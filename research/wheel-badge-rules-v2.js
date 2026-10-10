/* Proposed wheel badge evaluator V1. Pure and side-effect free; no awards or DB writes.
   Evaluate official saved run.results (types: duck,double,upgrade,spins,num).
   Numbers interrupt streaks. Both physical duck slices count as 'duck'. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CriloWheelBadgeRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const families=[
 {type:'duck',kind:'total',tiers:{common:2,uncommon:4,rare:6,epic:8,legendary:10,mythic:12}},
 {type:'double',kind:'total',tiers:{common:1,uncommon:2,rare:4,epic:5,legendary:7,mythic:8}},
 {type:'spins',kind:'total',tiers:{common:1,uncommon:3,rare:4,epic:6,legendary:8,mythic:10}},
 {type:'upgrade',kind:'total',tiers:{common:1,uncommon:2,rare:3,epic:4,mythic:5}},
 {type:'duck',kind:'streak',tiers:{uncommon:2,rare:3,epic:4,legendary:6,mythic:7}},
 {type:'double',kind:'streak',tiers:{rare:2,epic:3,legendary:4,mythic:5}},
 {type:'spins',kind:'streak',tiers:{rare:2,epic:3,legendary:4,mythic:5}},
 {type:'upgrade',kind:'streak',tiers:{rare:2,epic:3,mythic:4}}
 ];
 const types=new Set(['num','duck','double','spins','upgrade']);
 const rules=Object.freeze(families.flatMap(f=>Object.entries(f.tiers).map(([rarity,threshold])=>Object.freeze({
  key:'v2_'+f.type+'_'+f.kind+'_'+threshold,type:f.type,kind:f.kind,threshold,rarity
 }))));
 function analyze(results){
  if(!Array.isArray(results))throw Error('Missing spin results');
  const totals=Object.fromEntries([...types].map(t=>[t,0]));
  const streaks=Object.fromEntries([...types].map(t=>[t,0]));
  let prev='',streak=0,upgrades=0,segments=12;
  for(const result of results){
   const type=result&&result.type;
   if(!types.has(type))throw Error('Unknown wheel outcome: '+String(type));
   if(typeof result.segments==='number'&&result.segments!==(type==='upgrade'?segments+4+Math.min(upgrades+1,8):segments))
     throw Error('Inconsistent segment count in wheel event');
   totals[type]++;
   streak=type===prev?streak+1:1;prev=type;
   streaks[type]=Math.max(streaks[type],streak);
   if(type==='upgrade'){upgrades++;segments+=4+Math.min(upgrades,8);}
  }
  return {totals,streaks,upgrades,segments};
 }
 function evaluate(results){
  const stats=analyze(results);
  const earned=rules.filter(rule=>(rule.kind==='total'?stats.totals:stats.streaks)[rule.type]>=rule.threshold).map(r=>r.key);
  return {earned,stats};
 }
 return {rules,analyze,evaluate};
});