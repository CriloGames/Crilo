/* CRILO — PONG TOSS
 * Original fifty-stage 3D tabletop skill game. Pure browser-local progress.
 * Five chapters: foundations, moving cups, wind, blockers, bounce pads.
 * No Daily, leaderboard, account, badge or Supabase game writes.
 */
(async()=>{
'use strict';
const $=id=>document.getElementById(id);
const el={
 canvas:$('ptCanvas'),viewport:$('ptViewport'),overlay:$('ptOverlay'),
 overlayTag:$('ptOverlayTag'),overlayTitle:$('ptOverlayTitle'),
 overlayText:$('ptOverlayText'),primary:$('ptPrimary'),secondary:$('ptSecondary'),
 title:$('ptStageTitle'),counter:$('ptLevelNumber'),chapter:$('ptChapter'),
 attempts:$('ptAttempts'),bounces:$('ptBounces'),total:$('ptTotalStars'),status:$('ptStatus'),
 power:$('ptPowerFill'),powerValue:$('ptPowerValue'),trajectoryLabel:$('ptTrajectoryLabel'),
 grid:$('ptLevelGrid'),chapters:$('ptChapters'),chapterDescription:$('ptChapterDescription'),
 prev:$('ptPrev'),next:$('ptNext'),retry:$('ptRetry'),pause:$('ptPause'),
 sound:$('ptSound'),full:$('ptFullscreen'),wind:$('ptWind'),windLabel:$('ptWindLabel'),
 aim:$('ptAimText'),tutorial:$('ptTutorial'),best:$('ptBest'),toast:$('ptToast'),objective:$('ptShotObjective'),difficulty:$('ptDifficulty')
};
if(Object.values(el).some(v=>!v))return;
let THREE,renderer,scene,camera,group,ballMesh,ballShadow,ballTrailMeshes=[],launcher,cupGroup,cupFloor,trajectoryGroup,throwingHand,throwMoment=-10000;
let aimLine=[],ringMat,particleGroup,obstacles=[],pads=[],hoops=[],wallPad=null,airZone=null,fanFields=[],physicsBodies=[],physicsGrid=new Map(),physicsGlobal=[],physicsMoving=[],specialSurfaces=[],impactRing=null,impactAge=2,cupLid=null,lidOpen=null,targetLift=null,target={x:0,z:-2.5,y:0,top:1,r:.64,kind:0},ambient=[];
const STORE='crilo_pong_toss_50_v1',MUTED='crilo_pong_toss_sound_v1';
const TWO_PI=Math.PI*2,GRAVITY=10.65,LAUNCH_Z=4.25,LAUNCH_Y=1.32,BALL_R=.095;
const CHAPTERS=[
 {name:'FIRST WEEK',desc:'Learn accuracy, moving cups, a bank, crosswind and your first shutter, all before level 10.',from:1,to:10,color:0x6ccab5,short:'First Week'},
 {name:'THE DESK SHIFT',desc:'Mix moving cups with spring pads, lifting targets and the first timed lid.',from:11,to:20,color:0xeba1b5,short:'Desk Shift'},
 {name:'CROSS DRAFT',desc:'Varying fan gusts, blind shots, moving openings and combination trick shots.',from:21,to:30,color:0x8ba8e9,short:'Cross Draft'},
 {name:'THE LATE SHIFT',desc:'Sequence moving drawers, shutters, timed lids and precision rebounds.',from:31,to:40,color:0xebbc70,short:'Late Shift'},
 {name:'FINAL TRICK SHOTS',desc:'Spring pads, moving cups and timed lids collide in the final ten challenges.',from:41,to:50,color:0xae8edc,short:'Final Shift'}
];
let level=1,unlocked=1,stars={},best={},attempts=0,score=0,chosenChapter=0;
let playing=false,paused=false,flight=false,charging=false,chargeFrom=0,chargeSource=null,gesture=null;
let aimYaw=0,aimPitch=.70,power=.32,chargeAnchor=.20,lastNow=0,toastUntil=0,toastMessage='';
let effectTimer=0,soundOn=true,hasRenderer=false,shotStart=0,shotT=0,simTime=0,lastAimRefresh=-1000;
let ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:0,vy:0,vz:0,active:false,bounces:0,bankHits:0,springHits:0,wallHits:0,hoopsPassed:0,contacts:0,trail:[]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const fmtLevel=n=>String(n).padStart(2,'0');
const chapterIndex=n=>Math.min(4,Math.floor((n-1)/10));
const chapter=n=>CHAPTERS[chapterIndex(n)];
const seeded=n=>{let x=Math.sin(n*184.193+39.18)*42687.25;return x-Math.floor(x);};
function save(){
 try{localStorage.setItem(STORE,JSON.stringify({unlocked,stars,best,level}));}catch{}
}
try{
 const data=JSON.parse(localStorage.getItem(STORE)||'{}');
 unlocked=clamp(Number(data.unlocked)||1,1,50);
 stars=(data.stars&&typeof data.stars==='object')?data.stars:{};
 best=(data.best&&typeof data.best==='object')?data.best:{};
 level=clamp(Number(data.level)||unlocked,1,unlocked);
 soundOn=localStorage.getItem(MUTED)!=='off';
}catch{}
el.sound.textContent='♫';
el.sound.title=soundOn?'Mute sound':'Unmute sound';el.sound.setAttribute('aria-label',el.sound.title);
el.sound.setAttribute('aria-pressed',String(soundOn));
chosenChapter=chapterIndex(level);
function message(str,time=2.0){toastMessage=str;toastUntil=performance.now()+time*1000;el.toast.textContent=str;el.toast.dataset.tone=/SWISH|CLEARED|PERFECT|BANK|SPRING SHOT|BOUNCE/i.test(str)?'good':'normal';el.toast.hidden=false;}
function hear(freq=520,duration=.10,voice='sine',volume=.04){
 if(!soundOn)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  if(!hear.ctx)hear.ctx=new C();
  if(hear.ctx.state==='suspended')void hear.ctx.resume();
  const t=hear.ctx.currentTime,osc=hear.ctx.createOscillator(),gain=hear.ctx.createGain();
  osc.type=voice;osc.frequency.setValueAtTime(freq,t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.68),t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.013);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(hear.ctx.destination);osc.start(t);osc.stop(t+duration+.01);
 }catch{}
}
// Fifty authored level blueprints. Every entry has its own target furniture,
// room architecture, named set-piece, flight path and obstacles. These are not
// generated by cycling through the same ten layouts.
// Fields: [title,room,station,distance,lateral,platformHeight,radius,cup,
//         shot,movement,wind,heroProp,collidableObstacles,movingBarriers]
const STAGES=[
 ['First Day',0,'desk',4.45,0,.96,.57,0,'direct','still',0,'sticky',[],[]],
 ['The Side Drawer',0,'drawer',4.95,1.27,1.19,.53,1,'direct','still',0,'folders',[['files',.43,-1.20]],[]],
 ['Kitchen Slider',3,'counter',5.30,-1.15,1.02,.55,3,'direct','slide',0,'kettle',[['mugstack',.46,1.25]],[]],
 ['Printer Hoop',2,'printer',5.18,.86,1.28,.49,2,'direct','still',0,'printer',[['printer',.30,-1.02]],[]],
 ['Binder Bank',0,'cabinet',5.72,-.98,1.38,.50,1,'bank','still',0,'binders',[['screen',.31,1.55]],[]],
 ['Window Draft',1,'window',5.85,1.60,1.61,.51,4,'direct','still',.14,'sunblind',[['books',.58,-.91]],[]],
 ['Fan Cart Ricochet',2,'trolley',6.10,-1.77,1.13,.47,2,'bank','still',0,'letters',[['folders',.38,1.60]],[]],
 ['Moving Monitor',4,'desk',6.35,.44,1.26,.48,1,'direct','orbit',0,'dualmonitors',[['monitor',.28,-.86],['monitor',.61,1.10]],[]],
 ['The First Shutter',3,'counter',6.45,-1.17,1.30,.49,3,'direct','still',0,'coffee',[['teapot',.45,1.51]],[['panel',.55,.90,1.38]]],
 ['Archive Bank',5,'archive',6.85,.28,1.57,.47,5,'bank','still',-.13,'archive',[['files',.26,-1.6],['lamp',.76,1.25]],[]],
 ['Reception Wall Bank',6,'trolley',5.42,-1.32,1.06,.46,0,'direct','slide',0,'reception',[['plant',.39,1.20]],[]],
 ['Desk Pop',3,'desk',5.52,.24,1.04,.56,1,'spring','still',0,'coffee',[],[]],
 ['Rolling Bucket',2,'trolley',6.12,-.80,1.17,.45,2,'direct','slide',0,'packages',[['cart',.53,1.27]],[]],
 ['Gusty Trophy',7,'shelf',6.50,1.08,1.42,.46,6,'direct','orbit',.16,'trophies',[['books',.36,-1.05]],[]],
 ['Bank and Slide',1,'drawer',6.78,-1.18,1.37,.43,1,'bank','slide',0,'projector',[['screen',.26,1.70]],[]],
 ['Lifted Lunch',3,'counter',6.92,1.82,1.61,.42,3,'direct','lift',0,'lunch',[['teapot',.38,-1.22]],[]],
 ['Conveyor Gate',8,'cabinet',7.18,-1.36,1.19,.47,5,'direct','depth',0,'conveyor',[['packages',.44,1.45]],[['drawer',.61,.62,1.33]]],
 ['Moving Window Hoop',1,'window',7.25,1.55,1.74,.42,4,'direct','figure8',0,'sunblind',[['partition',.39,-1.07]],[]],
 ['Windy Return',6,'trolley',7.48,-.38,1.35,.44,2,'bank','orbit',.17,'mailbox',[['files',.33,1.60]],[]],
 ['Boardroom Finale',1,'conference',7.82,.85,1.55,.40,6,'direct','figure8',0,'whiteboard',[['lamp',.31,-1.25],['projector',.63,1.32]],[]],
 ['Fan on Low',3,'desk',5.58,.42,1.04,.45,0,'direct','still',.19,'fan',[['plant',.42,-1.22]],[]],
 ['Wallside Draft',0,'window',5.98,-1.45,1.50,.44,1,'direct','slide',-.28,'sunblind',[['folders',.44,1.23]],[]],
 ['Mailroom Gust',2,'trolley',6.28,1.35,1.22,.44,2,'direct','depth',.32,'letters',[['packages',.36,-1.18]],[]],
 ['The Vent',9,'shelf',6.48,-.90,1.78,.42,4,'direct','lift',-.43,'airvent',[['partition',.52,1.24]],[]],
 ['Headwind Bank',5,'cabinet',6.85,.36,1.27,.43,5,'bank','still',.38,'archive',[['screen',.33,1.56]],[]],
 ['Fan Behind Glass',4,'counter',7.12,-1.63,1.44,.41,3,'direct','orbit',-.47,'glass',[['monitor',.36,1.08]],[]],
 ['The Drafty Lift',9,'drawer',7.35,1.26,1.69,.41,1,'direct','lift',.54,'elevator',[['lamp',.34,-1.20]],[]],
 ['Double Reception Rings',6,'conference',7.65,-.66,1.23,.40,6,'direct','figure8',-.60,'reception',[['plant',.39,1.22]],[]],
 ['Wind Bank',8,'trolley',7.95,1.13,1.40,.40,2,'bank','slide',.65,'conveyor',[['cart',.29,-1.68]],[]],
 ['Air Conditioning',9,'shelf',8.30,-1.72,1.83,.39,4,'direct','orbit',-.70,'airvent',[['books',.36,1.08],['screen',.62,-1.18]],[]],
 ['Sliding Cabinet',5,'archive',6.04,.58,1.18,.44,5,'direct','still',.05,'archive',[['folders',.38,-1.10]],[['drawer',.60,0,1.6]]],
 ['Dual Printer',2,'printer',6.44,-1.21,1.33,.43,2,'direct','slide',.04,'printer',[['printer',.33,1.26]],[['panel',.68,.12,1.55]]],
 ['Scanner Gate',8,'counter',6.65,.86,1.28,.42,3,'bank','depth',.09,'scanner',[['partition',.30,1.63]],[['drawer',.75,-.50,1.45]]],
 ['Forklift Files',2,'trolley',6.96,1.59,1.49,.42,2,'direct','orbit',-.13,'forklift',[['cart',.44,-1.20]],[['panel',.61,.43,1.55]]],
 ['Payroll Double Rings',4,'drawer',7.30,-1.69,1.22,.41,1,'direct','figure8',.15,'dualmonitors',[['monitor',.32,1.25]],[['drawer',.66,-.31,1.61]]],
 ['Wallside Shredder',0,'desk',7.53,.71,1.64,.41,0,'direct','lift',-.16,'shredder',[['files',.40,-1.20]],[['panel',.58,.16,1.60]]],
 ['Cafeteria Bar',3,'counter',7.74,-.62,1.35,.40,3,'direct','slide',.20,'coffee',[['teapot',.29,1.36]],[['drawer',.59,-.26,1.53]]],
 ['Window Shutters',1,'window',7.95,1.47,1.80,.40,4,'direct','depth',-.23,'sunblind',[['partition',.38,-1.29]],[['panel',.67,.12,1.75]]],
 ['Moving Bank',6,'trolley',8.16,-1.10,1.50,.39,2,'bank','orbit',.25,'mailbox',[['files',.41,1.60]],[['drawer',.56,-.45,1.59]]],
 ['Overtime Wall Bank',7,'conference',8.38,.55,1.70,.39,6,'direct','figure8',-.27,'trophies',[['projector',.27,-1.20],['plant',.55,1.42]],[['panel',.70,.32,1.67],['drawer',.48,-.72,1.40]]],
 ['First Spring',3,'counter',6.30,-.16,1.22,.43,3,'spring','still',0,'lunch',[['plant',.46,1.20]],[]],
 ['Rubber Return',2,'trolley',6.52,.28,1.41,.42,2,'spring','slide',0,'packages',[['files',.35,-1.16]],[]],
 ['Spring Ladder',5,'shelf',6.93,-1.02,1.68,.41,4,'spring','lift',.09,'archive',[['books',.37,1.25]],[]],
 ['Double Bounce Desk',4,'drawer',7.18,1.21,1.32,.41,1,'spring','depth',-.12,'dualmonitors',[['screen',.33,-1.22]],[]],
 ['Vent and Spring',9,'cabinet',7.52,-1.38,1.59,.40,5,'spring','orbit',.17,'airvent',[['partition',.39,1.34]],[]],
 ['Cafeteria Chaos',3,'counter',7.75,.74,1.42,.40,3,'spring','figure8',-.19,'kettle',[['teapot',.40,-1.20]],[['panel',.67,.30,1.45]]],
 ['Spring Ring Combo',0,'trolley',8.06,-.81,1.58,.40,2,'spring','slide',.22,'folders',[['monitor',.36,1.36]],[['drawer',.70,-.48,1.52]]],
 ['Archive Springs',5,'archive',8.25,1.56,1.65,.45,4,'spring','lift',-.25,'archive',[['files',.28,-1.30]],[['panel',.60,.33,1.57]]],
 ['Around the Fans',9,'printer',8.44,-1.54,1.55,.39,0,'spring','orbit',.27,'fan',[['printer',.40,1.32]],[['drawer',.63,-.55,1.62]]],
 ['Last Day on the Job',7,'conference',8.65,.42,1.90,.38,6,'spring','figure8',-.30,'trophies',[['projector',.30,1.48],['lamp',.49,-1.14]],[['panel',.65,-.20,1.65],['drawer',.83,.52,1.39]]]
];
const SCENE_NAMES=['CUBICLE','BOARDROOM','MAILROOM','BREAK ROOM','NIGHT SHIFT',
 'ARCHIVE','RECEPTION','AWARDS OFFICE','SHIPPING DOCK','SERVER ROOM'];
