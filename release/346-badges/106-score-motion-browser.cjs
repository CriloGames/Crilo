'use strict';
/* Regression for the Play score: no continuous bobbing, slightly smaller
   numbers, and the new finite final-score frame seal respecting reduced motion.
   Use isolated Chromium with mock auth only. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const base='http://127.0.0.1:'+server.address().port;
 let checks=0;
 try{
  for(const width of [320,390,768,1280,1600]){
   for(const reduced of [false,true]){
    const context=await browser.newContext({
     viewport:{width,height:850},reducedMotion:reduced?'reduce':'no-preference'
    });
    await context.addInitScript({content:mockSupabase});
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    const res=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:18000});
    assert.equal(res?.status(),200);
    assert.equal(await page.locator('script[src*="score-motion.js"]').count(),0,
     'Play must not load repeating digit animation JS');
    assert.equal(await page.locator('link[href*="score-motion.css"]').count(),0,
     'Play must not load repeating digit animation CSS');
    const score=page.locator('#score');
    await score.waitFor({state:'visible'});
    const metrics=await score.evaluate(el=>({
     fontSize:parseFloat(getComputedStyle(el).fontSize),
     width:el.getBoundingClientRect().width,
     center:el.getBoundingClientRect().left+el.getBoundingClientRect().width/2,
     viewport:document.documentElement.clientWidth,
     overflow:document.documentElement.scrollWidth>innerWidth+2
    }));
    assert.ok(metrics.fontSize<=49.5,'Score too large at '+width+': '+metrics.fontSize);
    if(width<=700)assert.ok(metrics.fontSize<=43.5,'Mobile score too large');
    assert.ok(!metrics.overflow,'Score page causes horizontal overflow at '+width);
    await score.evaluate(el=>{el.textContent='12,345'});
    await page.locator('#result').evaluate(el=>el.classList.remove('hidden'));
    await page.locator('#finalScore').evaluate(el=>{el.textContent='12,345'});
    await page.waitForTimeout(100);
    for(const selector of ['#score','#finalScore']){
     const result=await page.locator(selector).evaluate(el=>({
      text:el.textContent,
      wrapped:el.querySelectorAll('.crilo-score-bob-digit').length,
      bobbing:el.getAnimations().some(a=>a.id==='criloScoreDigitBob')
     }));
     assert.equal(result.text,'12,345','Number changed at '+selector);
     assert.equal(result.wrapped,0,'Unexpected bobbing digits on '+selector);
     assert.equal(result.bobbing,false,'Continuous score bobbing on '+selector);
    }
    // The one-time finish now lands the intact score in a rarity frame,
    // rather than splitting its digits into animated characters.
    await page.locator('#wheelScorePanel').evaluate(el=>{
     el.dataset.rarity='rare';el.classList.add('crilo-final-settle');
    });
    const motion=await score.evaluate(el=>getComputedStyle(el).animationName);
    if(!reduced)assert.ok(motion.includes('crilo-final-score-settle'),
     'One-time final score seal must animate on motion-enabled devices');
    else assert.equal(motion,'none','Reduced-motion users get a still score');
    assert.equal(await score.textContent(),'12,345',
     'One-time effect must never replace or rearrange saved digits');
    assert.equal(await page.locator('#score .crilo-score-bob-digit').count(),0);
    assert.deepEqual(errors,[],'Page errors at '+width);
    checks++;await context.close();
   }
  }
  console.log('STATIC_HOME_SCORE_BROWSER_PASS '+checks+
   ' viewport/preference combinations, no bobbing, smaller font, finite rarity-frame finish retained');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(err=>{console.error('STATIC_HOME_SCORE_BROWSER_FAIL',err);process.exitCode=1});
