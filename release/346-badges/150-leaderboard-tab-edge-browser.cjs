'use strict';
/* Chromium regression: scrolling too far right must not make the leaderboard
 * categories snap left/right or repeatedly change arrow visibility/width. */
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const widths=[320,375,390,430,600,700,768,820,900,1024,1180,1440];

(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let overflowChecked=0,fittedChecked=0;
 try{
  for(const width of widths){
   const context=await browser.newContext({
    viewport:{width,height:860},reducedMotion:'reduce'
   });
   await context.addInitScript({content:mockSupabase});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,route=>route.abort());
   const page=await context.newPage();
   await page.goto(origin+'/leaderboard.html',{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(120);
   const result=await page.evaluate(async()=>{
    const strip=document.getElementById('leaderTabs');
    const wrap=document.querySelector('.leader-tabs-wrap');
    const prev=document.getElementById('leaderTabPrev');
    const next=document.getElementById('leaderTabNext');
    const first=strip.querySelector('[data-tab="today"]');
    const last=strip.querySelector('[data-tab="ducks"]');
    const full=wrap.getBoundingClientRect();
    const snap=getComputedStyle(strip).scrollSnapType;
    const font=getComputedStyle(first).fontSize;
    wrap.classList.toggle('tabs-fit');
    const otherFont=getComputedStyle(first).fontSize;
    wrap.classList.toggle('tabs-fit');
    if(snap!=='none')return{error:'scroll-snap must be none: '+snap};
    if(font!==otherFont)return{error:'font changes when fit class toggles: '+font+' to '+otherFont};
    const overflow=!next.hidden;
    if(!overflow)return{overflow:false};
    const max=Math.max(0,strip.scrollWidth-strip.clientWidth);
    if(max<=0)return{error:'arrow shown but strip has no overflow'};
    strip.scrollTo({left:999999,behavior:'instant'});
    await new Promise(ok=>setTimeout(ok,180));
    const samples=[];
    for(let i=0;i<25;i++){
     await new Promise(requestAnimationFrame);
     const lastRect=last.getBoundingClientRect(),stripRect=strip.getBoundingClientRect();
     samples.push({x:strip.scrollLeft,max:Math.max(0,strip.scrollWidth-strip.clientWidth),
      nextHidden:next.hidden,nextDisabled:next.disabled,previousHidden:prev.hidden,
      stripWidth:strip.clientWidth,wrapWidth:wrap.clientWidth,
      lastVisible:lastRect.right<=stripRect.right+2});
    }
    const end=samples.at(-1);
    if(samples.some(x=>Math.abs(x.x-end.x)>1.5))
     return{error:'scroll offset jittered at the right edge',samples};
    if(samples.some(x=>x.nextHidden!==end.nextHidden||x.stripWidth!==end.stripWidth))
     return{error:'arrow/layout visibility changed at the right edge',samples};
    if(!end.nextDisabled||!end.lastVisible||Math.abs(end.x-end.max)>2)
     return{error:'right edge not settled',end};
    // A further right click cannot animate into an impossible offset.
    next.click();
    await new Promise(ok=>setTimeout(ok,120));
    const after=strip.scrollLeft;
    if(Math.abs(after-end.x)>2)return{error:'right-edge click moved the strip',after,end};
    const beforeWidth=full.width;
    const afterWidth=wrap.getBoundingClientRect().width;
    if(Math.abs(afterWidth-beforeWidth)>1)return{error:'wrapper resized at right edge'};
    strip.scrollTo({left:0,behavior:'instant'});
    await new Promise(ok=>setTimeout(ok,120));
    if(!prev.disabled||next.disabled)return{error:'left edge controls not restored'};
    return{overflow:true,max,stable:true};
   });
   assert.equal(result.error,undefined,width+'px '+JSON.stringify(result).slice(0,3500));
   if(result.overflow)overflowChecked++;else fittedChecked++;
   await context.close();
  }
  assert.ok(overflowChecked>=4,'Need multiple narrow overflow scenarios');
  assert.ok(fittedChecked>=1,'Need at least one full-width fitted scenario');
  console.log('PASS: leaderboard right-edge scroll stable across '+overflowChecked+
   ' overflowing and '+fittedChecked+' fitted viewport sizes');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(err=>{console.error('LEADERBOARD_TAB_EDGE_FAIL',err);process.exitCode=1});
