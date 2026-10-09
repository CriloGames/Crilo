(()=>{
const $=id=>document.getElementById(id);
const list=$('drawingReviewList'),message=$('reviewMessage'),modal=$('reviewLightbox');
let rows=[],chosen=null,filter='flagged',generation=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 const request=++generation;
 if(!window.Crilo?.user||!window.Crilo?.profile?.is_owner){message.textContent='Owner access only.';list.replaceChildren();return}
 message.textContent='Loading drawings…';
 const {data,error}=await criloDB.rpc('crilo_owner_review_drawings',{p_status:filter});
 if(request!==generation)return;
 if(error){message.textContent='Could not load drawings: '+error.message;return}
 rows=data||[];
 message.textContent=rows.length?rows.length+' drawing'+(rows.length===1?'':'s')+' in this view.':'No drawings to review.';
 list.innerHTML=rows.map((d,i)=>'<button type="button" class="crilo-review-row" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span><span class="crilo-review-thumbnail">'+(d.drawing?'<img src="'+escape(d.drawing)+'" alt="Drawing thumbnail" loading="lazy">':'<span>Removed</span>')+'</span><span class="crilo-review-player"><strong>'+escape(d.username)+'</strong><small>'+escape(new Date(d.submitted_at).toLocaleString())+'</small></span><span class="crilo-review-score">'+Number(d.score).toLocaleString()+' pts</span><span class="crilo-review-state">'+escape(d.review_status)+'</span><span aria-hidden="true">↗</span></button>').join('');
}
function openDrawing(index){
 chosen=rows[index];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 const img=$('reviewLargeDrawing');img.src=chosen.drawing||'';img.classList.toggle('hidden',!chosen.drawing);
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score).toLocaleString()+' points';
 $('reviewActionStatus').textContent=chosen.ai_status==='flagged'?'AI flag: '+(chosen.ai_reasons||[]).join(', ')+(chosen.ai_details?' — '+chosen.ai_details:''):('AI scan status: '+(chosen.ai_status||'pending'));
 const pending=chosen.review_status==='pending';
 for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=!pending;
 modal.classList.remove('hidden');
}
list.addEventListener('click',e=>{const row=e.target.closest('[data-index]');if(row)openDrawing(Number(row.dataset.index))});
const close=()=>{modal.classList.add('hidden');chosen=null};
$('reviewClose').addEventListener('click',close);
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});
document.querySelectorAll('[data-review-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.reviewFilter;document.querySelectorAll('[data-review-filter]').forEach(x=>x.classList.toggle('active',x===btn));load()}));
$('reviewRefresh').addEventListener('click',load);
let scanning=false;
async function scanPending(){
 if(scanning||!window.Crilo?.profile?.is_owner)return;
 scanning=true;const btn=$('reviewScan');btn.disabled=true;btn.textContent='Scanning…';
 try{
  const {data:auth}=await criloDB.auth.getSession();const token=auth?.session?.access_token;
  if(!token)throw Error('Sign in first');
  const result=await fetch(CRILO_SUPABASE_URL+'/functions/v1/owner-scan-drawings',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':CRILO_SUPABASE_KEY,'Authorization':'Bearer '+token}
  });
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Error(data.error||'AI scanner unavailable');
  await load();
  message.textContent+=(data.scanned?' Scanned '+data.scanned+'; flagged '+data.flagged+'.':' No new scans.');
  if(data.failed)message.textContent+=' '+data.failed+' scan(s) could not be completed.';
 }catch(err){message.textContent='AI scan: '+err.message}
 finally{scanning=false;btn.disabled=false;btn.textContent='Scan new drawings'}
}
$('reviewScan').addEventListener('click',scanPending);
let firstOwnerLoad=false;
window.addEventListener('crilo-auth-ready',()=>{if(window.Crilo?.profile?.is_owner&&!firstOwnerLoad){firstOwnerLoad=true;scanPending()}});
setInterval(()=>{if(!document.hidden&&window.Crilo?.profile?.is_owner)scanPending()},120000);

async function act(action){
 if(!chosen)return;
 const current=chosen;
 const warning=action==='ban'?'Permanently ban '+current.username+' from Crilo? This will disable their account and remove this drawing.':action==='remove'?'Remove this drawing from Crilo? The player’s Daily score will remain unchanged.':'Mark this drawing as approved?';
 if(!window.confirm(warning))return;
 for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=true;
 $('reviewActionStatus').textContent='Saving…';
 try{
  if(action==='ban'){
   const {data:session}=await criloDB.auth.getSession();
   const accessToken=session?.session?.access_token;
   if(!accessToken)throw Error('Sign in again to ban an account.');
   const response=await fetch(CRILO_SUPABASE_URL+'/functions/v1/owner-ban-drawing-account',{method:'POST',headers:{'Content-Type':'application/json','apikey':CRILO_SUPABASE_KEY,'Authorization':'Bearer '+accessToken},body:JSON.stringify({action:'ban',run_id:current.run_id})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'Ban could not be completed');
  }else{
   const {error}=await criloDB.rpc('crilo_owner_review_action',{p_run_id:current.run_id,p_action:action});
   if(error)throw error;
  }
  close();await load();
 }catch(err){$('reviewActionStatus').textContent='Action failed: '+err.message;for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=false}
}
$('reviewApprove').addEventListener('click',()=>act('approve'));
$('reviewRemove').addEventListener('click',()=>act('remove'));
$('reviewBan').addEventListener('click',()=>act('ban'));
window.addEventListener('crilo-auth-ready',()=>load());
setTimeout(()=>{if(message.textContent.includes('Checking owner'))load()},1200);
})();