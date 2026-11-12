/* Browser-independent tests for Almost Perfect (owner-only playtest).
   Run with Node 20+: node scripts/verify-test-games.mjs
   No Supabase requests or public stats are made. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('test-games.js'),html=read('test-games.html'),css=read('test-games.css');
const app=read('app.js');
new Function(js);new Function(app);
assert.match(html,/name="robots" content="noindex,nofollow"/);
assert.match(html,/id="testCollection" hidden inert/);
assert.match(html,/id="precisionPrototype"[^>]+hidden/);
assert.match(html,/test-games\.js\?v=3/);
assert.match(html,/test-games\.css\?v=3/);
for(const value of ['path','distance','motion'])assert.ok(html.includes('<option value="'+value+'">'));
assert.match(js,/await criloDB\.auth\.getUser\(\)/);
assert.match(js,/\.select\('id,is_owner'\)\.eq\('id',userId\)\.maybeSingle\(\)/);
assert.match(js,/profile\?\.id!==userId\|\|profile\.is_owner!==true/);
assert.ok(!js.includes('criloDB.rpc('),'No API writes to public scores');
assert.match(app,/testLink\.textContent='TEST GAMES'/);
assert.match(css,/@media\(max-width:520px\)/);

function targetPoints(mode,round=1){
 const out=[],type=(round-1)%5,tilt=(round*.63)%6.28;
 for(let i=0;i<=240;i++){
  const u=i/240,t=u*Math.PI*2;
  let x=125+710*u,y=280;
  if(type===0)y+=92*Math.sin(t+tilt*.15)+42*Math.sin(2*t+.6);
  if(type===1)y+=112*Math.sin(1.5*t+.3)+28*Math.cos(3*t+.4);
  if(type===2){x+=29*Math.sin(t*3);y+=119*Math.cos(t*1.25+.35)}
  if(type===3)y+=95*Math.sin(2.35*t+.15)+30*Math.cos(t*4+.7);
  if(type===4){x+=36*Math.sin(2*t+.4);y+=115*Math.sin(t*1.8+.2)}
  if(mode==='motion')y=280+(y-280)*.78+23*Math.sin(3.5*t+tilt*.18);
  out.push({x:Math.max(90,Math.min(870,x)),y:Math.max(82,Math.min(478,y))});
 }
 return out;
}
function motionProgress(u){
 const beats=[0,.22,.48,.74,1],pos=[0,.10,.63,.77,1];
 const smooth=x=>x*x*(3-2*x);
 for(let i=0;i<4;i++)if(u<=beats[i+1]){
  const v=Math.max(0,Math.min(1,(u-beats[i])/(beats[i+1]-beats[i])));
  return pos[i]+(pos[i+1]-pos[i])*smooth(v);
 }
 return 1;
}
function routeAt(points,u){
 const i=Math.max(0,Math.min(1,u))*(points.length-1),n=Math.floor(i);
 const a=points[n],b=points[Math.min(n+1,points.length-1)],mix=i-n;
 return {x:a.x+(b.x-a.x)*mix,y:a.y+(b.y-a.y)*mix};
}
async function exercise(owner){
 const elements=new Map(),timers=new Map(),store=new Map(),docEvents={},windowEvents={};
 const noop=()=>{};
 const ctx=new Proxy({}, {get:(_,name)=>name==='createRadialGradient'?()=>({addColorStop(){}}):noop,set:()=>true});
 const node=id=>{
  if(elements.has(id))return elements.get(id);
  const el={
   id,hidden:['testCollection','precisionPrototype','apMessage'].includes(id),
   inert:false,disabled:false,textContent:'',value:id==='apMode'?'path':'',
   width:960,height:560,classNames:new Set(),events:{},
   setAttribute(){},getContext(){return ctx},scrollIntoView(){},
   setPointerCapture(){},releasePointerCapture(){},
   getBoundingClientRect(){return {left:0,top:0,width:960,height:560}},
   addEventListener(kind,fn){this.events[kind]=fn}
  };
  el.classList={add:v=>el.classNames.add(v),remove:v=>el.classNames.delete(v),
   toggle:(v,on)=>on?el.classNames.add(v):el.classNames.delete(v)};
  elements.set(id,el);return el;
 };
 const document={hidden:false,getElementById:node,
  addEventListener:(kind,fn)=>{docEvents[kind]=fn}};
 const window={Crilo:{authResolved:true},devicePixelRatio:1,
  addEventListener:(kind,fn)=>{windowEvents[kind]=fn}};
 const requestAnimationFrame=fn=>{const id=timers.size+1;timers.set(id,fn);return id};
 const cancelAnimationFrame=id=>timers.delete(id);
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
 let queried=0,roleAllowed=owner;
 const criloDB={auth:{getUser:async()=>({data:{user:{id:'owner-test-user'}}})},
  from:table=>{
   assert.equal(table,'profiles');queried++;
   return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:{id:'owner-test-user',is_owner:roleAllowed},error:null
   })})})};
  }
 };
 new Function('document','window','criloDB','localStorage','requestAnimationFrame','cancelAnimationFrame',js)
  (document,window,criloDB,localStorage,requestAnimationFrame,cancelAnimationFrame);
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.ok(queried>0,'Owner must be verified from profiles');
 assert.equal(node('testCollection').hidden,!owner);
 if(!owner){
  assert.equal(node('precisionPrototype').hidden,true);
  assert.match(node('testAccess').textContent,/owner account/);
  return;
 }
 node('testOpenPrecision').events.click();
 assert.equal(node('precisionPrototype').hidden,false);
 let now=100;
 const tick=()=>{
  const entry=timers.entries().next().value;
  assert.ok(entry,'Expected a scheduled game animation');
  timers.delete(entry[0]);entry[1](now);
  now+=50;
 };
 const start=()=>node('apStart').events.click();
 const pointer=(event,x,y,id=1)=>node('apCanvas').events[event]({
  pointerType:'mouse',button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){}
 });
 const playPreview=duration=>{
  // 50ms frame clamp; one first frame has zero delta.
  for(let i=0;i<Math.ceil(duration/.05)+6&&timers.size;i++)tick();
 };
 start();playPreview(3.8);
 assert.equal(node('apOverlay').hidden,true);
 const path=targetPoints('path');
 pointer('pointerdown',path[0].x,path[0].y);
 for(let i=1;i<path.length;i++)pointer('pointermove',path[i].x,path[i].y);
 pointer('pointerup',path.at(-1).x,path.at(-1).y);
 assert.match(node('apOverlayTitle').textContent,/%$/);
 const scorePath=parseFloat(node('apLast').textContent);
 assert.ok(scorePath>98,'Perfect trace should score above 98%: '+scorePath);
 assert.ok(store.size>0,'Local record expected');
 // Retry the same route, and verify a separate "new challenge" increments.
 start();
 assert.equal(node('apOverlay').hidden,true);
 node('apNew').events.click();
 assert.equal(node('apRound').textContent,'02');
 // An obviously inaccurate straight-line shortcut must score below a careful trace.
 start();playPreview(3.8);
 const second=targetPoints('path',2);
 pointer('pointerdown',second[0].x,second[0].y);
 pointer('pointermove',second[0].x+120,second[0].y-90);
 pointer('pointerup',second.at(-1).x,second.at(-1).y);
 assert.ok(parseFloat(node('apLast').textContent)<scorePath,
  'A short inaccurate path must not beat a perfect one');

 node('apMode').value='distance';node('apMode').events.change();
 assert.match(node('apHowTitle').textContent,/Distance/);
 start();
 assert.equal(node('apOverlay').hidden,true);
 const center=t=>({x:480+169*Math.sin(.68*t)+42*Math.sin(1.47*t),
  y:280+99*Math.cos(.77*t)+31*Math.sin(1.17*t)});
 pointer('pointerdown',562,379);
 // Track the ring with near-perfect precision.
 let elapsed=0;
 for(let i=0;i<242&&timers.size;i++){
  const pt=center(Math.min(11,elapsed));
  pointer('pointermove',pt.x+82,pt.y);
  tick();
  elapsed=Math.min(11,elapsed+.05);
 }
 assert.match(node('apOverlayTitle').textContent,/%$/);
 const distanceScore=parseFloat(node('apLast').textContent);
 assert.ok(distanceScore>85,'Keeping distance should earn strong score: '+distanceScore);
 start();pointer('pointerdown',562,379);
 for(let i=0;i<242&&timers.size;i++)tick();
 assert.ok(parseFloat(node('apLast').textContent)<distanceScore,
  'Standing still must not earn a perfect moving-distance score');

 node('apMode').value='motion';node('apMode').events.change();
 assert.match(node('apHowTitle').textContent,/Motion/);
 start();playPreview(5.2);
 const motion=targetPoints('motion');
 pointer('pointerdown',motion[0].x,motion[0].y);
 let time=0;
 for(let i=0;i<120&&timers.size;i++){
  const p=routeAt(motion,motionProgress(Math.min(1,(time+.05)/5.2)));
  pointer('pointermove',p.x,p.y);tick();time+=.05;
 }
 assert.match(node('apOverlayTitle').textContent,/%$/);
 const motionScore=parseFloat(node('apLast').textContent);
 assert.ok(motionScore>50,'Motion timing should be graded');
 // Jumping immediately to the endpoint cannot imitate the ghost's timing.
 start();playPreview(5.2);
 pointer('pointerdown',motion[0].x,motion[0].y);
 pointer('pointermove',motion.at(-1).x,motion.at(-1).y);
 for(let i=0;i<122&&timers.size;i++)tick();
 assert.ok(parseFloat(node('apLast').textContent)<motionScore,
  'Instantly skipping to the end must lose motion-timing accuracy');
 const numKeys=[...store.keys()];
 assert.equal(numKeys.filter(k=>k.includes(':path')).length,1);
 assert.equal(numKeys.filter(k=>k.includes(':distance')).length,1);
 assert.equal(numKeys.filter(k=>k.includes(':motion')).length,1);
 // A lost owner role or sign-out must hide the entire collection on next auth refresh.
 roleAllowed=false;
 window.Crilo.authResolved=false;
 windowEvents['crilo-auth-ready']();
 for(let i=0;i<7;i++)await Promise.resolve();
 assert.equal(node('testCollection').hidden,true,
  'Revoking the owner role must immediately hide the playtest area');
 return {scorePath,distanceScore,motionScore};
}
await exercise(false);
const scores=await exercise(true);
console.log('PASS: owner-only catalog, dropdown, precision Path/Distance/Motion, repeat and new challenge, local mode scores',scores);
