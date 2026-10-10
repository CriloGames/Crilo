(() => {const $=id=>document.getElementById(id);let tab='today';
const safeColor = value => /^#[0-9a-fA-F]{6}$/.test(String(value||'')) ? String(value) : 'inherit';
// Use the exact seven final-score thresholds from the Daily Wheel, not the
// rank, spin count, badge count, or lifetime duck count of a leaderboard row.
function scoreRarity(value){
 const score=Number(value);
 if(!Number.isFinite(score)||score<0)return '';
 const band=window.CriloRarity?.scoreBands?.find(item=>score<=item.max);
 return band?.key||'';
}
function setBestScoreRarity(value){
 const tier=value===null?'':scoreRarity(value);
 if(tier)$('bestScore').dataset.scoreRarity=tier;
 else delete $('bestScore').dataset.scoreRarity;
}
window.addEventListener('crilo-auth-ready',()=>load());
async function moderateRun(id,source){
 if(!Crilo.profile?.is_owner)return;
 let data,error;
 if(source==='official'){
  // Official removal for inappropriate artwork must use the same penalty
  // transaction as Drawing Review. A reason is required and publicly shown.
  const options=[
   ['1','profanity','Profanity or offensive text'],
   ['2','sexual','Sexual or genital drawing'],
   ['3','hate','Hate or extremist symbol'],
   ['4','links','Website link or external promotion'],
   ['5','qr','QR code or scannable link'],
   ['6','abuse','Harassment or abusive message'],
   ['7','other','Other inappropriate drawing']
  ];
  const choice=prompt('Reason for permanently deleting this official Daily and issuing a PUBLIC account warning:\n'+
   options.map(x=>x[0]+'. '+x[2]).join('\n')+'\nCancel to keep the run.');
  if(choice===null)return;
  const selected=options.find(x=>x[0]===choice.trim());
  if(!selected){alert('Choose a valid reason from 1 to 7. No changes made.');return}
  if(!confirm('FINAL CONFIRMATION: Delete the Daily and its points, reset the streak, block replay of that Daily period, and issue a permanent public warning for '+selected[2]+'?'))return;
  ({data,error}=await criloDB.rpc('crilo_owner_penalize_daily',{p_run_id:Number(id),p_reason:selected[1]}));
 }else{
  if(!confirm('Delete this private owner Test Run? Official players will not be affected.'))return;
  ({data,error}=await criloDB.rpc('crilo_owner_moderate_run',{p_id:id,p_source:source}));
 }
 if(error){alert('Could not remove run: '+error.message);return}
 if(!data){alert('Run not found or already removed.');return}
 await load();
}
$('leaderList')?.addEventListener('click',e=>{
 const btn=e.target.closest('.owner-remove-run');
 if(btn)moderateRun(btn.dataset.id,btn.dataset.source);
});
function periodDaysAgo(n){const d=new Date(Date.now()-n*86400000),shifted=new Date(d.getTime()-22*3600000);return shifted.toISOString().slice(0,10)}
async function load(){
 if(tab==='badges'){await loadBadges();return}if(tab==='ducks'){await loadDucks();return}if(tab==='points'){await loadTotalPoints();return}
 $('leaderList').innerHTML='<div class="empty-state">Loading scores…</div>';
 const fields='id,user_id,daily_period,score,spins,upgrades,doubles,ducks,drawing,rarity_odds,rarity_label,created_at';
 let q=criloDB.from('daily_runs').select(fields).eq('is_test',false);
 if(tab==='today')q=q.eq('daily_period',Crilo.dailyPeriod()).order('score',{ascending:false}).limit(100);
 else if(tab==='week')q=q.gte('daily_period',periodDaysAgo(6)).order('score',{ascending:false}).limit(100);
 else if(tab==='records')q=q.order('spins',{ascending:false}).order('score',{ascending:false}).limit(100);
 else if(tab==='ducks')q=q.order('ducks',{ascending:false}).order('score',{ascending:false}).limit(100);
 else q=q.order('score',{ascending:false}).limit(100);
 const official=await q;
 if(official.error){$('leaderList').innerHTML='<div class="empty-state">Could not load leaderboard: '+Crilo.esc(official.error.message)+'</div>';return}
 const runs=(official.data||[]).filter(run=>{
  const oldFifteen=Number(run.score)===15&&Number(run.spins)===8&&Number(run.upgrades)===0&&Number(run.doubles)===1&&Number(run.ducks)===2;
  const oldEightSixtyFour=Number(run.score)===864&&Number(run.spins)===11&&Number(run.upgrades)===3&&Number(run.doubles)===1&&Number(run.ducks)===0;
  return !(oldFifteen||oldEightSixtyFour);
 }).map(r=>({...r,_source:'official'}));
 if(tab==='records')runs.sort((a,b)=>b.spins-a.spins||b.score-a.score);
 else if(tab==='ducks')runs.sort((a,b)=>b.ducks-a.ducks||b.score-a.score);
 else runs.sort((a,b)=>b.score-a.score);
 const visible=runs.slice(0,100);
 const ids=[...new Set(visible.map(r=>r.user_id))];
 let profiles=[];
 if(ids.length){const result=await criloDB.from('profiles').select('id,username,name_color,is_owner').in('id',ids);profiles=result.data||[]}
 render(visible,new Map(profiles.map(p=>[p.id,p])));
}
// One aggregated row per player, from the database over every official Daily.
// Owner Test Runs are stored separately and can never add to these totals.
async function loadTotalPoints(){
 $('leaderList').innerHTML='<div class="empty-state">Loading all-time points…</div>';
 const {data,error}=await criloDB.rpc('crilo_total_points_leaders',{p_limit:100});
 if(error){
  setBestScoreRarity(null);
  $('leaderList').innerHTML='<div class="empty-state">Total points are unavailable: '+
   Crilo.esc(error.message)+'</div>';
  return;
 }
 const entries=data||[];
 setBestScoreRarity(null); // cumulative points are NOT one Daily's score tier.
 $('bestHeading').textContent='ALL-TIME POINTS LEADER';
 $('leaderDescription').textContent='Every point earned across all official Daily runs, added together. Private Test Runs do not count.';
 $('bestDrawing').classList.add('hidden');
 if(!entries.length){
  $('bestScore').textContent='—';$('bestUser').textContent='No points recorded yet';
  $('bestStats').textContent='Complete an official Daily to begin accumulating points.';
  $('leaderList').innerHTML='<div class="empty-state">No official Daily runs yet.</div>';
  return;
 }
 const leader=entries[0];
 const fmt=n=>Number(n||0).toLocaleString();
 $('bestScore').textContent=fmt(leader.total_points)+' pts';
 $('bestUser').textContent=leader.username||'Crilo player';
 $('bestUser').style.color=leader.name_color||'';
 $('bestStats').textContent=fmt(leader.official_runs)+' official Dailies played · lifetime points';
 // Competition ranks: scores tied for first share #1; next player is #3.
 $('leaderList').innerHTML=entries.map((entry,index)=>{
  const rank=entries.findIndex(x=>Number(x.total_points)===Number(entry.total_points))+1;
  const icon=rank<=3?['🥇','🥈','🥉'][rank-1]:String(rank);
  return '<div class="leader-row crilo-lifetime-points-row">'+
   '<div class="rank">'+icon+'</div><div class="leader-player">'+
   '<a class="leader-name" href="profile.html?id='+encodeURIComponent(entry.user_id)+
   '" style="color:'+safeColor(entry.name_color)+'">'+
   Crilo.esc(entry.username||'Crilo player')+'</a>'+
   '<span class="leader-mini">'+fmt(entry.official_runs)+' official Dailies played</span>'+
   '</div><div class="leader-score">'+fmt(entry.total_points)+
   ' <small class="leader-total-units">pts</small></div></div>';
 }).join('');
}
async function loadDucks(){
 $('leaderList').innerHTML='<div class="empty-state">Loading lifetime duck totals…</div>';
 const totals=new Map();let offset=0;
 // Fetch all official runs, not just the top 100 single-run results.
 while(true){
  const {data,error}=await criloDB.from('daily_runs').select('user_id,ducks').eq('is_test',false).order('id',{ascending:true}).range(offset,offset+999);
  if(error){$('leaderList').innerHTML='<div class="empty-state">Could not load duck totals: '+Crilo.esc(error.message)+'</div>';return}
  for(const run of data||[])totals.set(run.user_id,(totals.get(run.user_id)||0)+Number(run.ducks||0));
  if(!data||data.length<1000)break;
  offset+=1000;
 }
 const entries=[...totals].map(([user_id,count])=>({user_id,count})).sort((a,b)=>b.count-a.count||a.user_id.localeCompare(b.user_id)).slice(0,100);
 const ids=entries.map(x=>x.user_id);let profiles=[];
 if(ids.length){const {data}=await criloDB.from('profiles').select('id,username,name_color').in('id',ids);profiles=data||[]}
 renderDuckLeaders(entries,new Map(profiles.map(p=>[p.id,p])));
}
function renderDuckLeaders(entries,profiles){
 setBestScoreRarity(null); // Duck totals are counts, never final-score tiers.
 $('bestHeading').textContent='ALL-TIME DUCK COLLECTORS';
 $('leaderDescription').textContent='Total ducks collected across all official Daily runs. Private test runs do not count. Ties share a rank.';
 $('bestDrawing').classList.add('hidden');
 if(!entries.length){$('bestScore').textContent='—';$('bestUser').textContent='No ducks collected yet';$('bestStats').textContent='Complete official Dailies to collect ducks.';$('leaderList').innerHTML='<div class="empty-state">No official Daily runs yet.</div>';return}
 const best=entries[0],p=profiles.get(best.user_id);
 $('bestScore').textContent=best.count.toLocaleString()+' 🦆';$('bestUser').textContent=p?.username||'Crilo player';$('bestUser').style.color=p?.name_color||'';$('bestStats').textContent='Ducks collected across all official Daily runs';
 $('leaderList').innerHTML=entries.map(e=>{const p=profiles.get(e.user_id),rank=entries.findIndex(x=>x.count===e.count)+1;return '<div class="leader-row"><div class="rank">'+(rank<=3?['🥇','🥈','🥉'][rank-1]:rank)+'</div><div><a class="leader-name" href="profile.html?id='+encodeURIComponent(e.user_id)+'" style="color:'+safeColor(p?.name_color)+'">'+Crilo.esc(p?.username||'Crilo player')+'</a><span class="leader-mini">Total ducks from official Daily runs</span></div><div class="leader-score">'+e.count.toLocaleString()+' 🦆</div></div>'}).join('');
}
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
 setBestScoreRarity(null); // A badge count cannot be classified as a score.
 $('bestHeading').textContent='ALL-TIME BADGE COLLECTORS';$('leaderDescription').textContent='Unique badges earned, not featured slots. Ties share a rank.';$('bestDrawing').classList.add('hidden');
 if(!entries.length){$('bestScore').textContent='—';$('bestUser').textContent='No badges earned yet';$('bestStats').textContent='Earn badges by playing.';$('leaderList').innerHTML='<div class="empty-state">No badges earned yet.</div>';return}
 const best=entries[0],p=profiles.get(best.user_id);$('bestScore').textContent=best.count.toLocaleString()+' badges';$('bestUser').textContent=p?.username||'Crilo player';$('bestUser').style.color=p?.name_color||'';$('bestStats').textContent='Most badges earned across Crilo';
 $('leaderList').innerHTML=entries.map(e=>{const p=profiles.get(e.user_id),rank=entries.findIndex(x=>x.count===e.count)+1;return '<div class="leader-row"><div class="rank">'+(rank<=3?['🥇','🥈','🥉'][rank-1]:rank)+'</div><div><span class="leader-name" style="color:'+safeColor(p?.name_color)+'">'+Crilo.esc(p?.username||'Crilo player')+'</span><span class="leader-mini">Unique badges unlocked</span></div><div class="leader-score">'+e.count.toLocaleString()+'</div></div>'}).join('');
}
function render(runs,pm){
 const headings={today:'TODAY’S TOP SCORE',week:'WEEKLY TOP SCORE',all:'ALL-TIME TOP SCORE',records:'LONGEST DAILY RUN',badges:'ALL-TIME BADGE COLLECTORS',ducks:'ALL-TIME DUCK RECORD'};
 const descriptions={today:'The highest score from today’s official Daily.',week:'The highest score from the last seven Daily periods.',all:'The highest score ever recorded.',records:'Most spins in a single run. Score breaks ties.',badges:'Players ranked by the number of unique badges earned.',ducks:'The most ducks collected in a single run.'};
 $('bestHeading').textContent=headings[tab];
 $('leaderDescription').textContent=descriptions[tab];
 const scoreBoard=tab==='today'||tab==='week'||tab==='all';
 setBestScoreRarity(scoreBoard&&runs.length?runs[0].score:null);
 if(!runs.length){
  $('bestScore').textContent='—';
  $('bestUser').textContent='No completed runs yet';
  $('bestStats').textContent='Be the first.';
  $('bestDrawing').classList.add('hidden');
  $('leaderList').innerHTML='<div class="empty-state">No scores here yet.</div>';
  return;
 }
 const best=runs[0],bp=pm.get(best.user_id);
 $('bestScore').textContent=tab==='records'?Number(best.spins).toLocaleString()+' spins':
  tab==='ducks'?Number(best.ducks).toLocaleString()+' 🦆':Number(best.score).toLocaleString();
 $('bestUser').textContent=bp?.username||'Crilo player';
 $('bestUser').style.color=bp?.name_color||'';
 $('bestStats').textContent=`${best.spins} spins • ${best.upgrades} upgrades • ${best.doubles} doubles • ${best.ducks} ducks`;
 $('bestDrawing').classList.toggle('hidden',!best.drawing);
 if(best.drawing)$('bestDrawing').src=best.drawing;
 const medals=['🥇','🥈','🥉'];
 const canModerate=Boolean(Crilo.profile?.is_owner);
 $('leaderList').innerHTML=runs.map((r,i)=>{
  const p=pm.get(r.user_id);
  const metric=tab==='records'?`${Number(r.spins).toLocaleString()} spins`:
   tab==='ducks'?`${Number(r.ducks).toLocaleString()} 🦆`:Number(r.score).toLocaleString();
  const tier=scoreRarity(r.score);
  const scoreAttr=scoreBoard&&tier?` data-score-rarity="${tier}" title="${tier.toUpperCase()} final score"`:'';
  const secondary=tab==='records'&&tier?
   `<small class="leader-score-secondary" data-score-rarity="${tier}">Score ${Number(r.score).toLocaleString()} · ${tier.toUpperCase()}</small>`:'';
  const remove=canModerate?
   `<button type="button" class="owner-remove-run" data-id="${Crilo.esc(r.id)}" data-source="${r._source}" title="Remove score and drawing">Remove</button>`:'';
  return `<div class="leader-row score-run-row${canModerate?' owner-moderated':''}">
   <div class="rank">${medals[i]||i+1}</div>
   <div class="leader-player"><a class="leader-name" href="profile.html?id=${encodeURIComponent(r.user_id)}" style="color:${safeColor(p?.name_color)}">${Crilo.esc(p?.username||'Crilo player')}</a><span class="leader-mini">${r.spins} spins · ${r.upgrades} upgrades · ${r.doubles} doubles · ${r.ducks} ducks${r._source==='test'?' · PRIVATE RUN':''}</span></div>
   <div class="leader-score-actions">${remove}<div class="leader-score"${scoreAttr}>${metric}${secondary}</div></div>
   ${r.drawing?`<button class="mini-wheel" title="Spin artwork" data-drawing="${i}"><img src="${r.drawing}" alt="Player artwork"></button>`:''}
  </div>`;
 }).join('');
 document.querySelectorAll('.mini-wheel').forEach(b=>b.addEventListener('click',()=>{
  const img=b.querySelector('img');
  img.animate([{transform:'rotate(0deg)'},{transform:'rotate(1440deg)'}],{duration:2300,easing:'cubic-bezier(.1,.65,.2,1)'});
 }));
}
document.querySelectorAll('.leader-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.leader-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');tab=b.dataset.tab;load()}));load()})();
