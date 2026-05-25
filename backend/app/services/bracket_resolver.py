"""
Bracket resolver — ממלא את המשחקים בשלב נוקאאוט בשמות הקבוצות האמיתיות.

ה-fixtures המקוריות (מ-openfootball) מגיעות עם placeholders:
- "1A" = הראשונה בקבוצה A
- "2A" = השנייה בקבוצה A
- "3A/B/C/D/F" = השלישית באחת מקבוצות A/B/C/D/F (לפי דירוג שלישיות הטוב ביותר — פורמט 48 קבוצות)

לאחר ששלב הבתים מסתיים, ה-resolver:
1. מחשב את הטבלאות של כל 12 הקבוצות.
2. מסדר את 12 השלישיות לפי pts → gd → gf, לוקח את 8 הטובות.
3. ממלא placeholders ב-team_home / team_away של משחקי הנוקאאוט.

אידמפוטנטי — הרצה שנייה לא תשנה כלום אם הקבוצות כבר ממולאות (string-comparison).
"""
from __future__ import annotations

import logging
from typing import Optional

from app.db.supabase import supabase_admin

logger = logging.getLogger(__name__)


def _compute_group_table(group_name: str) -> Optional[list[dict]]:
    """
    מחזיר טבלת הקבוצה כ-list של 4 dicts מסודרים (1st...4th), עם pts/gd/gf/gp (group position).
    None אם הקבוצה עדיין לא שלמה.
    """
    matches = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,status")
        .eq("stage", "group")
        .eq("group_name", group_name)
        .execute()
    ).data or []

    finished = [m for m in matches if m["status"] == "finished" and m["score_home"] is not None]
    if len(finished) != 6:
        return None

    standings: dict[str, dict] = {}
    for m in finished:
        for team in (m["team_home"], m["team_away"]):
            standings.setdefault(team, {"name": team, "pts": 0, "gf": 0, "ga": 0})

        h, a = m["score_home"], m["score_away"]
        standings[m["team_home"]]["gf"] += h
        standings[m["team_home"]]["ga"] += a
        standings[m["team_away"]]["gf"] += a
        standings[m["team_away"]]["ga"] += h

        if h > a:
            standings[m["team_home"]]["pts"] += 3
        elif h < a:
            standings[m["team_away"]]["pts"] += 3
        else:
            standings[m["team_home"]]["pts"] += 1
            standings[m["team_away"]]["pts"] += 1

    for s in standings.values():
        s["gd"] = s["gf"] - s["ga"]
        s["group"] = group_name

    if len(standings) != 4:
        return None

    ordered = sorted(standings.values(), key=lambda s: (-s["pts"], -s["gd"], -s["gf"], s["name"]))
    for i, s in enumerate(ordered):
        s["position"] = i + 1
    return ordered


