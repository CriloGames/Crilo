-- Crilo: public leaderboard includes saved owner test runs; owner can moderate any score.
-- Run ONCE in Supabase SQL Editor. Does not change official Daily limits or badges.
-- Existing saved owner test runs become visible in public rankings.
create or replace function public.crilo_public_owner_runs()
returns table(id uuid,user_id uuid,daily_period date,score bigint,spins integer,upgrades integer,doubles integer,ducks integer,drawing text,rarity_label text,rarity_odds bigint,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.user_id,r.daily_period,r.score,r.spins,r.upgrades,r.doubles,r.ducks,r.drawing,r.rarity_label,r.rarity_odds,r.created_at
 from public.owner_test_runs r
 join public.profiles p on p.id=r.user_id and p.is_owner=true
 order by r.created_at desc limit 2000;
$$;
-- IDs are UUIDs; require an explicit run source to avoid deleting the wrong table.
create or replace function public.crilo_owner_moderate_run(p_id uuid,p_source text)
returns boolean language plpgsql security definer set search_path=public as $$
declare deleted_count integer;
begin
 if auth.uid() is null or not exists(
   select 1 from public.profiles where id=auth.uid() and is_owner=true
 ) then raise exception 'Owner access required'; end if;
 if p_source='test' then
   delete from public.owner_test_runs where id=p_id;
 elsif p_source='official' then
   delete from public.daily_runs where id=p_id;
 else
   raise exception 'Invalid run source';
 end if;
 get diagnostics deleted_count=row_count;
 return deleted_count=1;
end;
$$;
revoke all on function public.crilo_public_owner_runs() from public;
revoke all on function public.crilo_owner_moderate_run(uuid,text) from public;
grant execute on function public.crilo_public_owner_runs() to anon,authenticated;
grant execute on function public.crilo_owner_moderate_run(uuid,text) to authenticated;
