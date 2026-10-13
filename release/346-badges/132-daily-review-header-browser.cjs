'use strict';
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const saved={
 id:314,daily_period:new Date(Date.now()-22*3600000).toISOString().slice(0,10),
 score:825,spins:9,upgrades:2,doubles:1,ducks:3,extra_spins:4,
 best_roll_points:150,rarity_label:'EPIC',rarity_score:0.007,rarity_odds:133.7,
 results:[{type:'num',points:150},{type:'duck',points:0}],drawing:null
};
const intercept=`(function(){
 const create=window.supabase.createClient;
 window.supabase.createClient=function(){
  const db=create.apply(this,arguments),old=db.from;
  db.from=function(name){
   const q=old(name);
   if(name==='daily_runs')q.maybeSingle=async()=>({data:${JSON.stringify(saved)},error:null});
   return q;
  };
  return db;
 };
})();`;
(async()=>{
 const server=http.createServer(serve);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
 for(const owner of [false,true]){
  for(const width of [780,940,1024,1120,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const fake=mockSupabase.replace('loggedIn:false','loggedIn:true')
     .replace('is_owner:false','is_owner:'+(owner?'true':'false'));
   await context.addInitScript({content:fake+intercept});
   await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.locator('#reviewDailyBtn').waitFor({state:'visible',timeout:15000});
   await page.waitForFunction(()=>document.getElementById('accountBtn')?.getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('#result').isVisible(),false,'Do not auto-show saved Daily');
   assert.equal(await page.locator('#spinButton').isVisible(),false,'No second Daily spin');
   if(owner)assert.equal(await page.locator('#ownerRunControls').isVisible(),true);
   await page.locator('#reviewDailyBtn').click();
   await page.locator('#result').waitFor({state:'visible'});
   const cells=await page.evaluate(()=>['finalScore','rarityLabel','statSpins','statUpgrades','statDoubles','statDucks','statExtra','statBestRoll']
    .map(id=>document.getElementById(id).textContent));
   assert.deepEqual(cells,['825','EPIC','9','2','1','3','4','150'],
    'Review must use persisted results, not a new run: '+width+' owner '+owner);
   assert.match(await page.locator('#rarityOdds').innerText(),/0\.70% of simulated runs/,
    'Restored rarity explanation should match the original Daily results');
   assert.equal(await page.locator('#newBadgePanel').isVisible(),true);
   assert.equal(await page.locator('#newBadgePanel').evaluate(e=>e.open),false);
   assert.equal(await page.locator('#reviewDailyBtn').getAttribute('aria-expanded'),'true');
   await page.locator('#reviewDailyBtn').click();
   assert.equal(await page.locator('#result').isVisible(),false,'Review should close');
   // The actual available content width—not a fixed 1050px breakpoint—
   // must decide whether a shared navbar stays in its original row.
   const layout=await page.evaluate(()=>{
    const el=document.querySelector('.topbar'),nav=el.querySelector('nav'),
      brand=el.querySelector('.brand'),actions=el.querySelector('.header-actions');
    const css=getComputedStyle(el),gap=parseFloat(css.columnGap)||0;
    const room=el.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
    const needed=brand.getBoundingClientRect().width+nav.scrollWidth+actions.scrollWidth+gap*2+5;
    return{inline:el.classList.contains('crilo-header-inline'),
     stacked:el.classList.contains('crilo-header-stacked'),room,needed,
     navTop:nav.getBoundingClientRect().top,brandTop:brand.getBoundingClientRect().top,
     right:document.documentElement.scrollWidth,width:innerWidth};
   });
   assert.ok(layout.right<=layout.width+2,'Page overflow '+JSON.stringify(layout));
   if(layout.needed<=layout.room-2){
    assert.equal(layout.inline,true,'Early forced navigation wrap '+JSON.stringify(layout));
    assert.ok(Math.abs(layout.navTop-layout.brandTop)<18,'Navbar not on top row');
   }
   assert.deepEqual(errors,[],'Runtime errors: '+errors.join('; '));
   checks++;
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#reviewDailyBtn').waitFor({state:'visible',timeout:15000});
   assert.equal(await page.locator('#result').isVisible(),false);
   checks++;
   await context.close();
  }
 }
 const guestDate=new Date(Date.now()-22*3600000).toISOString().slice(0,10);
 const guestState={
  score:64,spins:0,multiplier:1,upgrades:0,doubles:0,ducks:1,
  totalSpins:6,numbersLanded:5,extraSpins:0,bestRollPoints:12,
  bestRollLabel:'+12',rotation:0,runProbability:.4,
  results:[{type:'num',points:12}],segments:Array.from({length:12},(_,i)=>
   i===1?{type:'duck'}:{type:'num',base:2}),
  drawing:'data:image/png;base64,'+'A'.repeat(300),drawMode:'stationary'
 };
 const guestSaved={version:3,period:guestDate,status:'complete',
  score:64,spins:6,state:guestState};
 for(const width of [390,1024]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript({content:mockSupabase+
   'localStorage.setItem("crilo_guest_daily_v1",'+JSON.stringify(JSON.stringify(guestSaved))+');'});
  await context.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,
   r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await context.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
  const page=await context.newPage();
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#reviewDailyBtn').waitFor({state:'visible',timeout:15000});
  await page.locator('#reviewDailyBtn').click();
  assert.equal(await page.locator('#finalScore').innerText(),'64');
  assert.equal(await page.locator('#statSpins').innerText(),'6');
  assert.equal(await page.locator('#resultEyebrow').innerText(),'GUEST DAILY COMPLETE');
  assert.match(await page.locator('#newBadgeCount').innerText(),/BADGES YOU COULD EARN/);
  assert.equal(await page.locator('#newBadgePanel').evaluate(el=>el.open),false);
  await context.close();checks++;
 }
 console.log('DAILY_REVIEW_HEADER_BROWSER_PASS '+checks+' owner/player/guest review, reload, responsive fit checks');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(error=>{console.error('DAILY_REVIEW_HEADER_BROWSER_FAIL',error);process.exitCode=1});