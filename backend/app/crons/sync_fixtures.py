"""
סקריפט CLI להרצה ידנית של sync_fixtures.

שימוש (לוקאלי):
    conda run -n my_conda python -m app.crons.sync_fixtures

בעתיד יעבור ל-Railway cron (יומי, בבוקר).
"""
import asyncio
import logging
import sys

from app.services.openfootball import sync_fixtures

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def main() -> int:
    stats = asyncio.run(sync_fixtures())
    print(f"✓ Fixtures synced: fetched={stats['fetched']}, updated={stats['inserted_or_updated']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
