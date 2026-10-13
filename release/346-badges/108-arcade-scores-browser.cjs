'use strict';
/* The leaderboard score display is a static rarity-colored number in a simple box.
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
    assert.equal(await page.locator('link[href="arcade-scores.css?v=2"]').count(),1);
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
       '<div class="leader-score-wrap"><div class="leader-score" data-score-rarity="mythic">'+score+
       '</div><small class="leader-score-secondary">Score '+score+' · MYTHIC</small></div></div>'+
       '<button class="mini-wheel" type="button"><img src="blank-wheel.svg" alt="Wheel drawing"></button></div>';
     const top=document.getElementById('bestScore');
     top.textContent='90,734';top.dataset.scoreRarity='rare';
     const wheel=document.getElementById('bestDrawing');
     wheel.src='blank-wheel.svg';wheel.classList.remove('hidden');
    },theme);
    const get=selector=>page.locator(selector).evaluate(el=>{
     const css=getComputedStyle(el),rect=el.getBoundingClientRect(),
      parent=el.closest('.leader-row')?.getBoundingClientRect();
     return{display:css.display,position:css.position,border:css.borderTopColor,
      shadow:css.boxShadow,color:css.color,contentBefore:getComputedStyle(el,'::before').content,
      decoration:getComputedStyle(el,'::after').content,
      animations:el.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&
       a.effect?.getKeyframes().some(frame=>frame.transform&&frame.transform!=='none')).length,
      left:rect.left,right:rect.right,parentLeft:parent?.left,parentRight:parent?.right,
      text:el.textContent,font:css.fontSize};
    });
    await page.waitForFunction(()=>document.querySelector('#bestScore').dataset.digits==='5',null,{timeout:3000});
    const row=await get('#leaderList .leader-score'),best=await get('#bestScore');
    assert.ok(['block','inline-block'].includes(row.display),'Score has only a clean frame');
    assert.ok(row.shadow.includes('inset'),'Reverse-neon scores need an inward, not outward, glow');
    assert.ok(row.shadow.includes('rgb'),'Score box should have a soft shadow');
    assert.ok(['none','normal'].includes(row.contentBefore),'Remove extra CRILO lettering');
    assert.ok(['none','normal'].includes(row.decoration),'Remove decorative status lights');
    assert.equal(row.animations,0,'No leaderboard bouncing whatsoever');
    assert.equal(best.animations,0,'Top-score number must remain still');
    assert.equal(row.text,'9,876,543,210','Only the score belongs inside the box');
    assert.ok(best.text.includes('90,734'),'Top score was altered');
    const horizontal=await page.locator('#bestScore').evaluate(el=>{
     const n=el.getBoundingClientRect(),
      w=document.getElementById('bestDrawing').getBoundingClientRect();
     return{gap:w.left-n.right,y:Math.abs((n.top+n.bottom)/2-(w.top+w.bottom)/2)};
    });
    // Current compact hero intentionally keeps the score beside the
    // artwork on phones as well as iPads; compare their layout STAGES,
    // not the typography and image bounding boxes.
    const stages=await page.locator('#bestScore').evaluate(el=>{
     const score=el.closest('.best-score-stage').getBoundingClientRect();
     const art=document.querySelector('.best-art-stage').getBoundingClientRect();
     return{gap:art.left-score.right,
      centerDiff:Math.abs((score.top+score.bottom)/2-(art.top+art.bottom)/2)};
    });
    assert.ok(stages.gap>=4,'Hero score and wheel must be side by side at '+width+': '+JSON.stringify(stages));
    assert.ok(stages.centerDiff<5,'Hero score and art stages must align at '+width+': '+JSON.stringify(stages));
    const hero=await page.locator('#bestScore').evaluate(el=>{
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return{font:parseFloat(s.fontSize),width:r.width,card:el.closest('.best-card').getBoundingClientRect().width};
    });
    assert.ok(hero.font>=20,'Longish score too small to read on '+width);
    assert.ok(hero.width<hero.card*.65,'Score box swallows player artwork on '+width);
    if(width>=768)assert.ok(hero.card<=672,'Top card must respect its 670px max-width');
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
