-- Crilo profile metrics + featured badges. Run in Supabase SQL Editor.
-- All statistics use OFFICIAL daily_runs only; private owner extra runs are excluded.
-- Ranks are per Daily period, with tied scores sharing the same rank.
create or replace function public.crilo_profile_metrics(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with official as (
 select user_id,daily_period,score,spins,upgrades,doubles,ducks,extra_spins,best_roll_points
 from public.daily_runs where is_test=false
), my as (
 select * from official where user_id=p_user
), ranks as (
 select user_id,daily_period,score,
 dense_rank() over(partition by daily_period order by score desc) as place
 from official
), myr as (
 select place from ranks where user_id=p_user
), dates as (
 select distinct daily_period from my
), numbered as (
 select daily_period, daily_period - (row_number() over(order by daily_period))::int as grp from dates
), streaks as (
 select grp,min(daily_period) as first_day,max(daily_period) as last_day,count(*)::int as days
 from numbered group by grp
), summary as (
 select count(*)::int as official_runs,coalesce(max(score),0) as best_score,
 coalesce(round(avg(score),2),0) as average_score,
 coalesce(sum(spins),0) as total_spins,coalesce(sum(upgrades),0) as total_upgrades,
 coalesce(sum(doubles),0) as total_doubles,coalesce(sum(ducks),0) as total_ducks,
 coalesce(sum(extra_spins),0) as total_extra_spins,
 coalesce(max(best_roll_points),0) as best_roll_points
 from my
)
select jsonb_build_object(
 'official_runs',summary.official_runs,'best_score',summary.best_score,
 'average_score',summary.average_score,'total_spins',summary.total_spins,
 'total_upgrades',summary.total_upgrades,'total_doubles',summary.total_doubles,
 'total_ducks',summary.total_ducks,'total_extra_spins',summary.total_extra_spins,
 'best_roll_points',summary.best_roll_points,
 'best_daily_rank',(select min(place) from myr),
 'daily_wins',(select count(*) from myr where place=1),
 'podium_finishes',(select count(*) from myr where place<=3),
 'top_10_finishes',(select count(*) from myr where place<=10),
 'longest_streak',coalesce((select max(days) from streaks),0),
 'current_streak',coalesce((select days from streaks
 where last_day >= ((now() at time zone 'UTC') - interval '22 hours')::date - 1
 order by last_day desc limit 1),0)
) from summary;
$$;
revoke all on function public.crilo_profile_metrics(uuid) from public;
grant execute on function public.crilo_profile_metrics(uuid) to anon,authenticated;

-- Users may feature only badges they personally earned. 5 positions maximum.
create or replace function public.crilo_set_featured_badge(p_position integer,p_badge_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_position not between 1 and 5 then raise exception 'Invalid slot'; end if;
 if p_badge_id is not null and not exists(
  select 1 from public.user_badges where user_id=auth.uid() and badge_id=p_badge_id
 ) then raise exception 'You have not earned this badge'; end if;
 delete from public.featured_badges where user_id=auth.uid() and
 (position=p_position or (p_badge_id is not null and badge_id=p_badge_id));
 if p_badge_id is not null then
  insert into public.featured_badges(user_id,badge_id,position)
  values(auth.uid(),p_badge_id,p_position);
 end if;
end;
$$;
revoke all on function public.crilo_set_featured_badge(integer,uuid) from public;
grant execute on function public.crilo_set_featured_badge(integer,uuid) to authenticated;
