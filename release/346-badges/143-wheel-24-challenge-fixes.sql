-- Preserve all historical awards; remove only incorrectly granted migration-time
-- awards that do not meet their actual updated challenge criteria.
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
  if n=129 then return run_count=5 and nnum=5;
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
end $function$
;
with candidates as (
 select ub.user_id,ub.badge_id,s.rule
 from public.user_badges ub
 join public.badges b on b.id=ub.badge_id
 join public.crilo_v3_badge_stage s on s.badge_key=b.badge_key
 left join crilo_wheel_20261014.user_badges old on old.user_id=ub.user_id and old.badge_id=ub.badge_id
 where old.user_id is null and b.badge_key in ('idea_run_154','idea_run_158')
)
delete from public.user_badges ub using candidates c
where ub.user_id=c.user_id and ub.badge_id=c.badge_id
 and not exists (
  select 1 from public.daily_runs d where d.user_id=c.user_id and d.is_test=false
  and public.crilo_v3_run_matches(c.rule,d.results,d.score)
 );
do $do$ declare u record;begin
 for u in select distinct user_id from public.daily_runs where is_test=false loop
  perform public.crilo_v3_refresh_user_badges(u.user_id);
 end loop;
end $do$;
do $check$ declare bad int; begin
select count(*) into bad
from public.user_badges u join public.badges b on u.badge_id=b.id
left join crilo_wheel_20261014.user_badges o on o.badge_id=u.badge_id and o.user_id=u.user_id
where o.user_id is null and b.badge_key in ('idea_run_154','idea_run_158')
and not exists (select 1 from public.daily_runs d join public.crilo_v3_badge_stage s on s.badge_key=b.badge_key
where d.user_id=u.user_id and d.is_test=false and public.crilo_v3_run_matches(s.rule,d.results,d.score));
if bad>0 then raise exception 'Unexpected unearned challenge badges: %',bad;end if;
end $check$;