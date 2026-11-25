-- Include the distribution only in the existing completed daily/archive response.
do $migration$
declare
  endpoint regprocedure := 'public.ascent_circuit(uuid,text,date,integer,text,date,uuid)'::regprocedure;
  original text := pg_get_functiondef(endpoint);
  old_query text := $old$select jsonb_build_object('average',round(avg(total)),'players',count(*)) into crowd from ascent_game.runs
  where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received));$old$;
  new_query text := $new$select jsonb_build_object(
    'average',round(sum(score_sum)/nullif(sum(n),0)),
    'players',coalesce(sum(n),0),
    'finishBands',case when sum(n)>=10 then jsonb_object_agg(band,n) end
  ) into crowd
  from (
    select least(total/100,9) as band,count(*) as n,sum(total) as score_sum
    from ascent_game.runs
    where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received))
    group by 1
  ) as bins;$new$;
begin
  if position(new_query in original)>0 then return; end if;
  if position(old_query in original)=0 then
    raise exception 'Expected Ascent finish aggregation was not found';
  end if;
  execute replace(original,old_query,new_query);
end
$migration$;
