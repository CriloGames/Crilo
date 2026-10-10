/* Guest Daily resume regression: in-memory browsers, no production writes.
 * node release/346-badges/038-guest-daily-refresh-lock-smoke.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.resolve(__dirname,'../../game.js'),'utf8');
const KEY='crilo_guest_daily_v1';
const DRAWING='data:image/png;base64,'+'a'.repeat(120);
const backing=new Map([['crilo_sound','off']]);
const storage={
 getItem:k=>backing.has(k)?backing.get(k):null,
 setItem:(k,v)=>backing.set(k,String(v))
};
const read=()=>JSON.parse(backing.get(KEY));
const clean=x=>JSON.parse(JSON.stringify(x));
function mount({period='2026-10-10',signedIn=false,owner=false,
 store=storage,random=[0],deferAnimation=false}={}){
 const els=new Map(),events={},queued=[],randoms=[...random];
 let drawnImage=null,spawned=0,clock=0;
 function get(id){
  if(els.has(id))return els.get(id);
  const classes=new Set(['hidden']);
  const classList={
   add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s),
   toggle:(s,on)=>{if(on===undefined)on=!classes.has(s);if(on)classes.add(s);else classes.delete(s);return !!on;}
  };
  const ctx=new Proxy({
   getImageData:()=>({data:new Uint8ClampedArray(200*200*4)}),
   clearRect:()=>{},drawImage:img=>{drawnImage=img.src;}
  },{get:(target,prop)=>target[prop]||(()=>{})});
  const el={
   id,disabled:false,hidden:false,open:false,value:'',textContent:'',classList,
   dataset:{},style:{},width:200,height:200,innerHTML:'',
   getContext:()=>ctx,toDataURL:()=>DRAWING,
   addEventListener:(name,cb)=>{el['on_'+name]=cb;},
   querySelector:()=>get(id+'-child'),querySelectorAll:()=>[],
   setAttribute:()=>{},getAttribute:(key)=>el.attrs?.[key]||null,
   removeAttribute:(key)=>{if(el.attrs)delete el.attrs[key];},
   replaceChildren:(...nodes)=>{el.children=nodes;el.textContent=nodes.map(n=>n.textContent).join('');},
   getBoundingClientRect:()=>({left:0,top:0,bottom:200,width:200,height:200})
  };
  els.set(id,el);return el;
 }
 const identity=signedIn?{id:owner?'owner':'account'}:null;
 const profile=identity?{id:identity.id,is_owner:owner,sound_enabled:false}:null;
 const Crilo={dailyPeriod:()=>period,nextReset:()=>new Date(Date.now()+86400000),user:identity,profile};
 const document={getElementById:get,querySelectorAll:()=>[],querySelector:()=>get('query'),
  createElement:()=>({textContent:'',className:'',style:{setProperty(){}},setAttribute(){}}),
  addEventListener:()=>{},body:{classList:{add:()=>{},remove:()=>{}},style:{setProperty:()=>{}}},
  documentElement:{clientWidth:900}};
 const window={addEventListener:(n,cb)=>{events[n]=cb;},CriloBadgeEvents:{track:async()=>true}};
 const db={
  auth:{getSession:async()=>({data:{session:identity?{user:identity}:null}})},
  rpc:async name=>{
   if(name==='crilo_my_daily_penalty')return{data:{blocked:false},error:null};
   return{data:null,error:{message:'Unexpected signed-in RPC '+name}};
  },
  from:()=>({select(){return this},eq(){return this},
   maybeSingle:async()=>({data:null,error:null})})
 };
 const raf=cb=>{
  if(deferAnimation){queued.push(cb);return;}
  clock+=3200;cb(clock);
 };
 class ImageMock{
  set src(value){this._src=value;if(this.onload)this.onload();}
  get src(){return this._src;}
 }
 const sandbox={window,document,Crilo,criloDB:db,
  DuckWorld:{clear:()=>{},load:async()=>{},spawn:()=>{spawned++;return{};},playSound:()=>{}},
  CriloRarity:{classify:()=>({label:'COMMON',color:'common',probability:.5,odds:2,explanation:'test'})},
  localStorage:store,location:{origin:'https://crilo.fun',pathname:'/index.html'},
  console:{log:()=>{},warn:()=>{},error:()=>{}},
  Image:ImageMock,setInterval:()=>0,setTimeout:()=>0,
  performance:{now:()=>clock},Math:Object.assign(Object.create(Math),
   {random:()=>randoms.length?randoms.shift():0}),
  requestAnimationFrame:raf};
 const ctx=vm.createContext(sandbox);
 vm.runInContext(game,ctx,{filename:'game.js',timeout:2000});
 async function ready(){await events['crilo-auth-ready']({detail:{user:identity,profile}});}
 return {get,events,ready,spin:()=>get('spinButton').on_click(),
  flush:()=>{const tasks=queued.splice(0);deferAnimation=false;for(const cb of tasks){clock+=3200;cb(clock);}},
  get drawnImage(){return drawnImage},get spawned(){return spawned}};
}
(async()=>{
 const first=mount();await first.ready();
 assert.equal(backing.has(KEY),false,'Just opening the wheel never consumes a Daily');
 await first.spin();
 assert.equal(read().status,'started');
 assert.equal(read().version,2);
 assert.equal(read().pending,null);
 assert.equal(read().state.totalSpins,1);
 assert.equal(read().state.spins,4);
 assert.equal(read().state.score,2);
 assert.equal(read().state.drawing,DRAWING);
 assert.equal(read().state.results.length,1);
 const snap=clean(read().state);
 const reloaded=mount();await reloaded.ready();
 assert.equal(reloaded.get('playedPanel').classList.contains('hidden'),true);
 assert.equal(reloaded.get('spinButton').classList.contains('hidden'),false);
 assert.equal(reloaded.get('spins').textContent,4);
 assert.equal(reloaded.get('score').textContent,'2');
 assert.equal(reloaded.get('wheelWrap').classList.contains('locked'),true);
 assert.equal(reloaded.drawnImage,DRAWING);
 assert.deepEqual(clean(read().state.results),snap.results,'Outcome history must be unchanged');
 assert.deepEqual(clean(read().state.segments),snap.segments,'Wheel slices must be unchanged');
 assert.match(reloaded.get('message').textContent,/Welcome back/);
 await reloaded.spin();
 assert.equal(read().state.totalSpins,2);
 assert.equal(read().state.score,4);

 // Refresh after outcome selection but before the wheel animation ends.
 // The old tab must not be able to overwrite the resumed state.
 backing.delete(KEY);
 const interrupted=mount({deferAnimation:true,random:[0,.28,.3,.1,.2,.3,.4,.5,.6]});
 await interrupted.ready();await interrupted.spin();
 assert.equal(read().status,'started');
 assert.equal(read().pending.index,3,'Queued outcome should be upgrade');
 assert.equal(read().state.totalSpins,0,'Snapshot remains pre-spin until committed outcome is applied');
 assert.equal(read().pending.upgradeBases.length,5);
 const chosen=clean(read().pending.upgradeBases);
 const during=mount();await during.ready();
 assert.equal(read().pending,null,'Reload must commit chosen outcome exactly once');
 assert.equal(read().state.totalSpins,1);
 assert.equal(read().state.upgrades,1);
 assert.equal(read().state.multiplier,3);
 assert.equal(read().state.spins,5,'Upgrade refunds the spin');
 assert.deepEqual(clean(read().state.segments.slice(-5).map(x=>x.base)),chosen);
 const stable=JSON.stringify(read());
 interrupted.flush();
 assert.equal(JSON.stringify(read()),stable,'The older tab must not overwrite resumed progress');

 // Special wheel actions and all counters survive a reload unchanged.
 backing.delete(KEY);
 const specials=mount({random:[0,.1,0,.88,0,.53,0,.29,0,0,.1,.2,.3,.4]});
 await specials.ready();
 for(let i=0;i<4;i++)await specials.spin();
 const withSpecials=clean(read().state);
 assert.equal(withSpecials.ducks,1);
 assert.equal(withSpecials.doubles,1);
 assert.equal(withSpecials.upgrades,1);
 assert.equal(withSpecials.extraSpins,2);
 assert.equal(withSpecials.multiplier,3);
 assert.equal(withSpecials.spins,6);
 assert.deepEqual(withSpecials.results.map(r=>r.type),['duck','double','spins','upgrade']);
 const specialReload=mount();await specialReload.ready();
 assert.equal(specialReload.get('spins').textContent,6);
 assert.equal(specialReload.get('level').textContent,'×3');
 assert.equal(specialReload.get('duckCount').textContent,1);
 assert.equal(specialReload.spawned,1,'Restored ducks must visibly reappear');
 assert.deepEqual(clean(read().state),withSpecials,'No special-run mutation during restore');

 // Finished runs still lock, while the next period has a new guest Daily.
 backing.delete(KEY);
 const finishing=mount();await finishing.ready();
 for(let i=0;i<5;i++)await finishing.spin();
 assert.equal(read().status,'complete');
 assert.equal(read().score,10);
 const completed=mount();await completed.ready();
 assert.equal(completed.get('spinButton').classList.contains('hidden'),true);
 assert.match(completed.get('playedText').textContent,/10 points/);
 const next=mount({period:'2026-10-11'});await next.ready();
 assert.equal(next.get('spinButton').classList.contains('hidden'),false);
 await next.spin();
 assert.equal(read().period,'2026-10-11');

 // Signed-in official and owner test selection must ignore guest browser saves.
 const signed=mount({signedIn:true});await signed.ready();
 assert.equal(signed.get('spinButton').classList.contains('hidden'),false);
 const owner=mount({signedIn:true,owner:true});await owner.ready();
 assert.equal(owner.get('ownerRunControls').classList.contains('hidden'),false);

 // Unrestorable legacy attempts and blocked storage fail CLOSED.
 backing.set(KEY,JSON.stringify({period:'2026-10-10',status:'started'}));
 const legacy=mount();await legacy.ready();
 assert.equal(legacy.get('spinButton').classList.contains('hidden'),true);
 assert.match(legacy.get('playedText').textContent,/cannot be restored/);
 const denied=mount({store:{getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}}});
 await denied.ready();
 assert.equal(denied.get('spinButton').classList.contains('hidden'),true);
 assert.match(denied.get('playedText').textContent,/Allow this site/);

 console.log('PASS: guest spin, artwork, entire wheel and counters restored unchanged.');
 console.log('PASS: mid-animation pending upgrade is committed once without reroll.');
 console.log('PASS: stale tab cannot overwrite; completed run and next period correct.');
 console.log('PASS: owner/sign-in isolated, legacy and broken-storage fail closed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
