(()=>{
const $=id=>document.getElementById(id);
const message=$('reviewMessage');
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
  await window.criloRefreshDrawingFeed?.();
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
  await window.criloRefreshDrawingFeed?.();
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
  await window.criloRefreshDrawingFeed?.();
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


})();