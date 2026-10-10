(() => {
  'use strict';
  const track=document.getElementById('bugBeetleTrack');
  const beetle=document.getElementById('bugBeetle');
  const modal=document.getElementById('bugReportModal');
  const form=document.getElementById('bugReportForm');
  const status=document.getElementById('bugReportStatus');
  const submit=document.getElementById('bugSubmit');
  if(!track||!beetle||!modal||!form)return;
  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  // CSS coordinates the return direction, the tiny landing, and its flies.
  // Pausing, rather than restarting, keeps the beetle and details in sync.
  function syncMotion(){
    if(motionQuery.matches){track.classList.remove('walking','paused');return}
    track.classList.add('walking');
    track.classList.toggle('paused',document.hidden||!modal.classList.contains('hidden'));
  }
  const open=()=>{beetle.classList.remove('silent-return-focus');status.textContent='';modal.classList.remove('hidden');syncMotion();document.getElementById('bugDescription').focus()};
  const close=()=>{
    modal.classList.add('hidden');
    syncMotion();
    // Keep keyboard focus on the report control, but avoid the persistent
    // focus-visible outline after closing the dialog with Escape.
    beetle.classList.add('silent-return-focus');
    beetle.focus({preventScroll:true});
  };
  beetle.addEventListener('blur',()=>beetle.classList.remove('silent-return-focus'));
  beetle.addEventListener('click',open);
  document.getElementById('bugClose').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  // Capture Escape before the site's global modal listener so focus returns to the beetle.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden')){e.preventDefault();e.stopImmediatePropagation();close()}},true);
  // One uninterrupted patrol: 7.36s out, quick hopping turn, 7.36s back, quick turn.
  setTimeout(syncMotion,1500);
  document.addEventListener('visibilitychange',syncMotion);
  motionQuery.addEventListener?.('change',syncMotion);
  let lastSend=0;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(submit.disabled)return;
    if(document.getElementById('bugWebsite').value)return;
    if(Date.now()-lastSend<60000){status.textContent='Please wait a minute before sending another report.';return}
    const description=document.getElementById('bugDescription').value.trim();
    const steps=document.getElementById('bugSteps').value.trim();
    if(description.length<15){status.textContent='Please describe the issue in at least 15 characters.';return}
    submit.disabled=true;status.textContent='Sending your report…';
    try{
      const session=typeof criloDB!=='undefined'?await criloDB.auth.getSession():null;
      const token=session?.data?.session?.access_token;
      const res=await fetch(CRILO_SUPABASE_URL+'/functions/v1/report-bug',{
        method:'POST',headers:{'Content-Type':'application/json','apikey':CRILO_SUPABASE_KEY,...(token?{'Authorization':'Bearer '+token}:{})},
        body:JSON.stringify({description,steps,page_url:location.origin+location.pathname,user_agent:navigator.userAgent})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Could not submit report.');
      lastSend=Date.now();status.textContent='Thanks! Your bug report has been received.';
      form.reset();
    }catch(err){status.textContent=err.message||'Something went wrong. Please try again.'}
    finally{submit.disabled=false}
  });
})();
