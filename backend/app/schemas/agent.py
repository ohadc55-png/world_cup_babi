"""Pydantic schemas ל-AI Agent (Phase 8)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    response: str


class MessageOut(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class HistoryResponse(BaseModel):
    messages: list[MessageOut] = []
    welcome: str | None = None       # מופיע רק אם אין הודעות עדיין
    suggestions: list[str] = []      # 4 כפתורי הצעה — מופיעים רק כשאין הודעות
