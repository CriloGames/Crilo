/* Crilo Owner TOTP MFA. Privileges are enforced by Supabase, never by this UI. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const card=$('ownerSecurityCard');
 if(!card)return;
 const status=$('ownerMfaStatus'),enrollBtn=$('ownerMfaEnroll'),
  unlockBtn=$('ownerMfaUnlock'),refreshBtn=$('ownerMfaRefresh'),
  form=$('ownerMfaCodeForm'),input=$('ownerMfaCode'),
  verifyBtn=$('ownerMfaVerify'),setup=$('ownerMfaSetup'),
  qr=$('ownerMfaQr'),secret=$('ownerMfaSecret');
 let currentUserId=null,verifiedFactor=null,pendingFactor=null,busy=false;
 const show=(el,yes)=>el.classList.toggle('hidden',!yes);
 function clearSecret(){qr.removeAttribute('src');secret.textContent='';}
 function message(text){status.textContent=text;}
 function lockButtons(yes){
  busy=yes;
  for(const element of [enrollBtn,unlockBtn,refreshBtn,verifyBtn])element.disabled=yes;
 }
 async function readMfa(){
  if(!window.Crilo?.user||!Crilo.profile?.is_owner){
   card.classList.add('hidden');
   currentUserId=null;
   verifiedFactor=null;pendingFactor=null;clearSecret();
   return;
  }
  const id=Crilo.user.id;
  if(currentUserId!==id){
   currentUserId=id;pendingFactor=null;verifiedFactor=null;clearSecret();
  }
  card.classList.remove('hidden');
  if(busy)return;
  message('Checking owner verification…');
  try{
   const [level,list]=await Promise.all([
    criloDB.auth.mfa.getAuthenticatorAssuranceLevel(),
    criloDB.auth.mfa.listFactors()
   ]);
   if(level.error)throw level.error;
   if(list.error)throw list.error;
   // A verified factor is the sole means of elevating an owner session.
   const totp=list.data?.totp||[];
   verifiedFactor=totp.find(f=>f.status==='verified')||null;
   const elevated=level.data?.currentLevel==='aal2'&&!!verifiedFactor;
   show(enrollBtn,!verifiedFactor&&!pendingFactor);
   show(unlockBtn,!!verifiedFactor&&!elevated);
   show(setup,!!pendingFactor);
   show(form,!!pendingFactor|| (!!verifiedFactor&&!elevated));
   if(elevated){
    pendingFactor=null;clearSecret();show(setup,false);show(form,false);
    show(unlockBtn,false);
    message('Verified: owner moderation and destructive actions are unlocked for this session.');
   }else if(verifiedFactor){
    message('Your authenticator is enrolled. Enter its six-digit code to unlock protected owner actions.');
   }else if(pendingFactor){
    message('Scan the QR code, then enter the six-digit code to finish enrollment.');
   }else{
    message('Action required: set up an authenticator. Until verified, bans, score removals, and moderation changes are blocked.');
   }
  }catch(error){
   message('Could not check MFA status: '+(error?.message||'Try refreshing.'));
  }
 }
 enrollBtn.addEventListener('click',async()=>{
  if(!Crilo.user||!Crilo.profile?.is_owner||busy)return;
  lockButtons(true);message('Creating your private authenticator setup…');
  try{
   const {data,error}=await criloDB.auth.mfa.enroll({
    factorType:'totp',friendlyName:'Crilo Owner Security'
   });
   if(error)throw error;
   if(!data?.id||!data?.totp?.qr_code||!data?.totp?.secret)throw new Error('Authenticator setup unavailable');
   pendingFactor=data.id;
   // Supabase Auth provides an image data URL, not arbitrary HTML.
   if(!/^data:image\/svg\+xml[;,]/i.test(data.totp.qr_code))throw new Error('Unexpected QR image format');
   qr.src=data.totp.qr_code;
   secret.textContent=data.totp.secret;
   show(setup,true);show(form,true);show(enrollBtn,false);
   show(unlockBtn,false);
   message('Scan the QR code or enter the setup key, then type the code shown by your authenticator.');
   input.value='';input.focus();
  }catch(error){message('Could not enroll authenticator: '+(error?.message||'Please try again.'))}
  finally{lockButtons(false)}
 });
 unlockBtn.addEventListener('click',()=>{
  if(!verifiedFactor||busy)return;
  show(form,true);input.value='';input.focus();
  message('Enter the current code from your registered authenticator.');
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(busy||!window.Crilo?.profile?.is_owner)return;
  const code=input.value.trim();
  if(!/^[0-9]{6}$/.test(code)){message('Enter exactly six digits from your authenticator.');return}
  const id=pendingFactor||verifiedFactor?.id;
  if(!id){message('Start authenticator setup first.');return}
  lockButtons(true);message('Verifying with Supabase Auth…');
  try{
   const {error}=await criloDB.auth.mfa.challengeAndVerify({factorId:id,code});
   if(error)throw error;
   input.value='';pendingFactor=null;clearSecret();
   show(setup,false);show(form,false);
   // This method refreshes the signed session with its server-issued AAL2 claim.
   message('Authenticator verified. Checking elevated session…');
  }catch(error){message('Verification failed: '+(error?.message||'Check the code and try again.'))}
  finally{lockButtons(false)}
  if(!pendingFactor)await readMfa();
 });
 refreshBtn.addEventListener('click',readMfa);
 window.addEventListener('crilo-auth-ready',readMfa);
 // No enrollment is performed without an explicit owner click.
})();
