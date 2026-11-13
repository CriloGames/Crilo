/* Offline browser-independent smoke for Crilo's owner-only Almost Perfect.
   Run: node scripts/verify-test-games.mjs */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('test-games.js'),html=read('test-games.html'),css=read('test-games.css'),app=read('app.js');
new Function(js);new Function(app);
assert.match(html,/name="robots" content="noindex,nofollow"/);
assert.match(html,/id="testCollection" hidden inert/);
assert.match(html,/id="precisionPrototype"[^>]+hidden/);
assert.match(html,/id="apResult"[^>]+hidden/);
assert.match(html,/test-games\.js\?v=12/);
assert.match(html,/test-games\.css\?v=9/);
assert.ok(!html.includes('id="apRound"'),'Numbered levels must not appear');
for(const mode of ['path','distance','motion'])assert.ok(html.includes('<option value="'+mode+'">'));
assert.match(html,/id="apNew">NEW GAME/);
assert.match(html,/id="apReplay" hidden/);
assert.match(html,/id="apLiveScore"[^>]*hidden/);
assert.match(html,/id="apLiveValue"/);
assert.match(html,/id="apSound"[^>]*aria-pressed="true"/);
assert.match(html,/id="apReach"/);
assert.match(html,/<option value="1\.75" selected>/);
assert.match(css,/#apReachWrap\[hidden\]\{display:none!important\}/);
assert.match(js,/function virtualPosition\(e\)/);
assert.match(js,/e\.pointerType!=='mouse'\|\|mode==='distance'/,
 'Touch and radial distance must bypass trackpad amplification');
assert.match(css,/\.ap-live-score\[hidden\]/);
assert.ok(!html.includes('id="apShape"')&&!html.includes('id="apShapeTitle"'),'Shape card must be absent from all game modes');
assert.match(js,/const forgiving=Math\.exp\(-error\/155\)/);
assert.match(js,/timeAccuracy\*\.72\+pathScore\(attempt\)\*\.28/);
assert.match(js,/await criloDB\.auth\.getUser\(\)/);
assert.match(js,/\.select\('id,is_owner'\)\.eq\('id',userId\)\.maybeSingle\(\)/);
assert.match(js,/profile\?\.id!==userId\|\|profile\.is_owner!==true/);
assert.ok(!js.includes('criloDB.rpc('),'No public scoreboard or Daily writes');
assert.match(app,/testLink\.textContent='TEST GAMES'/);
assert.match(css,/#apResult\[hidden\]/);
assert.match(css,/@media\(max-width:520px\)/);
assert.match(css,/precision studio visual pass/);
assert.match(css,/\.ap-arena::after\s*\{[^}]*pointer-events:none/s,
  'Arena ornamentation must never block input');
assert.match(css,/\.ap-stats\s*\{[^}]*display:flex/s,
  'Scores should share one calmer score rail rather than separate cards');
assert.match(js,/function drawCanvasBackdrop\(\)/);
assert.match(js,/ctx\.globalAlpha=alpha\*\.17/,
  'Drawn strokes should have a soft matte understroke');
assert.match(js,/arena\.setAttribute\('data-mode',mode\)/,
  'Mode switch must update instrument-board accent');

// Hard refresh must open Test Games at the top, but ordinary visits and
// explicit hash links must keep the browser's normal scroll behavior.
const scrollScriptMatch=html.match(/<script>\s*\/\* Keep a hard refresh[\s\S]*?<\/script>/);
assert.ok(scrollScriptMatch,'Missing early hard-refresh scroll fix');
const scrollScript=scrollScriptMatch[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
function simulatePageNavigation(type,hash=''){
 const calls=[],windowListeners={},documentListeners={};
 const history={scrollRestoration:'auto'};
 const window={scrollTo:(x,y)=>calls.push([x,y]),
  addEventListener:(name,handler)=>{windowListeners[name]=handler}};
 const document={addEventListener:(name,handler)=>{documentListeners[name]=handler}};
 const performance={getEntriesByType:()=>[{type}]};
 const requestAnimationFrame=callback=>callback();
 new Function('performance','location','history','window','document','requestAnimationFrame',scrollScript)
  (performance,{hash},history,window,document,requestAnimationFrame);
 return {calls,history,windowListeners,documentListeners};
}
const hardReload=simulatePageNavigation('reload');
assert.equal(hardReload.history.scrollRestoration,'manual');
assert.deepEqual(hardReload.calls,[[0,0]]);
hardReload.documentListeners.DOMContentLoaded();
hardReload.windowListeners.load();
hardReload.windowListeners.pageshow();
assert.ok(hardReload.calls.length>=4,'Reload should reset top through load and pageshow');
hardReload.windowListeners.pagehide();
assert.equal(hardReload.history.scrollRestoration,'auto','Restoration resets before leaving');
for(const [type,hash] of [['navigate',''],['back_forward',''],['reload','#precisionPrototype']]){
 const nav=simulatePageNavigation(type,hash);
 assert.equal(nav.history.scrollRestoration,'auto');
 assert.equal(nav.calls.length,0,'Normal page history and hash navigation must not jump to top');
}

const exposed=js.replace(" window.addEventListener('crilo-auth-ready',verify);",
 " window.__apSmoke={route:()=>route.map(p=>({...p})),seed:()=>routeSeed,distanceCenter,targetDistance:()=>targetDistance,phase:()=>phase,replayElapsed:()=>replayElapsed,samples:()=>timeSamples.map(s=>({...s})),attempt:()=>attempt.map(p=>({...p})),targetAt,boostPrecisionScore,scorePath:points=>pathScore(points),scoreStrict:points=>pathScore(points,false)};\n window.addEventListener('crilo-auth-ready',verify);");
assert.notEqual(js,exposed,'Could not expose test-only state');

const lerp=(a,b,t)=>a+(b-a)*t;
function at(points,u){
 const t=Math.max(0,Math.min(1,u))*(points.length-1);
 const i=Math.floor(t),a=points[i],b=points[Math.min(i+1,points.length-1)];
 return {x:lerp(a.x,b.x,t-i),y:lerp(a.y,b.y,t-i)};
}
function motionProgress(u){
 const beats=[0,.22,.48,.74,1],position=[0,.10,.63,.77,1];
 for(let i=0;i<4;i++){
  if(u<=beats[i+1]){
   const f=Math.max(0,Math.min(1,(u-beats[i])/(beats[i+1]-beats[i])));
   const s=f*f*(3-2*f);
   return lerp(position[i],position[i+1],s);
  }
 }
 return 1;
}
async function run(owner){
 const elements=new Map(),frames=new Map(),store=new Map(),events={},windowEvents={};
 const audioNotes=[];let soundClock=10000;
 const strokes=[],dashes=[];
 const canvasContext=new Proxy({strokeStyle:''},{
  get:(obj,name)=>name==='stroke'?()=>strokes.push(obj.strokeStyle):
   name==='setLineDash'?pattern=>dashes.push([...pattern]):
   name in obj?obj[name]:()=>{},
  set:(obj,name,value)=>{obj[name]=value;return true}
 });
 const node=id=>{
  if(elements.has(id))return elements.get(id);
  const el={id,hidden:['testCollection','precisionPrototype','apResult','apMessage','apLiveScore'].includes(id),
   inert:false,disabled:false,textContent:'',value:id==='apMode'?'path':'',width:960,height:560,events:{},
   addEventListener(type,fn){this.events[type]=fn},
   getContext(){return canvasContext},
   getBoundingClientRect(){return {left:0,top:0,width:960,height:560}},
   setAttribute(name,value){this.attributes??={};this.attributes[name]=value},setPointerCapture(){},releasePointerCapture(){},scrollIntoView(){}};
  el.classList={add(){},remove(){},toggle(){}};
  elements.set(id,el);return el;
 };
 const document={hidden:false,getElementById:node,addEventListener(type,fn){events[type]=fn}};
 const window={Crilo:{authResolved:true},devicePixelRatio:1,
  AudioContext:class {
   currentTime=0;state='running';destination={};
   createOscillator(){
    return {frequency:{setValueAtTime(value){this.value=value}},
     type:'sine',connect(){},disconnect(){},
     start(){audioNotes.push({pitch:this.frequency.value,type:this.type})},
     stop(){}};
   }
   createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
    connect(){},disconnect(){}}}
   resume(){return Promise.resolve()}
  },
  addEventListener(type,fn){windowEvents[type]=fn}};
 let nextFrame=0,clock=100,role=owner;
 const requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame};
 const cancelAnimationFrame=id=>frames.delete(id);
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
 const criloDB={auth:{getUser:async()=>({data:{user:{id:'test-owner'}}})},
  from:table=>{
   assert.equal(table,'profiles');
   return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:{id:'test-owner',is_owner:role},error:null
   })})})};
  }};
 const FakeDate={now:()=>soundClock};
 new Function('document','window','criloDB','localStorage','requestAnimationFrame','cancelAnimationFrame','Date',exposed)
  (document,window,criloDB,localStorage,requestAnimationFrame,cancelAnimationFrame,FakeDate);
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(node('testCollection').hidden,!owner);
 if(!owner){
  assert.match(node('testAccess').textContent,/owner account/i);
  assert.equal(node('precisionPrototype').hidden,true);
  assert.equal(frames.size,0);
  return;
 }
 node('testOpenPrecision').events.click();
 assert.equal(node('precisionPrototype').hidden,false);
 assert.equal(node('apArena').attributes?.['data-mode'],'path',
  'Path palette must be selected on game open');
 assert.equal(node('apRetry').textContent,'TRY SAME SHAPE');
 // Compare calibration at low, middle and near-perfect accuracies.
 const boost=window.__apSmoke.boostPrecisionScore;
 for(let i=0;i<=100;i++){
  const score=boost(i);
  assert.ok(score>=i-1e-8&&score<=100,'Score bonus cannot lower a result or exceed 100');
  if(i<100)assert.ok(score<boost(i+1),'Score boost must preserve ranking order');
 }
 assert.equal(boost(0),0);
 assert.equal(boost(100),100);
 assert.ok(boost(48)>63&&boost(48)<65,'Screenshot-like 48% should become about 64%');
 assert.ok(boost(90)>94&&boost(90)<96,'High precision remains clearly rewarded');
 assert.match(js,/mode==='distance'\?clamp\(value,0,100\):boostPrecisionScore\(value\)/,
  'Perfect Distance must retain original distance-only scoring');
 const tick=()=>{
  const entry=frames.entries().next().value;
  assert.ok(entry,'Animation frame missing');
  frames.delete(entry[0]);entry[1](clock);clock+=50;
 };
 const animateFor=seconds=>{
  for(let i=0;i<Math.ceil(seconds/.05)+6&&frames.size;i++)tick();
 };
 const click=id=>node(id).events.click();
 const pointer=(type,x,y,id=1)=>{
  soundClock+=100;
  node('apCanvas').events[type]({
   pointerType:'mouse',button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}
  });
 };
 const start=()=>click('apStart');
 // A trackpad user can reach much farther with a short horizontal stroke.
 assert.equal(node('apReach').value,'1.75','Trackpad drawing reach is enabled by default');
 assert.equal(node('apReachWrap').hidden,false);
 start();animateFor(3.8);
 const reachRoute=window.__apSmoke.route();
 const reachStart=reachRoute[0];
 pointer('pointerdown',reachStart.x,reachStart.y);
 assert.equal(node('apReach').disabled,true,'Reach cannot change in the middle of a stroke');
 pointer('pointermove',reachStart.x+100,reachStart.y+25);
 const amplified=window.__apSmoke.attempt().at(-1);
 assert.ok(Math.abs(amplified.x-(reachStart.x+175))<.01,
  'A 100px horizontal trackpad swipe should move 175px across the game');
 assert.ok(Math.abs(amplified.y-(reachStart.y+25))<.01,
  'Vertical movement must remain 1x for accurate curves');
 pointer('pointerup',reachStart.x+100,reachStart.y+25);
 assert.ok(Math.abs(window.__apSmoke.attempt().at(-1).x-amplified.x)<.01,
  'Releasing must not snap the line back to the physical cursor');
 assert.equal(node('apReach').disabled,false);
 // The far endpoint must be reachable in fewer physical pixels without
 // changing a perfect reproduction's final accuracy.
 click('apRetry');start();animateFor(3.8);
 pointer('pointerdown',reachStart.x,reachStart.y);
 for(let i=1;i<reachRoute.length;i++){
  const p=reachRoute[i];
  pointer('pointermove',reachStart.x+(p.x-reachStart.x)/1.75,p.y);
 }
 pointer('pointerup',reachStart.x+(reachRoute.at(-1).x-reachStart.x)/1.75,reachRoute.at(-1).y);
 assert.ok(parseFloat(node('apResultScore').textContent)>98,
  'Amplified trackpad draw must still earn near 100% when it traces the target');
 // Touch gestures must remain exactly 1x, even with amplified mouse reach.
 click('apRetry');start();animateFor(3.8);
 const touchEvent=(kind,x,y)=>node('apCanvas').events[kind]({
  pointerType:'touch',button:0,pointerId:41,clientX:x,clientY:y,preventDefault(){}
 });
 touchEvent('pointerdown',reachStart.x,reachStart.y);
 touchEvent('pointermove',reachStart.x+100,reachStart.y+30);
 assert.ok(Math.abs(window.__apSmoke.attempt().at(-1).x-(reachStart.x+100))<.01,
  'Touch input must not inherit trackpad sensitivity');
 touchEvent('pointerup',reachStart.x+100,reachStart.y+30);
 node('apReach').value='1';node('apReach').events.change();
 assert.equal(node('apReach').value,'1','Normal reach is selectable');
 assert.equal(store.get('crilo_owner_ap_reach_v1:test-owner'),'1',
  'Cursor reach preference must persist for the owner account');
 // Verify legacy exact-trace scoring in normal 1x mode.
 click('apRetry');start();animateFor(3.8);
 assert.equal(node('apOverlay').hidden,true);
 const reference=window.__apSmoke.route();
 // Calibration: broad but recognizable curves should score meaningfully above
 // the original strict path formula, without awarding an inaccurate scribble.
 const moderate=reference.map((p,i)=>({x:p.x,y:p.y+23*Math.sin(i*.11)}));
 const sloppy=reference.map((p,i)=>({x:p.x,y:p.y+85*Math.sin(i*.11)}));
 const exactScore=window.__apSmoke.scorePath(reference);
 const moderateScore=window.__apSmoke.scorePath(moderate);
 const previousStrict=window.__apSmoke.scoreStrict(moderate);
 assert.ok(exactScore>99.99&&exactScore<=100,'Exact match stays near 100%');
 assert.ok(moderateScore>previousStrict+4,'Recognizable shape must earn a fairer score');
 assert.ok(moderateScore<exactScore-5,'Moderate imprecision must still be penalized');
 assert.ok(window.__apSmoke.scorePath(sloppy)<moderateScore-12,
   'Strong distortions must score well below a recognizable curve');
 assert.ok(window.__apSmoke.scoreStrict(reference)>99.99,
   'Original strict scoring remains available to Perfect Motion');
 assert.equal(node('apLiveScore').hidden,true,'Live score hidden before drawing');
 const beforeSound=audioNotes.length;
 pointer('pointerdown',reference[0].x,reference[0].y);
 assert.equal(node('apLiveScore').hidden,false,'Live score starts with drawing');
 assert.ok(audioNotes.length>=beforeSound+2,'Starting a stroke should play a gentle two-note cue');
 for(let i=1;i<reference.length;i++){
  pointer('pointermove',reference[i].x,reference[i].y);
  if(i===40){
   assert.match(node('apLiveValue').textContent,/\d+\.\d{2}%/,
    'Path accuracy must update on screen while still drawing');
  }
 }
 assert.ok(audioNotes.length>beforeSound+2,'Movement should produce quiet drawing sounds');
 pointer('pointerup',reference.at(-1).x,reference.at(-1).y);
 assert.equal(node('apLiveScore').hidden,true,'Live score hides at completion');
 assert.ok(audioNotes.length>=beforeSound+5,'Finishing should play a completion cue');
 assert.equal(node('apOverlay').hidden,true,'No modal should cover completed drawings');
 assert.equal(node('apResult').hidden,false,'Result controls must be outside canvas');
 const pathScore=parseFloat(node('apResultScore').textContent);
 assert.ok(pathScore>98,'Perfect line should score near 100%, got '+pathScore);
 click('apCompare');
 assert.equal(node('apCompare').textContent,'SHOW BOTH LINES');
 click('apCompare');
 assert.equal(node('apCompare').textContent,'MY LINE ONLY');
 // Mute is a genuine setting: no start, stroke or finish notes when off.
 click('apSound');
 assert.equal(node('apSound').textContent,'SOUND: OFF');
 assert.equal(node('apSound').attributes['aria-pressed'],'false');
 const afterMute=audioNotes.length;
 click('apRetry');start();animateFor(3.8);
 pointer('pointerdown',reference[0].x,reference[0].y);
 for(let i=1;i<reference.length;i+=3)pointer('pointermove',reference[i].x,reference[i].y);
 pointer('pointerup',reference.at(-1).x,reference.at(-1).y);
 assert.equal(audioNotes.length,afterMute,'Muted game must not emit any notes');
 click('apSound');
 assert.equal(node('apSound').textContent,'SOUND: ON');
 assert.equal(node('apSound').attributes['aria-pressed'],'true');
 assert.ok(audioNotes.length>afterMute,'Enabling sound confirms the setting');
 const previousSeed=window.__apSmoke.seed(),previous=JSON.stringify(window.__apSmoke.route());
 click('apRetry');
 assert.equal(window.__apSmoke.seed(),previousSeed,'Try Same Shape must preserve route');
 click('apNew');
 assert.notEqual(window.__apSmoke.seed(),previousSeed,'New Game must reseed');
 assert.notEqual(JSON.stringify(window.__apSmoke.route()),previous,'New Game must generate a different shape');
 start();animateFor(3.8);
 const newPath=window.__apSmoke.route();
 pointer('pointerdown',newPath[0].x,newPath[0].y);
 pointer('pointermove',newPath[0].x+150,newPath[0].y-90);
 pointer('pointerup',newPath.at(-1).x,newPath.at(-1).y);
 assert.ok(parseFloat(node('apResultScore').textContent)<pathScore,
  'A shortcut must score worse than a perfect reproduction');
 // Perfect Distance: visible target before starting, hidden during the run.
 // Distance ignores the reach setting entirely; it measures actual pixels.
 node('apReach').value='2.1';node('apReach').events.change();
 node('apMode').value='distance';node('apMode').events.change();
 assert.equal(node('apReachWrap').hidden,true,'Trackpad drawing reach is hidden in Distance');
 assert.equal(node('apArena').attributes?.['data-mode'],'distance',
  'Distance mode must switch board accent');
 assert.equal(node('apRetry').textContent,'TRY SAME DISTANCE');
 start();
 const center=window.__apSmoke.distanceCenter;
 const radius=window.__apSmoke.targetDistance(),first=center(0);
 assert.ok(radius>=62&&radius<=117,'Distance falls within playable range');
 assert.ok(dashes.some(pattern=>pattern.length>0),'Guide appears before start');
 dashes.length=0;
 pointer('pointerdown',first.x+radius,first.y);
 tick();tick();
 assert.equal(window.__apSmoke.phase(),'active');
 assert.equal(node('apLiveScore').hidden,false,'Live accuracy visible during Distance');
 assert.match(node('apLiveValue').textContent,/%$/,'Distance uses cumulative accuracy');
 assert.ok(!dashes.some(pattern=>pattern.length>0),'Guide must disappear during play');
 let elapsed=.05;
 for(let i=0;i<245&&frames.size;i++){
  const p=center(Math.min(11,elapsed));
  pointer('pointermove',p.x+radius,p.y);tick();elapsed+=.05;
 }
 assert.equal(node('apResult').hidden,false);
 assert.equal(node('apLiveScore').hidden,true,'Live number clears at the result');
 const distanceScore=parseFloat(node('apResultScore').textContent);
 assert.ok(distanceScore>80,'Correct distance should earn a high score '+distanceScore);
 click('apRetry');
 assert.equal(window.__apSmoke.targetDistance(),radius,'Retry preserves target');
 start();pointer('pointerdown',first.x+radius,first.y);
 for(let i=0;i<245&&frames.size;i++)tick();
 assert.ok(parseFloat(node('apResultScore').textContent)<distanceScore,
  'Standing still should score below correct tracking');
 click('apNew');
 const nextRadius=window.__apSmoke.targetDistance();
 assert.ok(Math.abs(nextRadius-radius)>=18,'New Game changes distance noticeably');
 // Perfect Motion compares exact position at a given time.
 node('apMode').value='motion';node('apMode').events.change();
 assert.equal(node('apReachWrap').hidden,false,'Drawing reach applies to Motion too');
 node('apReach').value='1';node('apReach').events.change();
 assert.equal(node('apArena').attributes?.['data-mode'],'motion',
  'Motion mode must switch board accent');
 assert.equal(node('apRetry').textContent,'TRY SAME SHAPE');
 start();animateFor(5.2);
 const motion=window.__apSmoke.route();
 pointer('pointerdown',motion[0].x,motion[0].y);
 let elapsedMotion=0;
 for(let i=0;i<126&&frames.size;i++){
  const p=at(motion,motionProgress(Math.min(1,(elapsedMotion+.05)/5.2)));
  pointer('pointermove',p.x,p.y);tick();elapsedMotion+=.05;
  if(i===22){
   assert.equal(node('apLiveScore').hidden,false,'Motion has live accuracy');
   assert.match(node('apLiveValue').textContent,/%$/);
  }
 }
 assert.equal(node('apLiveScore').hidden,true,'Motion result clears live estimate');
 const motionScore=parseFloat(node('apResultScore').textContent);
 assert.ok(motionScore>50,'A correctly timed motion must score well');
 assert.equal(node('apReplay').hidden,false,'Only Motion exposes replay');
 const scoreBeforeReplay=node('apResultScore').textContent;
 click('apReplay');
 assert.equal(window.__apSmoke.phase(),'replay');
 assert.equal(node('apReplay').textContent,'STOP REPLAY ■');
 strokes.length=0;
 for(let i=0;i<30;i++)tick();
 assert.ok(strokes.includes('#abd8f0'),'Replay draws the blue reference');
 assert.ok(strokes.includes('#f0b67f'),'Replay draws the orange attempt');
 assert.ok(window.__apSmoke.replayElapsed()>0,'Replay advances through time');
 assert.equal(node('apResultScore').textContent,scoreBeforeReplay);
 click('apReplay');
 assert.equal(window.__apSmoke.phase(),'result','Replay can be stopped');
 click('apReplay');animateFor(5.2);
 assert.equal(window.__apSmoke.phase(),'result','Replay ends automatically');
 assert.equal(node('apResultScore').textContent,scoreBeforeReplay);
 // Test forgiving Motion scoring on a moderately imperfect, but recognizable, trace.
 click('apRetry');start();animateFor(5.2);
 pointer('pointerdown',motion[0].x,motion[0].y);
 let driftT=0;
 for(let i=0;i<126&&frames.size;i++){
  const p=at(motion,motionProgress(Math.min(1,(driftT+.05)/5.2)));
  pointer('pointermove',p.x+20*Math.sin(driftT*1.3),p.y+20*Math.sin(driftT));
  tick();driftT+=.05;
 }
 const moderateMotionScore=parseFloat(node('apResultScore').textContent);
 const sample=window.__apSmoke.samples();let oldArea=0;
 for(let i=1;i<sample.length;i++){
  const a=sample[i-1],b=sample[i],dt=b.t-a.t;
  if(dt<=0||b.missing)continue;
  const target=window.__apSmoke.targetAt(motionProgress(b.t/5.2));
  oldArea+=Math.exp(-Math.hypot(b.point.x-target.x,b.point.y-target.y)/103)*dt;
 }
 const oldMotionScore=100*oldArea/5.2*.72+window.__apSmoke.scoreStrict(window.__apSmoke.attempt())*.28;
 assert.ok(moderateMotionScore>oldMotionScore+1,'Forgiving motion should beat old strict score');
 assert.ok(moderateMotionScore<motionScore,'Accurate motion should still score higher');
  click('apRetry');start();animateFor(5.2);
 pointer('pointerdown',motion[0].x,motion[0].y);
 pointer('pointermove',motion.at(-1).x,motion.at(-1).y);
 for(let i=0;i<126&&frames.size;i++)tick();
 assert.ok(parseFloat(node('apResultScore').textContent)<motionScore,
  'Jumping to the endpoint cannot pass motion timing');
 for(const m of ['path','distance','motion'])
  assert.equal([...store.keys()].filter(k=>k.endsWith(':'+m)).length,1,
   'Best score must be stored independently for '+m);
 role=false;
 windowEvents['crilo-auth-ready']();
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(node('testCollection').hidden,true,'Revoking owner role must close playtests');
 return {pathScore,distanceScore,motionScore,moderateMotionScore,oldMotionScore,radius,nextRadius};
}
await run(false);
const result=await run(true);
console.log('PASS: owner access, adjustable trackpad reach, touch 1x, three modes, scores, audio, hidden distance and replay',result);
