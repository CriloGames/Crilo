-- Crilo rarity calibration · RNGdle-style percentile and badge odds ladders
-- Based on 1,000,000 reproducible Crilo wheel simulations (fixed-seed
-- reference; integer score ties mean the bands are approximate).
--
-- IMPORTANT: Changes BADGE METADATA / score_band eligibility only.
-- Never edits verified Daily scores, spin sessions, earned achievements,
-- user profiles, owner Test Runs, RLS, or anything tied to reward verification.
begin;
-- The six BADGE rarity labels describe occurrence in a single official
-- Daily: Common >10%, Uncommon 1-10%, Rare 0.1-1%, Epic 0.01-0.1%,
-- Anomaly 0.001-0.01%, Mythic <0.001%.
update public.badges b
set requirement=jsonb_set(b.requirement,'{rarity}',to_jsonb(
 case
  when (b.requirement->>'probability_percent')::numeric>10 then 'common'
  when (b.requirement->>'probability_percent')::numeric>=1 then 'uncommon'
  when (b.requirement->>'probability_percent')::numeric>=0.1 then 'rare'
  when (b.requirement->>'probability_percent')::numeric>=0.01 then 'epic'
  when (b.requirement->>'probability_percent')::numeric>=0.001 then 'anomaly'
  else 'mythic'
 end
))
where b.requirement ? 'probability_percent'
 and b.requirement->>'type'<>'score_band'
 and (b.requirement->>'probability_percent')::numeric between 0 and 100;
-- Every SCORE tier has a separate achievement. Its badge rarity is based on
-- the chance to earn that particular tier; it is not automatically assigned
-- the same label as its SCORE rarity (e.g. "Mythic Score" is a Rare badge).
with calibrated(tier,minimum,maximum,percentage,badge_rarity) as(
 values
 ('trash',0::bigint,6::bigint,1.2370::numeric,'uncommon'),
 ('common',7,24,49.7661,'common'),
 ('uncommon',25,48,24.5551,'common'),
 ('rare',49,92,14.4894,'common'),
 ('epic',93,141,4.9887,'uncommon'),
 ('anomaly',142,318,3.9677,'uncommon'),
 ('mythic',319,null::bigint,0.9960,'rare')
)
update public.badges b
set requirement=b.requirement||jsonb_build_object(
 'min_score',c.minimum,'max_score',c.maximum,
 'rarity',c.badge_rarity,'probability_percent',c.percentage,
 'simulation_runs',1000000
),
description='Finish one official Daily with a final score of '||
 case when c.maximum is null then 'at least '||c.minimum
 else c.minimum||'–'||c.maximum end||'.'
from calibrated c
where b.badge_key='v2_score_rarity_'||c.tier
 and b.requirement->>'type'='score_band';
-- Do not silently succeed if the deployed score-band set has changed.
do $$ begin
 if (select count(*) from public.badges
     where badge_key like 'v2_score_rarity_%'
     and requirement->>'type'='score_band')<>7
 then raise exception 'Rarity migration expected exactly seven score-band badges';end if;
end $$;
commit;
