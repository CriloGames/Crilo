-- Retire the unwanted Daily Challenges and Lucky Seven weekly features.
-- Preserve already-earned Stars and completed weekly play history in storage
-- for auditing and possible user support. Never alter Official Dailies,
-- badge progression, Bonus Runs, Mystery Gifts or their leaderboards.
BEGIN;
REVOKE ALL ON FUNCTION public.crilo_daily_challenges()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_begin_session()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_spin(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_state(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_save(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_status()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.crilo_weekly_leaders(integer)
 FROM PUBLIC,anon,authenticated;
-- This unfinished cosmetics endpoint depended on Challenge Stars.
-- Do not leave an unlaunched backend feature reachable after retirement.
REVOKE ALL ON FUNCTION public.crilo_wheel_looks(text,text)
 FROM PUBLIC,anon,authenticated;
COMMIT;