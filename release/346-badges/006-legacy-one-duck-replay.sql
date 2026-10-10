-- Historical compatibility verifier for the ONE-DUCK 11-segment Crilo wheel.
-- Historical source: game.js at commit 5f55d2bcd197d8f422909b21829931c5af721b52
-- before commit 7458d24ddbe391073da120fecf8ed2bc4de4b1e9 added another Duck.
-- This verifier deliberately supports only 11-segment runs without upgrades.
-- It does not accept or rewrite historical records; it is read-only.

CREATE OR REPLACE FUNCTION crilo_badge_prelaunch.run_evidence_legacy11(p_results jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $fn$
DECLARE
 e jsonb; kind text; base_num integer; expected_probability numeric;
 original_points numeric; observed_probability numeric; running_score numeric:=0;
 expected_points numeric:=0; revised jsonb:='[]'::jsonb;
 reconstructed jsonb;
BEGIN
 IF jsonb_typeof(p_results)<>'array'
    OR jsonb_array_length(p_results)<5
    OR jsonb_array_length(p_results)>500 THEN
  RETURN '{"valid":false,"reason":"bad_legacy_length"}'::jsonb;
 END IF;

 FOR e IN SELECT value FROM jsonb_array_elements(p_results) LOOP
  kind:=e->>'type';
  IF (e->>'segments') IS NULL OR (e->>'segments')!~'^[0-9]+$'
    OR (e->>'segments')::integer<>11
    OR jsonb_typeof(e->'probability')<>'number'
    OR jsonb_typeof(e->'points')<>'number'
    OR kind IS NULL OR kind='upgrade'
  THEN RETURN '{"valid":false,"reason":"unsupported_legacy_format"}'::jsonb;END IF;

  IF kind='num' THEN
   IF (e->>'base') IS NULL OR (e->>'base')!~'^[0-9]+$'
    THEN RETURN '{"valid":false,"reason":"bad_legacy_number"}'::jsonb;END IF;
   base_num:=(e->>'base')::integer;
   IF base_num NOT IN (1,2,3,5)
    THEN RETURN '{"valid":false,"reason":"number_missing_in_legacy_wheel"}'::jsonb;END IF;
   expected_probability:=(CASE base_num
     WHEN 1 THEN 3 WHEN 2 THEN 2 ELSE 1 END)::numeric/11;
   expected_points:=base_num;
  ELSIF kind IN ('duck','double','spins') THEN
   expected_probability:=1::numeric/11;
   expected_points:=CASE WHEN kind='double' THEN running_score ELSE 0 END;
  ELSE RETURN '{"valid":false,"reason":"unknown_legacy_type"}'::jsonb;
  END IF;

  observed_probability:=(e->>'probability')::numeric;
  original_points:=(e->>'points')::numeric;
  IF abs(observed_probability-expected_probability)>0.000000001
     OR original_points<>expected_points THEN
   RETURN '{"valid":false,"reason":"historical_outcome_mismatch"}'::jsonb;
  END IF;
  IF kind='num' THEN running_score:=running_score+base_num;END IF;
  IF kind='double' THEN running_score:=running_score*2;END IF;

  revised:=revised || jsonb_build_array(jsonb_set(e,'{segments}','12'::jsonb,true));
 END LOOP;

 reconstructed:=crilo_badge_prelaunch.run_evidence(revised);
 IF reconstructed->>'valid'<>'true'
    OR (reconstructed->>'score')::numeric<>running_score THEN
   RETURN '{"valid":false,"reason":"legacy_replay_failed"}'::jsonb;
 END IF;
 RETURN reconstructed || jsonb_build_object(
  'verified_legacy_mechanics','legacy-one-duck-11',
  'initial_segments',11);
EXCEPTION WHEN others THEN
 RETURN '{"valid":false,"reason":"invalid_legacy_fields"}'::jsonb;
END;
$fn$;

-- Row 2 should validate under historical rules, row 1 must remain unverified.
SELECT id,score,
 crilo_badge_prelaunch.run_evidence_legacy11(results)->>'valid' AS legacy_valid,
 crilo_badge_prelaunch.run_evidence_legacy11(results)->>'reason' AS exclusion_reason,
 CASE WHEN crilo_badge_prelaunch.run_evidence_legacy11(results)->>'valid'='true'
 THEN (SELECT count(*) FROM crilo_badge_prelaunch.definitions b
   WHERE b.rule->>'rule' IN(
    'hit_exact','score_band','event_total','event_streak','sequence',
    'challenge','first_event','final_base','spin_position','base_total',
    'base_sequence','number_sequence','first_last','variety')
   AND crilo_badge_prelaunch.qualifies_run(
      b.rule,crilo_badge_prelaunch.run_evidence_legacy11(d.results)))
 ELSE 0 END AS matching_rule_count
FROM public.daily_runs d WHERE id IN (1,2) AND is_test=false ORDER BY id;
