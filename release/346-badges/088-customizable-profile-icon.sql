-- Profile icon customization: fixed hand-drawn-style symbols or one character,
-- plus one of eight preset pastel backgrounds. No uploads, arbitrary SVG, HTML,
-- or unmoderated user-generated image data. NULL symbol = username initial.
ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS avatar_symbol text,
 ADD COLUMN IF NOT EXISTS avatar_background text NOT NULL DEFAULT '#FFF0A8';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS crilo_avatar_symbol_allowed;
ALTER TABLE public.profiles ADD CONSTRAINT crilo_avatar_symbol_allowed
 CHECK (avatar_symbol IS NULL OR avatar_symbol ~ '^[A-Z0-9]$'
    OR avatar_symbol IN ('icon:star','icon:duck','icon:flower','icon:bolt',
      'icon:heart','icon:moon','icon:dice','icon:wave','icon:sun'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS crilo_avatar_background_allowed;
ALTER TABLE public.profiles ADD CONSTRAINT crilo_avatar_background_allowed
 CHECK (avatar_background IN ('#FFF0A8','#DDF3E2','#DFECFF','#F1E6FF',
    '#FFDDE6','#FFE8D0','#E0F5F2','#F2F0E9'));

-- Profiles are already public-readable, but the browser cannot update them
-- directly. The function only updates the caller's two harmless icon fields.
CREATE OR REPLACE FUNCTION public.crilo_update_profile_icon(
 p_symbol text, p_background text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL
   OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
     AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE) THEN
  RAISE EXCEPTION 'A verified account is required.' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Account suspended.' USING ERRCODE='42501';
 END IF;
 IF p_symbol IS NOT NULL
   AND p_symbol !~ '^[A-Z0-9]$'
   AND p_symbol NOT IN ('icon:star','icon:duck','icon:flower','icon:bolt',
       'icon:heart','icon:moon','icon:dice','icon:wave','icon:sun') THEN
  RAISE EXCEPTION 'Choose a permitted letter or icon.' USING ERRCODE='22023';
 END IF;
 IF p_background IS NULL OR p_background NOT IN
   ('#FFF0A8','#DDF3E2','#DFECFF','#F1E6FF','#FFDDE6',
    '#FFE8D0','#E0F5F2','#F2F0E9') THEN
  RAISE EXCEPTION 'Choose a permitted background color.' USING ERRCODE='22023';
 END IF;
 UPDATE public.profiles SET
  avatar_symbol=p_symbol,avatar_background=p_background
 WHERE id=auth.uid()
 RETURNING jsonb_build_object('avatar_symbol',avatar_symbol,
   'avatar_background',avatar_background) INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Profile not found.' USING ERRCODE='P0002';END IF;
 RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.crilo_update_profile_icon(text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_update_profile_icon(text,text)
 TO authenticated,service_role;
