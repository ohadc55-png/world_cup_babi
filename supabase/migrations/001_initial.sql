-- ============================================
-- Mundial 2026 — Initial Schema
-- ============================================
-- All tables from the spec + score_events for audit trail.
-- RLS policies will be added in migration 002 (Phase 7).

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================
-- users
-- ============================================
create table if not exists users (
    id          uuid primary key default gen_random_uuid(),
    username    text unique not null,
    avatar_url  text,
    pin_hash    text not null,
    is_admin    boolean not null default false,
    created_at  timestamptz not null default now(),
    last_seen   timestamptz
);

-- ============================================
-- invite_codes
-- ============================================
create table if not exists invite_codes (
    code         text primary key,
    max_uses     integer not null default 50,
    current_uses integer not null default 0,
    created_at   timestamptz not null default now(),
    expires_at   timestamptz
);

-- ============================================
-- push_subscriptions
-- ============================================
create table if not exists push_subscriptions (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references users(id) on delete cascade,
    endpoint           text unique not null,
    p256dh_key         text not null,
    auth_key           text not null,
    user_agent         text,
    notification_prefs jsonb not null default '{"reminder":true,"result":true,"overtaken":true,"kickoff":false,"weekly":true,"stage":true}'::jsonb,
    created_at         timestamptz not null default now(),
    last_used          timestamptz
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

-- ============================================
-- matches
-- ============================================
create table if not exists matches (
    id                 integer primary key,
    stage              text not null check (stage in ('group','r32','r16','qf','sf','final')),
    group_name         text,
    match_number       integer,
    team_home          text not null,
    team_away          text not null,
    team_home_flag     text,
    team_away_flag     text,
    kickoff_utc        timestamptz not null,
    venue              text,
    status             text not null default 'scheduled' check (status in ('scheduled','live','finished','postponed','cancelled')),
    score_home         integer,
    score_away         integer,
    score_home_ht      integer,
    score_away_ht      integer,
    finished_at        timestamptz,
    external_id        text,
    predictions_locked boolean not null default false,
    updated_at         timestamptz not null default now()
);
create index if not exists idx_matches_kickoff on matches(kickoff_utc);
create index if not exists idx_matches_stage on matches(stage);
create index if not exists idx_matches_status on matches(status);

-- ============================================
-- predictions_tournament  (one row per user)
-- ============================================
create table if not exists predictions_tournament (
    user_id      uuid primary key references users(id) on delete cascade,
    winner       text,
    finalist_1   text,
    finalist_2   text,
    top_scorer   text,
    top_assister text,
    golden_ball  text,
    locked_at    timestamptz,
    updated_at   timestamptz not null default now()
);

-- ============================================
-- predictions_groups  (12 rows per user, one per group A..L)
-- ============================================
create table if not exists predictions_groups (
    user_id    uuid references users(id) on delete cascade,
    group_name text,
    team_1st   text not null,
    team_2nd   text not null,
    team_3rd   text not null,
    team_4th   text not null,
    locked_at  timestamptz,
    updated_at timestamptz not null default now(),
    primary key (user_id, group_name)
);

-- ============================================
-- predictions_matches
-- ============================================
create table if not exists predictions_matches (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(id) on delete cascade,
    match_id    integer not null references matches(id) on delete cascade,
    direction   text not null check (direction in ('1','X','2')),
    score_home  integer check (score_home is null or (score_home >= 0 and score_home <= 15)),
    score_away  integer check (score_away is null or (score_away >= 0 and score_away <= 15)),
    locked_at   timestamptz,
    updated_at  timestamptz not null default now(),
    unique (user_id, match_id)
);
create index if not exists idx_predictions_matches_match on predictions_matches(match_id);
create index if not exists idx_predictions_matches_user on predictions_matches(user_id);

-- ============================================
-- scores  (aggregated; source of truth for display)
-- ============================================
create table if not exists scores (
    user_id           uuid primary key references users(id) on delete cascade,
    total_points      integer not null default 0,
    group_stage_pts   integer not null default 0,
    knockout_pts      integer not null default 0,
    awards_pts        integer not null default 0,
    correct_count     integer not null default 0,
    total_predictions integer not null default 0,
    current_rank      integer,
    previous_rank     integer,
    last_calculated   timestamptz not null default now()
);
create index if not exists idx_scores_total on scores(total_points desc);

-- ============================================
-- score_events  (audit trail — every point traced)
-- ============================================
create table if not exists score_events (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references users(id) on delete cascade,
    source_type text not null,
    source_ref  text not null,
    points      integer not null,
    reason      text,
    computed_at timestamptz not null default now(),
    computed_by text not null default 'scoring_engine_v1',
    unique (user_id, source_type, source_ref)
);
create index if not exists idx_score_events_user on score_events(user_id);

-- ============================================
-- reactions  (likes + comments on feed items)
-- ============================================
create table if not exists reactions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users(id) on delete cascade,
    target_type   text not null,
    target_id     text not null,
    reaction_type text not null check (reaction_type in ('like','comment')),
    content       text,
    created_at    timestamptz not null default now()
);
create index if not exists idx_reactions_target on reactions(target_type, target_id);

-- ============================================
-- notifications_log
-- ============================================
create table if not exists notifications_log (
    id       uuid primary key default gen_random_uuid(),
    user_id  uuid not null references users(id) on delete cascade,
    type     text not null,
    title    text,
    body     text,
    sent_at  timestamptz not null default now(),
    read_at  timestamptz,
    metadata jsonb
);
create index if not exists idx_notifications_user on notifications_log(user_id, sent_at desc);

-- ============================================
-- app_config  (key-value config: demo mode state, etc.)
-- ============================================
create table if not exists app_config (
    key        text primary key,
    value      jsonb not null,
    updated_at timestamptz not null default now()
);

-- ============================================
-- Seed: default invite code MUNDIAL2026
-- ============================================
insert into invite_codes (code, max_uses, current_uses)
values ('MUNDIAL2026', 50, 0)
on conflict (code) do nothing;
