(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.Crilo = { $, esc, user:null, profile:null };

  function applyTheme(theme){
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('crilo_theme', theme === 'dark' ? 'dark' : 'light');
  }
  applyTheme(localStorage.getItem('crilo_theme') || 'light');

  let authReadySent = false;

  async function loadIdentity(sessionOverride){
    if(!window.criloDB) return;

    let session = sessionOverride;
    if(session === undefined){
      const {data, error} = await criloDB.auth.getSession();
      if(error) console.error('Crilo session error:', error);
      session = data?.session || null;
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
    authReadySent = true;
    window.dispatchEvent(new CustomEvent('crilo-auth-ready',{
      detail:{user:Crilo.user,profile:Crilo.profile}
    }));
  }

  async function finishAuthCallback(){
    if(!window.criloDB) return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    // Support PKCE callbacks if Supabase returns ?code=...
    if(code){
      const {data, error} = await criloDB.auth.exchangeCodeForSession(code);
      if(error){
        console.error('Crilo magic-link callback error:', error);
      } else {
        url.searchParams.delete('code');
        history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        await loadIdentity(data?.session || undefined);
        return;
      }
    }

    // Browser/implicit callbacks are detected and persisted by supabase-js.
    await loadIdentity();

    // Clean up a leftover empty # after a successful email redirect.
    if(window.location.hash === '#' && Crilo.user){
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  }

  function renderAccount(){
    const btn=$('accountBtn'), menu=$('accountMenu');
    if(!btn) return;
    if(!Crilo.user || !Crilo.profile){ btn.textContent='SIGN IN'; btn.style.color=''; return; }
    btn.textContent=Crilo.profile.username || 'ACCOUNT';
    btn.style.color=Crilo.profile.name_color || '';
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

  // Keep the header/profile synchronized whenever Supabase signs in or out.
  criloDB.auth.onAuthStateChange((event, session) => {
    if(event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'){
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
  finishAuthCallback();
})();
