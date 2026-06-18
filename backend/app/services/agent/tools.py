"""
Agent tools — definitions + implementations for all 9 tools the agent can call.

# =============================================================================
# CRITICAL — USER ISOLATION GUARANTEE
# =============================================================================
# Every function here receives `user_id` and `game_id` from get_current_user
# (the authenticated session). Never accept user_id from the client request
# or from Claude's tool input.
#
# Every DB query that touches user-scoped data MUST filter by user_id.
# Every query that touches OTHER users' data (leaderboard, others' preds)
# MUST also filter by game_id (so members of game A never see game B's data).
# =============================================================================
"""
from __future__ import annotations

from typing import Any

from app.db.supabase import supabase_admin


# ----------------------------------------------------------------
# Tool schema definitions (sent to Claude with each message)
# ----------------------------------------------------------------

AGENT_TOOLS: list[dict] = [
    {
        "name": "get_user_status",
        "description": (
            "מחזיר את המצב הנוכחי של המשתמש: מיקום בטבלה, ניקוד, פער מהראשון/הקודם, "
            "מספר ז'יטוני Double Down שנותרו, אחוז ניחושים נכונים. השתמש כשהמשתמש שואל "
            "על המצב שלו או כשאתה צריך להבין את ההקשר האסטרטגי שלו."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_match_info",
        "description": (
            "מחזיר מידע על משחק ספציפי: קבוצות, זמן משחק, דירוג FIFA, סטטוס "
            "(טרם החל/חי/הסתיים), תוצאה אם הסתיים."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "match_id": {"type": "integer", "description": "ID של המשחק (1-104)"}
            },
            "required": ["match_id"],
        },
    },
    {
        "name": "search_matches",
        "description": (
            "מחפש משחקים לפי שם קבוצה או שלב. החזר רשימת משחקים עם ID. "
            "השתמש כשהמשתמש מזכיר משחק בשם הקבוצות ('ברזיל ארגנטינה')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "team_name": {"type": "string", "description": "שם קבוצה (חלקי, באנגלית)"},
                "stage": {
                    "type": "string",
                    "enum": ["group", "r32", "r16", "qf", "sf", "third_place", "final"],
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_user_prediction",
        "description": "מחזיר את הניחוש של המשתמש למשחק ספציפי (אם קיים).",
        "input_schema": {
            "type": "object",
            "properties": {"match_id": {"type": "integer"}},
            "required": ["match_id"],
        },
    },
    {
        "name": "get_other_predictions",
        "description": (
            "מחזיר איך משתמשים אחרים בקבוצת המשחק ניחשו משחק. "
            "⚠️ עובד רק עבור משחקים שנעולים או הסתיימו. אחרת מחזיר שגיאה."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"match_id": {"type": "integer"}},
            "required": ["match_id"],
        },
    },
    {
        "name": "get_leaderboard",
        "description": (
            "מחזיר את טבלת הדירוג של המשחק (game) של המשתמש - 5 ראשונים + הסביבה שלו. "
            "לא מציג משתמשים ממשחקים אחרים."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_double_down_status",
        "description": "מחזיר סטטוס מלא של 8 ז'יטוני Double Down של המשתמש.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_match_stats",
        "description": (
            "מחזיר סטטיסטיקות עומק על משחק: צורת קבוצות אחרונה, מפגשי גומלין. "
            "נתונים מ-ESPN (אם זמינים) ומסד הנתונים."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"match_id": {"type": "integer"}},
            "required": ["match_id"],
        },
    },
    # NOTE: get_scoring_rules הוסר ב-2026-06-18 — החוקים עכשיו inline ב-SYSTEM_PROMPT
    # כדי שהסוכן יראה אותם כל פנייה ויענה בלי tool hop. ראה prompts.py.
]


# ----------------------------------------------------------------
# Dispatcher
# ----------------------------------------------------------------

def execute_tool(name: str, tool_input: dict, user_id: str, game_id: str | None) -> str:
    """
    מבצע קריאה לכלי ומחזיר מחרוזת (Claude יראה את התוצאה כ-tool_result).

    user_id ו-game_id חייבים להגיע מ-get_current_user (session JWT) — לעולם לא מ-client.
    """
    handlers = {
        "get_user_status": _get_user_status,
        "get_match_info": _get_match_info,
        "search_matches": _search_matches,
        "get_user_prediction": _get_user_prediction,
        "get_other_predictions": _get_other_predictions,
        "get_leaderboard": _get_leaderboard,
        "get_double_down_status": _get_double_down_status,
        "get_match_stats": _get_match_stats,
    }
    handler = handlers.get(name)
    if not handler:
        return f"שגיאה: כלי לא מוכר '{name}'"
    try:
        return handler(tool_input, user_id, game_id)
    except Exception as e:  # noqa: BLE001
        return f"שגיאה בקריאת הכלי {name}: {str(e)}"


# ----------------------------------------------------------------
# Handlers — all sync, all filtered by user_id (and game_id if relevant)
# ----------------------------------------------------------------

def _get_user_status(_input: dict, user_id: str, game_id: str | None) -> str:
    score_res = (
        supabase_admin.table("scores")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not score_res or not score_res.data:
        return "המשתמש עדיין לא צבר נקודות."
    score = score_res.data

    # rank scoped to user's game only
    rank = None
    leader_pts = 0
    gap_from_next = 0
    if game_id:
        members = (
            supabase_admin.table("users")
            .select("id")
            .eq("game_id", game_id)
            .execute()
        ).data or []
        member_ids = [m["id"] for m in members]
        if member_ids:
            ranked = (
                supabase_admin.table("scores")
                .select("user_id,total_points")
                .in_("user_id", member_ids)
                .order("total_points", desc=True)
                .execute()
            ).data or []
            for idx, r in enumerate(ranked, start=1):
                if r["user_id"] == user_id:
                    rank = idx
                    if idx > 1:
                        gap_from_next = ranked[idx - 2]["total_points"] - r["total_points"]
                    break
            leader_pts = ranked[0]["total_points"] if ranked else 0

    dd_count = (
        supabase_admin.table("double_down_tokens")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("status", "available")
        .execute()
    ).count or 0

    gap_from_leader = leader_pts - score["total_points"]
    correct = score.get("correct_count", 0)
    total = score.get("total_predictions", 0)

    lines = [
        f"מצב המשתמש (במסגרת הקבוצה הפרטית שלו):",
        f"- מיקום: {rank if rank else '—'}",
        f"- ניקוד כולל: {score['total_points']} נק'",
        f"- פער מהראשון: {gap_from_leader} נק'",
        f"- פער מהמיקום שמעליי: {gap_from_next} נק'" if rank and rank > 1 else "- במקום הראשון!",
        f"- ז'יטוני Double Down זמינים: {dd_count}/8",
        f"- ניחושים נכונים: {correct}/{total}",
    ]
    return "\n".join(lines)


def _get_match_info(input_: dict, user_id: str, game_id: str | None) -> str:
    match_id = input_["match_id"]
    res = (
        supabase_admin.table("matches")
        .select("*")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        return f"לא נמצא משחק עם ID {match_id}."
    m = res.data
    lines = [
        f"משחק #{m['id']}:",
        f"- {m['team_home']} (FIFA {m.get('team_home_fifa_rank') or 'N/A'}) "
        f"מול {m['team_away']} (FIFA {m.get('team_away_fifa_rank') or 'N/A'})",
        f"- שלב: {m['stage']}" + (f" (בית {m['group_name']}, מחזור {m.get('group_round') or '?'})" if m.get("group_name") else ""),
        f"- זמן: {m['kickoff_utc']}",
        f"- סטטוס: {m['status']}",
    ]
    if m["status"] == "finished":
        score = f"{m['score_home']}-{m['score_away']}"
        if m.get("score_home_pen") is not None:
            score += f" (פנדלים {m['score_home_pen']}-{m['score_away_pen']})"
        lines.append(f"- תוצאה: {score}")
    lines.append(
        "- ⚠️ משחק נעול - מותר לחשוף ניחושי אחרים"
        if m.get("predictions_locked") else
        "- 🔒 משחק עדיין פתוח לניחוש - אסור לחשוף ניחושים של אחרים"
    )
    return "\n".join(lines)


def _search_matches(input_: dict, user_id: str, game_id: str | None) -> str:
    query = supabase_admin.table("matches").select("id,team_home,team_away,stage,status,kickoff_utc")
    if "team_name" in input_ and input_["team_name"]:
        team = input_["team_name"]
        query = query.or_(f"team_home.ilike.%{team}%,team_away.ilike.%{team}%")
    if "stage" in input_ and input_["stage"]:
        query = query.eq("stage", input_["stage"])
    matches = query.order("kickoff_utc").limit(10).execute().data or []
    if not matches:
        return "לא נמצאו משחקים תואמים."
    return "\n".join(
        f"#{m['id']}: {m['team_home']} vs {m['team_away']} ({m['stage']}, {m['status']})"
        for m in matches
    )


def _get_user_prediction(input_: dict, user_id: str, game_id: str | None) -> str:
    pred = (
        supabase_admin.table("predictions_matches")
        .select("direction,score_home,score_away,points_earned")
        .eq("user_id", user_id)
        .eq("match_id", input_["match_id"])
        .execute()
    ).data or []
    if not pred:
        return "המשתמש עדיין לא ניחש את המשחק הזה."
    p = pred[0]
    parts = [f"ניחוש: כיוון {p['direction']}"]
    if p.get("score_home") is not None:
        parts.append(f"תוצאה {p['score_home']}-{p['score_away']}")
    if p.get("points_earned") is not None:
        parts.append(f"הרוויח {p['points_earned']} נק'")
    return ", ".join(parts) + "."


def _get_other_predictions(input_: dict, user_id: str, game_id: str | None) -> str:
    if not game_id:
        return "המשתמש לא במשחק קבוצתי - אין למי להשוות."
    match_id = input_["match_id"]

    match = (
        supabase_admin.table("matches")
        .select("predictions_locked,status,team_home,team_away")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not match or not match.data:
        return "משחק לא נמצא."

    if not match.data["predictions_locked"] and match.data["status"] != "finished":
        return (
            "⛔ המשחק עדיין פתוח לניחוש - אסור לחשוף ניחושים של משתמשים אחרים. "
            "החזר תשובה למשתמש שתסביר שהוא יוכל לראות את זה אחרי שהמשחק יינעל."
        )

    # רק חברי המשחק (game) של המשתמש — לא חברים ממשחקים אחרים
    members = (
        supabase_admin.table("users")
        .select("id,username")
        .eq("game_id", game_id)
        .execute()
    ).data or []
    member_ids = [m["id"] for m in members if m["id"] != user_id]
    if not member_ids:
        return "אין משתתפים אחרים במשחק שלך."

    preds = (
        supabase_admin.table("predictions_matches")
        .select("user_id,direction,score_home,score_away")
        .eq("match_id", match_id)
        .in_("user_id", member_ids)
        .execute()
    ).data or []
    if not preds:
        return "אף אחד מהאחרים בקבוצה לא ניחש את המשחק."

    counts = {"1": 0, "X": 0, "2": 0}
    for p in preds:
        if p["direction"] in counts:
            counts[p["direction"]] += 1
    majority = max(counts, key=counts.get)

    home = match.data["team_home"]
    away = match.data["team_away"]
    return (
        f"{len(preds)} חברים בקבוצה ניחשו: "
        f"{counts['1']} בית ({home}), "
        f"{counts['X']} תיקו, "
        f"{counts['2']} חוץ ({away}). "
        f"רוב מנחש: {majority}."
    )


def _get_leaderboard(_input: dict, user_id: str, game_id: str | None) -> str:
    if not game_id:
        return "המשתמש לא במשחק קבוצתי."

    # שולפים רק חברי המשחק (game) של המשתמש
    members = (
        supabase_admin.table("users")
        .select("id,username")
        .eq("game_id", game_id)
        .execute()
    ).data or []
    if not members:
        return "אין משתתפים במשחק."
    users_by_id = {m["id"]: m["username"] for m in members}

    scores = (
        supabase_admin.table("scores")
        .select("user_id,total_points")
        .in_("user_id", list(users_by_id.keys()))
        .order("total_points", desc=True)
        .execute()
    ).data or []
    if not scores:
        return "אין עדיין דירוג בקבוצה שלך."

    lines = ["🏆 טבלת הדירוג (קבוצה שלך):"]
    for i, s in enumerate(scores[:5], 1):
        uname = users_by_id.get(s["user_id"], "?")
        lines.append(f"{i}. {uname}: {s['total_points']} נק'")

    user_idx = next((i for i, s in enumerate(scores) if s["user_id"] == user_id), None)
    if user_idx is not None and user_idx >= 5:
        start = max(5, user_idx - 2)
        end = min(len(scores), user_idx + 3)
        lines.append("...")
        for i in range(start, end):
            s = scores[i]
            uname = users_by_id.get(s["user_id"], "?")
            marker = " ← אתה" if s["user_id"] == user_id else ""
            lines.append(f"{i + 1}. {uname}: {s['total_points']} נק'{marker}")

    return "\n".join(lines)


def _get_double_down_status(_input: dict, user_id: str, game_id: str | None) -> str:
    tokens = (
        supabase_admin.table("double_down_tokens")
        .select("status,points_earned,round_key")
        .eq("user_id", user_id)
        .execute()
    ).data or []
    if not tokens:
        return "המשתמש לא רשום למערכת Double Down."

    available = [t for t in tokens if t["status"] == "available"]
    active = [t for t in tokens if t["status"] == "active"]
    used = [t for t in tokens if t["status"] == "used"]
    lost = [t for t in tokens if t["status"] == "lost"]
    total_pts = sum((t.get("points_earned") or 0) for t in used)

    lines = [
        f"ז'יטוני Double Down (מתוך 8):",
        f"- זמינים: {len(available)}",
        f"- פעילים על משחק כעת: {len(active)}",
        f"- מומשו: {len(used)} (סה\"כ {total_pts} נק' בונוס)",
        f"- אבדו: {len(lost)}",
    ]
    return "\n".join(lines)


def _get_match_stats(input_: dict, user_id: str, game_id: str | None) -> str:
    match_id = input_["match_id"]
    match_res = (
        supabase_admin.table("matches")
        .select("team_home,team_away,team_home_fifa_rank,team_away_fifa_rank")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    if not match_res or not match_res.data:
        return "משחק לא נמצא."
    m = match_res.data
    lines = [
        f"סטטיסטיקות {m['team_home']} מול {m['team_away']}:",
        f"- דירוג FIFA: {m.get('team_home_fifa_rank') or 'N/A'} מול {m.get('team_away_fifa_rank') or 'N/A'}",
    ]

    cache = (
        supabase_admin.table("match_stats_cache")
        .select("h2h_summary,home_form,away_form")
        .eq("match_id", match_id)
        .maybe_single()
        .execute()
    )
    if cache and cache.data:
        c = cache.data
        if c.get("h2h_summary"):
            lines.append(f"- מפגשים אחרונים: {c['h2h_summary']}")
        if c.get("home_form"):
            lines.append(f"- צורת {m['team_home']} (5 משחקים אחרונים): {c['home_form']}")
        if c.get("away_form"):
            lines.append(f"- צורת {m['team_away']} (5 משחקים אחרונים): {c['away_form']}")
    else:
        lines.append("- נתונים סטטיסטיים נוספים לא זמינים כרגע.")

    return "\n".join(lines)


def _get_scoring_rules(input_: dict, user_id: str, game_id: str | None) -> str:
    from app.core import constants as c

    cat = (input_.get("category") or "all").lower()

    sections: dict[str, str] = {
        "group_match": (
            "ניקוד משחקי בתים:\n"
            f"- כיוון נכון: {c.GROUP_MATCH_DIRECTION} נק'\n"
            f"- תוצאה מדויקת: {c.GROUP_MATCH_EXACT_TOTAL} נק' סה\"כ (לא בונוס נוסף!)\n"
            f"- בונוס תיקו נכון: +{c.GROUP_DRAW_BONUS}"
        ),
        "group_standings": (
            f"ניקוד טבלת בית: {c.GROUP_POSITION_POINTS} נק' לכל מיקום נכון "
            f"(מתוך 4) + בונוס {c.GROUP_PERFECT_BONUS} אם כל הטבלה מדויקת."
        ),
        "knockout": (
            "ניקוד פלייאוף (כיוון לפי 90 דקות בלבד, פנדלים לא משפיעים על ניקוד המשחק):\n"
            + "\n".join(
                f"- {stage}: {pts['winner']} נק' כיוון, +{pts['exact_bonus']} בונוס מדויק"
                for stage, pts in c.KNOCKOUT_POINTS.items()
            )
        ),
        "final": (
            f"ניקוד הגמר (כמו שאר משחקי פלייאוף):\n"
            f"- {c.KNOCKOUT_POINTS['final']['winner']} נק' על ניחוש כיוון נכון\n"
            f"- בונוס תוצאה מדויקת: +{c.KNOCKOUT_POINTS['final']['exact_bonus']}\n"
            f"- מקסימום: 100 נק' (× 2 אם משתמשים ב-Double Down)"
        ),
        "longterm": (
            f"ניחושי טווח-ארוך (לפני הטורניר):\n"
            f"- אלופה: {c.LONGTERM_CHAMPION} נק'\n"
            f"- 2 פיינליסטיות: {c.LONGTERM_BOTH_FINALISTS} / אחת בלבד: {c.LONGTERM_ONE_FINALIST}\n"
            f"- חצי-גמרניות: {c.LONGTERM_SEMIFINALIST_EACH} לכל אחת + {c.LONGTERM_ALL_4_SEMIFINALISTS_BONUS} בונוס לכל 4 נכון\n"
            f"- מלך שערים: {c.LONGTERM_TOP_SCORER}\n"
            f"- מלך בישולים: {c.LONGTERM_TOP_ASSISTER}\n"
            f"- כדור הזהב: {c.LONGTERM_GOLDEN_BALL}"
        ),
        "double_down": (
            "Double Down: 8 ז'יטונים סה\"כ (3 לבתים, 5 לפלייאוף).\n"
            f"מפעילים על משחק → הניקוד שלו מוכפל ב-{c.DOUBLE_DOWN_MULTIPLIER}.\n"
            "חובה להפעיל לפני שהמשחק נסגר. אם לא משתמשים - הז'יטון אבוד."
        ),
    }

    if cat == "all":
        return "\n\n".join(sections.values())
    return sections.get(cat, "קטגוריה לא ידועה. אפשרויות: group_match, group_standings, knockout, final, longterm, double_down, all.")
