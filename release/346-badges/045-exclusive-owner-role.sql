-- Defense in depth: at most one Crilo owner profile may exist.
-- Normal account and preference operations do not modify this flag.
CREATE UNIQUE INDEX IF NOT EXISTS crilo_exactly_one_owner_guard
ON public.profiles ((is_owner))
WHERE is_owner IS TRUE;
-- Attackers must never set or update their own authority or auth-created timestamps.
-- Already protected by column GRANT restrictions and profile triggers.
REVOKE UPDATE (account_code,username_changed_at) ON public.profiles FROM authenticated;
REVOKE INSERT (account_code,username_changed_at) ON public.profiles FROM authenticated;
-- Server trigger generates account code. If an existing insert/upsert supplies
-- these columns, update client to omit them (profile forms should never send them).
