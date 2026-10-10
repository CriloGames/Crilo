-- Isolated reproducible positive witnesses for run-based achievement rules.
-- Never alters production badges, accounts, spin sessions or Daily runs.
CREATE TABLE IF NOT EXISTS crilo_badge_prelaunch.qa_run_witnesses(
 badge_key text PRIMARY KEY REFERENCES crilo_badge_prelaunch.definitions(badge_key),
 results jsonb NOT NULL,
 score bigint NOT NULL,
 method text NOT NULL CHECK(method IN ('seeded_simulation','constructed_possible')),
 checked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON crilo_badge_prelaunch.qa_run_witnesses FROM PUBLIC, anon, authenticated;

-- The resulting SELECT must return 215 / 215 verified witnesses.
SELECT count(*) total,
 count(*) FILTER(WHERE crilo_badge_prelaunch.run_evidence(w.results)->>'valid'='true'
 AND (crilo_badge_prelaunch.run_evidence(w.results)->>'score')::numeric=w.score) replay_valid,
 count(*) FILTER(WHERE EXISTS(
 SELECT 1 FROM crilo_badge_prelaunch.qualifying_run_badges(w.results,w.score) q
 WHERE q.badge_key=w.badge_key)) badge_earned,
 count(*) FILTER(WHERE EXISTS(
 SELECT 1 FROM crilo_badge_prelaunch.qualifying_run_badges(w.results,w.score+1) q
 WHERE q.badge_key=w.badge_key)) accepts_tampered_final_score,
 count(*) FILTER(WHERE EXISTS(
 SELECT 1 FROM crilo_badge_prelaunch.qualifying_run_badges('[]'::jsonb,w.score) q
 WHERE q.badge_key=w.badge_key)) accepts_missing_history
FROM crilo_badge_prelaunch.qa_run_witnesses w;

-- Every badge must also reject at least one other REALISTIC, fully valid
-- wheel outcome sequence in the private fixture pool (not merely empty JSON).
WITH valid_negative AS(
 SELECT d.badge_key, EXISTS(
   SELECT 1 FROM crilo_badge_prelaunch.qa_run_witnesses w
   WHERE w.badge_key<>d.badge_key
     AND crilo_badge_prelaunch.run_evidence(w.results)->>'valid'='true'
     AND NOT crilo_badge_prelaunch.qualifies_run(
         d.rule,crilo_badge_prelaunch.run_evidence(w.results))
 ) AS negative_found
 FROM crilo_badge_prelaunch.definitions d
 WHERE d.rule->>'rule' IN (
  'hit_exact','score_band','event_total','event_streak','sequence',
  'challenge','first_event','final_base','spin_position','base_total',
  'base_sequence','number_sequence','first_last','variety')
)
SELECT count(*) AS run_based_badges,
       count(*) FILTER(WHERE negative_found) AS valid_nonqualifying_witnesses
FROM valid_negative;
