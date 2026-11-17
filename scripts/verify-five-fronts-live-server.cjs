/* Full offline integration: two real human HTTP identities talking to the
 * unchanged Edge handler, with a stateful PostgREST and atomic CAS mock.
 * Run: node scripts/verify-five-fronts-live-server.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
const E=require('../five-fronts-core.js');
const entry=read('supabase/functions/five-fronts-live/index.js');
const ids={
 a:'11111111-1111-4111-8111-111111111111',
 b:'22222222-2222-4222-8222-222222222222',
 c:'33333333-3333-4333-8333-333333333333',
 d:'44444444-4444-4444-8444-444444444444'
};
const state={ff_live_rooms:[],ff_live_players:[],profiles:[
 {id:ids.a,username:'Host'},{id:ids.b,username:'Visitor'},
 {id:ids.c,username:'Third'},{id:ids.d,username:'Banned'}
],crilo_banned_accounts:[{user_id:ids.d}]};
let clock=Date.now();
class Clock extends Date{
 constructor(...args){super(...(args.length?args:[clock]))}
 static now(){return clock}
}
class Query{
 constructor(table){
  this.table=table;this.action='read';this.filters=[];this.orderKey='';
  this.patch=null;this.fields='*';
 }
 select(fields){this.fields=fields;return this}
 eq(key,value){this.filters.push([key,value]);return this}
 order(key){this.orderKey=key;return this}
 insert(value){this.action='insert';this.patch=structuredClone(value);return this}
 update(value){this.action='update';this.patch=structuredClone(value);return this}
 delete(){this.action='delete';return this}
 then(ok,fail){return Promise.resolve(this.run('array')).then(ok,fail)}
 maybeSingle(){return Promise.resolve(this.run('maybe'))}
 single(){return Promise.resolve(this.run('single'))}
 run(mode){
  const rows=state[this.table];
  assert.ok(rows,'Unexpected table '+this.table);
  let candidates=rows.filter(r=>this.filters.every(([k,v])=>r[k]===v));
  if(this.action==='insert'){
   const row={...this.patch};
   if(this.table==='ff_live_rooms'){
    if(rows.some(r=>r.code===row.code))
     return {data:null,error:{code:'23505',message:'Duplicate invite'}};
    Object.assign(row,{id:crypto.randomUUID(),game:null,revision:0,
     tick_at:new Clock().toISOString(),created_at:new Clock().toISOString(),
     updated_at:new Clock().toISOString()});
   }else if(this.table==='ff_live_players'){
    if(rows.some(p=>p.room_id===row.room_id&&
      (p.user_id===row.user_id||p.seat===row.seat)))
     return {data:null,error:{code:'23505',message:'Seat occupied'}};
    Object.assign(row,{joined_at:new Clock().toISOString(),last_seen:new Clock().toISOString()});
   }
   rows.push(row);candidates=[row];
  }else if(this.action==='update'){
   for(const row of candidates)Object.assign(row,structuredClone(this.patch));
  }else if(this.action==='delete'){
   for(const row of candidates){
    const i=rows.indexOf(row);if(i>=0)rows.splice(i,1);
   }
  }
  if(this.orderKey)candidates.sort((a,b)=>a[this.orderKey]>b[this.orderKey]?1:-1);
  const allowed=this.fields==='*'?null:this.fields.split(',').map(s=>s.trim());
  const output=candidates.map(row=>{
   const full=structuredClone(row);
   return allowed?Object.fromEntries(allowed.map(key=>[key,full[key]])):full;
  });
  if(mode==='single')return output.length===1?{data:output[0],error:null}:
   {data:null,error:{message:'Not one row'}};
  if(mode==='maybe')return {data:output[0]||null,error:null};
  return {data:output,error:null};
 }
}
const admin={
 from:table=>new Query(table),
 auth:{getUser:async token=>({
  data:{user:ids[token]?{id:ids[token]}:null},error:ids[token]?null:{message:'Invalid token'}
 })}
};
let handler=null;
const Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.supabase.co':
 key==='SUPABASE_SERVICE_ROLE_KEY'?'test-secret':null},
 serve:fn=>{handler=fn}};
const src=entry.replace(/^import .*?;\s*$/gm,'');
new Function('Deno','createClient','E','crypto','Date',
 'Request','Response','structuredClone','console',src)(
 Deno,()=>admin,E,crypto.webcrypto,Clock,Request,Response,structuredClone,console);
assert.equal(typeof handler,'function','Edge HTTP server did not initialize');

async function call(person,payload,origin='https://crilo.fun'){
 const request=new Request('https://test.supabase.co/functions/v1/five-fronts-live',{
  method:'POST',headers:{'Origin':origin,'Content-Type':'application/json',
   ...(person?{Authorization:'Bearer '+person}:{})},
  body:JSON.stringify(payload)
 });
 const res=await handler(request),json=await res.json();
 return {status:res.status,...json};
}
function requireSuccess(result,label){assert.equal(result.status,200,label+' '+JSON.stringify(result));return result.data}
const run=async()=>{
 assert.equal((await call(null,{operation:'create',capacity:2})).status,401);
 assert.equal((await call('d',{operation:'create',capacity:2})).status,403,
  'Site-banned users must be blocked');
 assert.equal((await call('a',{operation:'create',capacity:7})).status,400);
 assert.equal((await call('a',{operation:'create',capacity:2},'https://evil.invalid')).status,403);
 const host=requireSuccess(await call('a',{operation:'create',capacity:2,fast:true}),'create');
 assert.equal(host.meSeat,0);assert.equal(host.status,'waiting');
 assert.match(host.code,/^[A-Z2-9]{6}$/);
 assert.equal((await call('b',{operation:'sync',roomId:host.id})).status,403,
  'People outside the room cannot inspect its world state');
 const guest=requireSuccess(await call('b',{operation:'join',code:host.code}),'join');
 assert.equal(guest.meSeat,1);assert.equal(guest.players.length,2);
 assert.equal((await call('c',{operation:'join',code:host.code})).status,400);
 assert.equal((await call('b',{operation:'start',roomId:host.id})).status,403);
 const started=requireSuccess(await call('a',{operation:'start',roomId:host.id}),'start');
 assert.equal(started.status,'playing');assert.equal(started.game.online,true);
 assert.equal(started.game.countries.length,2);
 // A busy match must not freeze the clock just because somebody issues an
 // order every 150ms. A no-tick command must preserve the last tick anchor.
 const hostState=started.game.states.find(s=>s.owner===0&&s.capital);
 for(let repeat=0;repeat<3;repeat++){
  clock+=150;
  requireSuccess(await call('a',{operation:'command',roomId:host.id,
   command:'train',args:{stateId:hostState.id},requestId:crypto.randomUUID()}),
   'busy live clock '+repeat);
 }
 const movingTime=requireSuccess(await call('a',{operation:'sync',roomId:host.id}),
  'live clock after rapid commands').game.time;
 assert.ok(movingTime>=2,'The server clock must continue ticking during frequent actions');
 const own=started.game.states.find(s=>s.owner===1&&s.capital);
 const other=started.game.states.find(s=>s.owner===0&&s.capital);
 assert.equal((await call('b',{operation:'command',roomId:host.id,
  command:'train',args:{stateId:other.id},requestId:crypto.randomUUID()})).status,400,
  'Players must never recruit in their opponent’s territory');
 const trained=requireSuccess(await call('b',{operation:'command',roomId:host.id,
  command:'train',args:{stateId:own.id},requestId:crypto.randomUUID()}),'recruit');
 assert.equal(trained.result.ok,true);
 assert.equal(trained.snapshot.game.states[own.id].troops,own.troops+20);
 const revision=trained.snapshot.revision;
 const reqId=crypto.randomUUID();
 requireSuccess(await call('b',{operation:'command',roomId:host.id,
  command:'fortify',args:{stateId:own.id},requestId:reqId}),'fortify');
 const duplicate=requireSuccess(await call('b',{operation:'command',roomId:host.id,
  command:'fortify',args:{stateId:own.id},requestId:reqId}),'deduplicate');
 assert.equal(duplicate.result.duplicate,true);
 const after=requireSuccess(await call('a',{operation:'sync',roomId:host.id}),'sync');
 assert.ok(after.revision>revision);
 assert.equal(after.game.states[own.id].fort,1,'A retry must not double-fortify');
 assert.equal((await call('b',{operation:'command',roomId:host.id,
  command:'march',args:{from:own.id,to:29,troops:20},requestId:crypto.randomUUID()})).status,400,
  'Nonadjacent troop teleportation is forbidden');
 const reconnect=requireSuccess(await call('b',{operation:'join',code:host.code}),'reconnect');
 assert.equal(reconnect.meSeat,1);assert.equal(reconnect.players.length,2);
 assert.equal((await call('c',{operation:'join',code:host.code})).status,400);
 clock+=65000;
 const council=requireSuccess(await call('b',{operation:'sync',roomId:host.id}),'game clock');
 assert.ok(council.game.time>=300,'The 5× server timer must advance the war clock');
 assert.ok(council.game.pendingStrategies[0]&&council.game.pendingStrategies[1],
  'Both real people should have independently offered policies');
 const key=council.game.pendingStrategies[1].options[0];
 const policy=requireSuccess(await call('b',{operation:'command',roomId:host.id,
  command:'policy',args:{policy:key},requestId:crypto.randomUUID()}),'policy');
 assert.equal(policy.snapshot.game.pendingStrategies[1],undefined);
 assert.ok(policy.snapshot.game.pendingStrategies[0],
  'Choosing your own policy cannot resolve another person’s council');
 // Both sides can act concurrently after their councils are resolved.
 const first=policy.snapshot.game.pendingStrategies[0].options[0];
 requireSuccess(await call('a',{operation:'command',roomId:host.id,
  command:'policy',args:{policy:first},requestId:crypto.randomUUID()}),'other policy');
 const commands=await Promise.all([
  call('a',{operation:'command',roomId:host.id,command:'fortify',
   args:{stateId:other.id},requestId:crypto.randomUUID()}),
  call('b',{operation:'command',roomId:host.id,command:'train',
   args:{stateId:own.id},requestId:crypto.randomUUID()})
 ]);
 for(const result of commands)requireSuccess(result,'simultaneous action');
 assert.equal((await call('c',{operation:'sync',roomId:host.id})).status,403);
 clock+=400000;
 const finished=requireSuccess(await call('a',{operation:'sync',roomId:host.id}),'ending');
 assert.equal(finished.status,'finished');
 assert.equal(finished.game.ended,true);
 assert.ok(Number.isInteger(finished.game.winner));
 assert.equal((await call('b',{operation:'command',roomId:host.id,
  command:'train',args:{stateId:own.id},requestId:crypto.randomUUID()})).status,200,
  'Finished rooms return a read-only snapshot and ignore orders');
 const returner=requireSuccess(await call('b',{operation:'join',code:host.code}),'finished reconnect');
 assert.equal(returner.meSeat,1);
 assert.equal(state.ff_live_rooms.length,1,'No duplicate rooms');
 assert.equal(state.ff_live_players.length,2,'Two members, no duplicate seat joins');
 console.log('PASS server HTTP: auth, bans, private code, capacity, start, 2 seats, 403 invalid orders, idempotent actions, 5× clock, simultaneous writes, independent policies, reconnect and finish');
};
run().catch(err=>{console.error(err);process.exitCode=1});
