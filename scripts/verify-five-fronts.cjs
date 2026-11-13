/* Offline tests for the Five Fronts owner-only single-player alpha.
   Run: node scripts/verify-five-fronts.cjs
   No network, live Supabase accounts, or public scores are used. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const E=require('../five-fronts-core.js');
const html=read('five-fronts.html'),js=read('five-fronts.js'),css=read('five-fronts.css');
const catalog=read('test-games.html'),publicIndex=read('index.html');
new Function(js);
assert.match(html,/<meta name="robots" content="noindex,nofollow"/);
assert.match(html,/id="ffGame" hidden inert/);
assert.match(html,/id="ffGate"/);
assert.match(catalog,/href="five-fronts.html"/);
assert.doesNotMatch(publicIndex,/href="five-fronts.html"/);
assert.match(js,/await criloDB\.auth\.getUser\(\)/);
assert.match(js,/\.\s*select\('id,is_owner'\)\.eq\('id',uid\)\.maybeSingle\(\)/);
assert.match(js,/profile\?\.id!==uid\|\|profile\.is_owner!==true/);
assert.doesNotMatch(js,/criloDB\.(?:rpc|from\('five_fronts)/);
assert.match(html,/five-fronts-core\.js\?v=1/);
assert.match(html,/five-fronts\.js\?v=1/);
assert.match(html,/id="ffCountries"/);
assert.match(html,/id="ffSpeed"/);
assert.match(html,/id="ffMap"/);
assert.match(html,/id="ffCouncilModal"/);
assert.match(html,/id="ffEventModal"/);
assert.match(html,/id="ffEndModal"/);
assert.match(html,/id="ffTestEvent"/);
assert.match(css,/@media\(max-width:490px\)/);
assert.match(css,/\.ff-map-state\.is-targetable/);
const used=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
for(const id of used)assert.match(html,new RegExp('id="'+id+'"'),
 'JS control must exist in page: '+id);
function connected(g,id){
 const lands=g.states.filter(s=>s.owner===id),seen=new Set([lands[0].id]),queue=[lands[0]];
 while(queue.length){
  const top=queue.shift();
  for(const s of lands)if(!seen.has(s.id)&&top.neighbors.includes(s.id)){
   seen.add(s.id);queue.push(s);
  }
 }
 return seen.size===lands.length;
}
for(let count=2;count<=6;count++){
 for(let seed=1;seed<=100;seed++){
  const g=E.createMatch({countries:count,seed});
  assert.equal(g.states.length,count*5);
  assert.equal(g.countries.length,count);
  for(let owner=0;owner<count;owner++){
   assert.equal(E.ownedCount(g,owner),5,'Every country must own five equal-area hex states');
   assert.ok(connected(g,owner),'Country must begin as contiguous land');
   assert.equal(g.states.filter(s=>s.owner===owner&&s.capital).length,1);
   assert.ok(g.countries[owner].resources.food>0);
  }
  for(const s of g.states){
   assert.equal(s.neighbors.length,new Set(s.neighbors).size,'No duplicate borders');
   for(const other of s.neighbors){
    assert.ok(E.getState(g,other).neighbors.includes(s.id),'Borders are bidirectional');
   }
  }
 }
}
// Test real actions and economic costs, not just the module shape.
const g=E.createMatch({countries:3,seed:7717});
const capital=g.states.find(s=>s.owner===0&&s.capital);
const food=g.countries[0].resources.food,metal=g.countries[0].resources.metal;
const troops=capital.troops;
assert.equal(E.train(g,0,capital.id).ok,true);
assert.equal(capital.troops,troops+20);
assert.equal(g.countries[0].resources.food,food-E.COST.train.food);
assert.equal(g.countries[0].resources.metal,metal-E.COST.train.metal);
assert.equal(E.fortify(g,0,capital.id).ok,true);
assert.equal(capital.fort,1);
assert.equal(E.train(g,0,g.states.find(s=>s.owner!==0).id).ok,false);
const invalid=g.states.find(s=>!capital.neighbors.includes(s.id)&&s.id!==capital.id);
assert.equal(E.march(g,0,capital.id,invalid.id,20).ok,false,'No teleporting through the map');
const dst=E.getState(g,capital.neighbors[0]),before=capital.troops;
assert.equal(E.march(g,0,capital.id,dst.id,30).ok,true);
assert.equal(capital.troops,before-30);
assert.equal(g.transits.length,1);
assert.equal(E.march(g,0,capital.id,dst.id,1000).ok,false,'Troops cannot be duplicated');
for(let n=0;n<14;n++)E.advance(g,5);
assert.equal(g.transits.length,0,'Army orders must actually arrive');
// Event checks: a skilled response should lose fewer troops and resources.
assert.equal(E.triggerEvent(g,true),true);
const beforeEvent=structuredClone(g),event=beforeEvent.pendingEvent;
assert.ok(event&&event.owner===0);
const failed=structuredClone(beforeEvent),succeeded=structuredClone(beforeEvent);
E.resolveEvent(failed,failed.pendingEvent,false);
E.resolveEvent(succeeded,succeeded.pendingEvent,true);
assert.equal(failed.pendingEvent,null);
assert.ok(E.getState(succeeded,event.stateId).troops>=E.getState(failed,event.stateId).troops);
// Verify an actual national council at 05:00 game time.
let loops=0;
while(g.time<300&&!g.pendingStrategy&&loops++<90){
 if(g.pendingEvent)E.resolveEvent(g,g.pendingEvent,true);
 E.advance(g,5);
}
assert.ok(g.pendingStrategy,'A national choice must arrive every five minutes');
assert.equal(g.time>=300,true);
assert.equal(g.pendingStrategy.options.length,3);
assert.equal(new Set(g.pendingStrategy.options).size,3);
assert.equal(E.train(g,0,capital.id).ok,false,'No acting while council is open');
const policy=g.pendingStrategy.options[0];
assert.equal(E.applyStrategy(g,0,policy).ok,true);
assert.equal(g.pendingStrategy,null);
assert.equal(g.countries[0].policy,policy);
const atCouncil=g.time;
E.advance(g,5);assert.ok(g.time>atCouncil);
// Simulation should end reliably with one victor (including timed ties).
for(let players=2;players<=6;players++){
 for(let seed=1;seed<=24;seed++){
  const war=E.createMatch({countries:players,seed,fast:true});
  let rounds=0;
  while(!war.ended&&rounds++<1900){
   if(war.pendingStrategy)E.applyStrategy(war,0,war.pendingStrategy.options[0]);
   if(war.pendingEvent)E.resolveEvent(war,war.pendingEvent,true);
   E.advance(war,5);
  }
  assert.ok(war.ended,'War must always finish');
  assert.ok(Number.isInteger(war.winner),'Exactly one country wins');
  assert.ok(war.winner>=0&&war.winner<players);
  assert.ok(war.time<=1800+.001);
 }
}
(async()=>{
 // Browserless controller smoke: verifies owner gating, map interactions,
 // matching state counters, council choice, disaster challenge and outcome.
 async function browserless(owner){
  const nodes=new Map(),winEvents={},docEvents={},frames=new Map(),storage=new Map();
  let nextFrame=0,role=owner;
  function node(id){
   if(nodes.has(id))return nodes.get(id);
   const events={},children=[],styles={},attributes={};
   const n={id,hidden:['ffGame','ffMatch','ffResume','ffCommandActions','ffCancelMarch','ffCouncilModal','ffEventModal','ffEndModal'].includes(id),
    inert:false,disabled:false,textContent:'',innerHTML:'',value:id==='ffCountries'?'3':id==='ffSpeed'?'fast':id==='ffMarchAmount'?'60':'',
    events,children,dataset:{},style:styles,attributes,
    addEventListener(type,fn){events[type]=fn},
    setAttribute(k,v){attributes[k]=v},
    focus(){},append(...els){children.push(...els)},
    replaceChildren(){children.length=0},
    querySelector(sel){return sel==='button'?children.find(c=>c.tagName==='button'):null},
    classList:{add(){},remove(){}}
   };
   nodes.set(id,n);return n;
  }
  const doc={hidden:false,activeElement:node('ffStart'),
   getElementById:node,
   addEventListener:(k,f)=>{docEvents[k]=f},
   createElement(tag){const n=node('created-'+nodes.size);n.tagName=tag;return n;}};
  const win={Crilo:{authResolved:true},FiveFrontsEngine:E,
   confirm:()=>true,addEventListener:(k,f)=>{winEvents[k]=f}};
  const criloDB={auth:{getUser:async()=>({data:{user:{id:'fixture-owner'}}})},
   from:table=>{assert.equal(table,'profiles');return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:{id:'fixture-owner',is_owner:role}
   })})})};}};
  const localStorage={getItem:k=>storage.get(k)||null,
   setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame};
  const instrumented=js.replace(" window.addEventListener('crilo-auth-ready',verify);",
   " window.__ffSmoke={get:()=>match,checkInterruptions,render,resolveEmergency,updateEmergency};\n window.addEventListener('crilo-auth-ready',verify);");
  assert.notEqual(instrumented,js);
  new Function('window','document','criloDB','localStorage','requestAnimationFrame','E',instrumented)
   (win,doc,criloDB,localStorage,requestAnimationFrame,E);
  for(let i=0;i<9;i++)await Promise.resolve();
  assert.equal(node('ffGame').hidden,!owner);
  if(!owner){
   assert.match(node('ffGate').textContent,/owner/i);
   return;
  }
  node('ffStart').events.click();
  const war=win.__ffSmoke.get();
  assert.ok(war&&war.states.length===15);
  assert.equal(node('ffMatch').hidden,false);
  assert.match(node('ffMap').innerHTML,/data-state="0"/);
  assert.match(node('ffResources').innerHTML,/FOOD/);
  const state=war.states.find(s=>s.owner===0&&s.capital);
  const before=state.troops;
  node('ffTrain').events.click();
  assert.equal(state.troops,before+20);
  node('ffMarch').events.click();
  assert.match(node('ffGuidance').textContent,/adjacent/i);
  const target=state.neighbors[0];
  // Event delegation passes a real SVG-like target to the map.
  node('ffMap').events.click({target:{closest:()=>({dataset:{state:String(target)}})}});
  assert.equal(war.transits.length,1);
  node('ffPause').events.click();assert.equal(war.paused,true);
  node('ffPause').events.click();assert.equal(war.paused,false);
  node('ffTestEvent').events.click();
  assert.ok(war.pendingEvent);
  assert.equal(node('ffEventModal').hidden,false);
  win.__ffSmoke.updateEmergency(.8);
  node('ffEventTry').events.click();
  assert.equal(war.pendingEvent,null);
  assert.equal(node('ffEventModal').hidden,true);
  let safety=0;
  while(!war.pendingStrategy&&!war.ended&&safety++<80){
   if(war.pendingEvent)E.resolveEvent(war,war.pendingEvent,true);
   E.advance(war,5);
  }
  assert.ok(war.pendingStrategy,'National decision must appear');
  win.__ffSmoke.checkInterruptions();
  assert.equal(node('ffCouncilModal').hidden,false);
  const first=node('ffPolicyOptions').children[0];
  assert.ok(first&&first.events.click);
  first.events.click();
  assert.equal(war.pendingStrategy,null);
  assert.equal(node('ffCouncilModal').hidden,true);
  assert.ok(storage.size>0,'Private match should be saved locally');
  role=false;winEvents['crilo-auth-ready']();
  for(let i=0;i<9;i++)await Promise.resolve();
  assert.equal(node('ffGame').hidden,true,'Revoked owner access should hide the game');
 }
 await browserless(false);
 await browserless(true);
 console.log('PASS Five Fronts: 2–6 connected balanced countries, economy, combat, AI, decisions, events, one victor, auth and playable UI');
})().catch(err=>{console.error(err);process.exitCode=1});
