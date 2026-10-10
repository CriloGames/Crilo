(()=>{
const $=id=>document.getElementById(id);
const list=$('drawingReviewList'),message=$('reviewMessage'),modal=$('reviewLightbox');
let rows=[],chosen=null,generation=0,showUnflagged=false;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 const request=++generation;
 if(!window.Crilo?.user||!window.Crilo?.profile?.is_owner){message.textContent='Owner access only.';list.replaceChildren();return}
 message.textContent='Loading drawings…';
 const [{data,error},{data:tests,error:testError},{data:scanRows,error:scanError},{data:visualRows,error:visualError},{data:reviewDrawings,error:reviewError},{data:reviewTests,error:reviewTestError}]=await Promise.all([criloDB.rpc('crilo_owner_review_drawings',{p_status:'flagged'}),criloDB.rpc('crilo_owner_flagged_saved_tests'),criloDB.rpc('crilo_owner_test_scan_status'),criloDB.rpc('crilo_owner_visual_diagnostics'),criloDB.rpc('crilo_owner_review_drawings',{p_status:'review'}),criloDB.rpc('crilo_owner_visual_review_tests')]);
 if(request!==generation)return;
 if(error){message.textContent='Could not load drawings: '+error.message;return}
 const diagnostic=$('ownerScanDiagnostics');
 if(scanError){diagnostic.textContent='Could not load scan status: '+scanError.message}
 else {
  const checks=scanRows||[];
  const pending=checks.filter(x=>!x.ai_status||x.ai_status==='pending').length;
  const failed=checks.filter(x=>x.ai_status==='error').length;
  const flagged=checks.filter(x=>x.ai_status==='flagged').length;
  const clear=checks.filter(x=>x.ai_status==='clear').length;
  const review=checks.filter(x=>x.ai_status==='review').length;
  const ocrPending=checks.filter(x=>x.ai_status==='clear'&&!x.ocr_checked_at).length;
  diagnostic.textContent='Owner Test Runs: '+pending+' pending · '+clear+' clear · '+flagged+' flagged · '+review+ ' inconclusive visual scans · '+failed+' failed'+(ocrPending?' · '+ocrPending+' awaiting text recognition':'');
  $('ownerScanHistory').innerHTML=checks.slice(0,10).map(x=>'<div style="padding:5px 0;font-size:13px;color:var(--muted,#767676)">'+escape(new Date(x.submitted_at).toLocaleString())+' · '+escape(x.ai_status||'pending')+(x.ocr_checked_at?' · text checked':' · text not checked')+'</div>').join('');
 }
 const visual=$('ownerVisualHistory');
 if(visual){
  if(visualError) visual.textContent='Visual diagnostics unavailable: '+visualError.message;
  else visual.innerHTML=(visualRows||[]).slice(0,10).map(x=>{
   const date=escape(new Date(x.submitted_at).toLocaleString());
   const outcome=x.scan_error?'Scan failed: '+x.scan_error:!x.checked_at?'Not scanned yet':x.visual_label==='clear'?'Classified as harmless':x.visual_label||'No prediction';
   const confidence=x.visual_score!=null?' · '+(Number(x.visual_score)*100).toFixed(1)+'% relative score':'';
   return '<div style="padding:6px 0;font-size:13px">'+date+' · '+escape(outcome)+escape(confidence)+' · '+escape(x.ai_status||'pending')+'</div>';
  }).join('');
 }
 const flaggedRows=[...(data||[]),...(testError?[]:(tests||[]))];
 let unflaggedRows=[];
 if(showUnflagged){
  const [ordinary,ownerTests]=await Promise.all([
   criloDB.rpc('crilo_owner_review_drawings',{p_status:'pending'}),
   criloDB.rpc('crilo_owner_qa_export_drawings')
  ]);
  if(request!==generation)return;
  if(ordinary.error||ownerTests.error){
   message.textContent='Some unflagged drawings could not be loaded. Please refresh.';
  }else{
   const previouslyShown=new Set(flaggedRows.map(x=>String(x.run_id)));
   unflaggedRows=[
    ...(ordinary.data||[]).filter(x=>x.ai_status!=='flagged'&&x.ai_status!=='review'),
    ...(ownerTests.data||[]).filter(x=>x.ai_status!=='flagged'&&x.ai_status!=='review').map(x=>({
     ...x,username:'Owner',run_id:String(x.run_id),review_status:'test',ai_reasons:[],
     ai_details:'Owner Test Run; no account actions are available.'
    }))
   ].filter(x=>!previouslyShown.has(String(x.run_id)));
  }
 }
 const uncertainRows=[...(reviewError?[]:(reviewDrawings||[])),...(reviewTestError?[]:(reviewTests||[]))];
 rows=[...flaggedRows,...uncertainRows,...unflaggedRows];
 message.textContent=flaggedRows.length+' flagged drawings · '+uncertainRows.length+' visual predictions awaiting owner review.'+(showUnflagged?' Showing '+unflaggedRows.length+' additional unflagged drawings for manual inspection.':'');
 if(reviewError||reviewTestError)message.textContent+=' Some visual review results could not be loaded.';
 if(testError)message.textContent+=' Test scan results unavailable: '+testError.message;
 list.innerHTML=rows.map((d,i)=>'<button type="button" class="crilo-review-row" data-index="'+i+'"><span class="crilo-review-rank">'+(i+1)+'</span><span class="crilo-review-thumbnail">'+(d.drawing?'<img src="'+escape(d.drawing)+'" alt="Drawing thumbnail" loading="lazy">':'<span>Removed</span>')+'</span><span class="crilo-review-player"><strong>'+escape(d.username)+'</strong><small>'+escape(new Date(d.submitted_at).toLocaleString())+'</small></span><span class="crilo-review-score">'+Number(d.score).toLocaleString()+' pts</span><span class="crilo-review-state">'+escape(d.ai_status==='review'?'Needs review':d.review_status)+'</span><span aria-hidden="true">↗</span></button>').join('');
}
function openDrawing(index,source=rows){
 chosen=source[index];if(!chosen)return;
 $('reviewDetailTitle').textContent=chosen.username+'’s drawing';
 const img=$('reviewLargeDrawing');img.src=chosen.drawing||'';img.classList.toggle('hidden',!chosen.drawing);
 $('reviewDetailMeta').textContent='Submitted '+new Date(chosen.submitted_at).toLocaleString()+' · '+Number(chosen.score).toLocaleString()+' points';
 $('reviewActionStatus').textContent=chosen.ai_status==='review'?'Needs manual review (not a confirmed violation). '+(chosen.ai_details||''):chosen.ai_status==='flagged'?'AI flag: '+(chosen.ai_reasons||[]).join(', ')+(chosen.ai_details?' — '+chosen.ai_details:''):('AI scan status: '+(chosen.ai_status||'pending'));
 const pending=chosen.review_status==='pending' && (chosen.ai_status==='flagged'||chosen.ai_status==='review');
 for(const id of ['reviewApprove','reviewRemove','reviewBan'])$(id).disabled=!pending;
 if(chosen.ai_status==='review')$('reviewBan').disabled=true;
 modal.classList.remove('hidden');
}
list.addEventListener('click',e=>{const row=e.target.closest('[data-index]');if(row)openDrawing(Number(row.dataset.index))});
const close=()=>{modal.classList.add('hidden');chosen=null};
$('reviewClose').addEventListener('click',close);
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close()});

