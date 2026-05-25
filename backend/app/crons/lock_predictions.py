"""
נעילת ניחושים לפני תחילת משחקים.

תזמון בייצור (Railway): כל 5 דקות.
לוקאלי: מריצים ידנית לבדיקה (`python -m app.crons.lock_predictions`).

כללי הנעילה:
- ניחושי משחק בודד: נעולים 30 דקות לפני kickoff.
- ניחושי טווח-ארוך (טבלאות בתים + פרסים): נעולים שעה לפני המשחק הראשון של הטורניר.

הסקריפט idempotent — לא יקרה כלום אם הוא רץ פעמיים, כי אנחנו מסננים רק את
הניחושים שעדיין לא נעולים (locked_at IS NULL).

מצב בדיקה: --match-id N כופה נעילה על משחק ספציפי לבדיקת הזרימה ב-API.
"""
import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)

# סף נעילה לניחוש משחק בודד (לפני kickoff)
MATCH_LOCK_THRESHOLD = timedelta(minutes=30)

# סף נעילה לניחושי טווח-ארוך (לפני המשחק הראשון של הטורניר)
TOURNAMENT_LOCK_THRESHOLD = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> datetime:
    # פיתון מקבל ISO format עם 'Z' רק מ-3.11+, וב-3.11.14 שלנו זה בסדר;
    # להיות בטוחים מחליפים ל-+00:00
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def lock_match_predictions(now: datetime) -> dict:
    """נועל את המשחקים שעומדים להתחיל וב-predictions_matches שלהם."""
    threshold = now + MATCH_LOCK_THRESHOLD

    candidates = (
        supabase_admin.table("matches")
        .select("id, kickoff_utc, team_home, team_away")
        .lte("kickoff_utc", threshold.isoformat())
        .eq("predictions_locked", False)
        .execute()
    )

    locked_match_ids: list[int] = []
    total_preds_locked = 0

    for match in candidates.data:
        match_id = match["id"]

        # נועלים את המשחק
        supabase_admin.table("matches").update(
            {"predictions_locked": True, "updated_at": now.isoformat()}
        ).eq("id", match_id).execute()

        # מסמנים את כל הניחושים למשחק הזה כנעולים (רק אלה שעדיין לא נעולים)
        upd = (
            supabase_admin.table("predictions_matches")
            .update({"locked_at": now.isoformat()})
            .eq("match_id", match_id)
            .is_("locked_at", "null")
            .execute()
        )

        locked_match_ids.append(match_id)
        total_preds_locked += len(upd.data) if upd.data else 0
        logger.info(
            f"Locked match #{match_id} ({match['team_home']} vs {match['team_away']}) "
            f"— {len(upd.data) if upd.data else 0} predictions locked"
        )

    return {
        "matches_locked": locked_match_ids,
        "predictions_locked": total_preds_locked,
    }


def lock_tournament_predictions(now: datetime) -> dict:
    """נועל ניחושי טבלאות בתים + פרסים, אם המשחק הראשון מתחיל בתוך שעה."""
    first = (
        supabase_admin.table("matches")
        .select("kickoff_utc")
        .order("kickoff_utc")
        .limit(1)
        .execute()
    )
    if not first.data:
        return {"locked": False, "reason": "no matches in DB"}

    first_kickoff = _parse_iso(first.data[0]["kickoff_utc"])
    if first_kickoff > now + TOURNAMENT_LOCK_THRESHOLD:
        return {
            "locked": False,
            "reason": (
                f"first match at {first_kickoff.isoformat()} not within "
                f"{TOURNAMENT_LOCK_THRESHOLD} threshold (now: {now.isoformat()})"
            ),
        }

    g = (
        supabase_admin.table("predictions_groups")
        .update({"locked_at": now.isoformat()})
        .is_("locked_at", "null")
        .execute()
    )
    t = (
        supabase_admin.table("predictions_tournament")
        .update({"locked_at": now.isoformat()})
        .is_("locked_at", "null")
        .execute()
    )

    return {
        "locked": True,
        "groups_locked": len(g.data) if g.data else 0,
        "tournament_locked": len(t.data) if t.data else 0,
    }


def lock_predictions_now() -> dict:
    """נקודת כניסה ראשית — נועל את כל הניחושים שזכאים."""
    now = _now()
    match_result = lock_match_predictions(now)
    tournament_result = lock_tournament_predictions(now)
    return {
        "ran_at": now.isoformat(),
        "matches": match_result,
        "tournament": tournament_result,
    }


def force_lock_match(match_id: int) -> bool:
    """מצב בדיקה — כופה נעילה על משחק ספציפי + הניחושים שלו."""
    now = _now()

    upd = (
        supabase_admin.table("matches")
        .update({"predictions_locked": True, "updated_at": now.isoformat()})
        .eq("id", match_id)
        .execute()
    )
    if not upd.data:
        return False

    supabase_admin.table("predictions_matches").update(
        {"locked_at": now.isoformat()}
    ).eq("match_id", match_id).is_("locked_at", "null").execute()
    return True


def force_unlock_match(match_id: int) -> bool:
    """מצב בדיקה — מבטל נעילה על משחק ספציפי + הניחושים שלו."""
    upd = (
        supabase_admin.table("matches")
        .update({"predictions_locked": False, "updated_at": _now().isoformat()})
        .eq("id", match_id)
        .execute()
    )
    if not upd.data:
        return False

    supabase_admin.table("predictions_matches").update({"locked_at": None}).eq(
        "match_id", match_id
    ).execute()
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Lock predictions for upcoming matches")
    parser.add_argument(
        "--match-id", type=int, default=None, help="Force lock a specific match (testing)"
    )
    parser.add_argument(
        "--unlock-match-id",
        type=int,
        default=None,
        help="Force UNlock a specific match (testing cleanup)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.unlock_match_id is not None:
        ok = force_unlock_match(args.unlock_match_id)
        if ok:
            print(f"✓ Force-unlocked match #{args.unlock_match_id}")
        else:
            print(f"✗ Match #{args.unlock_match_id} not found")
        return 0 if ok else 1

    if args.match_id is not None:
        ok = force_lock_match(args.match_id)
        if ok:
            print(f"✓ Force-locked match #{args.match_id} (TEST)")
            print(f"  Run with --unlock-match-id {args.match_id} to revert")
        else:
            print(f"✗ Match #{args.match_id} not found")
        return 0 if ok else 1

    # מצב רגיל
    stats = lock_predictions_now()
    n_matches = len(stats["matches"]["matches_locked"])
    print(f"✓ Lock predictions run at {stats['ran_at']}")
    print(f"  Matches locked: {n_matches}")
    if n_matches:
        print(f"  Match predictions affected: {stats['matches']['predictions_locked']}")
    if stats["tournament"]["locked"]:
        print(f"  Tournament predictions locked: {stats['tournament']['tournament_locked']}")
        print(f"  Group standings locked: {stats['tournament']['groups_locked']}")
    else:
        print(f"  Tournament not locked: {stats['tournament'].get('reason')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
