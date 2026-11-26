(()=>{'use strict';
const $=id=>document.getElementById(id),E=globalThis.Afterimage,game=$('aiGame'),gate=$('aiGate');
const screens=['aiIntro','aiReady','aiObservePanel','aiQuestion','aiFinish'];
let owner=null,serial=0,session=null,phase='intro',deadline=0,loop=0,index=0,records=[],score=0,best=0;
const show=id=>{for(const s of screens)$(s).hidden=s!==id};
const key=()=> 'crilo_afterimage_room_best_v2:'+owner;
function hud(){$('aiRound').textContent=session?Math.min(index,5)+' / 5':'— / 5';$('aiScore').textContent=score+' / 500';$('aiBest').textContent=best?String(best):'—';$('aiRestart').hidden=!session}
function stop(){cancelAnimationFrame(loop);loop=0;deadline=0}
function screenTop(){window.scrollTo(0,0)}
function deny(message){owner=null;serial++;stop();session=null;game.hidden=true;game.inert=true;gate.hidden=false;gate.textContent=message}
async function verify(){
 const attempt=++serial;
 try{
  if(typeof criloDB==='undefined'||!criloDB?.auth?.getUser)return deny('Sign-in service unavailable. Refresh to try again.');
  const {data,error}=await criloDB.auth.getUser(),uid=data?.user?.id;
  if(attempt!==serial)return;
  if(error||!uid)return deny('Sign in to the Crilo owner account to playtest.');
  const {data:profile,error:readError}=await criloDB.from('profiles').select('id,is_owner').eq('id',uid).maybeSingle();
  if(attempt!==serial)return;
  if(readError||profile?.id!==uid||profile.is_owner!==true)return deny('This playtest is available only to Crilo’s owner account.');
  owner=uid;try{best=Math.max(0,Math.min(500,Number(localStorage.getItem(key()))||0))}catch{}
  game.hidden=false;game.inert=false;gate.hidden=true;show('aiIntro');hud();
  try{$('aiSceneCount').textContent=readHistory().seen.length.toLocaleString()+' unique scenes explored or reserved'}catch{}
  criloDB.auth.onAuthStateChange?.((event,s)=>{if(event==='SIGNED_OUT'||(s?.user?.id&&s.user.id!==owner))deny('Owner access ended. Sign in and refresh.')});
 }catch{if(attempt===serial)deny('Could not verify owner access. Refresh to try again.')}
}
const historyKey=()=> 'crilo_afterimage_scene_history_v3:'+owner;
let generating=false;
function readHistory(){
 const raw=localStorage.getItem(historyKey());
 if(raw===null)return {seen:[],deck:[],lastPlace:null};
 const h=JSON.parse(raw);
 if(!Array.isArray(h.seen)||!Array.isArray(h.deck)||h.seen.some(s=>typeof s!=='string')||h.deck.some(id=>!Number.isInteger(id)||id<0||id>=100))throw Error('Scene history is unreadable');
 return h;
}
function reserve(){
 const lib=globalThis.AfterimageScenes,history=readHistory();
 const seed=crypto.getRandomValues(new Uint32Array(1))[0],next=lib.next(history,seed);
 if(!next)throw Error('Could not find an unseen scene');
 const stored=JSON.stringify(next.history);
 localStorage.setItem(historyKey(),stored);
 if(localStorage.getItem(historyKey())!==stored)throw Error('Could not save scene history');
 return next;
}
async function newGame(){
 if(!owner||generating)return;
 generating=true;const uid=owner;
 try{
  const next=navigator.locks?.request?await navigator.locks.request(historyKey(),()=>reserve()):reserve();
  if(owner!==uid)return;
  stop();session=next.game;index=0;score=0;records=[];$('aiScene').replaceChildren();$('aiReviewScene').replaceChildren();
  phase='ready';$('aiReadyLabel').textContent='NEW SCENE · FIVE QUESTIONS';$('aiReadyTitle').textContent='Ready to look around?';
  $('aiReadyText').textContent='You will have '+session.scan+' seconds to observe a new scene. Then answer five questions with '+session.answer+' seconds each. The timer starts when you reveal it.';
  $('aiSceneCount').textContent=next.history.seen.length.toLocaleString()+' unique scenes explored or reserved';
  $('aiGenerationError').hidden=true;show('aiReady');hud();screenTop();
 }catch(e){
  $('aiGenerationError').textContent='Could not reserve a new scene. Make sure browser storage is available, then try again. Existing history has not been reset.';
  $('aiGenerationError').hidden=false;
 }finally{generating=false}
}
function tick(){
 if(!owner||!['observe','question'].includes(phase))return;
 const ms=Math.max(0,deadline-performance.now()),scan=phase==='observe',clock=$(scan?'aiScanClock':'aiAnswerClock'),bar=$(scan?'aiScanBar':'aiAnswerBar');
 clock.textContent=Math.ceil(ms/1000)+'s';clock.classList.toggle('urgent',ms<=5000);bar.value=ms/1000;
 if(ms<=0){if(scan)beginQuestion();else submit(true);return}loop=requestAnimationFrame(tick);
}
function observe(){
 if(!owner||phase!=='ready')return;
 phase='observe';$('aiScene').innerHTML=E.roomSVG(session.room);show('aiObservePanel');$('aiScanBar').max=session.scan;deadline=performance.now()+session.scan*1000;screenTop();tick();
}
function beginQuestion(){
 stop();$('aiScene').replaceChildren();phase='question';const q=session.questions[index];
 $('aiQuestionLabel').textContent='QUESTION '+(index+1)+' / 5';$('aiPrompt').textContent=q.prompt;$('aiInput').value='';
 $('aiInputHint').textContent='Type your answer, then lock it in.';
 $('aiInput').inputMode=/^\d+$/.test(q.answer)?'numeric':'text';
 const dots=$('aiDots');dots.replaceChildren();for(let i=0;i<5;i++){const dot=document.createElement('i');dot.className=i<index?'done':i===index?'now':'';dots.append(dot)}
 $('aiAnswerBar').max=session.answer;show('aiQuestion');deadline=performance.now()+session.answer*1000;screenTop();
 if(matchMedia('(pointer:fine)').matches)$('aiInput').focus({preventScroll:true});tick();
}
function submit(auto=false,skip=false){
 if(!owner||phase!=='question')return;
 const raw=skip?'':$('aiInput').value,q=session.questions[index];
 stop();phase='transition';const result=E.grade(q,raw);records.push({...result,auto,skipped:skip});score+=result.points;index++;hud();
 if(index<5)beginQuestion();else finish();
}
function finish(){
 stop();phase='finish';const newBest=score>best;if(newBest){best=score;try{localStorage.setItem(key(),String(best))}catch{}}
 $('aiFinalScore').textContent=String(score);$('aiFinalText').textContent=score/100+' of 5 correct.'+(newBest?' New personal best!':'');
 $('aiReviewScene').innerHTML=E.roomSVG(session.room);const list=$('aiBreakdown');list.replaceChildren();
 session.questions.forEach((q,i)=>{const v=records[i],row=document.createElement('article'),p=document.createElement('b'),result=document.createElement('span'),solution=document.createElement('span');
 row.className='ai-review-row';p.textContent=(i+1)+'. '+q.prompt;result.className=v.correct?'ai-result-ok':'ai-result-no';result.textContent=(v.correct?'✓ +100 pts':'✕ 0 pts')+' · Your answer: '+(v.answer||'No answer');solution.textContent='Answer: '+q.answer+'. '+q.why;row.append(p,result,solution);list.append(row)});
 hud();show('aiFinish');screenTop();
}
$('aiStart').onclick=$('aiAgain').onclick=newGame;
$('aiRestart').onclick=()=>{if(phase==='finish'||phase==='ready'||confirm('Abandon this game and generate a new scene?'))newGame()};
$('aiObserve').onclick=observe;
$('aiForm').onsubmit=e=>{e.preventDefault();if(phase!=='question')return;if(performance.now()>=deadline)submit(true);else if($('aiInput').value.trim())submit()};
$('aiSkip').onclick=()=>submit(false,true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&owner&&['observe','question'].includes(phase)&&performance.now()>=deadline){if(phase==='observe')beginQuestion();else submit(true)}});
verify();
})();