/* Server-authoritative guest Daily, refresh and claim smoke test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=fs.readFileSync('game.js','utf8');
const KEY='crilo_guest_daily_v1',TOKEN='a'.repeat(64);
const storage=new Map([['crilo_sound','off']]);
const localStorage={
 getItem:k=>storage.has(k)?storage.get(k):null,
 setItem:(k,v)=>storage.set(k,String(v)),
 removeItem:k=>storage.delete(k)
};
const segments=[
 {type:'num',base:2},{type:'duck'},{type:'num',base:1},{type:'upgrade'},
 {type:'num',base:3},{type:'num',base:1},{type:'spins'},{type:'num',base:5},
 {type:'duck'},{type:'num',base:2},{type:'double'},{type:'num',base:1}
];
let beginCount=0,claimed=0,remote=null,official=null,guestSpinCalls=0;
const clone=x=>JSON.parse(JSON.stringify(x));
function remoteState(){
 return{period:'2026-10-12',score:remote.score,remaining_spins:remote.remaining_spins,
  spin_count:remote.spin_count,multiplier:1,upgrades:0,doubles:0,ducks:0,
  numbers_landed:remote.spin_count,extra_spins:0,segments:clone(segments),
  results:clone(remote.results),finished:remote.remaining_spins===0,claimed:!!claimed};
}
function mount(signed=false){
 const els=new Map(),events={};let clock=0;
 const get=id=>{
  if(els.has(id))return els.get(id);
  const classes=new Set(['hidden']);
  const classList={add:x=>classes.add(x),remove:x=>classes.delete(x),
   contains:x=>classes.has(x),toggle:(x,v)=>{if(v===undefined)v=!classes.has(x);if(v)classes.add(x);else classes.delete(x);return v}};
  const canvasContext=new Proxy({
   getImageData:()=>({data:new Uint8ClampedArray(200*200*4)}),drawImage(){},clearRect(){}
  },{get:(t,k)=>t[k]||(()=>{})});
  const node={id,disabled:false,hidden:false,value:'',open:false,textContent:'',innerHTML:'',
   style:{},dataset:{},classList,width:200,height:200,
   getContext:()=>canvasContext,toDataURL:()=>('data:image/png;base64,'+'a'.repeat(300)),
   addEventListener:(name,fn)=>node['on_'+name]=fn,
   querySelector:()=>get(id+'-child'),querySelectorAll:()=>[],setAttribute(){},
   replaceChildren(){},getBoundingClientRect:()=>({left:0,top:0,width:200,height:200,bottom:200})};
  els.set(id,node);return node;
 };
 const user=signed?{id:'account'}:null,profile=user?{id:user.id,is_owner:false,sound_enabled:false}:null;
 const Crilo={user,profile,dailyPeriod:()=> '2026-10-12',nextReset:()=>new Date(Date.now()+86400000)};
 const calls=[];
 const db={
  auth:{getSession:async()=>({data:{session:user?{user}:null}})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='crilo_guest_begin'){
    beginCount++;remote={score:0,spin_count:0,remaining_spins:5,results:[]};
    return{data:{token:TOKEN,period:'2026-10-12'},error:null};
   }
   if(name==='crilo_guest_state')return{data:remoteState(),error:null};
   if(name==='crilo_guest_spin'){
    guestSpinCalls++;
    assert.equal(args.p_token,TOKEN);
    const rec={type:'num',base:2,points:2,segments:12,probability:2/12};
    remote.score+=2;remote.spin_count++;remote.remaining_spins--;
    remote.results.push(rec);
    return{data:{outcome_index:0,outcome:clone(rec),score:remote.score,
      remaining_spins:remote.remaining_spins,spin_count:remote.spin_count,
      segments:clone(segments),finished:remote.remaining_spins===0},error:null};
   }
   if(name==='crilo_claim_guest_daily'){
    assert.equal(args.p_token,TOKEN);
    assert.equal(remote.remaining_spins,0);
    claimed++;
    official={score:remote.score,spins:remote.spin_count,upgrades:0,doubles:0,ducks:0,drawing:null,daily_period:'2026-10-12'};
    return{data:{status:'saved',score:official.score,run_id:901,period:'2026-10-12'},error:null};
   }
   if(name==='crilo_my_daily_penalty')return{data:{blocked:false},error:null};
   return{data:null,error:{message:'Unexpected RPC '+name}};
  },
  from:table=>({
   select(){return this},eq(){return this},
   maybeSingle:async()=>({data:table==='daily_runs'?official:null,error:null})
  })
 };
 const document={getElementById:get,querySelectorAll:()=>[],querySelector:()=>get('q'),
  createElement:()=>({textContent:'',className:'',style:{setProperty(){}},setAttribute(){}}),
  addEventListener(){},body:{classList:{add(){},remove(){}},style:{setProperty(){}}},
  documentElement:{clientWidth:900}};
 const window={addEventListener:(name,fn)=>events[name]=fn,CriloBadgeEvents:{track:async()=>true}};
 const sandbox={window,document,Crilo,criloDB:db,
  DuckWorld:{clear(){},load:async()=>{},spawn:()=>({}),playSound(){}},
  CriloRarity:{classify:()=>({label:'COMMON',color:'common',probability:.5,odds:2,explanation:'test'})},
  localStorage,location:{origin:'https://crilo.fun',pathname:'/index.html'},URLSearchParams,
  console:{log(){},warn(){},error(){}},Image:class{set src(v){this._src=v;this.onload?.()}get src(){return this._src}},
  setInterval:()=>0,setTimeout:()=>0,performance:{now:()=>clock},
  Math,requestAnimationFrame:fn=>{clock+=3200;fn(clock)}};
 vm.runInNewContext(game,sandbox,{timeout:2500});
 return{get,calls,ready:()=>events['crilo-auth-ready']({detail:{user,profile}}),
  spin:()=>get('spinButton').on_click()};
}
(async()=>{
 const guest=mount();await guest.ready();assert.equal(beginCount,0,'Guest session starts only on first spin');
 await guest.spin();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(beginCount,1);assert.equal(guestSpinCalls,1);
 const persisted=JSON.parse(storage.get(KEY));
 assert.equal(persisted.version,3);assert.equal(persisted.verifiedToken,TOKEN);
 assert.equal(persisted.state.score,2);assert.equal(persisted.state.totalSpins,1);
 const restored=mount();await restored.ready();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(restored.get('score').textContent,'2','Reload uses server score');
 assert.equal(beginCount,1,'Reload cannot restart the verified guest Daily');
 for(let i=1;i<5;i++){await restored.spin();await new Promise(resolve=>setImmediate(resolve))}
 assert.equal(JSON.parse(storage.get(KEY)).status,'complete');
 assert.equal(remote.score,10);assert.equal(guestSpinCalls,5);assert.equal(claimed,0);
 const signed=mount(true);await signed.ready();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(claimed,1,'Completed guest Daily auto-claimed at sign in');
 assert.equal(official.score,10);assert.equal(storage.has(KEY),false);
 assert.match(signed.get('message').textContent,/saved|Daily/i);
 await signed.ready();assert.equal(claimed,1,'Claim cannot repeat');
 console.log('GUEST_CLAIM_SMOKE_PASS server spins, reload, completed transfer, idempotent sign-in');
})().catch(error=>{console.error('GUEST_CLAIM_SMOKE_FAIL',error);process.exitCode=1});
