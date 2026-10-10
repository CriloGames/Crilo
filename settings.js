(() => {const $=id=>document.getElementById(id);let p=null;async function init(){if(!Crilo.user)return;p=Crilo.profile;$('username').value=p?.username||'';$('nameColor').value=p?.name_color||'#17191e';$('soundBtn').textContent=p?.sound_enabled===false?'OFF':'ON'}async function save(extra={}){if(!Crilo.user)return;const username=$('username').value.trim(),nameColor=$('nameColor').value,theme=extra.theme||p?.theme||localStorage.getItem('crilo_theme')||'light',sound=extra.sound_enabled??p?.sound_enabled??true;const usernameError=Crilo.validateUsername(username);if(usernameError){$('identityStatus').textContent=usernameError;return false}const {error}=await criloDB.rpc('update_crilo_settings',{new_username:username,new_name_color:nameColor,new_theme:theme,new_sound_enabled:sound});if(error){$('identityStatus').textContent=error.message;return false}const oldName=p?.username,oldColor=p?.name_color;p={...p,username,name_color:nameColor,theme,sound_enabled:sound};if(oldName&&oldName!==username)window.CriloBadgeEvents?.track('display_name_saved');if(oldColor&&oldColor!==nameColor)window.CriloBadgeEvents?.track('name_color_saved');Crilo.profile=p;Crilo.applyTheme(theme);localStorage.setItem('crilo_sound',sound?'on':'off');$('identityStatus').textContent='Saved.';return true}async function savePreference(changes){
 if(!Crilo.user)return;
 const {error}=await criloDB.from('profiles').update(changes).eq('id',Crilo.user.id);
 if(error){$('identityStatus').textContent='Could not save preference: '+error.message;return}
 const previousTheme=p?.theme;p={...p,...changes};Crilo.profile=p;if(changes.theme&&changes.theme!==previousTheme)window.CriloBadgeEvents?.track(changes.theme==='dark'?'dark_mode':'light_mode');
 if(changes.theme)Crilo.applyTheme(changes.theme);
 if(Object.prototype.hasOwnProperty.call(changes,'sound_enabled')){
  localStorage.setItem('crilo_sound',changes.sound_enabled?'on':'off');
  $('soundBtn').textContent=changes.sound_enabled?'ON':'OFF';
 }
 $('identityStatus').textContent='Preference saved.';
}
$('saveIdentity').onclick=()=>save();
$('lightBtn').onclick=()=>savePreference({theme:'light'});
$('darkBtn').onclick=()=>savePreference({theme:'dark'});
$('soundBtn').onclick=()=>savePreference({sound_enabled:!(p?.sound_enabled??true)});
$('signOutBtn').onclick=async()=>{await criloDB.auth.signOut();location.href='index.html'};$('deleteBtn').onclick=async()=>{
 if(!Crilo.user){$('deleteStatus').textContent='Please sign in first.';return}
 const confirmation=prompt('Permanently delete your Crilo account, scores, badges, ducks, and friends? This cannot be undone. Type DELETE to confirm:');
 if(confirmation===null)return;
 if(confirmation!=='DELETE'){$('deleteStatus').textContent='Account not deleted. Type DELETE exactly to confirm.';return}
 if(!confirm('Final confirmation: permanently delete your Crilo account and all associated player data?'))return;
 const btn=$('deleteBtn');btn.disabled=true;$('deleteStatus').textContent='Deleting your account…';
 try{
  const {data,error}=await criloDB.functions.invoke('delete-my-account',{body:{confirmation:'DELETE'}});
  if(error||!data?.deleted)throw new Error(data?.error||error?.message||'Deletion failed');
  try{await criloDB.auth.signOut({scope:'local'})}catch(_){}
  location.replace('index.html?account_deleted=1');
 }catch(e){$('deleteStatus').textContent='Account was not deleted: '+(e?.message||'Please try again.');btn.disabled=false}
};window.addEventListener('crilo-auth-ready',init)})();
