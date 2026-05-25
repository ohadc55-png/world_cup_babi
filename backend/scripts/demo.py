"""
Demo simulator — בדיקת end-to-end של כל המערכת לפני המונדיאל.

מוסיף 4 בוטים למשחק הקיים שלך, נותן להם ניחושים מגוונים, ומאפשר לסמלץ
את כל 104 המשחקים אחד-אחד או בבת אחת כדי לראות איך הניקוד וההתראות עובדים.

זרימה מומלצת:
  1. python -m scripts.demo setup <YOUR_GAME_CODE>
     - מוסיף 4 בוטים למשחק שלך + נותן להם ניחושים (משחקים + טבלאות + מצטיינים)

  2. python -m scripts.demo status
     - מציג את ה-leaderboard הנוכחי + התקדמות הסימולציה

  3. python -m scripts.demo round 1
     - מסמלץ את כל 24 המשחקים של מחזור 1
     - ה-scoring engine רץ אוטומטית, push notifications נשלחות

  4. python -m scripts.demo all
     - מסמלץ הכל בסדר כרונולוגי (אזהרה: לוקח זמן + מציף עם push)

  5. python -m scripts.demo reset
     - מנקה הכל: בוטים, תוצאות, ניקוד. המשחק שלך נשמר.

פקודות נוספות:
  python -m scripts.demo simulate <MATCH_ID>   -- משחק ספציפי
  python -m scripts.demo stage qf              -- כל משחקי שלב ספציפי
"""
from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Optional

from app.core.constants import ROUND_KEYS
from app.core.security import hash_pin
from app.db.supabase import supabase_admin
from app.services import scoring

logger = logging.getLogger(__name__)

# ============================================================
# Configuration
# ============================================================

BOTS = [
    {"username": "demo_pro",     "label": "🎯 דמו-מקצועי",  "pin": "1111", "accuracy": "pro"},
    {"username": "demo_good",    "label": "👍 דמו-טוב",      "pin": "2222", "accuracy": "good"},
    {"username": "demo_meh",     "label": "😐 דמו-בינוני",   "pin": "3333", "accuracy": "meh"},
    {"username": "demo_lucky",   "label": "🎲 דמו-מזל",      "pin": "4444", "accuracy": "lucky"},
]

# קובץ persistence ל-actuals (כדי שניתן לחשב את 'pro' bot כפרפקט)
STATE_FILE = Path(__file__).parent / "demo_state.json"

# רנדום מבוסס seed — סימולציות עקביות בין הרצות
RNG = random.Random(42)


# ============================================================
# State file helpers
# ============================================================

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"actuals": {}}  # match_id (str) -> {home, away, home_pen, away_pen}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


# ============================================================
# Random score / prediction generators
# ============================================================

def realistic_score(rng: random.Random, allow_draws: bool = True) -> tuple[int, int]:
    """תוצאה ריאליסטית: רוב התוצאות 0-3 גולים, חלוקה כמו בכדורגל אמיתי."""
    # מודל פשוט: סך גולים לפי Poisson(2.7)
    total_goals = min(8, max(0, int(rng.expovariate(1 / 2.7))))
    if total_goals == 0:
        return 0, 0 if allow_draws else (1, 0)
    home = rng.randint(0, total_goals)
    away = total_goals - home
    if not allow_draws and home == away:
        # זרוק את הדגלים שוב כדי לוודא שאין תיקו
        if rng.random() < 0.5:
            home += 1
        else:
            away += 1
    return home, away


def penalty_score(rng: random.Random) -> tuple[int, int]:
    """תוצאת פנדלים: ~50/50 לכל צד עד שיש מנצח. מספרים סבירים 3-7 לכל צד."""
    home = rng.randint(3, 6)
    away = home + rng.choice([-1, 1])  # הפרש 1
    if away < 0:
        away = 0
    return home, away


