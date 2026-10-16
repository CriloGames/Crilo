-- Spin History totals include Bonus Run spins; existing verified grouping,
-- private Bonus drawings, owner Test exclusion and artwork remain unchanged.
-- Spin History: one day card with its best score and an optional list
-- of every Official Daily and server-verified badge-unlocked Bonus Run.
-- This is a public, read-only projection like existing Statistics artwork.
-- BONUS artwork and spin outcomes are never included, even for the owner.
-- Historic official Dailies are kept (including pre-verification saves).
CREATE OR REPLACE FUNCTION public.crilo_grouped_spin_history(
 p_user uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH official AS MATERIALIZED (
 SELECT d.id::text AS id,d.user_id,d.daily_period,d.score,d.spins,
  d.upgrades,d.doubles,d.ducks,d.drawing,d.created_at,
  'official'::text AS source,0::integer AS slot
 FROM public.daily_runs d
 WHERE d.user_id=p_user AND d.is_test=false
),
bonus AS MATERIALIZED (
 SELECT b.id::text,b.user_id,b.daily_period,b.score,b.spins,
  b.upgrades,b.doubles,b.ducks,
  NULL::text AS drawing, -- Bonus drawings are private.
  b.completed_at,'bonus'::text AS source,b.slot::integer
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
   AND s.daily_period=b.daily_period AND s.slot=b.slot
   AND s.finished_at IS NOT NULL AND s.remaining_spins=0
   AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
   AND jsonb_array_length(s.results)=s.spin_count
 WHERE b.user_id=p_user
 AND EXISTS (
  SELECT 1 FROM public.daily_runs d
  WHERE d.user_id=b.user_id AND d.daily_period=b.daily_period
   AND d.is_test=false AND d.verified_spin_session_id IS NOT NULL
 )
 AND NOT EXISTS (
  SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
  WHERE h.bonus_run_id=b.id
 )
 AND NOT EXISTS (
  SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period
 )
),
combined AS (
 SELECT * FROM official
 UNION ALL
 SELECT * FROM bonus
),
grouped AS (
 SELECT c.daily_period,count(*)::integer AS run_count,
  jsonb_agg(jsonb_build_object(
   'id',c.id,'source',c.source,'slot',c.slot,'score',c.score,
   'spins',c.spins,'upgrades',c.upgrades,'doubles',c.doubles,
   'ducks',c.ducks,'drawing',c.drawing,'created_at',c.created_at
  ) ORDER BY c.score DESC,c.created_at ASC,c.slot,c.id) AS runs
 FROM combined c GROUP BY c.daily_period
),
paged AS (
 SELECT daily_period,run_count,runs,runs->0 AS best
 FROM grouped
 ORDER BY daily_period DESC
 LIMIT LEAST(GREATEST(COALESCE(p_limit,5),1),25)
 OFFSET LEAST(GREATEST(COALESCE(p_offset,0),0),100000)
)
SELECT jsonb_build_object(
 'days',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'daily_period',p.daily_period,'run_count',p.run_count,
   'best',p.best,'runs',p.runs
  ) ORDER BY p.daily_period DESC)
  FROM paged p
 ),'[]'::jsonb),
 'total_dailies',(SELECT count(*)::integer FROM grouped),
 'official_dailies',(SELECT count(*)::integer FROM official),
 'official_spins',(SELECT coalesce(sum(greatest(0,spins)),0)::bigint FROM official),
 'bonus_runs',(SELECT count(*)::integer FROM bonus),
 'bonus_spins',(SELECT coalesce(sum(greatest(0,spins)),0)::bigint FROM bonus)
)
$fn$;
REVOKE ALL ON FUNCTION public.crilo_grouped_spin_history(uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_grouped_spin_history(uuid,integer,integer) TO anon,authenticated;
COMMENT ON FUNCTION public.crilo_grouped_spin_history(uuid,integer,integer) IS
'Paginated Statistics history: highest saved score per Daily date, all genuine official and eligible Bonus runs available in a group; Bonus artwork always private. Owner Test Runs excluded.';
