-- ============================================
-- Multi-Game Model — 2026-05-23
-- ============================================
-- שינוי מודל: במקום "טורניר אחד גלובלי" → כל משתמש נמצא ב"משחק" אחד.
-- כל משחק הוא קבוצת חברים פרטית עם invite_code משלה ולוח-תוצאות משלה.
--
-- המשחקים חולקים את אותו מאגר fixtures (matches table) — כי כולם מנחשים
-- את אותו מונדיאל. הסקופ הוא רק על הניחושים והניקוד.
--
-- שינויים:
--   1. games table חדש
--   2. users.game_id — null = משתמש בלי משחק עדיין (אחרי register, לפני join/create)
--   3. invite_codes — נמחק (הוחלף ב-games.invite_code)

-- ============================================
-- 1. games
-- ============================================
create table if not exists games (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    invite_code   text not null unique,
    owner_user_id uuid not null references users(id) on delete cascade,
    created_at    timestamptz not null default now()
);
create index if not exists idx_games_invite_code on games(invite_code);
create index if not exists idx_games_owner on games(owner_user_id);

-- ============================================
-- 2. users.game_id
-- ============================================
alter table users add column if not exists game_id uuid references games(id) on delete set null;
create index if not exists idx_users_game on users(game_id);

-- ============================================
-- 3. invite_codes — לא נחוץ יותר (נשמר כרגע למקרה rollback, נמחק ידנית בעתיד)
-- ============================================
-- drop table if exists invite_codes;  -- מבוטל לבטיחות, נמחק ידנית אחרי בדיקה
