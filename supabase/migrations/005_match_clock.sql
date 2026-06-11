-- ============================================
-- Live match clock — 2026-06-11
-- ============================================
-- מאפשר להציג את הדקה הנוכחית של משחק חי (למשל "67'", "45+2'", "HT", "ET 105'").
-- הערך מגיע מ-ESPN דרך השדה displayClock ונשמר על-ידי הקרון sync_results
-- (כל 2 דקות במצב production).
--
-- NULL אם המשחק עוד לא התחיל או נגמר.

alter table matches add column if not exists display_clock text;
