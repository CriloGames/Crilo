'use strict';
/* Daily Challenges browser/security regression with synthetic RPC results.
 * No real user account, spins, stars, scores, or badges are touched. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/161-daily-challenges.sql','utf8');
const html=fs.readFileSync('index.html','utf8');
const script=fs.readFileSync('daily-challenges.js','utf8');
const css=fs.readFileSync('daily-challenges.css','utf8');
const game=fs.readFileSync('game.js','utf8');
assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.crilo_daily_challenge_stars/);
assert.match(sql,/PRIMARY KEY\(user_id,daily_period,challenge_key\)/);
assert.match(sql,/ON CONFLICT\(user_id,daily_period,challenge_key\) DO NOTHING/);
assert.match(sql,/auth\.uid\(\)/);
assert.match(sql,/a\.email_confirmed_at IS NOT NULL/);
assert.match(sql,/public\.crilo_banned_accounts/);
assert.match(sql,/public\.crilo_daily_penalties/);
assert.match(sql,/public\.crilo_spin_sessions/);
assert.match(sql,/public\.daily_runs/);
assert.match(sql,/verified_spin_session_id IS NOT NULL/);
assert.match(sql,/AND is_test=false/);
assert.match(sql,/12,36,90/);
assert.doesNotMatch(sql,/(INSERT INTO|UPDATE|DELETE FROM) public\.(user_badges|badges|crilo_bonus_runs|daily_runs|leaderboard)/i,'Challenges must never change competitive or badge tables');
assert.match(sql,/REVOKE ALL ON public\.crilo_daily_challenge_stars FROM PUBLIC,anon,authenticated/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_daily_challenges\(\) TO authenticated/);
assert.match(script,/crilo-official-wheel-stopped/);
assert.match(game,/CriloDailyChallenges\?\.refresh\?\.\(\)/);
assert.match(html,/daily-challenges\.js\?v=1/);
assert.match(html,/daily-challenges\.css\?v=1/);
assert.match(html,/id="criloChallengePanel"/);
assert.doesNotMatch(game,/CriloDailyChallenges.*crilo_save_bonus_run/);
const markup=html.match(/<section id="criloChallengePanel"[\s\S]*?<\/section>/);
assert.ok(markup);
const dataset=(n,stamp=0)=>({
 period:'2026-10-15',completed:n,stars:stamp,
 decoration:stamp>=90?3:stamp>=36?2:stamp>=12?1:0,
 next_milestone:stamp>=90?null:stamp>=36?90:stamp>=12?36:12,
 tasks:[
  {key:'finish',name:'Finish your Daily',description:'Complete your official Daily Wheel run.',progress:n>=1?1:0,goal:1,done:n>=1},
  {key:'spin_3',name:'Get rolling',description:'Make three verified spins.',progress:n>=2?3:0,goal:3,done:n>=2},
  {key:'duck',name:'A little quack',description:'Find a Duck during your official Daily.',progress:n>=3?1:0,goal:1,done:n>=3}
 ]
});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checked=0;
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce'});
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="hero">'+markup[0]+'</main></body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(()=>{
    window.Crilo={authResolved:false,user:null,dailyPeriod:()=> '2026-10-15'};
    window.__challenges={period:'2026-10-15',completed:0,stars:0,next_milestone:12,decoration:0,tasks:[]};
    window.criloDB={rpc:async()=>({data:window.__challenges,error:null})};
   });
   await page.addScriptTag({content:script});
   await page.evaluate(()=>window.dispatchEvent(new Event('crilo-auth-ready')));
   assert.equal(await page.locator('#criloChallengePanel').isVisible(),false,'Guest must see no challenge card');
   await page.evaluate(data=>{
    window.__challenges=data;
    window.Crilo.user={id:'synthetic-qa-account'};
    window.dispatchEvent(new Event('crilo-auth-ready'));
   },dataset(0));
   await page.locator('#criloChallengePanel').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.getElementById('criloChallengeTasks').children.length===3);
   assert.match(await page.locator('#criloChallengeCount').textContent(),/0 \/ 3/);
   await page.evaluate(data=>{
    window.__challenges=data;window.dispatchEvent(new Event('crilo-official-wheel-stopped'));
   },dataset(2,12));
   await page.waitForFunction(()=>document.getElementById('criloChallengePanel').dataset.decoration==='1');
   assert.equal(await page.locator('.crilo-challenge-task.is-complete').count(),2);
   assert.equal(await page.locator('.crilo-challenge-stamp.is-earned').count(),1);
   await page.evaluate(data=>{
    window.__challenges=data;window.dispatchEvent(new Event('crilo-official-daily-saved'));
   },dataset(3,90));
   await page.waitForFunction(()=>document.getElementById('criloChallengeCount').textContent==='3 / 3 complete');
   assert.equal(await page.locator('.crilo-challenge-stamp.is-earned').count(),3);
   assert.match(await page.locator('#criloChallengeStatus').textContent(),/Come back tomorrow/);
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const measures=await page.evaluate(()=>{
      const card=document.getElementById('criloChallengePanel').getBoundingClientRect();
      return {viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,
       width:card.width,left:card.left,right:card.right};
    });
    assert.ok(measures.document<=measures.viewport+3,'Page overflow '+width+'px '+theme+' '+JSON.stringify(measures));
    assert.ok(measures.left>=-2&&measures.right<=width+2,'Card overflow '+width+'px '+theme);
   }
   await page.evaluate(()=>{
    Crilo.user=null;window.dispatchEvent(new Event('crilo-auth-ready'));
   });
   await page.waitForFunction(()=>document.getElementById('criloChallengePanel').hidden===true);
   await page.close();checked++;
  }
  console.log('DAILY_CHALLENGES_PASS: rotating official-only rules, 3 tasks, milestones, guest isolation; '+checked+' mobile/tablet/desktop widths, both themes');
 }finally{await browser.close()}
})().catch(err=>{console.error('DAILY_CHALLENGES_FAIL',err);process.exitCode=1});
