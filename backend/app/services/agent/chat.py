"""
Agent chat — main conversation loop using Anthropic SDK.

# =============================================================================
# CRITICAL — USER ISOLATION GUARANTEE
# =============================================================================
# - `chat_with_agent(user_id, game_id, message)` receives user_id from
#   get_current_user (authenticated session JWT). NEVER from client.
# - Conversation lookup is ALWAYS by user_id, enforced by UNIQUE constraint.
# - Messages are stored per-conversation_id; no cross-user query path exists.
# - Tool execution receives the same authenticated user_id + game_id and
#   filters every DB read accordingly. See tools.py for details.
# =============================================================================
"""
from __future__ import annotations

import logging
from typing import Any

import anthropic

from app.core.config import settings
from app.db.supabase import supabase_admin
from app.services.agent.prompts import SYSTEM_PROMPT
from app.services.agent.tools import AGENT_TOOLS, execute_tool

logger = logging.getLogger(__name__)

# Singleton sync client. Init lazy to allow imports without ANTHROPIC_API_KEY in env.
_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY לא מוגדר ב-.env — הסוכן לא יכול לעבוד עד שתוסיף מפתח."
            )
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


# ============================================================
# Conversation management
# ============================================================

def get_or_create_conversation(user_id: str) -> str:
    """מחזיר conversation_id של המשתמש, יוצר אחד אם לא קיים. UNIQUE(user_id) מבטיח אחד בלבד."""
    existing = (
        supabase_admin.table("agent_conversations")
        .select("id")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        return existing.data["id"]

    created = (
        supabase_admin.table("agent_conversations")
        .insert({"user_id": user_id})
        .execute()
    )
    return created.data[0]["id"]


def load_conversation_history(user_id: str) -> list[dict[str, str]]:
    """
    טוען עד MAX_HISTORY הודעות אחרונות, מסודרות מהישנה לחדשה.
    *סינון לפי user_id* — אי-אפשר להגיע להודעות של משתמש אחר.
    """
    conv_id = get_or_create_conversation(user_id)
    res = (
        supabase_admin.table("agent_messages")
        .select("role,content,created_at")
        .eq("conversation_id", conv_id)
        .order("created_at", desc=True)
        .limit(settings.AGENT_MAX_HISTORY_MESSAGES)
        .execute()
    )
    rows = (res.data or [])[::-1]  # reverse לקבל ordered מהישנה לחדשה
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def _save_message(conversation_id: str, role: str, content: str, tool_calls: Any | None = None) -> None:
    """שומר הודעה ב-DB + מעדכן last_message_at + message_count על השיחה."""
    supabase_admin.table("agent_messages").insert({
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "tool_calls": tool_calls,
    }).execute()

    # increment counter via read-then-write (אין RPC ב-DB; הקריאה הזו בטוחה כי שיחה אחת לכל user)
    current = (
        supabase_admin.table("agent_conversations")
        .select("message_count")
        .eq("id", conversation_id)
        .maybe_single()
        .execute()
    )
    new_count = ((current and current.data and current.data.get("message_count")) or 0) + 1
    supabase_admin.table("agent_conversations").update({
        "last_message_at": "now()",
        "message_count": new_count,
    }).eq("id", conversation_id).execute()


def reset_conversation(user_id: str) -> None:
    """מוחק את השיחה של המשתמש (cascade ימחק את כל ההודעות)."""
    conv = (
        supabase_admin.table("agent_conversations")
        .select("id")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if conv and conv.data:
        supabase_admin.table("agent_conversations").delete().eq("id", conv.data["id"]).execute()


# ============================================================
# Main chat loop
# ============================================================

def chat_with_agent(user_id: str, game_id: str | None, user_message: str) -> str:
    """
    שולח הודעה לסוכן, מבצע tool-use בלולאה, מחזיר תשובה סופית.

    זרימה:
      1. שלוף את conversation_id של המשתמש (יצירה אם צריך).
      2. טען היסטוריה.
      3. שמור את הודעת המשתמש החדשה.
      4. שלח ל-Claude עם SYSTEM_PROMPT + tools + history.
      5. אם stop_reason='tool_use' — בצע את הכלים, הוסף את התוצאות להיסטוריה,
         וחזור לשלב 4. עד MAX_ITERATIONS איטרציות.
      6. כשמקבלים תשובה טקסטואלית — שומרים ב-DB ומחזירים.
    """
    client = _get_client()
    conv_id = get_or_create_conversation(user_id)
    history = load_conversation_history(user_id)

    # שומרים את הודעת המשתמש מיד (גם אם משהו נכשל בהמשך, היא נראית בהיסטוריה)
    _save_message(conv_id, "user", user_message)
    history.append({"role": "user", "content": user_message})

    for iteration in range(settings.AGENT_MAX_TOOL_ITERATIONS):
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=AGENT_TOOLS,
            messages=history,
        )

        # ---- סיום רגיל ----
        if response.stop_reason == "end_turn":
            text_blocks = [b.text for b in response.content if getattr(b, "type", None) == "text"]
            final_text = "\n".join(text_blocks).strip() or "לא בטוח מה לענות 🤷"
            _save_message(conv_id, "assistant", final_text)
            return final_text

        # ---- tool_use: מבצעים את כל הכלים שהוא ביקש ----
        if response.stop_reason == "tool_use":
            # מוסיפים את התגובה של הסוכן להיסטוריה (כולל בלוקים של tool_use)
            history.append({"role": "assistant", "content": response.content})

            tool_results = []
            for block in response.content:
                if getattr(block, "type", None) == "tool_use":
                    result = execute_tool(block.name, block.input or {}, user_id, game_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            history.append({"role": "user", "content": tool_results})
            continue

        # ---- stop_reason לא צפוי ----
        logger.warning("Agent unexpected stop_reason: %s", response.stop_reason)
        break

    # פספסנו את ה-budget של iterations
    fallback = "אחי, סליחה, הסתבכתי קצת. תנסה שוב? 😅"
    _save_message(conv_id, "assistant", fallback)
    return fallback
