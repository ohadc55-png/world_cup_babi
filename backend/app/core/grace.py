"""
Grace-period helper — env-var-based admin override that allows specific users
to edit their long-term predictions (group standings) after the tournament
has started.

Both LONGTERM_GRACE_USER_IDS (comma-sep UUIDs) and LONGTERM_GRACE_UNTIL (ISO
UTC datetime) must be set, and the deadline must be in the future, for the
bypass to apply.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings


def user_in_grace_period(user_id: str) -> bool:
    raw_ids = (settings.LONGTERM_GRACE_USER_IDS or "").strip()
    raw_until = (settings.LONGTERM_GRACE_UNTIL or "").strip()
    if not raw_ids or not raw_until:
        return False
    ids = {x.strip() for x in raw_ids.split(",") if x.strip()}
    if user_id not in ids:
        return False
    try:
        until = datetime.fromisoformat(raw_until.replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) < until
