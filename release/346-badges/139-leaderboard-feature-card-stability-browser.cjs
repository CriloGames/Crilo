'use strict';
/* Real browser layout test, read-only synthetic leaderboard entries.
 * Confirms the featured-player box and the category strip's position stay
 * identical while viewing all seven category representations, including
 * categories without the winner's drawing. */
const http=require('node:http');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {serve,mockSupabase}=require('./086-site-wide-interactions-browser.cjs');
const css=fs.readFileSync('top-score-row.css','utf8');
const html=fs.readFileSync('leaderboard.html','utf8');
assert.match(css,/Leaderboard hero height lock/);
assert.match(css,/\.best-card\{[\s\S]*?height:408px/);
assert.match(css,/@media\(max-width:540px\)\{\s*\.best-card\{height:385px\}/);
assert.match(css,/@media\(max-width:340px\)\{\s*\.best-card\{height:415px\}/);
assert.match(html,/top-score-row\.css\?v=7/);
const states=[
 {heading:'TODAY’S TOP SCORE',score:'91,292',name:'LongestUsername_2026',drawing:true,metrics:true},
 {heading:'WEEKLY TOP SCORE',score:'9,007,199,254,740,991',name:'LongestUsername_2026',drawing:true,metrics:true},
 {heading:'ALL-TIME TOP SCORE',score:'231,144',name:'Player',drawing:true,metrics:true},
 {heading:'TOTAL POINTS LEADER',score:'1,502,209',name:'CriloPlayer',drawing:false,stats:'220 official Dailies played · lifetime points'},
 {heading:'LONGEST DAILY RUN',score:'500',name:'CriloFan',drawing:true,metrics:true},
 {heading:'ALL-TIME BADGE COLLECTORS',score:'346',name:'CriloFan',drawing:false,stats:'Most gameplay badges earned from official Crilo play'},
 {heading:'ALL-TIME DUCK COLLECTORS',score:'1,024',name:'CriloFan',drawing:false,stats:'Ducks collected across all official Daily runs'},
 {heading:'TODAY’S TOP SCORE',score:'—',name:'No completed runs yet',drawing:false,stats:'Be the first.'}
];
const metrics=['Spins','Upgrades','Doubles','Ducks'].map((label,i)=>'<span class="best-metric"><strong>'+[50,20,9,17][i]+'</strong><span>'+label+'</span></span>').join('');
(async()=>{
 const server=http.createServer(serve);
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let checked=0;
 try{
  for(const width of [320,360,390,430,540,768,1024,1280,1440]){
   for(const theme of ['light','dark']){
    const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await ctx.addInitScript({content:mockSupabase});
    await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
    await ctx.route(/^https:\/\/(?!crilo\.fun)/,r=>r.abort());
    const page=await ctx.newPage();
    await page.goto(base+'/leaderboard.html',{waitUntil:'domcontentloaded'});
    await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
    const snap=()=>page.evaluate(()=>{
     const card=document.querySelector('.best-card'),panel=document.querySelector('.leader-panel');
     const score=document.querySelector('#bestScore'),username=document.querySelector('#bestUser'),
       art=document.querySelector('#bestDrawing'),stats=document.querySelector('#bestStats');
     const c=card.getBoundingClientRect(),p=panel.getBoundingClientRect(),
      r=[score,username,stats,...(!art.classList.contains('hidden')?[art]:[])].map(x=>x.getBoundingClientRect());
     return {height:c.height,width:c.width,cardTop:c.top,panelTop:p.top,
       clipped:r.some(x=>x.top<c.top-1||x.bottom>c.bottom+1||x.left<c.left-1||x.right>c.right+1),
       documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth};
    });
    const initial=await snap();
    assert.ok(initial.height>300,'Hero not allocated fixed room');
    // Change all real navigation tabs with the app's loading behavior.
    for(const name of ['today','week','all','points','records','badges','ducks']){
     await page.locator('.leader-tab[data-tab="'+name+'"]').evaluate(el=>el.click());
     await page.waitForTimeout(25);
     const state=await snap();
     assert.equal(state.height,initial.height,'Tab changed hero height '+width+'/'+theme+'/'+name);
     assert.ok(Math.abs(state.panelTop-initial.panelTop)<1,'Tab moved list '+width+'/'+theme+'/'+name);
    }
    // Also test the full content-rich card versus no-artwork counters/text.
    for(const state of states){
     await page.evaluate(({state,metrics})=>{
      const best=document.querySelector('.best-card');
      document.querySelector('#bestHeading').textContent=state.heading;
      const score=document.querySelector('#bestScore');score.textContent=state.score;
      document.querySelector('#bestUser').textContent=state.name;
      const stats=document.querySelector('#bestStats');
      stats.innerHTML=state.metrics?metrics:'';
      if(!state.metrics)stats.textContent=state.stats;
      const art=document.querySelector('#bestDrawing');
      art.classList.toggle('hidden',!state.drawing);
      if(state.drawing)art.src='blank-wheel.svg';
     },{state,metrics});
     await page.waitForTimeout(25); // MutationObserver sets digit class.
     const now=await snap();
     assert.equal(now.height,initial.height,'Hero resized '+width+'/'+theme+'/'+state.heading);
     assert.equal(now.width,initial.width,'Hero width changed '+width+'/'+theme+'/'+state.heading);
     assert.ok(Math.abs(now.panelTop-initial.panelTop)<1,'List jumped '+width+'/'+theme+'/'+state.heading);
     assert.equal(now.clipped,false,'Hero content clipped '+width+'/'+theme+'/'+state.heading+': '+JSON.stringify(now));
     assert.ok(now.documentWidth<=now.viewportWidth+2,'Unexpected horizontal scroll '+width+'/'+theme);
     checked++;
    }
    await ctx.close();
   }
  }
  console.log('LEADERBOARD_HERO_STABLE_PASS '+checked+' filled/empty states across phone, iPad, desktop and dark mode');
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
})().catch(e=>{console.error('LEADERBOARD_HERO_STABLE_FAIL',e);process.exitCode=1});
