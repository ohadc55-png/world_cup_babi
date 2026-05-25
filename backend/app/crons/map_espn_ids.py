"""
חד-פעמי: מילוי matches.external_id עם ESPN match IDs.

זרימה:
1. סורק את ESPN לטווח תאריכי המונדיאל (11/6 - 19/7 2026).
2. לכל ESPN event מנסה להתאים אותו ל-match שלנו לפי:
   - תאריך + שעת kickoff (סבילות 30 דק')
   - שמות 2 הקבוצות
3. מעדכן את external_id.

טיפול בשמות לא תואמים בין openfootball ל-ESPN (USA vs United States וכו'):
מילון `TEAM_NAME_ALIASES` מתחת - להוסיף שם כשמתגלה אי-התאמה.

הפעלה:
    python -m app.crons.map_espn_ids                    # מצב רגיל
    python -m app.crons.map_espn_ids --dry-run          # רק מראה התאמות
    python -m app.crons.map_espn_ids --past             # מצב בדיקה - סורק 2022
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime, timedelta, timezone

from app.db.supabase import supabase_admin
from app.services import espn

logger = logging.getLogger(__name__)

# מונדיאל 2026: 11 ביוני - 19 ביולי
TOURNAMENT_START = date(2026, 6, 11)
TOURNAMENT_END = date(2026, 7, 19)

# טווח 2022 לבדיקות (--past)
PAST_START = date(2022, 11, 20)
PAST_END = date(2022, 12, 18)

# סבילות זמן בהתאמת kickoff (ESPN לפעמים מתעדכן מעט)
KICKOFF_TOLERANCE = timedelta(minutes=30)


# שמות שונים בין openfootball ל-ESPN - הוסף כאן כשמתגלה
TEAM_NAME_ALIASES: dict[str, list[str]] = {
    # openfootball name: [acceptable ESPN names]
    "USA": ["USA", "United States"],
    "South Korea": ["South Korea", "Korea Republic"],
    "Iran": ["Iran", "IR Iran"],
    "Czech Republic": ["Czech Republic", "Czechia"],
    "Cape Verde": ["Cape Verde", "Cabo Verde"],
    "DR Congo": ["DR Congo", "Congo DR", "Congo Democratic Republic"],
    "Bosnia & Herzegovina": [
        "Bosnia & Herzegovina",
        "Bosnia and Herzegovina",
        "Bosnia-Herzegovina",
    ],
    "Ivory Coast": ["Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire"],
    "Turkey": ["Turkey", "Türkiye", "Turkiye"],
    "Curaçao": ["Curaçao", "Curacao"],
}


def _normalize(name: str) -> str:
    return name.strip().lower()


def _names_match(our_name: str, espn_name: str) -> bool:
    if _normalize(our_name) == _normalize(espn_name):
        return True
    aliases = TEAM_NAME_ALIASES.get(our_name, [])
    return any(_normalize(a) == _normalize(espn_name) for a in aliases)


def _kickoffs_match(our_kickoff: datetime, espn_kickoff_str: str) -> bool:
    espn_kickoff = datetime.fromisoformat(espn_kickoff_str.replace("Z", "+00:00"))
    return abs(our_kickoff - espn_kickoff) <= KICKOFF_TOLERANCE


def find_match_by_event(our_matches: list[dict], event: dict) -> dict | None:
    """מחפש match שלנו שמתאים ל-ESPN event."""
    espn_home = event["team_home"]
    espn_away = event["team_away"]
    espn_kickoff_str = event["kickoff_utc"]

    for m in our_matches:
        our_home = m["team_home"]
        our_away = m["team_away"]
        our_kickoff = datetime.fromisoformat(
            m["kickoff_utc"].replace("Z", "+00:00")
        )

        # בודקים שני סדרים - ESPN לפעמים מהפך home/away (אצטדיון נייטרלי)
        names_ok = (
            (_names_match(our_home, espn_home) and _names_match(our_away, espn_away))
            or (_names_match(our_home, espn_away) and _names_match(our_away, espn_home))
        )
        if names_ok and _kickoffs_match(our_kickoff, espn_kickoff_str):
            return m

    return None


def map_all(dry_run: bool = False, use_past: bool = False) -> dict:
    """
    זרימה:
    1. שולפים את כל המשחקים שלנו (או רק שלב הבתים אם use_past=False כי פלייאוף עוד לא ידועות הקבוצות).
    2. עוברים יום-יום על תאריכי המונדיאל.
    3. מתאימים ESPN event למשחק שלנו.
    4. מעדכנים external_id.
    """
    start = PAST_START if use_past else TOURNAMENT_START
    end = PAST_END if use_past else TOURNAMENT_END

    our_matches_res = (
        supabase_admin.table("matches")
        .select("id, team_home, team_away, kickoff_utc, external_id, stage")
        .order("kickoff_utc")
        .execute()
    )
    our_matches = our_matches_res.data or []
    print(f"Our DB has {len(our_matches)} matches")

    if use_past:
        # מצב בדיקה - לא נכתוב ל-DB, רק נדפיס
        print("USE_PAST mode - only printing, NO writes")
        dry_run = True

    # מסננים החוצה משחקים שכבר ממופים (אלא אם --force)
    unmapped = [m for m in our_matches if not m.get("external_id")]
    print(f"Unmapped: {len(unmapped)}")
    if not unmapped and not use_past:
        print("All matches already mapped. Use --force to re-map (not implemented).")
        return {"mapped": 0, "skipped_all": True}

    summary = {
        "espn_events_found": 0,
        "matched": 0,
        "no_match": [],
        "already_mapped_skipped": len(our_matches) - len(unmapped),
        "updates": [],
    }

    current = start
    while current <= end:
        events = espn.fetch_scoreboard(current)
        summary["espn_events_found"] += len(events)

        for ev in events:
            target_pool = our_matches if use_past else unmapped
            our_match = find_match_by_event(target_pool, ev)
            if not our_match:
                summary["no_match"].append({
                    "espn_id": ev["espn_id"],
                    "teams": f"{ev['team_home']} vs {ev['team_away']}",
                    "date": ev["kickoff_utc"][:10],
                })
                continue

            summary["matched"] += 1
            summary["updates"].append({
                "our_match_id": our_match["id"],
                "espn_id": ev["espn_id"],
                "teams": f"{our_match['team_home']} vs {our_match['team_away']}",
                "stage": our_match["stage"],
            })

            if not dry_run:
                supabase_admin.table("matches").update({
                    "external_id": ev["espn_id"],
                }).eq("id", our_match["id"]).execute()

        current = date.fromordinal(current.toordinal() + 1)

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Map ESPN match IDs to our matches table")
    parser.add_argument("--dry-run", action="store_true", help="Show matches without writing")
    parser.add_argument("--past", action="store_true",
                        help="Test mode: scan 2022 World Cup instead of 2026")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    prefix = "(DRY) " if args.dry_run else ""
    print(f"{prefix}Mapping ESPN IDs...")
    summary = map_all(dry_run=args.dry_run, use_past=args.past)

    print()
    print(f"[OK] ESPN events found:       {summary['espn_events_found']}")
    print(f"[OK] Matches updated:         {summary['matched']}")
    print(f"  (already-mapped skipped: {summary['already_mapped_skipped']})")

    if summary["no_match"]:
        print()
        print(f"[!] {len(summary['no_match'])} ESPN events not matched to our DB:")
        for n in summary["no_match"][:10]:
            print(f"   ESPN #{n['espn_id']} ({n['date']}) - {n['teams']}")
        if len(summary["no_match"]) > 10:
            print(f"   ... and {len(summary['no_match']) - 10} more")

    if args.dry_run and summary["updates"]:
        print()
        print(f"Would update {len(summary['updates'])} matches:")
        for u in summary["updates"][:10]:
            print(f"   #{u['our_match_id']} ({u['stage']}) {u['teams']} → ESPN {u['espn_id']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
