(() => {const $=id=>document.getElementById(id);let tab='today';
let loadRevision=0;
const safeColor = value => /^#[0-9a-fA-F]{6}$/.test(String(value||'')) ? String(value) : 'inherit';
// These two old pre-verification sample-like rows were already intentionally
// excluded from public score boards. Do not hide future verified real results
// that happen to have matching score/counter totals.
function isLegacyPreviewRun(run){
 if(run.verified_spin_session_id||String(run.daily_period||'')>='2026-10-09')return false;
 const oldFifteen=Number(run.score)===15&&Number(run.spins)===8&&Number(run.upgrades)===0&&Number(run.doubles)===1&&Number(run.ducks)===2;
 const oldEightSixtyFour=Number(run.score)===864&&Number(run.spins)===11&&Number(run.upgrades)===3&&Number(run.doubles)===1&&Number(run.ducks)===0;
 return oldFifteen||oldEightSixtyFour;
}
// Use the exact seven final-score thresholds from the Daily Wheel, not the
// rank, spin count, badge count, or lifetime duck count of a leaderboard row.
function scoreRarity(value){
 const score=Number(value);
 if(!Number.isFinite(score)||score<0)return '';
 const band=window.CriloRarity?.scoreBands?.find(item=>score<=item.max);
 return band?.key||'';
}
// Preserve the exact stored drawing, or show the user's genuinely blank canvas.
function drawingSrc(drawing){
 return typeof drawing==='string'&&/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/.test(drawing)
  ?drawing:'blank-wheel.svg';
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
 }else if(source==='bonus'){
  const reason=prompt('Reason to hide this Bonus Run from the public leaderboard (10–240 characters):');
  if(reason===null)return;
  if(reason.trim().length<10||reason.trim().length>240){alert('Enter a specific reason (10–240 characters).');return;}
  if(!confirm('Hide this Bonus Run from the leaderboard? The player’s saved private run remains.'))return;
  ({data,error}=await criloDB.rpc('crilo_owner_hide_bonus_leaderboard_run',{p_run_id:id,p_reason:reason.trim()}));
 }else{
  if(!confirm('Delete this private owner Test Run? Official players will not be affected.'))return;
  ({data,error}=await criloDB.rpc('crilo_owner_moderate_run',{p_id:id,p_source:source}));
 }
 if(error){alert('Could not remove run: '+error.message);return}
 if(!data){alert('Run not found or already removed.');return}
 await load();
}
$('leaderList')?.addEventListener('click',e=>{
 const wheel=e.target.closest?.('.mini-wheel');
 if(wheel){window.CriloWheelPreview?.openFrom(wheel);return}
 const btn=e.target.closest?.('.owner-remove-run');
 if(btn)moderateRun(btn.dataset.id,btn.dataset.source);
});
$('bestDrawing')?.addEventListener('click',()=>window.CriloWheelPreview?.openFrom($('bestDrawing')));
$('bestDrawing')?.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){
  e.preventDefault();
  window.CriloWheelPreview?.openFrom($('bestDrawing'));
 }
});
async function load(){
 const revision=++loadRevision;
 const note=$('rankedRunNote');
 if(note){if(['today','week','all','records'].includes(tab))note.classList.remove('hidden');else note.classList.add('hidden');}
 if(tab==='badges'){await loadBadges(revision);return}if(tab==='ducks'){await loadDucks(revision);return}if(tab==='points'){await loadTotalPoints(revision);return}
 $('leaderList').innerHTML='<div class="empty-state">Loading scores…</div>';
 // Verified server-side UNION ALL selects the real Top 100 across both
 // official Dailies and Bonus Runs, with no per-user deduplication.
 const ranked=await criloDB.rpc('crilo_public_run_leaders',{p_board:tab,p_limit:100});
 if(revision!==loadRevision)return;
 if(ranked.error){$('leaderList').innerHTML='<div class="empty-state">Could not load leaderboard: '+Crilo.esc(ranked.error.message)+'</div>';return}
 const runs=(ranked.data||[]).filter(run=>!isLegacyPreviewRun(run))
  .map(r=>({...r,_source:r.source==='bonus'?'bonus':'official'}));
 if(tab==='records')runs.sort((a,b)=>b.spins-a.spins||b.score-a.score);
 else if(tab==='ducks')runs.sort((a,b)=>b.ducks-a.ducks||b.score-a.score);
 else runs.sort((a,b)=>b.score-a.score);
 const visible=runs.slice(0,100);
 const ids=[...new Set(visible.map(r=>r.user_id))];
 let profiles=[];
 if(ids.length){const result=await criloDB.from('profiles').select('id,username,name_color,name_letter_colors,is_owner').in('id',ids);if(revision!==loadRevision)return;profiles=result.data||[]}
 render(visible,new Map(profiles.map(p=>[p.id,p])));
}
// One aggregated row per player, from the database over every official Daily.
// Owner Test Runs are stored separately and can never add to these totals.
async function loadTotalPoints(revision){
 $('bestRunKind')?.classList.add('hidden');
 $('leaderList').innerHTML='<div class="empty-state">Loading all-time points…</div>';
 const {data,error}=await criloDB.rpc('crilo_total_points_leaders',{p_limit:100});
 if(revision!==loadRevision)return;
 if(error){
  setBestScoreRarity(null);
  $('leaderList').innerHTML='<div class="empty-state">Total points are unavailable: '+
   Crilo.esc(error.message)+'</div>';
  return;
 }
 const entries=data||[];
 const {data:pointProfileColors}=await criloDB.from('profiles')
  .select('id,name_letter_colors').in('id',entries.map(item=>item.user_id));
 if(revision!==loadRevision)return;
 const pointsColors=new Map((pointProfileColors||[]).map(x=>[x.id,x.name_letter_colors]));
 setBestScoreRarity(null); // cumulative points are NOT one Daily's score tier.
 $('bestHeading').textContent='ALL-TIME POINTS LEADER';
 $('bestDrawing').classList.add('hidden');
 if(!entries.length){
  $('bestScore').textContent='—';$('bestUser').textContent='No points recorded yet';
  $('bestStats').textContent='Complete an official Daily to begin accumulating points.';
  $('leaderList').innerHTML='<div class="empty-state">No official Daily runs yet.</div>';
  return;
 }
 const leader=entries[0];
 const fmt=n=>Number(n||0).toLocaleString();
 $('bestScore').textContent=fmt(leader.total_points);
 window.CriloNameColors.paint($('bestUser'),{...leader,name_letter_colors:pointsColors.get(leader.user_id)});
 $('bestStats').textContent=fmt(leader.official_runs)+' official Dailies played · lifetime points';
 // Competition ranks: scores tied for first share #1; next player is #3.
 $('leaderList').innerHTML=entries.map((entry,index)=>{
  const rank=entries.findIndex(x=>Number(x.total_points)===Number(entry.total_points))+1;
  const icon=rank<=3?['🥇','🥈','🥉'][rank-1]:String(rank);
  return '<div class="leader-row crilo-lifetime-points-row">'+
   '<div class="rank">'+icon+'</div><div class="leader-player">'+
   '<a class="leader-name" href="profile.html?id='+encodeURIComponent(entry.user_id)+
   '" style="color:'+safeColor(entry.name_color)+'">'+
   window.CriloNameColors.markup({...entry,name_letter_colors:pointsColors.get(entry.user_id)})+'</a>'+
   '<span class="leader-mini">'+fmt(entry.official_runs)+' official Dailies played</span>'+
   '</div><div class="leader-score-wrap"><div class="leader-score">'+fmt(entry.total_points)+
   '</div><small class="leader-total-units">pts</small></div></div>';
 }).join('');
}
function duckCountHTML(value){
 const count=Math.max(0,Number(value)||0).toLocaleString('en-US');
 // Original Classic illustration from the Meet the Ducks catalog.
 return '<span class="leader-duck-value"><span>'+count+'</span><img src="duck-classic.svg" class="leader-duck-icon leader-duck-icon-count" alt="" aria-hidden="true"></span>';
}
async function loadDucks(revision){
 $('bestRunKind')?.classList.add('hidden');
 $('leaderList').innerHTML='<div class="empty-state">Loading lifetime duck totals…</div>';
 const totals=new Map();let offset=0;
 // Fetch all official runs, not just the top 100 single-run results.
 while(true){
  const {data,error}=await criloDB.from('daily_runs').select('user_id,ducks,daily_period,score,spins,upgrades,doubles,verified_spin_session_id').eq('is_test',false).not('verified_spin_session_id','is',null).order('id',{ascending:true}).range(offset,offset+999);
  if(revision!==loadRevision)return;
  if(error){$('leaderList').innerHTML='<div class="empty-state">Could not load duck totals: '+Crilo.esc(error.message)+'</div>';return}
  for(const run of data||[]){if(isLegacyPreviewRun(run))continue;totals.set(run.user_id,(totals.get(run.user_id)||0)+Number(run.ducks||0));}
  if(!data||data.length<1000)break;
  offset+=1000;
 }
 const entries=[...totals].map(([user_id,count])=>({user_id,count})).sort((a,b)=>b.count-a.count||a.user_id.localeCompare(b.user_id)).slice(0,100);
 const ids=entries.map(x=>x.user_id);let profiles=[];
 if(ids.length){const {data}=await criloDB.from('profiles').select('id,username,name_color,name_letter_colors').in('id',ids);if(revision!==loadRevision)return;profiles=data||[]}
 renderDuckLeaders(entries,new Map(profiles.map(p=>[p.id,p])));
}
function renderDuckLeaders(entries,profiles){
 setBestScoreRarity(null); // Duck totals are counts, never final-score tiers.
 $('bestHeading').textContent='ALL-TIME DUCK COLLECTORS';
 $('bestDrawing').classList.add('hidden');
 if(!entries.length){$('bestScore').textContent='—';$('bestUser').textContent='No ducks collected yet';$('bestStats').textContent='Complete official Dailies to collect ducks.';$('leaderList').innerHTML='<div class="empty-state">No official Daily runs yet.</div>';return}
 const best=entries[0],p=profiles.get(best.user_id);
 $('bestScore').innerHTML=duckCountHTML(best.count);window.CriloNameColors.paint($('bestUser'),p);$('bestStats').textContent='Ducks collected across all official Daily runs';
 $('leaderList').innerHTML=entries.map(e=>{const p=profiles.get(e.user_id),rank=entries.findIndex(x=>x.count===e.count)+1;return '<div class="leader-row"><div class="rank">'+(rank<=3?['🥇','🥈','🥉'][rank-1]:rank)+'</div><div><a class="leader-name" href="profile.html?id='+encodeURIComponent(e.user_id)+'" style="color:'+safeColor(p?.name_color)+'">'+window.CriloNameColors.markup(p||{username:'Crilo player'})+'</a><span class="leader-mini">Total ducks from official Daily runs</span></div><div class="leader-score leader-duck-score">'+duckCountHTML(e.count)+'</div></div>'}).join('');
}
async function loadBadges(revision){
 $('bestRunKind')?.classList.add('hidden');
 $('leaderList').innerHTML='<div class="empty-state">Loading gameplay badge collectors…</div>';
 const {data,error}=await criloDB.rpc('crilo_gameplay_badge_leaders',{p_limit:100});
 if(revision!==loadRevision)return;
 if(error){$('leaderList').innerHTML='<div class="empty-state">Badge rankings unavailable: '+Crilo.esc(error.message)+'</div>';return}
 const entries=(data||[]).map(x=>({user_id:x.user_id,count:Number(x.gameplay_badges)||0}));
 const {data:badgeInkRows}=await criloDB.from('profiles').select('id,name_letter_colors')
 .in('id',entries.map(x=>x.user_id));
 if(revision!==loadRevision)return;
 const badgeInk=new Map((badgeInkRows||[]).map(x=>[x.id,x.name_letter_colors]));
 const profiles=new Map((data||[]).map(x=>[x.user_id,{
  username:x.username,name_color:x.name_color,name_letter_colors:badgeInk.get(x.user_id)}]));
 renderBadgeLeaders(entries,profiles);
}
function renderBadgeLeaders(entries,profiles){
 setBestScoreRarity(null); // A badge count cannot be classified as a score.
 $('bestHeading').textContent='ALL-TIME BADGE COLLECTORS';$('bestDrawing').classList.add('hidden');
 if(!entries.length){$('bestScore').textContent='—';$('bestUser').textContent='No badges earned yet';$('bestStats').textContent='Earn badges by playing.';$('leaderList').innerHTML='<div class="empty-state">No badges earned yet.</div>';return}
 const best=entries[0],p=profiles.get(best.user_id);$('bestScore').textContent=best.count.toLocaleString();window.CriloNameColors.paint($('bestUser'),p);$('bestStats').textContent='Most gameplay badges earned from official Crilo play';
 $('leaderList').innerHTML=entries.map(e=>{const p=profiles.get(e.user_id),rank=entries.findIndex(x=>x.count===e.count)+1;return '<div class="leader-row"><div class="rank">'+(rank<=3?['🥇','🥈','🥉'][rank-1]:rank)+'</div><div><a class="leader-name" href="profile.html?id='+encodeURIComponent(e.user_id)+'" style="color:'+safeColor(p?.name_color)+'">'+window.CriloNameColors.markup(p||{username:'Crilo player'})+'</a><span class="leader-mini">Gameplay badges unlocked</span></div><div class="leader-score">'+e.count.toLocaleString()+'</div></div>'}).join('');
}
function runLabel(r){return r._source==='bonus'?'Bonus Run '+Number(r.slot||0):'Official Daily'}
function render(runs,pm){
 const headings={today:'TODAY’S TOP SCORE',week:'WEEKLY TOP SCORE',all:'ALL-TIME TOP SCORE',records:'LONGEST DAILY RUN',badges:'ALL-TIME BADGE COLLECTORS',ducks:'ALL-TIME DUCK RECORD'};
 $('bestHeading').textContent=headings[tab];
 const scoreBoard=tab==='today'||tab==='week'||tab==='all';
 setBestScoreRarity(scoreBoard&&runs.length?runs[0].score:null);
 if(!runs.length){
  $('bestRunKind')?.classList.add('hidden');
  $('bestScore').textContent='—';
  $('bestUser').textContent='No completed runs yet';
  $('bestStats').textContent='Be the first.';
  $('bestDrawing').classList.add('hidden');
  $('leaderList').innerHTML='<div class="empty-state">No scores here yet.</div>';
  return;
 }
 const best=runs[0],bp=pm.get(best.user_id);
 const bestRunKind=$('bestRunKind');
 if(bestRunKind){bestRunKind.textContent=runLabel(best);bestRunKind.hidden=false;bestRunKind.classList.remove('hidden')}
 $('bestScore').textContent=tab==='records'?Number(best.spins).toLocaleString():
  Number(best.score).toLocaleString();
 if(tab==='ducks')$('bestScore').innerHTML=duckCountHTML(best.ducks);
 window.CriloNameColors.paint($('bestUser'),bp);
 $('bestStats').innerHTML=[
  ['Spins',best.spins],['Upgrades',best.upgrades],['Doubles',best.doubles],['Ducks',best.ducks]
 ].map(([label,value])=>'<span class="best-metric"><strong>'+
  Math.max(0,Number(value)||0).toLocaleString('en-US')+
  '</strong><span>'+label+'</span></span>').join('');
 if(best._source==='bonus')$('bestDrawing').classList.add('hidden');
 else $('bestDrawing').classList.remove('hidden');
 $('bestDrawing').src=drawingSrc(best.drawing);
 $('bestDrawing').alt=drawingSrc(best.drawing)==='blank-wheel.svg'?'Top player blank drawing':'Top player wheel artwork';
 const medals=['🥇','🥈','🥉'];
 const canModerate=Boolean(Crilo.profile?.is_owner);
 $('leaderList').innerHTML=runs.map((r,i)=>{
  const p=pm.get(r.user_id);
  const metric=tab==='records'?Number(r.spins).toLocaleString():
   tab==='ducks'?duckCountHTML(r.ducks):Number(r.score).toLocaleString();
  const tier=scoreRarity(r.score);
  const scoreAttr=scoreBoard&&tier?` data-score-rarity="${tier}" title="${tier.toUpperCase()} final score"`:'';
  const secondary=tab==='records'&&tier?
   `<small class="leader-score-secondary" data-score-rarity="${tier}">Spins · Score ${Number(r.score).toLocaleString()} · ${tier.toUpperCase()}</small>`:'';
  const remove=canModerate?
   `<button type="button" class="owner-remove-run" data-id="${Crilo.esc(r.id)}" data-source="${r._source}" title="Remove score and drawing">Remove</button>`:'';
  const bonus=r._source==='bonus';
  return `<div class="leader-row score-run-row${bonus?' is-bonus':''}${canModerate?' owner-moderated':''}" data-run-source="${bonus?'bonus':'official'}">
   <div class="rank">${medals[i]||i+1}</div>
   <div class="leader-player"><a class="leader-name" href="profile.html?id=${encodeURIComponent(r.user_id)}" style="color:${safeColor(p?.name_color)}">${window.CriloNameColors.markup(p||{username:'Crilo player'})}</a><span class="leader-mini"><span class="crilo-run-kind${bonus?' is-bonus':''}">${runLabel(r)}</span> · ${r.spins} spins · ${r.upgrades} upgrades · ${r.doubles} doubles · ${r.ducks} ducks</span></div>
   <div class="leader-score-actions">${remove}<div class="leader-score-wrap"><div class="leader-score"${scoreAttr}>${metric}</div>${secondary}</div></div>
   ${bonus?'':`<button type="button" class="mini-wheel" title="Expand wheel drawing" aria-label="Expand wheel drawing" data-drawing="${i}"><img src="${drawingSrc(r.drawing)}" alt="${drawingSrc(r.drawing)==='blank-wheel.svg'?'Blank drawing':'Player artwork'}"></button>`}
  </div>`;
 }).join('');

}
document.querySelectorAll('.leader-tab').forEach(b=>{
 b.setAttribute?.('aria-pressed',b.dataset.tab===tab?'true':'false');
 b.addEventListener('click',()=>{
  document.querySelectorAll('.leader-tab').forEach(x=>{
   x.classList.remove('active');
   x.setAttribute?.('aria-pressed','false');
  });
  b.classList.add('active');
  b.setAttribute?.('aria-pressed','true');
  tab=b.dataset.tab;
  load();
 });
});
load()})();
