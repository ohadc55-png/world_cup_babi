"""Read-only inspection of DB state — what does the app see?"""
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))
from app.db.supabase import supabase_admin


def main() -> int:
    print("\n=== DB STATE INSPECTION ===\n")

    # 1. matches summary
    res = (
        supabase_admin.table("matches")
        .select("id, kickoff_utc, status, predictions_locked, score_home, score_away")
        .order("kickoff_utc")
        .execute()
    )
    matches = res.data or []
    print(f"matches total: {len(matches)}")

    if matches:
        first = matches[0]
        last = matches[-1]
        print(f"  first kickoff_utc: {first['kickoff_utc']}  status={first['status']}")
        print(f"  last  kickoff_utc: {last['kickoff_utc']}   status={last['status']}")

        now = datetime.now(timezone.utc)
        print(f"  now (UTC): {now.isoformat()}")
        first_dt = datetime.fromisoformat(first["kickoff_utc"].replace("Z", "+00:00"))
        delta = first_dt - now
        print(f"  delta until first kickoff: {delta}")

    # status counts
    from collections import Counter
    status_counts = Counter(m["status"] for m in matches)
    print(f"\nstatus breakdown:")
    for s, c in sorted(status_counts.items()):
        print(f"  {s:15s} {c:>4}")

    # predictions_locked counts
    locked = sum(1 for m in matches if m["predictions_locked"])
    print(f"\npredictions_locked=true: {locked}")

    # scored matches
    scored = sum(1 for m in matches if m["score_home"] is not None)
    print(f"matches with score:       {scored}")

    # 2. _tournament_has_started would return what?
    started_by_date = (
        matches and
        datetime.fromisoformat(matches[0]["kickoff_utc"].replace("Z", "+00:00")) <= datetime.now(timezone.utc)
    )
    started_by_status = any(m["status"] in ("live", "finished") for m in matches)
    print(f"\ntournament_has_started decision:")
    print(f"  by date (first kickoff in past): {started_by_date}")
    print(f"  by status (any live/finished):   {started_by_status}")
    print(f"  FINAL: {started_by_date or started_by_status}")

    # 3. user/game count
    for t in ["users", "games", "predictions_matches", "scores", "double_down_tokens",
              "agent_conversations", "match_stats_cache"]:
        try:
            r = supabase_admin.table(t).select("*", count="exact").limit(1).execute()
            print(f"  {t:30s} {r.count or 0}")
        except Exception as e:
            print(f"  {t:30s} ERR")

    return 0


if __name__ == "__main__":
    sys.exit(main())
