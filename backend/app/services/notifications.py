"""
Notification triggers — 6 סוגי push notifications.

עיקרון: כל פונקציה מקבלת נתונים מינימליים ושולחת לקבוצת משתמשים הרלוונטית.
ה-multi-game scoping מטופל כאן — כל trigger מסנן רק את המשתמשים שבמשחקים
הרלוונטיים.

6 הטריגרים:
  1. reminder          - שעה לפני kickoff, למי שלא ניחש
  2. result            - אחרי calculate_match_score, לכל מי שניחש
  3. overtaken         - אחרי שינוי דירוג בתוך game
  4. kickoff           - כשמשחק עובר ל-live
  5. stage             - שלב פלייאוף חדש נפתח
  6. weekly            - סיכום שבועי
"""
from __future__ import annotations

import logging
from typing import Optional

from app.db.supabase import supabase_admin
from app.services.push import PushPayload, send_push_to_user, send_push_to_users

logger = logging.getLogger(__name__)


# ============================================================
# Helpers
# ============================================================

def _users_in_any_game() -> list[str]:
    """כל המשתמשים שמשויכים למשחק כלשהו."""
    res = (
        supabase_admin.table("users")
        .select("id")
        .not_.is_("game_id", "null")
        .execute()
    )
    return [u["id"] for u in (res.data or [])]


def _users_predicted_match(match_id: int) -> list[str]:
    """משתמשים שיש להם prediction למשחק הזה."""
    res = (
        supabase_admin.table("predictions_matches")
        .select("user_id")
        .eq("match_id", match_id)
        .execute()
    )
    return [r["user_id"] for r in (res.data or [])]


def _users_without_prediction_in_game(match_id: int) -> list[str]:
    """משתמשים שמשויכים למשחק כלשהו ועדיין לא ניחשו את המשחק."""
    in_games = set(_users_in_any_game())
    predicted = set(_users_predicted_match(match_id))
    return list(in_games - predicted)


def _match_label(match: dict) -> str:
    """תיאור קצר של משחק לכותרת ההתראה."""
    return f"{match['team_home']} vs {match['team_away']}"


# ============================================================
# Trigger #1 — reminder (שעה לפני kickoff)
# ============================================================

def trigger_match_reminders(match: dict) -> dict:
    """
    שולח תזכורת ל-users שלא ניחשו עדיין.
    נקרא מ-cron crons/send_reminders.py שמסרק משחקים בעוד 50-70 דקות.
    """
    label = _match_label(match)
    targets = _users_without_prediction_in_game(match["id"])
    if not targets:
        return {"sent": 0, "skipped": "no targets"}

    payload: PushPayload = {
        "title": "⚡ עוד שעה — לא ניחשת!",
        "body": f"{label} מתחיל בעוד שעה. הספיק לנחש?",
        "url": "/predictions",
        "tag": f"reminder-{match['id']}",
    }
    return send_push_to_users(targets, payload, "reminder")


# ============================================================
# Trigger #2 — result (אחרי calculate_match_score)
# ============================================================

