-- Crilo final secret + drawing badges. APPLY BEFORE publishing the accompanying game.js change.
-- Existing official runs only; private owner test runs never earn badges.
ALTER TABLE public.daily_runs ADD COLUMN IF NOT EXISTS drawing_is_blank boolean;

CREATE OR REPLACE FUNCTION public.crilo_award_remaining_secrets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE keys text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.is_test IS TRUE THEN RETURN NEW;END IF;
 -- Blank drawing and Picasso use an explicit pixel-derived flag from the client.
 IF NEW.drawing_is_blank IS TRUE THEN keys:=array_append(keys,'secret_blank');END IF;
 IF NEW.drawing_is_blank IS FALSE THEN keys:=array_append(keys,'daily_draw');END IF;
 -- A submission during the final minute of the Daily (21:59 UTC).
 IF to_char(NEW.created_at AT TIME ZONE 'UTC','HH24:MI')='21:59'
 THEN keys:=array_append(keys,'secret_clock');END IF;
 -- An extraordinary final score.
 IF NEW.score>=1000000 THEN keys:=array_append(keys,'secret_impossible');END IF;
 -- Owner identity is proven by the private owner test-run table, not a
 -- user-controlled profile field. Owner badge awarded on official play only.
 IF EXISTS(SELECT 1 FROM public.owner_test_runs t WHERE t.user_id=NEW.user_id)
 THEN keys:=array_append(keys,'secret_owner');END IF;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT NEW.user_id,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(keys)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_remaining_secrets_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_remaining_secrets_on_daily AFTER INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_award_remaining_secrets();

-- Existing drawing flags are NULL, so we cannot truthfully backfill blank/nonblank.
-- Backfill only achievements that historical data proves.
INSERT INTO public.user_badges(user_id,badge_id,earned_at)
SELECT DISTINCT r.user_id,b.id,now() FROM public.daily_runs r
JOIN public.badges b ON
 (b.badge_key='secret_clock' AND to_char(r.created_at AT TIME ZONE 'UTC','HH24:MI')='21:59')
 OR (b.badge_key='secret_impossible' AND r.score>=1000000)
 OR (b.badge_key='secret_owner' AND EXISTS(SELECT 1 FROM public.owner_test_runs t WHERE t.user_id=r.user_id))
WHERE r.is_test=false ON CONFLICT DO NOTHING;
