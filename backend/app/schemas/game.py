"""Pydantic models for games API."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class GameOut(BaseModel):
    id: str
    name: str
    invite_code: str
    owner_user_id: str
    is_owner: bool                 # האם המשתמש המבקש הוא הבעלים
    member_count: int              # כמה חברים יש במשחק
    created_at: datetime
    tournament_has_started: bool   # אם True - לא ניתן יותר להוסיף חברים


class CreateGameIn(BaseModel):
    name: str = Field(min_length=2, max_length=60, description="שם המשחק (לחברים)")


class JoinGameIn(BaseModel):
    invite_code: str = Field(min_length=4, max_length=24)
