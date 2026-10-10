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
 if(!confirm('Remove the '+Number(r.score).toLocaleString()+' point official run from '+esc(document.getElementById('profileName').textContent)+'? This deletes its score and drawing, and updates best runs and stats.'))return;
 if(!confirm('FINAL CONFIRMATION: Permanently delete this score? This cannot be undone.'))return;
 busy=true;btn.disabled=true;status.textContent='Deleting score…';
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_delete_profile_run',{p_user:who,p_run_id:r.run_id});
  if(error)throw error;if(data!==true)throw Error('Score no longer exists.');
  await load();
  status.textContent='Score deleted. Reloading player statistics…';
  location.reload();
 }catch(error){status.textContent='Deletion failed: '+error.message;btn.disabled=false}
 finally{busy=false}
});
window.addEventListener('crilo-auth-ready',load);
if(window.Crilo?.profile?.is_owner)load();
})();