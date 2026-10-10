(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.Crilo = { $, esc, user:null, profile:null };

  // Client-side feedback only; the Supabase trigger is the authoritative guard.
  window.Crilo.validateUsername = (value) => {
    const name = String(value || '').trim();
    if(!/^[A-Za-z0-9_]{2,20}$/.test(name)) return 'Use 2–20 letters, numbers, or underscores.';
    const normalized = name.toLowerCase().replace(/_/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
    const reserved = /^(admin|administrator|mod|moderator|support|helpdesk|staff|official|crilo|crilogames|owner|system|security|developer|devteam|verified|supabase)$/;
    const blocked = /(fuck|shit|bitch|cunt|nigg|fagg|retard|nazi|porn|rape|rapist|kike|spic|chink|whore|slut|dick|pussy|cock|penis|vagina|sexoffender)/;
    if(reserved.test(normalized)) return 'That username is reserved.';
    if(blocked.test(normalized)) return 'Choose a more appropriate username.';
    return null;
  };

  function applyTheme(theme){
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('crilo_theme', theme === 'dark' ? 'dark' : 'light');
  }
  applyTheme(localStorage.getItem('crilo_theme') || 'light');

  async function loadIdentity(sessionOverride){
    if(typeof criloDB === 'undefined') return;

    let session = sessionOverride;
    if(session === undefined){
      const {data, error} = await criloDB.auth.getSession();
      if(error) console.error('Crilo session error:', error);
      session = data?.session || null;
    }

    // A previously issued JWT may remain locally cached after an Auth ban.
    // Check the server-side account ban registry before restoring a session.
    if(session?.user){
      try{
        const {data:banned,error:banError}=await criloDB.rpc('crilo_my_ban_status');
        if(banError)throw banError;
        if(banned===true){
          Crilo.user=null;
          Crilo.profile=null;
          await criloDB.auth.signOut({scope:'local'});
          renderAccount();
          window.dispatchEvent(new CustomEvent('crilo-auth-ready',{detail:{user:null,profile:null}}));
          return;
        }
      }catch(error){
        console.error('Crilo ban status check failed:',error);
        // Don't restore a privileged signed-in UI if the ban check failed.
        Crilo.user=null;
        Crilo.profile=null;
        renderAccount();
        window.dispatchEvent(new CustomEvent('crilo-auth-ready',{detail:{user:null,profile:null}}));
        return;
      }
    }
    Crilo.user = session?.user || null;
    Crilo.profile = null;

    if(Crilo.user){
      const {data, error} = await criloDB
        .from('profiles')
        .select('id,username,name_color,theme,sound_enabled,is_owner,account_code')
        .eq('id',Crilo.user.id)
        .maybeSingle();

      if(error) console.error('Crilo profile error:', error);
      Crilo.profile = data || null;
      if(data?.theme) applyTheme(data.theme);
    }

    renderAccount();
    window.dispatchEvent(new CustomEvent('crilo-auth-ready',{
      detail:{user:Crilo.user,profile:Crilo.profile}
    }));
  }

  // Friend activity notifications, shared across Crilo pages.
  let bellTimer=null;
  const relativeTime=value=>{
    const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));
    if(seconds<60)return 'JUST NOW';
    if(seconds<3600)return Math.floor(seconds/60)+'M AGO';
    if(seconds<86400)return Math.floor(seconds/3600)+'H AGO';
    if(seconds<604800)return Math.floor(seconds/86400)+'D AGO';
    return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}).toUpperCase();
  };
  async function updateFriendBell(){
    const host=document.querySelector('.header-actions');
    if(!host)return;
    let wrap=document.getElementById('friendBellWrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='friendBellWrap';
      wrap.className='crilo-notification-wrap';
      wrap.innerHTML='<button id="friendBellBtn" class="circle-btn" type="button" aria-label="Notifications" aria-expanded="false" title="Notifications"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span id="friendBellCount" class="crilo-notification-count hidden"></span></button><section id="friendBellPanel" class="crilo-notification-panel hidden" aria-label="Notifications"><div class="crilo-notification-title">NOTIFICATIONS</div><div id="friendBellItems"></div><a class="crilo-notification-footer" href="friends.html">VIEW ALL FRIEND REQUESTS →</a></section>';
      host.insertBefore(wrap,host.firstChild);
      document.getElementById('friendBellBtn').addEventListener('click',()=>{
        const panel=document.getElementById('friendBellPanel');
        panel.classList.toggle('hidden');
        document.getElementById('friendBellBtn').setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));
      });
    }
    wrap.style.display=Crilo.user?'block':'none';
    if(!Crilo.user)return;
    const {data,error}=await criloDB.from('friend_requests').select('id,sender_id,created_at').eq('receiver_id',Crilo.user.id).eq('status','pending').order('created_at',{ascending:false}).limit(15);
    if(error)console.warn('Friend notifications:',error.message);
    // Private, owner-issued moderation notices share the existing bell.
    // Only the signed-in account's notices can be returned by this RPC.
    const {data:moderationNotices,error:moderationError}=await criloDB.rpc('crilo_my_moderation_notices');
    if(moderationError)console.warn('Moderation notices:',moderationError.message);
    const notices=moderationError?[]:(moderationNotices||[]);
    const requests=error?[]:(data||[]),indicator=document.getElementById('friendBellCount'),items=document.getElementById('friendBellItems');
    const unread=notices.filter(n=>!n.read_at).length;
    const totalUnread=requests.length+unread;
    indicator.classList.toggle('hidden',!totalUnread);
    indicator.textContent=totalUnread>9?'9+':String(totalUnread);
    let names={};
    if(requests.length){
      const ids=[...new Set(requests.map(x=>x.sender_id).filter(Boolean))];
      const response=await criloDB.from('profiles').select('id,username').in('id',ids);
      if(!response.error)names=Object.fromEntries((response.data||[]).map(x=>[x.id,x.username]));
    }
    const penaltyHTML=notices.map(n=>
      '<button type="button" class="crilo-notification-item crilo-moderation-notice'+(n.read_at?' is-read':'')+
       '" data-moderation-notice="'+Number(n.id)+'"><span class="crilo-notification-icon">⚑</span><span>'+
       '<span class="crilo-notification-copy"><b>DAILY DRAWING REMOVED — ACCOUNT FLAGGED</b>'+
       ' Your official Daily for '+esc(n.daily_period)+' was deleted for '+esc(n.reason)+
       '. '+Number(n.removed_score||0).toLocaleString()+' points were removed, and your current streak was reset. '+
       'You cannot replay that Daily. This is your one official warning; further violations may result in a ban.</span>'+
       '<small>'+relativeTime(n.created_at)+(n.read_at?' · READ':' · NEW')+'</small></span></button>'
    ).join('');
    const friendsHTML=requests.map(req=>
      '<a class="crilo-notification-item" href="friends.html"><span class="crilo-notification-icon">↗</span><span><span class="crilo-notification-copy"><b>'+esc(names[req.sender_id]||'A PLAYER')+'</b> SENT YOU A FRIEND REQUEST</span><small>'+relativeTime(req.created_at)+'</small></span></a>'
    ).join('');
    items.innerHTML=penaltyHTML+friendsHTML||
     '<div class="crilo-notification-empty">You’re all caught up. No new notifications.</div>';
    // Clicking a warning acknowledges it privately but keeps its message in
    // notification history. No public moderation details are exposed here.
    items.onclick=async event=>{
      const button=event.target.closest?.('[data-moderation-notice]');
      if(!button)return;
      const id=Number(button.dataset.moderationNotice);
      if(!Number.isSafeInteger(id)||id<=0)return;
      const {error}=await criloDB.rpc('crilo_read_moderation_notice',{p_id:id});
      if(!error)updateFriendBell();
    };
  }
  window.addEventListener('crilo-friends-changed',updateFriendBell);
  window.addEventListener('crilo-auth-ready',()=>{updateFriendBell();if(!bellTimer)bellTimer=setInterval(updateFriendBell,30000)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateFriendBell()});

  // Keep the document fixed while any modal is open, including modals opened
  // by page-specific scripts. MutationObserver catches class changes everywhere.
  let modalScrollY=0,modalLocked=false;
  function syncModalScroll(){
    const open=!!document.querySelector('.modal-backdrop:not(.hidden)');
    if(open&&!modalLocked){
      modalScrollY=window.scrollY;
      document.body.style.position='fixed';
      document.body.style.top=-modalScrollY+'px';
      document.body.style.left='0';
      document.body.style.right='0';
      document.body.style.width='100%';
      modalLocked=true;
    }else if(!open&&modalLocked){
      // Restore the document without exposing a frame at scroll position 0.
      // The body's fixed top offset holds the old viewport while locked.
      const savedY=modalScrollY;
      document.documentElement.style.scrollBehavior='auto';
      document.body.style.scrollBehavior='auto';
      document.body.style.position='';
      document.body.style.top='';
      document.body.style.left='';
      document.body.style.right='';
      document.body.style.width='';
      window.scrollTo({top:savedY,left:0,behavior:'instant'});
      modalLocked=false;
      document.documentElement.style.scrollBehavior='';
      document.body.style.scrollBehavior='';
    }
  }
  const modalObserver=new MutationObserver(syncModalScroll);
  modalObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
  syncModalScroll();

  // Escape closes the topmost visible popup, without affecting the page underneath.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||event.defaultPrevented)return;
    const visible=[...document.querySelectorAll('.modal-backdrop:not(.hidden)')];
    if(visible.length){
      const top=visible[visible.length-1];
      top.classList.add('hidden');
      event.preventDefault();
      return;
    }
    const bell=document.getElementById('friendBellPanel');
    if(bell&&!bell.classList.contains('hidden')){
      bell.classList.add('hidden');
      event.preventDefault();
      return;
    }
    // Allow Escape to dismiss the username menu on every page.
    const accountMenu=$('accountMenu');
    if(accountMenu&&!accountMenu.classList.contains('hidden')){
      accountMenu.classList.add('hidden');
      $('accountBtn')?.focus();
      event.preventDefault();
    }
  });

  function renderAccount(){
    // Owner-only navigation is also checked server-side by the moderation RPCs.
    const nav=document.querySelector('.topbar nav');
    if(nav){
      let link=nav.querySelector('#ownerDrawingNav');
      if(Crilo.profile?.is_owner){
        if(!link){
          link=document.createElement('a');
          link.id='ownerDrawingNav';
          link.href='moderation.html';
          link.textContent='DRAWING REVIEW';
          nav.appendChild(link);
        }
        link.classList.toggle('active',location.pathname.endsWith('/moderation.html'));
        link.style.setProperty('color','#b42336','important');
        link.style.setProperty('background-color','#ffe4e8','important');
        link.style.setProperty('border','1px solid #ef9eaa','important');
        link.style.setProperty('border-radius','10px','important');
        link.style.setProperty('padding','11px 15px','important');
        link.style.setProperty('font-weight','800','important');
      }else if(link)link.remove();
    }
    const btn=$('accountBtn'), menu=$('accountMenu');
    if(!btn) return;
    if(!Crilo.user){ btn.textContent='SIGN IN'; btn.style.color=''; return; }
    btn.textContent=Crilo.profile?.username || 'ACCOUNT';
    btn.style.color=Crilo.profile?.name_color || '';
    if(menu){
      menu.innerHTML=`<a href="profile.html">Statistics</a><a href="friends.html">Friends</a><a href="settings.html">Settings</a><button id="menuSignOut">Sign out</button>`;
      $('menuSignOut')?.addEventListener('click', async()=>{await criloDB.auth.signOut(); location.href='index.html';});
    }
  }

  document.addEventListener('click',e=>{
    const btn=$('accountBtn'), menu=$('accountMenu');
    if(!btn||!menu) return;
    if(e.target===btn){
      if(!Crilo.user){ window.dispatchEvent(new CustomEvent('crilo-signin-request')); return; }
      menu.classList.toggle('hidden');
    } else if(!menu.contains(e.target)) menu.classList.add('hidden');
  });

  window.Crilo.refreshIdentity = loadIdentity;
  window.Crilo.applyTheme = applyTheme;

  // Restore an existing Supabase session if it arrives after the first page load.
  // This also handles returning from an email-link redirect or switching tabs.
  let syncInProgress = false;
  async function syncSession(){
    if(syncInProgress) return;
    syncInProgress = true;
    try {
      const {data, error} = await criloDB.auth.getSession();
      if(error) console.error('Crilo auth synchronization error:', error);
      const session = data?.session || null;
      if(session?.user && (!Crilo.user || Crilo.user.id !== session.user.id || !Crilo.profile)){
        await loadIdentity(session);
      } else if(!session && Crilo.user){
        await loadIdentity(null);
      }
    } catch(error){
      console.error('Crilo session synchronization failed:', error);
    } finally {
      syncInProgress = false;
    }
  }
  window.addEventListener('focus', syncSession);
  window.addEventListener('pageshow', syncSession);
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden) syncSession();
  });
  // Retry after Supabase has finished processing any email callback.
  setTimeout(syncSession, 500);
  setTimeout(syncSession, 2000);

  // Keep the header/profile synchronized whenever Supabase signs in or out.
  criloDB.auth.onAuthStateChange((event, session) => {
    if(event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'){
      setTimeout(() => loadIdentity(session), 0);
    } else if(event === 'SIGNED_OUT'){
      Crilo.user = null;
      Crilo.profile = null;
      renderAccount();
      window.dispatchEvent(new CustomEvent('crilo-auth-ready',{
        detail:{user:null,profile:null}
      }));
    }
  });
  window.Crilo.dailyPeriod = (date=new Date()) => {
    const shifted = new Date(date.getTime() - 22*60*60*1000);
    return shifted.toISOString().slice(0,10);
  };
  window.Crilo.nextReset = (date=new Date()) => {
    const y=date.getUTCFullYear(),m=date.getUTCMonth(),d=date.getUTCDate();
    let reset=new Date(Date.UTC(y,m,d,22,0,0));
    if(date>=reset) reset=new Date(Date.UTC(y,m,d+1,22,0,0));
    return reset;
  };
  // Finish magic-link callbacks before the initial header identity check.
  async function initializeAuth(){
    const params=new URLSearchParams(location.search);
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const error=params.get('error_description')||hash.get('error_description');
    if(error){
      console.error('Crilo sign-in callback:',error);
      const status=$('authStatus');
      if(status)status.textContent='Sign-in link failed: '+error+'. Please request a new link.';
      window.dispatchEvent(new CustomEvent('crilo-auth-error',{detail:{message:error}}));
    }
    const code=params.get('code');
    if(code){
      const {data:existing}=await criloDB.auth.getSession();
      if(!existing?.session){
        const {error:exchangeError}=await criloDB.auth.exchangeCodeForSession(code);
        if(exchangeError){
          console.error('Crilo email code exchange:',exchangeError);
          window.dispatchEvent(new CustomEvent('crilo-auth-error',{detail:{message:exchangeError.message}}));
        }
      }
      const {data:restored}=await criloDB.auth.getSession();
      if(restored?.session){
        params.delete('code');
        history.replaceState(null,'',location.pathname+(params.toString()?'?'+params:''));
      }
    }
    await loadIdentity();
  }
  initializeAuth().catch(error=>console.error('Crilo auth initialization:',error));
})();
