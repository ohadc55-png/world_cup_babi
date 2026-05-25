"""
מערכת ניקוד למונדיאל 2026 — Single Source of Truth.

המקור הסמכותי לכל קבועי הניקוד בפרויקט. רק `scoring.py` משתמש בקבועים אלה
לחישוב; הקליינט (frontend) מציג נתונים מוכנים מהשרת ואסור לו לחשב.

עדכון 2026-05-24:
- הוסר Underdog bonus (גם לבתים וגם לפלייאוף).
- ניקוד פלייאוף שונה (R32→Final).
- הגמר הפך למשחק רגיל (winner+exact) במקום חישוב מיוחד מבוסס finalist picks.
"""
from typing import Literal


# ============================================
# Type aliases
# ============================================
Direction = Literal["1", "X", "2"]
Stage = Literal["group", "r32", "r16", "qf", "sf", "third_place", "final"]
RoundKey = Literal[
    "group_r1", "group_r2", "group_r3",
    "r32", "r16", "qf", "sf", "final",
]


# ============================================
# שלב הבתים — משחקים
# ============================================
GROUP_MATCH_DIRECTION = 3       # ניחוש כיוון נכון (1/X/2)
GROUP_MATCH_EXACT_TOTAL = 6     # תוצאה מדויקת — סה"כ (לא בונוס נוסף!)
GROUP_DRAW_BONUS = 1            # בונוס על ניחוש תיקו נכון
# הוסר GROUP_UNDERDOG_BONUS — לפי בקשת המשתמש 2026-05-24

# ============================================
# שלב הבתים — טבלת סיום
# כל מיקום שווה את אותו ערך — פשוט והוגן.
# ============================================
GROUP_POSITION_POINTS = 5       # 5 נק' לכל מיקום נכון (1, 2, 3, או 4)
GROUP_PERFECT_BONUS = 10        # בונוס אם כל 4 המיקומים נכונים

# ============================================
# פלייאוף — 6 שלבים (כולל Final הפעם)
# ============================================
KNOCKOUT_POINTS: dict[str, dict[str, int]] = {
    "r32":         {"winner": 10, "exact_bonus": 5},
    "r16":         {"winner": 15, "exact_bonus": 8},
    "qf":          {"winner": 25, "exact_bonus": 10},
    "sf":          {"winner": 35, "exact_bonus": 15},
    "third_place": {"winner": 35, "exact_bonus": 15},
    "final":       {"winner": 50, "exact_bonus": 50},
}
# הוסר KNOCKOUT_UNDERDOG_BONUS — לפי בקשת המשתמש 2026-05-24

# ============================================
# ניחושי טווח-ארוך (לפני המונדיאל)
# ============================================
LONGTERM_CHAMPION = 100                 # אלופת המונדיאל

# פיינליסטיות — אסימטרי:
#   0 נכון = 0
#   1 נכון = 40
#   2 נכון = 100 (= 50 לכל אחת)
LONGTERM_BOTH_FINALISTS = 100
LONGTERM_ONE_FINALIST = 40

# חצי-גמרניות:
#   20 נק' לכל קבוצה נכונה (מקסימום 4×20 = 80)
#   +20 בונוס נוסף אם כל 4 נכון = 100 מקס'
LONGTERM_SEMIFINALIST_EACH = 20
LONGTERM_ALL_4_SEMIFINALISTS_BONUS = 20

LONGTERM_TOP_SCORER = 70                # מלך שערים
LONGTERM_TOP_ASSISTER = 70              # מלך בישולים
LONGTERM_GOLDEN_BALL = 70               # כדור הזהב (שחקן הטורניר)

# ============================================
# Double Down
# 8 ז'יטונים סה"כ — אחד לכל מחזור/שלב.
# הניקוד של המשחק הנבחר מוכפל ב-2 (כולל בונוסים).
# ============================================
DOUBLE_DOWN_MULTIPLIER = 2

# מיפוי round_key → מטא-דאטה
# הז'יטון 'final' תקף גם לגמר וגם למקומות 3-4 (בחירת המשתמש, אך לא לשניהם).
DOUBLE_DOWN_ROUNDS: dict[str, dict] = {
    "group_r1": {"stages": ["group"], "group_round": 1, "label_he": "מחזור בתים 1"},
    "group_r2": {"stages": ["group"], "group_round": 2, "label_he": "מחזור בתים 2"},
    "group_r3": {"stages": ["group"], "group_round": 3, "label_he": "מחזור בתים 3"},
    "r32":      {"stages": ["r32"],                     "label_he": "סבב 32"},
    "r16":      {"stages": ["r16"],                     "label_he": "שמינית גמר"},
    "qf":       {"stages": ["qf"],                      "label_he": "רבע גמר"},
    "sf":       {"stages": ["sf"],                      "label_he": "חצי גמר"},
    "final":    {"stages": ["final", "third_place"],    "label_he": "גמר / מקומות 3-4"},
}

# רשימת ה-round_keys (לבדיקות ולאיניציאליזציה של משתמש חדש)
ROUND_KEYS: tuple[str, ...] = tuple(DOUBLE_DOWN_ROUNDS.keys())

# ============================================
# מיפוי שלב לעברית (לתצוגה ב-frontend אם צריך)
# ============================================
STAGE_NAMES_HE: dict[str, str] = {
    "group":       "שלב הבתים",
    "r32":         "סבב 32",
    "r16":         "שמינית גמר",
    "qf":          "רבע גמר",
    "sf":          "חצי גמר",
    "third_place": "מקומות 3-4",
    "final":       "גמר",
}
