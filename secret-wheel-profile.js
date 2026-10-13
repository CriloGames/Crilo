/* Earned Mint Orbit cosmetic. Public viewers can see an equipped halo;
   only the server-confirmed winner can change their own equipped state. */
(()=>{
 'use strict';
 const wrap=document.querySelector('.profile-icon-wrap'),
       button=document.getElementById('secretHaloToggle');
 if(!wrap||!button||typeof criloDB==='undefined')return;
 const query=new URLSearchParams(location.search);
 let equipped=false,won=false,revision=0;
 async function load(){
  const token=++revision;
  const target=query.get('id')||window.Crilo?.user?.id;
  if(!target){button.classList.add('hidden');wrap.classList.remove('secret-wheel-halo');return}
  const mine=Boolean(window.Crilo?.user?.id===target);
  const [appearance,reward]=await Promise.all([
   criloDB.rpc('crilo_secret_wheel_public_cosmetic',{p_user:target}),
   mine?criloDB.rpc('crilo_secret_wheel_status'):Promise.resolve({data:null})
  ]);
  if(token!==revision)return;
  if(appearance.error)return;
  equipped=appearance.data===true;
  won=mine&&reward.data?.won===true;
  wrap.classList.toggle('secret-wheel-halo',equipped);
  button.classList.toggle('hidden',!won);
  if(won){
   button.textContent=equipped?'✦ Mint Orbit · On':'✧ Mint Orbit · Off';
   button.title=equipped?'Unequip your earned Mint Orbit halo':'Equip your earned Mint Orbit halo';
   button.setAttribute('aria-pressed',String(equipped));
  }
 }
 button.addEventListener('click',async()=>{
  if(!won||button.disabled)return;
  button.disabled=true;
  try{
   const {data,error}=await criloDB.rpc('crilo_secret_wheel_equip',{p_equip:!equipped});
   if(error)throw error;
   equipped=data===true;
   wrap.classList.toggle('secret-wheel-halo',equipped);
   button.textContent=equipped?'✦ Mint Orbit · On':'✧ Mint Orbit · Off';
   button.setAttribute('aria-pressed',String(equipped));
   button.title=equipped?'Unequip your earned Mint Orbit halo':'Equip your earned Mint Orbit halo';
  }catch(error){
   button.title='Could not save cosmetic: '+(error?.message||'Try again');
  }finally{button.disabled=false}
 });
 window.addEventListener('crilo-auth-ready',load);
 load();
})();
