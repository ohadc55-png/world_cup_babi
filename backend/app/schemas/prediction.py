"""Pydantic schemas לניחושים — משחקים, בתים, פרסים, Double Down."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

Direction = Literal["1", "X", "2"]


# ============================================
# Match predictions
# ============================================


class MatchPredictionUpsert(BaseModel):
    """גוף בקשה ליצירה/עדכון ניחוש למשחק."""
    direction: Direction
    score_home: int | None = Field(default=None, ge=0, le=15)
    score_away: int | None = Field(default=None, ge=0, le=15)

    @field_validator("score_away")
    @classmethod
    def _both_or_neither(cls, v: int | None, info) -> int | None:
        # אם נשלח רק אחד (home או away) — שגיאה; חייב לשלוח את שניהם או אף אחד.
        home = info.data.get("score_home")
        if (home is None) != (v is None):
            raise ValueError("חייב לשלוח את שני הציונים, או אף אחד")
        return v


class MatchPredictionOut(BaseModel):
    id: str
    match_id: int
    direction: Direction
    score_home: int | None
    score_away: int | None
    locked_at: datetime | None
    updated_at: datetime
    points_earned: int | None = None
    points_breakdown: dict[str, Any] | None = None


# ============================================
# Group standings predictions
# ============================================


class GroupStandingsUpsert(BaseModel):
    """4 קבוצות לפי סדר מיקום צפוי (1st → 4th)."""
    team_1st: str = Field(..., min_length=1, max_length=64)
    team_2nd: str = Field(..., min_length=1, max_length=64)
    team_3rd: str = Field(..., min_length=1, max_length=64)
    team_4th: str = Field(..., min_length=1, max_length=64)


class GroupStandingsOut(BaseModel):
    group_name: str
    team_1st: str
    team_2nd: str
    team_3rd: str
    team_4th: str
    locked_at: datetime | None
    updated_at: datetime
    points_earned: int | None = None
    points_breakdown: dict[str, Any] | None = None


# ============================================
# Tournament-wide predictions (long-term)
# ============================================


class TournamentPredictionsUpsert(BaseModel):
    """ניחושים גלובליים — אלופה, פיינליסטיות, חצי-גמרניות, פרסים."""
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


class TournamentPredictionsOut(TournamentPredictionsUpsert):
    locked_at: datetime | None = None
    updated_at: datetime
    points_earned: int | None = None
    points_breakdown: dict[str, Any] | None = None


class MemberTournamentPrediction(BaseModel):
    """
    ניחושי טווח-ארוך של חבר אחר בקבוצה — לתצוגת "מי ניחש מה".

    נחשף רק אחרי שהטורניר התחיל (אז ניחושים כבר נעולים והגינות נשמרת).
    Endpoint סוקר רק חברי game_id של המבקש — לא נוגע בנתונים של game אחר.
    """
    user_id: str
    username: str
    avatar_url: str | None = None
    # קבוצות
    winner: str | None = None
    finalist_1: str | None = None
    finalist_2: str | None = None
    semifinalist_1: str | None = None
    semifinalist_2: str | None = None
    semifinalist_3: str | None = None
    semifinalist_4: str | None = None
    # שחקנים — טקסט גולמי שהמשתמש הקליד + שם קנוני אופציונלי (מ-resolution script)
    top_scorer: str | None = None
    top_scorer_canonical: str | None = None
    top_assister: str | None = None
    top_assister_canonical: str | None = None
    golden_ball: str | None = None


# ============================================
# Double Down tokens
# ============================================


DDStatus = Literal["available", "active", "used"]
RoundKey = Literal["group_r1", "group_r2", "group_r3", "r32", "r16", "qf", "sf", "final"]


class DoubleDownTokenOut(BaseModel):
    id: str
    round_key: RoundKey
    match_id: int | None
    status: DDStatus
    points_earned: int | None
    activated_at: datetime | None
    finalized_at: datetime | None


class DoubleDownActivate(BaseModel):
    """הפעלת ז'יטון על משחק ספציפי."""
    match_id: int = Field(..., gt=0)