// A fresh skill or combination every few rounds, not ten rounds apart.
// Extra skill shots throughout the campaign; no auto-steering after bounce.
const SPECIALS={
 4:{hoops:1},7:{fan:{kind:'cross',side:1,power:2}},
 11:{wall:{side:-1}},13:{hoops:1},
 17:{fan:{kind:'cross',side:-1,power:2.7}},
 18:{hoops:1,hoopMove:true},
 22:{wall:{side:-1}},
 23:{hoops:1,fan:{kind:'cross',side:-1,power:2}},
 26:{fan:{kind:'lift',side:1,power:3.8}},
 28:{hoops:2},30:{hoops:1,fan:{kind:'cross',side:1,power:2.1}},
 32:{fan:{kind:'cross',side:1,power:3.4}},
 36:{wall:{side:1}},40:{wall:{side:1}},
 35:{hoops:2,hoopMove:true},
 38:{fan:{kind:'lift',side:-1,power:4.1},hoops:1},
 42:{fan:{kind:'lift',side:1,power:3.1}},
 46:{fan:{kind:'cross',side:1,power:.95}},
 47:{hoops:2,hoopMove:true},
 49:{fan:{kind:'cross',side:-1,power:2.8},hoops:1},
 50:{hoops:2,hoopMove:true}
};
const NEW_TRICKS={
 1:'FIRST THROW',3:'MOVING CUP',4:'THROUGH THE HOOP',5:'RUBBER BANK',6:'DESK-FAN WIND',7:'AIR JET',
 9:'TIMED SHUTTER',11:'WALL RICOCHET',12:'SPRING REBOUND',16:'HINGED CUP LID',
 18:'MOVING HOOP',21:'PULSING GUSTS',22:'WALL RICOCHET',24:'WIND + LIFT',26:'UPDRAFT',28:'DOUBLE HOOP',
 27:'WIND + TIMED LID',31:'MOVING DRAWERS',34:'SHUTTER + LID',35:'DOUBLE MOVING HOOPS',
 37:'DOUBLE TIMING',38:'UPDRAFT + HOOP',41:'SPRING RETURN',45:'SPRING + LID',47:'MOVING RING GAUNTLET',
 48:'TIGHT SPRING PRECISION',49:'SPRING THROUGH THE HOOP',50:'FINAL HOOP GAUNTLET'
};
function stageDifficulty(n,spec){
 // Explicitly communicate escalating complexity without applying artificial
 // RNG penalties. A new mechanic can still begin with a generous target.
 const baseline=1+Math.floor((n-1)/14);
 const hazards=(spec?.hoops>1?1:0)+(spec?.wall?1:0)+
  (spec?.fanZone?1:0)+(spec?.lid?1:0)+(spec?.barrierCount>1?1:0);
 return Math.min(5,baseline+(hazards>=2?1:0));
}
function stageSettings(n){
 const row=STAGES[n-1];if(!row)throw Error('Missing level '+n);
 const [challenge,sceneId,station,d,x,topPad,radius,kind,shot,motion,wind,
  feature,obstaclePlan,barrierPlan]=row;
 const c=chapterIndex(n),tier=(n-1)%10;
 const bankRequired=shot==='bank',springRequired=shot==='spring';
 const motionPower=motion==='still'?0:.29+Math.min(4,c)*.055+(tier%3)*.06;
 const special=SPECIALS[n]||{};
 return {
  n,c,tier,challenge,sceneId,station,d,x,topPad,radius,kind,
  newTrick:NEW_TRICKS[n]||null,
  hoops:special.hoops||0,hoopMove:!!special.hoopMove,
  wall:special.wall||null,fanZone:special.fan||null,
  targetZ:LAUNCH_Z-d,shot,motion,moving:motionPower,wind,
  feature,obstaclePlan,barrierPlan,barrierCount:barrierPlan.length,
  // Every bounce has its own visible, predetermined launch position.
  bankRequired,springRequired,padCount:springRequired?1:0,
  lid:[16,20,27,34,40,45,50].includes(n),
  gust:[21,24,28,33,37,43,46,49].includes(n),
  bankX:x*.41,bankZ:LAUNCH_Z-d*.68,
  springX:0,springZ:LAUNCH_Z-.45-d*.5,
  roomVariant:tier>=5?1:0,
  color:chapter(n).color,targetHeight:[.55,.59,.68,.47,.63,.66,.57][kind]
 };
}
let settings=stageSettings(level);
function buildUi(){
 const completed=Object.values(stars).reduce((a,n)=>a+clamp(Number(n)||0,0,3),0);
 el.total.textContent=String(completed)+' / 150';
 el.counter.textContent=fmtLevel(level)+' / 50';
 el.chapter.textContent='CHAPTER '+(settings.c+1)+' · '+CHAPTERS[settings.c].short.toUpperCase();
 const rooms=SCENE_NAMES;
 el.title.textContent=settings.challenge+' · '+rooms[settings.sceneId];
 const rating=stageDifficulty(level,settings);
 const labels=['','EASY','STANDARD','TRICKY','HARD','EXPERT'];
 el.difficulty.textContent='DIFFICULTY · '+('★'.repeat(rating))+' · '+labels[rating];
 el.difficulty.dataset.rank=String(rating);
 el.chapter.textContent=settings.newTrick?'NEW TRICK · '+settings.newTrick:'SHIFT '+(settings.c+1)+' · '+CHAPTERS[settings.c].short.toUpperCase();
 el.objective.textContent=settings.wall?'WALL BANK → CUP':
  settings.hoops?'PASS '+settings.hoops+' HOOP'+(settings.hoops>1?'S':'')+' → CUP':
  settings.springRequired?'SPRING PAD → CUP':settings.bankRequired?'BANK OFF TRAY → CUP':'DIRECT THROW → CUP';
 el.viewport.dataset.shotMode=settings.springRequired?'spring':settings.bankRequired?'bank':'direct';
 el.viewport.dataset.showTip=settings.newTrick?'yes':'no';
 if(!settings.lid)delete el.viewport.dataset.lidState;
 el.status.textContent=(settings.bankRequired?'BANK SHOT REQUIRED · ':settings.springRequired?'SPRING SHOT REQUIRED · ':'')+
   cupVariant(settings.kind)+' · '+settings.d.toFixed(1)+'m · '+CHAPTERS[settings.c].short.toUpperCase();
 el.attempts.textContent=String(attempts);
 el.best.textContent=best[level]?best[level]+' THROW'+(best[level]===1?'':'S'):'—';
 el.prev.disabled=level<=1;
 el.next.disabled=level>=unlocked||level>=50;
 el.wind.hidden=Math.abs(settings.wind)<.001&&!settings.fanZone;
 el.windLabel.textContent=settings.fanZone?(settings.fanZone.kind==='lift'?'UPDRAFT ↑':'AIR JET '+(settings.fanZone.side>0?'←':'→')):
  settings.wind===0?'NO WIND':(settings.wind>0?'WIND → ':'← WIND ')+Math.abs(settings.wind).toFixed(1);
 el.tutorial.textContent=settings.wall?'RICOCHET FROM THE SIDE WALL BEFORE SCORING':
  settings.hoops?'PASS THROUGH THE RING BEFORE THE CUP':
  settings.fanZone?'AIR JET CHANGES THE FLIGHT PATH':
  settings.lid?'TIME IT · CUP LID OPENS AND CLOSES':
  settings.springRequired?'SPRING → '+settings.challenge.toUpperCase():
  settings.bankRequired?'BANK → '+settings.challenge.toUpperCase():
  settings.motion!=='still'?'TIME YOUR '+settings.motion.toUpperCase()+' TARGET':
  settings.wind?'ALLOW FOR THE FAN · '+settings.challenge.toUpperCase():
  'AIM THROUGH THE OFFICE · '+settings.challenge.toUpperCase();
 buildChapters();
}
function buildChapters(){
 el.chapters.replaceChildren();
 CHAPTERS.forEach((c,i)=>{
  const btn=document.createElement('button');btn.type='button';
  btn.className='pt-chapter'+(i===chosenChapter?' active':'');
  btn.textContent='0'+(i+1)+'  '+c.short;
  btn.disabled=(i*10+1)>unlocked;
  btn.setAttribute('aria-pressed',String(i===chosenChapter));
  btn.addEventListener('click',()=>{chosenChapter=i;buildChapters();});
  el.chapters.append(btn);
 });
 el.chapterDescription.textContent=CHAPTERS[chosenChapter].desc;
 el.grid.replaceChildren();
 for(let i=chosenChapter*10+1;i<=chosenChapter*10+10;i++){
  const button=document.createElement('button');button.type='button';
  button.className='pt-level-btn'+(i===level?' current':'')+(i>unlocked?' locked':'')+(stars[i]?' cleared':'');
  const label=document.createElement('span');label.textContent=fmtLevel(i);
  const recipe=stageSettings(i);
  button.dataset.difficulty=String(stageDifficulty(i,recipe));
  const nameTag=document.createElement('small');nameTag.className='pt-level-name';
  nameTag.textContent=recipe.challenge;
  const star=document.createElement('small');star.className='pt-level-status';
  star.textContent=i>unlocked?'LOCKED':stars[i]?'★'.repeat(stars[i]):recipe.newTrick?'NEW · '+recipe.newTrick:recipe.springRequired?'SPRING':recipe.bankRequired?'BANK':'DIRECT';
  button.append(label,nameTag,star);button.disabled=i>unlocked;
  const kind=recipe.springRequired?'SPRING':recipe.bankRequired?'BANK':'DIRECT';
  button.dataset.shot=kind.toLowerCase();
  if(recipe.newTrick)button.dataset.newTrick='true';
  button.dataset.scene=String(recipe.sceneId);
  button.title='Level '+i+' · '+recipe.challenge+' · '+kind+' SHOT · '+recipe.d.toFixed(1)+'m · difficulty '+stageDifficulty(i,recipe)+'/5';
  button.setAttribute('aria-label',button.title+(i>unlocked?' locked':stars[i]?' '+stars[i]+' stars':''));
  button.addEventListener('click',()=>loadLevel(i));
  el.grid.append(button);
 }
}
function showOverlay(tag,title,text,button,action){
 playing=false;charging=false;chargeSource=null;
 el.overlayTag.textContent=tag;el.overlayTitle.textContent=title;el.overlayText.textContent=text;
 el.overlay.dataset.state=action;
 el.primary.textContent=button;el.primary.dataset.action=action;
 el.secondary.hidden=action!=='win';
 el.overlay.hidden=false;
}
function hideOverlay(){el.overlay.hidden=true;playing=true;paused=false;}
function cupVariant(kind){
 return ['PAPER CUP','CERAMIC MUG','TALL BUCKET','COLOUR BOWL','WIRE BASKET','FILE BIN','TROPHY CUP'][kind];
}
function loadLevel(n){
 if(!Number.isInteger(n)||n<1||n>unlocked)return;
 level=n;settings=stageSettings(level);chosenChapter=chapterIndex(level);
 attempts=0;shotT=0;simTime=0;flight=false;paused=false;
 aimYaw=settings.springRequired?0:Math.atan2(settings.x,settings.d);
 aimPitch=settings.bankRequired?.31:settings.springRequired?.32:.70;
 power=idealPower();ball.active=false;resetBall();
 if(hasRenderer){buildWorld();tickObstacles(0);}
 buildUi();updatePower();
 const roadblock=settings.obstaclePlan.map(o=>o[0].replaceAll('_',' '));
 const barrierText=settings.barrierPlan.length?
  ' Watch for '+settings.barrierPlan.length+' moving obstacle'+(settings.barrierPlan.length===1?'':'s')+'.':'';
 const targetMotion={
  still:'',slide:'The target slides sideways.',
  depth:'The target moves nearer and farther.',lift:'The opening moves up and down.',
  orbit:'The container circles its station.',figure8:'The container follows a figure-eight.'
 }[settings.motion];
 const shotAdvice=settings.springRequired?
  'You MUST hit the spring plate first, then aim the natural rebound into the cup. It will NOT aim for you.':
  settings.bankRequired?'Bounce off the marked rubber tray and aim the rebound yourself; the pad will NOT steer the ball.':
  'Land inside the opening without hitting the rim.';
 if(settings.lid)el.tutorial.textContent='WAIT FOR THE LID TO OPEN · THEN THROW';
 const objective=settings.hoops?
  'Fly through '+settings.hoops+' numbered hoop'+(settings.hoops>1?'s in order':'')+' before scoring.':
  settings.wall?'Ricochet off the striped wall before hitting the cup.':
  settings.springRequired?'Bounce on the spring plate before scoring.':
  settings.bankRequired?'Bank the ball off the rubber tray first.':
  'Land the ball inside the target.';
 const extra=[
  settings.lid?'Watch for the lid to open.':null,
  settings.fanZone?'The airflow changes your shot.':null,
  settings.motion!=='still'?'Lead the moving target.':null,
  settings.wind?'Allow for the crosswind.':null
 ].filter(Boolean).slice(0,2).join(' ');
 const introText=(settings.newTrick?'NEW: '+settings.newTrick+'. ':'')+
  objective+' '+extra;
 showOverlay('LEVEL '+fmtLevel(level)+' · '+SCENE_NAMES[settings.sceneId],
  settings.challenge.toUpperCase(),introText,
  'PLAY LEVEL '+fmtLevel(level),'start');
 save();
}
function nextLevel(){
 if(level>=50){loadLevel(1);return;}
 const n=Math.min(level+1,unlocked);loadLevel(n);
}
function updateBounceCount(){
 if(el.bounces)el.bounces.textContent=String((ball.contacts||0)+(ball.bounces||0)+(ball.wallHits||0));
}
function resetBall(){
 ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:0,vy:0,vz:0,active:false,bounces:0,bankHits:0,springHits:0,wallHits:0,hoopsPassed:0,contacts:0,trail:[]};
 if(ballMesh)ballMesh.position.set(0,LAUNCH_Y,LAUNCH_Z);
 for(const bead of ballTrailMeshes)bead.visible=false;
 updateBounceCount();
}
function createMat(color,rough=.75,metal=.02,emissive=null){
 return new THREE.MeshStandardMaterial({
  color,roughness:rough,metalness:metal,flatShading:false,
  ...(emissive?{emissive,emissiveIntensity:.21}:{})
 });
}
// Smooth hand-rounded cuboids without introducing an external geometry library.
// The underlying BoxGeometry retains exact dimensions for collision testing.
function softBoxGeometry(w,h,d,radius){
 const geometry=new THREE.BoxGeometry(w,h,d,4,4,4);
 const p=geometry.attributes.position,n=geometry.attributes.normal;
 const cx=Math.max(0,w/2-radius),cy=Math.max(0,h/2-radius),cz=Math.max(0,d/2-radius);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const qx=clamp(x,-cx,cx),qy=clamp(y,-cy,cy),qz=clamp(z,-cz,cz);
  const dx=x-qx,dy=y-qy,dz=z-qz,len=Math.hypot(dx,dy,dz)||1;
  p.setXYZ(i,qx+dx/len*radius,qy+dy/len*radius,qz+dz/len*radius);
  n.setXYZ(i,dx/len,dy/len,dz/len);
 }
 p.needsUpdate=true;n.needsUpdate=true;
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}
function meshBox(parent,w,h,d,x,y,z,mat){
 const min=Math.min(w,h,d),max=Math.max(w,h,d);
 const soften=min>=.14&&max<14&&mat?.isMeshStandardMaterial;
 const geometry=soften?softBoxGeometry(w,h,d,Math.min(.095,min*.30)):
  new THREE.BoxGeometry(w,h,d);
 const mesh=new THREE.Mesh(geometry,mat);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function makeText(text,size=40,fg='#fff',bg='#344f70'){
 const c=document.createElement('canvas');c.width=512;c.height=128;
 const ctx=c.getContext('2d');if(!ctx)return createMat(0x7895aa);
 ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;
 ctx.font='900 '+size+'px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(text,256,67,485);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:false});
}
function worldClean(){
 if(!group)return;
 scene.remove(group);
 const materials=new Set(),geometries=new Set();
 group.traverse(obj=>{
  if(obj.geometry)geometries.add(obj.geometry);
  if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(x=>materials.add(x));
 });
 geometries.forEach(x=>x.dispose());materials.forEach(x=>{x.map?.dispose();x.dispose();});
}

// Procedural texture atlas: no external images, subtle realism at low cost.
function roomTexture(kind,seed,rx=1,ry=1){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 let x=(seed*49373+911)%2147483647;
 const rand=()=>{x=(x*48271)%2147483647;return x/2147483647;};
 ctx.fillStyle=kind==='wall'?'#eee8e2':kind==='carpet'?'#c2cbc8':'#e3d3c1';
 ctx.fillRect(0,0,256,256);
 if(kind==='wood'){
  for(let j=0;j<210;j++){
   const y=rand()*256;
   ctx.strokeStyle=rand()<.55?'rgba(70,47,31,.12)':'rgba(255,255,255,.13)';
   ctx.lineWidth=.4+rand()*1.2;ctx.beginPath();ctx.moveTo(0,y);
   ctx.bezierCurveTo(60,y+rand()*5-2,190,y+rand()*5-2,256,y+rand()*5-2);ctx.stroke();
  }
 }else{
  const n=kind==='carpet'?8500:4600;
  for(let j=0;j<n;j++){
   ctx.fillStyle=rand()<.5?'rgba(28,38,40,.075)':'rgba(255,255,255,.07)';
   const px=rand()*256,py=rand()*256;
   ctx.fillRect(px,py,kind==='carpet'?2:1,kind==='carpet'?2:1);
  }
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(rx,ry);
 texture.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);
 return texture;
}
function skylineTexture(seed,night,sunset){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 let v=(seed*67921+3307)%2147483647;
 const rand=()=>{v=(v*48271)%2147483647;return v/2147483647;};
 const sky=ctx.createLinearGradient(0,0,0,320);
 const stops=night?['#22384e','#45596b','#8293a0']:
  sunset?['#728da4','#e2aa87','#e6cfad']:['#90b7c8','#cdd5d5','#b1c4c5'];
 stops.forEach((c,i)=>sky.addColorStop(i/2,c));ctx.fillStyle=sky;ctx.fillRect(0,0,512,320);
 if(!night){
  const sunX=80+rand()*350;
  const glow=ctx.createRadialGradient(sunX,90,4,sunX,90,120);
  glow.addColorStop(0,'rgba(255,243,205,.57)');glow.addColorStop(1,'rgba(255,243,205,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,512,320);
 }
 for(let layer=0;layer<3;layer++){
  const palette=night?['#627887','#3d5266','#263c50']:
   sunset?['#aba19b','#878a8b','#596a74']:['#acbcc0','#849da2','#647f88'];
  const base=246+layer*34;ctx.fillStyle=palette[layer];
  for(let x=-5;x<525;){
   const width=15+rand()*40,height=45+rand()*85+layer*10;
   ctx.fillRect(x,base-height,width,height);
   if(layer){
    for(let wx=x+5;wx<x+width-3;wx+=9)for(let wy=base-height+7;wy<base-6;wy+=12){
     if(rand()>.67){ctx.fillStyle=night?'rgba(255,215,150,.75)':'rgba(224,235,233,.3)';
      ctx.fillRect(wx,wy,3,5);ctx.fillStyle=palette[layer];}
    }
   }
   x+=width+rand()*6;
  }
 }
 const glint=ctx.createLinearGradient(0,0,512,120);
 glint.addColorStop(0,'rgba(255,255,255,.22)');glint.addColorStop(.3,'rgba(255,255,255,0)');
 glint.addColorStop(.85,'rgba(255,255,255,.07)');glint.addColorStop(1,'rgba(255,255,255,.18)');
 ctx.fillStyle=glint;ctx.fillRect(0,0,512,320);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function roundedPoster(parent,text,x,y,z,colorText='#fef0c0'){
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.72,.52),
  makeText(text,35,colorText,'#334858'));
 sign.position.set(x,y,z);parent.add(sign);return sign;
}
function desk(parent,x,z,w,d,h,top,legs){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 meshBox(g,w,.18,d,0,h,0,top);
 for(const sx of [-1,1])for(const sz of [-1,1])
  meshBox(g,.11,h-.13,.11,sx*(w/2-.19),(h-.18)/2,sz*(d/2-.22),legs);
 meshBox(g,w*.88,.075,d*.82,0,h-.21,0,legs);
 return g;
}
function plant(parent,x,z,h=.92){
 const pot=createMat(0xa17462),soil=createMat(0x504439);
 const leaf=createMat(0x4b7968),leaf2=createMat(0x6b9479);
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const p=new THREE.Mesh(new THREE.CylinderGeometry(.28,.22,.42,13),pot);
 p.position.y=.22;g.add(p);
 const dirt=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.045,12),soil);
 dirt.position.y=.43;g.add(dirt);
 for(let i=0;i<8;i++){
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.14,h*.78,6),i%2?leaf:leaf2);
  blade.position.set(Math.sin(i*2.4)*.19,.44+h*.39,Math.cos(i*2.4)*.19);
  blade.rotation.z=(Math.sin(i*2.1))*.38;blade.rotation.x=(Math.cos(i*2.1))*.30;g.add(blade);
 }
 return g;
}
function stackBooks(parent,x,y,z,num,seed){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 const paints=[0xa95d4a,0x638b83,0x486f8d,0xc9a06b,0x947d98];
 for(let i=0;i<num;i++){
  const b=meshBox(g,.48+(i%3)*.055,.072,.70+(i%2)*.06,
   Math.sin(seed+i*2.9)*.08,i*.075,Math.cos(seed+i*2.1)*.04,createMat(paints[(i+seed)%5]));
  b.rotation.y=Math.sin(seed+i)*.12;
  const pages=createMat(0xe9e2d5);
  meshBox(g,.42,.011,.65,b.position.x,b.position.y+.041,b.position.z,pages).rotation.y=b.rotation.y;
 }
}
// Readable fake office software, unique by stage: calendars, reports, mail.
function monitorTexture(seed){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const modes=['TASKS','MAIL','REPORTS','CALENDAR','INBOX'];
 const mode=modes[seed%5];
 ctx.fillStyle='#1b3442';ctx.fillRect(0,0,256,144);
 ctx.fillStyle='#294657';ctx.fillRect(0,0,256,19);
 ctx.fillStyle='#9ed8c9';ctx.font='bold 9px ui-monospace, monospace';
 ctx.fillText('CRILO  /  '+mode,11,13);
 for(let i=0;i<3;i++){
  ctx.fillStyle=['#e6b27d','#80b2b0','#dca2ab'][i];
  ctx.beginPath();ctx.arc(226+i*8,10,2.8,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle='#263e4b';ctx.fillRect(10,28,50,105);
 for(let i=0;i<5;i++){
  ctx.fillStyle=i===seed%5?'#6ca69d':'#40616b';
  ctx.fillRect(16,37+i*18,36,6);
 }
 ctx.fillStyle='#bbd5cf';ctx.font='bold 11px sans-serif';
 ctx.fillText(mode==='REPORTS'?'WEEKLY OVERVIEW':mode==='MAIL'?'MESSAGES':'TODAY AT WORK',72,43);
 if(seed%3===0){
  for(let i=0;i<7;i++){
   const height=12+((i*17+seed*13)%48);
   ctx.fillStyle=i%2?'#75b2b0':'#dfb583';
   ctx.fillRect(77+i*23,120-height,13,height);
  }
  ctx.fillStyle='#476b74';ctx.fillRect(70,121,178,1);
 }else if(seed%3===1){
  for(let i=0;i<5;i++){
   ctx.fillStyle=i%2?'#355863':'#305362';
   ctx.fillRect(70,56+i*15,173,12);
   ctx.fillStyle=i===seed%5?'#e3bf86':'#87aca9';
   ctx.fillRect(77,60+i*15,10,4);
   ctx.fillStyle='#779fa3';ctx.fillRect(94,60+i*15,67+i*11,4);
  }
 }else{
  for(let j=0;j<4;j++)for(let i=0;i<7;i++){
   ctx.fillStyle=(i+j+seed)%5===0?'#d3a979':'#365c65';
   ctx.fillRect(72+i*24,59+j*18,20,14);
  }
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=1;
 return texture;
}
function officeMonitor(parent,x,y,z,angle=0){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);
 const plastic=createMat(0x313c47,.63,.18);
 meshBox(g,1.45,.88,.11,0,.56,0,plastic);
 const litScreen=new THREE.MeshBasicMaterial({
  color:0xc2d3d0,map:monitorTexture(level),toneMapped:true
 });
 meshBox(g,1.27,.69,.013,0,.57,-.064,litScreen);
 const led=new THREE.Mesh(new THREE.SphereGeometry(.014,7,5),
  new THREE.MeshBasicMaterial({color:0x9de4bd}));
 led.position.set(.64,.17,-.075);g.add(led);
 meshBox(g,.09,.45,.10,0,-.11,.06,plastic);
 meshBox(g,.65,.04,.31,0,-.31,.18,plastic);
 return g;
}
function officeBin(parent,x,z,mat){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(.55,.43,.86,22,1,true),mat);
 shell.position.y=.43;g.add(shell);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.56,.036,7,24),createMat(0xc5d0d0,.34,.52));
 rim.rotation.x=Math.PI/2;rim.position.y=.86;g.add(rim);
 const bottom=new THREE.Mesh(new THREE.CircleGeometry(.43,22),createMat(0x40484d));
 bottom.rotation.x=-Math.PI/2;bottom.position.y=.025;g.add(bottom);
 return g;
}
function officeFan(parent,x,z,mat,angle=0,kind='cross'){
 // Floor-mounted desk turbine: weighted rubber feet, upright metal mast,
 // hinged head, grille, cord and a small power socket. Nothing floats.
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;parent.add(g);
 const steel=createMat(0x9aafb7,.27,.57),dark=createMat(0x31454d,.65,.24);
 const rubber=createMat(0x263840,.94,.02);
 const base=meshBox(g,.71,.105,.56,0,.082,0,mat);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.05,12),rubber);
  foot.position.set(sx*.27,.025,sz*.21);foot.castShadow=true;g.add(foot);
 }
 const headY=kind==='lift'?.77:1.84;
 const pedestalHeight=headY-.27;
 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.073,.10,pedestalHeight,14),steel);
 mast.position.set(0,.18+pedestalHeight*.5,0);
 mast.castShadow=true;g.add(mast);
 const collar=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.12,16),dark);
 collar.position.y=headY-.13;g.add(collar);
 const head=new THREE.Group();head.position.y=headY;
 if(kind==='lift')head.rotation.x=-Math.PI/2;
 g.add(head);
 const casing=new THREE.Mesh(new THREE.CylinderGeometry(.49,.43,.28,36),
  mat);
 casing.rotation.x=Math.PI/2;casing.position.z=-.12;
 casing.castShadow=true;casing.receiveShadow=true;head.add(casing);
 const back=new THREE.Mesh(new THREE.CircleGeometry(.40,36),dark);
 back.position.z=-.265;head.add(back);
 const motor=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.21,18),steel);
 motor.rotation.x=Math.PI/2;motor.position.z=-.045;head.add(motor);
 const rotor=new THREE.Group();rotor.position.z=.067;head.add(rotor);
 for(let i=0;i<4;i++){
  const blade=new THREE.Mesh(new THREE.SphereGeometry(.20,16,11),mat);
  blade.scale.set(.69,1.49,.20);
  const a=i*Math.PI/2;blade.rotation.z=-a-.16;
  blade.position.set(Math.sin(a)*.20,Math.cos(a)*.20,0);
  blade.castShadow=true;rotor.add(blade);
 }
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.092,16,12),steel);
 cap.position.z=.038;rotor.add(cap);
 const guard=new THREE.Group();guard.position.z=.165;head.add(guard);
 for(const rad of [.17,.30,.44]){
  const rim=new THREE.Mesh(new THREE.TorusGeometry(rad,.016,7,44),steel);
  guard.add(rim);
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const spoke=new THREE.Mesh(new THREE.CylinderGeometry(.010,.010,.88,6),steel);
  spoke.rotation.z=a;guard.add(spoke);
 }
 const lip=new THREE.Mesh(new THREE.TorusGeometry(.49,.039,9,42),dark);
 guard.add(lip);
 const switchBody=meshBox(g,.18,.040,.10,.16,.143,.02,dark);
 switchBody.castShadow=false;
 const led=new THREE.Mesh(new THREE.SphereGeometry(.025,10,8),
  new THREE.MeshBasicMaterial({color:0x8aebcf}));
 led.position.set(.16,.169,.02);g.add(led);
 // The cable runs down from the base and along the FLOOR toward an outlet.
 const cord=new THREE.Mesh(new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
   new THREE.Vector3(-.27,.065,.08),new THREE.Vector3(-.46,.048,.22),
   new THREE.Vector3(-.64,.048,.39),new THREE.Vector3(-.99,.046,.48),
   new THREE.Vector3(-1.13,.049,.55)
  ]),22,.015,6,false),rubber);
 g.add(cord);
 const plug=meshBox(g,.22,.12,.06,-1.18,.12,.56,dark);
 plug.castShadow=false;
 g.userData={rotor,baseYaw:angle,kind,headY};
 return g;
}
function officeColleague(parent,x,z,n){
 // Original stylized coworker with smooth body, curved shoulders and hands.
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const skin=createMat([0xcfa68b,0x9b7058,0xe2bca4,0xb58b6e,0xd5a18a][n%5],.65);
 const shirt=createMat([0x668fa3,0x94918c,0xbb8986,0x75a292,0x838bac][n%5],.75);
 const hair=createMat([0x483c38,0x353237,0x604738,0x403f3c,0x6d5744][n%5],.83);
 const pants=createMat(0x536579,.78);
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.34,.29,.78,20,1),shirt);
 torso.position.set(0,1.15,0);torso.scale.z=.76;torso.castShadow=true;g.add(torso);
 const shoulders=new THREE.Mesh(new THREE.SphereGeometry(.36,20,14),shirt);
 shoulders.position.set(0,1.47,0);shoulders.scale.set(1,.36,.70);g.add(shoulders);
 const hips=new THREE.Mesh(new THREE.SphereGeometry(.28,18,12),pants);
 hips.position.set(0,.71,-.05);hips.scale.set(1,.54,.75);g.add(hips);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.10,.12,.18,14),skin);
 neck.position.y=1.59;g.add(neck);
 const face=new THREE.Mesh(new THREE.SphereGeometry(.32,24,20),skin);
 face.position.set(0,1.84,-.03);face.scale.set(1,.98,.87);face.castShadow=true;g.add(face);
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.33,22,14),hair);
 cap.scale.set(1.04,.50,1.02);cap.position.set(0,2.055,-.02);g.add(cap);
 for(const sx of [-1,1]){
  const eye=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),hair);
  eye.position.set(sx*.11,1.86,-.304);g.add(eye);
  const shoe=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),hair);
  shoe.scale.set(1,.54,1.43);shoe.position.set(sx*.17,.12,-.08);g.add(shoe);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.115,.10,.62,12),pants);
  leg.position.set(sx*.18,.38,0);leg.castShadow=true;g.add(leg);
 }
 const arm=new THREE.Group();arm.position.set(.42,1.48,0);g.add(arm);
 const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.12,.105,.55,12),shirt);
 sleeve.position.set(.05,-.25,0);sleeve.rotation.z=.20;arm.add(sleeve);
 const hand=new THREE.Mesh(new THREE.SphereGeometry(.115,12,10),skin);
 hand.position.set(.095,-.55,.03);arm.add(hand);
 const other=new THREE.Mesh(new THREE.CylinderGeometry(.12,.10,.54,12),shirt);
 other.position.set(-.43,1.20,0);other.rotation.z=-.27;g.add(other);
 const mouth=new THREE.Mesh(new THREE.TorusGeometry(.055,.009,5,18,Math.PI),hair);
 mouth.position.set(0,1.70,-.299);mouth.rotation.z=Math.PI;g.add(mouth);
 g.userData={arm,face,baseY:g.position.y};
 return g;
}
function officeChair(parent,x,z){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const dark=createMat(0x44555b,.72,.06),silver=createMat(0x9fa8a7,.4,.45);
 meshBox(g,.88,.19,.74,0,.75,0,dark);
 meshBox(g,.88,1.02,.16,0,1.19,.35,dark);
 meshBox(g,.06,.65,.07,0,.41,0,silver);
 for(const a of [0,1.26,2.52,3.78,5.04]){
  const foot=meshBox(g,.09,.09,.67,Math.sin(a)*.24,.08,Math.cos(a)*.24,silver);
  foot.rotation.y=a;
 }
 return g;
}

