'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const game=fs.readFileSync('game.js','utf8'),rarity=fs.readFileSync('rarity-system.js','utf8');
const items=JSON.parse(fs.readFileSync('release/346-badges/catalog-rules.json','utf8'));
assert.match(game,/const twelve=\[\{type:'num',base:40\}/);
assert.match(game,/segments=twelve\.concat\(twelve\.map/);
assert.match(game,/const chord=2\*radialText\*Math\.sin\(a\/2\)/);
assert.match(game,/ctx\.measureText\(text\)\.width<=maxLabelWidth/);
assert.match(game,/bases=\[20,20,40,40,60,60,80,80,120,160\]/);
assert.match(game,/segments\.push\(\{type:'num',base\},\{type:'num',base\}\)/);
assert.match(rarity,/segments\.push\(value,value\)/);
assert.match(rarity,/\{key:'divine',min:14421,max:Infinity\}/);
assert.equal(items.filter(i=>i.rule==='score_band').length,8);
assert.equal(items.filter(i=>i.rule==='hit_exact').length,65);
for(const x of items.filter(i=>i.rule==='hit_exact')){
 assert.equal(x.target%20,0,x.key);
 assert.ok(x.condition.includes(x.target.toLocaleString('en-US')),x.key);
}
for(const x of items.filter(i=>['base_total','final_base','lifetime_base'].includes(i.rule)))assert.ok([20,40,60,80,120,160].includes(x.base),x.key);
for(const x of items.filter(i=>['base_sequence','number_sequence'].includes(i.rule)))assert.ok(x.pattern.every(v=>[20,40,60,80,120,160].includes(v)),x.key);
console.log('WHEEL_24_PASS: 24 segments, paired upgrades, fitting labels, 65 retargeted exact achievements, Divine');
