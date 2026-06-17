"""
Tournament-wide endpoints — מצטייני הטורניר (מלך שערים + מלך בישולים).

המידע מאוכלס על ידי crons/sync_player_stats.py כל שעה (top 10 לכל קטגוריה).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.match import PlayerStatOut


router = APIRouter(prefix="/api/tournament", tags=["tournament"])

# טבלאות המצטיינים מתעדכנות שעתי בקרון, אבל בלי הצהרה מפורשת הדפדפן/PWA
# נכנס ל-heuristic caching ומציג נתונים ישנים גם אחרי שה-DB התעדכן.
# no-cache מאלצת revalidation בכל קריאה (ETag/304 לא נשמר כאן — תמיד גוף מלא).
_NO_CACHE = "no-cache, must-revalidate"


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
    response: Response,
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[PlayerStatOut]:
    """מלך שערים — top 10 בטורניר."""
    response.headers["Cache-Control"] = _NO_CACHE
    return _fetch_top("top_scorers")


@router.get("/top-assisters", response_model=list[PlayerStatOut])
def get_top_assisters(
    response: Response,
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[PlayerStatOut]:
    """מלך בישולים — top 10 בטורניר."""
    response.headers["Cache-Control"] = _NO_CACHE
    return _fetch_top("top_assisters")
