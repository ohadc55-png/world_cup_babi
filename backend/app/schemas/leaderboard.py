"""Pydantic schemas ל-leaderboard timeline (Bumps Chart בעמוד /leaderboard).

ה-schemas האלה משרתים אך ורק את ה-endpoint החדש
GET /api/leaderboard/timeline — read-only, ללא כל השפעה על שאר ה-leaderboard.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ResultType = Literal["exact", "direction", "miss"]


class TimelineCheckpoint(BaseModel):
    """משחק בודד מתוך חלון 5 המשחקים האחרונים."""
    match_id: int
    label: str           # "POR-CGO"
    sub_label: str       # "מ3" / "R32" / "QF" / "SF" / "Final" / "3rd"
    finished_at: datetime


class TimelineMember(BaseModel):
    """המצב של חבר אחד לאורך 5 הצ׳קפוינטים."""
    user_id: str
    username: str
    avatar_url: str | None = None
    is_me: bool
    # כל השלושה באורך זהה לאורך checkpoints
    ranks: list[int]                 # מקום (1=ראשון) אחרי כל checkpoint
    pts: list[int]                   # סך נקודות מצטבר אחרי כל checkpoint
    results: list[ResultType]        # תוצאת הניחוש של המשתמש למשחק אותו checkpoint


class TimelineResponse(BaseModel):
    """תשובת ה-endpoint. ריק אם יש פחות מ-2 משחקים שהסתיימו."""
    checkpoints: list[TimelineCheckpoint]
    members: list[TimelineMember]
