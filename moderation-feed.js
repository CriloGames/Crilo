(()=>{
'use strict';
const $=id=>document.getElementById(id);
const list=$('drawingReviewList'),message=$('reviewMessage'),modal=$('reviewLightbox');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],chosen=null,busy=false;
const validDrawing=x=>typeof x==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(x);
async function refresh(){
 if(busy||document.hidden||!window.Crilo?.user||!window.Crilo?.profile?.is_owner)return;
 busy=true;
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_drawing_feed',{p_limit:200});
  if(error)throw error;
  rows=(data||[]).filter(x=>validDrawing(x.drawing)&&($('showOwnerTests').checked||!x.is_test));
  const pending=rows.filter(x=>!x.is_test).length,tests=rows.length-pending;
  message.textContent=pending+' player drawings awaiting review'+(tests?' · '+tests+' owner Test Runs':'')+' · Updated '+new Date().toLocaleTimeString();
  list.innerHTML=rows.length?rows.map((d,i)=>'<button type="button" class="crilo-review-row" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span><span class="crilo-review-thumbnail"><img src="'+escape(d.drawing)+'" alt="Drawing preview" loading="lazy"></span><span class="crilo-review-player"><strong>'+escape(d.username)+'</strong><small>'+escape(new Date(d.submitted_at).toLocaleString())+'</small></span><span class="crilo-review-score">'+Number(d.score||0).toLocaleString()+' pts</span><span class="crilo-review-state">'+(d.is_test?'OWNER TEST':'REVIEW')+'</span><span aria-hidden="true">↗</span></button>').join(''):'<p class="muted">No drawings waiting for review.</p>';
 }catch(error){message.textContent='Drawing feed could not load: '+error.message}
 finally{busy=false}
}
function close(){modal.classList.add('hidden');chosen=null;$('reviewLargeDrawing').removeAttribute('src')}
function open(index){
 chosen=rows[index];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 $('reviewLargeDrawing').src=chosen.drawing;
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score||0).toLocaleString()+' points'+(chosen.is_test?' · Owner Test Run':'');
 $('reviewActionStatus').textContent=chosen.is_test?'Test Run: no moderation actions.':'Approve hides this drawing from the feed. Remove deletes the drawing but keeps its score.';
 $('reviewApprove').disabled=!!chosen.is_test;$('reviewRemove').disabled=!!chosen.is_test;
 modal.classList.remove('hidden');
}
list.addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b)open(Number(b.dataset.index))});
$('reviewClose').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});
async function decide(action){
 const d=chosen;if(!d||d.is_test)return;
 if(!confirm(action==='remove'?'Permanently remove this drawing? The player score will be preserved.':'Approve and hide this drawing from review?'))return;
 $('reviewApprove').disabled=true;$('reviewRemove').disabled=true;$('reviewActionStatus').textContent='Saving…';
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_drawing_decision',{p_run_id:Number(d.run_id),p_action:action});
  if(error)throw error;if(!data)throw Error('Drawing already reviewed or unavailable.');
  close();await refresh();
 }catch(e){$('reviewActionStatus').textContent='Could not save: '+e.message;$('reviewApprove').disabled=false;$('reviewRemove').disabled=false}
}
$('reviewApprove').addEventListener('click',()=>decide('approve'));$('reviewRemove').addEventListener('click',()=>decide('remove'));
$('reviewRefresh').addEventListener('click',refresh);$('showOwnerTests').addEventListener('change',refresh);
window.addEventListener('crilo-auth-ready',()=>{if(window.Crilo?.profile?.is_owner){refresh();}});
setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();