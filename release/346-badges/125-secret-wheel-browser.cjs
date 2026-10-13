'use strict';
/* A local, read-only Chromium check; deliberately no authenticated writes. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript({content:mockSupabase});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    request=>request.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,request=>request.abort());
   for(const target of ['index.html','leaderboard.html','settings.html','support.html','domain/']){
    const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const result=await page.goto(base+'/'+target,{waitUntil:'domcontentloaded',timeout:18000});
    assert.equal(result.status(),200);
    await page.waitForSelector('#criloAmbientWheels',{timeout:12000});
    await page.waitForTimeout(120);
    const data=await page.evaluate(()=>{
     const fake=[...document.querySelectorAll('.crilo-fake-wheel:not([hidden])')];
     const real=[...document.querySelectorAll('#criloAmbientWheels #secretWheelEntry')];
     return{
      scrollWidth:document.documentElement.scrollWidth,
      viewport:innerWidth,
      fakeCount:fake.length,
      none:fake.every(el=>getComputedStyle(el).pointerEvents==='none'),
      sizes:[...new Set(fake.map(el=>Math.round(el.getBoundingClientRect().width)))].length,
      realCount:real.length,
      realClickable:real.length===1&&getComputedStyle(real[0]).pointerEvents==='auto',
      sameSize:fake.every(el=>el.getBoundingClientRect().width===fake[0].getBoundingClientRect().width)
     };
    });
    assert.ok(data.scrollWidth<=width+2,target+' overflows '+width+'px: '+JSON.stringify(data));
    assert.ok(data.fakeCount>=7,'Not enough dispersed decoys: '+target);
    assert.ok(data.none,'Decorative wheels must not be clickable');
    assert.ok(data.sizes>=3,'Decorative wheels must not look uniform');
    assert.equal(data.realCount,target==='index.html'?1:0,'Exactly one live entry on Play');
    if(target==='index.html'){
     assert.equal(data.realClickable,true,'Real tiny wheel must be accessible');
     await page.locator('#secretWheelEntry').click();
     assert.equal(await page.locator('#secretWheelDialog').evaluate(x=>x.open),true);
     assert.equal(await page.locator('#secretWheelSpin').isDisabled(),true,'Guest must not spin');
     assert.equal(await page.locator('#secretWheelFast').count(),0,'No quick ×10 option');
     assert.equal(await page.locator('#secretWheelRemaining').count(),0,'No attempt limit');
     assert.equal(await page.locator('#secretWheelSpinCount').count(),1);
    }
    if(target==='settings.html'){
     assert.equal(await page.locator('#letterColors').isVisible(),false,'Prize remains locked for guests');
     const fragment=await page.evaluate(()=>window.CriloNameColors.markup({
      username:'Crilo',name_letter_colors:['#FF0000','#00FF00','#0000FF','#FFFF00','#FF00FF']}));
     assert.match(fragment,/<span style="color:#FF0000">C<\/span>/);
    }
    assert.deepEqual(errors,[],target+' '+width+'px page errors');
    checks++;
    await page.close();
   }
   await context.close();
  }
  console.log('SECRET_WHEEL_BROWSER_PASS '+checks+' pages and viewport scenarios');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error('SECRET_WHEEL_BROWSER_FAIL',error);process.exitCode=1});