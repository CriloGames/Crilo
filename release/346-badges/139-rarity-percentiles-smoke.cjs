'use strict';
/* Final score percentiles and individual badge drop odds are different scales.
 * No Supabase session or live user data is required for these checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const rworld={};
vm.runInNewContext(read('rarity-system.js'),{window:rworld});
const score=rworld.CriloRarity;
const expected=[
 ['trash',0,6],['common',7,24],['uncommon',25,48],
 ['rare',49,92],['epic',93,141],['anomaly',142,318],['mythic',319,Infinity]
];
assert.deepEqual(JSON.parse(JSON.stringify(score.scoreBands.map(x=>[x.key,x.min,x.max]).map(row=>row.map(x=>x===Infinity?'Infinity':x)))),expected.map(row=>row.map(x=>x===Infinity?'Infinity':x)));
for(const [tier,min,max] of expected){
 assert.equal(score.classify(min).color,tier,'Score floor '+tier);
 if(Number.isFinite(max))assert.equal(score.classify(max).color,tier,'Score ceiling '+tier);
}
assert.equal(score.classify(318).color,'anomaly');
assert.equal(score.classify(319).color,'mythic');
assert.equal(score.levels.find(x=>x.key==='mythic').max,0.01);
assert.equal(score.badgeBands.length,6,'Badge rarity excludes Trash');
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
assert.equal(badges.rarityOrder.length,6);
assert.deepEqual(Array.from(badges.rarityOrder),['common','uncommon','rare','epic','anomaly','mythic']);
const mk=prob=>({name:'Probability example',badge_key:'example',category:'wheel',
 requirement:{rarity:'mythic',probability_percent:prob},description:'Test chance'});
assert.equal(badges.rarity(mk(18.41335)),'common','Measured probability overrides old rarity');
assert.equal(badges.rarity(mk(.5262)),'rare','Measured rare is not Mythic');
assert.equal(badges.rarity(mk(.0003667)),'mythic');
assert.equal(badges.rarity({requirement:{rarity:'epic'}}),'epic','Unmeasured challenges preserve difficulty');
assert.equal(badges.rarity({requirement:{rarity:'trash'}}),'uncommon','There is no Trash badge tier');
const escape=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const html=badges.tileHTML(mk(.5262),true,escape,{expanded:true,interactive:false});
assert.match(html,/data-badge-rarity="rare"/);
assert.match(html,/about 0\.5262% per Daily/);
assert.doesNotMatch(html,/MYTHIC/i);
const definitions=JSON.parse(read('release/346-badges/catalog-rules.json'));
assert.equal(definitions.length,346);
const scoreBadges=definitions.filter(x=>x.rule==='score_band');
assert.equal(scoreBadges.length,7);
for(let i=0;i<7;i++){
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
assert.match(palette,/\.badge-top-chip/);
for(const path of ['index.html','profile.html','leaderboard.html','badge-sets.html'])
 assert.match(read(path),/rarity-palette\.css\?v=2/,'Rarity styles missing '+path);
assert.match(read('index.html'),/Mythic<\/strong><small>319\+ points/);
assert.match(read('index.html'),/Anomaly<\/strong><small>142–318 points/);
assert.match(read('badge-sets.html'),/&lt;0\.001%/);
assert.doesNotMatch(read('badge-sets.html'),/<span data-rarity="trash">/);
console.log('RARITY_PERCENTILES_PASS: seven Crilo score bands, six badge chance bands, calibrated 346 catalog, legacy fallbacks, four page styles and read-only migration');
