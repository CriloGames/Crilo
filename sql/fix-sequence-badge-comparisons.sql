-- Fix numeric sequence comparisons: 1 followed by 5 is NOT a repeat.
-- Also fixes bookends, palindromes and variety to compare displayed results.
-- Safe to rerun. Existing earned badges are preserved.
-- Crilo badge milestone engine (official Daily runs only).
-- Run in Supabase SQL Editor. Safe to repeat; existing badges are never removed.
CREATE OR REPLACE FUNCTION public.crilo_award_run_badges(p_run public.daily_runs)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 keys text[]:=ARRAY['score_001'];
 a jsonb:=coalesce(p_run.results::jsonb,'[]'::jsonb);
 n int; i int; t text; identity text; prev text:=''; prev2 text:=''; streak int:=0; specials int:=0;
 seq text[]:=ARRAY[]::text[]; variety text[]:=ARRAY[]::text[];
 left_spins int:=5; running_score numeric:=0;
 all_numbers boolean:=true; palindrome boolean:=true;
 d boolean:=false; u boolean:=false; x boolean:=false; plus boolean:=false;
 k int; ducks_total bigint;
BEGIN
 IF p_run.is_test IS TRUE THEN RETURN; END IF;
 IF jsonb_typeof(a)<>'array' THEN a:='[]'::jsonb;END IF;
 n:=jsonb_array_length(a);
 FOREACH k IN ARRAY ARRAY[100,250,500,750,1000,1500,2000,3000,4000,5000,7500,10000,15000,20000,30000,50000,75000,100000,250000] LOOP
  IF p_run.score>=k THEN keys:=array_append(keys,'score_'||k);END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY[1,2,3,4,5,6,7,8,9,10,12,15,20,25,30] LOOP
  IF coalesce(p_run.upgrades,0)>=k THEN keys:=array_append(keys,'upgrade_'||k);END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY[1,2,3,4,5,6,7,8,10] LOOP
  IF coalesce(p_run.doubles,0)>=k THEN keys:=array_append(keys,'double_'||k);END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY[1,2,3,4,5,7,10,15] LOOP
  IF coalesce(p_run.ducks,0)>=k THEN keys:=array_append(keys,'duck_'||k);END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY[1,2,3,5] LOOP
  IF coalesce(p_run.extra_spins,0)>=k*2 THEN keys:=array_append(keys,'spinplus_'||k);END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY[10,15,20,25,30] LOOP
  IF coalesce(p_run.spins,0)>=k THEN keys:=array_append(keys,'spins_'||k);END IF;
 END LOOP;
 SELECT coalesce(sum(ducks),0) INTO ducks_total FROM public.daily_runs WHERE user_id=p_run.user_id AND is_test=false;
 IF ducks_total>=100 THEN keys:=array_append(keys,'duck_lifetime100');END IF;
 -- The saved rarity odds use a 100,000-run simulation; larger odds cannot be resolved.
 FOREACH k IN ARRAY ARRAY[10,25,100,250,500,1000,2500,5000,10000,25000,100000] LOOP
  IF coalesce(p_run.rarity_odds,0)>=k THEN keys:=array_append(keys,'rarity_'||k);END IF;
 END LOOP;
 IF upper(coalesce(p_run.rarity_label,''))='MYTHIC' THEN keys:=array_append(keys,'rarity_legendary');END IF;
 FOR i IN 0..n-1 LOOP
  t:=coalesce(a->i->>'type','');
  identity:=CASE WHEN t='num' THEN 'num:'||coalesce(a->i->>'label',a->i->>'base','') ELSE t END;
  seq:=array_append(seq,identity);
  IF t='double' THEN x:=true;END IF;
  IF t='upgrade' THEN u:=true;END IF;
  IF t='spins' THEN plus:=true;END IF;
  IF t='duck' THEN d:=true;END IF;
  IF t<>'num' THEN all_numbers:=false;END IF;
  IF i=0 AND t='duck' THEN keys:=array_append(keys,'duck_first');END IF;
  IF left_spins=1 AND t='duck' THEN keys:=array_append(keys,'duck_last');END IF;
  IF left_spins=1 AND t='double' THEN keys:=array_append(keys,'double_final');END IF;
  IF left_spins=1 AND t='spins' THEN keys:=array_append(keys,'spinplus_saved');END IF;
  left_spins:=left_spins-1;
  IF t IN ('duck','double','upgrade') THEN left_spins:=left_spins+1;
  ELSIF t='spins' THEN left_spins:=left_spins+2;END IF;
  IF t='double' THEN
   IF running_score=0 THEN keys:=array_append(keys,'double_zero');END IF;
   IF running_score>=1000 THEN keys:=array_append(keys,'double_1000');END IF;
   IF running_score>=5000 THEN keys:=array_append(keys,'double_5000');END IF;
   running_score:=running_score*2;
  ELSIF t='num' THEN running_score:=running_score+coalesce((a->i->>'points')::numeric,0);END IF;
  IF identity=prev THEN streak:=streak+1;ELSE streak:=1;END IF;
  IF streak>=2 THEN keys:=array_append(keys,'seq_repeat2');END IF;
  IF streak>=3 THEN keys:=array_append(keys,'seq_repeat3');END IF;
  IF streak>=4 THEN keys:=array_append(keys,'seq_repeat4');END IF;
  IF t='double' AND prev='double' THEN keys:=array_append(keys,'double_back2');END IF;
  IF t='double' AND prev='double' AND prev2='double' THEN keys:=array_append(keys,'double_back3');END IF;
  IF t='duck' AND prev='duck' THEN keys:=array_append(keys,'duck_back2');END IF;
  IF t='duck' AND prev2='duck' AND prev<>'duck' THEN keys:=array_append(keys,'duck_sandwich');END IF;
  IF t='upgrade' AND prev='duck' THEN keys:=array_append(keys,'duck_upgrade');END IF;
  IF t='double' AND prev='duck' THEN keys:=array_append(keys,'duck_double');END IF;
  IF t='num' THEN specials:=0;ELSE specials:=specials+1;END IF;
  IF specials>=3 THEN keys:=array_append(keys,'seq_special3');END IF;
  IF specials>=5 THEN keys:=array_append(keys,'seq_special5');END IF;
  IF identity=ANY(variety) THEN variety:=ARRAY[identity];ELSE variety:=array_append(variety,identity);END IF;
  IF cardinality(variety)>=5 THEN keys:=array_append(keys,'seq_variety5');END IF;
  prev2:=prev;prev:=identity;
 END LOOP;
 IF n>0 THEN
  IF x AND u AND plus AND d THEN keys:=array_append(keys,'seq_all_specials');END IF;
  IF all_numbers AND left_spins=0 THEN keys:=array_append(keys,'seq_numbers_only');END IF;
  IF n>=2 AND seq[1]=seq[n] THEN keys:=array_append(keys,'seq_bookends');END IF;
  IF n>=3 THEN
   FOR k IN 1..(n/2) LOOP
    IF seq[k]<>seq[n+1-k] THEN palindrome:=false;EXIT;END IF;
   END LOOP;
   IF palindrome THEN keys:=array_append(keys,'seq_palindrome');END IF;
  END IF;
 END IF;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT p_run.user_id,b.id,now() FROM public.badges b
 WHERE b.badge_key=ANY(keys) ON CONFLICT DO NOTHING;
END $$;

-- No retroactive removals; only future sequence awards use corrected logic.
