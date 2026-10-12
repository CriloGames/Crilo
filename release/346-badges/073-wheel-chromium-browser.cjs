/* Actual Chromium DOM regression against Crilo's checked-in website.
 * Synthetic, signed-in Supabase client: NO live sessions, scores or mail.
 * Complements rollback-only authenticated-role Supabase SQL tests.
 */
'use strict';
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let uri;
 try{uri=decodeURIComponent((req.url||'/index.html').split('?')[0])}catch{res.writeHead(400);res.end();return}
 const name=path.resolve(root,'.'+path.normalize(uri));
 if(!name.startsWith(root+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){
  res.writeHead(404);res.end('Not found');return;
 }
 res.writeHead(200,{'content-type':mime[path.extname(name)]||'text/plain'});
 fs.createReadStream(name).pipe(res);
});
async function start(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return 'http://127.0.0.1:'+server.address().port+'/index.html';
}
function fakeAuth(mode){
 // Injected into the REAL browser before any page scripts execute.
 const profile={id:'wheel-qa-user',username:'WheelQA',name_color:'#223344',theme:'light',sound_enabled:false,is_owner:false};
 const backend={
  mode,saves:[],saveAttempts:0,spinCount:0,sessionId:'synthetic-qa-session',lostSpin:false,
  segments:[{type:'num',base:2},{type:'duck'},{type:'num',base:1},{type:'upgrade'},
   {type:'num',base:3},{type:'num',base:1},{type:'spins'},{type:'num',base:5},
   {type:'duck'},{type:'num',base:2},{type:'double'},{type:'num',base:1}],
  results:[],score:0,remaining_spins:5,finished:false
 };
 window.__qaBackend=backend;
 window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()+5000),0);
 const session={user:{id:profile.id}};
 const client={
  auth:{
   async getSession(){return {data:{session}}},
   onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},
   async signOut(){return{error:null}}
  },
  async rpc(name,args){
   if(name==='crilo_my_ban_status')return{data:false,error:null};
   if(name==='crilo_my_moderation_notices')return{data:[],error:null};
   if(name==='crilo_my_daily_penalty')return{data:{blocked:false},error:null};
   if(name==='crilo_duck_progress')return{data:[{completed_dailies:0}],error:null};
   if(name==='crilo_v3_record_event')return{data:true,error:null};
   if(name==='crilo_begin_server_spin_session')return{data:backend.sessionId,error:null};
   if(name==='crilo_get_server_spin_state')return{data:{
    session_id:backend.sessionId,spin_count:backend.spinCount,score:backend.score,
    multiplier:1,remaining_spins:backend.remaining_spins,upgrades:0,doubles:0,ducks:0,
    numbers_landed:backend.spinCount,extra_spins:0,segments:backend.segments,
    results:backend.results,finished:backend.finished
   },error:null};
   if(name==='crilo_server_spin'){
    if(backend.finished)return{error:{message:'Session already completed'}};
    backend.spinCount++;
    const points=1;
    backend.score+=points;
    backend.remaining_spins--;
    if(backend.mode==='forced-terminal')backend.remaining_spins=0;
    backend.finished=backend.remaining_spins===0;
    const outcome={type:'num',base:1,points,segments:12,probability:.25};
    backend.results.push(outcome);
    const reply={outcome_index:2,outcome,score:backend.score,
     remaining_spins:backend.remaining_spins,spin_count:backend.spinCount,
     segments:backend.segments,finished:backend.finished};
    if(backend.mode==='lost-spin'&&!backend.lostSpin){
     backend.lostSpin=true;
     return{error:{message:'Simulated lost spin reply'},data:null};
    }
    return{data:reply,error:null};
   }
   return{data:null,error:null};
  },
  from(table){
   let inserted=null;const filters=[];
   const q={
    select(){return q},
    eq(field,value){filters.push([field,value]);return q},
    not(){return q},gte(){return q},in(){return q},
    order(){return q},limit(){return q},range(){return q},
    insert(value){inserted=value;backend.saveAttempts++;return q},
    async single(){
     if(inserted){
      const first=backend.saveAttempts===1;
      if(backend.mode==='reject-save'&&first)return{data:null,error:{message:'Temporary network error'}};
      if(!(backend.mode==='lost-save'&&first)&&backend.saves.length)throw Error('Duplicate save was sent');
      backend.saves.push(inserted);
      if(backend.mode==='lost-save'&&first)return{data:null,error:{message:'Response lost after commit'}};
      return{data:{id:1,is_test:false,daily_period:'2026-10-11'},error:null};
     }
     return{data:null,error:null};
    },
    async maybeSingle(){
     if(table==='profiles')return{data:profile,error:null};
     if(table==='daily_runs'){
      const lookup=filters.some(([k])=>k==='verified_spin_session_id');
      if(lookup&&backend.saves.length)return{data:{id:1,daily_period:'2026-10-11'},error:null};
      return{data:null,error:null};
     }
     return{data:null,error:null};
    },
    then(resolve,reject){
     let rows=[];
     if(backend.mode==='badge-rewards'&&backend.saves.length){
      const tiers=['mythic','rare','common','anomaly','uncommon','epic','trash'];
      if(table==='user_badges')rows=tiers.map((tier,i)=>({badge_id:i+500}));
      if(table==='badges')rows=tiers.map((tier,i)=>({
       id:i+500,badge_key:'qa_'+tier,name:'QA '+tier,
       description:'A synthetic '+tier+' badge',category:'Wheel moments',
       requirement:{rarity:tier},is_secret:false
      }));
     }
     return Promise.resolve({data:rows,error:null}).then(resolve,reject);
    }
   };
   return q;
  }
 };
 window.supabase={createClient:()=>client};
}
async function run(){
 const url=await start(),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let passed=0;
 try{
  const scenarios=[
   {name:'double-click-and-reset',mode:'normal',width:1280,height:850},
   {name:'lost-spin-response',mode:'lost-spin',width:390,height:844},
   {name:'rejected-save-retry',mode:'reject-save',width:390,height:844},
   {name:'committed-save-lost-response',mode:'lost-save',width:1280,height:850},
   {name:'authoritative-early-terminal',mode:'forced-terminal',width:390,height:844},
   {name:'badge-rewards',mode:'badge-rewards',width:390,height:844}
  ];
  for(const sc of scenarios){
   const context=await browser.newContext({viewport:{width:sc.width,height:sc.height}});
   await context.addInitScript(fakeAuth,sc.mode);
   const page=await context.newPage(),errors=[];
   page.setDefaultTimeout(15000);
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    if(route.request().url().startsWith('http://127.0.0.1:'))return route.continue();
    route.abort();
   });
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.Crilo?.user?.id==='wheel-qa-user'&&!document.getElementById('spinButton').disabled);
   if(sc.name==='double-click-and-reset'){
    await page.evaluate(()=>{document.getElementById('spinButton').click();document.getElementById('spinButton').click()});
    await page.waitForFunction(()=>window.__qaBackend.spinCount===1&&!document.getElementById('spinButton').disabled);
    assert.equal(await page.evaluate(()=>window.__qaBackend.spinCount),1,'Double click consumed more than one server spin');
    await page.evaluate(()=>{window.Crilo.nextReset=()=>new Date(Date.now()-5000)});
    await page.waitForTimeout(1600);
    assert.equal(await page.evaluate(()=>window.__qaBackend.spinCount),1,'Active run reloaded at reset');
   }else if(sc.name==='lost-spin-response'){
    await page.locator('#spinButton').click();
    await page.waitForFunction(()=>window.__qaBackend.spinCount===1&&!document.getElementById('spinButton').disabled);
    await page.locator('#spinButton').click();
    assert.equal(await page.evaluate(()=>window.__qaBackend.spinCount),1,'Recovery replayed the lost spin');
    await page.locator('#spinButton').click();
    await page.waitForFunction(()=>window.__qaBackend.spinCount===2);
   }else if(sc.name==='authoritative-early-terminal'){
    await page.locator('#spinButton').click();
    await page.waitForFunction(()=>window.__qaBackend.finished&&window.__qaBackend.saves.length===1);
    assert.equal(await page.evaluate(()=>window.__qaBackend.saves[0].spins),1);
    assert.equal(await page.evaluate(()=>window.__qaBackend.saves[0].score),1);
    assert.equal(await page.evaluate(()=>window.__qaBackend.saves[0].drawing),null,'Blank official drawings must not be stored as empty PNGs');
   }else{
    for(let i=1;i<=5;i++){
     await page.locator('#spinButton').click();
     await page.waitForFunction(i=>window.__qaBackend.spinCount===i,i);
     if(i<5)await page.waitForFunction(()=>!document.getElementById('spinButton').disabled);
    }
    await page.waitForFunction(()=>window.__qaBackend.saveAttempts>=1);
    if(sc.name==='rejected-save-retry'){
     await page.locator('#retrySaveBtn').waitFor({state:'visible'});
     assert.equal(await page.evaluate(()=>window.__qaBackend.saves.length),0);
     await page.locator('#retrySaveBtn').click();
     await page.waitForFunction(()=>window.__qaBackend.saves.length===1);
     assert.equal(await page.locator('#retrySaveBtn').isVisible(),false);
     assert.equal(await page.evaluate(()=>window.__qaBackend.saveAttempts),2);
    }else{
     await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Official Daily saved'));
     assert.equal(await page.evaluate(()=>window.__qaBackend.saves.length),1);
     assert.equal(await page.evaluate(()=>window.__qaBackend.saveAttempts),1);
     assert.equal(await page.locator('#retrySaveBtn').isVisible(),false);
    }
   }
   if(sc.name==='badge-rewards'){
    await page.locator('#newBadgeList .new-badge-item').first().waitFor();
    assert.equal(await page.locator('#newBadgePanel').isVisible(),true,
     'Newly earned badges must be visible without a click');
    assert.equal(await page.locator('#newBadgePanel').evaluate(el=>el.tagName),'SECTION',
     'New badges cannot be hidden inside a details dropdown');
    assert.equal(await page.locator('#newBadgePanel summary').count(),0,
     'Badge list must not be a collapsible summary');
    const ordered=await page.locator('#newBadgeList .new-badge-item').evaluateAll(
     items=>items.map(item=>item.dataset.badgeRarity));
    assert.deepEqual(ordered,['trash','common','uncommon','rare','epic','anomaly','mythic'],
     'Newly earned badges must be organized from lowest tier to Mythic');
    assert.equal(await page.locator('#newBadgeCount').innerText(),'7 NEW BADGES UNLOCKED');
    await page.locator('#newBadgeList [data-badge-rarity="rare"]').click();
    assert.equal(await page.locator('#dailyBadgePreviewDialog').isVisible(),true,
     'Sorted badge rewards must keep their interactive details');
    await page.locator('#dailyBadgePreviewClose').click();
   }
   assert.equal(errors.filter(x=>/ReferenceError|TypeError|SyntaxError|finalSaveInProgress/.test(x)).length,0,
    sc.name+' browser error: '+JSON.stringify(errors));
   console.log('PASS '+sc.name+' ('+sc.width+'x'+sc.height+')');
   passed++;await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
 assert.equal(passed,6);
 console.log('PASS: 6 real Chromium browser flows with automatic badge rewards ordered by rarity; zero production writes.');
}
run().catch(error=>{console.error(error);process.exitCode=1;try{server.close()}catch{}});
