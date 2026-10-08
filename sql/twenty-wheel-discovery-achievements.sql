-- Crilo: 20 wheel achievement collection.
-- 18 new wheel badges + 2 existing equivalents:
-- "Double Trouble" = double_back2; "Triple Threat" = upgrade_3.
-- Deja Vu replaces social_og, preserving any pre-existing earned badge references.
-- Run once in Supabase SQL Editor. Only official runs count.
UPDATE public.badges SET badge_key='wheel_dejavu',name='Déjà Vu',
 description='Finish two consecutive Dailies with exactly the same score.',
 category='secret',is_secret=true,sort_order=501
WHERE badge_key='social_og'
 AND NOT EXISTS(SELECT 1 FROM public.badges WHERE badge_key='wheel_dejavu');
INSERT INTO public.badges(badge_key,name,description,category,is_secret,sort_order)
SELECT v.badge_key,v.name,v.description,'secret',true,v.sort_order
FROM (VALUES
('wheel_dejavu','Déjà Vu','Finish two consecutive Dailies with exactly the same score.',501),
('wheel_full_circle','Full Circle','Finish a Daily with the same score as your first Daily.',502),
('wheel_lucky_seven','Lucky Number Seven','Finish seven Dailies with scores ending in 7.',503),
('wheel_mirror','Mirror Image','Finish two Dailies with reversed scores.',504),
('wheel_groundhog','Groundhog Day','Match the first three spin results on two consecutive Dailies.',505),
('wheel_perfect_match','The Perfect Match','Match another player''s score on the same Daily.',506),
('wheel_collector','The Collector','Land every starting-wheel result across official Dailies.',507),
('wheel_against_odds','Against All Odds','Finish with at least five ducks and zero upgrades.',508),
('wheel_one_each','One of Each','Land every special wheel result in one Daily.',509),
('wheel_long_way','The Long Way Around','Reach 20 spins in one Daily.',510),
('wheel_quack_attack','Quack Attack','Land four ducks in a row.',511),
('wheel_comeback','The Comeback','Earn more than half your final score on your last scoring spin.',512),
('wheel_slow_starter','Slow Starter','Score no points on your first five spins, then finish above zero.',513),
('wheel_no_ducks','All Gas, No Brakes','Finish without landing a duck.',514),
('wheel_duck_dynasty','Duck Dynasty','Land more ducks than numbered results.',515),
('wheel_small_beginnings','Small Beginnings','Start with a 1 and finish with at least 1,000 points.',516),
('wheel_minimalist','The Minimalist','Finish in exactly five spins without special results.',517),
('wheel_chosen_one','The Chosen One','Land the same numbered result five times in a row.',518)
) v(badge_key,name,description,sort_order)
WHERE NOT EXISTS(SELECT 1 FROM public.badges b WHERE b.badge_key=v.badge_key);

-- The existing badges cover two of the 20 without redundant awards.
-- double_back2: Double Trouble; upgrade_3: Triple Threat.

