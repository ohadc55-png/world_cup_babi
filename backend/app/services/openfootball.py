"""
טעינת לוח המשחקים של מונדיאל 2026 מ-openfootball/worldcup.json.

המקור חינמי לחלוטין (GitHub raw). 104 משחקים: 72 שלב בתים + 32 פלייאוף.
המבנה: רשימת matches שטוחה עם round (שם), date, time (UTC offset), team1/2, group (אם בית), ground.

הערה לגבי FIFA ranks: נכון לעכשיו נשמרים NULL (יוסיף ערכים בעדכון מאוחר יותר).
חסר FIFA rank → בונוס underdog פשוט לא יחול (לוגיקת is_underdog_win מטפלת ב-NULL).
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.db.supabase import supabase_admin

OPENFOOTBALL_URL = (
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
)


def determine_stage(round_name: str) -> str:
    """ממיר את שם הסיבוב מ-openfootball ל-stage תקין (אחד מ-7 ערכים)."""
    r = (round_name or "").lower().strip()

    if "matchday" in r or "group" in r:
        return "group"
    if "round of 32" in r:
        return "r32"
    if "round of 16" in r:
        return "r16"
    if "quarter" in r:
        return "qf"
    if "semi" in r:
        return "sf"
    if "third" in r or "3rd place" in r:
        return "third_place"
    if "final" in r:
        return "final"

    raise ValueError(f"Unknown round name: {round_name!r}")


_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*UTC([+-])(\d{1,2})(?::(\d{2}))?$")


def parse_kickoff(date_str: str, time_str: str) -> datetime:
    """
    ממיר תאריך+שעה מ-openfootball ל-UTC datetime.
    דוגמה: date='2026-06-11', time='13:00 UTC-6' → datetime(2026,6,11,19,0,tzinfo=UTC)
    """
    match = _TIME_RE.match(time_str.strip())
    if not match:
        raise ValueError(f"Could not parse time string: {time_str!r}")

    hour, minute, sign, off_h, off_m = match.groups()
    hour, minute, off_h = int(hour), int(minute), int(off_h)
    off_m = int(off_m) if off_m else 0

    # היסט UTC: ה-time בקובץ זה מקומי באזור משחק. UTC-6 אומר שהמקומי = UTC-6.
    # כדי לקבל UTC: local + |offset| (אם sign=='-') או local - offset (אם sign=='+').
    offset_minutes = off_h * 60 + off_m
    if sign == "-":
        offset_minutes = -offset_minutes

    # מבנים datetime נאיבי במקומי, ואז מחסירים את ה-offset כדי לקבל UTC
    local_naive = datetime.strptime(f"{date_str} {hour:02d}:{minute:02d}", "%Y-%m-%d %H:%M")
    # אם המקומי = UTC + offset, אז UTC = מקומי - offset
    utc_dt = local_naive - timedelta(minutes=offset_minutes)
    return utc_dt.replace(tzinfo=timezone.utc)


def compute_group_rounds(matches: list[dict[str, Any]]) -> dict[int, int]:
    """
    מחזיר mapping של match_index → group_round (1/2/3).
    החישוב: לכל בית, מיון לפי תאריך → 2 משחקים ראשונים = round 1, וכך הלאה.

    האינדקס בא מרשימת המשחקים המקורית (כפי שהם מסודרים בקובץ).
    """
    # קיבוץ אינדקסים לפי קבוצה (רק משחקי בתים)
    by_group: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for idx, m in enumerate(matches):
        group = m.get("group")
        if group:
            by_group[group].append((idx, m["date"]))

    result: dict[int, int] = {}
    for group, items in by_group.items():
        # מיון לפי תאריך (יציב — לפי האינדקס המקורי)
        items.sort(key=lambda x: (x[1], x[0]))
        # 2 ראשונים = round 1, הבאים 2 = round 2, האחרונים 2 = round 3
        for slot, (idx, _) in enumerate(items):
            result[idx] = slot // 2 + 1  # 0,1→1; 2,3→2; 4,5→3
    return result


async def sync_fixtures() -> dict[str, int]:
    """
    מסנכרן את 104 המשחקים ל-DB. idempotent — אם משחק קיים, מתעדכן.
    מחזיר סטטיסטיקה: {fetched, inserted_or_updated}.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(OPENFOOTBALL_URL)
        response.raise_for_status()
        data = response.json()

    matches = data.get("matches", [])
    group_round_map = compute_group_rounds(matches)

    rows = []
    for idx, m in enumerate(matches, start=1):
        stage = determine_stage(m["round"])
        kickoff_utc = parse_kickoff(m["date"], m["time"])

        # group_name: 'Group A' → 'A'
        group_name = None
        if m.get("group"):
            g = m["group"]
            group_name = g.replace("Group ", "").strip() if "Group " in g else g

        rows.append({
            "id": idx,
            "stage": stage,
            "group_name": group_name,
            "group_round": group_round_map.get(idx - 1),  # idx-1 כי המפה משתמשת באינדקס המקורי 0-based
            "match_number": idx,
            "team_home": m["team1"],
            "team_away": m["team2"],
            "kickoff_utc": kickoff_utc.isoformat(),
            "venue": m.get("ground"),
            "status": "scheduled",
            "predictions_locked": False,
            # FIFA ranks: NULL לעת עתה (יוסיפו בעדכון עתידי)
            "team_home_fifa_rank": None,
            "team_away_fifa_rank": None,
        })

    # upsert בבת אחת (Supabase מקבל list של דiсts)
    result = supabase_admin.table("matches").upsert(rows, on_conflict="id").execute()

    return {
        "fetched": len(matches),
        "inserted_or_updated": len(result.data) if result.data else 0,
    }
