/* Offline smoke test for owner-only Test Games.
   Run: node scripts/verify-test-games.mjs
   No live Supabase accounts, records or player data are used. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('test-games.js'),page=read('test-games.html');
const app=read('app.js'),css=read('test-games.css');
new Function(source);
new Function(app);
assert.match(page,/name="robots" content="noindex,nofollow"/);
assert.match(page,/id="testCollection" hidden inert/);
assert.match(page,/id="lightPrototype"[^>]+hidden/);
assert.match(page,/id="llCanvas"/);
assert.match(page,/test-games\.js\?v=1/);
assert.match(app,/Crilo\.profile\?\.id===Crilo\.user\.id&&Crilo\.profile\?\.is_owner===true/);
assert.match(app,/testLink\.textContent='TEST GAMES'/);
assert.match(source,/await criloDB\.auth\.getUser\(\)/);
assert.match(source,/\.select\('id,is_owner'\)\.eq\('id',user\.id\)\.maybeSingle\(\)/);
assert.match(source,/profile\?\.id!==user\.id\|\|profile\.is_owner!==true/);
assert.ok(!source.includes('criloDB.rpc('),'The local prototype must not write to rankings');
assert.match(css,/\.ll-stage\.is-running canvas\{cursor:none\}/);
assert.match(css,/@media\(max-width:540px\)/);

async function browserlessTest(isOwner){
 const elements=new Map(),documentEvents={},windowEvents={},frames=new Map(),store=new Map();
 const noop=()=>{};
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{
  get:(obj,key)=>key in obj?obj[key]:noop,
  set:(obj,key,value)=>{obj[key]=value;return true}
 });
 const element=id=>{
  if(elements.has(id))return elements.get(id);
  const el={
   id,hidden:id==='testCollection'||id==='lightPrototype',inert:false,disabled:false,
   textContent:'',value:id==='llDifficulty'?'standard':'',width:1100,height:640,
   classList:{add(){},remove(){},contains(){return false}},
   events:{},addEventListener(type,fn){this.events[type]=fn},
   setAttribute(){},getContext(){return ctx},
   getBoundingClientRect(){return {left:0,top:0,width:600,height:360}},
   scrollIntoView(){},setPointerCapture(){},releasePointerCapture(){}
  };
  elements.set(id,el);return el;
 };
 const document={hidden:false,getElementById:element,
  addEventListener(type,fn){documentEvents[type]=fn}};
 const window={Crilo:{authResolved:true},devicePixelRatio:1,
  addEventListener(type,fn){windowEvents[type]=fn}};
 let nextFrame=0;
 const requestAnimationFrame=cb=>{frames.set(++nextFrame,cb);return nextFrame};
 const cancelAnimationFrame=id=>frames.delete(id);
 const localStorage={
  getItem:key=>store.get(key)||null,
  setItem:(key,v)=>store.set(key,String(v))
 };
 const criloDB={
  auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})},
  from:name=>{
   assert.equal(name,'profiles');
   return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:{id:'test-user',is_owner:isOwner},error:null
   })})})};
  }
 };
 new Function('document','window','criloDB','localStorage','requestAnimationFrame','cancelAnimationFrame',
  source)(document,window,criloDB,localStorage,requestAnimationFrame,cancelAnimationFrame);
 for(let i=0;i<9;i++)await Promise.resolve();
 assert.equal(element('testCollection').hidden,!isOwner);
 if(!isOwner){
  assert.equal(element('lightPrototype').hidden,true);
  assert.equal(frames.size,0);
  assert.match(element('testAccess').textContent,/owner account/i);
  return;
 }
 element('testOpenLight').events.click();
 assert.equal(element('lightPrototype').hidden,false);
 element('llStart').events.click();
 assert.equal(element('llPrompt').hidden,false);
 element('llCanvas').events.pointerdown({
  pointerType:'mouse',button:0,clientX:300,clientY:180,preventDefault(){}
 });
 assert.equal(element('llPause').disabled,false,'Mouse click inside light starts game');
 for(const now of [100,190,280,370]){
  const next=frames.entries().next().value;
  assert.ok(next,'Running game must request a new animation frame');
  frames.delete(next[0]);next[1](now);
 }
 assert.notEqual(element('llTime').textContent,'00:00.00');
 documentEvents.keydown({key:'Escape',preventDefault(){}});
 assert.equal(element('llOverlayTitle').textContent,'Paused.');
 assert.equal(element('llPause').disabled,true);
 element('llStart').events.click();
 assert.equal(element('llPrompt').hidden,false);
 element('llCanvas').events.pointerdown({
  pointerType:'mouse',button:0,clientX:300,clientY:180,preventDefault(){}
 });
 assert.equal(element('llPause').disabled,false);
 element('llCanvas').events.pointermove({pointerType:'mouse',clientX:0,clientY:0});
 assert.equal(element('llOverlayTitle').textContent,'Light lost.');
 assert.equal(element('llPause').disabled,true);
 assert.ok(store.size>0,'Personal best should stay local to the owner browser');
 element('llReset').events.click();
 assert.equal(element('llTime').textContent,'00:00.00');
 assert.equal(element('llOverlayTitle').textContent,'Keep up with it.');
}
await browserlessTest(false);
await browserlessTest(true);
console.log('PASS: private owner gate, playable mouse tracking, Escape pause, failure boundary, local best, restart.');
