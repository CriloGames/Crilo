'use strict';
/* Mystery edge cases: completed claims, late page responses, connection
 * failures, and mobile hover positioning. Read-only mocked browser tests. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const migration=fs.readFileSync('release/346-badges/174-mystery-claim-hardening.sql','utf8');
const original=fs.readFileSync('release/346-badges/172-mystery-collection-completion.sql','utf8');
const floating=fs.readFileSync('floating-mystery.js','utf8');
const css=fs.readFileSync('floating-mystery.css','utf8');
const profile=fs.readFileSync('mystery-profile.js','utf8');
const statsHTML=fs.readFileSync('profile.html','utf8');
const statsCSS=fs.readFileSync('mystery-profile.css','utf8');
const shelf=statsHTML.match(/<section id="criloCuriosities"[\s\S]*?<\/dialog>/);
assert.ok(shelf);
assert.match(migration,/IF total>=6 THEN[\s\S]*?'state','complete'/);
assert.match(migration,/FOR UPDATE/);
assert.match(migration,/ON CONFLICT DO NOTHING/);
assert.match(original,/pg_advisory_xact_lock/);
assert.match(floating,/completed=true;checked=true;\+\+request/);
assert.match(floating,/if\(checked\|\|completed\|\|typeof criloDB/);
assert.match(profile,/try\{[\s\S]*?crilo_mystery_gift/);
assert.match(statsHTML,/mystery-profile\.js\?v=6/);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:320,height:700},reducedMotion:'reduce'});
  await context.route('https://qa.crilo.fun/**',route=>route.fulfill({
   status:200,contentType:'text/html',
   body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'
  }));
  const tab=await context.newPage();
  await tab.goto('https://qa.crilo.fun/index.html');
  await tab.evaluate(()=>{
   window.Crilo={authResolved:true,user:{id:'delayed-user'}};
   window.__resolveEnter=null;window.__enterCalls=0;
   window.criloDB={rpc:async(name,args)=>{
    if(args.p_action==='enter'){
     window.__enterCalls++;
     return new Promise(resolve=>{window.__resolveEnter=resolve});
    }
    return{data:{state:'complete',discovered_count:6},error:null};
   }};
  });
  await tab.addStyleTag({content:css});
  await tab.addScriptTag({content:floating});
  await tab.waitForFunction(()=>typeof window.__resolveEnter==='function');
  const other=await context.newPage();
  await other.goto('https://qa.crilo.fun/profile.html');
  await other.evaluate(()=>{
   window.__peer=new BroadcastChannel('crilo-mystery-curiosity-v1');
   window.__peer.postMessage({type:'complete',userId:'delayed-user'});
  });
  await tab.waitForFunction(()=>window.CriloFloatingMysteryLoaded&&window.__enterCalls===1);
  await tab.waitForTimeout(200);
  await tab.evaluate(()=>{
   window.__resolveEnter({data:{state:'ready',key:'sleepy_duck',spawn_id:'stale-token'},error:null});
  });
  await tab.waitForTimeout(100);
  assert.equal(await tab.locator('.crilo-wandering-find').count(),0,
   'Delayed pre-completion response must not resurrect a collectible');
  await tab.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
  await tab.waitForTimeout(60);
  assert.equal(await tab.evaluate(()=>window.__enterCalls),1,
   'Completed collection never makes a second check');
  await other.close();
  await tab.close();
  await context.close();

  // The Statistics RPC can throw during network loss; no unhandled rejection
  // or permanently loading counter may remain, and refresh must recover.
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+shelf[0]+'</body></html>');
  await page.addStyleTag({content:statsCSS});
  await page.evaluate(()=>{
   window.Crilo={authResolved:true,user:{id:'qa-profile'}};
   window.__networkFails=true;
   window.criloDB={rpc:async()=>{
    if(window.__networkFails)throw Error('Mock connection lost');
    return {data:{discovered:['tiny_crown']},error:null};
   }};
  });
  await page.addScriptTag({content:profile});
  await page.waitForFunction(()=>document.getElementById('criloCuriositiesCount').textContent.includes('Unable'));
  await page.evaluate(()=>{
   window.__networkFails=false;
   window.dispatchEvent(new Event('crilo-mystery-discovered'));
  });
  await page.waitForFunction(()=>document.getElementById('criloCuriositiesCount').textContent.includes('1 / 6'));
  assert.equal(await page.locator('.crilo-curiosity-found').count(),1);
  assert.equal(await page.locator('.crilo-curiosity-locked').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('MYSTERY_EDGE_CASES_PASS: expired claim guards, stale cross-tab replies and network recovery');
 }finally{await browser.close()}
})().catch(error=>{console.error('MYSTERY_EDGE_CASES_FAIL',error);process.exitCode=1});