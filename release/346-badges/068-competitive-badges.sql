-- Client-reported navigation/click events are not secure competitive proof.
-- Preserve every collectible badge, exclude exploration only from ranking.
CREATE OR REPLACE FUNCTION public.crilo_gameplay_badge_leaders(p_limit integer DEFAULT 100)
RETURNS TABLE(user_id uuid,username text,name_color text,gameplay_badges bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $badge$
 SELECT p.id,p.username,p.name_color,count(DISTINCT ub.badge_id)::bigint
 FROM public.user_badges ub
 JOIN public.badges b ON b.id=ub.badge_id
 JOIN public.profiles p ON p.id=ub.user_id
 WHERE b.category IS DISTINCT FROM 'Exploration & onboarding'
 GROUP BY p.id,p.username,p.name_color
 ORDER BY count(DISTINCT ub.badge_id) DESC,p.id
 LIMIT LEAST(GREATEST(COALESCE(p_limit,100),1),100)
$badge$;
REVOKE ALL ON FUNCTION public.crilo_gameplay_badge_leaders(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_gameplay_badge_leaders(integer) TO anon,authenticated,service_role;
