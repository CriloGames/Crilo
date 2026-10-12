'use strict';
/* Real Chromium: verify independent Y-axis digit waves with staggered starts,
   score updates, full text, rarity, final-run pops and reduced-motion safety. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  for(const width of [390,768,1280]){
   for(const reduced of [false,true]){
    const context=await browser.newContext({
     viewport:{width,height:860},reducedMotion:reduced?'reduce':'no-preference'
    });
    await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
    await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
    for(const path of ['index.html','leaderboard.html']){
     const page=await context.newPage(),errors=[];
     page.on('pageerror',err=>errors.push(err.message));
     await page.goto(base+'/'+path,{waitUntil:'domcontentloaded',timeout:16000});
     assert.equal(await page.locator('link[href="score-motion.css?v=3"]').count(),1,
      'CSS must load exactly once on '+path);
     assert.equal(await page.locator('script[src="score-motion.js?v=1"]').count(),1,
      'JS digit animator must load exactly once on '+path);
     let selectors;
     if(path==='index.html'){
      await page.locator('#score').waitFor({state:'visible'});
      await page.locator('#result').evaluate(el=>el.classList.remove('hidden'));
      await page.locator('#score').evaluate(el=>el.textContent='12,345');
      await page.locator('#finalScore').evaluate(el=>el.textContent='12,345');
      selectors=['#score','#finalScore'];
     }else{
      await page.locator('#bestScore').waitFor({state:'visible'});
      await page.locator('#bestScore').evaluate(el=>el.textContent='12,345 pts');
      await page.locator('#leaderList').evaluate(el=>{
       el.innerHTML='<div class="leader-row score-run-row">'+
        '<div class="rank">1</div><div class="leader-player">QA</div>'+
        '<div class="leader-score-actions">'+
        '<div class="leader-score" data-score-rarity="rare">12,345'+
        '<small class="leader-score-secondary">Score 42 · RARE</small></div></div>'+
        '<span class="mini-wheel"></span></div>';
      });
      selectors=['#bestScore','#leaderList .leader-score'];
     }
     for(const selector of selectors){
      await page.waitForFunction(sel=>
       document.querySelector(sel)?.querySelectorAll(':scope > .crilo-score-bob-digit').length===5,
       selector);
      const actual=await page.locator(selector).evaluate(el=>{
       const glyphs=[...el.querySelectorAll(':scope > .crilo-score-bob-digit')];
       const before=el.getBoundingClientRect().width;
       const text=el.textContent;
       const first=getComputedStyle(glyphs[0]);
       const a=glyphs[0].getAnimations().find(x=>x.animationName==='criloScoreDigitBob');
       const b=glyphs[1].getAnimations().find(x=>x.animationName==='criloScoreDigitBob');
       if(!a)return{active:false,name:first.animationName,before,text,digits:glyphs.length};
       a.pause();b.pause();a.currentTime=0;b.currentTime=0;
       const x0=new DOMMatrix(getComputedStyle(glyphs[0]).transform).m41;
       a.currentTime=972;
       const upper=new DOMMatrix(getComputedStyle(glyphs[0]).transform);
       b.currentTime=972;
       const following=new DOMMatrix(getComputedStyle(glyphs[1]).transform);
       const after=el.getBoundingClientRect().width;
       a.cancel();b.cancel();
       return{active:true,name:first.animationName,before,after,text,digits:glyphs.length,
        x0,x:upper.m41,y:upper.m42,followingY:following.m42,
        delay1:glyphs[0].style.animationDelay,delay2:glyphs[1].style.animationDelay};
      });
      assert.ok(actual.text.startsWith('12,345'),'Score text was modified by animation');
      if(reduced){
       assert.equal(actual.active,false,'Reduced motion must disable '+selector);
       assert.equal(actual.name,'none','Reduced motion CSS did not apply');
      }else{
       assert.equal(actual.active,true,'Missing glyph animation '+selector);
       assert.equal(actual.name,'criloScoreDigitBob');
       assert.ok(actual.y < -1,'Number must bob upward, not slide sideways');
       assert.ok(Math.abs(actual.x-actual.x0)<.1,'Digits must not move horizontally');
       assert.ok(actual.followingY>actual.y+.15,'Later digit must follow after the earlier one');
       assert.equal(actual.delay1,'0s');assert.equal(actual.delay2,'0.22s');
       assert.ok(Math.abs(actual.before-actual.after)<.1,'Wave changed score column width');
      }
     }
     if(path==='index.html'){
      // Actual score updates still replace the complete number.
      await page.locator('#score').evaluate(el=>el.textContent='987');
      await page.waitForFunction(()=>document.querySelectorAll('#score > .crilo-score-bob-digit').length===3);
      assert.equal(await page.locator('#score').innerText(),'987');
      // The terminal celebration owns the score markup until its class ends.
      await page.locator('#score').evaluate(el=>{
       el.classList.add('crilo-final-animate');
       el.innerHTML='<span class="crilo-final-glyph crilo-final-digit">9</span>';
      });
      await page.waitForTimeout(50);
      assert.equal(await page.locator('#score .crilo-score-bob-digit').count(),0,
       'Idle wave must not overwrite final-spin glyph pops');
      await page.locator('#score').evaluate(el=>{
       el.textContent='987';el.classList.remove('crilo-final-animate');
      });
      await page.waitForFunction(()=>document.querySelectorAll('#score > .crilo-score-bob-digit').length===3);
      assert.equal(await page.locator('#score').innerText(),'987');
     }else{
      const color=await page.locator('#leaderList .leader-score').evaluate(el=>getComputedStyle(el).color);
      assert.equal(color,'rgb(49, 122, 192)','Rare tier score color changed');
      const metadata=await page.locator('.leader-score-secondary').innerText();
      assert.equal(metadata,'Score 42 · RARE','Nested leaderboard text was altered');
      await page.locator('#leaderList .leader-score').evaluate(el=>el.innerHTML='578');
      await page.waitForFunction(()=>document.querySelectorAll('.leader-score > .crilo-score-bob-digit').length===3);
      assert.equal(await page.locator('.leader-score').innerText(),'578');
      // Preserve illustrated Duck leaderboard markup rather than flattening images.
      await page.locator('#leaderList .leader-score').evaluate(el=>{
       el.innerHTML='<img src="duck-classic.svg" alt="duck"> 7';
      });
      await page.waitForTimeout(50);
      assert.equal(await page.locator('.leader-score img').count(),1);
      assert.equal(await page.locator('.leader-score .crilo-score-bob-digit').count(),0);
     }
     const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(dim.width<=dim.viewport+2,'Score animation overflowed at '+width+'px');
     assert.deepEqual(errors,[],'Browser errors '+path+' at '+width+'px');
     cases++;
     await page.close();
    }
    await context.close();
   }
  }
  console.log('SCORE_MOTION_BROWSER_PASS '+cases+' responsive, accessible per-digit wave cases');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error('SCORE_MOTION_BROWSER_FAIL',err);process.exitCode=1});
