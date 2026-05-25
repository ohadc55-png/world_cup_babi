"""
AI Agent API — 3 endpoints:
  POST   /api/agent/chat          — שליחת הודעה לסוכן
  GET    /api/agent/history       — שליפת היסטוריית השיחה (+ welcome/suggestions אם ריקה)
  DELETE /api/agent/conversation  — איפוס שיחה

# =============================================================================
# USER ISOLATION: כל endpoint משתמש ב-`user.id` ו-`user.game_id` מ-get_current_user.
# אף פעם לא מקבל user_id מה-request body. הזיהוי תמיד מ-JWT.
# =============================================================================
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.schemas.agent import (
    ChatRequest, ChatResponse, HistoryResponse, MessageOut,
)
from app.services.agent.chat import (
    chat_with_agent, load_conversation_history, reset_conversation,
)
from app.services.agent.prompts import STARTER_SUGGESTIONS, get_welcome_message

router = APIRouter(prefix="/api/agent", tags=["agent"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def _require_game(user: AuthenticatedUser) -> None:
    """הסוכן זמין רק למשתמשים שכבר במשחק (game)."""
    if not user.game_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="הסוכן זמין רק אחרי שאתה מצטרף למשחק.",
        )


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: CurrentUser) -> ChatResponse:
    """שולח הודעה לסוכן ומחזיר תגובה. כל הזיהוי מ-JWT, לא מהקליינט."""
    _require_game(user)
    try:
        response = chat_with_agent(user.id, user.game_id, payload.message)
        return ChatResponse(response=response)
    except RuntimeError as e:
        # ANTHROPIC_API_KEY חסר
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))


@router.get("/history", response_model=HistoryResponse)
def history(user: CurrentUser) -> HistoryResponse:
    """מחזיר היסטוריית שיחה של המשתמש. אם ריקה — מוסיף welcome + suggestions."""
    _require_game(user)
    msgs = load_conversation_history(user.id)
    if msgs:
        return HistoryResponse(
            messages=[MessageOut(**m) for m in msgs],
            welcome=None,
            suggestions=[],
        )
    return HistoryResponse(
        messages=[],
        welcome=get_welcome_message(user.username),
        suggestions=STARTER_SUGGESTIONS,
    )


@router.delete("/conversation", status_code=status.HTTP_204_NO_CONTENT)
def reset(user: CurrentUser) -> None:
    """מוחק את כל היסטוריית השיחה של המשתמש."""
    _require_game(user)
    reset_conversation(user.id)