def gen_actual_score(rng: random.Random, stage: str) -> dict:
    """מחזיר {home, away, home_pen, away_pen} - תוצאה ריאליסטית לפי שלב."""
    if stage == "group":
        h, a = realistic_score(rng, allow_draws=True)
        return {"home": h, "away": a, "home_pen": None, "away_pen": None}
    # פלייאוף - יכול להגיע לפנדלים
    h, a = realistic_score(rng, allow_draws=True)
    if h == a:
        # ~25% מהתיקויים בפלייאוף הולכים לפנדלים (לא הכל - חלקם יוכרעו בהארכה)
        if rng.random() < 0.7:
            hp, ap = penalty_score(rng)
            return {"home": h, "away": a, "home_pen": hp, "away_pen": ap}
        # אחרת — נדחוף תוצאת הארכה
        if rng.random() < 0.5:
            h += 1
        else:
            a += 1
    return {"home": h, "away": a, "home_pen": None, "away_pen": None}


def gen_prediction(rng: random.Random, actual: dict, accuracy: str) -> dict:
    """
    מחזיר {direction, score_home, score_away} לפי ה-accuracy של הבוט.

    pro    — תמיד מנחש exact (זמן רגיל)
    good   — 65% direction נכון, 35% מהם exact
    meh    — 40% direction נכון, 10% מהם exact
    lucky  — אקראי טהור
    """
    ah, aa = actual["home"], actual["away"]
    actual_dir = "1" if ah > aa else "2" if ah < aa else "X"

    if accuracy == "pro":
        return {"direction": actual_dir, "score_home": ah, "score_away": aa}

    if accuracy == "good":
        if rng.random() < 0.65:
            # direction נכון
            if rng.random() < 0.35:
                return {"direction": actual_dir, "score_home": ah, "score_away": aa}
            # רק direction, score שונה
            return _matching_direction_score(rng, actual_dir, exclude_exact=(ah, aa))
        return _random_score(rng)

    if accuracy == "meh":
        if rng.random() < 0.40:
            if rng.random() < 0.10:
                return {"direction": actual_dir, "score_home": ah, "score_away": aa}
            return _matching_direction_score(rng, actual_dir, exclude_exact=(ah, aa))
        return _random_score(rng)

    # lucky — אקראי
    return _random_score(rng)


def _matching_direction_score(rng: random.Random, direction: str, exclude_exact: tuple[int, int]) -> dict:
    """תוצאה מ-direction נתון אבל לא בדיוק exclude_exact."""
    for _ in range(10):
        h = rng.randint(0, 4)
        a = rng.randint(0, 4)
        dir_match = ("1" if h > a else "2" if h < a else "X")
        if dir_match == direction and (h, a) != exclude_exact:
            return {"direction": direction, "score_home": h, "score_away": a}
    # fallback
    if direction == "1":
        return {"direction": "1", "score_home": 1, "score_away": 0}
    if direction == "2":
        return {"direction": "2", "score_home": 0, "score_away": 1}
    return {"direction": "X", "score_home": 1, "score_away": 1}


def _random_score(rng: random.Random) -> dict:
    h = rng.randint(0, 4)
    a = rng.randint(0, 4)
    dir_ = "1" if h > a else "2" if h < a else "X"
    return {"direction": dir_, "score_home": h, "score_away": a}


# ============================================================
# Group standings prediction (per bot)
# ============================================================

def gen_group_standings_prediction(rng: random.Random, teams: list[str], accuracy: str) -> list[str]:
    """מחזיר 4 קבוצות בסדר נוחה. ל-pro: מסדר 'נכון' (אלפבית); ל-lucky: shuffled."""
    teams = list(teams)
    if accuracy == "pro":
        return sorted(teams)  # ל-demo, נסדר אלפבתי
    if accuracy == "good":
        result = sorted(teams)
        # 1-2 swaps אקראיים
        for _ in range(rng.randint(1, 2)):
            i, j = rng.sample(range(4), 2)
            result[i], result[j] = result[j], result[i]
        return result
    rng.shuffle(teams)
    return teams


# ============================================================
# Helpers
# ============================================================

