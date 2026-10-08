(() => {const $=id=>document.getElementById(id);let p=null;async function init(){if(!Crilo.user)return;p=Crilo.profile;$('username').value=p?.username||'';$('nameColor').value=p?.name_color||'#17191e';$('soundBtn').textContent=p?.sound_enabled===false?'OFF':'ON'}async function save(extra={}){if(!Crilo.user)return;const username=$('username').value.trim(),nameColor=$('nameColor').value,theme=extra.theme||p?.theme||localStorage.getItem('crilo_theme')||'light',sound=extra.sound_enabled??p?.sound_enabled??true;const usernameError=Crilo.validateUsername(username);if(usernameError){$('identityStatus').textContent=usernameError;return false}const {error}=await criloDB.rpc('update_crilo_settings',{new_username:username,new_name_color:nameColor,new_theme:theme,new_sound_enabled:sound});if(error){$('identityStatus').textContent=error.message;return false}p={...p,username,name_color:nameColor,theme,sound_enabled:sound};Crilo.profile=p;Crilo.applyTheme(theme);localStorage.setItem('crilo_sound',sound?'on':'off');$('identityStatus').textContent='Saved.';return true}async function savePreference(changes){
 if(!Crilo.user)return;
 const {error}=await criloDB.from('profiles').update(changes).eq('id',Crilo.user.id);
 if(error){$('identityStatus').textContent='Could not save preference: '+error.message;return}
 p={...p,...changes};Crilo.profile=p;
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
$('signOutBtn').onclick=async()=>{await criloDB.auth.signOut();location.href='index.html'};$('deleteBtn').onclick=async()=>{if(!Crilo.user)return;if(!confirm('Request deletion of your Crilo account?'))return;const {error}=await criloDB.from('account_deletion_requests').upsert({user_id:Crilo.user.id});$('deleteStatus').textContent=error?error.message:'Deletion request submitted. Your account has not been deleted yet.'};window.addEventListener('crilo-auth-ready',init)})();
