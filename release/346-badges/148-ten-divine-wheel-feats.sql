-- 2026-10-14: Add ten distinct, realistically attainable Divine-tier challenges.
-- Estimated per-official-Daily probabilities derived from 8,000,000 seeded
-- independent simulations of the existing 24-sector wheel. Simulated odds
-- are approximate; no wheel odds, scoring, player records, or badges are altered.
-- Triggers already award these via the verified official Daily badge evaluator.
-- Existing Divine medals remain unchanged.
begin;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_fourfold_fortune','Fourfold Fortune','Land four consecutive ×2 results in one official Daily.','Divine','Wheel ×2','{"key":"divine_fourfold_fortune","name":"Fourfold Fortune","rule":"event_streak","event":"double","target":4,"rarity":"Divine","category":"Wheel ×2","condition":"Land four consecutive ×2 results in one official Daily.","probability_percent":0.030425}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_fourfold_fortune','Fourfold Fortune','Land four consecutive ×2 results in one official Daily.','Wheel ×2','{"type":"event_streak","rarity":"divine","probability_percent":0.030425,"rule":"event_streak","event":"double","target":4}'::jsonb,false,874,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_royal_flock','Royal Flock','Land five consecutive Duck results in one official Daily.','Divine','Wheel Duck','{"key":"divine_royal_flock","name":"Royal Flock","rule":"event_streak","event":"duck","target":5,"rarity":"Divine","category":"Wheel Duck","condition":"Land five consecutive Duck results in one official Daily.","probability_percent":0.07285}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_royal_flock','Royal Flock','Land five consecutive Duck results in one official Daily.','Wheel Duck','{"type":"event_streak","rarity":"divine","probability_percent":0.07285,"rule":"event_streak","event":"duck","target":5}'::jsonb,false,875,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_perpetual_bonus','Perpetual Bonus','Land four consecutive +2 Spins results in one official Daily.','Divine','Wheel +2 Spins','{"key":"divine_perpetual_bonus","name":"Perpetual Bonus","rule":"event_streak","event":"spins","target":4,"rarity":"Divine","category":"Wheel +2 Spins","condition":"Land four consecutive +2 Spins results in one official Daily.","probability_percent":0.031137}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_perpetual_bonus','Perpetual Bonus','Land four consecutive +2 Spins results in one official Daily.','Wheel +2 Spins','{"type":"event_streak","rarity":"divine","probability_percent":0.031137,"rule":"event_streak","event":"spins","target":4}'::jsonb,false,876,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_fifth_ascension','Fifth Ascension','Land at least five Upgrades during a single official Daily.','Divine','Wheel Upgrade','{"key":"divine_fifth_ascension","name":"Fifth Ascension","rule":"event_total","event":"upgrade","target":5,"rarity":"Divine","category":"Wheel Upgrade","condition":"Land at least five Upgrades during a single official Daily.","probability_percent":0.010313}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_fifth_ascension','Fifth Ascension','Land at least five Upgrades during a single official Daily.','Wheel Upgrade','{"type":"event_total","rarity":"divine","probability_percent":0.010313,"rule":"event_total","event":"upgrade","target":5}'::jsonb,false,877,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_sixfold_echo','Sixfold Echo','Land at least six ×2 results during a single official Daily.','Divine','Wheel ×2','{"key":"divine_sixfold_echo","name":"Sixfold Echo","rule":"event_total","event":"double","target":6,"rarity":"Divine","category":"Wheel ×2","condition":"Land at least six ×2 results during a single official Daily.","probability_percent":0.055688}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_sixfold_echo','Sixfold Echo','Land at least six ×2 results during a single official Daily.','Wheel ×2','{"type":"event_total","rarity":"divine","probability_percent":0.055688,"rule":"event_total","event":"double","target":6}'::jsonb,false,878,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_great_migration','The Great Migration','Land at least ten Duck results during a single official Daily.','Divine','Wheel Duck','{"key":"divine_great_migration","name":"The Great Migration","rule":"event_total","event":"duck","target":10,"rarity":"Divine","category":"Wheel Duck","condition":"Land at least ten Duck results during a single official Daily.","probability_percent":0.01635}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_great_migration','The Great Migration','Land at least ten Duck results during a single official Daily.','Wheel Duck','{"type":"event_total","rarity":"divine","probability_percent":0.01635,"rule":"event_total","event":"duck","target":10}'::jsonb,false,879,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_celestial_jackpot','Celestial Jackpot','Gain at least 10,000 points from a single numbered spin after Upgrades during one official Daily.','Divine','Score rarity','{"key":"divine_celestial_jackpot","name":"Celestial Jackpot","rule":"challenge","number":159,"target":10000,"rarity":"Divine","category":"Score rarity","condition":"Gain at least 10,000 points from a single numbered spin after Upgrades during one official Daily.","probability_percent":0.030325}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_celestial_jackpot','Celestial Jackpot','Gain at least 10,000 points from a single numbered spin after Upgrades during one official Daily.','Score rarity','{"type":"challenge","rarity":"divine","probability_percent":0.030325,"rule":"challenge","number":159,"target":10000}'::jsonb,false,880,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_perfect_orbit','The Perfect Orbit','Land Duck → ×2 → Upgrade → +2 Spins → Duck on five consecutive spins in one official Daily.','Divine','Wheel combinations','{"key":"divine_perfect_orbit","name":"The Perfect Orbit","rule":"sequence","pattern":["duck","double","upgrade","spins","duck"],"rarity":"Divine","category":"Wheel combinations","condition":"Land Duck → ×2 → Upgrade → +2 Spins → Duck on five consecutive spins in one official Daily.","probability_percent":0.005412}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_perfect_orbit','The Perfect Orbit','Land Duck → ×2 → Upgrade → +2 Spins → Duck on five consecutive spins in one official Daily.','Wheel combinations','{"type":"sequence","rarity":"divine","probability_percent":0.005412,"rule":"sequence","pattern":["duck","double","upgrade","spins","duck"]}'::jsonb,false,881,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_cosmic_alignment','Cosmic Alignment','Land ×2 → Upgrade → ×2 → Upgrade on four consecutive spins in one official Daily.','Divine','Wheel combinations','{"key":"divine_cosmic_alignment","name":"Cosmic Alignment","rule":"sequence","pattern":["double","upgrade","double","upgrade"],"rarity":"Divine","category":"Wheel combinations","condition":"Land ×2 → Upgrade → ×2 → Upgrade on four consecutive spins in one official Daily.","probability_percent":0.016025}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_cosmic_alignment','Cosmic Alignment','Land ×2 → Upgrade → ×2 → Upgrade on four consecutive spins in one official Daily.','Wheel combinations','{"type":"sequence","rarity":"divine","probability_percent":0.016025,"rule":"sequence","pattern":["double","upgrade","double","upgrade"]}'::jsonb,false,882,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

