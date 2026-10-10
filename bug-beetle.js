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
  // Each turnaround independently has a 1-in-15 chance of a special trick.
  // Five tricks are equally likely when one is selected (1 in 75 per wall).
  // Select them once per 16-second patrol, keeping the trick layers on the
  // SAME CSS timeline as the walking, jumping, poop and flies.
  const tricks=['backflip','barrel','frontflip','doublehop','wiggle'];
  const sides=['right','left'];
  function chooseTurnTricks(){
    for(const side of sides){
      for(const trick of tricks)track.classList.remove('beetle-'+side+'-'+trick);
      if(Math.random()<1/15){
        const trick=tricks[Math.floor(Math.random()*tricks.length)];
        track.classList.add('beetle-'+side+'-'+trick);
      }
    }
  }
  // A new random choice at the exact start of each patrol iteration avoids
  // timers drifting out of sync when the tab or report modal pauses the beetle.
  beetle.addEventListener('animationiteration',event=>{
    if(event.target===beetle&&event.animationName==='criloBeetlePatrol')chooseTurnTricks();
  });

  // CSS coordinates the return direction, the tiny landing, and its flies.
  // Pausing, rather than restarting, keeps the beetle and details in sync.
  function syncMotion(){
    if(motionQuery.matches){track.classList.remove('walking','paused');return}
    track.classList.add('walking');
    track.classList.toggle('paused',document.hidden||!modal.classList.contains('hidden'));
  }
  // A short, distinct insect chitter triggered ONLY by the report-beetle click.
  // Web Audio is generated locally (no downloads, requests, or usage fees).
  let audioContext=null;
  function playBeetleChirp(){
    try{
      if(window.Crilo?.profile?.sound_enabled===false)return;
      if(window.localStorage?.getItem('crilo_sound')==='off')return;
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return; // An unsupported audio device must not block reports.
      const ac=audioContext||(audioContext=new Audio());
      if(ac.state==='suspended')ac.resume().catch(()=>{});
      const filter=ac.createBiquadFilter();
      filter.type='lowpass';
      filter.frequency.value=2550;
      filter.connect(ac.destination);
      const start=ac.currentTime+0.012;
      // Five small descending, scratchy trills and a soft final click.
      // Kept well below the volume of the normal wheel effects.
      const chirps=[
        [0,1175,810,.055,.034,'triangle'],
        [.065,1380,880,.058,.031,'sawtooth'],
        [.133,1120,700,.064,.037,'triangle'],
        [.215,960,620,.082,.034,'triangle'],
        [.309,1180,720,.057,.029,'sawtooth'],
        [.380,510,320,.034,.023,'triangle']
      ];
      for(const [delay,from,to,duration,volume,wave] of chirps){
        const t=start+delay,osc=ac.createOscillator(),gain=ac.createGain();
        osc.type=wave;
        osc.frequency.setValueAtTime(from,t);
        osc.frequency.exponentialRampToValueAtTime(to,t+duration);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(volume,t+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        osc.connect(gain);
        gain.connect(filter);
        osc.start(t);
        osc.stop(t+duration+.006);
      }
    }catch(_err){
      // Audio is optional: unavailable or blocked sound must not block bug reports.
    }
  }
  const open=()=>{playBeetleChirp();beetle.classList.remove('silent-return-focus');status.textContent='';modal.classList.remove('hidden');syncMotion();document.getElementById('bugDescription').focus()};
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
  setTimeout(()=>{chooseTurnTricks();syncMotion()},1500);
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
