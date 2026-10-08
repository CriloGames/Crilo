-- Crilo Duck Collection — Phase 1 database foundation.
-- Run once in Supabase SQL Editor. Safe for existing profiles and daily_runs.
-- Unlock progress counts DISTINCT completed, non-test Daily periods, not logins or test spins.

create table if not exists public.duck_types (
  id smallint primary key check (id between 1 and 30),
  slug text not null unique,
  name text not null,
  unlock_runs integer not null check (unlock_runs >= 0),
  appearance_weight integer not null check (appearance_weight > 0),
  tier text not null check (tier in ('Common','Uncommon','Rare','Epic','Legendary','Mythic')),
  description text not null default ''
);

-- Appearance weights are RELATIVE, not absolute percentages:
-- each eligible duck's chance = its weight / sum of unlocked weights.
-- All 30 rows are explicit to keep unlock progression predictable.
insert into public.duck_types(id,slug,name,unlock_runs,appearance_weight,tier,description) values
(1,'classic','Classic',0,1000,'Common','The original yellow doodle duck'),
(2,'blue','Blue',2,550,'Common','A bright blue doodle duck'),
(3,'pink','Pink',3,450,'Common','A rosy little duck'),
(4,'mallard','Mallard',5,400,'Common','A woodland-colored duck'),
(5,'duckling','Duckling',7,360,'Common','Tiny and excitable'),
(6,'snow','Snow',10,300,'Uncommon','A snowy white duck'),
(7,'cowboy','Cowboy',12,260,'Uncommon','A duck in a floppy hat'),
(8,'chef','Chef',15,240,'Uncommon','An enthusiastic tiny chef'),
(9,'bee','Bee',18,220,'Uncommon','A duck in a bee costume'),
(10,'frog','Frog',21,200,'Uncommon','A duck pretending to be a frog'),
(11,'detective','Detective',25,170,'Uncommon','A duck investigating mysteries'),
(12,'party','Party',30,150,'Uncommon','Confetti follows this duck'),
(13,'cool','Cool',35,130,'Rare','Too cool for the pond'),
(14,'pirate','Pirate',40,115,'Rare','A tiny pond pirate'),
(15,'dino','Dino',45,100,'Rare','A prehistoric costume'),
(16,'ninja','Ninja',50,90,'Rare','A sneaky little duck'),
(17,'summer','Summer',55,80,'Rare','Sunny tropical duck'),
(18,'viking','Viking',60,70,'Rare','A tiny horned helmet'),
(19,'royal','Royal',70,60,'Epic','A crown and big ambitions'),
(20,'angel','Angel',80,50,'Epic','A halo and small wings'),
(21,'devil','Devil',90,45,'Epic','A mischievous duck'),
(22,'zombie','Zombie',100,40,'Epic','Still loves bread'),
(23,'vampire','Vampire',115,34,'Epic','A dramatic cape'),
(24,'wizard','Wizard',130,28,'Legendary','Mostly harmless spells'),
(25,'astronaut','Astronaut',150,24,'Legendary','Exploring beyond the pond'),
(26,'robot','Robot',175,20,'Legendary','A mechanical quack'),
(27,'ghost','Ghost',200,16,'Legendary','A friendly little haunting'),
(28,'fire','Fire',230,12,'Mythic','A fiery doodle duck'),
(29,'ice','Ice',260,9,'Mythic','A frosty doodle duck'),
(30,'galaxy','Galaxy',300,5,'Mythic','A duck full of stars')
on conflict (id) do nothing;

-- Discoveries are separate from unlocks. A player can unlock a duck
-- without having rolled it. No client INSERT policy yet: server-validated
-- recording will be added with the game integration to prevent fake finds.
create table if not exists public.duck_discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  duck_id smallint not null references public.duck_types(id),
  first_found_at timestamptz not null default now(),
  times_found integer not null default 1 check (times_found > 0),
  primary key(user_id,duck_id)
);

create index if not exists duck_discoveries_user_idx on public.duck_discoveries(user_id);
create index if not exists daily_runs_duck_progress_idx
  on public.daily_runs(user_id,daily_period)
  where is_test = false;

alter table public.duck_types enable row level security;
alter table public.duck_discoveries enable row level security;

drop policy if exists "Anyone can view duck types" on public.duck_types;
create policy "Anyone can view duck types"
on public.duck_types for select to anon, authenticated using (true);

drop policy if exists "Players can view their discoveries" on public.duck_discoveries;
create policy "Players can view their discoveries"
on public.duck_discoveries for select to authenticated using (auth.uid() = user_id);

-- Read-only, authenticated progress endpoint.
-- SECURITY INVOKER respects daily_runs RLS; assumes users can read their own runs.
create or replace function public.crilo_duck_progress()
returns table (completed_dailies bigint, duck_id smallint, unlocked boolean, discovered boolean, times_found integer)
language sql stable security invoker set search_path = public
as $$
  with progress as (
    select count(distinct daily_period)::bigint as n
    from public.daily_runs
    where user_id = auth.uid() and is_test = false
  )
  select p.n, d.id, p.n >= d.unlock_runs,
         (coalesce(f.times_found,0) > 0),
         coalesce(f.times_found,0)
  from public.duck_types d cross join progress p
  left join public.duck_discoveries f
    on f.user_id = auth.uid() and f.duck_id = d.id
  order by d.id;
$$;
revoke all on function public.crilo_duck_progress() from public;
grant execute on function public.crilo_duck_progress() to authenticated;
