
-- Run inside a transaction; no tables or player rows are modified.
do $qa$
declare
 basebag integer[]:=array[1,1,2,2,3,3,5,5,8,10];
 segments text[]:=array['num:1','num:1','num:1','num:2','num:2','num:3','num:5','double','upgrade','spins','duck','duck'];
 pick text; typ text; b integer; score_now numeric; mult numeric; u integer; remaining integer;
 spin_ct integer; stream jsonb; outcome jsonb; trial integer;
 props jsonb; key text; x record; a boolean; bb boolean;
 mismatches integer:=0; checked integer:=0; inconsistent text:='';
begin
 for trial in 1..200 loop
  segments:=array['num:1','num:1','num:1','num:2','num:2','num:3','num:5','double','upgrade','spins','duck','duck'];
  remaining:=5;u:=0;mult:=1;score_now:=0;spin_ct:=0;stream:='[]'::jsonb;
  while remaining>0 and spin_ct<250 loop
   spin_ct:=spin_ct+1;remaining:=remaining-1;
   pick:=segments[1+floor(random()*array_length(segments,1))::integer];
   typ:=split_part(pick,':',1);b:=null;
   if typ='num' then
    b:=split_part(pick,':',2)::int;score_now:=score_now+b*mult;
   elsif typ='double' then score_now:=score_now*2;remaining:=remaining+1;
   elsif typ='spins' then remaining:=remaining+2;
   elsif typ='duck' then remaining:=remaining+1;
   elsif typ='upgrade' then
    u:=u+1;mult:=mult*3;remaining:=remaining+1;
    for j in 1..(4+least(u,8)) loop
     segments:=array_append(segments,'num:'||basebag[1+floor(random()*10)::int]::text);
    end loop;
   end if;
   stream:=stream||jsonb_build_array(jsonb_build_object('type',typ,'base',b,'segments',array_length(segments,1)));
  end loop;
  if remaining<>0 or score_now>9223372036854775807 then continue;end if;
  props:=crilo_badge_prelaunch.run_evidence(stream);
  if props->>'valid'<>'true' or (props->>'score')::numeric <> score_now then
   raise exception 'Strict server replay rejected a valid generated run: %',props;
  end if;
  for x in select badge_key,rule from crilo_badge_prelaunch.definitions
    where rule->>'rule' in ('hit_exact','score_band','event_total','event_streak','sequence','challenge',
     'first_event','final_base','spin_position','base_total','base_sequence','number_sequence','first_last','variety')
  loop
   a:=crilo_badge_prelaunch.qualifies_run(x.rule,props);
   bb:=public.crilo_v3_run_matches(x.rule,stream,score_now::bigint);
   checked:=checked+1;
   if a is distinct from bb then
    mismatches:=mismatches+1;
    if mismatches<=12 then inconsistent:=inconsistent||x.badge_key||' ['||coalesce(a::text,'null')||'/'||coalesce(bb::text,'null')||']; ';end if;
   end if;
  end loop;
 end loop;
 if mismatches>0 then raise exception 'Badge evaluator disagreement: % / % checks; %',mismatches,checked,inconsistent;end if;
end $qa$;