-- Crilo: make the three extreme rarity achievements measurable using exact
-- recorded wheel-outcome sequence probabilities, NOT estimated score rarity.
-- No changes to the 100k-run score rarity display or existing awards.
-- The exact ordered outcome sequence chance is the product of the saved
-- per-spin conditional probabilities (including changing wheel segments).
UPDATE public.badges SET description=CASE badge_key
 WHEN 'rarity_1000000' THEN 'Finish an official Daily with a wheel outcome sequence whose chance is 1 in 1,000,000 or rarer.'
 WHEN 'rarity_10000000' THEN 'Finish an official Daily with a wheel outcome sequence whose chance is 1 in 10,000,000 or rarer.'
 WHEN 'rarity_100000000' THEN 'Finish an official Daily with a wheel outcome sequence whose chance is 1 in 100,000,000 or rarer.'
 ELSE description END
WHERE badge_key IN ('rarity_1000000','rarity_10000000','rarity_100000000');

CREATE OR REPLACE FUNCTION public.crilo_award_extreme_sequence_rarity(p_run public.daily_runs)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 a jsonb:=p_run.results::jsonb;
 item jsonb;
 chance numeric:=1;
 p numeric;
 keys text[]:=ARRAY[]::text[];
BEGIN
 IF p_run.is_test IS DISTINCT FROM FALSE THEN RETURN;END IF;
 IF a IS NULL OR jsonb_typeof(a)<>'array' OR jsonb_array_length(a)<5 THEN RETURN;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(a) LOOP
  IF jsonb_typeof(item)<>'object' OR
     coalesce(item->>'type','') NOT IN ('num','duck','upgrade','double','spins') OR
     coalesce(item->>'probability','') !~ '^(0?([.][0-9]+)?|1([.]0+)?)$'
  THEN RETURN;END IF;
  p:=(item->>'probability')::numeric;
  IF p<=0 OR p>1 THEN RETURN;END IF;
  chance:=chance*p;
 END LOOP;
 IF chance<=1.0/1000000 THEN keys:=array_append(keys,'rarity_1000000');END IF;
 IF chance<=1.0/10000000 THEN keys:=array_append(keys,'rarity_10000000');END IF;
 IF chance<=1.0/100000000 THEN keys:=array_append(keys,'rarity_100000000');END IF;
 IF cardinality(keys)=0 THEN RETURN;END IF;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT p_run.user_id,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(keys)
 ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.crilo_extreme_sequence_rarity_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_test IS FALSE THEN PERFORM public.crilo_award_extreme_sequence_rarity(NEW);END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_extreme_sequence_rarity_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_extreme_sequence_rarity_on_daily
AFTER INSERT ON public.daily_runs FOR EACH ROW
EXECUTE FUNCTION public.crilo_extreme_sequence_rarity_trigger();

-- Retroactive awards from saved official runs only.
DO $$
DECLARE r public.daily_runs%rowtype;
BEGIN
 FOR r IN SELECT * FROM public.daily_runs WHERE is_test=false LOOP
  PERFORM public.crilo_award_extreme_sequence_rarity(r);
 END LOOP;
END $$;

SELECT b.badge_key,b.name,b.description,count(DISTINCT ub.user_id) AS players_awarded
FROM public.badges b LEFT JOIN public.user_badges ub ON ub.badge_id=b.id
WHERE b.badge_key IN ('rarity_1000000','rarity_10000000','rarity_100000000')
GROUP BY b.id,b.badge_key,b.name,b.description ORDER BY b.badge_key;
