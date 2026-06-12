"""Auth endpoints.

Flow (multi-game model — 2026-05-23):
1. /register — username + PIN → user + session token (אין invite code ברמת חשבון)
2. /login — username + PIN → session token
3. /me — מחזיר את המשתמש הנוכחי + game_id

קודי הזמנה הם פר-משחק ומנוהלים ב-/api/games/join, לא כאן.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, create_token, get_current_user
from app.core.constants import ROUND_KEYS
from app.core.grace import user_in_grace_period
from app.core.security import hash_pin, verify_pin
from app.db.supabase import supabase_admin
from app.schemas.user import AuthSuccessResponse, LoginRequest, RegisterRequest


class MeResponse(BaseModel):
    """תגובת /api/auth/me — משתמש מחובר + דגלים תלויי-בקשה."""
    id: str
    username: str
    is_admin: bool
    game_id: str | None = None
    avatar_url: str | None = None
    created_at: str | None = None
    # True אם המשתמש בחלון חסד שמאפשר עריכת ניחושי טווח-ארוך אחרי תחילת הטורניר
    longterm_grace_active: bool = False


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _initialize_double_down_tokens(user_id: str) -> None:
    """יוצר 8 ז'יטוני Double Down בסטטוס 'available' למשתמש חדש."""
    rows = [{"user_id": user_id, "round_key": rk, "status": "available"} for rk in ROUND_KEYS]
    supabase_admin.table("double_down_tokens").insert(rows).execute()


@router.post("/register", response_model=AuthSuccessResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> AuthSuccessResponse:
    """רישום פתוח — כל אחד יכול לפתוח חשבון. לא נדרש invite code."""
    username = payload.username.strip()

    existing = (
        supabase_admin.table("users")
        .select("id")
        .eq("username", username)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="שם משתמש תפוס")

    user_insert = (
        supabase_admin.table("users")
        .insert({
            "username": username,
            "pin_hash": hash_pin(payload.pin),
            "avatar_url": payload.avatar_url,
        })
        .execute()
    )
    user = user_insert.data[0]

    # תשתית פנימית — scores + DD tokens (גם בלי game_id)
    supabase_admin.table("scores").insert({"user_id": user["id"]}).execute()
    _initialize_double_down_tokens(user["id"])

    session_token = create_token(subject=user["id"], token_type="session")
    return AuthSuccessResponse(
        token=session_token,
        user_id=user["id"],
        username=user["username"],
        is_admin=user["is_admin"],
        avatar_url=user.get("avatar_url"),
        game_id=user.get("game_id"),
    )


@router.post("/login", response_model=AuthSuccessResponse)
def login(payload: LoginRequest) -> AuthSuccessResponse:
    result = (
        supabase_admin.table("users")
        .select("id, username, pin_hash, is_admin, avatar_url, game_id")
        .eq("username", payload.username.strip())
        .maybe_single()
        .execute()
    )
    user = result.data if result else None
    if not user or not verify_pin(payload.pin, user["pin_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="שם משתמש או PIN שגויים",
        )

    supabase_admin.table("users").update(
        {"last_seen": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user["id"]).execute()

    session_token = create_token(subject=user["id"], token_type="session")
    return AuthSuccessResponse(
        token=session_token,
        user_id=user["id"],
        username=user["username"],
        is_admin=user["is_admin"],
        avatar_url=user.get("avatar_url"),
        game_id=user.get("game_id"),
    )


@router.get("/me", response_model=MeResponse)
def me(user: AuthenticatedUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        game_id=user.game_id,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        longterm_grace_active=user_in_grace_period(user.id),
    )
