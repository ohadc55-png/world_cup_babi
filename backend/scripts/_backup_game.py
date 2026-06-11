"""
Full read-only backup of a specific game (by invite_code) and all its users' data.

Dumps to a single JSON file with everything needed to restore manually if
something corrupts production:
  - game row
  - all users in the game (including pin_hash so login still works after restore)
  - predictions_matches / predictions_groups / predictions_tournament
  - scores, score_events
  - double_down_tokens
  - agent_conversations + agent_messages
  - push_subscriptions, notifications_log, reactions

The backup file is sensitive (contains pin_hash) — store it locally only,
never commit to git.

Usage:
    python -m scripts._backup_game X7KBRLHD
    python -m scripts._backup_game X7KBRLHD c:/path/to/output.json
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin


def fetch_table(table: str, filter_col: str, values: list) -> list[dict]:
    """SELECT * FROM <table> WHERE <col> IN <values>, paged in chunks of 1000."""
    out: list[dict] = []
    if not values:
        return out
    chunk = 1000
    for i in range(0, len(values), chunk):
        sub = values[i : i + chunk]
        res = supabase_admin.table(table).select("*").in_(filter_col, sub).execute()
        out.extend(res.data or [])
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m scripts._backup_game <INVITE_CODE> [output_path]")
        return 1

    invite_code = sys.argv[1].strip().upper()
    out_path = (
        Path(sys.argv[2])
        if len(sys.argv) >= 3
        else Path(__file__).parent.parent.parent
        / "backups"
        / f"{invite_code}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n=== Backing up game {invite_code} ===\n")

    # 1. resolve game
    game_res = (
        supabase_admin.table("games")
        .select("*")
        .eq("invite_code", invite_code)
        .maybe_single()
        .execute()
    )
    if not game_res or not game_res.data:
        print(f"[ERR] no game with invite_code='{invite_code}'")
        return 1
    game = game_res.data
    game_id = game["id"]
    print(f"  game: '{game['name']}' (id={game_id[:8]})")

    # 2. users in this game
    users = (
        supabase_admin.table("users")
        .select("*")
        .eq("game_id", game_id)
        .execute()
    ).data or []
    user_ids = [u["id"] for u in users]
    print(f"  users: {len(users)}")

    # 3. all per-user tables (filtered by user_id)
    predictions_matches = fetch_table("predictions_matches", "user_id", user_ids)
    predictions_groups = fetch_table("predictions_groups", "user_id", user_ids)
    predictions_tournament = fetch_table("predictions_tournament", "user_id", user_ids)
    scores = fetch_table("scores", "user_id", user_ids)
    score_events = fetch_table("score_events", "user_id", user_ids)
    double_down_tokens = fetch_table("double_down_tokens", "user_id", user_ids)
    push_subscriptions = fetch_table("push_subscriptions", "user_id", user_ids)
    notifications_log = fetch_table("notifications_log", "user_id", user_ids)
    reactions = fetch_table("reactions", "user_id", user_ids)
    agent_conversations = fetch_table("agent_conversations", "user_id", user_ids)
    conv_ids = [c["id"] for c in agent_conversations]
    agent_messages = fetch_table("agent_messages", "conversation_id", conv_ids)

    print(f"  predictions_matches: {len(predictions_matches)}")
    print(f"  predictions_groups: {len(predictions_groups)}")
    print(f"  predictions_tournament: {len(predictions_tournament)}")
    print(f"  scores: {len(scores)}")
    print(f"  score_events: {len(score_events)}")
    print(f"  double_down_tokens: {len(double_down_tokens)}")
    print(f"  push_subscriptions: {len(push_subscriptions)}")
    print(f"  notifications_log: {len(notifications_log)}")
    print(f"  reactions: {len(reactions)}")
    print(f"  agent_conversations: {len(agent_conversations)}")
    print(f"  agent_messages: {len(agent_messages)}")

    backup = {
        "backup_metadata": {
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "invite_code": invite_code,
            "game_id": game_id,
            "user_count": len(users),
            "note": (
                "Contains pin_hash and push subscription endpoints. SENSITIVE — "
                "store locally only, never commit."
            ),
        },
        "game": game,
        "users": users,
        "predictions_matches": predictions_matches,
        "predictions_groups": predictions_groups,
        "predictions_tournament": predictions_tournament,
        "scores": scores,
        "score_events": score_events,
        "double_down_tokens": double_down_tokens,
        "push_subscriptions": push_subscriptions,
        "notifications_log": notifications_log,
        "reactions": reactions,
        "agent_conversations": agent_conversations,
        "agent_messages": agent_messages,
    }

    out_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    print(f"\n[OK] wrote {out_path}  ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
