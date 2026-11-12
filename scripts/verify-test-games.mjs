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
assert.match(html,/test-games\.js\?v=4/);
assert.match(html,/test-games\.css\?v=4/);
assert.ok(!html.includes('id="apRound"'),'Numbered levels must not appear');
for(const mode of ['path','distance','motion'])assert.ok(html.includes('<option value="'+mode+'">'));
assert.match(html,/id="apNew">NEW GAME/);
assert.match(js,/await criloDB\.auth\.getUser\(\)/);
assert.match(js,/\.select\('id,is_owner'\)\.eq\('id',userId\)\.maybeSingle\(\)/);
assert.match(js,/profile\?\.id!==userId\|\|profile\.is_owner!==true/);
assert.ok(!js.includes('criloDB.rpc('),'No public scoreboard or Daily writes');
assert.match(app,/testLink\.textContent='TEST GAMES'/);
assert.match(css,/#apResult\[hidden\]/);
assert.match(css,/@media\(max-width:520px\)/);

const exposed=js.replace(" window.addEventListener('crilo-auth-ready',verify);",
 " window.__apSmoke={route:()=>route.map(p=>({...p})),seed:()=>routeSeed,distanceCenter};\n window.addEventListener('crilo-auth-ready',verify);");
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
 const canvasContext=new Proxy({},{get:()=>()=>{},set:()=>true});
 const node=id=>{
  if(elements.has(id))return elements.get(id);
  const el={id,hidden:['testCollection','precisionPrototype','apResult','apMessage'].includes(id),
   inert:false,disabled:false,textContent:'',value:id==='apMode'?'path':'',width:960,height:560,events:{},
   addEventListener(type,fn){this.events[type]=fn},
   getContext(){return canvasContext},
   getBoundingClientRect(){return {left:0,top:0,width:960,height:560}},
   setAttribute(){},setPointerCapture(){},releasePointerCapture(){},scrollIntoView(){}};
  el.classList={add(){},remove(){},toggle(){}};
  elements.set(id,el);return el;
 };
 const document={hidden:false,getElementById:node,addEventListener(type,fn){events[type]=fn}};
 const window={Crilo:{authResolved:true},devicePixelRatio:1,
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
 new Function('document','window','criloDB','localStorage','requestAnimationFrame','cancelAnimationFrame',exposed)
  (document,window,criloDB,localStorage,requestAnimationFrame,cancelAnimationFrame);
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
 const tick=()=>{
  const entry=frames.entries().next().value;
  assert.ok(entry,'Animation frame missing');
  frames.delete(entry[0]);entry[1](clock);clock+=50;
 };
 const animateFor=seconds=>{
  for(let i=0;i<Math.ceil(seconds/.05)+6&&frames.size;i++)tick();
 };
 const click=id=>node(id).events.click();
 const pointer=(type,x,y,id=1)=>node('apCanvas').events[type]({
  pointerType:'mouse',button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}
 });
 const start=()=>click('apStart');
 // Draw the generated target perfectly and verify that the result cannot hide it.
 start();animateFor(3.8);
 assert.equal(node('apOverlay').hidden,true);
 const reference=window.__apSmoke.route();
 pointer('pointerdown',reference[0].x,reference[0].y);
 for(let i=1;i<reference.length;i++)pointer('pointermove',reference[i].x,reference[i].y);
 pointer('pointerup',reference.at(-1).x,reference.at(-1).y);
 assert.equal(node('apOverlay').hidden,true,'No modal should cover completed drawings');
 assert.equal(node('apResult').hidden,false,'Result controls must be outside canvas');
 const pathScore=parseFloat(node('apResultScore').textContent);
 assert.ok(pathScore>98,'Perfect line should score near 100%, got '+pathScore);
 click('apCompare');
 assert.equal(node('apCompare').textContent,'SHOW BOTH LINES');
 click('apCompare');
 assert.equal(node('apCompare').textContent,'MY LINE ONLY');
 const previousSeed=window.__apSmoke.seed(),previous=JSON.stringify(window.__apSmoke.route());
 click('apRetry');
 assert.equal(window.__apSmoke.seed(),previousSeed,'Try Same Shape must preserve route');
 click('apNew');
 assert.notEqual(window.__apSmoke.seed(),previousSeed,'New Game must reseed');
 assert.notEqual(JSON.stringify(window.__apSmoke.route()),previous,'New Game must generate a different shape');
 assert.equal(node('apShape').textContent,'RANDOM');
 start();animateFor(3.8);
 const newPath=window.__apSmoke.route();
 pointer('pointerdown',newPath[0].x,newPath[0].y);
 pointer('pointermove',newPath[0].x+150,newPath[0].y-90);
 pointer('pointerup',newPath.at(-1).x,newPath.at(-1).y);
 assert.ok(parseFloat(node('apResultScore').textContent)<pathScore,
  'A shortcut must score worse than a perfect reproduction');
 // Perfect Distance maintains a randomized movement pattern across New Game.
 node('apMode').value='distance';node('apMode').events.change();
 assert.match(node('apHowTitle').textContent,/Distance/);
 start();
 const center=window.__apSmoke.distanceCenter;
 const first=center(0);
 pointer('pointerdown',first.x+82,first.y);
 let elapsed=0;
 for(let i=0;i<245&&frames.size;i++){
  const p=center(Math.min(11,elapsed));
  pointer('pointermove',p.x+82,p.y);tick();elapsed+=.05;
 }
 assert.equal(node('apResult').hidden,false);
 const distanceScore=parseFloat(node('apResultScore').textContent);
 assert.ok(distanceScore>80,'Correct distance should earn a high score '+distanceScore);
 click('apRetry');start();
 pointer('pointerdown',first.x+82,first.y);
 for(let i=0;i<245&&frames.size;i++)tick();
 assert.ok(parseFloat(node('apResultScore').textContent)<distanceScore,
  'Standing still should score below accurate tracking');
 // Perfect Motion compares exact position at a given time.
 node('apMode').value='motion';node('apMode').events.change();
 start();animateFor(5.2);
 const motion=window.__apSmoke.route();
 pointer('pointerdown',motion[0].x,motion[0].y);
 let elapsedMotion=0;
 for(let i=0;i<126&&frames.size;i++){
  const p=at(motion,motionProgress(Math.min(1,(elapsedMotion+.05)/5.2)));
  pointer('pointermove',p.x,p.y);tick();elapsedMotion+=.05;
 }
 const motionScore=parseFloat(node('apResultScore').textContent);
 assert.ok(motionScore>50,'A correctly timed motion must score well');
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
 return {pathScore,distanceScore,motionScore};
}
await run(false);
const result=await run(true);
console.log('PASS: owner gate, 3 modes, random New Game, visible full drawing, replay, scored timing and local bests',result);
