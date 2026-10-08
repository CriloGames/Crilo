-- Run in Supabase SQL Editor to repair featured badge saves.
-- Badge IDs in public.badges are numeric; the previous RPC expected UUIDs.
-- Keep the function name and the same frontend parameter names.
DROP FUNCTION IF EXISTS public.crilo_set_featured_badge(integer, uuid);
DROP FUNCTION IF EXISTS public.crilo_set_featured_badge(integer, bigint);
DROP FUNCTION IF EXISTS public.crilo_set_featured_badge(integer, integer);

CREATE OR REPLACE FUNCTION public.crilo_set_featured_badge(
  p_position integer,
  p_badge_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF p_position NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Featured slot must be between 1 and 5';
  END IF;
  IF p_badge_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = v_user AND ub.badge_id = p_badge_id
  ) THEN
    RAISE EXCEPTION 'You can only feature unlocked badges';
  END IF;
  DELETE FROM public.featured_badges
  WHERE user_id = v_user AND (position = p_position OR (p_badge_id IS NOT NULL AND badge_id = p_badge_id));
  IF p_badge_id IS NOT NULL THEN
    INSERT INTO public.featured_badges (user_id, position, badge_id)
    VALUES (v_user, p_position, p_badge_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.crilo_set_featured_badge(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_set_featured_badge(integer, integer) TO authenticated;
