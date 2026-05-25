"""
Games API — ניהול משחקים (קבוצות פרטיות של חברים).

זרימה:
- POST /api/games/create  — המשתמש המאומת יוצר משחק חדש, נהיה owner, מקבל invite_code
- POST /api/games/join    — המשתמש המאומת מצטרף למשחק קיים לפי invite_code
- GET  /api/games/mine    — מחזיר את המשחק הנוכחי של המשתמש (או 404)

עיקרון: משתמש יכול להיות במשחק אחד בכל רגע. אם הוא כבר במשחק וניסה
להצטרף/ליצור — מקבל 409 Conflict.

ה-invite_code נוצר אקראי בזמן יצירת המשחק (8 תווים — אותיות גדולות + ספרות,
ללא O/0/I/1 להימנעות מבלבול).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import supabase_admin
from app.schemas.game import CreateGameIn, GameOut, JoinGameIn

router = APIRouter(prefix="/api/games", tags=["games"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]

# תווים ל-invite code — לא כוללים O/0/I/1 כדי שלא יהיה בלבול בהקלדה
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def _generate_invite_code() -> str:
    """יוצר קוד אקראי, מוודא שאינו קיים ב-DB."""
    for _ in range(20):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        existing = (
            supabase_admin.table("games")
            .select("id")
            .eq("invite_code", code)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return code
    raise HTTPException(500, "Could not generate unique invite code")


def _get_user_game_id(user_id: str) -> str | None:
    """שולף את ה-game_id של המשתמש (או None אם אין)."""
    res = (
        supabase_admin.table("users")
        .select("game_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return res.data[0].get("game_id")


def _count_members(game_id: str) -> int:
    """סופר כמה משתמשים יש במשחק."""
    res = (
        supabase_admin.table("users")
        .select("id", count="exact")
        .eq("game_id", game_id)
        .execute()
    )
    return res.count or 0


def _tournament_has_started() -> bool:
    """
    True אם המשחק הראשון כבר התחיל (kickoff_utc <= now), או אם משחק כלשהו
    כבר במצב live/finished (סימולציה / הזנה ידנית).
    """
    # תנאי א' — תאריך המשחק הראשון
    first = (
        supabase_admin.table("matches")
        .select("kickoff_utc")
        .order("kickoff_utc")
        .limit(1)
        .execute()
    )
    if first.data:
        kickoff = datetime.fromisoformat(first.data[0]["kickoff_utc"].replace("Z", "+00:00"))
        if kickoff <= datetime.now(timezone.utc):
            return True

    # תנאי ב' — משחק כלשהו רץ/הסתיים
    played = (
        supabase_admin.table("matches")
        .select("id", count="exact")
        .in_("status", ["live", "finished"])
        .limit(1)
        .execute()
    )
    return (played.count or 0) > 0


def _game_to_out(game: dict, current_user_id: str) -> GameOut:
    return GameOut(
        id=game["id"],
        name=game["name"],
        invite_code=game["invite_code"],
        owner_user_id=game["owner_user_id"],
        is_owner=game["owner_user_id"] == current_user_id,
        member_count=_count_members(game["id"]),
        created_at=game["created_at"],
        tournament_has_started=_tournament_has_started(),
    )


@router.post("/create", response_model=GameOut, status_code=status.HTTP_201_CREATED)
def create_game(payload: CreateGameIn, user: CurrentUser) -> GameOut:
    """יוצר משחק חדש. המשתמש נהיה owner ומשויך אליו אוטומטית."""
    if _get_user_game_id(user.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="כבר אתה במשחק. עזוב לפני יצירת משחק חדש.",
        )
    if _tournament_has_started():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="הטורניר כבר התחיל - לא ניתן ליצור משחק חדש.",
        )

    code = _generate_invite_code()
    insert = (
        supabase_admin.table("games")
        .insert({
            "name": payload.name.strip(),
            "invite_code": code,
            "owner_user_id": user.id,
        })
        .execute()
    )
    if not insert.data:
        raise HTTPException(500, "Failed to create game")

    game = insert.data[0]

    # משייכים את המשתמש למשחק
    supabase_admin.table("users").update({"game_id": game["id"]}).eq("id", user.id).execute()

    return _game_to_out(game, user.id)


@router.post("/join", response_model=GameOut)
def join_game(payload: JoinGameIn, user: CurrentUser) -> GameOut:
    """מצטרף למשחק קיים לפי invite_code."""
    if _get_user_game_id(user.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="כבר אתה במשחק. עזוב לפני הצטרפות חדשה.",
        )
    if _tournament_has_started():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="הטורניר כבר התחיל - לא ניתן להצטרף למשחק חדש.",
        )

    code = payload.invite_code.strip().upper()
    game_res = (
        supabase_admin.table("games")
        .select("*")
        .eq("invite_code", code)
        .limit(1)
        .execute()
    )
    if not game_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="קוד הזמנה לא קיים")

    game = game_res.data[0]

    # משייכים את המשתמש
    supabase_admin.table("users").update({"game_id": game["id"]}).eq("id", user.id).execute()

    return _game_to_out(game, user.id)


@router.get("/mine", response_model=GameOut | None)
def get_my_game(user: CurrentUser) -> GameOut | None:
    """מחזיר את המשחק הנוכחי של המשתמש, או null אם אין."""
    game_id = _get_user_game_id(user.id)
    if not game_id:
        return None

    game_res = (
        supabase_admin.table("games")
        .select("*")
        .eq("id", game_id)
        .limit(1)
        .execute()
    )
    if not game_res.data:
        return None

    return _game_to_out(game_res.data[0], user.id)


@router.delete("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_game(user: CurrentUser) -> None:
    """
    יציאה מהמשחק הנוכחי. הניחושים נשארים ב-DB אבל המשתמש כבר לא רואה אותם
    (game_id = NULL).
    אם המשתמש הוא ה-owner — לא ניתן לעזוב עד שהוא מעביר בעלות.
    """
    game_id = _get_user_game_id(user.id)
    if not game_id:
        raise HTTPException(404, "אתה לא במשחק")

    game_res = (
        supabase_admin.table("games")
        .select("owner_user_id")
        .eq("id", game_id)
        .limit(1)
        .execute()
    )
    if game_res.data and game_res.data[0]["owner_user_id"] == user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="אתה owner של המשחק. אי אפשר לעזוב.",
        )

    supabase_admin.table("users").update({"game_id": None}).eq("id", user.id).execute()
