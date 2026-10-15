'use strict';
/* Final score percentiles and individual badge drop odds are different scales.
 * No Supabase session or live user data is required for these checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const rworld={};
vm.runInNewContext(read('rarity-system.js'),{window:rworld});
const score=rworld.CriloRarity;
const expected=[
 ['trash',0,120],['common',121,440],['uncommon',441,860],
 ['rare',861,1620],['epic',1621,2460],['anomaly',2461,5440],
 ['mythic',5441,14420],['divine',14421,Infinity]
];
assert.deepEqual(JSON.parse(JSON.stringify(score.scoreBands.map(x=>[x.key,x.min,x.max]).map(row=>row.map(x=>x===Infinity?'Infinity':x)))),expected.map(row=>row.map(x=>x===Infinity?'Infinity':x)));
for(const [tier,min,max] of expected){
 assert.equal(score.classify(min).color,tier,'Score floor '+tier);
 if(Number.isFinite(max))assert.equal(score.classify(max).color,tier,'Score ceiling '+tier);
}
assert.equal(score.classify(5440).color,'anomaly');
assert.equal(score.classify(5441).color,'mythic');
assert.equal(score.classify(14421).color,'divine');
assert.equal(score.levels.find(x=>x.key==='mythic').max,0.01);
assert.equal(score.badgeBands.length,7,'Six probability bands plus explicit Divine prestige; Trash is a score only');
assert.equal(score.badgeBands[6].key,'divine');
for(const [prob,expectedTier] of [
 [50,'common'],[10.001,'common'],[10,'uncommon'],
 [1,'uncommon'],[.999999,'rare'],[.1,'rare'],
 [.0999,'epic'],[.01,'epic'],[.009999,'anomaly'],
 [.001,'anomaly'],[.00099,'mythic'],[.0003667,'mythic']
])assert.equal(score.badgeTierFromPercent(prob),expectedTier,'Probability '+prob);
for(const bad of [null,-1,101,NaN,Infinity,''])assert.equal(score.badgeTierFromPercent(bad),null);
const collectionWindow={};
vm.runInNewContext(read('badge-collection.js'),{window:collectionWindow});
const badges=collectionWindow.CriloBadgeCollection;
assert.equal(badges.rarityOrder.length,7);
assert.deepEqual(Array.from(badges.rarityOrder),['common','uncommon','rare','epic','anomaly','mythic','divine']);
const mk=prob=>({name:'Probability example',badge_key:'example',category:'wheel',
 requirement:{rarity:'mythic',probability_percent:prob},description:'Test chance'});
assert.equal(badges.rarity(mk(18.41335)),'common','Measured probability overrides old rarity');
assert.equal(badges.rarity(mk(.5262)),'rare','Measured rare is not Mythic');
assert.equal(badges.rarity(mk(.0003667)),'mythic');
assert.equal(badges.rarity({requirement:{rarity:'epic'}}),'epic','Unmeasured challenges preserve difficulty');
assert.equal(badges.rarity({requirement:{rarity:'divine',probability_percent:.09335}}),'divine','Divine authored prestige outranks measured badge drop chance');
assert.equal(badges.rarity({requirement:{rarity:'trash'}}),'uncommon','There is no Trash badge tier');
const escape=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const html=badges.tileHTML(mk(.5262),true,escape,{expanded:true,interactive:false});
assert.match(html,/data-badge-rarity="rare"/);
assert.match(html,/about 0\.5262% per Daily/);
assert.doesNotMatch(html,/MYTHIC/i);
const definitions=JSON.parse(read('release/346-badges/catalog-rules.json'));
assert.equal(definitions.length,347);
const scoreBadges=definitions.filter(x=>x.rule==='score_band');
assert.equal(scoreBadges.length,8);
for(let i=0;i<8;i++){
 const [tier,min,max]=expected[i];
 const info=scoreBadges.find(x=>x.key==='v2_score_rarity_'+tier);
 assert.ok(info,'Missing score badge '+tier);
 assert.equal(info.lower,min);
 assert.equal(info.upper,max===Infinity?null:max);
 assert.equal(info.rarity.toLowerCase(),score.badgeTierFromPercent(info.probability_percent));
 assert.match(info.condition,/Finish one official Daily/);
}
const sql=read('release/346-badges/138-rngdle-percentile-rarity.sql');
assert.match(sql,/update public\.badges/);
assert.doesNotMatch(sql,/(update|delete|truncate)\s+public\.(daily_runs|user_badges|profiles|spin_sessions)/i);
assert.match(sql,/0\.001/);
assert.match(sql,/319/);
const palette=read('rarity-palette.css');
assert.match(palette,/--tier-mythic:#bd2633/);
assert.match(palette,/--tier-mythic:#eda0aa/);
assert.match(palette,/--tier-divine:#d8e6ff/);
assert.match(palette,/--tier-divine-pale:#111318/);
assert.doesNotMatch(palette,/--tier-divine:#e1c781/);
assert.match(palette,/\.badge-top-chip/);
for(const path of ['index.html','profile.html','leaderboard.html','badge-sets.html'])
 assert.match(read(path),/rarity-palette\.css\?v=4/,'Rarity styles missing '+path);
assert.match(read('index.html'),/Divine<\/strong><small>14,440\+ points/);
assert.match(read('index.html'),/Anomaly<\/strong><small>2,480–5,440 points/);
assert.match(read('badge-sets.html'),/&lt;0\.001%/);
assert.doesNotMatch(read('badge-sets.html'),/<span data-rarity="trash">/);
// Divine is intentionally separate from per-spin badge drop bands; each medal has a real rule.
const oldDivineKeys=['v2_score_rarity_divine','divine_beyond_mythic','divine_touched_by_wheel',
 'divine_heavenly_momentum','divine_consistency'];
const newDivineKeys=[
 'divine_fourfold_fortune','divine_royal_flock','divine_perpetual_bonus',
 'divine_fifth_ascension','divine_sixfold_echo','divine_great_migration',
 'divine_celestial_jackpot','divine_perfect_orbit','divine_cosmic_alignment',
 'divine_twenty_thousand_suns'
];
const divineKeys=[...oldDivineKeys,...newDivineKeys];
assert.equal(divineKeys.length,15);
const divineSource=read('release/346-badges/147-divine-achievements.sql');
const addedDivineSource=read('release/346-badges/148-ten-divine-wheel-feats.sql');
for(const key of oldDivineKeys)assert.ok(divineSource.includes(key),'Missing existing Divine badge '+key);
for(const key of newDivineKeys)assert.ok(addedDivineSource.includes(key),'Missing new Divine badge '+key);
assert.match(addedDivineSource,/8,000,000 seeded/);
assert.match(addedDivineSource,/on conflict \(badge_key\) do update/);
assert.doesNotMatch(addedDivineSource,/(?:update|delete|truncate)\s+public\.(daily_runs|user_badges|profiles|crilo_spin_sessions)/i);
assert.match(addedDivineSource,/"probability_percent"/,'Every new Divine has estimated odds');
assert.match(divineSource,/verified_spin_session_id is not null/,'Consistency must use proven official runs');
const featuredDivine=divineKeys.map((badge_key,id)=>({
 id:id+1,badge_key,name:badge_key,category:'Score rarity',requirement:{rarity:'divine'},is_active:true,is_earnable:true
}));
assert.equal(badges.active([...featuredDivine,{id:7,is_active:false},{id:8,is_earnable:false}]).length,5);
const arts=featuredDivine.map(x=>badges.artHTML(x));
assert.ok(arts.every(x=>x.includes('<svg')),'All fifteen Divine badges need art');
assert.equal(new Set(arts).size,15,'Each Divine badge needs distinct artwork');
const divineBeforeMythic=badges.bestEarned([
 {id:99,badge_key:'mythic',name:'Mythic',category:'Wheel',requirement:{rarity:'mythic'}},
 ...featuredDivine],[...featuredDivine.map(x=>({badge_id:x.id})),{badge_id:99}],50);
 assert.equal(badges.rarity(divineBeforeMythic[0]),'divine','Divine precedes Mythic');
 assert.equal(divineBeforeMythic[divineBeforeMythic.length-1].badge_key,'mythic');
assert.match(read('profile.js'),/earnedCount\+'\/'\+activeBadges\.length\+' badges collected · Best 50 shown'/);
assert.match(read('profile.js'),/is_active,is_earnable/);
assert.match(read('badge-sets.js'),/is_active,is_earnable/);
console.log('RARITY_PERCENTILES_PASS: eight score tiers, six chance bands plus Divine prestige, dynamic active collections, fifteen distinct Divine emblems');
