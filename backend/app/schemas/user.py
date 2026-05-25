from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """רישום פתוח — ללא invite code (קודי הזמנה הם פר-משחק, לא פר-חשבון)."""
    username: str = Field(..., min_length=2, max_length=32)
    pin: str = Field(..., pattern=r"^\d{4}$")
    avatar_url: str | None = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=32)
    pin: str = Field(..., pattern=r"^\d{4}$")


class AuthSuccessResponse(BaseModel):
    token: str
    user_id: str
    username: str
    is_admin: bool
    avatar_url: str | None = None
    game_id: str | None = None  # null אם המשתמש עדיין לא במשחק
