-- ============================================
-- Tournament top athletes — מלך שערים + מלך בישולים — 2026-06-13
-- ============================================
-- מקור: ESPN statistics endpoint (goalsLeaders + assistsLeaders).
-- מאוכלס ע"י crons/sync_player_stats.py כל שעה.
-- delete-and-replace pattern (rank=1..10 לכל קטגוריה).
--
-- 20 שורות בלבד סה"כ (10 לכל קטגוריה). שומרים top 10 לפי בקשת המשתמש.

create table if not exists tournament_top_athletes (
    category      text not null check (category in ('top_scorers', 'top_assisters')),
    rank          integer not null check (rank between 1 and 10),
    player_name   text not null,
    player_id     text,                -- ESPN athlete id
    team_name     text,                -- שם הקבוצה לפי ESPN (לזיהוי דגל ב-frontend)
    matches       integer not null default 0,
    value         integer not null,    -- goals או assists
    display_value text,                -- "Matches: 1, Goals: 1"
    updated_at    timestamptz not null default now(),
    primary key (category, rank)
);