$('reviewRefresh').addEventListener('click',load);
$('reviewUnflagged').addEventListener('click',()=>{
 showUnflagged=!showUnflagged;
 $('reviewUnflagged').textContent=showUnflagged?'Hide unflagged drawings':'Show unflagged drawings';
 $('reviewUnflagged').setAttribute('aria-pressed',String(showUnflagged));
 load();
});
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
  checkSymbols();
  message.textContent+=(data.scanned?' Scanned '+data.scanned+'; flagged '+data.flagged+'.':' No new scans.');
  if(data.failed)message.textContent+=' '+data.failed+' scan(s) could not be completed.';
  if(data.testScanned)message.textContent+=' Scanned '+data.testScanned+' owner Test Run(s); flagged '+data.testFlagged+'.';
  if(data.testFailed)message.textContent+=' '+data.testFailed+' owner test scan(s) failed.';
 }catch(err){message.textContent='AI scan: '+err.message}
 finally{scanning=false}
}

let handwritingModel=null,handwritingUnavailable=false;
async function handwritingOCR(canvas){
 if(handwritingUnavailable)return '';
 try{
  if(!handwritingModel){
   const status=$('ownerOcrStatus');if(status)status.textContent='Loading open-source handwriting model (large first-time download)…';
   const mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   handwritingModel=await mod.pipeline('image-to-text','Xenova/trocr-small-handwritten',{device:'wasm',dtype:'q8'});
  }
  const status=$('ownerOcrStatus');if(status)status.textContent='Checking handwriting…';
  const output=await handwritingModel(canvas.toDataURL('image/png'),{max_new_tokens:80});
  return String(output?.[0]?.generated_text||'').slice(0,4096);
 }catch(error){
  console.warn('Handwriting model unavailable; retaining Tesseract results',error);
  handwritingUnavailable=true;
  const status=$('ownerOcrStatus');if(status)status.textContent='Handwriting model unavailable; using basic OCR only. Some handwritten words may be missed.';
  return '';
 }
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
    // Composite transparent drawings onto white and upscale small handwriting.
    const source=await new Promise((ok,fail)=>{
     const image=new Image();image.onload=()=>ok(image);image.onerror=fail;image.src=item.drawing;
    });
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(800,source.naturalWidth*3);
    canvas.height=Math.max(800,source.naturalHeight*3);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const result=await ocrEngine.recognize(canvas);
    const primaryText=String(result.data.text||'').slice(0,4096);
    // TrOCR is trained on handwriting; fallback only when the printed-text OCR
    // finds no matching common profanity. Keep the original text too.
    const profanity=/\b(fuck|fucking|fucked|shit|shitty|bitch|asshole|bastard|damn|crap|cunt|dick|motherfucker)\b/i;
    const fallbackText=!profanity.test(primaryText)?await handwritingOCR(canvas):'';
    const text=(primaryText+' '+fallbackText).slice(0,4096);
    const saved=item.ownerTest?await criloDB.rpc('crilo_owner_saved_test_ocr_finish',{p_run_id:item.run_id,p_text:text}):await criloDB.rpc('crilo_owner_finish_ocr',{p_run_id:item.run_id,p_is_test:item.is_test,p_text:text});
    if(saved.error)console.warn('OCR result could not be saved',saved.error);
   }catch(e){console.warn('OCR unavailable for a drawing',e)}
  }
  await load();
  if(!handwritingUnavailable){const status=$('ownerOcrStatus');if(status)status.textContent='Handwriting check completed.';}
 }catch(e){console.warn('Free OCR unavailable',e);const status=$('ownerOcrStatus');if(status)status.textContent='OCR check failed; please refresh to retry.';}
 finally{ocrBusy=false}
}

