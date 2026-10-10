-- Protect owner visitors against stored HTML/style attribute injection:
-- Players could previously PATCH their name_color directly, bypassing the
-- UI / update_crilo_settings hex validator. This value appears in HTML attrs.
ALTER TABLE public.profiles
 ADD CONSTRAINT crilo_name_color_hex_only
 CHECK (name_color IS NULL OR name_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.profiles
 ADD CONSTRAINT crilo_theme_known_values_only
 CHECK (theme IS NULL OR theme IN ('light','dark'));
-- A defensive write guard on all API paths (including SECURITY DEFINER RPCs).
CREATE OR REPLACE FUNCTION public.crilo_enforce_safe_profile_preferences()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
 IF NEW.name_color IS NOT NULL AND NEW.name_color !~ '^#[0-9A-Fa-f]{6}$' THEN
   RAISE EXCEPTION 'Display name color must be a six-digit hexadecimal color' USING ERRCODE='23514';
 END IF;
 IF NEW.theme IS NOT NULL AND NEW.theme NOT IN ('light','dark') THEN
   RAISE EXCEPTION 'Invalid theme' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.crilo_enforce_safe_profile_preferences() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS crilo_enforce_safe_profile_preferences ON public.profiles;
CREATE TRIGGER crilo_enforce_safe_profile_preferences
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.crilo_enforce_safe_profile_preferences();