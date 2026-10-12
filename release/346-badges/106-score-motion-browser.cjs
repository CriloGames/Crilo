'use strict';
/* Animated scoreboard browser regression, without writing any real runs. */
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
     page.on('pageerror',e=>errors.push(e.message));
     await page.goto(base+'/'+path,{waitUntil:'domcontentloaded',timeout:16000});
     assert.equal(await page.locator('link[href="score-motion.css?v=2"]').count(),1,
      path+' should load scoreboard motion styles only once');
     let selectors;
     if(path==='index.html'){
      await page.locator('#score').waitFor({state:'visible'});
      // Show the already-existing finished-score markup without running a Daily.
      await page.locator('#result').evaluate(el=>el.classList.remove('hidden'));
      selectors=['#score','#finalScore'];
     }else{
      await page.locator('#bestScore').waitFor({state:'visible'});
      // Read-only display fixture for a leaderboard which has no fake run data.
      await page.locator('#leaderList').evaluate(el=>{
       el.innerHTML='<div class="leader-row score-run-row">'+
        '<div class="rank">1</div><div class="leader-player">QA</div>'+
        '<div class="leader-score-actions"><div class="leader-score" data-score-rarity="rare">92</div></div>'+
        '<span class="mini-wheel"></span></div>';
      });
      selectors=['#bestScore','#leaderList .leader-score'];
     }
     for(const selector of selectors){
      const actual=await page.locator(selector).evaluate(element=>{
       const name=getComputedStyle(element).animationName;
       const animation=element.getAnimations().find(a=>a.animationName==='criloScoreSway');
       if(!animation)return{name,animation:false,color:getComputedStyle(element).color};
       animation.pause();
       animation.currentTime=0;
       const first=new DOMMatrix(getComputedStyle(element).transform).m41;
       const widthBefore=element.getBoundingClientRect().width;
       animation.currentTime=3400;
       const last=new DOMMatrix(getComputedStyle(element).transform).m41;
       const widthAfter=element.getBoundingClientRect().width;
       animation.cancel();
       return{name,animation:true,first,last,widthBefore,widthAfter,color:getComputedStyle(element).color};
      });
      if(reduced){
       assert.equal(actual.name,'none',selector+' must respect reduced motion');
       assert.equal(actual.animation,false,selector+' had a live animation in reduced-motion mode');
      }else{
       assert.equal(actual.name,'criloScoreSway',selector+' should sway constantly');
       assert.equal(actual.animation,true,selector+' CSS animation was missing');
       const needed=width<=520&&selector.includes('leader-score')?7:13;
       assert.ok(actual.last-actual.first>=needed,selector+' must drift at least '+needed+'px left/right');
       assert.ok(Math.abs(actual.widthBefore-actual.widthAfter)<.1,
        selector+' must not reflow score columns');
      }
      assert.notEqual(actual.color,'transparent',selector+' lost its score text color');
     }
     if(path==='leaderboard.html'){
      assert.equal(await page.locator('#leaderList .leader-score').evaluate(e=>getComputedStyle(e).color),
       'rgb(49, 122, 192)','Score animation must preserve rare-tier ink');
     }
     const extent=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,viewport:innerWidth
     }));
     assert.ok(extent.scroll<=extent.viewport+2,
      path+' must not overflow horizontally at '+width+'px');
     assert.deepEqual(errors,[],path+' errors at '+width+'px');
     cases++;
     await page.close();
    }
    await context.close();
   }
  }
  console.log('SCORE_MOTION_BROWSER_PASS '+cases+' cases');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error('SCORE_MOTION_BROWSER_FAIL',err);process.exitCode=1});