insert into public.crilo_v3_badge_stage
 (badge_key,display_name,description,rarity,category,rule,status)
 values ('divine_twenty_thousand_suns','Twenty Thousand Suns','Finish an official Daily with at least 20,000 total points.','Divine','Score rarity','{"key":"divine_twenty_thousand_suns","name":"Twenty Thousand Suns","rule":"score_band","lower":20000,"upper":null,"rarity":"Divine","category":"Score rarity","condition":"Finish an official Daily with at least 20,000 total points.","probability_percent":0.044025}'::jsonb,'active')
 on conflict (badge_key) do update
 set display_name=excluded.display_name,description=excluded.description,rarity=excluded.rarity,
 category=excluded.category,rule=excluded.rule,status=excluded.status;

insert into public.badges
 (badge_key,name,description,category,requirement,is_secret,sort_order,is_active,is_earnable)
 values ('divine_twenty_thousand_suns','Twenty Thousand Suns','Finish an official Daily with at least 20,000 total points.','Score rarity','{"type":"score_band","rarity":"divine","probability_percent":0.044025,"rule":"score_band","lower":20000,"upper":null}'::jsonb,false,883,true,true)
 on conflict (badge_key) do update
 set name=excluded.name,description=excluded.description,category=excluded.category,
 requirement=excluded.requirement,is_active=true,is_earnable=true;

commit;
