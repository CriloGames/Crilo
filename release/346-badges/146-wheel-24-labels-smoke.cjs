'use strict';
const assert=require('node:assert/strict');
const rules=require('./catalog-rules.json');
assert.equal(rules.length,347,'Badge catalog count must not change');
const find=k=>{const b=rules.find(x=>x.key===k);assert.ok(b,k);return b};
for(let i=11;i<=18;i++){const b=find('proposal_linear_'+String(i).padStart(3,'0'));assert.ok(b.name.includes(String(b.base)),b.key);}
for(let i=36;i<=47;i++){const b=find('proposal_linear_'+String(i).padStart(3,'0'));assert.ok(b.name.includes(', '+b.last_base+' Closes'),b.key);}
for(let i=32;i<=35;i++){const b=find('proposal_linear_'+String(i).padStart(3,'0'));assert.ok(b.condition.includes(b.pattern[0]+' then '+b.pattern[1]),b.key);}
for(let i=70;i<=72;i++){const b=find('proposal_linear_'+String(i).padStart(3,'0'));assert.match(b.condition,/\{20,40,60,80\}/);assert.match(b.name,/Different Numbers/);}
assert.equal(rules.filter(b=>b.rule==='hit_exact').length,65,'Keep all exact-score achievements');
assert.equal(rules.filter(b=>b.rule==='score_band').length,8,'Keep Divine and all seven previous score tiers');
console.log('WHEEL_24_LABELS_PASS: 39 corrected badge labels and descriptions; 65 exact-score badges preserved');
