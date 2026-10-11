-- Consistency repair: the UI has deliberately hidden two pre-verification
-- preview-like Daily rows from its competitive single-run boards; keep them
-- from silently contributing to the all-time points leaderboard as well.
-- No run, badge, score or player stat is deleted or changed.
CREATE OR REPLACE FUNCTION public.crilo_total_points_leaders(p_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, username text, name_color text, total_points numeric, official_runs bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT p.id,p.username,p.name_color,coalesce(sum(d.score),0)::numeric AS total_points,
        count(*)::bigint AS official_runs
 FROM public.daily_runs d
 JOIN public.profiles p ON p.id=d.user_id
 WHERE d.is_test=false
   -- Two historical preview-like rows are already suppressed on the visible
   -- individual-score leaderboard. Do not let them reappear as all-time
   -- competitive points. Restrict the exception to pre-verification dates
   -- and missing server proof, so genuine future matching results still count.
   AND NOT (
      d.verified_spin_session_id IS NULL
      AND d.daily_period < DATE '2026-10-09'
      AND (
        (d.score=864 AND d.spins=11 AND d.upgrades=3 AND d.doubles=1 AND d.ducks=0)
        OR (d.score=15 AND d.spins=8 AND d.upgrades=0 AND d.doubles=1 AND d.ducks=2)
      )
   )
 GROUP BY p.id,p.username,p.name_color
 ORDER BY sum(d.score) DESC,count(*) DESC,p.id
 LIMIT least(greatest(coalesce(p_limit,100),1),100)
$function$;
