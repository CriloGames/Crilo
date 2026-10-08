-- Crilo Daily + finalized leaderboard achievements.
-- Run in Supabase SQL Editor. Official runs only; never awards active-period ranks.
CREATE OR REPLACE FUNCTION public.crilo_award_daily_rank_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_user uuid; v_runs int; v_streak int; v_keys text[]:=ARRAY[]::text[]; v_k int;
 v_final date:=(now() AT TIME ZONE 'UTC' - interval '22 hours')::date;
BEGIN
 IF TG_OP='INSERT' AND NEW.is_test IS TRUE THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  v_user:=NEW.user_id;
  SELECT count(DISTINCT daily_period) INTO v_runs
  FROM public.daily_runs WHERE user_id=v_user AND is_test=false;
  IF v_runs>=1 THEN v_keys:=array_append(v_keys,'daily_1');END IF;
  IF v_runs>=3 THEN v_keys:=array_append(v_keys,'daily_3');END IF;
  FOREACH v_k IN ARRAY ARRAY[25,50,100,250,500,1000] LOOP
   IF v_runs>=v_k THEN v_keys:=array_append(v_keys,'runs_'||v_k);END IF;
  END LOOP;
  SELECT coalesce(max(cnt),0) INTO v_streak FROM (
   SELECT count(*) AS cnt FROM (
    SELECT daily_period, daily_period-(row_number() OVER (ORDER BY daily_period))::int AS grp
    FROM (SELECT DISTINCT daily_period FROM public.daily_runs WHERE user_id=v_user AND is_test=false) dates
   ) streak_dates GROUP BY grp
  ) streak_groups;
  FOREACH v_k IN ARRAY ARRAY[7,14,30,50,100,365] LOOP
   IF v_streak>=v_k THEN v_keys:=array_append(v_keys,'daily_'||v_k);END IF;
  END LOOP;
  INSERT INTO public.user_badges(user_id,badge_id,earned_at)
  SELECT v_user,b.id,now() FROM public.badges b WHERE b.badge_key=ANY(v_keys)
  ON CONFLICT DO NOTHING;
 END IF;
 -- Finalized rankings: never rank the current Daily.
 WITH official AS (
  SELECT user_id,daily_period,score FROM public.daily_runs
  WHERE is_test=false AND daily_period<v_final
 ), ranks AS (
  SELECT user_id,daily_period,dense_rank() OVER(PARTITION BY daily_period ORDER BY score DESC) AS place
  FROM official
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
 SELECT DISTINCT e.user_id,b.id,now() FROM earned e JOIN public.badges b ON b.badge_key=e.badge_key
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crilo_daily_rank_badges_on_daily ON public.daily_runs;
CREATE TRIGGER crilo_daily_rank_badges_on_daily AFTER INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_award_daily_rank_badges();

-- Backfill Daily badges from historical official runs.
WITH dates AS (
 SELECT DISTINCT user_id,daily_period FROM public.daily_runs WHERE is_test=false
), grouped AS (
 SELECT user_id,daily_period,daily_period-(row_number() OVER(PARTITION BY user_id ORDER BY daily_period))::int AS grp FROM dates
), summary AS (
 SELECT user_id,count(*) AS runs FROM dates GROUP BY user_id
), streaks AS (
 SELECT user_id,max(n) AS longest FROM (SELECT user_id,grp,count(*) AS n FROM grouped GROUP BY user_id,grp) s GROUP BY user_id
), earned AS (
 SELECT s.user_id,b.badge_key FROM summary s JOIN streaks st USING(user_id)
 CROSS JOIN public.badges b
 WHERE (b.badge_key='daily_1' AND s.runs>=1)
 OR (b.badge_key='daily_3' AND s.runs>=3)
 OR (b.badge_key ~ '^runs_[0-9]+$' AND s.runs>=split_part(b.badge_key,'_',2)::int)
 OR (b.badge_key IN ('daily_7','daily_14','daily_30','daily_50','daily_100','daily_365')
     AND st.longest>=split_part(b.badge_key,'_',2)::int)
)
INSERT INTO public.user_badges(user_id,badge_id,earned_at)
SELECT e.user_id,b.id,now() FROM earned e JOIN public.badges b ON b.badge_key=e.badge_key
ON CONFLICT DO NOTHING;

-- Backfill finalized leaderboard placements now.
WITH ranks AS (
 SELECT user_id,daily_period,dense_rank() OVER(PARTITION BY daily_period ORDER BY score DESC) AS place
 FROM public.daily_runs WHERE is_test=false AND daily_period<((now() AT TIME ZONE 'UTC' - interval '22 hours')::date)
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
SELECT DISTINCT e.user_id,b.id,now() FROM earned e JOIN public.badges b ON b.badge_key=e.badge_key
ON CONFLICT DO NOTHING;
-- NOTE: Finalized leaderboard awards run when the NEXT official Daily is inserted.
-- For days with no subsequent run, schedule a daily refresh after 22:00 UTC.
-- daily_draw and social/secret achievements require separate verified definitions.
