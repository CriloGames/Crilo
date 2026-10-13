'use strict';
/* Verify the actual first visible Daily frame while a signed-in completion
   lookup is deliberately delayed. Real browser; fake read-only Supabase. */
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const cases=[{name:'finished',data:{score:823,spins:6,ducks:2,upgrades:1,doubles:1,extra_spins:1,
 best_roll_points:100,rarity_label:'EPIC',rarity_score:0.01,results:[],drawing:null}},
 {name:'unplayed',data:null}];
(async()=>{
 const server=http.createServer(serve);
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
  for(const size of [390,1280])for(const scenario of cases){
   const context=await browser.newContext({viewport:{width:size,height:900},reducedMotion:'reduce'});
   const fake=mockSupabase.replace('loggedIn:false','loggedIn:true');
   const intercept=`(()=>{
     const original=window.supabase.createClient;
     window.__dailyLookupStarted=false;
     window.__dailyLookupFinished=false;
     window.supabase.createClient=function(){
       const db=original.apply(this,arguments),from=db.from;
       db.from=function(name){
         const query=from(name);
         if(name==='daily_runs')query.maybeSingle=async()=>{
           window.__dailyLookupStarted=true;
           await new Promise(resolve=>setTimeout(resolve,1300));
           window.__dailyLookupFinished=true;
           return {data:${JSON.stringify(scenario.data)},error:null};
         };
         return query;
       };
       return db;
     };
   })();`;
   await context.addInitScript({content:fake+intercept});
   await context.route('https://**/*',r=>r.abort());
   await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route('https://unpkg.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__dailyLookupStarted===true,{timeout:15000});
   await page.waitForFunction(()=>document.documentElement.dataset.criloAuthReady==='true',{timeout:15000});
   const before=await page.evaluate(()=>({
     waiting:document.documentElement.classList.contains('crilo-daily-pending'),
     lookupFinished:window.__dailyLookupFinished,
     visibility:getComputedStyle(document.querySelector('#drawPanel')).visibility,
     interactive:getComputedStyle(document.querySelector('#drawPanel')).pointerEvents
   }));
   assert.equal(before.waiting,true,'Keep pending class until data confirmed: '+scenario.name);
   assert.equal(before.lookupFinished,false,'Lookup resolved before the first-paint assertion');
   assert.equal(before.visibility,'hidden','Editor flashed before completion lookup: '+scenario.name);
   assert.equal(before.interactive,'none','Editor was interactive during lookup: '+scenario.name);
   await page.waitForFunction(()=>window.__dailyLookupFinished&&!document.documentElement.classList.contains('crilo-daily-pending'),{timeout:15000});
   assert.equal(await page.locator('#drawPanel').evaluate(e=>getComputedStyle(e).visibility),'visible');
   assert.equal(await page.locator('#drawPanel').evaluate(e=>e.classList.contains('daily-finished')),scenario.name==='finished',
     'Editor should have final verified state before being revealed');
   if(scenario.name==='finished'){
     assert.equal(await page.locator('#spinButton').isVisible(),false,'Completed Daily must remain locked');
     assert.equal(await page.locator('#reviewDailyBtn').isVisible(),true,'Review Daily should remain available');
   }else{
     assert.equal(await page.locator('#spinButton').isVisible(),true,'Fresh Daily should remain playable');
   }
   assert.deepEqual(errors,[],'Unexpected script error: '+JSON.stringify(errors));
   await context.close();checks++;
  }
  // Guest Daily is still immediately available after normal guest auth.
  const context=await browser.newContext({viewport:{width:390,height:800}});
  await context.addInitScript({content:mockSupabase});
  await context.route('https://**/*',r=>r.abort());
   await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await context.route('https://unpkg.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  const page=await context.newPage();
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.documentElement.classList.contains('crilo-daily-pending'),{timeout:15000});
  assert.equal(await page.locator('#drawPanel').isVisible(),true);
  assert.equal(await page.locator('#spinButton').isVisible(),true);
  await context.close();checks++;
  console.log('CRILO_DAILY_FIRST_PAINT_OK '+checks+' signed-in and guest refresh checks');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1});
