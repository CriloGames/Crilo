-- Three deterministic daily challenges: two participation paths and one
-- rotating wheel objective. Official, verified runs only; no bonuses/Tests.
-- Every successful task permanently earns one decorative Challenge Star.
-- 12/36/90 Stars unlock decorative stamps on the challenge card only.
-- No spins, wheel changes, competitive points, badges or profile cosmetics.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crilo_daily_challenge_stars (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 daily_period date NOT NULL,
 challenge_key text NOT NULL CHECK(challenge_key IN (
   'finish','spin_3','spin_5','sketch','duck','upgrade',
   'double','extra','numbers'
 )),
 earned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,daily_period,challenge_key)
);
CREATE INDEX IF NOT EXISTS crilo_challenge_star_history
 ON public.crilo_daily_challenge_stars(user_id,daily_period DESC);
ALTER TABLE public.crilo_daily_challenge_stars ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_daily_challenge_stars FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crilo_daily_challenges()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 u uuid:=auth.uid();
 dp date:=((pg_catalog.clock_timestamp() AT TIME ZONE 'UTC') - interval '22 hours')::date;
 rotation integer;
 s public.crilo_spin_sessions%ROWTYPE;
 d public.daily_runs%ROWTYPE;
 saved boolean:=false;
 eligible boolean:=false;
 keys text[];
 names text[];
 descriptions text[];
 values_now integer[];
 goals integer[];
 complete_today boolean[];
 total integer:=0;
 today_done integer:=0;
 next_reward integer;
 decoration integer:=0;
 tasks jsonb:='[]'::jsonb;
 i integer;
 spins_now integer:=0;
 ducks_now integer:=0;
 upgrades_now integer:=0;
 doubles_now integer:=0;
 extra_now integer:=0;
 numbers_now integer:=0;
