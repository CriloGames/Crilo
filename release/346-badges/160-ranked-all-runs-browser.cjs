'use strict';
/* One ranked Daily entry per user/day, all verified attempts in an accessible
 * expansion. Browser uses synthetic data only; never mutates live accounts. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/167-grouped-daily-leaderboard.sql','utf8');
const js=fs.readFileSync('leaderboard.js','utf8');
const html=fs.readFileSync('leaderboard.html','utf8');
const css=fs.readFileSync('style.css','utf8')+'\n'+fs.readFileSync('leaderboard-run-types.css','utf8');
const preview=fs.readFileSync('wheel-preview.js','utf8');
const game=fs.readFileSync('game.js','utf8');
assert.match(sql,/UNION ALL/i);
assert.match(sql,/PARTITION BY e\.user_id,e\.daily_period/,'Rank once per player per Daily period, not once per player all-time');
assert.match(sql,/b\.position=1/,'Rank one winner per player per Daily');
assert.match(sql,/LIMIT LEAST\(GREATEST\(COALESCE\(p_limit,100\),1\),100\)/i,'Apply Top 100 after grouping');
assert.match(sql,/jsonb_agg\(/,'All completed attempts must survive in the dropdown');
assert.match(sql,/public\.crilo_bonus_spin_sessions/);
assert.match(sql,/s\.finished_at IS NOT NULL/);
assert.match(sql,/s\.score=b\.score/);
assert.match(sql,/d\.verified_spin_session_id IS NOT NULL/);
assert.match(sql,/NULL::text AS drawing/,'Bonus artwork stays private even in the dropdown');
assert.match(sql,/crilo_hidden_bonus_leaderboard_runs/,'Hidden Bonus runs remain excluded');
assert.match(sql,/crilo_daily_penalties/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_grouped_daily_leaders\(text,integer\) TO anon,authenticated/);
assert.match(js,/crilo_grouped_daily_leaders/);
assert.match(js,/leader-runs-toggle/);
assert.match(js,/leader-run-breakdown/);
assert.match(js,/crilo_total_points_leaders/,'Lifetime points include verified Bonus Runs');
assert.match(js,/crilo_lifetime_duck_leaders/,'Lifetime ducks include eligible Bonus Runs');
assert.match(html,/leaderboard-run-types\.css\?v=3/);
assert.match(html,/leaderboard\.js\?v=60/);
assert.match(game,/!isTest&&!isBonus/,'Bonus runs cannot earn normal run badges');

const official={id:'official-a',source:'official',slot:0,score:100,spins:5,upgrades:0,doubles:0,ducks:0,drawing:'data:image/png;base64,AAAA'};
const bonus1={id:'bonus-1',source:'bonus',slot:1,score:900,spins:8,upgrades:3,doubles:0,ducks:1,drawing:null};
const bonus2={id:'bonus-2',source:'bonus',slot:2,score:600,spins:6,upgrades:1,doubles:1,ducks:0,drawing:null};
const other={id:'other-official',source:'official',slot:0,score:450,spins:5,upgrades:0,doubles:1,ducks:0,drawing:null};
const days=[
 {...bonus1,user_id:'player-a',daily_period:'2026-10-15',group_count:3,group_runs:[bonus1,bonus2,official]},
 {...other,user_id:'player-b',daily_period:'2026-10-15',group_count:1,group_runs:[other]}
];
const head=html.slice(html.indexOf('<main class="leader-main">'),html.indexOf('</main>')+7);
assert.ok(head.startsWith('<main class="leader-main">'));

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'+head+'</body></html>');
   await page.addStyleTag({content:css});
   await page.evaluate(groups=>{
    window.__mockCalls=[];
    window.Crilo={profile:null,esc:x=>String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')};
    window.CriloNameColors={paint:(element,p)=>{element.textContent=p?.username||'Crilo player'},markup:p=>p?.username||'Crilo player'};
    window.CriloRarity={scoreBands:[{key:'common',max:500},{key:'mythic',max:Infinity}]};
    window.criloDB={
     rpc:async(name,args)=>{window.__mockCalls.push({name,args});return{data:name==='crilo_grouped_daily_leaders'?groups:[],error:null}},
     from:()=>({select(){return this},in(){return Promise.resolve({data:[
      {id:'player-a',username:'BadgeRunner',name_color:'#334455'},
      {id:'player-b',username:'OtherPlayer',name_color:'#556677'}],error:null})}})
    };
   },days);
   await page.addScriptTag({content:js});
   await page.waitForFunction(()=>document.querySelectorAll('.leader-row.score-run-row').length===2);
   assert.equal(await page.locator('.leader-row.score-run-row').count(),2,'Three Bonus/official attempts must share one rank');
   assert.equal(await page.locator('.leader-row.score-run-row .crilo-run-kind').count(),1,'Only ranked Bonus Run has a type pill');
   assert.equal(await page.locator('.leader-row.score-run-row[data-run-source="official"] .crilo-run-kind').count(),0,'No Official Daily pill');
   assert.equal(await page.locator('.leader-run-detail-row .crilo-run-kind').count(),2,'Only Bonus runs in dropdown are labeled');
   assert.deepEqual(await page.locator('.leader-run-detail-row .crilo-run-kind').allTextContents(),['Bonus Run 1','Bonus Run 2']);
   assert.equal(await page.locator('#bestRunKind').textContent(),'Bonus Run 1','Featured Bonus Run stays labeled');
   assert.equal(await page.locator('.leader-run-bundle').count(),1,'Only player with multiple attempts gets a disclosure');
   assert.equal(await page.locator('.leader-runs-toggle').count(),1);
   assert.equal(await page.locator('.leader-run-detail-row').count(),3,'All 3 attempts persist in the collapsed group');
   assert.equal(await page.locator('.leader-run-detail-row .leader-run-best-tag').count(),1);
   assert.equal(await page.locator('.leader-run-detail-row .mini-wheel').count(),3,'Every expanded run retains a drawing thumbnail');
   assert.equal(await page.locator('.leader-row.score-run-row .mini-wheel').count(),2);
   assert.equal(await page.locator('#bestScore').textContent(),'900','Highest daily score leads the group');
   assert.equal(await page.locator('#bestDrawing').getAttribute('src'),'blank-wheel.svg','Top private Bonus drawing gets blank wheel');
   assert.equal(await page.locator('.leader-run-detail-row img[src="blank-wheel.svg"]').count(),2);
   assert.equal(await page.locator('.leader-run-detail-row img[src^="data:image/png"]').count(),1,'Official drawing remains available');
   assert.equal(await page.locator('#leader-daily-group-0').isVisible(),false,'Run history starts collapsed');
   await page.locator('.leader-runs-toggle').click();
   await page.locator('#leader-daily-group-0').waitFor({state:'visible'});
   assert.equal(await page.locator('.leader-runs-toggle').getAttribute('aria-expanded'),'true');
   assert.doesNotMatch(await page.locator('#leader-daily-group-0').textContent(),/Official Daily/,'No Official Daily pills in expanded history');
   assert.match(await page.locator('#leader-daily-group-0').textContent(),/Bonus Run 1/);
   assert.match(await page.locator('#leader-daily-group-0').textContent(),/Bonus Run 2/);
   await page.addScriptTag({content:preview});
   await page.locator('#leader-daily-group-0 .mini-wheel').first().click();
   await page.locator('#criloWheelPreview').waitFor({state:'visible'});
   await page.locator('.crilo-wheel-preview-close').click();
   await page.locator('.leader-runs-toggle').click();
   assert.equal(await page.locator('.leader-runs-toggle').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('#leader-daily-group-0').isVisible(),false);
   const rpc=await page.evaluate(()=>window.__mockCalls[0]);
   assert.equal(rpc.name,'crilo_grouped_daily_leaders');
   assert.equal(rpc.args.p_limit,100);
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const size=await page.evaluate(()=>({
     whole:document.documentElement.scrollWidth,view:document.documentElement.clientWidth,
     row:document.querySelector('.leader-run-bundle').getBoundingClientRect().width
    }));
    assert.ok(size.whole<=size.view+3,width+'px '+theme+' overflow '+JSON.stringify(size));
   }
   assert.deepEqual(errors,[],'Browser must have no JS errors');
   await page.close();
  }
  console.log('GROUPED_DAILIES_PASS: best rank per day, expandable all runs, blank/private artwork, keyboard-accessible toggles, four viewport widths');
 }finally{await browser.close()}
})().catch(err=>{console.error('GROUPED_DAILIES_FAIL',err);process.exitCode=1});
