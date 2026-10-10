
-- Safe isolated release candidate. Does not award public badges.
create or replace function crilo_badge_prelaunch.run_evidence(p_results jsonb)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare
 e jsonb; kind text; b integer; i integer:=0; left_spins integer:=5;
 upgrades integer:=0; sectors integer:=12; mult numeric:=1; v_score numeric:=0;
 points numeric; last_kind text:=''; chain integer:=0; last_base integer:=-1;
 base_chain integer:=0; max_base_chain integer:=0;
 event_types jsonb:='[]'::jsonb; base_types jsonb:='[]'::jsonb;
 totals jsonb:='{"duck":0,"double":0,"spins":0,"upgrade":0,"num":0}'::jsonb;
 streaks jsonb:='{"duck":0,"double":0,"spins":0,"upgrade":0,"num":0}'::jsonb;
 basecount jsonb:='{"1":0,"2":0,"3":0,"5":0,"8":0,"10":0}'::jsonb;
 visited jsonb:='{}'::jsonb; best_num numeric:=0; after_upgrade15 boolean:=false;
begin
 if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>250 or jsonb_array_length(p_results)<5 then
 return '{"valid":false,"reason":"invalid_results_length"}'::jsonb;end if;
 for e in select value from jsonb_array_elements(p_results) loop
  if left_spins<=0 then return '{"valid":false,"reason":"results_after_finish"}'::jsonb;end if;
  kind:=e->>'type';i:=i+1;left_spins:=left_spins-1;
  if kind not in ('num','duck','spins','double','upgrade') or kind is null then
    return '{"valid":false,"reason":"unknown_type"}'::jsonb;
  end if;
  if (e->>'segments') is not null then
    if (e->>'segments')!~'^[0-9]+$' then return '{"valid":false,"reason":"bad_segment_count"}'::jsonb;end if;
    if (e->>'segments')::integer <> (sectors + (case when kind='upgrade' then 4+least(upgrades+1,8) else 0 end)) then
      return '{"valid":false,"reason":"wrong_segment_count"}'::jsonb;
    end if;
  end if;
  event_types:=event_types || jsonb_build_array(kind);
  totals:=jsonb_set(totals,array[kind],to_jsonb((totals->>kind)::int+1),true);
  if kind=last_kind then chain:=chain+1;else chain:=1;end if;
  last_kind:=kind;
  if chain>(streaks->>kind)::int then streaks:=jsonb_set(streaks,array[kind],to_jsonb(chain),true);end if;
  if kind='num' then
    if e->>'base' is null or (e->>'base') !~ '^[0-9]{1,2}$' then
      return '{"valid":false,"reason":"missing_number_base"}'::jsonb;end if;
    b:=(e->>'base')::integer;
    if (upgrades=0 and b not in (1,2,3,5)) or (upgrades>0 and b not in (1,2,3,5,8,10)) then
      return '{"valid":false,"reason":"number_not_on_wheel"}'::jsonb;end if;
    base_types:=base_types||jsonb_build_array(b);
    basecount:=jsonb_set(basecount,array[b::text],to_jsonb((basecount->>b::text)::integer+1),true);
    if last_base=b then base_chain:=base_chain+1;else base_chain:=1;end if;
    last_base:=b;max_base_chain:=greatest(max_base_chain,base_chain);
    points:=b*mult;v_score:=v_score+points;best_num:=greatest(best_num,points);
    if upgrades>0 and points>=15 then after_upgrade15:=true;end if;
  else
    base_types:=base_types||'null'::jsonb;last_base:=-1;base_chain:=0;
    case kind
      when 'double' then v_score:=v_score*2;left_spins:=left_spins+1;
      when 'upgrade' then upgrades:=upgrades+1;mult:=mult*3;sectors:=sectors+4+least(upgrades,8);left_spins:=left_spins+1;
      when 'spins' then left_spins:=left_spins+2;
      when 'duck' then left_spins:=left_spins+1;
    end case;
  end if;
  visited:=jsonb_set(visited,array[v_score::text],'true'::jsonb,true);
 end loop;
 if left_spins<>0 then return '{"valid":false,"reason":"unfinished_run"}'::jsonb;end if;
 return jsonb_build_object('valid',true,'score',v_score,'types',event_types,'bases',base_types,
   'totals',totals,'streaks',streaks,'basecount',basecount,'hits',visited,
   'max_base_streak',max_base_chain,'upgraded_large_number',after_upgrade15,
   'best_number_points',best_num,'spins',i);
end; $fn$;
create or replace function crilo_badge_prelaunch.qualifies_run(r jsonb,v jsonb)
returns boolean language plpgsql immutable set search_path='' as $fn$
declare
 kind text:=r->>'rule'; t text:=r->>'event'; n int:=coalesce((r->>'target')::int,0);
 types jsonb:=v->'types';bases jsonb:=v->'bases';pat jsonb:=r->'pattern';
 len integer:=coalesce(jsonb_array_length(v->'types'),0); patternlen integer;
 i integer;j integer;matched boolean;vcount integer;
 c jsonb:=v->'totals';bc jsonb:=v->'basecount';
