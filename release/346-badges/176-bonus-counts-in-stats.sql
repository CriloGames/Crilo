-- Keep Bonus Runs ranked and counted in gameplay statistics without ever
-- granting badge awards, streak credit, or access to private Bonus artwork.
-- Read-only summaries; no stored scores or badge rows are rewritten.
CREATE OR REPLACE FUNCTION public.crilo_profile_metrics(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH official AS MATERIALIZED (
 SELECT d.id::text AS id,d.user_id,d.daily_period,d.score,d.spins,d.upgrades,
  d.doubles,d.ducks,d.extra_spins,d.best_roll_points,d.created_at,
  'official'::text AS source,0::integer AS slot
 FROM public.daily_runs d WHERE d.is_test=false
), bonus AS MATERIALIZED (
 SELECT b.id::text,b.user_id,b.daily_period,b.score,b.spins,b.upgrades,
  b.doubles,b.ducks,b.extra_spins,b.best_roll_points,b.completed_at,
  'bonus'::text,b.slot::integer
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
  AND s.daily_period=b.daily_period AND s.slot=b.slot
  AND s.finished_at IS NOT NULL AND s.remaining_spins=0
  AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
  AND jsonb_array_length(s.results)=s.spin_count
 WHERE EXISTS (
  SELECT 1 FROM public.daily_runs d WHERE d.user_id=b.user_id
  AND d.daily_period=b.daily_period AND d.is_test=false
  AND d.verified_spin_session_id IS NOT NULL
 )
 AND NOT EXISTS(SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
                WHERE h.bonus_run_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties p
                WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period)
), combined AS (
 SELECT * FROM official UNION ALL SELECT * FROM bonus
), mine AS (
 SELECT * FROM combined WHERE user_id=p_user
), dates AS (
 SELECT DISTINCT daily_period FROM official WHERE user_id=p_user
), numbered AS (
 SELECT daily_period,daily_period-(row_number() OVER(ORDER BY daily_period))::int AS grp FROM dates
), streaks AS (
 SELECT count(*)::int AS days FROM numbered GROUP BY grp
), best_per_day AS (
 SELECT user_id,daily_period,max(score) AS score FROM combined GROUP BY user_id,daily_period
), ranks AS (
 SELECT user_id,daily_period,
  dense_rank() OVER(PARTITION BY daily_period ORDER BY score DESC) AS place
 FROM best_per_day
 WHERE daily_period < ((now() AT TIME ZONE 'UTC'-interval '22 hours')::date)
), myr AS (
 SELECT place FROM ranks WHERE user_id=p_user
), summary AS (
 SELECT count(*) FILTER(WHERE source='official')::int AS official_runs,
 count(*) FILTER(WHERE source='bonus')::int AS bonus_runs,
 count(*)::int AS all_runs,
 coalesce(max(score),0) AS best_score,
 coalesce(round(avg(score),2),0) AS average_score,
 coalesce(sum(score),0) AS total_points,
 coalesce(sum(spins),0) AS total_spins,
 coalesce(sum(upgrades),0) AS total_upgrades,
 coalesce(sum(doubles),0) AS total_doubles,
 coalesce(sum(ducks),0) AS total_ducks,
 coalesce(sum(extra_spins),0) AS total_extra_spins,
 coalesce(max(best_roll_points),0) AS best_roll_points
 FROM mine
), best_run AS (
 SELECT jsonb_build_object(
 'id',id,'source',source,'slot',slot,'daily_period',daily_period,
 'score',score,'spins',spins,'upgrades',upgrades,'doubles',doubles,
 'ducks',ducks,'extra_spins',extra_spins,'best_roll_points',best_roll_points
 ) AS detail
 FROM mine ORDER BY score DESC,created_at ASC,id ASC LIMIT 1
)
SELECT jsonb_build_object(
 'official_runs',summary.official_runs,'bonus_runs',summary.bonus_runs,
 'all_runs',summary.all_runs,
 'best_score',summary.best_score,'average_score',summary.average_score,
 'total_points',summary.total_points,'total_spins',summary.total_spins,
 'total_upgrades',summary.total_upgrades,'total_doubles',summary.total_doubles,
 'total_ducks',summary.total_ducks,'total_extra_spins',summary.total_extra_spins,
 'best_roll_points',summary.best_roll_points,
 'best_run',(SELECT detail FROM best_run),
 'best_daily_rank',(SELECT min(place) FROM myr),
 'daily_wins',(SELECT count(*) FROM myr WHERE place=1),
 'podium_finishes',(SELECT count(*) FROM myr WHERE place<=3),
 'top_10_finishes',(SELECT count(*) FROM myr WHERE place<=10),
 'longest_streak',coalesce((SELECT max(days) FROM streaks),0),
 'current_streak',public.crilo_warning_current_streak(p_user)
) FROM summary
$fn$;

CREATE OR REPLACE FUNCTION public.crilo_total_points_leaders(p_limit integer DEFAULT 100)
RETURNS TABLE(user_id uuid,username text,name_color text,total_points numeric,official_runs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH official AS (
 SELECT d.user_id,sum(d.score)::numeric AS points,count(*)::bigint AS runs
 FROM public.daily_runs d
 WHERE d.is_test=false AND d.verified_spin_session_id IS NOT NULL
 GROUP BY d.user_id
), bonus AS (
 SELECT b.user_id,sum(b.score)::numeric AS points
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
  AND s.daily_period=b.daily_period AND s.slot=b.slot
  AND s.finished_at IS NOT NULL AND s.remaining_spins=0
  AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
  AND jsonb_array_length(s.results)=s.spin_count
 WHERE EXISTS(SELECT 1 FROM public.daily_runs d WHERE d.user_id=b.user_id
  AND d.daily_period=b.daily_period AND d.is_test=false
  AND d.verified_spin_session_id IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
  WHERE h.bonus_run_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period)
 GROUP BY b.user_id
)
SELECT p.id,p.username,p.name_color,
 (o.points+coalesce(b.points,0))::numeric AS total_points,o.runs AS official_runs
FROM official o JOIN public.profiles p ON p.id=o.user_id
LEFT JOIN bonus b ON b.user_id=o.user_id
ORDER BY total_points DESC,o.runs DESC,p.id
LIMIT least(greatest(coalesce(p_limit,100),1),100)
$fn$;

CREATE OR REPLACE FUNCTION public.crilo_lifetime_duck_leaders(p_limit integer DEFAULT 100)
RETURNS TABLE(user_id uuid,ducks bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH official AS (
 SELECT d.user_id,sum(greatest(d.ducks,0))::bigint AS count
 FROM public.daily_runs d
 WHERE d.is_test=false AND d.verified_spin_session_id IS NOT NULL
 GROUP BY d.user_id
), bonus AS (
 SELECT b.user_id,sum(greatest(b.ducks,0))::bigint AS count
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
  AND s.daily_period=b.daily_period AND s.slot=b.slot
  AND s.finished_at IS NOT NULL AND s.remaining_spins=0
  AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
  AND jsonb_array_length(s.results)=s.spin_count
 WHERE EXISTS(SELECT 1 FROM public.daily_runs d WHERE d.user_id=b.user_id
  AND d.daily_period=b.daily_period AND d.is_test=false
  AND d.verified_spin_session_id IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
  WHERE h.bonus_run_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period)
 GROUP BY b.user_id
)
SELECT o.user_id,(o.count+coalesce(b.count,0))::bigint AS ducks
FROM official o LEFT JOIN bonus b ON b.user_id=o.user_id
ORDER BY ducks DESC,o.user_id
LIMIT least(greatest(coalesce(p_limit,100),1),100)
$fn$;
REVOKE ALL ON FUNCTION public.crilo_lifetime_duck_leaders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_lifetime_duck_leaders(integer) TO anon,authenticated;
COMMENT ON FUNCTION public.crilo_lifetime_duck_leaders(integer)
 IS 'Public lifetime ducks from verified Official and eligible Bonus runs; owner Test Runs excluded.';
