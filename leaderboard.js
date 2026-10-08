(() => {const $=id=>document.getElementById(id);let tab='today';let preview=false,ownerTestRows=[],testLoadError='';
const fakeNames=['PixelPilot','LuckyDuck','WheelWizard','SpinDoctor','TinyComet','BlueJay','SevenStars','QuackAttack','MoonMoth','OrbitFox','DoodleCat','RollMaster'];
function fakePeriod(n){const date=new Date(Date.now()-n*86400000);return Crilo.dailyPeriod(date)}
// Deterministic sample runs, using the exact wheel event rules in game.js.
function seededRandom(seed){let x=seed>>>0;return()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296}}
function simulateRun(random){
 let segments=[1,1,1,2,2,3,5,'double','upgrade','spins','duck'];
 let score=0,spinsLeft=5,totalSpins=0,upgrades=0,doubles=0,ducks=0,extraSpins=0,multiplier=1,numbersLanded=0;
 while(spinsLeft>0&&totalSpins<250){
  spinsLeft--;totalSpins++;
  const v=segments[Math.floor(random()*segments.length)];
  if(typeof v==='number'){score+=v*multiplier;numbersLanded++}
  else if(v==='double'){score*=2;spinsLeft++;doubles++}
  else if(v==='upgrade'){multiplier*=3;spinsLeft++;upgrades++;const bases=[1,1,2,2,3,3,5,5,8,10];for(let j=0;j<4+Math.min(upgrades,8);j++)segments.push(bases[Math.floor(random()*bases.length)])}
  else if(v==='spins'){spinsLeft+=2;extraSpins+=2}
  else if(v==='duck'){spinsLeft++;ducks++}
 }
 return{score,spins:totalSpins,upgrades,doubles,ducks,extra_spins:extraSpins,numbers_landed:numbersLanded}
}
function makePreview(){
 const random=seededRandom(20261007),rows=[];
 for(let i=0;i<48;i++){
  const run=simulateRun(random);
  rows.push({user_id:'preview-'+i,daily_period:fakePeriod(i%14),...run,drawing:null,rarity_odds:null,rarity_label:null,created_at:new Date().toISOString()});
 }
 return rows;
}
const previewRows=makePreview();
const previewBadgeCounts=[72,68,68,44,39,32,24,19,17,12,8,3];
const previewProfiles=new Map(previewRows.map((r,i)=>[r.user_id,{username:fakeNames[i%fakeNames.length]+(i>=12?' '+(i+1):''),name_color:['#2763a1','#b03f70','#3c825b','#a35d2c'][i%4]}]));
function previewRender(){if(tab==='badges'){renderBadgeLeaders(previewBadgeCounts.map((n,i)=>({user_id:'preview-'+i,count:n})),previewProfiles);return}let rows=previewRows.filter(r=>tab==='today'?r.daily_period===Crilo.dailyPeriod():tab==='week'?r.daily_period>=periodDaysAgo(6):true).slice();if(tab==='records')rows.sort((a,b)=>b.spins-a.spins||b.score-a.score);else if(tab==='ducks')rows.sort((a,b)=>b.ducks-a.ducks||b.score-a.score);else rows.sort((a,b)=>b.score-a.score||a.user_id.localeCompare(b.user_id));render(rows,previewProfiles)}
function togglePreview(on){
 if(on&&!Crilo.profile?.is_owner)return;
 preview=!!on;
 $('previewBanner')?.classList.toggle('hidden',!preview);
 $('previewToggle').textContent=preview?'Exit sample preview':'Preview sample players';
 if(preview)previewRender();else load();
}
async function refreshOwnerTests(){
 if(!Crilo.profile?.is_owner)return;
 const {data,error}=await criloDB.rpc('crilo_owner_test_runs');
 testLoadError=error?.message||'';
 if(!error)ownerTestRows=data||[];
 $('ownerTestStatus').textContent=error?'Unable to load test runs: '+error.message:'';
}
function renderOwnerTests(){
 $('bestHeading').textContent='YOUR BEST TEST RUN';
 $('leaderDescription').textContent='Saved practice runs for testing. These never appear in public rankings.';
 $('ownerTestActions').classList.remove('hidden');
 if(testLoadError){$('leaderList').innerHTML='<div class="empty-state">Could not load test runs: '+Crilo.esc(testLoadError)+'</div>';return}
 const rows=[...ownerTestRows].sort((a,b)=>Number(b.score)-Number(a.score)||new Date(b.created_at)-new Date(a.created_at));
 if(!rows.length){
  $('bestScore').textContent='—';$('bestUser').textContent='No saved test runs yet';
  $('bestStats').textContent='Play a saved test Daily to get started.';
  $('bestDrawing').classList.add('hidden');
  $('leaderList').innerHTML='<div class="empty-state">No saved runs yet. Go to Play and choose “Save Test Daily” to add one here.</div>';
  $('ownerDeleteSelected').disabled=true;return;
 }
 const best=rows[0];
 $('bestScore').textContent=Number(best.score).toLocaleString();
 $('bestUser').textContent=Crilo.profile?.username||'Owner';
 $('bestUser').style.color=Crilo.profile?.name_color||'';
 $('bestStats').textContent=best.spins+' spins • '+best.upgrades+' upgrades • '+best.ducks+' ducks';
 $('bestDrawing').classList.toggle('hidden',!best.drawing);
 if(best.drawing)$('bestDrawing').src=best.drawing;
 $('leaderList').innerHTML=rows.map((r,i)=>'<label class="leader-row owner-test-row"><input class="owner-test-check" type="checkbox" value="'+Crilo.esc(r.id)+'" aria-label="Select test run with '+Number(r.score).toLocaleString()+' points"><span class="rank">'+(i+1)+'</span><span class="owner-test-details"><strong class="leader-name">'+Number(r.score).toLocaleString()+' points</strong><span class="leader-mini">'+Number(r.spins)+' spins · '+Number(r.upgrades)+' upgrades · '+Number(r.ducks)+' ducks</span><span class="leader-mini">'+Crilo.esc(new Date(r.created_at).toLocaleString())+'</span></span><span class="owner-test-rarity">'+Crilo.esc(r.rarity_label||'TEST')+'</span></label>').join('');
 $('ownerDeleteSelected').disabled=true;
 $('leaderList').querySelectorAll('.owner-test-check').forEach(x=>x.addEventListener('change',()=>{$('ownerDeleteSelected').disabled=!$('leaderList').querySelector('.owner-test-check:checked')}));
}
$('ownerDeleteSelected')?.addEventListener('click',async()=>{
 if(!Crilo.profile?.is_owner||tab!=='tests')return;
 const ids=[...document.querySelectorAll('#leaderList .owner-test-check:checked')].map(x=>x.value);
 if(!ids.length||!confirm('Delete '+ids.length+' selected test run(s)? This cannot be undone. Official Daily runs will not be touched.'))return;
 $('ownerDeleteSelected').disabled=true;
 const {data,error}=await criloDB.rpc('crilo_delete_owner_test_runs',{p_ids:ids});
 if(error){$('ownerTestStatus').textContent='Delete failed: '+error.message;renderOwnerTests();return}
 await refreshOwnerTests();
 $('ownerTestStatus').textContent=Number(data)+' test run(s) deleted.';
 renderOwnerTests();
});
window.addEventListener('crilo-auth-ready',async e=>{
 const owner=!!e.detail.profile?.is_owner;
 $('ownerTools')?.classList.toggle('hidden',!owner);
 document.querySelector('.owner-only-tab')?.classList.toggle('hidden',!owner);
 if(owner)await refreshOwnerTests();
 else{ownerTestRows=[];testLoadError='';if(preview)togglePreview(false);if(tab==='tests'){tab='today';document.querySelectorAll('.leader-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='today'))}}
 if(tab==='tests'&&owner)renderOwnerTests();
});
$('previewToggle')?.addEventListener('click',()=>togglePreview(!preview));
function periodDaysAgo(n){const d=new Date(Date.now()-n*86400000),shifted=new Date(d.getTime()-22*3600000);return shifted.toISOString().slice(0,10)}
async function load(){ $('ownerTestActions').classList.add('hidden');if(tab==='tests'){if(!Crilo.profile?.is_owner){tab='today';return load()}await refreshOwnerTests();renderOwnerTests();return}if(preview){previewRender();return}if(tab==='badges'){await loadBadges();return}$('leaderList').innerHTML='<div class="empty-state">Loading scores…</div>';let fields='user_id,daily_period,score,spins,upgrades,doubles,ducks,drawing,rarity_odds,rarity_label,created_at';let q=criloDB.from('daily_runs').select(fields).eq('is_test',false);if(tab==='today')q=q.eq('daily_period',Crilo.dailyPeriod()).order('score',{ascending:false}).limit(100);else if(tab==='week')q=q.gte('daily_period',periodDaysAgo(6)).order('score',{ascending:false}).limit(100);else if(tab==='records')q=q.order('spins',{ascending:false}).order('score',{ascending:false}).limit(100);else if(tab==='ducks')q=q.order('ducks',{ascending:false}).order('score',{ascending:false}).limit(100);else q=q.order('score',{ascending:false}).limit(100);const {data:runs,error}=await q;if(error){$('leaderList').innerHTML='<div class="empty-state">Could not load leaderboard.</div>';console.error(error);return}const ids=[...new Set((runs||[]).map(r=>r.user_id))];let profiles=[];if(ids.length){const r=await criloDB.from('profiles').select('id,username,name_color,is_owner').in('id',ids);profiles=r.data||[]}const pm=new Map(profiles.map(p=>[p.id,p]));const visible=(runs||[]).filter(run=>{const oldFifteen=Number(run.score)===15&&Number(run.spins)===8&&Number(run.upgrades)===0&&Number(run.doubles)===1&&Number(run.ducks)===2;const oldEightSixtyFour=Number(run.score)===864&&Number(run.spins)===11&&Number(run.upgrades)===3&&Number(run.doubles)===1&&Number(run.ducks)===0;return !(oldFifteen||oldEightSixtyFour)});render(visible,pm)}
async function loadBadges(){
 $('leaderList').innerHTML='<div class="empty-state">Loading badge collectors…</div>';
 const {data:earned,error}=await criloDB.from('user_badges').select('user_id,badge_id').limit(10000);
 if(error){$('leaderList').innerHTML='<div class="empty-state">Badge rankings unavailable: '+Crilo.esc(error.message)+'</div>';return}
 const counts=new Map();for(const b of earned||[]){if(!counts.has(b.user_id))counts.set(b.user_id,new Set());counts.get(b.user_id).add(b.badge_id)}
 const entries=[...counts].map(([user_id,ids])=>({user_id,count:ids.size})).sort((a,b)=>b.count-a.count).slice(0,100);
 const ids=entries.map(x=>x.user_id);let profiles=[];if(ids.length){const {data}=await criloDB.from('profiles').select('id,username,name_color').in('id',ids);profiles=data||[]}
 renderBadgeLeaders(entries,new Map(profiles.map(p=>[p.id,p])));
}
function renderBadgeLeaders(entries,profiles){
 $('bestHeading').textContent='ALL-TIME BADGE COLLECTORS';$('leaderDescription').textContent='Unique badges earned, not featured slots. Ties share a rank.';$('bestDrawing').classList.add('hidden');
 if(!entries.length){$('bestScore').textContent='—';$('bestUser').textContent='No badges earned yet';$('bestStats').textContent='Earn badges by playing.';$('leaderList').innerHTML='<div class="empty-state">No badges earned yet.</div>';return}
 const best=entries[0],p=profiles.get(best.user_id);$('bestScore').textContent=best.count.toLocaleString()+' badges';$('bestUser').textContent=p?.username||'Crilo player';$('bestUser').style.color=p?.name_color||'';$('bestStats').textContent='Most badges earned across Crilo';
 $('leaderList').innerHTML=entries.map(e=>{const p=profiles.get(e.user_id),rank=entries.findIndex(x=>x.count===e.count)+1;return '<div class="leader-row"><div class="rank">'+(rank<=3?['🥇','🥈','🥉'][rank-1]:rank)+'</div><div><span class="leader-name" style="color:'+(p?.name_color||'inherit')+'">'+Crilo.esc(p?.username||'Crilo player')+'</span><span class="leader-mini">Unique badges unlocked</span></div><div class="leader-score">'+e.count.toLocaleString()+'</div></div>'}).join('');
}
function render(runs,pm){const headings={today:'TODAY’S TOP SCORE',week:'WEEKLY TOP SCORE',all:'ALL-TIME TOP SCORE',records:'LONGEST DAILY RUN',badges:'ALL-TIME BADGE COLLECTORS',ducks:'ALL-TIME DUCK RECORD'};const descriptions={today:'The highest score from today’s Daily.',week:'The highest score from the last seven Daily periods.',all:'The highest score ever recorded.',records:'Most spins in a single official Daily. Score breaks ties.',badges:'Players ranked by the number of unique badges earned.',ducks:'The most ducks collected in a single official run in Crilo history.'};$('bestHeading').textContent=headings[tab];$('leaderDescription').textContent=descriptions[tab];if(!runs.length){$('bestScore').textContent='—';$('bestUser').textContent='No completed runs yet';$('bestStats').textContent='Be the first.';$('bestDrawing').classList.add('hidden');$('leaderList').innerHTML='<div class="empty-state">No scores here yet.</div>';return}const best=runs[0],bp=pm.get(best.user_id);$('bestScore').textContent=tab==='records'?Number(best.spins).toLocaleString()+' spins':tab==='ducks'?Number(best.ducks).toLocaleString()+' 🦆':Number(best.score).toLocaleString();$('bestUser').textContent=bp?.username||'Crilo player';$('bestUser').style.color=bp?.name_color||'';$('bestStats').textContent=`${best.spins} spins • ${best.upgrades} upgrades • ${best.doubles} doubles • ${best.ducks} ducks`;$('bestDrawing').classList.toggle('hidden',!best.drawing);if(best.drawing)$('bestDrawing').src=best.drawing;const medals=['🥇','🥈','🥉'];$('leaderList').innerHTML=runs.map((r,i)=>{const p=pm.get(r.user_id),metric=tab==='records'?`${Number(r.spins).toLocaleString()} spins`:tab==='ducks'?`${Number(r.ducks).toLocaleString()} 🦆`:Number(r.score).toLocaleString();return `<div class="leader-row"><div class="rank">${medals[i]||i+1}</div><div><a class="leader-name" href="profile.html?id=${encodeURIComponent(r.user_id)}" style="color:${p?.name_color||'inherit'}">${Crilo.esc(p?.username||'Crilo player')}</a><span class="leader-mini">${r.spins} spins · ${r.upgrades} upgrades · ${r.doubles} doubles · ${r.ducks} ducks${r._ownerTest?' · OWNER TEST (only you see this)':''}</span></div><div class="leader-score">${metric}</div>${r.drawing?`<button class="mini-wheel" title="Spin artwork" data-drawing="${i}"><img src="${r.drawing}" alt="Player artwork"></button>`:""}</div>`}).join('');document.querySelectorAll('.mini-wheel').forEach(b=>b.addEventListener('click',()=>{const img=b.querySelector('img');img.animate([{transform:'rotate(0deg)'},{transform:'rotate(1440deg)'}],{duration:2300,easing:'cubic-bezier(.1,.65,.2,1)'});}));}
document.querySelectorAll('.leader-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.leader-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');tab=b.dataset.tab;if(tab==='tests'){preview=false;$('previewBanner')?.classList.add('hidden');$('previewToggle').textContent='Preview sample players'}if(preview)previewRender();else load()}));load()})();
