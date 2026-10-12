'use strict';
/* All launch-page layout audit, using Chromium and an isolated Supabase mock.
   No real account, score, drawing, donation or moderation action is taken. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const pages=[
 'index.html','leaderboard.html','ducks.html','badge-sets.html',
 'profile.html','settings.html','friends.html','support.html',
 'shape-of-sound.html','beetle-tricks.html','domain/',
 'privacy.html','terms.html','moderation.html','owner-analytics.html',
 'owner-dataset-lab.html','badge-art-audit.html','private-nsfw-qa.html'
];
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
  for(const width of [320,390,768,1280,1600]){
   for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
    await context.addInitScript({content:'localStorage.setItem("crilo_theme","'+theme+'");'+mockSupabase});
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
     r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    for(const name of pages){
     const page=await context.newPage(),errors=[];
     page.on('pageerror',error=>errors.push(error.message));
     const response=await page.goto(base+'/'+name,{waitUntil:'domcontentloaded',timeout:18000});
     assert.equal(response?.status(),200,'Unavailable page '+name);
     await page.waitForTimeout(100);
     const ui=await page.evaluate(()=>{
      const w=innerWidth,failedImages=[],badInputs=[],tiny=[];
      for(const im of document.images){
       const s=getComputedStyle(im),r=im.getBoundingClientRect();
       if(s.display==='none'||s.visibility==='hidden'||r.width<2||r.height<2)continue;
       const src=im.currentSrc||im.getAttribute('src')||'';
       if(src&&im.complete&&im.naturalWidth===0&&
          !/^https?:/.test(src))failedImages.push(src.slice(0,110));
      }
      for(const el of document.querySelectorAll('input,textarea,select')){
       const s=getComputedStyle(el),r=el.getBoundingClientRect();
       if(s.display==='none'||s.visibility==='hidden'||r.width<4||el.type==='hidden')continue;
       if(r.right>w+4||r.left< -4)badInputs.push({
        id:el.id,left:Math.round(r.left),right:Math.round(r.right)
       });
      }
      for(const el of document.querySelectorAll('button')){
       const s=getComputedStyle(el),r=el.getBoundingClientRect();
       if(s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)continue;
       if(r.width<12||r.height<12)tiny.push({
        id:el.id,w:Math.round(r.width),h:Math.round(r.height)
       });
      }
      return{width:w,scroll:document.documentElement.scrollWidth,
       failedImages,badInputs,tiny};
     });
     assert.ok(ui.scroll<=width+2,
      name+' '+theme+' '+width+'px overflow: '+JSON.stringify(ui));
     assert.deepEqual(ui.failedImages,[],
      name+' '+theme+' '+width+'px broken visible image(s)');
     assert.deepEqual(ui.badInputs,[],
      name+' '+theme+' '+width+'px clipped input(s)');
     assert.deepEqual(ui.tiny,[],
      name+' '+theme+' '+width+'px tiny buttons');
     // The experimental decorative lines must be absent on every page.
     assert.equal(await page.locator('link[href*="play-accents.css"]').count(),0,
      name+' should not load the retired border-line stylesheet');
     if(name==='index.html'){
      assert.equal(await page.locator('link[href*="daily-drawing-state.css"]').count(),1,
       'Play must retain its dedicated completed-editor styles');
      assert.equal(await page.locator('script[src*="score-motion.js"]').count(),0,
       'Play score should not use continuous per-digit animations');
      assert.equal(await page.locator('link[href*="wheel-neon-rings.css"]').count(),1);
      const neon=await page.evaluate(()=>{
       const wrap=document.getElementById('wheelWrap')?.getBoundingClientRect();
       const draw=document.getElementById('drawing')?.getBoundingClientRect();
       const outer=document.getElementById('wheelNeonOuter');
       const inner=document.getElementById('wheelNeonInner');
       if(!wrap||!draw||!outer||!inner)return{missing:true};
       const o=outer.getBoundingClientRect(),i=inner.getBoundingClientRect();
       return {
        w:wrap.width,d:draw.width,o:o.width,i:i.width,
        oc:Math.abs((o.left+o.right)/2-(wrap.left+wrap.right)/2),
        ic:Math.abs((i.top+i.bottom)/2-(draw.top+draw.bottom)/2),
        pointers:[getComputedStyle(outer).pointerEvents,getComputedStyle(inner).pointerEvents],
        animation:getComputedStyle(outer).animationName,
        mask:getComputedStyle(outer,'::before').maskImage,
        overflow:document.documentElement.scrollWidth>innerWidth+2
       };
      });
      assert.equal(neon.missing,undefined,'Missing wheel neon decoration');
      assert.ok(neon.o>neon.w*.95&&neon.o<neon.w,'Outer glow should hug wheel rim');
      assert.ok(neon.i>neon.d&&neon.i<neon.d+neon.w*.05,
       'Inner glow should sit in the drawing border, not cover artwork');
      assert.ok(neon.oc<2&&neon.ic<2,'Neon rings must remain concentric');
      assert.deepEqual(neon.pointers,['none','none'],'Neon cannot block pen touches');
      assert.equal(neon.animation,'none','Reduced-motion should stop neon movement');
      assert.match(neon.mask,/radial-gradient/,'Neon must mask over drawing');
      assert.equal(neon.overflow,false,'Neon must not cause horizontal overflow');
      const number=await page.locator('#score').evaluate(el=>({
       font:parseFloat(getComputedStyle(el).fontSize),
       bobbing:el.querySelectorAll('.crilo-score-bob-digit').length,
       animation:el.getAnimations().some(a=>a.id==='criloScoreDigitBob')
      }));
      assert.ok(number.font<=49.5,'Home score is too large: '+number.font+'px');
      if(width<=700)assert.ok(number.font<=43.5,
       'Home score is too large for mobile: '+number.font+'px');
      assert.equal(number.bobbing,0,'Score contains unwanted bobbing digit markup');
      assert.equal(number.animation,false,'Home score has repeating bobbing motion');
      // The completed Daily is a single, compact confirmation. The saved
      // score, rarity, and reset timer live elsewhere, not in three tiles.
      const completion=await page.evaluate(()=>{
       const panel=document.getElementById('playedPanel');
       panel.classList.remove('hidden');
       const share=document.getElementById('criloSharePlayed');
       share?.classList.remove('hidden');
       const actions=[...panel.querySelectorAll('a.small-btn,.crilo-share-trigger')];
       const data={oldTiles:!!document.getElementById('dailyCompleteDetails'),
        actions:actions.map(el=>({text:el.textContent.trim(),
         left:el.getBoundingClientRect().left,
         right:el.getBoundingClientRect().right,
         width:el.getBoundingClientRect().width})),
        overflow:document.documentElement.scrollWidth>innerWidth+2};
       share?.classList.add('hidden');panel.classList.add('hidden');
       return data;
      });
      assert.equal(completion.oldTiles,false,'The success card must not repeat score/rarity/countdown');
      assert.equal(completion.actions.length,2,'Keep Leaderboard and Share score actions');
      assert.ok(completion.actions.every(action=>action.left>=-2&&
       action.right<=width+2&&action.width>=20),
       'The completed card actions should fit at '+width+'px '+theme);
      assert.equal(completion.overflow,false,'The completion card must not cause horizontal overflow');

      const result=await page.evaluate(()=>{
       const panel=document.getElementById('drawPanel');
       if(!panel)return{missing:true};
       panel.classList.add('daily-finished');
       const scrim=getComputedStyle(panel,'::after');
       const text=getComputedStyle(panel.firstElementChild);
       const completeNote=document.getElementById('drawCompleteNote');
       const noteStyle=getComputedStyle(completeNote);
       const descStyle=getComputedStyle(document.getElementById('drawPanelDescription'));
       const wheel=document.querySelector('.wheel-wrap').getBoundingClientRect();
       const outcome={
        scrim:scrim.backgroundColor,intercepts:scrim.pointerEvents,
        content:scrim.content,headingOpacity:text.opacity,
        noteVisible:noteStyle.display!=='none',
        noteText:completeNote.textContent,
        originalStatusClipped:descStyle.position==='absolute',
        wheelDiameter:wheel.width,
        removedText:!document.querySelector('.draw-finished-overlay'),
        overflow:document.documentElement.scrollWidth>window.innerWidth+2
       };
       panel.classList.remove('daily-finished');
       return outcome;
      });
      assert.equal(result.missing,undefined,'Drawing panel missing');
      assert.equal(result.scrim,theme==='dark'?'rgba(55, 60, 70, 0.39)':
       'rgba(215, 219, 225, 0.43)',
       'Finished editor should be gently gray in '+theme+' mode');
      assert.equal(result.intercepts,'none','Scrim must not capture clicks');
      assert.equal(result.headingOpacity,'1','Lock label must remain readable above gray panel');
      assert.ok(result.noteVisible&&result.noteText.includes('Daily complete'),
       'Completed editor should explain its disabled state immediately');
      assert.equal(result.originalStatusClipped,true,
       'Hidden duplicate screen-reader status should remain available');
      assert.equal(result.removedText,true,'Old centered completion text remains');
      assert.equal(result.overflow,false,'Finished panel scrim causes overflow');
      if(width>=1024){
       assert.ok(result.wheelDiameter<=Math.min(570,850*.55)+2,
        'Desktop wheel should fit above the score and completed-run actions');
      }
     }else{
      assert.equal(await page.locator('link[href*="daily-drawing-state.css"]').count(),0,
       'Non-Play pages should not load the drawing-only stylesheet');
     }
     if(name==='private-nsfw-qa.html'){
      const night=await page.evaluate(()=>({
       mode:document.documentElement.dataset.theme,
       bg:getComputedStyle(document.body).backgroundColor,
       section:getComputedStyle(document.querySelector('section')).backgroundColor
      }));
      assert.equal(night.mode,theme,'Private QA should follow Crilo theme setting');
      if(theme==='dark'){
       assert.equal(night.bg,'rgb(27, 31, 41)','Private QA body too bright in dark mode');
       assert.equal(night.section,'rgb(38, 44, 56)','Private QA card too bright in dark mode');
      }
     }
     assert.deepEqual(errors,[],name+' '+theme+' '+width+'px script errors');
     checks+=5;
     await page.close();
    }
    await context.close();
   }
  }
  console.log('CRILO_ALL_PAGES_VISUAL_PASS '+checks+' checks across '+pages.length+
   ' pages, 5 widths, 2 themes');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('CRILO_ALL_PAGES_VISUAL_FAIL',e);process.exitCode=1});
