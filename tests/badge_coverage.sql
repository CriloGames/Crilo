-- Crilo badge certification: READ-ONLY live coverage audit.
-- Run in Supabase SQL editor. Does not create users, runs, or awards.
WITH award_functions AS (
  SELECT p.proname, pg_get_functiondef(p.oid) AS source
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'crilo_award_run_badges',
      'crilo_award_missing_sequence_badges',
      'crilo_award_secret_badges',
      'crilo_award_remaining_secrets',
      'crilo_award_score_rarity_badges',
      'crilo_award_score_rarity_tier',
      'crilo_award_daily_rank_badges',
      'crilo_refresh_finalized_rank_badges',
      'crilo_award_friend_badges',
      'crilo_award_profile_badge',
      'crilo_award_wheel_discoveries'
    )
),
catalog AS (
  SELECT b.id,b.badge_key,b.category,
         EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.badge_id=b.id) AS ever_awarded,
         EXISTS (SELECT 1 FROM public.badge_requirements br WHERE br.badge_id=b.id) AS has_requirement,
         EXISTS (SELECT 1 FROM award_functions f WHERE strpos(f.source,quote_literal(b.badge_key))>0) AS explicit_key_in_function
  FROM public.badges b
)
SELECT category,count(*) AS badges,
       count(*) FILTER (WHERE ever_awarded) AS awarded_in_production,
       count(*) FILTER (WHERE NOT ever_awarded) AS never_awarded,
       count(*) FILTER (WHERE has_requirement) AS requirements_present,
       count(*) FILTER (WHERE explicit_key_in_function) AS explicitly_referenced
FROM catalog
GROUP BY category
UNION ALL
SELECT 'TOTAL',count(*),
       count(*) FILTER (WHERE ever_awarded),
       count(*) FILTER (WHERE NOT ever_awarded),
       count(*) FILTER (WHERE has_requirement),
       count(*) FILTER (WHERE explicit_key_in_function)
FROM catalog
ORDER BY category;

-- Important: dynamic award keys (e.g. 'duck_' || k) and keys selected
-- from badge_requirements do not appear as literal strings in function bodies.
-- An absent explicit reference is NOT proof that a badge cannot be awarded.
-- Awarded-in-production is NOT a substitute for isolated trigger testing.
