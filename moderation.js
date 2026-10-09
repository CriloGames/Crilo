(()=>{
const $=id=>document.getElementById(id);
const list=$('drawingReviewList'),message=$('reviewMessage'),modal=$('reviewLightbox');
let rows=[],chosen=null,generation=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 const request=++generation;
 if(!window.Crilo?.user||!window.Crilo?.profile?.is_owner){message.textContent='Owner access only.';list.replaceChildren();return}
 message.textContent='Loading drawings…';
 const [{data,error},{data:tests,error:testError}]=await Promise.all([criloDB.rpc('crilo_owner_review_drawings',{p_status:'flagged'}),criloDB.rpc('crilo_owner_flagged_saved_tests')]);
 if(request!==generation)return;
 if(error){message.textContent='Could not load drawings: '+error.message;return}
 rows=[...(data||[]),...(testError?[]:(tests||[]))];
 message.textContent=rows.length?rows.length+' AI-flagged drawing(s).':'No AI-flagged drawings to review.';
 if(testError)message.textContent+=' Test scan results unavailable: '+testError.message;
 list.innerHTML=rows.map((d,i)=>'<button type="button" class="crilo-review-row" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span><span class="crilo-review-thumbnail">'+(d.drawing?'<img src="'+escape(d.drawing)+'" alt="Drawing thumbnail" loading="lazy">':'<span>Removed</span>')+'</span><span class="crilo-review-player"><strong>'+escape(d.username)+'</strong><small>'+escape(new Date(d.submitted_at).toLocaleString())+'</small></span><span class="crilo-review-score">'+Number(d.score).toLocaleString()+' pts</span><span class="crilo-review-state">'+escape(d.review_status)+'</span><span aria-hidden="true">↗</span></button>').join('');
}
function openDrawing(index,source=rows){
 chosen=source[index];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 const img=$('reviewLargeDrawing');img.src=chosen.drawing||'';img.classList.toggle('hidden',!chosen.drawing);
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score).toLocaleString()+' points';
 $('reviewActionStatus').textContent=chosen.ai_status==='flagged'?'AI flag: '+(chosen.ai_reasons||[]).join(', ')+(chosen.ai_details?' — '+chosen.ai_details:''):('AI scan status: '+(chosen.ai_status||'pending'));
 const pending=chosen.review_status==='pending' && chosen.ai_status==='flagged';
 for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=!pending;
 modal.classList.remove('hidden');
}
list.addEventListener('click',e=>{const row=e.target.closest('[data-index]');if(row)openDrawing(Number(row.dataset.index))});
const close=()=>{modal.classList.add('hidden');chosen=null};
$('reviewClose').addEventListener('click',close);
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});

$('reviewRefresh').addEventListener('click',load);
let scanning=false;
async function scanPending(){
 if(scanning||!window.Crilo?.profile?.is_owner)return;
 scanning=true;
 try{
  const {data:auth}=await criloDB.auth.getSession();const token=auth?.session?.access_token;
  if(!token)throw Error('Sign in first');
  const result=await fetch(CRILO_SUPABASE_URL+'/functions/v1/owner-scan-drawings',{
   method:'POST',headers:{'Content-Type':'application/json','apikey':CRILO_SUPABASE_KEY,'Authorization':'Bearer '+token}
  });
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Error(data.error||'AI scanner unavailable');
  await load();
  checkText();
  message.textContent+=(data.scanned?' Scanned '+data.scanned+'; flagged '+data.flagged+'.':' No new scans.');
  if(data.failed)message.textContent+=' '+data.failed+' scan(s) could not be completed.';
  if(data.testScanned)message.textContent+=' Scanned '+data.testScanned+' owner Test Run(s); flagged '+data.testFlagged+'.';
  if(data.testFailed)message.textContent+=' '+data.testFailed+' owner test scan(s) failed.';
 }catch(err){message.textContent='AI scan: '+err.message}
 finally{scanning=false}
}

let ocrBusy=false,ocrEngine=null;
async function checkText(){
 if(ocrBusy||document.hidden||!window.Crilo?.profile?.is_owner)return;
 ocrBusy=true;
 try{
  const [q,regular]=await Promise.all([criloDB.rpc('crilo_owner_saved_test_ocr_queue'),criloDB.rpc('crilo_owner_ocr_queue')]);
  if(q.error||regular.error)return;
  const jobs=[...(q.data||[]).map(x=>({...x,ownerTest:true})),...(regular.data||[]).map(x=>({...x,ownerTest:false}))];
  if(!jobs.length)return;
  if(!window.Tesseract)await new Promise((ok,fail)=>{
   const script=document.createElement('script');
   script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
   script.onload=ok;script.onerror=fail;document.head.appendChild(script);
  });
  if(!ocrEngine)ocrEngine=await Tesseract.createWorker('eng');
  for(const item of jobs){
   try{
    const result=await ocrEngine.recognize(item.drawing);
    const text=String(result.data.text||'').slice(0,4096);
    const saved=item.ownerTest?await criloDB.rpc('crilo_owner_saved_test_ocr_finish',{p_run_id:item.run_id,p_text:text}):await criloDB.rpc('crilo_owner_finish_ocr',{p_run_id:item.run_id,p_is_test:item.is_test,p_text:text});
    if(saved.error)console.warn('OCR result could not be saved',saved.error);
   }catch(e){console.warn('OCR unavailable for a drawing',e)}
  }
  await load();
 }catch(e){console.warn('Free OCR unavailable',e)}
 finally{ocrBusy=false}
}
let firstOwnerLoad=false;
window.addEventListener('crilo-auth-ready',()=>{if(window.Crilo?.profile?.is_owner&&!firstOwnerLoad){firstOwnerLoad=true;scanPending();checkText()}});
setInterval(()=>{if(!document.hidden&&window.Crilo?.profile?.is_owner){scanPending();checkText()}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.Crilo?.profile?.is_owner){scanPending();checkText()}});

async function act(action){
 if(!chosen)return;
 const current=chosen;
 const warning=action==='ban'?'Permanently ban '+current.username+' from Crilo? This will disable their account and remove this drawing.':action==='remove'?'Remove this drawing from Crilo? The player’s Daily score will remain unchanged.':'Mark this drawing as approved?';
 if(!window.confirm(warning))return;
 if(action==='ban'&&!window.confirm('Confirm again: apply the account restriction to '+current.username+'?'))return;
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