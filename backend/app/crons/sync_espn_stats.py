"""
Cron — מסנכרן סטטיסטיקות עומק למשחקים שיתחילו ב-48 שעות הקרובות.

הפעלה ידנית:
    conda run -n my_conda python -m app.crons.sync_espn_stats

בעתיד ב-Railway:
    cron: "0 20 * * *"   (כל יום ב-20:00 UTC)
"""
from __future__ import annotations

import logging
import sys

from app.services.espn_stats import sync_upcoming_matches

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main() -> int:
    summary = sync_upcoming_matches(hours_ahead=48)
    print(
        f"✓ Stats synced: scanned {summary['matches_found']} matches in next "
        f"{summary['scanned_window_hours']}h, processed {summary['processed']}, "
        f"errors {len(summary['errors'])}"
    )
    if summary["errors"]:
        for err in summary["errors"]:
            print(f"  ✗ match {err['match_id']}: {err['error']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
