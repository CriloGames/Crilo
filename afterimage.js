(()=>{'use strict';
const $=id=>document.getElementById(id),E=globalThis.Afterimage,game=$('aiGame'),gate=$('aiGate');
const screens=['aiIntro','aiReady','aiObservePanel','aiQuestion','aiReview','aiFinish'];let owner=null,serial=0,session=null,roundIndex=0,questionIndex=0,phase='intro',deadline=0,loop=0,records=[],score=0,best=0;
const show=id=>{for(const s of screens)$(s).hidden=s!==id};
const key=()=> 'crilo_afterimage_best_v1:'+owner;
const integer=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const fmt=n=>n.toLocaleString('en-US');
function hud(){$('aiRound').textContent=session?(roundIndex+1)+' / 3':'— / 3';$('aiScore').textContent=fmt(score)+' / 1,500';$('aiBest').textContent=best?fmt(best):'—';$('aiRestart').hidden=!session}
function stop(){cancelAnimationFrame(loop);loop=0;deadline=0}
function screenTop(){if(window.scrollY>100)window.scrollTo({top:0,behavior:'instant'})}
function scene(container,round,highlight=[]){
 const grid=document.createElement('div');grid.className='ai-board';grid.setAttribute('aria-label','Four columns and three rows of objects');
 for(const [i,t] of round.board.entries()){
  const tile=document.createElement('div');tile.className='ai-tile'+(highlight.includes(i)?' highlight':'');
  tile.setAttribute('aria-label',t.name+', '+t.color+', '+t.mark+', tag '+t.tag+', row '+(t.row+1)+', column '+(t.col+1));
  const tag=document.createElement('span');tag.className='ai-tag';tag.textContent=t.tag;
  const ns='http://www.w3.org/2000/svg',mark=document.createElementNS(ns,'svg');mark.classList.add('ai-mark');mark.setAttribute('viewBox','0 0 16 16');mark.setAttribute('aria-hidden','true');
  const shape=document.createElementNS(ns,'path');shape.setAttribute('d',{circle:'M8 1a7 7 0 1 0 0 14a7 7 0 1 0 0-14',triangle:'M8 1L15 14H1Z',square:'M2 2H14V14H2Z',diamond:'M8 1L15 8L8 15L1 8Z'}[t.mark]);shape.setAttribute('fill','#334c40');mark.append(shape);
  const svg=document.createElementNS(ns,'svg');svg.classList.add('ai-object');svg.setAttribute('viewBox','0 0 36 36');svg.setAttribute('aria-hidden','true');
  const p=document.createElementNS(ns,'path');p.setAttribute('d',t.path);p.setAttribute('fill',t.hex);p.setAttribute('fill-opacity','.22');p.setAttribute('stroke',t.hex);p.setAttribute('stroke-width','2');p.setAttribute('stroke-linejoin','round');p.setAttribute('stroke-linecap','round');svg.append(p);
  const name=document.createElement('span');name.className='ai-object-name';name.textContent=t.name;const color=document.createElement('span');color.className='ai-color';color.textContent=t.color;
  tile.append(tag,mark,svg,name,color);grid.append(tile);
 }container.replaceChildren(grid);
}
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
  owner=uid;try{best=Math.max(0,Math.min(1500,Number(localStorage.getItem(key()))||0))}catch{}
  game.hidden=false;game.inert=false;gate.hidden=true;show('aiIntro');hud();
  criloDB.auth.onAuthStateChange?.((event,s)=>{if(event==='SIGNED_OUT'||(s?.user?.id&&s.user.id!==owner))deny('Owner access ended. Sign in and refresh.')});
 }catch{if(attempt===serial)deny('Could not verify owner access. Refresh to try again.')}
}
function newGame(){
 if(!owner)return;
 const old=session?.seed;let seed=integer();while(seed===old)seed=integer();
 stop();session=E.generate(seed);roundIndex=0;questionIndex=0;score=0;records=session.rounds.map(()=>[]);$('aiAllReviews').hidden=true;$('aiAllReviews').replaceChildren();ready();
}
function ready(){
 stop();phase='ready';questionIndex=0;const r=session.rounds[roundIndex];
 $('aiReadyLabel').textContent='CASE '+(roundIndex+1)+' / 3 · '+['OBSERVATION','ASSOCIATION','PRECISION'][roundIndex];
 $('aiReadyTitle').textContent=['The first impression','Look beyond the obvious','The final case'][roundIndex];
 $('aiReadyText').textContent=r.scan+' seconds to study twelve objects. Then answer five questions, '+r.answer+' seconds each. The clock starts when you reveal the case.';
 show('aiReady');hud();screenTop();
}
function tick(){if(!owner||!['observe','question'].includes(phase))return;const ms=Math.max(0,deadline-performance.now()),sec=Math.ceil(ms/1000),scan=phase==='observe',clock=$(scan?'aiScanClock':'aiAnswerClock'),bar=$(scan?'aiScanBar':'aiAnswerBar');
 clock.textContent=sec+'s';clock.classList.toggle('urgent',ms<=5000);bar.value=ms/1000;
 if(ms<=0){if(scan)beginQuestion();else submit(true);return}
 loop=requestAnimationFrame(tick)}
