'use strict';
/* Full browser smoke test with fake server outcomes; never writes to users'
 * official Dailies, badges, or leaderboards. */
const http=require('node:http'),assert=require('node:assert/strict');
const fs=require('node:fs'),{chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const html=fs.readFileSync('index.html','utf8');
const game=fs.readFileSync('game.js','utf8');
const sql=fs.readFileSync('release/346-badges/151-mystery-gift-collection.sql','utf8');
assert.ok(html.includes('mystery-gift.js?v='),'Wheel popup gift script must load');
assert.match(html,/mystery-gift\.css\?v=2/);
assert.ok(html.includes('game.js?v='),'The Daily wheel bundle must be loaded');
assert.match(html,/id="criloMysteryWheel"/);
assert.match(html,/id="criloMysteryShelf"/);
assert.match(game,/window\.CriloMysteryGift\?\.refresh\?\.\(\{autoOpen:true\}\)/);
assert.match(sql,/and d\.is_test=false and d\.verified_spin_session_id is not null/i);
assert.match(game,/CriloMysteryGift\?\.setMode\?\.\('test'\)/);
assert.match(game,/CriloMysteryGift\?\.setMode\?\.\('bonus'\)/);
assert.match(sql,/primary key \(user_id,daily_period\)/);
assert.match(sql,/for update;/i);
assert.match(sql,/v_slice := pg_catalog\.floor\(pg_catalog\.random\(\)\*8\)/);
assert.match(sql,/revoke all on public\.crilo_mystery_gifts from public, anon, authenticated/i);
assert.match(sql,/grant execute on function public\.crilo_mystery_gift\(text\) to authenticated/i);
assert.doesNotMatch(sql,/(insert into|update|delete from) public\.(daily_runs|user_badges|player_stats)/i,
 'Gift rewards must never modify ranked gameplay or badges');
assert.ok(!html.includes('id="criloMysteryPanel"'), 'Large persistent Mystery Gift card must be removed');
assert.ok(html.includes('id="criloMysteryShortcut"'), 'Small collection shortcut required');
assert.ok(html.includes('id="criloMysteryShelfDialog"'), 'Collection remains reachable');
assert.match(html,/<div id="wheelWrap"[\s\S]*?id="criloMysteryModal"/,
 'Mystery popup must live directly on top of the wheel');
const script=fs.readFileSync('mystery-gift.js','utf8');
assert.match(script,/wheelWrap\.scrollIntoView/,'Auto-surprise must come into view');
assert.match(script,/runMode!=='official'/,'No surprise during private Test or Bonus Runs');
const migration=fs.readFileSync('release/346-badges/156-mystery-collection-every-day.sql','utf8');
assert.match(migration,/discovered',v_discovered/,'Collection history must persist between Dailies');
const stateFor=(available,spun=false,slice=null,prize=null,discovered=[])=>({
 eligible:true,available,spun,slice,prize,discovered,period:'2026-10-14'
});
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let passes=0;
 try{
 for(const width of [320,390,768,1180]){
  const context=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
  await context.addInitScript({content:mockSupabase});
  // This component test mounts the site's real markup, stylesheet and
  // Mystery Gift behavior but mocks unrelated Daily auth and spins.
  for(const asset of ['app.js','game.js']){
   await context.route('**/'+asset+'?v=*',route=>route.fulfill({
    status:200,contentType:'text/javascript',
    body:'window.Crilo=window.Crilo||{authResolved:false,user:null};'
   }));
  }
  await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
   route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
  await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
  const page=await context.newPage();
  page.setDefaultTimeout(9000);
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.CriloMysteryGift);
  await page.evaluate(()=>document.documentElement.classList.remove('crilo-daily-pending','crilo-auth-pending'));
  async function setServer(value,hasUser=true){
   await page.evaluate(({value,hasUser})=>{
    window.__giftState=value;
    window.__giftSpinCalls=0;
    window.Crilo.user=hasUser?{id:'11111111-1111-4111-8111-111111111111'}:null;
    criloDB.rpc=async(name,args)=>{
     if(name==='crilo_mystery_gift'){
      if(args.p_action==='spin'){
       window.__giftSpinCalls++;
       window.__giftState={...window.__giftState,spun:true,slice:0,
        prize:'sleepy_duck',discovered:['sleepy_duck']};
      }
      return{data:window.__giftState,error:null};
     }
     return{data:null,error:null};
    };
   },{value,hasUser});
   await page.evaluate(()=>window.CriloMysteryGift.refresh());
  }
  await setServer({eligible:false,available:false,spun:false,discovered:[]},false);
  assert.equal(await page.locator('#criloMysteryShortcut').isVisible(),false,
   width+'px guest must not see collection');
  // History still visible on days when no official Daily has been completed.
  await setServer({eligible:false,available:false,spun:false,discovered:['sleepy_duck']});
  assert.equal(await page.locator('#criloMysteryShortcut').isVisible(),true);
  assert.match(await page.locator('#criloMysteryShortcutLabel').textContent(),/1 \/ 6/);
  await page.locator('#criloMysteryShelfButton').click();
  assert.equal(await page.locator('#criloMysteryShelfDialog').isVisible(),true);
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),false);
  assert.match(await page.locator('#criloMysteryShelfDialog').textContent(),/Napping Duck/);
  assert.equal(await page.locator('#criloMysteryReviewButton').isVisible(),false);
  await page.locator('#criloMysteryShelfClose').click();
  await setServer(stateFor(false));
  await page.evaluate(()=>window.CriloMysteryGift.refresh({autoOpen:true}));
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),false,
   'No automatic gift when event was not drawn');
  await setServer(stateFor(true));
  await page.evaluate(()=>window.CriloMysteryGift.refresh({autoOpen:true}));
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),true,
   width+'px gift should surprise the player immediately on the wheel');
  assert.equal(await page.locator('#criloMysterySpin').isVisible(),true);
  const placement=await page.evaluate(()=>{
   const wheel=document.getElementById('wheelWrap').getBoundingClientRect();
   const dialog=document.querySelector('.crilo-mystery-dialog').getBoundingClientRect();
   const overlay=document.getElementById('criloMysteryModal');
   return {wheel:{x:wheel.x,y:wheel.y,w:wheel.width,h:wheel.height},
    dialog:{x:dialog.x,y:dialog.y,w:dialog.width,h:dialog.height},
    attached:overlay.parentElement?.id==='wheelWrap',
    bg:getComputedStyle(overlay,'::before').backgroundColor};
  });
  assert.equal(placement.attached,true,'Mystery Gift must be anchored to the wheel itself');
  assert.ok(Math.abs(placement.dialog.x+placement.dialog.w/2-
    placement.wheel.x-placement.wheel.w/2)<6,'Gift not horizontally centered on wheel');
  assert.ok(Math.abs(placement.dialog.y+placement.dialog.h/2-
    placement.wheel.y-placement.wheel.h/2)<6,'Gift not vertically centered on wheel');
  assert.ok(placement.dialog.x>=-2&&placement.dialog.x+placement.dialog.w<=width+2,
   'Gift exceeds mobile viewport '+width+' '+JSON.stringify(placement));
  await page.locator('#criloMysteryClose').click();
  await page.evaluate(()=>window.CriloMysteryGift.refresh({autoOpen:true}));
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),false,
   'No repeated automatic popup on refresh');
  await page.evaluate(()=>window.CriloMysteryGift.setMode('test'));
  assert.equal(await page.locator('#criloMysteryShortcut').isVisible(),false,
   'Test Run hides gift shortcut');
  await page.evaluate(()=>window.CriloMysteryGift.refresh({autoOpen:true}));
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),false,
   'Test Run cannot open an automatic gift');
  await page.evaluate(()=>window.CriloMysteryGift.setMode('bonus'));
  assert.equal(await page.locator('#criloMysteryShortcut').isVisible(),false,
   'Unranked bonus runs hide the mystery shortcut');
  await page.evaluate(()=>window.CriloMysteryGift.setMode('official'));
  await page.locator('#criloMysteryShelfButton').click();
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),true,
   'Unopened gift can be accessed after the surprise is dismissed');
  await page.locator('#criloMysterySpin').click();
  await page.waitForFunction(()=>document.getElementById('criloMysteryTitle').textContent==='You opened it!',{timeout:7000});
  assert.equal(await page.evaluate(()=>window.__giftSpinCalls),1);
  assert.match(await page.locator('#criloMysteryMessage').textContent(),/Napping Duck/);
  assert.equal(await page.locator('#criloMysterySpin').isVisible(),false);
  await page.locator('#criloMysteryClose').click();
  await page.locator('#criloMysteryShelfButton').click();
  assert.equal(await page.locator('#criloMysteryShelfDialog').isVisible(),true,
   'Completed gift shortcut should show the collection, not a giant card');
  assert.match(await page.locator('#criloMysteryProgress').textContent(),/1 \/ 6/);
  await page.locator('#criloMysteryReviewButton').click();
  assert.equal(await page.locator('#criloMysteryModal').isVisible(),true,
   'Finished gift remains reviewable inside the wheel');
  assert.equal(await page.locator('#criloMysterySpin').isVisible(),false,
   'Review cannot produce another spin');
  assert.equal(await page.evaluate(()=>window.__giftSpinCalls),1);
  await context.close();passes++;
 }
 console.log('MYSTERY_GIFT_BROWSER_PASS '+passes+
  ' real-device widths; surprise wheel popup, history, collection, no rerolls and Test Run isolation');
 }finally{await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error('MYSTERY_GIFT_BROWSER_FAIL',e);process.exitCode=1});
