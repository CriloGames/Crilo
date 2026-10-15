'use strict';
/* Independent entries: official Daily + every completed Bonus Run.
 * All browser scores are mock data. No player account is modified. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('playwright');
const sql=fs.readFileSync('release/346-badges/159-all-daily-runs-leaderboard.sql','utf8');
const source=fs.readFileSync('leaderboard.js','utf8');
const html=fs.readFileSync('leaderboard.html','utf8');
const styles=fs.readFileSync('leaderboard-run-types.css','utf8');
const game=fs.readFileSync('game.js','utf8');
assert.match(sql,/UNION ALL/i,'Use every completed run, not the player maximum');
assert.match(sql,/public\.crilo_bonus_runs/);
assert.match(sql,/public\.crilo_bonus_spin_sessions/);
assert.match(sql,/s\.finished_at IS NOT NULL/);
assert.match(sql,/s\.score=b\.score/);
assert.match(sql,/d\.verified_spin_session_id IS NOT NULL/);
assert.match(sql,/NULL::text AS drawing/,'Bonus artwork must remain private');
assert.match(sql,/crilo_owner_hide_bonus_leaderboard_run/);
assert.match(sql,/crilo_require_owner_mfa/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.crilo_public_run_leaders\(text,integer\) TO anon,authenticated/);
assert.match(source,/crilo_public_run_leaders/);
assert.match(source,/crilo_total_points_leaders/,'Lifetime stats are still official-only');
assert.match(source,/if\(isLegacyPreviewRun\(run\)\)continue/,'Official ducks unchanged');
assert.match(html,/leaderboard-run-types\.css\?v=1/);
assert.match(html,/leaderboard\.js\?v=53/);
assert.match(game,/!isTest&&!isBonus/,'No Bonus Run badge awards');
const runs=[
 {id:'a',user_id:'user-a',source:'official',slot:0,score:100,spins:5,upgrades:0,doubles:0,ducks:0,drawing:'data:image/png;base64,AAAA',verified_spin_session_id:'proof',daily_period:'2026-10-15'},
 {id:'b1',user_id:'user-a',source:'bonus',slot:1,score:900,spins:8,upgrades:3,doubles:0,ducks:1,drawing:null,verified_spin_session_id:null,daily_period:'2026-10-15'},
 {id:'b2',user_id:'user-a',source:'bonus',slot:2,score:600,spins:6,upgrades:1,doubles:1,ducks:0,drawing:null,verified_spin_session_id:null,daily_period:'2026-10-15'},
 {id:'c',user_id:'user-b',source:'official',slot:0,score:450,spins:5,upgrades:0,doubles:1,ducks:0,drawing:null,verified_spin_session_id:'proof',daily_period:'2026-10-15'}
].sort((a,b)=>b.score-a.score);
const nodes=new Map();
function get(id){
 if(!nodes.has(id)){
  const set=new Set(['hidden']);
  nodes.set(id,{id,textContent:'',innerHTML:'',dataset:{},style:{},hidden:false,src:'',alt:'',
   classList:{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)},
   addEventListener(){},querySelector(){return null}});
 }
 return nodes.get(id);
}
let called=[];
const tabs=['today','week','all','points','records','badges','ducks'].map(tab=>({
 dataset:{tab},setAttribute(){},classList:{add(){},remove(){}},
 addEventListener(type,fn){if(type==='click')this.click=fn}
}));
const db={
 rpc:async(key,args)=>{called.push([key,args]);return{data:key==='crilo_public_run_leaders'?runs:[],error:null}},
 from:table=>({select(){return this},in(){return Promise.resolve({data:[
 {id:'user-a',username:'MultipleRuns',name_color:'#222222'},
 {id:'user-b',username:'SecondPlayer',name_color:'#777777'}
 ],error:null})}})
};
const ctx={window:{addEventListener(){},CriloRarity:{scoreBands:[{key:'common',max:500},{key:'mythic',max:Infinity}]},
 CriloNameColors:{paint:(el,p)=>{el.textContent=p?.username||'Crilo player'},markup:p=>p?.username||'Crilo player'}},
 document:{getElementById:get,querySelectorAll:s=>s==='.leader-tab'?tabs:[]},
 Crilo:{dailyPeriod:()=> '2026-10-15',profile:null,esc:x=>String(x||'')},
 criloDB:db,Date,Math,Set,Map,Number,encodeURIComponent,console,prompt(){return null},confirm(){return false},alert(){}};
vm.runInNewContext(source,ctx,{filename:'leaderboard.js'});
(async()=>{
 for(let i=0;i<40;i++)await Promise.resolve();
 const markup=get('leaderList').innerHTML;
 assert.equal((markup.match(/class="leader-row score-run-row/g)||[]).length,4,'Must show all four runs independently');
 assert.equal((markup.match(/data-run-source="bonus"/g)||[]).length,2);
 assert.equal((markup.match(/data-run-source="official"/g)||[]).length,2);
 assert.ok(markup.indexOf('Bonus Run 1')<markup.indexOf('Bonus Run 2'),'Score sorting must be preserved');
 assert.equal((markup.match(/class="mini-wheel"/g)||[]).length,2,'Bonus drawings remain private');
 assert.equal(get('bestRunKind').textContent,'Bonus Run 1');
 assert.ok(get('bestDrawing').classList.contains('hidden'));
 assert.equal(called[0][0],'crilo_public_run_leaders');
 assert.equal(called[0][1].p_board,'today');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main class="leader-panel"><div class="leader-row score-run-row is-bonus" data-run-source="bonus"><span class="rank">1</span><span class="leader-player"><a class="leader-name">MultipleRuns</a><span class="leader-mini"><span class="crilo-run-kind is-bonus">Bonus Run 1</span> · 12 spins · 5 upgrades</span></span><div class="leader-score-actions"><div class="leader-score">9,999,000</div></div></div></main></body></html>');
   await page.addStyleTag({content:styles+'\nbody{margin:0;font-family:system-ui}.leader-panel{width:min(100%,980px);margin:auto}.leader-row{display:grid;gap:10px;padding:14px;box-sizing:border-box}.leader-player{min-width:0}.leader-mini{display:block}.leader-score{font-size:18px;font-weight:900}'});
   for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Unexpected overflow at '+width+' '+theme+': '+overflow);
   }
   await page.close();
  }
  console.log('ALL_RUNS_LEADERBOARD_PASS all four rankings, private bonus drawings, desktop/tablet/phone and themes');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
