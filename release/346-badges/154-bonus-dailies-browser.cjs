'use strict';
/* Browser test: bonus progression and accessible phone/tablet controls.
 * Synthetic status RPC only. No player data, scores or badges are written. */
const http=require('node:http'),assert=require('node:assert/strict');
const fs=require('node:fs'),{chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8');
const migration=fs.readFileSync('release/346-badges/153-badge-bonus-daily-runs.sql','utf8');
assert.match(html,/bonus-runs\.js\?v=1/);
assert.match(html,/bonus-runs\.css\?v=1/);
assert.match(html,/game\.js\?v=119/);
assert.match(html,/id="criloBonusPanel"/);
assert.match(html,/id="bonusModeBanner"/);
assert.match(game,/isBonus\?'crilo_bonus_spin':'crilo_server_spin'/);
assert.match(game,/isBonus\?'crilo_get_bonus_spin_state':'crilo_get_server_spin_state'/);
assert.match(game,/crilo_save_bonus_run/);
assert.match(game,/if\(!isTest&&!isBonus\)\{const before=/);
assert.match(game,/else if\(isBonus\)/);
assert.match(migration,/LEAST\(4, badges_earned \/ 50\)/);
assert.match(migration,/earned < p_slot\*50/);
assert.match(migration,/d\.is_test=false[\s\S]*?verified_spin_session_id IS NOT NULL/i);
assert.match(migration,/row level security/i);
assert.doesNotMatch(migration,/(insert into|update|delete from) public\.(daily_runs|user_badges|player_stats)/i,
 'Bonus runs must never directly modify competitive or badge tables');
function snapshot(badges,official=true,complete=[]){
 const max=Math.min(4,Math.floor(badges/50));
 return{badge_count:badges,bonus_unlocked:max,total_runs:1+max,official_done:official,
 next_unlock:max===4?null:(max+1)*50,
 runs:[1,2,3,4].map(slot=>({slot,unlocked:slot<=max,saved:complete.includes(slot),
  started:complete.includes(slot),finished:complete.includes(slot),
  score:complete.includes(slot)?1500:null,spins:complete.includes(slot)?5:null}))};
}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let count=0;
 try{
 for(const width of [320,390,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
  await ctx.addInitScript({content:mockSupabase});
  for(const asset of ['app.js','game.js']){
   await ctx.route('**/'+asset+'?v=*',route=>route.fulfill({
    status:200,contentType:'text/javascript',body:'window.Crilo=window.Crilo||{authResolved:false,user:null};'
   }));
  }
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
   route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await ctx.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
  const page=await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.CriloBonusRuns);
  await page.evaluate(()=>{
   document.documentElement.classList.remove('crilo-daily-pending','crilo-auth-pending');
   window.Crilo.user={id:'11111111-1111-4111-8111-111111111111'};
   window.__bonusEvents=[];
   window.addEventListener('crilo-bonus-run-start',e=>window.__bonusEvents.push(e.detail.slot));
   criloDB.rpc=async(name,args)=>{
    if(name==='crilo_bonus_status')return{data:window.__bonusSnapshot,error:null};
    if(name==='crilo_begin_bonus_spin_session'){
     window.__bonusBegins.push(args.p_slot);
     return {data:'11111111-1111-4111-8111-111111111111',error:null};
    }
    return {data:null,error:null};
   };
   window.__bonusBegins=[];
  });
  async function setStatus(s){
   await page.evaluate(s=>{window.__bonusSnapshot=s;},s);
   await page.evaluate(()=>window.CriloBonusRuns.refresh());
  }
  await setStatus(snapshot(155,false));
  assert.equal(await page.locator('#criloBonusPanel').isVisible(),false,
   'Bonus should not show until official Daily is complete');
  await setStatus(snapshot(45));
  assert.equal(await page.locator('#criloBonusPanel').isVisible(),true);
  assert.match(await page.locator('#criloBonusProgress').textContent(),/5 more/);
  assert.equal(await page.locator('#criloBonusList button:not([disabled])').count(),0);
  await setStatus(snapshot(155,true,[1]));
  assert.match(await page.locator('#criloBonusSummary').textContent(),/4 Daily Runs/);
  const buttons=page.locator('#criloBonusList button');
  assert.equal(await buttons.count(),4);
  assert.equal(await buttons.nth(0).isDisabled(),true);
  assert.equal(await buttons.nth(1).isEnabled(),true);
  assert.equal(await buttons.nth(2).isEnabled(),true);
  assert.equal(await buttons.nth(3).isDisabled(),true);
  const rect=await page.locator('#criloBonusPanel').boundingBox();
  assert.ok(rect&&rect.x>=-2&&rect.x+rect.width<=width+2,
   'Clipped bonus UI at '+width+'px '+JSON.stringify(rect));
  await buttons.nth(1).click();
  assert.deepEqual(await page.evaluate(()=>window.__bonusBegins),[2]);
  assert.deepEqual(await page.evaluate(()=>window.__bonusEvents),[2]);
  await ctx.close();count++;
 }
 console.log('BONUS_RUNS_BROWSER_PASS '+count+' viewports, milestones, locked slots, official-only eligibility and safe start events');
 }finally{
 await browser.close();await new Promise(done=>server.close(done));
 }
})().catch(e=>{console.error('BONUS_RUNS_BROWSER_FAIL',e);process.exitCode=1});
