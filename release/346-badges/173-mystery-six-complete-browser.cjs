'use strict';
/* Completed Mystery collection: server guard and read-only mock browser tests. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/172-mystery-collection-completion.sql','utf8');
const profile=fs.readFileSync('mystery-profile.js','utf8');
const floating=fs.readFileSync('floating-mystery.js','utf8');
const gift=fs.readFileSync('mystery-gift.js','utf8');
const html=fs.readFileSync('profile.html','utf8');
const css=fs.readFileSync('mystery-profile.css','utf8');
const keys=['sleepy_duck','cosmic_quack','backwards_map','tiny_crown','cloud_recipe','lost_button'];
assert.equal((sql.match(/pg_catalog\.pg_advisory_xact_lock/g)||[]).length,2,'Both award RPCs must share a per-user lock');
assert.match(sql,/jsonb_array_length\(v_discovered\)>=6[\s\S]*?'available',false/);
assert.match(sql,/total>=6 AND p_action='enter'/);
assert.match(sql,/total>=6 AND row_state\.claimed_at IS NULL/);
assert.match(sql,/IF chosen IS NOT NULL THEN/);
assert.match(sql,/IF v_prize IS NOT NULL THEN/);
assert.doesNotMatch(sql,/IF chosen IS NULL THEN/);
assert.doesNotMatch(sql,/if v_prize is null then/i);
assert.match(sql,/collection_complete/);
assert.doesNotMatch(sql,/(INSERT INTO|UPDATE|DELETE FROM) public\.(daily_runs|crilo_bonus_runs|user_badges)/i);
assert.match(gift,/collection_complete/);
assert.match(gift,/CriloFloatingMystery\?\.complete/);
assert.match(floating,/state==='complete'/);
assert.match(floating,/type:'complete'/);
assert.match(profile,/for\(const key of found\)/);
assert.match(html,/mystery-profile\.js\?v=6/);
const collection=html.match(/<section id="criloCuriosities"[\s\S]*?<\/dialog>/);
assert.ok(collection);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [375,768,1180]){
   const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+collection[0]+'</body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(items=>{
    window.Crilo={authResolved:true,user:{id:'synthetic-collector'}};
    window.__items=items.slice();
    window.criloDB={rpc:async()=>({data:{eligible:false,available:false,spun:false,collection_complete:true,discovered:window.__items},error:null})};
   },keys);
   await page.addScriptTag({content:floating});
   await page.addScriptTag({content:profile});
   await page.locator('#criloCuriositiesOpen').waitFor({state:'visible'});
   assert.match(await page.locator('#criloCuriositiesCount').textContent(),/6 \/ 6/);
   await page.locator('#criloCuriositiesOpen').click();
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-found').count(),6);
   assert.equal(await page.locator('#criloCuriositiesList li.crilo-curiosity-locked').count(),0);
   assert.equal(await page.locator('#criloCuriositiesList svg').count(),6);
   await page.locator('#criloCuriositiesClose').click();
   await page.evaluate(()=>{
    window.__items=['sleepy_duck'];
    window.dispatchEvent(new Event('crilo-mystery-discovered'));
   });
   await page.waitForFunction(()=>document.querySelectorAll('#criloCuriositiesList li.crilo-curiosity-found').length===1);
   await page.locator('#criloCuriositiesOpen').click();
   assert.equal(await page.locator('#criloCuriositiesList li').count(),1,'Only collected items are visible');
   await page.locator('#criloCuriositiesClose').click();
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Horizontal overflow '+width+'px '+theme+' '+overflow);
   }
   assert.deepEqual(errors,[]);
   await page.close();
  }
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.evaluate(()=>{
   window.Crilo={authResolved:true,user:{id:'finished-account'}};
   window.__checked=0;
   window.criloDB={rpc:async()=>{window.__checked++;return{data:{state:'complete',discovered_count:6},error:null}}};
  });
  await page.addScriptTag({content:floating});
  await page.waitForFunction(()=>window.__checked===1);
  assert.equal(await page.locator('.crilo-wandering-find').count(),0,'No wandering item after 6');
  await page.close();
  console.log('MYSTERY_SIX_COMPLETE_PASS: server guards, six real cards, partial collection, no new visitors, 3 responsive widths');
 }finally{await browser.close()}
})().catch(e=>{console.error('MYSTERY_SIX_COMPLETE_FAIL',e);process.exitCode=1});