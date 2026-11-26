(()=>{'use strict';
const gate=document.getElementById('ascentOwnerGate'),status=document.getElementById('ascentOwnerStatus');
const deny=message=>{document.body.classList.add('ascent-owner-pending');gate.hidden=false;status.textContent=message};
const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.append(script)});
(async()=>{
 try{
  if(typeof criloDB==='undefined'||!criloDB?.auth?.getUser)return deny('Sign-in service unavailable. Refresh to try again.');
  const {data,error}=await criloDB.auth.getUser(),uid=data?.user?.id;
  if(error||!uid)return deny('Sign in to the Crilo owner account to playtest.');
  const {data:profile,error:readError}=await criloDB.from('profiles').select('id,is_owner').eq('id',uid).maybeSingle();
  if(readError||profile?.id!==uid||profile.is_owner!==true)return deny('This playtest is available only to Crilo’s owner account.');
  gate.hidden=true;document.body.classList.remove('ascent-owner-pending');
  criloDB.auth.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'||(session?.user?.id&&session.user.id!==uid))location.replace('/test-games.html')});
  await load('routes-api.js?v=3');
  if(document.getElementById('view')){await load('mountain.js?v=9');await load('game.js?v=69')}else await load('archive.js?v=2');
 }catch{deny('Could not open the playtest. Check your connection and refresh.')}
})();
})();