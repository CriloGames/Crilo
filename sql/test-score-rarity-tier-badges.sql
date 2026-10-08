-- Crilo: isolated tests of five score-rarity tiers and private-run isolation.
-- No live user_badges rows are written. Entire transaction rolls back.
BEGIN;
CREATE TEMP TABLE crilo_tier_badges(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),badge_key text UNIQUE NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE crilo_tier_awards(user_id uuid NOT NULL,badge_id uuid NOT NULL,earned_at timestamptz,UNIQUE(user_id,badge_id)) ON COMMIT DROP;
INSERT INTO crilo_tier_badges(badge_key)
SELECT badge_key FROM public.badges WHERE badge_key IN ('score_uncommon','score_rare','score_epic','score_legendary','score_mythic');
DO $$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='crilo_award_score_rarity_tier'
 AND p.pronargs=1 AND p.proargtypes[0]='public.daily_runs'::regtype;
 IF src IS NULL THEN RAISE EXCEPTION 'Score rarity function not installed'; END IF;
 src:=replace(src,'public.crilo_award_score_rarity_tier','pg_temp.crilo_tier_award');
 src:=replace(src,'public.user_badges','pg_temp.crilo_tier_awards');
 src:=replace(src,'public.badges','pg_temp.crilo_tier_badges');
 src:=replace(src,'SECURITY DEFINER','SECURITY INVOKER');
 EXECUTE src;
END $$;
CREATE TEMP TABLE crilo_tier_cases(case_id int PRIMARY KEY,scenario text,rarity_label text,is_test boolean,expected text[]) ON COMMIT DROP;
INSERT INTO crilo_tier_cases VALUES
(1,'Uncommon official','UNCOMMON',false,ARRAY['score_uncommon']),
(2,'Rare official','RARE',false,ARRAY['score_rare']),
(3,'Epic official','EPIC',false,ARRAY['score_epic']),
(4,'Legendary official','LEGENDARY',false,ARRAY['score_legendary']),
(5,'Mythic official','MYTHIC',false,ARRAY['score_mythic']),
(6,'Common does not unlock','COMMON',false,ARRAY[]::text[]),
(7,'Unknown does not unlock','INVALID',false,ARRAY[]::text[]),
(8,'Null does not unlock',NULL,false,ARRAY[]::text[]),
(9,'Uncommon private','UNCOMMON',true,ARRAY[]::text[]),
(10,'Rare private','RARE',true,ARRAY[]::text[]),
(11,'Epic private','EPIC',true,ARRAY[]::text[]),
(12,'Legendary private','LEGENDARY',true,ARRAY[]::text[]),
(13,'Mythic private','MYTHIC',true,ARRAY[]::text[]),
(14,'Case and whitespace normalization','  rArE  ',false,ARRAY['score_rare']);
DO $$
DECLARE c record;r public.daily_runs%rowtype;
BEGIN
 FOR c IN SELECT * FROM pg_temp.crilo_tier_cases ORDER BY case_id LOOP
  r.user_id:=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid;
  r.is_test:=c.is_test;
  r.rarity_label:=c.rarity_label;
  PERFORM pg_temp.crilo_tier_award(r);
 END LOOP;
END $$;
WITH actual AS (
 SELECT c.case_id,c.scenario,c.expected,
 coalesce(array_agg(b.badge_key ORDER BY b.badge_key) FILTER(WHERE b.badge_key IS NOT NULL),ARRAY[]::text[]) AS awarded
 FROM pg_temp.crilo_tier_cases c
 LEFT JOIN pg_temp.crilo_tier_awards a ON a.user_id=('00000000-0000-4000-8000-'||lpad(c.case_id::text,12,'0'))::uuid
 LEFT JOIN pg_temp.crilo_tier_badges b ON b.id=a.badge_id
 GROUP BY c.case_id,c.scenario,c.expected
)
SELECT case_id,scenario,CASE WHEN awarded=ARRAY(SELECT unnest(expected) ORDER BY 1) THEN 'PASS' ELSE 'FAIL' END AS status,expected,awarded
FROM actual ORDER BY case_id;
ROLLBACK;
