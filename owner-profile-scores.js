(()=>{
'use strict';
const section=document.getElementById('ownerScoreManager'),list=document.getElementById('ownerScoreList'),status=document.getElementById('ownerScoreStatus');
const target=new URLSearchParams(location.search).get('id');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],busy=false;
async function load(){
 if(!window.Crilo?.profile?.is_owner){section.classList.add('hidden');return}
 const who=target||window.Crilo?.user?.id;
 if(!who)return;
 section.classList.remove('hidden');
 status.textContent='Loading official runs…';
 const {data,error}=await criloDB.rpc('crilo_owner_profile_runs',{p_user:who,p_limit:100});
 if(error){status.textContent='Unable to load runs: '+error.message;return}
 rows=data||[];
 list.innerHTML=rows.length?rows.map((r,i)=>'<div class="person-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #ddd"><span style="flex:1">'+Number(r.score||0).toLocaleString()+' pts · '+esc(r.run_date)+' · '+Number(r.spins||0)+' spins · '+Number(r.ducks||0)+' ducks</span><button class="small-btn crilo-owner-delete-score" type="button" data-index="'+i+'" style="border:1px solid #cc6d76;color:#a12f40">Delete score</button></div>').join(''):'<p class="muted">No official runs for this player.</p>';
 status.textContent=rows.length+' official runs shown (highest scoring first).';
}
list.addEventListener('click',async e=>{
 const btn=e.target.closest('.crilo-owner-delete-score');if(!btn||busy||!window.Crilo?.profile?.is_owner)return;
 const r=rows[Number(btn.dataset.index)];if(!r)return;
 const who=target||window.Crilo?.user?.id;if(!who)return;
 // Apply the SAME accountable penalty as the leaderboard and Drawing Review.
 // Silent deletion bypassed the required account warning, notice and replay lock.
 const reasons=[['1','profanity','Profanity or offensive text'],['2','sexual','Sexual or genital drawing'],
  ['3','hate','Hate or extremist symbol'],['4','links','Website link or external promotion'],
  ['5','qr','QR code or scannable link'],['6','abuse','Harassment or abusive message'],
  ['7','other','Other inappropriate drawing']];
 const nl=String.fromCharCode(10);
 const choice=prompt('Why is this official Daily being removed?'+nl+
  reasons.map(v=>v[0]+'. '+v[2]).join(nl)+nl+nl+'Enter a reason number (1–7):');
 if(choice===null)return;
 const selected=reasons.find(v=>v[0]===choice.trim());
 if(!selected){status.textContent='Choose a valid violation reason (1–7). No action taken.';return;}
 const playerName=document.getElementById('profileName')?.textContent||'this player';
 if(!confirm('Remove '+Number(r.score).toLocaleString()+' points from '+playerName+' for '+selected[2]+'? Their Daily and associated badges will be removed, streak reset and account flagged.'))return;
 if(!confirm('FINAL CONFIRMATION: Permanently penalize this official Daily? The player cannot replay it, and will receive a warning.'))return;
 busy=true;btn.disabled=true;status.textContent='Applying Daily penalty…';
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_penalize_daily',{p_run_id:Number(r.run_id),p_reason:selected[1]});
  if(error)throw error;if(data!==true)throw Error('Score no longer exists.');
  await load();
  status.textContent='Official Daily removed with violation warning. Reloading player statistics…';
  location.reload();
 }catch(error){status.textContent='Deletion failed: '+error.message;btn.disabled=false}
 finally{busy=false}
});
window.addEventListener('crilo-auth-ready',load);
if(window.Crilo?.profile?.is_owner)load();
})();