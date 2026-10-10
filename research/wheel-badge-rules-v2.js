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
 // Score rarity uses the percentage of simulated *completed runs* reaching this score or higher.
 const scoreTiers=[
  {rarity:'mythic',max:0.0001},
  {rarity:'legendary',max:0.001},
  {rarity:'epic',max:0.01},
  {rarity:'rare',max:0.05},
  {rarity:'uncommon',max:0.20},
  {rarity:'common',max:1}
 ];
 const scoreRules=Object.freeze(scoreTiers.map(x=>Object.freeze({
  key:'v2_score_rarity_'+x.rarity,kind:'score_rarity',rarity:x.rarity,maxTailProbability:x.max
 })));
 function classifyScoreTail(tailProbability){
  if(typeof tailProbability!=='number'||!Number.isFinite(tailProbability)||tailProbability<0||tailProbability>1)
   throw Error('Score rarity requires a valid verified tail probability between 0 and 1');
  return scoreTiers.find(t=>tailProbability<=t.max).rarity;
 }
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
 function evaluate(results,scoreTailProbability){
  const stats=analyze(results);
  const earned=rules.filter(rule=>(rule.kind==='total'?stats.totals:stats.streaks)[rule.type]>=rule.threshold).map(r=>r.key);
  // Exactly ONE score-tier badge per completed official run, never all lower tiers.
  if(scoreTailProbability!==undefined)earned.push('v2_score_rarity_'+classifyScoreTail(scoreTailProbability));
  return {earned,stats};
 }
 return {rules,scoreRules,classifyScoreTail,analyze,evaluate};
});