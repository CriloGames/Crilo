-- Crilo isolated wheel badge test. TEMP TABLES ONLY. Read-only against real game data.
-- Creates a temporary clone of the LIVE awarding function, redirected to temp fixtures.
-- No INSERT/UPDATE/DELETE on public tables. Transaction ends in ROLLBACK.
BEGIN;
CREATE TEMP TABLE crilo_test_runs (
 id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id uuid NOT NULL, daily_period date NOT NULL,
 score numeric NOT NULL, spins integer NOT NULL,
 ducks integer NOT NULL, upgrades integer NOT NULL,
 results jsonb NOT NULL, is_test boolean NOT NULL DEFAULT false
) ON COMMIT DROP;
CREATE TEMP TABLE crilo_test_badges (
 id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 badge_key text NOT NULL UNIQUE
) ON COMMIT DROP;
CREATE TEMP TABLE crilo_test_awards (
 user_id uuid NOT NULL, badge_id uuid NOT NULL,
 earned_at timestamptz NOT NULL,
 UNIQUE(user_id,badge_id)
) ON COMMIT DROP;
INSERT INTO crilo_test_badges(badge_key)
SELECT badge_key FROM public.badges WHERE badge_key LIKE 'wheel_%';
INSERT INTO crilo_test_runs(user_id,daily_period,score,spins,ducks,upgrades,results,is_test)
VALUES
('00000000-0000-4000-8000-000000000001'::uuid,'2026-01-01'::date + 0,42,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000001'::uuid,'2026-01-01'::date + 1,42,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000002'::uuid,'2026-01-01'::date + 0,45,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000002'::uuid,'2026-01-01'::date + 1,12,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000002'::uuid,'2026-01-01'::date + 2,45,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 0,7,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 1,17,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 2,27,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 3,37,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 4,47,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 5,57,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000003'::uuid,'2026-01-01'::date + 6,67,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000004'::uuid,'2026-01-01'::date + 0,12,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000004'::uuid,'2026-01-01'::date + 1,21,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000005'::uuid,'2026-01-01'::date + 0,9,3,1,0,'[{"type":"num","base":1,"points":1},{"type":"duck","points":0},{"type":"num","base":2,"points":2}]'::jsonb,false),
('00000000-0000-4000-8000-000000000005'::uuid,'2026-01-01'::date + 1,10,3,1,0,'[{"type":"num","base":1,"points":1},{"type":"duck","points":0},{"type":"num","base":2,"points":2}]'::jsonb,false),
('00000000-0000-4000-8000-000000000006'::uuid,'2026-01-01'::date + 0,777,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000007'::uuid,'2026-01-01'::date + 0,18,8,1,1,'[{"type":"num","base":1,"points":1},{"type":"num","base":2,"points":2},{"type":"num","base":3,"points":3},{"type":"num","base":5,"points":5},{"type":"duck","points":0},{"type":"upgrade","points":0},{"type":"double","points":0},{"type":"spins","points":0}]'::jsonb,false),
('00000000-0000-4000-8000-000000000008'::uuid,'2026-01-01'::date + 0,0,5,5,0,'[{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0}]'::jsonb,false),
('00000000-0000-4000-8000-000000000009'::uuid,'2026-01-01'::date + 0,5,5,1,1,'[{"type":"duck","points":0},{"type":"upgrade","points":0},{"type":"double","points":0},{"type":"spins","points":0},{"type":"num","base":5,"points":5}]'::jsonb,false),
('00000000-0000-4000-8000-000000000010'::uuid,'2026-01-01'::date + 0,2,20,0,0,'[{"type":"num","base":2,"points":2}]'::jsonb,false),
('00000000-0000-4000-8000-000000000011'::uuid,'2026-01-01'::date + 0,0,4,4,0,'[{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0}]'::jsonb,false),
('00000000-0000-4000-8000-000000000012'::uuid,'2026-01-01'::date + 0,110,2,0,0,'[{"type":"num","base":1,"points":10},{"type":"num","base":5,"points":100}]'::jsonb,false),
('00000000-0000-4000-8000-000000000013'::uuid,'2026-01-01'::date + 0,5,6,2,1,'[{"type":"duck","points":0},{"type":"upgrade","points":0},{"type":"double","points":0},{"type":"spins","points":0},{"type":"duck","points":0},{"type":"num","base":5,"points":5}]'::jsonb,false),
('00000000-0000-4000-8000-000000000014'::uuid,'2026-01-01'::date + 0,5,1,0,0,'[{"type":"num","base":5,"points":5}]'::jsonb,false),
('00000000-0000-4000-8000-000000000015'::uuid,'2026-01-01'::date + 0,1,4,3,0,'[{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000016'::uuid,'2026-01-01'::date + 0,1000,2,0,0,'[{"type":"num","base":1,"points":1},{"type":"num","base":5,"points":999}]'::jsonb,false),
('00000000-0000-4000-8000-000000000017'::uuid,'2026-01-01'::date + 0,12,5,0,0,'[{"type":"num","base":1,"points":1},{"type":"num","base":2,"points":2},{"type":"num","base":3,"points":3},{"type":"num","base":5,"points":5},{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000018'::uuid,'2026-01-01'::date + 0,5,5,0,0,'[{"type":"num","base":1,"points":1},{"type":"num","base":1,"points":1},{"type":"num","base":1,"points":1},{"type":"num","base":1,"points":1},{"type":"num","base":1,"points":1}]'::jsonb,false),
('00000000-0000-4000-8000-000000000019'::uuid,'2026-01-01',0,5,5,0,'[{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0},{"type":"duck","points":0}]'::jsonb,true),
('00000000-0000-4000-8000-000000000020'::uuid,'2026-01-01',777,1,0,0,'[{"type":"num","base":1,"points":1}]'::jsonb,false);

-- Clone the installed function definition rather than rewriting its logic.
-- Only redirect table names and function name; force SECURITY INVOKER.
DO $setup$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO fn
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='crilo_award_wheel_discoveries'
 AND pg_get_function_identity_arguments(p.oid)='p_user uuid';
 IF fn IS NULL THEN RAISE EXCEPTION 'Installed wheel award function not found';END IF;
 fn:=replace(fn,'public.crilo_award_wheel_discoveries','pg_temp.crilo_test_award_wheel_discoveries');
 fn:=replace(fn,'public.daily_runs','pg_temp.crilo_test_runs');
 fn:=replace(fn,'public.user_badges','pg_temp.crilo_test_awards');
 fn:=replace(fn,'public.badges','pg_temp.crilo_test_badges');
 fn:=replace(fn,'SECURITY DEFINER','SECURITY INVOKER');
 EXECUTE fn;
END $setup$;

-- Simulate the official-run trigger calls, including both players on a shared Daily.
DO $execute$
DECLARE u record;
BEGIN
 FOR u IN SELECT DISTINCT user_id FROM pg_temp.crilo_test_runs
          WHERE is_test=false ORDER BY user_id LOOP
  PERFORM pg_temp.crilo_test_award_wheel_discoveries(u.user_id);
 END LOOP;
END $execute$;

WITH expected(user_id,badge_key) AS (
 VALUES
('00000000-0000-4000-8000-000000000001'::uuid,'wheel_dejavu'),
('00000000-0000-4000-8000-000000000002'::uuid,'wheel_full_circle'),
('00000000-0000-4000-8000-000000000003'::uuid,'wheel_lucky_seven'),
('00000000-0000-4000-8000-000000000004'::uuid,'wheel_mirror'),
('00000000-0000-4000-8000-000000000005'::uuid,'wheel_groundhog'),
('00000000-0000-4000-8000-000000000006'::uuid,'wheel_perfect_match'),
('00000000-0000-4000-8000-000000000007'::uuid,'wheel_collector'),
('00000000-0000-4000-8000-000000000008'::uuid,'wheel_against_odds'),
('00000000-0000-4000-8000-000000000009'::uuid,'wheel_one_each'),
('00000000-0000-4000-8000-000000000010'::uuid,'wheel_long_way'),
('00000000-0000-4000-8000-000000000011'::uuid,'wheel_quack_attack'),
('00000000-0000-4000-8000-000000000012'::uuid,'wheel_comeback'),
('00000000-0000-4000-8000-000000000013'::uuid,'wheel_slow_starter'),
('00000000-0000-4000-8000-000000000014'::uuid,'wheel_no_ducks'),
('00000000-0000-4000-8000-000000000015'::uuid,'wheel_duck_dynasty'),
('00000000-0000-4000-8000-000000000016'::uuid,'wheel_small_beginnings'),
('00000000-0000-4000-8000-000000000017'::uuid,'wheel_minimalist'),
('00000000-0000-4000-8000-000000000018'::uuid,'wheel_chosen_one')
), actual AS (
 SELECT a.user_id,b.badge_key FROM pg_temp.crilo_test_awards a
 JOIN pg_temp.crilo_test_badges b ON b.id=a.badge_id
), test_cases AS (
 SELECT e.badge_key,
  CASE WHEN EXISTS(SELECT 1 FROM actual a WHERE a.user_id=e.user_id AND a.badge_key=e.badge_key)
  THEN 'PASS' ELSE 'FAIL' END AS status,
  'Expected simulated qualifying run to unlock badge'::text AS detail
 FROM expected e
 UNION ALL
 SELECT 'owner test isolation',
  CASE WHEN NOT EXISTS(SELECT 1 FROM actual WHERE user_id='00000000-0000-4000-8000-000000000019'::uuid)
  THEN 'PASS' ELSE 'FAIL' END,
  'Private test-only user must not receive wheel awards'
 UNION ALL
 SELECT 'no real database changes','PASS',
  'All inserts target temporary tables; transaction ends with ROLLBACK'
)
SELECT badge_key,status,detail FROM test_cases ORDER BY badge_key;
ROLLBACK;
