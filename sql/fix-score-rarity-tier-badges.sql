-- Crilo: award the five score-rarity tier badges from the official Daily rarity label.
-- Does not modify rarity calculations, existing awards, or owner test runs.
CREATE OR REPLACE FUNCTION public.crilo_award_score_rarity_tier(p_run public.daily_runs)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tier text; v_badge_key text;
BEGIN
 IF p_run.is_test IS DISTINCT FROM FALSE THEN RETURN; END IF;
 tier:=lower(trim(coalesce(p_run.rarity_label,'')));
 IF tier NOT IN ('uncommon','rare','epic','legendary','mythic') THEN RETURN; END IF;
 v_badge_key:='score_'||tier;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT p_run.user_id,b.id,now() FROM public.badges b
 WHERE b.badge_key=v_badge_key ON CONFLICT DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.crilo_score_rarity_tier_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_test IS FALSE THEN PERFORM public.crilo_award_score_rarity_tier(NEW);END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_score_rarity_tier_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_score_rarity_tier_on_daily
AFTER INSERT ON public.daily_runs FOR EACH ROW
EXECUTE FUNCTION public.crilo_score_rarity_tier_trigger();

-- Backfill existing official runs without revoking anything.
DO $$
DECLARE r public.daily_runs%rowtype;
BEGIN
 FOR r IN SELECT * FROM public.daily_runs WHERE is_test=false LOOP
  PERFORM public.crilo_award_score_rarity_tier(r);
 END LOOP;
END $$;

SELECT b.badge_key,b.name,count(DISTINCT ub.user_id) AS players_awarded
FROM public.badges b LEFT JOIN public.user_badges ub ON ub.badge_id=b.id
WHERE b.badge_key IN ('score_uncommon','score_rare','score_epic','score_legendary','score_mythic')
GROUP BY b.id,b.badge_key,b.name ORDER BY b.badge_key;
