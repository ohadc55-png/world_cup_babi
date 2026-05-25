"""
Leaderboard API — טבלת ניקוד חיה.

GET /api/leaderboard — כל המשתמשים מסודרים לפי total_points יורד.
GET /api/leaderboard/me — הניקוד שלי + ההישגים שלי לפי קטגוריות.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


# ============================================================
# Schemas
# ============================================================

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    avatar_url: str | None = None
    total_points: int
    group_stage_pts: int
    knockout_pts: int
    awards_pts: int
    double_down_pts: int
    correct_count: int
    total_predictions: int
    last_calculated: str | None = None


class MyScoreDetail(BaseModel):
    rank: int | None
    total_users: int
    total_points: int
    group_stage_pts: int
    knockout_pts: int
    awards_pts: int
    double_down_pts: int
    correct_count: int
    total_predictions: int
    points_to_next: int | None       # פער מהאדם מעליי
    points_above_below: int | None   # פער מהאדם תחתיי


# ============================================================
# Endpoints
# ============================================================

@router.get("", response_model=list[LeaderboardEntry])
def get_leaderboard(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[LeaderboardEntry]:
    """
    מחזיר את הלוח של המשחק שהמשתמש חבר בו, מסודר לפי total_points יורד.
    משתמש שלא במשחק (game_id=null) → מחזיר רשימה ריקה.
    rank מחושב on-the-fly (1, 2, 3, ...).
    """
    if not user.game_id:
        return []

    # שולפים רק משתמשים מאותו game
    members_result = (
        supabase_admin.table("users")
        .select("id, username, avatar_url")
        .eq("game_id", user.game_id)
        .execute()
    )
    members = members_result.data or []
    if not members:
        return []

    members_ids = [m["id"] for m in members]
    users_by_id = {m["id"]: m for m in members}

    scores_result = (
        supabase_admin.table("scores")
        .select("*")
        .in_("user_id", members_ids)
        .order("total_points", desc=True)
        .execute()
    )
    scores = scores_result.data or []

    entries: list[LeaderboardEntry] = []
    for idx, s in enumerate(scores, start=1):
        u = users_by_id.get(s["user_id"])
        if not u:
            continue  # user נמחק אבל scores נשאר — דלג

        entries.append(
            LeaderboardEntry(
                rank=idx,
                user_id=s["user_id"],
                username=u["username"],
                avatar_url=u.get("avatar_url"),
                total_points=s["total_points"],
                group_stage_pts=s["group_stage_pts"],
                knockout_pts=s["knockout_pts"],
                awards_pts=s["awards_pts"],
                double_down_pts=s.get("double_down_pts", 0),
                correct_count=s["correct_count"],
                total_predictions=s["total_predictions"],
                last_calculated=s.get("last_calculated"),
            )
        )

    return entries


@router.get("/me", response_model=MyScoreDetail)
def get_my_score(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> MyScoreDetail:
    """הניקוד שלי + פערים מהמיקום הסמוך."""
    leaderboard = get_leaderboard(user)
    total_users = len(leaderboard)

    if total_users == 0:
        return MyScoreDetail(
            rank=None, total_users=0, total_points=0,
            group_stage_pts=0, knockout_pts=0, awards_pts=0,
            double_down_pts=0, correct_count=0, total_predictions=0,
            points_to_next=None, points_above_below=None,
        )

    my_index = next(
        (i for i, e in enumerate(leaderboard) if e.user_id == user.id),
        None,
    )

    if my_index is None:
        # אין רשומה ב-scores עדיין למשתמש זה (יוצרים את הרשומה ברישום, אבל ליתר ביטחון)
        return MyScoreDetail(
            rank=None, total_users=total_users, total_points=0,
            group_stage_pts=0, knockout_pts=0, awards_pts=0,
            double_down_pts=0, correct_count=0, total_predictions=0,
            points_to_next=None, points_above_below=None,
        )

    me = leaderboard[my_index]
    points_to_next = (
        leaderboard[my_index - 1].total_points - me.total_points
        if my_index > 0 else None
    )
    points_above_below = (
        me.total_points - leaderboard[my_index + 1].total_points
        if my_index < total_users - 1 else None
    )

    return MyScoreDetail(
        rank=me.rank,
        total_users=total_users,
        total_points=me.total_points,
        group_stage_pts=me.group_stage_pts,
        knockout_pts=me.knockout_pts,
        awards_pts=me.awards_pts,
        double_down_pts=me.double_down_pts,
        correct_count=me.correct_count,
        total_predictions=me.total_predictions,
        points_to_next=points_to_next,
        points_above_below=points_above_below,
    )
