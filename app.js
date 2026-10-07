(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  window.Crilo = { $, esc, user:null, profile:null };

  function applyTheme(theme){
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('crilo_theme', theme === 'dark' ? 'dark' : 'light');
  }
  applyTheme(localStorage.getItem('crilo_theme') || 'light');

  async function loadIdentity(){
    if(!window.criloDB) return;
    const {data:{session}} = await criloDB.auth.getSession();
    Crilo.user = session?.user || null;
    if(Crilo.user){
      const {data} = await criloDB.from('profiles').select('id,username,name_color,theme,sound_enabled,is_owner,account_code').eq('id',Crilo.user.id).maybeSingle();
      Crilo.profile = data || null;
      if(data?.theme) applyTheme(data.theme);
    }
    renderAccount();
    window.dispatchEvent(new CustomEvent('crilo-auth-ready',{detail:{user:Crilo.user,profile:Crilo.profile}}));
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
  loadIdentity();
})();
