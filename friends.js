(() => {const $=id=>document.getElementById(id);let me=null;async function profiles(ids){if(!ids.length)return new Map();const {data}=await criloDB.from('profiles').select('id,username,name_color,account_code').in('id',[...new Set(ids)]);return new Map((data||[]).map(p=>[p.id,p]))}function row(p,actions=''){return `<div class="person-row"><a class="person-name" href="profile.html?id=${encodeURIComponent(p.id)}" style="color:${p.name_color||'inherit'}">${Crilo.esc(p.username)}</a><div class="person-actions">${actions}</div></div>`}
async function load(){me=Crilo.user;if(!me){$('friendsList').textContent='Sign in to use Friends.';$('requestsList').textContent='Sign in to use Friends.';$('copyInviteBtn').disabled=true;$('inviteCode').textContent='—';$('inviteLink').textContent='';openIncomingInvite();return}openIncomingInvite();$('inviteCode').textContent=Crilo.profile?.account_code||'—';$('inviteLink').textContent=Crilo.profile?.account_code?`${location.origin}/friends.html?invite=${encodeURIComponent(Crilo.profile.account_code)}`:'';$('copyInviteBtn').disabled=!Crilo.profile?.account_code;const {data:reqs,error:listError}=await criloDB.from('friend_requests').select('id,sender_id,receiver_id,status,created_at').or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`);if(listError){$('requestsList').textContent='Could not load requests: '+listError.message;return}const ids=(reqs||[]).flatMap(r=>[r.sender_id,r.receiver_id]).filter(id=>id!==me.id),pm=await profiles(ids);const accepted=(reqs||[]).filter(r=>r.status==='accepted'),incoming=(reqs||[]).filter(r=>r.status==='pending'&&r.receiver_id===me.id),outgoing=(reqs||[]).filter(r=>r.status==='pending'&&r.sender_id===me.id);$('friendsList').innerHTML=accepted.length?accepted.map(r=>{const id=r.sender_id===me.id?r.receiver_id:r.sender_id,p=pm.get(id);return p?row(p,`<button class="tiny-btn remove" data-id="${id}">Remove</button>`):''}).join(''):'<span class="muted">No friends yet.</span>';$('requestsList').innerHTML=[...incoming.map(r=>{const p=pm.get(r.sender_id);return p?row(p,`<button class="tiny-btn accept" data-id="${r.id}">Accept</button><button class="tiny-btn decline" data-id="${r.id}">Decline</button>`):''}),...outgoing.map(r=>{const p=pm.get(r.receiver_id);return p?row(p,'<span class="muted">Pending</span>'):''})].join('')||'<span class="muted">No requests.</span>';bindActions()}

const inviteCode=new URLSearchParams(location.search).get('invite');
const incomingInvite=inviteCode&&/^[a-z0-9_-]{5,24}$/i.test(inviteCode)?inviteCode:null;
let inviteHandledFor=null;
const inviteNotice=$('invitationNotice');
const copyStatus=$('inviteCopyStatus');
$('copyInviteBtn').addEventListener('click',async()=>{
 const url=$('inviteLink').textContent.trim();
 if(!url){copyStatus.textContent='Sign in to create an invitation link.';return;}
 try{
  if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(url);
   copyStatus.textContent='Copied!';
  }else{
   const temporary=document.createElement('input');
   temporary.value=url;temporary.setAttribute('readonly','');
   temporary.style.position='fixed';temporary.style.left='-9999px';
   document.body.appendChild(temporary);temporary.select();
   const copied=document.execCommand?.('copy');
   temporary.remove();
   copyStatus.textContent=copied?'Copied!':'Select the link below to copy it.';
  }
 }catch(error){copyStatus.textContent='Select the invite link below to copy it.';}
});
async function openIncomingInvite(){
 if(!incomingInvite||!inviteNotice)return;
 if(!me){
  inviteNotice.textContent='You have been invited to connect on Crilo. Sign in above to see who sent the invitation.';
  return;
 }
 if(inviteHandledFor===me.id)return;
 inviteHandledFor=me.id;
 inviteNotice.textContent='Looking up your invitation…';
 try{
  const {data,error}=await criloDB.rpc('get_crilo_player_by_code',{code:incomingInvite});
  if(error)throw error;
  const sender=Array.isArray(data)?data[0]:data;
  if(!sender){
   inviteNotice.textContent='This invitation is invalid or belongs to your own account.';
   return;
  }
  inviteNotice.replaceChildren();
  const card=document.createElement('div');card.className='friend-card';
  const label=document.createElement('p');label.className='muted';
  label.textContent='INVITATION FROM';
  const person=document.createElement('a');
  person.href='profile.html?id='+encodeURIComponent(sender.id);
  person.textContent=sender.username||'Crilo player';
  person.className='person-name';
  const add=document.createElement('button');add.type='button';
  add.className='primary';add.textContent='Send friend request';
  const feedback=document.createElement('p');feedback.className='muted';
  feedback.setAttribute('role','status');
  add.addEventListener('click',async()=>{
   if(add.disabled)return;
   add.disabled=true;
   feedback.textContent='Sending request…';
   const {error}=await criloDB.rpc('send_friend_request',{target_user:sender.id});
   if(error){feedback.textContent='Could not send request: '+error.message;add.disabled=false;}
   else{
    feedback.textContent='Friend request sent!';
    add.textContent='Request sent';
    window.dispatchEvent(new Event('crilo-friends-changed'));
    load();
   }
  });
  card.append(label,person,add,feedback);
  inviteNotice.appendChild(card);
 }catch(error){
  inviteNotice.textContent='Could not open invitation: '+(error?.message||'Please try again.');
  inviteHandledFor=null;
 }
}
function bindActions(){document.querySelectorAll('.accept').forEach(b=>b.onclick=async()=>{const {error}=await criloDB.rpc('accept_friend_request',{request_id:b.dataset.id});if(error){alert('Could not accept friend request: '+error.message);console.error(error)}else window.dispatchEvent(new Event('crilo-friends-changed'));await load()});document.querySelectorAll('.decline').forEach(b=>b.onclick=async()=>{const {error}=await criloDB.rpc('decline_friend_request',{request_id:b.dataset.id});if(error)alert('Could not decline request: '+error.message);else window.dispatchEvent(new Event('crilo-friends-changed'));await load()});document.querySelectorAll('.remove').forEach(b=>b.onclick=async()=>{if(confirm('Remove this friend?')){await criloDB.rpc('remove_crilo_friend',{friend_user:b.dataset.id});load()}})}
async function search(){if(!me)return;const q=$('friendSearch').value.trim();if(!q)return;const {data,error}=await criloDB.rpc('search_crilo_players',{search_text:q});if(error){$('searchResults').innerHTML=`<p class="muted">${Crilo.esc(error.message)}</p>`;return}$('searchResults').innerHTML=`<section class="friend-card" style="margin-bottom:18px"><h2>Search results</h2>${(data||[]).length?(data||[]).map(p=>row(p,`<button class="tiny-btn add" data-id="${p.id}">Add friend</button>`)).join(''):'<span class="muted">No players found.</span>'}</section>`;document.querySelectorAll('.add').forEach(b=>b.onclick=async()=>{const {error}=await criloDB.rpc('send_friend_request',{target_user:b.dataset.id});b.textContent=error?'Could not send':'Sent!';b.disabled=true})}
$('searchBtn').onclick=search;$('friendSearch').addEventListener('keydown',e=>{if(e.key==='Enter')search()});window.addEventListener('crilo-auth-ready',load)})();
