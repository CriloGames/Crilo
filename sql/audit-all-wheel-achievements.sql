-- Crilo: single-query, READ-ONLY audit of 20 wheel discovery achievements.
-- Run the ENTIRE script in Supabase SQL Editor. Only official Daily runs count.
-- Two reused milestone badges are catalog-only here (their original rules differ).
WITH badge_list(badge_key) AS (
 SELECT unnest(ARRAY[
 'wheel_dejavu','wheel_full_circle','wheel_lucky_seven','wheel_mirror',
 'wheel_groundhog','wheel_perfect_match','wheel_collector','wheel_against_odds',
 'wheel_one_each','wheel_long_way','wheel_quack_attack','wheel_comeback',
 'wheel_slow_starter','wheel_no_ducks','wheel_duck_dynasty',
 'wheel_small_beginnings','wheel_minimalist','wheel_chosen_one',
 'double_back2','upgrade_3'
 ]::text[])
),
official AS (
 SELECT r.id,r.user_id,r.daily_period,r.score,r.spins,r.ducks,r.upgrades,
        CASE WHEN jsonb_typeof(r.results)='array' THEN r.results ELSE '[]'::jsonb END AS results
 FROM public.daily_runs r WHERE r.is_test=false
),
spins AS (
 SELECT o.id,o.user_id,(e.ordinality-1)::int AS idx,
        e.value->>'type' AS kind,
        CASE WHEN e.value->>'type'='num' THEN 'num:'||coalesce(e.value->>'base','')
             ELSE e.value->>'type' END AS identity,
        coalesce(nullif(e.value->>'points','')::numeric,0) AS points
 FROM official o CROSS JOIN LATERAL jsonb_array_elements(o.results)
 WITH ORDINALITY AS e(value,ordinality)
),
spin_sequences AS (
 SELECT s.*,lag(identity) OVER (PARTITION BY id ORDER BY idx) AS prev1,
        lag(identity,2) OVER (PARTITION BY id ORDER BY idx) AS prev2,
        lag(identity,3) OVER (PARTITION BY id ORDER BY idx) AS prev3,
        lag(identity,4) OVER (PARTITION BY id ORDER BY idx) AS prev4,
        lag(kind) OVER (PARTITION BY id ORDER BY idx) AS prev_kind1,
        lag(kind,2) OVER (PARTITION BY id ORDER BY idx) AS prev_kind2,
        lag(kind,3) OVER (PARTITION BY id ORDER BY idx) AS prev_kind3
 FROM spins s
),
spin_flags AS (
 SELECT id,
  count(*) AS n,
  count(*) FILTER (WHERE kind='duck') AS duck_results,
  count(*) FILTER (WHERE kind='num') AS number_results,
  bool_and(kind='num') AS all_numbers,
  bool_or(kind='duck') AS has_duck,
  bool_or(kind='upgrade') AS has_upgrade,
  bool_or(kind='double') AS has_double,
  bool_or(kind='spins') AS has_spins,
  bool_and(points<=0) FILTER (WHERE idx<5) AS first_five_zero,
  (array_agg(kind ORDER BY idx))[1] AS first_kind,
  (array_agg(identity ORDER BY idx))[1] AS first_identity,
  array_agg(identity ORDER BY idx) FILTER (WHERE idx<3) AS first_three,
  (array_agg(points ORDER BY idx DESC) FILTER (WHERE points>0))[1] AS last_scoring,
  bool_or(kind='duck' AND prev_kind1='duck' AND prev_kind2='duck' AND prev_kind3='duck') AS four_ducks,
  bool_or(kind='num' AND identity=prev1 AND identity=prev2 AND identity=prev3 AND identity=prev4) AS five_same
 FROM spin_sequences GROUP BY id
),
runs AS (
 SELECT o.*,coalesce(f.n,0) AS n,coalesce(f.duck_results,0) AS duck_results,
 coalesce(f.number_results,0) AS number_results,coalesce(f.all_numbers,false) AS all_numbers,
 coalesce(f.has_duck,false) AS has_duck,coalesce(f.has_upgrade,false) AS has_upgrade,
 coalesce(f.has_double,false) AS has_double,coalesce(f.has_spins,false) AS has_spins,
 coalesce(f.first_five_zero,false) AS first_five_zero,
 f.first_kind,f.first_identity,f.first_three,coalesce(f.last_scoring,0) AS last_scoring,
 coalesce(f.four_ducks,false) AS four_ducks,coalesce(f.five_same,false) AS five_same,
 row_number() OVER (PARTITION BY o.user_id ORDER BY o.daily_period,o.id) AS run_number,
 first_value(o.score) OVER (PARTITION BY o.user_id ORDER BY o.daily_period,o.id) AS first_score,
 lag(o.daily_period) OVER (PARTITION BY o.user_id ORDER BY o.daily_period,o.id) AS prev_period,
 lag(o.score) OVER (PARTITION BY o.user_id ORDER BY o.daily_period,o.id) AS prev_score,
 lag(f.first_three) OVER (PARTITION BY o.user_id ORDER BY o.daily_period,o.id) AS prev_three
 FROM official o LEFT JOIN spin_flags f USING(id)
),
seen AS (
 SELECT DISTINCT user_id,identity FROM spins
),
eligible AS (
 SELECT DISTINCT r.user_id,v.badge_key
 FROM runs r CROSS JOIN LATERAL (VALUES
 ('wheel_dejavu',r.prev_period IS NOT NULL AND r.daily_period=r.prev_period+1 AND r.score=r.prev_score),
 ('wheel_full_circle',r.run_number>1 AND r.score=r.first_score),
 ('wheel_lucky_seven',(SELECT count(*) FROM runs x WHERE x.user_id=r.user_id AND mod(x.score,10)=7)>=7),
 ('wheel_mirror',EXISTS(SELECT 1 FROM runs x WHERE x.user_id=r.user_id AND x.id<>r.id AND x.score::text=reverse(r.score::text))),
 ('wheel_groundhog',r.prev_period IS NOT NULL AND r.daily_period=r.prev_period+1 AND r.n>=3 AND cardinality(r.prev_three)=3 AND r.first_three=r.prev_three),
 ('wheel_perfect_match',EXISTS(SELECT 1 FROM runs x WHERE x.user_id<>r.user_id AND x.daily_period=r.daily_period AND x.score=r.score)),
 ('wheel_collector',NOT EXISTS(SELECT 1 FROM unnest(ARRAY['num:1','num:2','num:3','num:5','duck','double','upgrade','spins']) needed(identity) WHERE NOT EXISTS(SELECT 1 FROM seen s WHERE s.user_id=r.user_id AND s.identity=needed.identity))),
 ('wheel_against_odds',r.ducks>=5 AND r.upgrades=0),
 ('wheel_one_each',r.has_duck AND r.has_upgrade AND r.has_double AND r.has_spins),
 ('wheel_long_way',r.spins>=20),
 ('wheel_quack_attack',r.four_ducks),
 ('wheel_comeback',r.score>0 AND r.last_scoring>r.score/2),
 ('wheel_slow_starter',r.n>=6 AND r.first_five_zero AND r.score>0),
 ('wheel_no_ducks',r.ducks=0),
 ('wheel_duck_dynasty',r.n>0 AND r.duck_results>r.number_results),
 ('wheel_small_beginnings',r.n>0 AND r.first_identity='num:1' AND r.score>=1000),
 ('wheel_minimalist',r.n=5 AND r.all_numbers AND r.spins=5),
 ('wheel_chosen_one',r.five_same)
 ) v(badge_key,qualifies) WHERE v.qualifies
),
players AS (SELECT DISTINCT user_id FROM official),
counts AS (
 SELECT b.badge_key,
  (SELECT count(*) FROM eligible e WHERE e.badge_key=b.badge_key) AS qualifying_players,
  (SELECT count(*) FROM eligible e JOIN public.user_badges ub ON ub.user_id=e.user_id JOIN public.badges bb ON bb.id=ub.badge_id AND bb.badge_key=e.badge_key WHERE e.badge_key=b.badge_key) AS correctly_awarded,
  (SELECT count(*) FROM eligible e WHERE e.badge_key=b.badge_key AND NOT EXISTS(SELECT 1 FROM public.user_badges ub JOIN public.badges bb ON bb.id=ub.badge_id WHERE ub.user_id=e.user_id AND bb.badge_key=e.badge_key)) AS missing_awards,
  (SELECT count(*) FROM public.user_badges ub JOIN public.badges bb ON bb.id=ub.badge_id WHERE bb.badge_key=b.badge_key AND NOT EXISTS(SELECT 1 FROM eligible e WHERE e.badge_key=b.badge_key AND e.user_id=ub.user_id)) AS unexpected_awards
 FROM badge_list b
)
SELECT b.badge_key,coalesce(bd.name,'MISSING') AS badge_name,
 CASE WHEN bd.id IS NULL THEN 'MISSING BADGE'
      WHEN b.badge_key IN ('double_back2','upgrade_3') THEN 'MILESTONE - NOT AUDITED'
      WHEN c.missing_awards>0 OR c.unexpected_awards>0 THEN 'REVIEW'
      ELSE 'PASS' END AS status,
 CASE WHEN b.badge_key IN ('double_back2','upgrade_3') THEN NULL ELSE c.qualifying_players END AS qualifying_players,
 CASE WHEN b.badge_key IN ('double_back2','upgrade_3') THEN NULL ELSE c.correctly_awarded END AS correctly_awarded,
 CASE WHEN b.badge_key IN ('double_back2','upgrade_3') THEN NULL ELSE c.missing_awards END AS missing_awards,
 CASE WHEN b.badge_key IN ('double_back2','upgrade_3') THEN NULL ELSE c.unexpected_awards END AS unexpected_awards
FROM badge_list b LEFT JOIN public.badges bd ON bd.badge_key=b.badge_key
JOIN counts c ON c.badge_key=b.badge_key
ORDER BY b.badge_key;