CREATE OR REPLACE FUNCTION public.crilo_award_wheel_discoveries(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 r record; prev_period date; prev_score numeric; first_score numeric; lucky_count int:=0;
 seen text[]:=ARRAY[]::text[]; first_three text[]; prev_three text[];
 arr jsonb; n int; i int; t text; identity text; prev_identity text;
 duck_streak int; number_streak int; duck_count int; number_count int;
 has_d boolean; has_u boolean; has_x boolean; has_s boolean;
 last_scoring numeric; first_five_no_points boolean; all_numbers boolean;
 keys text[]:=ARRAY[]::text[];
BEGIN
 IF p_user IS NULL THEN RETURN;END IF;
 FOR r IN SELECT id,daily_period,score,spins,upgrades,ducks,results
          FROM public.daily_runs
          WHERE user_id=p_user AND is_test=false
          ORDER BY daily_period,id LOOP
  arr:=coalesce(r.results,'[]'::jsonb);
  IF jsonb_typeof(arr)<>'array' THEN arr:='[]'::jsonb;END IF;
  n:=jsonb_array_length(arr);
  first_three:=ARRAY[]::text[];
  prev_identity:='';duck_streak:=0;number_streak:=0;duck_count:=0;number_count:=0;
  has_d:=false;has_u:=false;has_x:=false;has_s:=false;
  last_scoring:=0;first_five_no_points:=true;all_numbers:=true;
  IF n>0 THEN
   FOR i IN 0..n-1 LOOP
    t:=coalesce(arr->i->>'type','');
    identity:=CASE WHEN t='num' THEN 'num:'||coalesce(arr->i->>'base','') ELSE t END;
    IF i<3 THEN first_three:=array_append(first_three,identity);END IF;
    IF NOT identity=ANY(seen) THEN seen:=array_append(seen,identity);END IF;
    IF t='duck' THEN has_d:=true;duck_count:=duck_count+1;duck_streak:=duck_streak+1;
    ELSE duck_streak:=0;END IF;
    IF t='upgrade' THEN has_u:=true;END IF;
    IF t='double' THEN has_x:=true;END IF;
    IF t='spins' THEN has_s:=true;END IF;
    IF t='num' THEN
     number_count:=number_count+1;
     IF identity=prev_identity THEN number_streak:=number_streak+1;
     ELSE number_streak:=1;END IF;
    ELSE number_streak:=0;all_numbers:=false;END IF;
    IF i<5 AND coalesce((arr->i->>'points')::numeric,0)>0 THEN first_five_no_points:=false;END IF;
    IF coalesce((arr->i->>'points')::numeric,0)>0 THEN last_scoring:=(arr->i->>'points')::numeric;END IF;
    IF duck_streak>=4 THEN keys:=array_append(keys,'wheel_quack_attack');END IF;
    IF number_streak>=5 THEN keys:=array_append(keys,'wheel_chosen_one');END IF;
    prev_identity:=identity;
   END LOOP;
  END IF;
  IF first_score IS NULL THEN first_score:=r.score;
  ELSIF r.score=first_score THEN keys:=array_append(keys,'wheel_full_circle');END IF;
  IF prev_period IS NOT NULL AND r.daily_period=prev_period+1 THEN
   IF r.score=prev_score THEN keys:=array_append(keys,'wheel_dejavu');END IF;
   IF n>=3 AND cardinality(prev_three)=3 AND first_three=prev_three
   THEN keys:=array_append(keys,'wheel_groundhog');END IF;
  END IF;
  IF mod(r.score,10)=7 THEN lucky_count:=lucky_count+1;END IF;
  IF lucky_count>=7 THEN keys:=array_append(keys,'wheel_lucky_seven');END IF;
  IF EXISTS(
    SELECT 1 FROM public.daily_runs other
    WHERE other.user_id=p_user AND other.is_test=false AND other.id<>r.id
      AND other.score::text=reverse(r.score::text)
  ) THEN keys:=array_append(keys,'wheel_mirror');END IF;
  IF EXISTS(
    SELECT 1 FROM public.daily_runs other
    WHERE other.user_id<>p_user AND other.is_test=false
      AND other.daily_period=r.daily_period AND other.score=r.score
  ) THEN keys:=array_append(keys,'wheel_perfect_match');END IF;
  IF ARRAY['num:1','num:2','num:3','num:5','duck','double','upgrade','spins'] <@ seen
  THEN keys:=array_append(keys,'wheel_collector');END IF;
  IF r.ducks>=5 AND r.upgrades=0 THEN keys:=array_append(keys,'wheel_against_odds');END IF;
  IF has_d AND has_u AND has_x AND has_s THEN keys:=array_append(keys,'wheel_one_each');END IF;
  IF r.spins>=20 THEN keys:=array_append(keys,'wheel_long_way');END IF;
  IF r.score>0 AND last_scoring>r.score/2 THEN keys:=array_append(keys,'wheel_comeback');END IF;
  IF n>=6 AND first_five_no_points AND r.score>0 THEN keys:=array_append(keys,'wheel_slow_starter');END IF;
  IF r.ducks=0 THEN keys:=array_append(keys,'wheel_no_ducks');END IF;
  IF duck_count>number_count AND n>0 THEN keys:=array_append(keys,'wheel_duck_dynasty');END IF;
  IF n>0 AND arr->0->>'type'='num' AND arr->0->>'base'='1' AND r.score>=1000
  THEN keys:=array_append(keys,'wheel_small_beginnings');END IF;
  IF n=5 AND all_numbers AND r.spins=5 THEN keys:=array_append(keys,'wheel_minimalist');END IF;
  prev_period:=r.daily_period;prev_score:=r.score;
  prev_three:=first_three;
 END LOOP;
 INSERT INTO public.user_badges(user_id,badge_id,earned_at)
 SELECT p_user,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(keys)
 ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.crilo_award_wheel_discoveries_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.is_test IS TRUE THEN RETURN NEW;END IF;
 PERFORM public.crilo_award_wheel_discoveries(NEW.user_id);
 -- A matching score can also unlock the badge for the other player.
 PERFORM public.crilo_award_wheel_discoveries(other.user_id)
 FROM (SELECT DISTINCT user_id FROM public.daily_runs
       WHERE is_test=false AND daily_period=NEW.daily_period
         AND score=NEW.score AND user_id<>NEW.user_id) other;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_wheel_discoveries_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_wheel_discoveries_on_daily
AFTER INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_award_wheel_discoveries_trigger();

-- Backfill from official runs; no owner tests.
DO $$
DECLARE u record;
BEGIN
 FOR u IN SELECT DISTINCT user_id FROM public.daily_runs WHERE is_test=false LOOP
  PERFORM public.crilo_award_wheel_discoveries(u.user_id);
 END LOOP;
END $$;

SELECT badge_key,name FROM public.badges
WHERE badge_key LIKE 'wheel_%' OR badge_key IN ('double_back2','upgrade_3')
ORDER BY sort_order,badge_key;
