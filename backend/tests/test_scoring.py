"""
בדיקות יחידה ל-services/scoring.py — table-driven.

עדכון 2026-05-24:
- הוסרו כל הבדיקות של Underdog (לא קיים יותר במערכת).
- ערכי הפלייאוף עודכנו (R32: 10+5, R16: 15+8, QF: 25+10, SF: 35+15, Third: 35+15, Final: 50+50).
- score_final_match הוסר; הגמר מטופל ע"י score_knockout_match.

הרצה:
    cd backend
    conda run -n my_conda python -m pytest tests/test_scoring.py -v
"""
from __future__ import annotations

import pytest

from app.services.scoring import (
    TournamentActuals,
    compute_direction,
    compute_knockout_advancer,
    score_group_match,
    score_group_standings,
    score_knockout_match,
    score_tournament_predictions,
    _normalize_player,
)


# ============================================================
# compute_direction
# ============================================================

@pytest.mark.parametrize("home,away,expected", [
    (2, 1, "1"),
    (0, 3, "2"),
    (1, 1, "X"),
    (0, 0, "X"),
    (5, 5, "X"),
    (7, 0, "1"),
])
def test_compute_direction(home, away, expected):
    assert compute_direction(home, away) == expected


# ============================================================
# score_group_match
# ============================================================

@pytest.mark.parametrize(
    "pred_dir,pred_h,pred_a,actual_h,actual_a,expected_pts,reason",
    [
        # === כיוון שגוי ===
        ("1", 2, 1, 0, 2, 0, "wrong direction (predicted 1, actual 2)"),
        ("X", 1, 1, 2, 0, 0, "wrong direction (predicted X, actual 1)"),
        ("2", 0, 3, 3, 0, 0, "wrong direction (predicted 2, actual 1)"),

        # === כיוון נכון, לא מדויק ===
        ("1", 2, 1, 3, 0, 3, "direction only (1)"),
        ("2", 0, 2, 1, 4, 3, "direction only (2)"),

        # === כיוון נכון + exact ===
        ("1", 2, 1, 2, 1, 6, "exact 1 (total 6, no extra)"),
        ("2", 0, 3, 0, 3, 6, "exact 2"),

        # === תיקו נכון, לא exact ===
        ("X", 1, 1, 0, 0, 4, "draw direction + draw bonus = 3+1"),
        ("X", 2, 2, 1, 1, 4, "draw direction + draw bonus"),

        # === תיקו נכון + exact ===
        ("X", 0, 0, 0, 0, 7, "exact draw = 6 + 1 bonus"),
        ("X", 1, 1, 1, 1, 7, "exact draw 1-1"),

        # === pred_h/pred_a כ-None (רק direction) ===
        ("1", None, None, 2, 0, 3, "direction only, no score guessed"),
        ("X", None, None, 0, 0, 4, "X direction + draw bonus, no score"),
    ],
)
def test_score_group_match(
    pred_dir, pred_h, pred_a, actual_h, actual_a, expected_pts, reason
):
    pts, _ = score_group_match(pred_dir, pred_h, pred_a, actual_h, actual_a)
    assert pts == expected_pts, f"Failed: {reason} → got {pts} expected {expected_pts}"


def test_score_group_match_breakdown_structure():
    """breakdown מכיל רק את המפתחות שאכן נצברו."""
    pts, b = score_group_match("X", 1, 1, 1, 1)
    assert b == {"direction": 3, "exact_uplift": 3, "draw_bonus": 1}
    assert pts == 7

    pts, b = score_group_match("1", 1, 0, 1, 0)
    assert b == {"direction": 3, "exact_uplift": 3}
    assert pts == 6


# ============================================================
# score_knockout_match — לכל 6 השלבים
# ערכי הניקוד (winner + exact_bonus):
#   r32: 10 + 5      → max 15
#   r16: 15 + 8      → max 23
#   qf:  25 + 10     → max 35
#   sf:  35 + 15     → max 50
#   third: 35 + 15   → max 50
#   final: 50 + 50   → max 100
# ============================================================

