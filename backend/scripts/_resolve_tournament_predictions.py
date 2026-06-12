"""
Resolve users' free-text top_scorer / top_assister predictions to ESPN
player IDs. Writes results to predictions_tournament.top_scorer_player_id +
top_scorer_canonical (same for assister).

Match strategy:
1. Build canonical aliases dict — each player has Hebrew + English variants.
2. For each user prediction text, normalize (lowercase, strip whitespace,
   remove trailing punctuation), then check if ANY alias is contained in it
   (substring match handles variants like "אמבפה!", " למינא ימל").
3. If exactly one player matches, resolve. If multiple match, prefer the
   one with the longest matching alias. If none match, mark as UNRESOLVED.

Usage:
    python -m scripts._resolve_tournament_predictions          # dry-run (shows resolution)
    python -m scripts._resolve_tournament_predictions --apply  # writes to DB
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin

# ESPN player IDs verified by fetching team rosters today (2026-06-13).
# Aliases include all spellings we observed in the predictions data + a few
# more (transliterations, common typos).
PLAYERS = [
    {
        "id": "231388",
        "canonical": "Kylian Mbappé",
        "team": "France",
        "aliases": ["אמבפה", "מבפה", "קיליאן אמבפה", "אמבאפה", "mbappe", "mbappé", "kylian"],
    },
    {
        "id": "142200",
        "canonical": "Harry Kane",
        "team": "England",
        "aliases": ["הארי קיין", "קיין", "harry kane", "kane"],
    },
    {
        "id": "277206",
        "canonical": "Julián Álvarez",
        "team": "Argentina",
        "aliases": ["חוליאן אלברס", "חוליאן אלוורז", "אלברס", "אלוורז", "alvarez", "álvarez", "julián"],
    },
    {
        "id": "45843",
        "canonical": "Lionel Messi",
        "team": "Argentina",
        "aliases": ["מסי", "messi", "ליונל מסי"],
    },
    {
        "id": "362150",
        "canonical": "Lamine Yamal",
        "team": "Spain",
        "aliases": ["יאמל", "ימאל", "לאמין יאמל", "לאמין ימאל", "למינא ימל",
                    "תאמין יאמל",   # likely typo of "לאמין"
                    "yamal", "lamine"],
    },
    {
        "id": "250465",
        "canonical": "Pedri",
        "team": "Spain",
        "aliases": ["פדרי", "pedri"],
    },
    {
        "id": "124091",
        "canonical": "Bruno Fernandes",
        "team": "Portugal",
        "aliases": ["ברונו פרננדס", "ברונו פרננדש", "ברונו פרנדדש", "ברונו פרננדז",
                    "ברונו פאננדש", "פרננדס", "פרננדש", "fernandes", "bruno"],
    },
    {
        "id": "252107",
        "canonical": "Vinícius Júnior",
        "team": "Brazil",
        "aliases": ["וניציוס", "ויניסיוס", "vinicius", "vinícius", "vini"],
    },
]


def _normalize(s: str) -> str:
    return (s or "").strip().lower()


def resolve_text(text: str) -> tuple[str | None, str | None, str]:
    """Returns (player_id, canonical, debug). player_id=None if unresolved."""
    if not text or not text.strip():
        return None, None, "empty"
    norm = _normalize(text)
    # find all players where ANY alias matches (substring)
    candidates: list[tuple[dict, int]] = []  # (player, longest alias match length)
    for p in PLAYERS:
        longest = 0
        for a in p["aliases"]:
            na = _normalize(a)
            if na and na in norm:
                if len(na) > longest:
                    longest = len(na)
        if longest > 0:
            candidates.append((p, longest))
    if not candidates:
        return None, None, "no match"
    # prefer longest alias match
    candidates.sort(key=lambda c: -c[1])
    best = candidates[0][0]
    if len(candidates) > 1 and candidates[0][1] == candidates[1][1]:
        # ambiguous — same length match for 2+ players
        return best["id"], best["canonical"], f"AMBIGUOUS: {candidates[0][0]['canonical']} vs {candidates[1][0]['canonical']}"
    return best["id"], best["canonical"], f"match (alias len {candidates[0][1]})"


def main() -> int:
    apply = "--apply" in sys.argv

    rows = (
        supabase_admin.table("predictions_tournament")
        .select("user_id, top_scorer, top_assister")
        .execute()
    ).data or []

    # join with usernames for nicer output
    user_ids = [r["user_id"] for r in rows]
    if user_ids:
        users = (
            supabase_admin.table("users")
            .select("id, username")
            .in_("id", user_ids)
            .execute()
        ).data or []
        username_by_id = {u["id"]: u["username"] for u in users}
    else:
        username_by_id = {}

    print(f"\n=== Resolving {len(rows)} tournament prediction rows ===")
    print(f"Mode: {'APPLY (writing to DB)' if apply else 'DRY-RUN'}\n")

    stats = {"scorer_resolved": 0, "scorer_unresolved": 0,
             "assister_resolved": 0, "assister_unresolved": 0}
    unresolved_examples: list[tuple[str, str, str, str]] = []

    for r in rows:
        uname = username_by_id.get(r["user_id"], "?")
        ts = r.get("top_scorer") or ""
        ta = r.get("top_assister") or ""

        ts_id, ts_canon, ts_dbg = resolve_text(ts)
        ta_id, ta_canon, ta_dbg = resolve_text(ta)

        ts_status = ts_canon if ts_id else "UNRESOLVED"
        ta_status = ta_canon if ta_id else "UNRESOLVED"
        print(f"  {uname:25s}")
        print(f"      scorer:   '{ts}' -> {ts_status:25s}  [{ts_dbg}]")
        print(f"      assister: '{ta}' -> {ta_status:25s}  [{ta_dbg}]")

        if ts_id:
            stats["scorer_resolved"] += 1
        else:
            stats["scorer_unresolved"] += 1
            if ts.strip():
                unresolved_examples.append((uname, "scorer", ts, ts_dbg))
        if ta_id:
            stats["assister_resolved"] += 1
        else:
            stats["assister_unresolved"] += 1
            if ta.strip():
                unresolved_examples.append((uname, "assister", ta, ta_dbg))

        if apply:
            update_data = {
                "top_scorer_player_id": ts_id,
                "top_scorer_canonical": ts_canon,
                "top_assister_player_id": ta_id,
                "top_assister_canonical": ta_canon,
            }
            supabase_admin.table("predictions_tournament").update(update_data).eq("user_id", r["user_id"]).execute()

    print(f"\n=== Summary ===")
    print(f"  Scorer:   resolved={stats['scorer_resolved']}, unresolved={stats['scorer_unresolved']}")
    print(f"  Assister: resolved={stats['assister_resolved']}, unresolved={stats['assister_unresolved']}")
    if unresolved_examples:
        print(f"\n  Unresolved texts (non-empty):")
        for uname, field, text, dbg in unresolved_examples:
            print(f"    - {uname} {field}: '{text}' [{dbg}]")

    if not apply:
        print(f"\n(dry-run) pass --apply to write to DB")
    else:
        print(f"\n[OK] DB updated")

    return 0


if __name__ == "__main__":
    sys.exit(main())
