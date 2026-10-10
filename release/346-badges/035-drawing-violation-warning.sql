-- Crilo: owner-confirmed drawing violations. Do not execute on player records during QA.
CREATE TABLE IF NOT EXISTS public.crilo_daily_penalties(
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 daily_period date NOT NULL,
 original_run_id bigint NOT NULL UNIQUE,
 removed_score bigint NOT NULL,
 reason_code text NOT NULL CHECK(reason_code IN ('profanity','sexual','hate','links','qr','abuse','other')),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 issued_by uuid NOT NULL,
 PRIMARY KEY(user_id,daily_period)
);
CREATE TABLE IF NOT EXISTS public.crilo_account_warnings(
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 first_reason_code text NOT NULL CHECK(first_reason_code IN ('profanity','sexual','hate','links','qr','abuse','other')),
 first_daily_period date NOT NULL,
 first_flagged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_streak_reset_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 violation_count integer NOT NULL DEFAULT 1 CHECK(violation_count>=1)
);
CREATE TABLE IF NOT EXISTS public.crilo_moderation_notices(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 original_run_id bigint NOT NULL UNIQUE,
 daily_period date NOT NULL,
 reason_code text NOT NULL CHECK(reason_code IN ('profanity','sexual','hate','links','qr','abuse','other')),
 removed_score bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS crilo_moderation_notices_owner_time
 ON public.crilo_moderation_notices(user_id,created_at DESC);

ALTER TABLE public.crilo_daily_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crilo_account_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crilo_moderation_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_daily_penalties FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.crilo_account_warnings FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.crilo_moderation_notices FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crilo_warning_reason(p_reason text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
 SELECT CASE p_reason
 WHEN 'profanity' THEN 'Profanity or offensive text'
 WHEN 'sexual' THEN 'Sexual or genital drawing'
 WHEN 'hate' THEN 'Hate or extremist symbol'
 WHEN 'links' THEN 'Website link or external promotion'
 WHEN 'qr' THEN 'QR code or scannable link'
 WHEN 'abuse' THEN 'Harassment or abusive message'
 WHEN 'other' THEN 'Other inappropriate drawing'
 ELSE 'Inappropriate drawing' END
$fn$;

-- The warning resets only the *current* chain of valid Dailies.
-- Historical longest-streak achievements are recalculated from the remaining
-- legitimate records, independently of this new current-chain cutoff.
CREATE OR REPLACE FUNCTION public.crilo_warning_current_streak(p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 WITH clock AS (
  SELECT ((now() AT TIME ZONE 'UTC')-interval '22 hours')::date AS period,
         (SELECT w.last_streak_reset_at FROM public.crilo_account_warnings w
           WHERE w.user_id=p_user) AS cutoff
 ), dates AS (
  SELECT DISTINCT d.daily_period
  FROM public.daily_runs d CROSS JOIN clock c
  WHERE d.user_id=p_user AND d.is_test=false AND d.daily_period IS NOT NULL
   AND (c.cutoff IS NULL OR d.created_at>c.cutoff)
 ), numbered AS (
  SELECT daily_period,daily_period-row_number() OVER(ORDER BY daily_period)::integer AS grp
  FROM dates
 ), streaks AS (
  SELECT count(*)::integer AS days,max(daily_period) AS last_day FROM numbered GROUP BY grp
 )
 SELECT coalesce((SELECT s.days FROM streaks s CROSS JOIN clock c
    WHERE s.last_day>=c.period-1 ORDER BY s.last_day DESC LIMIT 1),0);
$fn$;
REVOKE ALL ON FUNCTION public.crilo_warning_current_streak(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_warning_current_streak(uuid) TO authenticated;

-- Remove after-action cached streak drift on later valid official runs.
CREATE OR REPLACE FUNCTION public.crilo_warning_sync_cached_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF coalesce(NEW.is_test,false)=false AND EXISTS(
  SELECT 1 FROM public.crilo_account_warnings w WHERE w.user_id=NEW.user_id
 ) THEN
  UPDATE public.player_stats
  SET current_streak=public.crilo_warning_current_streak(NEW.user_id)
  WHERE user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS zzzz_crilo_warning_sync_cached_streak ON public.daily_runs;
CREATE TRIGGER zzzz_crilo_warning_sync_cached_streak
 AFTER INSERT ON public.daily_runs FOR EACH ROW EXECUTE FUNCTION public.crilo_warning_sync_cached_streak();

-- Preserve the existing JSON metrics API while using the authoritative
-- post-warning streak cutoff. Abort if the upstream definition has changed.
DO $modify$
DECLARE fn text; target text; updated text;
BEGIN
 fn:=pg_get_functiondef('public.crilo_profile_metrics(uuid)'::regprocedure);
 IF position('''current_streak'',public.crilo_warning_current_streak(p_user)' IN fn)=0 THEN
  target:='''current_streak'',coalesce((select days from streaks';
  IF position(target IN fn)=0 THEN RAISE EXCEPTION 'Profile metrics streak anchor changed';END IF;
  updated:=regexp_replace(fn,
    '''current_streak'',coalesce\(\(select days from streaks.*?order by last_day desc limit 1\),0\)',
    '''current_streak'',public.crilo_warning_current_streak(p_user)','s');
  IF updated=fn OR position('''current_streak'',public.crilo_warning_current_streak(p_user)' IN updated)=0
  THEN RAISE EXCEPTION 'Streak replacement did not apply';END IF;
  EXECUTE updated;
 END IF;
END $modify$;

-- Even if a run has been deleted, the original period cannot be submitted
-- again. This runs after the server stamps the authoritative daily_period.
CREATE OR REPLACE FUNCTION public.crilo_reject_penalized_daily()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF coalesce(NEW.is_test,false)=false AND EXISTS(
  SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=NEW.user_id AND p.daily_period=NEW.daily_period
 ) THEN
  RAISE EXCEPTION 'This Daily was removed for a drawing violation. You cannot replay this Daily.'
   USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS zz0_crilo_reject_penalized_daily ON public.daily_runs;
CREATE TRIGGER zz0_crilo_reject_penalized_daily
 BEFORE INSERT ON public.daily_runs FOR EACH ROW EXECUTE FUNCTION public.crilo_reject_penalized_daily();

-- Prevent creating or continuing an official spin session for a penalized
-- Daily. Old stored sessions cannot be used to circumvent the insert guard.
DO $enforce$
DECLARE fn text; updated text;
BEGIN
 fn:=pg_get_functiondef('public.crilo_begin_server_spin_session()'::regprocedure);
 IF position('crilo_daily_penalties' IN fn)=0 THEN
  IF position('PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,442204));' IN fn)=0
  THEN RAISE EXCEPTION 'Begin session structure changed';END IF;
  updated:=replace(fn,
   'PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,442204));',
   'PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,442204));'||chr(10)||
   ' IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=uid AND x.daily_period=period) THEN RAISE EXCEPTION ''Daily locked after drawing removal'' USING ERRCODE=''23514'';END IF;');
  EXECUTE updated;
 END IF;
 fn:=pg_get_functiondef('public.crilo_server_spin(uuid)'::regprocedure);
 IF position('crilo_daily_penalties' IN fn)=0 THEN
  IF position('IF s.finished_at IS NOT NULL' IN fn)=0
  THEN RAISE EXCEPTION 'Spin session structure changed';END IF;
  updated:=replace(fn,'IF s.finished_at IS NOT NULL',
   'IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=s.user_id AND x.daily_period=s.daily_period) THEN RAISE EXCEPTION ''Daily locked after drawing removal'' USING ERRCODE=''23514'';END IF;'||chr(10)||
   ' IF s.finished_at IS NOT NULL');
  EXECUTE updated;
 END IF;
END $enforce$;

-- Public warning details expose only moderated, predefined categories.
CREATE OR REPLACE FUNCTION public.crilo_public_warning_status(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT CASE WHEN w.user_id IS NULL THEN jsonb_build_object('flagged',false)
 ELSE jsonb_build_object('flagged',true,'reason',public.crilo_warning_reason(w.first_reason_code),
  'first_flagged_at',w.first_flagged_at,
  'meaning','This account has received its one official warning for an inappropriate Daily drawing. The offending Daily and its points were removed. Further violations may result in a ban.')
 END
 FROM (SELECT 1) fixed LEFT JOIN public.crilo_account_warnings w ON w.user_id=p_user
$fn$;

CREATE OR REPLACE FUNCTION public.crilo_my_daily_penalty(p_period date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE result jsonb; period date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 period:=coalesce(p_period,((now() AT TIME ZONE 'UTC')-interval '22 hours')::date);
 SELECT jsonb_build_object('blocked',true,'period',x.daily_period,
  'reason',public.crilo_warning_reason(x.reason_code))
 INTO result FROM public.crilo_daily_penalties x WHERE x.user_id=auth.uid() AND x.daily_period=period;
 RETURN coalesce(result,jsonb_build_object('blocked',false));
END $fn$;

CREATE OR REPLACE FUNCTION public.crilo_my_moderation_notices()
RETURNS TABLE(id bigint,reason text,daily_period date,removed_score bigint,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT n.id,public.crilo_warning_reason(n.reason_code),n.daily_period,n.removed_score,
  n.created_at,n.read_at FROM public.crilo_moderation_notices n
 WHERE n.user_id=auth.uid() ORDER BY n.created_at DESC LIMIT 15;
END $fn$;
CREATE OR REPLACE FUNCTION public.crilo_read_moderation_notice(p_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE affected integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 UPDATE public.crilo_moderation_notices SET read_at=coalesce(read_at,now())
 WHERE id=p_id AND user_id=auth.uid();
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN affected=1;
END $fn$;

-- Single atomic owner decision. Failure rolls back the warning, penalty,
-- notice and run deletion together. No auto-ban, no test-run penalty.
CREATE OR REPLACE FUNCTION public.crilo_owner_penalize_daily(p_run_id bigint,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid;v_period date;v_score bigint;v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner=true)
 THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501';END IF;
 IF p_reason IS NULL OR p_reason NOT IN ('profanity','sexual','hate','links','qr','abuse','other')
 THEN RAISE EXCEPTION 'Select an appropriate violation reason';END IF;
 SELECT d.user_id,d.daily_period,d.score
 INTO v_user,v_period,v_score
 FROM public.daily_runs d
 LEFT JOIN public.crilo_drawing_reviews r ON r.run_id=d.id
 WHERE d.id=p_run_id AND coalesce(d.is_test,false)=false
  AND d.drawing IS NOT NULL
  AND coalesce(r.status,'pending')='pending'
 FOR UPDATE OF d;
 IF v_user IS NULL THEN RETURN false;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,442204));
 IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=v_user AND p.daily_period=v_period)
 THEN RETURN false;END IF;

 INSERT INTO public.crilo_daily_penalties(user_id,daily_period,original_run_id,removed_score,reason_code,issued_by)
 VALUES (v_user,v_period,p_run_id,v_score,p_reason,auth.uid());
 INSERT INTO public.crilo_account_warnings(user_id,first_reason_code,first_daily_period,violation_count)
 VALUES(v_user,p_reason,v_period,1)
 ON CONFLICT(user_id) DO UPDATE SET
  last_streak_reset_at=clock_timestamp(),
  violation_count=public.crilo_account_warnings.violation_count+1;
 INSERT INTO public.crilo_moderation_notices(user_id,original_run_id,daily_period,reason_code,removed_score)
 VALUES(v_user,p_run_id,v_period,p_reason,v_score);

 -- These badge IDs are refreshed from the remaining eligible official runs by
 -- the existing AFTER DELETE trigger, including badges that were run-scoped.
 DELETE FROM public.user_badges ub WHERE ub.user_id=v_user AND ub.run_id=p_run_id;
 DELETE FROM public.daily_runs d WHERE d.id=p_run_id AND d.user_id=v_user
   AND coalesce(d.is_test,false)=false;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Run could not be removed';END IF;
 DELETE FROM public.featured_badges fb
 WHERE fb.user_id=v_user AND NOT EXISTS(
  SELECT 1 FROM public.user_badges ub WHERE ub.user_id=fb.user_id AND ub.badge_id=fb.badge_id);
 UPDATE public.player_stats SET current_streak=public.crilo_warning_current_streak(v_user)
 WHERE user_id=v_user;
 RETURN true;
END $fn$;

-- Keep old owner Drawing Review calls safe: any old remove action must still
-- record a warning rather than silently permitting replay. New UI sends
-- the exact category through crilo_owner_penalize_daily.
DO $legacy$
DECLARE fn text; updated text;
BEGIN
 fn:=pg_get_functiondef('public.crilo_owner_drawing_decision(bigint,text)'::regprocedure);
 IF position('perform public.crilo_owner_penalize_daily' IN lower(fn))=0 THEN
  IF position('delete from public.daily_runs d where d.id=p_run_id' IN lower(fn))=0
  THEN RAISE EXCEPTION 'Old moderation function changed'; END IF;
  updated:=regexp_replace(fn,
   'delete from public.daily_runs d where d.id=p_run_id and d.user_id=v_uid and coalesce\(d.is_test,false\)=false;\s*get diagnostics n=row_count;\s*return n=1;',
   'return public.crilo_owner_penalize_daily(p_run_id,''other'');','i');
  IF updated=fn THEN RAISE EXCEPTION 'Could not route legacy remove through penalty';END IF;
  EXECUTE updated;
 END IF;
END $legacy$;

REVOKE ALL ON FUNCTION public.crilo_owner_penalize_daily(bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_my_daily_penalty(date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_my_moderation_notices() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_read_moderation_notice(bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_public_warning_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_owner_penalize_daily(bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_my_daily_penalty(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_my_moderation_notices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_read_moderation_notice(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_public_warning_status(uuid) TO anon,authenticated;
