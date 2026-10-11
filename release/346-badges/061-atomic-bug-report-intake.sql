-- Security audit: atomically rate-limit public bug reports at the database boundary.
-- Service-role-only intake; no existing reports are changed or deleted.
CREATE OR REPLACE FUNCTION public.crilo_accept_bug_report(
 p_user_id uuid,
 p_description text,
 p_steps text,
 p_page_url text,
 p_user_agent text,
 p_ip_hash text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $$
DECLARE new_id uuid;
BEGIN
 IF current_user <> 'service_role' THEN
  RAISE EXCEPTION 'Bug report intake is server-only' USING ERRCODE='42501';
 END IF;
 IF p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$'
 OR p_description IS NULL OR length(p_description)<15 OR length(p_description)>3000
 OR length(coalesce(p_steps,''))>1500
 OR length(coalesce(p_page_url,''))>500
 OR length(coalesce(p_user_agent,''))>500 THEN
  RAISE EXCEPTION 'Invalid bug report payload' USING ERRCODE='22023';
 END IF;
 -- All requests for the same visitor key are serialized until commit. A
 -- concurrent burst cannot observe a stale count and send extra emails.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash,611102));
 IF (SELECT count(*) FROM public.crilo_bug_reports
   WHERE ip_hash=p_ip_hash AND created_at > pg_catalog.clock_timestamp()-interval '1 hour') >= 3 THEN
  RAISE EXCEPTION 'BUG_REPORT_RATE_LIMIT' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_bug_reports
   WHERE ip_hash=p_ip_hash AND created_at > pg_catalog.clock_timestamp()-interval '60 seconds') THEN
  RAISE EXCEPTION 'BUG_REPORT_COOLDOWN' USING ERRCODE='P0001';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_bug_reports
   WHERE ip_hash=p_ip_hash AND description=p_description
     AND created_at > pg_catalog.clock_timestamp()-interval '1 hour') THEN
  RAISE EXCEPTION 'BUG_REPORT_DUPLICATE' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.crilo_bug_reports
  (user_id,description,steps,page_url,user_agent,ip_hash)
 VALUES(p_user_id,p_description,p_steps,p_page_url,p_user_agent,p_ip_hash)
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.crilo_accept_bug_report(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_accept_bug_report(uuid,text,text,text,text,text) TO service_role;
CREATE INDEX IF NOT EXISTS crilo_bug_reports_ip_rate_idx
ON public.crilo_bug_reports (ip_hash,created_at DESC);
