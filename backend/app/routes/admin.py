"""
Admin endpoints — בדיקות, תיקונים, וניהול תוצאות ידני.

כל endpoint דורש is_admin=true (`require_admin` dependency).

בשלב זה (Phase 5) חשוב במיוחד:
- POST /api/admin/matches/{match_id}/result — הזנת תוצאה ידנית + הפעלת scoring
- POST /api/admin/matches/{match_id}/revert  — ביטול ניקוד למשחק
- GET  /api/admin/score-audit/{user_id}      — audit trail מלא של ניקוד משתמש
- GET  /api/admin/score-verify               — בדיקת קונסיסטנטיות של כל הניקוד
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.services import scoring, scoring_audit

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ============================================================
# Dependency: רק אדמין
# ============================================================

def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


AdminUser = Annotated[AuthenticatedUser, Depends(require_admin)]


# ============================================================
# Schemas
# ============================================================

class MatchResultIn(BaseModel):
    """תוצאה ידנית למשחק. גם משנה status ל-'finished' (אלא אם מצוין אחרת)."""
    score_home: int = Field(ge=0, le=20)
    score_away: int = Field(ge=0, le=20)
    score_home_ht: Optional[int] = Field(default=None, ge=0, le=20)
    score_away_ht: Optional[int] = Field(default=None, ge=0, le=20)
    set_finished: bool = Field(default=True, description="האם להעביר את המשחק ל-status='finished' ולחשב ניקוד מיד")


class MatchResultOut(BaseModel):
    match_id: int
    status: str
    score_home: int
    score_away: int
    scoring_summary: Optional[dict] = None


class ScoreEventOut(BaseModel):
    id: str
    source_type: str
    source_ref: str
    points: int
    reason: str | None
    computed_at: str
    computed_by: str


class UserScoreAuditOut(BaseModel):
    user_id: str
    username: str
    scores_total: int
    events_sum: int
    consistent: bool
    events: list[ScoreEventOut]


# ============================================================
# Endpoints
# ============================================================

@router.post("/matches/{match_id}/result", response_model=MatchResultOut)
def set_match_result(
    match_id: int,
    payload: MatchResultIn,
    _admin: AdminUser,
) -> MatchResultOut:
    """
    מזין תוצאה ידנית למשחק.
    אם set_finished=true — המשחק עובר ל-'finished' וה-scoring engine רץ אוטומטית.
    """
    match_check = (
        supabase_admin.table("matches")
        .select("id, status")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_check.data:
        raise HTTPException(404, f"Match {match_id} not found")

    update = {
        "score_home": payload.score_home,
        "score_away": payload.score_away,
    }
    if payload.score_home_ht is not None:
        update["score_home_ht"] = payload.score_home_ht
    if payload.score_away_ht is not None:
        update["score_away_ht"] = payload.score_away_ht
    if payload.set_finished:
        update["status"] = "finished"
        update["finished_at"] = "now()"

    supabase_admin.table("matches").update(update).eq("id", match_id).execute()

    scoring_summary = None
    if payload.set_finished:
        scoring_summary = scoring.calculate_match_score(match_id)

    return MatchResultOut(
        match_id=match_id,
        status="finished" if payload.set_finished else match_check.data[0]["status"],
        score_home=payload.score_home,
        score_away=payload.score_away,
        scoring_summary=scoring_summary,
    )


@router.post("/matches/{match_id}/revert", response_model=dict)
def revert_match_score(match_id: int, _admin: AdminUser) -> dict:
    """מבטל את הניקוד שניתן על משחק. שימושי לתיקוני תוצאה."""
    return scoring.revert_match_score(match_id)


@router.get("/score-audit/{user_id}", response_model=UserScoreAuditOut)
def get_user_score_audit(user_id: str, _admin: AdminUser) -> UserScoreAuditOut:
    """
    מציג audit trail מלא של ניקוד למשתמש: כל ה-score_events שלו וסכומם
    מול ה-aggregate ב-scores. שקיפות מלאה אם מישהו מערער.
    """
    user_result = (
        supabase_admin.table("users")
        .select("id, username")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not user_result.data:
        raise HTTPException(404, "User not found")

    audit = scoring_audit.verify_user_scores(user_id)
    events = (
        supabase_admin.table("score_events")
        .select("*")
        .eq("user_id", user_id)
        .order("computed_at", desc=True)
        .execute()
    )

    return UserScoreAuditOut(
        user_id=user_id,
        username=user_result.data[0]["username"],
        scores_total=audit["scores_total"],
        events_sum=audit["events_sum"],
        consistent=audit["consistent"],
        events=[ScoreEventOut(**e) for e in (events.data or [])],
    )


@router.get("/score-verify", response_model=dict)
def verify_all_scores(_admin: AdminUser) -> dict:
    """
    מאמת קונסיסטנטיות של ניקוד לכל המשתמשים.
    מחזיר רשימה של mismatches (אם יש) — חייב להיות ריק במצב תקין.
    """
    return scoring_audit.verify_all_scores()
