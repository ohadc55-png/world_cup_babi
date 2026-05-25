"""
Full DB reset — wipes ALL user state, keeps ONLY the Mundial fixtures (matches table)
with runtime fields cleared (status=scheduled, no scores, not locked).

Run from backend/ with the .env loaded:
    conda run -n my_conda python -m scripts._full_reset

Safety: requires CONFIRM=YES env var or --yes flag to actually run.
"""
import os
import sys
from pathlib import Path

# bootstrap path so we can import app.*
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin

IMPOSSIBLE_UUID = "00000000-0000-0000-0000-000000000000"
IMPOSSIBLE_INT = -1


def count(table: str) -> int:
    res = supabase_admin.table(table).select("*", count="exact").limit(1).execute()
    return res.count or 0


def show_state(label: str) -> None:
    print(f"\n=== {label} ===")
    for t in [
        "users", "games", "predictions_matches", "predictions_groups",
        "predictions_tournament", "scores", "score_events", "double_down_tokens",
        "agent_conversations", "agent_messages", "match_stats_cache",
        "push_subscriptions", "reactions", "notifications_log", "app_config",
        "matches",
    ]:
        try:
            n = count(t)
            print(f"  {t:30s} {n:>6}")
        except Exception as e:
            print(f"  {t:30s} ERR: {e}")


def reset() -> None:
    # 1. delete all users — cascades to games, predictions_*, scores, score_events,
    #    double_down_tokens, push_subscriptions, reactions, notifications_log,
    #    agent_conversations -> agent_messages
    print("\n[1/4] deleting all users (cascade)...")
    supabase_admin.table("users").delete().neq("id", IMPOSSIBLE_UUID).execute()

    # 2. wipe match_stats_cache (FK to matches, not users — needs explicit delete)
    print("[2/4] wiping match_stats_cache...")
    supabase_admin.table("match_stats_cache").delete().neq("match_id", IMPOSSIBLE_INT).execute()

    # 3. reset matches runtime state (keep schedule, teams, FIFA ranks, etc.)
    print("[3/4] resetting matches to scheduled/no-score/unlocked...")
    supabase_admin.table("matches").update({
        "status": "scheduled",
        "score_home": None,
        "score_away": None,
        "score_home_ht": None,
        "score_away_ht": None,
        "score_home_pen": None,
        "score_away_pen": None,
        "finished_at": None,
        "predictions_locked": False,
    }).neq("id", IMPOSSIBLE_INT).execute()

    # 4. clear app_config (might contain demo simulation state)
    print("[4/4] clearing app_config...")
    supabase_admin.table("app_config").delete().neq("key", "__never_match__").execute()


def main() -> int:
    confirm = os.environ.get("CONFIRM") == "YES" or "--yes" in sys.argv

    show_state("BEFORE")

    if not confirm:
        print("\n[DRY RUN] set CONFIRM=YES env var (or pass --yes) to actually wipe.")
        return 0

    print("\n!! CONFIRMED — wiping in 2 seconds...")
    import time
    time.sleep(2)
    reset()

    show_state("AFTER")
    print("\n[DONE] full reset complete. Mundial fixtures preserved, all user state wiped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
