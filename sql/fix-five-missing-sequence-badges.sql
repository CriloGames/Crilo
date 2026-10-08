-- Crilo: implement five previously unawarded sequence badges.
-- Official Dailies only. Safe to rerun. Existing awards are preserved.
-- Definitions below are authoritative and update the badge descriptions.
UPDATE public.badges SET description=CASE badge_key
 WHEN 'seq_comeback' THEN 'Score at least half your final points on your last number spin.'
 WHEN 'seq_first_last_special' THEN 'Start and finish a Daily with a special slice.'
 WHEN 'seq_four_specials' THEN 'Land all four special slice types in one Daily.'
 WHEN 'seq_no_repeat' THEN 'Finish a Daily without landing the same slice result twice.'
 WHEN 'seq_upgrade_sandwich' THEN 'Land an upgrade between two number spins.'
 ELSE description END
WHERE badge_key IN ('seq_comeback','seq_first_last_special','seq_four_specials','seq_no_repeat','seq_upgrade_sandwich');

CREATE OR REPLACE FUNCTION public.crilo_award_missing_sequence_badges(p_run public.daily_runs)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 a jsonb:=CASE WHEN jsonb_typeof(p_run.results::jsonb)='array' THEN p_run.results::jsonb ELSE '[]'::jsonb END;
 n int; i int; kind text; identity text;
 seen text[]:=ARRAY[]::text[]; all_unique boolean:=true;
 specials text[]:=ARRAY[]::text[];
 prev_kind text:=''; prev2_kind text:='';
 first_kind text:=''; last_kind text:='';
 last_num_points numeric:=0;
 keys text[]:=ARRAY[]::text[];
BEGIN
 IF p_run.is_test IS TRUE THEN RETURN;END IF;
 n:=jsonb_array_length(a);
 IF n=0 THEN RETURN;END IF;
 FOR i IN 0..n-1 LOOP
  kind:=coalesce(a->i->>'type','');
  identity:=CASE WHEN kind='num' THEN 'num:'||coalesce(a->i->>'base',a->i->>'label','') ELSE kind END;
  IF i=0 THEN first_kind:=kind;END IF;
  last_kind:=kind;
  IF identity=ANY(seen) THEN all_unique:=false;END IF;
  seen:=array_append(seen,identity);
  IF kind IN ('duck','upgrade','double','spins') AND NOT kind=ANY(specials)
  THEN specials:=array_append(specials,kind);END IF;
  IF kind='num' THEN
   last_num_points:=coalesce(nullif(a->i->>'points','')::numeric,0);
  END IF;
  IF kind='num' AND prev_kind='upgrade' AND prev2_kind='num'
  THEN keys:=array_append(keys,'seq_upgrade_sandwich');END IF;
  prev2_kind:=prev_kind;prev_kind:=kind;
 END LOOP;
 IF first_kind IN ('duck','upgrade','double','spins') AND last_kind IN ('duck','upgrade','double','spins')
 THEN keys:=array_append(keys,'seq_first_last_special');END IF;
 IF cardinality(specials)=4 THEN keys:=array_append(keys,'seq_four_specials');END IF;
 IF all_unique AND n>=5 THEN keys:=array_append(keys,'seq_no_repeat');END IF;
 IF p_run.score>0 AND last_num_points>=p_run.score/2
 THEN keys:=array_append(keys,'seq_comeback');END IF;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT p_run.user_id,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(keys)
 ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.crilo_missing_sequence_badges_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_test IS FALSE THEN PERFORM public.crilo_award_missing_sequence_badges(NEW);END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_missing_sequence_badges_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_missing_sequence_badges_on_daily
AFTER INSERT ON public.daily_runs FOR EACH ROW
EXECUTE FUNCTION public.crilo_missing_sequence_badges_trigger();

-- Backfill previously completed official Dailies only.
DO $$
DECLARE r public.daily_runs%rowtype;
BEGIN
 FOR r IN SELECT * FROM public.daily_runs WHERE is_test=false ORDER BY daily_period,id LOOP
  PERFORM public.crilo_award_missing_sequence_badges(r);
 END LOOP;
END $$;

-- Verification results
SELECT b.badge_key,b.name,b.description,count(ub.badge_id) AS players_awarded
FROM public.badges b LEFT JOIN public.user_badges ub ON ub.badge_id=b.id
WHERE b.badge_key IN ('seq_comeback','seq_first_last_special','seq_four_specials','seq_no_repeat','seq_upgrade_sandwich')
GROUP BY b.id,b.badge_key,b.name,b.description ORDER BY b.badge_key;
