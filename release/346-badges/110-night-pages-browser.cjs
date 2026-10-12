'use strict';
/* Real Chromium color QA for owner Drawing Review and all standalone games.
   Fake auth and local static files only: never change live users or scores. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
function rgb(s){const m=s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);if(!m)throw Error('Not rgb: '+s);return m.slice(1,4).map(Number)}
function lum(s){const v=rgb(s).map(n=>{const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]}
function contrast(a,b){const aa=lum(a),bb=lum(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const pages=[
  {url:'moderation.html',selector:'.crilo-review-scan-box',text:'.crilo-review-scan-top strong'},
  {url:'support.html',selector:'.tip-card',text:'.tip-card h1'},
  {url:'beetle-tricks.html',selector:'.beetle-demo-card',text:'.beetle-demo-card h2'},
  {url:'shape-of-sound.html',selector:'.sound-app',text:'.sound-heading h1'},
  {url:'domain/',selector:'.card',text:'.question'},
 ];
 let tests=0;
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:860}});
   await context.addInitScript({content:
    "localStorage.setItem('crilo_theme','dark');"+mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>
    r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   for(const item of pages){
    const page=await context.newPage();
    // The UI of moderation is tested with injected sample rows; no moderation
    // RPC, scan worker or owner permissions are used.
    if(item.url==='moderation.html'){
     await page.route('**/moderation-feed*.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
     await page.route('**/moderation-feedback.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    }
    await page.goto(base+'/'+item.url,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('link[href$="night-pages.css?v=1"]').count(),1,
      item.url+' must load shared night palette');
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    if(item.url==='moderation.html'){
     await page.locator('#drawingReviewList').evaluate(el=>{
      el.innerHTML='<button class="crilo-review-row" type="button">'+
       '<span class="crilo-review-rank">1</span><span class="crilo-review-thumbnail"><img src="blank-wheel.svg"></span>'+
       '<span class="crilo-review-player"><strong>HappyDuck</strong><small>Today</small></span>'+
       '<span class="crilo-review-score">69 pts</span><span class="crilo-review-state">NO FLAGS</span></button>';
     });
     for(const sel of ['.crilo-review-overview>div','.crilo-review-row','.crilo-review-scan-box']){
      const colors=await page.locator(sel).first().evaluate(el=>{
       const s=getComputedStyle(el);
       return{background:s.backgroundColor,text:s.color};
      });
      assert.ok(lum(colors.background)<.095,sel+' white in dark theme: '+colors.background);
      assert.ok(contrast(colors.background,colors.text)>6,sel+' text unreadable');
      tests++;
     }
     const user=await page.locator('.crilo-review-player strong').evaluate(el=>({
      color:getComputedStyle(el).color,
      background:getComputedStyle(el.closest('.crilo-review-row')).backgroundColor
     }));
     assert.ok(contrast(user.color,user.background)>6,'Username invisible in dark review card');
     const filter=await page.locator('#reviewFilter').evaluate(el=>{
      const s=getComputedStyle(el);return{fg:s.color,bg:s.backgroundColor};
     });
     assert.ok(contrast(filter.fg,filter.bg)>=4.5,'Drawing review filter illegible');
     tests+=2;
    }else{
     const card=await page.locator(item.selector).first().evaluate(el=>{
      const s=getComputedStyle(el);return{fg:s.color,bg:s.backgroundColor};
     });
     assert.ok(lum(card.bg)<.12,item.url+' card still too bright: '+card.bg);
     assert.ok(contrast(card.fg,card.bg)>=4.5,item.url+' card text contrast bad');
     tests++;
    }
    if(item.url==='support.html'){
     const pay=await page.locator('.support-pay').evaluate(el=>{
      const s=getComputedStyle(el);return{fg:s.color,bg:s.backgroundColor};
     });
     assert.ok(contrast(pay.fg,pay.bg)>=4.5,'Keep Crilo Spinning checkout button illegible');
     assert.ok(lum(pay.bg)<.25,'Checkout button too bright for dark mode');
     const count=await page.locator('.support-amount').count();
     assert.equal(count,4,'Support amount choices unexpectedly changed');
     tests+=2;
    }
    if(item.url==='beetle-tricks.html'){
     assert.ok(await page.locator('.beetle-demo-card').count()>=5,'Beetle tricks must all remain present');
    }
    const dim=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(dim.page<=dim.viewport+2,item.url+' horizontal overflow at '+width);
    await page.close();
    tests++;
   }
   // Light-mode stays light for standalone pages and can be restored.
   const page=await context.newPage();
   await page.goto(base+'/support.html',{waitUntil:'domcontentloaded'});
   await page.evaluate(()=>{localStorage.setItem('crilo_theme','light');location.reload()});
   await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
   const bg=await page.locator('.tip-card').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.ok(lum(bg)>.70,'Support original light page should stay light');
   tests++;await context.close();
  }
  console.log('NIGHT_PAGES_BROWSER_PASS '+tests);
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('NIGHT_PAGES_BROWSER_FAIL',e);process.exitCode=1});
