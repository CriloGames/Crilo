/* Consistent local theme for standalone games and support pages.
   No account data, networking or gameplay changes. */
(()=>{
 try{
  const key='crilo_theme';
  const apply=()=>{document.documentElement.dataset.theme=
   localStorage.getItem(key)==='dark'?'dark':'light'};
  apply();
  window.addEventListener('storage',event=>{if(event.key===key)apply()});
 }catch(_){document.documentElement.dataset.theme='light'}
})();
