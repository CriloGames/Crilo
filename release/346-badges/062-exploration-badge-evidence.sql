-- Stronger anti-forgery prerequisites for exploration badge events.
-- Preserve all 346 catalog definitions and previously earned badges.
-- View/click-only achievements remain client-attested until server-backed
-- navigation or gameplay instrumentation is available.
CREATE OR REPLACE FUNCTION public.crilo_v3_record_event(p_event text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); did_insert boolean:=false;
begin
 if u is null then return false;end if;
 if exists(select 1 from public.crilo_banned_accounts where user_id=u) then return false;end if;
 if p_event='domain_set' and not exists(select 1 from public.game_scores where user_id=u and game_key='domain' and is_verified=true) then return false;end if;
 if p_event='badge_filter' and not exists(select 1 from public.featured_badges where user_id=u) then return false;end if;
 if not exists(select 1 from public.crilo_v3_badge_stage s where s.rule->>'rule'='exploration' and s.rule->>'event'=p_event) then return false;end if;
 if p_event in ('daily_results','daily_run_screen') and not exists(select 1 from public.daily_runs where user_id=u and is_test=false) then return false;end if;
 if p_event='duck_sound' and not exists(select 1 from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e where d.user_id=u and d.is_test=false and e->>'type'='duck') then return false;end if;
 -- Client-reported exploration events do not prove a real game action.
 -- Require existing authoritative evidence where the server can verify it.
 if p_event='drawing_mark' and not exists (
  select 1 from public.daily_runs d where d.user_id=u and d.is_test=false
  and d.drawing_is_blank IS FALSE and d.drawing is not null
 ) then return false;end if;
 if p_event='drawing_canvas' and not exists (
  select 1 from public.daily_runs d where d.user_id=u and d.is_test=false
 ) then return false;end if;
 if p_event='display_name_saved' and not exists (
  select 1 from public.profiles p where p.id=u and p.username_changed_at is not null
 ) then return false;end if;
 if p_event='personal_best' and not exists (
  select 1 from public.daily_runs d where d.user_id=u and d.is_test=false
 ) then return false;end if;
 if p_event in ('dark_mode','light_mode') and not exists (
  select 1 from public.profiles p where p.id=u and
   p.theme=case when p_event='dark_mode' then 'dark' else 'light' end
 ) then return false;end if;
 insert into public.crilo_v3_user_events(user_id,event_name) values (u,p_event)
 on conflict do nothing;
 get diagnostics did_insert=row_count;
 return did_insert;
end $function$;

REVOKE EXECUTE ON FUNCTION public.crilo_v3_record_event(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_v3_record_event(text) TO authenticated;
