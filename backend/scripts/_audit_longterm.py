"""
Audit which users in a game are missing long-term predictions:
  - predictions_tournament (one row per user, 10 fields: winner, finalists,
    semifinalists, top scorer, top assister, golden ball)
  - predictions_groups (12 rows per user, one per group A-L,
    fields: team_1st/2nd/3rd/4th)

Usage:
    python -m scripts._audit_longterm X7KBRLHD
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin

TOURNAMENT_FIELDS = [
    ("winner", "אלופה"),
    ("finalist_1", "פיינליסטית 1"),
    ("finalist_2", "פיינליסטית 2"),
    ("semifinalist_1", "חצי-גמרנית 1"),
    ("semifinalist_2", "חצי-גמרנית 2"),
    ("semifinalist_3", "חצי-גמרנית 3"),
    ("semifinalist_4", "חצי-גמרנית 4"),
    ("top_scorer", "מלך שערים"),
    ("top_assister", "מלך בישולים"),
    ("golden_ball", "כדור הזהב"),
]

ALL_GROUPS = list("ABCDEFGHIJKL")

GROUP_POSITION_FIELDS = [
    ("team_1st", "מקום 1"),
    ("team_2nd", "מקום 2"),
    ("team_3rd", "מקום 3"),
    ("team_4th", "מקום 4"),
]


def audit_user(user: dict) -> dict:
    """Return what's missing for this user."""
    user_id = user["id"]
    username = user["username"]
    missing = {
        "username": username,
        "user_id": user_id,
        "missing_tournament_fields": [],
        "missing_groups": [],            # entire groups missing
        "partial_groups": [],            # group present but some positions missing
        "tournament_row_missing": False,
    }

    # 1. tournament row
    t = (
        supabase_admin.table("predictions_tournament")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not t or not t.data:
        missing["tournament_row_missing"] = True
        missing["missing_tournament_fields"] = [label for _, label in TOURNAMENT_FIELDS]
    else:
        for field, label in TOURNAMENT_FIELDS:
            if not t.data.get(field):
                missing["missing_tournament_fields"].append(label)

    # 2. group rows
    gs = (
        supabase_admin.table("predictions_groups")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    ).data or []
    by_group = {g["group_name"]: g for g in gs}

    for gname in ALL_GROUPS:
        if gname not in by_group:
            missing["missing_groups"].append(gname)
        else:
            row = by_group[gname]
            partial = []
            for field, label in GROUP_POSITION_FIELDS:
                if not row.get(field):
                    partial.append(label)
            if partial:
                missing["partial_groups"].append({"group": gname, "missing": partial})

    return missing


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m scripts._audit_longterm <INVITE_CODE>")
        return 1

    invite_code = sys.argv[1].strip().upper()

    game = (
        supabase_admin.table("games")
        .select("id, name")
        .eq("invite_code", invite_code)
        .maybe_single()
        .execute()
    )
    if not game or not game.data:
        print(f"[ERR] no game with invite_code='{invite_code}'")
        return 1

    print(f"\n=== Audit: '{game.data['name']}' ({invite_code}) ===\n")

    users = (
        supabase_admin.table("users")
        .select("id, username")
        .eq("game_id", game.data["id"])
        .order("username")
        .execute()
    ).data or []
    print(f"Members: {len(users)}\n")

    complete_count = 0
    issues = []
    for u in users:
        m = audit_user(u)
        has_issue = (
            m["tournament_row_missing"]
            or len(m["missing_tournament_fields"]) > 0
            or len(m["missing_groups"]) > 0
            or len(m["partial_groups"]) > 0
        )
        if not has_issue:
            complete_count += 1
        else:
            issues.append(m)

    # === Report ===
    print(f"[OK] {complete_count}/{len(users)} users with complete long-term predictions\n")

    if not issues:
        print("All users are fully covered. Nothing to fix.")
        return 0

    print(f"[!] {len(issues)} users missing data:")
    print("=" * 70)
    for m in issues:
        print(f"\n  --- {m['username']} ---")
        if m["tournament_row_missing"]:
            print(f"     X tournament row entirely missing (no row in predictions_tournament)")
            print(f"       missing all: {', '.join(m['missing_tournament_fields'])}")
        elif m["missing_tournament_fields"]:
            print(f"     X tournament fields missing ({len(m['missing_tournament_fields'])}):")
            for f in m["missing_tournament_fields"]:
                print(f"        - {f}")
        if m["missing_groups"]:
            print(f"     X group standings ENTIRELY missing ({len(m['missing_groups'])}):")
            for g in m["missing_groups"]:
                print(f"        - group {g}")
        if m["partial_groups"]:
            print(f"     X group standings partially missing ({len(m['partial_groups'])}):")
            for pg in m["partial_groups"]:
                print(f"        - group {pg['group']}: {', '.join(pg['missing'])}")

    print("\n" + "=" * 70)
    print(f"Summary: {complete_count} complete, {len(issues)} with missing data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
