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
  for(const width of [375,430,620,700,701,780,940,1024,1120,1160,1280,1440]){
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
   assert.deepEqual(cells,['825','MYTHIC','9','2','1','3','4','150'],
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
     stacked:el.classList.contains('crilo-header-stacked'),
     compact:el.classList.contains('crilo-header-compact'),room,needed,
     navTop:nav.getBoundingClientRect().top,brandTop:brand.getBoundingClientRect().top,
     right:document.documentElement.scrollWidth,width:innerWidth,
     navigation:(()=>{
       const rect=nav.getBoundingClientRect();
       const links=[...nav.querySelectorAll('a')].filter(a=>getComputedStyle(a).display!=='none')
         .map(a=>a.getBoundingClientRect());
       const rows=[];
       for(const link of links){
         let row=rows.find(group=>Math.abs((group[0].top+group[0].height/2)-(link.top+link.height/2))<6);
         if(!row){row=[];rows.push(row);}
         row.push(link);
       }
       return{
         justify:getComputedStyle(nav).justifyContent,
         centers:rows.map(row=>{
           const left=Math.min(...row.map(link=>link.left));
           const right=Math.max(...row.map(link=>link.right));
           return Math.abs((left-rect.left)-(rect.right-right));
         }),
         gaps:rows.flatMap(row=>row.slice(1).map((link,i)=>link.left-row[i].right)),
         overflow:links.some(link=>link.left<rect.left-2||link.right>rect.right+2)
       };
     })()};
   });
   assert.ok(layout.right<=layout.width+2,'Page overflow '+JSON.stringify(layout));
   if(layout.stacked||width<=700){
     assert.equal(layout.navigation.justify,'space-evenly',
      'Compact nav must distribute links: '+JSON.stringify(layout));
     assert.ok(layout.navigation.centers.every(n=>n<5),
      'Compact nav rows should appear centered: '+JSON.stringify(layout));
     assert.equal(layout.navigation.overflow,false,
      'Compact nav tabs overflow: '+JSON.stringify(layout));
   }
   if(layout.inline){
     const gaps=layout.navigation.gaps;
     assert.ok(gaps.every(g=>g>=8),
      'Header tabs squeezed together: '+JSON.stringify(layout));
     if(!layout.compact){
       assert.ok(gaps.every(g=>g>=15),
        'Comfortable tab spacing missing: '+JSON.stringify(layout));
     }
     assert.ok(gaps.length<=1||Math.max(...gaps)-Math.min(...gaps)<2,
      'Header gaps are not uniform: '+JSON.stringify(layout));
   }
   if(width>700&&layout.needed<=layout.room-2){
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
 console.log('DAILY_REVIEW_HEADER_BROWSER_PASS '+checks+' owner/player review, reload, responsive fit checks');
 }finally{await browser.close();await new Promise(done=>server.close(done))}
})().catch(error=>{console.error('DAILY_REVIEW_HEADER_BROWSER_FAIL',error);process.exitCode=1});