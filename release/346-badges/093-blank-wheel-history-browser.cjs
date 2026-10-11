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
    daily_period:date,created_at:new Date().toISOString(),score:23,spins:3,
    upgrades:0,doubles:0,ducks:1,verified_spin_session_id:'proof',
    drawing:null,results:[{type:'num',points:3},{type:'duck',points:0},{type:'num',points:20}]
   };
   let rows=[daily],fields='';
   const q={
    select(v){fields=v;return q},
    eq(k,v){if(k==='user_id'||k==='is_test'||k==='daily_period')rows=rows.filter(r=>r[k]===v);return q},
    not(){return q},gte(){return q},order(){return q},limit(n){rows=rows.slice(0,n);return q},
    range(a,b){const data=rows.slice(a,b+1);return Promise.resolve({data:fields==='spins'?data.map(r=>({spins:r.spins})):data,error:null})},
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
   await ctx.addInitScript({content:mockSupabase.replace('loggedIn:false','loggedIn:true')});
   await ctx.addInitScript({content:'('+installFakeDaily.toString()+')()'});
   await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   for(const pageFile of ['leaderboard.html','profile.html']){
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/'+pageFile,{waitUntil:'domcontentloaded'});
    const image=pageFile==='leaderboard.html'?page.locator('#bestDrawing'):page.locator('.spin-history-wheel img').first();
    await image.waitFor({state:'visible',timeout:10000});
    assert.equal(await image.getAttribute('src'),'default-wheel.svg','Blank wheel must always appear');
    assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0),'SVG failed to load');
    if(pageFile==='leaderboard.html'){
     await page.waitForFunction(()=>document.querySelectorAll('.leader-list .mini-wheel').length>0);
     const btn=page.locator('#leaderList .mini-wheel');
     assert.equal(await btn.count(),1,'Blank drawing must still have wheel button');
     await btn.click();
     assert.ok(await btn.locator('img').evaluate(el=>el.getAnimations().length>0),'Leaderboard wheel did not spin');
    }else{
     await page.waitForFunction(()=>document.querySelectorAll('.spin-history-item').length===3);
     assert.equal(await page.locator('.spin-history-item').count(),3,'Expected three real spins');
     const text=await page.locator('#spinHistoryList').innerText();
     assert.ok(text.includes('DUCK!')&&text.includes('Landed 3 points'),'Actual spin outcomes missing');
     assert.equal(await page.locator('.spin-history-wheel').count(),3);
     await page.locator('.spin-history-wheel').first().click();
     assert.ok(await image.evaluate(el=>el.getAnimations().length>0),'History wheel did not spin');
    }
    assert.deepEqual(errors,[],pageFile+' runtime errors');
    checked++;
    console.log('PASS blank wheel and prior spin events '+pageFile+' '+width+'px');
    await page.close();
   }
   await ctx.close();
  }
  console.log('BLANK_WHEEL_HISTORY_PASS '+checked+' browser scenarios');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(e=>{console.error('BLANK_WHEEL_HISTORY_FAIL',e);process.exitCode=1});
