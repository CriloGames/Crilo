const assert=require('node:assert/strict');
const {rules,scoreRules,classifyScoreTail,evaluate}=require('./wheel-badge-rules-v2.js');
const TYPES=['duck','double','spins','upgrade'];
const create=(types)=>{let upgrades=0,segments=12;return types.map(type=>{if(type==='upgrade'){upgrades++;segments+=4+Math.min(upgrades,8)}return {type,segments};});};
assert.equal(rules.length,22,'22 balanced new badge requirements');
assert.equal(new Set(rules.map(r=>r.key)).size,39);
assert.deepEqual(evaluate([]).earned,[],'empty run cannot win wheel badges');
assert.deepEqual(evaluate(create(['num','num','num'])).earned,[],'numbers award no wheel badges');
for(const rule of rules){
 const positive=rule.kind==='total'
   ?Array.from({length:rule.threshold},(_,i)=>i===0?rule.type:rule.type).flatMap((t,i)=>i?[ 'num',t ]:[t])
   :Array(rule.threshold).fill(rule.type);
 const win=evaluate(create(positive)).earned;
 assert.ok(win.includes(rule.key),'failed to award '+rule.key+' on exact threshold');
 const negative=rule.kind==='total'
   ?Array(Math.max(0,rule.threshold-1)).fill(rule.type)
   :Array(Math.max(0,rule.threshold-1)).fill(rule.type);
 assert.ok(!evaluate(create(negative)).earned.includes(rule.key),'premature unlock '+rule.key);
 if(rule.kind==='streak'&&rule.threshold>1){
  const broken=Array(rule.threshold).fill(rule.type).flatMap((t,i)=>i?['num',t]:[t]);
  assert.ok(!evaluate(create(broken)).earned.includes(rule.key),'false streak '+rule.key);
 }
}
assert.equal(evaluate(create(['duck','num','duck','duck'])).stats.streaks.duck,2);
assert.equal(evaluate(create(['upgrade','upgrade','upgrade','duck'])).stats.segments,30);
for(const t of TYPES){
 const a=evaluate(create([t]));
 assert.ok(a.stats.totals[t]===1);
}
assert.throws(()=>evaluate([{type:'fake'}]));
assert.throws(()=>evaluate([{type:'upgrade',segments:12}]),/segment/);
console.log('PASS: all 22 badge thresholds fire at exact boundary, never fire early, reject broken streaks, and account for upgrade-expanded wheels.');
assert.equal(scoreRules.length,6,'six distinct score rarity badges');
for(const [p,label] of [[0.00005,'mythic'],[0.0001,'mythic'],[0.00011,'legendary'],[0.001,'legendary'],[0.00101,'epic'],[0.01,'epic'],[0.0101,'rare'],[0.05,'rare'],[0.0501,'uncommon'],[0.2,'uncommon'],[0.2001,'common'],[1,'common']]){
 assert.equal(classifyScoreTail(p),label,'score tier boundary '+p);
 const badges=evaluate(create(['num']),p).earned.filter(x=>x.startsWith('v2_score_rarity_'));
 assert.deepEqual(badges,['v2_score_rarity_'+label],'one score rarity badge per completed run');
}
assert.equal(evaluate(create(['num'])).earned.filter(x=>x.startsWith('v2_score_rarity_')).length,0,'no made-up tier without verified score odds');
assert.throws(()=>classifyScoreTail(-1));
assert.throws(()=>classifyScoreTail(NaN));
console.log('PASS: six exclusive score tiers with precise rarity boundaries.');
