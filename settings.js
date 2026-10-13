(() => {const $=id=>document.getElementById(id);let p=null;async function init(){if(!Crilo.user)return;p=Crilo.profile;$('username').value=p?.username||'';$('nameColor').value=p?.name_color||'#17191e';$('soundBtn').textContent=p?.sound_enabled===false?'OFF':'ON';await loadLetterPrize()}async function save(extra={}){if(!Crilo.user)return;const username=$('username').value.trim(),nameColor=$('nameColor').value,theme=extra.theme||p?.theme||localStorage.getItem('crilo_theme')||'light',sound=extra.sound_enabled??p?.sound_enabled??true;const usernameError=Crilo.validateUsername(username);if(usernameError){$('identityStatus').textContent=usernameError;return false}const {error}=await criloDB.rpc('update_crilo_settings',{new_username:username,new_name_color:nameColor,new_theme:theme,new_sound_enabled:sound});if(error){$('identityStatus').textContent=error.message;return false}const oldName=p?.username,oldColor=p?.name_color;p={...p,username,name_color:nameColor,theme,sound_enabled:sound};if(oldName!==username&&letterPrizeReady){letters=[...username].map((_,index)=>letters[index]||nameColor);renderLetterPickers();}if(oldName&&oldName!==username)window.CriloBadgeEvents?.track('display_name_saved');if(oldColor&&oldColor!==nameColor)window.CriloBadgeEvents?.track('name_color_saved');Crilo.profile=p;Crilo.applyTheme(theme);localStorage.setItem('crilo_sound',sound?'on':'off');$('identityStatus').textContent='Saved.';return true}async function savePreference(changes){
 if(!Crilo.user)return;
 // Direct profile UPDATE is intentionally not granted to browser sessions.
 // Reuse the server-owned settings RPC for theme/sound updates as well.
 if(!p){$('identityStatus').textContent='Account still loading. Try again.';return}
 const {error}=await criloDB.rpc('update_crilo_settings',{
  new_username:p.username,
  new_name_color:p.name_color,
  new_theme:changes.theme??p.theme??'light',
  new_sound_enabled:changes.sound_enabled??p.sound_enabled??true
 });
 if(error){$('identityStatus').textContent='Could not save preference: '+error.message;return}
 const previousTheme=p?.theme;p={...p,...changes};Crilo.profile=p;if(changes.theme&&changes.theme!==previousTheme)window.CriloBadgeEvents?.track(changes.theme==='dark'?'dark_mode':'light_mode');
 if(changes.theme)Crilo.applyTheme(changes.theme);
 if(Object.prototype.hasOwnProperty.call(changes,'sound_enabled')){
  localStorage.setItem('crilo_sound',changes.sound_enabled?'on':'off');
  $('soundBtn').textContent=changes.sound_enabled?'ON':'OFF';
 }
 $('identityStatus').textContent='Preference saved.';
}

let letters=[],letterPrizeReady=false;
const validInk=value=>/^#[0-9A-Fa-f]{6}$/.test(String(value||''));
function previewLetters(){
 const preview=$('letterColorsPreview');
 if(!preview||!p)return;
 const name=p.username||'';
 preview.innerHTML=window.CriloNameColors.markup({username:name,name_letter_colors:letters});
}
function renderLetterPickers(){
 const host=$('letterColorsGrid');host.replaceChildren();
 if(!p)return;
 const username=p.username||'';
 [...username].forEach((letter,index)=>{
  const item=document.createElement('label');item.className='secret-letter-item';
  const symbol=document.createElement('span');symbol.textContent=letter;
  const picker=document.createElement('input');picker.type='color';
  picker.value=letters[index]||p.name_color||'#17191e';
  picker.setAttribute('aria-label','Color for letter '+(index+1)+': '+letter);
  picker.addEventListener('input',()=>{letters[index]=picker.value.toUpperCase();previewLetters();$('letterColorsStatus').textContent='Unsaved letter colors.'});
  item.append(symbol,picker);host.append(item);
 });
 previewLetters();
}
async function loadLetterPrize(){
 const card=$('letterColors');if(!card||!p||!Crilo.user)return;
 const currentUser=Crilo.user.id;
 const {data,error}=await criloDB.rpc('crilo_secret_wheel_status');
 if(currentUser!==Crilo.user?.id||!p)return;
 letterPrizeReady=!error&&data?.won===true;
 card.classList.toggle('hidden',!letterPrizeReady);
 if(!letterPrizeReady)return;
 letters=window.CriloNameColors.valid(p)?[...p.name_letter_colors]:
  [...(p.username||'')].map(()=>validInk(p.name_color)?p.name_color:'#17191e');
 renderLetterPickers();
}
$('letterColorsSave')?.addEventListener('click',async()=>{
 if(!letterPrizeReady||!Crilo.user||!p)return;
 if($('username').value.trim()!==p.username){
  $('letterColorsStatus').textContent='Save your new display name first, then choose its letter colors.';return;
 }
 const btn=$('letterColorsSave');btn.disabled=true;$('letterColorsStatus').textContent='Saving your colors…';
 try{
  const {data,error}=await criloDB.rpc('crilo_secret_wheel_set_name_colors',{p_colors:letters});
  if(error)throw error;
  if(!data||data.username!==p.username||!Array.isArray(data.name_letter_colors))
   throw new Error('The server could not confirm the new colors.');
  p={...p,name_letter_colors:data.name_letter_colors};
  Crilo.profile={...Crilo.profile,name_letter_colors:data.name_letter_colors};
  letters=[...data.name_letter_colors];renderLetterPickers();
  $('letterColorsStatus').textContent='Each letter color has been saved!';
  window.CriloNameColors.paint($('accountBtn'),Crilo.profile);
 }catch(error){$('letterColorsStatus').textContent='Could not save: '+(error?.message||'Try again.')}
 finally{btn.disabled=false}
});
$('letterColorsReset')?.addEventListener('click',()=>{
 if(!p||!letterPrizeReady)return;
 letters=[...(p.username||'')].map(()=>validInk(p.name_color)?p.name_color:'#17191e');
 renderLetterPickers();$('letterColorsStatus').textContent='Colors reset in preview. Press Save letter colors to keep them.';
});

$('saveIdentity').onclick=()=>save();
$('lightBtn').onclick=()=>savePreference({theme:'light'});
$('darkBtn').onclick=()=>savePreference({theme:'dark'});
$('soundBtn').onclick=()=>savePreference({sound_enabled:!(p?.sound_enabled??true)});
$('signOutBtn').onclick=async()=>{
 const btn=$('signOutBtn');btn.disabled=true;
 try{await Crilo.signOut()}
 catch(error){
  console.error('Crilo Settings sign-out failed:',error);
  $('identityStatus').textContent='Could not sign out: '+(error?.message||'Please try again.');
  btn.disabled=false;
 }
};$('deleteBtn').onclick=async()=>{
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
};window.addEventListener('crilo-auth-ready',init);if(Crilo.user)init();})();
