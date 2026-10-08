-- Crilo: make extra owner runs PRIVATE again.
-- Run in Supabase SQL Editor. This replaces the previously public RPC.
-- Official daily_runs remain public and unchanged.
create or replace function public.crilo_public_owner_runs()
returns table(id uuid,user_id uuid,daily_period date,score bigint,spins integer,upgrades integer,doubles integer,ducks integer,drawing text,rarity_label text,rarity_odds bigint,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.user_id,r.daily_period,r.score,r.spins,r.upgrades,r.doubles,r.ducks,r.drawing,r.rarity_label,r.rarity_odds,r.created_at
 from public.owner_test_runs r
 where r.user_id=auth.uid()
   and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_owner=true)
 order by r.created_at desc limit 2000;
$$;
-- Defense in depth: unauthenticated visitors cannot execute this function.
revoke execute on function public.crilo_public_owner_runs() from public,anon;
grant execute on function public.crilo_public_owner_runs() to authenticated;
-- Saved owner test runs still cannot be selected directly through table RLS.
