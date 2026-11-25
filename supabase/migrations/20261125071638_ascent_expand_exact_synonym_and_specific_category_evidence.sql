insert into ascent_game.direct_connection_facts(clue,word,reason) select x.clue,x.word,x.reason from jsonb_to_recordset('[{"word":"snowplow","clue":"skiing","reason":"A snowplow is a skiing stance used to slow down."},{"word":"whisk","clue":"eggs","reason":"Whisks beat eggs."},{"word":"pancreas","clue":"insulin","reason":"The pancreas produces insulin."},{"word":"turntable","clue":"vinyl","reason":"Turntables play vinyl records."},{"word":"scalpel","clue":"surgery","reason":"Scalpels are used to make surgical incisions."},{"word":"feather","clue":"quill","reason":"A quill pen is made from a feather."},{"word":"silkworm","clue":"cocoon","reason":"Silkworms spin silk cocoons."},{"word":"earbud","clue":"audio","reason":"Earbuds reproduce audio."},{"word":"snowflake","clue":"ice crystal","reason":"Snowflakes consist of ice crystals."},{"word":"hummingbird","clue":"nectar","reason":"Hummingbirds feed on flower nectar."},{"word":"petal","clue":"flower","reason":"Petals are parts of flowers."},{"word":"clay","clue":"potter","reason":"Potters shape clay into vessels."},{"word":"lens","clue":"binoculars","reason":"Binoculars contain optical lenses."},{"word":"refrigerator","clue":"compressor","reason":"Most refrigerators use compressors in their cooling systems."},{"word":"pulley","clue":"rope","reason":"A rope runs over a pulley to redirect force."},{"word":"sail","clue":"wind","reason":"Sails harness wind to propel boats."}]'::jsonb) x(clue text,word text,reason text) where not exists(select 1 from ascent_game.rejected_associations r where (r.clue=x.clue and r.word=x.word) or (r.word=x.clue and r.clue=x.word)) on conflict(clue,word) do update set reason=excluded.reason;
insert into ascent_game.rejected_associations(clue,word,reason) values('violin','guitar strings','Guitar strings are specifically made for guitars, not the usual strings of a violin.') on conflict(clue,word) do nothing;
CREATE OR REPLACE FUNCTION ascent_game.direct_fact_links(clues text[], guess text, known jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with g_base as materialized (
 select guess term,0 priority union
 select f,1 from unnest(ascent_game.guess_forms(guess)) f where f<>guess and not exists(select 1 from ascent_game.wordnet_members m where m.word=guess) union
 select b.word,1 from ascent_game.equivalent_answers a join ascent_game.equivalent_answers b using(group_key) where a.word=guess and a.group_key like 'inflection:%'
), c_base as materialized (
 select x clue,x term,0 priority from unnest(clues)x where not known ? x union
 select x,f,1 from unnest(clues)x cross join lateral unnest(ascent_game.guess_forms(x)) f where f<>x and not known ? x and not exists(select 1 from ascent_game.wordnet_members m where m.word=x) union
 select x,b.word,1 from unnest(clues)x join ascent_game.equivalent_answers a on a.word=x join ascent_game.equivalent_answers b using(group_key) where a.group_key like 'inflection:%' and not known ? x
), g as materialized (
 select term,priority from g_base
 union
 select distinct n.word,2 from g_base g join ascent_game.wordnet_members m on m.word=g.term join ascent_game.wordnet_members n using(synset)
 where n.word<>g.term and (select count(*) from ascent_game.wordnet_members z where z.word=g.term)=1 and (select count(*) from ascent_game.wordnet_members z where z.word=n.word)=1
), c as materialized (
 select clue,term,priority from c_base
 union
 select distinct c.clue,n.word,2 from c_base c join ascent_game.wordnet_members m on m.word=c.term join ascent_game.wordnet_members n using(synset)
 where n.word<>c.term and (select count(*) from ascent_game.wordnet_members z where z.word=c.term)=1 and (select count(*) from ascent_game.wordnet_members z where z.word=n.word)=1
), hits as (
 select c.clue,f.reason,c.priority+g.priority priority from c join ascent_game.direct_connection_facts f on f.clue=c.term join g on g.term=f.word
 where not (c.priority=2 and g.priority=2) and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.term and r.word=g.term) or (r.word=c.term and r.clue=g.term))
 union all
 select c.clue,f.reason,c.priority+g.priority from c join ascent_game.direct_connection_facts f on f.word=c.term join g on g.term=f.clue
 where not (c.priority=2 and g.priority=2) and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.term and r.word=g.term) or (r.word=c.term and r.clue=g.term))
), best as (select distinct on(clue) clue,reason from hits where not exists(select 1 from ascent_game.rejected_associations r where (r.clue=hits.clue and r.word=guess) or (r.word=hits.clue and r.clue=guess)) order by clue,priority,reason)
select case when ascent_game.is_displayed_clue(clues,guess) then '{}'::jsonb else known||coalesce((select jsonb_object_agg(clue,reason) from best),'{}'::jsonb) end
$function$;

