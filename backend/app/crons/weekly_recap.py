"""
סיכום שבועי — push לכל המשתמשים במשחק.

תזמון: cron כל יום ראשון 19:00 שעון ישראל (= 16:00 UTC בקיץ).
המידע: סך נקודות + מיקום נוכחי. אפשר להעשיר עם "המשחק הכי טוב שלך השבוע".

הפעלה ידנית:
    python -m app.crons.weekly_recap
"""
from __future__ import annotations

import logging
import sys

from app.services import notifications


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    summary = notifications.trigger_weekly_recap()
    print(f"[OK] Weekly recap sent: {summary['sent']}/{summary['users']} users notified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
