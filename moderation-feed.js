/* Owner drawing review. Findings are hints, never automatic punishments. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const list=$('drawingReviewList'),message=$('reviewMessage'),modal=$('reviewLightbox');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDrawing=x=>typeof x==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(x);
const key=d=>(d.is_test?'test:':'official:')+String(d.run_id);
let rows=[],chosen=null,busy=false,refreshQueued=false,filter='all',pageIndex=0,matchedCount=0,loadGeneration=0,lastPaint='';
let totals={pending:0,flagged:0,unscanned:0,partial:0,tests:0};
const PAGE_SIZE=24;
const dismissedKeys=new Set();
const isOwner=()=>!!(window.Crilo?.user&&window.Crilo?.profile?.is_owner);
// Only evidence-based scan reasons (or a separately flagged legacy result)
// make a drawing REVIEW SUGGESTED. Incomplete checks are a different status.
const hintsFor=d=>[
 ...(d.local?.reasons||[]).map(reason=>
  reason==='Possible genital drawing'&&
  /^Possible (penis|vulva) drawing \(shape review\)$/.test(d.local?.visual_label||'')?
   d.local.visual_label.replace(' (shape review)',''):reason),
 // A completed v6 recheck supersedes older advisory image flags.
 // Otherwise false positives continue to appear after clean rescans.
 ...(d.local?.status==='complete'&&Number(d.local.scan_version)>=6?
   []:d.legacyHint?[d.legacyHint]:[])
];
const isStale=d=>!d.local||Number(d.local.scan_version||0)<5;
function visible(d){return !dismissedKeys.has(key(d))}
function render(){
 const filtered=rows.filter(visible);
 const priority=totals.flagged;
 const pending=totals.pending;
 const unchecked=totals.unscanned;
 const partial=totals.partial;
 const update=(id,v)=>{const e=$(id);if(e&&e.textContent!==String(v))e.textContent=v};
 update('reviewCountPending',pending);
 update('reviewCountFlagged',priority);
 update('reviewCountUnscanned',unchecked);
 update('reviewCountPartial',partial);
 const first=matchedCount?PAGE_SIZE*pageIndex+1:0;
 const last=Math.min(matchedCount,first+filtered.length-1);
 update('reviewStats',first+'–'+last+' of '+matchedCount+' matching drawings · '+totals.tests+' Test Runs included');
 update('reviewPageInfo','Page '+(pageIndex+1)+' of '+Math.max(1,Math.ceil(matchedCount/PAGE_SIZE)));
 $('reviewPagePrev').disabled=pageIndex===0;
 $('reviewPageNext').disabled=(pageIndex+1)*PAGE_SIZE>=matchedCount;
 update('reviewMessage','Results are advisory. Select a drawing for details and owner decisions.');
 // Avoid recreating large base64 <img> elements on every 30-second refresh.
 // Repeated reflows and image decoding caused UI freezes while scanning.
 const signature=filter+'|'+pageIndex+'|'+matchedCount+'|'+filtered.map(d=>[
  key(d),d.score,d.username,d.review_status,d.local?.status||'',
  (d.local?.reasons||[]).join('/'),d.legacyHint||'',d.local?.checked_at||'',d.local?.scan_version||'',d.local?.error||''
 ].join(':')).join('|');
 if(signature===lastPaint)return;
 if(chosen&&!modal.classList.contains('hidden'))return;
 lastPaint=signature;
 list.innerHTML=filtered.length?filtered.map(d=>{
  const i=rows.indexOf(d),why=hintsFor(d);
  const status=why.length?'REVIEW SUGGESTED':!d.local?'NOT CHECKED':
   isStale(d)?'NEEDS RESCAN':d.local.status==='partial'?'INCOMPLETE CHECK':'NO FLAGS';
  const chips=why.length?'<span class="crilo-review-reasons">'+
   why.slice(0,3).map(w=>'<em>'+escape(w)+'</em>').join('')+
   (why.length>3?'<em>+'+(why.length-3)+'</em>':'')+'</span>':'';
  return '<button type="button" class="crilo-review-row'+(why.length?' crilo-review-suspected':'')+
   '" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span>'+
   '<span class="crilo-review-thumbnail"><img src="'+escape(d.drawing)+
   '" alt="Drawing preview" loading="lazy" decoding="async"></span>'+
   '<span class="crilo-review-player"><strong>'+escape(d.username)+(d.is_test?'<span class="crilo-review-test-tag">TEST RUN</span>':'')+'</strong><small>'+
   escape(new Date(d.submitted_at).toLocaleString())+'</small>'+chips+'</span>'+
   '<span class="crilo-review-score">'+Number(d.score||0).toLocaleString()+' pts</span>'+
   '<span class="crilo-review-state" data-state="'+(why.length?'flagged':isStale(d)?'stale':d.local?.status==='partial'?'partial':'normal')+'">'+
   status+'</span><span aria-hidden="true">↗</span></button>';
 }).join(''):'<p class="muted">No drawings match this filter.</p>';
}
async function refresh(){
 if(document.hidden||!isOwner())return;
 if(busy){refreshQueued=true;return}
 refreshQueued=false;
 busy=true;const request=++loadGeneration;
 try{
  // One bounded request: server counts ALL pending drawings but sends only
  // the requested 24 images. Never download 1,000 base64 canvases on sign-in.
  const requestedPage=pageIndex;
  const {data,error}=await criloDB.rpc('crilo_owner_review_page_v1',{
   p_page:requestedPage,p_filter:filter,p_include_tests:!!$('showOwnerTests').checked
  });
  if(error)throw error;
  if(request!==loadGeneration||requestedPage!==pageIndex)return;
  if(!data||!Array.isArray(data.rows)||data.rows.length>PAGE_SIZE)
   throw Error('Drawing feed returned an invalid page');
  matchedCount=Math.max(0,Number(data.matched)||0);
  totals={pending:Number(data.pending)||0,flagged:Number(data.flagged)||0,
   unscanned:Number(data.unscanned)||0,partial:Number(data.partial)||0,
   tests:Number(data.tests)||0};
  if(pageIndex>0&&pageIndex*PAGE_SIZE>=matchedCount){
   pageIndex=Math.max(0,Math.ceil(matchedCount/PAGE_SIZE)-1);
   refreshQueued=true;return;
  }
  rows=data.rows.filter(x=>validDrawing(x.drawing)&&!dismissedKeys.has(key(x)));
  render();
 }catch(err){message.textContent='Drawing feed could not load: '+err.message}
 finally{busy=false;if(refreshQueued){refreshQueued=false;setTimeout(refresh,0)}}
}
function close(){
 modal.classList.add('hidden');chosen=null;$('reviewLargeDrawing').removeAttribute('src');
 render();
}
function open(i){
 chosen=rows[i];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 $('reviewLargeDrawing').src=chosen.drawing;
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score||0).toLocaleString()+' points'+(chosen.is_test?' · Owner Test Run':'');
 const why=hintsFor(chosen);
 const findings=$('reviewFindings');
 findings.replaceChildren();
 const title=document.createElement('strong');title.textContent=why.length?'Review suggestions (unconfirmed)':'Review status';
 findings.appendChild(title);
 const p=document.createElement('p');
 p.textContent=why.length?why.join(' · '):!chosen.local?'Not yet scanned. Please review manually.':isStale(chosen)?'Checked with an older scanner. Scan this drawing again for the latest link detection.':chosen.local.status==='partial'?'Incomplete scan; please review manually.':'No automatic flags. This is not a guarantee that the drawing is appropriate.';
 findings.appendChild(p);
 if(chosen.local?.recognized_text){
  const words=document.createElement('p');
  words.textContent='OCR saw: "'+chosen.local.recognized_text+'" (may be incorrect)';
  findings.appendChild(words);
 }
 if(chosen.local?.visual_label){
  const v=document.createElement('p');
  v.textContent='Local image comparison: '+chosen.local.visual_label+(Number.isFinite(chosen.local.visual_score)?' (relative match score '+chosen.local.visual_score.toFixed(2)+', not a probability)':'');
  findings.appendChild(v);
 }
 if(chosen.local?.error){
  const warning=document.createElement('p');warning.className='crilo-review-scan-warning';
  warning.textContent='Scanner limitation: '+chosen.local.error+'. Manual inspection required.';
  findings.appendChild(warning);
 }
 $('reviewActionStatus').textContent=chosen.is_test?'Owner Test Run: account actions are disabled.':'Only your decision can remove a run or ban a player.';
 for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=!!chosen.is_test;
 $('reviewBan').disabled=!!chosen.is_test||chosen.username?.toLowerCase()==='owner';
 $('reviewRetry').disabled=false;
 $('reviewDeleteTest').hidden=!chosen.is_test;
 $('reviewDeleteTest').disabled=!chosen.is_test;
 $('deleteRunWithBan').checked=false;
 $('reviewBanOptions').hidden=!!chosen.is_test||chosen.username?.toLowerCase()==='owner';
 modal.classList.remove('hidden');
 window.criloFeedbackShow?.(chosen);
}
list.addEventListener('click',e=>{const item=e.target.closest('[data-index]');if(item)open(Number(item.dataset.index))});
$('reviewClose').addEventListener('click',close);
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});
async function decide(action){
 const d=chosen;if(!d||d.is_test)return;
 const extra=!!$('deleteRunWithBan').checked;
 let warning;
 if(action==='approve')warning='Approve this drawing and hide it from your review queue?';
 else if(action==='remove')warning='Delete this entire official run, including its leaderboard score and associated statistics? This cannot be undone.';
 else warning='Permanently ban '+d.username+'? '+(extra?'This also deletes the entire official run and its score.':'This removes the drawing while retaining their score.');
 if(!confirm(warning))return;
 if((action==='remove'||action==='ban')&&!confirm('FINAL CONFIRMATION: '+(action==='ban'?'Apply account ban'+(extra?' AND delete the run':''):'Permanently delete the run')+'?'))return;
 const buttons=['reviewApprove','reviewRemove','reviewBan','reviewRetry'];
 for(const id of buttons)$(id).disabled=true;
 $('reviewActionStatus').textContent='Saving your decision…';
 try{
  if(action==='ban'){
   const {data:auth}=await criloDB.auth.getSession();
   const token=auth?.session?.access_token;
   if(!token)throw Error('Your owner session expired');
   const response=await fetch(CRILO_SUPABASE_URL+'/functions/v1/owner-ban-drawing-account',{
    method:'POST',headers:{'Content-Type':'application/json','apikey':CRILO_SUPABASE_KEY,'Authorization':'Bearer '+token},
    body:JSON.stringify({action:'ban',run_id:Number(d.run_id),delete_run:extra})
   });
   const reply=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(reply.error||'Account ban failed');
   if(extra&&!reply.run_deleted)throw Error('Account was banned, but the run could not be deleted. Check the leaderboard and remove it separately.');
  }else{
   const {data,error}=await criloDB.rpc('crilo_owner_drawing_decision',{p_run_id:Number(d.run_id),p_action:action});
   if(error)throw error;
   if(data!==true)throw Error('Run already reviewed or unavailable');
  }
  // The server has confirmed the owner action. Remove the completed item
  // immediately, even when a 30-second refresh is already running.
  // Suppress stale in-flight snapshots so deleted runs cannot reappear.
  dismissedKeys.add(key(d));
  loadGeneration++;
  rows=rows.filter(row=>key(row)!==key(d));
  close();lastPaint='';render();
  await refresh();
  const note=action==='approve'?'Drawing approved and removed from review.':
   action==='remove'?'Official run deleted and removed from review.':
   'Account action completed; drawing removed from the review queue.';
  $('reviewMessage').textContent=note;
 }catch(err){
  $('reviewActionStatus').textContent=err.message;
  for(const id of buttons)$(id).disabled=id==='reviewBan'&&d.username?.toLowerCase()==='owner';
 }
}
// Owner Test Runs are disposable QA records, never official Dailies.
// A separate owner-guarded RPC prevents accidental changes to player runs.
$('reviewDeleteTest').addEventListener('click',async()=>{
 const d=chosen;if(!d||!d.is_test||!isOwner())return;
 if(!confirm('Delete this Owner Test Run and remove it from Drawing Review?'))return;
 if(!confirm('FINAL CONFIRMATION: Permanently delete this practice Test Run?'))return;
 $('reviewDeleteTest').disabled=true;
 $('reviewActionStatus').textContent='Deleting practice Test Run…';
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_delete_test_run',
   {p_run_id:String(d.run_id)});
  if(error)throw error;
  if(data!==true)throw Error('Practice run was already deleted or unavailable');
  dismissedKeys.add(key(d));loadGeneration++;
  rows=rows.filter(row=>key(row)!==key(d));
  close();lastPaint='';render();await refresh();
  $('reviewMessage').textContent='Practice Test Run deleted. Official Dailies remain unchanged.';
 }catch(err){
  $('reviewActionStatus').textContent='Could not delete Test Run: '+err.message;
  $('reviewDeleteTest').disabled=false;
 }
});
$('reviewApprove').addEventListener('click',()=>decide('approve'));
$('reviewRemove').addEventListener('click',()=>decide('remove'));
$('reviewBan').addEventListener('click',()=>decide('ban'));
$('reviewRetry').addEventListener('click',async()=>{
 const d=chosen;if(!d)return;
 $('reviewRetry').disabled=true;$('reviewActionStatus').textContent='Scheduling another local scan…';
 try{
  const {error}=await criloDB.rpc('crilo_owner_local_scan_retry',{p_run_id:String(d.run_id),p_is_test:!!d.is_test});
  if(error)throw error;
  close();await refresh();await window.criloScanSpecificDrawing?.({run_id:d.run_id,is_test:!!d.is_test,drawing:d.drawing});
 }catch(err){$('reviewActionStatus').textContent='Could not rescan: '+err.message;$('reviewRetry').disabled=false}
});
$('reviewRefresh').addEventListener('click',refresh);
$('showOwnerTests').addEventListener('change',()=>{pageIndex=0;lastPaint='';refresh()});
$('reviewFilter').addEventListener('change',e=>{filter=e.target.value;pageIndex=0;lastPaint='';refresh()});
$('reviewPagePrev').addEventListener('click',()=>{if(pageIndex>0){pageIndex--;lastPaint='';refresh()}});
$('reviewPageNext').addEventListener('click',()=>{
 if((pageIndex+1)*PAGE_SIZE<matchedCount){pageIndex++;lastPaint='';refresh()}
});
window.criloRefreshDrawingFeed=refresh;
window.addEventListener('crilo-auth-ready',()=>{if(isOwner())refresh();else{
 list.replaceChildren();message.textContent='Owner access only.';}});
setTimeout(()=>{if(isOwner())refresh()},1800);
setInterval(refresh,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();