KNOCKOUT_CASES = [
    # === R32 (10 + 5) ===
    ("r32", "1", 1, 0, 1, 0, 15, "R32 exact: 10+5"),
    ("r32", "1", 2, 0, 1, 0, 10, "R32 direction only"),
    ("r32", "2", 1, 0, 1, 0, 0,  "R32 wrong direction"),

    # === R16 (15 + 8) ===
    ("r16", "1", 2, 1, 2, 1, 23, "R16 exact: 15+8"),
    ("r16", "2", 0, 3, 0, 3, 23, "R16 exact 2"),
    ("r16", "1", 3, 0, 4, 1, 15, "R16 direction only"),
    ("r16", "2", 1, 0, 0, 1, 15, "R16 direction only (2)"),

    # === QF (25 + 10) ===
    ("qf", "1", 1, 0, 1, 0, 35, "QF exact: 25+10"),
    ("qf", "1", 1, 0, 2, 1, 25, "QF direction only"),

    # === SF (35 + 15) ===
    ("sf", "2", 0, 1, 0, 1, 50, "SF exact: 35+15"),
    ("sf", "1", 2, 0, 3, 1, 35, "SF direction only"),

    # === Third place (35 + 15) ===
    ("third_place", "1", 2, 1, 2, 1, 50, "3rd-place exact: 35+15"),
    ("third_place", "1", 1, 0, 3, 0, 35, "3rd-place direction only"),
    ("third_place", "2", 0, 1, 0, 1, 50, "3rd-place exact (2)"),

    # === Final (50 + 50) ===
    ("final", "1", 2, 1, 2, 1, 100, "Final exact: 50+50"),
    ("final", "1", 1, 0, 2, 1, 50,  "Final direction only"),
    ("final", "2", 0, 3, 0, 3, 100, "Final exact 0-3"),
    ("final", "1", 2, 1, 0, 2, 0,   "Final wrong direction"),
]


@pytest.mark.parametrize(
    "stage,pred_dir,pred_h,pred_a,actual_h,actual_a,expected_pts,reason",
    KNOCKOUT_CASES,
)
def test_score_knockout_match(
    stage, pred_dir, pred_h, pred_a, actual_h, actual_a, expected_pts, reason
):
    pts, _ = score_knockout_match(
        pred_dir, pred_h, pred_a, actual_h, actual_a, stage
    )
    assert pts == expected_pts, f"Failed: {reason} → got {pts} expected {expected_pts}"


def test_score_knockout_rejects_group():
    with pytest.raises(ValueError, match="group"):
        score_knockout_match("1", 1, 0, 1, 0, "group")


def test_score_knockout_accepts_final_now():
    """אחרי השינוי 2026-05-24 - Final הוא knockout רגיל."""
    pts, _ = score_knockout_match("1", 2, 1, 2, 1, "final")
    assert pts == 100  # 50 winner + 50 exact


# ============================================================
# compute_knockout_advancer (פנדלים)
# ============================================================

@pytest.mark.parametrize("h,a,hp,ap,expected,reason", [
    # תוצאה רגילה
    (2, 1, None, None, "1", "home wins regular time"),
    (0, 3, None, None, "2", "away wins regular time"),
    (5, 0, None, None, "1", "blowout home"),
    # תיקו + פנדלים
    (1, 1, 4, 3, "1", "draw, home wins on pens"),
    (2, 2, 4, 5, "2", "draw, away wins on pens"),
    (0, 0, 3, 5, "2", "0-0, away wins on pens 5-3"),
    (3, 3, 6, 4, "1", "high-scoring draw, home on pens"),
])
def test_compute_knockout_advancer(h, a, hp, ap, expected, reason):
    assert compute_knockout_advancer(h, a, hp, ap) == expected, reason


def test_compute_knockout_advancer_draw_no_pens_raises():
    with pytest.raises(ValueError, match="no penalty data"):
        compute_knockout_advancer(1, 1)
    with pytest.raises(ValueError, match="no penalty data"):
        compute_knockout_advancer(1, 1, None, 5)
    with pytest.raises(ValueError, match="no penalty data"):
        compute_knockout_advancer(1, 1, 5, None)


def test_compute_knockout_advancer_pen_draw_raises():
    """פנדלים נמשכים עד שיש מנצח - תיקו בפנדלים זה bug בנתונים."""
    with pytest.raises(ValueError, match="impossible"):
        compute_knockout_advancer(1, 1, 4, 4)


# ============================================================
# Penalty shootout — score_knockout_match cases
# דוגמה: USA 2(4) vs Brazil 2(5) - זמן רגיל 2-2, פנדלים 4-5, Brazil עברה
# ============================================================

