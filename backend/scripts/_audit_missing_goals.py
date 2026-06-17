"""
Read-only audit: for every finished match with an external_id, compare
goal counts between match_events (our DB) and ESPN summary.

Prints:
  - All matches where DB count != ESPN count
  - All ESPN team names that don't match either side in our DB (silent
    goal-drops in the sync_results _sync_match_events team-match logic)
  - Totals
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from app.db.supabase import supabase_admin
from app.crons.sync_results import ESPN_TO_DB_TEAM_NAME


def main() -> int:
    matches = (
        supabase_admin.table("matches")
        .select("id, team_home, team_away, status, external_id, score_home, score_away")
        .eq("status", "finished")
        .execute()
    ).data or []

    with_id = [m for m in matches if m.get("external_id")]
    print(f"Finished matches with external_id: {len(with_id)}/{len(matches)}")

    mismatches: list[tuple] = []
    total_db = 0
    total_espn = 0
    diffs: list[tuple] = []

    headers = {"User-Agent": "Mozilla/5.0"}
    with httpx.Client(timeout=15.0, headers=headers) as client:
        for m in with_id:
            db_events = (
                supabase_admin.table("match_events")
                .select("id", count="exact")
                .eq("match_id", m["id"])
                .eq("event_type", "goal")
                .execute()
            )
            db_count = db_events.count or 0
            total_db += db_count

            try:
                r = client.get(
                    f"http://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={m['external_id']}"
                )
                r.raise_for_status()
                data = r.json()
            except Exception as e:
                print(f"  match #{m['id']}: ESPN fetch failed: {e}")
                continue

            details = data.get("header", {}).get("competitions", [{}])[0].get("details", [])
            espn_goals = [d for d in details if d.get("scoringPlay")]
            total_espn += len(espn_goals)

            for g in espn_goals:
                tname = (g.get("team") or {}).get("displayName") or ""
                norm = ESPN_TO_DB_TEAM_NAME.get(tname, tname)
                if norm not in (m["team_home"], m["team_away"]):
                    scorer = (
                        (g.get("participants") or [{}])[0].get("athlete") or {}
                    ).get("displayName", "?")
                    clock = (g.get("clock") or {}).get("displayValue", "?")
                    mismatches.append(
                        (m["id"], m["team_home"], m["team_away"], tname, scorer, clock)
                    )

            if db_count != len(espn_goals):
                diffs.append((m["id"], m["team_home"], m["team_away"], db_count, len(espn_goals)))

    print()
    print(f"== TOTALS ==  DB goals: {total_db}  ESPN goals: {total_espn}  diff: {total_espn - total_db}")
    print()
    print(f"== Matches with goal-count mismatch ({len(diffs)}) ==")
    for mid, h, a, db_c, espn_c in diffs:
        print(f"  #{mid:3d}  {h} v {a}:  DB={db_c}  ESPN={espn_c}  diff={espn_c - db_c}")

    print()
    print(f"== Goals where ESPN team_name doesn't match DB ({len(mismatches)}) ==")
    seen_pairs: set[tuple[str, str, str]] = set()  # (espn_team, db_home, db_away)
    for mid, h, a, espn_team, scorer, clock in mismatches:
        print(f"  #{mid}  DB=[{h} v {a}]  ESPN_team=[{espn_team}]  scorer={scorer} {clock}")
        seen_pairs.add((espn_team, h, a))

    print()
    print("== Suggested alias additions ==")
    for espn_team, h, a in sorted(seen_pairs):
        # Pick whichever DB-team is "closer" (most overlapping letters) — heuristic
        match = h if h.lower().replace(" ", "") in espn_team.lower().replace(" ", "") or espn_team.lower().replace(" ", "") in h.lower().replace(" ", "") else a
        print(f'    "{espn_team}": "{match}",')

    return 0


if __name__ == "__main__":
    sys.exit(main())
