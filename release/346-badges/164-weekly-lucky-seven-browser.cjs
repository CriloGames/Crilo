'use strict';
/* Full Lucky Seven browser flow using synthetic RPC responses only.
 * No user data, leaderboards, daily scores or badges are touched. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/163-weekly-lucky-seven.sql','utf8');
const html=fs.readFileSync('weekly.html','utf8');
const css=fs.readFileSync('weekly.css','utf8');
const code=fs.readFileSync('weekly.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const main=fs.readFileSync('game.js','utf8');
assert.match(sql,/CREATE TABLE public\.crilo_weekly_spin_sessions/);
assert.match(sql,/ALTER COLUMN remaining_spins SET DEFAULT 7/);
assert.match(sql,/crilo_weekly_one_session_per_week UNIQUE\(user_id,daily_period\)/);
assert.match(sql,/public\.crilo_secure_random_index/); // copied spin source name comes from function cloning
assert.match(sql,/public\.crilo_server_spin\(uuid\)/);
assert.match(sql,/pg_get_functiondef/);
assert.match(sql,/Complete today''s Official Daily to unlock Lucky Seven/);
assert.match(sql,/d\.verified_spin_session_id IS NOT NULL/);
assert.match(sql,/crilo_wheel_assert_unique_email|weekly session clone failed/i);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.crilo_weekly_leaders/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.crilo_weekly_save/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_weekly_leaders\(integer\) TO anon,authenticated/);
assert.match(sql,/REVOKE ALL ON public\.crilo_weekly_runs FROM PUBLIC,anon,authenticated/);
assert.doesNotMatch(sql,/(INSERT INTO|UPDATE|DELETE FROM) public\.(daily_runs|crilo_bonus_runs|user_badges|player_stats)/i);
assert.match(home,/href="weekly\.html"/);
assert.match(html,/weekly\.js\?v=1/);
assert.match(html,/weekly\.css\?v=1/);
assert.doesNotMatch(main,/crilo_weekly_(?:spin|save|begin)/);
assert.match(code,/crilo_weekly_spin/);
assert.match(code,/crilo_weekly_save/);
assert.match(code,/crilo_weekly_leaders/);
assert.match(code,/createElement\('a'\)/);
const initial=[
 {type:'num',base:40},{type:'duck'},{type:'num',base:20},{type:'upgrade'},
 {type:'num',base:60},{type:'num',base:20},{type:'spins'},{type:'num',base:80},
 {type:'duck'},{type:'num',base:40},{type:'double'},{type:'num',base:20}
];
const segment=initial.concat(initial);
const markup=html.slice(html.indexOf('<main class="weekly-main">'),html.indexOf('</main>')+7);
assert.match(markup,/id="weeklyStart"/);
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let count=0;
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+markup+'</body></html>');
   await page.addStyleTag({content:css});
   const errs=[];page.on('pageerror',e=>errs.push(e.message));
   await page.evaluate(segment=>{
    window.Crilo={authResolved:false,user:null,profile:null};
    window.__weeklyTest={started:false,score:0,count:0,saved:false,ribbons:0,spins:7,segment,leaderNames:['<script>alert(1)</script>','Regular']};
    window.criloDB={rpc:async(name,args)=>{
     const t=window.__weeklyTest;
     if(name==='crilo_weekly_leaders')return {data:[
      {user_id:'test1',username:t.leaderNames[0],score:230,spins:7,ducks:1,name_color:'#334455'},
      {user_id:'test2',username:t.leaderNames[1],score:140,spins:8,ducks:0,name_color:'#334455'}],error:null};
     if(name==='crilo_weekly_status')return {data:{
      week_period:'2026-10-12',ends_at:new Date(Date.now()+3600000).toISOString(),
      can_start:true,started:t.started,finished:t.saved,save_pending:t.count===7&&!t.saved,
      session_id:t.started?'weekly-qa':null,score:t.score,spins:t.count,
      ribbons:t.ribbons},error:null};
     if(name==='crilo_weekly_begin_session'){t.started=true;return{data:'weekly-qa',error:null}}
     if(name==='crilo_weekly_state')return{data:{
      score:t.score,remaining_spins:t.spins,spin_count:t.count,
      segments:t.segment,multiplier:1,finished:t.spins===0},error:null};
     if(name==='crilo_weekly_spin'){
      t.count++;t.score+=40;t.spins=Math.max(0,7-t.count);
      return{data:{outcome_index:0,outcome:{type:'num',base:40,points:40},
       score:t.score,spin_count:t.count,remaining_spins:t.spins,
       segments:t.segment,finished:t.spins===0},error:null};
     }
     if(name==='crilo_weekly_save'){if(!t.saved)t.ribbons++;t.saved=true;return{data:{status:'saved',score:t.score},error:null}}
     throw Error('Unknown RPC '+name);
    }};
   },segment);
   await page.addScriptTag({content:code});
   await page.waitForFunction(()=>document.querySelectorAll('#weeklyLeaders li').length===2);
   assert.equal(await page.locator('#weeklyStart').isVisible(),false,'Guests cannot play');
   assert.equal(await page.locator('#weeklySignIn').isVisible(),true,'Guests see sign in');
   const text=await page.locator('#weeklyLeaders').textContent();
   assert.match(text,/Regular/);
   assert.match(text,/<script>alert\(1\)<\/script>/);
   assert.equal(await page.locator('script').count(),1,'Untrusted usernames must not inject DOM scripts');
   await page.evaluate(()=>{Crilo.user={id:'mock-player'};window.dispatchEvent(new Event('crilo-auth-ready'))});
   await page.locator('#weeklyStart').waitFor({state:'visible'});
   await page.locator('#weeklyStart').click();
   await page.locator('#weeklySpin').waitFor({state:'visible'});
   assert.equal(await page.locator('#weeklyRemaining').textContent(),'7');
   for(let n=1;n<=7;n++){
    await page.locator('#weeklySpin').click();
    await page.waitForFunction(n=>Number(document.getElementById('weeklyTaken').textContent)===n,n);
    if(n<7)await page.waitForFunction(()=>!document.getElementById('weeklySpin').disabled);
   }
   await page.locator('#weeklyFinished').waitFor({state:'visible'});
   assert.equal(await page.locator('#weeklyScore').textContent(),'280');
   assert.equal(await page.locator('#weeklyRemaining').textContent(),'0');
   assert.equal(await page.locator('#weeklyRibbons').textContent(),'1');
   assert.equal(await page.locator('#weeklySpin').isVisible(),false);
   await page.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
   await page.waitForFunction(()=>document.getElementById('weeklyFinished').hidden===false);
   assert.equal(await page.locator('#weeklyRibbons').textContent(),'1','Refreshing never duplicates ribbons');
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Weekly horizontal overflow '+width+'px '+theme+' '+overflow);
   }
   assert.deepEqual(errs,[],'No browser script errors');
   await page.close();count++;
  }
  console.log('WEEKLY_LUCKY_SEVEN_PASS '+count+' viewport widths, guests, 7 verified spins, one ribbon, separate rankings, no XSS, no overflow');
 }finally{await browser.close()}
})().catch(e=>{console.error('WEEKLY_LUCKY_SEVEN_FAIL',e);process.exitCode=1});
