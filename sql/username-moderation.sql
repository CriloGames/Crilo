-- Crilo username moderation: run ONCE in Supabase SQL Editor.
-- Protects inserts, profile edits, and updates through update_crilo_settings().
-- Existing usernames are not changed; moderation applies when a username is inserted or changed.
create or replace function public.crilo_guard_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized text;
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then
    return new;
  end if;
  if new.username is null or new.username !~ '^[A-Za-z0-9_]{2,20}$' then
    raise exception 'Use 2–20 letters, numbers, or underscores.' using errcode = '23514';
  end if;
  normalized := lower(replace(new.username, '_', ''));
  normalized := translate(normalized, '013457', 'oieast');
  if normalized ~ '^(admin|administrator|mod|moderator|support|helpdesk|staff|official|crilo|crilogames|owner|system|security|developer|devteam|verified|supabase)$' then
    raise exception 'That username is reserved.' using errcode = '23514';
  end if;
  if normalized ~ '(fuck|shit|bitch|cunt|nigg|fagg|retard|nazi|porn|rape|rapist|kike|spic|chink|whore|slut|dick|pussy|cock|penis|vagina|sexoffender)' then
    raise exception 'Choose a more appropriate username.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists crilo_guard_username_trigger on public.profiles;
create trigger crilo_guard_username_trigger
before insert or update of username on public.profiles
for each row execute function public.crilo_guard_username();
