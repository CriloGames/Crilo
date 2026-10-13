'use strict';
const http=require('node:http'),a=require('node:assert/strict'),{chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const origin='http://127.0.0.1:'+server.address().port;
 let checks=0;
 try{
 for(const width of [320,390,768,1280]){
  for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript({content:mockSupabase});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errs=[];
   page.on('pageerror',e=>errs.push(e.message));
   await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
   await page.evaluate(theme=>{
    document.documentElement.dataset.theme=theme;
    const el=document.getElementById('newBadgePanel'),result=document.getElementById('result');
    result.classList.remove('hidden');el.classList.remove('hidden');
    document.getElementById('newBadgeCount').textContent='BADGES YOU COULD EARN';
    document.getElementById('newBadgeOrder').textContent='GUEST PREVIEW · NOT AWARDED';
    document.getElementById('newBadgeList').innerHTML=
     '<div class="badge-top-chip new-badge-item guest-badge-item" data-badge-rarity="rare">'+
     '<span class="new-badge-item-copy"><strong>Rare Score</strong><small>RARE · PREVIEW ONLY</small>'+
     '<p>Guest runs do not earn badges.</p></span></div>';
   },theme);
   const panel=page.locator('#newBadgePanel'),summary=panel.locator('summary');
   a.equal(await panel.evaluate(el=>el.open),false,'Collapsed by default');
   a.equal(await panel.locator('div.guest-badge-item').isVisible(),false,'Badge list initially folded');
   await summary.click();a.equal(await panel.evaluate(el=>el.open),true,'Click expands dropdown');
   a.equal(await panel.locator('div.guest-badge-item').isVisible(),true,'Expanded badge visible');
   const metrics=await panel.evaluate(el=>{
    const a=el.getBoundingClientRect(),b=el.closest('#result').getBoundingClientRect();
    return{scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
     panelRight:a.right,resultRight:b.right}
   });
   a.ok(metrics.scrollWidth<=metrics.width+2,'Horizontal overflow '+width+' '+theme+': '+JSON.stringify(metrics));
   await summary.click();a.equal(await panel.evaluate(el=>el.open),false,'Click collapses dropdown');
   a.deepEqual(errs,[],'Browser errors');
   await context.close();checks++;
  }
 }
 console.log('DAILY_BADGE_DROPDOWN_BROWSER_PASS '+checks+' responsive and dark-mode scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(err=>{console.error('DAILY_BADGE_DROPDOWN_BROWSER_FAIL',err);process.exitCode=1});
