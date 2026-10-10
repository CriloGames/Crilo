-- Staging-only stateful QA; no production user/account/run/award mutations.
CREATE TABLE IF NOT EXISTS crilo_badge_prelaunch.qa_daily_runs(
 user_id uuid NOT NULL, daily_period date, is_test boolean NOT NULL DEFAULT false,
 spins integer DEFAULT 0, numbers_landed integer DEFAULT 0,
 results jsonb NOT NULL DEFAULT '[]'::jsonb, drawing_is_blank boolean DEFAULT true,
 score bigint NOT NULL DEFAULT 0, final_rank integer
);
CREATE TABLE IF NOT EXISTS crilo_badge_prelaunch.qa_friend_requests(
 sender_id uuid NOT NULL, receiver_id uuid NOT NULL, status text NOT NULL
);
CREATE TABLE IF NOT EXISTS crilo_badge_prelaunch.qa_user_events(
 user_id uuid NOT NULL,event_name text NOT NULL
);
REVOKE ALL ON crilo_badge_prelaunch.qa_daily_runs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON crilo_badge_prelaunch.qa_friend_requests FROM PUBLIC,anon,authenticated;
REVOKE ALL ON crilo_badge_prelaunch.qa_user_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION crilo_badge_prelaunch.qa_account_matches(p_rule jsonb, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare kind text:=p_rule->>'rule'; t integer:=coalesce((p_rule->>'target')::int,0);
 n integer:=0; v text:=p_rule->>'event'; x integer:=0;
 idn integer:=coalesce(nullif(substring(p_rule->>'key' from '[0-9]+$'),'')::int,0);
begin
 if p_user is null then return false;end if;
 if kind='exploration' then
  return exists(select 1 from crilo_badge_prelaunch.qa_user_events e where e.user_id=p_user and e.event_name=v);
 elsif kind='lifetime_runs' then
  select count(distinct daily_period) into n from crilo_badge_prelaunch.qa_daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_spins' then
  select coalesce(sum(spins),0)::int into n from crilo_badge_prelaunch.qa_daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_event' or kind='lifetime_base' then
  if kind='lifetime_event' and v='num' then
   select coalesce(sum(numbers_landed),0)::int into n from crilo_badge_prelaunch.qa_daily_runs where user_id=p_user and is_test=false;
  elsif kind='lifetime_event' and v in ('duck','double','spins','upgrade') then
   select count(*) into n from crilo_badge_prelaunch.qa_daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'=v;
  else
   select count(*) into n from crilo_badge_prelaunch.qa_daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'='num' and (e->>'base')::int=(p_rule->>'base')::int;
  end if; return n>=t;
 elsif kind='daily_streak' then
  select coalesce(max(cnt),0) into n from (
   select count(*) cnt from (
    select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
    from (select distinct daily_period from crilo_badge_prelaunch.qa_daily_runs where user_id=p_user and is_test=false and daily_period is not null)p
   )g group by grp
  )z;return n>=t;
 elsif kind='drawing' then
  if idn in (234,235,236,237,238,241) then
   t:=case idn when 234 then 1 when 235 then 2 when 236 then 5 when 237 then 10 when 238 then 20 else 30 end;
   select count(distinct daily_period) into n from crilo_badge_prelaunch.qa_daily_runs d
    where d.user_id=p_user and d.is_test=false and d.drawing_is_blank=false;
   return n>=t;
  elsif idn=240 then
   select coalesce(max(cnt),0) into n from (
    select count(*) cnt from (
     select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
     from (select distinct daily_period from crilo_badge_prelaunch.qa_daily_runs where user_id=p_user and is_test=false and drawing_is_blank=false and daily_period is not null)p
    )g group by grp
   )z;return n>=7;
  elsif idn=239 then
   return exists(
    select 1 from crilo_badge_prelaunch.qa_friend_requests f
    join crilo_badge_prelaunch.qa_daily_runs a on a.user_id=p_user and a.is_test=false and a.drawing_is_blank=false
    join crilo_badge_prelaunch.qa_daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.drawing_is_blank=false and b.user_id=
       case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
  end if;return false;
 elsif kind='leaderboard' then
  if idn between 209 and 217 then
   t:=case idn when 209 then 100 when 210 then 50 when 211 then 25 when 212 then 10
    when 213 then 5 when 214 then 3 when 215 then 2 when 216 then 3 else 1 end;
   if idn in (215,216,217) then
    return exists(select 1 from crilo_badge_prelaunch.qa_daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank=t);
   end if;
   return exists(select 1 from crilo_badge_prelaunch.qa_daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and t);
  elsif idn between 218 and 223 then
   t:=case idn when 218 then 2 when 219 then 5 when 220 then 10 when 221 then 2 when 222 then 5 else 2 end;
   x:=case when idn between 218 and 220 then 100 when idn between 221 and 222 then 10 else 1 end;
   select count(distinct daily_period) into n from crilo_badge_prelaunch.qa_daily_runs d
   where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and x;
   return n>=t;
  end if;return false;
 elsif kind='social' then
  if idn between 224 and 228 then
   t:=case idn when 224 then 1 when 225 then 3 when 226 then 5 when 227 then 10 else 20 end;
   select count(distinct case when sender_id=p_user then receiver_id else sender_id end) into n
   from crilo_badge_prelaunch.qa_friend_requests f where status='accepted' and (sender_id=p_user or receiver_id=p_user);
   return n>=t;
  elsif idn in (229,230,231,232,233) then
   if idn=232 then
    return exists(select 1 from crilo_badge_prelaunch.qa_friend_requests f join crilo_badge_prelaunch.qa_daily_runs b on b.user_id=
     case when f.sender_id=p_user then f.receiver_id else f.sender_id end and b.is_test=false and b.final_rank=1
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
   end if;
   if idn=230 then
    select count(distinct a.daily_period) into n from crilo_badge_prelaunch.qa_friend_requests f
    join crilo_badge_prelaunch.qa_daily_runs a on a.user_id=p_user and a.is_test=false
    join crilo_badge_prelaunch.qa_daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user) and a.score>b.score;
    return n>=5;
   end if;
   return exists(select 1 from crilo_badge_prelaunch.qa_friend_requests f
    join crilo_badge_prelaunch.qa_daily_runs a on a.user_id=p_user and a.is_test=false
    join crilo_badge_prelaunch.qa_daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user)
      and (idn=233 or (idn=229 and a.score>b.score) or (idn=231 and abs(a.score-b.score)<=5)));
  end if;return false;
 end if;
 return false;
exception when others then return false;
end $function$

REVOKE ALL ON FUNCTION crilo_badge_prelaunch.qa_account_matches(jsonb,uuid) FROM PUBLIC,anon,authenticated;

-- Actual PostgreSQL stateful predicate coverage, positive and negative for all 131
-- non-run badge definitions, with no production table writes.
DO $qa$
DECLARE
 u uuid:='00000000-0000-4000-8000-000000000001'::uuid;
 friend uuid:=md5('qa-friend')::uuid;
 b record; kind text; t integer; idn integer; v text; a integer; rank_value integer;
 checked integer:=0;
BEGIN
 FOR b IN SELECT rule, badge_key FROM crilo_badge_prelaunch.definitions
  WHERE rule->>'rule' NOT IN ('hit_exact','score_band','event_total','event_streak',
    'sequence','challenge','first_event','final_base','spin_position',
    'base_total','base_sequence','number_sequence','first_last','variety')
 LOOP
  TRUNCATE crilo_badge_prelaunch.qa_daily_runs,crilo_badge_prelaunch.qa_friend_requests,
    crilo_badge_prelaunch.qa_user_events;
  kind:=b.rule->>'rule';
  t:=coalesce((b.rule->>'target')::int,0);
  v:=b.rule->>'event';
  idn:=coalesce(nullif(substring(b.badge_key from '[0-9]+$'),'')::int,0);
  -- Empty state is the near-miss baseline for every badge.
  IF crilo_badge_prelaunch.qa_account_matches(b.rule,u) THEN
   RAISE EXCEPTION 'False positive on empty QA state: %',b.badge_key;
  END IF;
  CASE kind
   WHEN 'exploration' THEN
    INSERT INTO crilo_badge_prelaunch.qa_user_events VALUES(u,v);
   WHEN 'lifetime_runs','daily_streak','lifetime_spins' THEN
    INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,spins)
    SELECT u,date '2000-01-01'+i,false,
     CASE WHEN kind='lifetime_spins' THEN 1 ELSE 5 END
    FROM generate_series(0,t-1) AS i;
   WHEN 'lifetime_event','lifetime_base' THEN
    INSERT INTO crilo_badge_prelaunch.qa_daily_runs
       (user_id,daily_period,is_test,numbers_landed,results)
    SELECT u,date '2000-01-01'+i,false,
      CASE WHEN v='num' OR kind='lifetime_base' THEN 1 ELSE 0 END,
      jsonb_build_array(CASE WHEN kind='lifetime_base'
         THEN jsonb_build_object('type','num','base',(b.rule->>'base')::int)
         ELSE jsonb_build_object('type',v,'base',CASE WHEN v='num' THEN 1 ELSE null END) END)
    FROM generate_series(0,t-1) AS i;
   WHEN 'leaderboard' THEN
    IF idn BETWEEN 209 AND 217 THEN
     rank_value:=CASE idn WHEN 209 THEN 100 WHEN 210 THEN 50
       WHEN 211 THEN 25 WHEN 212 THEN 10 WHEN 213 THEN 5 WHEN 214 THEN 3
       WHEN 215 THEN 2 WHEN 216 THEN 3 ELSE 1 END;
     t:=1;
    ELSE
     t:=CASE idn WHEN 218 THEN 2 WHEN 219 THEN 5 WHEN 220 THEN 10
       WHEN 221 THEN 2 WHEN 222 THEN 5 ELSE 2 END;
     rank_value:=CASE WHEN idn BETWEEN 218 AND 220 THEN 100
       WHEN idn BETWEEN 221 AND 222 THEN 10 ELSE 1 END;
    END IF;
    INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,final_rank)
    SELECT u,date '2000-01-01'+i,false,rank_value
    FROM generate_series(0,t-1) AS i;
   WHEN 'drawing' THEN
    t:=CASE idn WHEN 234 THEN 1 WHEN 235 THEN 2 WHEN 236 THEN 5
      WHEN 237 THEN 10 WHEN 238 THEN 20 WHEN 239 THEN 1
      WHEN 240 THEN 7 ELSE 30 END;
    INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,drawing_is_blank)
    SELECT u,date '2000-01-01'+i,false,false
    FROM generate_series(0,t-1) AS i;
    IF idn=239 THEN
     INSERT INTO crilo_badge_prelaunch.qa_friend_requests VALUES(u,friend,'accepted');
     INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,drawing_is_blank)
     VALUES(friend,date '2000-01-01',false,false);
    END IF;
   WHEN 'social' THEN
    IF idn BETWEEN 224 AND 228 THEN
     t:=CASE idn WHEN 224 THEN 1 WHEN 225 THEN 3 WHEN 226 THEN 5
       WHEN 227 THEN 10 ELSE 20 END;
     INSERT INTO crilo_badge_prelaunch.qa_friend_requests
     SELECT u,md5('qa-friend-'||i::text)::uuid,'accepted'
     FROM generate_series(1,t) i;
    ELSE
     INSERT INTO crilo_badge_prelaunch.qa_friend_requests VALUES(u,friend,'accepted');
     IF idn=232 THEN
      INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,final_rank)
      VALUES(friend,date '2000-01-01',false,1);
     ELSE
      t:=CASE WHEN idn=230 THEN 5 ELSE 1 END;
      INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,score)
      SELECT u,date '2000-01-01'+i,false,10
      FROM generate_series(0,t-1) i;
      INSERT INTO crilo_badge_prelaunch.qa_daily_runs(user_id,daily_period,is_test,score)
      SELECT friend,date '2000-01-01'+i,false,
       CASE WHEN idn=231 THEN 8 ELSE 1 END
      FROM generate_series(0,t-1) i;
     END IF;
    END IF;
   ELSE RAISE EXCEPTION 'Unhandled stateful rule: %',kind;
  END CASE;
  IF NOT crilo_badge_prelaunch.qa_account_matches(b.rule,u) THEN
   RAISE EXCEPTION 'False negative on qualifying QA state: % kind % target %',b.badge_key,kind,t;
  END IF;
  checked:=checked+1;
 END LOOP;
 IF checked<>131 THEN RAISE EXCEPTION 'Expected 131 stateful rules, got %',checked;END IF;
 TRUNCATE crilo_badge_prelaunch.qa_daily_runs,crilo_badge_prelaunch.qa_friend_requests,
 crilo_badge_prelaunch.qa_user_events;
 RAISE NOTICE 'All % stateful rules passed empty-state and positive fixture checks',checked;
END;
$qa$;
SELECT count(*) AS tested_stateful_badges FROM crilo_badge_prelaunch.definitions
 WHERE rule->>'rule' NOT IN
 ('hit_exact','score_band','event_total','event_streak','sequence','challenge',
  'first_event','final_base','spin_position','base_total','base_sequence',
  'number_sequence','first_last','variety');
