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
