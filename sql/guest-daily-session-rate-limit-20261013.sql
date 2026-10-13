-- Crilo rate limits for anonymous server-backed Daily ticket creation.
-- No changes to guest_spin, guest_state, claim, official game, scores or RLS.
-- IP is never stored in plaintext; HMAC key stays inside a non-exposed schema.
BEGIN;
CREATE SCHEMA IF NOT EXISTS crilo_private;
REVOKE ALL ON SCHEMA crilo_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS crilo_private.guest_rate_secret(
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 secret bytea NOT NULL
);
INSERT INTO crilo_private.guest_rate_secret(singleton,secret)
VALUES(true,extensions.gen_random_bytes(32))
ON CONFLICT(singleton) DO NOTHING;
CREATE TABLE IF NOT EXISTS crilo_private.guest_rate_quota(
 visitor_key bytea NOT NULL,
 window_type text NOT NULL CHECK (window_type IN ('10m','daily')),
 window_start timestamptz NOT NULL,
 starts integer NOT NULL CHECK(starts>0),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 PRIMARY KEY(visitor_key,window_type,window_start)
);
CREATE INDEX IF NOT EXISTS crilo_guest_rate_quota_prune_idx
ON crilo_private.guest_rate_quota(window_start);
ALTER TABLE crilo_private.guest_rate_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE crilo_private.guest_rate_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crilo_private.guest_rate_secret FROM PUBLIC,anon,authenticated;
REVOKE ALL ON crilo_private.guest_rate_quota FROM PUBLIC,anon,authenticated;
-- Preserve intentionally exposed anon-only function grants in place.
CREATE OR REPLACE FUNCTION public.crilo_guest_begin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 token text;
 period date;
 hdr jsonb;
 forwarded text;
 client_ip text;
 normalized_ip text;
 ip_key bytea;
 hmac_secret bytea;
 now_at timestamptz := pg_catalog.clock_timestamp();
 short_bucket timestamptz;
 daily_bucket timestamptz;
 uses integer;
BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Already signed in' USING ERRCODE='42501'; END IF;

 -- Resolve the proxy-provided client IP, not a browser-provided identifier.
 -- Cloudflare's connecting-IP is preferred. If absent, take the *last*
 -- forwarded hop rather than the spoofable first X-Forwarded-For entry.
 hdr := coalesce(
   nullif(pg_catalog.current_setting('request.headers',true),'')::jsonb,
   '{}'::jsonb);
 forwarded := hdr->>'x-forwarded-for';
 client_ip := coalesce(
   nullif(pg_catalog.btrim(hdr->>'cf-connecting-ip'),''),
   nullif(pg_catalog.btrim(
     pg_catalog.split_part(forwarded,',',
       pg_catalog.array_length(pg_catalog.string_to_array(forwarded,','),1))), ''));
 IF client_ip IS NULL OR pg_catalog.length(client_ip)>64 THEN
   RAISE EXCEPTION 'Guest session request missing valid proxy client address'
     USING ERRCODE='42501';
 END IF;
 BEGIN
   normalized_ip:=pg_catalog.host(client_ip::inet);
 EXCEPTION WHEN data_exception THEN
   RAISE EXCEPTION 'Guest session request missing valid proxy client address'
     USING ERRCODE='42501';
 END;
 SELECT secret INTO hmac_secret FROM crilo_private.guest_rate_secret WHERE singleton=true;
 IF hmac_secret IS NULL THEN
   RAISE EXCEPTION 'Guest protections temporarily unavailable' USING ERRCODE='42501';
 END IF;
 ip_key:=extensions.hmac(pg_catalog.convert_to(normalized_ip,'UTF8'),hmac_secret,'sha256');
 short_bucket:=pg_catalog.to_timestamp((pg_catalog.floor(extract(epoch from now_at)/600)*600)::double precision);
 period:=((now_at AT TIME ZONE 'UTC')-interval '22 hours')::date;
 daily_bucket:=((period::timestamp+interval '22 hours') AT TIME ZONE 'UTC');

 -- The unique-key UPSERT serializes concurrent requests for the same IP.
 -- A blocked request does not create a ticket, and retrying with a new
 -- browser, localStorage ID, or user-agent does not reset these quotas.
 INSERT INTO crilo_private.guest_rate_quota(visitor_key,window_type,window_start,starts,updated_at)
 VALUES(ip_key,'10m',short_bucket,1,now_at)
 ON CONFLICT(visitor_key,window_type,window_start)
 DO UPDATE SET starts=crilo_private.guest_rate_quota.starts+1,updated_at=EXCLUDED.updated_at
   WHERE crilo_private.guest_rate_quota.starts<10
 RETURNING starts INTO uses;
 IF uses IS NULL THEN
   RAISE SQLSTATE 'PGRST' USING
     MESSAGE=pg_catalog.jsonb_build_object('code','GUEST_RATE_LIMIT',
       'message','Too many new guest Dailies started from this connection. Please try again later.')::text,
     DETAIL=pg_catalog.jsonb_build_object('status',429,
       'headers',pg_catalog.jsonb_build_object('Retry-After','600'))::text;
 END IF;
 uses:=NULL;
 INSERT INTO crilo_private.guest_rate_quota(visitor_key,window_type,window_start,starts,updated_at)
 VALUES(ip_key,'daily',daily_bucket,1,now_at)
 ON CONFLICT(visitor_key,window_type,window_start)
 DO UPDATE SET starts=crilo_private.guest_rate_quota.starts+1,updated_at=EXCLUDED.updated_at
   WHERE crilo_private.guest_rate_quota.starts<60
 RETURNING starts INTO uses;
 IF uses IS NULL THEN
   RAISE SQLSTATE 'PGRST' USING
     MESSAGE=pg_catalog.jsonb_build_object('code','GUEST_RATE_LIMIT',
       'message','Too many guest Dailies were started from this connection today. Please try again after the next Daily reset.')::text,
     DETAIL=pg_catalog.jsonb_build_object('status',429,
       'headers',pg_catalog.jsonb_build_object('Retry-After','3600'))::text;
 END IF;
 -- Periodic cleanup without unbounded per-request scan/write overhead.
 IF pg_catalog.random()<0.01 THEN
   DELETE FROM crilo_private.guest_rate_quota
   WHERE window_start < now_at-interval '72 hours';
 END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 period:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 INSERT INTO public.crilo_guest_spin_sessions(ticket_hash,daily_period,segments)
 VALUES(extensions.digest(decode(token,'hex'),'sha256'),period,
 '[{"type":"num","base":2},{"type":"duck"},{"type":"num","base":1},{"type":"upgrade"},{"type":"num","base":3},{"type":"num","base":1},{"type":"spins"},{"type":"num","base":5},{"type":"duck"},{"type":"num","base":2},{"type":"double"},{"type":"num","base":1}]'::jsonb);
 RETURN jsonb_build_object('token',token,'period',period);
END $function$;
REVOKE EXECUTE ON FUNCTION public.crilo_guest_begin() FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_guest_begin() TO anon,service_role;
COMMIT;
