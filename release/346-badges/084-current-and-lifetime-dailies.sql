-- Crilo: current Daily is the 22:00 UTC reset period, not midnight.
-- This migration matches the live 2026-10-11 transactionally-updated totals.
CREATE TABLE IF NOT EXISTS public.crilo_daily_period_counts(
 period date PRIMARY KEY,runs bigint NOT NULL DEFAULT 0 CHECK(runs>=0));
ALTER TABLE public.crilo_daily_period_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_daily_period_counts FROM public,anon,authenticated;
INSERT INTO public.crilo_daily_period_counts(period,runs)
SELECT d.daily_period,count(*) FROM public.daily_runs d
WHERE d.is_test=false AND d.verified_spin_session_id IS NOT NULL AND d.daily_period IS NOT NULL
GROUP BY d.daily_period
ON CONFLICT(period) DO UPDATE SET runs=excluded.runs;
CREATE OR REPLACE FUNCTION public.crilo_update_daily_period_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE before_day date;after_day date;
BEGIN
 IF tg_op<>'INSERT' AND old.is_test=false AND old.verified_spin_session_id IS NOT NULL THEN before_day:=old.daily_period;END IF;
 IF tg_op<>'DELETE' AND new.is_test=false AND new.verified_spin_session_id IS NOT NULL THEN after_day:=new.daily_period;END IF;
 IF before_day IS DISTINCT FROM after_day THEN
  IF before_day IS NOT NULL THEN
   UPDATE public.crilo_daily_period_counts SET runs=runs-1 WHERE period=before_day AND runs>0;
   IF NOT FOUND THEN RAISE EXCEPTION 'Daily counter out of sync';END IF;
  END IF;
  IF after_day IS NOT NULL THEN
   INSERT INTO public.crilo_daily_period_counts(period,runs) VALUES(after_day,1)
   ON CONFLICT(period) DO UPDATE SET runs=public.crilo_daily_period_counts.runs+1;
  END IF;
 END IF;
 IF tg_op='DELETE' THEN RETURN old;END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.crilo_update_daily_period_counts() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS crilo_daily_period_count_change ON public.daily_runs;
CREATE TRIGGER crilo_daily_period_count_change AFTER INSERT OR DELETE OR UPDATE OF daily_period,is_test,verified_spin_session_id
ON public.daily_runs FOR EACH ROW EXECUTE FUNCTION public.crilo_update_daily_period_counts();
CREATE OR REPLACE FUNCTION public.crilo_public_daily_completion_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT jsonb_build_object(
 'today',coalesce((SELECT runs FROM public.crilo_daily_period_counts WHERE period=((now() AT TIME ZONE 'UTC')-interval '22 hours')::date),0),
 'all_time',coalesce((SELECT completed FROM public.crilo_official_daily_total WHERE singleton=1),0),
 'period',((now() AT TIME ZONE 'UTC')-interval '22 hours')::date)
$$;
REVOKE ALL ON FUNCTION public.crilo_public_daily_completion_counts() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_public_daily_completion_counts() TO anon,authenticated,service_role;
