-- Five Fronts: invite-only 2–6 player rooms. All writes are trusted Edge Function writes.
-- Neither anonymous visitors nor signed-in clients can alter match data.
create table if not exists public.ff_live_rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
 host_id uuid not null references auth.users(id) on delete cascade,
 capacity smallint not null check (capacity between 2 and 6),
 fast boolean not null default false,
 status text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
 game jsonb,
 revision bigint not null default 0 check (revision >= 0),
 tick_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.ff_live_players (
 room_id uuid not null references public.ff_live_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 seat smallint not null check (seat between 0 and 5),
 display_name text not null check (char_length(display_name) between 1 and 24),
 joined_at timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 primary key(room_id,user_id),
 unique(room_id,seat)
);
create index if not exists ff_live_rooms_host_idx on public.ff_live_rooms(host_id,created_at desc);
create index if not exists ff_live_players_user_idx on public.ff_live_players(user_id,joined_at desc);
alter table public.ff_live_rooms enable row level security;
alter table public.ff_live_players enable row level security;
revoke all on public.ff_live_rooms,public.ff_live_players from anon,authenticated;
grant select on public.ff_live_rooms,public.ff_live_players to authenticated;
drop policy if exists "ff_room_member_read" on public.ff_live_rooms;
create policy "ff_room_member_read" on public.ff_live_rooms for select to authenticated
 using (exists (
  select 1 from public.ff_live_players p
  where p.room_id=ff_live_rooms.id and p.user_id=(select auth.uid())
 ));
drop policy if exists "ff_player_self_read" on public.ff_live_players;
create policy "ff_player_self_read" on public.ff_live_players for select to authenticated
 using (user_id=(select auth.uid()));
-- Realtime subscriptions only reveal a room to authenticated members;
-- Edge Functions use the service role to perform every state mutation.
do $$
begin
 if not exists (select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='ff_live_rooms') then
  alter publication supabase_realtime add table public.ff_live_rooms;
 end if;
end $$;