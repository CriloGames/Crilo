/* Paint-only account-header continuity between Crilo's separate HTML pages.
 * This snapshot never authorizes navigation, RPCs, moderation, or account actions.
 * Supabase re-verifies the user and owner role on every new page. */
(()=>{
'use strict';
const KEY='crilo-header-preview-v1',AGE=3*60*60*1000;
const validName=s=>typeof s==='string'&&/^[A-Za-z0-9_]{2,20}$/.test(s);
const validColor=s=>typeof s==='string'&&/^#[\da-fA-F]{6}$/.test(s);
function read(){
 try{
  const raw=sessionStorage.getItem(KEY);
  if(!raw)return null;
  const data=JSON.parse(raw);
  if(!data||!Number.isFinite(data.time)||Date.now()-data.time>AGE||
     data.time>Date.now()+60000||!validName(data.name)||!validColor(data.color)||
     typeof data.owner!=='boolean'||!Number.isInteger(data.count)||data.count<0||
     data.count>999||typeof data.userId!=='string'||data.userId.length>100){
   sessionStorage.removeItem(KEY);return null;
  }
  return data;
 }catch{return null}
}
function store(info){
 try{sessionStorage.setItem(KEY,JSON.stringify(info))}catch{}
}
function ownerLink(){
 const nav=document.querySelector('.topbar nav');
 if(!nav)return null;
 let link=nav.querySelector('#ownerDrawingNav');
 if(!link){
  link=document.createElement('a');
  link.id='ownerDrawingNav';link.className='crilo-owner-review-link';
  link.href='moderation.html';link.textContent='DRAWING REVIEW';
  nav.appendChild(link);
 }
 link.classList.toggle('active',location.pathname.endsWith('/moderation.html'));
 return link;
}
function ensureBell(host=document.querySelector('.header-actions')){
 if(!host)return null;
 let wrap=document.getElementById('friendBellWrap');
 if(!wrap){
  wrap=document.createElement('div');wrap.id='friendBellWrap';
  wrap.className='crilo-notification-wrap';
  wrap.innerHTML='<button id="friendBellBtn" class="circle-btn" type="button" aria-label="Notifications" aria-expanded="false" title="Notifications"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span id="friendBellCount" class="crilo-notification-count hidden"></span></button><section id="friendBellPanel" class="crilo-notification-panel hidden" aria-label="Notifications"><div class="crilo-notification-title">NOTIFICATIONS</div><div id="friendBellItems"></div><a class="crilo-notification-footer" href="friends.html">VIEW ALL FRIEND REQUESTS →</a></section>';
  host.insertBefore(wrap,host.firstChild);
 }
 const button=wrap.querySelector('#friendBellBtn');
 if(button&&!button.dataset.bound){
  button.dataset.bound='true';
  button.addEventListener('click',()=>{
   // A cached icon cannot open notifications before the session is confirmed.
   if(!window.Crilo?.user)return;
   const panel=wrap.querySelector('#friendBellPanel');
   panel.classList.toggle('hidden');
   button.setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));
  });
 }
 return wrap;
}
function prime(){
 const button=document.getElementById('accountBtn');
 if(!button)return;
 const snapshot=read();
 // Construct the bell in its final position before the first content paint.
 const bell=ensureBell();
 if(bell)bell.style.display=snapshot?'block':'none';
 if(!snapshot)return;
 button.textContent=snapshot.name;
 button.style.color=snapshot.color;
 button.style.visibility='visible';
 button.dataset.visualReady='true';
 button.setAttribute('aria-busy','true');
 if(snapshot.owner){
  const link=ownerLink();
  if(link){link.setAttribute('aria-disabled','true');link.tabIndex=-1;link.classList.add('crilo-owner-pending')}
 }
 const counter=document.getElementById('friendBellCount');
 if(counter){
  counter.classList.toggle('hidden',!snapshot.count);
  counter.textContent=snapshot.count>9?'9+':String(snapshot.count);
 }
}
function save(user,profile){
 if(!user?.id||profile?.id!==user.id||!validName(profile.username))return;
 const old=read();
 const data={userId:user.id,name:profile.username,
  color:validColor(profile.name_color)?profile.name_color:'#17191e',
  owner:profile.is_owner===true,
  count:old?.userId===user.id?old.count:0,time:Date.now()};
 store(data);
 const button=document.getElementById('accountBtn');
 if(button)delete button.dataset.visualReady;
 const link=document.getElementById('ownerDrawingNav');
 if(link){link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');link.classList.remove('crilo-owner-pending')}
}
function updateCount(userId,count){
 const old=read();
 if(!old||old.userId!==userId||!Number.isInteger(count)||count<0)return;
 old.count=Math.min(999,count);old.time=Date.now();store(old);
}
function clear(){
 try{sessionStorage.removeItem(KEY)}catch{}
 const button=document.getElementById('accountBtn');
 if(button)delete button.dataset.visualReady;
}
window.CriloHeaderContinuity={prime,save,updateCount,clear,ensureBell};
prime();
})();
