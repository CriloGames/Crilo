/* Share completed, server-verified Crilo Daily results; never expose drawings or owner Test Runs. */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id);
 const esc=s=>String(s??'');
 const number=n=>Math.max(0,Number(n)||0);
 let report=null,dialog=null,canvas=null,notice=null,busy=false;
 const font=(weight,size)=>weight+' '+size+'px system-ui, -apple-system, sans-serif';
 function addButton(parent,id,text){
  const btn=document.createElement('button');btn.type='button';btn.id=id;
  btn.className='primary crilo-share-trigger hidden';btn.textContent=text;if(id==='criloShareResult')parent?.prepend(btn);else parent?.append(btn);
  btn.addEventListener('click',show);return btn;
 }
 const resultBtn=addButton(document.querySelector('#result .result-actions'),'criloShareResult','Share my Daily ↗');
 const replayBtn=addButton(byId('playedPanel'),'criloSharePlayed','Share score ↗');
 if(!resultBtn||!replayBtn)return;
 function ensureDialog(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='criloShareDialog';dialog.className='crilo-share-dialog';
  dialog.innerHTML='<div class="crilo-share-head"><strong>SHARE YOUR DAILY</strong><button type="button" id="criloShareClose" aria-label="Close">×</button></div>'+
   '<canvas id="criloShareCanvas" width="1080" height="1080" aria-label="Preview of your Crilo Daily score card"></canvas>'+
   '<p class="crilo-share-hint">Share the score card, save it as an image, or copy a link to challenge friends. Your drawing and username stay private.</p>'+
   '<div class="crilo-share-actions"><button type="button" id="criloShareCopy">Copy result</button><button type="button" id="criloShareSave">Save image</button><button type="button" id="criloShareNative">Share ↗</button></div>'+
   '<p id="criloShareNotice" role="status" aria-live="polite"></p>';
  document.body.append(dialog);
  canvas=byId('criloShareCanvas');notice=byId('criloShareNotice');
  byId('criloShareClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  byId('criloShareCopy').addEventListener('click',copyText);
  byId('criloShareSave').addEventListener('click',saveImage);
  byId('criloShareNative').addEventListener('click',nativeShare);
 }
 function description(){
  if(!report)return '';
  return 'Crilo Daily '+report.daily_period+'\n'+number(report.score).toLocaleString()+' points · '+number(report.spins)+' spins · '+number(report.ducks)+' ducks · '+number(report.upgrades)+' upgrades\n'+
  'Can you beat my Daily? https://crilo.fun/';
 }
 function draw(){
  const ctx=canvas.getContext('2d'),W=1080;ctx.clearRect(0,0,W,W);
  ctx.fillStyle='#faf6ed';ctx.fillRect(0,0,W,W);
  ctx.fillStyle='#ccebd9';ctx.beginPath();ctx.arc(1010,80,235,0,7);ctx.fill();
  ctx.fillStyle='#f8d9e6';ctx.beginPath();ctx.arc(55,1055,255,0,7);ctx.fill();
  ctx.fillStyle='#17191e';ctx.beginPath();ctx.roundRect(65,65,950,950,60);ctx.fill();
  ctx.fillStyle='#fffdf7';ctx.beginPath();ctx.roundRect(78,78,924,924,52);ctx.fill();
  ctx.textAlign='left';ctx.fillStyle='#17191e';
  ctx.font=font(900,88);ctx.fillText('CRILO',133,200);
  ctx.font=font(800,27);ctx.fillText('THE DAILY WHEEL',137,259);
  // The icon is rendered as vector sectors, so it stays sharp when shared.
  const colors=['#ffe06b','#90e0c8','#ffa9c9','#ceb1f2','#98cdf9'];
  const cx=835,cy=192,r=92;
  colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.strokeStyle='#17191e';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,-Math.PI/2+i*2*Math.PI/5,-Math.PI/2+(i+1)*2*Math.PI/5);ctx.closePath();ctx.fill();ctx.stroke()});
  ctx.beginPath();ctx.arc(cx,cy,39,0,7);ctx.fillStyle='#fffdf7';ctx.fill();ctx.stroke();
  ctx.font=font(900,46);ctx.textAlign='center';ctx.fillStyle='#17191e';ctx.fillText('C',cx,cy+16);
  ctx.textAlign='left';ctx.font=font(800,27);ctx.fillStyle='#66615d';ctx.fillText('OFFICIAL DAILY · '+report.daily_period,137,360);
  ctx.fillStyle='#17191e';ctx.font=font(900,173);ctx.fillText(number(report.score).toLocaleString(),126,545);
  ctx.font=font(800,42);ctx.fillText('POINTS',137,610);
  const names=['SPINS','DUCKS','UPGRADES'],vals=[report.spins,report.ducks,report.upgrades];
  vals.forEach((v,i)=>{let x=132+275*i;ctx.fillStyle=['#fce6a5','#d5e8f7','#eedcf5'][i];ctx.beginPath();ctx.roundRect(x,686,242,169,28);ctx.fill();ctx.fillStyle='#17191e';ctx.font=font(900,65);ctx.fillText(String(number(v)),x+22,763);ctx.font=font(800,23);ctx.fillText(names[i],x+22,811)});
  ctx.font=font(800,36);ctx.fillStyle='#17191e';ctx.fillText('Can you beat my Daily?',135,930);
  ctx.textAlign='right';ctx.fillText('crilo.fun',946,930);
 }
 const outputBlob=()=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not export score image')),'image/png'));
 async function copyText(){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(description());notice.textContent='Copied!';}
   else {window.prompt('Copy your Daily result:',description());notice.textContent='Ready to copy.';}
   window.CriloMetrics?.track('share_result');
  }catch(e){notice.textContent='Copy was blocked. Try Share or Save image.'}
 }
 async function saveImage(){
  try{const blob=await outputBlob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='crilo-daily-'+report.daily_period+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent='Image saved.';window.CriloMetrics?.track('share_result')}
  catch(e){notice.textContent='Image could not be saved.'}
 }
 async function nativeShare(){
  try{
   const blob=await outputBlob(),file=new File([blob],'crilo-daily.png',{type:'image/png'});
   if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'Crilo Daily Wheel',text:description(),files:[file]})}
   else if(navigator.share){await navigator.share({title:'Crilo Daily Wheel',text:description(),url:'https://crilo.fun/'})}
   else {await copyText();return}
   window.CriloMetrics?.track('share_result');notice.textContent='Shared!';
  }catch(e){if(e.name!=='AbortError')notice.textContent='Sharing unavailable here. Try Copy result or Save image.'}
 }
 async function show(){
  if(busy)return;busy=true;
  try{
   const user=window.Crilo?.user;
   if(!user){return}
   // Query only the signed-in user's real server-verified Daily. A preview,
   // guest run or private Test Run is never eligible.
   const {data,error}=await criloDB.from('daily_runs')
     .select('score,spins,ducks,upgrades,daily_period,verified_spin_session_id')
     .eq('user_id',user.id).eq('is_test',false)
     .not('verified_spin_session_id','is',null)
     .order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(error||!data?.verified_spin_session_id){
    byId('message').textContent='Your verified Daily is not saved yet. Try again after it finishes.';
    return;
   }
   report=data;ensureDialog();notice.textContent='';draw();dialog.showModal();
  }catch(e){console.warn('Crilo sharing unavailable:',e)}finally{busy=false}
 }
 function sync(){
  const isSignedIn=!!window.Crilo?.user?.id;
  const saved=byId('message')?.textContent?.includes('Official Daily saved')&&
    !byId('result')?.classList.contains('hidden');
  const played=!byId('playedPanel')?.classList.contains('hidden')&&
    byId('playedPanel')?.textContent?.includes('Official Daily complete')&&
    !byId('playedText')?.textContent?.includes('removed');
  resultBtn.classList.toggle('hidden',!isSignedIn||!saved);
  replayBtn.classList.toggle('hidden',!isSignedIn||!played);
 }
 const observer=new MutationObserver(sync);
 for(const id of ['message','playedPanel','result']){const node=byId(id);if(node)observer.observe(node,{subtree:true,childList:true,characterData:true,attributes:id!=='playedPanel'})}
 window.addEventListener('crilo-auth-ready',sync);sync();
})();
