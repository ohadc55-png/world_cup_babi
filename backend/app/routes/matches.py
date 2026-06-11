"""Matches API — קריאה בלבד. כל המשחקים זמינים לכל משתמש מאומת."""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.match import MatchOut, Stage

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=list[MatchOut])
def list_matches(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    stage: Stage | None = Query(default=None, description="סינון לפי שלב"),
    group_name: str | None = Query(default=None, max_length=4, description="A..L"),
    group_round: int | None = Query(default=None, ge=1, le=3),
    on_date: date | None = Query(default=None, alias="date", description="YYYY-MM-DD (UTC)"),
    upcoming_only: bool = Query(default=False, description="רק משחקים שעוד לא הסתיימו"),
) -> list[MatchOut]:
    """מחזיר רשימת משחקים ממוינת לפי kickoff_utc."""
    query = supabase_admin.table("matches").select("*").order("kickoff_utc")

    if stage:
        query = query.eq("stage", stage)
    if group_name:
        query = query.eq("group_name", group_name.upper())
    if group_round is not None:
        query = query.eq("group_round", group_round)
    if on_date:
        start = datetime.combine(on_date, time.min, tzinfo=timezone.utc)
        end = datetime.combine(on_date, time.max, tzinfo=timezone.utc)
        query = query.gte("kickoff_utc", start.isoformat()).lte("kickoff_utc", end.isoformat())
    if upcoming_only:
        query = query.neq("status", "finished")

    result = query.execute()
    return [MatchOut(**row) for row in result.data]


@router.get("/today", response_model=list[MatchOut])
def matches_today(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[MatchOut]:
    """משחקי היום (UTC). שימוש מהיר ב-Home Dashboard."""
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    end = datetime.combine(today, time.max, tzinfo=timezone.utc)
    result = (
        supabase_admin.table("matches")
        .select("*")
        .gte("kickoff_utc", start.isoformat())
        .lte("kickoff_utc", end.isoformat())
        .order("kickoff_utc")
        .execute()
    )
    return [MatchOut(**row) for row in result.data]


@router.get("/next", response_model=MatchOut | None)
def next_match(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> MatchOut | None:
    """
    "המשחק הבא" לתצוגת ה-Hero — סדר עדיפויות:
      1. משחק LIVE שמתנהל עכשיו (אם יש כזה).
      2. אחרת — המשחק הקרוב שעוד לא התחיל.
      3. אחרת — None (הטורניר נגמר).

    כך המסך הראשי עובר אוטומטית להציג את המשחק החי כשהוא מתחיל.
    """
    # priority 1: live match
    live = (
        supabase_admin.table("matches")
        .select("*")
        .eq("status", "live")
        .order("kickoff_utc")
        .limit(1)
        .execute()
    )
    if live.data:
        return MatchOut(**live.data[0])

    # priority 2: next scheduled match
    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase_admin.table("matches")
        .select("*")
        .gte("kickoff_utc", now)
        .neq("status", "finished")
        .order("kickoff_utc")
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return MatchOut(**result.data[0])


@router.get("/{match_id}", response_model=MatchOut)
def get_match(
    match_id: int,
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> MatchOut:
    """משחק יחיד לפי ID."""
    result = (
        supabase_admin.table("matches")
        .select("*")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return MatchOut(**result.data)


# ============================================================
# Match predictions list (per-match, all members of user's game)
# ============================================================

class MemberPredictionOut(BaseModel):
    """ניחוש של חבר במשחק בודד — מוצג בדף פרטי המשחק."""
    user_id: str
    username: str
    avatar_url: str | None = None
    direction: str | None = None     # "1" / "X" / "2" — None אם המשתמש לא ניחש
    score_home: int | None = None
    score_away: int | None = None
    points_earned: int | None = None       # רק אם המשחק נגמר
    points_breakdown: dict | None = None   # פירוט הניקוד (direction/exact_uplift/draw_bonus וכו')
    has_double_down: bool = False          # האם הופעל DD על המשחק הזה
    is_me: bool = False                    # האם זו השורה של המשתמש המבקש


@router.get("/{match_id}/predictions", response_model=list[MemberPredictionOut])
def get_match_predictions(
    match_id: int,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[MemberPredictionOut]:
    """
    מחזיר את כל ניחושי החברים *באותו משחק (game)* למשחק (match) הזה.

    גישה:
    - לפני lock — מחזיר רק את הניחוש של המשתמש עצמו (להגן על פרטיות).
    - אחרי lock או finished — מחזיר את הניחושים של כולם.

    מיון: לפי points_earned יורד (אם נגמר), אחרת לפי username.
    """
    # 1. שולפים את המשחק
    match_res = (
        supabase_admin.table("matches")
        .select("predictions_locked, status")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_res.data:
        raise HTTPException(404, "Match not found")
    match = match_res.data[0]
    is_visible = match["predictions_locked"] or match["status"] in ("live", "finished")

    # 2. ודא שיש לי game
    if not user.game_id:
        return []

    # 3. שולפים את החברים שלי
    members_res = (
        supabase_admin.table("users")
        .select("id, username, avatar_url")
        .eq("game_id", user.game_id)
        .execute()
    )
    members = members_res.data or []
    if not members:
        return []
    members_by_id = {m["id"]: m for m in members}

    # 4. אם לא נעול — מחזירים רק את הניחוש שלי
    target_user_ids = list(members_by_id.keys()) if is_visible else [user.id]

    # 5. שולפים predictions למשחק הזה של החברים הרלוונטיים
    preds_res = (
        supabase_admin.table("predictions_matches")
        .select("user_id, direction, score_home, score_away, points_earned, points_breakdown")
        .eq("match_id", match_id)
        .in_("user_id", target_user_ids)
        .execute()
    )
    preds_by_user = {p["user_id"]: p for p in (preds_res.data or [])}

    # 6. שולפים DD active למשחק זה
    dd_res = (
        supabase_admin.table("double_down_tokens")
        .select("user_id")
        .eq("match_id", match_id)
        .in_("status", ["active", "used"])
        .in_("user_id", target_user_ids)
        .execute()
    )
    dd_user_ids = {row["user_id"] for row in (dd_res.data or [])}

    # 7. בונים את התשובה — שורה לכל member רלוונטי (גם אם לא ניחש, מציגים שורה ריקה)
    rows: list[MemberPredictionOut] = []
    for uid in target_user_ids:
        m = members_by_id.get(uid)
        if not m:
            continue
        p = preds_by_user.get(uid) or {}
        rows.append(
            MemberPredictionOut(
                user_id=uid,
                username=m["username"],
                avatar_url=m.get("avatar_url"),
                direction=p.get("direction"),
                score_home=p.get("score_home"),
                score_away=p.get("score_away"),
                points_earned=p.get("points_earned"),
                points_breakdown=p.get("points_breakdown"),
                has_double_down=uid in dd_user_ids,
                is_me=(uid == user.id),
            )
        )

    # 8. מיון
    if match["status"] == "finished":
        rows.sort(key=lambda r: (-(r.points_earned or 0), r.username))
    else:
        rows.sort(key=lambda r: r.username.lower())

    return rows
