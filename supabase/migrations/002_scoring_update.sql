-- ============================================
-- Scoring System Update — 2026-05-23
-- ============================================
-- מסמך עדכון הניקוד הוסיף 3 פיצ'רים (Double Down, Underdog, Semifinalists)
-- ותיקן את מבנה השלבים ל-7 (כולל מקומות 3-4).
--
-- כל ה-ALTER משתמשים ב-IF NOT EXISTS כדי שהמיגרציה תהיה safe לרוץ פעמיים.

-- ============================================
-- 1. תיקון matches.stage: הוספת 'third_place'
-- ============================================
alter table matches drop constraint if exists matches_stage_check;
alter table matches add constraint matches_stage_check
    check (stage in ('group','r32','r16','qf','sf','third_place','final'));

-- ============================================
-- 2. FIFA ranks ל-matches (לבונוס underdog)
-- ============================================
alter table matches add column if not exists team_home_fifa_rank integer;
alter table matches add column if not exists team_away_fifa_rank integer;

-- ============================================
-- 3. group_round ל-matches (לוגיקת Double Down: מחזור 1/2/3)
-- ============================================
alter table matches add column if not exists group_round integer
    check (group_round is null or group_round in (1, 2, 3));

-- ============================================
-- 4. טבלת double_down_tokens (חדשה)
-- ============================================
create table if not exists double_down_tokens (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users(id) on delete cascade,
    round_key     text not null check (round_key in ('group_r1','group_r2','group_r3','r32','r16','qf','sf','final')),
    match_id      integer references matches(id) on delete set null,
    status        text not null default 'available' check (status in ('available','active','used')),
    points_earned integer,
    activated_at  timestamptz,
    finalized_at  timestamptz,
    created_at    timestamptz not null default now(),
    unique (user_id, round_key)
);
create index if not exists idx_dd_tokens_user  on double_down_tokens(user_id);
create index if not exists idx_dd_tokens_match on double_down_tokens(match_id) where match_id is not null;

-- ============================================
-- 5. semifinalists ל-predictions_tournament
-- ============================================
alter table predictions_tournament add column if not exists semifinalist_1 text;
alter table predictions_tournament add column if not exists semifinalist_2 text;
alter table predictions_tournament add column if not exists semifinalist_3 text;
alter table predictions_tournament add column if not exists semifinalist_4 text;

-- ============================================
-- 6. points_earned + points_breakdown בכל טבלאות הניחושים
-- ============================================
alter table predictions_matches    add column if not exists points_earned integer;
alter table predictions_matches    add column if not exists points_breakdown jsonb;
alter table predictions_groups     add column if not exists points_earned integer;
alter table predictions_groups     add column if not exists points_breakdown jsonb;
alter table predictions_tournament add column if not exists points_earned integer;
alter table predictions_tournament add column if not exists points_breakdown jsonb;

-- ============================================
-- 7. double_down_pts ל-scores
-- ============================================
alter table scores add column if not exists double_down_pts integer not null default 0;

-- ============================================
-- 8. Backfill: 8 DD tokens לכל משתמש קיים
--    (idempotent — UNIQUE constraint ימנע כפילות)
-- ============================================
insert into double_down_tokens (user_id, round_key, status)
select u.id, rk.round_key, 'available'
from users u
cross join (
    values ('group_r1'), ('group_r2'), ('group_r3'),
           ('r32'), ('r16'), ('qf'), ('sf'), ('final')
) as rk(round_key)
on conflict (user_id, round_key) do nothing;