let symbolBusy=false,symbolClassifier=null,symbolUnavailable=false;
const symbolLabels=[
 'A simple black line drawing of a penis or male genitals',
 'A simple black line drawing of a vagina or female genitals',
 'A hand drawn swastika symbol',
 'A hand drawn extremist hate symbol',
 'A harmless smiley face doodle',
 'A harmless flower doodle',
 'A harmless duck doodle',
 'A blank white drawing',
 'Random abstract pencil strokes'
];
async function checkSymbols(){
 if(symbolBusy||symbolUnavailable||document.hidden||!window.Crilo?.profile?.is_owner)return;
 symbolBusy=true;
 const status=$('ownerVisualStatus');
 try{
  const {data:jobs,error}=await criloDB.rpc('crilo_owner_visual_jobs');
  if(error)throw error;
  if(!jobs?.length){if(status)status.textContent='Visual symbol checks are up to date.';return}
  if(!symbolClassifier){
   if(status)status.textContent='Loading open-source SigLIP visual classifier (large first-time download)…';
   const module=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   symbolClassifier=await module.pipeline('zero-shot-image-classification','Xenova/siglip-base-patch16-224',{device:'wasm',dtype:'q8'});
  }
  for(const item of jobs){
   try{
    if(status)status.textContent='Scanning drawing for prohibited symbols…';
    const results=await symbolClassifier(item.drawing,symbolLabels);
    const best=Array.isArray(results)?results[0]:null;
    if(!best||!Number.isFinite(best.score))throw Error('Invalid visual classification');
    const pos=symbolLabels.indexOf(best.label);
    const category=pos===0||pos===1?'explicit genital drawing':pos===2?'hand drawn swastika':pos===3?'hate symbol drawing':'clear';
    const saved=await criloDB.rpc('crilo_owner_finish_visual',{
     p_run_id:String(item.run_id),p_is_test:item.is_test,p_label:category,p_score:best.score,p_error:null
    });
    if(saved.error)throw saved.error;
   }catch(err){
    console.warn('Visual symbol scan failed:',err);
    await criloDB.rpc('crilo_owner_finish_visual',{
     p_run_id:String(item.run_id),p_is_test:item.is_test,p_label:'unavailable',p_score:0,p_error:String(err).slice(0,300)
    });
   }
  }
  if(status)status.textContent='Visual symbol check finished. Results require manual review.';
  await load();
 }catch(err){
  console.warn('Visual symbol model unavailable:',err);
  symbolUnavailable=true;
  if(status)status.textContent='Visual symbol classifier could not load. Visual symbol detection is unavailable; do not assume drawings passed.';
 }finally{symbolBusy=false}
}
let firstOwnerLoad=false;
window.addEventListener('crilo-auth-ready',()=>{if(window.Crilo?.profile?.is_owner&&!firstOwnerLoad){firstOwnerLoad=true;scanPending();checkText();checkSymbols()}});
setInterval(()=>{if(!document.hidden&&window.Crilo?.profile?.is_owner){scanPending();checkText();checkSymbols()}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&window.Crilo?.profile?.is_owner){scanPending();checkText();checkSymbols()}});

async function act(action){
 if(!chosen)return;
 const current=chosen;
 if(action==='ban'&&current.ai_status==='review'){ $('reviewActionStatus').textContent='A visual prediction alone cannot start a ban. Review the drawing first.';return;}
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