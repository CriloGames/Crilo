/* Crilo bonus Dailies — account-only continuation below official results.
 * Server-verified Bonus scores compete for each player's best Daily leaderboard
 * entry and lifetime statistics; only Official Dailies award gameplay badges. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('criloBonusPanel'),summary=$('criloBonusSummary'),
  lead=$('criloBonusLead'),remaining=$('criloBonusRemaining'),
  primary=$('criloBonusPrimary'),list=$('criloBonusList'),
  progress=$('criloBonusProgress'),track=$('criloBonusTrack'),
  trackFill=$('criloBonusTrackFill'),runsCount=$('criloBonusRunsCount'),
  details=$('criloBonusDetails'),status=$('criloBonusStatus');
 if(![panel,summary,lead,remaining,primary,list,progress,track,trackFill,runsCount,details,status].every(Boolean))return;
 let snapshot=null,serial=0,starting=false,active=false,pendingFocus=false,focusTimer=null;
 let tierToast=null,tierTimer=null,queuedTier=0,celebrationAccount='';
 const tierSeenThisSession=new Map();
 const TIER_SEEN_PREFIX='crilo-bonus-milestone-seen-v1:';
 const loggedIn=()=>Boolean(window.Crilo?.user?.id&&window.Crilo?.profile?.id);
 const prefersLessMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const mysteryOpen=()=>!$('criloMysteryModal')?.classList.contains('hidden');
 const period=()=>snapshot?.period||'';
 const fmt=n=>Math.max(0,Number(n)||0).toLocaleString();
 function focusWhenReady(){
  pendingFocus=false;
  if(!loggedIn()||!snapshot?.official_done||active||panel.classList.contains('hidden'))return;
  if(mysteryOpen()){pendingFocus=true;return}
  panel.scrollIntoView?.({behavior:prefersLessMotion()?'auto':'smooth',block:'start'});
 }
 function requestFocus(){
  if(focusTimer!==null)clearTimeout(focusTimer);
  focusTimer=setTimeout(()=>{focusTimer=null;focusWhenReady()},350);
 }
 function element(tag,classes,text){
  const node=document.createElement(tag);
  if(classes)node.className=classes;
  if(text!==undefined)node.textContent=text;
  return node;
 }
 // This is a quiet, non-modal celebration of the 50/100/150/200 badge
 // milestones. The Supabase bonus status is authoritative: never grant
 // a run, infer one from a test run, or replay old milestones on sign-in.
 function seenTier(userId){
  let seen=tierSeenThisSession.get(userId)??null;
  try{
   const raw=localStorage.getItem(TIER_SEEN_PREFIX+userId);
   const saved=raw===null?null:Number(raw);
   if(saved!==null&&Number.isInteger(saved)&&saved>=0&&saved<=4)
    seen=Math.max(seen??0,saved);
  }catch(_){}
  return seen;
 }
 function rememberTier(userId,level){
  tierSeenThisSession.set(userId,level);
  try{localStorage.setItem(TIER_SEEN_PREFIX+userId,String(level))}catch(_){}
 }
 function clearTierToast(){
  if(tierTimer!==null){clearTimeout(tierTimer);tierTimer=null}
  if(tierToast){tierToast.remove();tierToast=null}
 }
 function showTierToast(tier){
  if(mysteryOpen()){queuedTier=Math.max(queuedTier,tier);return}
  clearTierToast();
  const toast=element('div','crilo-bonus-tier-toast');
  toast.id='criloBonusTierToast';
  toast.setAttribute('role','status');
  toast.setAttribute('aria-live','polite');
  toast.setAttribute('aria-atomic','true');
  const confetti=element('div','crilo-bonus-tier-confetti');
  confetti.setAttribute('aria-hidden','true');
  if(!prefersLessMotion()){
   for(let i=0;i<18;i++){
    const piece=element('i');
    const angle=i*Math.PI*2/18,radius=86+(i%3)*14;
    piece.style.setProperty('--burst-x',Math.round(Math.cos(angle)*radius)+'px');
    piece.style.setProperty('--burst-y',Math.round(Math.sin(angle)*radius)+'px');
    piece.style.setProperty('--burst-rotation',(i%2?230:-200)+'deg');
    piece.style.setProperty('--burst-delay',(i%5)*28+'ms');
    confetti.append(piece);
   }
  }
  toast.append(confetti,
   element('strong','crilo-bonus-tier-title','Bonus Run '+tier+' unlocked!'),
   element('span','crilo-bonus-tier-message',tier*50+' unique badges · 5 free spins'));
  document.body.append(toast);
  tierToast=toast;
  tierTimer=setTimeout(()=>{toast.remove();if(tierToast===toast)tierToast=null;tierTimer=null},2800);
 }
 function checkTierUnlock(data,options={}){
  const userId=String(window.Crilo?.user?.id||'');
  if(!userId)return;
  if(userId!==celebrationAccount){
   clearTierToast();queuedTier=0;celebrationAccount=userId;
  }
  const unlocked=Math.max(0,Math.min(4,Math.trunc(Number(data?.bonus_unlocked)||0)));
  const prior=Number(options.badgeCountBefore);
  const hasPrior=options.badgeCountBefore!==undefined&&options.badgeCountBefore!==null&&
   Number.isInteger(prior)&&prior>=0;
  const earlier=seenTier(userId);
  // On the first load, old earned tiers become the baseline instead of
  // triggering four belated popups for an established account.
  const baseline=earlier??(hasPrior?Math.min(4,Math.floor(prior/50)):unlocked);
  const current=Math.max(baseline,unlocked);
  rememberTier(userId,current);
  if(unlocked>baseline&&data?.official_done){
   // If several milestones arrive together, celebrate only the newest.
   showTierToast(unlocked);
  }
 }
 function makeButton(slot,primaryButton=false){
  const button=element('button',primaryButton?'crilo-bonus-action':'crilo-bonus-play');
  button.type='button';
  button.disabled=starting||!slot.unlocked||slot.saved||!loggedIn();
  button.textContent=slot.saved?'Completed':!slot.unlocked?'Locked':
   slot.started?'Resume run':'Play now →';
  button.setAttribute('aria-label',
   (slot.started?'Resume':'Play')+' Bonus Daily '+slot.slot);
  button.addEventListener('click',()=>activate(slot.slot));
  return button;
 }
 function render(){
  const visible=loggedIn()&&!!snapshot?.official_done&&!active;
  panel.classList.toggle('hidden',!visible);
  if(!visible)return;
  const count=Math.max(0,Number(snapshot.badge_count)||0);
  const unlocked=Math.max(0,Number(snapshot.bonus_unlocked)||0);
  const runs=Array.isArray(snapshot.runs)?snapshot.runs:[];
  const open=runs.filter(x=>x.unlocked&&!x.saved);
  const completed=runs.filter(x=>x.saved).length;
  const next=open[0]||null;
  summary.textContent=next?'Keep playing':unlocked?'All spun out!':'More runs await';
  lead.textContent=next?'You earned another go at the wheel.':
    unlocked?'You finished your bonus runs for today. Nice spinning.':
    'Collect 50 unique badges to unlock your first free Bonus Run.';
  remaining.replaceChildren();
  const big=element('strong',null,String(Math.max(0,open.length)));
  const small=element('span',null,open.length===1?'BONUS RUN LEFT':'BONUS RUNS LEFT');
  remaining.append(big,small);
  primary.replaceChildren();
  if(next){
   const intro=element('div','crilo-bonus-primary-copy');
   intro.append(element('strong',null,'Bonus run '+next.slot),
    element('span',null,next.started?'Pick up where you left off':'Another 5-spin run, just for you'));
   primary.append(intro,makeButton(next,true));
  }else{
   const copy=element('div','crilo-bonus-primary-copy');
   copy.append(element('strong',null,unlocked?'Finished for today':'First free Bonus Run: 50 badges'),
    element('span',null,unlocked?'Come back for more after the next Daily reset':
      (50-count)+' more unique badges to unlock it'));
   primary.append(copy,element('span','crilo-bonus-done',unlocked?'✓':'✦'));
  }
  const cap=Number(snapshot.next_unlock),maxed=unlocked>=4;
  const threshold=maxed?200:(Number.isFinite(cap)&&cap>0?cap:50);
  const previous=maxed?150:Math.max(0,threshold-50);
  const obtained=maxed?50:Math.max(0,Math.min(50,count-previous));
  const percentage=obtained/50*100;
  progress.textContent=maxed?
   fmt(count)+' unique badges · All free Bonus Runs unlocked':
   fmt(count)+' / '+fmt(threshold)+' unique badges to unlock your next free Bonus Run';
  track.setAttribute('aria-valuenow',String(obtained));
  track.setAttribute('aria-valuetext',maxed?'All free Bonus Runs unlocked':(threshold-count)+' more unique badges to unlock your next free Bonus Run');
  trackFill.style.width=percentage+'%';
  runsCount.textContent=completed+'/'+unlocked+' completed';
  list.replaceChildren();
  for(const slot of runs){
   const row=element('div','crilo-bonus-slot'+(!slot.unlocked?' is-locked':'')+
    (slot.saved?' is-complete':''));
   const copy=element('div','crilo-bonus-slot-copy');
   copy.append(element('strong',null,'Run '+slot.slot));
   copy.append(element('small',null,slot.saved?
    fmt(slot.score)+' points · leaderboard eligible':
    slot.started?'In progress':
    slot.unlocked?'Ready when you are':
    'Unlock at '+(slot.slot*50)+' badges'));
   row.append(copy,makeButton(slot));list.append(row);
  }
 }
 async function refresh(options={}){
  const shouldFocus=options?.focus===true;
  const gen=++serial;
  if(!loggedIn()||typeof criloDB==='undefined'){
   snapshot=null;active=false;pendingFocus=false;queuedTier=0;celebrationAccount='';
   clearTierToast();
   panel.classList.add('hidden');return;
  }
  const {data,error}=await criloDB.rpc('crilo_bonus_status');
  if(gen!==serial)return;
  if(error){
   status.textContent='Bonus runs could not be loaded. Please refresh to retry.';
   console.warn('Bonus Daily status:',error);
   return;
  }
  snapshot=data;
  active=false;
  status.textContent='';
  render();
  checkTierUnlock(data,options);
  if(shouldFocus&&snapshot?.official_done)requestFocus();
 }
 async function activate(number){
  if(starting||active||!loggedIn()||!snapshot?.official_done||!Number.isInteger(number))return;
  const slot=(snapshot.runs||[]).find(x=>x.slot===number);
  if(!slot||!slot.unlocked||slot.saved)return;
  starting=true;render();
  try{
   // Enforced by Supabase RPC: the 50-badge milestone, ownership, one
   // session per slot and a verified, completed official Daily.
   const {data,error}=await criloDB.rpc('crilo_begin_bonus_spin_session',{p_slot:number});
   if(error||!data)throw error||new Error('Bonus run unavailable');
   status.textContent='';
   active=true;pendingFocus=false;panel.classList.add('hidden');
   window.dispatchEvent(new CustomEvent('crilo-bonus-run-start',{detail:{slot:number}}));
  }catch(error){
   status.textContent=error?.message||'Bonus run could not start. Try again.';
   console.warn('Bonus Daily start:',error);
  }finally{
   starting=false;render();
  }
 }
 window.addEventListener('crilo-mystery-closed',()=>{
  if(pendingFocus)requestFocus();
  if(queuedTier){const tier=queuedTier;queuedTier=0;showTierToast(tier)}
 });
 window.addEventListener('crilo-auth-ready',()=>refresh());
 window.CriloBonusRuns={refresh};
 if(window.Crilo?.authResolved)refresh();
})();
