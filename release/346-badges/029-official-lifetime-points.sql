-- Crilo 2026-10-10: all-time cumulative official Daily points.
-- Applied in production via Supabase migration
--   official_lifetime_points_leaderboard_and_profile_metric.
-- Run only when provisioning a new Crilo database, or to repair these
-- two read-only reporting objects. Does not change award rules or player runs.

CREATE OR REPLACE FUNCTION public.crilo_total_points_leaders(p_limit integer DEFAULT 100)
RETURNS TABLE(user_id uuid, username text, name_color text, total_points numeric, official_runs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
 SELECT p.id,p.username,p.name_color,
        coalesce(sum(d.score),0)::numeric AS total_points,
        count(*)::bigint AS official_runs
 FROM public.daily_runs d
 JOIN public.profiles p ON p.id=d.user_id
 WHERE d.is_test=false
 GROUP BY p.id,p.username,p.name_color
 ORDER BY sum(d.score) DESC,count(*) DESC,p.id
 LIMIT least(greatest(coalesce(p_limit,100),1),100)
$function$;
REVOKE ALL ON FUNCTION public.crilo_total_points_leaders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_total_points_leaders(integer) TO anon,authenticated;

DO $migration$
DECLARE fn text;
BEGIN
 fn:=pg_get_functiondef('public.crilo_profile_metrics(uuid)'::regprocedure);
 IF position('''total_points'',summary.total_points' IN fn)>0 THEN RETURN; END IF;
 IF position('coalesce(sum(spins),0) as total_spins' IN fn)=0 OR
    position('''average_score'',summary.average_score' IN fn)=0 THEN
  RAISE EXCEPTION 'Profile metrics definition changed. Review before updating.';
 END IF;
 fn:=replace(fn,'coalesce(sum(spins),0) as total_spins',
  'coalesce(sum(score),0) as total_points,coalesce(sum(spins),0) as total_spins');
 fn:=replace(fn,'''average_score'',summary.average_score',
  '''average_score'',summary.average_score,''total_points'',summary.total_points');
 EXECUTE fn;
END $migration$;
