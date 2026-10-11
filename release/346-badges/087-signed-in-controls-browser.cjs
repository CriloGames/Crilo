'use strict';
/* Isolated signed-in UI interactions; fake Supabase user and RPC responses.
   No production login, email, account changes or moderation writes. */
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const {chromium}=require('playwright'),http=require('node:http'),assert=require('node:assert/strict');
let total=0;function passed(v){total++;console.log('PASS '+v)}
async function open(browser,origin,site,kind='player',width=390){
 const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
 const fixture=mockSupabase.replace('loggedIn:false','loggedIn:true').replace('is_owner:false','is_owner:'+(kind==='owner'));
 await ctx.addInitScript({content:fixture});
 await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'&&!/Failed to load resource: net::ERR_FAILED/.test(msg.text()))errors.push(msg.text())});
 const response=await page.goto(origin+'/'+site,{waitUntil:'domcontentloaded',timeout:14000});
 assert.equal(response.status(),200,site+' unavailable');
 await page.waitForFunction(()=>window.Crilo?.profile?.id,{timeout:11000});
 return{ctx,page,errors};
}
async function test(){
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1280]){
   // Account navigation and safe Settings changes.
   {
    const {ctx,page,errors}=await open(browser,base,'settings.html','player',width);
    assert.equal(await page.locator('#accountBtn').innerText(),'CriloQA');
    await page.locator('#accountBtn').click();assert.ok(await page.locator('#accountMenu').isVisible());
    for(const href of ['profile.html','friends.html','settings.html'])assert.ok((await page.locator('#accountMenu a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))).includes(href));
    await page.locator('h1').click();
    assert.ok(await page.locator('#accountMenu').isHidden(),'Account menu did not close');
    passed('Signed-in profile / Friends / Settings menu '+width);
    await page.locator('#darkBtn').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    await page.locator('#lightBtn').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    await page.locator('#soundBtn').click();await page.waitForFunction(()=>document.getElementById('soundBtn').textContent==='OFF');
    await page.locator('#soundBtn').click();await page.waitForFunction(()=>document.getElementById('soundBtn').textContent==='ON');
    await page.locator('#username').fill('CriloQA2');
    await page.locator('#saveIdentity').click();await page.waitForFunction(()=>document.getElementById('identityStatus').textContent==='Saved.');
    assert.ok(await page.evaluate(()=>window.__qa.requests.some(x=>x[1]==='update_crilo_settings')));
    passed('Signed-in theme, sound, username/save controls '+width);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.locator('#deleteBtn').click();
    assert.ok(await page.locator('#deleteBtn').isEnabled(),'Deletion cancel should not disable control');
    passed('Delete account confirmation can be safely cancelled '+width);
    assert.deepEqual(errors,[],'Settings runtime errors');
    await ctx.close();
   }
   // Friends: invitation, search field and empty/no-match rendering.
   {
    const {ctx,page,errors}=await open(browser,base,'friends.html','player',width);
    await page.waitForFunction(()=>document.getElementById('inviteCode').textContent==='QA123');
    assert.ok(await page.locator('#copyInviteBtn').isEnabled());
    await page.locator('#friendSearch').fill('NoSuchPlayer');
    await page.locator('#searchBtn').click();
    await page.waitForFunction(()=>document.getElementById('searchResults').textContent.includes('No players found'));
    passed('Signed-in Friends invite and search '+width);
    assert.deepEqual(errors,[],'Friends runtime errors');
    await ctx.close();
   }
   // Signed-in Duck collection; test that cards and modal open for eligible ducks.
   {
    const {ctx,page,errors}=await open(browser,base,'ducks.html','player',width);
    await page.waitForFunction(()=>!document.getElementById('duckStatus').textContent.includes('Loading'),{timeout:8000});
    const count=await page.locator('.duck-collection-card').count();
    assert.ok(count>0,'No collection cards rendered');
    const unlocked=page.locator('.duck-unlocked').first();
    if(await unlocked.count()){
     await unlocked.click();
     assert.ok(await page.locator('#duckUnlockModal').isVisible());
     await page.locator('#duckUnlockClose').click();
     assert.ok(await page.locator('#duckUnlockModal').isHidden());
     passed('Unlocked Duck card and close modal '+width);
    }else passed('Locked Duck gallery visible, no unlocked sample in fixture '+width);
    assert.deepEqual(errors,[],'Ducks signed-in runtime errors');
    await ctx.close();
   }
   // Badge collection signed-in; empty catalog is a valid initial state.
   {
    const {ctx,page,errors}=await open(browser,base,'badge-sets.html','player',width);
    await page.waitForFunction(()=>!document.getElementById('collectionNotice').textContent.includes('Loading'));
    assert.ok(await page.locator('#collectionSets').count(),'Collections list missing');
    passed('Signed-in Badge collections initial state '+width);
    assert.deepEqual(errors,[],'Badge collections runtime errors');
    await ctx.close();
   }
   // Owner mode: availability of moderation and analytics entry points; don't
   // click approval, ban, delete, or other real destructive actions.
   {
    const {ctx,page,errors}=await open(browser,base,'settings.html','owner',width);
    assert.ok(await page.locator('#ownerDrawingNav').isVisible(),'Owner moderation nav missing');
    assert.ok(await page.locator('#growthSettingsCard').isVisible(),'Owner analytics card missing');
    assert.ok((await page.locator('#growthSettingsCard a').getAttribute('href')).includes('owner-analytics.html'));
    passed('Owner-only moderation and analytics navigation '+width);
    assert.deepEqual(errors,[],'Owner Settings runtime errors');
    await ctx.close();
   }
   {
    const {ctx,page,errors}=await open(browser,base,'owner-analytics.html','owner',width);
    const days=page.locator('#analyticsDays');
    for(const n of ['7','30','90']){await days.selectOption(n);assert.equal(await days.inputValue(),n)}
    await page.locator('#analyticsReload').click();
    passed('Owner analytics 7/30/90 day selectors and Refresh '+width);
    assert.deepEqual(errors,[],'Owner analytics runtime errors');
    await ctx.close();
   }
  }
  console.log('SIGNED_IN_UI_AUDIT_PASS '+total+' cases');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
test().catch(e=>{console.error('SIGNED_IN_UI_AUDIT_FAIL',e);process.exitCode=1});