function observe(){
 if(!owner||phase!=='ready')return;const r=session.rounds[roundIndex];phase='observe';scene($('aiScene'),r);show('aiObservePanel');$('aiScanBar').max=r.scan;deadline=performance.now()+r.scan*1000;screenTop();tick();
}
function beginQuestion(){
 stop();$('aiScene').replaceChildren();phase='question';const r=session.rounds[roundIndex],q=r.questions[questionIndex];
 $('aiQuestionLabel').textContent='CASE '+(roundIndex+1)+' · QUESTION '+(questionIndex+1)+' / 5';$('aiPrompt').textContent=q.prompt;$('aiInput').value='';
 $('aiInputHint').textContent=/^\d+$/.test(q.answer)?'Enter a number.':'Enter the object, color or symbol requested.';
 const dots=$('aiDots');dots.replaceChildren();for(let i=0;i<5;i++){const dot=document.createElement('i');dot.className=i<questionIndex?'done':i===questionIndex?'now':'';dots.append(dot)}
 $('aiAnswerBar').max=r.answer;show('aiQuestion');deadline=performance.now()+r.answer*1000;screenTop();
 // Focus on desktop; on touch avoid opening the keyboard without a gesture.
 if(matchMedia('(pointer:fine)').matches)$('aiInput').focus({preventScroll:true});tick();
}
function submit(auto=false,skip=false){
 if(!owner||phase!=='question')return;
 // At the deadline, lock the text already in the field. No extra time is awarded.
 const raw=skip?'':$('aiInput').value,q=session.rounds[roundIndex].questions[questionIndex];
 stop();phase='transition';const result=E.grade(q,raw);records[roundIndex].push({...result,auto,skipped:skip});score+=result.points;hud();questionIndex++;
 if(questionIndex<5)beginQuestion();else review();
}
function answers(container,r,results){
 container.replaceChildren();
 r.questions.forEach((q,i)=>{const v=results[i],row=document.createElement('article');row.className='ai-review-row';const p=document.createElement('b');p.textContent=(i+1)+'. '+q.prompt;
 const result=document.createElement('span');result.className=v.correct?'ai-result-ok':'ai-result-no';result.textContent=(v.correct?'✓ +100 pts':'✕ 0 pts')+' · Your answer: '+(v.answer||'No answer');
 const solution=document.createElement('span');solution.textContent='Answer: '+q.answer+' · '+q.why;
 row.append(p,result,solution);container.append(row)})
}
function review(){stop();phase='review';const r=session.rounds[roundIndex],results=records[roundIndex],n=results.filter(x=>x.correct).length;
 $('aiReviewLabel').textContent='CASE '+(roundIndex+1)+' / 3 · REVIEW';$('aiRoundResult').textContent=n+' / 5';$('aiReviewTitle').textContent=n===5?'Perfect observation.':n>=3?'A good eye.':'What slipped away?';
 scene($('aiReviewScene'),r);answers($('aiReviewAnswers'),r,results);$('aiNext').textContent=roundIndex===2?'See final score ↗':'Next case ↗';show('aiReview');screenTop()}
function finish(){stop();phase='finish';const n=score/100;$('aiFinalScore').textContent=fmt(score);const newBest=score>best; if(newBest){best=score;try{localStorage.setItem(key(),String(best))}catch{}}
 $('aiFinalText').textContent=n+' of 15 answers correct.'+(newBest?' New personal best!':' Try a different random case to improve.');hud();
 const breakdown=$('aiBreakdown');breakdown.replaceChildren();records.forEach((rs,i)=>{const row=document.createElement('div');row.className='ai-review-row';const b=document.createElement('b');b.textContent='Case '+(i+1)+' · '+rs.filter(x=>x.correct).length+'/5 correct';row.append(b);breakdown.append(row)});show('aiFinish');screenTop()}
$('aiStart').onclick=$('aiAgain').onclick=newGame;
$('aiRestart').onclick=()=>{if(phase==='finish'||phase==='ready'||phase==='review'||confirm('Abandon this game and generate a new case?'))newGame()};
$('aiObserve').onclick=observe;$('aiForm').onsubmit=e=>{e.preventDefault();if(performance.now()>=deadline)submit(true);else if($('aiInput').value.trim())submit()};
$('aiSkip').onclick=()=>submit(false,true);
$('aiNext').onclick=()=>{if(phase!=='review')return;if(roundIndex===2)finish();else{roundIndex++;ready()}};
$('aiShowReview').onclick=()=>{const el=$('aiAllReviews');if(!el.hidden){el.hidden=true;return}el.replaceChildren();session.rounds.forEach((r,i)=>{const sec=document.createElement('section'),h=document.createElement('h3'),board=document.createElement('div'),list=document.createElement('div');h.textContent='Case '+(i+1);list.className='ai-review-list';scene(board,r);answers(list,r,records[i]);sec.append(h,board,list);el.append(sec)});el.hidden=false};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&owner&&['observe','question'].includes(phase)&&performance.now()>=deadline){if(phase==='observe')beginQuestion();else submit(true)}});
verify();
})();