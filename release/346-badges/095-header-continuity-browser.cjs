/* Check cross-document header consistency with slow Supabase restore.
 * Browser runs use fake auth and synthetic friend notifications only. */
'use strict';
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let scenarios=0;
 try{
  for(const width of [390,768,1280]){
   for(const role of ['owner','player']){
    const ctx=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
    const mock=mockSupabase.replace('loggedIn:false','loggedIn:true')
       .replace('is_owner:false','is_owner:'+(role==='owner'));
    const slow="(function(){const orig=window.supabase.createClient;window.supabase.createClient=(...a)=>{const db=orig(...a),get=db.auth.getSession;db.auth.getSession=async(...v)=>{await new Promise(r=>setTimeout(r,700));return get(...v)};return db}})();";
    await ctx.addInitScript({content:mock+slow});
    await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
      route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('#accountBtn').innerText(),'CriloQA');
    assert.equal(await page.locator('#ownerDrawingNav').count(),role==='owner'?1:0);
    assert.ok(await page.locator('#friendBellBtn').isVisible(),'Bell missing on home');
    // Simulate a previously fetched unread count. The following navigation
    // must show the same notification badge without waiting for any new RPC.
    await page.evaluate(()=>window.CriloHeaderContinuity.updateCount(window.Crilo.user.id,3));
    for(const route of ['leaderboard.html','profile.html','friends.html','index.html']){
      await page.goto(origin+'/'+route,{waitUntil:'domcontentloaded'});
      const button=page.locator('#accountBtn');
      // Prepaint is synchronous, ahead of the 700ms auth round trip.
      assert.equal(await button.getAttribute('aria-busy'),'true',
        route+' should be restoring session');
      assert.equal(await button.innerText(),'CriloQA',
        route+' must NOT render SIGN IN / ACCOUNT / blank username');
      assert.equal(await button.evaluate(el=>getComputedStyle(el).visibility),'visible',
        route+' account name should stay visible during navigation');
      assert.equal(await button.evaluate(el=>getComputedStyle(el).color),'rgb(47, 135, 97)',
        route+' username color changed mid-navigation');
      assert.ok(await page.locator('#friendBellBtn').isVisible(),
        route+' notification bell disappeared while navigating');
      if(role==='owner'){
        assert.equal(await page.locator('#ownerDrawingNav').count(),1,
          route+' owner Drawing Review link flashed off');
        assert.equal(await page.locator('#ownerDrawingNav').getAttribute('aria-disabled'),'true',
          route+' cached owner link must not authorize actions before revalidation');
      }else{
        assert.equal(await page.locator('#ownerDrawingNav').count(),0,
          route+' nonowner must not see Drawing Review');
      }
      const badge=await page.locator('#friendBellCount').innerText();
      assert.equal(badge,'3','Cached unread count should be visible before RPC resolution');
      const positions=await page.evaluate(()=>{
        const b=id=>document.getElementById(id)?.getBoundingClientRect();
        const bell=b('friendBellBtn'),name=b('accountBtn'),help=b('helpBtn');
        return {gap:name.left-bell.right,helpGap:help?name.left-help.right:null,
          topbarWidth:document.querySelector('.topbar').getBoundingClientRect().width,
          viewport:innerWidth};
      });
      assert.ok(positions.gap>=-5&&positions.gap<65,'Bell too far from username at '+width+'px: '+positions.gap);
      if(positions.helpGap!==null)
        assert.ok(positions.helpGap>=-5&&positions.helpGap<20,'Question mark too far from username');
      assert.ok(positions.topbarWidth<=positions.viewport+1,'Topbar overflow');
      await page.waitForFunction(()=>document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false');
      assert.equal(await button.innerText(),'CriloQA');
      assert.ok(await page.locator('#friendBellBtn').isVisible());
      assert.equal(await page.locator('#ownerDrawingNav').count(),role==='owner'?1:0);
      if(role==='owner')assert.equal(await page.locator('#ownerDrawingNav').getAttribute('aria-disabled'),null,
        'Owner link should become interactive after verifying Supabase role');
      scenarios++;
    }
    assert.deepEqual(errors,[],role+' '+width+'px script errors');
    await ctx.close();
   }
  }
  console.log('HEADER_CONTINUITY_PASS '+scenarios+' navigation scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('HEADER_CONTINUITY_FAIL',e);process.exitCode=1});
