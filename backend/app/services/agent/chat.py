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

# =============================================================================
# CONTEXT PERSISTENCE (2026-06-18 — phase C of agent quality work)
# =============================================================================
# מקודם: שמרנו רק user-text + final assistant-text. tool_use ו-tool_result
# בלוקים נזרקו אחרי כל בקשה, וכל שיחה חדשה החלה ללא היסטוריית הכלים.
# התוצאה: הסוכן היה צריך לקרוא לאותם כלים שוב כדי לזכור עובדות בסיסיות.
#
# עכשיו: כל הודעה נשמרת עם content מובנה ב-tool_calls jsonb (אם רלוונטי).
# load_conversation_history משחזר את המבנה המלא — text + tool_use + tool_result —
# והסוכן רואה את כל הקונטקסט, כולל מה שהוא ביצע בעבר וקיבל בחזרה.
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


def _serialize_blocks(blocks: Any) -> list[dict]:
    """ממיר Anthropic SDK content blocks (TextBlock, ToolUseBlock, וכו') ל-dicts ניתנים ל-JSON."""
    out: list[dict] = []
    for b in blocks:
        if hasattr(b, "model_dump"):
            out.append(b.model_dump())
        elif isinstance(b, dict):
            out.append(b)
        # אם זה משהו אחר — מתעלמים בשקט (לא אמור לקרות)
    return out


def load_conversation_history(user_id: str) -> list[dict[str, Any]]:
    """
    טוען עד MAX_HISTORY הודעות אחרונות ומשחזר את התוכן המבני המלא.

    אם להודעה יש tool_calls (jsonb) — זה אומר שיש בה בלוקים מובנים (text, tool_use,
    tool_result) — נשתמש בהם כ-content. אחרת התוכן הוא טקסט פשוט מ-content.
    סינון לפי user_id דרך conversation_id; אין דרך לראות הודעות של משתמש אחר.
    """
    conv_id = get_or_create_conversation(user_id)
    res = (
        supabase_admin.table("agent_messages")
        .select("role,content,tool_calls,created_at")
        .eq("conversation_id", conv_id)
        .order("created_at", desc=True)
        .limit(settings.AGENT_MAX_HISTORY_MESSAGES)
        .execute()
    )
    rows = (res.data or [])[::-1]  # reverse לקבל ordered מהישנה לחדשה

    history: list[dict[str, Any]] = []
    for r in rows:
        blocks = r.get("tool_calls")
        if blocks:
            history.append({"role": r["role"], "content": blocks})
        else:
            history.append({"role": r["role"], "content": r["content"]})
    return history


def _save_message(
    conversation_id: str,
    role: str,
    content: str = "",
    blocks: list[dict] | None = None,
) -> None:
    """
    שומר הודעה ב-DB.

    - אם `blocks` מסופק → התוכן המובני נשמר ב-tool_calls jsonb (טקסט פשוט ב-content
      כ-fallback אם רלוונטי). זה כולל: tool_use של הסוכן, tool_result של הכלים, או
      text+tool_use מעורבב.
    - אחרת → טקסט פשוט ב-content, tool_calls=null.
    """
    supabase_admin.table("agent_messages").insert({
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "tool_calls": blocks,
    }).execute()

    # increment counter (read-then-write — בטוח כי שיחה אחת לכל user)
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
      1. שלוף conversation_id (יצירה אם צריך).
      2. טען היסטוריה מובנית (text + tool_use + tool_result מהשיחות הקודמות).
      3. שמור את הודעת המשתמש החדשה.
      4. שלח ל-Claude עם SYSTEM_PROMPT + tools + history.
      5. אם stop_reason='tool_use' — שמור את ה-tool_use blocks ל-DB, בצע את הכלים,
         שמור את ה-tool_result blocks ל-DB, וחזור לשלב 4.
      6. כשמקבלים תשובה טקסטואלית — שומרים ב-DB ומחזירים.
    """
    client = _get_client()
    conv_id = get_or_create_conversation(user_id)
    history = load_conversation_history(user_id)

    # שומרים את הודעת המשתמש מיד (גם אם משהו נכשל בהמשך, היא נראית בהיסטוריה)
    _save_message(conv_id, "user", content=user_message)
    history.append({"role": "user", "content": user_message})

    for iteration in range(settings.AGENT_MAX_TOOL_ITERATIONS):
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=AGENT_TOOLS,
            messages=history,
        )

        # ---- סיום רגיל ----
        if response.stop_reason == "end_turn":
            text_blocks = [b.text for b in response.content if getattr(b, "type", None) == "text"]
            final_text = "\n".join(text_blocks).strip() or "לא בטוח מה לענות 🤷"
            # שומרים את התשובה הסופית כטקסט פשוט (אין בה tool_use)
            _save_message(conv_id, "assistant", content=final_text)
            return final_text

        # ---- tool_use: מבצעים את כל הכלים שהוא ביקש ----
        if response.stop_reason == "tool_use":
            # שומרים את התגובה של הסוכן (כולל text + tool_use blocks) ב-DB
            assistant_blocks = _serialize_blocks(response.content)
            _save_message(conv_id, "assistant", blocks=assistant_blocks)
            history.append({"role": "assistant", "content": response.content})

            # מבצעים את הכלים ובונים את ה-tool_results
            tool_results: list[dict] = []
            for block in response.content:
                if getattr(block, "type", None) == "tool_use":
                    result = execute_tool(block.name, block.input or {}, user_id, game_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
            # שומרים את ה-tool_results גם ב-DB (role=user לפי Anthropic API) וגם ב-memory
            _save_message(conv_id, "user", blocks=tool_results)
            history.append({"role": "user", "content": tool_results})
            continue

        # ---- stop_reason לא צפוי ----
        logger.warning("Agent unexpected stop_reason: %s", response.stop_reason)
        break

    # פספסנו את ה-budget של iterations
    fallback = "אחי, סליחה, הסתבכתי קצת. תנסה שוב? 😅"
    _save_message(conv_id, "assistant", content=fallback)
    return fallback
