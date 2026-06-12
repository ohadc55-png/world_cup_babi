"""Pydantic models for matches API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Stage = Literal["group", "r32", "r16", "qf", "sf", "third_place", "final"]
MatchStatus = Literal["scheduled", "live", "finished", "postponed", "cancelled"]


class MatchOut(BaseModel):
    id: int
    stage: Stage
    group_name: str | None = None
    group_round: int | None = Field(default=None, ge=1, le=3)
    match_number: int | None = None
    team_home: str
    team_away: str
    team_home_fifa_rank: int | None = None
    team_away_fifa_rank: int | None = None
    kickoff_utc: datetime
    venue: str | None = None
    status: MatchStatus
    score_home: int | None = None
    score_away: int | None = None
    score_home_ht: int | None = None
    score_away_ht: int | None = None
    score_home_pen: int | None = None  # פנדלים — בפלייאוף בלבד
    score_away_pen: int | None = None
    finished_at: datetime | None = None
    predictions_locked: bool
    display_clock: str | None = None   # "67'", "45+2'", "HT", "ET 105'" — רק במשחק חי
    updated_at: datetime


class MatchEventOut(BaseModel):
    """אירוע משחק יחיד — שער או כרטיס אדום מ-ESPN."""
    id: str
    event_type: Literal["goal", "red_card"]
    minute: str                    # "21'", "45+2'"
    minute_value: int              # לסידור כרונולוגי
    team: Literal["home", "away"]
    primary_player: str            # שם המשער או מקבל הכרטיס
    assister: str | None = None    # רק לשערים
    is_penalty: bool = False
    is_own_goal: bool = False