BEGIN
 IF u IS NULL OR auth.role()<>'authenticated' THEN
  RAISE EXCEPTION 'Sign in to see Daily Challenges'
   USING ERRCODE='42501';
 END IF;
 -- Never award stars to anonymous, unverified, or banned accounts.
 SELECT EXISTS(
   SELECT 1 FROM auth.users a
   JOIN public.profiles p ON p.id=a.id
   WHERE a.id=u AND a.is_anonymous IS FALSE AND a.email IS NOT NULL
    AND a.email_confirmed_at IS NOT NULL
    AND (a.banned_until IS NULL OR a.banned_until<=pg_catalog.clock_timestamp())
    AND NOT EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=u)
    AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties x
     WHERE x.user_id=u AND x.daily_period=dp)
 ) INTO eligible;

 SELECT * INTO d FROM public.daily_runs
 WHERE user_id=u AND daily_period=dp AND is_test=false
  AND verified_spin_session_id IS NOT NULL
 ORDER BY id DESC LIMIT 1;
 saved:=FOUND;
 -- A verified server-managed official session is the ONLY in-progress source.
 -- A verified Guest Daily claimed at sign-in is covered by the saved Daily.
 SELECT * INTO s FROM public.crilo_spin_sessions
 WHERE user_id=u AND daily_period=dp
 ORDER BY created_at DESC LIMIT 1;
 spins_now:=GREATEST(COALESCE(s.spin_count,0),CASE WHEN saved THEN COALESCE(d.spins,0) ELSE 0 END);
 ducks_now:=GREATEST(COALESCE(s.ducks,0),CASE WHEN saved THEN COALESCE(d.ducks,0) ELSE 0 END);
 upgrades_now:=GREATEST(COALESCE(s.upgrades,0),CASE WHEN saved THEN COALESCE(d.upgrades,0) ELSE 0 END);
 doubles_now:=GREATEST(COALESCE(s.doubles,0),CASE WHEN saved THEN COALESCE(d.doubles,0) ELSE 0 END);
 extra_now:=GREATEST(COALESCE(s.extra_spins,0),CASE WHEN saved THEN COALESCE(d.extra_spins,0) ELSE 0 END);
 numbers_now:=GREATEST(COALESCE(s.numbers_landed,0),CASE WHEN saved THEN COALESCE(d.numbers_landed,0) ELSE 0 END);

 rotation:=(dp-DATE '2026-10-01');
 keys:=ARRAY['finish','',''];
 names:=ARRAY['Finish your Daily','',''];
 descriptions:=ARRAY['Complete your official Daily Wheel run.','',''];
 values_now:=ARRAY[CASE WHEN saved THEN 1 ELSE 0 END,0,0];
 goals:=ARRAY[1,1,1];
 CASE (rotation%3)
  WHEN 0 THEN
   keys[2]:='spin_3';names[2]:='Get rolling';
   descriptions[2]:='Make at least 3 verified spins in your official Daily.';
   values_now[2]:=spins_now;goals[2]:=3;
  WHEN 1 THEN
   keys[2]:='spin_5';names[2]:='Five and thriving';
   descriptions[2]:='Make at least 5 verified spins in your official Daily.';
   values_now[2]:=spins_now;goals[2]:=5;
  ELSE
   keys[2]:='sketch';names[2]:='Leave your mark';
   descriptions[2]:='Add a drawing to the center of your completed official Daily.';
   values_now[2]:=CASE WHEN saved AND d.drawing_is_blank IS FALSE THEN 1 ELSE 0 END;
 END CASE;
 CASE (rotation%5)
  WHEN 0 THEN
   keys[3]:='duck';names[3]:='A little quack';
   descriptions[3]:='Land on at least one Duck during your official Daily.';
   values_now[3]:=ducks_now;
  WHEN 1 THEN
   keys[3]:='upgrade';names[3]:='Level up';
   descriptions[3]:='Land on an Upgrade during your official Daily.';
   values_now[3]:=upgrades_now;
  WHEN 2 THEN
   keys[3]:='double';names[3]:='Double trouble';
   descriptions[3]:='Land on a ×2 during your official Daily.';
   values_now[3]:=doubles_now;
  WHEN 3 THEN
   keys[3]:='extra';names[3]:='One more round';
   descriptions[3]:='Land on +2 Spins during your official Daily.';
   values_now[3]:=extra_now;goals[3]:=2;
  ELSE
   keys[3]:='numbers';names[3]:='Number collector';
   descriptions[3]:='Land on at least 2 number slices during your official Daily.';
   values_now[3]:=numbers_now;goals[3]:=2;
 END CASE;
 -- Atomic server-side inserts: repeated status checks, retries, refreshes
 -- and parallel tabs can never claim a star twice.
 IF eligible THEN
  FOR i IN 1..3 LOOP
   IF values_now[i]>=goals[i] THEN
    INSERT INTO public.crilo_daily_challenge_stars(user_id,daily_period,challenge_key)
    VALUES(u,dp,keys[i])
    ON CONFLICT(user_id,daily_period,challenge_key) DO NOTHING;
   END IF;
  END LOOP;
 END IF;

 -- Moderation penalties invalidate stars for that Daily without destroying
 -- the audit trail. Other days are unaffected.
 SELECT count(*)::integer INTO total
 FROM public.crilo_daily_challenge_stars a
 WHERE a.user_id=u AND NOT EXISTS(
  SELECT 1 FROM public.crilo_daily_penalties penalty
  WHERE penalty.user_id=u AND penalty.daily_period=a.daily_period
 );
 IF total>=90 THEN decoration:=3;
 ELSIF total>=36 THEN decoration:=2;
 ELSIF total>=12 THEN decoration:=1;
 END IF;
 next_reward:=CASE WHEN total<12 THEN 12 WHEN total<36 THEN 36
  WHEN total<90 THEN 90 ELSE NULL END;
 FOR i IN 1..3 LOOP
  complete_today[i]:=eligible AND EXISTS(
   SELECT 1 FROM public.crilo_daily_challenge_stars a
   WHERE a.user_id=u AND a.daily_period=dp AND a.challenge_key=keys[i]
  );
  IF complete_today[i] THEN today_done:=today_done+1; END IF;
  tasks:=tasks||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
   'key',keys[i],'name',names[i],'description',descriptions[i],
   'progress',LEAST(goals[i],CASE WHEN eligible THEN values_now[i] ELSE 0 END),
   'goal',goals[i],'done',complete_today[i],'reward','1 Challenge Star'
  ));
 END LOOP;
 RETURN pg_catalog.jsonb_build_object(
  'period',dp,'tasks',tasks,'completed',today_done,
  'stars',total,'next_milestone',next_reward,'decoration',decoration,
  'milestones',pg_catalog.jsonb_build_array(12,36,90),
  'rewards','Decorative Challenge Card stamps only. No points, spins, odds, badges or leaderboard advantage.'
 );
END
$fn$;
REVOKE ALL ON FUNCTION public.crilo_daily_challenges() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_daily_challenges() TO authenticated;
COMMENT ON FUNCTION public.crilo_daily_challenges() IS
'3 rotating official-only tasks, idempotent Star awards, decorative 12/36/90 milestones; never changes competitive scoring';
COMMIT;