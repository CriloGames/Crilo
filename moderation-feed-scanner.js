/* Crilo free drawing safety review — owner browser only.
   No paid APIs, auto-deletions, or automated account enforcement.
   OCR/QR and visual models execute locally; all findings are advisory. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const owner=()=>!!(window.Crilo?.user&&window.Crilo?.profile?.is_owner);
const REASONS={
 profanity:'Profanity',hate:'Hateful or abusive text',link:'Website or link',
 qr:'QR code',extremism:'Possible extremist symbol',
 genital:'Possible genital drawing',sexual:'Possible sexual image',
 gore:'Possible graphic violence',qrMaybe:'Possible QR-like image'
};
const words=/(?:fuck(?:ing|ed|er|s)?|shit(?:ty|head|s)?|bitch(?:es|y)?|asshole|bastard|damn|crap|slut|whore|cunt|motherfucker|dick(?:head)?|cock(?:sucker)?|nigg(?:er|a)s?|faggot|kike|spic|retard(?:ed)?)/i;
const abusive=/(?:kill\s*(?:yourself|urself)|heil\s*hitler|white\s*power|nazi|gas\s*the\s*\w+)/i;
const url=/(?:https?:\/\/|www[.]|(?:discord[.]gg|t[.]me|bit[.]ly)\/|(?:[a-z0-9-]{2,}[.](?:com|net|org|io|gg|fun|co|xyz|link|app|dev|edu|gov|me|tv|shop|site|info|us|uk|ru|ly|ai|store|online|click|to|cc))(?:\b|\/)|[a-z0-9-]{2,}\s*(?:dot|\[dot\]|\(dot\))\s*(?:com|net|org|io|gg|fun|co|xyz|app|link)\b)/i;
function classifyText(raw){
 const original=String(raw||'').slice(0,4096).normalize('NFKC').toLowerCase();
 const basic=original.replace(/[\u200b-\u200f\u2060]/g,'').replace(/[@4]/g,'a').replace(/3/g,'e').replace(/[1!|]/g,'i').replace(/0/g,'o').replace(/5|\$/g,'s').replace(/7/g,'t');
 const combined=[original,basic,basic.replace(/[^a-z0-9]+/g,' '),basic.replace(/[^a-z0-9]+/g,'')];
 const hasWord=combined.some((s,i)=>i===3?false:new RegExp('(?:^|[^a-z])'+words.source+'(?=$|[^a-z])','i').test(s));
 const spaced=/\b(?:f[^a-z0-9]{1,3}u[^a-z0-9]{1,3}c[^a-z0-9]{1,3}k|s[^a-z0-9]{1,3}h[^a-z0-9]{1,3}i[^a-z0-9]{1,3}t)\b/i.test(original);
 const hasHate=combined.some((s,i)=>i===3?false:abusive.test(s));
 const hasLink=url.test(original)||url.test(basic);
 return [(hasWord||spaced)&&REASONS.profanity,hasHate&&REASONS.hate,hasLink&&REASONS.link].filter(Boolean);
}
const candidateLabels=[
 'A hand drawn Nazi swastika or extremist hate symbol',
 'An extremist hate group insignia',
 'An explicit hand drawing of a penis or testicles',
 'An explicit hand drawing of a vulva or vagina',
 'A sexually explicit pornographic image or nude adult',
 'A sexually explicit cartoon illustration',
 'Graphic blood, gore, or severe injury',
 'A black and white QR code with a grid of square patterns',
 'A harmless smiley face doodle',
 'A harmless duck cartoon doodle',
 'A harmless abstract scribble',
 'A harmless flower or landscape drawing',
 'A harmless cartoon character drawing',
 'A handwritten sentence on white paper',
 'A blank white square'
];
function classifyVisual(list){
 if(!Array.isArray(list)||!list.length)return {reason:null,label:null,score:null};
 const ranked=list.filter(x=>x&&Number.isFinite(x.score)&&candidateLabels.includes(x.label)).sort((a,b)=>b.score-a.score);
 if(!ranked.length)return {reason:null,label:null,score:null};
 const top=ranked[0],idx=candidateLabels.indexOf(top.label);
 const neutral=Math.max(0,...ranked.filter(x=>candidateLabels.indexOf(x.label)>=8).map(x=>x.score));
 const relative=top.score/(neutral||0.00001);
 // SigLIP scores are relative to THIS candidate list, not probabilities of a violation.
 const good=idx<8&&top.score>=0.27&&relative>=1.35;
 const reason=good?(idx<=1?REASONS.extremism:idx<=3?REASONS.genital:idx<=5?REASONS.sexual:idx===6?REASONS.gore:REASONS.qrMaybe):null;
 return {reason,label:good?top.label:'No strong category match',score:top.score};
}
window.CriloLocalSafety={classifyText,classifyVisual,candidateLabels,REASONS};
let worker=null,ocrBroken=false,qrBroken=false,visionBroken=false,visionModel=null,scanning=false,started=false;
let scannedCount=0,scannedFlagged=0;
const statuses={ocr:'Waiting',qr:'Waiting',visual:'Waiting'};
function setStatus(text){
 const e=$('reviewScanStatus');if(e)e.textContent=text;
}
function renderStatus(){
 const e=$('reviewScannerDetails');if(e)e.textContent='Text: '+statuses.ocr+' · QR: '+statuses.qr+' · Visual: '+statuses.visual;
}
function loadScript(src,test){
 if(test())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=src;s.async=true;
  s.onload=()=>test()?resolve():reject(Error('Library did not initialize'));
  s.onerror=()=>reject(Error('Could not load scanner library'));
  document.head.appendChild(s);
 });
}
function loadImage(src){
 return new Promise((resolve,reject)=>{
  if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src))
   return reject(Error('Invalid drawing data'));
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(Error('Could not decode drawing'));
  img.src=src;
 });
}
function canvasFor(image,scale=1){
 const c=document.createElement('canvas');
 c.width=Math.min(1600,Math.max(1,Math.round(image.naturalWidth*scale)));
 c.height=Math.min(1600,Math.max(1,Math.round(image.naturalHeight*scale)));
 const x=c.getContext('2d',{willReadFrequently:true});
 x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
 x.imageSmoothingEnabled=false;x.drawImage(image,0,0,c.width,c.height);
 return c;
}
async function scanQR(image){
 try{
  if(qrBroken)throw Error('QR decoder unavailable');
  statuses.qr='Loading';renderStatus();
  await loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',()=>typeof window.jsQR==='function');
  for(const factor of [1,2,4]){
   const c=canvasFor(image,factor),x=c.getContext('2d',{willReadFrequently:true});
   const data=x.getImageData(0,0,c.width,c.height);
   if(window.jsQR(data.data,c.width,c.height,{inversionAttempts:'attemptBoth'})){
    statuses.qr='QR detected';renderStatus();return true;
   }
  }
  statuses.qr='Checked';renderStatus();return false;
 }catch(err){qrBroken=true;statuses.qr='Unavailable';renderStatus();throw Error('QR: '+err.message)}
}
async function scanOCR(image){
 try{
  if(ocrBroken)throw Error('OCR library unavailable');
  statuses.ocr='Loading';renderStatus();
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',()=>typeof window.Tesseract?.createWorker==='function');
  if(!worker)worker=await window.Tesseract.createWorker('eng');
  const large=canvasFor(image,Math.max(2,Math.ceil(900/Math.max(image.naturalWidth,image.naturalHeight))));
  statuses.ocr='Reading text';renderStatus();
  let result=await worker.recognize(large);
  let output=String(result?.data?.text||'').slice(0,3500);
  // A second high-contrast pass helps with simple handwriting and pixel letters.
  if(!classifyText(output).length&&output.trim().length<12){
   const ctx=large.getContext('2d',{willReadFrequently:true}),px=ctx.getImageData(0,0,large.width,large.height);
   for(let i=0;i<px.data.length;i+=4){
    const gray=0.299*px.data[i]+0.587*px.data[i+1]+0.114*px.data[i+2];
    const v=gray<185?0:255;
    px.data[i]=v;px.data[i+1]=v;px.data[i+2]=v;
   }
   ctx.putImageData(px,0,0);
   result=await worker.recognize(large);
   output+=' '+String(result?.data?.text||'').slice(0,3000);
  }
  statuses.ocr='Checked';renderStatus();
  return output.slice(0,4096);
 }catch(err){ocrBroken=true;statuses.ocr='Unavailable';renderStatus();throw Error('Text OCR: '+err.message)}
}
async function scanVisual(image){
 try{
  if(visionBroken)throw Error('Visual classifier unavailable');
  statuses.visual='Loading local model';renderStatus();
  if(!visionModel){
   const lib=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   visionModel=await lib.pipeline('zero-shot-image-classification','Xenova/siglip-base-patch16-224',{device:'wasm',dtype:'q8'});
  }
  statuses.visual='Classifying drawing';renderStatus();
  const c=canvasFor(image,Math.max(1,Math.ceil(224/Math.max(image.naturalWidth,image.naturalHeight))));
  const result=await visionModel(c.toDataURL('image/png'),candidateLabels);
  statuses.visual='Checked (advisory)';renderStatus();
  return classifyVisual(result);
 }catch(err){visionBroken=true;statuses.visual='Unavailable';renderStatus();throw Error('Visual model: '+err.message)}
}
async function runJob(job){
 const problems=[],reasons=[],src=job.drawing;
 let recognized='',visual={label:null,score:null,reason:null},qrFound=false;
 setStatus('Scanning '+(job.is_test?'Owner Test Run':'player drawing')+' (local device only)…');
 let image;
 try{image=await loadImage(src)}
 catch(err){problems.push(String(err.message))}
 if(image){
  try{qrFound=await scanQR(image);if(qrFound)reasons.push(REASONS.qr)}catch(err){problems.push(err.message)}
  try{recognized=await scanOCR(image);reasons.push(...classifyText(recognized))}
  catch(err){problems.push(err.message)}
  try{visual=await scanVisual(image);if(visual.reason)reasons.push(visual.reason)}
  catch(err){problems.push(err.message)}
 }
 const payload={
  p_run_id:String(job.run_id),p_is_test:!!job.is_test,
  p_reasons:[...new Set(reasons)],p_text:recognized.trim().slice(0,300),
  p_visual_label:visual.label,p_visual_score:visual.score,
  p_error:problems.length?problems.join('; ').slice(0,250):null
 };
 const {data,error}=await criloDB.rpc('crilo_owner_local_scan_save',payload);
 if(error)throw error;
 if(data!==true)throw Error('Run no longer awaiting review');
 scannedCount++;if(payload.p_reasons.length)scannedFlagged++;
 if(problems.length)setStatus('Partial scan: '+problems.join(' · ')+'. Inspect manually.');
 else setStatus('Scanned '+scannedCount+' drawing(s), '+scannedFlagged+' with review suggestions. No automatic actions.');
 await window.criloRefreshDrawingFeed?.();
}
async function scanBatch(){
 if(scanning||document.hidden||!owner())return;
 scanning=true;
 try{
  const {data,error}=await criloDB.rpc('crilo_owner_local_scan_jobs',{p_limit:3});
  if(error)throw error;
  if(!data?.length){
   if(!scannedCount)setStatus('No new drawings to scan. Previously scanned drawings remain in the feed.');
   return;
  }
  for(const job of data){
   if(document.hidden||!owner())break;
   try{await runJob(job)}
   catch(err){setStatus('Scan could not be saved: '+err.message+'. Refresh to retry.');console.warn('Crilo local drawing scanner',err)}
  }
 }catch(err){setStatus('Scanner unavailable: '+err.message)}
 finally{scanning=false}
}
window.criloScanPendingDrawings=scanBatch;
window.CriloLocalSafety.start=()=>{
 if(started||!owner())return;started=true;
 setStatus('Free local scan ready. No images sent to a paid API.');
 scanBatch();
};
window.addEventListener('crilo-auth-ready',window.CriloLocalSafety.start);
setTimeout(window.CriloLocalSafety.start,1500);
setInterval(scanBatch,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scanBatch()});
window.addEventListener('beforeunload',()=>{if(worker)worker.terminate().catch(()=>{})});
})();