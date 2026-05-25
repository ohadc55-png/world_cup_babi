"""
espn_stats — סטטיסטיקות עומק לתצוגה בסוכן.

הערת ארכיטקטורה: הקובץ נקרא "espn_stats" כי הספק המקורי דרש משיכה מ-ESPN.
אבל בפועל אנחנו מסכמים נתונים *מתוך טבלת matches שלנו* כי:
  1. ESPN לא חושף team-stats אלא דרך team-id mapping שאנחנו לא תחזקנו.
  2. הקשר טורניר ספציפי (איך גרמניה שיחקה ב-3 משחקי הבתים שלה?) הוא הרבה יותר
     רלוונטי לניחושים מאשר היסטוריה של ידידותיות.
  3. אנחנו לא תלויים ב-API חיצוני שעלול ליפול / לשנות סכמה.

מה שאנחנו מחשבים לכל קבוצה:
  - home_form / away_form: 5 המשחקים האחרונים שלה בטורניר, כ-"W-D-L".
  - h2h_summary: האם הקבוצות נפגשו בטורניר הזה (לרוב לא, בנוקאאוט).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------
# Public API
# ----------------------------------------------------------------

def compute_team_form(team_name: str, before: datetime) -> str:
    """
    מחזיר תיאור טקסטואלי של 5 המשחקים האחרונים של הקבוצה לפני התאריך הנתון.
    דוגמה: "3W-1D-1L, 8 שערים בעד, 3 נגד"
    """
    matches = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,kickoff_utc,status")
        .or_(f"team_home.eq.{team_name},team_away.eq.{team_name}")
        .eq("status", "finished")
        .lt("kickoff_utc", before.isoformat())
        .order("kickoff_utc", desc=True)
        .limit(5)
        .execute()
    ).data or []

    if not matches:
        return "טרם שיחקה משחקים בטורניר"

    wins = draws = losses = goals_for = goals_against = 0
    for m in matches:
        is_home = m["team_home"] == team_name
        our = m["score_home"] if is_home else m["score_away"]
        opp = m["score_away"] if is_home else m["score_home"]
        if our is None or opp is None:
            continue
        goals_for += our
        goals_against += opp
        if our > opp:
            wins += 1
        elif our < opp:
            losses += 1
        else:
            draws += 1

    return (
        f"{wins}W-{draws}D-{losses}L "
        f"({goals_for} שערים בעד, {goals_against} נגד) "
        f"מתוך {len(matches)} משחקים אחרונים בטורניר"
    )


def compute_h2h(team_a: str, team_b: str) -> str:
    """
    מחזיר תיאור של מפגשי גומלין בין שתי הקבוצות *בטורניר הזה*.
    אם לא נפגשו - מחזיר את זה במפורש.
    """
    matches = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,stage,status")
        .or_(
            f"and(team_home.eq.{team_a},team_away.eq.{team_b}),"
            f"and(team_home.eq.{team_b},team_away.eq.{team_a})"
        )
        .eq("status", "finished")
        .execute()
    ).data or []

    if not matches:
        return f"{team_a} ו-{team_b} לא נפגשו בטורניר הזה"

    lines = []
    for m in matches:
        lines.append(
            f"{m['team_home']} {m['score_home']}-{m['score_away']} {m['team_away']} ({m['stage']})"
        )
    return "; ".join(lines)


def update_match_stats(match_id: int) -> dict:
    """
    מחשב סטטיסטיקות למשחק ספציפי ומעדכן את match_stats_cache.
    מחזיר summary של מה שעודכן.
    """
    match = (
        supabase_admin.table("matches")
        .select("id,team_home,team_away,kickoff_utc")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not match or not match.data:
        return {"match_id": match_id, "error": "not found"}

    m = match.data
    kickoff = datetime.fromisoformat(m["kickoff_utc"].replace("Z", "+00:00"))

    home_form = compute_team_form(m["team_home"], kickoff)
    away_form = compute_team_form(m["team_away"], kickoff)
    h2h = compute_h2h(m["team_home"], m["team_away"])

    supabase_admin.table("match_stats_cache").upsert({
        "match_id": match_id,
        "home_form": home_form,
        "away_form": away_form,
        "h2h_summary": h2h,
        "updated_at": "now()",
    }).execute()

    return {
        "match_id": match_id,
        "team_home": m["team_home"],
        "team_away": m["team_away"],
        "home_form": home_form,
        "away_form": away_form,
        "h2h": h2h,
    }


def sync_upcoming_matches(hours_ahead: int = 48) -> dict:
    """
    סורק את כל המשחקים שיתחילו ב-X השעות הקרובות (ועדיין לא הסתיימו),
    ומחשב סטטיסטיקות לכל אחד.
    """
    now = datetime.now(timezone.utc)
    end = now + timedelta(hours=hours_ahead)

    upcoming = (
        supabase_admin.table("matches")
        .select("id")
        .gte("kickoff_utc", now.isoformat())
        .lte("kickoff_utc", end.isoformat())
        .neq("status", "finished")
        .order("kickoff_utc")
        .execute()
    ).data or []

    processed = 0
    errors = []
    for m in upcoming:
        try:
            update_match_stats(m["id"])
            processed += 1
        except Exception as e:  # noqa: BLE001
            errors.append({"match_id": m["id"], "error": str(e)})
            logger.exception("Failed to update stats for match %s", m["id"])

    return {
        "scanned_window_hours": hours_ahead,
        "matches_found": len(upcoming),
        "processed": processed,
        "errors": errors,
    }