@pytest.mark.parametrize("stage,pred_dir,pred_h,pred_a,ah,aa,hp,ap,expected,reason", [
    # R32 (10 + 5) + penalties
    ("r32", "2", 2, 2, 2, 2, 4, 5, 15, "R32 pred=2 exact=2-2, away wins pens: 10+5"),
    ("r32", "1", 2, 2, 2, 2, 5, 4, 15, "R32 pred=1 exact=2-2, home wins pens"),
    ("r32", "1", 1, 0, 1, 1, 4, 3, 10, "R32 pred=1 wrong score, home wins on pens: 10 only"),
    ("r32", "2", 1, 0, 1, 1, 3, 4, 10, "R32 pred=2 wrong score, away wins on pens"),
    ("r32", "1", 2, 2, 2, 2, 4, 5, 0,  "R32 pred=1 but away won on pens"),

    # SF (35 + 15) + penalties
    ("sf", "1", 1, 1, 1, 1, 5, 3, 50, "SF pred=1 exact=1-1, home wins pens: 35+15"),
    ("sf", "2", 0, 0, 0, 0, 3, 5, 50, "SF pred=2 exact=0-0, away wins pens"),

    # Final (50 + 50) + penalties
    ("final", "1", 2, 2, 2, 2, 5, 3, 100, "Final pred=1 exact=2-2, home wins pens: 50+50"),
    ("final", "2", 1, 1, 1, 1, 3, 5, 100, "Final pred=2 exact=1-1, away wins pens: 50+50"),
    ("final", "1", 3, 2, 1, 1, 5, 3, 50,  "Final pred=1 wrong score, home wins pens: 50"),

    # Third place (35 + 15) + penalties
    ("third_place", "1", 1, 1, 1, 1, 4, 2, 50, "3rd place exact 1-1 + pens: 35+15"),
])
def test_score_knockout_with_penalties(
    stage, pred_dir, pred_h, pred_a, ah, aa, hp, ap, expected, reason
):
    pts, _ = score_knockout_match(
        pred_dir, pred_h, pred_a, ah, aa, stage,
        actual_home_pen=hp, actual_away_pen=ap,
    )
    assert pts == expected, f"Failed: {reason} → got {pts} expected {expected}"


def test_score_knockout_draw_without_pens_raises():
    """Knockout match with regular-time draw + no penalty scores = data error."""
    with pytest.raises(ValueError, match="no penalty"):
        score_knockout_match("1", 1, 1, 1, 1, stage="r32")


# ============================================================
# score_group_standings — 0/1/2/3/4 positions correct
# ============================================================

@pytest.mark.parametrize(
    "p1,p2,p3,p4,a1,a2,a3,a4,expected,reason",
    [
        # perfect
        ("A","B","C","D", "A","B","C","D", 30, "perfect: 4×5 + 10 bonus"),
        # 3 correct
        ("A","B","C","X", "A","B","C","D", 15, "3 correct, no bonus"),
        ("A","B","X","D", "A","B","C","D", 15, "3 correct (3rd wrong)"),
        # 2 correct
        ("A","B","X","Y", "A","B","C","D", 10, "2 correct"),
        ("A","X","C","Y", "A","B","C","D", 10, "1st + 3rd correct"),
        # 1 correct
        ("A","X","Y","Z", "A","B","C","D", 5,  "only 1st correct"),
        ("X","B","Y","Z", "A","B","C","D", 5,  "only 2nd correct"),
        # 0 correct
        ("X","Y","Z","W", "A","B","C","D", 0,  "none correct"),
        # swapped (must be in exact position!)
        ("B","A","D","C", "A","B","C","D", 0,  "swapped pairs = 0"),
    ],
)
def test_score_group_standings(p1, p2, p3, p4, a1, a2, a3, a4, expected, reason):
    pts, _ = score_group_standings(p1, p2, p3, p4, a1, a2, a3, a4)
    assert pts == expected, f"Failed: {reason} → got {pts} expected {expected}"


# ============================================================
# score_tournament_predictions — long-term picks
# ============================================================

def _actuals(**overrides):
    base = {
        "champion": "Argentina",
        "finalists": ("Argentina", "Brazil"),
        "semifinalists": ("Argentina", "Brazil", "France", "Spain"),
        "top_scorer": "Lionel Messi",
        "top_assister": "Kevin De Bruyne",
        "golden_ball": "Lionel Messi",
    }
    base.update(overrides)
    return TournamentActuals(**base)


def test_tournament_perfect_score():
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner="Argentina",
        pred_finalist_1="Argentina",
        pred_finalist_2="Brazil",
        pred_semifinalist_1="Argentina",
        pred_semifinalist_2="Brazil",
        pred_semifinalist_3="France",
        pred_semifinalist_4="Spain",
        pred_top_scorer="Lionel Messi",
        pred_top_assister="Kevin De Bruyne",
        pred_golden_ball="Lionel Messi",
        actuals=actuals,
    )
    # 100 + 100 + (4×20 + 20) + 70 + 70 + 70 = 510
    assert pts == 510
    assert b["champion"] == 100
    assert b["both_finalists"] == 100
    assert b["semifinalists_each"] == 80
    assert b["all_4_semifinalists_bonus"] == 20
    assert b["top_scorer"] == 70