def trigger_match_result(match_id: int, scoring_summary: dict) -> dict:
    """
    שולח התראה לכל מי שניחש את המשחק.
    נקרא מ-scoring.calculate_match_score בסוף.
    """
    match_res = (
        supabase_admin.table("matches")
        .select("team_home, team_away, score_home, score_away, score_home_pen, score_away_pen")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_res.data:
        return {"sent": 0, "skipped": "match not found"}
    match = match_res.data[0]

    # פורמט תוצאה (כולל פנדלים)
    score = f"{match['score_home']}-{match['score_away']}"
    if match.get("score_home_pen") is not None:
        score = f"{match['score_home']}({match['score_home_pen']})-{match['score_away']}({match['score_away_pen']})"

    # לכל user נשלח התראה עם הניקוד שלו
    preds_res = (
        supabase_admin.table("predictions_matches")
        .select("user_id, points_earned")
        .eq("match_id", match_id)
        .execute()
    )

    total_sent = 0
    for pred in (preds_res.data or []):
        pts = pred.get("points_earned", 0) or 0
        emoji = "🎯" if pts >= 6 else ("👍" if pts > 0 else "😐")
        payload: PushPayload = {
            "title": f"🏁 {_match_label(match)} {score}",
            "body": f"{emoji} קיבלת {pts} נק'",
            "url": "/leaderboard",
            "tag": f"result-{match_id}",
        }
        r = send_push_to_user(pred["user_id"], payload, "result")
        total_sent += r["sent"]

    return {"sent": total_sent, "predictions": len(preds_res.data or [])}


# ============================================================
# Trigger #3 — overtaken / rank change
# ============================================================

def trigger_rank_changes(game_id: str) -> dict:
    """
    בודק שינויי דירוג בתוך game ושולח התראות.
    משווה current_rank לעומת previous_rank לכל משתמש במשחק.
    אם המשתמש ירד = "עקפו אותך"; אם עלה = "עליית מקום".
    נקרא אחרי כל recalc.
    """
    # שולפים scores של כל המשתמשים במשחק, ממוינים לפי נקודות
    members_res = (
        supabase_admin.table("users")
        .select("id")
        .eq("game_id", game_id)
        .execute()
    )
    member_ids = [u["id"] for u in (members_res.data or [])]
    if not member_ids:
        return {"sent": 0}

    scores_res = (
        supabase_admin.table("scores")
        .select("user_id, total_points, current_rank, previous_rank")
        .in_("user_id", member_ids)
        .order("total_points", desc=True)
        .execute()
    )
    scores = scores_res.data or []

    # מחשבים rank חדש
    new_ranks: dict[str, int] = {s["user_id"]: idx + 1 for idx, s in enumerate(scores)}

    notified = 0
    for s in scores:
        uid = s["user_id"]
        old_rank = s.get("current_rank")  # המיקום הקודם (לפני ה-recalc הזה)
        new_rank = new_ranks[uid]

        # עדכון ה-DB
        supabase_admin.table("scores").update({
            "current_rank": new_rank,
            "previous_rank": old_rank,
        }).eq("user_id", uid).execute()

        # שולחים push רק אם המיקום השתנה משמעותית
        if old_rank is None or old_rank == new_rank:
            continue

        if new_rank < old_rank:
            payload: PushPayload = {
                "title": f"🚀 עלית למקום {new_rank}!",
                "body": f"היית במקום {old_rank} — עכשיו {new_rank}",
                "url": "/leaderboard",
                "tag": f"rank-up-{uid}",
            }
        else:
            payload = {
                "title": f"📊 עקפו אותך",
                "body": f"עכשיו אתה במקום {new_rank} (היית {old_rank})",
                "url": "/leaderboard",
                "tag": f"rank-down-{uid}",
            }
        r = send_push_to_user(uid, payload, "overtaken")
        notified += r["sent"]

    return {"sent": notified, "members": len(scores)}


def trigger_rank_changes_all_games() -> dict:
    """ריצה על כל המשחקים בנפרד (משחקים מבודדים זה מזה)."""
    games_res = supabase_admin.table("games").select("id").execute()
    total = 0
    for g in (games_res.data or []):
        r = trigger_rank_changes(g["id"])
        total += r["sent"]
    return {"sent": total, "games": len(games_res.data or [])}


# ============================================================
# Trigger #4 — kickoff (משחק עבר ל-live)
# ============================================================

def trigger_kickoff(match: dict) -> dict:
    """
    מודיע למשתמשים שהמשחק התחיל. opt-in בלבד.
    נקרא מ-sync_results כשstatus עובר ל-live.
    """
    targets = _users_predicted_match(match["id"])
    if not targets:
        return {"sent": 0}

    payload: PushPayload = {
        "title": f"▶ המשחק התחיל!",
        "body": f"{_match_label(match)} — לחץ לצפות",
        "url": "/home",
        "tag": f"kickoff-{match['id']}",
    }
    return send_push_to_users(targets, payload, "kickoff")


# ============================================================
# Trigger #5 — new stage opens (אחרי שלב הבתים)
# ============================================================

def trigger_new_stage(stage: str, stage_name_he: str) -> dict:
    """
    שולח לכל המשתמשים כשפלייאוף נפתח.
    נקרא אחרי שכל משחקי שלב הבתים הסתיימו (ידני בינתיים, אוטומטי בעתיד).
    """
    targets = _users_in_any_game()
    payload: PushPayload = {
        "title": f"🏆 {stage_name_he} נפתח!",
        "body": "לחץ לנחש את המשחקים החדשים",
        "url": "/predictions",
        "tag": f"stage-{stage}",
    }
    return send_push_to_users(targets, payload, "stage")


# ============================================================
# Trigger #6 — weekly recap
# ============================================================

def trigger_weekly_recap() -> dict:
    """
    סיכום שבועי לכל המשתמשים שבמשחק.
    נקרא מ-cron כל יום ראשון 19:00.

    התוכן מותאם אישית - נקודות השבוע + מיקום נוכחי.
    כאן כתבתי פשוט — אפשר להעשיר עם נתונים נוספים בעתיד (כמו "המשחק הכי
    טוב שלך השבוע").
    """
    targets = _users_in_any_game()
    total_sent = 0

    for uid in targets:
        score_res = (
            supabase_admin.table("scores")
            .select("total_points, current_rank")
            .eq("user_id", uid)
            .limit(1)
            .execute()
        )
        score = score_res.data[0] if score_res.data else None
        if not score:
            continue

        rank = score.get("current_rank") or "—"
        pts = score.get("total_points") or 0

        payload: PushPayload = {
            "title": f"📈 הסיכום השבועי שלך",
            "body": f"{pts} נק' · מקום {rank}",
            "url": "/leaderboard",
            "tag": "weekly-recap",
        }
        r = send_push_to_user(uid, payload, "weekly")
        total_sent += r["sent"]

    return {"sent": total_sent, "users": len(targets)}
