"""
ESPN API wrapper — מקור נתונים חינמי, לא רשמי, לא מוגבל ב-rate.

Endpoint עיקרי:
    GET http://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
    GET http://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD

מיפוי שדות ESPN → שלנו:
    status.type.state            → 'pre' / 'in' / 'post'
    status.type.completed        → True/False
    competitors[].score          → תוצאת זמן רגיל
    competitors[].shootoutScore  → פנדלים (אופציונלי)
    status.displayClock          → "90'", "120'", "HT"
    date                         → ISO 8601 kickoff
    id                           → ESPN match id (string)
    venue.fullName               → אצטדיון
    competitors[].team.name      → שם הקבוצה
    competitors[].homeAway       → "home" / "away"

הערה: ESPN לא רשמי — אם משתנה הסכמה, נצטרך לעדכן כאן. כל הקוד שצורך נתוני מקור
חיצוני מבודד בקובץ הזה.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Literal, Optional, TypedDict

import httpx

logger = logging.getLogger(__name__)

ESPN_BASE = "http://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
TIMEOUT = httpx.Timeout(10.0, connect=5.0)

InternalStatus = Literal["scheduled", "live", "finished"]


class EspnMatchResult(TypedDict, total=False):
    espn_id: str
    status: InternalStatus
    is_completed: bool
    score_home: Optional[int]
    score_away: Optional[int]
    score_home_pen: Optional[int]   # NULL אם אין shootout
    score_away_pen: Optional[int]
    team_home: str                  # שם הקבוצה לפי ESPN (לבדיקת mapping)
    team_away: str
    kickoff_utc: str                # ISO 8601
    venue: Optional[str]
    display_clock: Optional[str]    # למשל "67'" ב-live


def _map_status(espn_state: str, completed: bool) -> InternalStatus:
    """ESPN state → סטטוס פנימי שלנו."""
    if completed:
        return "finished"
    if espn_state == "in":
        return "live"
    return "scheduled"  # 'pre' או כל דבר אחר


def _parse_competitor(comp: dict) -> tuple[str, Optional[int], Optional[int], str]:
    """מחזיר (team_name, score, pen_score, home_or_away)."""
    team_name = comp.get("team", {}).get("displayName") or comp.get("team", {}).get("name", "")
    score_str = comp.get("score", "")
    score = int(score_str) if score_str and score_str.isdigit() else None
    pen_score = comp.get("shootoutScore")
    if pen_score is not None:
        pen_score = int(pen_score)
    return team_name, score, pen_score, comp.get("homeAway", "")


def _parse_event(event: dict) -> Optional[EspnMatchResult]:
    """
    ממיר event יחיד מ-ESPN למבנה הפנימי שלנו. מחזיר None אם הנתונים לא תקינים.

    מטפל גם ב-scoreboard structure (event.date, event.competitions[0]) וגם
    ב-summary structure שבה ה-date והשדות נמצאים בתוך competitions[0]
    (event.competitions[0].date, event.competitions[0].status).
    """
    try:
        competition = event.get("competitions", [{}])[0]
        competitors = competition.get("competitors", [])

        if len(competitors) != 2:
            return None

        # ESPN לפעמים מחזיר home/away בסדר הפוך — מוצאים לפי homeAway
        home_comp = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away_comp = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home_comp or not away_comp:
            # fallback: ESPN לא תמיד מסמן home/away (אתרים נייטרליים)
            home_comp, away_comp = competitors[0], competitors[1]

        team_home, score_home, pen_home, _ = _parse_competitor(home_comp)
        team_away, score_away, pen_away, _ = _parse_competitor(away_comp)

        # status: scoreboard מחזיר ב-event.status, summary מחזיר ב-competition.status
        status_root = event.get("status") or competition.get("status") or {}
        status_data = status_root.get("type", {})
        status = _map_status(
            status_data.get("state", "pre"),
            bool(status_data.get("completed", False)),
        )

        # date: scoreboard מחזיר ב-event.date, summary רק ב-competition.date
        kickoff = event.get("date") or competition.get("date")
        if not kickoff:
            return None

        venue = competition.get("venue", {}).get("fullName")

        return EspnMatchResult(
            espn_id=str(event["id"]),
            status=status,
            is_completed=bool(status_data.get("completed", False)),
            score_home=score_home,
            score_away=score_away,
            score_home_pen=pen_home,
            score_away_pen=pen_away,
            team_home=team_home,
            team_away=team_away,
            kickoff_utc=kickoff,
            venue=venue,
            display_clock=status_root.get("displayClock"),
        )
    except (KeyError, IndexError, ValueError) as e:
        logger.warning(f"Failed to parse ESPN event {event.get('id')}: {e}")
        return None


def fetch_scoreboard(target_date: Optional[date] = None) -> list[EspnMatchResult]:
    """
    שולף את ה-scoreboard של מונדיאל, אופציונלית לתאריך ספציפי.

    בלי target_date: ESPN מחזיר את ה"אירוע הקרוב" (לרוב היום הנוכחי + יום-יומיים סביב).
    עם target_date: רק משחקים בתאריך הספציפי (לפי UTC).
    """
    url = ESPN_BASE + "/scoreboard"
    params = {}
    if target_date:
        params["dates"] = target_date.strftime("%Y%m%d")

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.error(f"ESPN scoreboard fetch failed: {e}")
        return []

    events = data.get("events", [])
    results = [_parse_event(ev) for ev in events]
    return [r for r in results if r is not None]


def fetch_match_by_id(espn_id: str) -> Optional[EspnMatchResult]:
    """
    שולף משחק ספציפי לפי ESPN id דרך endpoint summary.
    שימושי כשאנחנו יודעים מראש איזה משחק לבדוק (סדרת mapping).
    """
    url = ESPN_BASE + "/summary"
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(url, params={"event": espn_id})
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.error(f"ESPN summary fetch failed for {espn_id}: {e}")
        return None

    # ה-summary endpoint מחזיר את האירוע ב-data.header עם המבנה:
    # header.id, header.competitions[0].{date,status,competitors,...}
    event = data.get("header")
    if not event or "id" not in event:
        return None

    return _parse_event(event)


def fetch_scoreboard_for_date_range(
    start: date, end: date
) -> list[EspnMatchResult]:
    """
    שולף משחקים לטווח תאריכים. ESPN לפעמים תומך ב-?dates=YYYYMMDD-YYYYMMDD אבל
    בטוח יותר לעבור יום-יום.
    """
    results: list[EspnMatchResult] = []
    current = start
    while current <= end:
        results.extend(fetch_scoreboard(current))
        current = date.fromordinal(current.toordinal() + 1)
    return results
