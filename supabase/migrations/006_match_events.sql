-- ============================================
-- Match events — goals + red cards from ESPN — 2026-06-13
-- ============================================
-- מקור: ESPN summary endpoint (header.competitions[0].details[] לשערים,
-- keyEvents[] לכרטיסים אדומים). מאוכלס ע"י crons/sync_results.py
-- בכל מחזור (כל 2 דקות) — שערי לייב מופיעים תוך 2-3 דק'.
--
-- team='home'/'away' (לא team_name) כי בפלייאוף שמות הקבוצות יכולים להחליף;
-- side יציבה.

create table if not exists match_events (
    id                uuid primary key default gen_random_uuid(),
    match_id          integer not null references matches(id) on delete cascade,
    event_type        text not null check (event_type in ('goal', 'red_card')),
    minute            text not null,                       -- "21'", "45+2'", "90+5'"
    minute_value      integer not null,                    -- לסידור: 21, 45 (זמן נוסף נחתך)
    team              text not null check (team in ('home', 'away')),
    primary_player    text not null,                       -- משער או מקבל כרטיס
    primary_player_id text,                                -- ESPN athlete id
    assister          text,                                -- רק לשערים
    assister_id       text,
    is_penalty        boolean not null default false,
    is_own_goal       boolean not null default false,
    espn_event_id     text not null,                       -- ESPN id (string)
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    unique (match_id, espn_event_id)
);
create index if not exists idx_match_events_match on match_events(match_id, minute_value);
