-- Crilo security audit 2026-10-11: stale-token ban enforcement and friend-request throttling.
-- Non-destructive: no player rows, scores, badges or friendships are changed.
-- RPCs must fail closed even when an old, otherwise-valid auth token survives a ban.

CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
 END IF;
 UPDATE public.friend_requests SET status='accepted',updated_at=now()
 WHERE id=request_id AND receiver_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending incoming request not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decline_friend_request(request_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
 END IF;
 UPDATE public.friend_requests SET status='declined',updated_at=now()
 WHERE id=request_id AND receiver_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending incoming request not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_crilo_friend(friend_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
 END IF;
 DELETE FROM public.friend_requests WHERE status='accepted'
 AND ((sender_id=auth.uid() AND receiver_id=friend_user)
 OR (receiver_id=auth.uid() AND sender_id=friend_user));
 IF NOT FOUND THEN RAISE EXCEPTION 'Friendship not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.send_friend_request(target_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE me uuid:=auth.uid(); r public.friend_requests%ROWTYPE;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=me) THEN
  RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
 END IF;
 IF target_user IS NULL OR target_user=me THEN RAISE EXCEPTION 'Invalid friend'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=target_user) THEN
  RAISE EXCEPTION 'Player not found';
 END IF;
 -- Serialize concurrent sends for this account; avoid races around the rate limit.
 PERFORM pg_advisory_xact_lock(hashtextextended(me::text,442606));
 SELECT * INTO r FROM public.friend_requests
 WHERE (sender_id=me AND receiver_id=target_user)
    OR (sender_id=target_user AND receiver_id=me)
 FOR UPDATE;
 IF FOUND THEN
  IF r.status='accepted' THEN RETURN; END IF;
  IF r.status='pending' THEN
   IF r.receiver_id=me THEN
    UPDATE public.friend_requests SET status='accepted',updated_at=now() WHERE id=r.id;
   END IF;
   RETURN;
  END IF;
 END IF;
 -- Limit new/renewed outgoing invites; existing accepted/pending requests
 -- and acceptance of an incoming request are unaffected.
 IF (SELECT count(*) FROM public.friend_requests
     WHERE sender_id=me AND updated_at>=clock_timestamp()-interval '1 hour')>=30
    OR EXISTS (SELECT 1 FROM public.friend_requests
     WHERE sender_id=me AND updated_at>clock_timestamp()-interval '3 seconds')
 THEN RAISE EXCEPTION 'Too many friend requests. Try again later'
   USING ERRCODE='23514';
 END IF;
 IF FOUND THEN
  UPDATE public.friend_requests
   SET sender_id=me,receiver_id=target_user,status='pending',updated_at=now()
   WHERE id=r.id;
 ELSE
  INSERT INTO public.friend_requests(sender_id,receiver_id) VALUES(me,target_user);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_crilo_settings(
 new_username text,new_name_color text,new_theme text,new_sound_enabled boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
 END IF;
 IF length(trim(new_username))<2 OR length(trim(new_username))>20 THEN
  RAISE EXCEPTION 'Username must be between 2 and 20 characters.';
 END IF;
 IF new_theme NOT IN ('light','dark') THEN
  RAISE EXCEPTION 'Invalid theme.';
 END IF;
 IF new_name_color !~ '^#[0-9A-Fa-f]{6}$' THEN
  RAISE EXCEPTION 'Invalid display name color.';
 END IF;
 UPDATE public.profiles SET username=trim(new_username),
  name_color=new_name_color,theme=new_theme,sound_enabled=new_sound_enabled
  WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;
END $$;

-- Public/PostgREST execution is limited to signed-in callers. RLS bypass
-- inside these definer RPCs is offset by explicit auth.uid/ban/ownership checks.
REVOKE EXECUTE ON FUNCTION public.accept_friend_request(bigint) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.decline_friend_request(bigint) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.remove_crilo_friend(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.update_crilo_settings(text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_crilo_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_crilo_settings(text,text,text,boolean) TO authenticated;
