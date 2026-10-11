-- Privacy-friendly aggregate analytics: no IPs, cookies, client IDs, or UAs.
-- Client events are approximate and can be spoofed. Wheel completions are server-backed.
create table if not exists public.crilo_site_daily_metrics (
 day date not null,
 metric text not null check(metric in ('daily_visitor','guest_start','guest_complete','share_result')),
 events integer not null default 0 check(events between 0 and 20000),
 primary key (day,metric)
);
alter table public.crilo_site_daily_metrics enable row level security;
revoke all on public.crilo_site_daily_metrics from public,anon,authenticated;

create or replace function public.crilo_track_site_metric(p_metric text)
returns boolean language plpgsql security definer set search_path to ''
as $metric$
declare today date:=((clock_timestamp() at time zone 'UTC')-interval '22 hours')::date;
begin
 if p_metric is null or p_metric not in ('daily_visitor','guest_start','guest_complete','share_result') then return false;end if;
 insert into public.crilo_site_daily_metrics(day,metric,events)
 values(today,p_metric,1)
 on conflict(day,metric) do update
 set events=public.crilo_site_daily_metrics.events+1
 where public.crilo_site_daily_metrics.events<20000;
 return found;
end;
$metric$;
revoke all on function public.crilo_track_site_metric(text) from public,anon,authenticated;
grant execute on function public.crilo_track_site_metric(text) to anon,authenticated,service_role;

create or replace function public.crilo_owner_growth_report(p_days integer default 30)
returns table (
 day date,daily_visitors bigint,guest_starts bigint,guest_completions bigint,
 result_shares bigint,verified_sessions bigint,official_completions bigint,
 returning_players bigint,new_accounts bigint
) language plpgsql stable security definer set search_path to ''
as $report$
begin
 if auth.uid() is null or not exists (
   select 1 from public.profiles p join auth.users u on u.id=p.id
   where p.id=auth.uid() and p.is_owner is true
   and u.is_anonymous is false and u.email_confirmed_at is not null
   and (u.banned_until is null or u.banned_until<=clock_timestamp())
 ) or exists (select 1 from public.crilo_banned_accounts where user_id=auth.uid()) then
  raise exception 'Owner account required' using errcode='42501';
 end if;
 return query
 with calendar as (
  select gs::date as d from generate_series(
   ((clock_timestamp() at time zone 'UTC')-interval '22 hours')::date-least(greatest(coalesce(p_days,30),1),90)+1,
   ((clock_timestamp() at time zone 'UTC')-interval '22 hours')::date,
   interval '1 day') as gs
 ),
 raw_telemetry as (
  select m.day,
   sum(m.events) filter(where m.metric='daily_visitor') as visits,
   sum(m.events) filter(where m.metric='guest_start') as starts,
   sum(m.events) filter(where m.metric='guest_complete') as completes,
   sum(m.events) filter(where m.metric='share_result') as shares
  from public.crilo_site_daily_metrics m group by m.day
 ),
 played as (
  select s.daily_period as d,count(*)::bigint n
  from public.crilo_spin_sessions s group by s.daily_period
 ),
 verified as (
  select r.daily_period as d,
   count(*)::bigint n,
   count(*) filter(where exists (
     select 1 from public.daily_runs older
     where older.user_id=r.user_id
       and older.daily_period<r.daily_period
       and older.is_test=false
       and older.verified_spin_session_id is not null
   ))::bigint returning_count
  from public.daily_runs r
  where r.is_test=false and r.verified_spin_session_id is not null
  group by r.daily_period
 ),
 accounts as (
  select ((u.created_at at time zone 'UTC')-interval '22 hours')::date d,
         count(*)::bigint n
  from auth.users u where u.is_anonymous is false
  group by 1
 )
 select c.d,coalesce(t.visits,0)::bigint,coalesce(t.starts,0)::bigint,
        coalesce(t.completes,0)::bigint,coalesce(t.shares,0)::bigint,
        coalesce(p.n,0),coalesce(v.n,0),coalesce(v.returning_count,0),coalesce(a.n,0)
 from calendar c
 left join raw_telemetry t on t.day=c.d
 left join played p on p.d=c.d
 left join verified v on v.d=c.d
 left join accounts a on a.d=c.d
 order by c.d desc;
end;
$report$;
revoke all on function public.crilo_owner_growth_report(integer) from public,anon,authenticated;
grant execute on function public.crilo_owner_growth_report(integer) to authenticated,service_role;
