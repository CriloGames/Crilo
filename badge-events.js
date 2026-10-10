/* Crilo V3: signed-in, idempotent low-stakes exploration badge events.
   Server validates identity and required official-run prerequisites; Test Runs do not record run achievements. */
(() => {
 'use strict';
 const sent=new Set();
 async function track(name){
  if(!name||sent.has(name)||typeof criloDB==='undefined')return false;
  try{
   const {data:{session}}=await criloDB.auth.getSession();
   if(!session?.user)return false;
   const {data,error}=await criloDB.rpc('crilo_v3_record_event',{p_event:name});
   if(error){console.warn('Badge exploration event not recorded',name,error.message);return false;}
   sent.add(name);
   return !!data;
  }catch(e){console.warn('Badge exploration event unavailable',name,e);return false;}
 }
 window.CriloBadgeEvents={track};
 const path=location.pathname.toLowerCase();
 const inDomain=/\/domain\/(?:index\.html)?$/.test(path);
 const onPage=(a)=>path.endsWith('/'+a)||path.endsWith('/'+a+'.html');
 const bind=()=>{
  // Recheck after Supabase magic-link restoration.
  const page=onPage('index')||path==='/'?'home_view':
    onPage('ducks')?'ducks_page':
    onPage('leaderboard')?'leaderboard_page':
    onPage('settings')?'settings_page':
    inDomain?'domain_open':
    null;
  if(page)track(page);
  if(onPage('profile')){
   const id=new URLSearchParams(location.search).get('id');
   criloDB.auth.getSession().then(({data})=>{
    const mine=!id||id===data?.session?.user?.id;
    if(mine){track('profile_page');const grid=document.getElementById('badgeGrid');
     if(grid&&'IntersectionObserver'in window){const io=new IntersectionObserver(entries=>{
       if(entries.some(x=>x.isIntersecting)){track('badges_page');io.disconnect();}
      });io.observe(grid);}
    }else if(document.referrer.includes('leaderboard'))track('other_player_profile');
   }).catch(()=>{});
  }
 };
 document.addEventListener('click',e=>{
  const node=e.target.closest('button,a,summary,[role="button"],.stat-tile,.duck-unlocked');
  if(!node)return;
  const id=node.id||'';
  if(onPage('index')||path==='/'){
   if(id==='helpBtn')track('info_open');
   if(id==='rarityInfoBtn')track('rarity_info');
   if(node.closest('a[href="#more-games"]'))track('more_games_page');
  }
  if(onPage('ducks')){
   if(node.closest('.duck-unlocked')){track('duck_details');track('duck_sound');}
   if(id==='duckUnlockArt')track('duck_sound');
  }
  if(onPage('profile')){
   if(node.closest('.badge-set summary'))track('badge_detail');
   if(node.closest('.featured-editable,.featured-slot'))track('badge_search');
   if(node.closest('.stat-tile')){track('run_history');if(/best/i.test(node.textContent||''))track('personal_best');}
  }
  if(onPage('leaderboard')){
   if(node.closest('[data-tab="today"]'))track('daily_leaderboard');
  }
  if(inDomain){
   if(id==='helpBtn')track('domain_instructions');
   if(id==='guessButton')track('domain_guess');
  }
 });
 window.addEventListener('crilo-auth-ready',bind);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();