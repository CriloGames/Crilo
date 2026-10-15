-- 2026-10-14: Owner profile statistics and badge awards must never include Test Runs.
-- Preserve all official Daily rows and every legitimately earned official badge.
-- Replay-safe: source-of-truth is daily_runs.is_test = false.
begin;

-- The cached-stat fallback used by profile.js now also derives OWNER values
-- from authoritative official Dailies. Other players keep existing RPC behavior.
create or replace function public.get_crilo_player_stats(target_user uuid)
 returns table(
 user_id uuid,official_runs integer,best_score bigint,average_score numeric,
 current_streak integer,longest_streak integer,total_spins bigint,total_numbers bigint,
 total_doubles bigint,total_upgrades bigint,total_extra_spins bigint,total_ducks bigint,
 best_roll_points bigint,best_roll_label text,rarest_odds numeric,rarest_label text,
 best_daily_rank integer,daily_wins integer,podium_finishes integer,top_10_finishes integer
 )
 language sql stable security definer set search_path to ''
as $function$
with owner_current as (
 select p.id as owner_id, public.crilo_profile_metrics(p.id) as m,
  (select coalesce(sum(d.numbers_landed),0)::bigint from public.daily_runs d
   where d.user_id=p.id and d.is_test=false) as official_numbers,
  (select d.best_roll_label from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.best_roll_points desc nulls last,d.created_at asc,d.id asc limit 1) as official_roll_label,
  (select d.rarity_odds from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.rarity_odds desc nulls last,d.created_at asc,d.id asc limit 1) as official_rarest_odds,
  (select d.rarity_label from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.rarity_odds desc nulls last,d.created_at asc,d.id asc limit 1) as official_rarest_label
 from public.profiles p where p.id=target_user and p.is_owner=true
)
select s.user_id,
 case when o.owner_id is not null then (o.m->>'official_runs')::integer else s.official_runs end,
 case when o.owner_id is not null then (o.m->>'best_score')::bigint else s.best_score end,
 case when o.owner_id is not null then (o.m->>'average_score')::numeric
      when s.official_runs>0 then round(s.total_score/s.official_runs,2) else 0 end,
 case when o.owner_id is not null then (o.m->>'current_streak')::integer else s.current_streak end,
 case when o.owner_id is not null then (o.m->>'longest_streak')::integer else s.longest_streak end,
 case when o.owner_id is not null then (o.m->>'total_spins')::bigint else s.total_spins end,
 case when o.owner_id is not null then o.official_numbers else s.total_numbers end,
 case when o.owner_id is not null then (o.m->>'total_doubles')::bigint else s.total_doubles end,
 case when o.owner_id is not null then (o.m->>'total_upgrades')::bigint else s.total_upgrades end,
 case when o.owner_id is not null then (o.m->>'total_extra_spins')::bigint else s.total_extra_spins end,
 case when o.owner_id is not null then (o.m->>'total_ducks')::bigint else s.total_ducks end,
 case when o.owner_id is not null then (o.m->>'best_roll_points')::bigint else s.best_roll_points end,
 case when o.owner_id is not null then o.official_roll_label else s.best_roll_label end,
 case when o.owner_id is not null then o.official_rarest_odds else s.rarest_odds end,
 case when o.owner_id is not null then o.official_rarest_label else s.rarest_label end,
 case when o.owner_id is not null then (o.m->>'best_daily_rank')::integer else s.best_daily_rank end,
 case when o.owner_id is not null then (o.m->>'daily_wins')::integer else s.daily_wins end,
 case when o.owner_id is not null then (o.m->>'podium_finishes')::integer else s.podium_finishes end,
 case when o.owner_id is not null then (o.m->>'top_10_finishes')::integer else s.top_10_finishes end
from public.player_stats s
left join owner_current o on o.owner_id=s.user_id
where s.user_id=target_user;
$function$;

-- Drop any provably Test Run linked owner badges (none existed at audit time).
-- Do not discard grandfathered awards attached to official Dailies.
delete from public.featured_badges f
where exists(
 select 1 from public.profiles p join public.user_badges ub
   on ub.user_id=p.id and ub.badge_id=f.badge_id
 join public.daily_runs d on d.id=ub.run_id
 where p.is_owner=true and f.user_id=p.id and d.is_test=true
);
delete from public.user_badges ub
using public.profiles p,public.daily_runs d
where p.id=ub.user_id and p.is_owner=true
 and d.id=ub.run_id and d.is_test=true;

-- Rebuild cached owner stats from official Dailies, including streaks, ranks,
-- scores and individual wheel outcomes. Do not edit/delete any Daily runs.
with owner_truth as (
 select p.id as owner_id,public.crilo_profile_metrics(p.id) m,
  (select coalesce(sum(d.numbers_landed),0)::bigint from public.daily_runs d
   where d.user_id=p.id and d.is_test=false) official_numbers,
  (select d.best_roll_label from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.best_roll_points desc nulls last,d.created_at asc,d.id asc limit 1) official_roll_label,
  (select d.rarity_odds from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.rarity_odds desc nulls last,d.created_at asc,d.id asc limit 1) official_rarest_odds,
  (select d.rarity_label from public.daily_runs d
   where d.user_id=p.id and d.is_test=false
   order by d.rarity_odds desc nulls last,d.created_at asc,d.id asc limit 1) official_rarest_label
 from public.profiles p where p.is_owner=true
)
update public.player_stats s set
 official_runs=(o.m->>'official_runs')::integer,
 best_score=(o.m->>'best_score')::bigint,
 total_score=(o.m->>'total_points')::numeric,
 current_streak=(o.m->>'current_streak')::integer,
 longest_streak=(o.m->>'longest_streak')::integer,
 total_spins=(o.m->>'total_spins')::bigint,
 total_numbers=o.official_numbers,
 total_doubles=(o.m->>'total_doubles')::bigint,
 total_upgrades=(o.m->>'total_upgrades')::bigint,
 total_extra_spins=(o.m->>'total_extra_spins')::bigint,
 total_ducks=(o.m->>'total_ducks')::bigint,
 best_roll_points=(o.m->>'best_roll_points')::bigint,
 best_roll_label=o.official_roll_label,
 rarest_odds=o.official_rarest_odds,
 rarest_label=o.official_rarest_label,
 best_daily_rank=(o.m->>'best_daily_rank')::integer,
 daily_wins=(o.m->>'daily_wins')::integer,
 podium_finishes=(o.m->>'podium_finishes')::integer,
 top_10_finishes=(o.m->>'top_10_finishes')::integer,
 updated_at=now()
from owner_truth o where s.user_id=o.owner_id;
commit;
