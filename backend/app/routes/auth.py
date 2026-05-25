"""Auth endpoints.

Flow (multi-game model — 2026-05-23):
1. /register — username + PIN → user + session token (אין invite code ברמת חשבון)
2. /login — username + PIN → session token
3. /me — מחזיר את המשתמש הנוכחי + game_id

קודי הזמנה הם פר-משחק ומנוהלים ב-/api/games/join, לא כאן.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, create_token, get_current_user
from app.core.constants import ROUND_KEYS
from app.core.security import hash_pin, verify_pin
from app.db.supabase import supabase_admin
from app.schemas.user import AuthSuccessResponse, LoginRequest, RegisterRequest


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


@router.get("/me", response_model=AuthenticatedUser)
def me(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    return user
