/* Crilo Daily Challenges: verified, official-run-only progress and decorative Stars.
 * The server decides eligibility and awards. The browser is display-only. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const host=$('criloChallengePanel');
 if(!host)return;
 const tasks=$('criloChallengeTasks'),count=$('criloChallengeCount'),
  stars=$('criloChallengeStars'),progress=$('criloChallengeMilestone'),
  fill=$('criloChallengeFill'),next=$('criloChallengeNext'),
  stamps=$('criloChallengeStamps'),status=$('criloChallengeStatus');
 let revision=0,lastPeriod=null;
 const fmt=n=>Math.max(0,Number(n)||0).toLocaleString('en-US');
 function row(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
 }
 function showState(snapshot){
  if(!snapshot||!Array.isArray(snapshot.tasks)||snapshot.tasks.length!==3){
   throw new Error('Challenge data is not ready');
  }
  const period=String(snapshot.period||'');
  const complete=Math.min(3,Math.max(0,Number(snapshot.completed)||0));
  const starCount=Math.max(0,Number(snapshot.stars)||0);
  const decoration=Math.min(3,Math.max(0,Number(snapshot.decoration)||0));
  lastPeriod=period;
  host.dataset.decoration=String(decoration);
  count.textContent=complete+' / 3 complete';
  stars.textContent=fmt(starCount)+' Stars';
  tasks.replaceChildren();
  for(const task of snapshot.tasks){
   const done=task.done===true;
   const goal=Math.max(1,Number(task.goal)||1);
   const reached=Math.max(0,Math.min(goal,Number(task.progress)||0));
   const li=row('li','crilo-challenge-task'+(done?' is-complete':''));
   const symbol=row('span','crilo-challenge-check',done?'✓':'○');
   symbol.setAttribute('aria-hidden','true');
   const body=row('div','crilo-challenge-task-body');
   const name=row('strong','crilo-challenge-name',String(task.name||'Daily task'));
   const description=row('small','crilo-challenge-detail',String(task.description||''));
   const bar=row('div','crilo-challenge-task-progress');
   bar.setAttribute('role','progressbar');
   bar.setAttribute('aria-label',String(task.name||'Task')+' progress');
   bar.setAttribute('aria-valuemin','0');
   bar.setAttribute('aria-valuemax',String(goal));
   bar.setAttribute('aria-valuenow',String(reached));
   const inside=row('span','');
   inside.style.width=(reached/goal*100)+'%';
   bar.append(inside);
   body.append(name,description,bar);
   const reward=row('span','crilo-challenge-reward',done?'✓ +1 Star':fmt(reached)+' / '+fmt(goal));
   li.append(symbol,body,reward);
   tasks.append(li);
  }
  const upcoming=snapshot.next_milestone===null?null:Number(snapshot.next_milestone);
  const previous=upcoming===12?0:upcoming===36?12:upcoming===90?36:90;
  const ratio=upcoming?Math.max(0,Math.min(1,(starCount-previous)/(upcoming-previous))):1;
  const label=upcoming?'Next decorative stamp: '+fmt(starCount)+' / '+upcoming+' Stars':
   'All decorative stamps unlocked!';
  progress.textContent=label;
  fill.style.width=Math.round(ratio*100)+'%';
  next.textContent=upcoming?'Earn '+Math.max(0,upcoming-starCount)+' more Stars to unlock a card decoration.':
   'Your challenge card has all three decorations.';
  for(const item of stamps.querySelectorAll('[data-stars-required]')){
   const required=Number(item.dataset.starsRequired);
   const unlocked=starCount>=required;
   item.classList.toggle('is-earned',unlocked);
   item.setAttribute('aria-label',item.dataset.stampName+
    (unlocked?' — unlocked':' — locked until '+required+' Stars'));
   item.title=item.getAttribute('aria-label');
  }
  status.textContent=complete===3?'All three challenges complete! Come back tomorrow for a new set.':
   complete===0?'Complete tasks during your official Daily to collect Stars.':
   complete+' of 3 done. Keep going!';
 }
 async function refresh(){
  const ticket=++revision;
  const account=window.Crilo?.user;
  if(!account){
   host.classList.add('hidden');
   host.hidden=true;lastPeriod=null;return;
  }
  host.hidden=false;host.classList.remove('hidden');
  try{
   if(typeof criloDB==='undefined')return;
   const {data,error}=await criloDB.rpc('crilo_daily_challenges');
   if(ticket!==revision)return;
   if(error)throw error;
   showState(data);
  }catch(error){
   if(ticket!==revision)return;
   console.warn('Daily Challenges temporarily unavailable:',error?.message||error);
   status.textContent='Challenges temporarily unavailable. Refresh the page to retry.';
  }
 }
 window.addEventListener('crilo-auth-ready',refresh);
 window.addEventListener('crilo-official-wheel-stopped',refresh);
 // Final spin may be restored or saved asynchronously; refresh after save.
 window.addEventListener('crilo-official-daily-saved',refresh);
 window.addEventListener('focus',()=>{
  const period=window.Crilo?.dailyPeriod?.();
  if(period&&String(period)!==lastPeriod)void refresh();
 });
 // The reset uses the site's existing 22:00 UTC daily period.
 setInterval(()=>{
  if(!window.Crilo?.user)return;
  const period=window.Crilo?.dailyPeriod?.();
  if(period&&String(period)!==lastPeriod)void refresh();
 },60000);
 window.CriloDailyChallenges={refresh};
 if(window.Crilo?.authResolved)void refresh();
})();
