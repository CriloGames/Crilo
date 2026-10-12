'use strict';
/* Real Chromium regression: smaller, quicker, NON-overlapping digit bobs.
   Verify wave phase timing, nonmoving X, score updates, end-run celebration,
   unchanged rarity ink, mobile overflow and reduced-motion preferences. */
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
    for(const path of ['index.html']){
     const page=await context.newPage(),errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(base+'/'+path,{waitUntil:'domcontentloaded',timeout:16000});
     assert.equal(await page.locator('link[href="score-motion.css?v=4"]').count(),1,
      'Bobbing CSS must load exactly once on '+path);
     assert.equal(await page.locator('script[src="score-motion.js?v=2"]').count(),1,
      'Digit animator must load exactly once on '+path);
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
       const before=el.getBoundingClientRect().width,text=el.textContent;
       const fontSize=parseFloat(getComputedStyle(glyphs[0]).fontSize);
       const animations=glyphs.slice(0,2).map(x=>x.getAnimations().find(a=>a.id==='criloScoreDigitBob'));
       if(!animations[0])return{active:false,before,text,digits:glyphs.length};
       const [a,b]=animations;
       a.pause();b.pause();
       const timingA=a.effect.getTiming(),timingB=b.effect.getTiming();
       const frames=a.effect.getKeyframes();
       const sample=t=>{
        a.currentTime=t;b.currentTime=t;
        const first=new DOMMatrix(getComputedStyle(glyphs[0]).transform);
        const second=new DOMMatrix(getComputedStyle(glyphs[1]).transform);
        return{x:first.m41,y:first.m42,x2:second.m41,y2:second.m42};
       };
       const atRise=sample(125);
       const atDown=sample(285);
       const atNextRise=sample(365+125);
       const after=el.getBoundingClientRect().width;
       a.cancel();b.cancel();
       return{active:true,before,after,text,fontSize,digits:glyphs.length,
        timingA,timingB,frames,atRise,atDown,atNextRise};
      });
      assert.ok(actual.text.startsWith('12,345'),'Score text changed');
      if(reduced){
       assert.equal(actual.active,false,'Reduced motion must disable '+selector);
      }else{
       assert.equal(actual.active,true,'Missing digit bob '+selector);
       assert.equal(actual.timingB.delay-actual.timingA.delay,365,
        'Second digit must wait its full turn');
       assert.ok(actual.timingA.duration<3600,'The wave should be faster than before');
       assert.ok(Math.abs(actual.atRise.y)<actual.fontSize*.085,
        'Digit height must be below 8.5% of its font size');
       assert.ok(actual.frames[2].offset*actual.timingA.duration<
        actual.timingB.delay,'First digit must finish BEFORE next starts');
       assert.ok(actual.atRise.y < -.5,'First digit must rise');
       assert.ok(actual.atRise.y2===0,'Second digit must stay down during first rise');
       assert.ok(Math.abs(actual.atRise.y)<12,'Bounce height must be subtle');
       assert.ok(Math.abs(actual.atDown.y)<.2&&Math.abs(actual.atDown.y2)<.2,
        'Both digits must settle before next begins');
       assert.ok(actual.atNextRise.y2<-.5,'Second digit must rise only after first settles');
       assert.ok(Math.abs(actual.atNextRise.y)<.2,
        'First digit must remain down during second rise');
       assert.ok(Math.abs(actual.atRise.x)<.1&&Math.abs(actual.atRise.x2)<.1,
        'Digits must never move sideways');
       assert.ok(Math.abs(actual.before-actual.after)<.1,'Wave changed column width');
      }
     }
     if(path==='index.html'){
      await page.locator('#score').evaluate(el=>el.textContent='987');
      await page.waitForFunction(()=>document.querySelectorAll('#score > .crilo-score-bob-digit').length===3);
      assert.equal(await page.locator('#score').innerText(),'987');
      await page.locator('#score').evaluate(el=>{
       el.classList.add('crilo-final-animate');
       el.innerHTML='<span class="crilo-final-glyph crilo-final-digit">9</span>';
      });
      await page.waitForTimeout(50);
      assert.equal(await page.locator('#score .crilo-score-bob-digit').count(),0,
       'Idle wave must not override the original final-spin celebration');
      await page.locator('#score').evaluate(el=>{
       el.textContent='987';el.classList.remove('crilo-final-animate');
      });
      await page.waitForFunction(()=>document.querySelectorAll('#score > .crilo-score-bob-digit').length===3);
     }else{
      const color=await page.locator('#leaderList .leader-score').evaluate(el=>getComputedStyle(el).color);
      assert.equal(color,'rgb(49, 122, 192)','Rarity color must not change');
      assert.equal(await page.locator('.leader-score-secondary').innerText(),'Score 42 · RARE');
      await page.locator('#leaderList .leader-score').evaluate(el=>el.innerHTML='578');
      await page.waitForFunction(()=>document.querySelectorAll('.leader-score > .crilo-score-bob-digit').length===3);
      assert.equal(await page.locator('.leader-score').innerText(),'578');
      await page.locator('#leaderList .leader-score').evaluate(el=>{
       el.innerHTML='<img src="duck-classic.svg" alt="duck"> 7';
      });
      await page.waitForTimeout(50);
      assert.equal(await page.locator('.leader-score img').count(),1);
      assert.equal(await page.locator('.leader-score .crilo-score-bob-digit').count(),0);
     }
     const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(dim.width<=dim.viewport+2,'Score overflow at '+width+'px');
     assert.deepEqual(errors,[],'JavaScript errors '+path+' '+width+'px');
     cases++;await page.close();
    }
    await context.close();
   }
  }
  console.log('SCORE_MOTION_BROWSER_PASS '+cases+' sequential wave tests');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error('SCORE_MOTION_BROWSER_FAIL',err);process.exitCode=1});
