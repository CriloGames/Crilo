/* Crilo 346 badge release: browser-logic regression tests without production credentials.
 * Run: node release/346-badges/009-client-flow-smoke.cjs
 * Browser DOM and RPCs are simulated; this is NOT a substitute for authenticated live browser QA.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.resolve(__dirname,'../../game.js'),'utf8');
const defaults=[
 {type:'num',base:2},{type:'duck'},{type:'num',base:1},{type:'upgrade'},
 {type:'num',base:3},{type:'num',base:1},{type:'spins'},{type:'num',base:5},
 {type:'duck'},{type:'num',base:2},{type:'double'},{type:'num',base:1}
];
const pool=[1,1,2,2,3,3,5,5,8,10];
function mockClient(outcomes,{loseFirstReply=false,owner=false}={}){
 const els=new Map(),events={};
 function element(id){
  if(els.has(id))return els.get(id);
  const states=new Set(['hidden']);
  const classList={add:x=>states.add(x),remove:x=>states.delete(x),contains:x=>states.has(x),
   toggle:x=>states.has(x)?(states.delete(x),false):(states.add(x),true)};
  const ctx=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(200*200*4)})},{get:(o,p)=>o[p]??(()=>{})});
  const el={id,classList,style:{},dataset:{},textContent:'',innerHTML:'',value:'',
   disabled:false,width:200,height:200,open:false,addEventListener:(name,cb)=>el['on_'+name]=cb,
   setAttribute:(key,val)=>{(el.attrs||(el.attrs={}))[key]=val;},getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,'+'a'.repeat(200),
   querySelector:()=>element('nested'),querySelectorAll:()=>[],
   getAttribute:(key)=>el.attrs?.[key]||null,
   removeAttribute:(key)=>{if(el.attrs)delete el.attrs[key];},
   replaceChildren:(...nodes)=>{el.children=nodes;el.textContent=nodes.map(n=>n.textContent).join('');},
   getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
  els.set(id,el);return el;
 }
 const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>element('nested'),
  createElement:()=>({textContent:'',className:'',style:{setProperty(){}},setAttribute(){}}),
  addEventListener:()=>{}};
 const window={addEventListener:(n,cb)=>events[n]=cb,CriloBadgeEvents:{track:async()=>true}};
 const rpcCalls=[],saved=[],errors=[];
 const state={id:'test-session',remaining_spins:5,spin_count:0,score:0,multiplier:1,
  upgrades:0,doubles:0,ducks:0,extra_spins:0,numbers_landed:0,segments:defaults.map(x=>({...x})),
  results:[],finished:false};
 let cursor=0,lost=loseFirstReply;
 const db={
  rpc:async(name)=>{
   rpcCalls.push(name);
   if(name==='crilo_begin_server_spin_session')return{data:state.id};
   if(name==='crilo_get_server_spin_state')return{data:{
    session_id:state.id,remaining_spins:state.remaining_spins,spin_count:state.spin_count,
    score:state.score,multiplier:state.multiplier,upgrades:state.upgrades,doubles:state.doubles,
    ducks:state.ducks,extra_spins:state.extra_spins,numbers_landed:state.numbers_landed,
    segments:state.segments,results:state.results,finished:state.finished}};
   if(name==='crilo_server_spin'){
    const kind=outcomes[cursor++];if(!kind)return{error:{message:'Unexpected extra spin'}};
    const idx=state.segments.findIndex(s=>s.type===kind.type&&(kind.type!=='num'||s.base===kind.base));
    assert.ok(idx>=0,'Outcome exists on wheel');
    const probability=state.segments.filter(s=>s.type===kind.type&&(kind.type!=='num'||s.base===kind.base)).length/state.segments.length;
    let points=0;
    state.remaining_spins--;state.spin_count++;
    if(kind.type==='num'){points=kind.base*state.multiplier;state.score+=points;state.numbers_landed++;}
    if(kind.type==='duck'){state.ducks++;state.remaining_spins++;}
    if(kind.type==='double'){points=state.score;state.score*=2;state.doubles++;state.remaining_spins++;}
    if(kind.type==='spins'){state.remaining_spins+=2;state.extra_spins+=2;}
    if(kind.type==='upgrade'){state.multiplier*=3;state.upgrades++;state.remaining_spins++;
      for(let i=0;i<4+Math.min(state.upgrades,8);i++)state.segments.push({type:'num',base:pool[0]});}
    const out={type:kind.type,base:kind.base??null,points,segments:state.segments.length,probability};
    state.results.push(out);state.finished=state.remaining_spins===0;
    if(lost){lost=false;return{error:{message:'Lost response'}};}
    return{data:{outcome_index:idx,outcome:out,score:state.score,
     remaining_spins:state.remaining_spins,spin_count:state.spin_count,
     segments:state.segments,finished:state.finished}};
   }
   return{error:{message:'Unrecognized RPC '+name}};
  },
  auth:{getSession:async()=>({data:{session:{user:{id:'player1'}}}})},
  from(table){
   const query={
    select:()=>query,eq:()=>query,in:()=>query,maybeSingle:async()=>({data:null}),
    single:async()=>({data:saved.at(-1)||null,error:null}),
    insert(payload){if(table==='daily_runs')saved.push(payload);return query;},
    then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}
   };
   return query;
  }
 };
 const Crilo={user:{id:'player1'},profile:{id:'player1',is_owner:owner,sound_enabled:false},
  dailyPeriod:()=> '2026-10-09',nextReset:()=>new Date(Date.now()+100000)};
 const ducks={clear:()=>{},load:async()=>{},spawn:()=>({}),playSound:()=>{}};
 let clock=0;const perf={now:()=>clock};
 const requestAnimationFrame=cb=>{clock+=3100;cb(clock);};
 const context={window,document,Crilo,criloDB:db,DuckWorld:ducks,
  CriloRarity:{classify:score=>({label:score>300?'MYTHIC':'COMMON',color:'common',
   probability:.5,odds:2,explanation:'fixture'})},
  localStorage:{getItem:()=> 'off'},location:{origin:'https://crilo.fun',pathname:'/index.html'},
  setInterval:()=>0,setTimeout:()=>0,requestAnimationFrame,performance:perf,
  console:{error:(...args)=>errors.push(args),warn:()=>{},log:()=>{}},Image:class{}};
 vm.runInNewContext(game,context,{filename:'game.js',timeout:1200});
 return{state,rpcCalls,saved,errors,els,events,spin:()=>element('spinButton').on_click()};
}
(async()=>{
 const x=mockClient(Array.from({length:5},()=>({type:'num',base:1})));
 await x.events['crilo-auth-ready']({detail:{user:{id:'player1'},profile:{id:'player1',is_owner:false,sound_enabled:false}}});
 for(let i=0;i<5;i++)await x.spin();
 // The animation is synchronously mocked, but endRun saves asynchronously.
 await new Promise(setImmediate);
 assert.equal(x.saved.length,1,'One official run saved');
 assert.equal(x.saved[0].score,5);
 assert.equal(x.saved[0].verified_spin_session_id,'test-session');
 assert.equal(x.saved[0].spins,5);
 assert.equal(x.state.remaining_spins,0);
 const y=mockClient([
  {type:'duck'},{type:'double'},{type:'upgrade'},{type:'spins'},
  ...Array.from({length:6},()=>({type:'num',base:1}))
 ]);
 await y.events['crilo-auth-ready']({detail:{user:{id:'player1'},profile:{id:'player1',is_owner:false,sound_enabled:false}}});
 for(let i=0;i<10;i++)await y.spin();
 await new Promise(setImmediate);
 assert.equal(y.saved.length,1,'All-special run saved only once');
 assert.equal(y.saved[0].spins,10);
 assert.equal(y.saved[0].score,18);
 assert.equal(y.saved[0].upgrades,1);
 assert.equal(y.saved[0].ducks,1);
 assert.equal(y.saved[0].doubles,1);
 assert.equal(y.saved[0].extra_spins,2);
 assert.equal(y.saved[0].verified_spin_session_id,'test-session');
 const z=mockClient([{type:'num',base:2},{type:'num',base:2}],{loseFirstReply:true});
 await z.events['crilo-auth-ready']({detail:{user:{id:'player1'},profile:{id:'player1',is_owner:false,sound_enabled:false}}});
 await z.spin();
 assert.equal(z.state.spin_count,1);
 await z.spin();
 assert.equal(z.state.spin_count,1,'Recovery must not consume a spin');
 await z.spin();
 assert.equal(z.state.spin_count,2,'Next real click consumes one spin');
 console.log('PASS: five numbers, special effects, one official save, proof ID, lost-response recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
