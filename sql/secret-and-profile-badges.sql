-- Crilo secret achievement rules + profile creation award.
-- Run in Supabase SQL Editor. Additive, idempotent; official runs only.
-- Explicit secret rules are maintained here (not exposed in game UI).
CREATE OR REPLACE FUNCTION public.crilo_award_secret_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 a jsonb; n int; i int; t text; previous text:='';
 ducks_in_row int:=0; double_in_row int:=0; numbers_in_row int:=0;
 has_duck_triple boolean:=false; has_double_pair boolean:=false;
 has_number_triple boolean:=false;
 keys text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.is_test IS TRUE THEN RETURN NEW;END IF;
 -- Secret score easter eggs: the score must be exactly this value.
 IF NEW.score=404 THEN keys:=array_append(keys,'secret_404');END IF;
 IF NEW.score=42 THEN keys:=array_append(keys,'secret_42');END IF;
 IF NEW.score=69 THEN keys:=array_append(keys,'secret_69');END IF;
 IF NEW.score=777 THEN keys:=array_append(keys,'secret_777');END IF;
 IF NEW.score=1337 THEN keys:=array_append(keys,'secret_1337');END IF;
 IF NEW.score=0 THEN keys:=array_append(keys,'secret_zero');END IF;
 -- One point short of a major score milestone.
 IF NEW.score IN (99,249,499,749,999,1499,1999,2999,3999,4999,7499,9999)
 THEN keys:=array_append(keys,'secret_close');END IF;
 a:=coalesce(NEW.results::jsonb,'[]'::jsonb);
 IF jsonb_typeof(a)<>'array' THEN a:='[]'::jsonb;END IF;
 n:=jsonb_array_length(a);
 IF n>0 THEN
  -- First spin is a double (beginner's luck).
  IF a->0->>'type'='double' THEN keys:=array_append(keys,'secret_first');END IF;
  FOR i IN 0..n-1 LOOP
   t:=coalesce(a->i->>'type','');
   IF t='duck' THEN ducks_in_row:=ducks_in_row+1;ELSE ducks_in_row:=0;END IF;
   IF t='double' THEN double_in_row:=double_in_row+1;ELSE double_in_row:=0;END IF;
   IF t='num' THEN numbers_in_row:=numbers_in_row+1;ELSE numbers_in_row:=0;END IF;
   IF ducks_in_row>=3 THEN has_duck_triple:=true;END IF;
   IF double_in_row>=2 THEN has_double_pair:=true;END IF;
   IF numbers_in_row>=5 THEN has_number_triple:=true;END IF;
   previous:=t;
  END LOOP;
  IF has_duck_triple THEN keys:=array_append(keys,'secret_ducks');END IF;
  IF has_double_pair THEN keys:=array_append(keys,'secret_double');END IF;
  IF has_number_triple THEN keys:=array_append(keys,'secret_pattern');END IF;
 END IF;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT NEW.user_id,b.id,now() FROM public.badges b
 WHERE b.badge_key=ANY(keys)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_secret_badges_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_secret_badges_on_daily AFTER INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_award_secret_badges();

-- Award profile creation immediately and backfill all existing profiles.
CREATE OR REPLACE FUNCTION public.crilo_award_profile_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT NEW.id,b.id,now() FROM public.badges b
 WHERE b.badge_key='social_profile'
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_profile_badge_on_create ON public.profiles;
CREATE TRIGGER crilo_profile_badge_on_create AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.crilo_award_profile_badge();
INSERT INTO public.user_badges(user_id,badge_id,earned_at)
SELECT p.id,b.id,now() FROM public.profiles p
JOIN public.badges b ON b.badge_key='social_profile'
ON CONFLICT DO NOTHING;

-- Backfill secret badges without inserting fake runs.
-- Use the existing trigger function through a temporary staging table of
-- the same row type; do not modify original run data or player statistics.
DO $$
DECLARE r public.daily_runs%rowtype;
DECLARE keys text[]; a jsonb; n int; i int; ducks_row int; doubles_row int; nums_row int; t text;
BEGIN
 FOR r IN SELECT * FROM public.daily_runs WHERE is_test=false LOOP
  keys:=ARRAY[]::text[];
  IF r.score=404 THEN keys:=array_append(keys,'secret_404');END IF;
  IF r.score=42 THEN keys:=array_append(keys,'secret_42');END IF;
  IF r.score=69 THEN keys:=array_append(keys,'secret_69');END IF;
  IF r.score=777 THEN keys:=array_append(keys,'secret_777');END IF;
  IF r.score=1337 THEN keys:=array_append(keys,'secret_1337');END IF;
  IF r.score=0 THEN keys:=array_append(keys,'secret_zero');END IF;
  IF r.score IN (99,249,499,749,999,1499,1999,2999,3999,4999,7499,9999)
  THEN keys:=array_append(keys,'secret_close');END IF;
  a:=coalesce(r.results::jsonb,'[]'::jsonb);
  IF jsonb_typeof(a)<>'array' THEN a:='[]'::jsonb;END IF;
  n:=jsonb_array_length(a);
  ducks_row:=0;doubles_row:=0;nums_row:=0;
  IF n>0 THEN
   IF a->0->>'type'='double' THEN keys:=array_append(keys,'secret_first');END IF;
   FOR i IN 0..n-1 LOOP
    t:=coalesce(a->i->>'type','');
    IF t='duck' THEN ducks_row:=ducks_row+1;ELSE ducks_row:=0;END IF;
    IF t='double' THEN doubles_row:=doubles_row+1;ELSE doubles_row:=0;END IF;
    IF t='num' THEN nums_row:=nums_row+1;ELSE nums_row:=0;END IF;
    IF ducks_row>=3 THEN keys:=array_append(keys,'secret_ducks');END IF;
    IF doubles_row>=2 THEN keys:=array_append(keys,'secret_double');END IF;
    IF nums_row>=5 THEN keys:=array_append(keys,'secret_pattern');END IF;
   END LOOP;
  END IF;
  INSERT INTO public.user_badges(user_id,badge_id,earned_at)
  SELECT r.user_id,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(keys)
  ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
-- Remaining secrets: owner, blank, clock, impossible require explicit rules.
-- Friendship and OG badges require friendship / signup eligibility definitions.
-- The drawing badge requires a reliable saved drawing-made indicator.
