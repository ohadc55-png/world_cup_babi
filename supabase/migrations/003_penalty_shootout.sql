-- ============================================
-- Penalty shootout support — 2026-05-23
-- ============================================
-- בפלייאוף משחק יכול להסתיים בפנדלים. אנחנו שומרים:
--   score_home / score_away         = תוצאת זמן רגיל (כולל הארכה אם הייתה)
--   score_home_pen / score_away_pen = תוצאת הפנדלים (NULL אם אין שערים מהנקודה הלבנה)
--
-- הצגה ב-frontend: "2(5)" — תוצאה רגילה + סוגריים עם פנדלים.
-- לוגיקת ניקוד: כיוון = מי שעבר הלאה (כולל פנדלים); exact bonus = זמן רגיל.

alter table matches add column if not exists score_home_pen integer
    check (score_home_pen is null or (score_home_pen >= 0 and score_home_pen <= 30));
alter table matches add column if not exists score_away_pen integer
    check (score_away_pen is null or (score_away_pen >= 0 and score_away_pen <= 30));
