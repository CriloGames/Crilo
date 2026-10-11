-- Historic pre-authoritative Dailies remain saved and visible on profiles,
-- but cannot be used in competitive verified Wheel rankings.
-- Zero existing runs, awards, stats or drawings are edited.
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
   AND d.verified_spin_session_id IS NOT NULL
 GROUP BY p.id,p.username,p.name_color
 ORDER BY sum(d.score) DESC,count(*) DESC,p.id
 LIMIT least(greatest(coalesce(p_limit,100),1),100)
$function$;
