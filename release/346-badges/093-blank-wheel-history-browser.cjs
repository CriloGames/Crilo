'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
function installFakeDaily(){
 const orig=window.supabase.createClient;
 window.supabase.createClient=(...args)=>{
  const db=orig(...args),from=db.from;
  db.from=table=>{
   if(table!=='daily_runs')return from(table);
   const date=new Date(Date.now()-22*3600000).toISOString().slice(0,10);
   const daily={
    id:93,user_id:'11111111-1111-4111-8111-111111111111',is_test:false,
    daily_period:date,created_at:new Date().toISOString(),score:23,spins:10,
    upgrades:0,doubles:0,ducks:1,verified_spin_session_id:'proof',
    drawing:null,results:[{type:'num',points:3},{type:'duck',points:0},{type:'num',points:20}]
   };
   let rows=[daily],fields='';
   const q={
    select(v){fields=v;return q},
    eq(k,v){if(k==='user_id'||k==='is_test'||k==='daily_period')rows=rows.filter(r=>r[k]===v);return q},
    not(){return q},gte(){return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},
    range(a,b){const data=rows.slice(a,b+1);return Promise.resolve({data:fields==='spins'?data.map(r=>({spins:r.spins})):data,error:null})},
    maybeSingle(){return Promise.resolve({data:rows[0]||null,error:null})},
    single(){return Promise.resolve({data:rows[0]||null,error:null})},
    then(yes,no){return Promise.resolve({data:rows,error:null}).then(yes,no)}
   };
   return q;
  };
  return db;
 };
}
(async()=>{
 const server=http.createServer(serve);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checked=0;
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
   await ctx.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')+';('+installFakeDaily.toString()+')()'});
   await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   for(const pageFile of ['leaderboard.html','profile.html']){
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/'+pageFile,{waitUntil:'domcontentloaded'});
    const image=pageFile==='leaderboard.html'?page.locator('#bestDrawing'):page.locator('.spin-history-wheel img').first();
    await image.waitFor({state:'visible',timeout:10000});
    assert.equal(await image.getAttribute('src'),'blank-wheel.svg','Blank drawing must show a white wheel with no fake artwork');
    assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0),'SVG failed to load');
    const white=await image.evaluate(el=>{
      const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;
      const ctx=canvas.getContext('2d');ctx.drawImage(el,0,0,10,10);
      return [...ctx.getImageData(5,5,1,1).data];
    });
    assert.deepEqual(white,[255,255,255,255],'Blank wheel center must be pure white, with no colored segments');
    const rim=pageFile==='leaderboard.html'?page.locator('#bestDrawing'):page.locator('.spin-history-wheel').first();
    const border=await rim.evaluate(el=>({width:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor}));
    if(pageFile==='leaderboard.html'){
     // The hero adds a white mat and lavender outline outside the actual
     // player artwork. Blank-wheel.svg remains white and its saved pixels
     // are never repainted or altered.
     assert.equal(border.color,'rgb(255, 255, 255)',
      'Hero artwork must have the white inner mat shown in the Crilo mockup');
     const ring=await rim.evaluate(el=>({style:getComputedStyle(el).outlineStyle,
      width:getComputedStyle(el).outlineWidth,color:getComputedStyle(el).outlineColor}));
     assert.equal(ring.style,'solid','The hero needs a clear outer frame');
     assert.ok(parseFloat(ring.width)>=3,'Outer lavender ring must be visible');
     assert.notEqual(ring.color,'rgb(255, 255, 255)','Ring must stand apart from white paper');
    }else{
     assert.equal(border.color,'rgb(23, 25, 30)','History wheel needs original black rim');
    }
    // Leaderboard's 3px white mat has its own lavender outline; the
    // History thumbnails retain the original 4px black wheel border.
    const minimum=pageFile==='leaderboard.html'?3:4;
    assert.ok(parseFloat(border.width)>=minimum,
     'Unexpected '+pageFile+' '+width+'px wheel rim: '+JSON.stringify(border));
    if(pageFile==='leaderboard.html'){
     await page.waitForFunction(()=>document.querySelectorAll('.leader-list .mini-wheel').length>0);
     const btn=page.locator('#leaderList .mini-wheel');
     assert.equal(await btn.count(),1,'Blank drawing must still have wheel button');
     assert.equal(await page.locator('#criloWheelPreview').isVisible(),false,'Wheel preview starts closed');
     await btn.click();
     assert.equal(await btn.locator('img').evaluate(el=>el.getAnimations().length),0,'Thumbnail must not spin on opening');
     assert.ok(await page.locator('#criloWheelPreview').isVisible(),'Leaderboard wheel did not expand');
     assert.equal(await page.locator('.crilo-wheel-preview-image').getAttribute('src'),'blank-wheel.svg',
      'Enlarged leaderboard wheel changed the blank drawing');
     await page.locator('.crilo-wheel-preview-spin').click();
     assert.equal(await page.locator('.crilo-wheel-preview-spin').getAttribute('data-spins'),'1',
      'Clicking the enlarged leaderboard wheel must spin it');
     await page.locator('.crilo-wheel-preview-close').click();
     assert.equal(await page.locator('#criloWheelPreview').isVisible(),false,'Preview close button failed');
     await page.locator('#bestDrawing').click();
     assert.ok(await page.locator('#criloWheelPreview').isVisible(),'Top player drawing should also expand');
     await page.keyboard.press('Escape');
     assert.equal(await page.locator('#criloWheelPreview').isVisible(),false,'Escape should close enlarged leaderboard drawing');
    }else{
     await page.waitForFunction(()=>document.querySelectorAll('.spin-history-item').length===1);
     assert.equal(await page.locator('.spin-history-item').count(),1,'Ten spins must display as one scored Daily');
     await page.waitForFunction(()=>document.getElementById('spinHistoryCount')?.textContent==='1 Daily completed');
     assert.match(await page.locator('#spinHistorySpinCount').innerText(),/10 wheel spins in Dailies/);
     assert.ok(await page.locator('#spinHistoryPager').isHidden(),'One saved Daily cannot have older pages');
     assert.ok(await page.locator('#spinHistoryEnd').isVisible(),'Single saved Daily must show an explicit end');
     const text=await page.locator('#spinHistoryList').innerText();
     assert.ok(text.includes('10 spins')&&text.includes('23'),'Daily card must show saved spin count and final score');
     assert.ok(!text.includes('DUCK!')&&!text.includes('Landed '),'Do not show individual spin or badge-like events');
     assert.equal(await page.locator('.spin-history-wheel').count(),1);
     assert.equal(await page.locator('.spin-history-status').count(),0,'No verification status labels should appear');
     assert.ok(!/Verified Daily|Earlier Daily/.test(text),'Daily cards should not show verification labels');
     assert.ok(!(await page.locator('#spinHistoryList').innerText()).includes('Badge earned'),'Spin history must not show badge unlocks');
     await page.locator('.spin-history-wheel').first().click();
     assert.equal(await image.evaluate(el=>el.getAnimations().length),0,'History thumbnail must not spin on opening');
     assert.ok(await page.locator('#criloWheelPreview').isVisible(),'History drawing did not expand');
     assert.equal(await page.locator('.crilo-wheel-preview-image').getAttribute('src'),'blank-wheel.svg',
      'Expanded History drawing should remain truly blank');
     await page.locator('.crilo-wheel-preview-spin').click();
     assert.equal(await page.locator('.crilo-wheel-preview-spin').getAttribute('data-spins'),'1',
      'Enlarged History wheel must spin when clicked');
     await page.locator('.crilo-wheel-preview-spin').click();
     assert.equal(await page.locator('.crilo-wheel-preview-spin').getAttribute('data-spins'),'2',
      'Enlarged History wheel must be replayable');
     await page.keyboard.press('Escape');
     assert.equal(await page.locator('#criloWheelPreview').isVisible(),false,'Escape should close enlarged History artwork');
    }
    assert.deepEqual(errors,[],pageFile+' runtime errors');
    checked++;
    console.log('PASS blank drawing and one scored Daily '+pageFile+' '+width+'px');
    await page.close();
   }
   await ctx.close();
  }
  console.log('BLANK_WHEEL_HISTORY_PASS '+checked+' browser scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('BLANK_WHEEL_HISTORY_FAIL',e);process.exitCode=1});
