/* Desktop + mobile Chromium multiplayer lobby-to-battle smoke.
 * Mock rooms are deterministic; actual authenticated Edge logic has its own HTTP test. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url),E=require('../five-fronts-core.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const p=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!p.startsWith(root+path.sep))throw Error('Forbidden');
  const data=await readFile(p);
  res.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':
   p.endsWith('.css')?'text/css':'text/html'});
  res.end(data);
 }catch{res.writeHead(404);res.end('Missing')}
});
const rooms=new Map(),codes=new Map();
const copy=x=>structuredClone(x);
function state(room,id){
 const player=room.players.find(p=>p.id===id);
 if(!player)throw Error('Not in room');
 return copy({id:room.id,code:room.code,revision:room.revision,status:room.status,
  capacity:room.capacity,fast:room.fast,meSeat:player.seat,
  isHost:room.players[0].id===id,
  players:room.players.map(p=>({seat:p.seat,name:p.name,connected:true})),game:room.game});
}
function api(id,p){
 if(p.operation==='create'){
  const room={id:crypto.randomUUID(),code:'FRONT'+String(codes.size+2),
   status:'waiting',capacity:p.capacity,fast:p.fast,revision:0,
   players:[{id,seat:0,name:'Host'}],game:null,last:Date.now()};
  rooms.set(room.id,room);codes.set(room.code,room.id);
  return state(room,id);
 }
 if(p.operation==='join'){
  const room=rooms.get(codes.get(p.code));if(!room)throw Error('No room');
  if(!room.players.some(user=>user.id===id)){
   if(room.status!=='waiting'||room.players.length>=room.capacity)throw Error('Room full');
   room.players.push({id,seat:room.players.length,name:'Guest'});
  }
  return state(room,id);
 }
 const room=rooms.get(p.roomId);
 if(!room||!room.players.some(user=>user.id===id))throw Error('Unauthorized');
 if(p.operation==='leave')return {left:true};
 if(p.operation==='start'){
  if(room.players[0].id!==id||room.players.length!==room.capacity)throw Error('Not ready');
  room.game=E.createMatch({countries:room.capacity,online:true,fast:room.fast,seed:8830});
  room.status='playing';room.revision++;
 }
 if(room.status==='playing'&&(p.operation==='sync'||p.operation==='command')){
  const dt=Math.min(5,(Date.now()-room.last)/1000*room.game.speed);
  if(dt>1){E.advance(room.game,dt);room.revision++}
  room.last=Date.now();
 }
 if(p.operation==='command'){
  const seat=room.players.find(x=>x.id===id).seat,a=p.args,g=room.game;
  const result=p.command==='train'?E.train(g,seat,a.stateId):
   p.command==='fortify'?E.fortify(g,seat,a.stateId):
   p.command==='march'?E.march(g,seat,a.from,a.to,a.troops):
   E.applyStrategy(g,seat,a.policy);
  if(!result.ok)throw Error(result.error);
  room.revision++;return {snapshot:state(room,id),result};
 }
 return state(room,id);
}
async function setup(page,id,url){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__ffRpc',request=>api(id,request));
 await page.route('https://cdn.jsdelivr.net/**',r=>
  r.fulfill({status:200,contentType:'text/javascript',body:''}));
 for(const file of ['auth-first-paint.js','header-continuity.js','theme-bridge.js']){
  await page.route('**/'+file+'?*',r=>
   r.fulfill({status:200,contentType:'text/javascript',body:''}));
 }
 await page.route('**/supabase-config.js?*',r=>
  r.fulfill({status:200,contentType:'text/javascript',body:
   "window.criloDB={auth:{getUser:async()=>({data:{user:{id:'"+id+"'}},error:null})},"+
   "functions:{invoke:async(name,req)=>{try{return {data:{ok:true,data:await window.__ffRpc(req.body)},error:null}}"+
   "catch(e){return {data:null,error:{message:e.message}}}}},"+
   "channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:async()=>{}};"
  }));
 await page.route('**/app.js?*',r=>
  r.fulfill({status:200,contentType:'text/javascript',
   body:"window.Crilo={authResolved:true};window.dispatchEvent(new Event('crilo-auth-ready'));"}));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.getElementById('ffGame').hidden,null,{timeout:11000});
 return errors;
}
const port=await new Promise(done=>web.listen(0,'127.0.0.1',()=>done(web.address().port)));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const desktop=await browser.newContext({viewport:{width:1300,height:840}});
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const a=await desktop.newPage(),b=await mobile.newPage();
 const url='http://127.0.0.1:'+port+'/five-fronts-live.html';
 const errorsA=await setup(a,'a',url),errorsB=await setup(b,'b',url);
 await a.locator('#ffCreateRoom').click();
 await a.waitForFunction(()=>document.getElementById('ffInviteCode').textContent.length===6);
 const code=await a.locator('#ffInviteCode').textContent();
 assert.match(code,/^[A-Z2-9]{6}$/);
 await b.locator('#ffRoomCode').fill(code);
 await b.locator('#ffJoinRoom').click();
 await b.waitForFunction(()=>document.getElementById('ffSeats').children.length===2);
 await a.waitForFunction(()=>!document.getElementById('ffStartLive').disabled,null,{timeout:9000});
 await a.locator('#ffStartLive').click();
 await a.waitForFunction(()=>!document.getElementById('ffMatch').hidden);
 await b.waitForFunction(()=>!document.getElementById('ffMatch').hidden,null,{timeout:10000});
 assert.equal(await a.locator('.ff-map-state').count(),10);
 assert.equal(await b.locator('.ff-map-state').count(),10);
 assert.ok((await b.locator('#ffSelectedDescription').textContent()).includes('Your territory'),
  'Guest should start on their own capital');
 const opts=await b.locator('#ffStatePicker option').evaluateAll(all=>
  all.map(o=>({value:o.value,label:o.textContent})));
 const home=opts.find(o=>o.label.includes('(YOU)')&&o.label.includes('Capital'));
 assert.ok(home,'Mobile player has a selectable capital');
 await b.locator('#ffStatePicker').selectOption(home.value);
 const target='.ff-map-state[data-state="'+home.value+'"] .ff-tile-number';
 const initial=Number(await b.locator(target).textContent());
 await b.locator('#ffTrain').click();
 await b.waitForFunction(({selector,n})=>Number(document.querySelector(selector)?.textContent)===n+20,
  {selector:target,n:initial},{timeout:7000});
 await a.waitForFunction(({selector,n})=>Number(document.querySelector(selector)?.textContent)===n+20,
  {selector:target,n:initial},{timeout:12000});
 await b.reload({waitUntil:'domcontentloaded'});
 await b.waitForFunction(()=>!document.getElementById('ffMatch').hidden,null,{timeout:11000});
 assert.ok((await b.locator('#ffSelectedDescription').textContent()).includes('Your territory'),
  'Reconnect must return player to the same country');
 const metrics=await b.evaluate(()=>({scroll:document.documentElement.scrollWidth,
  width:innerWidth,players:document.querySelectorAll('.ff-live-player').length}));
 assert.ok(metrics.scroll<=metrics.width+3,'Mobile viewport overflow '+JSON.stringify(metrics));
 assert.equal(metrics.players,2);
 assert.deepEqual(errorsA,[],'Desktop browser exceptions');
 assert.deepEqual(errorsB,[],'Mobile browser exceptions');
 console.log('PASS Five Fronts desktop+phone browser: invite, lobby, two countries, shared troop action, reconnect and responsive map');
}finally{await browser?.close();await new Promise(ok=>web.close(ok))}
