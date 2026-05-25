"""
Push subscription endpoints.

- POST /api/push/subscribe   — שמירת subscription חדש
- POST /api/push/unsubscribe — מחיקת subscription לפי endpoint
- POST /api/push/test        — שליחת התראת בדיקה למשתמש המחובר (זמני, לבדיקה ב-Phase 3)
- GET  /api/push/vapid-key   — מחזיר את ה-public key (frontend צריך אותו ל-subscribe)
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_user
from app.core.config import settings
from app.db.supabase import supabase_admin
from app.services.push import send_push_to_user

router = APIRouter(prefix="/api/push", tags=["push"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


# ============================================================
# Schemas
# ============================================================

class PushKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeIn(BaseModel):
    endpoint: str
    keys: PushKeys
    user_agent: Optional[str] = None


class UnsubscribeIn(BaseModel):
    endpoint: str


class VapidKeyOut(BaseModel):
    public_key: str


class NotificationPrefs(BaseModel):
    """6 הטריגרים שאפשר להפעיל/לכבות. ברירת מחדל ON לכולם חוץ מ-kickoff."""
    reminder: bool = True
    result: bool = True
    overtaken: bool = True
    kickoff: bool = False    # רעשני, default off
    stage: bool = True
    weekly: bool = True


class PrefsOut(BaseModel):
    has_subscription: bool
    prefs: NotificationPrefs


# ============================================================
# Endpoints
# ============================================================

@router.get("/vapid-key", response_model=VapidKeyOut)
def get_vapid_key() -> VapidKeyOut:
    """frontend קורא לזה כדי לבצע subscribe ב-PushManager."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(500, "VAPID public key not configured")
    return VapidKeyOut(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(payload: SubscribeIn, user: CurrentUser) -> dict:
    """
    שמירת subscription. אם כבר קיים אותו endpoint (refresh subscription) —
    מעדכן את ה-keys.
    """
    # UPSERT ידני (supabase-py לא תומך טוב ב-on_conflict בלי PostgREST extension)
    existing = (
        supabase_admin.table("push_subscriptions")
        .select("id")
        .eq("endpoint", payload.endpoint)
        .limit(1)
        .execute()
    )

    data = {
        "user_id": user.id,
        "endpoint": payload.endpoint,
        "p256dh_key": payload.keys.p256dh,
        "auth_key": payload.keys.auth,
        "user_agent": payload.user_agent,
        "last_used": "now()",
    }

    if existing.data:
        supabase_admin.table("push_subscriptions").update(data).eq(
            "endpoint", payload.endpoint
        ).execute()
        return {"status": "updated"}
    else:
        supabase_admin.table("push_subscriptions").insert(data).execute()
        return {"status": "created"}


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(payload: UnsubscribeIn, user: CurrentUser) -> None:
    """מוחק subscription לפי endpoint. בודק שזה אכן של המשתמש."""
    supabase_admin.table("push_subscriptions").delete().eq(
        "endpoint", payload.endpoint
    ).eq("user_id", user.id).execute()


@router.get("/preferences", response_model=PrefsOut)
def get_prefs(user: CurrentUser) -> PrefsOut:
    """
    מחזיר את ה-prefs של ה-subscription הראשון של המשתמש.
    אם אין subscription בכלל — מחזיר ברירת מחדל + has_subscription=false.
    """
    sub_res = (
        supabase_admin.table("push_subscriptions")
        .select("notification_prefs")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not sub_res.data:
        return PrefsOut(has_subscription=False, prefs=NotificationPrefs())

    raw = sub_res.data[0].get("notification_prefs") or {}
    return PrefsOut(has_subscription=True, prefs=NotificationPrefs(**raw))


@router.put("/preferences", response_model=PrefsOut)
def update_prefs(payload: NotificationPrefs, user: CurrentUser) -> PrefsOut:
    """
    מעדכן את ה-prefs לכל ה-subscriptions של המשתמש (כל המכשירים).
    אם אין subscriptions — שומר ב-DB עתידי כברירת מחדל לrישום הבא? כרגע: 404.
    """
    subs = (
        supabase_admin.table("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .execute()
    )
    if not subs.data:
        raise HTTPException(404, "אין מנוי להתראות. צריך להפעיל קודם.")

    prefs_json = payload.model_dump()
    supabase_admin.table("push_subscriptions").update({
        "notification_prefs": prefs_json,
    }).eq("user_id", user.id).execute()

    return PrefsOut(has_subscription=True, prefs=payload)


@router.post("/test", response_model=dict)
def send_test(user: CurrentUser) -> dict:
    """
    זמני — שליחת התראת בדיקה למשתמש. שימושי בזמן פיתוח.
    (נמחק אחרי Phase 3.6 ל-cleanup).
    """
    result = send_push_to_user(
        user.id,
        {
            "title": "מונדיאל 2026 - בדיקה",
            "body": f"התראת בדיקה עבור {user.username} 🏆",
            "url": "/home",
            "tag": "test",
        },
        notification_type="test",
        respect_prefs=False,
    )
    if result["sent"] == 0:
        raise HTTPException(
            status_code=404,
            detail="אין subscriptions פעילים. הירשם להתראות קודם.",
        )
    return result
