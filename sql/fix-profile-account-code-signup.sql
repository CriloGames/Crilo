-- Crilo signup repair: generate account codes for new profiles.
-- Run in Supabase SQL Editor after the file is committed.
-- Does not modify existing non-null codes, usernames, friend requests, or badges.
--
-- Existing profile creation sends id, username, name_color only.
-- A BEFORE INSERT trigger fills account_code when the browser omits it.
-- Uses cryptographically random, lower-case 12-character hexadecimal codes.
-- Uniqueness is checked before insertion; an existing unique constraint on
-- profiles.account_code remains the ultimate concurrency safeguard.

CREATE OR REPLACE FUNCTION public.crilo_assign_account_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate text;
  attempts integer;
BEGIN
  IF NEW.account_code IS NOT NULL AND btrim(NEW.account_code) <> '' THEN
    RETURN NEW;
  END IF;

  FOR attempts IN 1..20 LOOP
    -- gen_random_uuid is provided by modern PostgreSQL / Supabase.
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE account_code = candidate
    ) THEN
      NEW.account_code := candidate;
      RETURN NEW;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Could not generate a unique Crilo account code';
END;
$$;

DROP TRIGGER IF EXISTS crilo_assign_account_code_on_insert ON public.profiles;
CREATE TRIGGER crilo_assign_account_code_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.crilo_assign_account_code();

-- Repair any rows with missing codes, if present. Existing codes are untouched.
UPDATE public.profiles SET account_code = NULL
WHERE account_code IS NULL OR btrim(account_code) = '';

-- Verify the generator is installed and there are no missing codes.
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema='public'
  AND event_object_table='profiles'
  AND trigger_name='crilo_assign_account_code_on_insert';

SELECT count(*) AS profiles_missing_account_codes
FROM public.profiles
WHERE account_code IS NULL OR btrim(account_code) = '';
