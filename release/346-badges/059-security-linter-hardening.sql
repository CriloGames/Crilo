-- Applied to production Supabase via migration hardening_prelaunch_ping_search_path
-- Static archival copy: fixes mutable-function search_path Supabase security lint.
ALTER FUNCTION crilo_badge_prelaunch.ping() SET search_path = '';
