"""
Admin: remove a user from a game — soft (game_id=NULL) or hard (delete row).

Usage:
    # 1. list users in a game (read-only):
    python -m scripts._remove_user X7KBRLHD

    # 2. soft remove (keep account + predictions, just unlink from game):
    python -m scripts._remove_user X7KBRLHD <username>

    # 3. hard delete (CASCADE wipes everything they did):
    python -m scripts._remove_user X7KBRLHD <username> --delete

Hard delete is irreversible without a backup. Use _backup_game.py first.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.supabase import supabase_admin


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m scripts._remove_user <INVITE_CODE> [<username>] [--delete]")
        return 1

    invite_code = sys.argv[1].strip().upper()

    # 1. find the game
    game_res = (
        supabase_admin.table("games")
        .select("id, name, owner_user_id")
        .eq("invite_code", invite_code)
        .maybe_single()
        .execute()
    )
    if not game_res or not game_res.data:
        print(f"[ERR] no game with invite_code='{invite_code}'")
        return 1
    game = game_res.data
    print(f"\n=== game '{game['name']}' ({game['id'][:8]}) ===\n")

    # 2. list users in game
    users = (
        supabase_admin.table("users")
        .select("id, username, is_admin")
        .eq("game_id", game["id"])
        .order("username")
        .execute()
    ).data or []
    print(f"members ({len(users)}):")
    for u in users:
        marker = ""
        if u["id"] == game["owner_user_id"]:
            marker = "  [OWNER]"
        elif u.get("is_admin"):
            marker = "  [ADMIN]"
        print(f"  - {u['username']:30s}  (id={u['id'][:8]}){marker}")

    if len(sys.argv) < 3:
        print("\nTo remove a user, run with their username (+ --delete for hard delete):")
        print(f"  python -m scripts._remove_user {invite_code} <username>")
        print(f"  python -m scripts._remove_user {invite_code} <username> --delete")
        return 0

    target_username = sys.argv[2]
    hard_delete = "--delete" in sys.argv

    target = next((u for u in users if u["username"].lower() == target_username.lower()), None)
    if not target:
        print(f"\n[ERR] no user '{target_username}' in this game")
        return 1

    if target["id"] == game["owner_user_id"]:
        print(f"\n[ERR] cannot remove the owner. Transfer ownership first.")
        return 1

    if hard_delete:
        print(f"\n!! HARD DELETE: '{target['username']}' — predictions, scores, DD tokens, ")
        print(f"   agent convo, push subs will all be wiped via CASCADE. Irreversible.")
        # No interactive prompt — script requires --delete which is explicit enough
        supabase_admin.table("users").delete().eq("id", target["id"]).execute()
        print(f"   [OK] deleted user row + all related data")
    else:
        print(f"\n>> SOFT REMOVE: '{target['username']}' — account stays, predictions kept, ")
        print(f"   just unlinked from the game (game_id=NULL).")
        supabase_admin.table("users").update({"game_id": None}).eq("id", target["id"]).execute()
        print(f"   [OK] user removed from game")

    return 0


if __name__ == "__main__":
    sys.exit(main())
