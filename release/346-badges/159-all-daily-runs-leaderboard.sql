-- Every verified Official Daily and finished Bonus Run is ranked separately.
-- Preserve private bonus artwork/histories and official-only lifetime stats.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crilo_hidden_bonus_leaderboard_runs (
 bonus_run_id uuid PRIMARY KEY REFERENCES public.crilo_bonus_runs(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 240),
 hidden_by uuid NOT NULL REFERENCES auth.users(id),
 hidden_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.crilo_hidden_bonus_leaderboard_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_hidden_bonus_leaderboard_runs FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crilo_public_run_leaders(
 p_board text DEFAULT 'today',p_limit integer DEFAULT 100
)
RETURNS TABLE (
 id text,user_id uuid,daily_period date,score bigint,spins integer,
 upgrades integer,doubles integer,ducks integer,drawing text,
 rarity_odds numeric,rarity_label text,created_at timestamptz,
 verified_spin_session_id uuid,source text,slot integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $func$
WITH bounds AS (
 SELECT ((now() AT TIME ZONE 'UTC')-interval '22 hours')::date AS today
),
eligible AS (
 SELECT d.id::text,d.user_id,d.daily_period,d.score,d.spins,
  d.upgrades,d.doubles,d.ducks,d.drawing,d.rarity_odds,d.rarity_label,
  d.created_at,d.verified_spin_session_id,'official'::text AS source,
  0::integer AS slot
 FROM public.daily_runs d
 WHERE d.is_test=false AND d.verified_spin_session_id IS NOT NULL
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
    AND d.is_test=false AND d.verified_spin_session_id IS NOT NULL
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
$func$;
REVOKE ALL ON FUNCTION public.crilo_public_run_leaders(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_public_run_leaders(text,integer) TO anon,authenticated;
COMMENT ON FUNCTION public.crilo_public_run_leaders(text,integer) IS
'Top 100: distinct verified official and finished bonus scores, no private bonus drawings or Test Runs.';

CREATE OR REPLACE FUNCTION public.crilo_owner_hide_bonus_leaderboard_run(
 p_run_id uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
BEGIN
 PERFORM public.crilo_require_owner_mfa();
 IF auth.uid() IS NULL OR auth.role()<>'authenticated'
  OR NOT EXISTS(SELECT 1 FROM public.profiles
     WHERE id=auth.uid() AND is_owner=true) THEN
  RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
 END IF;
 IF p_run_id IS NULL OR p_reason IS NULL
   OR length(trim(p_reason)) NOT BETWEEN 10 AND 240 THEN
  RAISE EXCEPTION 'Provide a moderation reason (10–240 characters)'
   USING ERRCODE='22023';
 END IF;
 INSERT INTO public.crilo_hidden_bonus_leaderboard_runs(
  bonus_run_id,reason,hidden_by
 ) SELECT b.id,trim(p_reason),auth.uid()
   FROM public.crilo_bonus_runs b WHERE b.id=p_run_id
 ON CONFLICT (bonus_run_id) DO UPDATE
 SET reason=excluded.reason,hidden_by=excluded.hidden_by,
     hidden_at=clock_timestamp();
 RETURN FOUND;
END
$func$;
REVOKE ALL ON FUNCTION public.crilo_owner_hide_bonus_leaderboard_run(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_owner_hide_bonus_leaderboard_run(uuid,text)
 TO authenticated;
COMMIT;