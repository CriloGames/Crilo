/* Enlarged, read-only wheel drawings for Leaderboard and Spin History.
   One tap opens the artwork; tapping the enlarged wheel spins it. */
(() => {
 'use strict';
 if(window.CriloWheelPreview)return;
 const dialog=document.createElement('dialog');
 dialog.id='criloWheelPreview';
 dialog.className='crilo-wheel-preview-dialog';
 dialog.setAttribute('aria-label','Enlarged wheel drawing');
 dialog.innerHTML=
  '<section class="crilo-wheel-preview-card">'+
   '<div class="crilo-wheel-preview-head">'+
    '<div><span class="crilo-wheel-preview-kicker">CRILO ARTWORK</span>'+
     '<h2 id="criloWheelPreviewTitle">Wheel drawing</h2></div>'+
    '<button type="button" class="crilo-wheel-preview-close" aria-label="Close enlarged wheel">×</button>'+
   '</div>'+
   '<button type="button" class="crilo-wheel-preview-spin" aria-label="Spin the enlarged wheel" title="Click to spin">'+
    '<img class="crilo-wheel-preview-image" alt="Wheel drawing">'+
   '</button>'+
   '<p class="crilo-wheel-preview-hint">Tap the wheel to give it a spin.</p>'+
  '</section>';
 document.body.appendChild(dialog);
 const wheelButton=dialog.querySelector('.crilo-wheel-preview-spin');
 const image=dialog.querySelector('.crilo-wheel-preview-image');
 const title=dialog.querySelector('#criloWheelPreviewTitle');
 const closeButton=dialog.querySelector('.crilo-wheel-preview-close');
 let animation=null,opener=null,spins=0;
 function stopSpin(){
  if(animation){animation.cancel();animation=null}
  image.style.transform='';
 }
 function close(){
  if(dialog.open)dialog.close();
 }
 function openFrom(source){
  const artwork=source?.matches?.('img')?source:source?.querySelector?.('img');
  if(!artwork)return;
  const src=artwork.getAttribute('src')||'';
  if(src!=='blank-wheel.svg'&&!/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/.test(src))return;
  if(dialog.open)dialog.close();
  stopSpin();
  opener=source;spins=0;
  wheelButton.dataset.spins='0';
  image.src=src;
  image.alt=artwork.alt||'Wheel drawing';
  const blank=src==='blank-wheel.svg';
  title.textContent=blank?'Blank wheel drawing':'Wheel drawing';
  wheelButton.setAttribute('aria-label',blank?'Spin enlarged blank wheel':'Spin enlarged wheel drawing');
  dialog.showModal();
  closeButton.focus();
 }
 wheelButton.addEventListener('click',()=>{
  stopSpin();
  spins++;
  wheelButton.dataset.spins=String(spins);
  // Even users who prefer less motion can click; they just get a very short spin.
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration=reduced?180:2000;
  animation=image.animate([
   {transform:'rotate(0deg)'},{transform:'rotate('+(reduced?360:1440)+'deg)'}
  ],{duration,easing:'cubic-bezier(.1,.65,.2,1)'});
 });
 closeButton.addEventListener('click',close);
 dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
 dialog.addEventListener('close',()=>{
  stopSpin();
  const focusTarget=opener;
  opener=null;
  if(focusTarget?.isConnected)focusTarget.focus?.({preventScroll:true});
 });
 window.CriloWheelPreview=Object.freeze({openFrom});
})();
