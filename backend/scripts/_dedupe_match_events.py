"""
Cleanup of duplicate goal/red-card rows in match_events caused by a sync bug
where espn_event_id was synthesized from clock.value (seconds), which drifts
±1s between ESPN snapshots and produced fresh-looking IDs for the same event.

Strategy:
  Group by (match_id, primary_player_id, minute, event_type, team).
  Within each group keep ONE row:
    - prefer the row whose assister is NOT NULL (more complete data)
    - tiebreak by lowest espn_event_id (deterministic, oldest sync wins)

Dry-run by default: lists what would be deleted.
Pass --apply to perform the delete.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin


def main() -> int:
    apply = "--apply" in sys.argv

    rows = (
        supabase_admin.table("match_events")
        .select("id, match_id, event_type, team, minute, primary_player, primary_player_id, assister, espn_event_id")
        .execute()
    ).data or []

    print(f"Loaded {len(rows)} match_events rows")

    # Group key — what makes two rows "the same event"
    def key(r):
        return (
            r["match_id"],
            r["event_type"],
            r["team"],
            r["minute"],
            r.get("primary_player_id") or r.get("primary_player"),
        )

    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        groups.setdefault(key(r), []).append(r)

    dupes = {k: rs for k, rs in groups.items() if len(rs) > 1}
    print(f"Duplicate groups: {len(dupes)}")
    print()

    to_delete: list[str] = []
    for k, rs in sorted(dupes.items()):
        # sort so the winner is at index 0:
        #   has_assister=True first, then lowest espn_event_id
        rs.sort(key=lambda x: (x.get("assister") is None, x.get("espn_event_id") or ""))
        keeper = rs[0]
        losers = rs[1:]
        match_id, ev_type, team, minute, _ = k
        print(f"  match={match_id:3d}  {ev_type:9s}  {team:5s}  min={minute:7s}  player={keeper.get('primary_player')}")
        print(f"      keep    espn_id={keeper.get('espn_event_id')}  assister={keeper.get('assister') or '-'}")
        for x in losers:
            print(f"      DELETE  espn_id={x.get('espn_event_id')}  assister={x.get('assister') or '-'}")
            to_delete.append(x["id"])

    print()
    print(f"Total rows to delete: {len(to_delete)}")
    if not to_delete:
        print("Nothing to do.")
        return 0

    if not apply:
        print("(dry-run) pass --apply to perform the delete")
        return 0

    # batch delete — supabase-py doesn't accept .in_() on .delete() with > N ids, but
    # the list here is tiny (≤ a few dozen). Loop one-by-one.
    for rid in to_delete:
        supabase_admin.table("match_events").delete().eq("id", rid).execute()
    print(f"[OK] Deleted {len(to_delete)} duplicate rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
