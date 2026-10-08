(() => {const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);let target=params.get('id');const trophyIcon='<svg class="crilo-badge-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h14v8c0 6-3 9-7 9s-7-3-7-9V5Z"/><path d="M9 8H5v4c0 4 2 6 6 6M23 8h4v4c0 4-2 6-6 6M16 22v5m-6 1h12"/></svg>';
const duckIcon='<svg class="crilo-badge-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 18c0-4 3-7 7-7 2 0 4 1 5 2 0-5 3-8 7-8 3 0 5 2 5 5 0 2-1 3-2 4l4 2-4 2c-1 6-6 10-13 10-6 0-10-4-10-9 0-2 0-3 1-4Z"/><path d="M9 18c2 3 5 4 9 3"/><circle cx="24" cy="10" r="1" fill="currentColor" stroke="none"/></svg>';
const iconFor=c=>({score:'#',upgrade:'↑',double:'×2',duck:duckIcon,extra_spins:'+2',rarity:'✦',sequence:'↻',daily:'◷',leaderboard:trophyIcon,social:'☺',secret:'?'}[c]||'★');
async function load(){if(!target)target=Crilo.user?.id;if(!target){$('profileName').textContent='Sign in to see your statistics';return}const [{data:p},{data:stats,error:statsError},{data:metrics,error:metricsError},{data:badges,error:badgesError},{data:earned,error:earnedError},{data:featured},{data:domainScores}]=await Promise.all([criloDB.from('profiles').select('id,username,name_color,account_code').eq('id',target).maybeSingle(),criloDB.rpc('get_crilo_player_stats',{target_user:target}),criloDB.rpc('crilo_profile_metrics',{p_user:target}),criloDB.from('badges').select('id,badge_key,name,description,category,is_secret,sort_order').order('sort_order'),criloDB.from('user_badges').select('badge_id,earned_at').eq('user_id',target),criloDB.from('featured_badges').select('badge_id,position').eq('user_id',target).order('position'),criloDB.from('game_scores').select('score').eq('user_id',target).eq('game_key','domain').order('score',{ascending:false}).limit(5)]);if(!p){$('profileName').textContent='Player not found';return}$('profileName').textContent=p.username;$('profileName').style.color=p.name_color||'';$('avatar').textContent=(p.username||'C')[0].toUpperCase();$('profileCode').textContent=target===Crilo.user?.id?`Account code: ${p.account_code||'—'}`:'Crilo player';const s=metricsError?(stats?.[0]||{}):(metrics||{});
const {data:rarestOfficial,error:rarestError}=await criloDB.from('daily_runs')
 .select('score,spins,upgrades,doubles,ducks,extra_spins,best_roll_points,best_roll_label,daily_period,rarity_label,drawing')
 .eq('user_id',target).eq('is_test',false).order('score',{ascending:false}).limit(1).maybeSingle();
if(rarestError)console.warn('Could not load official rarest run',rarestError);const rareScore=Number(rarestOfficial?.score??s.best_score??0);const rareTier=!(statsError&&metricsError)&&Number(s.official_runs||0)>0&&window.CriloRarity?CriloRarity.classify(rareScore):null;if(metricsError)console.warn('Updated player statistics unavailable; run profile-metrics-and-featured-badges.sql',metricsError);if(statsError&&metricsError)console.error('Player statistics unavailable',statsError);const vals=[['Official Dailies',statsError&&metricsError?'—':s.official_runs??0],['Best Score',statsError&&metricsError?'—':Number(s.best_score||0).toLocaleString()],['Average Score',statsError&&metricsError?'—':Number(s.average_score||0).toLocaleString()],['Current Streak',s.current_streak||0],['Longest Streak',s.longest_streak||0],['Total Spins',Number(s.total_spins||0).toLocaleString()],['Upgrades',Number(s.total_upgrades||0).toLocaleString()],['Doubles',Number(s.total_doubles||0).toLocaleString()],['Total Ducks',Number(s.total_ducks||0).toLocaleString()],['Extra Spins',Number(s.total_extra_spins||0).toLocaleString()],['Best Roll',Number(s.best_roll_points||0).toLocaleString()],['Rarest Run',rareTier?((rareTier.probability*100).toFixed(rareTier.probability<0.01?3:rareTier.probability<0.1?2:1)+'%'):'—'],['Best Daily Rank',s.best_daily_rank?`#${s.best_daily_rank}`:'—'],['Daily Wins',s.daily_wins||0],['Podiums',s.podium_finishes||0],['Top 10s',s.top_10_finishes||0]];$('statsGrid').innerHTML=vals.map(([k,v])=>`<div class="stat-tile ${k==='Rarest Run'&&rareTier?'stat-rarity stat-rarity-'+rareTier.color:'' } ${k==='Rarest Run'&&rarestOfficial?'stat-rarity-clickable':''}" ${k==='Rarest Run'&&rarestOfficial?'role="button" tabindex="0" aria-label="View rarest official Daily run details"':''}><b>${v}</b><span>${k}</span>${k==='Rarest Run'&&rareTier?'<small class="stat-rarity-tier">'+Crilo.esc(rareTier.label)+'</small>':''}${k==='Rarest Run'&&rarestOfficial?'<small class="stat-rarity-hint">View run ↗</small>':''}</div>`).join('');const statDescriptions={
 'Official Dailies':'Number of official Daily games you completed. Private owner test runs do not count.',
 'Best Score':'Your highest score in a single official Daily.',
 'Average Score':'Your average score across all completed official Dailies.',
 'Current Streak':'Consecutive Daily periods you have played, including the current period if you have already completed it.',
 'Longest Streak':'Your longest consecutive streak of official Daily periods played.',
 'Total Spins':'Total wheel spins across all your official Dailies.',
 'Upgrades':'Total upgrade slices landed across all your official Dailies.',
 'Doubles':'Total double slices landed across all your official Dailies.',
 'Total Ducks':'Total ducks collected across all your official Dailies, not your single-day record.',
 'Extra Spins':'Total bonus spins earned from the extra-spins wheel slice across official Dailies.',
 'Best Roll':'Highest number of points earned from a single scoring spin across official Dailies.',
 'Rarest Run':'Your highest-scoring official Daily, with its estimated score rarity. Select to see its full run details.',
 'Best Daily Rank':'Your best final position on a completed Daily leaderboard. The current Daily does not count until reset.',
 'Daily Wins':'Number of completed Daily leaderboards where your official score finished tied for 1st or alone in 1st. Today is excluded until reset.',
 'Podiums':'Number of completed Daily leaderboards where you finished in the top 3, including ties. Today is excluded until reset.',
 'Top 10s':'Number of completed Daily leaderboards where you finished in the top 10, including ties. Today is excluded until reset.'
};
if(rarestOfficial){
 const modal=$('rarestRunModal'),open=()=>{
  const run=rarestOfficial,tier=window.CriloRarity?.classify(Number(run.score));
  $('rarestRunTitle').textContent='Your rarest official Daily';
  $('rarestRunScore').textContent=Number(run.score).toLocaleString()+' points';
  $('rarestRunRarity').textContent=tier?tier.label+' · About '+(tier.probability*100).toFixed(tier.probability<0.01?3:tier.probability<0.1?2:1)+'% of runs reach this score or higher':'';
  $('rarestRunDate').textContent='Daily: '+String(run.daily_period||'—');
  const items=[['Spins',run.spins],['Upgrades',run.upgrades],['Doubles',run.doubles],['Ducks',run.ducks],['Extra spins',run.extra_spins],['Best roll',run.best_roll_points]];
  $('rarestRunDetails').innerHTML=items.map(([label,value])=>'<div class="rarest-run-detail"><b>'+Number(value||0).toLocaleString()+'</b><span>'+label+'</span></div>').join('');
  $('rarestRunDrawing').classList.toggle('hidden',!run.drawing);
  if(run.drawing)$('rarestRunDrawing').src=run.drawing;
  modal.classList.remove('hidden');
 };
 const tile=$('statsGrid').querySelector('.stat-rarity-clickable');
 tile?.addEventListener('click',open);
 tile?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
 $('rarestRunClose').onclick=()=>modal.classList.add('hidden');
 modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden')};
}
$('statsGrid').querySelectorAll('.stat-tile').forEach((tile,index)=>{
 const [name,value]=vals[index];
 if(name==='Rarest Run'&&rarestOfficial)return;
 tile.classList.add('stat-explained');tile.tabIndex=0;tile.setAttribute('role','button');
 tile.setAttribute('aria-label','About '+name);
 const open=()=>{
  $('statInfoTitle').textContent=name;
  $('statInfoValue').textContent=String(value);
  $('statInfoDescription').textContent=statDescriptions[name]||'Official Daily statistic.';
  $('statInfoModal').classList.remove('hidden');
 };
 tile.addEventListener('click',open);
 tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
});
$('statInfoClose').onclick=()=>$('statInfoModal').classList.add('hidden');
$('statInfoModal').onclick=e=>{if(e.target===$('statInfoModal'))$('statInfoModal').classList.add('hidden')};
const em=new Map((earned||[]).map(x=>[x.badge_id,x]));const badgeDataReady=!badgesError&&!earnedError;const badgeCatalog=new Set((badges||[]).map(b=>b.id));const earnedCount=[...em.keys()].filter(id=>badgeCatalog.has(id)).length;$('badgeProgress').textContent=badgeDataReady?`${earnedCount} / ${(badges||[]).length}`:'Badge data unavailable';if(!badgeDataReady){$('badgeGrid').textContent='Badges could not be loaded. Please refresh to try again.';$('featuredBadges').textContent='Featured badges are temporarily unavailable.';return;}const groupInfo={score:['#','Score Milestones','Reach new personal score heights'],upgrade:['↑','Upgrade Mastery','Grow your wheel and multiply values'],double:['×2','Double Trouble','Make the most of ×2'],duck:[duckIcon,'Duck Encounters','A little luck with your feathered friends'],extra_spins:['+2','Bonus Spins','Keep the wheel turning'],rarity:['✦','Rare Moments','Beat the odds'],sequence:['↻','Wheel Combos','Make unusual things happen in one run'],daily:['◷','Daily Dedication','Show up and play'],leaderboard:[trophyIcon,'Leaderboard Legends','Climb the rankings'],social:['☺','Social Circle','Make connections'],secret:['?','Hidden Wonders','Discover the unexpected']};const groups=new Map();for(const b of badges||[]){const key=b.category||'other';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}const cards=list=>list.map(b=>{const e=em.get(b.id),secret=b.is_secret&&!e;return `<article class="badge-card ${e?'':'locked'} ${secret?'secret':''}"><div class="badge-icon">${secret?'?':iconFor(b.category)}</div><b>${secret?'???':Crilo.esc(b.name)}</b><p>${Crilo.esc(secret?'Unlock to reveal this badge.':b.description)}</p>${e?`<p>Unlocked ${new Date(e.earned_at).toLocaleDateString()}</p>`:''}</article>`}).join('');$('badgeGrid').innerHTML=[...groups].map(([key,list])=>{const count=list.filter(b=>em.has(b.id)).length,info=groupInfo[key]||['★',key.replace(/_/g,' ').replace(/\\b\\w/g,x=>x.toUpperCase()),'Collect badges in this set'];return `<details class="badge-set"><summary class="badge-set-head"><span class="badge-set-icon">${info[0]}</span><span class="badge-set-label"><strong>${Crilo.esc(info[1])}</strong><small>${Crilo.esc(info[2])}</small></span><span class="badge-set-count"><b>${count}/${list.length}</b><small>${Math.round(100*count/list.length)}%</small></span><span class="badge-set-chevron">⌄</span><span class="badge-set-track"><i style="width:${100*count/list.length}%"></i></span></summary><div class="badge-set-items">${cards(list)}</div></details>`}).join('');const bm=new Map((badges||[]).map(b=>[b.id,b]));
const mine=target===Crilo.user?.id;
const featuredIds=new Map((featured||[]).map(f=>[f.position,f.badge_id]));
const featuredCard=(position)=>{
 const id=featuredIds.get(position),b=id&&em.has(id)?bm.get(id):null;
 return '<button type="button" class="featured-slot '+(mine?'featured-editable':'')+'" data-position="'+position+'" '+(mine?'title="Choose an earned badge for this slot"':'disabled')+'>'+(b?'<div class="badge-icon">'+iconFor(b.category)+'</div><b>'+Crilo.esc(b.name)+'</b>':mine?'<span>+ Choose badge</span>':'<span>Empty badge slot</span>')+'</button>';
};
$('featuredBadges').innerHTML=Array.from({length:5},(_,i)=>featuredCard(i+1)).join('');
if(mine){
 const dialog=$('featuredPicker');
 const options=()=>'<option value="">Empty slot</option>'+[...bm.values()].filter(b=>em.has(b.id)).map(b=>'<option value="'+Crilo.esc(b.id)+'">'+Crilo.esc(b.name)+'</option>').join('');
 $('featuredBadges').querySelectorAll('[data-position]').forEach(btn=>btn.addEventListener('click',()=>{
  const pos=Number(btn.dataset.position);
  $('featuredSlotNumber').textContent=pos;
  $('featuredBadgeSelect').innerHTML=options();
  $('featuredBadgeSelect').value=featuredIds.get(pos)||'';
  $('featuredStatus').textContent='';
  dialog.dataset.position=pos;
  dialog.classList.remove('hidden');
 }));
 $('featuredCancel').onclick=()=>dialog.classList.add('hidden');
 $('featuredSave').onclick=async()=>{
  const position=Number(dialog.dataset.position),id=$('featuredBadgeSelect').value||null;
  $('featuredSave').disabled=true;
  const {error}=await criloDB.rpc('crilo_set_featured_badge',{p_position:position,p_badge_id:id});
  $('featuredSave').disabled=false;
  if(error){$('featuredStatus').textContent='Could not save: '+error.message;return}
  if(id)featuredIds.set(position,id);else featuredIds.delete(position);
  $('featuredBadges').innerHTML=Array.from({length:5},(_,i)=>featuredCard(i+1)).join('');
  dialog.classList.add('hidden');
  load();
 };
}
let local=[];if(target===Crilo.user?.id){try{local=JSON.parse(localStorage.getItem('crilo_domain_top5')||'[]')}catch{}}const ds=(domainScores||[]).map(x=>x.score);const top=[...ds,...local].sort((a,b)=>b-a).slice(0,5);$('domainTop').innerHTML=top.length?top.map((v,i)=>`<div class="domain-score">#${i+1} ${Number(v).toLocaleString()} / 5000</div>`).join(''):'<span class="muted">No Domain scores yet.</span>'}
window.addEventListener('crilo-auth-ready',load)})();
