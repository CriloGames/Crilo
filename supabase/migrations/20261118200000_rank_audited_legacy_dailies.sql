-- Nov 18, 2026: keep ALL legitimate scores ranked, without admitting Test Runs
-- or the two explicitly excluded pre-proof preview/example records.
-- Historical runs are admitted only after checking their original October 14
-- snapshot, spin-by-spin history, converted score, and explicit audited ID.
-- We intentionally do NOT modify any saved Daily, bonus, user, or badge row.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crilo_ranked_legacy_dailies(
 run_id bigint PRIMARY KEY REFERENCES public.daily_runs(id) ON DELETE CASCADE,
 saved_score bigint NOT NULL CHECK(saved_score>=0),
 audited_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.crilo_ranked_legacy_dailies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_ranked_legacy_dailies FROM PUBLIC,anon,authenticated;

INSERT INTO public.crilo_ranked_legacy_dailies(run_id,saved_score)
SELECT d.id,d.score
FROM public.daily_runs d
JOIN crilo_wheel_20261014.daily_runs historical ON historical.id=d.id
WHERE d.id IN (5,6,7,1686)
 AND d.is_test=false
 AND historical.is_test=false
 AND d.verified_spin_session_id IS NULL
 AND d.daily_period<'2026-10-09'
 AND jsonb_typeof(d.results)='array'
 AND jsonb_typeof(historical.results)='array'
 AND jsonb_array_length(d.results)=d.spins
 AND jsonb_array_length(historical.results)=historical.spins
 AND d.spins>=5
 AND crilo_wheel_20261014.history_score(d.results)=d.score
 AND NOT EXISTS(
  SELECT 1 FROM public.crilo_daily_penalties pen
  WHERE pen.user_id=d.user_id AND pen.daily_period=d.daily_period
 )
ON CONFLICT (run_id) DO NOTHING;

DO $crilo_audit$
DECLARE total_count integer;
BEGIN
 SELECT count(*) INTO total_count FROM public.crilo_ranked_legacy_dailies;
 IF total_count<>4 THEN
  RAISE EXCEPTION 'Historical Daily audit mismatch: expected four, found %',total_count;
 END IF;
 IF EXISTS(
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  JOIN public.daily_runs d ON d.id=legacy.run_id
  WHERE d.is_test IS DISTINCT FROM false
    OR d.score<>legacy.saved_score
 ) THEN
  RAISE EXCEPTION 'A historical score changed after audit';
 END IF;
END $crilo_audit$;
COMMENT ON TABLE public.crilo_ranked_legacy_dailies IS
 'Four verified-by-history pre-server-proof Official Dailies; never includes owner sample records or Test Runs.';

-- Align crilo_grouped_daily_leaders with both server-proven and individually audited historical Dailies.
CREATE OR REPLACE FUNCTION public.crilo_grouped_daily_leaders(p_board text DEFAULT 'today'::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id text, user_id uuid, daily_period date, score bigint, spins integer, upgrades integer, doubles integer, ducks integer, drawing text, rarity_odds numeric, rarity_label text, created_at timestamp with time zone, verified_spin_session_id uuid, source text, slot integer, group_count integer, group_runs jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH period_bound AS (
 SELECT ((now() AT TIME ZONE 'UTC')-interval '22 hours')::date AS today
),
official AS (
 SELECT d.id::text AS id,d.user_id,d.daily_period,d.score,d.spins,
  d.upgrades,d.doubles,d.ducks,d.drawing,d.rarity_odds,d.rarity_label,
  d.created_at,d.verified_spin_session_id,'official'::text AS source,
  0::integer AS slot
 FROM public.daily_runs d
 WHERE d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
),
eligible AS (
 SELECT * FROM official
 UNION ALL
 SELECT b.id::text,b.user_id,b.daily_period,b.score,b.spins,
  b.upgrades,b.doubles,b.ducks,
  CASE WHEN coalesce(br.status,'pending') <> 'removed' AND coalesce(br.ai_status,'pending') <> 'flagged' THEN b.drawing ELSE NULL::text END AS drawing,
  NULL::numeric AS rarity_odds,NULL::text AS rarity_label,
  b.completed_at,b.spin_session_id,'bonus'::text AS source,
  b.slot::integer AS slot
 FROM public.crilo_bonus_runs b
 LEFT JOIN public.crilo_bonus_drawing_reviews br ON br.bonus_run_id=b.id
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
    'ducks',e.ducks,'drawing',e.drawing,'created_at',e.created_at,
    'featured', coalesce(chosen.source=e.source AND chosen.run_id=e.id,false)
   )
   ORDER BY
    CASE WHEN p_board='records' THEN e.spins END DESC NULLS LAST,
    e.score DESC,e.created_at ASC,e.slot,e.id
  ) AS group_runs
 FROM scoped e
 LEFT JOIN public.crilo_featured_daily_drawings chosen
 ON chosen.user_id=e.user_id AND chosen.daily_period=e.daily_period
 GROUP BY e.user_id,e.daily_period
)
SELECT b.id,b.user_id,b.daily_period,b.score,b.spins,b.upgrades,
 b.doubles,b.ducks,
 COALESCE((SELECT chosen_drawing.drawing FROM eligible chosen_drawing
   JOIN public.crilo_featured_daily_drawings choice
    ON choice.user_id=chosen_drawing.user_id AND choice.daily_period=chosen_drawing.daily_period
    AND choice.source=chosen_drawing.source AND choice.run_id=chosen_drawing.id
   WHERE chosen_drawing.user_id=b.user_id AND chosen_drawing.daily_period=b.daily_period
    AND chosen_drawing.drawing IS NOT NULL
   LIMIT 1),b.drawing) AS drawing,
 b.rarity_odds,b.rarity_label,
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
$function$
;

