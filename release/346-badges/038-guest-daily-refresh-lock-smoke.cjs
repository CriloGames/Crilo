/* Browser-scoped guest Daily persistence regression (no real users / network).
 * Simulates a reload, second tab, Daily rollover, disabled storage, and
 * a legitimate signed-in account on the same browser.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.resolve(__dirname,'../../game.js'),'utf8');
const key='crilo_guest_daily_v1';
const backing=new Map([['crilo_sound','off']]);
const storage={
 getItem:k=>backing.has(k)?backing.get(k):null,
 setItem:(k,v)=>backing.set(k,String(v))
};
function mount({period='2026-10-10',signedIn=false,owner=false,store=storage}={}){
 const els=new Map(),events={};
 function get(id){
  if(els.has(id))return els.get(id);
  const classes=new Set(['hidden']);
  const classList={
   add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s),
   toggle:(s,on)=>{if(on===undefined)on=!classes.has(s);if(on)classes.add(s);else classes.delete(s);return !!on;}
  };
  const ctx=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(200*200*4)})},
   {get:(target,prop)=>target[prop]||(()=>{})});
  const el={
   id,disabled:false,hidden:false,open:false,value:'',textContent:'',classList,
   dataset:{},style:{},width:200,height:200,innerHTML:'',
   getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test',
   addEventListener:(event,fn)=>{el['on_'+event]=fn;},
   querySelector:()=>get(id+'-child'),querySelectorAll:()=>[],
   setAttribute:()=>{},getBoundingClientRect:()=>({left:0,top:0,bottom:200,width:200,height:200}),
   getClientRects:()=>[]
  };
  els.set(id,el);return el;
 }
 const identity=signedIn?{id:owner?'owner':'account'}:null;
 const profile=identity?{id:identity.id,is_owner:owner,sound_enabled:false}:null;
 const Crilo={dailyPeriod:()=>period,nextReset:()=>new Date(Date.now()+86400000),
  user:identity,profile};
 const document={getElementById:get,querySelectorAll:()=>[],
  querySelector:()=>get('query'),addEventListener:()=>{},
  body:{classList:{add:()=>{},remove:()=>{}},style:{setProperty:()=>{}}},
  documentElement:{clientWidth:900}};
 const window={addEventListener:(event,fn)=>{events[event]=fn;},CriloBadgeEvents:{track:async()=>true}};
 const db={
  auth:{getSession:async()=>({data:{session:identity?{user:identity}:null}})},
  rpc:async name=>{
   if(name==='crilo_my_daily_penalty')return {data:{blocked:false},error:null};
   throw new Error('Unexpected RPC: '+name);
  },
  from:()=>({select(){return this},eq(){return this},
   maybeSingle:async()=>({data:null,error:null})})
 };
 let clock=0;
 const sandbox={window,document,Crilo,criloDB:db,
  DuckWorld:{clear:()=>{},load:async()=>{},spawn:()=>({}),playSound:()=>{}},
  CriloRarity:{classify:()=>({label:'COMMON',color:'common',probability:.5,odds:2,explanation:'test'})},
  localStorage:store,location:{origin:'https://crilo.fun',pathname:'/index.html'},
  console:{log:()=>{},warn:()=>{},error:()=>{}},
  Image:class{},setInterval:()=>0,setTimeout:()=>0,
  performance:{now:()=>clock},Math:Object.assign(Object.create(Math),{random:()=>0}),
  requestAnimationFrame:cb=>{clock+=3200;cb(clock);}
 };
 const ctx=vm.createContext(sandbox);
 vm.runInContext(game,ctx,{filename:'game.js',timeout:2000});
 async function ready(){
  await events['crilo-auth-ready']({detail:{user:identity,profile}});
 }
 return {get,events,ready,spin:()=>get('spinButton').on_click()};
}
(async()=>{
 const unplayed=mount();await unplayed.ready();
 assert.equal(unplayed.get('spinButton').classList.contains('hidden'),false,
  'Unused guest Daily should show spin button');
 assert.equal(backing.has(key),false,'Viewing an unplayed wheel must not consume the Daily');
 const secondTab=mount();await secondTab.ready();
 await unplayed.spin();
 let marker=JSON.parse(backing.get(key));
 assert.equal(marker.period,'2026-10-10');
 assert.equal(marker.status,'started','First guest spin must claim Daily immediately');
 assert.equal(unplayed.get('spins').textContent,4);
 secondTab.events.storage({key});
 assert.equal(secondTab.get('spinButton').classList.contains('hidden'),true,
  'Second open tab should lock after first claims Daily');
 const refreshed=mount();await refreshed.ready();
 assert.equal(refreshed.get('playedPanel').classList.contains('hidden'),false);
 assert.match(refreshed.get('playedText').textContent,/already been started/);
 assert.equal(refreshed.get('spinButton').classList.contains('hidden'),true);
 await refreshed.spin(); // even a synthetic programmatic click must fail closed
 assert.equal(refreshed.get('spins').textContent,5);
 assert.equal(unplayed.get('spins').textContent,4,'Original tab may finish its original run');
 for(let i=0;i<4;i++)await unplayed.spin();
 marker=JSON.parse(backing.get(key));
 assert.equal(marker.status,'complete');
 assert.equal(marker.spins,5);
 assert.equal(marker.score,10);
 const finished=mount();await finished.ready();
 assert.match(finished.get('playedText').textContent,/10 points/);
 assert.equal(finished.get('spinButton').classList.contains('hidden'),true);
 const nextPeriod=mount({period:'2026-10-11'});await nextPeriod.ready();
 assert.equal(nextPeriod.get('spinButton').classList.contains('hidden'),false,
  'Guest should be eligible next Daily period');
 await nextPeriod.spin();
 assert.equal(JSON.parse(backing.get(key)).period,'2026-10-11');
 const signed=mount({signedIn:true});await signed.ready();
 assert.equal(signed.get('spinButton').classList.contains('hidden'),false,
  'Signed-in official Daily uses its own server-side eligibility');
 const owner=mount({signedIn:true,owner:true});await owner.ready();
 assert.equal(owner.get('ownerRunControls').classList.contains('hidden'),false,
  'Owner choice must stay available');
 const brokenStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const denied=mount({store:brokenStorage});await denied.ready();
 assert.match(denied.get('playedText').textContent,/allow this site to save browser data/);
 assert.equal(denied.get('spinButton').classList.contains('hidden'),true,
  'No persistent storage means guest may not play untrackably');
 console.log('PASS: guest viewing alone is free; first spin claims Daily.');
 console.log('PASS: refresh, second tab, and synthetic clicks cannot replay.');
 console.log('PASS: completion remains locked; next period, signed-in and owner unaffected.');
 console.log('PASS: unavailable browser storage fails closed for guests.');
})().catch(error=>{console.error(error);process.exitCode=1;});
