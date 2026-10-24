/* Installed before the page's first paint. No session assumptions or auth
 * permissions: this only avoids rendering a temporary guest layout while
 * Supabase restores the real user and color palette. */
(()=>{
 'use strict';
 const root=document.documentElement;
 root.classList.add('crilo-auth-pending');
 try{
  const theme=localStorage.getItem('crilo_theme');
  if(theme==='dark'||theme==='light')root.dataset.theme=theme;
 }catch{}
 const style=document.createElement('style');
 style.textContent=`
  html.crilo-auth-pending body main{visibility:hidden!important;pointer-events:none!important}
  html.crilo-auth-pending body::after{
   content:"Loading Crilo…";position:fixed;z-index:8;top:clamp(128px,28vh,270px);
   left:50%;transform:translateX(-50%);padding:10px 18px;
   color:var(--muted,#8c8191);font:600 12px/1.4 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
   letter-spacing:.045em;text-align:center;white-space:nowrap;pointer-events:none
  }
  html.crilo-auth-pending body .account-menu{display:none!important}
 `;
 document.head.append(style);
 let settled=false;
 function reveal(){
  if(settled)return;
  settled=true;
  root.classList.remove('crilo-auth-pending');
  root.dataset.criloAuthReady='true';
 }
 window.CriloAuthFirstPaint={reveal,isPending:()=>!settled};
})();