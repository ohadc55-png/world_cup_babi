"""
Tournament-wide endpoints — מצטייני הטורניר (מלך שערים + מלך בישולים).

המידע מאוכלס על ידי crons/sync_player_stats.py כל שעה (top 10 לכל קטגוריה).
"""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.match import PlayerStatOut


router = APIRouter(prefix="/api/tournament", tags=["tournament"])


def _fetch_top(category: str) -> list[PlayerStatOut]:
    rows = (
        supabase_admin.table("tournament_top_athletes")
        .select("*")
        .eq("category", category)
        .order("rank")
        .limit(10)
        .execute()
    ).data or []
    return [PlayerStatOut(**r) for r in rows]


@router.get("/top-scorers", response_model=list[PlayerStatOut])
def get_top_scorers(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[PlayerStatOut]:
    """מלך שערים — top 10 בטורניר."""
    return _fetch_top("top_scorers")


@router.get("/top-assisters", response_model=list[PlayerStatOut])
def get_top_assisters(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[PlayerStatOut]:
    """מלך בישולים — top 10 בטורניר."""
    return _fetch_top("top_assisters")
