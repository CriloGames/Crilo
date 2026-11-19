-- Five selected drawings on each Crilo Statistics profile.
-- Drawings stay in the original completed runs; we store only references.
-- Test runs, unverified runs, removed/moderated drawings, and hidden Bonus
-- Runs cannot be picked or displayed through either public RPC.
create table if not exists public.crilo_profile_featured_drawings (
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  source text not null check (source in ('official','bonus')),
  run_id text not null check (length(run_id) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (user_id,position),
  unique (user_id,source,run_id)
);
alter table public.crilo_profile_featured_drawings enable row level security;
revoke all on public.crilo_profile_featured_drawings from public,anon,authenticated;

-- Private eligibility helper. Never expose this full artwork collection to
-- unauthenticated profile visitors. Public users may see only chosen slots.
create or replace function public.crilo_profile_eligible_artwork(p_user uuid)
returns table(source text,run_id text,daily_period date,drawing text,score bigint)
language sql stable security definer set search_path=''
as $$
  select 'official'::text,d.id::text,coalesce(d.daily_period,d.run_date),
         d.drawing,d.score
  from public.daily_runs d
  left join public.crilo_drawing_reviews r on r.run_id=d.id
  where p_user is not null and d.user_id=p_user
    and d.is_test=false and d.verified_spin_session_id is not null
    and d.drawing is not null and d.drawing_is_blank is distinct from true
    and length(d.drawing)>100
    and d.drawing ~ '^data:image/(png|webp);base64,[A-Za-z0-9+/=]+$'
    and coalesce(r.status,'pending')<>'removed'
    and not exists(
      select 1 from public.crilo_daily_penalties x
      where x.user_id=p_user and x.daily_period=d.daily_period
    )
  union all
  select 'bonus'::text,b.id::text,b.daily_period,b.drawing,b.score
  from public.crilo_bonus_runs b
  join public.crilo_bonus_spin_sessions s on s.id=b.spin_session_id
  left join public.crilo_bonus_drawing_reviews r on r.bonus_run_id=b.id
  where p_user is not null and b.user_id=p_user
    and s.user_id=p_user and s.finished_at is not null
    and s.remaining_spins=0 and s.score=b.score and s.spin_count=b.spins
    and b.drawing is not null and length(b.drawing)>100
    and b.drawing ~ '^data:image/(png|webp);base64,[A-Za-z0-9+/=]+$'
    and coalesce(r.status,'pending')<>'removed'
    and not exists(
      select 1 from public.crilo_hidden_bonus_leaderboard_runs h
      where h.bonus_run_id=b.id
    )
    and not exists(
      select 1 from public.crilo_daily_penalties x
      where x.user_id=p_user and x.daily_period=b.daily_period
    )
    and exists(
      select 1 from public.daily_runs d
      where d.user_id=p_user and d.daily_period=b.daily_period
        and d.is_test=false and d.verified_spin_session_id is not null
    );
$$;
revoke all on function public.crilo_profile_eligible_artwork(uuid)
 from public,anon,authenticated;

-- Visible on the player's public profile, but only the five *selected*
-- drawings, after rerunning eligibility each time to honor moderation.
create or replace function public.crilo_profile_featured_drawings(p_user uuid)
returns table(slot smallint,source text,run_id text,daily_period date,drawing text,score bigint)
language sql stable security definer set search_path=''
as $$
  select f.position,a.source,a.run_id,a.daily_period,a.drawing,a.score
  from public.crilo_profile_eligible_artwork(p_user) a
  join public.crilo_profile_featured_drawings f
    on f.user_id=p_user and f.source=a.source and f.run_id=a.run_id
  where p_user is not null
  order by f.position;
$$;
revoke all on function public.crilo_profile_featured_drawings(uuid)
 from public,anon,authenticated;
grant execute on function public.crilo_profile_featured_drawings(uuid)
 to anon,authenticated;

-- The picker is never accessible for a different user's collection.
-- Paginated for accounts with hundreds of completed Daily/Bonus Runs.
create or replace function public.crilo_my_featured_drawing_choices(
 p_limit integer default 18,p_offset integer default 0)
returns table(source text,run_id text,daily_period date,drawing text,score bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null then
   raise exception 'Sign in to choose drawings' using errcode='42501';
 end if;
 return query
 select a.source,a.run_id,a.daily_period,a.drawing,a.score
 from public.crilo_profile_eligible_artwork(auth.uid()) a
 order by a.daily_period desc,a.source,a.score desc,a.run_id desc
 limit greatest(1,least(coalesce(p_limit,18),24))
 offset greatest(0,least(coalesce(p_offset,0),10000));
end;
$$;
revoke all on function public.crilo_my_featured_drawing_choices(integer,integer)
 from public,anon,authenticated;
grant execute on function public.crilo_my_featured_drawing_choices(integer,integer)
 to authenticated;

-- Copy the existing featured-badge semantics: clearing a slot leaves it
-- empty; selecting a drawing removes it from any prior slot before moving.
create or replace function public.crilo_set_profile_featured_drawing(
 p_position integer,p_source text,p_run_id text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then
   raise exception 'Sign in to edit your profile' using errcode='42501';
 end if;
 if p_position not between 1 and 5 then
   raise exception 'Select one of the five drawing slots' using errcode='22023';
 end if;
 if (p_source is null) <> (p_run_id is null) then
   raise exception 'Select a saved drawing or clear the slot' using errcode='22023';
 end if;
 if p_source is not null then
   if p_source not in ('official','bonus') or length(p_run_id) not between 1 and 40 then
     raise exception 'Invalid drawing choice' using errcode='22023';
   end if;
   if not exists(
     select 1 from public.crilo_profile_eligible_artwork(v_user) a
     where a.source=p_source and a.run_id=p_run_id
   ) then
     raise exception 'This drawing is no longer available to feature' using errcode='42501';
   end if;
 end if;
 delete from public.crilo_profile_featured_drawings f
 where f.user_id=v_user and
    (f.position=p_position or
      (p_source is not null and f.source=p_source and f.run_id=p_run_id));
 if p_source is not null then
   insert into public.crilo_profile_featured_drawings(user_id,position,source,run_id)
   values(v_user,p_position,p_source,p_run_id);
 end if;
 return true;
end;
$$;
revoke all on function public.crilo_set_profile_featured_drawing(integer,text,text)
 from public,anon,authenticated;
grant execute on function public.crilo_set_profile_featured_drawing(integer,text,text)
 to authenticated;