function addFanJet(spec,x,z,device,label){
 // Visuals and physics share a single emitter at the actual fan motor.
 const kind=spec.kind,side=spec.side;
 // Mount horizontal fans on grounded cabinets to line up the visible jet
 // with the actual height of the thrown ball.
 if(kind==='cross'&&!settings.bankRequired&&!settings.springRequired){
  const shelfY=1.15,paint=createMat(0x667e82,.43,.34);
  const legs=createMat(0x455d65,.53,.42);
  meshBox(group,1.28,.13,1.10,x,shelfY-.065,z,paint);
  for(const dx of [-.49,.49])for(const dz of [-.41,.41])
   meshBox(group,.088,shelfY-.13,.088,x+dx,(shelfY-.13)*.5,z+dz,legs);
  meshBox(group,1.14,.055,.88,x,.29,z,legs);
  device.position.y=shelfY;
  // Continue the motor's power lead down the cabinet to a floor outlet.
  device.updateMatrixWorld(true);
  const end=new THREE.Vector3(-1.18,.12,.56).applyMatrix4(device.matrixWorld);
  const outlet=new THREE.Vector3(x+side*.85,.15,z+.72);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(
   new THREE.CatmullRomCurve3([
    end,end.clone().add(new THREE.Vector3(0,-.28,.06)),
    new THREE.Vector3(end.x,.12,end.z+.11),outlet
   ]),24,.016,6,false),createMat(0x243843,.86)));
  meshBox(group,.27,.26,.07,outlet.x,.14,outlet.z,
   createMat(0xc1cac5,.55));
 }
 const headY=device.position.y+device.userData.headY;
 const field={kind,side,dir:-side,x,y:headY,z,power:spec.power,
  reach:kind==='lift'?3.25:4.45,device,phase:settings.n*.33,label,cloud:null};
 const cloud=new THREE.Group();cloud.position.set(x,headY,z);group.add(cloud);
 const color=kind==='lift'?0x9aebc5:0x9edce9;
 const markerMat=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:.64,depthWrite:false,depthTest:true,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide
 });
 for(let i=0;i<12;i++){
  const marker=new THREE.Mesh(new THREE.ConeGeometry(.061,.18,8),markerMat);
  marker.userData.progress=(i+.22)/12;
  const a=i*2.4,spread=.20+.30*i/12;
  marker.userData.u=Math.cos(a)*spread;
  marker.userData.v=Math.sin(a)*spread;
  if(kind!=='lift')marker.rotation.z=side*Math.PI/2;
  marker.castShadow=false;cloud.add(marker);
 }
 const streamMat=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:.13,depthWrite:false,
  blending:THREE.AdditiveBlending
 });
 const marks=new THREE.Group();cloud.add(marks);
 for(let k=0;k<3;k++){
  const ring=new THREE.Mesh(
   new THREE.TorusGeometry(.27+k*.13,.017,6,28),streamMat);
  if(kind==='lift'){ring.rotation.x=-Math.PI/2;ring.position.y=.52+k*.77;}
  else{ring.rotation.y=Math.PI/2;ring.position.x=field.dir*(.52+k*.77);}
  marks.add(ring);
 }
 field.cloud=cloud;fanFields.push(field);
 return field;
}
function buildWorld(){
 if(!hasRenderer)return;
 worldClean();
 group=new THREE.Group();scene.add(group);
 obstacles=[];pads=[];hoops=[];wallPad=null;airZone=null;fanFields=[];physicsBodies=[];physicsGrid=new Map();physicsGlobal=[];physicsMoving=[];specialSurfaces=[];ambient=[];aimLine=[];targetLift=null;ballTrailMeshes=[];impactRing=null;impactAge=2;cupLid=null;lidOpen=null;
 const sets=[
  {walls:0xa2b3b2,carpet:0x53686d,desk:0xbb906e,trim:0x4d6d75,name:'THE CUBICLE'},
  {walls:0xb7ada1,carpet:0x637571,desk:0xa88361,trim:0x556d72,name:'MEETING ROOM'},
  {walls:0x9dabb6,carpet:0x5c727b,desk:0xb39377,trim:0x4c727e,name:'MAILROOM'},
  {walls:0xb8b3a0,carpet:0x758078,desk:0xbb8e72,trim:0x6e7166,name:'BREAK ROOM'},
  {walls:0x728c9c,carpet:0x495f74,desk:0x9f8166,trim:0x3c6173,name:'NIGHT SHIFT'},
  {walls:0xa5a096,carpet:0x686260,desk:0xb19677,trim:0x70635e,name:'ARCHIVE'},
  {walls:0xb4c2b8,carpet:0x607a71,desk:0xc7a47e,trim:0x477976,name:'RECEPTION'},
  {walls:0xb1a8a2,carpet:0x656273,desk:0xbca283,trim:0x6e5b65,name:'AWARDS OFFICE'},
  {walls:0xa1afb0,carpet:0x5c7073,desk:0xb09775,trim:0x5a737b,name:'SHIPPING DOCK'},
  {walls:0x667e91,carpet:0x42586b,desk:0x977f6d,trim:0x416a80,name:'SERVER ROOM'}
 ];
 const theme=sets[settings.sceneId],roomEnd=settings.targetZ-4.15;
 // Ten authored-looking layouts: each room has a day/night and workday/after-hours state,
 // and the challenge layout changes its foreground props per individual level.
 const lightingMode=(level-1)%10>=5;
 const sceneTone=[0x526977,0x756e68,0x526574,0x776f5f,0x4f5e70,0x5a5450,0x657874,0x605866,0x5f6e71,0x394f61][settings.sceneId];
 const nearDeskTone=settings.roomVariant?0x695348:theme.desk;
 const roomMiddle=(LAUNCH_Z+5+roomEnd)/2,roomLength=LAUNCH_Z+5-roomEnd;
 const wallMat=createMat(theme.walls,.91),carpet=createMat(theme.carpet,.94);
 wallMat.map=roomTexture('wall',level,5,3);
 carpet.map=roomTexture('carpet',level+23,9,8);
 const wood=createMat(nearDeskTone,.48,.04),darkWood=createMat(0x45392f,.68);
 wood.map=roomTexture('wood',level+39,3,2);
 const metal=createMat(0x687985,.33,.41),dark=createMat(theme.trim,.6,.15);
 const cream=createMat(0xe3d9cb,.8),paper=createMat(0xdfddcf,.9);
 const highlight=createMat(settings.color,.38,.02,settings.color);
 const blue=createMat(0x66899b,.6),light=createMat(0xf0e0b9,.7);
 const lampGlow=new THREE.MeshBasicMaterial({color:0xffe9b3});
 // Room-specific architecture: a grounded first-person office scene, not a
 // generic pastel shooting gallery. Warm lights and dark walls frame the ball.
 if(settings.sceneId===1){
  for(const x of [-4.4,4.4]){
   const column=meshBox(group,.40,6.9,.55,x,3.3,roomEnd+.48,metal);
   column.castShadow=true;
  }
 }
 if(settings.sceneId===2){
  for(let i=0;i<6;i++){
   const z=roomEnd+1.2+i*1.25;
   meshBox(group,.18,3.1,.92,7.45,1.62,z,metal);
  }
 }
 if(settings.sceneId===3){
  // Kitchen wall backsplash and distinct tiled texture.
  meshBox(group,7.4,1.9,.07,0,1.9,roomEnd+.20,createMat(0x83918a,.58));
  for(let x=-3.2;x<=3.2;x+=.8)
   meshBox(group,.025,1.8,.08,x,1.9,roomEnd+.27,cream);
 }
 if(settings.sceneId===4){
  // Midnight computer lab: monitor columns and cool blue workstation accents.
  for(const x of [-5.5,-4.2,4.2,5.5])
   meshBox(group,.25,5.3,.25,x,3,roomEnd+.35,dark);
 }
 // Ten distinct office identities; each changes the actual architectural
 // silhouette beyond the target, not only the wall paint.
 if(settings.sceneId===5){
  for(const side of [-1,1])for(let i=0;i<4;i++){
   const zz=roomEnd+1.0+i*2.1;
   meshBox(group,2.5,.13,1.12,side*5.15,1.15,zz,wood);
   meshBox(group,2.5,.13,1.12,side*5.15,2.47,zz,wood);
   meshBox(group,2.5,.13,1.12,side*5.15,3.79,zz,wood);
   for(const yy of [1.34,2.66,3.98])for(let k=0;k<4;k++)
    meshBox(group,.31,.40,.75,side*5.15+(k-1.5)*.47,yy,zz,
     createMat([0x9e8478,0xa7a18b,0x70848a,0x877b88][(k+i)%4]));
  }
 }else if(settings.sceneId===6){
  for(const x of [-5.7,5.7]){
   meshBox(group,.54,5.9,.58,x,3.05,roomEnd+1.15,cream);
   meshBox(group,.80,.29,.80,x,6.02,roomEnd+1.15,wood);
  }
  meshBox(group,8.1,.14,1.38,0,1.32,roomEnd+1.25,wood);
  roundedPoster(group,'WELCOME',0,4.8,roomEnd+.42);
 }else if(settings.sceneId===7){
  for(let i=0;i<6;i++){
   const xx=-5.4+i*2.1;
   const frame=meshBox(group,1.22,1.5,.08,xx,4.7,roomEnd+.36,wood);
   meshBox(group,1.04,1.32,.09,xx,4.7,roomEnd+.42,
    createMat([0xae956e,0x7d8997,0x9c897e][i%3],.35,.22));
   const disk=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.09,20),
    createMat(0xc8a05e,.34,.48));
   disk.rotation.x=Math.PI/2;disk.position.set(xx,4.95,roomEnd+.52);group.add(disk);
  }
 }else if(settings.sceneId===8){
  for(const x of [-6.45,6.45]){
   for(let i=0;i<6;i++){
    const zz=roomEnd+1.4+i*2.1;
    meshBox(group,.95,.80,1.0,x,.42,zz,createMat(i%2?0xb79c7a:0x83959d));
    meshBox(group,.06,.78,1.03,x,.42,zz,cream);
   }
  }
  for(let i=0;i<7;i++)meshBox(group,10,.08,.12,0,.18,roomEnd+1.0+i*.65,metal);
  roundedPoster(group,'DISPATCH',0,5.1,roomEnd+.43);
 }else if(settings.sceneId===9){
  for(const side of [-1,1])for(let i=0;i<5;i++){
   const x=side*6.5,zz=roomEnd+1.5+i*2.0;
   meshBox(group,.9,3.90,1.66,x,2.10,zz,dark);
   for(let k=0;k<8;k++){
    const indicator=meshBox(group,.18,.035,.02,x,1.02+k*.36,zz+.85,
     createMat(k%3===0?0x68b69c:0x5f93c4,.36,.1,k%3===0?0x225f48:0x20455d));
    indicator.castShadow=false;
   }
  }
 }
 // A full-size room: fixed eye-level perspective from behind the front desk.
 meshBox(group,16,.23,roomLength,0,-.115,roomMiddle,carpet);
 meshBox(group,16,8,.22,0,3.47,roomEnd,wallMat);
 meshBox(group,.22,8,roomLength,-8,3.47,roomMiddle,wallMat);
 meshBox(group,.22,8,roomLength,8,3.47,roomMiddle,wallMat);
 // Skirting, ceiling, timber wall frames and acoustic office panels.
 meshBox(group,16,.19,roomLength,0,7.54,roomMiddle,cream);
 for(const x of [-7.84,7.84]){
  meshBox(group,.09,.28,roomLength,x,.06,roomMiddle,darkWood);
  for(let i=0;i<4;i++){
   const zz=roomEnd+(i+1)*roomLength/5;
   meshBox(group,.25,5,.15,x,3.3,zz,metal);
  }
 }
 for(let i=0;i<4;i++){
  const zz=roomEnd+.6+i*roomLength/4;
  meshBox(group,15.8,.10,.09,0,6.5,zz,cream);
 }
 // Wall window with faux blinds and warm sky, safely BEHIND target.
 const winGroup=new THREE.Group();winGroup.position.set(-3.75,4.55,roomEnd+.19);group.add(winGroup);
 meshBox(winGroup,3.8,2.35,.14,0,0,0,cream);
 const outside=new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.03),
  new THREE.MeshBasicMaterial({map:skylineTexture(level+settings.sceneId*19,
   settings.roomVariant===1||[4,9].includes(settings.sceneId),
   [1,6,7].includes(settings.sceneId)),side:THREE.DoubleSide}));
 outside.position.z=.09;winGroup.add(outside);
 // Blinds stay mostly open, revealing different skyline lighting each round.
 for(let i=0;i<5;i++)
  meshBox(winGroup,3.33,.031,.028,0,.61+i*.083,.118,cream);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(.22,1.78),
  new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.075,depthWrite:false}));
 glass.position.set(-.77,0,.132);glass.rotation.z=-.1;winGroup.add(glass);
 meshBox(winGroup,.11,2.1,.18,0,0,.15,cream);
 // Window sill, real frame thickness and a worn side door.
 meshBox(winGroup,3.91,.18,.41,0,-1.20,.13,cream);
 meshBox(winGroup,.075,.34,.12,.15,-.07,.23,metal);
 const doorwayX=settings.sceneId%2===0?6.95:-6.95;
 meshBox(group,1.33,4.5,.22,doorwayX,2.16,roomEnd+.30,dark);
 meshBox(group,1.06,4.21,.13,doorwayX,2.12,roomEnd+.47,
  createMat(settings.roomVariant?0x3c5362:0x887f70,.79));
 const doorHandle=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),
  createMat(0xcdb68a,.29,.35));
 doorHandle.position.set(doorwayX+(doorwayX>0?-.34:.34),1.98,roomEnd+.58);
 group.add(doorHandle);
 // Notices, pinned memos, clock and shelving on the rear wall.
 const cork=meshBox(group,2.8,1.55,.19,3.75,4.1,roomEnd+.22,
  createMat(0x95755b));
 const noteMat=[0xffe5a4,0xcad8b0,0xe4c0b9,0xc0d8e5];
 for(let i=0;i<6;i++){
  const note=meshBox(group,.52+(i%3)*.15,.39+(i%2)*.10,.02,
   2.8+(i%3)*.8,4.55-Math.floor(i/3)*.62,roomEnd+.35,
   createMat(noteMat[(i+level)%4],.92));
  note.rotation.z=(i%3-1)*.075;
 }
 const clock=new THREE.Mesh(new THREE.CylinderGeometry(.41,.41,.07,30),
  createMat(0xedebe4,.77));
 clock.rotation.x=Math.PI/2;clock.position.set(0,5.58,roomEnd+.32);group.add(clock);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.019,6,5),dark);
  dot.position.set(Math.sin(a)*.30,5.58+Math.cos(a)*.30,roomEnd+.37);group.add(dot);
 }
 meshBox(group,.04,.24,.05,0,5.68,roomEnd+.4,dark).rotation.z=.35;
 // Baffled overhead lights and warm pools of indirect light give depth
 // without making the small ball or cup disappear into a bright scene.
 const nightRoom=settings.roomVariant===1||[4,9].includes(settings.sceneId);
 const fixture=createMat(0x7a8790,.34,.34);
 for(let i=0;i<3;i++){
  const z=roomEnd+2.0+i*roomLength/3.5;
  meshBox(group,2.63,.14,1.0,-2.6,7.35,z,fixture);
  meshBox(group,2.17,.035,.70,-2.6,7.20,z,
   new THREE.MeshBasicMaterial({color:nightRoom?0xc5deee:0xffe6b6}));
  if(i===1){
   const overhead=new THREE.PointLight(nightRoom?0xc6d7ee:0xffd6ab,
    nightRoom?8.0:10.0,12,2);
   overhead.position.set(-2.6,6.90,z);group.add(overhead);
  }
 }
 const focusLight=new THREE.PointLight(nightRoom?0xaacadd:0xffdbac,3.3,5,2);
 focusLight.position.set(settings.x+1.65,settings.topPad+3.3,settings.targetZ+.75);
 group.add(focusLight);
 // Side cubicle furnishings and cabinets, different positions per layout.
 for(const side of [-1,1]){
  for(let i=0;i<2;i++){
   const z=roomEnd+2.0+i*3.3+(settings.roomVariant?.6:0);
   const x=side*5.3;
   const ds=desk(group,x,z,2.9,1.55,1.0,wood,metal);
   officeMonitor(ds,0,1.02,-.2,-side*.17);
   meshBox(ds,.85,.10,.31,.52,1.06,.44,dark);
   officeChair(group,x,z+1.3);
   stackBooks(group,x-side*.78,1.15,z,3+i,level+i);
   meshBox(group,2.8,1.7,.11,side*6.98,.95,z-.8,dark);
  }
  plant(group,side*6.0,roomEnd+1.35+settings.roomVariant,.95);
  if((level+iLevelFactor(side))%3!==0)
   officeBin(group,side*4.65,roomEnd+1.35,createMat(0x7c8b8e,.35,.35));
 }
 // A deterministic detail switch varies clutter for each level.
 function iLevelFactor(side){return side<0?1:2;}
 // Front player desk close to camera: tangible 3D surface and desk accessories.
 const playerDesk=desk(group,0,5.65,12.7,3.9,1.02,wood,metal);
 meshBox(playerDesk,5.7,.012,1.0,0,1.13,-.61,
  createMat(0x435a61,.83)); // desk mat behind the ball
 stackBooks(playerDesk,-4.32,1.19,.35,4,level);
 const note=meshBox(playerDesk,1.2,.01,.84,3.8,1.15,-.27,paper);
 note.rotation.y=.12;
 const pencil=createMat(0xe5b04c,.34),eraser=createMat(0x8a6867,.83);
 for(let i=0;i<3;i++){
  const pen=meshBox(playerDesk,.026,.025,.7,3.33+i*.15,1.17,.20,pencil);
  pen.rotation.y=-.2+i*.08;
 }
 meshBox(playerDesk,.35,.13,.30,4.50,1.23,.06,eraser);
 // First-person throwing hand on the right edge of the desktop.
 const skin=createMat(0xc19375,.83),cuff=createMat(0x467a8b,.83);
 const hand=new THREE.Group();hand.position.set(.75,1.40,LAUNCH_Z+.60);group.add(hand);
 throwingHand=hand;
 const palm=new THREE.Mesh(new THREE.SphereGeometry(.34,20,16),skin);
 palm.scale.set(.88,.47,1.18);palm.position.set(0,.035,-.03);
 palm.castShadow=true;hand.add(palm);
 const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.27,.31,.43,20),cuff);
 sleeve.rotation.x=Math.PI/2;sleeve.position.set(0,-.08,.34);hand.add(sleeve);
 for(let i=0;i<4;i++){
  const finger=new THREE.Mesh(new THREE.SphereGeometry(.092,12,10),skin);
  finger.scale.set(.65,.53,1.67-i*.06);
  finger.position.set(-.17+i*.115,.18,-.31-(i%2)*.03);
  finger.rotation.y=(i-1.5)*.06;hand.add(finger);
 }
 const thumb=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),skin);
 thumb.scale.set(1,.63,1.33);thumb.position.set(.285,.01,-.08);
 thumb.rotation.y=-.42;hand.add(thumb);
 // Five distinct target furniture stations. Each cup now belongs to a
 // believable location: wooden desk, filing cabinet, shelf, cart or counter.
 const farDesk=new THREE.Group();farDesk.position.set(settings.x,0,settings.targetZ);group.add(farDesk);
 const stationNames=['desk','drawer','shelf','trolley','counter','cabinet','window','printer','archive','conference'];
 const station=Math.max(0,stationNames.indexOf(settings.station)),stationY=settings.topPad+.03;
 if(station===0){
  desk(farDesk,0,0,5.0,2.8,stationY,wood,metal);
  meshBox(farDesk,4.7,.09,.06,0,stationY-.17,-1.35,darkWood);
 }else if(station===1){
  const cabinet=createMat(0x737e80,.4,.34);
  meshBox(farDesk,2.9,stationY,2.35,0,stationY/2,0,cabinet);
  meshBox(farDesk,3.1,.14,2.53,0,stationY+.01,0,wood);
  for(let k=0;k<3;k++){
   const y=.23+(k+.5)*(stationY-.28)/3;
   meshBox(farDesk,2.26,(stationY-.26)/3-.07,.034,0,y,1.19,dark);
   meshBox(farDesk,.48,.07,.04,0,y+.08,1.215,cream);
  }
 }else if(station===2){
  meshBox(farDesk,3.45,.21,2.0,0,stationY,0,wood);
  meshBox(farDesk,.16,stationY,.19,-1.5,stationY/2,-.78,metal);
  meshBox(farDesk,.16,stationY,.19,1.5,stationY/2,-.78,metal);
  meshBox(farDesk,3.3,.07,1.9,0,stationY*.49,0,dark);
  for(const x of [-1.5,1.5])meshBox(farDesk,.20,.20,.20,x,stationY+.15,0,cream);
 }else if(station===3){
  const cartMat=createMat(0x76878c,.35,.41);
  meshBox(farDesk,2.65,.12,2.15,0,stationY+.01,0,cartMat);
  meshBox(farDesk,2.4,.09,1.96,0,stationY*.55,0,cartMat);
  for(const x of [-1.07,1.07])for(const z of [-.80,.80]){
   meshBox(farDesk,.13,stationY,.13,x,stationY/2,z,metal);
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.08,12),dark);
   wheel.rotation.z=Math.PI/2;wheel.position.set(x,.14,z);farDesk.add(wheel);
  }
  meshBox(farDesk,.10,.52,2.1,-1.34,stationY+.12,0,dark);
 }else if(station===4||station===5){
  const cabinets=createMat(station===5?0x60737c:0x8a948e,.8,.06);
  meshBox(farDesk,3.5,stationY,2.1,0,stationY/2,0,cabinets);
  meshBox(farDesk,3.7,.17,2.29,0,stationY+.04,0,wood);
  for(const x of [-.85,.85]){
   meshBox(farDesk,1.40,stationY*.75,.06,x,stationY*.49,1.085,cream);
   meshBox(farDesk,.12,.42,.05,x+.42,stationY*.49,1.13,metal);
  }
 }else if(station===6){
  // Deep bay window with a slim sill, a completely different distant target.
  meshBox(farDesk,3.45,.18,1.40,0,stationY,0,cream);
  meshBox(farDesk,3.55,2.2,.15,0,stationY+1.07,-.75,metal);
  meshBox(farDesk,3.10,1.8,.04,0,stationY+1.05,-.65,blue);
  meshBox(farDesk,.09,2.10,.20,0,stationY+1.12,-.64,cream);
 }else if(station===7){
  // Industrial photocopier with control panel and tall output shelf.
  meshBox(farDesk,3.15,stationY,2.4,0,stationY*.5,0,metal);
  meshBox(farDesk,3.40,.15,2.45,0,stationY+.02,0,dark);
  meshBox(farDesk,1.05,.09,.64,-.90,stationY+.16,.52,cream);
  meshBox(farDesk,.80,.10,.6,.86,stationY+.15,-.82,blue);
 }else if(station===8){
  // Wall of compact archival shelves with target sitting on a top board.
  for(const x of [-1.45,1.45]){
   meshBox(farDesk,.14,3,.16,x,1.5,-.58,dark);
  }
  for(const yy of [.55,1.10,stationY]){
   meshBox(farDesk,3.18,.11,1.78,0,yy,0,wood);
  }
  for(let k=0;k<5;k++)
   meshBox(farDesk,.17,.42,.52,-1.0+k*.47,stationY-.29,-.60,
    createMat([0x8aa0a4,0xc1a57a,0xb18585][k%3]));
 }else{
  // Big boardroom oval tabletop with visible pedestal base.
  const oval=new THREE.Mesh(new THREE.CylinderGeometry(1.70,1.70,.16,32),wood);
  oval.scale.set(1,.9,.70);oval.position.y=stationY;farDesk.add(oval);
  meshBox(farDesk,.70,stationY-.15,.58,0,(stationY-.15)*.5,0,metal);
  meshBox(farDesk,2.45,.10,1.20,0,.12,0,dark);
 }
 const stationMarker=meshBox(farDesk,2.45,.038,.14,0,stationY+.115,-.73,highlight);
 stationMarker.castShadow=false;
 // Draw each cup's movement envelope on its work surface.
 if(settings.motion!=='still'&&settings.motion!=='lift'){
  const pts=[],am=settings.moving*.98,yy=stationY+.19;
  for(let j=0;j<=56;j++){
   const tt=j/56*TWO_PI;
   let x=0,z=0;
   if(settings.motion==='slide')x=Math.sin(tt)*am;
   else if(settings.motion==='depth')z=Math.sin(tt)*am*.80;
   else if(settings.motion==='orbit'){x=Math.sin(tt)*am;z=Math.cos(tt)*am*.50;}
   else if(settings.motion==='figure8'){x=Math.sin(tt)*am;z=Math.sin(tt*2)*am*.48;}
   pts.push(new THREE.Vector3(x,yy,z));
  }
  farDesk.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
   new THREE.LineBasicMaterial({color:0xfce2a4,transparent:true,opacity:.77,depthWrite:false})));
 }
 if(settings.motion==='lift'){
  // Rising cups extend a visible support instead of clipping into the desk.
  targetLift=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,1,12),
   createMat(0xc3c1b1,.32,.38));
  targetLift.position.set(settings.x,stationY+.18,settings.targetZ);
  group.add(targetLift);
 }
 if(settings.sceneId===0){
  officeMonitor(farDesk,-1.65,stationY+.15,-.75,.12);
  stackBooks(farDesk,1.60,stationY+.18,-.7,2,level);
 }else if(settings.sceneId===1){
  for(let i=0;i<4;i++)meshBox(farDesk,.6,.09,.40,
   (i-1.5)*.65,stationY+.18,-.79,paper);
 }else if(settings.sceneId===2){
  // Mail sorting station: labeled parcel stacks and a raised dispatch shelf.
  for(let i=0;i<4;i++){
   const item=meshBox(farDesk,.75,.40,.52,-1.73+i*.92,settings.topPad+.20,-1.03,
    createMat(i%2?0x9f9181:0xa7a69a));
   meshBox(farDesk,.52,.012,.015,item.position.x,settings.topPad+.28,-1.30,paper);
  }
 }else if(settings.sceneId===3){
  // Staff kitchenette: urn, stacked dishes and appliances.
  const kettle=new THREE.Mesh(new THREE.CylinderGeometry(.30,.42,.65,14),
   createMat(0xb4b0a9,.35,.54));
  kettle.position.set(settings.x-1.38,settings.topPad+.39,settings.targetZ-.92);
  group.add(kettle);
  for(let i=0;i<4;i++)meshBox(farDesk,.56,.05,.56,1.47,settings.topPad+.1+i*.07,-.76,cream);
  plant(group,settings.x+2.4,settings.targetZ-.4,1.1);
 }else{
  for(let i=0;i<4;i++){
   const screen=meshBox(farDesk,.76,.52,.10,-1.85+i*1.2,settings.topPad+.52,-.80,dark);
   meshBox(farDesk,.60,.36,.016,screen.position.x,settings.topPad+.52,-.862,
     createMat(0x3c656e,.35,.06,0x335969));
  }
 }
 // Variety: the actual cup is always open and visible on its own tray.
 cupGroup=new THREE.Group();cupGroup.position.set(settings.x,.19+settings.topPad,settings.targetZ);group.add(cupGroup);
 const r=settings.radius,kind=settings.kind,h=settings.targetHeight;
 // A believable warm practical highlight keeps the target legible in dim rooms.
 const targetSpot=new THREE.PointLight(0xffd49d,settings.roomVariant?2.4:2.9,2.7,2);
 targetSpot.position.set(0,h+.45,0);cupGroup.add(targetSpot);
 const colors=[0xd5e2e1,0xe7b5a0,0x9dbcc4,0xd0b38c,0x94bec1,0xe0c7ad,0xf0ce89];
 const cupMat=createMat(colors[kind],kind===0?.72:.31,[2,4,6].includes(kind)?.38:.06);
 const insideMat=createMat(0x60747b,.73),lipMat=createMat(0xf4d8a8,.23,.32,0x5a402e);
 // Curved lathe profile: a real bucket/mug silhouette, not a straight block.
 const baseRadius=kind===3?r*.62:r*.72;
 const outline=[
  new THREE.Vector2(baseRadius*.92,0),
  new THREE.Vector2(baseRadius,.045),
  new THREE.Vector2(baseRadius*1.02,h*.20),
  new THREE.Vector2(r*.86,h*.60),
  new THREE.Vector2(r*.96,h*.87),
  new THREE.Vector2(r,h)
 ];
 const shell=new THREE.Mesh(new THREE.LatheGeometry(outline,40,0,Math.PI*2),cupMat);
 shell.castShadow=true;shell.receiveShadow=true;cupGroup.add(shell);
 const rimHighlight=new THREE.Mesh(new THREE.TorusGeometry(r*.95,.013,7,40),
  new THREE.MeshBasicMaterial({color:0xf6e2bc,transparent:true,opacity:.65}));
 rimHighlight.rotation.x=Math.PI/2;rimHighlight.position.y=h+.018;cupGroup.add(rimHighlight);
 if(kind!==4&&kind!==5){
  const trim=new THREE.Mesh(new THREE.TorusGeometry(r*.77,.020,8,36),
   createMat(kind===6?0xe8a968:0x8b9a99,.38,.22));
  trim.rotation.x=Math.PI/2;trim.position.y=h*.18;cupGroup.add(trim);
 }
 const inner=new THREE.Mesh(new THREE.CylinderGeometry(r*.93,r*.71,h*.91,30,1,true),
  new THREE.MeshStandardMaterial({color:0x505d61,side:THREE.BackSide,roughness:.7}));
 inner.position.y=h/2;cupGroup.add(inner);
 cupFloor=new THREE.Mesh(new THREE.CircleGeometry(r*.70,28),insideMat);
 cupFloor.rotation.x=-Math.PI/2;cupFloor.position.y=.045;cupGroup.add(cupFloor);
 const lip=new THREE.Mesh(new THREE.TorusGeometry(r*.98,.028,9,36),lipMat);
 lip.rotation.x=Math.PI/2;lip.position.y=h;cupGroup.add(lip);
 if(settings.lid){
  // Visibly hinged timed lid. Landing while closed never scores.
  const hinge=new THREE.Group();
  hinge.position.set(r*1.03,h+.045,0);cupGroup.add(hinge);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(r*1.04,r*1.04,.064,26),
   createMat(0x9eafad,.44,.24));
  cap.position.set(-r*1.03,0,0);cap.castShadow=true;hinge.add(cap);
  const stripe=meshBox(hinge,r*.62,.013,.085,-r*.98,.038,0,
   new THREE.MeshBasicMaterial({color:0xffdb96}));
  stripe.castShadow=false;
  const hingePin=new THREE.Mesh(new THREE.CylinderGeometry(.063,.063,.26,12),
   createMat(0x627a82,.38,.52));
  hingePin.rotation.x=Math.PI/2;hingePin.position.set(0,0,0);hinge.add(hingePin);
  cupLid={hinge,indicator:new THREE.MeshBasicMaterial({color:0xcc816f})};
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.068,10,8),cupLid.indicator);
  beacon.position.set(r*1.27,h+.08,0);cupGroup.add(beacon);
 }
 if(kind===1){
  const handle=new THREE.Mesh(new THREE.TorusGeometry(r*.4,.085,8,22),cupMat);
  handle.rotation.y=Math.PI/2;handle.position.set(r*1.12,h*.55,0);cupGroup.add(handle);
 }
 if(kind===2){
  for(const side of [-1,1])meshBox(cupGroup,.10,h*.75,.08,side*r*.85,h*.52,0,lipMat);
 }
 if(kind===4||kind===5){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.96,r*.7,h*.77,20,1,true),
   new THREE.MeshStandardMaterial({color:kind===4?0xabb7b1:0x927965,transparent:true,opacity:.47,wireframe:true}));
  mesh.position.y=h*.4;cupGroup.add(mesh);
 }
 if(kind===6){
  const gold=createMat(0xe4ba6c,.35,.46);
  for(const side of [-1,1]){
   const handle=new THREE.Mesh(new THREE.TorusGeometry(r*.38,.06,7,18),gold);
   handle.rotation.y=Math.PI/2;handle.position.set(side*r*.97,h*.66,0);cupGroup.add(handle);
  }
 }
 target={x:settings.x,z:settings.targetZ,y:.19+settings.topPad,top:.19+settings.topPad+h,r,kind};
 // The tray/pad follows lateral target motion, not the entire desk.
 meshBox(cupGroup,r*2.5,.09,r*2.5,0,-.10,0,cream);
 // A lively original coworker anchors the office perspective. Always
 // placed on the opposite side from the target so they never hide its rim.
 // Outfit and desk pose change by stage rather than repeating one backdrop.
 const coworkerX=settings.x>=0?-2.25:2.25;
 const coworkerZ=settings.targetZ-1.55;
 if(settings.sceneId!==2||settings.tier%2===0){
  const colleague=officeColleague(group,coworkerX,coworkerZ,level);
  colleague.rotation.y=(settings.tier%3-1)*.19;
  ambient.push({type:'colleague',obj:colleague});
  officeChair(group,coworkerX,coworkerZ+.43);
  const desktop=meshBox(group,2.25,.13,1.05,coworkerX,1.07,coworkerZ-.23,wood);
  const cup=createMat(0xb8a18d,.58,.05);
  const coworkerMug=new THREE.Mesh(new THREE.CylinderGeometry(.13,.115,.20,12),cup);
  coworkerMug.position.set(coworkerX+((level%2)?-.68:.68),1.25,coworkerZ-.38);
  group.add(coworkerMug);
 }
 const targetMarker=new THREE.Mesh(new THREE.PlaneGeometry(1.50,.36),
  makeText('YOUR TARGET',31,'#fff0da','#40505b'));
 targetMarker.position.set(settings.x+1.05,settings.topPad+1.72,settings.targetZ-1.20);group.add(targetMarker);
 // Every level gets its own recognizable environmental centerpiece,
 // positioned to the SIDE of the goal so visual variety never hides the cup.
 const feature=new THREE.Group();
 const featureSide=settings.x>=0?-1:1;
 feature.position.set(featureSide*4.30,0,settings.targetZ-1.15);
 group.add(feature);
 const stone=createMat(0x9a9d93,.67),brass=createMat(0xbda078,.46,.30);
 const tile=createMat(0x72949d,.66),ink=createMat(0x465761,.65);
 const woodPaper=createMat(0xc4b6a1,.91),colored=createMat(0xc88b79,.62);
 const drawer=createMat(0x7d8988,.45,.32);
 const pole=(height=2.4)=>meshBox(feature,.13,height,.14,0,height/2,0,metal);
 switch(settings.feature){
  case 'sticky':case 'folders':case 'binders':case 'letters':{
   meshBox(feature,1.78,1.85,.25,0,2.15,0,wood);
   for(let i=0;i<12;i++){
    const x=(i%4-1.5)*.33,y=1.55+Math.floor(i/4)*.47;
    meshBox(feature,.25,.32,.025,x,y,-.15,
     createMat([0xe0c68d,0xb8c5b3,0xaabcca,0xcdaba7][(i+level)%4],.89));
   }break;
  }
  case 'kettle':case 'coffee':case 'lunch':case 'teapot':{
   meshBox(feature,2.25,.18,1.0,0,1.10,0,wood);
   const kettle=new THREE.Mesh(new THREE.CylinderGeometry(.36,.40,.75,20),
    createMat(0xb1b6b4,.30,.5));kettle.position.set(-.5,1.59,0);feature.add(kettle);
   const lid=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),ink);
   lid.scale.y=.18;lid.position.set(-.5,2.00,0);feature.add(lid);
   for(let i=0;i<3;i++){
    const mug=new THREE.Mesh(new THREE.CylinderGeometry(.14,.11,.23,12),colored);
    mug.position.set(.18+i*.34,1.32,0);feature.add(mug);
   }break;
  }
  case 'printer':case 'scanner':case 'shredder':{
   meshBox(feature,1.92,1.55,1.15,0,.84,0,drawer);
   meshBox(feature,1.72,.22,.94,0,1.70,0,ink);
   meshBox(feature,1.32,.09,.82,0,1.87,-.05,stone);
   for(let i=0;i<5;i++)
    meshBox(feature,1.10,.023,.71,0,1.92+i*.035,-.10,woodPaper);
   meshBox(feature,.84,.28,.10,0,1.02,.61,ink);
   break;
  }
  case 'sunblind':case 'glass':case 'whiteboard':{
   meshBox(feature,2.35,2.1,.17,0,2.8,0,cream);
   meshBox(feature,2.11,1.91,.045,0,2.8,-.13,tile);
   if(settings.feature==='sunblind')for(let i=0;i<8;i++)
    meshBox(feature,2.13,.075,.025,0,1.95+i*.24,-.16,woodPaper);
   else for(let i=0;i<5;i++)
    meshBox(feature,.23+i*.18,.045,.05,-.70,2.40+i*.20,-.17,
     createMat([0x729fa9,0xb89076][i%2]));
   break;
  }
  case 'dualmonitors':case 'reception':case 'elevator':{
   meshBox(feature,2.85,.20,1.05,0,1.10,0,wood);
   for(const xx of [-.72,.72]){
    meshBox(feature,1.04,.80,.12,xx,1.79,0,ink);
    meshBox(feature,.87,.63,.04,xx,1.79,-.08,tile);
    meshBox(feature,.07,.43,.08,xx,1.26,.04,metal);
   }break;
  }
  case 'archive':case 'packages':case 'conveyor':case 'forklift':{
   for(let i=0;i<3;i++){
    meshBox(feature,2.2,.18,1.45,0,.62+i*.85,0,metal);
    for(let j=0;j<3;j++)
     meshBox(feature,.55,.48,.77,(j-1)*.67,.94+i*.85,0,
      createMat([0xb9a184,0x8c989c,0xa78e78][(i+j)%3]));
   }break;
  }
  case 'trophies':case 'mailbox':{
   meshBox(feature,2.2,.18,.95,0,1.18,0,wood);
   for(const xx of [-.65,0,.65]){
    meshBox(feature,.18,.40,.18,xx,1.50,0,brass);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.21,.12,.32,16),brass);
    cup.position.set(xx,1.84,0);feature.add(cup);
    const top=new THREE.Mesh(new THREE.TorusGeometry(.21,.034,7,20),cream);
    top.rotation.x=Math.PI/2;top.position.set(xx,2.02,0);feature.add(top);
   }break;
  }
  case 'fan':case 'airvent':{
   pole(2.1);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.73,.06,9,26),metal);
   ring.position.set(0,2.33,0);feature.add(ring);
   for(let i=0;i<6;i++){
    const blade=meshBox(feature,.15,.62,.05,0,2.35,0,tile);
    blade.rotation.z=i*Math.PI/3;
   }break;
  }
  default:{
   pole(1.7);
   meshBox(feature,2.0,.18,.80,0,1.47,0,wood);
   for(let i=0;i<5;i++)
    meshBox(feature,.27,.36,.41,(i-2)*.33,1.73,0,
     createMat([0x779ca2,0xbcaa8a,0x8f8a9e][i%3]));
  }
 }
 // Named art-direction plaque and lighting, unique on EACH level.
 roundedPoster(group,settings.challenge.toUpperCase(),0,6.10,roomEnd+.40);
 // Level-specific set dressing: practical office obstacles at distinctly
 // different heights, foreground silhouettes, and a different challenge path.
 if(settings.sceneId===0){
  stackBooks(group,-2.4,1.18,settings.targetZ+.66,2+(level%4),level+1);
  plant(group,3.3,settings.targetZ-1.4,.9);
 }else if(settings.sceneId===1){
  const projector=meshBox(group,1.28,.35,.85,2.0,2.2,settings.targetZ+.8,dark);
  projector.rotation.y=.14;
  for(let k=0;k<3;k++)meshBox(group,.65,.025,.38,-2.8+k*.7,1.17,settings.targetZ+.9,paper);
 }else if(settings.sceneId===2){
  for(let k=0;k<3;k++){
   meshBox(group,.9,.63,.75,3.7,(k+.5)*.66,settings.targetZ+.8,
    createMat(k%2?0x9e927d:0x8f9d99,.85));
  }
 }else if(settings.sceneId===3){
  const kettleMat=createMat(0xa8acaa,.3,.48);
  const urn=new THREE.Mesh(new THREE.CylinderGeometry(.27,.34,.67,20),kettleMat);
  urn.position.set(-2.6,1.6,settings.targetZ+.65);group.add(urn);
  for(let k=0;k<3;k++){
   const tray=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.045,16),cream);
   tray.position.set(2.9,1.15+k*.09,settings.targetZ+.6);group.add(tray);
  }
 }else{
  // Late-shift cubicle: clusters of luminous monitors on the side desk.
  for(let k=0;k<3;k++){
   const screen=meshBox(group,.65,.53,.10,-2.4+k*.8,1.84,settings.targetZ+.6,dark);
   meshBox(group,.52,.40,.013,screen.position.x,screen.position.y,screen.position.z+.06,
    createMat(0x476a7b,.3,.05,0x263f4b));
  }
 }
 // Bank-shot trays: an actual rubberized office trolley surface. The ball
 // must physically fall onto its center and rebound before the shot counts.
 // These are present in selected levels from chapter one onward.
 if(settings.bankRequired){
  const x=settings.bankX,z=settings.bankZ,padY=1.22;
  const bankMat=createMat(0x405764,.81,.02),rubber=createMat(0xbb7861,.88,.02);
  const tape=createMat(0xffdf87,.53,.02);
  const tray=new THREE.Group();tray.position.set(x,0,z);group.add(tray);
  specialSurfaces.push(tray);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   meshBox(tray,.09,1.02,.09,sx*.78,.56,sz*.83,metal);
  }
  meshBox(tray,1.88,.13,2.02,0,1.11,0,bankMat);
  meshBox(tray,1.78,.045,1.91,0,1.201,0,rubber);
  for(const edge of [-1,1]){
   meshBox(tray,.065,.023,1.72,edge*.78,1.236,0,tape);
   meshBox(tray,1.58,.023,.065,0,1.236,edge*.86,tape);
  }
  const bankLabel=new THREE.Mesh(new THREE.PlaneGeometry(1.53,.37),
   makeText('BOUNCE HERE',36,'#fff4ce','#674d43'));
  bankLabel.rotation.x=-Math.PI/2;bankLabel.position.set(0,1.239,.0);tray.add(bankLabel);
  pads.push({type:'bank',x,z,r:.88,y:padY,mat:rubber,last:-10});
 }
 // Stage-specific obstacles are authored one at a time in STAGES[].
 // The obstacle type, trajectory fraction and left/right placement are never
 // generated from stage number, preserving 50 recognizably different puzzles.
 for(let i=0;i<settings.obstaclePlan.length;i++){
  const [style,t,offset]=settings.obstaclePlan[i];
  const x=settings.x*t+offset,z=LAUNCH_Z-settings.d*t;
  const g=new THREE.Group();g.position.set(x,0,z);group.add(g);
  const officePaints=[0x7f9298,0xc5a17f,0x8b9c8f,0xb88e8a,0x607581];
  const paint=createMat(officePaints[(i+settings.sceneId)%5],.72);
  let oy=1.65,w=.80,h=.86,depth=.52;
  if(style==='screen'||style==='monitor'){
   oy=2.22;w=1.02;h=.78;depth=.22;
   meshBox(g,w,h,depth,0,oy,0,dark);
   meshBox(g,w*.86,.58,.04,0,oy,-.14,createMat(0x3e6774,.46));
   meshBox(g,.13,1.12,.13,0,1.34,.10,metal);
  }else if(style==='partition'){
   oy=2.02;w=.82;h=1.82;depth=.24;
   meshBox(g,w,h,depth,0,oy,0,createMat(0x7d9298));
   meshBox(g,w*.9,.14,.29,0,oy+h*.5,0,metal);
   for(let k=0;k<3;k++)meshBox(g,.46,.10,.025,0,oy+.3-k*.22,-.135,paper);
  }else if(style==='printer'||style==='projector'){
   oy=1.77;w=1.15;h=.55;depth=.88;
   meshBox(g,w,h,depth,0,oy,0,createMat(0x9ba6a5,.37,.28));
   meshBox(g,.68,.07,.32,0,oy+.18,-.50,dark);
   meshBox(g,.16,.08,.04,-.36,oy+.17,-.455,highlight);
   if(style==='projector')meshBox(g,.2,.19,.09,0,oy,-.50,cream);
  }else if(style==='mugstack'||style==='teapot'){
   oy=1.51;w=.62;h=.78;depth=.55;
   for(let k=0;k<3;k++){
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.19,.16,.25,14),
     createMat([0xc29d82,0x8eb6bb,0xc9b17d][k]));
    cyl.position.set(Math.sin(k*2.3)*.09,1.18+k*.24,0);g.add(cyl);
   }
  }else if(style==='plant'){
   oy=1.57;w=.72;h=1.12;depth=.72;plant(g,0,0,.98);
   g.position.y=1.02;
  }else if(style==='lamp'){
   oy=2.04;w=.65;h=.98;depth=.53;
   meshBox(g,.09,1.15,.09,0,1.66,0,metal);
   const shade=new THREE.Mesh(new THREE.ConeGeometry(.32,.42,12),paint);
   shade.position.y=2.35;shade.rotation.z=Math.PI;g.add(shade);
  }else if(style==='cart'){
   oy=1.45;w=1.02;h=.96;depth=1;
   meshBox(g,1.06,.11,1.02,0,1.80,0,metal);
   meshBox(g,1.02,.12,.95,0,1.12,0,metal);
   for(const sx of [-1,1])for(const sz of [-1,1])
    meshBox(g,.10,.80,.10,sx*.42,1.40,sz*.43,dark);
  }else if(style==='books'||style==='files'||style==='folders'){
   oy=1.82;w=.98;h=.66;depth=.65;
   for(let k=0;k<5;k++){
    const item=meshBox(g,style==='files'?.17:.98,
     style==='files'?.64:.095,style==='files'?.60:.66,
     style==='files'?(k-2)*.17:Math.sin(k)*.05,
     style==='files'?1.54:1.40+k*.12,0,
     createMat([0xb88572,0x7799a5,0xc9b18e,0x839782,0x9a879f][k]));
    item.rotation.y=k%2?.06:-.06;
   }
  }else{
   // Parcels and generic padded trays are still physically meaningful.
   oy=1.60;w=.90;h=.73;depth=.75;
   for(let k=0;k<3;k++)
    meshBox(g,.80,.23,.70,0,1.25+k*.25,0,paint);
   meshBox(g,.03,.65,.78,0,1.50,0,cream);
  }
  obstacles.push({type:style,obj:g,x,y:style==='plant'?1.62:oy,
   z,w,h,d:depth});
 }
 // Only Chapter 4+ introduces moving blockers. Their positions and timing
 // are explicit in each level blueprint, not a repeated evenly spaced gate.
 for(let i=0;i<settings.barrierPlan.length;i++){
  const [style,t,offset,midY]=settings.barrierPlan[i];
  const x=settings.x*t+offset,z=LAUNCH_Z-settings.d*t;
  const g=new THREE.Group();g.position.set(x,midY,z);group.add(g);
  const shutter=style==='panel';
  const body=createMat(shutter?0x889fab:0xa08b82,.55,.18);
  meshBox(g,shutter?1.05:1.14,shutter?.52:.31,.24,0,0,0,body);
  meshBox(g,.53,.042,.05,0,.04,-.15,cream);
  // Ceiling-mounted shutter lifts vertically; filing drawers slide sideways.
  if(shutter){
   for(const side of [-1,1]){
    meshBox(group,.09,1.18,.13,x+side*.61,midY+.49,z,metal);
   }
  }else{
   meshBox(group,2.18,.055,.28,x,midY-.26,z,dark);
  }
  const amp=shutter?.48:.64;
  obstacles.push({type:'barrier',style,obj:g,x,y:midY,z,
   w:shutter?1.05:1.14,h:shutter?.52:.31,d:.24,
   centerX:x,centerY:midY,amp,speed:.72+i*.18+settings.tier*.035,
   phase:i*1.8+settings.n*.17});
 }
 // Ambient crosswind comes from a visible, grounded fan; a light room-wide
 // draft is retained so existing wind levels keep their authored difficulty.
 if(Math.abs(settings.wind)>.001){
  const side=settings.wind>=0?-1:1,z=LAUNCH_Z-settings.d*.50;
  const fan=officeFan(group,side*2.75,z,metal,-side*Math.PI/2,'cross');
  ambient.push({type:'fan',obj:fan});
  addFanJet({kind:'cross',side,power:Math.abs(settings.wind)*1.65},
   side*2.75,z,fan,'ROOM VENT');
 }

 // Wall-cushion ricochet: actual mesh AND actual side-plane collision. An
 // illuminated frame clearly shows the only surface that counts as a wall bank.
 if(settings.wall){
  const side=settings.wall.side,x=side*2.16,z=LAUNCH_Z-settings.d*.52;
  const wall=new THREE.Group();wall.position.set(x,2.42,z);group.add(wall);
  specialSurfaces.push(wall);
  const rubber=createMat(0x617780,.82,.03),stripe=createMat(0xf2bb7a,.43,.02,0x4a291a);
  meshBox(wall,.17,3.55,3.65,0,0,0,rubber);
  for(let k=0;k<8;k++)
   meshBox(wall,.024,3.18,.065,-side*.109,0,-1.46+k*.42,stripe);
  for(const zz of [-1.89,1.89])
   meshBox(wall,.23,3.7,.10,0,0,zz,createMat(0x324d58,.35,.38));
  for(const yy of [-1.76,1.76])
   meshBox(wall,.23,.1,3.8,0,yy,0,createMat(0x324d58,.35,.38));
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.75,.32),
   makeText('BANK HERE',46,'#ffeac0','#485d65'));
  sign.rotation.y=side*Math.PI/2;
  sign.position.set(-side*.15,1.43,0);wall.add(sign);
  const indicator=new THREE.PointLight(0xf6c18d,2.2,3.7,2);
  indicator.position.set(-side*.38,.4,0);wall.add(indicator);
  wallPad={x,z,side,y:2.42,height:3.55,length:3.65,mesh:wall};
 }
 // Sequential 3D hoops: pass through the physical vertical ring plane before
 // the cup. Their centers follow the reference arc but can oscillate.
 for(let i=0;i<settings.hoops;i++){
  const fraction=settings.hoops===1?.39:(i===0?.24:.40);
  const pitch=settings.springRequired?.32:settings.bankRequired?.31:.70;
  const dist=settings.d*fraction,range=settings.bankRequired?
   Math.hypot(LAUNCH_Z-settings.bankZ,settings.bankX):
   settings.springRequired?LAUNCH_Z-settings.springZ:Math.hypot(settings.d,settings.x);
  const hRequired=settings.bankRequired?1.22+BALL_R:
   settings.springRequired?1.21+BALL_R:.19+settings.topPad+settings.targetHeight-BALL_R;
  const speed=Math.sqrt(Math.max(1,GRAVITY*range*range/
   Math.max(.08,2*Math.cos(pitch)**2*(range*Math.tan(pitch)+LAUNCH_Y-hRequired))));
  const effective=clamp((speed-5.6)/8.2,.06,.97)*8.2+5.6;
  const t=dist/(Math.cos(pitch)*effective);
  const y=clamp(LAUNCH_Y+Math.sin(pitch)*effective*t-GRAVITY*t*t*.5,1.05,5.4);
  const x=settings.x*fraction;
  const z=LAUNCH_Z-dist;
  const radius=settings.hoops>1?.86:.93;
  const anchor=new THREE.Group();anchor.position.set(x,y,z);group.add(anchor);
  specialSurfaces.push(anchor);
  const material=new THREE.MeshStandardMaterial({
   color:0xffedb2,emissive:0xffc777,emissiveIntensity:1.25,
   metalness:.18,roughness:.24
  });
  // The actual solid rim retains its radius and collision tube (.065).
  const torus=new THREE.Mesh(new THREE.TorusGeometry(radius,.065,14,64),material);
  torus.castShadow=true;anchor.add(torus);
  // Soft additive glow, without full-frame bloom that washes out the ball.
  const glows=[];
  for(const [extra,tube,alpha] of [[.006,.095,.18],[.012,.16,.10],[.022,.25,.045]]){
   const glowMaterial=new THREE.MeshBasicMaterial({
    color:0xffd999,transparent:true,opacity:alpha,depthWrite:false,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide
   });
   const glow=new THREE.Mesh(new THREE.TorusGeometry(radius+extra,tube,14,64),glowMaterial);
   glow.castShadow=false;glow.renderOrder=2;anchor.add(glow);
   glows.push({material:glowMaterial,base:alpha});
  }
  const coreMaterial=new THREE.MeshBasicMaterial({
   color:0xfff7d7,transparent:true,opacity:.94,depthWrite:false,
   blending:THREE.AdditiveBlending
  });
  const core=new THREE.Mesh(new THREE.TorusGeometry(radius+.018,.014,8,72),coreMaterial);
  core.renderOrder=3;anchor.add(core);
  const ringLight=new THREE.PointLight(0xffd69b,.82,2.6,2);
  ringLight.position.set(0,0,.30);anchor.add(ringLight);
  const numberLabel=new THREE.Mesh(new THREE.PlaneGeometry(.5,.24),
   makeText('RING '+(i+1),36,'#f3edd0','#385a61'));
  numberLabel.position.set(0,-radius-.32,.04);anchor.add(numberLabel);
  hoops.push({x,y,z,r:radius,baseX:x,baseY:y,mesh:anchor,
   material,glows,coreMaterial,ringLight,passed:false,
   phase:i*1.8+settings.n*.16});
 }
 // Special fans emit actual forces at the exact positions of their grille,
 // accompanied by moving air markers in the SAME 3D volume.
 if(settings.fanZone){
  const spec=settings.fanZone,z=LAUNCH_Z-settings.d*.52;
  const x=spec.kind==='lift'?settings.x*.43:spec.side*2.75;
  const yaw=spec.kind==='lift'?0:-spec.side*Math.PI/2;
  const device=officeFan(group,x,z,createMat(0x7998a2,.34,.40),yaw,spec.kind);
  ambient.push({type:'fan',obj:device});
  airZone=addFanJet(spec,x,z,device,spec.kind==='lift'?'UPDRAFT':'SIDE JET');
 }
 // Chapter 5: rubber launch plates on actual rolling office carts.
 for(let i=0;i<settings.padCount;i++){
  const z=lerp(LAUNCH_Z-.9,settings.targetZ,(i+1)/(settings.padCount+1));
  const x=i===0?0:settings.x*.48,padY=1.16+(i===1?.27:0);
  const cart=new THREE.Group();cart.position.set(x,0,z);group.add(cart);
  specialSurfaces.push(cart);
  meshBox(cart,1.8,.15,1.8,0,padY-.17,0,metal);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   meshBox(cart,.12,padY-.20,.12,sx*.73,(padY-.20)/2,sz*.73,dark);
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.07,10),dark);
   wheel.rotation.z=Math.PI/2;wheel.position.set(sx*.73,.12,sz*.73);cart.add(wheel);
  }
  const spring=new THREE.Mesh(new THREE.CylinderGeometry(.76,.76,.085,26),
    createMat(0x5a9593,.25,.08,0x6ae5ba));
  spring.position.y=padY;cart.add(spring);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.77,.055,8,30),
    new THREE.MeshBasicMaterial({color:0xd3ffbe}));
  ring.rotation.x=Math.PI/2;ring.position.y=padY+.065;cart.add(ring);
  pads.push({type:'spring',x,z,r:.74,y:padY+.05,mat:spring.material,last:-10});
 }
 // Subtle dust motes in illuminated air. Each room feels occupied,
 // especially when viewed toward the window; purely decorative.
 const motes=new THREE.Group();group.add(motes);
 const moteMat=new THREE.MeshBasicMaterial({
  color:settings.roomVariant?0xb6d0dc:0xffe8c0,transparent:true,
  opacity:.20,depthWrite:false
 });
 for(let i=0;i<16;i++){
  const phase=i*2.39996,xx=Math.sin(phase)*3.5,zz=settings.targetZ+2.2+(i%6)*1.2;
  const sprite=new THREE.Mesh(new THREE.SphereGeometry(.017+(i%3)*.007,5,4),moteMat);
  sprite.position.set(xx,2.0+(i%5)*.75,zz);motes.add(sprite);
 }
 ambient.push({type:'dust',obj:motes});
 // Projectile is deliberately warm orange, outlined, large enough to TRACK,
 // strongly contrasting with the dark gray office instead of washing out.
 const ballMaterial=new THREE.MeshStandardMaterial({
  color:0xffbd72,roughness:.22,metalness:0,
  emissive:0x804119,emissiveIntensity:.30
 });
 ballMesh=new THREE.Mesh(new THREE.SphereGeometry(BALL_R*1.08,24,18),ballMaterial);
 ballMesh.castShadow=true;ballMesh.position.set(0,LAUNCH_Y,LAUNCH_Z);group.add(ballMesh);
 const ringPaint=new THREE.MeshBasicMaterial({color:0x733b23});
 for(const angle of [0,Math.PI/2]){
  const seam=new THREE.Mesh(new THREE.TorusGeometry(BALL_R*1.075,.003,5,32),ringPaint);
  seam.rotation.y=angle;ballMesh.add(seam);
 }
 // Soft contact shadow only, not a pale ball on a pale tabletop.
 ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.20,24),
  new THREE.MeshBasicMaterial({color:0x1c282f,transparent:true,opacity:.27,depthWrite:false}));
 ballShadow.rotation.x=-Math.PI/2;ballShadow.position.set(0,1.15,LAUNCH_Z);group.add(ballShadow);
 impactRing=new THREE.Mesh(new THREE.TorusGeometry(.21,.024,8,32),
  new THREE.MeshBasicMaterial({color:0xffd49a,transparent:true,opacity:0,
   depthWrite:false,side:THREE.DoubleSide}));
 impactRing.rotation.x=-Math.PI/2;impactRing.visible=false;group.add(impactRing);
 // Short motion trail keeps the smaller ball visible without increasing it.
 const trailGeometry=new THREE.SphereGeometry(BALL_R*.62,9,7);
 for(let k=0;k<11;k++){
  const material=new THREE.MeshBasicMaterial({
   color:0xffc58b,transparent:true,opacity:.16*(1-k/11),depthWrite:false
  });
  const bead=new THREE.Mesh(trailGeometry,material);
  bead.visible=false;group.add(bead);ballTrailMeshes.push(bead);
 }
 trajectoryGroup=new THREE.Group();group.add(trajectoryGroup);
 for(let i=0;i<84;i++){
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.040,7,6),
   new THREE.MeshBasicMaterial({color:i%3===0?0xf3b768:0x5c9199,transparent:true,
     opacity:Math.max(.18,.8-i*.014)}));
  dot.visible=false;trajectoryGroup.add(dot);
 }
 aimLine=trajectoryGroup.children;
 // Camera at human eye-height, not the old god's-eye tabletop view.
 // Immersive eye-level fixed viewpoint inspired by tactile desk-flick games.
 // Keep the ball in the lower foreground and the intended container above it.
 const cameraOffsets=[-.10,.23,-.21,.12,-.11,.20,-.16,.15,-.18,.08];
 const cameraHeight=2.20+(settings.tier%4)*.065;
 camera.position.set(cameraOffsets[settings.sceneId],cameraHeight,
  7.87+(settings.tier%3)*.14);
 camera.lookAt(settings.x*.29,1.61,settings.targetZ*.60);
 camera.updateMatrixWorld();
 scene.background.setHex(lightingMode?0x3d4c57:sceneTone);
 if(scene.fog)scene.fog.color.copy(scene.background);
 renderer.setClearColor(scene.background,1);
 buildPhysicsBodies();
 resetBall();paintAim();
}

