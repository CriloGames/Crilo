-- Run once in Supabase SQL Editor. Owner-only, isolated test leaderboard data.
-- Does not touch official daily_runs or previously earned badges.
create table if not exists public.owner_test_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 daily_period date not null default ((now() at time zone 'utc' - interval '22 hours')::date),
 score bigint not null default 0,
 spins integer not null default 0,
 upgrades integer not null default 0,
 doubles integer not null default 0,
 ducks integer not null default 0,
 drawing text,
 rarity_label text,
 rarity_odds bigint,
 created_at timestamptz not null default now()
);
create index if not exists owner_test_runs_user_created_idx on public.owner_test_runs(user_id,created_at desc);
alter table public.owner_test_runs enable row level security;
revoke all on public.owner_test_runs from anon,authenticated;
-- All access is through SECURITY DEFINER functions which verify the owner server-side.
create or replace function public.crilo_owner_test_runs()
returns setof public.owner_test_runs language sql stable security definer
set search_path=public as $$
 select r.* from public.owner_test_runs r
 where r.user_id=auth.uid()
   and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_owner=true)
 order by r.created_at desc limit 200;
$$;
create or replace function public.crilo_save_owner_test_run(p_run jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_owner=true)
 then raise exception 'Owner access required'; end if;
 insert into public.owner_test_runs(user_id,daily_period,score,spins,upgrades,doubles,ducks,drawing,rarity_label,rarity_odds)
 values(auth.uid(),(now() at time zone 'utc' - interval '22 hours')::date,
 greatest(0,least(9223372036854775807::numeric,coalesce((p_run->>'score')::numeric,0)))::bigint,
 greatest(0,least(250,coalesce((p_run->>'spins')::integer,0))),
 greatest(0,coalesce((p_run->>'upgrades')::integer,0)),
 greatest(0,coalesce((p_run->>'doubles')::integer,0)),
 greatest(0,coalesce((p_run->>'ducks')::integer,0)),
 left(p_run->>'drawing',1000000),
 left(p_run->>'rarity_label',32),
 greatest(0,coalesce((p_run->>'rarity_odds')::bigint,0)))
 returning id into new_id;
 return new_id;
end;
$$;
create or replace function public.crilo_delete_owner_test_runs(p_ids uuid[])
returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_owner=true)
 then raise exception 'Owner access required'; end if;
 delete from public.owner_test_runs where user_id=auth.uid() and id=any(p_ids);
 get diagnostics removed=row_count;
 return removed;
end;
$$;
revoke all on function public.crilo_owner_test_runs() from public;
revoke all on function public.crilo_save_owner_test_run(jsonb) from public;
revoke all on function public.crilo_delete_owner_test_runs(uuid[]) from public;
grant execute on function public.crilo_owner_test_runs() to authenticated;
grant execute on function public.crilo_save_owner_test_run(jsonb) to authenticated;
grant execute on function public.crilo_delete_owner_test_runs(uuid[]) to authenticated;
