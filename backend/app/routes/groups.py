"""
Groups API — טבלאות בית חיות לכל 12 קבוצות הבתים.

GET /api/groups/standings — טבלאות חיות (גם חלקיות, במהלך שלב הבתים).

לכל קבוצה: 4 שורות עם שם הקבוצה, P (משחקים שיחקה), W/D/L, GD, GF, GA, Pts.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin

router = APIRouter(prefix="/api/groups", tags=["groups"])


# ============================================================
# Schemas
# ============================================================

class TeamStanding(BaseModel):
    position: int           # 1..4 לפי דירוג נוכחי
    team: str               # שם באנגלית (frontend ימפה לעברית + דגל)
    played: int             # P
    won: int                # W
    drawn: int              # D
    lost: int               # L
    goals_for: int          # GF
    goals_against: int      # GA
    goal_diff: int          # GD
    points: int             # Pts


class GroupStanding(BaseModel):
    group_name: str         # A..L
    matches_played: int     # 0..6 — כמה משחקים בקבוצה כבר הסתיימו
    matches_total: int = 6  # תמיד 6 בשלב הבתים
    is_complete: bool       # כל 6 המשחקים הסתיימו → 1/2 העולים סופיים
    table: list[TeamStanding]


# ============================================================
# Live group table computation (tolerant of partial data)
# ============================================================

def _compute_live_table(group_name: str) -> GroupStanding | None:
    """
    בונה טבלת בית חיה — גם אם רק חלק מהמשחקים הסתיימו.
    מחזיר None רק אם הקבוצה עצמה לא קיימת ב-DB.
    """
    matches = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,status")
        .eq("stage", "group")
        .eq("group_name", group_name)
        .execute()
    ).data or []

    if not matches:
        return None

    # אוסף את כל 4 הקבוצות בבית, גם אם לא שיחקו עדיין
    all_teams: set[str] = set()
    for m in matches:
        all_teams.add(m["team_home"])
        all_teams.add(m["team_away"])

    # אתחל סטטיסטיקות
    stats: dict[str, dict] = {
        t: {"team": t, "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "goals_for": 0, "goals_against": 0}
        for t in all_teams
    }

    # ספור רק משחקים שהסתיימו
    finished_count = 0
    for m in matches:
        if m["status"] != "finished" or m["score_home"] is None or m["score_away"] is None:
            continue
        finished_count += 1
        h, a = m["score_home"], m["score_away"]
        home, away = m["team_home"], m["team_away"]

        stats[home]["played"] += 1
        stats[away]["played"] += 1
        stats[home]["goals_for"] += h
        stats[home]["goals_against"] += a
        stats[away]["goals_for"] += a
        stats[away]["goals_against"] += h

        if h > a:
            stats[home]["won"] += 1
            stats[away]["lost"] += 1
        elif h < a:
            stats[away]["won"] += 1
            stats[home]["lost"] += 1
        else:
            stats[home]["drawn"] += 1
            stats[away]["drawn"] += 1

    # חישוב points + GD
    for s in stats.values():
        s["points"] = s["won"] * 3 + s["drawn"]
        s["goal_diff"] = s["goals_for"] - s["goals_against"]

    # מיון FIFA: pts → gd → gf → שם הקבוצה
    ordered = sorted(
        stats.values(),
        key=lambda s: (-s["points"], -s["goal_diff"], -s["goals_for"], s["team"]),
    )
    for i, s in enumerate(ordered):
        s["position"] = i + 1

    table = [TeamStanding(**s) for s in ordered]
    return GroupStanding(
        group_name=group_name,
        matches_played=finished_count,
        is_complete=finished_count >= 6,
        table=table,
    )


# ============================================================
# Endpoint
# ============================================================

@router.get("/standings", response_model=list[GroupStanding])
def get_all_group_standings(
    _user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> list[GroupStanding]:
    """כל 12 הקבוצות (A..L), טבלאות חיות מבוססות משחקים שכבר הסתיימו."""
    result: list[GroupStanding] = []
    for i in range(12):
        letter = chr(ord("A") + i)
        gs = _compute_live_table(letter)
        if gs:
            result.append(gs)
    return result
