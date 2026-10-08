-- Crilo: finalize leaderboard achievements automatically at 22:01 UTC daily.
-- Requires Supabase pg_cron extension. Run once in Supabase SQL Editor.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.crilo_refresh_finalized_rank_badges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Only finalized official Dailies count. Ties share a dense rank.
  WITH ranks AS (
    SELECT user_id,daily_period,
      dense_rank() OVER(PARTITION BY daily_period ORDER BY score DESC) AS place
    FROM public.daily_runs
    WHERE is_test=false
      AND daily_period < ((now() AT TIME ZONE 'UTC' - interval '22 hours')::date)
  ), earned AS (
    SELECT user_id,'rank_100'::text AS badge_key FROM ranks WHERE place<=100
    UNION ALL SELECT user_id,'rank_50' FROM ranks WHERE place<=50
    UNION ALL SELECT user_id,'rank_25' FROM ranks WHERE place<=25
    UNION ALL SELECT user_id,'rank_10' FROM ranks WHERE place<=10
    UNION ALL SELECT user_id,'rank_5' FROM ranks WHERE place<=5
    UNION ALL SELECT user_id,'rank_3' FROM ranks WHERE place=3
    UNION ALL SELECT user_id,'rank_2' FROM ranks WHERE place=2
    UNION ALL SELECT user_id,'rank_1' FROM ranks WHERE place=1
    UNION ALL SELECT user_id,'rank_wins_5' FROM ranks WHERE place=1 GROUP BY user_id HAVING count(*)>=5
    UNION ALL SELECT user_id,'rank_wins_25' FROM ranks WHERE place=1 GROUP BY user_id HAVING count(*)>=25
  )
  INSERT INTO public.user_badges(user_id,badge_id,earned_at)
  SELECT DISTINCT e.user_id,b.id,now()
  FROM earned e JOIN public.badges b ON b.badge_key=e.badge_key
  ON CONFLICT DO NOTHING;
END;
$$;

-- Backfill any ranks already finalized.
SELECT public.crilo_refresh_finalized_rank_badges();

-- Cron uses the database server timezone (UTC on standard Supabase projects).
-- Replace an existing job with this name instead of creating duplicates.
DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job
  WHERE jobname='crilo-finalize-daily-rank-badges' LIMIT 1;
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
  PERFORM cron.schedule(
    'crilo-finalize-daily-rank-badges',
    '1 22 * * *',
    'SELECT public.crilo_refresh_finalized_rank_badges();'
  );
END $$;

-- Verify cron exists and the schedule is 22:01 UTC.
SELECT jobid,jobname,schedule,command,active
FROM cron.job WHERE jobname='crilo-finalize-daily-rank-badges';
