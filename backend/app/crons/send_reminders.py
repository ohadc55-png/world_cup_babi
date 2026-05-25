"""
שולח תזכורות push למשחקים שמתחילים בעוד 50-70 דקות (חלון של 20 דק').

תזמון: cron כל שעה (למשל ב-XX:05).
הסיבה לחלון: cron שרץ כל שעה יכול להחמיץ משחק בעוד דקה אם פועל בדיוק אחריו.
חלון של 20 דקות מבטיח שאף משחק לא ייפסל ושלא נשלח תזכורת פעמיים לאותו משחק
(idempotency אנו מקבלים מ-tag-uniqueness בצד הדפדפן).

הפעלה ידנית:
    python -m app.crons.send_reminders
    python -m app.crons.send_reminders --match-id N   # תזכורת מאולצת למשחק
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

from app.db.supabase import supabase_admin
from app.services import notifications

logger = logging.getLogger(__name__)

WINDOW_START = timedelta(minutes=50)   # משחק בעוד 50 דק' = שלח עכשיו
WINDOW_END = timedelta(minutes=70)     # ולא מעבר ל-70 דק'


def find_upcoming_matches() -> list[dict]:
    """משחקים שמתחילים בחלון הקרוב."""
    now = datetime.now(timezone.utc)
    window_min = (now + WINDOW_START).isoformat()
    window_max = (now + WINDOW_END).isoformat()

    res = (
        supabase_admin.table("matches")
        .select("*")
        .gte("kickoff_utc", window_min)
        .lte("kickoff_utc", window_max)
        .eq("status", "scheduled")
        .execute()
    )
    return res.data or []


def send_reminders_now() -> dict:
    matches = find_upcoming_matches()
    total_sent = 0
    for m in matches:
        r = notifications.trigger_match_reminders(m)
        total_sent += r.get("sent", 0)
    return {"matches": len(matches), "pushes_sent": total_sent}


def main() -> int:
    parser = argparse.ArgumentParser(description="Send 1h reminders for upcoming matches")
    parser.add_argument("--match-id", type=int, help="Force reminder for specific match")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.match_id:
        match = (
            supabase_admin.table("matches")
            .select("*")
            .eq("id", args.match_id)
            .limit(1)
            .execute()
        )
        if not match.data:
            print(f"[ERR] Match {args.match_id} not found")
            return 1
        r = notifications.trigger_match_reminders(match.data[0])
        print(f"[OK] Sent {r.get('sent', 0)} reminders for match {args.match_id}")
        return 0

    summary = send_reminders_now()
    print(f"[OK] Reminders run: {summary['matches']} matches, {summary['pushes_sent']} pushes sent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
