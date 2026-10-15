/* Badge-unlocked bonus Dailies: separate from official scoring and badges. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('criloBonusPanel'),summary=$('criloBonusSummary'),list=$('criloBonusList'),
  progress=$('criloBonusProgress'),status=$('criloBonusStatus');
 if(!panel||!summary||!list||!progress||!status)return;
 let snapshot=null,serial=0,starting=false;
 function render(){
  panel.classList.toggle('hidden',!snapshot?.official_done);
  if(!snapshot?.official_done)return;
  const count=Number(snapshot.badge_count)||0;
  const unlocked=Number(snapshot.bonus_unlocked)||0;
  const total=1+unlocked;
  summary.textContent=total+' Daily '+(total===1?'Run':'Runs')+' available per day';
  progress.textContent=unlocked===4?
   count+' unique badges · All four bonus runs unlocked':
   count+' unique badges · '+Math.max(0,Number(snapshot.next_unlock)-count)+
   ' more until your next bonus run';
  list.replaceChildren();
  for(const slot of snapshot.runs||[]){
   const item=document.createElement('div');item.className='crilo-bonus-slot';
   const title=document.createElement('div');title.className='crilo-bonus-slot-copy';
   const name=document.createElement('strong');name.textContent='Bonus Daily '+slot.slot;
   const sub=document.createElement('small');
   const required=slot.slot*50;
   if(slot.saved)sub.textContent='Completed · '+Number(slot.score||0).toLocaleString()+' points · unranked';
   else if(slot.started&&slot.finished)sub.textContent='Wheel complete · save to finish';
   else if(slot.started)sub.textContent='In progress · continue your verified spins';
   else if(slot.unlocked)sub.textContent='Unlocked at '+required+' unique badges · 5 starting spins';
   else sub.textContent='Unlock at '+required+' unique badges';
   title.append(name,sub);item.appendChild(title);
   const btn=document.createElement('button');
   btn.type='button';btn.className='crilo-bonus-play';
   btn.disabled=starting||!slot.unlocked||slot.saved;
   btn.textContent=slot.saved?'Completed':!slot.unlocked?'Locked':slot.started?'Resume':'Play';
   btn.setAttribute('aria-label',(slot.started?'Resume':'Play')+' Bonus Daily '+slot.slot);
   btn.addEventListener('click',()=>activate(slot.slot));
   item.appendChild(btn);list.appendChild(item);
  }
 }
 async function refresh(){
  const gen=++serial;
  if(!window.Crilo?.user||typeof criloDB==='undefined'){
   snapshot=null;panel.classList.add('hidden');return;
  }
  const {data,error}=await criloDB.rpc('crilo_bonus_status');
  if(gen!==serial)return;
  if(error){
   status.textContent='Bonus runs could not be loaded. Reload to retry.';
   console.warn('Bonus Daily status:',error);
   return;
  }
  snapshot=data;
  status.textContent='';
  render();
 }
 async function activate(number){
  if(starting||!snapshot?.official_done||!Number.isInteger(number))return;
  const slot=(snapshot.runs||[]).find(x=>x.slot===number);
  if(!slot||!slot.unlocked||slot.saved)return;
  starting=true;render();
  try{
   // Server checks milestone, official Daily completion, account ownership and
   // one session per badge slot. Never rely on client badge count for auth.
   const {data,error}=await criloDB.rpc('crilo_begin_bonus_spin_session',{p_slot:number});
   if(error||!data)throw error||new Error('Bonus run unavailable');
   status.textContent='';
   panel.classList.add('hidden');
   window.dispatchEvent(new CustomEvent('crilo-bonus-run-start',{detail:{slot:number}}));
  }catch(error){
   status.textContent=error?.message||'Bonus run could not start. Try again.';
   console.warn('Bonus Daily start:',error);
  }finally{
   starting=false;render();
  }
 }
 window.addEventListener('crilo-auth-ready',refresh);
 window.CriloBonusRuns={refresh};
 if(window.Crilo?.authResolved)refresh();
})();
