"""
מנוע הניקוד — Single Source of Truth לחישוב נקודות במונדיאל 2026.

עקרונות:
1. כל הקבועים מ-`app.core.constants` (לא קוד-קשיח כאן).
2. פונקציות טהורות (input → output) בראש הקובץ — קלות לבדיקה.
3. פונקציות DB-aware בתחתית — קוראות לפונקציות הטהורות + כותבות ל-score_events.
4. כל נקודה שמתווספת ל-`scores.total_points` חייבת לעבור דרך `_add_score_event`
   עם UNIQUE constraint (user_id, source_type, source_ref) — מבטיח idempotency.
5. ניקוד = int בלבד. אסור floats.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal, Optional, TypedDict

from app.core import constants
from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)

Direction = Literal["1", "X", "2"]
Stage = Literal["group", "r32", "r16", "qf", "sf", "third_place", "final"]


# ============================================================
# Type contracts
# ============================================================

class GroupMatchBreakdown(TypedDict, total=False):
    direction: int        # 3 if direction correct else 0
    exact_uplift: int     # 3 if exact (uplift from 3 → 6 total)
    draw_bonus: int       # 1 if direction was correctly X


class KnockoutMatchBreakdown(TypedDict, total=False):
    winner: int           # base points if winner correct (per stage)
    exact_bonus: int      # exact_bonus if also exact score (per stage)


class GroupStandingsBreakdown(TypedDict, total=False):
    positions_correct: int    # 0..4
    position_points: int      # 5 × positions_correct
    perfect_bonus: int        # 10 if all 4


class TournamentBreakdown(TypedDict, total=False):
    champion: int                  # 100
    both_finalists: int            # 100 (only if 2 correct)
    one_finalist: int              # 40 (only if 1 correct)
    semifinalists_each: int        # correct_count × 20 (max 80)
    all_4_semifinalists_bonus: int # +20 if all 4 correct
    top_scorer: int                # 70
    top_assister: int              # 70
    golden_ball: int               # 70


# ============================================================
# === PURE FUNCTIONS — לא נוגעות ב-DB ====================
# ============================================================

def compute_direction(score_home: int, score_away: int) -> Direction:
    """ממיר תוצאה מספרית לכיוון 1/X/2."""
    if score_home > score_away:
        return "1"
    if score_home < score_away:
        return "2"
    return "X"


# ----------------------------------------------------------------
# Group stage match scoring
# ----------------------------------------------------------------

def score_group_match(
    pred_direction: Direction,
    pred_home: Optional[int],
    pred_away: Optional[int],
    actual_home: int,
    actual_away: int,
) -> tuple[int, GroupMatchBreakdown]:
    """
    מחזיר (points, breakdown) למשחק שלב הבתים.

    חוקי הניקוד:
    - כיוון נכון (1/X/2): +3
    - תוצאה מדויקת: סה"כ 6 (uplift של +3 מהכיוון)
    - תיקו נכון (כיוון X): +1

    מקסימום למשחק בודד: 6 (exact). תיקו עם exact: 7.
    """
    actual_direction = compute_direction(actual_home, actual_away)
    breakdown: GroupMatchBreakdown = {}
    total = 0

    if pred_direction != actual_direction:
        return 0, breakdown

    # כיוון נכון
    breakdown["direction"] = constants.GROUP_MATCH_DIRECTION
    total += constants.GROUP_MATCH_DIRECTION

    # תוצאה מדויקת?
    if pred_home is not None and pred_away is not None:
        if pred_home == actual_home and pred_away == actual_away:
            uplift = constants.GROUP_MATCH_EXACT_TOTAL - constants.GROUP_MATCH_DIRECTION
            breakdown["exact_uplift"] = uplift
            total += uplift

    # בונוס תיקו
    if actual_direction == "X":
        breakdown["draw_bonus"] = constants.GROUP_DRAW_BONUS
        total += constants.GROUP_DRAW_BONUS

    return total, breakdown


# ----------------------------------------------------------------
# Knockout stage match scoring (R32/R16/QF/SF/Third-place)
# ----------------------------------------------------------------

def compute_knockout_advancer(
    actual_home: int,
    actual_away: int,
    actual_home_pen: Optional[int] = None,
    actual_away_pen: Optional[int] = None,
) -> Direction:
    """
    מחזיר את הכיוון של מי שעבר הלאה במשחק פלייאוף.
    בפלייאוף חייב להיות מנצח — אם זמן רגיל היה תיקו, מסתכלים על הפנדלים.
    """
    if actual_home > actual_away:
        return "1"
    if actual_home < actual_away:
        return "2"
    # תיקו בזמן רגיל → חייבים פנדלים
    if actual_home_pen is None or actual_away_pen is None:
        raise ValueError(
            f"Knockout match drew {actual_home}-{actual_away} but no penalty data provided"
        )
    if actual_home_pen > actual_away_pen:
        return "1"
    if actual_home_pen < actual_away_pen:
        return "2"
    raise ValueError(
        f"Penalty shootout also drew ({actual_home_pen}-{actual_away_pen}) — impossible"
    )


def score_knockout_match(
    pred_direction: Direction,
    pred_home: Optional[int],
    pred_away: Optional[int],
    actual_home: int,
    actual_away: int,
    stage: Stage,
    actual_home_pen: Optional[int] = None,   # נשמר ב-signature לצורך תאימות, לא בשימוש
    actual_away_pen: Optional[int] = None,   # פנדלים לא משפיעים על ניקוד המשחק
) -> tuple[int, KnockoutMatchBreakdown]:
    """
    מחזיר (points, breakdown) למשחק פלייאוף — כל השלבים מ-R32 ועד Final.

    כלל הניקוד (החלטה מ-2026-05-25):
    - "כיוון" נקבע לפי 90 הדקות בלבד. אם הזמן הרגיל הסתיים בתיקו → הכיוון = "X".
    - פנדלים *לא* משפיעים על הניקוד למשחק (הם רק קובעים מי עלה הלאה לטובת הברקט).
    - מי שניחש 1-1 לזמן רגיל ולא היה 1-1 → 0 נק', גם אם הזמן הרגיל באמת היה תיקו אבל בתוצאה אחרת (0-0).
    - מי שניחש תוצאה מדויקת (לזמן הרגיל) → מקבל גם את ה-exact bonus.

    זה מתואם לחלוטין עם score_group_match — אותו ניקוד דירקציוני, רק עם
    הסקאלה של KNOCKOUT_POINTS[stage]. ניחושי "מי עולה הלאה" נמצאים בטווח-ארוך.
    """
    if stage == "group":
        raise ValueError("Use score_group_match() for group stage matches")

    if stage not in constants.KNOCKOUT_POINTS:
        raise ValueError(f"Unknown knockout stage: {stage}")

    stage_points = constants.KNOCKOUT_POINTS[stage]
    actual_direction = compute_direction(actual_home, actual_away)   # 90 min only
    breakdown: KnockoutMatchBreakdown = {}
    total = 0

    if pred_direction != actual_direction:
        return 0, breakdown

    # כיוון נכון
    breakdown["winner"] = stage_points["winner"]
    total += stage_points["winner"]

    # תוצאה מדויקת — לזמן הרגיל בלבד (לא לפנדלים)
    if pred_home is not None and pred_away is not None:
        if pred_home == actual_home and pred_away == actual_away:
            breakdown["exact_bonus"] = stage_points["exact_bonus"]
            total += stage_points["exact_bonus"]

    return total, breakdown


# ----------------------------------------------------------------
# Group standings — סוף שלב הבתים
# ----------------------------------------------------------------

def score_group_standings(
    pred_1st: str,
    pred_2nd: str,
    pred_3rd: str,
    pred_4th: str,
    actual_1st: str,
    actual_2nd: str,
    actual_3rd: str,
    actual_4th: str,
) -> tuple[int, GroupStandingsBreakdown]:
    """
    ניקוד טבלת מיקום קבוצה — 5 נק' לכל מיקום נכון + 10 בונוס פרפקט.
    מקסימום: 30.
    """
    predictions = [pred_1st, pred_2nd, pred_3rd, pred_4th]
    actuals = [actual_1st, actual_2nd, actual_3rd, actual_4th]
    positions_correct = sum(1 for p, a in zip(predictions, actuals) if p == a)

    breakdown: GroupStandingsBreakdown = {
        "positions_correct": positions_correct,
        "position_points": positions_correct * constants.GROUP_POSITION_POINTS,
    }
    total = positions_correct * constants.GROUP_POSITION_POINTS

    if positions_correct == 4:
        breakdown["perfect_bonus"] = constants.GROUP_PERFECT_BONUS
        total += constants.GROUP_PERFECT_BONUS

    return total, breakdown


# ----------------------------------------------------------------
# Tournament-wide long-term predictions
# ----------------------------------------------------------------

@dataclass(frozen=True)
class TournamentActuals:
    """מצב סופי של הטורניר — לחישוב ניחושי טווח-ארוך."""
    champion: str
    finalists: tuple[str, str]               # סדר לא משנה
    semifinalists: tuple[str, str, str, str] # סדר לא משנה
    top_scorer: str
    top_assister: str
    golden_ball: str


def score_tournament_predictions(
    pred_winner: Optional[str],
    pred_finalist_1: Optional[str],
    pred_finalist_2: Optional[str],
    pred_semifinalist_1: Optional[str],
    pred_semifinalist_2: Optional[str],
    pred_semifinalist_3: Optional[str],
    pred_semifinalist_4: Optional[str],
    pred_top_scorer: Optional[str],
    pred_top_assister: Optional[str],
    pred_golden_ball: Optional[str],
    actuals: TournamentActuals,
) -> tuple[int, TournamentBreakdown]:
    """
    ניקוד ניחושי טווח-ארוך (champion / finalists / semis / awards).
    הניקוד של הגמר עצמו (50/50/50) מטופל בנפרד דרך `score_final_match`.

    מקסימום אפשרי כאן:
        80 (champion) + 40 (finalists) + 30 (semis bonus) +
        70 + 70 + 70 (awards) = 360.
    """
    breakdown: TournamentBreakdown = {}
    total = 0

    # אלופה
    if pred_winner and pred_winner == actuals.champion:
        breakdown["champion"] = constants.LONGTERM_CHAMPION
        total += constants.LONGTERM_CHAMPION

    # פיינליסטיות
    actual_finalists_set = set(actuals.finalists)
    user_finalists = [f for f in [pred_finalist_1, pred_finalist_2] if f]
    # נספור unique כדי לא להחזיר ×2 על אותה בחירה
    correct_finalists = len(set(user_finalists) & actual_finalists_set)

    if correct_finalists >= 2:
        breakdown["both_finalists"] = constants.LONGTERM_BOTH_FINALISTS
        total += constants.LONGTERM_BOTH_FINALISTS
    elif correct_finalists == 1:
        breakdown["one_finalist"] = constants.LONGTERM_ONE_FINALIST
        total += constants.LONGTERM_ONE_FINALIST

    # חצי-גמרניות: 20 לכל קבוצה נכונה + 20 בונוס אם כל 4 = 100 מקס'
    actual_semis_set = set(actuals.semifinalists)
    user_semis = {s for s in [pred_semifinalist_1, pred_semifinalist_2,
                              pred_semifinalist_3, pred_semifinalist_4] if s}
    correct_semis = len(user_semis & actual_semis_set)
    if correct_semis > 0:
        per_team = correct_semis * constants.LONGTERM_SEMIFINALIST_EACH
        breakdown["semifinalists_each"] = per_team
        total += per_team
    if correct_semis == 4:
        breakdown["all_4_semifinalists_bonus"] = constants.LONGTERM_ALL_4_SEMIFINALISTS_BONUS
        total += constants.LONGTERM_ALL_4_SEMIFINALISTS_BONUS

    # פרסים אישיים — בדיוק על השם
    if pred_top_scorer and _normalize_player(pred_top_scorer) == _normalize_player(actuals.top_scorer):
        breakdown["top_scorer"] = constants.LONGTERM_TOP_SCORER
        total += constants.LONGTERM_TOP_SCORER

    if pred_top_assister and _normalize_player(pred_top_assister) == _normalize_player(actuals.top_assister):
        breakdown["top_assister"] = constants.LONGTERM_TOP_ASSISTER
        total += constants.LONGTERM_TOP_ASSISTER

    if pred_golden_ball and _normalize_player(pred_golden_ball) == _normalize_player(actuals.golden_ball):
        breakdown["golden_ball"] = constants.LONGTERM_GOLDEN_BALL
        total += constants.LONGTERM_GOLDEN_BALL

    return total, breakdown


def _normalize_player(name: str) -> str:
    """נירמול שם שחקן: lowercase, trim, whitespace conflation.
    מאפשר "Lionel Messi" == "lionel  messi  " == "LIONEL MESSI".
    """
    return " ".join(name.lower().strip().split())


# ============================================================
# === DB-INTEGRATED FUNCTIONS ===============================
# ============================================================
# כל הפונקציות מתחת לקו זה נוגעות ב-Supabase.
# הן בונות על הפונקציות הטהורות שלמעלה.

def _add_score_event(
    user_id: str,
    source_type: str,
    source_ref: str,
    points: int,
    reason: str,
) -> bool:
    """
    מוסיף רשומה ל-score_events. מחזיר True אם נוספה רשומה, False אם
    קיים כבר (UNIQUE constraint תפס — idempotency).
    """
    try:
        result = (
            supabase_admin.table("score_events")
            .insert({
                "user_id": user_id,
                "source_type": source_type,
                "source_ref": source_ref,
                "points": points,
                "reason": reason,
            })
            .execute()
        )
        return bool(result.data)
    except Exception as e:
        msg = str(e)
        # 23505 = unique_violation — כבר חישבנו את האירוע הזה, idempotent skip
        if "23505" in msg or "duplicate key" in msg.lower():
            logger.debug(
                f"score_event already exists for user={user_id} "
                f"{source_type}/{source_ref} — skipping (idempotent)"
            )
            return False
        raise


def _refresh_user_scores(user_id: str) -> None:
    """
    מסכם מחדש את כל ה-score_events של משתמש ומעדכן את `scores`.
    Source of truth = score_events. scores הוא cached aggregation.
    """
    events = (
        supabase_admin.table("score_events")
        .select("source_type, points")
        .eq("user_id", user_id)
        .execute()
    )

    total = 0
    group_pts = 0
    knockout_pts = 0
    awards_pts = 0
    dd_pts = 0

    for ev in events.data or []:
        pts = ev["points"]
        st = ev["source_type"]
        total += pts

        if st == "double_down_bonus":
            dd_pts += pts
        elif st.startswith("match_group") or st.startswith("group_position") or st.startswith("group_perfect"):
            group_pts += pts
        elif st.startswith("match_r32") or st.startswith("match_r16") or st.startswith("match_qf") or \
             st.startswith("match_sf") or st.startswith("match_third_place") or st.startswith("match_final"):
            knockout_pts += pts
        elif st.startswith("awards_") or st.startswith("longterm_"):
            awards_pts += pts

    supabase_admin.table("scores").update({
        "total_points": total,
        "group_stage_pts": group_pts,
        "knockout_pts": knockout_pts,
        "awards_pts": awards_pts,
        "double_down_pts": dd_pts,
        "last_calculated": "now()",
    }).eq("user_id", user_id).execute()


def _get_active_double_down(user_id: str, match_id: int) -> Optional[dict]:
    """מחזיר את ה-DD token של המשתמש למשחק הזה אם הוא פעיל, אחרת None."""
    result = (
        supabase_admin.table("double_down_tokens")
        .select("*")
        .eq("user_id", user_id)
        .eq("match_id", match_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def _finalize_double_down(token_id: str, dd_bonus: int) -> None:
    """מסמן DD token כ-used + שומר את הבונוס שהושג."""
    supabase_admin.table("double_down_tokens").update({
        "status": "used",
        "points_earned": dd_bonus,
        "finalized_at": "now()",
    }).eq("id", token_id).execute()


def _stage_to_source_type(stage: str) -> str:
    """match_group / match_r32 / match_r16 / match_qf / match_sf / match_third_place / match_final"""
    return f"match_{stage}"


def calculate_match_score(match_id: int) -> dict:
    """
    מחשב ניקוד לכל המשתמשים על משחק שהסתיים.

    זרימה:
    1. שולף את המשחק (חייב status='finished' עם score_home/score_away).
    2. שולף את כל הניחושים של המשתמשים למשחק הזה.
    3. לכל ניחוש: מחשב ניקוד בסיסי (לפי שלב).
    4. כותב score_event ראשי.
    5. אם יש DD token פעיל למשתמש+משחק — כותב score_event שני 'double_down_bonus'.
    6. מעדכן predictions_matches.points_earned + breakdown.
    7. מרענן scores לכל המשתמשים המושפעים.

    אידמפוטנטי — UNIQUE constraint על (user_id, source_type, source_ref) מבטיח
    שהרצה שנייה לא תוסיף נקודות. שדה points_earned יכול להתעדכן באותו ערך.
    """
    match_result = (
        supabase_admin.table("matches")
        .select("*")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_result.data:
        raise ValueError(f"Match {match_id} not found")

    match = match_result.data[0]

    if match["status"] != "finished":
        raise ValueError(
            f"Match {match_id} status is '{match['status']}', not 'finished'"
        )
    if match["score_home"] is None or match["score_away"] is None:
        raise ValueError(f"Match {match_id} has no final score")

    stage: Stage = match["stage"]
    actual_home = match["score_home"]
    actual_away = match["score_away"]
    actual_home_pen = match.get("score_home_pen")
    actual_away_pen = match.get("score_away_pen")

    preds_result = (
        supabase_admin.table("predictions_matches")
        .select("*")
        .eq("match_id", match_id)
        .execute()
    )
    predictions = preds_result.data or []

    affected_users: set[str] = set()
    summary = {
        "match_id": match_id,
        "stage": stage,
        "predictions_scored": 0,
        "total_points_awarded": 0,
        "double_down_bonuses": 0,
    }

    source_type = _stage_to_source_type(stage)
    source_ref = str(match_id)

    for pred in predictions:
        user_id = pred["user_id"]
        affected_users.add(user_id)

        # === חישוב ניקוד בסיסי לפי שלב ===
        if stage == "group":
            base_pts, breakdown = score_group_match(
                pred_direction=pred["direction"],
                pred_home=pred.get("score_home"),
                pred_away=pred.get("score_away"),
                actual_home=actual_home,
                actual_away=actual_away,
            )
        else:
            # פלייאוף - כל השלבים מ-R32 ועד Final
            base_pts, breakdown = score_knockout_match(
                pred_direction=pred["direction"],
                pred_home=pred.get("score_home"),
                pred_away=pred.get("score_away"),
                actual_home=actual_home,
                actual_away=actual_away,
                stage=stage,
                actual_home_pen=actual_home_pen,
                actual_away_pen=actual_away_pen,
            )

        # === כתיבת score_event בסיסי + עדכון predictions_matches ===
        added = _add_score_event(
            user_id=user_id,
            source_type=source_type,
            source_ref=source_ref,
            points=base_pts,
            reason=f"{stage} match {match_id}: {match['team_home']} {actual_home}-{actual_away} {match['team_away']}",
        )

        if added:
            summary["predictions_scored"] += 1
            summary["total_points_awarded"] += base_pts

        # תמיד מעדכנים את ה-cache (גם אם score_event לא נוסף — לבטיחות מול re-run אחרי שינוי schema)
        supabase_admin.table("predictions_matches").update({
            "points_earned": base_pts,
            "points_breakdown": breakdown,
        }).eq("id", pred["id"]).execute()

        # === Double Down bonus (אם יש token פעיל) ===
        # הטוקן מסומן used גם כשהניחוש הרוויח 0 — אחרת הוא נשאר "תלוי" במצב
        # active לנצח על משחק שכבר נגמר. score_event נכתב רק לבונוס חיובי.
        dd_token = _get_active_double_down(user_id, match_id)
        if dd_token:
            dd_bonus = base_pts * (constants.DOUBLE_DOWN_MULTIPLIER - 1)
            if dd_bonus > 0:
                dd_added = _add_score_event(
                    user_id=user_id,
                    source_type="double_down_bonus",
                    source_ref=source_ref,
                    points=dd_bonus,
                    reason=f"DD token {dd_token['round_key']}: ×{constants.DOUBLE_DOWN_MULTIPLIER} on match {match_id}",
                )
                if dd_added:
                    summary["double_down_bonuses"] += dd_bonus
            _finalize_double_down(dd_token["id"], dd_bonus)

    # === רענון aggregations ===
    for uid in affected_users:
        _refresh_user_scores(uid)

    summary["affected_users"] = len(affected_users)

    # === אוטו-טריגר: אם הקבוצה הזו השלימה 6 משחקים → לסמן ניקוד טבלת מיקום ===
    if stage == "group" and match.get("group_name"):
        actuals = compute_actual_group_standings(match["group_name"])
        if actuals:
            try:
                gs_summary = calculate_group_standings_score(match["group_name"], *actuals)
                summary["group_standings_finalized"] = {
                    "group": match["group_name"],
                    "actual_standings": list(actuals),
                    **gs_summary,
                }
            except Exception as e:
                logger.warning(f"Group standings finalization failed for {match['group_name']}: {e}")

        # אם זה היה המשחק האחרון בשלב הבתים (72) → ממלא placeholders ב-knockouts
        finished_count = (
            supabase_admin.table("matches")
            .select("id", count="exact")
            .eq("stage", "group")
            .eq("status", "finished")
            .execute()
        ).count or 0
        if finished_count >= 72:
            try:
                from app.services import bracket_resolver
                br_summary = bracket_resolver.resolve_knockout_brackets()
                summary["brackets_resolved"] = br_summary
            except Exception as e:
                logger.warning(f"Bracket resolution failed (non-fatal): {e}")

    # === אוטו-טריגר: אחרי משחק נוקאאוט → לפענח placeholders של W/L בשלבים הבאים ===
    if stage in ("r32", "r16", "qf", "sf"):
        try:
            from app.services import bracket_resolver
            br_summary = bracket_resolver.resolve_knockout_brackets()
            if br_summary.get("updated", 0) > 0:
                summary["brackets_resolved"] = br_summary
        except Exception as e:
            logger.warning(f"Bracket resolution failed after knockout (non-fatal): {e}")

    # === Push: תוצאת משחק + שינויי דירוג (per-game) ===
    # מבודד ב-try כדי שלא תפיל את כל החישוב אם push נכשל
    try:
        from app.services import notifications
        notifications.trigger_match_result(match_id, summary)
        notifications.trigger_rank_changes_all_games()
    except Exception as e:
        logger.warning(f"Push notifications failed (non-fatal): {e}")

    return summary


def revert_match_score(match_id: int) -> dict:
    """
    מבטל את הניקוד שניתן על משחק (לתיקוני UEFA / שגיאות הזנה).
    מוחק את ה-score_events של המשחק כדי שניתן יהיה להריץ calculate_match_score
    מחדש על תוצאה חדשה. אחרי revert ה-aggregates ב-scores מתאפסים.
    """
    match_result = (
        supabase_admin.table("matches")
        .select("stage")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_result.data:
        raise ValueError(f"Match {match_id} not found")

    stage = match_result.data[0]["stage"]
    source_ref = str(match_id)

    # שליפת ה-events כדי לדעת אילו משתמשים מושפעים
    events = (
        supabase_admin.table("score_events")
        .select("user_id, source_type, points")
        .eq("source_ref", source_ref)
        .in_("source_type", [_stage_to_source_type(stage), "double_down_bonus"])
        .execute()
    )

    affected_users: set[str] = set()
    reverted_count = 0

    for ev in events.data or []:
        affected_users.add(ev["user_id"])
        reverted_count += 1

    # מחיקה בלוט (אחר אחד) של כל ה-events של המשחק
    if events.data:
        supabase_admin.table("score_events").delete().eq(
            "source_ref", source_ref
        ).in_("source_type", [_stage_to_source_type(stage), "double_down_bonus"]).execute()

    # מאפסים את predictions_matches.points_earned
    supabase_admin.table("predictions_matches").update({
        "points_earned": None,
        "points_breakdown": None,
    }).eq("match_id", match_id).execute()

    # אם היו DD tokens שהופעלו על המשחק — מחזירים אותם ל-active
    supabase_admin.table("double_down_tokens").update({
        "status": "active",
        "points_earned": None,
        "finalized_at": None,
    }).eq("match_id", match_id).eq("status", "used").execute()

    # רענון aggregations
    for uid in affected_users:
        _refresh_user_scores(uid)

    return {
        "match_id": match_id,
        "reverted_events": reverted_count,
        "affected_users": len(affected_users),
    }


def compute_actual_group_standings(group_name: str) -> Optional[tuple[str, str, str, str]]:
    """
    מחשב טבלת מיקום אמיתית בקבוצה מתוך 6 המשחקים שהסתיימו.
    מחזיר tuple של (1st, 2nd, 3rd, 4th) או None אם הקבוצה עדיין לא שלמה.

    קריטריונים (לפי FIFA):
    1. נקודות (W=3, D=1, L=0).
    2. הפרש שערים.
    3. שערים שהובקעו.
    4. שם הקבוצה (טיי-ברייקר דטרמיניסטי לדמו — בייצור עדיף h2h).
    """
    matches_res = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,status")
        .eq("stage", "group")
        .eq("group_name", group_name)
        .execute()
    )
    matches = matches_res.data or []

    # צריך שכל 6 המשחקים יהיו finished
    finished = [m for m in matches if m["status"] == "finished" and m["score_home"] is not None]
    if len(finished) != 6:
        return None

    standings: dict[str, dict] = {}
    for m in finished:
        for team in (m["team_home"], m["team_away"]):
            standings.setdefault(team, {"pts": 0, "gf": 0, "ga": 0, "gd": 0, "name": team})

        h, a = m["score_home"], m["score_away"]
        home, away = m["team_home"], m["team_away"]

        standings[home]["gf"] += h
        standings[home]["ga"] += a
        standings[away]["gf"] += a
        standings[away]["ga"] += h

        if h > a:
            standings[home]["pts"] += 3
        elif h < a:
            standings[away]["pts"] += 3
        else:
            standings[home]["pts"] += 1
            standings[away]["pts"] += 1

    for s in standings.values():
        s["gd"] = s["gf"] - s["ga"]

    if len(standings) != 4:
        return None

    ordered = sorted(
        standings.values(),
        key=lambda s: (-s["pts"], -s["gd"], -s["gf"], s["name"]),
    )
    return (ordered[0]["name"], ordered[1]["name"], ordered[2]["name"], ordered[3]["name"])


def finalize_group_stage() -> dict:
    """
    מריץ ניקוד טבלאות מיקום ל-12 הקבוצות. אידמפוטנטי — אם כבר חושב, ה-UNIQUE
    constraint על score_events ימנע double-counting; ערכי points_earned יתעדכנו לאותו ערך.
    """
    groups = sorted({chr(ord("A") + i) for i in range(12)})
    summary = {"groups_finalized": 0, "groups_skipped": 0, "groups": []}

    for g in groups:
        actuals = compute_actual_group_standings(g)
        if not actuals:
            summary["groups_skipped"] += 1
            continue
        res = calculate_group_standings_score(g, *actuals)
        summary["groups"].append({**res, "actual_standings": list(actuals)})
        summary["groups_finalized"] += 1

    return summary


def calculate_group_standings_score(
    group_name: str,
    actual_1st: str,
    actual_2nd: str,
    actual_3rd: str,
    actual_4th: str,
) -> dict:
    """
    מחשב ניקוד טבלת מיקום בקבוצה בסוף שלב הבתים.
    נקרא ידנית (או מ-cron) אחרי שכל 6 משחקי הקבוצה הסתיימו.
    """
    preds = (
        supabase_admin.table("predictions_groups")
        .select("*")
        .eq("group_name", group_name)
        .execute()
    )

    affected_users: set[str] = set()
    summary = {
        "group_name": group_name,
        "users_scored": 0,
        "total_points": 0,
    }

    for pred in preds.data or []:
        user_id = pred["user_id"]
        affected_users.add(user_id)

        pts, breakdown = score_group_standings(
            pred_1st=pred["team_1st"],
            pred_2nd=pred["team_2nd"],
            pred_3rd=pred["team_3rd"],
            pred_4th=pred["team_4th"],
            actual_1st=actual_1st,
            actual_2nd=actual_2nd,
            actual_3rd=actual_3rd,
            actual_4th=actual_4th,
        )

        # שני source_types נפרדים: position + perfect bonus (כדי שיהיה ניתן ל-revert בנפרד)
        position_pts = breakdown.get("position_points", 0)
        perfect_bonus = breakdown.get("perfect_bonus", 0)

        if position_pts > 0:
            _add_score_event(
                user_id=user_id,
                source_type=f"group_position_{group_name}",
                source_ref=group_name,
                points=position_pts,
                reason=f"Group {group_name}: {breakdown['positions_correct']}/4 positions correct",
            )
        if perfect_bonus > 0:
            _add_score_event(
                user_id=user_id,
                source_type=f"group_perfect_{group_name}",
                source_ref=group_name,
                points=perfect_bonus,
                reason=f"Group {group_name}: perfect standings bonus",
            )

        supabase_admin.table("predictions_groups").update({
            "points_earned": pts,
            "points_breakdown": breakdown,
        }).eq("user_id", user_id).eq("group_name", group_name).execute()

        if pts > 0:
            summary["users_scored"] += 1
            summary["total_points"] += pts

    for uid in affected_users:
        _refresh_user_scores(uid)

    return summary


def calculate_tournament_predictions_score(actuals: TournamentActuals) -> dict:
    """
    מחשב ניקוד ניחושי טווח-ארוך בסוף הטורניר.
    נקרא ידנית (או מ-cron) אחרי שהטורניר נגמר.
    """
    preds = (
        supabase_admin.table("predictions_tournament")
        .select("*")
        .execute()
    )

    affected_users: set[str] = set()
    summary = {
        "users_scored": 0,
        "total_points": 0,
    }

    for pred in preds.data or []:
        user_id = pred["user_id"]
        affected_users.add(user_id)

        pts, breakdown = score_tournament_predictions(
            pred_winner=pred.get("winner"),
            pred_finalist_1=pred.get("finalist_1"),
            pred_finalist_2=pred.get("finalist_2"),
            pred_semifinalist_1=pred.get("semifinalist_1"),
            pred_semifinalist_2=pred.get("semifinalist_2"),
            pred_semifinalist_3=pred.get("semifinalist_3"),
            pred_semifinalist_4=pred.get("semifinalist_4"),
            pred_top_scorer=pred.get("top_scorer"),
            pred_top_assister=pred.get("top_assister"),
            pred_golden_ball=pred.get("golden_ball"),
            actuals=actuals,
        )

        # source_type נפרד לכל קטגוריה כדי לאפשר revert מפורט
        category_map = {
            "champion": ("awards_champion", "champion"),
            "both_finalists": ("awards_finalists", "finalists"),
            "one_finalist": ("awards_finalists", "finalists"),
            "semifinalists_each": ("awards_semifinalists", "semifinalists_each"),
            "all_4_semifinalists_bonus": ("awards_semifinalists", "semifinalists_bonus"),
            "top_scorer": ("awards_top_scorer", "top_scorer"),
            "top_assister": ("awards_top_assister", "top_assister"),
            "golden_ball": ("awards_golden_ball", "golden_ball"),
        }

        for breakdown_key, (source_type, ref) in category_map.items():
            cat_pts = breakdown.get(breakdown_key, 0)
            if cat_pts > 0:
                _add_score_event(
                    user_id=user_id,
                    source_type=source_type,
                    source_ref=ref,
                    points=cat_pts,
                    reason=f"Tournament long-term: {breakdown_key}",
                )

        supabase_admin.table("predictions_tournament").update({
            "points_earned": pts,
            "points_breakdown": breakdown,
        }).eq("user_id", user_id).execute()

        if pts > 0:
            summary["users_scored"] += 1
            summary["total_points"] += pts

    for uid in affected_users:
        _refresh_user_scores(uid)

    return summary
