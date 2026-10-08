-- Crilo: read-only achievement integration checks against REAL database state.
-- One result table. Does not insert runs, award badges, or modify players.
WITH expected(trigger_name) AS (
 VALUES ('crilo_wheel_discoveries_on_daily'),
        ('crilo_award_run_badges_on_daily')
), trigger_checks AS (
 SELECT e.trigger_name,
   EXISTS(SELECT 1 FROM pg_trigger t
          WHERE t.tgrelid='public.daily_runs'::regclass
            AND t.tgname=e.trigger_name AND t.tgenabled IN ('O','A')) AS enabled
 FROM expected e
), official AS (
 SELECT user_id,id,daily_period,score,upgrades,results
 FROM public.daily_runs WHERE is_test=false
), test_only AS (
 SELECT DISTINCT r.user_id FROM public.owner_test_runs r
 WHERE NOT EXISTS(SELECT 1 FROM official o WHERE o.user_id=r.user_id)
), badge_records AS (
 SELECT ub.user_id,b.badge_key
 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
), check_results AS (
 SELECT 'wheel trigger enabled' AS test_name,
   CASE WHEN EXISTS(SELECT 1 FROM trigger_checks WHERE trigger_name='crilo_wheel_discoveries_on_daily' AND enabled)
   THEN 'PASS' ELSE 'FAIL' END AS status,
   'Wheel achievements fire on official run insertion' AS detail
 UNION ALL
 SELECT 'milestone trigger enabled',
   CASE WHEN EXISTS(SELECT 1 FROM trigger_checks WHERE trigger_name='crilo_award_run_badges_on_daily' AND enabled)
   THEN 'PASS' ELSE 'FAIL' END,
   'Existing milestone achievements fire on run insertion'
 UNION ALL
 SELECT 'no wheel awards to users without official runs',
   CASE WHEN NOT EXISTS(
    SELECT 1 FROM badge_records b WHERE b.badge_key LIKE 'wheel_%'
    AND NOT EXISTS(SELECT 1 FROM official o WHERE o.user_id=b.user_id)
   ) THEN 'PASS' ELSE 'FAIL' END,
   'Checks whether any wheel badge recipient has zero official Dailies'
 UNION ALL
 SELECT 'owner-test-only users have no wheel awards',
   CASE WHEN NOT EXISTS(
    SELECT 1 FROM test_only t JOIN badge_records b USING(user_id)
    WHERE b.badge_key LIKE 'wheel_%'
   ) THEN 'PASS' ELSE 'FAIL' END,
   'Checks players with owner tests but no official Daily'
 UNION ALL
 SELECT 'Triple Threat catalog name',
   CASE WHEN EXISTS(SELECT 1 FROM public.badges WHERE badge_key='upgrade_3' AND name='Triple Threat')
   THEN 'PASS' ELSE 'FAIL' END,
   'Existing upgrade_3 badge name'
 UNION ALL
 SELECT 'Double Trouble catalog name',
   CASE WHEN EXISTS(SELECT 1 FROM public.badges WHERE badge_key='double_back2' AND name='Double Trouble')
   THEN 'PASS' ELSE 'FAIL' END,
   'Existing double_back2 badge name'
 UNION ALL
 SELECT 'Triple Threat award completeness',
   CASE WHEN NOT EXISTS(
     SELECT 1 FROM official o
     WHERE o.upgrades>=3
       AND NOT EXISTS(SELECT 1 FROM badge_records b WHERE b.user_id=o.user_id AND b.badge_key='upgrade_3')
   ) THEN 'PASS' ELSE 'FAIL' END,
   'Every player with 3+ upgrades on an official Daily has upgrade_3'
 UNION ALL
 SELECT 'Double Trouble award completeness',
   CASE WHEN NOT EXISTS(
     SELECT 1 FROM official o
     WHERE EXISTS(
       SELECT 1 FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(o.results)='array' THEN o.results ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS a(v,n)
       JOIN jsonb_array_elements(
         CASE WHEN jsonb_typeof(o.results)='array' THEN o.results ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS b(v,n) ON b.n=a.n+1
       WHERE a.v->>'type'='double' AND b.v->>'type'='double'
     )
     AND NOT EXISTS(SELECT 1 FROM badge_records b WHERE b.user_id=o.user_id AND b.badge_key='double_back2')
   ) THEN 'PASS' ELSE 'FAIL' END,
   'Every player with adjacent doubles on an official Daily has double_back2'
)
SELECT test_name,status,detail FROM check_results ORDER BY test_name;
