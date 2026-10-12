'use strict';
/* Browser regression for the owner-facing Statistics history: five Dailies,
 * 43 wheel spins, two excluded Test Runs, and three-plus-five pagination. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
function installOwnerDailies(){
 const original=window.supabase.createClient;
 window.supabase.createClient=(...args)=>{
  const db=original(...args),originalFrom=db.from;
  const id='11111111-1111-4111-8111-111111111111';
  const painted='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WZkAAAAASUVORK5CYII=';
  const make=(day,spins,score,isTest=false)=>({
   id:day+(isTest?100:0),user_id:id,is_test:isTest,
   daily_period:'2026-10-'+String(day).padStart(2,'0'),
   created_at:'2026-10-'+String(day).padStart(2,'0')+'T12:00:00Z',
   run_date:'2026-10-'+String(day).padStart(2,'0'),
   spins,score,upgrades:0,doubles:0,ducks:0,
   verified_spin_session_id:day>=9?'server-proof':null,
   drawing:day===9?painted:null,
   results:Array.from({length:spins},()=>({type:'duck'}))
  });
  const runs=[
   make(10,7,17),make(9,10,42),make(8,7,24),
   make(7,8,15),make(6,11,864),
   make(10,12,123,true),make(9,15,999,true)
  ];
  db.from=table=>{
   if(table!=='daily_runs')return originalFrom(table);
   let field='',filters={},orders=[],limit=null;
   const filtered=()=>runs.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v))
    .sort((a,b)=>{
     for(const [column,ascending] of orders){
      const x=a[column],y=b[column];
      if(x===y)continue;
      return (x<y?-1:1)*(ascending?1:-1);
     }
     return 0;
    }).slice(0,limit??runs.length);
   const selectRows=rows=>field==='spins,daily_period'?
    rows.map(r=>({spins:r.spins,daily_period:r.daily_period})):rows;
   const q={
    select(x){field=x;return q},
    eq(k,v){filters[k]=v;return q},
    order(k,options={}){orders.push([k,options.ascending===true]);return q},
    limit(n){limit=n;return q},
    range(a,b){return Promise.resolve({data:selectRows(filtered().slice(a,b+1)),error:null})},
    maybeSingle(){return Promise.resolve({data:filtered()[0]??null,error:null})},
    single(){return Promise.resolve({data:filtered()[0]??null,error:null})},
    then(resolve,reject){return Promise.resolve({data:selectRows(filtered()),error:null}).then(resolve,reject)}
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
 try{
  for(const width of [390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:860},reducedMotion:'reduce'});
   await ctx.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')
    .replace('is_owner:false','is_owner:true')+';('+installOwnerDailies.toString()+')()'});
   await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
    r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/profile.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelectorAll('.spin-history-item').length===3);
   await page.waitForFunction(()=>document.getElementById('spinHistoryCount')?.textContent==='5 Dailies completed');
   assert.equal(await page.locator('#spinHistoryCount').innerText(),'5 Dailies completed');
   assert.match(await page.locator('#spinHistorySpinCount').innerText(),/43 wheel spins in Dailies/);
   assert.match(await page.locator('#spinHistorySpinCount').innerText(),/Test Runs excluded/);
   assert.equal(await page.locator('.spin-history-item').count(),3);
   assert.ok(await page.locator('#spinHistoryMore').isVisible(),'Older Dailies must be accessible');
   assert.match(await page.locator('#spinHistoryMore').innerText(),/SHOW 2 OLDER DAILIES/);
   assert.ok(await page.locator('#spinHistoryEnd').isHidden(),'History must not appear finished after three');
   await page.locator('#spinHistoryMore').click();
   await page.waitForFunction(()=>document.querySelectorAll('.spin-history-item').length===5);
   assert.ok(await page.locator('#spinHistoryMore').isHidden(),'No additional saved Dailies remain');
   assert.ok(await page.locator('#spinHistoryEnd').isVisible(),'Show explicit end of saved official history');
   assert.match(await page.locator('#spinHistoryEndLabel').innerText(),/All 5 saved Dailies shown/);
   const listText=await page.locator('#spinHistoryList').innerText();
   for(const score of ['17','42','24','15','864'])assert.ok(listText.includes(score),'Missing actual Daily score '+score);
   assert.ok(!listText.includes('999')&&!listText.includes('123'),'Owner Test Run incorrectly displayed');
   assert.equal(await page.locator('.spin-history-wheel').count(),5);
   assert.ok((await page.locator('.spin-history-wheel img[src="blank-wheel.svg"]').count())>=4,'Unpainted wheels changed');
   assert.ok((await page.locator('.spin-history-wheel img[src^="data:image/png;base64,"]').count())>=1,'Saved artwork changed');
   const paintedWheel=page.locator('.spin-history-wheel img[src^="data:image/png;base64,"]').first();
   const originalSrc=await paintedWheel.getAttribute('src');
   await paintedWheel.click();
   assert.ok(await page.locator('#criloWheelPreview').isVisible(),'Saved artwork must expand in the preview');
   assert.equal(await page.locator('.crilo-wheel-preview-image').getAttribute('src'),originalSrc,
    'Expanded artwork must use the exact stored drawing, not a substitute');
   await page.locator('.crilo-wheel-preview-spin').click();
   assert.equal(await page.locator('.crilo-wheel-preview-spin').getAttribute('data-spins'),'1',
    'Enlarged saved drawing did not spin when clicked');
   await page.locator('.crilo-wheel-preview-close').click();
   assert.equal(await paintedWheel.getAttribute('src'),originalSrc,'Closing preview must not alter artwork');
   assert.equal(await page.locator('#spinHistoryCount').innerText(),'5 Dailies completed');
   const horizontal=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(horizontal.scroll<=horizontal.viewport+2,'Statistics page overflow at '+width+'px');
   assert.deepEqual(errors,[],'Runtime errors at '+width+'px');
   console.log('PASS owner Daily History at '+width+'px: three to five Dailies, 43 spins');
   await ctx.close();
  }
  console.log('OWNER_DAILY_HISTORY_BROWSER_PASS');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('OWNER_DAILY_HISTORY_BROWSER_FAIL',e);process.exitCode=1});
