'use strict';
/* Hidden per-spin mystery odds and account-only collection QA.
 * No real players, official scores, or Supabase rows are touched. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/157-mystery-gifts-hidden-spins.sql','utf8');
const home=fs.readFileSync('index.html','utf8');
const profile=fs.readFileSync('profile.html','utf8');
const gift=fs.readFileSync('mystery-gift.js','utf8');
const source=fs.readFileSync('mystery-profile.js','utf8');
const floating=fs.readFileSync('floating-mystery.js','utf8');
const css=fs.readFileSync('mystery-profile.css','utf8');
const game=fs.readFileSync('game.js','utf8');
assert.match(sql,/pg_catalog\.random\(\)<0\.02/,'Use a real 2% roll for each spin');
assert.match(sql,/checked_spins/,'Persist per-spin RNG decisions');
assert.match(sql,/FOR UPDATE/,'Serialize concurrent requests');
assert.match(sql,/v_checked<v_spin_count/,'No HTTP reroll');
assert.match(sql,/public\.crilo_spin_sessions/,'Only official server-confirmed spins');
assert.match(sql,/public\.crilo_daily_penalties/,'Removed Dailies cannot win');
assert.match(sql,/public\.crilo_banned_accounts/,'Suspended accounts cannot win');
assert.doesNotMatch(sql,/(insert into|update|delete from) public\.(daily_runs|user_badges|player_stats|crilo_bonus_runs)/i);
assert.match(gift,/shortcut\.classList\.toggle\('hidden',!waiting\)/,
 'Mystery should be invisible on Daily until a surprise actually appears');
assert.doesNotMatch(gift,/count\+' \/ '\+names\.length\+' mysteries found'/);
assert.match(game,/serverReply&&!guestRun&&!isBonus&&!isTest&&spins>0/);
assert.match(game,/crilo-official-wheel-stopped/);
assert.match(gift,/addEventListener\('crilo-official-wheel-stopped'/);
assert.match(profile,/id="criloCuriosities"/);
assert.match(home,/id="criloMysteryOpenCollection" hidden/);
const markup=profile.match(/<section id="criloCuriosities"[\s\S]*?<\/dialog>/);
assert.ok(markup,'Private Statistics shelf and dialog must exist');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  let tested=0;
  for(const width of [375,820,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+markup[0]+'</body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    window.Crilo={authResolved:false,user:null};
    window.criloDB={rpc:async()=>({data:{eligible:false,available:false,spun:false,discovered:[]},error:null})};
   });
   await page.addScriptTag({content:floating});
   await page.addScriptTag({content:source});
   await page.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
   assert.equal(await page.locator('#criloCuriosities').isVisible(),false,'Guest must not see curiosities');
   await page.evaluate(()=>{
    Crilo.user={id:'owner-qa'};
    criloDB.rpc=async()=>({data:{discovered:[]},error:null});
    window.dispatchEvent(new Event('crilo-auth-ready'));
   });
   await page.locator('#criloCuriositiesOpen').waitFor({state:'visible'});
   assert.match(await page.locator('#criloCuriositiesCount').textContent(),/0 \/ 6/);
   await page.evaluate(()=>{
    criloDB.rpc=async()=>({data:{discovered:['sleepy_duck','tiny_crown']},error:null});
    window.dispatchEvent(new Event('crilo-auth-ready'));
   });
   await page.locator('#criloCuriositiesOpen').waitFor({state:'visible'});
   await page.locator('#criloCuriositiesOpen').click();
   assert.equal(await page.locator('#criloCuriositiesList li').count(),2,'Only found mysteries are shown');
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-found').count(),2);
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-found svg').count(),2,'Earned mysteries show distinct art');
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-locked svg').count(),0,'Locked prizes remain hidden');
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-locked').count(),0);
   assert.match(await page.locator('#criloCuriositiesCount').textContent(),/2 \/ 6/);
   assert.match(await page.locator('#criloCuriositiesDialog').textContent(),/Napping Duck/);
   assert.doesNotMatch(await page.locator('#criloCuriositiesDialog').textContent(),/Backwards Map/);
   await page.locator('#criloCuriositiesClose').click();
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Collection overflows '+width+' '+theme+' by '+overflow);
   }
   await page.close();tested++;
  }
  console.log('HIDDEN_MYSTERY_PASS: 2% official spins, post-stop surprise; permanent private Statistics collection and '+tested+' device widths');
 }finally{await browser.close()}
})().catch(error=>{console.error('HIDDEN_MYSTERY_FAIL',error);process.exitCode=1});
