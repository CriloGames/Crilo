/* Crilo owner Test Run isolation and live score-rarity HUD regression.
 * Run: node release/346-badges/009-client-flow-smoke.cjs
 * Browser DOM and RPCs are simulated; this is NOT a substitute for authenticated live browser QA.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const game=fs.readFileSync(path.resolve(__dirname,'../../game.js'),'utf8');
const raritySource=fs.readFileSync(path.resolve(__dirname,'../../rarity-system.js'),'utf8');
const indexHTML=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const historySource=fs.readFileSync(path.resolve(__dirname,'../../spin-history.js'),'utf8');
const scoreCSS=fs.readFileSync(path.resolve(__dirname,'../../style.css'),'utf8');
const rarityWorld={};vm.runInNewContext(raritySource,{window:rarityWorld});
const trueScoreBands=rarityWorld.CriloRarity.scoreBands;
assert.match(indexHTML,/rarity-system\.js\?v=11/,'Homepage should load the updated rarity explanation');
for(const score of [0,9,60,301]){
 const message=rarityWorld.CriloRarity.classify(score).explanation;
 assert.match(message,/^\d+\.\d{2}% of simulated runs scored at least this high\.$/);
 assert.ok(!message.includes('Score tier based on'),'Omit redundant simulation prefix');
}
assert.deepEqual(Array.from(trueScoreBands,b=>[b.key,b.min,b.max===Infinity?'infinity':b.max]),[
 ['trash',0,6],['common',7,24],['uncommon',25,48],
 ['rare',49,92],['epic',93,141],['anomaly',142,300],
 ['mythic',301,'infinity']
]);
assert.match(historySource,/\.eq\('is_test',false\)/,'Spin History excludes Test Runs');
assert.match(historySource,/from\('daily_runs'\)/,'Spin History reads only official Daily rows');
assert.match(indexHTML,/id="wheelScorePanel"/);
assert.match(indexHTML,/id="scoreTierText"/);
assert.match(indexHTML,/game\.js\?v=71/);
assert.match(indexHTML,/style\.css\?v=99/);
assert.match(indexHTML,/id="wheelScorePanel" data-rarity="unrevealed"/);
assert.match(indexHTML,/id="scoreTier" hidden/);
assert.match(indexHTML,/id="scoreTierHint">Spin to reveal tier/);
assert.match(scoreCSS,/\.wheel-score-rarity\[hidden\],\.wheel-score-hint\[hidden\]\{display:none!important\}/);
assert.match(scoreCSS,/\.wheel-score\[data-rarity="mythic"\]/);
assert.match(scoreCSS,/\.wheel-hud \.wheel-counts/);
assert.ok(game.includes("if(isTest){\n // A Test Run must never fall through"),'Test save must fail closed');
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
  const attrs={};
  const el={id,classList,style:{},dataset:{},textContent:'',innerHTML:'',value:'',
   disabled:false,width:200,height:200,open:false,addEventListener:(name,cb)=>el['on_'+name]=cb,
   setAttribute:(key,value)=>{attrs[key]=value},getAttribute:key=>attrs[key]||null,
   removeAttribute:key=>{delete attrs[key]},
   replaceChildren:(...nodes)=>{el.children=nodes;el.textContent=nodes.map(x=>x.textContent).join('')},
   getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,'+'a'.repeat(200),
   querySelector:()=>element('nested'),querySelectorAll:()=>[],
   getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
  els.set(id,el);return el;
 }
 const document={getElementById:element,querySelectorAll:()=>[],querySelector:()=>element('nested'),
  createElement:()=>({textContent:'',className:'',style:{setProperty(){}},setAttribute(){}}),
  addEventListener:()=>{}};
 const window={addEventListener:(n,cb)=>events[n]=cb,CriloRarity:{scoreBands:trueScoreBands},CriloBadgeEvents:{track:async name=>{badgeEvents.push(name);return true;}}};
 const rpcCalls=[],saved=[],testSaved=[],badgeEvents=[],errors=[];
 const state={id:'test-session',remaining_spins:5,spin_count:0,score:0,multiplier:1,
  upgrades:0,doubles:0,ducks:0,extra_spins:0,numbers_landed:0,segments:defaults.map(x=>({...x})),
  results:[],finished:false};
 let cursor=0,lost=loseFirstReply;
 const db={
  rpc:async(name,args)=>{
   rpcCalls.push(name);
   if(name==='crilo_save_owner_test_run'){
    testSaved.push(args.p_run);
    return {data:'private-test-id',error:null};
   }
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
  CriloRarity:{scoreBands:trueScoreBands,classify:score=>({label:score>300?'MYTHIC':'COMMON',color:'common',
   probability:.5,odds:2,explanation:'fixture'})},
  localStorage:{getItem:()=> 'off'},location:{origin:'https://crilo.fun',pathname:'/index.html'},
  setInterval:()=>0,setTimeout:()=>0,requestAnimationFrame,performance:perf,Math:Object.assign(Object.create(Math),{random:()=>0}),
  console:{error:(...args)=>errors.push(args),warn:()=>{},log:()=>{}},Image:class{}};
 const instrumented=game.replace(/\n\}\)\(\);\s*$/, '\nwindow.__criloScoreTest=n=>{score=n;update()};\n})();');
 assert.notEqual(instrumented,game,'Injecting synthetic threshold test function failed');
 vm.runInNewContext(instrumented,context,{filename:'game.js',timeout:1200});
 return{state,rpcCalls,saved,testSaved,badgeEvents,errors,els,events,window,spin:()=>element('spinButton').on_click()};
}
(async()=>{
 const owner=mockClient([],{owner:true});
 await owner.events['crilo-auth-ready']({detail:{user:{id:'player1'},profile:{id:'player1',is_owner:true,sound_enabled:false}}});
 assert.ok(owner.els.get('ownerSaveRunBtn').on_click,'Owner Test Run button is bound');
 owner.els.get('ownerSaveRunBtn').on_click();
 assert.equal(owner.els.get('testBanner').classList.contains('hidden'),false,'Owner Test mode visible');
 assert.equal(owner.els.get('wheelScorePanel').dataset.rarity,'unrevealed','No Trash tier before first owner Test spin');
 assert.equal(owner.els.get('scoreTier').hidden,true);
 assert.equal(owner.els.get('scoreTierHint').hidden,false);
 await owner.spin(); // Resolved first result can still be Trash.
 assert.equal(owner.els.get('wheelScorePanel').dataset.rarity,'trash','First resolved low score reveals Trash');
 assert.equal(owner.els.get('scoreTier').hidden,false);
 assert.equal(owner.els.get('scoreTierHint').hidden,true);
 for(let i=1;i<5;i++)await owner.spin();
 await new Promise(setImmediate);
 assert.equal(owner.saved.length,0,'Test must not create official Daily row');
 assert.equal(owner.testSaved.length,1,'Private test uses its own RPC exactly once');
 assert.equal(owner.badgeEvents.length,0,'Test Run cannot emit badge events');
 assert.ok(owner.rpcCalls.includes('crilo_save_owner_test_run'),'Test must use private RPC');
 assert.ok(!owner.rpcCalls.includes('crilo_begin_server_spin_session'),'Test must not create official spin session');
 assert.equal(owner.els.get('wheelScorePanel').dataset.rarity,'common','Five num-2 spins reach Common score');
 assert.equal(owner.els.get('scoreTierText').textContent,'COMMON');
 const pointsAndTiers=[
 [0,'trash'],[6,'trash'],[7,'common'],[24,'common'],
 [25,'uncommon'],[48,'uncommon'],[49,'rare'],[92,'rare'],
 [93,'epic'],[141,'epic'],[142,'anomaly'],[300,'anomaly'],
 [301,'mythic'],[999999,'mythic']
 ];
 for(const [score,tier] of pointsAndTiers){
  owner.window.__criloScoreTest(score);
  assert.equal(owner.els.get('wheelScorePanel').dataset.rarity,tier,'Score rarity '+score);
  assert.equal(owner.els.get('scoreTierText').textContent,tier.toUpperCase());
  assert.equal(owner.els.get('scoreTier').id,'scoreTier');
 }
 owner.els.get('ownerSaveRunBtn').on_click();
 assert.equal(owner.els.get('wheelScorePanel').dataset.rarity,'unrevealed','Next owner Test run begins without Trash');
 assert.equal(owner.els.get('scoreTier').hidden,true);
 assert.equal(owner.els.get('scoreTierHint').hidden,false);
 console.log('PASS: owner Test Run saved privately, zero official inserts, zero badge events, and all 14 rarity score boundaries.');
 const x=mockClient(Array.from({length:5},()=>({type:'num',base:1})));
 await x.events['crilo-auth-ready']({detail:{user:{id:'player1'},profile:{id:'player1',is_owner:false,sound_enabled:false}}});
 assert.equal(x.els.get('wheelScorePanel').dataset.rarity,'unrevealed','Official Daily starts neutral');
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
 assert.equal(y.els.get('wheelScorePanel').dataset.rarity,'unrevealed');
 await y.spin();
 assert.equal(y.els.get('wheelScorePanel').dataset.rarity,'trash','First Duck reveals zero-point Trash after resolution');
 assert.equal(y.els.get('scoreTier').hidden,false);
 for(let i=1;i<10;i++)await y.spin();
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
 console.log('PASS: authoritative official run, server proof, recovery and seven-tier scoreboard.');
})().catch(error=>{console.error(error);process.exitCode=1;});
