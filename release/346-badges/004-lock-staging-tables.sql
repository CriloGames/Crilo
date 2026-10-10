revoke all on table public.crilo_v3_badge_stage, public.crilo_v3_user_events from public,anon,authenticated;
comment on table public.crilo_v3_badge_stage is 'Unreleased server-only 346 badge specification; never client writable.';
comment on table public.crilo_v3_user_events is 'Server-authenticated exploration events; direct client access forbidden, writes only through authenticated RPC.';