begin
 if v->>'valid'<>'true' then return false;end if;
 case kind
  when 'hit_exact' then return (v->'hits') ? (r->>'target');
  when 'score_band' then return (v->>'score')::numeric >= (r->>'lower')::numeric and
    (r->'upper'='null'::jsonb or (v->>'score')::numeric <=(r->>'upper')::numeric);
  when 'event_total' then return coalesce((c->>t)::integer,0)>=n;
  when 'event_streak' then return coalesce((v->'streaks'->>t)::integer,0)>=n;
  when 'base_total' then return coalesce((bc->>(r->>'base'))::integer,0)>=n;
  when 'variety' then return
   (case when (bc->>'1')::int>0 then 1 else 0 end)+
   (case when (bc->>'2')::int>0 then 1 else 0 end)+
   (case when (bc->>'3')::int>0 then 1 else 0 end)+
   (case when (bc->>'5')::int>0 then 1 else 0 end) >=n;
  when 'spin_position' then return len>=n and types->>(n-1)='num';
  when 'first_event' then return types->>0=t;
  when 'final_base' then return types->>(len-1)='num' and bases->>(len-1)=r->>'base';
  when 'first_last' then return types->>0=r->>'first' and
   types->>(len-1)='num' and bases->>(len-1)=r->>'last_base';
  when 'sequence','base_sequence','number_sequence' then
   patternlen:=jsonb_array_length(pat);
   if len<patternlen then return false;end if;
   for i in 0..(len-patternlen) loop
    matched:=true;
    for j in 0..(patternlen-1) loop
     if (case when kind='sequence' then types->>(i+j) else bases->>(i+j) end)
         is distinct from pat->>(j) then matched:=false;exit;end if;
    end loop;
    if matched then return true;end if;
   end loop;
   return false;
  when 'challenge' then
   case (r->>'number')::int
    when 129 then return len=5 and (c->>'num')::int=5;
    when 130 then return (c->>'duck')::int=0;
    when 131 then return (c->>'duck')::int=1;
    when 132 then return (c->>'duck')::int=2;
    when 133 then return (c->>'double')::int=0;
    when 134 then return (c->>'double')::int=1;
    when 135 then return (c->>'upgrade')::int=0;
    when 136 then return (c->>'upgrade')::int=1;
    when 137 then return (c->>'spins')::int=0;
    when 138 then return (c->>'spins')::int=1;
    when 139 then return (c->>'duck')::int>0 and (c->>'double')::int>0 and (c->>'upgrade')::int>0 and (c->>'spins')::int>0;
    when 140 then return (c->>'duck')::int>0 and (c->>'double')::int>0;
    when 141 then return (c->>'duck')::int>0 and (c->>'upgrade')::int>0;
    when 142 then return (c->>'duck')::int>0 and (c->>'spins')::int>0;
    when 143 then return (c->>'double')::int>0 and (c->>'upgrade')::int>0;
    when 144 then return (c->>'double')::int>0 and (c->>'spins')::int>0;
    when 145 then return (c->>'upgrade')::int>0 and (c->>'spins')::int>0;
    when 146 then return len>=8;
    when 147 then return len>=10;
    when 148 then return len>=12;
    when 149 then return (bc->>'1')::int>=1 and (bc->>'3')::int>=1 and (bc->>'5')::int>=1;
    when 150 then return (bc->>'1')::int>=1;
    when 151 then return (bc->>'2')::int>=2;
    when 152 then return (bc->>'5')::int>=1;
    when 153 then return (bc->>'3')::int>=3;
    when 154 then return (bc->>'1')::int=0;
    when 155 then return (bc->>'1')::int>=5;
    when 156 then return (v->>'max_base_streak')::int>=4;
    when 157 then return (v->>'upgraded_large_number')::boolean;
    when 158 then return (v->>'best_number_points')::numeric>=30;
   end case;
   return false;
 end case;
 return false;
end; $fn$;
create or replace function crilo_badge_prelaunch.qualifying_run_badges(p_results jsonb,p_score bigint)
returns table(badge_key text)
language plpgsql stable set search_path='' as $fn$
declare ev jsonb;
begin
 ev:=crilo_badge_prelaunch.run_evidence(p_results);
 if ev->>'valid'<>'true' or (ev->>'score')::numeric<>p_score then return;end if;
 return query select d.badge_key from crilo_badge_prelaunch.definitions d
 where d.rule->>'rule' in ('hit_exact','score_band','event_total','event_streak',
  'sequence','challenge','first_event','final_base','spin_position','base_total',
  'base_sequence','number_sequence','first_last','variety')
 and crilo_badge_prelaunch.qualifies_run(d.rule,ev);
end; $fn$;
