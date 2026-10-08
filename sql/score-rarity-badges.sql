-- Run once in Supabase SQL Editor after reviewing.
-- Score tiers calibrated from 100,000 deterministic wheel-rule simulations.
-- Each threshold is the minimum score whose empirical upper-tail probability
-- is <= 20%, 5%, 1%, 0.1%, or 0.01%, respectively.
-- Never deletes or replaces existing badges or earned badges.
insert into public.badges (badge_key,name,description,category,is_secret,sort_order)
select v.badge_key,v.name,v.description,'rarity',false,v.sort_order
from (values
 ('score_uncommon','Uncommon Run','Finish an official Daily with an Uncommon score or higher (top 20%).',201),
 ('score_rare','Rare Run','Finish an official Daily with a Rare score or higher (top 5%).',202),
 ('score_epic','Epic Run','Finish an official Daily with an Epic score or higher (top 1%).',203),
 ('score_legendary','Legendary Run','Finish an official Daily with a Legendary score or higher (top 0.1%).',204),
 ('score_mythic','Mythic Run','Finish an official Daily with a Mythic score or higher (top 0.01%).',205)
) as v(badge_key,name,description,sort_order)
where not exists(select 1 from public.badges b where b.badge_key=v.badge_key);

create or replace function public.crilo_award_score_rarity_badges()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if new.is_test is true then return new; end if;
 insert into public.user_badges(user_id,badge_id,earned_at)
 select new.user_id,b.id,now() from public.badges b
 where (b.badge_key='score_uncommon' and new.score>=58)
    or (b.badge_key='score_rare' and new.score>=142)
    or (b.badge_key='score_epic' and new.score>=320)
    or (b.badge_key='score_legendary' and new.score>=805)
    or (b.badge_key='score_mythic' and new.score>=2034)
 on conflict do nothing;
 return new;
end;
$$;
drop trigger if exists crilo_score_rarity_badges_on_daily on public.daily_runs;
create trigger crilo_score_rarity_badges_on_daily
after insert on public.daily_runs
for each row execute function public.crilo_award_score_rarity_badges();

-- Backfill earned rarity badges from existing official runs.
insert into public.user_badges(user_id,badge_id,earned_at)
select r.user_id,b.id,now()
from (select user_id,max(score) as best from public.daily_runs where is_test=false group by user_id) r
cross join public.badges b
where (b.badge_key='score_uncommon' and r.best>=58)
   or (b.badge_key='score_rare' and r.best>=142)
   or (b.badge_key='score_epic' and r.best>=320)
   or (b.badge_key='score_legendary' and r.best>=805)
   or (b.badge_key='score_mythic' and r.best>=2034)
on conflict do nothing;
