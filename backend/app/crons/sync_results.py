"""
סנכרון תוצאות חיות + הפעלת scoring אוטומטית.

תזמון בייצור (Railway): כל 10 דקות.
לוקאלי: ידני (`python -m app.crons.sync_results --dry-run`).

זרימה:
1. שולפים את כל המשחקים הפעילים (live) או שעומדים להתחיל ב-2 השעות הקרובות.
2. עבור כל אחד, שואלים את ה-data source (API-Football או מקור חלופי) על התוצאה.
3. אם status השתנה ל-'finished' — מעדכנים את ה-row במשחק ומריצים scoring.
4. אם רק score השתנה (live update) — מעדכנים רק score (לא scoring).

מקור הנתונים (API-Football) מופרד דרך `services/api_football.py` (TODO Phase 5.1).
הקובץ הזה לא יודע כלום על איך לתקשר עם API חיצוני — רק על הזרימה הפנימית.

הפעלה ידנית למצב בדיקה:
    python -m app.crons.sync_results --dry-run          # רק מראה מה היה קורה
    python -m app.crons.sync_results --recompute MATCH  # מחשב שוב ניקוד למשחק ספציפי
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional, TypedDict

from app.db.supabase import supabase_admin
from app.services import scoring

logger = logging.getLogger(__name__)

# חלון זמן לפולינג: עד 30 דקות אחרי שמשחק "אמור" להסתיים, ועד 2 שעות לפני התחלה
SYNC_WINDOW_BEFORE = timedelta(hours=2)
SYNC_WINDOW_AFTER = timedelta(hours=3)  # 90 דק' + הארכה + הפסקות


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MatchSyncResult(TypedDict, total=False):
    match_id: int
    action: str           # 'no_change' / 'live_update' / 'finished' / 'error'
    old_status: str
    new_status: str
    old_score: tuple[Optional[int], Optional[int]]
    new_score: tuple[Optional[int], Optional[int]]
    scoring_summary: Optional[dict]
    error: Optional[str]


def fetch_active_matches() -> list[dict]:
    """משחקים שצריך לבדוק עכשיו:
      (א) משחקים שה-kickoff שלהם בחלון [now-3h, now+2h] עם status scheduled/live, ו-
      (ב) *כל* משחק שעדיין status='live' — גם אם ה-kickoff שלו מחוץ לחלון
           (משחקים שנכנסו להארכה/פנדלים/דחיות גורמים לזה ויקלעו אחרת חצוצים).

    שתי שאילתות נפרדות + dedup ב-id. עלות זניחה (בפלייאוף ~32 משחקים סה"כ).
    """
    now = _now()
    window_start = (now - SYNC_WINDOW_AFTER).isoformat()
    window_end = (now + SYNC_WINDOW_BEFORE).isoformat()

    in_window = (
        supabase_admin.table("matches")
        .select("*")
        .gte("kickoff_utc", window_start)
        .lte("kickoff_utc", window_end)
        .in_("status", ["scheduled", "live"])
        .execute()
    ).data or []

    live_any = (
        supabase_admin.table("matches")
        .select("*")
        .eq("status", "live")
        .execute()
    ).data or []

    # Dedup by match id (in_window + live_any יכולים לחפוף)
    by_id: dict[int, dict] = {}
    for m in in_window:
        by_id[m["id"]] = m
    for m in live_any:
        by_id.setdefault(m["id"], m)
    return list(by_id.values())


def _is_placeholder_team(team_name: Optional[str]) -> bool:
    """מזהה אם שם הקבוצה הוא placeholder של פלייאוף (W##, L##, 1A, 2B, 3A/B/C/D/F).

    אם True — המשחק עדיין לא resolved (bracket_resolver לא הריץ עליו עוד), אז
    אין טעם לחפש אותו ב-ESPN.
    """
    if not team_name:
        return True
    n = team_name.strip()
    if not n:
        return True
    # W74 / L101 — מנצח/מפסיד משחק קודם
    if n[0] in ("W", "L") and n[1:].isdigit():
        return True
    # 1A / 2B / 3C / 4D — מקום בקבוצה
    if len(n) == 2 and n[0] in "1234" and n[1].isalpha():
        return True
    # 3A/B/C/D/F — מקום שלישי הטוב ביותר מבית שבחר
    if n[0] == "3" and "/" in n:
        return True
    return False


def _try_map_espn_id(match: dict) -> Optional[str]:
    """אם משחק חסר external_id אבל הקבוצות אמיתיות — מנסה למצוא את ה-ESPN event
    ע"י סריקת scoreboard והשוואת שמות.

    חשוב: ESPN מסווג משחקים לתאריכים לפי שעון אמריקאי — משחק שמתחיל ב-00:00/01:00
    UTC מופיע אצלם תחת התאריך הקודם (זה מה שתקע את מקסיקו-אנגליה וארה"ב-בלגיה).
    לכן סורקים את יום ה-kickoff וגם את היום שלפניו ואחריו.

    Idempotent: לא כותב כלום. מחזיר ESPN id (str) או None.
    מחיר: עד 3 שאילתות HTTP ל-ESPN (פר ניסיון, רק כשאין external_id).
    """
    from datetime import datetime, timedelta

    from app.crons.map_espn_ids import _names_match
    from app.services import espn

    team_home = match.get("team_home")
    team_away = match.get("team_away")
    if _is_placeholder_team(team_home) or _is_placeholder_team(team_away):
        return None  # עוד לא resolved — אין טעם לחפש

    kickoff_str = match.get("kickoff_utc")
    if not kickoff_str:
        return None
    try:
        kickoff = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
    except ValueError:
        return None

    for day_offset in (0, -1, 1):
        target = kickoff.date() + timedelta(days=day_offset)
        events = espn.fetch_scoreboard(target)
        for ev in events:
            same_order = (
                _names_match(team_home, ev["team_home"])
                and _names_match(team_away, ev["team_away"])
            )
            flipped = (
                _names_match(team_home, ev["team_away"])
                and _names_match(team_away, ev["team_home"])
            )
            if same_order or flipped:
                return ev["espn_id"]
    return None


def fetch_match_result_from_api(match: dict) -> Optional[dict]:
    """
    שולף תוצאה חיה מ-ESPN דרך external_id.

    אם external_id חסר אבל הקבוצות אמיתיות (post bracket-resolver) —
    מנסה לאתר את ה-ESPN event לבד ולשמור אותו לקראת הרצות הבאות.

    מחזיר None אם:
    - הקבוצות עדיין placeholder (W##/L##/1A/3A/B/C/D/F)
    - ESPN לא מצא התאמה
    - אין שינוי משמעותי
    """
    from app.services import espn

    espn_id = match.get("external_id")
    if not espn_id:
        # Auto-mapping — קורה ל-R16+ אחרי שה-bracket_resolver מילא קבוצות אמיתיות
        espn_id = _try_map_espn_id(match)
        if not espn_id:
            return None
        # Cache בלייב — שאר הריצות יעברו מהר דרך external_id
        try:
            supabase_admin.table("matches").update({"external_id": espn_id}).eq(
                "id", match["id"]
            ).execute()
            match["external_id"] = espn_id
            logger.info(f"auto-mapped match #{match['id']} → ESPN {espn_id}")
        except Exception as e:
            logger.warning(f"failed to cache external_id for match #{match['id']}: {e}")

    espn_result = espn.fetch_match_by_id(espn_id)
    if not espn_result:
        return None

    return {
        "status": espn_result["status"],
        "score_home": espn_result["score_home"],
        "score_away": espn_result["score_away"],
        "score_home_pen": espn_result.get("score_home_pen"),
        "score_away_pen": espn_result.get("score_away_pen"),
        "display_clock": espn_result.get("display_clock"),
    }


def sync_one_match(match: dict, dry_run: bool = False) -> MatchSyncResult:
    """מסנכרן משחק אחד. מחזיר תיאור מה קרה."""
    match_id = match["id"]
    old_status = match["status"]
    old_score = (match.get("score_home"), match.get("score_away"))

    result: MatchSyncResult = {
        "match_id": match_id,
        "action": "no_change",
        "old_status": old_status,
        "new_status": old_status,
        "old_score": old_score,
        "new_score": old_score,
    }

    api_data = fetch_match_result_from_api(match)
    if not api_data:
        return result  # אין מקור נתונים, דלג בשקט

    new_status = api_data["status"]
    new_score = (api_data["score_home"], api_data["score_away"])
    new_clock = api_data.get("display_clock")
    old_clock = match.get("display_clock")
    result["new_status"] = new_status
    result["new_score"] = new_score

    # אין שינוי בכלל? (כולל ה-clock כדי שדקה תזוז גם בלי שער)
    if new_status == old_status and new_score == old_score and new_clock == old_clock:
        return result

    if dry_run:
        result["action"] = "dry_run_would_update"
        return result

    # === עדכון ה-row במשחק ===
    update = {
        "score_home": new_score[0],
        "score_away": new_score[1],
        "status": new_status,
        "display_clock": new_clock,
    }
    if "score_home_ht" in api_data:
        update["score_home_ht"] = api_data["score_home_ht"]
    if "score_away_ht" in api_data:
        update["score_away_ht"] = api_data["score_away_ht"]
    # פנדלים (אם המשחק הסתיים בפנדלים)
    if "score_home_pen" in api_data:
        update["score_home_pen"] = api_data["score_home_pen"]
    if "score_away_pen" in api_data:
        update["score_away_pen"] = api_data["score_away_pen"]
    if new_status == "finished" and old_status != "finished":
        update["finished_at"] = _now().isoformat()

    supabase_admin.table("matches").update(update).eq("id", match_id).execute()

    # === הפעלת scoring רק כשעבר ל-finished ===
    if new_status == "finished" and old_status != "finished":
        try:
            summary = scoring.calculate_match_score(match_id)
            result["action"] = "finished"
            result["scoring_summary"] = summary
        except Exception as e:
            logger.exception(f"Scoring failed for match {match_id}")
            result["action"] = "error"
            result["error"] = str(e)
    else:
        result["action"] = "live_update"

    # === Push: kickoff (משחק עבר ל-live) ===
    if new_status == "live" and old_status != "live":
        try:
            from app.services import notifications
            notifications.trigger_kickoff(match)
        except Exception as e:
            logger.warning(f"Kickoff push failed (non-fatal): {e}")

    # === Sync goal/red-card events (Phase 9) ===
    # רץ גם בלייב — שערים מופיעים תוך 2-3 דק׳. שגיאות לא הורגות את הסנכרון.
    if new_status in ("live", "finished") and not dry_run:
        try:
            _sync_match_events(match)
        except Exception:
            logger.exception(f"Failed to sync match events for {match_id} (non-fatal)")

    return result


# ============================================================
# Match events sync (Phase 9 — goals + red cards)
# ============================================================

# ESPN משתמש בשמות קבוצות מעט שונים מ-openfootball שמילא לנו את matches.
# כל פעם שמתגלה mismatch — להוסיף כאן.
ESPN_TO_DB_TEAM_NAME = {
    "Czechia": "Czech Republic",
    "Bosnia-Herzegovina": "Bosnia & Herzegovina",
    "United States": "USA",   # ESPN sometimes uses this for USMNT
    "USA": "USA",
    "Congo DR": "DR Congo",   # POR v DR Congo (#61): ESPN flipped the word order
    "Türkiye": "Turkey",      # TUR v USA (#23): ESPN uses the FIFA name
}


def _normalize_espn_team_name(espn_name: str) -> str:
    """תרגום שם קבוצה מ-ESPN לשם הנפוץ ב-matches table."""
    return ESPN_TO_DB_TEAM_NAME.get(espn_name, espn_name)


def _sync_match_events(match: dict) -> dict:
    """
    Fetch goals + red cards from ESPN for a match and reconcile match_events:
    upsert what's in the feed (idempotent via UNIQUE match_id,espn_event_id)
    and delete rows whose espn_event_id is no longer in the feed — ESPN drops
    VAR-cancelled goals, and without the delete they linger as ghost events.
    Deletion only runs on a successful ESPN response (fetch failure → None →
    no writes at all), and never touches rows with NULL espn_event_id.
    Returns counts; caller may log/ignore.
    """
    from app.services import espn

    espn_id = match.get("external_id")
    if not espn_id:
        return {"goals": 0, "red_cards": 0, "skipped": "no_external_id"}

    fetched = espn.fetch_match_events(espn_id)
    if fetched is None:
        return {"goals": 0, "red_cards": 0, "skipped": "espn_fetch_failed"}
    goals, red_cards = fetched

    match_id = match["id"]
    team_home_name = match["team_home"]
    team_away_name = match["team_away"]

    rows: list[dict] = []
    for g in goals:
        tname = _normalize_espn_team_name(g.get("team_name") or "")
        side = "home" if tname == team_home_name else "away" if tname == team_away_name else None
        if side is None:
            # ESPN team name didn't match either side — skip (probably a name mismatch
            # we don't want to fail silently in DB)
            logger.warning(f"match {match_id}: goal team '{tname}' matches neither home nor away")
            continue
        rows.append({
            "match_id": match_id,
            "event_type": "goal",
            "minute": g["minute"],
            "minute_value": g["minute_value"],
            "team": side,
            "primary_player": g["scorer"],
            "primary_player_id": g.get("scorer_id") or None,
            "assister": g.get("assister"),
            "assister_id": g.get("assister_id"),
            "is_penalty": g.get("is_penalty", False),
            "is_own_goal": g.get("is_own_goal", False),
            "espn_event_id": g["espn_event_id"],
        })

    for rc in red_cards:
        tname = _normalize_espn_team_name(rc.get("team_name") or "")
        side = "home" if tname == team_home_name else "away" if tname == team_away_name else None
        if side is None:
            logger.warning(f"match {match_id}: red-card team '{tname}' matches neither side")
            continue
        rows.append({
            "match_id": match_id,
            "event_type": "red_card",
            "minute": rc["minute"],
            "minute_value": rc["minute_value"],
            "team": side,
            "primary_player": rc["player"],
            "primary_player_id": rc.get("player_id") or None,
            "assister": None,
            "assister_id": None,
            "is_penalty": False,
            "is_own_goal": False,
            "espn_event_id": rc["espn_event_id"],
        })

    if rows:
        supabase_admin.table("match_events").upsert(
            rows, on_conflict="match_id,espn_event_id"
        ).execute()

    # Reconcile: delete events that vanished from the ESPN feed (VAR removals).
    # The feed-id set includes events skipped above on team-name mismatch, so a
    # broken alias can't cascade into deleting a previously-written row.
    feed_ids = {e["espn_event_id"] for e in goals + red_cards if e.get("espn_event_id")}
    existing = (
        supabase_admin.table("match_events")
        .select("id, espn_event_id, event_type, minute, primary_player")
        .eq("match_id", match_id)
        .not_.is_("espn_event_id", "null")
        .execute()
    ).data or []
    stale = [ev for ev in existing if ev["espn_event_id"] not in feed_ids]
    for ev in stale:
        logger.warning(
            f"match {match_id}: deleting ghost event no longer in ESPN feed — "
            f"{ev['event_type']} {ev['minute']} {ev['primary_player']} (espn_event_id={ev['espn_event_id']})"
        )
        supabase_admin.table("match_events").delete().eq("id", ev["id"]).execute()

    return {
        "goals": len(goals),
        "red_cards": len(red_cards),
        "written": len(rows),
        "deleted_ghosts": len(stale),
    }


def backfill_all_match_events() -> dict:
    """
    Manual one-shot: scan all matches with external_id, fetch + upsert events.
    Used to populate finished matches that are outside the active 2h window.
    """
    matches = (
        supabase_admin.table("matches")
        .select("id, external_id, team_home, team_away, status")
        .not_.is_("external_id", "null")
        .execute()
    ).data or []
    counts = {"scanned": 0, "with_events": 0, "total_rows": 0, "errors": 0}
    for m in matches:
        if m["status"] == "scheduled":
            continue  # nothing to fetch for unstarted matches
        counts["scanned"] += 1
        try:
            res = _sync_match_events(m)
            n = res.get("written", 0) or 0
            counts["total_rows"] += n
            if n > 0:
                counts["with_events"] += 1
                print(f"  match #{m['id']}: wrote {n} events ({res['goals']} goals, {res['red_cards']} red cards)")
        except Exception as e:
            counts["errors"] += 1
            print(f"  match #{m['id']}: ERROR {e}")
    return counts


def sync_all_active(dry_run: bool = False) -> list[MatchSyncResult]:
    """מסנכרן את כל המשחקים בחלון הפעיל. נקרא מה-cron."""
    matches = fetch_active_matches()
    results: list[MatchSyncResult] = []
    for m in matches:
        try:
            results.append(sync_one_match(m, dry_run=dry_run))
        except Exception as e:
            logger.exception(f"Failed to sync match {m['id']}")
            results.append({
                "match_id": m["id"],
                "action": "error",
                "old_status": m["status"],
                "new_status": m["status"],
                "old_score": (m.get("score_home"), m.get("score_away")),
                "new_score": (m.get("score_home"), m.get("score_away")),
                "error": str(e),
            })
    return results


def recompute_match(match_id: int) -> dict:
    """מחשב שוב ניקוד למשחק ספציפי (idempotent — score_events לא יוכפלו)."""
    return scoring.calculate_match_score(match_id)


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync match results + run scoring")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen, don't write")
    parser.add_argument("--recompute", type=int, metavar="MATCH_ID",
                        help="Recompute scoring for a specific match (idempotent)")
    parser.add_argument("--backfill", action="store_true",
                        help="One-shot: fetch goal/red-card events for all matches (outside cron window)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.recompute is not None:
        summary = recompute_match(args.recompute)
        print(f"✓ Recomputed match #{args.recompute}")
        print(f"  Predictions scored: {summary['predictions_scored']}")
        print(f"  Total points awarded: {summary['total_points_awarded']}")
        print(f"  Double-down bonuses: {summary['double_down_bonuses']}")
        print(f"  Affected users: {summary['affected_users']}")
        return 0

    if args.backfill:
        print("Backfilling match events for all matches with external_id...")
        counts = backfill_all_match_events()
        print(f"\nDone. Scanned: {counts['scanned']}, "
              f"With events: {counts['with_events']}, "
              f"Total event rows: {counts['total_rows']}, "
              f"Errors: {counts['errors']}")
        return 0

    results = sync_all_active(dry_run=args.dry_run)
    prefix = "(DRY) " if args.dry_run else ""
    print(f"{prefix}Synced {len(results)} active matches")
    for r in results:
        if r["action"] != "no_change":
            print(f"  match #{r['match_id']}: {r['old_status']}→{r['new_status']} "
                  f"{r['old_score']}→{r['new_score']} action={r['action']}")
            if r.get("scoring_summary"):
                s = r["scoring_summary"]
                print(f"    scored {s['predictions_scored']} preds, "
                      f"{s['total_points_awarded']} pts, "
                      f"DD={s['double_down_bonuses']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
