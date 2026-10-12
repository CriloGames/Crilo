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
  for(const width of [320,390,768,1280]){
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
     assert.deepEqual(errors,[],name+' '+theme+' '+width+'px script errors');
     checks+=5;
     await page.close();
    }
    await context.close();
   }
  }
  console.log('CRILO_ALL_PAGES_VISUAL_PASS '+checks+' checks across '+pages.length+
   ' pages, 4 widths, 2 themes');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('CRILO_ALL_PAGES_VISUAL_FAIL',e);process.exitCode=1});
