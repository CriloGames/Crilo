-- Complete the 24-sector migration for historical owner-only Test Runs.
-- These 30 sandbox records never participate in official competition and do
-- not have spin histories, so only a documented 20x approximation is possible.
create table crilo_wheel_20261014.owner_test_runs as
select * from public.owner_test_runs;
revoke all on crilo_wheel_20261014.owner_test_runs from public,anon,authenticated;
create table crilo_wheel_20261014.owner_test_conversion_audit as
select id,score as original_score,'estimated_20x_no_spin_history'::text as method,
created_at from public.owner_test_runs;
revoke all on crilo_wheel_20261014.owner_test_conversion_audit from public,anon,authenticated;
update public.owner_test_runs o set
score=least(o.score::numeric*20,9007199254740991::numeric)::bigint,
rarity_label=upper(replace(public.crilo_v2_official_score_badge_key(
least(o.score::numeric*20,9007199254740991::numeric)::bigint),
'v2_score_rarity_','')),
rarity_odds=case when o.score*20>=14421 then 1000 when o.score*20>=5441 then 111
when o.score*20>=2461 then 25 when o.score*20>=1621 then 20
when o.score*20>=861 then 7 when o.score*20>=441 then 4
when o.score*20>=121 then 2 else 1 end
where o.id in (select id from crilo_wheel_20261014.owner_test_runs);
do $verify$ declare b int;n int;wrong int;begin
select count(*) into b from crilo_wheel_20261014.owner_test_runs;
select count(*) into n from public.owner_test_runs;
select count(*) into wrong from public.owner_test_runs o
join crilo_wheel_20261014.owner_test_runs b on b.id=o.id
where o.score<>least(b.score::numeric*20,9007199254740991::numeric)::bigint;
if b<>n or wrong<>0 then raise exception 'Owner Test conversion mismatch %/% wrong %',b,n,wrong;end if;
end $verify$;