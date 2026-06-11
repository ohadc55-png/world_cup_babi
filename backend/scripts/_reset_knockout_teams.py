"""
Reset team_home/team_away of knockout matches back to their original placeholders
(e.g. 'W101', '1A', '3A/B/C/D/F') from openfootball.

Why: during the simulation, bracket_resolver filled the placeholders with real
country names (Cape Verde, Argentina, ...). After the full DB reset, those names
remained because the reset only cleared scores/status/locks — not team columns.

This script:
- Fetches the canonical fixtures from openfootball
- For matches where stage != 'group': updates ONLY team_home / team_away
- Touches NOTHING else (FIFA ranks, kickoff, status, predictions, scores, users)
- Group-stage matches are skipped (their team names are real countries from day 1)

Dry-run by default. Pass --yes (or set CONFIRM=YES) to apply.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from app.db.supabase import supabase_admin
from app.services.openfootball import OPENFOOTBALL_URL, determine_stage


async def fetch_canonical() -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(OPENFOOTBALL_URL)
        r.raise_for_status()
        return r.json().get("matches", [])


def build_diff(canonical: list[dict]) -> list[dict]:
    """Returns list of {id, stage, current_home, current_away, target_home, target_away} for knockout matches that need update."""
    current_rows = (
        supabase_admin.table("matches")
        .select("id, stage, team_home, team_away")
        .order("id")
        .execute()
    ).data or []
    current_by_id = {m["id"]: m for m in current_rows}

    diff = []
    for idx, m in enumerate(canonical, start=1):
        stage = determine_stage(m["round"])
        if stage == "group":
            continue  # skip group matches — their team names are real and unchanged
        cur = current_by_id.get(idx)
        if not cur:
            continue
        target_home = m["team1"]
        target_away = m["team2"]
        if cur["team_home"] != target_home or cur["team_away"] != target_away:
            diff.append({
                "id": idx,
                "stage": stage,
                "current_home": cur["team_home"],
                "current_away": cur["team_away"],
                "target_home": target_home,
                "target_away": target_away,
            })
    return diff


def main() -> int:
    print("Fetching canonical fixtures from openfootball...")
    canonical = asyncio.run(fetch_canonical())
    print(f"Got {len(canonical)} matches\n")

    diff = build_diff(canonical)
    print(f"=== {len(diff)} knockout matches need team_home/team_away reset ===\n")
    for d in diff:
        print(f"  #{d['id']:3d} ({d['stage']:11s}): "
              f"'{d['current_home']}' vs '{d['current_away']}'"
              f"  ->  '{d['target_home']}' vs '{d['target_away']}'")

    if not diff:
        print("\n[OK] nothing to do — all knockout matches already at canonical placeholders.")
        return 0

    confirm = os.environ.get("CONFIRM") == "YES" or "--yes" in sys.argv
    if not confirm:
        print("\n[DRY RUN] set CONFIRM=YES (or pass --yes) to apply.")
        return 0

    print("\n!! CONFIRMED — applying updates...")
    for d in diff:
        supabase_admin.table("matches").update({
            "team_home": d["target_home"],
            "team_away": d["target_away"],
        }).eq("id", d["id"]).execute()
        print(f"  [OK] #{d['id']}")

    print(f"\n[DONE] reset {len(diff)} knockout matches. User predictions untouched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
