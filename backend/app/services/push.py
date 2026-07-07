"""
Web Push service — שולח התראות למשתמשים דרך pywebpush + VAPID.

זרימה כללית:
1. הלקוח (frontend) נרשם דרך browser PushManager → מקבל endpoint+keys
2. השרת שומר אותם ב-push_subscriptions
3. כשרוצים לשלוח התראה — קוראים ל-`send_push_to_user(user_id, payload)`
4. השרת שולח לכל ה-subscriptions של המשתמש דרך pywebpush.webpush()
5. אם subscription לא תקף יותר (410 Gone) — מוחקים אוטומטית

anti-spam: כל push נכתב ל-notifications_log.

multi-game scoping: השכבה הזו לא יודעת על game_id — היא רק שולחת ל-user_id ספציפי.
ה-callers ב-Phase 3.6 מטפלים בסינון לפי game.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional, TypedDict

import requests
from pywebpush import WebPushException, webpush

from app.core.config import settings
from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)


class PushPayload(TypedDict, total=False):
    title: str
    body: str
    url: str          # יעד הניווט בלחיצה (ברירת מחדל /home)
    tag: str          # אותו tag = התראה אחת מחליפה את הקודמת
    icon: str
    badge: str
    data: dict


NotificationType = str  # 'reminder' / 'result' / 'overtaken' / 'kickoff' / 'stage' / 'weekly'


def _vapid_claims() -> dict:
    return {"sub": settings.VAPID_SUBJECT}


def send_push_to_subscription(
    subscription: dict,
    payload: PushPayload,
) -> tuple[bool, Optional[str]]:
    """
    שולח push יחיד ל-subscription ספציפי. מחזיר (success, error_message).

    subscription expected format:
        {'endpoint': ..., 'p256dh_key': ..., 'auth_key': ...}
    """
    sub_info = {
        "endpoint": subscription["endpoint"],
        "keys": {
            "p256dh": subscription["p256dh_key"],
            "auth": subscription["auth_key"],
        },
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_vapid_claims(),
            # בלי timeout, endpoint שלא עונה תוקע את ה-thread לנצח — ומקפיא
            # את לולאת ה-sync כולה (pywebpush לא שם timeout כברירת מחדל)
            timeout=10,
        )
        return True, None
    except requests.exceptions.RequestException as e:
        logger.warning(f"WebPush transport error (non-fatal): {e}")
        return False, str(e)
    except WebPushException as e:
        # 410 = Gone (subscription לא תקף יותר); 404 = endpoint לא קיים
        status_code = getattr(e.response, "status_code", None) if e.response else None
        if status_code in (404, 410):
            # subscription מת — מוחקים מה-DB
            supabase_admin.table("push_subscriptions").delete().eq(
                "endpoint", subscription["endpoint"]
            ).execute()
            return False, f"subscription expired (HTTP {status_code}) — deleted"
        logger.warning(f"WebPush failed: {e}")
        return False, str(e)


def send_push_to_user(
    user_id: str,
    payload: PushPayload,
    notification_type: NotificationType = "test",
    *,
    respect_prefs: bool = True,
) -> dict:
    """
    שולח את ה-payload לכל ה-subscriptions של המשתמש.

    respect_prefs: בודק push_subscriptions.notification_prefs[notification_type].
    אם False = הצמדה (למשל test endpoint).

    מחזיר {"sent": N, "failed": N, "skipped_prefs": N}.
    """
    subs_res = (
        supabase_admin.table("push_subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    subs = subs_res.data or []

    sent = 0
    failed = 0
    skipped_prefs = 0

    for sub in subs:
        if respect_prefs:
            prefs = sub.get("notification_prefs") or {}
            if not prefs.get(notification_type, True):
                skipped_prefs += 1
                continue

        ok, _err = send_push_to_subscription(sub, payload)
        if ok:
            sent += 1
        else:
            failed += 1

    # רישום ב-log (גם אם נכשל — לטובת אבחון)
    if sent > 0 or failed > 0:
        supabase_admin.table("notifications_log").insert({
            "user_id": user_id,
            "type": notification_type,
            "title": payload.get("title", ""),
            "body": payload.get("body", ""),
            "metadata": {"sent": sent, "failed": failed, "skipped_prefs": skipped_prefs},
        }).execute()

    return {"sent": sent, "failed": failed, "skipped_prefs": skipped_prefs}


def send_push_to_users(
    user_ids: list[str],
    payload: PushPayload,
    notification_type: NotificationType,
) -> dict:
    """fan-out — שולח לרשימת משתמשים. מחזיר סיכום אגרגטיבי."""
    total_sent = 0
    total_failed = 0
    for uid in user_ids:
        r = send_push_to_user(uid, payload, notification_type)
        total_sent += r["sent"]
        total_failed += r["failed"]
    return {
        "users": len(user_ids),
        "total_sent": total_sent,
        "total_failed": total_failed,
    }
