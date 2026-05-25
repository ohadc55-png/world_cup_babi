"""
Users API — פרופיל ציבורי של חבר במשחק.

GET /api/users/{user_id}/profile  — מחזיר username, score, וכל הניחושים.

עקרון חשיפה: ניחושים של משתמש אחר נחשפים רק אחרי שהמונדיאל התחיל
(_tournament_has_started). פרטי משחק ספציפי נחשפים רק אחרי שהמשחק
ננעל / חי / הסתיים.

המשתמש שמבקש חייב להיות באותו game_id כמו המשתמש המבוקש.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin

router = APIRouter(prefix="/api/users", tags=["users"])


def _tournament_has_started() -> bool:
    """אותו לוגיקה כמו ב-predictions.py / games.py — DRY-נשאר כפול בכוונה כי קל לחפש."""
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


# ============================================================
# Schemas
# ============================================================

class UserScoreOut(BaseModel):
    total_points: int = 0
    group_stage_pts: int = 0
    knockout_pts: int = 0
    awards_pts: int = 0
    double_down_pts: int = 0
    correct_count: int = 0
    total_predictions: int = 0
    rank: int | None = None


class ProfileMatchPredictionOut(BaseModel):
    """ניחוש משחק יחיד בפרופיל — כולל מטא של המשחק עצמו."""
    match_id: int
    stage: str
    group_name: str | None = None
    group_round: int | None = None
    kickoff_utc: str
    team_home: str
    team_away: str
    match_status: str           # scheduled/live/finished
    match_score_home: int | None = None
    match_score_away: int | None = None
    match_score_home_pen: int | None = None
    match_score_away_pen: int | None = None
    # ניחוש (None אם המשחק עוד לא נעול ולא הפרופיל שלי)
    direction: str | None = None
    pred_score_home: int | None = None
    pred_score_away: int | None = None
    points_earned: int | None = None
    has_double_down: bool = False


class ProfileGroupPredictionOut(BaseModel):
    group_name: str
    team_1st: str | None = None
    team_2nd: str | None = None
    team_3rd: str | None = None
    team_4th: str | None = None
    points_earned: int | None = None
    locked_at: str | None = None


class ProfileTournamentOut(BaseModel):
    winner: str | None = None
    finalist_1: str | None = None
    finalist_2: str | None = None
    semifinalist_1: str | None = None
    semifinalist_2: str | None = None
    semifinalist_3: str | None = None
    semifinalist_4: str | None = None
    top_scorer: str | None = None
    top_assister: str | None = None
    golden_ball: str | None = None
    points_earned: int | None = None


class UserProfileOut(BaseModel):
    user_id: str
    username: str
    avatar_url: str | None = None
    is_me: bool
    is_owner: bool
    tournament_has_started: bool
    score: UserScoreOut
    # אם tournament_has_started=False ולא is_me → רשימות יהיו ריקות
    match_predictions: list[ProfileMatchPredictionOut] = []
    group_predictions: list[ProfileGroupPredictionOut] = []
    tournament_predictions: ProfileTournamentOut | None = None


# ============================================================
# Endpoint
# ============================================================

@router.get("/{user_id}/profile", response_model=UserProfileOut)
def get_user_profile(
    user_id: str,
    me: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> UserProfileOut:
    """מחזיר פרופיל של משתמש (חייב להיות באותו משחק כמוני)."""
    if not me.game_id:
        raise HTTPException(404, "אתה לא במשחק")

    # שולפים את היעד
    target_res = (
        supabase_admin.table("users")
        .select("id, username, avatar_url, game_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not target_res or not target_res.data:
        raise HTTPException(404, "משתמש לא נמצא")
    target = target_res.data

    if target.get("game_id") != me.game_id:
        raise HTTPException(403, "המשתמש לא במשחק שלך")

    is_me = target["id"] == me.id
    started = _tournament_has_started()

    # בעלות
    game_res = (
        supabase_admin.table("games")
        .select("owner_user_id")
        .eq("id", me.game_id)
        .maybe_single()
        .execute()
    )
    is_owner = bool(game_res and game_res.data and game_res.data.get("owner_user_id") == target["id"])

    # ניקוד
    score_data: dict = {}
    score_res = (
        supabase_admin.table("scores")
        .select("*")
        .eq("user_id", target["id"])
        .maybe_single()
        .execute()
    )
    if score_res and score_res.data:
        score_data = score_res.data

    # rank — מחשבים מהמשחק
    rank: int | None = None
    members_res = (
        supabase_admin.table("users")
        .select("id")
        .eq("game_id", me.game_id)
        .execute()
    )
    member_ids = [m["id"] for m in (members_res.data or [])]
    if member_ids:
        ranked = (
            supabase_admin.table("scores")
            .select("user_id,total_points")
            .in_("user_id", member_ids)
            .order("total_points", desc=True)
            .execute()
        ).data or []
        for idx, r in enumerate(ranked, start=1):
            if r["user_id"] == target["id"]:
                rank = idx
                break

    score_out = UserScoreOut(
        total_points=score_data.get("total_points", 0),
        group_stage_pts=score_data.get("group_stage_pts", 0),
        knockout_pts=score_data.get("knockout_pts", 0),
        awards_pts=score_data.get("awards_pts", 0),
        double_down_pts=score_data.get("double_down_pts", 0),
        correct_count=score_data.get("correct_count", 0),
        total_predictions=score_data.get("total_predictions", 0),
        rank=rank,
    )

    # אם הטורניר עוד לא התחיל וזה לא הפרופיל שלי — מחזיר רק את המטא
    if not started and not is_me:
        return UserProfileOut(
            user_id=target["id"],
            username=target["username"],
            avatar_url=target.get("avatar_url"),
            is_me=is_me,
            is_owner=is_owner,
            tournament_has_started=started,
            score=score_out,
        )

    # ============================
    # Match predictions
    # ============================
    matches_res = (
        supabase_admin.table("matches")
        .select("id,stage,group_name,group_round,kickoff_utc,team_home,team_away,status,score_home,score_away,score_home_pen,score_away_pen,predictions_locked")
        .execute()
    )
    matches_by_id = {m["id"]: m for m in (matches_res.data or [])}

    pred_match_rows = (
        supabase_admin.table("predictions_matches")
        .select("*")
        .eq("user_id", target["id"])
        .execute()
    ).data or []

    # DD tokens של המשתמש (כדי לסמן has_double_down)
    dd_rows = (
        supabase_admin.table("double_down_tokens")
        .select("match_id,status")
        .eq("user_id", target["id"])
        .neq("status", "available")
        .execute()
    ).data or []
    dd_by_match = {d["match_id"] for d in dd_rows if d.get("match_id")}

    match_preds: list[ProfileMatchPredictionOut] = []
    for p in pred_match_rows:
        m = matches_by_id.get(p["match_id"])
        if not m:
            continue
        # חשיפה של ניחוש משחק ספציפי: רק אם נעול / חי / הסתיים, או is_me
        match_locked = m.get("predictions_locked") or m["status"] in ("live", "finished")
        if not (is_me or match_locked):
            # מציגים את המשחק עצמו (שורה ריקה), אבל לא את הניחוש — שיוצג "טרם נחשף"
            match_preds.append(ProfileMatchPredictionOut(
                match_id=m["id"],
                stage=m["stage"],
                group_name=m.get("group_name"),
                group_round=m.get("group_round"),
                kickoff_utc=m["kickoff_utc"],
                team_home=m["team_home"],
                team_away=m["team_away"],
                match_status=m["status"],
            ))
            continue
        match_preds.append(ProfileMatchPredictionOut(
            match_id=m["id"],
            stage=m["stage"],
            group_name=m.get("group_name"),
            group_round=m.get("group_round"),
            kickoff_utc=m["kickoff_utc"],
            team_home=m["team_home"],
            team_away=m["team_away"],
            match_status=m["status"],
            match_score_home=m.get("score_home"),
            match_score_away=m.get("score_away"),
            match_score_home_pen=m.get("score_home_pen"),
            match_score_away_pen=m.get("score_away_pen"),
            direction=p.get("direction"),
            pred_score_home=p.get("score_home"),
            pred_score_away=p.get("score_away"),
            points_earned=p.get("points_earned"),
            has_double_down=m["id"] in dd_by_match,
        ))

    # מיון: מהמשחקים הקרובים ביותר ראשונים (יורד לפי kickoff)
    match_preds.sort(key=lambda x: x.kickoff_utc, reverse=True)

    # ============================
    # Group predictions
    # ============================
    group_rows = (
        supabase_admin.table("predictions_groups")
        .select("*")
        .eq("user_id", target["id"])
        .execute()
    ).data or []
    group_preds = [
        ProfileGroupPredictionOut(
            group_name=g["group_name"],
            team_1st=g.get("team_1st"),
            team_2nd=g.get("team_2nd"),
            team_3rd=g.get("team_3rd"),
            team_4th=g.get("team_4th"),
            points_earned=g.get("points_earned"),
            locked_at=g.get("locked_at"),
        )
        for g in group_rows
    ]
    group_preds.sort(key=lambda x: x.group_name)

    # ============================
    # Tournament predictions
    # ============================
    t_res = (
        supabase_admin.table("predictions_tournament")
        .select("*")
        .eq("user_id", target["id"])
        .maybe_single()
        .execute()
    )
    tournament_preds = None
    if t_res and t_res.data:
        t = t_res.data
        tournament_preds = ProfileTournamentOut(
            winner=t.get("winner"),
            finalist_1=t.get("finalist_1"),
            finalist_2=t.get("finalist_2"),
            semifinalist_1=t.get("semifinalist_1"),
            semifinalist_2=t.get("semifinalist_2"),
            semifinalist_3=t.get("semifinalist_3"),
            semifinalist_4=t.get("semifinalist_4"),
            top_scorer=t.get("top_scorer"),
            top_assister=t.get("top_assister"),
            golden_ball=t.get("golden_ball"),
            points_earned=t.get("points_earned"),
        )

    return UserProfileOut(
        user_id=target["id"],
        username=target["username"],
        avatar_url=target.get("avatar_url"),
        is_me=is_me,
        is_owner=is_owner,
        tournament_has_started=started,
        score=score_out,
        match_predictions=match_preds,
        group_predictions=group_preds,
        tournament_predictions=tournament_preds,
    )
