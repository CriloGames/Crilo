-- Rank the highest completed run per player per Daily while keeping ALL
-- validated official and badge-unlocked Bonus Runs in a read-only expansion.
-- Rank the top 100 AFTER grouping, not before, to avoid one user
-- crowding other players off the leaderboard.
-- Never expose private Bonus artwork, spin histories, Test Runs, penalties.
BEGIN;
CREATE OR REPLACE FUNCTION public.crilo_grouped_daily_leaders(
 p_board text DEFAULT 'today', p_limit integer DEFAULT 100
)
RETURNS TABLE(
 id text, user_id uuid, daily_period date, score bigint, spins integer,
 upgrades integer, doubles integer, ducks integer, drawing text,
 rarity_odds numeric, rarity_label text, created_at timestamptz,
 verified_spin_session_id uuid, source text, slot integer,
 group_count integer, group_runs jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH period_bound AS (
 SELECT ((now() AT TIME ZONE 'UTC')-interval '22 hours')::date AS today
),
official AS (
 SELECT d.id::text AS id,d.user_id,d.daily_period,d.score,d.spins,
  d.upgrades,d.doubles,d.ducks,d.drawing,d.rarity_odds,d.rarity_label,
  d.created_at,d.verified_spin_session_id,'official'::text AS source,
  0::integer AS slot
 FROM public.daily_runs d
 WHERE d.is_test=false AND d.verified_spin_session_id IS NOT NULL
),
eligible AS (
 SELECT * FROM official
 UNION ALL
 SELECT b.id::text,b.user_id,b.daily_period,b.score,b.spins,
  b.upgrades,b.doubles,b.ducks,
  NULL::text AS drawing, -- Private Bonus artwork must not be published.
  NULL::numeric AS rarity_odds,NULL::text AS rarity_label,
  b.completed_at,b.spin_session_id,'bonus'::text AS source,
  b.slot::integer AS slot
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
   AND s.daily_period=b.daily_period AND s.slot=b.slot
   AND s.finished_at IS NOT NULL AND s.remaining_spins=0
   AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
   AND jsonb_array_length(s.results)=s.spin_count
 JOIN official d ON d.user_id=b.user_id AND d.daily_period=b.daily_period
 WHERE NOT EXISTS (
  SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
  WHERE h.bonus_run_id=b.id
 ) AND NOT EXISTS (
  SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period
 )
),
scoped AS (
 SELECT e.* FROM eligible e CROSS JOIN period_bound t
 WHERE p_board IN ('today','week','all','records')
  AND (p_board NOT IN ('today','week')
   OR (p_board='today' AND e.daily_period=t.today)
   OR (p_board='week' AND e.daily_period>=t.today-6))
),
best AS (
 SELECT e.*,
  row_number() OVER (
   PARTITION BY e.user_id,e.daily_period
   ORDER BY
    CASE WHEN p_board='records' THEN e.spins END DESC NULLS LAST,
    e.score DESC,e.created_at ASC,e.slot,e.id
  ) AS position
 FROM scoped e
),
all_runs AS (
 SELECT e.user_id,e.daily_period,count(*)::integer AS group_count,
  jsonb_agg(
   jsonb_build_object(
    'id',e.id,'source',e.source,'slot',e.slot,'score',e.score,
    'spins',e.spins,'upgrades',e.upgrades,'doubles',e.doubles,
    'ducks',e.ducks,'drawing',e.drawing,'created_at',e.created_at
   )
   ORDER BY
    CASE WHEN p_board='records' THEN e.spins END DESC NULLS LAST,
    e.score DESC,e.created_at ASC,e.slot,e.id
  ) AS group_runs
 FROM scoped e
 GROUP BY e.user_id,e.daily_period
)
SELECT b.id,b.user_id,b.daily_period,b.score,b.spins,b.upgrades,
 b.doubles,b.ducks,b.drawing,b.rarity_odds,b.rarity_label,
 b.created_at,b.verified_spin_session_id,b.source,b.slot,
 grouped.group_count,grouped.group_runs
FROM best b
JOIN all_runs grouped ON grouped.user_id=b.user_id
 AND grouped.daily_period=b.daily_period
WHERE b.position=1
ORDER BY
 CASE WHEN p_board='records' THEN b.spins END DESC NULLS LAST,
 b.score DESC,b.created_at ASC,b.user_id,b.daily_period,b.id
LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100)
$fn$;
REVOKE ALL ON FUNCTION public.crilo_grouped_daily_leaders(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_grouped_daily_leaders(text,integer) TO anon,authenticated;
COMMENT ON FUNCTION public.crilo_grouped_daily_leaders(text,integer) IS
'Public grouped Daily scoreboard: highest eligible score per user/date (longest for records), with full verified official/Bonus run list inside collapsed groups and private Bonus artwork omitted';
COMMIT;