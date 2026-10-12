'use strict';
/* The score display is a static Crilo mini arcade readout, not an animated pill.
   Real Chromium renders mobile/tablet/desktop, light/dark, tiers and owner rows. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  for(const width of [320,390,768,1280]){
   for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:860},reducedMotion:'no-preference'});
    await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/leaderboard.html',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('link[href="arcade-scores.css?v=1"]').count(),1);
    assert.equal(await page.locator('script[src^="score-motion.js"]').count(),0,
      'Leaderboard must never run the per-digit bobbing script');
    assert.equal(await page.locator('link[href^="score-motion.css"]').count(),0,
      'Leaderboard must not load the wheel bobbing stylesheet');
    await page.evaluate(selectedTheme=>{
     document.documentElement.dataset.theme=selectedTheme;
     const panel=document.getElementById('leaderList');
     const score='9,876,543,210';
     panel.innerHTML='<div class="leader-row score-run-row owner-moderated">'+
       '<div class="rank">1</div>'+
       '<div class="leader-player"><a class="leader-name" href="profile.html">CriloPlayer</a><span class="leader-mini">5 spins · 2 ducks</span></div>'+
       '<div class="leader-score-actions"><button class="owner-remove-run" type="button">Remove</button>'+
       '<div class="leader-score" data-score-rarity="mythic">'+score+
       '<small class="leader-score-secondary">Score '+score+' · MYTHIC</small></div></div>'+
       '<button class="mini-wheel" type="button"><img src="blank-wheel.svg" alt="Wheel drawing"></button></div>';
     const top=document.getElementById('bestScore');
     top.textContent='90,734';top.dataset.scoreRarity='rare';
    },theme);
    const get=selector=>page.locator(selector).evaluate(el=>{
     const css=getComputedStyle(el),rect=el.getBoundingClientRect(),
      parent=el.closest('.leader-row')?.getBoundingClientRect();
     return{display:css.display,position:css.position,border:css.borderTopColor,
      shadow:css.boxShadow,color:css.color,contentBefore:getComputedStyle(el,'::before').content,
      decoration:getComputedStyle(el,'::after').content,
      animations:el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length,
      left:rect.left,right:rect.right,parentLeft:parent?.left,parentRight:parent?.right,
      text:el.textContent,font:css.fontSize};
    });
    const row=await get('#leaderList .leader-score'),best=await get('#bestScore');
    assert.ok(['flex','inline-flex'].includes(row.display),
      'Arcade screens should be flex containers (flex children are blockified by CSS)');
    assert.ok(row.shadow.includes('inset'),'Scores need an inset screen rim');
    assert.ok(row.shadow.includes('rgb'),'Scores need visible frame and depth');
    assert.ok(row.contentBefore.includes('C R I L O'),'Branding should be distinct from RNGdle');
    assert.ok(row.decoration.includes('●'),'Arcade readout should have tiny status lights');
    assert.equal(row.animations,0,'No leaderboard bouncing whatsoever');
    assert.equal(best.animations,0,'Top-score number must remain still');
    assert.ok(row.text.startsWith('9,876,543,210'),'Long score was altered');
    assert.ok(best.text.includes('90,734'),'Top score was altered');
    assert.equal(theme==='dark'?best.color:'rgb(49, 122, 192)',best.color,
      'Light rare score should keep the existing rarity ink');
    assert.equal(await page.locator('.leader-score-secondary').innerText(),
      'Score 9,876,543,210 · MYTHIC');
    assert.equal(await page.locator('.owner-remove-run').count(),1,'Owner action lost');
    assert.equal(await page.locator('.mini-wheel img').count(),1,'Wheel art lost');
    const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth,
      viewport:innerWidth,leader:document.querySelector('.leader-panel').getBoundingClientRect().right}));
    assert.ok(overflow.document<=overflow.viewport+2,
      'Leaderboard horizontally overflows viewport '+width+': '+JSON.stringify(overflow));
    assert.deepEqual(errors,[],'Browser errors '+theme+' '+width+': '+errors.join('; '));
    cases++;await context.close();
   }
  }
  console.log('ARCADE_SCORES_BROWSER_PASS '+cases+' responsive static display scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(err=>{console.error('ARCADE_SCORES_BROWSER_FAIL',err);process.exitCode=1});
