"""
Predictions API — endpoints לכל סוגי הניחושים.

מבנה ה-routes:
- /api/predictions/matches       — ניחושי משחקים בודדים
- /api/predictions/groups        — ניחושי טבלת בית (12 קבוצות)
- /api/predictions/tournament    — ניחושי טווח-ארוך (אלופה, פיינליסטיות, פרסים)
- /api/predictions/double-down   — ניהול ז'יטוני Double Down

עקרונות:
- כל ה-endpoints דורשים אימות (get_current_user).
- כתיבה מותרת רק לפני lock (predictions_locked=false על המשחק או locked_at IS NULL על שאר).
- ניחוש חדש = INSERT. עדכון ניחוש קיים = UPDATE עם בדיקה שלא נעול עדיין.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.constants import DOUBLE_DOWN_ROUNDS
from app.db.supabase import supabase_admin
from app.schemas.prediction import (
    DoubleDownActivate,
    DoubleDownTokenOut,
    GroupStandingsOut,
    GroupStandingsUpsert,
    MatchPredictionOut,
    MatchPredictionUpsert,
    TournamentPredictionsOut,
    TournamentPredictionsUpsert,
)

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


# ============================================================
# Match predictions
# ============================================================


def _get_match_or_404(match_id: int) -> dict:
    result = (
        supabase_admin.table("matches")
        .select("*")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return result.data


def _assert_match_open(match: dict) -> None:
    if match.get("predictions_locked"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ניחושים נעולים למשחק זה",
        )


@router.get("/matches", response_model=list[MatchPredictionOut])
def list_my_match_predictions(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[MatchPredictionOut]:
    """כל הניחושים של המשתמש לכל המשחקים."""
    result = (
        supabase_admin.table("predictions_matches")
        .select("*")
        .eq("user_id", user.id)
        .execute()
    )
    return [MatchPredictionOut(**row) for row in result.data]


@router.put("/matches/{match_id}", response_model=MatchPredictionOut)
def upsert_match_prediction(
    match_id: int,
    payload: MatchPredictionUpsert,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> MatchPredictionOut:
    """יוצר או מעדכן ניחוש למשחק. נכשל ב-403 אם הניחושים נעולים."""
    match = _get_match_or_404(match_id)
    _assert_match_open(match)

    data = {
        "user_id": user.id,
        "match_id": match_id,
        "direction": payload.direction,
        "score_home": payload.score_home,
        "score_away": payload.score_away,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        supabase_admin.table("predictions_matches")
        .upsert(data, on_conflict="user_id,match_id")
        .execute()
    )
    return MatchPredictionOut(**result.data[0])


# ============================================================
# Group standings predictions
# ============================================================


def _tournament_has_started() -> bool:
    """
    True אם המשחק הראשון כבר התחיל (kickoff_utc <= now), או אם משחק כלשהו
    כבר במצב live/finished (למשל לאחר סימולציה).
    """
    # תנאי א' — תאריך
    first = (
        supabase_admin.table("matches")
        .select("kickoff_utc")
        .order("kickoff_utc")
        .limit(1)
        .execute()
    )
    if first.data:
        kickoff = datetime.fromisoformat(first.data[0]["kickoff_utc"].replace("Z", "+00:00"))
        if kickoff <= datetime.now(timezone.utc):
            return True

    # תנאי ב' — כל משחק שכבר רץ/הסתיים (סימולציה / הזנה ידנית)
    played = (
        supabase_admin.table("matches")
        .select("id", count="exact")
        .in_("status", ["live", "finished"])
        .limit(1)
        .execute()
    )
    return (played.count or 0) > 0


def _assert_group_open(user_id: str, group_name: str) -> None:
    """ניחושי טבלת בית ננעלים: או ע"י cron (locked_at), או אם הטורניר כבר התחיל."""
    if _tournament_has_started():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="ניחושי הבתים נעולים — המונדיאל כבר התחיל",
        )
    existing = (
        supabase_admin.table("predictions_groups")
        .select("locked_at")
        .eq("user_id", user_id)
        .eq("group_name", group_name)
        .maybe_single()
        .execute()
    )
    if existing and existing.data and existing.data.get("locked_at"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ניחושי הבית נעולים",
        )


