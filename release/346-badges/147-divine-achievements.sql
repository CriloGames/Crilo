-- 2026-10-14: Divine badges and active/earnable catalog flags.
-- All existing awards, badge IDs, wheel odds, historical points are preserved.
-- Estimated probabilities: 2,000,000 seeded independent Dailies; these are Monte Carlo estimates.
-- 30,000+ 0.01555%; 4 successive upgrades 0.0049%; 5,000+ single number 0.09335%.
-- Divine Consistency is a multi-day milestone; no per-run percentage is asserted.
begin;
alter table public.badges add column if not exists is_active boolean not null default true;
alter table public.badges add column if not exists is_earnable boolean not null default true;

-- Promote the EXISTING Divine Score metadata without changing its badge ID.
update public.badges
set requirement=jsonb_set(requirement,'{rarity}','"divine"'::jsonb,true)
where badge_key='v2_score_rarity_divine';
update public.crilo_v3_badge_stage
set rarity='Divine',rule=jsonb_set(rule,'{rarity}','"Divine"'::jsonb,true)
where badge_key='v2_score_rarity_divine';

CREATE OR REPLACE FUNCTION public.crilo_v3_run_matches(p_rule jsonb, p_results jsonb, p_score bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare kind text:=p_rule->>'rule'; n int:=coalesce((p_rule->>'target')::int,0);
 e jsonb; a jsonb; typ text; base int; i int:=0; nnum int:=0; counts jsonb:='{}'::jsonb;
 types text[]:=array[]::text[]; bases int[]:=array[]::int[]; vals bigint[]:=array[]::bigint[];
 score numeric:=0; mult numeric:=1; prev text:=''; streak int:=0;
 pat text[]; bpat int[]; run_count int:=0; j int; ok boolean; distinct_count int; bcounter int:=0;
 first_type text; last_type text; last_base int;
begin
 if kind='score_band' then return p_score >= (p_rule->>'lower')::bigint and (p_rule->>'upper' is null or p_score <= (p_rule->>'upper')::bigint);end if;
 if jsonb_typeof(p_results) <> 'array' then return false;end if;
 for e in select value from jsonb_array_elements(p_results) loop
  typ:=e->>'type';
  if typ not in ('num','duck','double','spins','upgrade') then return false;end if;
  i:=i+1;if i>500 then return false;end if;
  if typ='num' then
   base:=coalesce((e->>'base')::int,0);
   if base not in (20,40,60,80,120,160) then return false;end if;
   score:=least(score+base*mult,9007199254740991::numeric);
   nnum:=nnum+1;
  else base:=0;
   if typ='double' then score:=least(score*2,9007199254740991::numeric);
   elsif typ='upgrade' then mult:=least(mult*3,9007199254740991::numeric);end if;
  end if;
  if score>9223372036854775807 then return false;end if;
  types:=array_append(types,typ);bases:=array_append(bases,base);vals:=array_append(vals,score::bigint);
 end loop;
 run_count:=coalesce(array_length(types,1),0);
 if run_count=0 then return false;end if;
 if kind='hit_exact' then return n=any(vals);
 elsif kind='event_total' then
  select count(*) into bcounter from unnest(types) t where t=p_rule->>'event';
  return bcounter>=n;
 elsif kind='event_streak' then
  for j in 1..run_count loop
   if types[j]=p_rule->>'event' then streak:=streak+1;if streak>=n then return true;end if;
   else streak:=0;end if;
  end loop;return false;
 elsif kind in ('sequence','base_sequence','number_sequence') then
  if kind='sequence' then
   select array_agg(value) into pat from jsonb_array_elements_text(p_rule->'pattern');
   if pat is null or cardinality(pat)>run_count then return false;end if;
   for j in 1..run_count-cardinality(pat)+1 loop
    ok:=true;
    for i in 1..cardinality(pat) loop if types[j+i-1] <> pat[i] then ok:=false;exit;end if;end loop;
    if ok then return true;end if;
   end loop;
  else
   select array_agg(value::int) into bpat from jsonb_array_elements_text(p_rule->'pattern');
   if bpat is null or cardinality(bpat)>run_count then return false;end if;
   for j in 1..run_count-cardinality(bpat)+1 loop
    ok:=true;for i in 1..cardinality(bpat) loop
     if types[j+i-1]<>'num' or bases[j+i-1]<>bpat[i] then ok:=false;exit;end if;
    end loop;if ok then return true;end if;
   end loop;
  end if;return false;
 elsif kind='first_event' then return types[1]=p_rule->>'event';
 elsif kind='final_base' then return types[run_count]='num' and bases[run_count]=(p_rule->>'base')::int;
 elsif kind='first_last' then return types[1]=p_rule->>'first' and types[run_count]='num' and bases[run_count]=(p_rule->>'last_base')::int;
 elsif kind='spin_position' then return run_count>=n and types[n]='num';
 elsif kind='base_total' then
  for j in 1..run_count loop if types[j]='num' and bases[j]=(p_rule->>'base')::int then bcounter:=bcounter+1;end if;end loop;
  return bcounter>=n;
 elsif kind='variety' then
  select count(distinct x) into distinct_count from unnest(bases) x where x in (20,40,60,80);
  return distinct_count>=n;
 elsif kind='challenge' then
  n:=(p_rule->>'number')::int;
  if n=159 then
   -- Official single numbered spin gain; multiplier only applies to numbers.
   mult:=1;
   for j in 1..run_count loop
    if types[j]='upgrade' then mult:=least(mult*3,9007199254740991::numeric);end if;
    if types[j]='num' and bases[j]*mult >= (p_rule->>'target')::numeric then return true;end if;
   end loop;
   return false;
  elsif n=129 then return run_count=5 and nnum=5;
  elsif n between 130 and 138 then
   typ:=case when n in (130,131,132) then 'duck' when n in (133,134) then 'double' when n in (135,136) then 'upgrade' else 'spins' end;
   select count(*) into bcounter from unnest(types) t where t=typ;
   if n in (130,133,135,137) then return bcounter=0;end if;
   if n=132 then return bcounter=2;end if;
   return bcounter=1;
  elsif n=139 then return array['duck','double','upgrade','spins'] <@ types;
  elsif n between 140 and 145 then
   pat:=case n
    when 140 then array['duck','double'] when 141 then array['duck','upgrade']
    when 142 then array['duck','spins'] when 143 then array['double','upgrade']
    when 144 then array['double','spins'] else array['upgrade','spins'] end;
   return pat <@ types;
  elsif n in (146,147,148) then return run_count>=case n when 146 then 8 when 147 then 10 else 12 end;
  elsif n=149 then return array[20,60,80] <@ bases;
  elsif n=150 then return 20=any(bases);
  elsif n=151 then select count(*) into bcounter from unnest(bases) b where b=40;return bcounter>=2;
  elsif n=152 then return 80=any(bases);
  elsif n=153 then select count(*) into bcounter from unnest(bases) b where b=60;return bcounter>=3;
  elsif n=154 then return not (20=any(bases));
  elsif n=155 then select count(*) into bcounter from unnest(bases) b where b=20;return bcounter>=5;
  elsif n=156 then
   -- "four consecutive numerical spins" means four adjacent wheel results, not numerical subsequence.
   for j in 1..run_count-3 loop
    if types[j]='num' and bases[j]=bases[j+1] and bases[j]=bases[j+2] and bases[j]=bases[j+3] then return true;end if;
   end loop;return false;
  elsif n=157 then
   mult:=1;for j in 1..run_count loop
    if types[j]='upgrade' then mult:=mult*3;end if;
    if types[j]='num' and mult>1 and bases[j]*mult>=300 then return true;end if;
   end loop;return false;
  elsif n=158 then
   mult:=1;for j in 1..run_count loop
    if types[j]='upgrade' then mult:=mult*3;end if;
    if types[j]='num' and bases[j]*mult>=600 then return true;end if;
   end loop;return false;
  end if;
 end if;
 return false;
exception when others then return false;
end $function$;
CREATE OR REPLACE FUNCTION public.crilo_v3_account_matches(p_rule jsonb, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare kind text:=p_rule->>'rule'; t integer:=coalesce((p_rule->>'target')::int,0);
 n integer:=0; v text:=p_rule->>'event'; x integer:=0;
 idn integer:=coalesce(nullif(substring(p_rule->>'key' from '[0-9]+$'),'')::int,0);
begin
 if p_user is null then return false;end if;
 if kind='divine_mythic_dailies' then
  -- Verified official Dailies only. Exclude test runs and unverified legacy rows.
  select count(distinct d.daily_period) into n
  from public.daily_runs d
  where d.user_id=p_user and d.is_test=false
    and d.verified_spin_session_id is not null
    and d.score>=5441;
  return n>=t;
 elsif kind='exploration' then
  return exists(select 1 from public.crilo_v3_user_events e where e.user_id=p_user and e.event_name=v);
 elsif kind='lifetime_runs' then
  select count(distinct daily_period) into n from public.daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_spins' then
  select coalesce(sum(spins),0)::int into n from public.daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_event' or kind='lifetime_base' then
  if kind='lifetime_event' and v='num' then
   select coalesce(sum(numbers_landed),0)::int into n from public.daily_runs where user_id=p_user and is_test=false;
  elsif kind='lifetime_event' and v in ('duck','double','spins','upgrade') then
   select count(*) into n from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'=v;
  else
   select count(*) into n from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'='num' and (e->>'base')::int=(p_rule->>'base')::int;
  end if; return n>=t;
 elsif kind='daily_streak' then
  select coalesce(max(cnt),0) into n from (
   select count(*) cnt from (
    select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
    from (select distinct daily_period from public.daily_runs where user_id=p_user and is_test=false and daily_period is not null)p
   )g group by grp
  )z;return n>=t;
 elsif kind='drawing' then
  if idn in (234,235,236,237,238,241) then
   t:=case idn when 234 then 1 when 235 then 2 when 236 then 5 when 237 then 10 when 238 then 20 else 30 end;
   select count(distinct daily_period) into n from public.daily_runs d
    where d.user_id=p_user and d.is_test=false and d.drawing_is_blank=false;
   return n>=t;
  elsif idn=240 then
   select coalesce(max(cnt),0) into n from (
    select count(*) cnt from (
     select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
     from (select distinct daily_period from public.daily_runs where user_id=p_user and is_test=false and drawing_is_blank=false and daily_period is not null)p
    )g group by grp
   )z;return n>=7;
  elsif idn=239 then
   return exists(
    select 1 from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false and a.drawing_is_blank=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.drawing_is_blank=false and b.user_id=
       case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
  end if;return false;
 elsif kind='leaderboard' then
  if idn between 209 and 217 then
   t:=case idn when 209 then 100 when 210 then 50 when 211 then 25 when 212 then 10
    when 213 then 5 when 214 then 3 when 215 then 2 when 216 then 3 else 1 end;
   if idn in (215,216,217) then
    return exists(select 1 from public.daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank=t);
   end if;
   return exists(select 1 from public.daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and t);
  elsif idn between 218 and 223 then
   t:=case idn when 218 then 2 when 219 then 5 when 220 then 10 when 221 then 2 when 222 then 5 else 2 end;
   x:=case when idn between 218 and 220 then 100 when idn between 221 and 222 then 10 else 1 end;
   select count(distinct daily_period) into n from public.daily_runs d
   where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and x;
   return n>=t;
  end if;return false;
 elsif kind='social' then
  if idn between 224 and 228 then
   t:=case idn when 224 then 1 when 225 then 3 when 226 then 5 when 227 then 10 else 20 end;
   select count(distinct case when sender_id=p_user then receiver_id else sender_id end) into n
   from public.friend_requests f where status='accepted' and (sender_id=p_user or receiver_id=p_user);
   return n>=t;
  elsif idn in (229,230,231,232,233) then
   if idn=232 then
    return exists(select 1 from public.friend_requests f join public.daily_runs b on b.user_id=
     case when f.sender_id=p_user then f.receiver_id else f.sender_id end and b.is_test=false and b.final_rank=1
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
   end if;
   if idn=230 then
    select count(distinct a.daily_period) into n from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user) and a.score>b.score;
    return n>=5;
   end if;
   return exists(select 1 from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user)
      and (idn=233 or (idn=229 and a.score>b.score) or (idn=231 and abs(a.score-b.score)<=100)));
  end if;return false;
 end if;
 return false;
exception when others then return false;
end $function$;

insert into public.crilo_v3_badge_stage(badge_key,display_name,description,rarity,category,rule,status)
values('divine_beyond_mythic','Beyond Mythic','Finish an official Daily with at least 30,000 points.','Divine','Score rarity','{"key":"divine_beyond_mythic","name":"Beyond Mythic","rule":"score_band","lower":30000,"upper":null,"rarity":"Divine","category":"Score rarity","condition":"Finish an official Daily with at least 30,000 points.","probability_percent":0.01555}'::jsonb,'active')
on conflict(badge_key) do update set
 display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;
insert into public.badges(badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
values('divine_beyond_mythic','Beyond Mythic','Finish an official Daily with at least 30,000 points.','Score rarity','{"type":"score_band","rarity":"divine","probability_percent":0.01555,"rule":"score_band","lower":30000,"upper":null}'::jsonb,false,870,true,true)
on conflict(badge_key) do update set
 name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage(badge_key,display_name,description,rarity,category,rule,status)
values('divine_touched_by_wheel','Touched by the Wheel','Land on Upgrade four times in a row during one official Daily.','Divine','Score rarity','{"key":"divine_touched_by_wheel","name":"Touched by the Wheel","rule":"event_streak","event":"upgrade","target":4,"rarity":"Divine","category":"Score rarity","condition":"Land on Upgrade four times in a row during one official Daily.","probability_percent":0.0049}'::jsonb,'active')
on conflict(badge_key) do update set
 display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;
insert into public.badges(badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
values('divine_touched_by_wheel','Touched by the Wheel','Land on Upgrade four times in a row during one official Daily.','Score rarity','{"type":"event_streak","rarity":"divine","probability_percent":0.0049,"rule":"event_streak","event":"upgrade","target":4}'::jsonb,false,871,true,true)
on conflict(badge_key) do update set
 name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage(badge_key,display_name,description,rarity,category,rule,status)
values('divine_heavenly_momentum','Heavenly Momentum','Gain at least 5,000 points from a single number spin after Upgrades during an official Daily.','Divine','Score rarity','{"key":"divine_heavenly_momentum","name":"Heavenly Momentum","rule":"challenge","number":159,"target":5000,"rarity":"Divine","category":"Score rarity","condition":"Gain at least 5,000 points from a single number spin after Upgrades during an official Daily.","probability_percent":0.09335}'::jsonb,'active')
on conflict(badge_key) do update set
 display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;
insert into public.badges(badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
values('divine_heavenly_momentum','Heavenly Momentum','Gain at least 5,000 points from a single number spin after Upgrades during an official Daily.','Score rarity','{"type":"challenge","rarity":"divine","probability_percent":0.09335,"rule":"challenge","number":159,"target":5000}'::jsonb,false,872,true,true)
on conflict(badge_key) do update set
 name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage(badge_key,display_name,description,rarity,category,rule,status)
values('divine_consistency','Divine Consistency','Finish five different verified official Dailies with Mythic-or-better scores (5,441+ points).','Divine','Lifetime milestones','{"key":"divine_consistency","name":"Divine Consistency","rule":"divine_mythic_dailies","target":5,"rarity":"Divine","category":"Lifetime milestones","condition":"Finish five different verified official Dailies with Mythic-or-better scores (5,441+ points)."}'::jsonb,'active')
on conflict(badge_key) do update set
 display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;
insert into public.badges(badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
values('divine_consistency','Divine Consistency','Finish five different verified official Dailies with Mythic-or-better scores (5,441+ points).','Lifetime milestones','{"type":"divine_mythic_dailies","rarity":"divine","rule":"divine_mythic_dailies","target":5}'::jsonb,false,873,true,true)
on conflict(badge_key) do update set
 name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

commit;
