-- Public Daily completion tally, backed only by authenticated, server-proved
-- official Dailies. Guest play and isolated owner Test Runs never enter it.
-- Counter rows are hidden from browser roles. Server-only triggers maintain
-- the value transactionally, including account deletion / run removal.
CREATE TABLE IF NOT EXISTS public.crilo_official_daily_total (
 singleton smallint PRIMARY KEY CHECK(singleton=1),
 completed bigint NOT NULL DEFAULT 0 CHECK(completed>=0)
);
ALTER TABLE public.crilo_official_daily_total ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.crilo_official_daily_total FROM PUBLIC,anon,authenticated;

-- Seed from all eligible historic official runs without deleting or changing
-- the original run records. Verified runs have account-level ownership proof.
INSERT INTO public.crilo_official_daily_total(singleton,completed)
SELECT 1,count(*)::bigint
FROM public.daily_runs d
JOIN auth.users u ON u.id=d.user_id
WHERE d.is_test IS FALSE
  AND d.verified_spin_session_id IS NOT NULL
  AND u.is_anonymous IS FALSE
  AND u.email_confirmed_at IS NOT NULL
ON CONFLICT(singleton) DO UPDATE SET completed=EXCLUDED.completed;

CREATE OR REPLACE FUNCTION public.crilo_maintain_official_daily_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $counter$
DECLARE old_counts boolean:=false; new_counts boolean:=false; delta integer:=0;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  old_counts:=OLD.is_test IS FALSE AND OLD.verified_spin_session_id IS NOT NULL;
 END IF;
 IF TG_OP <> 'DELETE' THEN
  new_counts:=NEW.is_test IS FALSE AND NEW.verified_spin_session_id IS NOT NULL;
 END IF;
 delta:=new_counts::integer-old_counts::integer;
 IF delta<>0 THEN
  UPDATE public.crilo_official_daily_total
     SET completed=completed+delta
   WHERE singleton=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Official Daily counter unavailable';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END
$counter$;
REVOKE ALL ON FUNCTION public.crilo_maintain_official_daily_total() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS crilo_official_total_after_insert ON public.daily_runs;
CREATE TRIGGER crilo_official_total_after_insert
AFTER INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_maintain_official_daily_total();
DROP TRIGGER IF EXISTS crilo_official_total_after_delete ON public.daily_runs;
CREATE TRIGGER crilo_official_total_after_delete
AFTER DELETE ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_maintain_official_daily_total();
DROP TRIGGER IF EXISTS crilo_official_total_after_update ON public.daily_runs;
CREATE TRIGGER crilo_official_total_after_update
AFTER UPDATE OF is_test,verified_spin_session_id ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_maintain_official_daily_total();

CREATE OR REPLACE FUNCTION public.crilo_public_official_daily_total()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $view$
 SELECT coalesce((SELECT completed FROM public.crilo_official_daily_total WHERE singleton=1),0)::bigint
$view$;
REVOKE ALL ON FUNCTION public.crilo_public_official_daily_total() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_public_official_daily_total() TO anon,authenticated,service_role;

-- Match the currently shipped image encoder. The former PNG-only validator
-- rejected blank drawings (NULL) and smaller WebP images. Preserve strict
-- 200x200-image validation and the size bound for every supported format.
CREATE OR REPLACE FUNCTION public.crilo_validate_daily_drawing_envelope()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $image$
DECLARE pixels bytea; image_kind text; n integer; imgwidth integer; imgheight integer; chunk text;
BEGIN
 IF NEW.drawing IS NULL THEN
  IF NEW.drawing_is_blank IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'Nonblank Daily drawing is required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 n:=length(NEW.drawing);
 IF n>1400000 OR n<100 THEN
  RAISE EXCEPTION 'Daily drawing exceeds size limits or is invalid' USING ERRCODE='23514';
 END IF;
 IF left(NEW.drawing,22)='data:image/png;base64,' THEN
  image_kind:='png';
  BEGIN pixels:=decode(substr(NEW.drawing,23),'base64');
  EXCEPTION WHEN others THEN
   RAISE EXCEPTION 'Invalid Daily PNG base64' USING ERRCODE='23514';
  END;
 ELSIF left(NEW.drawing,23)='data:image/webp;base64,' THEN
  image_kind:='webp';
  BEGIN pixels:=decode(substr(NEW.drawing,24),'base64');
  EXCEPTION WHEN others THEN
   RAISE EXCEPTION 'Invalid Daily WebP base64' USING ERRCODE='23514';
  END;
 ELSE
  RAISE EXCEPTION 'Daily drawing must be PNG or WebP' USING ERRCODE='23514';
 END IF;
 n:=octet_length(pixels);
 IF image_kind='png' THEN
  IF n<65 OR encode(substring(pixels from 1 for 24),'hex')<>
   '89504e470d0a1a0a0000000d49484452000000c8000000c8' THEN
   RAISE EXCEPTION 'Invalid Daily PNG header or dimensions' USING ERRCODE='23514';
  END IF;
 ELSE
  IF n<30 OR encode(substring(pixels from 1 for 4),'hex')<>'52494646'
          OR encode(substring(pixels from 9 for 4),'hex')<>'57454250' THEN
   RAISE EXCEPTION 'Invalid Daily WebP container' USING ERRCODE='23514';
  END IF;
  chunk:=encode(substring(pixels from 13 for 4),'hex');
  IF chunk='56503858' THEN -- Extended VP8X: 24-bit width/height minus one.
   imgwidth:=1+get_byte(pixels,24)+get_byte(pixels,25)*256+get_byte(pixels,26)*65536;
   imgheight:=1+get_byte(pixels,27)+get_byte(pixels,28)*256+get_byte(pixels,29)*65536;
  ELSIF chunk='5650384c' THEN -- Lossless VP8L: packed dimensions.
   IF get_byte(pixels,20)<>47 THEN
    RAISE EXCEPTION 'Invalid VP8L image header' USING ERRCODE='23514';
   END IF;
   imgwidth:=1+get_byte(pixels,21)+(get_byte(pixels,22)&63)*256;
   imgheight:=1+(get_byte(pixels,22)>>6)+get_byte(pixels,23)*4+(get_byte(pixels,24)&15)*1024;
  ELSIF chunk='56503820' THEN -- Lossy VP8: start code then 14-bit width/height.
   IF encode(substring(pixels from 24 for 3),'hex')<>'9d012a' THEN
    RAISE EXCEPTION 'Invalid VP8 image header' USING ERRCODE='23514';
   END IF;
   imgwidth:=get_byte(pixels,26)+(get_byte(pixels,27)&63)*256;
   imgheight:=get_byte(pixels,28)+(get_byte(pixels,29)&63)*256;
  ELSE
   RAISE EXCEPTION 'Unsupported WebP image header' USING ERRCODE='23514';
  END IF;
  IF imgwidth<>200 OR imgheight<>200 THEN
   RAISE EXCEPTION 'Daily WebP image must be 200x200' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END
$image$;
REVOKE ALL ON FUNCTION public.crilo_validate_daily_drawing_envelope() FROM PUBLIC,anon,authenticated;
