"""
Leaderboard API — טבלת ניקוד חיה.

GET /api/leaderboard — כל המשתמשים מסודרים לפי total_points יורד.
GET /api/leaderboard/me — הניקוד שלי + ההישגים שלי לפי קטגוריות.
GET /api/leaderboard/timeline — Bumps Chart על 5 המשחקים האחרונים (read-only).
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.leaderboard import (
    TimelineCheckpoint,
    TimelineMember,
    TimelineResponse,
)

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


# ============================================================
# Timeline (Bumps Chart) — חלון מתגלגל של 5 משחקים אחרונים
# ============================================================

_TIMELINE_WINDOW = 5

# שלב → תווית קצרה. group_round משלים את "מ1/מ2/מ3" ל-group stage.
_STAGE_LABEL: dict[str, str] = {
    "group": "מ",       # יצורף עם group_round
    "r32": "R32",
    "r16": "R16",
    "qf": "1/4",
    "sf": "1/2",
    "third_place": "מקום 3",
    "final": "Final",
}


def _team_code(team: str) -> str:
    """לוקח שם קבוצה (אנגלית) ומחזיר 3 אותיות גדולות. דוגמה: 'Portugal' → 'POR'."""
    if not team:
        return "???"
    return team.strip()[:3].upper()


def _build_sub_label(stage: str, group_round: int | None) -> str:
    """תווית משנה לכל checkpoint לפי השלב."""
    if stage == "group" and group_round:
        return f"מ{group_round}"
    return _STAGE_LABEL.get(stage, stage.upper())


def _classify_result(breakdown: dict | None) -> str:
    """מחזיר 'exact' / 'direction' / 'miss' לפי תוצאת הניחוש.

    מבוסס על המפתחות ש-scoring.py כותב ל-predictions_matches.points_breakdown:
      - group:    direction, exact_uplift, draw_bonus
      - knockout: winner, exact_bonus
    """
    if not breakdown:
        return "miss"
    if breakdown.get("exact_uplift") or breakdown.get("exact_bonus"):
        return "exact"
    if breakdown.get("direction") or breakdown.get("winner"):
        return "direction"
    return "miss"


@router.get("/timeline", response_model=TimelineResponse)
def get_leaderboard_timeline(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TimelineResponse:
    """
    Bumps Chart — איך הדירוג של חברי הקבוצה התפתח לאורך 5 המשחקים האחרונים.

    Read-only מוחלט. חמש שאילתות SELECT בלבד:
      1) matches  — 5 משחקים שהסתיימו, מהאחרון לראשון (ואז reverse).
      2) matches  — id+finished_at של *כל* המשחקים המסוימים, לצורך מיפוי
                    event.source_ref ↔ זמן הסיום של המשחק (חשוב כי scoring
                    רץ כמה שניות אחרי שה-row מתעדכן ל-finished — אם נסתמך
                    על computed_at של ה-event הוא ייפול אחרי ה-cutoff של
                    ה-checkpoint שלו עצמו).
      3) users    — חברי game_id של המשתמש המאומת.
      4) score_events — כל ה-events של חברי הקבוצה.
      5) predictions_matches — לכל (member, checkpoint_match) — לסיווג result.

    מחזיר checkpoints=[], members=[] אם אין game_id או אם הסתיימו פחות מ-2 משחקים.
    """
    empty = TimelineResponse(checkpoints=[], members=[])

    if not user.game_id:
        return empty

    # 1) 5 המשחקים שהסתיימו, ordered מהחדש לישן ואז reverse → כרונולוגי
    matches_result = (
        supabase_admin.table("matches")
        .select("id, stage, group_round, team_home, team_away, finished_at")
        .eq("status", "finished")
        .order("finished_at", desc=True)
        .limit(_TIMELINE_WINDOW)
        .execute()
    )
    recent_matches: list[dict[str, Any]] = list(matches_result.data or [])
    if len(recent_matches) < 2:
        return empty
    recent_matches.reverse()  # עכשיו chronological: הישן בצד שמאל

    checkpoints: list[TimelineCheckpoint] = []
    for m in recent_matches:
        checkpoints.append(
            TimelineCheckpoint(
                match_id=m["id"],
                label=f"{_team_code(m['team_home'])}-{_team_code(m['team_away'])}",
                sub_label=_build_sub_label(m["stage"], m.get("group_round")),
                finished_at=m["finished_at"],
            )
        )

    match_ids = [m["id"] for m in recent_matches]
    finished_ats = [m["finished_at"] for m in recent_matches]

    # 2) מיפוי match_id → finished_at לכל המשחקים המסוימים — לשימוש כ-"effective time"
    # של score_events שמשויכים למשחק. בלי זה, scoring שרץ אחרי finished_at של
    # המשחק היה נחתך מה-checkpoint שלו (הניקוד הופיע רק ב-checkpoint הבא).
    # נוסף: מיפוי group_letter → finished_at של המשחק האחרון בבית, ל-score_events
    # של דירוג הבית (group_position_X / group_perfect_X) שנכתבים שניות אחרי
    # finished_at של המשחק ה-6 בבית.
    all_finished_result = (
        supabase_admin.table("matches")
        .select("id, finished_at, stage, group_name")
        .eq("status", "finished")
        .execute()
    )
    match_finished_by_id: dict[str, str] = {}
    group_max_finished: dict[str, str] = {}
    for m in (all_finished_result.data or []):
        fa = m.get("finished_at")
        if not fa:
            continue
        match_finished_by_id[str(m["id"])] = fa
        if m.get("stage") == "group" and m.get("group_name"):
            g = m["group_name"]
            prev = group_max_finished.get(g)
            if prev is None or fa > prev:
                group_max_finished[g] = fa

    # 3) חברי הקבוצה של המשתמש המאומת בלבד (game_id scope)
    members_result = (
        supabase_admin.table("users")
        .select("id, username, avatar_url")
        .eq("game_id", user.game_id)
        .execute()
    )
    members_rows = list(members_result.data or [])
    if not members_rows:
        return empty

    member_ids = [m["id"] for m in members_rows]
    user_meta: dict[str, dict] = {m["id"]: m for m in members_rows}

    # 4) כל ה-score_events של חברי הקבוצה (בלוק אחד, אין לולאת N×5)
    events_result = (
        supabase_admin.table("score_events")
        .select("user_id, points, computed_at, source_type, source_ref")
        .in_("user_id", member_ids)
        .execute()
    )
    events_by_user: dict[str, list[dict]] = {uid: [] for uid in member_ids}
    for ev in events_result.data or []:
        uid = ev["user_id"]
        if uid not in events_by_user:
            continue
        # effective_time — הזמן "האפקטיבי" של האירוע לצורך החתך ב-checkpoint:
        # - match-typed (match_group/r32/.../double_down_bonus): finished_at של המשחק
        # - group_position_X / group_perfect_X: finished_at של המשחק האחרון בבית
        # - awards_* / longterm_* / שאר: fallback ל-computed_at
        src_ref = str(ev.get("source_ref") or "")
        src_type = str(ev.get("source_type") or "")
        eff = match_finished_by_id.get(src_ref)
        if not eff and (src_type.startswith("group_position_") or src_type.startswith("group_perfect_")):
            # אות הבית: ב-source_ref (לפי scoring.py), עם נפילה ל-suffix של source_type
            g = src_ref if src_ref in group_max_finished else src_type.rsplit("_", 1)[-1]
            eff = group_max_finished.get(g)
        ev["effective_time"] = eff or ev.get("computed_at") or ""
        events_by_user[uid].append(ev)

    # 5) predictions_matches של (member × match) — לסיווג result
    preds_result = (
        supabase_admin.table("predictions_matches")
        .select("user_id, match_id, points_breakdown")
        .in_("user_id", member_ids)
        .in_("match_id", match_ids)
        .execute()
    )
    pred_by_key: dict[tuple[str, int], dict] = {}
    for p in preds_result.data or []:
        pred_by_key[(p["user_id"], p["match_id"])] = p

    # ---- חישוב cumulative pts ל-(member, checkpoint) ----
    # לכל משתמש: ממיינים את ה-events לפי effective_time (finished_at של המשחק
    # אם זה אירוע משחק, אחרת computed_at כ-fallback) ועוברים לכל checkpoint.
    pts_by_user: dict[str, list[int]] = {}
    for uid in member_ids:
        sorted_events = sorted(
            events_by_user[uid],
            key=lambda e: e["effective_time"],
        )
        per_checkpoint: list[int] = []
        cumulative = 0
        idx = 0
        for cutoff in finished_ats:
            while idx < len(sorted_events) and sorted_events[idx]["effective_time"] <= cutoff:
                cumulative += int(sorted_events[idx]["points"] or 0)
                idx += 1
            per_checkpoint.append(cumulative)
        pts_by_user[uid] = per_checkpoint

    # ---- ranks לכל checkpoint (ordinal, 1=ראשון) ----
    ranks_by_user: dict[str, list[int]] = {uid: [0] * len(checkpoints) for uid in member_ids}
    for ci in range(len(checkpoints)):
        ordered_uids = sorted(
            member_ids,
            key=lambda uid: (-pts_by_user[uid][ci], user_meta[uid]["username"]),
        )
        for rank, uid in enumerate(ordered_uids, start=1):
            ranks_by_user[uid][ci] = rank

    # ---- results לכל checkpoint ----
    results_by_user: dict[str, list[str]] = {}
    for uid in member_ids:
        results_by_user[uid] = [
            _classify_result(
                (pred_by_key.get((uid, m["id"])) or {}).get("points_breakdown")
            )
            for m in recent_matches
        ]

    # ---- בניית התשובה ----
    members_out: list[TimelineMember] = []
    for uid in member_ids:
        meta = user_meta[uid]
        members_out.append(
            TimelineMember(
                user_id=uid,
                username=meta["username"],
                avatar_url=meta.get("avatar_url"),
                is_me=(uid == user.id),
                ranks=ranks_by_user[uid],
                pts=pts_by_user[uid],
                results=results_by_user[uid],  # type: ignore[arg-type]
            )
        )

    return TimelineResponse(checkpoints=checkpoints, members=members_out)
