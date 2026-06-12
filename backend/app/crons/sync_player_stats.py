"""
סנכרון מצטייני הטורניר (top scorers + top assisters) מ-ESPN.

תזמון בייצור (Railway): כל שעה — דרך ה-in-process scheduler ב-main.py.
לוקאלי: `python -m app.crons.sync_player_stats` להרצה חד-פעמית.

זרימה:
1. קריאה ל-ESPN /statistics — מחזיר goalsLeaders + assistsLeaders.
2. דילול ל-top 10 לכל קטגוריה.
3. delete-and-replace ב-tournament_top_athletes (טבלה קטנה, 20 שורות סה"כ).

אם ESPN לא נגיש או מחזיר ריק — לא נוגעים בטבלה הקיימת (הנתונים האחרונים
נשארים זמינים למשתמשים).
"""
from __future__ import annotations

import logging
import sys

from app.db.supabase import supabase_admin
from app.services import espn

logger = logging.getLogger(__name__)


def sync_player_stats_now() -> dict:
    """נקודת כניסה ל-scheduler. מחזיר סטטיסטיקה של הריצה."""
    leaders = espn.fetch_tournament_leaders()
    goals = leaders.get("goals", [])
    assists = leaders.get("assists", [])

    written = {"top_scorers": 0, "top_assisters": 0}

    for cat_name, rows in (("top_scorers", goals), ("top_assisters", assists)):
        if not rows:
            # אם ESPN החזיר ריק — לא נוגעים בטבלה (משאירים נתונים ישנים)
            continue
        # delete-and-replace pattern
        supabase_admin.table("tournament_top_athletes").delete().eq("category", cat_name).execute()
        insert_rows = []
        for i, ld in enumerate(rows[:10], start=1):
            insert_rows.append({
                "category": cat_name,
                "rank": i,
                "player_name": ld["player_name"],
                "player_id": ld.get("player_id") or None,
                "team_name": ld.get("team_name") or None,
                "matches": ld.get("matches", 0),
                "value": ld.get("value", 0),
                "display_value": ld.get("display_value") or None,
            })
        if insert_rows:
            supabase_admin.table("tournament_top_athletes").insert(insert_rows).execute()
            written[cat_name] = len(insert_rows)

    return written


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    res = sync_player_stats_now()
    print(f"✓ Synced player stats: top_scorers={res['top_scorers']}, top_assisters={res['top_assisters']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