def get_game_by_code(code: str) -> Optional[dict]:
    res = (
        supabase_admin.table("games")
        .select("*")
        .eq("invite_code", code.upper())
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def get_or_create_bot(bot_def: dict, game_id: str) -> dict:
    """מחזיר את ה-bot user (יוצר אם לא קיים, ומשייך לmשחק)."""
    existing = (
        supabase_admin.table("users")
        .select("*")
        .eq("username", bot_def["username"])
        .limit(1)
        .execute()
    )
    if existing.data:
        user = existing.data[0]
        # ודא שמשויך למשחק
        if user.get("game_id") != game_id:
            supabase_admin.table("users").update({"game_id": game_id}).eq(
                "id", user["id"]
            ).execute()
        return user

    # יצירה
    new_user = (
        supabase_admin.table("users")
        .insert({
            "username": bot_def["username"],
            "pin_hash": hash_pin(bot_def["pin"]),
            "avatar_url": None,
            "game_id": game_id,
        })
        .execute()
    )
    user = new_user.data[0]

    # תשתית - scores + DD tokens
    supabase_admin.table("scores").insert({"user_id": user["id"]}).execute()
    rows = [{"user_id": user["id"], "round_key": rk, "status": "available"} for rk in ROUND_KEYS]
    supabase_admin.table("double_down_tokens").insert(rows).execute()

    return user


def list_demo_bot_users() -> list[dict]:
    """כל הבוטים הקיימים ב-DB."""
    usernames = [b["username"] for b in BOTS]
    res = (
        supabase_admin.table("users")
        .select("*")
        .in_("username", usernames)
        .execute()
    )
    return res.data or []


# ============================================================
# SETUP command
# ============================================================

def cmd_setup(args: argparse.Namespace) -> int:
    code = args.code.upper()
    game = get_game_by_code(code)
    if not game:
        print(f"[ERR] משחק עם קוד {code} לא נמצא")
        return 1

    print(f"== Setup דמו במשחק '{game['name']}' (קוד {code}) ==")
    print()

    # 1. שולפים את כל המשחקים
    all_matches_res = (
        supabase_admin.table("matches")
        .select("*")
        .order("kickoff_utc")
        .execute()
    )
    all_matches = all_matches_res.data
    print(f"[OK] נטענו {len(all_matches)} משחקים מה-DB")

    # 2. גנרציה של 'actual scores' פר משחק (deterministic seed)
    state = load_state()
    actuals = state.setdefault("actuals", {})
    rng = random.Random(42)
    for m in all_matches:
        key = str(m["id"])
        if key not in actuals:
            actuals[key] = gen_actual_score(rng, m["stage"])
    save_state(state)
    print(f"[OK] נוצרו {len(actuals)} תוצאות עתידיות (cached ל-{STATE_FILE.name})")

    # 3. שולפים קבוצות לפי בית (לטבלאות בתים)
    teams_by_group: dict[str, list[str]] = {}
    for m in all_matches:
        if m["stage"] != "group" or not m["group_name"]:
            continue
        g = m["group_name"]
        teams_by_group.setdefault(g, [])
        for t in (m["team_home"], m["team_away"]):
            if t not in teams_by_group[g]:
                teams_by_group[g].append(t)

    # רשימת כל הקבוצות (לבחירת champion/finalists/semis/awards)
    all_teams = sorted({t for teams in teams_by_group.values() for t in teams})

    # 4. בוטים — יצירה + שיוך + ניחושים
    for bot_def in BOTS:
        user = get_or_create_bot(bot_def, game["id"])
        print(f"[OK] בוט {bot_def['username']} ({bot_def['accuracy']}) - user_id={user['id'][:8]}...")

        bot_rng = random.Random(hash(bot_def["username"]) % (2**32))

        # 4a. ניחושי משחקים
        preds_to_insert = []
        for m in all_matches:
            actual = actuals[str(m["id"])]
            p = gen_prediction(bot_rng, actual, bot_def["accuracy"])
            preds_to_insert.append({
                "user_id": user["id"],
                "match_id": m["id"],
                "direction": p["direction"],
                "score_home": p["score_home"],
                "score_away": p["score_away"],
            })
        # UPSERT אחד-אחד (Supabase JSON limit), batch של 100
        for i in range(0, len(preds_to_insert), 100):
            chunk = preds_to_insert[i:i+100]
            try:
                supabase_admin.table("predictions_matches").upsert(
                    chunk, on_conflict="user_id,match_id"
                ).execute()
            except Exception as e:
                logger.warning(f"upsert chunk failed: {e}")
        print(f"     - {len(preds_to_insert)} ניחושי משחקים")

        # 4b. ניחושי טבלאות בתים
        for g, teams in teams_by_group.items():
            standings = gen_group_standings_prediction(bot_rng, teams, bot_def["accuracy"])
            supabase_admin.table("predictions_groups").upsert({
                "user_id": user["id"],
                "group_name": g,
                "team_1st": standings[0],
                "team_2nd": standings[1],
                "team_3rd": standings[2],
                "team_4th": standings[3],
            }, on_conflict="user_id,group_name").execute()
        print(f"     - {len(teams_by_group)} ניחושי טבלאות בתים")

        # 4c. ניחושי טווח-ארוך (champion + finalists + semis + scorers)
        picks = bot_rng.sample(all_teams, 4) if len(all_teams) >= 4 else all_teams
        supabase_admin.table("predictions_tournament").upsert({
            "user_id": user["id"],
            "winner": picks[0],
            "finalist_1": picks[0],
            "finalist_2": picks[1],
            "semifinalist_1": picks[0],
            "semifinalist_2": picks[1],
            "semifinalist_3": picks[2],
            "semifinalist_4": picks[3],
            "top_scorer": f"Player {bot_rng.randint(1, 99)}",
            "top_assister": f"Player {bot_rng.randint(1, 99)}",
            "golden_ball": f"Player {bot_rng.randint(1, 99)}",
        }, on_conflict="user_id").execute()
        print(f"     - ניחושי טווח-ארוך (champion + finalists + semis + awards)")
        print()

    print(f"[OK] Setup הושלם! {len(BOTS)} בוטים מוכנים עם ניחושים.")
    print()
    print("הצעד הבא:")
    print("  python -m scripts.demo status     -- ראה מצב נוכחי")
    print("  python -m scripts.demo round 1    -- סמלץ מחזור 1")
    print("  python -m scripts.demo all        -- סמלץ הכל")
    return 0


# ============================================================
# SIMULATE commands
# ============================================================

def _simulate_one_match(match_id: int, verbose: bool = True) -> dict:
    """מסמלץ משחק יחיד: כותב את ה-actual ל-DB, מריץ scoring."""
    state = load_state()
    actuals = state.get("actuals", {})
    key = str(match_id)
    if key not in actuals:
        # אם לא נוצר מראש - generate fresh
        match_res = supabase_admin.table("matches").select("stage").eq("id", match_id).single().execute()
        if not match_res.data:
            return {"error": f"Match {match_id} not found"}
        rng = random.Random(match_id)
        actuals[key] = gen_actual_score(rng, match_res.data["stage"])
        state["actuals"] = actuals
        save_state(state)

    actual = actuals[key]
    update = {
        "score_home": actual["home"],
        "score_away": actual["away"],
        "status": "finished",
        "finished_at": "now()",
        "predictions_locked": True,
    }
    if actual.get("home_pen") is not None:
        update["score_home_pen"] = actual["home_pen"]
        update["score_away_pen"] = actual["away_pen"]

    supabase_admin.table("matches").update(update).eq("id", match_id).execute()

    # Run scoring
    try:
        summary = scoring.calculate_match_score(match_id)
    except Exception as e:
        return {"match_id": match_id, "error": str(e)}

    if verbose:
        score_str = f"{actual['home']}-{actual['away']}"
        if actual.get("home_pen") is not None:
            score_str = f"{actual['home']}({actual['home_pen']})-{actual['away']}({actual['away_pen']})"
        print(f"  match #{match_id}: {score_str} | scored {summary['predictions_scored']} preds, {summary['total_points_awarded']} pts")
    return summary


def cmd_simulate_match(args: argparse.Namespace) -> int:
    print(f"== Simulating match #{args.match_id} ==")
    result = _simulate_one_match(args.match_id)
    if "error" in result:
        print(f"[ERR] {result['error']}")
        return 1
    print()
    print(f"[OK] match #{args.match_id} done")
    return 0


def cmd_simulate_round(args: argparse.Namespace) -> int:
    round_num = args.round
    print(f"== Simulating group round {round_num} ==")
    matches = (
        supabase_admin.table("matches")
        .select("id, team_home, team_away, group_round, status")
        .eq("stage", "group")
        .eq("group_round", round_num)
        .order("kickoff_utc")
        .execute()
    )
    pending = [m for m in matches.data if m["status"] != "finished"]
    print(f"[OK] {len(pending)} pending matches in round {round_num}")
    print()
    for m in pending:
        _simulate_one_match(m["id"])
    print()
    print(f"[OK] round {round_num} done")
    return 0


def cmd_simulate_stage(args: argparse.Namespace) -> int:
    stage = args.stage
    print(f"== Simulating stage '{stage}' ==")
    matches = (
        supabase_admin.table("matches")
        .select("id, team_home, team_away, status")
        .eq("stage", stage)
        .order("kickoff_utc")
        .execute()
    )
    pending = [m for m in matches.data if m["status"] != "finished"]
    print(f"[OK] {len(pending)} pending matches in stage '{stage}'")
    print()
    for m in pending:
        _simulate_one_match(m["id"])
    print()
    print(f"[OK] stage '{stage}' done")
    return 0


def cmd_simulate_all(args: argparse.Namespace) -> int:
    print("== Simulating ALL matches in chronological order ==")
    matches = (
        supabase_admin.table("matches")
        .select("id, status")
        .order("kickoff_utc")
        .execute()
    )
    pending = [m for m in matches.data if m["status"] != "finished"]
    print(f"[OK] {len(pending)} pending matches total")
    print()

    for i, m in enumerate(pending, 1):
        _simulate_one_match(m["id"])
        if args.delay > 0:
            time.sleep(args.delay)
        if i % 10 == 0:
            print(f"  ... {i}/{len(pending)} done")
    print()
    print(f"[OK] all {len(pending)} matches done")
    print()
    print("הצעד הבא: python -m scripts.demo status")
    return 0


# ============================================================
# STATUS command
# ============================================================

def cmd_status(args: argparse.Namespace) -> int:
    # סטטיסטיקת משחקים
    all_matches = supabase_admin.table("matches").select("status, stage").execute()
    by_status = {}
    for m in (all_matches.data or []):
        by_status[m["status"]] = by_status.get(m["status"], 0) + 1
    print("== Matches by status ==")
    for s, n in sorted(by_status.items()):
        print(f"  {s}: {n}")
    print()

    # בוטים
    bots = list_demo_bot_users()
    print(f"== Bots in DB ({len(bots)}) ==")
    for b in bots:
        score_res = supabase_admin.table("scores").select("total_points").eq("user_id", b["id"]).single().execute()
        pts = score_res.data["total_points"] if score_res.data else 0
        print(f"  {b['username']:20s}  game_id={str(b.get('game_id') or '-')[:8]}...  {pts:5d} pts")
    print()

    # Leaderboard לכל game עם בוטים
    games_with_bots = {b["game_id"] for b in bots if b.get("game_id")}
    for game_id in games_with_bots:
        game_res = supabase_admin.table("games").select("name").eq("id", game_id).single().execute()
        game_name = game_res.data["name"] if game_res.data else "—"
        members = supabase_admin.table("users").select("id, username").eq("game_id", game_id).execute()
        member_ids = [m["id"] for m in members.data]
        scores = (
            supabase_admin.table("scores")
            .select("user_id, total_points, group_stage_pts, knockout_pts, awards_pts, double_down_pts")
            .in_("user_id", member_ids)
            .order("total_points", desc=True)
            .execute()
        )
        users_by_id = {u["id"]: u["username"] for u in members.data}
        print(f"== Leaderboard for '{game_name}' ==")
        print(f"  {'#':<3} {'user':<22} {'total':>7} {'group':>7} {'KO':>5} {'awards':>7} {'DD':>5}")
        for i, s in enumerate(scores.data or [], 1):
            u = users_by_id.get(s["user_id"], "—")
            print(f"  {i:<3} {u:<22} {s['total_points']:>7} {s['group_stage_pts']:>7} {s['knockout_pts']:>5} {s['awards_pts']:>7} {s['double_down_pts']:>5}")
        print()
    return 0


# ============================================================
# RESET command
# ============================================================

def cmd_reset(args: argparse.Namespace) -> int:
    print("== Reset Demo ==")
    print()

    # 1. מחיקת בוטים (CASCADE מנקה predictions, scores, DD tokens, score_events)
    bots = list_demo_bot_users()
    print(f"מוחק {len(bots)} בוטים...")
    for b in bots:
        supabase_admin.table("users").delete().eq("id", b["id"]).execute()
        print(f"  [OK] deleted {b['username']}")
    print()

    # 2. איפוס תוצאות משחקים (לא משפיע על הניחושים של המשתמש האמיתי)
    print("מאפס תוצאות משחקים...")
    supabase_admin.table("matches").update({
        "score_home": None,
        "score_away": None,
        "score_home_pen": None,
        "score_away_pen": None,
        "status": "scheduled",
        "finished_at": None,
        "predictions_locked": False,
    }).neq("id", -1).execute()  # כל המשחקים
    print("  [OK] all matches reset to scheduled")
    print()

    # 3. ניקוי score_events של המשתמש האמיתי + רענון aggregations
    print("מנקה score_events של המשתמש שלך...")
    # שולפים את המשתמש (לא הבוטים)
    real_users = (
        supabase_admin.table("users")
        .select("id")
        .not_.in_("username", [b["username"] for b in BOTS])
        .execute()
    )
    for u in real_users.data or []:
        supabase_admin.table("score_events").delete().eq("user_id", u["id"]).execute()
        supabase_admin.table("predictions_matches").update({
            "points_earned": None,
            "points_breakdown": None,
        }).eq("user_id", u["id"]).execute()
        scoring._refresh_user_scores(u["id"])
    print(f"  [OK] cleaned for {len(real_users.data or [])} real users")
    print()

    # 4. ניקוי state file
    if STATE_FILE.exists():
        STATE_FILE.unlink()
        print(f"[OK] {STATE_FILE.name} deleted")

    print()
    print("[OK] Reset הושלם. אפשר להריץ setup חדש.")
    return 0


# ============================================================
# CLI
# ============================================================

def main() -> int:
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(
        prog="scripts.demo",
        description="Demo simulator for end-to-end testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_setup = sub.add_parser("setup", help="Create bots + predictions in your game")
    p_setup.add_argument("code", help="Game invite code (e.g., V63FZRZ2)")
    p_setup.set_defaults(func=cmd_setup)

    p_status = sub.add_parser("status", help="Show current leaderboard + progress")
    p_status.set_defaults(func=cmd_status)

    p_sim = sub.add_parser("simulate", help="Simulate a specific match")
    p_sim.add_argument("match_id", type=int)
    p_sim.set_defaults(func=cmd_simulate_match)

    p_round = sub.add_parser("round", help="Simulate all matches in a group round (1/2/3)")
    p_round.add_argument("round", type=int, choices=[1, 2, 3])
    p_round.set_defaults(func=cmd_simulate_round)

    p_stage = sub.add_parser("stage", help="Simulate all matches in a stage")
    p_stage.add_argument("stage", choices=["group", "r32", "r16", "qf", "sf", "third_place", "final"])
    p_stage.set_defaults(func=cmd_simulate_stage)

    p_all = sub.add_parser("all", help="Simulate ALL 104 matches chronologically")
    p_all.add_argument("--delay", type=float, default=0.0, help="Seconds between matches (default 0)")
    p_all.set_defaults(func=cmd_simulate_all)

    p_reset = sub.add_parser("reset", help="Clean up: remove bots, reset matches, clear scores")
    p_reset.set_defaults(func=cmd_reset)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
