-- Crilo extreme sequence rarity: 9 isolated test cases.
-- Only temporary badge tables receive awards; rollback discards all fixtures.
BEGIN;
CREATE TEMP TABLE crilo_ext_badges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),badge_key text UNIQUE NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE crilo_ext_awards(user_id uuid NOT NULL,badge_id uuid NOT NULL,earned_at timestamptz,UNIQUE(user_id,badge_id)) ON COMMIT DROP;
INSERT INTO crilo_ext_badges(badge_key)
SELECT badge_key FROM public.badges WHERE badge_key IN ('rarity_1000000','rarity_10000000','rarity_100000000');
DO $$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='crilo_award_extreme_sequence_rarity'
 AND p.pronargs=1 AND p.proargtypes[0]='public.daily_runs'::regtype;
 IF src IS NULL THEN RAISE EXCEPTION 'Extreme rarity award function not installed';END IF;
 src:=replace(src,'public.crilo_award_extreme_sequence_rarity','pg_temp.crilo_ext_award');
 src:=replace(src,'public.user_badges','pg_temp.crilo_ext_awards');
 src:=replace(src,'public.badges','pg_temp.crilo_ext_badges');
 src:=replace(src,'SECURITY DEFINER','SECURITY INVOKER');
 EXECUTE src;
END $$;
CREATE TEMP TABLE crilo_ext_cases(case_id int PRIMARY KEY,scenario text,expected text[],test_run boolean,probability numeric) ON COMMIT DROP;
INSERT INTO crilo_ext_cases VALUES
(1,'1M positive',ARRAY['rarity_1000000'],false,0.05),
(2,'10M positive',ARRAY['rarity_1000000','rarity_10000000'],false,0.03),
(3,'100M positive',ARRAY['rarity_1000000','rarity_10000000','rarity_100000000'],false,0.02),
(4,'1M negative',ARRAY[]::text[],false,0.07),
(5,'10M negative',ARRAY['rarity_1000000'],false,0.05),
(6,'100M negative',ARRAY['rarity_1000000','rarity_10000000'],false,0.03),
(7,'private 1M isolation',ARRAY[]::text[],true,0.05),
(8,'private 10M isolation',ARRAY[]::text[],true,0.03),
(9,'private 100M isolation',ARRAY[]::text[],true,0.02);
DO $$
DECLARE c record;r public.daily_runs%rowtype;
BEGIN
 FOR c IN SELECT * FROM pg_temp.crilo_ext_cases ORDER BY case_id LOOP
  r.user_id:=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid;
  r.is_test:=c.test_run;
  r.score:=100;
  r.results:=(SELECT jsonb_agg(jsonb_build_object('type','num','base',1,'probability',c.probability,'points',1))
    FROM generate_series(1,5));
  PERFORM pg_temp.crilo_ext_award(r);
 END LOOP;
END $$;
WITH actual AS (
 SELECT c.case_id,c.scenario,c.expected,coalesce(array_agg(b.badge_key ORDER BY b.badge_key) FILTER(WHERE b.badge_key IS NOT NULL),ARRAY[]::text[]) AS awarded
 FROM pg_temp.crilo_ext_cases c
 LEFT JOIN pg_temp.crilo_ext_awards a ON a.user_id=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid
 LEFT JOIN pg_temp.crilo_ext_badges b ON b.id=a.badge_id
 GROUP BY c.case_id,c.scenario,c.expected
)
SELECT case_id,scenario,CASE WHEN awarded=ARRAY(SELECT unnest(expected) ORDER BY 1) THEN 'PASS' ELSE 'FAIL' END AS status,expected,awarded
FROM actual ORDER BY case_id;
ROLLBACK;
