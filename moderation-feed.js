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
  const [feed,flagged,flaggedTests,visual]=await Promise.all([
    criloDB.rpc('crilo_owner_drawing_feed',{p_limit:200}),
    criloDB.rpc('crilo_owner_review_drawings',{p_status:'flagged'}),
    criloDB.rpc('crilo_owner_flagged_saved_tests'),
    criloDB.rpc('crilo_owner_visual_candidates')
  ]);
  if(feed.error)throw feed.error;
  const flags=new Map();
  for(const x of [...(flagged.data||[]),...(flaggedTests.data||[])])
    flags.set(String(x.run_id),'FLAGGED: TEXT / PROFANITY');
  for(const x of visual.data||[])
    if(!flags.has(String(x.run_id)))flags.set(String(x.run_id),'SUSPECTED IMAGE');
  rows=(feed.data||[]).filter(x=>validDrawing(x.drawing)&&($('showOwnerTests').checked||!x.is_test))
    .map(x=>({...x,reviewHint:flags.get(String(x.run_id))||''}))
    .sort((a,b)=>Number(!!b.reviewHint)-Number(!!a.reviewHint)||new Date(b.submitted_at)-new Date(a.submitted_at));
  const pending=rows.filter(x=>!x.is_test).length,tests=rows.length-pending,priority=rows.filter(x=>x.reviewHint).length;
  message.textContent=priority+' flagged/suspected drawings prioritized · '+pending+' player drawings awaiting review'+(tests?' · '+tests+' owner Test Runs':'')+' · Updated '+new Date().toLocaleTimeString();
  list.innerHTML=rows.length?rows.map((d,i)=>'<button type="button" class="crilo-review-row" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span><span class="crilo-review-thumbnail"><img src="'+escape(d.drawing)+'" alt="Drawing preview" loading="lazy"></span><span class="crilo-review-player"><strong>'+escape(d.username)+'</strong><small>'+escape(new Date(d.submitted_at).toLocaleString())+'</small></span><span class="crilo-review-score">'+Number(d.score||0).toLocaleString()+' pts</span><span class="crilo-review-state">'+(d.reviewHint?escape(d.reviewHint):d.is_test?'OWNER TEST':'REVIEW')+'</span><span aria-hidden="true">↗</span></button>').join(''):'<p class="muted">No drawings waiting for review.</p>';
 }catch(error){message.textContent='Drawing feed could not load: '+error.message}
 finally{busy=false}
}
function close(){modal.classList.add('hidden');chosen=null;$('reviewLargeDrawing').removeAttribute('src')}
function open(index){
 chosen=rows[index];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 $('reviewLargeDrawing').src=chosen.drawing;
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score||0).toLocaleString()+' points'+(chosen.is_test?' · Owner Test Run':'');
 $('reviewActionStatus').textContent=chosen.is_test?'Test Run: no moderation actions.':(chosen.reviewHint?chosen.reviewHint+' (verify manually). ':'')+'Approve hides this drawing from the feed. Remove permanently deletes the entire official run, including score and statistics.';
 $('reviewApprove').disabled=!!chosen.is_test;$('reviewRemove').disabled=!!chosen.is_test;
 modal.classList.remove('hidden');
}
list.addEventListener('click',e=>{const b=e.target.closest('[data-index]');if(b)open(Number(b.dataset.index))});
$('reviewClose').addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});
async function decide(action){
 const d=chosen;if(!d||d.is_test)return;
 if(!confirm(action==='remove'?'Permanently delete this drawing AND its entire official run? This removes its score from leaderboards and recalculates profile statistics.':'Approve and hide this drawing from review?'))return;
 if(action==='remove'&&!confirm('FINAL CONFIRMATION: Delete this run, its score, and its related statistics? This cannot be undone.'))return;
 $('reviewApprove').disabled=true;$('reviewRemove').disabled=true;$('reviewActionStatus').textContent='Saving…';
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_drawing_decision',{p_run_id:Number(d.run_id),p_action:action});
  if(error)throw error;if(!data)throw Error('Drawing already reviewed or unavailable.');
  close();await refresh();
 }catch(e){$('reviewActionStatus').textContent='Could not save: '+e.message;$('reviewApprove').disabled=false;$('reviewRemove').disabled=false}
}
$('reviewApprove').addEventListener('click',()=>decide('approve'));$('reviewRemove').addEventListener('click',()=>decide('remove'));
$('reviewRefresh').addEventListener('click',refresh);$('showOwnerTests').addEventListener('change',refresh);
window.criloRefreshDrawingFeed=refresh;
window.addEventListener('crilo-auth-ready',()=>{if(window.Crilo?.profile?.is_owner){refresh();}});
setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();