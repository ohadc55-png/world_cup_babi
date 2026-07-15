"""
Tournament-wide endpoints:
  - מצטייני הטורניר (מלך שערים + מלך בישולים) — מאוכלס מקרון כל שעה
  - "מי ניחש מה" — ניחושי טווח-ארוך של כל חברי הקבוצה (אחרי תחילת הטורניר)
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.match import PlayerStatOut
from app.schemas.prediction import MemberTournamentPrediction


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


# ============================================================
# "מי ניחש מה" — ניחושי טווח-ארוך של כל חברי הקבוצה
# ============================================================

def _tournament_has_started() -> bool:
    """
    True אם המשחק הראשון התחיל (kickoff_utc עבר), או אם יש כבר משחק
    בסטטוס live/finished. אחרת False.

    זהה ללוגיקה ב-users.py / predictions.py / games.py — נשאר כפול בכוונה
    כי קל לחפש (אין שורש אמת יחיד היום, אבל פשוט להבין).
    """
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
    played = (
        supabase_admin.table("matches")
        .select("id", count="exact")
        .in_("status", ["live", "finished"])
        .limit(1)
        .execute()
    )
    return (played.count or 0) > 0


@router.get("/all-predictions", response_model=list[MemberTournamentPrediction])
def get_all_long_term_predictions(
    response: Response,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[MemberTournamentPrediction]:
    """
    מחזיר ניחושי טווח-ארוך של כל חברי הקבוצה (game_id) של המבקש.

    Privacy / fairness:
      - 403 אם הטורניר עדיין לא התחיל (ניחושים לא נעולים → לא חושפים).
      - מסונן ל-game_id של המשתמש בלבד — לא נוגע בנתונים של game אחר.
      - read-only. אין שום כתיבה ל-DB.
    """
    response.headers["Cache-Control"] = _NO_CACHE

    if not user.game_id:
        # משתמש שלא במשחק קבוצתי לא רואה שום ניחוש של אף אחד
        return []

    if not _tournament_has_started():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ניחושי טווח-ארוך נחשפים רק לאחר תחילת המונדיאל.",
        )

    # שלב 1: כל חברי ה-game של המבקש
    members = (
        supabase_admin.table("users")
        .select("id, username, avatar_url")
        .eq("game_id", user.game_id)
        .execute()
    ).data or []
    if not members:
        return []
    member_by_id = {m["id"]: m for m in members}
    member_ids = list(member_by_id.keys())

    # שלב 2: ניחושי טווח-ארוך של כל החברים (read-only)
    preds = (
        supabase_admin.table("predictions_tournament")
        .select(
            "user_id, winner, finalist_1, finalist_2, "
            "semifinalist_1, semifinalist_2, semifinalist_3, semifinalist_4, "
            "top_scorer, top_scorer_canonical, "
            "top_assister, top_assister_canonical, "
            "golden_ball"
        )
        .in_("user_id", member_ids)
        .execute()
    ).data or []
    pred_by_user = {p["user_id"]: p for p in preds}

    # מצב ה-actuals הידוע כרגע — פעם אחת לכל הבקשה (read-only)
    from app.schemas.prediction import LongTermPointsBreakdown
    from app.services import scoring
    known_actuals = scoring.compute_known_longterm_actuals()

    # שלב 3: build response — כולל גם משתמשים בלי ניחוש (כל השדות None)
    out: list[MemberTournamentPrediction] = []
    for uid, m in member_by_id.items():
        p = pred_by_user.get(uid, {})
        # נקודות per-slot רק אם למשתמש יש ניחוש כלשהו
        points = None
        if p:
            points = LongTermPointsBreakdown(**scoring.compute_longterm_points_display(p, known_actuals))
        out.append(MemberTournamentPrediction(
            user_id=uid,
            username=m["username"],
            avatar_url=m.get("avatar_url"),
            winner=p.get("winner"),
            finalist_1=p.get("finalist_1"),
            finalist_2=p.get("finalist_2"),
            semifinalist_1=p.get("semifinalist_1"),
            semifinalist_2=p.get("semifinalist_2"),
            semifinalist_3=p.get("semifinalist_3"),
            semifinalist_4=p.get("semifinalist_4"),
            top_scorer=p.get("top_scorer"),
            top_scorer_canonical=p.get("top_scorer_canonical"),
            top_assister=p.get("top_assister"),
            top_assister_canonical=p.get("top_assister_canonical"),
            golden_ball=p.get("golden_ball"),
            points=points,
        ))
    # מיון לפי username לעקביות בתצוגה
    out.sort(key=lambda x: x.username)
    return out
