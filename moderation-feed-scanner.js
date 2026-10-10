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
let background=null,pending=null,scanning=false,started=false,auto=true,visualChecks=true;
let pendingTimer=null,processed=0,suspected=0,cancelled=0,unavailable=false;
let nowStage={qr:'Waiting',ocr:'Waiting',visual:'Waiting'};
const waitMs=2500;
function setStatus(message){
 const p=$('reviewScanStatus');if(p)p.textContent=message;
}
function showStage(){
 const el=$('reviewScannerDetails');if(el)el.textContent=
  'QR: '+nowStage.qr+'  ·  Text: '+nowStage.ocr+'  ·  Image: '+nowStage.visual;
}
function resetStage(){nowStage={qr:'Waiting',ocr:'Waiting',visual:'Waiting'};showStage()}
function startWorker(){
 if(unavailable)throw Error('Background scanning is unavailable in this browser');
 if(background)return background;
 if(typeof Worker==='undefined'){
  unavailable=true;throw Error('This browser does not support dedicated workers');
 }
 const active=new Worker('moderation-scan-worker.js?v=5');
 background=active;
 active.onmessage=e=>{
  const data=e.data;
  if(!pending||active!==background||data.id!==pending.id)return;
  if(data.type==='progress'){
   const phase=data.step==='visual'?'visual':data.step==='ocr'?'ocr':data.step==='qr'?'qr':null;
   if(phase)nowStage[phase]=data.detail||'Working';
   showStage();
   setStatus((pending.is_test?'Test Run':'Player drawing')+': '+(data.detail||'Scanning')+'…');
   return;
  }
  if(data.type==='result'){
   const job=pending;pending=null;
   clearTimeout(job.timeout);
   nowStage={
    qr:data.stages?.qr==='done'?'Done':data.stages?.qr==='unavailable'?'Unavailable':'Not started',
    ocr:data.stages?.ocr==='done'?'Done':data.stages?.ocr==='unavailable'?'Unavailable':'Not started',
    visual:data.stages?.visual==='done'?'Done':data.stages?.visual==='skipped'?'Off':data.stages?.visual==='unavailable'?'Unavailable':'Not started'
   };
   showStage();
   job.resolve(data);
  }
 };
 active.onerror=e=>{
  e.preventDefault?.();
  if(active!==background)return;
  const fail=pending;pending=null;
  if(fail){clearTimeout(fail.timeout);fail.reject(Error('Background worker crashed'));}
  active.terminate();background=null;unavailable=true;
  setStatus('Background scanner could not start. Review drawings manually.');
 };
 return active;
}
function stopActive(){
 cancelled++;
 if(pending){
  const job=pending;pending=null;clearTimeout(job.timeout);
  job.reject(Error('Scan paused'));
 }
 if(background){background.terminate();background=null;}
}
function runInWorker(item){
 return new Promise((resolve,reject)=>{
  let active;
  try{active=startWorker();}
  catch(err){reject(err);return}
  const id=++cancelled;
  pending={id,is_test:!!item.is_test,resolve,reject,timeout:setTimeout(()=>{
   if(!pending||pending.id!==id)return;
   pending=null;
   active.terminate();
   if(background===active)background=null;
   reject(Error('Scan exceeded 3 minutes; review manually or retry'));
  },180000)};
  active.postMessage({type:'scan',id,drawing:item.drawing,checkVisual:visualChecks});
 });
}
function schedule(delay=waitMs){
 if(pendingTimer!==null)clearTimeout(pendingTimer);
 pendingTimer=null;
 if(!auto||document.hidden||!owner()||unavailable)return;
 pendingTimer=setTimeout(()=>{pendingTimer=null;scanNext(false)},delay);
}
async function scanNext(manual=false,selected=null){
 if(scanning||document.hidden||!owner()||(!auto&&!manual))return;
 const startedAt=cancelled;
 scanning=true;
 const nextButton=$('reviewScanNext');if(nextButton)nextButton.disabled=true;
 try{
  if(unavailable)throw Error('Background scanner unavailable in this browser');
  const request=selected?{data:[selected],error:null}:
   await criloDB.rpc('crilo_owner_local_scan_jobs_v4',{p_limit:1});
  if(request.error)throw request.error;
  if(document.hidden||!owner()||cancelled!==startedAt||(!auto&&!manual))return;
  const item=request.data?.[0];
  if(!item || (item.is_test&&!$('showOwnerTests')?.checked&&!selected)){
   setStatus(item?.is_test?'Player drawings checked. Enable Test Runs to scan those too.':
    'Up to date. New drawings will be checked in the background.');
   resetStage();
   return;
  }
  resetStage();
  const idAtStart=cancelled;
  let result;
  try{result=await runInWorker(item)}
  catch(err){
   if(String(err.message).includes('Scan paused'))return;
   setStatus('Scan interrupted: '+err.message+'. You can retry; manual review is still available.');
   // A crashed/unsupported scanner must never produce a "clear" result.
   if(!unavailable)unavailable=true;
   return;
  }
  if(!owner()||document.hidden||cancelled!==idAtStart+1)return;
  const blank=result.blank===true;
  const visual=blank?{reason:null,label:'Blank or nearly blank',score:null}:
   classifyVisual(result.visualResults);
  const reasons=blank?[]:[...(result.qrFound?[REASONS.qr]:[]),...classifyText(result.ocrText)];
  if(!blank&&visual.reason)reasons.push(visual.reason);
  // Recognized outline shapes are positive advisory signals, not proof.
  if(!blank&&(result.shapeSuspected===true||result.genitalSuspected===true))
    reasons.push(REASONS.genital);
  const problems=[...(result.errors||[])];
  if(!blank){
   if(result.stages?.qr!=='done'&&!problems.some(x=>/QR/i.test(x)))
    problems.push('QR check incomplete');
   if(result.stages?.ocr!=='done'&&!problems.some(x=>/OCR|Text/i.test(x)))
    problems.push('Text check incomplete');
   if(!visualChecks)problems.push('Image/symbol checks switched off');
   else{
    if(result.stages?.shape!=='done'&&!problems.some(x=>/Outline/i.test(x)))
     problems.push('Outline check incomplete');
    if(result.stages?.visual!=='done'&&!problems.some(x=>/Visual|model/i.test(x)))
     problems.push('Image model check incomplete');
   }
  }
  // Low SigLIP similarity is common even on entirely harmless artwork.
  // Never flag or mark incomplete solely because the numeric score is low.
  const payload={
   p_run_id:String(item.run_id),p_is_test:!!item.is_test,
   p_reasons:[...new Set(reasons)],p_text:String(result.ocrText||'').trim().slice(0,300),
   p_visual_label:blank?'Blank or nearly blank drawing':
    result.genitalSuspected?(result.genitalType==='vulva'?
     'Possible vulva drawing (shape review)':'Possible penis drawing (shape review)'):
    result.shapeSuspected?'Possible genital outline (shape review)':visual.label,
   p_visual_score:visual.score,
   p_error:problems.length?problems.join('; ').slice(0,250):null
  };
  const saved=await criloDB.rpc('crilo_owner_local_scan_save_v4',payload);
  if(saved.error)throw saved.error;
  if(saved.data!==true)throw Error('Run is no longer awaiting review');
  processed++;if(payload.p_reasons.length)suspected++;
  setStatus('Checked '+processed+' drawing'+(processed!==1?'s':'')+
   ' · '+suspected+' suggested for your review'+(payload.p_error?' · Some checks unavailable':'')+
   '. No automatic removal or bans.');
  await window.criloRefreshDrawingFeed?.();
 }catch(err){
  setStatus('Scan error: '+err.message+'. Drawings remain available for your review.');
 }finally{
  scanning=false;
  if(nextButton)nextButton.disabled=false;
  if(!manual) schedule();
  else if(auto)schedule(6000);
 }
}
function setAuto(value){
 auto=!!value;
 const btn=$('reviewToggleScan');
 if(btn){btn.textContent=auto?'Pause scanning':'Resume scanning';btn.setAttribute('aria-pressed',String(!auto));}
 if(!auto){
  if(pendingTimer!==null)clearTimeout(pendingTimer);
  pendingTimer=null;stopActive();setStatus('Paused. You can review and moderate drawings without scanning.');
 }else{
  unavailable=false;setStatus('Background checks are on; processing one drawing at a time.');
  schedule(1200);
 }
}
function init(){
 if(started||!owner())return;
 started=true;resetStage();
 if($('reviewToggleScan'))$('reviewToggleScan').addEventListener('click',()=>setAuto(!auto));
 if($('reviewScanNext'))$('reviewScanNext').addEventListener('click',()=>scanNext(true));
 if($('reviewVisualEnabled'))$('reviewVisualEnabled').addEventListener('change',e=>{
  visualChecks=!!e.target.checked;
  if(!visualChecks)nowStage.visual='Off';
  showStage();
 });
 if($('showOwnerTests'))$('showOwnerTests').addEventListener('change',()=>{if(auto)schedule(500)});
 setStatus('Background scanning ready. The page remains responsive while checks run.');
 schedule(1600);
}
window.criloScanSpecificDrawing=async selected=>{
 if(!selected||!owner()||typeof selected.run_id==='undefined')return;
 if(scanning){
  stopActive();
  for(let tries=0;tries<40&&scanning;tries++)
   await new Promise(resolve=>setTimeout(resolve,25));
 }
 if(scanning){setStatus('Current scan is stopping. Try this drawing again.');return}
 return scanNext(true,selected);
};
window.criloScanPendingDrawings=()=>scanNext(true);
window.CriloLocalSafety.start=init;
window.addEventListener('crilo-auth-ready',init);
setTimeout(init,1500);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){if(pendingTimer!==null)clearTimeout(pendingTimer);pendingTimer=null;stopActive();}
 else if(auto){if(unavailable)unavailable=false;schedule(1200)}
});
window.addEventListener('beforeunload',stopActive);
})();