def _winner_loser_of(match_id: int) -> Optional[tuple[str, str]]:
    """מחזיר (winner, loser) של משחק נוקאאוט שהסתיים, או None אם עוד לא נגמר."""
    res = (
        supabase_admin.table("matches")
        .select("team_home,team_away,score_home,score_away,score_home_pen,score_away_pen,status")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    m = res.data[0]
    if m["status"] != "finished" or m["score_home"] is None:
        return None

    h, a = m["score_home"], m["score_away"]
    if h > a:
        return (m["team_home"], m["team_away"])
    if a > h:
        return (m["team_away"], m["team_home"])

    # שוויון — מכריעים בפנדלים
    hp, ap = m.get("score_home_pen"), m.get("score_away_pen")
    if hp is not None and ap is not None:
        if hp > ap:
            return (m["team_home"], m["team_away"])
        if ap > hp:
            return (m["team_away"], m["team_home"])
    return None


def _resolve_placeholder(
    placeholder: str,
    tables: dict[str, list[dict]],
    third_place_ranking: list[dict],
    used_thirds: set[str],
) -> Optional[str]:
    """
    מפענח placeholder יחיד:
    - "1A" / "2A" / "3A" / "4A" → ראש קבוצה / שני / שלישי / רביעי בקבוצה A
    - "3A/B/C/D/E" → הטוב ביותר מבין השלישיות של הקבוצות הללו שעוד לא שובץ
    - "W73" / "L73" → מנצח / מפסיד של משחק 73 (אם הסתיים)
    אם השם לא placeholder (כבר שם אמיתי של קבוצה) — מחזיר אותו כמו שהוא.
    """
    if not placeholder or len(placeholder) < 2:
        return placeholder

    # "W{id}" / "L{id}" — winner/loser of previous knockout match
    if placeholder[0] in ("W", "L") and placeholder[1:].isdigit():
        match_id = int(placeholder[1:])
        result = _winner_loser_of(match_id)
        if not result:
            return None
        winner, loser = result
        return winner if placeholder[0] == "W" else loser

    # Plain "1A" / "2A" / "3A" / "4A"
    if len(placeholder) == 2 and placeholder[0] in "1234" and placeholder[1].isalpha():
        pos = int(placeholder[0])
        group = placeholder[1].upper()
        if group in tables and len(tables[group]) >= pos:
            return tables[group][pos - 1]["name"]
        return None

    # "3A/B/C/D/F" or "3C/D/F/G/H" — best third from listed groups
    if placeholder.startswith("3") and "/" in placeholder:
        eligible_groups = placeholder[1:].split("/")
        candidates = [t for t in third_place_ranking if t["group"] in eligible_groups and t["name"] not in used_thirds]
        if candidates:
            chosen = candidates[0]
            used_thirds.add(chosen["name"])
            return chosen["name"]
        return None

    return placeholder  # already a real team name


def resolve_knockout_brackets() -> dict:
    """
    מפענח את כל placeholder-ים במשחקי R32 → final.
    מחזיר summary עם כמות מעודכנים.

    אם איזושהי קבוצה לא שלמה — לא משתנה כלום באותו slot, אבל ממשיך לאחרים.
    """
    # 1. בניית טבלאות לכל 12 הקבוצות
    tables: dict[str, list[dict]] = {}
    for letter in (chr(ord("A") + i) for i in range(12)):
        table = _compute_group_table(letter)
        if table:
            tables[letter] = table

    # 2. דירוג שלישיות (third-place ranking)
    thirds = [tables[g][2] for g in tables if len(tables[g]) >= 3]
    third_place_ranking = sorted(thirds, key=lambda s: (-s["pts"], -s["gd"], -s["gf"], s["name"]))

    # 3. עוברים על כל משחק נוקאאוט בסדר כרונולוגי ומפענחים placeholders
    knockout_stages = ["r32", "r16", "qf", "sf", "third_place", "final"]
    matches = (
        supabase_admin.table("matches")
        .select("id,stage,team_home,team_away")
        .in_("stage", knockout_stages)
        .order("kickoff_utc")
        .execute()
    ).data or []

    used_thirds: set[str] = set()
    summary = {
        "groups_resolved": len(tables),
        "third_place_ranking": [{"name": t["name"], "group": t["group"], "pts": t["pts"]} for t in third_place_ranking],
        "updated": 0,
        "unresolved": [],
    }

    for m in matches:
        new_home = _resolve_placeholder(m["team_home"], tables, third_place_ranking, used_thirds)
        new_away = _resolve_placeholder(m["team_away"], tables, third_place_ranking, used_thirds)

        update: dict = {}
        if new_home and new_home != m["team_home"]:
            update["team_home"] = new_home
        if new_away and new_away != m["team_away"]:
            update["team_away"] = new_away

        if update:
            supabase_admin.table("matches").update(update).eq("id", m["id"]).execute()
            summary["updated"] += 1

        if not new_home or not new_away:
            summary["unresolved"].append({
                "match_id": m["id"],
                "stage": m["stage"],
                "home": m["team_home"],
                "away": m["team_away"],
            })

    return summary
