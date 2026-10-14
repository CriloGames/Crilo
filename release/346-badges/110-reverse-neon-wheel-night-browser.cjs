'use strict';
/* Chromium visual checks: cohesive reverse-neon score frames on Play, Rankings
   and Statistics, plus canvas-level dark-wheel colors (no image filters).
   Supabase is fully mocked: no real scores, accounts or pictures are changed. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
function luminance(pixel){
 const f=n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
 return f(pixel[0])*.2126+f(pixel[1])*.7152+f(pixel[2])*.0722;
}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const root='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let pass=0;
 try{
  for(const width of [390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   await context.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   for(const path of ['index.html','leaderboard.html','profile.html']){
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(root+'/'+path,{waitUntil:'domcontentloaded',timeout:16000});
    assert.equal(await page.locator('link[href="rarity-score-frames.css?v=3"]').count(),1,
      path+' did not load reversed-neon scoreboard');
    if(path==='leaderboard.html') assert.equal(
      await page.locator('link[href="top-score-row.css?v=7"]').count(),1,
      'Leaderboard must load its polished horizontal hero layout');
    if(path==='leaderboard.html') assert.equal(
      await page.locator('script[src="top-score-fit.js?v=1"]').count(),1,
      'Leaderboard must resize large scores without altering their value');
    if(path==='index.html'){
     await page.locator('#wheel').waitFor({state:'visible'});

    // Measure both the numerical text and its OUTER FRAME using Chromium's
    // actual layout boxes. This catches accidental negative tracking, a
    // displaced single '0', animated glyph drift and oversized score chips.
    async function scoreCentered(selector,parentSelector,values){
     for(const value of values){
      await page.locator(selector).evaluate((el,text)=>{el.textContent=text},value);
      // Continuous bobbing was intentionally removed; plain, steady digits
      // should still be centered in their rarity-colored frames.
      assert.equal(await page.locator(selector+' .crilo-score-bob-digit').count(),0,
       selector+' must not recreate the retired score bobbing effect');
      const centered=await page.locator(selector).evaluate((el,pSel)=>{
       const rect=el.getBoundingClientRect();
       const range=document.createRange();range.selectNodeContents(el);
       const glyphs=range.getBoundingClientRect();
       const parent=el.closest(pSel),stage=parent?.getBoundingClientRect();
       const css=getComputedStyle(el);
       return{
        digits:(el.textContent||'').trim(),
        rendered:el.innerText,
        textDelta:Math.abs((glyphs.left+glyphs.right-rect.left-rect.right)/2),
        frameDelta:stage?Math.abs((rect.left+rect.right-stage.left-stage.right)/2):null,
        tracking:css.letterSpacing,
        frameWidth:rect.width,viewport:innerWidth,
        overflow:document.documentElement.scrollWidth-innerWidth
       };
      },parentSelector);
      assert.equal(centered.rendered,value,
       selector+' should render every digit on one line without inserted line breaks');
      assert.ok(centered.textDelta<=2.5,
       selector+' digits '+value+' are not centered within their frame: '+JSON.stringify(centered));
      assert.ok(centered.frameDelta<=2.5,
       selector+' frame '+value+' does not line up with its slot: '+JSON.stringify(centered));
      assert.ok(centered.overflow<=2,
       selector+' causes horizontal overflow at '+width+'px');
     }
    }

     await scoreCentered('#score','.wheel-score',['0','7','69','1,234']);
     await page.locator('#result').evaluate(el=>el.classList.remove('hidden'));
     await scoreCentered('#finalScore','#result',['0','69','1,234']);

     const pixel=()=>page.locator('#wheel').evaluate(el=>{
      const ctx=el.getContext('2d');
      return [...ctx.getImageData(375,68,1,1).data];
     });
     await page.waitForFunction(()=>{
      const canvas=document.getElementById('wheel');return canvas?.getContext('2d')
       .getImageData(375,68,1,1).data[3]===255;
     });
     const daylight=await pixel();
     const center=await page.locator('#drawing').evaluate(el=>({
      content:el.toDataURL(),background:getComputedStyle(el).backgroundColor
     }));
     await page.evaluate(()=>document.documentElement.dataset.theme='dark');
     await page.waitForFunction(expected=>{
      const p=document.getElementById('wheel').getContext('2d').getImageData(375,68,1,1).data;
      return p[0]!==expected[0]||p[1]!==expected[1]||p[2]!==expected[2];
     },daylight);
     const nighttime=await pixel();
     assert.ok(luminance(nighttime)<luminance(daylight)*.60,
      'The wheel itself must get noticeably softer in dark mode: '+daylight+' -> '+nighttime);
     assert.deepEqual(await page.locator('#drawing').evaluate(el=>({
      content:el.toDataURL(),background:getComputedStyle(el).backgroundColor
     })),center,'Night wheel must preserve the existing drawing canvas');
     for(const rarity of ['trash','common','uncommon','rare','epic','anomaly','mythic']){
      await page.locator('#wheelScorePanel').evaluate((el,tier)=>{el.dataset.rarity=tier},rarity);
      const box=await page.locator('#score').evaluate(el=>{
       const c=getComputedStyle(el);return{shadow:c.boxShadow,border:c.borderTopWidth,
        color:c.color,transform:c.transform};
      });
      assert.ok(box.shadow.includes('inset'),'The live score needs reverse-neon inward glow');
      assert.ok(parseFloat(box.border)>=1,'The live score must keep its rarity frame');
     }
     // A final spin may briefly settle into its score frame. Its CSS
     // animation is finite and never rewrites the displayed number.
     await page.locator('#wheelScorePanel').evaluate(el=>{
      el.dataset.rarity='rare';el.classList.add('crilo-final-settle');
     });
     const finish=await page.locator('#score').evaluate(el=>({
      name:el.getAnimations().map(a=>a.animationName||''),
      label:el.textContent,
      width:el.getBoundingClientRect().width
     }));
     assert.ok(finish.name.includes('crilo-final-score-settle'),
      'A final spin should have a subtle, finite score settle animation');
     assert.ok(finish.width>10,'Final score box must remain visible');
     await page.locator('#wheelScorePanel').evaluate(el=>el.classList.remove('crilo-final-settle'));
     await page.locator('#result').evaluate(el=>{
      el.classList.remove('hidden');el.dataset.rarity='mythic';
     });
     const final=await page.locator('#finalScore').evaluate(el=>({
      content:el.textContent,shadow:getComputedStyle(el).boxShadow
     }));
     assert.ok(final.shadow.includes('inset'),'Completed Daily needs matching glow');
     await page.evaluate(()=>document.documentElement.dataset.theme='light');
     await page.waitForFunction(expected=>{
      const now=document.getElementById('wheel').getContext('2d').getImageData(375,68,1,1).data;
      return now[0]===expected[0]&&now[1]===expected[1]&&now[2]===expected[2];
     },daylight);
     pass++;
    }else if(path==='leaderboard.html'){
     await page.locator('#leaderList').evaluate(el=>{
      el.innerHTML='<div class="leader-row score-run-row">'+
       '<div class="rank">1</div><div class="leader-player">QA</div>'+
       '<div class="leader-score-actions"><div class="leader-score-wrap">'+
       '<div class="leader-score" data-score-rarity="rare">92</div></div></div></div>';
     });
     const score=await page.locator('#leaderList .leader-score').evaluate(el=>({
      text:el.textContent,shadow:getComputedStyle(el).boxShadow,
      before:getComputedStyle(el,'::before').content
     }));
     assert.equal(score.text,'92');
     assert.ok(score.shadow.includes('inset'),'Leaderboard needs inward glow');
     assert.ok(['none','normal'].includes(score.before),'No labels inside box');
     await page.locator('#bestScore').evaluate(el=>{el.textContent='69';el.dataset.scoreRarity='rare'});
     await page.locator('#bestDrawing').evaluate(el=>{el.src='blank-wheel.svg';el.classList.remove('hidden')});
     assert.equal(await page.locator('.best-card .best-crown svg').count(),1,
      'Celebratory topper must be decorative SVG, not player art');
     await page.locator('#bestDrawing').evaluate(async el=>{
      await el.decode();
      const before=el.getBoundingClientRect(),first=el.currentSrc;
      el.src='default-wheel.svg';await el.decode();
      const after=el.getBoundingClientRect();
      if(first===el.currentSrc)throw Error('Best run art is hardcoded');
      if(Math.abs(after.width-before.width)>1||Math.abs(after.height-before.height)>1)
       throw Error('Changing artwork resized the top-run frame');
     });
     const top=await page.locator('#bestScore').evaluate(el=>{
      const score=el.getBoundingClientRect();
      const art=document.getElementById('bestDrawing').getBoundingClientRect();
      const s=getComputedStyle(el);
      return{font:parseFloat(s.fontSize),display:s.display,
       scoreX:score.left,scoreRight:score.right,
       scoreY:(score.top+score.bottom)/2,
       artX:art.left,artRight:art.right,
       artY:(art.top+art.bottom)/2,
       shadow:s.boxShadow,bg:getComputedStyle(el.closest('.best-card')).backgroundImage,
       overflow:document.documentElement.scrollWidth-innerWidth};
     });
     assert.ok(top.font>=24,'Keep a readable large top score on every device');
     assert.ok(['flex','block'].includes(top.display),'Top score must remain a number box');
     if(width<=440){
      // The polished compact hero intentionally keeps score LEFT of artwork.
      const compact=await page.locator('#bestScore').evaluate(el=>{
       const a=el.getBoundingClientRect(),b=document.getElementById('bestDrawing').getBoundingClientRect();
       const scoreStage=el.closest('.best-score-stage').getBoundingClientRect();
       const artStage=document.querySelector('.best-art-stage').getBoundingClientRect();
       return{gap:b.left-a.right,center:Math.abs((scoreStage.top+scoreStage.bottom)/2-(artStage.top+artStage.bottom)/2)};
      });
      assert.ok(compact.gap>=4,'Phone hero score should sit beside the wheel: '+JSON.stringify(compact));
      assert.ok(compact.center<5,'Phone hero score and art stages should align vertically: '+JSON.stringify(compact));
     }else{
      assert.ok(top.scoreRight+5<top.artX,
       'Desktop score belongs on the LEFT, drawing on the RIGHT');
      const stageDelta=await page.locator('#bestScore').evaluate(el=>{
       const a=el.closest('.best-score-stage').getBoundingClientRect();
       const b=document.querySelector('.best-art-stage').getBoundingClientRect();
       return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2);
      });
      assert.ok(stageDelta<5,
       'Desktop score and wheel stages should align vertically: '+stageDelta);
     }
     const heroCenter=await page.locator('#bestScore').evaluate(el=>{
      const box=el.getBoundingClientRect(),stage=el.closest('.best-score-stage').getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(el);
      const ink=range.getBoundingClientRect();
      return{frame:Math.abs((box.left+box.right-stage.left-stage.right)/2),
       ink:Math.abs((ink.left+ink.right-box.left-box.right)/2)};
     });
     assert.ok(heroCenter.frame<2.5&&heroCenter.ink<2.5,
      'Leaderboard hero rarity number must be centered: '+JSON.stringify(heroCenter));
     const miniCenter=await page.locator('#leaderList .leader-score').evaluate(el=>{
      const box=el.getBoundingClientRect(),range=document.createRange();
      range.selectNodeContents(el);const ink=range.getBoundingClientRect();
      return Math.abs((ink.left+ink.right-box.left-box.right)/2);
     });
     assert.ok(miniCenter<2.5,'Leaderboard number inside its chip is off center');
     assert.ok(top.shadow.includes('inset'),'Keep reverse-neon rarity number frame');
     assert.ok(top.bg.includes('gradient'),'Keep classic pastel hero background');
     assert.ok(top.overflow<=2,'Top card caused mobile horizontal overflow');
     // A large official score must shrink within its card, not displace the wheel.
     await page.locator('#bestScore').evaluate(el=>{el.textContent='12,345,678'});
     await page.waitForFunction(()=>document.querySelector('#bestScore').dataset.digits==='8',null,{timeout:3000});
     const score8=await page.locator('#bestScore').evaluate(el=>({
      width:el.getBoundingClientRect().width,font:parseFloat(getComputedStyle(el).fontSize),
      content:el.textContent
     }));
     assert.equal(score8.content,'12,345,678','Score shrinking must not change saved points');
     assert.ok(score8.width<width*.8,'Eight digit score overflows the phone view');
     const extra=await page.locator('.best-card').evaluate(el=>{
      const s=getComputedStyle(el),heading=getComputedStyle(el.querySelector('#bestHeading'));
      const pill=getComputedStyle(el.querySelector('#bestStats'));
      return{width:el.getBoundingClientRect().width,bg:s.backgroundImage,
       heading:heading.color, pillBackground:pill.backgroundColor,
       artWidth:el.querySelector('#bestDrawing').getBoundingClientRect().width};
     });
     assert.ok(extra.width<=width,'Top score hero too wide at '+width);
     if(width>=768)assert.ok(extra.width<=672,'Leaderboard hero should respect the current 670px max-width design: '+extra.width);
     assert.ok(extra.artWidth>=100,'Drawing became too small at '+width);
     assert.ok(extra.bg.includes('gradient'),'Top score hero lost pastel treatment');
     await page.locator('#bestDrawing').evaluate(el=>el.classList.add('hidden'));
     const centered=await page.locator('#bestScore').evaluate(el=>{
      const b=el.getBoundingClientRect(),c=el.closest('.best-card').getBoundingClientRect();
      return Math.abs((b.left+b.right)/2-(c.left+c.right)/2);
     });
     assert.ok(centered<3,'Categories without a drawing should center the score');

     await page.evaluate(()=>document.documentElement.dataset.theme='dark');
     const night=await page.locator('#leaderList .leader-score').evaluate(el=>getComputedStyle(el).boxShadow);
     assert.ok(night.includes('inset'),'Leaderboard dark version must have inward glow');
     assert.equal(await page.locator('#leaderList .crilo-score-bob-digit').count(),0,
      'Leaderboard must not bounce');
     pass++;
    }else{
     await page.locator('#spinHistoryList').evaluate(el=>{
      el.innerHTML='<article class="spin-history-item" data-rarity="epic">'+
       '<div class="spin-history-detail"><div class="spin-history-event">Oct 11</div></div>'+
       '<div class="spin-history-side"><strong class="spin-history-score">123</strong>'+
       '<small class="spin-history-units">PTS</small></div>'+
       '<button class="spin-history-wheel"><img src="blank-wheel.svg" alt="blank"></button></article>';
     });
     for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const score=await page.locator('.spin-history-score').evaluate(el=>{
       const style=getComputedStyle(el),r=el.getBoundingClientRect();
       return{text:el.textContent,shadow:style.boxShadow,border:style.borderTopWidth,
        x:r.left,right:r.right};
      });
      assert.equal(score.text,'123','History box must contain only digits');
      assert.ok(score.shadow.includes('inset'),'Spin History reverse-neon glow missing');
      assert.ok(parseFloat(score.border)>=1);
      assert.equal(await page.locator('.spin-history-units').innerText(),'PTS');
      assert.equal(await page.locator('.spin-history-wheel img').count(),1,
       'Saved drawing must remain unaffected');
     }
     pass++;
    }
    assert.deepEqual(errors,[],'Page JavaScript errors '+path+' on '+width);
    await page.close();
   }
   await context.close();
  }
  console.log('REVERSE_NEON_WHEEL_NIGHT_BROWSER_PASS '+pass+' responsive page/theme checks');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('REVERSE_NEON_WHEEL_NIGHT_BROWSER_FAIL',e);process.exitCode=1});