-- Align crilo_lifetime_duck_leaders with both server-proven and individually audited historical Dailies.
CREATE OR REPLACE FUNCTION public.crilo_lifetime_duck_leaders(p_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, ducks bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH official AS (
 SELECT d.user_id,sum(greatest(d.ducks,0))::bigint AS count
 FROM public.daily_runs d
 WHERE d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
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
$function$
;

-- Align crilo_profile_metrics with both server-proven and individually audited historical Dailies.
CREATE OR REPLACE FUNCTION public.crilo_profile_metrics(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH official AS MATERIALIZED (
 SELECT d.id::text AS id,d.user_id,d.daily_period,d.score,d.spins,d.upgrades,
  d.doubles,d.ducks,d.extra_spins,d.best_roll_points,d.created_at,
  'official'::text AS source,0::integer AS slot
 FROM public.daily_runs d WHERE d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
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
$function$
;

-- Align crilo_public_run_leaders with both server-proven and individually audited historical Dailies.
CREATE OR REPLACE FUNCTION public.crilo_public_run_leaders(p_board text DEFAULT 'today'::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id text, user_id uuid, daily_period date, score bigint, spins integer, upgrades integer, doubles integer, ducks integer, drawing text, rarity_odds numeric, rarity_label text, created_at timestamp with time zone, verified_spin_session_id uuid, source text, slot integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH bounds AS (
 SELECT ((now() AT TIME ZONE 'UTC')-interval '22 hours')::date AS today
),
eligible AS (
 SELECT d.id::text,d.user_id,d.daily_period,d.score,d.spins,
  d.upgrades,d.doubles,d.ducks,d.drawing,d.rarity_odds,d.rarity_label,
  d.created_at,d.verified_spin_session_id,'official'::text AS source,
  0::integer AS slot
 FROM public.daily_runs d
 WHERE d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
 UNION ALL
 SELECT b.id::text,b.user_id,b.daily_period,b.score,b.spins,
  b.upgrades,b.doubles,b.ducks,
  NULL::text AS drawing, -- Bonus drawings were saved privately.
  NULL::numeric AS rarity_odds,NULL::text AS rarity_label,
  b.completed_at,b.spin_session_id,'bonus'::text AS source,b.slot::integer
 FROM public.crilo_bonus_runs b
 JOIN public.crilo_bonus_spin_sessions s
  ON s.id=b.spin_session_id AND s.user_id=b.user_id
    AND s.daily_period=b.daily_period AND s.slot=b.slot
    AND s.finished_at IS NOT NULL AND s.remaining_spins=0
    AND s.spin_count=b.spins AND s.score=b.score AND s.spin_count>=5
    AND jsonb_array_length(s.results)=s.spin_count
 JOIN public.daily_runs d
  ON d.user_id=b.user_id AND d.daily_period=b.daily_period
    AND d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
 WHERE NOT EXISTS (
   SELECT 1 FROM public.crilo_hidden_bonus_leaderboard_runs h
   WHERE h.bonus_run_id=b.id
 ) AND NOT EXISTS (
   SELECT 1 FROM public.crilo_daily_penalties p
   WHERE p.user_id=b.user_id AND p.daily_period=b.daily_period
 )
)
SELECT e.id,e.user_id,e.daily_period,e.score,e.spins,e.upgrades,
 e.doubles,e.ducks,e.drawing,e.rarity_odds,e.rarity_label,
 e.created_at,e.verified_spin_session_id,e.source,e.slot
FROM eligible e CROSS JOIN bounds t
WHERE p_board IN ('today','week','all','records')
 AND (p_board NOT IN ('today','week')
  OR (p_board='today' AND e.daily_period=t.today)
  OR (p_board='week' AND e.daily_period>=t.today-6))
ORDER BY
 CASE WHEN p_board='records' THEN e.spins END DESC NULLS LAST,
 e.score DESC,e.created_at ASC,e.user_id,e.slot,e.id
LIMIT least(greatest(coalesce(p_limit,100),1),100)
$function$
;

-- Align crilo_total_points_leaders with both server-proven and individually audited historical Dailies.
CREATE OR REPLACE FUNCTION public.crilo_total_points_leaders(p_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, username text, name_color text, total_points numeric, official_runs bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH official AS (
 SELECT d.user_id,sum(d.score)::numeric AS points,count(*)::bigint AS runs
 FROM public.daily_runs d
 WHERE d.is_test=false AND (d.verified_spin_session_id IS NOT NULL OR EXISTS (
  SELECT 1 FROM public.crilo_ranked_legacy_dailies legacy
  WHERE legacy.run_id=d.id AND legacy.saved_score=d.score
 ))
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
$function$
;

-- Public ranking functions intentionally expose eligible scores, but the
-- audit allowlist itself is private and not selectable via the Data API.
COMMENT ON FUNCTION public.crilo_grouped_daily_leaders(text,integer) IS
 'Best eligible Official/Bonus per user/day, with all eligible run details; audited legacy full-spin-history Dailies included; Test Runs and preview examples excluded.';
COMMIT;