@router.get("/groups", response_model=list[GroupStandingsOut])
def list_my_group_predictions(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[GroupStandingsOut]:
    result = (
        supabase_admin.table("predictions_groups")
        .select("*")
        .eq("user_id", user.id)
        .execute()
    )
    return [GroupStandingsOut(**row) for row in result.data]


@router.put("/groups/{group_name}", response_model=GroupStandingsOut)
def upsert_group_prediction(
    group_name: str,
    payload: GroupStandingsUpsert,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> GroupStandingsOut:
    if not (1 <= len(group_name) <= 4):
        raise HTTPException(status_code=400, detail="group_name חייב 1-4 תווים")
    group_name = group_name.upper()
    _assert_group_open(user.id, group_name)

    # ולידציה: 4 קבוצות ייחודיות
    teams = {payload.team_1st, payload.team_2nd, payload.team_3rd, payload.team_4th}
    if len(teams) != 4:
        raise HTTPException(status_code=400, detail="4 הקבוצות חייבות להיות שונות")

    data = {
        "user_id": user.id,
        "group_name": group_name,
        "team_1st": payload.team_1st,
        "team_2nd": payload.team_2nd,
        "team_3rd": payload.team_3rd,
        "team_4th": payload.team_4th,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        supabase_admin.table("predictions_groups")
        .upsert(data, on_conflict="user_id,group_name")
        .execute()
    )
    return GroupStandingsOut(**result.data[0])


# ============================================================
# Tournament-wide predictions (long-term)
# ============================================================


def _assert_tournament_open(user_id: str) -> None:
    """ננעל שעה לפני המשחק הראשון (cron), או ברגע שהמונדיאל מתחיל."""
    if _tournament_has_started():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="ניחושי המצטיינים נעולים — המונדיאל כבר התחיל",
        )
    existing = (
        supabase_admin.table("predictions_tournament")
        .select("locked_at")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data and existing.data.get("locked_at"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ניחושי הטורניר נעולים",
        )


@router.get("/tournament", response_model=TournamentPredictionsOut | None)
def get_my_tournament_predictions(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TournamentPredictionsOut | None:
    result = (
        supabase_admin.table("predictions_tournament")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        return None
    return TournamentPredictionsOut(**result.data)


@router.put("/tournament", response_model=TournamentPredictionsOut)
def upsert_tournament_predictions(
    payload: TournamentPredictionsUpsert,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TournamentPredictionsOut:
    _assert_tournament_open(user.id)

    data = {
        "user_id": user.id,
        **payload.model_dump(exclude_none=False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        supabase_admin.table("predictions_tournament")
        .upsert(data, on_conflict="user_id")
        .execute()
    )
    return TournamentPredictionsOut(**result.data[0])


# ============================================================
# Double Down tokens
# ============================================================


@router.get("/double-down", response_model=list[DoubleDownTokenOut])
def list_my_double_down_tokens(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[DoubleDownTokenOut]:
    """8 הז'יטונים של המשתמש (מסודרים לפי הסדר ההגיוני של השלבים)."""
    order_keys = list(DOUBLE_DOWN_ROUNDS.keys())  # group_r1, group_r2, ..., final
    result = (
        supabase_admin.table("double_down_tokens")
        .select("*")
        .eq("user_id", user.id)
        .execute()
    )
    # מיון לפי סדר השלבים
    sorted_tokens = sorted(result.data, key=lambda t: order_keys.index(t["round_key"]))
    return [DoubleDownTokenOut(**t) for t in sorted_tokens]


@router.put("/double-down/{round_key}/activate", response_model=DoubleDownTokenOut)
def activate_double_down(
    round_key: str,
    payload: DoubleDownActivate,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> DoubleDownTokenOut:
    """
    מפעיל ז'יטון על משחק ספציפי.
    תנאים:
    - הז'יטון חייב להיות בסטטוס 'available' או 'active' (אם 'active' — שנה משחק).
    - המשחק חייב להיות בשלב/מחזור שתואם ל-round_key.
    - המשחק לא נעול לניחושים.
    """
    if round_key not in DOUBLE_DOWN_ROUNDS:
        raise HTTPException(status_code=400, detail=f"round_key לא חוקי: {round_key}")

    round_meta = DOUBLE_DOWN_ROUNDS[round_key]

    # שליפת הטוקן
    token_res = (
        supabase_admin.table("double_down_tokens")
        .select("*")
        .eq("user_id", user.id)
        .eq("round_key", round_key)
        .maybe_single()
        .execute()
    )
    if not token_res or not token_res.data:
        raise HTTPException(status_code=404, detail="ז'יטון לא נמצא")
    token = token_res.data
    if token["status"] == "used":
        raise HTTPException(status_code=409, detail="הז'יטון כבר מומש")

    # שליפת המשחק + בדיקה שהוא בשלב המתאים
    match = _get_match_or_404(payload.match_id)
    _assert_match_open(match)

    allowed_stages = round_meta["stages"]
    if match["stage"] not in allowed_stages:
        raise HTTPException(
            status_code=400,
            detail=f"הז'יטון תקף לשלבים {allowed_stages}, לא ל-{match['stage']}",
        )
    # למחזורי בתים (group_r1/2/3) — חייב גם להתאים ל-group_round
    if "group_round" in round_meta:
        if match.get("group_round") != round_meta["group_round"]:
            raise HTTPException(
                status_code=400,
                detail=f"הז'יטון תקף למחזור בתים {round_meta['group_round']}, לא ל-{match.get('group_round')}",
            )

    # עדכון הטוקן
    now = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase_admin.table("double_down_tokens")
        .update({
            "match_id": payload.match_id,
            "status": "active",
            "activated_at": now,
        })
        .eq("id", token["id"])
        .execute()
    )
    return DoubleDownTokenOut(**updated.data[0])


@router.delete("/double-down/{round_key}", response_model=DoubleDownTokenOut)
def deactivate_double_down(
    round_key: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> DoubleDownTokenOut:
    """ביטול הפעלת ז'יטון (רק אם המשחק עוד לא נעול)."""
    if round_key not in DOUBLE_DOWN_ROUNDS:
        raise HTTPException(status_code=400, detail=f"round_key לא חוקי: {round_key}")

    token_res = (
        supabase_admin.table("double_down_tokens")
        .select("*")
        .eq("user_id", user.id)
        .eq("round_key", round_key)
        .maybe_single()
        .execute()
    )
    if not token_res or not token_res.data:
        raise HTTPException(status_code=404, detail="ז'יטון לא נמצא")
    token = token_res.data
    if token["status"] == "used":
        raise HTTPException(status_code=409, detail="הז'יטון כבר מומש — לא ניתן לבטל")

    # אם הוא active, צריך לבדוק שהמשחק עוד לא נעול
    if token["match_id"]:
        match = _get_match_or_404(token["match_id"])
        if match["predictions_locked"]:
            raise HTTPException(
                status_code=403,
                detail="המשחק שעליו הז'יטון פעיל כבר נעול — לא ניתן להזיז",
            )

    updated = (
        supabase_admin.table("double_down_tokens")
        .update({"match_id": None, "status": "available", "activated_at": None})
        .eq("id", token["id"])
        .execute()
    )
    return DoubleDownTokenOut(**updated.data[0])
