'use strict';
/* Full browser smoke test with fake server outcomes; never writes to users'
 * official Dailies, badges, or leaderboards. */
const http=require('node:http'),assert=require('node:assert/strict');
const fs=require('node:fs'),{chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const html=fs.readFileSync('index.html','utf8');
const game=fs.readFileSync('game.js','utf8');
const sql=fs.readFileSync('release/346-badges/151-mystery-gift-collection.sql','utf8');
assert.match(html,/mystery-gift\.js\?v=1/);
assert.match(html,/mystery-gift\.css\?v=1/);
assert.match(html,/game\.js\?v=118/);
assert.match(html,/id="criloMysteryWheel"/);
assert.match(html,/id="criloMysteryShelf"/);
assert.match(game,/window\.CriloMysteryGift\?\.refresh\?\.\(\)/);
assert.match(sql,/and d\.is_test=false and d\.verified_spin_session_id is not null/i);
assert.match(sql,/primary key \(user_id,daily_period\)/);
assert.match(sql,/for update;/i);
assert.match(sql,/v_slice := pg_catalog\.floor\(pg_catalog\.random\(\)\*8\)/);
assert.match(sql,/revoke all on public\.crilo_mystery_gifts from public, anon, authenticated/i);
assert.match(sql,/grant execute on function public\.crilo_mystery_gift\(text\) to authenticated/i);
assert.doesNotMatch(sql,/(insert into|update|delete from) public\.(daily_runs|user_badges|player_stats)/i,
 'Gift rewards must never modify ranked gameplay or badges');
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
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   const page=await context.newPage();
   await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.CriloMysteryGift,{timeout:7000});
   const setServer=async(value)=>{
    await page.evaluate(v=>{
     window.__giftState=v;
     window.__giftSpinCalls=0;
     window.Crilo.user={id:'11111111-1111-4111-8111-111111111111'};
     window.criloDB.rpc=async(name,args)=>{
      if(name==='crilo_mystery_gift'){
       if(args.p_action==='spin'){
        window.__giftSpinCalls++;
        window.__giftState={...window.__giftState,spun:true,slice:0,
         prize:'sleepy_duck',discovered:['sleepy_duck']};
       }
       return {data:window.__giftState,error:null};
      }
      return{data:null,error:null};
     };
    },value);
    await page.evaluate(()=>window.CriloMysteryGift.refresh());
   };
   // No stored official Daily = no gift, including owner Test-Run-only users.
   await setServer({eligible:false,available:false,spun:false,discovered:[]});
   assert.equal(await page.locator('#criloMysteryPanel').isVisible(),false,
    width+'px cannot display Mystery Gift before verified official Daily');
   await setServer(stateFor(false));
   assert.equal(await page.locator('#criloMysteryPanel').isVisible(),true);
   assert.equal(await page.locator('#criloMysteryOpen').isVisible(),false,
    width+'px unavailable gift must not spin');
   await page.locator('#criloMysteryShelfButton').click();
   assert.equal(await page.locator('#criloMysteryModal').isVisible(),true);
   assert.equal(await page.locator('#criloMysterySpin').isVisible(),false);
   // Available=false collection-only must not offer a playable wheel.
   // Close before testing today's gift.
   await page.locator('#criloMysteryClose').click();
   await setServer(stateFor(true));
   await page.locator('#criloMysteryOpen').click();
   const bounds=await page.locator('.crilo-mystery-dialog').boundingBox();
   assert.ok(bounds&&bounds.x>=-2&&bounds.x+bounds.width<=width+2,
    width+'px Mystery Gift modal clipped: '+JSON.stringify(bounds));
   await page.locator('#criloMysterySpin').click();
   await page.waitForFunction(()=>document.getElementById('criloMysteryTitle').textContent==='You opened it!',{timeout:7000});
   assert.equal(await page.evaluate(()=>window.__giftSpinCalls),1);
   assert.match(await page.locator('#criloMysteryMessage').textContent(),/Napping Duck/);
   assert.equal(await page.locator('#criloMysterySpin').isVisible(),false);
   assert.match(await page.locator('#criloMysteryProgress').textContent(),/1 \/ 6/);
   await page.locator('#criloMysteryClose').click();
   await page.locator('#criloMysteryOpen').click();
   assert.equal(await page.locator('#criloMysterySpin').isVisible(),false,
    width+'px saved gift must never show a second spin');
   assert.equal(await page.evaluate(()=>window.__giftSpinCalls),1);
   passes++;
   await context.close();
  }
  console.log('MYSTERY_GIFT_BROWSER_PASS: '+passes+' phone/tablet/desktop widths, saved spins, prize collection, eligibility and reroll guard.');
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error('MYSTERY_GIFT_BROWSER_FAIL',e);process.exitCode=1});