CREATE OR REPLACE FUNCTION ascent_game.live_dictionary_links(clues text[], guess text, known jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with recursive g as materialized (select distinct m.synset from ascent_game.wordnet_members m where m.word=any(ascent_game.guess_forms(guess))),
c as materialized (select distinct clue,m.synset from unnest(clues) clue join ascent_game.wordnet_members m on m.word=clue where not known ? clue),
tax as (
 select distinct g.synset src,g.synset node,0 depth from g where g.synset like '%-n'
 union
 select distinct c.synset,c.synset,0 from c where c.synset like '%-n'
 union
 select t.src,r.dst,t.depth+1 from tax t join ascent_game.wordnet_relations r on r.src=t.node and r.rel='hypernym' where t.depth<3
),
paths as (
 select c.clue,guess||' is a specific type of '||c.clue reason,80 priority from c join tax t on t.node=c.synset join g on g.synset=t.src
 where t.depth between 2 and 3 and c.clue not in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process','animal','organism','living thing','physical object','artifact','instrumentality','substance','unit','whole','abstract entity') and (select count(*) from ascent_game.wordnet_relations x where x.dst=t.node and x.rel='hypernym')<=25
 union all
 select c.clue,c.clue||' is a specific type of '||guess,80 from c join tax t on t.src=c.synset join g on g.synset=t.node
 where t.depth between 2 and 3 and guess not in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process','animal','organism','living thing','physical object','artifact','instrumentality','substance','unit','whole','abstract entity') and (select count(*) from ascent_game.wordnet_relations x where x.dst=t.node and x.rel='hypernym')<=25
 union all
 select c.clue,'Same dictionary meaning as '||c.clue reason,100 priority from c join g using(synset)
 union all select c.clue,case r.rel when 'hypernym' then clue||' is a specific type of '||guess when 'mero_part' then guess||' is a component of '||clue when 'mero_substance' then guess||' is a material in '||clue when 'mero_member' then guess||' is a member of '||clue when 'similar' then 'Closely related dictionary meaning' when 'entails' then clue||' entails '||guess when 'causes' then clue||' can cause '||guess end,90
 from c join ascent_game.wordnet_relations r on r.src=c.synset join g on g.synset=r.dst
 where r.rel in ('hypernym','mero_part','mero_substance','mero_member','similar','entails','causes') and (r.rel<>'hypernym' or (select count(*) from ascent_game.wordnet_relations x where x.dst=r.dst and x.rel='hypernym')<=35)
 union all select c.clue,case r.rel when 'hypernym' then guess||' is a specific type of '||clue when 'mero_part' then clue||' is a component of '||guess when 'mero_substance' then clue||' is a material in '||guess when 'mero_member' then clue||' is a member of '||guess when 'similar' then 'Closely related dictionary meaning' when 'entails' then guess||' entails '||clue when 'causes' then guess||' can cause '||clue end,90
 from g join ascent_game.wordnet_relations r on r.src=g.synset join c on c.synset=r.dst
 where r.rel in ('hypernym','mero_part','mero_substance','mero_member','similar','entails','causes') and (r.rel<>'hypernym' or (select count(*) from ascent_game.wordnet_relations x where x.dst=r.dst and x.rel='hypernym')<=35)
), chosen as (select distinct on(clue) clue,reason from paths where reason is not null and not exists(select 1 from ascent_game.rejected_associations x where x.clue=paths.clue and x.word=any(ascent_game.guess_forms(guess))) order by clue,priority desc,reason)
select case when guess !~ '^[a-z0-9]+( [a-z0-9]+){0,7}$' or guess ~ '(^| )(not|unrelated|none|except|without|or)( |$)' or guess in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process') or ascent_game.is_displayed_clue(clues,guess) then known else known||coalesce((select jsonb_object_agg(clue,reason||' — Open English WordNet') from chosen),'{}') end
$function$;

CREATE OR REPLACE FUNCTION ascent_game.is_displayed_clue(clues text[], guess text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with normalized as (select btrim(regexp_replace(lower(regexp_replace(coalesce(guess,''),'[’'']','','g')),'[[:space:]‐‑–—-]+',' ','g')) g),
forms as (select btrim(regexp_replace(g,'[.!?]+$','','g')) g from normalized),
clean as (select regexp_replace(g,'^(a|an|the) +','','i') g from forms)
select exists(select 1 from clean cross join unnest(clues) c where
 (' '||lower(regexp_replace(c,'[^a-zA-Z0-9]+',' ','g'))||' ') like ('% '||replace(replace(g,'%','\\%'),'_','\\_')||' %') or
 exists(select 1 from unnest(ascent_game.clue_terms(c)) token where g=token or (length(token)>2 and g=token||'s') or (length(g)>2 and token=g||'s')) or
 g=c or g=regexp_replace(c,'^(a|an|the) +','','i') or
 (g like '% %' and c like '% %' and ascent_game.guess_forms(g)&&ascent_game.guess_forms(c)) or
 exists(select 1 from ascent_game.equivalent_answers a join ascent_game.equivalent_answers b using(group_key) where a.group_key like 'inflection:%' and a.word=g and b.word=c))
$function$;

CREATE OR REPLACE FUNCTION ascent_game.generated_links(board jsonb, guess text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with forms as (select ascent_game.guess_forms(guess) g),
answers as (select a, a->>'word' answer_word, ord from jsonb_array_elements(coalesce(board->'answers','[]'::jsonb)) with ordinality x(a,ord)),
ranked as (
 select a,answer_word,ord,case when answer_word=lower(btrim(guess)) then 0 when ascent_game.guess_forms(answer_word)&&g then 1
 when exists(select 1 from ascent_game.wordnet_members m join ascent_game.wordnet_members n using(synset) where m.word=any(g) and n.word=answers.answer_word and (select count(*) from ascent_game.wordnet_members z where z.word=m.word)=1 and (select count(*) from ascent_game.wordnet_members z where z.word=n.word)=1) then 2 end rank
 from answers cross join forms
), picked as (select * from ranked where rank is not null order by rank,ord limit 1)
select case when ascent_game.is_displayed_clue(array(select jsonb_array_elements_text(board->'clues')),guess) then '{}'::jsonb else coalesce((select jsonb_object_agg(c.clue,case when rank=2 then 'Equivalent answer “'||answer_word||'” — '||r.reason else r.reason end)
 from picked cross join lateral jsonb_array_elements_text(board->'clues') with ordinality c(clue,i)
 cross join lateral jsonb_array_elements_text(a->'reasons') with ordinality r(reason,i)
 where c.i=r.i and r.reason is not null and not exists(select 1 from ascent_game.rejected_associations x where (x.clue=c.clue and x.word=any(ascent_game.guess_forms(guess)||array[answer_word])) or (x.word=c.clue and x.clue=any(ascent_game.guess_forms(guess)||array[answer_word])))),'{}'::jsonb) end
$function$;