function idealPower(){
 // For direct throws, aim at the cup opening. For bank shots, aim at the
 // rubber tray's actual physical collision height, not at the cup.
 const d=settings.bankRequired?Math.hypot(LAUNCH_Z-settings.bankZ,settings.bankX):
  settings.springRequired?LAUNCH_Z-settings.springZ:
  Math.hypot(settings.d,settings.x);
 const requiredHeight=settings.bankRequired?1.22+BALL_R:
  settings.springRequired?1.21+BALL_R:
  .19+settings.topPad+settings.targetHeight-BALL_R;
 const t=Math.tan(aimPitch),co=Math.cos(aimPitch);
 const denom=2*co*co*(d*t+LAUNCH_Y-requiredHeight);
 const v=Math.sqrt(Math.max(1,GRAVITY*d*d/Math.max(.08,denom)));
 return clamp((v-5.6)/8.2,.06,.97);
}
function makeVelocity(p){
 const speed=5.6+8.2*p;
 return {
  vx:Math.sin(aimYaw)*Math.cos(aimPitch)*speed,
  vy:Math.sin(aimPitch)*speed,
  vz:-Math.cos(aimYaw)*Math.cos(aimPitch)*speed
 };
}
function windAt(time){
 // A desk fan oscillates rather than blowing at a perfectly constant rate.
 if(settings.gust){
  const wave=Math.sin(time*1.42+settings.n*.3);
  return settings.wind*(.2+.8*Math.max(0,wave));
 }
 return settings.wind*(.66+.34*Math.sin(time*.88+.7));
}
// Deterministic, physically visible target travel. Distinct levels can slide,
// rise on a lift, move towards the player or describe a figure-eight.
function targetLocation(time){
 const a=settings.moving,frequency=.78+(settings.tier%4)*.095,phase=time*frequency;
 let x=settings.x,z=settings.targetZ,y=.19+settings.topPad;
 if(!a)return {x,y,z};
 switch(settings.motion){
  case 'slide':x+=Math.sin(phase)*a;break;
  case 'depth':z+=Math.sin(phase)*a*.80;break;
  case 'lift':y+=(.5+.5*Math.sin(phase))*a*.90;break;
  case 'orbit':x+=Math.sin(phase)*a;z+=Math.cos(phase)*a*.50;break;
  case 'figure8':x+=Math.sin(phase)*a;z+=Math.sin(phase*2)*a*.48;break;
 }
 return {x,y,z};
}
// Pads act like REAL bounce surfaces, not magnets. Outgoing velocity depends
// solely on inbound velocity, contact location and pad material. No target
// coordinates, cup motion or targetLocation() are used to steer the rebound.
// A fan pushes only inside its illustrated 3D air column. Wind is a
// vector impulse; no target location enters the calculation.
// Collision system: every solid office mesh (desks, shelves, monitor
// housings, drawers, books, machinery, plants and architecture) supplies a
// sphere-versus-box contact. Dynamic barriers refresh their bounds each frame;
// targets, hoop rings and specialist rebound pads have dedicated shapes.
function buildPhysicsBodies(){
 if(!group)return;
 group.updateMatrixWorld(true);
 const skip=[cupGroup,throwingHand,trajectoryGroup,ballMesh,ballShadow,
  impactRing,airZone?.cloud,...specialSurfaces,...ballTrailMeshes];
 for(const item of ambient)if(item.type==='dust')skip.push(item.obj);
 const moving=new Map();
 for(const obstacle of obstacles)if(obstacle.type==='barrier')
  obstacle.obj.traverse(m=>{if(m.isMesh)moving.set(m,obstacle);});
 physicsBodies=[];physicsGrid=new Map();physicsGlobal=[];physicsMoving=[];
 group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry)return;
  for(let p=mesh;p;p=p.parent)if(skip.includes(p))return;
  const type=mesh.geometry.type;
  if(!['BoxGeometry','CylinderGeometry','ConeGeometry','SphereGeometry'].includes(type))return;
  const mat=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
  if(mat?.transparent&&mat.opacity<.75)return;
  mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  // Only collision surfaces in or bordering the playable room matter.
  if(bounds.max.z<settings.targetZ-4.8||bounds.min.z>LAUNCH_Z+3.6)return;
  const metal=mat?.metalness||0,rough=mat?.roughness??.65;
  const restitution=metal>.28?.76:rough>.84?.48:.62;
  physicsBodies.push({mesh,box:bounds,local:mesh.geometry.boundingBox.clone(),
   owner:moving.get(mesh)||null,restitution,friction:metal>.28?.065:.13});
 });
 // Broad-phase grid: a ball tests only nearby furniture, not every shelf,
 // cabinet and background prop on every simulation substep.
 const cell=2;
 for(const item of physicsBodies){
  if(item.owner){physicsMoving.push(item);continue;}
  const b=item.box,x0=Math.floor((b.min.x-BALL_R)/cell),
   x1=Math.floor((b.max.x+BALL_R)/cell),
   z0=Math.floor((b.min.z-BALL_R)/cell),
   z1=Math.floor((b.max.z+BALL_R)/cell);
  if((x1-x0+1)*(z1-z0+1)>85){physicsGlobal.push(item);continue;}
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
   const key=x+','+z;
   if(!physicsGrid.has(key))physicsGrid.set(key,[]);
   physicsGrid.get(key).push(item);
  }
 }
}
function bounceContact(body,nx,ny,nz,depth,rest=.62,friction=.1,
 surfaceX=0,surfaceY=0,surfaceZ=0,preview=false){
 const magnitude=Math.hypot(nx,ny,nz);
 if(magnitude<.00001)return false;
 nx/=magnitude;ny/=magnitude;nz/=magnitude;
 body.x+=nx*Math.max(depth+.001,0);
 body.y+=ny*Math.max(depth+.001,0);
 body.z+=nz*Math.max(depth+.001,0);
 const vx=body.vx-surfaceX,vy=body.vy-surfaceY,vz=body.vz-surfaceZ;
 const incoming=vx*nx+vy*ny+vz*nz;
 if(incoming>=-.006)return false;
 const tangent=Math.max(0,1-friction);
 // Friction damps only sideways slip; restitution controls the normal bounce.
 const normalOut=-incoming*rest;
 body.vx=surfaceX+(vx-incoming*nx)*tangent+normalOut*nx;
 body.vy=surfaceY+(vy-incoming*ny)*tangent+normalOut*ny;
 body.vz=surfaceZ+(vz-incoming*nz)*tangent+normalOut*nz;
 if(!preview){
  body.contacts=(body.contacts||0)+1;
  updateBounceCount();
  if(impactRing){
   impactRing.position.set(body.x-nx*BALL_R,body.y-ny*BALL_R,body.z-nz*BALL_R);
   impactRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),
    new THREE.Vector3(nx,ny,nz));
   impactRing.material.color.setHex(rest>.69?0xb5ddec:0xffd6a0);
   impactAge=0;impactRing.visible=true;
  }
  if(!body.lastHitTime||simTime-body.lastHitTime>.08){
   body.lastHitTime=simTime;
   hear(rest>.69?530:360,.075,'triangle',Math.min(.035,.008+Math.abs(incoming)*.003));
  }
 }
 return true;
}
function resolveEnvironment(body,preview=false){
 // Colliders are prebuilt, so most throw steps only perform a few comparisons.
 let reacted=false;
 for(let pass=0;pass<2;pass++){
  let candidate=null,penetration=0;
  const key=Math.floor(body.x/2)+','+Math.floor(body.z/2);
  const candidates=[physicsGrid.get(key)||[],physicsGlobal,physicsMoving];
  for(const bucket of candidates)for(const item of bucket){
   const b=item.box;
   if(body.x<b.min.x-BALL_R||body.x>b.max.x+BALL_R||
    body.y<b.min.y-BALL_R||body.y>b.max.y+BALL_R||
    body.z<b.min.z-BALL_R||body.z>b.max.z+BALL_R)continue;
   const qx=clamp(body.x,b.min.x,b.max.x),qy=clamp(body.y,b.min.y,b.max.y),
    qz=clamp(body.z,b.min.z,b.max.z);
   let nx=body.x-qx,ny=body.y-qy,nz=body.z-qz;
   const d2=nx*nx+ny*ny+nz*nz;
   if(d2>=BALL_R*BALL_R)continue;
   let depth;
   if(d2>.0000001){
    depth=BALL_R-Math.sqrt(d2);
   }else{
    // Ball center landed inside a thin slab: move to closest outward face.
    const faces=[
     [body.x-b.min.x,-1,0,0],[b.max.x-body.x,1,0,0],
     [body.y-b.min.y,0,-1,0],[b.max.y-body.y,0,1,0],
     [body.z-b.min.z,0,0,-1],[b.max.z-body.z,0,0,1]
    ].sort((a,b)=>a[0]-b[0]);
    nx=faces[0][1];ny=faces[0][2];nz=faces[0][3];
    depth=BALL_R+faces[0][0];
   }
   if(depth>penetration){candidate={item,nx,ny,nz,depth};penetration=depth;}
  }
  if(!candidate)break;
  const {item,nx,ny,nz,depth}=candidate;
  const o=item.owner,vx=o?.type==='barrier'&&o.style!=='panel'?
   Math.cos(simTime*o.speed+o.phase)*o.amp*o.speed:0;
  const vy=o?.type==='barrier'&&o.style==='panel'?
   Math.cos(simTime*o.speed+o.phase)*.65*o.speed:0;
  if(bounceContact(body,nx,ny,nz,depth,item.restitution,
   item.friction,vx,vy,0,preview))reacted=true;
 }
 return reacted;
}
function cupSurfaceCollision(body,preview=false,time=simTime){
 const targetAt=preview?targetLocation(time):target;
 const base=targetAt.y,up=base+settings.targetHeight,r=target.r;
 const dx=body.x-targetAt.x,dz=body.z-targetAt.z,rad=Math.hypot(dx,dz);
 if(rad>r+BALL_R+.1)return false;
 // Closed lids cover the cup opening with a horizontal collision plane.
 if(settings.lid&&lidFraction(time)<=.61&&
    rad<r-BALL_R*.2&&body.y<=up+BALL_R&&body.y>=up-BALL_R*.75&&body.vy<0)
  return bounceContact(body,0,1,0,up+BALL_R-body.y,.56,.12,0,0,0,preview);
 // Rounded lip/rim: ball glances and kicks outward rather than disappearing.
 const nearRim=Math.abs(rad-r)<BALL_R+.033&&Math.abs(body.y-up)<BALL_R+.034&&
  Math.hypot(rad-r,body.y-up)<BALL_R+.033;
 if(nearRim){
  const direction=Math.max(rad,.001),dr=rad-r,dy=body.y-up;
  const n=Math.hypot(dr,dy)||1;
  return bounceContact(body,dr/n*dx/direction,dy/n,dr/n*dz/direction,
   BALL_R+.03-n,.77,.06,0,0,0,preview);
 }
 // Cylindrical container wall, including glancing contact from the side.
 if(body.y>base+BALL_R*.5&&body.y<up-BALL_R*.22&&
    Math.abs(rad-r)<BALL_R){
  const direction=Math.max(rad,.001),sign=rad>=r?1:-1;
  return bounceContact(body,dx/direction*sign,0,dz/direction*sign,
   BALL_R-Math.abs(rad-r),.59,.14,0,0,0,preview);
 }
 // The ball can settle and rebound from the visible cup bottom.
 if(rad<r-BALL_R*.4&&body.y<base+BALL_R+.05&&body.y>base-BALL_R)
  return bounceContact(body,0,1,0,base+BALL_R-body.y,.42,.26,0,0,0,preview);
 return false;
}
function hoopRimCollision(body,time,preview=false){
 let touched=false;
 for(const gate of hoops){
  const g=hoopMotion(gate,time),dx=body.x-g.x,dy=body.y-g.y,
   radius=Math.hypot(dx,dy),dz=body.z-g.z;
  const tube=.065,dist=Math.hypot(radius-gate.r,dz);
  if(dist>=BALL_R+tube||dist<.00001)continue;
  const nx=radius>.00001?(dx/radius)*(radius-gate.r)/dist:0;
  const ny=radius>.00001?(dy/radius)*(radius-gate.r)/dist:0;
  const nz=dz/dist;
  if(bounceContact(body,nx,ny,nz,BALL_R+tube-dist,.77,.04,0,0,0,preview))
   touched=true;
 }
 return touched;
}
function airForce(x,y,z,time){
 // A ball is accelerated only INSIDE the physical stream from a fan nozzle.
 // No auto-aiming, target correction or invisible detached force volumes.
 let fx=0,fy=0;
 for(const f of fanFields){
  const axial=f.kind==='lift'?y-f.y:(x-f.x)*f.dir;
  if(axial<-.12||axial>f.reach)continue;
  const progress=clamp(axial/f.reach,0,1);
  const spread=f.kind==='lift'?.55+progress*.72:.85+progress*1.15;
  const dy=f.kind==='lift'?(x-f.x)/spread:(y-f.y)/spread;
  const dz=(z-f.z)/(spread*.92);
  const radial=dy*dy+dz*dz;
  if(radial>=1)continue;
  const flow=Math.pow(1-radial,1.35)*(.92-.35*progress)*
   (.86+.14*Math.sin(time*6.2+f.phase));
  const push=f.power*flow;
  if(f.kind==='lift'){fy+=push;fx+=f.side*push*.12;}
  else{fx+=f.dir*push;fy+=push*.09;}
 }
 return {x:fx,y:fy};
}
function wallCollision(projectile,previousX,preview=false){
 if(!wallPad)return false;
 const w=wallPad;
 const before=previousX-w.x,after=projectile.x-w.x;
 const fromSide=before<0?-1:1;
 const crossed=before*fromSide>BALL_R&&after*fromSide<=BALL_R;
 if(!crossed||
  Math.abs(projectile.z-w.z)>w.length*.5||
  Math.abs(projectile.y-w.y)>w.height*.5)return false;
 // Reflect from EITHER side: the wall is solid even on a second contact.
 projectile.x=w.x+fromSide*(BALL_R+.025);
 projectile.vx=-projectile.vx*.90;
 projectile.vz*=.97;
 projectile.vy+=.18;
 projectile.wallHits=(projectile.wallHits||0)+1;
 if(!preview){
  updateBounceCount();
  message('WALL BANK! · FINISH THE SHOT',1.1);
  el.objective.textContent=settings.hoops?'WALL BANK ✓ · NOW THE HOOPS':'WALL BANK ✓ · SINK THE CUP';
  hear(550,.12,'triangle',.05);
 }
 return true;
}
function hoopMotion(gate,time){
 const amt=settings.hoopMove?.27:0;
 return {x:gate.baseX+Math.sin(time*1.16+gate.phase)*amt,
  y:gate.baseY+Math.cos(time*.97+gate.phase)*amt*.54,z:gate.z};
}
function checkHoopCross(previous,projectile,time,preview=false){
 if(!hoops.length||projectile.vz>=0)return;
 const gate=hoops[projectile.hoopsPassed||0];
 if(!gate||previous.z<gate.z||projectile.z>gate.z)return;
 const alpha=clamp((previous.z-gate.z)/Math.max(.00001,previous.z-projectile.z),0,1);
 const position=hoopMotion(gate,time);
 const crossingX=previous.x+(projectile.x-previous.x)*alpha;
 const crossingY=previous.y+(projectile.y-previous.y)*alpha;
 if(Math.hypot(crossingX-position.x,crossingY-position.y)<gate.r-BALL_R*.75){
  projectile.hoopsPassed=(projectile.hoopsPassed||0)+1;
  if(!preview){
   gate.passed=true;
   gate.material.color.setHex(0x9df6c5);
   gate.material.emissive.setHex(0x63edb5);
   gate.ringLight.color.setHex(0x88ffd0);
   gate.ringLight.intensity=1.2;
   gate.coreMaterial.color.setHex(0xeafff1);
   for(const glow of gate.glows)glow.material.color.setHex(0x8affc4);
   hear(800+projectile.hoopsPassed*120,.10,'sine',.06);
   message('RING '+projectile.hoopsPassed+'/'+hoops.length+' CLEARED!',1.1);
   el.objective.textContent=projectile.hoopsPassed===hoops.length?
    'ALL RINGS CLEARED · SINK THE CUP':
    'RING '+(projectile.hoopsPassed+1)+' NEXT';
   if(settings.lid)el.objective.textContent+=' · CHECK LID';
  }
 }else if(!preview){
  message('MISSED RING '+(projectile.hoopsPassed+1)+' · RETRY THE SHOT',1.0);
 }
}
function padRebound(projectile,pad){
 const offsetX=clamp((projectile.x-pad.x)/pad.r,-1,1);
 const offsetZ=clamp((projectile.z-pad.z)/pad.r,-1,1);
 const impact=Math.abs(Math.min(0,projectile.vy));
 if(pad.type==='spring'){
  // Textured spring absorbs horizontal speed while returning a vertical kick.
  return {
   vx:projectile.vx*.79+offsetX*.44,
   vy:clamp(5.65+impact*.43,5.65,8.2),
   vz:projectile.vz*.53+offsetZ*.35
  };
 }
 // High-friction rubber tray absorbs forward speed. Offset hits deflect subtly.
 return {
  vx:projectile.vx*.78+offsetX*.52,
  vy:clamp(2.75+impact*.79,3.3,7.3),
  vz:projectile.vz*.42+offsetZ*.29
 };
}
function paintAim(){
 if(!hasRenderer||!aimLine.length)return;
 const p=charging?power:idealPower(),v=makeVelocity(p);
 const preview={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:v.vx,vy:v.vy,vz:v.vz,
  wallHits:0,hoopsPassed:0};
 let predictedBounces=0;
 const count=settings.springRequired||settings.bankRequired||settings.wall?79:
  settings.hoops?73:settings.barrierCount?70:62;
 const start=simTime,dt=.048,substeps=2;
 for(let i=0;i<aimLine.length;i++){
  const dot=aimLine[i];dot.visible=!flight&&playing&&i<count;
  if(i>0){
   for(let sub=0;sub<substeps;sub++){
    const t=start+(i-1+sub/substeps)*dt,h=dt/substeps;
    const prior={x:preview.x,y:preview.y,z:preview.z};
    const fan=airForce(preview.x,preview.y,preview.z,t);
    preview.vx+=(windAt(t)+fan.x)*h;
    preview.vy+=(fan.y-GRAVITY)*h;
    preview.x+=preview.vx*h;preview.y+=preview.vy*h;preview.z+=preview.vz*h;
    wallCollision(preview,prior.x,true);
    checkHoopCross(prior,preview,t+h,true);
    hoopRimCollision(preview,t+h,true);
    resolveEnvironment(preview,true);
    cupSurfaceCollision(preview,true,t+h);
    if(preview.vy<0){
     for(const pad of pads){
      if(prior.y>=pad.y+BALL_R&&preview.y<=pad.y+BALL_R&&
        Math.hypot(preview.x-pad.x,preview.z-pad.z)<pad.r-BALL_R){
       preview.y=pad.y+BALL_R;
       Object.assign(preview,padRebound(preview,pad));
       predictedBounces++;break;
      }
     }
    }
   }
  }
  dot.position.set(preview.x,preview.y,preview.z);
  if(preview.y<-.12||preview.z<settings.targetZ-4.8)dot.visible=false;
  const next=targetLocation(start+i*dt);
  const nearOpening=Math.hypot(preview.x-next.x,preview.z-next.z)<settings.radius*.95&&
   Math.abs(preview.y-next.y-settings.targetHeight)<.42;
  const cue=preview.wallHits||predictedBounces?0xffbd77:
   preview.hoopsPassed?0xa4efc7:i%3===0?0xffdda4:0x86bec8;
  dot.material.color.setHex(cue);
  dot.scale.setScalar(nearOpening?2.1:preview.hoopsPassed?1.2:1);
 }
}
function updatePower(){
 const pct=Math.round(power*100);
 el.power.style.width=pct+'%';el.powerValue.textContent=pct+'%';
 el.trajectoryLabel.textContent=charging?'CHARGING THROW':'AIM TRAJECTORY';
 el.aim.textContent='ANGLE '+Math.round(aimPitch*180/Math.PI)+'° · '+(aimYaw>=0?'R':'L')+
  Math.round(Math.abs(aimYaw)*180/Math.PI)+'°';
 paintAim();
}
function inputAim(clientX,clientY){
 const rect=el.canvas.getBoundingClientRect();
 if(rect.width<2||rect.height<2)return;
 const nx=clamp((clientX-rect.left)/rect.width,0,1);
 const ny=clamp((clientY-rect.top)/rect.height,0,1);
 const baseline=Math.atan2(target.x,settings.d);
 aimYaw=clamp(baseline+(nx-.5)*.68,-.54,.54);
 aimPitch=settings.bankRequired||settings.springRequired?clamp(.52+(.5-ny)*1.04,.13,1.04):clamp(.70+(.5-ny)*.52,.27,1.04);
 if(!charging)power=idealPower();
 updatePower();
}
function startCharge(source){
 if(!playing||paused||flight||charging)return;
 charging=true;chargeSource=source;chargeFrom=performance.now();
 chargeAnchor=settings.wall?.06:clamp(idealPower()-.13,.06,.87);
 power=chargeAnchor;
 hear(510,.048,'triangle',.013);updatePower();
}
function chargeTick(now){
 if(!charging)return;
 if(chargeSource==='pointer'&&gesture?.moved)return;
 const sec=(now-chargeFrom)/1000;
 power=clamp(chargeAnchor+sec*.58,.06,1);
 updatePower();
}
function launch(flickPower=null){
 if(!playing||paused||flight||!charging)return;
 if(flickPower===null)chargeTick(performance.now());else power=clamp(flickPower,.05,1);
 charging=false;chargeSource=null;gesture=null;flight=true;attempts++;
 const v=makeVelocity(power);
 ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:v.vx,vy:v.vy,vz:v.vz,
  active:true,bounces:0,bankHits:0,springHits:0,wallHits:0,hoopsPassed:0,contacts:0,trail:[]};
 shotT=0;shotStart=performance.now();
 el.status.textContent='BALL IN FLIGHT · WATCH THE ARC';
 el.attempts.textContent=String(attempts);
 updateBounceCount();
 throwMoment=performance.now();
 hear(880,.12,'sine',.045);message('PONG!',.55);
 paintAim();
}
function miss(reason='MISS!'){
 if(!flight)return;
 flight=false;ball.active=false;
 hear(230,.16,'triangle',.027);
 const info=ball.rimMiss;
 let hint='Adjust angle and power for the next throw.';
 if(reason.includes('HOOP')||reason.includes('RING'))
  hint='Fly through the middle of every numbered ring, in order.';
 else if(reason.includes('WALL BANK'))
  hint='Touch the striped wall cushion to rebound before scoring.';
 else if(reason==='OBSTACLE HIT!'||reason==='BLOCKED!')
  hint='Try a higher arc or aim around the obstruction.';
 else if(reason.includes('BOUNCE')||reason.includes('PAD')||
  ((settings.bankRequired||settings.springRequired)&&ball.bounces===0))
  hint='Hit the marked bounce surface first, then aim the rebound yourself.';
 else if(info&&info.distance<2.9){
  const sideways=Math.abs(info.dx),length=Math.abs(info.dz);
  hint=sideways>length*.95?
   (info.dx>0?'Passed RIGHT of the cup: aim left.':
    'Passed LEFT of the cup: aim right.'):
   (info.dz>0?'Fell SHORT: add power.':'Sailed LONG: reduce power.');
 }
 el.status.textContent=reason+' · '+hint;
 message(reason.replace(/[!]+$/,'').slice(0,24),1.05);
 if(impactRing){
  impactRing.position.set(ball.x,Math.max(.04,ball.y-.08),ball.z);
  impactRing.material.color.setHex(0xe69886);impactAge=0;impactRing.visible=true;
 }
 resetBall();paintAim();
}
function complete(){
 if(!flight)return;
 flight=false;ball.active=false;
 hear(920,.11,'sine',.07);
 setTimeout(()=>hear(1160,.14,'sine',.055),110);
 const award=attempts<=2?3:attempts<=4?2:1;
 stars[level]=Math.max(Number(stars[level])||0,award);
 best[level]=Math.min(best[level]||Infinity,attempts);
 if(level>=unlocked&&unlocked<50)unlocked=level+1;
 save();buildUi();
 showOverlay('CLEAN SHOT · LEVEL '+fmtLevel(level),'SWISH!'+(award===3?' ★★★':award===2?' ★★':' ★'),
  'Ball in! '+attempts+' throw'+(attempts===1?'':'s')+' · '+award+' star'+(award===1?'':'s')+
  (level===50?' · You cleared all 50 levels!':' · Level '+fmtLevel(Math.min(50,level+1))+' unlocked.'),
  level===50?'REPLAY FROM LEVEL 1':'NEXT LEVEL →','win');
}
function lidFraction(t){
 return .5+.5*Math.sin(t*1.8+level*.67);
}
function tickObstacles(time){
 if(!cupGroup)return;
 const t=time/1000;
 if(Math.abs(settings.wind)>.001){
  const actual=windAt(t);
  el.windLabel.textContent=(actual>=0?'FAN → ':'← FAN ')+Math.abs(actual).toFixed(2);
 }
 const position=targetLocation(t);
 cupGroup.position.set(position.x,position.y,position.z);
 for(const gate of hoops){
  const pos=hoopMotion(gate,t);
  gate.x=pos.x;gate.y=pos.y;
  gate.mesh.position.set(pos.x,pos.y,pos.z);
  if(!gate.passed)gate.mesh.rotation.y=Math.sin(t*1.4+gate.phase)*.055;
  const pulse=.85+.15*Math.sin(t*2.7+gate.phase);
  for(const layer of gate.glows)
   layer.material.opacity=layer.base*pulse*(gate.passed?1.26:1);
  gate.coreMaterial.opacity=gate.passed?.98:.79+.17*pulse;
  gate.ringLight.intensity=(gate.passed?1.2:.78)*pulse;
 }
 for(const field of fanFields){
  const cloud=field.cloud,n=cloud.children.length-1;
  for(let i=0;i<n;i++){
   const arrow=cloud.children[i],progress=(t*.52+arrow.userData.progress)%1;
   const along=.20+progress*(field.reach-.30),
    spread=field.kind==='lift'?.38+progress*.63:.57+progress*1.15;
   if(field.kind==='lift')
    arrow.position.set(arrow.userData.u*spread,along,arrow.userData.v*spread);
   else
    arrow.position.set(field.dir*along,arrow.userData.u*spread,arrow.userData.v*spread);
   arrow.scale.setScalar(.72+Math.sin(progress*Math.PI)*.32);
   arrow.visible=progress<.96;
  }
 }
 if(targetLift){
  const floorY=settings.topPad+.16;
  const extension=Math.max(.055,position.y-floorY);
  targetLift.position.set(position.x,floorY+extension*.5,position.z);
  targetLift.scale.y=extension;
 }
 target.x=position.x;target.z=position.z;target.y=position.y;
 target.top=position.y+settings.targetHeight;
 if(cupLid){
  const factor=lidFraction(t);
  cupLid.hinge.rotation.z=-factor*1.94;
  const isOpen=factor>.61;
  cupLid.indicator.color.setHex(isOpen?0x85e2b1:0xf2a191);
  if(lidOpen!==isOpen){
   lidOpen=isOpen;
   const ringText=settings.hoops?
    'RINGS '+Math.min(ball.hoopsPassed,settings.hoops)+'/'+settings.hoops+' · ':'';
   el.objective.textContent=ringText+(isOpen?'LID OPEN · THROW':'LID CLOSED · WAIT');
   el.viewport.dataset.lidState=isOpen?'open':'closed';
  }
 }
 for(const item of ambient){
  if(item.type==='fan'){
   const fan=item.obj,base=fan.userData.baseYaw;
   fan.rotation.y=base+(fan.userData.kind==='lift'?0:Math.sin(t*.7+level)*.055);
   if(fan.userData.rotor)
    fan.userData.rotor.rotation.z=-t*(12.5+Math.abs(settings.wind)*1.8+
     (settings.fanZone?.power||0)*.85);
  }
  if(item.type==='dust'){
   for(let i=0;i<item.obj.children.length;i++){
    const mote=item.obj.children[i];
    mote.position.y+=Math.sin(t*.42+i*1.3)*.00028;
    mote.position.x+=Math.cos(t*.37+i*.7)*.00019;
   }
  }
  if(item.type==='colleague'){
   const arm=item.obj.userData.arm;
   if(arm)arm.rotation.x=.30+Math.sin(t*2.1+level)*.19;
   const face=item.obj.userData.face;
   if(face)face.rotation.y=Math.sin(t*.72+level)*.11;
  }
 }
 for(const obj of obstacles){
  if(obj.type==='barrier'){
   const wave=Math.sin(t*obj.speed+obj.phase);
   if(obj.style==='panel'){
    obj.y=obj.centerY+wave*.65;
    obj.obj.position.y=obj.y;
   }else{
    obj.x=obj.centerX+wave*obj.amp;
    obj.obj.position.x=obj.x;
   }
  }
 }
 // Only animated meshes need their collision bounds rebuilt.
 const activeOwners=new Set();
 for(const p of physicsBodies)if(p.owner)activeOwners.add(p.owner);
 for(const owner of activeOwners)owner.obj.updateMatrixWorld(true);
 for(const p of physicsBodies)if(p.owner){
  p.box.copy(p.local).applyMatrix4(p.mesh.matrixWorld);
 }
}
function collideObstacles(){
 // A collision changes the ball's velocity. Furniture is not a fail trigger.
 return resolveEnvironment(ball);
}
function tickFlight(dt){
 if(!flight)return;
 // Conservative step size avoids tunnelling through thin desks and monitors.
 const speed=Math.hypot(ball.vx,ball.vy,ball.vz);
 const substeps=Math.min(20,Math.max(4,Math.ceil(dt*Math.max(speed,9)/(BALL_R*.70))));
 const h=dt/substeps;
 for(let step=0;step<substeps;step++){
  if(!flight)break;
  const prevY=ball.y,prevX=ball.x,prevZ=ball.z;
  const air=airForce(ball.x,ball.y,ball.z,simTime);
  ball.vx+=(windAt(simTime)+air.x)*h;
  ball.vy+=air.y*h;
  ball.vy-=GRAVITY*h;
  ball.x+=ball.vx*h;ball.y+=ball.vy*h;ball.z+=ball.vz*h;
  wallCollision(ball,prevX);
  checkHoopCross({x:prevX,y:prevY,z:prevZ},ball,simTime);
  hoopRimCollision(ball,simTime);
  shotT+=h;
  ball.trail.unshift([ball.x,ball.y,ball.z]);
  if(ball.trail.length>46)ball.trail.length=46;
  collideObstacles();
  const inside=Math.hypot(ball.x-target.x,ball.z-target.z);
  if(prevY>=target.top-BALL_R&&ball.y<=target.top-BALL_R&&ball.vy<0)
   ball.rimMiss={dx:ball.x-target.x,dz:ball.z-target.z,distance:inside};
  if(prevY>=target.top-BALL_R&&ball.y<=target.top-BALL_R&&ball.vy<0&&
   inside<target.r-BALL_R*.7){
   if((!settings.lid||lidFraction(simTime)>.61)&&
    (!settings.wall||ball.wallHits>0)&&
    (!settings.hoops||ball.hoopsPassed>=settings.hoops)&&
    (!settings.bankRequired||ball.bankHits>0)&&
    (!settings.springRequired||ball.springHits>0)){
    complete();return;
   }
   // An invalid basket entry is a physical miss: the ball can hit the
   // cup bottom and bounce back out, but does not award the level.
   if(settings.hoops&&ball.hoopsPassed<settings.hoops)
    el.status.textContent='PASS THE NUMBERED HOOPS BEFORE SCORING';
   else if(settings.wall&&ball.wallHits<1)
    el.status.textContent='WALL RICOCHET REQUIRED FOR THIS SHOT';
   else if((settings.bankRequired&&ball.bankHits<1)||
     (settings.springRequired&&ball.springHits<1))
    el.status.textContent='HIT THE REQUIRED BOUNCE PAD FIRST';
  }
  // Cup rim is now a real rounded collider, not an instant failure.
  cupSurfaceCollision(ball);
  // Cylinder wall and bottom contact are resolved by cupSurfaceCollision.
  // Scoring remains restricted to downward entry through the real opening.
  // Real, visible rubber bank trays and spring plates. Rebounds modify
  // the ball's velocity and position; later obstacles can still block it.
  let bouncedThisStep=false;
  if(ball.vy<0){
   for(const pad of pads){
    if(prevY>=pad.y+BALL_R&&ball.y<=pad.y+BALL_R&&
       Math.hypot(ball.x-pad.x,ball.z-pad.z)<pad.r-BALL_R){
     ball.y=pad.y+BALL_R;
     if(pad.type==='bank'){
      ball.bankHits++;
      const impulse=padRebound(ball,pad);
      ball.vx=impulse.vx;ball.vy=impulse.vy;ball.vz=impulse.vz;
      message('BANK BOUNCE! · NOW LAND THE SHOT',1.0);
      hear(650,.13,'triangle',.045);
     }else{
      const rebound=padRebound(ball,pad);
      ball.vy=rebound.vy;ball.vz=rebound.vz;ball.vx=rebound.vx;
      ball.springHits++;
      message('SPRING SHOT!',.9);hear(480,.18,'sine',.06);
     }
     if(impactRing){
      impactRing.position.set(ball.x,pad.y+.075,ball.z);
      impactRing.material.color.setHex(pad.type==='spring'?0x9ef3c8:0xffdc9e);
      impactAge=0;impactRing.visible=true;
     }
     ball.bounces++;updateBounceCount();bouncedThisStep=true;break;
    }
   }
  }
  // All visible solid desk/floor/wall/prop geometry has already been
  // checked by resolveEnvironment. Energy naturally decays with each hit.
  if(ball.y<-.35){miss('OUT OF THE ROOM!');return;}
  if(Math.abs(ball.x)>8.3||ball.z<settings.targetZ-5.3||
   ball.z>LAUNCH_Z+3.0||shotT>10.0||ball.contacts>28){
   miss('BALL OUT OF PLAY!');return;
  }
  if(shotT>.8&&Math.hypot(ball.vx,ball.vy,ball.vz)<.26&&ball.contacts>0){
   ball.restTimer=(ball.restTimer||0)+h;
   if(ball.restTimer>.48){miss('BALL SETTLED!');return;}
  }else ball.restTimer=0;
 }
 if(ballMesh){
  ballMesh.position.set(ball.x,ball.y,ball.z);
  ballMesh.rotation.x+=dt*ball.vz*.6;
  ballMesh.rotation.z+=dt*ball.vx*.6;
  const shadowOnFar=ball.z>settings.targetZ-1.5&&ball.z<settings.targetZ+1.5&&
   Math.abs(ball.x-settings.x)<2.30;
  const shadowOnNear=ball.z>3.7&&ball.z<7.55&&Math.abs(ball.x)<6.30;
  const shadowY=shadowOnFar?settings.topPad+.16:shadowOnNear?1.12:0;
  ballShadow.position.set(ball.x,shadowY+.025,ball.z);
  ballShadow.scale.setScalar(clamp(1+(ball.y-shadowY)*.29,.6,2.1));
  ballShadow.material.opacity=clamp(.25-(ball.y-shadowY)*.045,.045,.20);
  for(let k=0;k<ballTrailMeshes.length;k++){
   const trail=ballTrailMeshes[k],sample=ball.trail[(k+1)*3];
   trail.visible=!!sample;
   if(sample)trail.position.set(sample[0],sample[1],sample[2]);
  }
 }
}
function animate(now){
 requestAnimationFrame(animate);
 const dt=lastNow?clamp((now-lastNow)/1000,0,.04):0;lastNow=now;
 if(!hasRenderer)return;
 if(playing&&!paused){
  simTime+=dt;
  tickObstacles(simTime*1000);
  if(charging)chargeTick(now);
  if(flight)tickFlight(dt);
  // Recompute the predicted arc against the target's current movement.
  if(simTime>4.2&&el.viewport.dataset.showTip==='yes')el.viewport.dataset.showTip='no';
  if(!flight&&now-lastAimRefresh>75){
   lastAimRefresh=now;paintAim();
  }
 }
 if(impactRing?.visible&&playing&&!paused){
  impactAge+=dt;
  impactRing.scale.setScalar(1+impactAge*3);
  impactRing.material.opacity=Math.max(0,.69-impactAge*1.25);
  if(impactAge>.55)impactRing.visible=false;
 }
 if(throwingHand){
  const t=clamp((now-throwMoment)/440,0,1);
  throwingHand.rotation.x=t<1?-Math.sin(t*Math.PI)*.73:0;
  throwingHand.position.z=LAUNCH_Z+.60-(t<1?Math.sin(t*Math.PI)*.25:0);
 }
 if(toastUntil&&now>toastUntil){el.toast.hidden=true;toastUntil=0;}
 if(renderer)renderer.render(scene,camera);
}
async function init(){
 try{
  THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  scene=new THREE.Scene();scene.background=new THREE.Color(0xe0f3f1);
  scene.fog=new THREE.Fog(0x687985,22,45);
  camera=new THREE.PerspectiveCamera(47,1,.1,95);
  renderer=new THREE.WebGLRenderer({canvas:el.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.97;
  scene.add(new THREE.HemisphereLight(0xffe8ca,0x607e90,1.57));
  const sun=new THREE.DirectionalLight(0xffdfb8,1.82);
  sun.position.set(-5,13,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
  sun.shadow.camera.top=16;sun.shadow.camera.bottom=-26;sun.shadow.camera.far=75;
  scene.add(sun);
  const fill=new THREE.PointLight(0xa8d0e5,4.6,22,2);fill.position.set(4,5,1);scene.add(fill);
  const bounce=new THREE.DirectionalLight(0xa8dfe0,.42);
  bounce.position.set(4,6,-10);scene.add(bounce);
  hasRenderer=true;buildWorld();resize();
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(el.viewport);
  else window.addEventListener('resize',resize,{passive:true});
  requestAnimationFrame(animate);
 }catch(err){
  console.warn('Pong Toss 3D unavailable',err);
  el.status.textContent='3D graphics could not start. Enable WebGL or try a newer browser.';
  el.primary.disabled=true;
 }
}
function resize(){
 if(!renderer||!camera)return;
 const r=el.viewport.getBoundingClientRect();
 const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));
 camera.aspect=w/h;
 camera.fov=w<580?61:48;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
}
function action(){
 const what=el.primary.dataset.action;
 if(what==='win'){nextLevel();return;}
 if(what==='resume'){hideOverlay();return;}
 if(what==='start'){hideOverlay();paintAim();return;}
 if(what==='final'){loadLevel(1);return;}
}
function togglePause(){
 if(!playing&&el.overlay.hidden===false&&el.primary.dataset.action!=='resume')return;
 if(playing){
  paused=true;playing=false;charging=false;
  showOverlay('GAME PAUSED','TAKE A BREATHER','Your ball and moving obstacles are frozen. Resume whenever you are ready.',
    'RESUME','resume');
 }else if(el.primary.dataset.action==='resume')hideOverlay();
}
el.primary.addEventListener('click',action);
el.secondary.addEventListener('click',()=>{loadLevel(level);});
el.retry.addEventListener('click',()=>loadLevel(level));
el.prev.addEventListener('click',()=>loadLevel(Math.max(1,level-1)));
el.next.addEventListener('click',()=>loadLevel(Math.min(unlocked,level+1)));
el.pause.addEventListener('click',togglePause);
el.sound.addEventListener('click',()=>{
 soundOn=!soundOn;el.sound.textContent='♫';
el.sound.title=soundOn?'Mute sound':'Unmute sound';el.sound.setAttribute('aria-label',el.sound.title);
 el.sound.setAttribute('aria-pressed',String(soundOn));
 try{localStorage.setItem(MUTED,soundOn?'on':'off');}catch{}
});
el.full.addEventListener('click',async()=>{
 const root=$('ptShell');
 try{
  if(document.fullscreenElement===root)await document.exitFullscreen();
  else await root.requestFullscreen();
 }catch{message('FULLSCREEN NOT AVAILABLE');}
});
document.addEventListener('fullscreenchange',()=>{
 const active=document.fullscreenElement===$('ptShell');
 el.full.textContent='⛶';el.full.title=active?'Exit fullscreen':'Enter fullscreen';
 el.full.setAttribute('aria-label',el.full.title);resize();
});
// Flick gesture inspired by classic touchscreen toss games — drag upward to
// aim/throw, or simply hold and release for power-charging on desktop.
function flickAim(e){
 if(!gesture||gesture.id!==e.pointerId)return;
 const rect=el.canvas.getBoundingClientRect();
 const height=Math.max(rect.height,1);
 const dx=(e.clientX-gesture.x)/height;
 const dy=(gesture.y-e.clientY)/height;
 const duration=Math.max(70,performance.now()-gesture.time);
 const pixels=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y);
 if(pixels<12&&!gesture.moved)return;
 gesture.moved=true;
 aimYaw=clamp(Math.atan2(settings.x,settings.d)+dx*.88,-.62,.62);
 aimPitch=settings.bankRequired||settings.springRequired?clamp(.20+dy*.90,.13,1.04):clamp(.37+dy*.79,.29,1.10);
 const speed=pixels/(duration/1000);
 gesture.flickPower=clamp(idealPower()+(dy-.42)*.36+clamp((speed-950)/6000,-.045,.055),.065,1);
 power=gesture.flickPower;
 updatePower();
}
el.canvas.addEventListener('pointermove',e=>{
 if(!playing||flight)return;
 if(gesture&&gesture.id===e.pointerId)flickAim(e);
 else if(e.pointerType!=='touch')inputAim(e.clientX,e.clientY);
});
el.canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!playing||flight)return;
 e.preventDefault();
 el.canvas.setPointerCapture?.(e.pointerId);
 inputAim(e.clientX,e.clientY);
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false,flickPower:null};
 startCharge('pointer');
});
const release=e=>{
 if(chargeSource!=='pointer')return;
 e.preventDefault();
 if(gesture&&gesture.id===e.pointerId){
  flickAim(e);
  if(gesture.moved&&e.clientY<gesture.y-20)launch(gesture.flickPower);
  else if(gesture.moved&&e.clientY>=gesture.y-20){
   charging=false;chargeSource=null;gesture=null;message('FLICK UP TO THROW!',1.0);
  }else launch();
 }
 try{el.canvas.releasePointerCapture?.(e.pointerId);}catch{}
};
el.canvas.addEventListener('pointerup',release);
el.canvas.addEventListener('pointercancel',()=>{charging=false;chargeSource=null;gesture=null;});
document.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName||'';
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag)||e.ctrlKey||e.altKey||e.metaKey)return;
 const key=e.key.toLowerCase();
 if(key==='r'){e.preventDefault();loadLevel(level);return;}
 if(key==='escape'){e.preventDefault();togglePause();return;}
 if(!playing||flight)return;
 if(['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s'].includes(key)){
  e.preventDefault();
  const amount=e.shiftKey?.019:.011;
  if(key==='arrowleft'||key==='a')aimYaw=clamp(aimYaw-amount,-.56,.56);
  if(key==='arrowright'||key==='d')aimYaw=clamp(aimYaw+amount,-.56,.56);
  if(key==='arrowup'||key==='w')aimPitch=clamp(aimPitch+amount,settings.bankRequired||settings.springRequired?.13:.27,1.04);
  if(key==='arrowdown'||key==='s')aimPitch=clamp(aimPitch-amount,settings.bankRequired||settings.springRequired?.13:.27,1.04);
  if(!charging)power=idealPower();updatePower();
 }else if(e.code==='Space'&&!e.repeat){
  e.preventDefault();startCharge('keyboard');
 }
});
document.addEventListener('keyup',e=>{
 if(e.code==='Space'&&chargeSource==='keyboard'){e.preventDefault();launch();}
});
window.addEventListener('blur',()=>{
 if(charging){charging=false;chargeSource=null;}
 if(playing)togglePause();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)togglePause();});
loadLevel(level);
await init();
})();