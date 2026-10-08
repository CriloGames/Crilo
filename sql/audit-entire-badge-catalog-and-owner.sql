-- CRILO: 172-badge inventory + owner/profile count reconciliation (READ ONLY)
-- Run in Supabase SQL Editor. Does not award, delete, or modify badges.
-- Owner is inferred ONLY if exactly one distinct account has private owner test runs.
-- If owner_accounts_found != 1, the owner columns intentionally stay NULL.
WITH owners AS (
 SELECT DISTINCT user_id FROM public.owner_test_runs
), owner_meta AS (
 SELECT count(*)::int AS owner_accounts_found,
        CASE WHEN count(*)=1 THEN min(user_id) ELSE NULL::uuid END AS owner_id
 FROM owners
), catalog AS (
 SELECT id,badge_key,name,category,is_secret FROM public.badges
), award_totals AS (
 SELECT ub.badge_id,count(DISTINCT ub.user_id) AS players_awarded
 FROM public.user_badges ub GROUP BY ub.badge_id
), owner_awards AS (
 SELECT ub.badge_id,count(*) AS awards
 FROM public.user_badges ub CROSS JOIN owner_meta o
 WHERE o.owner_id IS NOT NULL AND ub.user_id=o.owner_id
 GROUP BY ub.badge_id
), owner_counts AS (
 SELECT count(*) FILTER (WHERE oa.badge_id IS NOT NULL)::int AS earned_catalog_badges
 FROM catalog c LEFT JOIN owner_awards oa ON oa.badge_id=c.id
), total_count AS (SELECT count(*)::int AS catalog_total FROM catalog),
trigger_checks AS (
 SELECT
  count(*) FILTER (WHERE tgname='crilo_award_run_badges_on_daily' AND tgenabled IN ('O','A'))>0 AS milestone,
  count(*) FILTER (WHERE tgname='crilo_daily_rank_badges_on_daily' AND tgenabled IN ('O','A'))>0 AS daily_rank,
  count(*) FILTER (WHERE tgname='crilo_secret_badges_on_daily' AND tgenabled IN ('O','A'))>0 AS secret,
  count(*) FILTER (WHERE tgname='crilo_remaining_secrets_on_daily' AND tgenabled IN ('O','A'))>0 AS remaining,
  count(*) FILTER (WHERE tgname='crilo_wheel_discoveries_on_daily' AND tgenabled IN ('O','A'))>0 AS wheel
 FROM pg_trigger WHERE tgrelid='public.daily_runs'::regclass
), profile_trigger AS (
 SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass
 AND tgname='crilo_profile_badge_on_create' AND tgenabled IN ('O','A')) AS enabled
), badges AS (
 SELECT c.*,coalesce(a.players_awarded,0)::int AS players_awarded,
 CASE WHEN o.owner_id IS NULL THEN NULL::boolean ELSE oa.badge_id IS NOT NULL END AS owner_earned,
 CASE
  WHEN c.badge_key IN ('social_friend1','social_friend5','social_friend25') THEN 'NOT IMPLEMENTED: FRIENDS'
  WHEN c.badge_key IN ('rarity_1000000','rarity_10000000','rarity_100000000') THEN 'UNREACHABLE WITH 100K ODDS'
  WHEN c.badge_key LIKE 'wheel_%' THEN CASE WHEN t.wheel THEN 'AWARD TRIGGER PRESENT; 18 POSITIVE SIMULATIONS PASSED' ELSE 'MISSING WHEEL TRIGGER' END
  WHEN c.badge_key='social_profile' THEN CASE WHEN p.enabled THEN 'PROFILE TRIGGER PRESENT' ELSE 'MISSING PROFILE TRIGGER' END
  WHEN c.badge_key LIKE 'social_%' THEN 'NO VERIFIED AWARD RULE'
  WHEN c.badge_key LIKE 'rank_%' THEN CASE WHEN t.daily_rank THEN 'RANK TRIGGER PRESENT; VERIFY FINALIZATION' ELSE 'MISSING RANK TRIGGER' END
  WHEN c.badge_key LIKE 'daily_%' OR c.badge_key LIKE 'runs_%' THEN
    CASE WHEN c.badge_key='daily_draw' THEN CASE WHEN t.remaining THEN 'DRAWING TRIGGER PRESENT' ELSE 'MISSING DRAWING TRIGGER' END
    WHEN t.daily_rank THEN 'DAILY TRIGGER PRESENT' ELSE 'MISSING DAILY TRIGGER' END
  WHEN c.badge_key LIKE 'secret_%' THEN CASE
    WHEN c.badge_key IN ('secret_blank','secret_clock','secret_impossible','secret_owner') THEN
      CASE WHEN t.remaining THEN 'SECRET TRIGGER PRESENT' ELSE 'MISSING SECRET TRIGGER' END
    WHEN t.secret THEN 'SECRET TRIGGER PRESENT' ELSE 'MISSING SECRET TRIGGER' END
  WHEN c.badge_key LIKE 'score_%' OR c.badge_key LIKE 'upgrade_%'
    OR c.badge_key LIKE 'double_%' OR c.badge_key LIKE 'duck_%'
    OR c.badge_key LIKE 'spinplus_%' OR c.badge_key LIKE 'spins_%'
    OR c.badge_key LIKE 'rarity_%' OR c.badge_key LIKE 'seq_%' THEN
    CASE WHEN t.milestone THEN 'MILESTONE TRIGGER PRESENT; INDIVIDUAL RULE NOT FULLY TESTED'
         ELSE 'MISSING MILESTONE TRIGGER' END
  ELSE 'UNCLASSIFIED: REVIEW AWARD RULE' END AS audit_status
 FROM catalog c LEFT JOIN award_totals a ON a.badge_id=c.id
 CROSS JOIN owner_meta o CROSS JOIN trigger_checks t CROSS JOIN profile_trigger p
 LEFT JOIN owner_awards oa ON oa.badge_id=c.id
)
SELECT b.badge_key,b.name,b.category,b.audit_status,b.players_awarded,b.owner_earned,
 o.owner_accounts_found,
 CASE WHEN o.owner_id IS NOT NULL THEN oc.earned_catalog_badges ELSE NULL END AS owner_earned_total,
 tc.catalog_total AS profile_denominator,
 CASE WHEN tc.catalog_total=172 THEN '172 EXPECTED' ELSE 'COUNT DIFFERS FROM 172' END AS catalog_check
FROM badges b CROSS JOIN owner_meta o CROSS JOIN owner_counts oc CROSS JOIN total_count tc
ORDER BY b.category,b.badge_key;
