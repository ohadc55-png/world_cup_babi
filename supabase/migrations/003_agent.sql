-- ============================================
-- AI Agent (Phase 8) — 2026-05-25
-- ============================================
-- מוסיף 3 טבלאות:
--   1. agent_conversations — שיחה אחת קבועה לכל משתמש (UNIQUE)
--   2. agent_messages       — היסטוריית ההודעות בכל שיחה
--   3. match_stats_cache    — cache לסטטיסטיקות עומק מ-ESPN
--
-- בלי RLS — תואם לשאר הטבלאות בפרויקט (filtering נעשה ב-backend).
-- כל המיגרציה safe לרוץ פעמיים בזכות IF NOT EXISTS.

-- ============================================
-- 1. agent_conversations — שיחה אחת קבועה לכל משתמש
-- ============================================
create table if not exists agent_conversations (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users(id) on delete cascade,
    started_at      timestamptz not null default now(),
    last_message_at timestamptz not null default now(),
    message_count   integer not null default 0,
    unique (user_id)  -- מבטיח שיחה אחת בלבד לכל משתמש (קריטי להפרדת משתמשים)
);

create index if not exists idx_agent_conv_user on agent_conversations(user_id);

-- ============================================
-- 2. agent_messages — הודעות בשיחה
-- ============================================
create table if not exists agent_messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references agent_conversations(id) on delete cascade,
    role            text not null check (role in ('user', 'assistant')),
    content         text not null,
    tool_calls      jsonb,  -- audit trail של קריאות לכלים שהסוכן ביצע (אופציונלי)
    created_at      timestamptz not null default now()
);

create index if not exists idx_agent_msg_conv on agent_messages(conversation_id, created_at);

-- ============================================
-- 3. match_stats_cache — סטטיסטיקות עומק (ESPN) לכל משחק
-- ============================================
create table if not exists match_stats_cache (
    match_id     integer primary key references matches(id) on delete cascade,
    h2h_summary  text,        -- סיכום מפגשי גומלין
    home_form    text,        -- צורת קבוצת הבית ב-5 משחקים אחרונים
    away_form    text,        -- צורת קבוצת החוץ ב-5 משחקים אחרונים
    raw_data     jsonb,       -- ה-payload המלא מ-ESPN לדיבוג
    updated_at   timestamptz not null default now()
);
