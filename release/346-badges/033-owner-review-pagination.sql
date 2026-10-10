-- Production function already installed: bounded owner review feed.
-- Reapply only if recreating the project. No player data writes.
CREATE OR REPLACE FUNCTION public.crilo_owner_review_page_v1(p_page integer DEFAULT 0, p_filter text DEFAULT 'all'::text, p_include_tests boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS
  (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner=true)
 THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>100000
  OR p_filter NOT IN ('all','flagged','unscanned','partial','clear')
  OR p_filter IS NULL THEN
  RAISE EXCEPTION 'Invalid page or filter' USING ERRCODE='22023'; END IF;

 WITH all_items AS MATERIALIZED (
  SELECT d.id::text AS run_id,false AS is_test,p.username,
         d.created_at AS submitted_at,d.score,
         s.reasons,s.status AS scan_status,s.checked_at,s.scan_version,
         s.recognized_text,s.visual_label,s.visual_score,s.error,
         (r.ai_status='flagged' OR EXISTS(
           SELECT 1 FROM public.crilo_review_visual_scan v
           WHERE v.run_id=d.id AND v.error IS NULL
             AND v.visual_label IN ('explicit genital drawing','hand drawn swastika','hate symbol drawing')
             AND v.visual_score>=0.2
         )) AS legacy_flag
  FROM public.daily_runs d
  JOIN public.profiles p ON p.id=d.user_id
  LEFT JOIN public.crilo_drawing_reviews r ON r.run_id=d.id
  LEFT JOIN public.crilo_local_drawing_scans s ON s.official_run_id=d.id
  WHERE d.drawing IS NOT NULL AND length(d.drawing)>0
    AND coalesce(d.drawing_is_blank,false)=false
    AND coalesce(d.is_test,false)=false
    AND coalesce(r.status,'pending')='pending'

  UNION ALL

  SELECT t.id::text,true,p.username,t.created_at,t.score,
         s.reasons,s.status,s.checked_at,s.scan_version,
         s.recognized_text,s.visual_label,s.visual_score,s.error,
         (m.ai_status='flagged' OR EXISTS(
           SELECT 1 FROM public.crilo_owner_visual_scan v
           WHERE v.run_id=t.id AND v.error IS NULL
             AND v.visual_label IN ('explicit genital drawing','hand drawn swastika','hate symbol drawing')
             AND v.visual_score>=0.2
         ))
  FROM public.owner_test_runs t
  JOIN public.profiles p ON p.id=t.user_id
  LEFT JOIN public.crilo_local_drawing_scans s ON s.owner_test_run_id=t.id
  LEFT JOIN public.crilo_owner_test_moderation m ON m.run_id=t.id
  WHERE p_include_tests=true AND t.user_id=auth.uid()
    AND t.drawing IS NOT NULL AND length(t.drawing)>0
 ),
 classified AS MATERIALIZED (
  SELECT a.*,
   (coalesce(cardinality(a.reasons),0)>0
    OR (coalesce(a.scan_status,'')<>'complete'
        OR coalesce(a.scan_version,0)<6) AND coalesce(a.legacy_flag,false)
   ) AS flagged,
   (a.scan_version IS NULL OR a.scan_version<5) AS unchecked,
   (a.scan_status='partial') AS partial
  FROM all_items a
 ),
 filtered AS MATERIALIZED (
  SELECT * FROM classified c
  WHERE p_filter='all'
    OR (p_filter='flagged' AND c.flagged)
    OR (p_filter='unscanned' AND c.unchecked)
    OR (p_filter='partial' AND c.partial)
    OR (p_filter='clear' AND c.scan_status='complete'
        AND NOT c.flagged AND NOT c.unchecked)
 ),
 summary AS (
  SELECT count(*) AS total,
         count(*) FILTER(WHERE NOT is_test) AS pending,
         count(*) FILTER(WHERE is_test) AS test_runs,
         count(*) FILTER(WHERE flagged) AS flagged,
         count(*) FILTER(WHERE unchecked) AS unscanned,
         count(*) FILTER(WHERE partial) AS partial
  FROM classified
 ),
 paged AS (
  SELECT * FROM filtered
  ORDER BY flagged DESC,submitted_at DESC,run_id DESC
  LIMIT 24 OFFSET p_page*24
 ),
 payload AS (
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'run_id',pg.run_id,'is_test',pg.is_test,'username',pg.username,
      'submitted_at',pg.submitted_at,'score',pg.score,
      'review_status',CASE WHEN pg.is_test THEN 'test' ELSE 'pending' END,
      'drawing', CASE WHEN pg.is_test THEN
        (SELECT t.drawing FROM public.owner_test_runs t WHERE t.id=pg.run_id::uuid)
        ELSE (SELECT d.drawing FROM public.daily_runs d WHERE d.id=pg.run_id::bigint)
       END,
      'legacyHint',CASE WHEN pg.legacy_flag AND
        (pg.scan_version IS NULL OR pg.scan_version<6 OR pg.scan_status<>'complete')
        THEN 'Earlier text/image flag' ELSE null END,
      'local',CASE WHEN pg.scan_version IS NULL THEN null
        ELSE jsonb_build_object(
          'reasons',coalesce(pg.reasons,array[]::text[]),
          'status',pg.scan_status,'checked_at',pg.checked_at,
          'scan_version',pg.scan_version,'recognized_text',pg.recognized_text,
          'visual_label',pg.visual_label,'visual_score',pg.visual_score,
          'error',pg.error)
        END
    ) ORDER BY pg.flagged DESC,pg.submitted_at DESC,pg.run_id DESC
  ),'[]'::jsonb) AS entries
  FROM paged pg
 ),
 matched AS (SELECT count(*) AS n FROM filtered)
 SELECT jsonb_build_object(
   'rows',payload.entries,'matched',matched.n,'page',p_page,
   'page_size',24,'total',summary.total,
   'pending',summary.pending,'flagged',summary.flagged,
   'unscanned',summary.unscanned,'partial',summary.partial,
   'tests',summary.test_runs
 ) INTO result FROM summary CROSS JOIN matched CROSS JOIN payload;
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION public.crilo_owner_review_page_v1(integer,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_owner_review_page_v1(integer,text,boolean) TO authenticated;
