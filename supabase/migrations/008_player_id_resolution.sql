-- ============================================
-- Player ID resolution for tournament predictions — 2026-06-13
-- ============================================
-- מאפשר מיפוי טקסטים חופשיים של top_scorer / top_assister לזהות יציבה של
-- ESPN. בסוף הטורניר השוואה מול ESPN's #1 scorer/assister תהיה אוטומטית
-- ולא תלויה במחרוזת.
--
-- NULL = עוד לא נפתר ידנית. ה-text המקורי נשאר ב-top_scorer/top_assister
-- כדי להציג למשתמש מה הוא הזין.

alter table predictions_tournament
    add column if not exists top_scorer_player_id   text,
    add column if not exists top_scorer_canonical   text,
    add column if not exists top_assister_player_id text,
    add column if not exists top_assister_canonical text;

create index if not exists idx_pt_top_scorer_pid   on predictions_tournament(top_scorer_player_id);
create index if not exists idx_pt_top_assister_pid on predictions_tournament(top_assister_player_id);
