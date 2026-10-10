revoke execute on function public.crilo_v3_record_event(text) from public,anon;
grant execute on function public.crilo_v3_record_event(text) to authenticated;
revoke execute on function public.crilo_v3_finalize_periods() from public,anon,authenticated;
revoke execute on function public.crilo_v3_after_friend_change() from public,anon,authenticated;
revoke execute on function public.crilo_v3_after_run_change() from public,anon,authenticated;
revoke execute on function public.crilo_v3_after_user_event() from public,anon,authenticated;
comment on function public.crilo_v3_record_event(text) is 'Authenticated-only, server-authenticated, single-user exploration progress. Future award activation gated separately.';