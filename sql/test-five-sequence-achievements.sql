-- Crilo: five sequence badge positive/negative simulation. READ-ONLY to permanent tables.
-- Temporary fixtures + cloned production award function; ROLLBACK at end.
BEGIN;
CREATE TEMP TABLE crilo_seq_badges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),badge_key text UNIQUE NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE crilo_seq_awards(user_id uuid NOT NULL,badge_id uuid NOT NULL,earned_at timestamptz,UNIQUE(user_id,badge_id)) ON COMMIT DROP;
INSERT INTO crilo_seq_badges(badge_key)
SELECT badge_key FROM public.badges WHERE badge_key IN
('seq_comeback','seq_first_last_special','seq_four_specials','seq_no_repeat','seq_upgrade_sandwich');
DO $$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='crilo_award_missing_sequence_badges'
 AND pg_get_function_identity_arguments(p.oid)='p_run public.daily_runs';
 IF src IS NULL THEN RAISE EXCEPTION 'Sequence award function not installed'; END IF;
 src:=replace(src,'public.crilo_award_missing_sequence_badges','pg_temp.crilo_seq_award');
 src:=replace(src,'public.user_badges','pg_temp.crilo_seq_awards');
 src:=replace(src,'public.badges','pg_temp.crilo_seq_badges');
 src:=replace(src,'SECURITY DEFINER','SECURITY INVOKER');
 EXECUTE src;
END $$;
CREATE TEMP TABLE crilo_seq_cases(
 case_id int PRIMARY KEY,badge_key text NOT NULL,should_award boolean NOT NULL,
 run_is_test boolean NOT NULL DEFAULT false,final_score numeric NOT NULL,results jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO crilo_seq_cases(case_id,badge_key,should_award,run_is_test,final_score,results) VALUES
(1,'seq_comeback',true,false,10,'[{"type":"num","base":1,"points":3},{"type":"num","base":5,"points":7}]'),
(2,'seq_comeback',false,false,10,'[{"type":"num","base":5,"points":9},{"type":"num","base":1,"points":1}]'),
(3,'seq_first_last_special',true,false,10,'[{"type":"duck"},{"type":"num","base":5,"points":10},{"type":"double"}]'),
(4,'seq_first_last_special',false,false,10,'[{"type":"num","base":1,"points":1},{"type":"duck"},{"type":"num","base":5,"points":9}]'),
(5,'seq_four_specials',true,false,10,'[{"type":"duck"},{"type":"upgrade"},{"type":"double"},{"type":"spins"},{"type":"num","base":5,"points":10}]'),
(6,'seq_four_specials',false,false,10,'[{"type":"duck"},{"type":"upgrade"},{"type":"double"},{"type":"num","base":5,"points":10}]'),
(7,'seq_no_repeat',true,false,10,'[{"type":"num","base":1,"points":1},{"type":"num","base":2,"points":2},{"type":"num","base":3,"points":3},{"type":"num","base":5,"points":4},{"type":"duck"}]'),
(8,'seq_no_repeat',false,false,10,'[{"type":"num","base":1,"points":1},{"type":"num","base":2,"points":2},{"type":"num","base":1,"points":1},{"type":"num","base":5,"points":5},{"type":"duck"}]'),
(9,'seq_upgrade_sandwich',true,false,10,'[{"type":"num","base":1,"points":1},{"type":"upgrade"},{"type":"num","base":3,"points":9}]'),
(10,'seq_upgrade_sandwich',false,false,10,'[{"type":"upgrade"},{"type":"num","base":1,"points":1},{"type":"num","base":3,"points":9}]'),
(11,'seq_comeback',false,true,10,'[{"type":"num","base":5,"points":10}]'),
(12,'seq_first_last_special',false,true,10,'[{"type":"duck"},{"type":"double"}]'),
(13,'seq_four_specials',false,true,10,'[{"type":"duck"},{"type":"upgrade"},{"type":"double"},{"type":"spins"}]'),
(14,'seq_no_repeat',false,true,10,'[{"type":"num","base":1},{"type":"num","base":2},{"type":"num","base":3},{"type":"num","base":5},{"type":"duck"}]'),
(15,'seq_upgrade_sandwich',false,true,10,'[{"type":"num","base":1},{"type":"upgrade"},{"type":"num","base":3}]');
DO $$
DECLARE c record; row_run public.daily_runs%rowtype;
BEGIN
 FOR c IN SELECT * FROM pg_temp.crilo_seq_cases ORDER BY case_id LOOP
  row_run.user_id:=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid;
  row_run.is_test:=c.run_is_test;
  row_run.score:=c.final_score;
  row_run.results:=c.results;
  PERFORM pg_temp.crilo_seq_award(row_run);
 END LOOP;
END $$;
WITH observed AS (
 SELECT c.case_id,c.badge_key,c.should_award,c.run_is_test,
 EXISTS(SELECT 1 FROM pg_temp.crilo_seq_awards a JOIN pg_temp.crilo_seq_badges b ON b.id=a.badge_id
 WHERE a.user_id=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid
 AND b.badge_key=c.badge_key) AS awarded
 FROM pg_temp.crilo_seq_cases c
)
SELECT case_id,badge_key,CASE WHEN run_is_test THEN 'OWNER/TEST ISOLATION' WHEN should_award THEN 'POSITIVE' ELSE 'NEGATIVE' END AS scenario,
 CASE WHEN awarded=should_award THEN 'PASS' ELSE 'FAIL' END AS status,
 should_award AS expected_award,awarded AS actual_award
FROM observed ORDER BY case_id;
ROLLBACK;
