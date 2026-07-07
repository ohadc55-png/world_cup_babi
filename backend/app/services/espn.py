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
    # חוק הבית: ניקוד לפי 90 דקות בלבד. לכן במשחק שהסתיים אחרי הארכה,
    # score_home/away הם תוצאת ה-90 דקות (H1+H2 מ-linescores) ולא התוצאה הסופית.
    # במשחק חי — התוצאה הרצה כרגיל (כולל הארכה, לתצוגת live).
    score_home: Optional[int]
    score_away: Optional[int]
    # התוצאה הסופית כולל הארכה — לקביעת העולה בברקט כשתיקו ב-90' ואין פנדלים.
    score_home_final: Optional[int]
    score_away_final: Optional[int]
    went_extra_time: bool
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


def _regulation_score(comp: dict) -> Optional[int]:
    """תוצאת 90 הדקות של קבוצה אחת, מתוך linescores.

    מבנה linescores: [מחצית1, מחצית2, (הארכה1), (הארכה2), (פנדלים)].
    מחזיר H1+H2, או None אם אין שתי מחציות תקינות (ואז נופלים ל-score הרגיל).
    """
    ls = comp.get("linescores") or []
    if len(ls) < 2:
        return None
    vals = []
    for entry in ls[:2]:
        v = entry.get("displayValue") if isinstance(entry, dict) else None
        if v is None and isinstance(entry, dict):
            v = entry.get("value")
        try:
            vals.append(int(float(v)))
        except (TypeError, ValueError):
            return None
    return vals[0] + vals[1]


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

        is_completed = bool(status_data.get("completed", False))

        # === חוק 90 הדקות ===
        # ESPN מחזיר ב-score את התוצאה הסופית כולל הארכה. הניקוד אצלנו נקבע
        # לפי 90 דקות בלבד, אז במשחק שהסתיים גוזרים את תוצאת ה-90' מ-linescores.
        # אם המשחק נגמר בזמן רגיל — H1+H2 == score ואין שינוי בפועל.
        score_home_final, score_away_final = score_home, score_away
        went_extra_time = False
        if is_completed:
            reg_home = _regulation_score(home_comp)
            reg_away = _regulation_score(away_comp)
            if reg_home is not None and reg_away is not None:
                went_extra_time = (reg_home, reg_away) != (score_home, score_away) \
                    or pen_home is not None
                score_home, score_away = reg_home, reg_away

        return EspnMatchResult(
            espn_id=str(event["id"]),
            status=status,
            is_completed=is_completed,
            score_home=score_home,
            score_away=score_away,
            score_home_final=score_home_final,
            score_away_final=score_away_final,
            went_extra_time=went_extra_time,
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


# ============================================================
# Player events — goals + red cards (Phase 9)
# ============================================================

class EspnGoalEvent(TypedDict, total=False):
    espn_event_id: str        # synthetic stable id (minute_value + scorer_id)
    minute: str               # "21'", "45+2'"
    minute_value: int         # שניות מתחילת המשחק לסידור
    scorer: str               # "Cyle Larin"
    scorer_id: str            # ESPN athlete id (string)
    assister: Optional[str]
    assister_id: Optional[str]
    team_name: str            # "Canada" — caller יתרגם ל-home/away
    is_penalty: bool
    is_own_goal: bool


class EspnRedCardEvent(TypedDict, total=False):
    espn_event_id: str        # ESPN keyEvent.id (string)
    minute: str
    minute_value: int
    player: str
    player_id: str
    team_name: str


def _safe_int_from_clock(clock: dict | None) -> int:
    """Convert clock.value (seconds) to int. 0 if missing/invalid."""
    if not clock:
        return 0
    v = clock.get("value")
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0


def _parse_goal(detail: dict) -> Optional[EspnGoalEvent]:
    """
    Parse a scoring play from header.competitions[0].details[].
    Convention: participants[0]=scorer, participants[1]=assister.
    """
    if not detail.get("scoringPlay"):
        return None
    participants = detail.get("participants") or []
    if not participants:
        return None
    scorer_athlete = (participants[0] or {}).get("athlete") or {}
    scorer = scorer_athlete.get("displayName") or ""
    scorer_id = str(scorer_athlete.get("id") or "")
    if not scorer:
        return None

    assister: Optional[str] = None
    assister_id: Optional[str] = None
    if len(participants) > 1:
        ass_ath = (participants[1] or {}).get("athlete") or {}
        assister = ass_ath.get("displayName") or None
        ass_id_raw = ass_ath.get("id")
        assister_id = str(ass_id_raw) if ass_id_raw else None

    clock = detail.get("clock") or {}
    minute_value = _safe_int_from_clock(clock)
    minute_display = clock.get("displayValue") or f"{minute_value // 60}'"

    # Stable id — must NOT change between sync runs. clock.value drifts by ±1s
    # between ESPN snapshots, so we key on the displayed minute (e.g. "17'",
    # "45+2'") which ESPN reports identically each call.
    synthetic_id = f"goal-{minute_display}-{scorer_id or scorer}"

    return EspnGoalEvent(
        espn_event_id=synthetic_id,
        minute=minute_display,
        minute_value=minute_value,
        scorer=scorer,
        scorer_id=scorer_id,
        assister=assister,
        assister_id=assister_id,
        team_name=(detail.get("team") or {}).get("displayName") or "",
        is_penalty=bool(detail.get("penaltyKick")),
        is_own_goal=bool(detail.get("ownGoal")),
    )


def _parse_red_card(event: dict) -> Optional[EspnRedCardEvent]:
    """Parse a red card from keyEvents[]."""
    if (event.get("type") or {}).get("text") != "Red Card":
        return None
    participants = event.get("participants") or []
    if not participants:
        return None
    ath = (participants[0] or {}).get("athlete") or {}
    player = ath.get("displayName") or ""
    player_id = str(ath.get("id") or "")
    if not player:
        return None

    clock = event.get("clock") or {}
    minute_value = _safe_int_from_clock(clock)
    minute_display = clock.get("displayValue") or f"{minute_value // 60}'"

    # Prefer real ESPN keyEvent id; fall back to minute-keyed synthetic so the
    # id stays stable across syncs even when clock.value drifts.
    espn_id = str(event.get("id") or "") or f"redcard-{minute_display}-{player_id or player}"

    return EspnRedCardEvent(
        espn_event_id=espn_id,
        minute=minute_display,
        minute_value=minute_value,
        player=player,
        player_id=player_id,
        team_name=(event.get("team") or {}).get("displayName") or "",
    )


# ============================================================
# Tournament-wide leaders (Phase 9.B) — goals + assists rankings
# ============================================================

class EspnLeader(TypedDict, total=False):
    player_name: str
    player_id: str
    team_name: str
    matches: int
    value: int
    display_value: str


def _parse_leader(entry: dict) -> Optional[EspnLeader]:
    """Parse a single leader row from /statistics stats[].leaders[]."""
    athlete = entry.get("athlete") or {}
    name = athlete.get("displayName") or ""
    if not name:
        return None
    try:
        value = int(entry.get("value") or 0)
    except (TypeError, ValueError):
        value = 0

    # Try to extract match count from displayValue like "Matches: 5, Goals: 7"
    matches = 0
    display = entry.get("displayValue") or ""
    if display:
        import re
        m = re.search(r"Matches:\s*(\d+)", display)
        if m:
            try:
                matches = int(m.group(1))
            except ValueError:
                matches = 0

    # ב-statistics endpoint ה-team מקונן בתוך athlete (לא ברמת הentry).
    team_name = (athlete.get("team") or {}).get("displayName") \
        or (entry.get("team") or {}).get("displayName") \
        or ""

    return EspnLeader(
        player_name=name,
        player_id=str(athlete.get("id") or ""),
        team_name=team_name,
        matches=matches,
        value=value,
        display_value=display,
    )


def fetch_tournament_leaders() -> dict[str, list[EspnLeader]]:
    """
    קורא ל-/statistics ומחזיר {'goals': [...], 'assists': [...]}.
    כל list מסודר לפי value יורד, top 10 בלבד.
    מחזיר ריק אם ה-fetch נכשל.
    """
    url = ESPN_BASE + "/statistics"
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.error(f"ESPN statistics fetch failed: {e}")
        return {"goals": [], "assists": []}

    result: dict[str, list[EspnLeader]] = {"goals": [], "assists": []}
    for category in data.get("stats", []) or []:
        cat_name = category.get("name") or ""
        if cat_name == "goalsLeaders":
            key = "goals"
        elif cat_name == "assistsLeaders":
            key = "assists"
        else:
            continue
        for entry in category.get("leaders", []) or []:
            try:
                ld = _parse_leader(entry)
                if ld and ld.get("value", 0) > 0:
                    result[key].append(ld)
            except Exception:
                logger.exception(f"Failed to parse leader in {cat_name}")
        # ESPN already sorts by value desc; take top 10
        result[key] = result[key][:10]

    return result


def fetch_match_events(espn_id: str) -> tuple[list[EspnGoalEvent], list[EspnRedCardEvent]] | None:
    """
    שולף summary ומחזיר (goals, red_cards).
    Goals מ-header.competitions[0].details[] לפי scoringPlay=True.
    Red cards מ-keyEvents[] לפי type.text == 'Red Card'.
    מחזיר None אם ה-fetch נכשל — הקורא חייב להבדיל בין כשל רשת לבין תשובה
    תקינה ריקה: ה-reconciliation מוחק אירועים שנעלמו מהפיד (VAR), ואסור
    שכשל זמני יימחק טיימליין שלם. שגיאות parse של פלאיי בודד נבלעות בלי
    להפיל את שאר הרשימה.
    """
    url = ESPN_BASE + "/summary"
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            r = client.get(url, params={"event": espn_id})
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.error(f"ESPN summary fetch failed for events {espn_id}: {e}")
        return None

    goals: list[EspnGoalEvent] = []
    red_cards: list[EspnRedCardEvent] = []

    competition = (data.get("header") or {}).get("competitions", [{}])[0]
    for detail in competition.get("details", []) or []:
        try:
            g = _parse_goal(detail)
            if g:
                goals.append(g)
        except Exception:
            logger.exception(f"Failed to parse goal play in {espn_id}")

    for ev in data.get("keyEvents", []) or []:
        try:
            rc = _parse_red_card(ev)
            if rc:
                red_cards.append(rc)
        except Exception:
            logger.exception(f"Failed to parse keyEvent in {espn_id}")

    return (goals, red_cards)
