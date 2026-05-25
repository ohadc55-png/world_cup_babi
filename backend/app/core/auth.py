"""JWT issuing + FastAPI dependency for current user."""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings
from app.db.supabase import supabase_admin


TokenType = Literal["temp", "session"]
"""temp: rights to register only (issued after invite redeem). session: full access."""


class TokenPayload(BaseModel):
    sub: str
    typ: TokenType
    iat: int
    exp: int


class AuthenticatedUser(BaseModel):
    id: str
    username: str
    is_admin: bool
    game_id: str | None = None
    avatar_url: str | None = None
    created_at: str | None = None


def create_token(subject: str, token_type: TokenType, hours: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    delta = timedelta(hours=hours if hours is not None else settings.JWT_EXPIRE_HOURS)
    payload = {
        "sub": subject,
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + delta).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    try:
        raw = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return TokenPayload(**raw)
    except (JWTError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    payload = decode_token(credentials.credentials)
    if payload.typ != "session":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token required (got temp token)",
        )
    result = (
        supabase_admin.table("users")
        .select("id, username, is_admin, game_id, avatar_url, created_at")
        .eq("id", payload.sub)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return AuthenticatedUser(**result.data)


def get_temp_token_subject(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> str:
    """משמש ב-/register — קורא את ה-temp token שהונפק אחרי redeem-invite."""
    payload = decode_token(credentials.credentials)
    if payload.typ != "temp":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Temp token required (use /redeem-invite first)",
        )
    return payload.sub
