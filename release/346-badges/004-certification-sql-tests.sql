-- CRILO 346 badge release: deterministic isolated-staging certification checks.
-- Read-only: no inserts, updates, deletes, awards or migrations.
DO $qa$
DECLARE n integer; mismatches integer; test_json jsonb;
BEGIN
 SELECT count(*) INTO n FROM crilo_badge_prelaunch.definitions;
 IF n<>346 THEN RAISE EXCEPTION 'Expected 346 isolated badges, got %',n; END IF;
 SELECT count(*) INTO n FROM public.crilo_v3_badge_stage;
 IF n<>346 THEN RAISE EXCEPTION 'Expected 346 V3 staged badges, got %',n; END IF;
 SELECT count(*) INTO n FROM (
  SELECT badge_key FROM crilo_badge_prelaunch.definitions GROUP BY badge_key HAVING count(*)>1
  UNION ALL SELECT name FROM crilo_badge_prelaunch.definitions GROUP BY name HAVING count(*)>1
 ) z;
 IF n>0 THEN RAISE EXCEPTION 'Duplicate keys or names'; END IF;
 SELECT count(*) INTO mismatches
 FROM crilo_badge_prelaunch.definitions a
 FULL OUTER JOIN public.crilo_v3_badge_stage b USING(badge_key)
 WHERE a.badge_key IS NULL OR b.badge_key IS NULL
    OR a.rarity IS DISTINCT FROM b.rarity
    OR a.category IS DISTINCT FROM b.category
    OR (a.rule - 'description' - 'condition') IS DISTINCT FROM
       (b.rule - 'description' - 'condition');
 IF mismatches<>0 THEN RAISE EXCEPTION 'Behavioral catalog mismatches: %',mismatches; END IF;

 test_json:='[{"type":"num","base":1,"segments":12},{"type":"num","base":1,"segments":12},{"type":"num","base":1,"segments":12},{"type":"num","base":1,"segments":12},{"type":"num","base":1,"segments":12}]'::jsonb;
 IF crilo_badge_prelaunch.run_evidence(test_json)->>'valid'<>'true'
    OR (crilo_badge_prelaunch.run_evidence(test_json)->>'score')::numeric<>5
    OR NOT EXISTS (SELECT 1 FROM crilo_badge_prelaunch.qualifying_run_badges(test_json,5))
 THEN RAISE EXCEPTION 'Valid five-spin test failed'; END IF;
 IF EXISTS (SELECT 1 FROM crilo_badge_prelaunch.qualifying_run_badges(test_json,301))
 THEN RAISE EXCEPTION 'Forged claimed score awarded badges'; END IF;
 IF crilo_badge_prelaunch.run_evidence('[]'::jsonb)->>'valid'<>'false'
 THEN RAISE EXCEPTION 'Missing spin history accepted'; END IF;
 test_json:='[{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1},{"type":"duck"}]'::jsonb;
 IF crilo_badge_prelaunch.run_evidence(test_json)->>'valid'<>'false'
 THEN RAISE EXCEPTION 'Post-completion wheel event accepted'; END IF;
 test_json:='[{"type":"num","base":8},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1}]'::jsonb;
 IF crilo_badge_prelaunch.run_evidence(test_json)->>'valid'<>'false'
 THEN RAISE EXCEPTION 'Unavailable initial number accepted'; END IF;
 test_json:='[{"type":"num","base":1,"segments":11},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1},{"type":"num","base":1}]'::jsonb;
 IF crilo_badge_prelaunch.run_evidence(test_json)->>'valid'<>'false'
 THEN RAISE EXCEPTION 'Legacy wheel layout accepted as current'; END IF;

 -- All valid-current historical official runs must agree with the previous
 -- matcher across every run-level rule. Legacy records are excluded.
 WITH runs AS(
  SELECT id,results,score,crilo_badge_prelaunch.run_evidence(results) ev
  FROM public.daily_runs WHERE is_test=false
 ), cmp AS (
  SELECT r.id,d.badge_key,
   COALESCE(crilo_badge_prelaunch.qualifies_run(d.rule,r.ev),false) candidate,
   COALESCE(public.crilo_v3_run_matches(d.rule,r.results,r.score),false) original
  FROM runs r CROSS JOIN crilo_badge_prelaunch.definitions d
  WHERE r.ev->>'valid'='true' AND (r.ev->>'score')::numeric=r.score
   AND d.rule->>'rule' IN
    ('hit_exact','score_band','event_total','event_streak','sequence',
     'challenge','first_event','final_base','spin_position','base_total',
     'base_sequence','number_sequence','first_last','variety')
 ) SELECT count(*) INTO mismatches FROM cmp WHERE candidate IS DISTINCT FROM original;
 IF mismatches>0 THEN RAISE EXCEPTION 'Run matcher disagreement count: %',mismatches; END IF;
END;
$qa$;
SELECT
 (SELECT count(*) FROM crilo_badge_prelaunch.definitions) AS candidate_count,
 (SELECT count(*) FROM public.crilo_v3_badge_stage) AS staged_count,
 (SELECT count(*) FROM public.daily_runs WHERE is_test=false
   AND crilo_badge_prelaunch.run_evidence(results)->>'valid'='true'
   AND (crilo_badge_prelaunch.run_evidence(results)->>'score')::numeric=score) AS verified_current_replays,
 (SELECT count(*) FROM public.daily_runs WHERE is_test=false
   AND crilo_badge_prelaunch.run_evidence(results)->>'valid'<>'true') AS excluded_legacy_or_invalid;
