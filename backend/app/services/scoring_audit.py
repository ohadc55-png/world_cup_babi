"""
Scoring audit — מאמת קונסיסטנטיות בין `score_events` לבין `scores`.

invariant יסודי:
    sum(score_events.points where user_id = X) == scores.total_points where user_id = X

אם יש mismatch — יש באג ב-scoring engine או בעדכון ידני שאיכף את ה-invariant.
"""
from __future__ import annotations

import logging
from typing import TypedDict

from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)


class UserAudit(TypedDict):
    user_id: str
    username: str
    scores_total: int
    events_sum: int
    consistent: bool


def verify_user_scores(user_id: str) -> UserAudit:
    """מאמת קונסיסטנטיות לאיש אחד."""
    user = (
        supabase_admin.table("users")
        .select("id, username")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not user.data:
        raise ValueError(f"User {user_id} not found")

    score_row = (
        supabase_admin.table("scores")
        .select("total_points")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    scores_total = score_row.data[0]["total_points"] if score_row.data else 0

    events = (
        supabase_admin.table("score_events")
        .select("points")
        .eq("user_id", user_id)
        .execute()
    )
    events_sum = sum(e["points"] for e in (events.data or []))

    return UserAudit(
        user_id=user_id,
        username=user.data[0]["username"],
        scores_total=scores_total,
        events_sum=events_sum,
        consistent=(scores_total == events_sum),
    )


def verify_all_scores() -> dict:
    """
    מאמת קונסיסטנטיות לכל המשתמשים. מחזיר רשימת mismatches (חייב להיות ריק).
    """
    users = supabase_admin.table("users").select("id").execute()
    user_ids = [u["id"] for u in (users.data or [])]

    mismatches: list[UserAudit] = []
    audited = 0

    for uid in user_ids:
        audit = verify_user_scores(uid)
        audited += 1
        if not audit["consistent"]:
            mismatches.append(audit)
            logger.warning(
                f"Score mismatch for user {audit['username']} ({uid}): "
                f"scores={audit['scores_total']} vs events={audit['events_sum']}"
            )

    return {
        "audited": audited,
        "mismatches": mismatches,
        "ok": len(mismatches) == 0,
    }
