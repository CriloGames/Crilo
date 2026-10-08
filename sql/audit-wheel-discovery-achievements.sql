-- Crilo wheel badge verification: READ-ONLY (no badges awarded or removed).
-- Shows catalog, trigger, and potential false-positive / missing award evidence.
WITH expected(badge_key) AS (
 SELECT unnest(ARRAY[
 'wheel_dejavu','wheel_full_circle','wheel_lucky_seven','wheel_mirror',
 'wheel_groundhog','wheel_perfect_match','wheel_collector','wheel_against_odds',
 'wheel_one_each','wheel_long_way','wheel_quack_attack','wheel_comeback',
 'wheel_slow_starter','wheel_no_ducks','wheel_duck_dynasty',
 'wheel_small_beginnings','wheel_minimalist','wheel_chosen_one',
 'double_back2','upgrade_3'
 ]::text[])
)
SELECT e.badge_key,coalesce(b.name,'MISSING') AS name,
 CASE WHEN b.id IS NULL THEN 'MISSING' ELSE 'OK' END AS catalog_status,
 count(ub.badge_id) AS unlocks
FROM expected e LEFT JOIN public.badges b USING(badge_key)
LEFT JOIN public.user_badges ub ON ub.badge_id=b.id
GROUP BY e.badge_key,b.id,b.name ORDER BY e.badge_key;

-- Confirm the official-run trigger is installed and enabled.
SELECT tgname, tgenabled,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE tgrelid='public.daily_runs'::regclass
AND tgname='crilo_wheel_discoveries_on_daily';

-- Audit simple badge conditions against official runs.
-- Mismatches are suspicious, not necessarily proof of a bug (historical data
-- may have been edited or results missing).
WITH official AS (
 SELECT r.user_id,r.id,r.daily_period,r.score,r.spins,r.ducks,r.upgrades,
        coalesce(r.results,'[]'::jsonb) AS results
 FROM public.daily_runs r WHERE r.is_test=false
), run_flags AS (
 SELECT o.*,
   NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.results) x WHERE x->>'type'<>'num') AS numbers_only,
   (SELECT count(*) FROM jsonb_array_elements(o.results) x WHERE x->>'type'='duck') AS result_ducks,
   (SELECT count(*) FROM jsonb_array_elements(o.results) x WHERE x->>'type'='num') AS result_numbers
 FROM official o
), conditions AS (
 SELECT 'wheel_against_odds'::text badge_key,user_id,
   bool_or(ducks>=5 AND upgrades=0) eligible FROM run_flags GROUP BY user_id
 UNION ALL SELECT 'wheel_long_way',user_id,bool_or(spins>=20) FROM run_flags GROUP BY user_id
 UNION ALL SELECT 'wheel_no_ducks',user_id,bool_or(ducks=0) FROM run_flags GROUP BY user_id
 UNION ALL SELECT 'wheel_minimalist',user_id,
   bool_or(spins=5 AND jsonb_array_length(results)=5 AND numbers_only)
 FROM run_flags GROUP BY user_id
 UNION ALL SELECT 'wheel_duck_dynasty',user_id,
   bool_or(jsonb_array_length(results)>0 AND result_ducks>result_numbers)
 FROM run_flags GROUP BY user_id
), actual AS (
 SELECT b.badge_key,ub.user_id FROM public.user_badges ub
 JOIN public.badges b ON b.id=ub.badge_id
 WHERE b.badge_key LIKE 'wheel_%'
)
SELECT c.badge_key,
 count(*) FILTER(WHERE c.eligible) AS qualifying_players,
 count(*) FILTER(WHERE c.eligible AND a.user_id IS NOT NULL) AS correctly_awarded,
 count(*) FILTER(WHERE c.eligible AND a.user_id IS NULL) AS missing_awards,
 count(*) FILTER(WHERE NOT c.eligible AND a.user_id IS NOT NULL) AS unexpected_awards
FROM conditions c LEFT JOIN actual a ON a.badge_key=c.badge_key AND a.user_id=c.user_id
GROUP BY c.badge_key ORDER BY c.badge_key;

-- Look for existing accounts with awards but no official Daily whatsoever.
SELECT count(DISTINCT ub.user_id) AS wheel_award_users_without_official_runs
FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
WHERE b.badge_key LIKE 'wheel_%'
AND NOT EXISTS(SELECT 1 FROM public.daily_runs r WHERE r.user_id=ub.user_id AND r.is_test=false);
