-- Isolated staging only: none of these objects are in public nor grant client access.
create schema if not exists crilo_badge_prelaunch;
revoke all on schema crilo_badge_prelaunch from public, anon, authenticated;
create table if not exists crilo_badge_prelaunch.definitions(
 badge_key text primary key,
 name text not null,
 category text not null,
 rarity text not null check(rarity in ('Trash','Common','Uncommon','Rare','Epic','Anomaly','Mythic')),
 description text not null,
 rule jsonb not null,
 eligibility_checked boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists crilo_badge_prelaunch.qa_awards(
 user_id uuid not null,
 badge_key text not null references crilo_badge_prelaunch.definitions(badge_key),
 run_id bigint,
 event_name text,
 earned_at timestamptz not null default now(),
 primary key(user_id,badge_key)
);
create table if not exists crilo_badge_prelaunch.qa_events(
 user_id uuid not null,
 event_name text not null,
 occurred_at timestamptz not null default now(),
 primary key(user_id,event_name)
);
revoke all on all tables in schema crilo_badge_prelaunch from public, anon, authenticated;
comment on schema crilo_badge_prelaunch is 'Unreleased 346-badge certification only. No live user award triggers. No public permissions.';