def test_tournament_one_finalist_only():
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1="Argentina",
        pred_finalist_2="Germany",  # not in actual final
        pred_semifinalist_1=None, pred_semifinalist_2=None,
        pred_semifinalist_3=None, pred_semifinalist_4=None,
        pred_top_scorer=None, pred_top_assister=None, pred_golden_ball=None,
        actuals=actuals,
    )
    assert pts == 40
    assert b == {"one_finalist": 40}


def test_tournament_partial_semis_get_per_team():
    """3/4 semis correct → 60 pts (3×20), no bonus."""
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1=None, pred_finalist_2=None,
        pred_semifinalist_1="Argentina",
        pred_semifinalist_2="Brazil",
        pred_semifinalist_3="France",
        pred_semifinalist_4="Germany",  # 3/4 correct
        pred_top_scorer=None, pred_top_assister=None, pred_golden_ball=None,
        actuals=actuals,
    )
    assert pts == 60
    assert b == {"semifinalists_each": 60}


def test_tournament_only_one_semi_correct():
    """1/4 semis correct → 20 pts, no bonus."""
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1=None, pred_finalist_2=None,
        pred_semifinalist_1="Argentina",  # only this one correct
        pred_semifinalist_2="Germany",
        pred_semifinalist_3="Italy",
        pred_semifinalist_4="Netherlands",
        pred_top_scorer=None, pred_top_assister=None, pred_golden_ball=None,
        actuals=actuals,
    )
    assert pts == 20
    assert b == {"semifinalists_each": 20}


def test_tournament_all_4_semis_correct():
    """4/4 → 4×20 + 20 bonus = 100."""
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1=None, pred_finalist_2=None,
        pred_semifinalist_1="Spain",
        pred_semifinalist_2="France",
        pred_semifinalist_3="Argentina",
        pred_semifinalist_4="Brazil",  # all 4 correct (order doesn't matter)
        pred_top_scorer=None, pred_top_assister=None, pred_golden_ball=None,
        actuals=actuals,
    )
    assert pts == 100
    assert b == {"semifinalists_each": 80, "all_4_semifinalists_bonus": 20}


def test_tournament_player_name_normalization():
    actuals = _actuals()
    pts, _ = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1=None, pred_finalist_2=None,
        pred_semifinalist_1=None, pred_semifinalist_2=None,
        pred_semifinalist_3=None, pred_semifinalist_4=None,
        pred_top_scorer="  LIONEL  messi ",
        pred_top_assister=None,
        pred_golden_ball="lionel messi",
        actuals=actuals,
    )
    assert pts == 140  # top_scorer + golden_ball


def test_tournament_duplicate_finalist_pick():
    """אם המשתמש בחר את אותה קבוצה פעמיים — סופרים פעם אחת."""
    actuals = _actuals()
    pts, b = score_tournament_predictions(
        pred_winner=None,
        pred_finalist_1="Argentina",
        pred_finalist_2="Argentina",  # same pick twice
        pred_semifinalist_1=None, pred_semifinalist_2=None,
        pred_semifinalist_3=None, pred_semifinalist_4=None,
        pred_top_scorer=None, pred_top_assister=None, pred_golden_ball=None,
        actuals=actuals,
    )
    assert pts == 40  # one finalist only (counted once)
    assert b == {"one_finalist": 40}


def test_normalize_player_helper():
    assert _normalize_player("Lionel Messi") == _normalize_player("LIONEL MESSI")
    assert _normalize_player("  De  Bruyne ") == "de bruyne"
    assert _normalize_player("Mbappé") != _normalize_player("Mbappe")  # accents matter


# ============================================================
# Bounds invariants
# ============================================================

@pytest.mark.parametrize("pred_h,pred_a,actual_h,actual_a", [
    (h, a, ah, aa)
    for h in range(0, 6)
    for a in range(0, 6)
    for ah in range(0, 6)
    for aa in range(0, 6)
])
def test_group_match_bounds(pred_h, pred_a, actual_h, actual_a):
    """כל ניקוד שלב הבתים חייב להיות בטווח [0, 7]."""
    direction = compute_direction(pred_h, pred_a)
    pts, _ = score_group_match(direction, pred_h, pred_a, actual_h, actual_a)
    assert 0 <= pts <= 7, f"out of range: {pts}"


@pytest.mark.parametrize("stage,max_pts", [
    ("r32", 15),         # 10+5
    ("r16", 23),         # 15+8
    ("qf", 35),          # 25+10
    ("sf", 50),          # 35+15
    ("third_place", 50), # 35+15
    ("final", 100),      # 50+50
])
def test_knockout_match_bounds(stage, max_pts):
    """תקרה לכל שלב פלייאוף."""
    pts, _ = score_knockout_match("1", 2, 1, 2, 1, stage)
    assert pts == max_pts
