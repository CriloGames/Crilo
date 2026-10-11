'use strict';
// Browser integration test: simulated slow Supabase account restoration.
// Tests signed-in and guest states without touching a live Supabase project.
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const publicPages=['index.html','leaderboard.html','ducks.html','badge-sets.html',
 'friends.html','profile.html','settings.html'];
const ownerPages=['moderation.html','owner-analytics.html'];
async function main(){
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let count=0;
 try{
  for(const mode of ['guest','signed-in']){
   for(const width of [390,1280]){
    const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
    const base=mockSupabase.replace('loggedIn:false','loggedIn:'+(mode==='signed-in'))
      .replace('is_owner:false','is_owner:true');
    const slow="(function(){const orig=window.supabase.createClient;window.supabase.createClient=(...a)=>{const db=orig(...a);const get=db.auth.getSession;db.auth.getSession=async(...v)=>{await new Promise(r=>setTimeout(r,700));return get(...v)};return db}})();";
    await ctx.addInitScript({content:base+slow});
    await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    for(const name of (mode==='signed-in'?[...publicPages,...ownerPages]:publicPages)){
     const page=await ctx.newPage();
     const response=await page.goto(origin+'/'+name,{waitUntil:'domcontentloaded',timeout:16000});
     assert.equal(response.status(),200,name+' missing');
     const button=page.locator('#accountBtn');
     assert.equal(await button.count(),1,name+' missing account control');
     assert.equal(await button.getAttribute('aria-busy'),'true');
     const warm=mode==='signed-in'&&name!=='index.html';
     if(warm){
       assert.equal(await button.evaluate(el=>getComputedStyle(el).visibility),'visible',
         name+' must preserve the already verified username during next-page auth');
       assert.equal(await button.innerText(),'CriloQA',
         name+' flashed SIGN IN / ACCOUNT instead of the previous username');
       assert.equal(await button.evaluate(el=>getComputedStyle(el).color),'rgb(47, 135, 97)',
         name+' flashed the wrong username color');
     }else{
       assert.equal(await button.evaluate(el=>getComputedStyle(el).visibility),'hidden',
         name+' should not expose unverified account content ('+mode+')');
       const solid=await button.evaluate(el=>getComputedStyle(el.parentElement,'::before').backgroundColor);
       assert.equal(solid,'rgb(214, 232, 221)',name+' should reserve a solid-color account placeholder');
     }
     await page.waitForTimeout(190);
     assert.equal(await button.evaluate(el=>getComputedStyle(el).visibility),warm?'visible':'hidden',
       name+' changed account label visibility during initial restoration');
     const reservedWidth=await button.evaluate(el=>el.getBoundingClientRect().width);
     assert.ok(reservedWidth>=40,'Account space collapsed in '+name);
     await page.waitForFunction(()=>document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false',{timeout:11000});
     assert.equal(await button.evaluate(el=>getComputedStyle(el).visibility),'visible');
     assert.equal(await button.innerText(),mode==='signed-in'?'CriloQA':'SIGN IN',
        name+' showed incorrect completed login state');
     const finalGap=await button.evaluate(el=>{
       const r=el.getBoundingClientRect(),w=el.closest('.account-wrap').getBoundingClientRect();
       return w.right-r.right;
     });
     assert.ok(Math.abs(finalGap)<2,'Account label leaves extra white space to its right on '+name);
     count++;
     console.log('PASS no SIGN IN flash '+mode+' '+width+'px '+name);
     await page.close();
    }
    await ctx.close();
   }
  }
  console.log('NO_SIGNIN_FLASH_PASS '+count+' slow-session page loads');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
}
main().catch(e=>{console.error('NO_SIGNIN_FLASH_FAIL',e);process.exitCode=1});
