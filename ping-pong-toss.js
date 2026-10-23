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
 attempts:$('ptAttempts'),bounces:$('ptBounces'),total:$('ptLevelsCleared'),menu:$('ptLevelMenu'),resume:$('ptContinue'),selection:$('ptSelection'),status:$('ptStatus'),
 power:$('ptPowerFill'),powerValue:$('ptPowerValue'),trajectoryLabel:$('ptTrajectoryLabel'),
 grid:$('ptLevelGrid'),chapters:$('ptChapters'),chapterDescription:$('ptChapterDescription'),
 prev:$('ptPrev'),next:$('ptNext'),retry:$('ptRetry'),pause:$('ptPause'),
 sound:$('ptSound'),full:$('ptFullscreen'),wind:$('ptWind'),windLabel:$('ptWindLabel'),
 aim:$('ptAimText'),tutorial:$('ptTutorial'),best:$('ptBest'),toast:$('ptToast'),objective:$('ptShotObjective'),difficulty:$('ptDifficulty')
};
if(Object.values(el).some(v=>!v))return;
let THREE,renderer,scene,camera,group,ballMesh,ballShadow,ballTrailMeshes=[],launcher,cupGroup,cupFloor,targetShadow,trajectoryGroup;
let aimLine=[],ringMat,particleGroup,obstacles=[],pads=[],hoops=[],wallPad=null,wallPads=[],airZone=null,fanFields=[],physicsBodies=[],physicsGrid=new Map(),physicsGlobal=[],physicsMoving=[],specialSurfaces=[],decorCandidates=[],readabilityAspect=0,impactRing=null,impactAge=2,cupLid=null,lidOpen=null,targetLift=null,target={x:0,z:-2.5,y:0,top:1,r:.64,kind:0},ambient=[];
const STORE='crilo_pong_toss_50_v1',MUTED='crilo_pong_toss_sound_v1';
const TWO_PI=Math.PI*2,GRAVITY=10.65,LAUNCH_Z=4.25,LAUNCH_Y=1.32,BALL_R=.095;
const MAX_AIM_YAW=1.02;
function launchOffset(){return clamp(aimYaw*.37,-.38,.38);}
const CHAPTERS=[
 {name:'FIRST WEEK',desc:'Learn accuracy, moving cups, a bank, crosswind and your first shutter, all before level 10.',from:1,to:10,color:0x6ccab5,short:'First Week'},
 {name:'THE DESK SHIFT',desc:'Mix moving cups with spring pads, lifting targets and the first timed lid.',from:11,to:20,color:0xeba1b5,short:'Desk Shift'},
 {name:'CROSS DRAFT',desc:'Varying fan gusts, blind shots, moving openings and combination trick shots.',from:21,to:30,color:0x8ba8e9,short:'Cross Draft'},
 {name:'THE LATE SHIFT',desc:'Sequence moving drawers, shutters, timed lids and precision rebounds.',from:31,to:40,color:0xebbc70,short:'Late Shift'},
 {name:'FINAL TRICK SHOTS',desc:'Spring pads, moving cups and timed lids collide in the final ten challenges.',from:41,to:50,color:0xae8edc,short:'Final Shift'}
];
let level=1,unlocked=1,completed={},best={},attempts=0,score=0,chosenChapter=0;
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
 try{localStorage.setItem(STORE,JSON.stringify({unlocked,completed,best,level}));}catch{}
}
try{
 const data=JSON.parse(localStorage.getItem(STORE)||'{}');
 unlocked=clamp(Number(data.unlocked)||1,1,50);
 completed=(data.completed&&typeof data.completed==='object')?data.completed:{};
 const legacy=data.stars||{};
 for(let i=1;i<=50;i++)if(legacy[i]>0||i<unlocked)completed[i]=true;
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
 ['Ricochet Corridor',4,'drawer',7.18,1.21,1.32,.41,1,'direct','depth',-.12,'dualmonitors',[['screen',.33,-1.22]],[]],
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
 42:{fan:{kind:'lift',side:1,power:4.7}},
 44:{walls:[{side:-1,fraction:.27,x:1.55,length:2.70},{side:1,fraction:.74,x:1.55,length:2.70}]},
 46:{fan:{kind:'cross',side:1,power:3.4}},
 47:{hoops:2,hoopMove:true},
 49:{fan:{kind:'cross',side:-1,power:4.2},hoops:1},
 50:{hoops:2,hoopMove:true}
};
// Late stages intentionally place pads at different distances and laterals.
// The multi-pad stages require physical hits on separate carts in sequence.
const FINAL_PAD_LAYOUTS={
 41:[.71],42:[.59],43:[.38,.84],45:[.80],46:[.71],
 47:[.64],48:[.40,.86],49:[.76],50:[.51,.90]
};
const NEW_TRICKS={
 1:'FIRST THROW',3:'MOVING CUP',4:'THROUGH THE HOOP',5:'RUBBER BANK',6:'DESK-FAN WIND',7:'AIR JET',
 9:'TIMED SHUTTER',11:'WALL RICOCHET',12:'SPRING REBOUND',16:'HINGED CUP LID',
 18:'MOVING HOOP',21:'PULSING GUSTS',22:'WALL RICOCHET',24:'WIND + LIFT',26:'UPDRAFT',28:'DOUBLE HOOP',
 27:'WIND + TIMED LID',31:'MOVING DRAWERS',34:'SHUTTER + LID',35:'DOUBLE MOVING HOOPS',
 37:'DOUBLE TIMING',38:'UPDRAFT + HOOP',41:'SPRING RETURN',45:'SPRING + LID',47:'MOVING RING GAUNTLET',
 43:'DOUBLE SPRING RUN',44:'TWO WALL BANKS',46:'FAR PAD + CROSSWIND',
 48:'DOUBLE SPRING PRECISION',49:'SPRING THROUGH THE HOOP',50:'DOUBLE SPRING FINALE'
};
function stageDifficulty(n,spec){
 // Explicitly communicate escalating complexity without applying artificial
 // RNG penalties. A new mechanic can still begin with a generous target.
 const baseline=1+Math.floor((n-1)/14);
 const hazards=(spec?.hoops>1?1:0)+(spec?.wallCount>1?2:spec?.wall?1:0)+
  (spec?.padCount>1?2:0)+(spec?.fanZone?1:0)+(spec?.lid?1:0)+
  (spec?.barrierCount>1?1:0);
 return Math.min(5,baseline+(hazards>=2?1:0));
}

// Campaign fairness overrides. A level introduces or combines 1–3 learnable
// mechanics, rather than stacking extreme wind, moving hoops, lids, barriers
// AND precision springs into an unsolvable shot. The underlying 50 blueprints
// and all saved player progress remain unchanged.
const LEVEL_FAIRNESS={
 24:{wind:-.23},26:{wind:-.12,fanPower:2.7},
 28:{wind:-.10},30:{wind:-.12,fanPower:2.6},
 35:{wind:0,clearBarriers:true},
 38:{wind:0,fanPower:2.8,clearBarriers:true},
 40:{wind:0,clearBarriers:true},
 42:{fanPower:2.9},
 43:{wind:0,motion:'still'},
 44:{wind:0,motion:'still',clearObstacles:true},
 45:{wind:0,motion:'slide'},
 46:{wind:0,fanPower:2.7,motion:'still',clearBarriers:true},
 47:{wind:0,hoops:1,hoopMove:false,clearBarriers:true},
 48:{wind:0,motion:'still',clearBarriers:true},
 49:{wind:0,fanPower:2.6,motion:'still',clearBarriers:true},
 50:{wind:0,hoops:1,hoopMove:false,lid:false,motion:'still',
   clearBarriers:true}
};
function balanceStage(spec){
 const tune=LEVEL_FAIRNESS[spec.n];if(!tune)return spec;
 if(tune.wind!==undefined)spec.wind=tune.wind;
 if(tune.motion!==undefined){
  spec.motion=tune.motion;
  spec.moving=tune.motion==='still'?0:Math.min(spec.moving,.33);
 }
 if(tune.fanPower!==undefined&&spec.fanZone)
  spec.fanZone={...spec.fanZone,power:tune.fanPower};
 if(tune.hoops!==undefined)spec.hoops=tune.hoops;
 if(tune.hoopMove!==undefined)spec.hoopMove=tune.hoopMove;
 if(tune.lid!==undefined)spec.lid=tune.lid;
 if(tune.clearBarriers){spec.barrierPlan=[];spec.barrierCount=0;}
 if(tune.clearObstacles)spec.obstaclePlan=[];
 return spec;
}
function stageSettings(n){
 const row=STAGES[n-1];if(!row)throw Error('Missing level '+n);
 const [challenge,sceneId,station,d,x,topPad,radius,kind,shot,motion,wind,
  feature,obstaclePlan,barrierPlan]=row;
 const c=chapterIndex(n),tier=(n-1)%10;
 const bankRequired=shot==='bank',springRequired=shot==='spring';
 const motionPower=motion==='still'?0:.29+Math.min(4,c)*.055+(tier%3)*.06;
 const special=SPECIALS[n]||{};
 const springFractions=springRequired?(FINAL_PAD_LAYOUTS[n]||[.50]):[];
 const wallPlan=special.walls||(special.wall?
  [{side:special.wall.side,fraction:.52,x:2.16,length:3.65}]:[]);
 return balanceStage({
  n,c,tier,challenge,sceneId,station,d,x,topPad,radius,kind,
  newTrick:NEW_TRICKS[n]||null,
  hoops:special.hoops||0,hoopMove:!!special.hoopMove,
  wall:special.wall||special.walls?.[0]||null,wallPlan,wallCount:wallPlan.length,
  fanZone:special.fan||null,
  targetZ:LAUNCH_Z-d,shot,motion,moving:motionPower,wind,
  feature,obstaclePlan,barrierPlan,barrierCount:barrierPlan.length,
  // Every bounce has its own visible, predetermined launch position.
  bankRequired,springRequired,padCount:springFractions.length,springFractions,
  lid:[16,20,27,34,40,45,50].includes(n),
  gust:[21,24,28,33,37,43,46,49].includes(n),
  bankX:x*.41,bankZ:LAUNCH_Z-d*.68,
  springX:x*(springFractions[0]||.5)+(springFractions.length>1?-.15:0),
  springZ:LAUNCH_Z-d*(springFractions[0]||.5),
  roomVariant:tier>=5?1:0,
  color:chapter(n).color,targetHeight:[.55,.59,.68,.47,.63,.66,.57][kind]
 });
}
let settings=stageSettings(level);
// Keep the visible shot sequence in the order the player actually meets the
// mechanics on the way across the room, including mixed hoop-and-pad stages.
function orderedGoals(spec){
 const goals=[];
 if(spec.hoops)goals.push({position:.38,kind:'hoops'});
 if(spec.wall)goals.push({position:.52,kind:'wall'});
 if(spec.springRequired)goals.push({position:.58,kind:'spring'});
 if(spec.bankRequired)goals.push({position:.68,kind:'bank'});
 return goals.sort((a,b)=>a.position-b.position);
}
function shotSteps(spec,p={}){
 const words={
  hoops:()=> 'RINGS '+Math.min(p.hoopsPassed||0,spec.hoops)+'/'+spec.hoops,
  wall:()=>spec.wallCount>1?'WALLS '+Math.min(p.wallHits||0,spec.wallCount)+'/'+spec.wallCount:(p.wallHits?'WALL ✓':'WALL BANK'),
  bank:()=>p.bankHits?'TRAY ✓':'RUBBER TRAY',
  spring:()=>spec.padCount>1?'SPRINGS '+Math.min(p.springHits||0,spec.padCount)+'/'+spec.padCount:(p.springHits?'SPRING ✓':'SPRING PAD')
 };
 const steps=orderedGoals(spec).map(goal=>words[goal.kind]());
 if(!steps.length)steps.push('AIM');
 steps.push('CUP');return steps;
}
function updateObjective(){
 const hint=settings.lid?' · LID '+(lidOpen===true?'OPEN':lidOpen===false?'CLOSED':'TIMED'):
  settings.barrierCount?' · MOVING BARRIER':
  settings.fanZone?' · '+(settings.fanZone.kind==='lift'?'UPDRAFT':'SIDE FAN'):
  settings.wind?' · CROSSWIND':
  settings.motion!=='still'?' · MOVING CUP':'';
 el.objective.textContent=shotSteps(settings,ball).join(' → ')+hint;
}
function levelInstructions(spec){
 const actions={
  hoops:'pass through '+spec.hoops+' numbered hoop'+(spec.hoops>1?'s in order':''),
  wall:spec.wallCount>1?'bounce off '+spec.wallCount+' numbered wall cushions in order':'bounce off the striped wall cushion',
  spring:spec.padCount>1?'bounce on both numbered spring pads in order':'hit the green spring pad',
  bank:'hit the orange rubber tray'
 };
 const tasks=orderedGoals(spec).map(goal=>actions[goal.kind]);
 const goal=tasks.length?'First '+tasks.join(', then ')+'. Then sink the cup.':
  'Aim into the cup to finish.';
 const movements={
  still:'',slide:'Cup slides side to side',depth:'Cup moves toward and away',
  lift:'Cup moves up and down',orbit:'Cup circles around',figure8:'Cup moves in a figure eight'
 };
 const hazards=[];
 if(movements[spec.motion])hazards.push(movements[spec.motion]);
 if(spec.fanZone)hazards.push(spec.fanZone.kind==='lift'?
  'green updraft lifts the ball':'blue fan stream pushes the ball sideways');
 if(spec.wind)hazards.push('crosswind pushes the ball sideways');
 if(spec.barrierCount)hazards.push('watch the moving '+(spec.barrierCount===1?'barrier':'barriers'));
 if(spec.lid)hazards.push('wait for the lid to open');
 return goal+(hazards.length?' '+hazards.join('; ')+'.':'');
}
function buildUi(){
 el.total.textContent=Array.from({length:50},(_,i)=>i+1).filter(i=>completed[i]).length+' / 50';
 el.resume.textContent=(completed[50]?'REPLAY':'CONTINUE')+' · LEVEL '+fmtLevel(unlocked);
 el.counter.textContent=fmtLevel(level)+' / 50';
 el.chapter.textContent='CHAPTER '+(settings.c+1)+' · '+CHAPTERS[settings.c].short.toUpperCase();
 const rooms=SCENE_NAMES;
 el.title.textContent=settings.challenge+' · '+rooms[settings.sceneId];
 const rating=stageDifficulty(level,settings);
 const labels=['','EASY','STANDARD','TRICKY','HARD','EXPERT'];
 el.difficulty.textContent=labels[rating];
 el.difficulty.dataset.rank=String(rating);
 el.chapter.textContent=settings.newTrick?'NEW TRICK · '+settings.newTrick:'SHIFT '+(settings.c+1)+' · '+CHAPTERS[settings.c].short.toUpperCase();
 updateObjective();
 el.viewport.dataset.shotMode=settings.springRequired?'spring':settings.bankRequired?'bank':'direct';
 el.viewport.style.setProperty('--pt-stage-accent',
  '#'+settings.color.toString(16).padStart(6,'0'));
 el.viewport.dataset.challenge=stageArtPlan(settings).tricks>=3?'complex':'simple';
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
// Consistent readable mechanic vocabulary across all 50 level cards.
function mechanicLabel(spec){
 const tags=[];
 if(spec.wallCount)tags.push(spec.wallCount>1?'2 WALLS':'WALL');
 if(spec.padCount)tags.push(spec.padCount>1?'2 SPRINGS':'SPRING');
 if(spec.bankRequired)tags.push('BANK');
 if(spec.hoops)tags.push(spec.hoops>1?'2 HOOPS':'HOOP');
 if(spec.fanZone||Math.abs(spec.wind)>.09)tags.push('FAN');
 if(spec.lid)tags.push('LID');
 if(spec.barrierCount)tags.push('SHUTTER');
 if(!tags.length&&spec.motion!=='still')tags.push('MOVING CUP');
 if(!tags.length)tags.push('PRECISION');
 return tags.slice(0,2).join(' + ');
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
  button.className='pt-level-btn'+(i===level?' current':'')+(i>unlocked?' locked':'')+(completed[i]?' cleared':'');
  const label=document.createElement('span');label.textContent=fmtLevel(i);
  const recipe=stageSettings(i);
  button.dataset.difficulty=String(stageDifficulty(i,recipe));
  const nameTag=document.createElement('small');nameTag.className='pt-level-name';
  nameTag.textContent=recipe.challenge;
  const star=document.createElement('small');star.className='pt-level-status';
  star.textContent=i>unlocked?'LOCKED':(completed[i]?'✓ ':'')+mechanicLabel(recipe);
  button.append(label,nameTag,star);button.disabled=i>unlocked;
  const kind=recipe.springRequired?'SPRING':recipe.bankRequired?'BANK':'DIRECT';
  button.dataset.shot=kind.toLowerCase();
  if(recipe.newTrick)button.dataset.newTrick='true';
  button.dataset.scene=String(recipe.sceneId);
  button.title='Level '+i+' · '+recipe.challenge+' · '+mechanicLabel(recipe)+' · '+recipe.d.toFixed(1)+'m · difficulty '+stageDifficulty(i,recipe)+'/5';
  button.setAttribute('aria-label',button.title+(i>unlocked?' locked':completed[i]?' cleared':''));
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
 aimYaw=settings.springRequired?
  Math.atan2(settings.springX,LAUNCH_Z-settings.springZ):
  Math.atan2(settings.x,settings.d);
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
 const objective=levelInstructions(settings);
 const introText=(settings.newTrick?'NEW: '+settings.newTrick+'. ':'')+objective;
 showOverlay('LEVEL '+fmtLevel(level)+' · '+SCENE_NAMES[settings.sceneId],
  settings.challenge.toUpperCase(),introText,
  'PLAY LEVEL '+fmtLevel(level),'start');
 save();
}
function nextLevel(){
 if(level>=50){openLevelMenu();return;}
 const n=Math.min(level+1,unlocked);loadLevel(n);
}
function updateBounceCount(){
 if(el.bounces)el.bounces.textContent=String((ball.contacts||0)+(ball.bounces||0)+(ball.wallHits||0));
}
function resetBall(){
 ball={x:launchOffset(),y:LAUNCH_Y,z:LAUNCH_Z,vx:0,vy:0,vz:0,active:false,bounces:0,bankHits:0,springHits:0,wallHits:0,hoopsPassed:0,contacts:0,trail:[]};
 if(ballMesh){ballMesh.position.set(launchOffset(),LAUNCH_Y,LAUNCH_Z);ballMesh.rotation.set(0,0,0);}
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
 geometries.forEach(x=>x.dispose());materials.forEach(x=>{x.map?.dispose();x.bumpMap?.dispose();x.dispose();});
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


/* Fine-scale, deterministic surface relief. The low-strength bump maps react
 * to real scene lights without requiring heavy image assets or new requests. */
function surfaceRelief(kind,seed,rx,ry){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const image=ctx.createImageData(128,128),p=image.data;
 let state=((seed+31)*16807)%2147483647;
 const random=()=>{state=(state*48271)%2147483647;return state/2147483647;};
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const grain=(random()-.5)*(kind==='carpet'?60:kind==='wood'?26:18);
  const ridge=kind==='wood'?Math.sin(y*.48+Math.sin(x*.08+seed)*1.4)*26:
   kind==='carpet'?((x%4<2)===(y%4<2)?10:-10):
   Math.sin(y*.17+x*.31)*3;
  const v=clamp(Math.round(128+ridge+grain),0,255),i=(y*128+x)*4;
  p[i]=p[i+1]=p[i+2]=v;p[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 const tex=new THREE.CanvasTexture(canvas);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(rx,ry);
 tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;
 return tex;
}
// Architecture is background scenery only: none of these decorative details
// enter the projectile collision system or change the fifty level solutions.
function roomArchitecture(roomEnd,roomLength,sceneId,variant,palette){
 const art=new THREE.Group();group.add(art);
 ambient.push({type:'scenery',obj:art});
 const frame=createMat(palette.trim,.42,.29),
  chalk=createMat(variant?0x455764:0x71858a,.87),
  brass=createMat(0xc4a77e,.38,.34),
  paper=createMat(0xe7dfce,.87),
  warm=createMat(0xc39580,.78),
  mint=createMat(0x8db7af,.64),
  glass=new THREE.MeshStandardMaterial({color:0x93bec4,roughness:.16,metalness:.15,transparent:true,opacity:.63,depthWrite:false}),
  glow=new THREE.MeshBasicMaterial({color:variant?0x89bed1:0xffd6ab,toneMapped:false});
 const piece=(w,h,d,x,y,z,mat)=>{
  const m=meshBox(art,w,h,d,x,y,z,mat);m.castShadow=false;
  return m;
 };
 const far=roomEnd+.43;
 // Structural double-layer wall reveals and quietly lit side-wall strips.
 for(const side of [-1,1]){
  const bx=side*6.65;
  piece(1.55,3.65,.14,bx,3.63,far,frame);
  piece(1.36,3.47,.06,bx,3.63,far+.11,chalk);
  piece(.045,3.25,.065,bx-side*.57,3.63,far+.15,brass);
  const sideZ=roomEnd+Math.min(roomLength*.32,6.0);
  piece(.09,2.9,2.5,side*7.83,3.58,sideZ,frame);
  piece(.10,2.74,2.31,side*7.74,3.58,sideZ,chalk);
  piece(.12,.035,2.26,side*7.67,4.89,sideZ,glow);
 }
 // Room signatures, built into the walls instead of dropped in the throw lane.
 // All positions are on distant walls or beside the far side cabinets.
 const bx=6.65,bz=far+.18;
 if(sceneId===0){ // Felt acoustic modules, with stitched seams.
  for(const side of [-1,1])for(let row=0;row<5;row++){
   const y=2.35+row*.57,shift=row%2?.07:-.07;
   piece(1.15,.47,.04,side*bx+shift,y,bz,
    row%2?mint:warm);
   piece(.96,.012,.015,side*bx+shift,y-.15,bz+.04,paper);
  }
 }else if(sceneId===1){ // Glass conference display and engraved guides.
  for(const side of [-1,1]){
   piece(1.12,2.42,.048,side*bx,3.66,bz,glass);
   for(let i=0;i<5;i++)
    piece(.75-i*.07,.035,.015,side*bx-.1+i*.025,4.5-i*.37,bz+.052,i%2?mint:paper);
   piece(1.24,.06,.18,side*bx,2.38,bz,brass);
  }
 }else if(sceneId===2){ // Built-in mail slots with individual envelopes.
  for(const side of [-1,1])for(let i=0;i<5;i++){
   const y=2.37+i*.56;
   piece(1.13,.43,.15,side*bx,y,bz,frame);
   piece(.88,.24,.07,side*bx,y+.03,bz+.11,paper);
   piece(.62,.025,.015,side*bx,y-.045,bz+.15,warm);
  }
 }else if(sceneId===3){ // Café tiles and softly glowing wall sconces.
  for(const side of [-1,1]){
   for(let row=0;row<7;row++)
    piece(1.12,.025,.04,side*bx,2.25+row*.44,bz,paper);
   piece(.73,.67,.12,side*bx,4.36,bz+.11,frame);
   const disk=new THREE.Mesh(new THREE.CircleGeometry(.24,24),glow);
   disk.position.set(side*bx,4.36,bz+.186);art.add(disk);
  }
 }else if(sceneId===4){ // After-hours luminous workstation panels.
  for(const side of [-1,1]){
   piece(1.08,2.61,.08,side*bx,3.62,bz,frame);
   for(let row=0;row<6;row++){
    piece(.87,.028,.025,side*bx,2.6+row*.39,bz+.068,row%3?mint:glow);
    piece(.10,.09,.04,side*bx-.39,2.6+row*.39,bz+.095,brass);
   }
  }
 }else if(sceneId===5){ // Numbered archival drawer faces.
  for(const side of [-1,1])for(let row=0;row<6;row++){
   const y=2.27+row*.52;
   piece(1.05,.43,.10,side*bx,y,bz,warm);
   piece(.62,.19,.035,side*bx,y+.045,bz+.077,paper);
   piece(.26,.04,.06,side*bx,y-.11,bz+.10,frame);
  }
 }else if(sceneId===6){ // Reception's fluted timber feature wall.
  for(const side of [-1,1]){
   for(let i=0;i<7;i++)piece(.085,3.07,.085,side*bx+(i-3)*.17,3.61,bz,
    i%2?brass:paper);
   const badge=new THREE.Mesh(new THREE.TorusGeometry(.35,.055,10,32),brass);
   badge.position.set(side*bx,4.19,bz+.08);art.add(badge);
  }
 }else if(sceneId===7){ // Framed award alcoves, lit from the edge.
  for(const side of [-1,1]){
   for(let i=0;i<3;i++){
    const y=2.68+i*.89;
    piece(.92,.68,.085,side*bx,y,bz,brass);
    piece(.76,.52,.057,side*bx,y,bz+.065,chalk);
    const medal=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.024,24),brass);
    medal.rotation.x=Math.PI/2;medal.position.set(side*bx,y,bz+.115);art.add(medal);
   }
  }
 }else if(sceneId===8){ // Loading-bay hazard trims and recessed tie-downs.
  for(const side of [-1,1]){
   for(let row=0;row<8;row++){
    const band=piece(1.12,.13,.048,side*bx,2.23+row*.42,bz,row%2?brass:frame);
    band.rotation.z=(row%2?1:-1)*.11;
   }
   piece(.86,.13,.10,side*bx,5.05,bz,metallicBlue());
  }
 }else if(sceneId===9){ // Data-centre cable trunking and separate status modules.
  for(const side of [-1,1]){
   for(let i=0;i<3;i++)
    piece(.20,3.03,.12,side*bx+(i-1)*.37,3.6,bz,i%2?frame:mint);
   for(let row=0;row<8;row++)
    piece(.11,.065,.05,side*bx+.40,2.43+row*.34,bz+.14,row%3?mint:glow);
  }
 }
 function metallicBlue(){return createMat(0x7797a2,.35,.45);}
 // A diffused window-light pool, projected onto the existing carpet rather
 // than inserting a fake solid object in the playable environment.
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d');
 if(ctx){
  const grad=ctx.createRadialGradient(64,64,6,64,64,64);
  grad.addColorStop(0,'rgba(255,238,192,.78)');
  grad.addColorStop(.52,'rgba(255,231,189,.37)');
  grad.addColorStop(1,'rgba(255,231,189,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  ctx.fillStyle='rgba(38,63,72,.055)';
  for(let i=0;i<5;i++)ctx.fillRect(11+i*23,0,5,128);
  const texture=new THREE.CanvasTexture(c);
  const spill=new THREE.Mesh(new THREE.PlaneGeometry(4.2,5.6),
   new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:variant ? .12 : .30,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  spill.rotation.x=-Math.PI/2;
  spill.rotation.z=.14;
  spill.position.set(-3.70,.013,roomEnd+Math.min(roomLength*.36,6.4));
  art.add(spill);
 }
}

function roundedPoster(parent,text,x,y,z,colorText='#fef0c0'){
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.72,.52),
  makeText(text,35,colorText,'#334858'));
 sign.position.set(x,y,z);parent.add(sign);return sign;
}
function desk(parent,x,z,w,d,h,top,legs){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 // Soft worktop overhang, laminated edge and a narrow metal frame.
 meshBox(g,w,.19,d,0,h,0,top);
 const edge=createMat(0x8b796b,.57,.16),under=createMat(0x475d65,.54,.38);
 meshBox(g,w*.956,.043,d*.963,0,h-.126,0,edge);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const lx=sx*(w/2-.22),lz=sz*(d/2-.23);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.069,.079,Math.max(.15,h-.20),12),legs);
  leg.position.set(lx,(h-.20)/2,lz);leg.castShadow=true;g.add(leg);
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.055,12),
   createMat(0x303d44,.9,.08));
  foot.position.set(lx,.032,lz);g.add(foot);
 }
 meshBox(g,w*.87,.075,d*.08,0,h-.25,-d*.40,under);
 meshBox(g,w*.87,.075,d*.08,0,h-.25,d*.40,under);
 // A real drawer pull and seam, not a floating flat rectangle.
 if(w<7){
  const drawerW=Math.min(.9,w*.45);
  meshBox(g,drawerW,.20,.045,w*.23,h-.34,d*.42,top);
  meshBox(g,drawerW*.26,.034,.046,w*.23,h-.34,d*.46,
   createMat(0xc1ced0,.30,.55));
 }
 return g;
}
function plant(parent,x,z,h=.92){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const pot=createMat(0xb88771,.72),lip=createMat(0xd1a28a,.62);
 const soil=createMat(0x514a3e,.95),stem=createMat(0x527966,.75);
 const leaves=[
  createMat(0x638b70,.76),createMat(0x7ba58a,.77),
  createMat(0x456c60,.72),createMat(0x91b19a,.76)
 ];
 const vessel=new THREE.Mesh(new THREE.CylinderGeometry(.29,.21,.45,24),pot);
 vessel.position.y=.225;vessel.castShadow=true;vessel.receiveShadow=true;g.add(vessel);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.291,.032,9,30),lip);
 rim.rotation.x=Math.PI/2;rim.position.y=.44;g.add(rim);
 const dirt=new THREE.Mesh(new THREE.CylinderGeometry(.266,.266,.023,20),soil);
 dirt.position.y=.429;g.add(dirt);
 const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.035,.047,h*.74,10),stem);
 stalk.position.y=.45+h*.37;g.add(stalk);
 // Tapered leaves have a real swept silhouette, stem and central vein,
 // rather than lumpy ellipsoids. The same grounded planter is still used.
 const leafShape=new THREE.Shape();
 leafShape.moveTo(0,0);
 leafShape.bezierCurveTo(-.145,.09,-.17,.36,0,.55);
 leafShape.bezierCurveTo(.18,.36,.14,.09,0,0);
 const leafGeometry=new THREE.ExtrudeGeometry(leafShape,{
  depth:.018,steps:1,bevelEnabled:true,bevelThickness:.012,
  bevelSize:.010,bevelSegments:2,curveSegments:10
 });
 const vein=createMat(0x4c7a65,.81);
 for(let i=0;i<10;i++){
  const angle=i*2.39996,layer=i%3,reach=.14+(i%4)*.065,
   yy=.48+h*(.32+(i%5)*.09);
  const branch=new THREE.Group();
  branch.position.set(Math.cos(angle)*reach,yy,Math.sin(angle)*reach);
  branch.rotation.y=angle;branch.rotation.z=(i%2?.38:-.32);
  g.add(branch);
  const leaf=new THREE.Mesh(leafGeometry,leaves[i%leaves.length]);
  leaf.scale.set(.80+layer*.09,.75+layer*.06,1);
  leaf.rotation.x=(i%3-1)*.13;leaf.castShadow=true;branch.add(leaf);
  const midrib=new THREE.Mesh(new THREE.CylinderGeometry(.009,.012,.40,6),vein);
  midrib.position.set(0,.23,-.014);midrib.castShadow=false;branch.add(midrib);
  const stalkSide=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.21,7),stem);
  stalkSide.position.set(0,-.075,.02);branch.add(stalkSide);
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
// Rounded recognizable office props. The large solid parts use supported
// physics geometries; handles, glass and labels are decorative details.
function officeMug(parent,x,y,z,color,scale=1){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
 const porcelain=createMat(color,.36,.06),inside=createMat(0x656e70,.76);
 const profile=[
  new THREE.Vector2(.145,0),new THREE.Vector2(.163,.02),
  new THREE.Vector2(.172,.10),new THREE.Vector2(.187,.24),
  new THREE.Vector2(.185,.29)
 ];
 const body=new THREE.Mesh(new THREE.LatheGeometry(profile,30),porcelain);
 body.castShadow=true;body.receiveShadow=true;g.add(body);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.185,.022,8,32),
  createMat(0xf8e9d8,.32,.10));
 rim.rotation.x=Math.PI/2;rim.position.y=.29;g.add(rim);
 const inner=new THREE.Mesh(new THREE.CylinderGeometry(.168,.139,.22,24,1,true),
  new THREE.MeshStandardMaterial({color:0x858e90,side:THREE.BackSide,roughness:.87}));
 inner.position.y=.16;g.add(inner);
 const handle=new THREE.Mesh(new THREE.TorusGeometry(.145,.039,10,24,Math.PI*1.65),
  porcelain);
 handle.position.set(.259,.16,0);handle.rotation.y=Math.PI/2;
 handle.rotation.z=-.15;g.add(handle);
 return g;
}
function officePrinter(parent,x,y,z,mat,scale=1){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
 const body=mat||createMat(0xa6b5b7,.40,.17),dark=createMat(0x344854,.39,.30);
 const glass=createMat(0x4c6d80,.19,.32),paper=createMat(0xf5efe4,.90);
 meshBox(g,1.16,.49,.91,0,-.035,0,body);
 meshBox(g,1.02,.065,.79,0,.225,-.035,dark);
 const glassTop=meshBox(g,.90,.012,.64,0,.267,-.03,glass);
 glassTop.castShadow=false;
 const tray=meshBox(g,.72,.045,.53,0,-.16,.535,dark);
 tray.rotation.x=-.13;
 for(let i=0;i<3;i++){
  const page=meshBox(g,.55,.006,.40,0,-.105+i*.012,.62,paper);
  page.castShadow=false;
 }
 const controls=meshBox(g,.31,.035,.19,-.36,.262,.24,body);
 controls.rotation.y=.17;
 for(let k=0;k<4;k++){
  const light=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),
   new THREE.MeshBasicMaterial({color:k===0?0x95e8c1:0x8da2aa}));
  light.position.set(-.45+k*.06,.291,.24);g.add(light);
 }
 return g;
}
function officeLamp(parent,x,y,z,scale=1){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
 const metal=createMat(0x7e939b,.31,.51),shade=createMat(0xd1b49b,.54,.18);
 const foot=new THREE.Mesh(new THREE.CylinderGeometry(.25,.30,.085,24),metal);
 foot.position.y=0;foot.castShadow=true;g.add(foot);
 const neck=new THREE.Mesh(new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
   new THREE.Vector3(0,.04,0),new THREE.Vector3(-.05,.33,0),
   new THREE.Vector3(.01,.66,0),new THREE.Vector3(.21,.80,0)
  ]),18,.046,8,false),metal);
 neck.castShadow=true;g.add(neck);
 const cover=new THREE.Mesh(new THREE.CylinderGeometry(.22,.34,.30,28,1),shade);
 cover.rotation.z=-.42;cover.position.set(.28,.76,0);cover.castShadow=true;g.add(cover);
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.105,12,9),
  new THREE.MeshBasicMaterial({color:0xffe3af}));
 bulb.position.set(.34,.58,0);g.add(bulb);
 return g;
}
function officeParcel(parent,x,y,z,variant=0){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 const colors=[0xd0b391,0xa2b4af,0xb9a88d,0x9babb0,0xc7a283];
 const w=.53+(variant%2)*.09,h=.43+(variant%3)*.045,d=.66;
 const fiber=createMat(colors[variant%colors.length],.88,.02);
 const tape=createMat(0xe5d8b7,.67,.02),label=createMat(0xf7f3e7,.95,.01);
 meshBox(g,w,h,d,0,h/2,0,fiber);
 // Folded lid, brown packing seams and crossing tape.
 meshBox(g,w-.03,.017,d-.03,0,h+.011,0,fiber);
 meshBox(g,.105,.023,d-.035,0,h+.025,0,tape);
 meshBox(g,w-.04,.021,.09,0,h+.027,0,tape);
 meshBox(g,w*.67,h*.31,.015,.015,h*.55,d*.5+.011,label);
 const barMat=createMat(0x58646a,.81,.02);
 for(let i=0;i<7;i++){
  const line=meshBox(g,.012+(i%3)*.008,h*.20,.017,
   -.13+i*.043,h*.56,d*.5+.025,barMat);
  line.castShadow=false;
 }
 return g;
}
function officeTrophy(parent,x,y,z,variant=0){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 const brass=createMat(variant%2?0xd3a46e:0xe5c77c,.25,.68);
 const base=createMat(0x465560,.47,.35),ivory=createMat(0xffedc2,.44,.18);
 meshBox(g,.37,.13,.30,0,.075,0,base);
 meshBox(g,.32,.060,.26,0,.17,0,ivory);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.06,.085,.30,20),brass);
 stem.position.y=.35;g.add(stem);
 const points=[
  new THREE.Vector2(.105,0),new THREE.Vector2(.18,.055),
  new THREE.Vector2(.22,.16),new THREE.Vector2(.27,.34),
  new THREE.Vector2(.285,.37)
 ];
 const cup=new THREE.Mesh(new THREE.LatheGeometry(points,28),brass);
 cup.position.y=.50;cup.castShadow=true;g.add(cup);
 const lip=new THREE.Mesh(new THREE.TorusGeometry(.283,.028,8,32),ivory);
 lip.rotation.x=Math.PI/2;lip.position.y=.865;g.add(lip);
 for(const side of [-1,1]){
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.16,.031,9,26,Math.PI*1.42),
   brass);
  handle.rotation.y=Math.PI/2;
  handle.rotation.z=side===1?-.38:Math.PI+.38;
  handle.position.set(side*.30,.67,0);g.add(handle);
 }
 const emblem=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.024,24),ivory);
 emblem.rotation.x=Math.PI/2;emblem.position.set(0,.695,.274);g.add(emblem);
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
 // Sculpted swept propellers catch highlights better than the old clover.
 const bladeMat=new THREE.MeshStandardMaterial({
  color:0x87aab0,roughness:.35,metalness:.50,side:THREE.DoubleSide});
 const shape=new THREE.Shape();
 shape.moveTo(-.04,.055);
 shape.bezierCurveTo(-.13,.19,-.16,.43,-.02,.47);
 shape.bezierCurveTo(.14,.47,.33,.30,.29,.17);
 shape.bezierCurveTo(.27,.08,.08,.045,-.04,.055);
 const bladeGeo=new THREE.ExtrudeGeometry(shape,{
  depth:.036,steps:1,bevelEnabled:true,bevelSegments:2,
  bevelSize:.011,bevelThickness:.008,curveSegments:8});
 for(let i=0;i<4;i++){
  const blade=new THREE.Mesh(bladeGeo,bladeMat);
  blade.rotation.z=i*Math.PI/2+.21;
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
 const frame=createMat(0x697c86,.39,.50),upholstery=createMat(0x657b83,.83),
  padding=createMat(0x79949c,.94),rubber=createMat(0x293e49,.92);
 // Upholstered shaped seat and reclined back with visible curved cushioning.
 const seat=meshBox(g,.92,.17,.79,0,.74,0,upholstery);
 seat.rotation.x=-.04;
 const seatCushion=new THREE.Mesh(new THREE.SphereGeometry(.48,22,14),padding);
 seatCushion.scale.set(.94,.21,.78);seatCushion.position.set(0,.849,-.04);
 seatCushion.castShadow=true;g.add(seatCushion);
 const back=meshBox(g,.94,1.02,.19,0,1.36,.34,upholstery);
 back.rotation.x=.13;
 const backPad=new THREE.Mesh(new THREE.SphereGeometry(.48,20,16),padding);
 backPad.scale.set(.88,.91,.18);backPad.position.set(0,1.34,.210);
 backPad.rotation.x=.10;backPad.castShadow=true;g.add(backPad);
 // Curved arm supports, chrome lift, five-spoke base and caster wheels.
 for(const side of [-1,1]){
  const arm=meshBox(g,.13,.11,.62,side*.51,.91,-.02,upholstery);
  arm.rotation.y=side*.09;
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.045,.053,.36,12),frame);
  post.position.set(side*.51,.71,.04);g.add(post);
 }
 const piston=new THREE.Mesh(new THREE.CylinderGeometry(.06,.075,.55,14),frame);
 piston.position.set(0,.38,0);g.add(piston);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.12,20),frame);
 hub.position.y=.19;g.add(hub);
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5,px=Math.sin(a)*.38,pz=Math.cos(a)*.38;
  const spoke=meshBox(g,.13,.08,.53,px*.45,.145,pz*.45,frame);
  spoke.rotation.y=-a;
  const caster=new THREE.Mesh(new THREE.CylinderGeometry(.094,.094,.08,12),rubber);
  caster.rotation.z=Math.PI/2;caster.position.set(px,.083,pz);
  caster.castShadow=true;g.add(caster);
 }
 return g;
}

function addFanJet(spec,x,z,device,label){
 // Visuals and physics share a single emitter at the actual fan motor.
 const kind=spec.kind,side=spec.side;
 // Mount horizontal fans on grounded cabinets to line up the visible jet
 // with the actual height of the thrown ball.
 if(kind==='cross'&&!settings.bankRequired&&!settings.springRequired){
  const shelfY=.72,paint=createMat(0x667e82,.43,.34);
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
  reach:kind==='lift'?4.00:5.25,device,phase:settings.n*.33,label,cloud:null};
 const cloud=new THREE.Group();cloud.position.set(x,headY,z);group.add(cloud);
 const color=kind==='lift'?0x74bc97:0x64b3c7;
 const markerMat=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:.51,depthWrite:false,depthTest:true,
  blending:THREE.NormalBlending,side:THREE.DoubleSide
 });
 for(let i=0;i<14;i++){
  const marker=new THREE.Mesh(new THREE.ConeGeometry(.057,.19,10),markerMat);
  marker.userData.progress=(i+.22)/14;
  const a=i*2.4,spread=.20+.36*i/14;
  marker.userData.u=Math.cos(a)*spread;
  marker.userData.v=Math.sin(a)*spread;
  if(kind!=='lift')marker.rotation.z=side*Math.PI/2;
  marker.castShadow=false;cloud.add(marker);
 }
 const streamMat=new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:.17,depthWrite:false,
  blending:THREE.NormalBlending
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
// A localized soft contact shadow helps cups feel attached to the desk,
// including moving targets. It is purely visual and not a collision body.
function softContactShadow(parent,x,y,z,scaleX,scaleZ){
 const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const g=ctx.createRadialGradient(48,48,7,48,48,47);
 g.addColorStop(0,'rgba(12,27,32,.57)');
 g.addColorStop(.45,'rgba(12,27,32,.33)');
 g.addColorStop(1,'rgba(12,27,32,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,96,96);
 const texture=new THREE.CanvasTexture(canvas);
 const material=new THREE.MeshBasicMaterial({
  map:texture,transparent:true,opacity:.72,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-1
 });
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
 shadow.rotation.x=-Math.PI/2;
 shadow.position.set(x,y,z);
 shadow.scale.set(scaleX,scaleZ,1);
 shadow.renderOrder=1;
 shadow.castShadow=false;shadow.receiveShadow=false;
 parent.add(shadow);
 return shadow;
}

// Viewport-space silhouettes are computed from the actual level camera.
// NEVER move the goal, authored obstacles, wall pads, spring trays or hoops.
function screenRect(bounds){
 if(!bounds||bounds.isEmpty())return null;
 const low=bounds.min,high=bounds.max,p=new THREE.Vector3();
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,front=0;
 for(const x of [low.x,high.x])for(const y of [low.y,high.y])
  for(const z of [low.z,high.z]){
   p.set(x,y,z).project(camera);
   if(p.z>=-1&&p.z<=1)front++;
   left=Math.min(left,(p.x+1)/2);right=Math.max(right,(p.x+1)/2);
   top=Math.min(top,(1-p.y)/2);bottom=Math.max(bottom,(1-p.y)/2);
  }
 if(!front||!Number.isFinite(left+right+top+bottom))return null;
 return {x0:Math.max(-1,left),y0:Math.max(-1,top),
  x1:Math.min(2,right),y1:Math.min(2,bottom)};
}
function screenOverlap(a,b,pad=0){
 if(!a||!b)return 0;
 const w=Math.min(a.x1,b.x1+pad)-Math.max(a.x0,b.x0-pad),
  h=Math.min(a.y1,b.y1+pad)-Math.max(a.y0,b.y0-pad);
 if(w<=0||h<=0)return 0;
 const areaA=Math.max(.0001,(a.x1-a.x0)*(a.y1-a.y0)),
  areaB=Math.max(.0001,(b.x1-b.x0)*(b.y1-b.y0));
 return w*h/Math.min(areaA,areaB);
}

// Resolve camera-space collisions among ordinary gameplay blockers, without
// ever relocating required hoops, pads, the bank wall or the target cup.
function separateBlockersOnScreen(){
 if(!camera||!obstacles.length)return false;
 const bounds=(x,y,z,w,h,d)=>new THREE.Box3(
  new THREE.Vector3(x-w,y-h,z-d),new THREE.Vector3(x+w,y+h,z+d));
 const swing=settings.moving||0;
 const protect=[{rect:screenRect(bounds(
  settings.x,.19+settings.topPad+settings.targetHeight*.55,settings.targetZ,
  settings.radius*1.45+swing+.15,
  settings.targetHeight*.65+(settings.motion==='lift'?swing:0)+.12,
  settings.radius*1.5+.22)),weight:7}];
 for(const pad of pads)protect.push({rect:screenRect(bounds(
  pad.x,pad.y,pad.z,pad.r+.20,.3,pad.r+.20)),weight:5});
 for(const hoop of hoops)protect.push({rect:screenRect(bounds(
  hoop.baseX,hoop.baseY,hoop.z,hoop.r+(settings.hoopMove?.33:0),
  hoop.r+.24,.23)),weight:6});
 if(wallPad)protect.push({rect:screenRect(bounds(
  wallPad.x,wallPad.y,wallPad.z,.17,wallPad.height*.5,wallPad.length*.5)),weight:5});
 const separated=[];let moved=false;
 // Nearer silhouettes are evaluated first so foreground blockers stay
 // consistent across retries. Displacements are capped at about one metre.
 for(const ob of [...obstacles].sort((a,b)=>b.z-a.z)){
  if(ob.sourceX===undefined)ob.sourceX=ob.type==='barrier'?ob.centerX:ob.x;
  const authoredX=ob.sourceX;
  let best={score:Infinity,x:authoredX,rect:null};
  for(const dx of [0,-.24,.24,-.48,.48,-.76,.76,-1.03,1.03]){
   const x=authoredX+dx;
   if(Math.abs(x)>3.65)continue;
   ob.obj.position.x=x;
   if(ob.support)ob.support.position.x=x;
   ob.obj.updateWorldMatrix(true,true);
   const rect=screenRect(new THREE.Box3().setFromObject(ob.obj));
   if(!rect)continue;
   let conflict=0;
   for(const item of protect)
    conflict+=item.weight*Math.max(0,screenOverlap(rect,item.rect,.012)-.08);
   for(const prior of separated)
    conflict+=3*Math.max(0,screenOverlap(rect,prior,.020)-.10);
   const score=conflict+Math.abs(dx)*.095;
   if(score<best.score)best={score,x,rect};
  }
  ob.obj.position.x=best.x;
  if(ob.support)ob.support.position.x=best.x;
  if(ob.type==='barrier')ob.centerX=best.x;
  ob.x=best.x;
  if(best.rect)separated.push(best.rect);
  if(Math.abs(best.x-authoredX)>.01)moved=true;
 }
 return moved;
}

function validateLevelReadability(){
 if(!camera||!group||!decorCandidates.length)return false;
 const bounds=(x,y,z,w,h,d)=>new THREE.Box3(
  new THREE.Vector3(x-w,y-h,z-d),new THREE.Vector3(x+w,y+h,z+d));
 group.updateMatrixWorld(true);
 const swing=settings.moving||0;
 const protectedRects=[{rect:screenRect(bounds(
  settings.x,.19+settings.topPad+settings.targetHeight*.5,settings.targetZ,
  settings.radius*1.5+swing+.18,
  settings.targetHeight*.65+(settings.motion==='lift'?swing:0)+.19,
  settings.radius*1.5+(settings.motion==='depth'?swing:0)+.25)),weight:9}];
 for(const ring of hoops)protectedRects.push({rect:screenRect(bounds(
  ring.baseX,ring.baseY,ring.z,ring.r+(settings.hoopMove?.36:.04),ring.r+.24,.28)),
  weight:7});
 for(const pad of pads)protectedRects.push({rect:screenRect(bounds(
  pad.x,pad.y,pad.z,pad.r+.23,.28,pad.r+.23)),weight:7});
 if(wallPad)protectedRects.push({rect:screenRect(bounds(
  wallPad.x,wallPad.y,wallPad.z,.19,wallPad.height/2,wallPad.length/2)),weight:7});
 for(const obstruction of obstacles)protectedRects.push({
  rect:screenRect(new THREE.Box3().setFromObject(obstruction.obj)),
  weight:obstruction.type==='barrier'?3:1.5});
 let changed=false;const taken=[];
 for(const decor of decorCandidates){
  const obj=decor.obj,baseX=decor.baseX??(decor.baseX=obj.position.x),
   baseZ=decor.baseZ??(decor.baseZ=obj.position.z),
   side=decor.side||1;
  let best={score:Infinity,x:baseX,z:baseZ,rect:null};
  for(const slide of [0,.65,1.30,1.95,2.45]){
   for(const depth of [0,-.65,-1.25]){
    if(Math.abs(decor.anchorX+side*slide)>6.60)continue;
    const x=baseX+side*slide,z=baseZ+depth;
    obj.visible=true;obj.position.set(x,obj.position.y,z);
    obj.updateWorldMatrix(true,true);
    const projected=screenRect(new THREE.Box3().setFromObject(obj));
    if(!projected)continue;
    let overlap=0;
    for(const item of protectedRects)
     overlap+=item.weight*Math.max(0,screenOverlap(projected,item.rect,.015)-.07);
    for(const prior of taken)overlap+=2*Math.max(0,screenOverlap(projected,prior,.012)-.11);
    const score=overlap+slide*.035+(-depth)*.030;
    if(score<best.score)best={score,x,z,rect:projected};
   }
  }
  obj.position.set(best.x,obj.position.y,best.z);
  // Optional decor can vanish rather than obscure a cup or a required pad.
  obj.visible=best.score<.88;
  obj.updateWorldMatrix(true,true);
  if(obj.visible&&best.rect)taken.push(best.rect);
  if(!obj.visible||Math.abs(best.x-baseX)>.01||Math.abs(best.z-baseZ)>.01)
   changed=true;
 }
 return changed;
}


// Art-direction budget inspired by readable mobile trick-shot stages: reserve
// the centre for the projectile and use room furniture only to FRAME a shot.
// These are visual composition decisions; the authored gameplay is untouched.
function stageArtPlan(spec){
 const tricks=(spec.hoops||0)+(spec.wallCount||0)+(spec.padCount||0)+
  (spec.bankRequired?1:0)+(spec.fanZone?1:0)+(spec.barrierCount||0)+
  (spec.lid?1:0)+(spec.motion!=='still'?1:0);
 return {
  tricks,
  sideDesks:tricks>=4?0:tricks>=2?1:2,
  sidePlants:tricks>=3?0:1,
  worktopClutter:tricks<=1,
  heroExtras:tricks<=2,
  visualRoom:spec.sceneId,
  focusColor:spec.color
 };
}

function buildWorld(){
 if(!hasRenderer)return;
 worldClean();
 group=new THREE.Group();scene.add(group);
 obstacles=[];pads=[];hoops=[];wallPad=null;wallPads=[];airZone=null;fanFields=[];physicsBodies=[];physicsGrid=new Map();physicsGlobal=[];physicsMoving=[];specialSurfaces=[];decorCandidates=[];readabilityAspect=0;ambient=[];aimLine=[];targetLift=null;targetShadow=null;ballTrailMeshes=[];impactRing=null;impactAge=2;cupLid=null;lidOpen=null;
 const sets=[
  {walls:0xc7d4cf,carpet:0x738981,desk:0xc49c7c,trim:0x436977,name:'THE CUBICLE'},
  {walls:0xd8cbb9,carpet:0x7b8c86,desk:0xc29a77,trim:0x536d79,name:'MEETING ROOM'},
  {walls:0xc4d2d7,carpet:0x6d8392,desk:0xbfa080,trim:0x4c7283,name:'MAILROOM'},
  {walls:0xe0d9c5,carpet:0x899186,desk:0xc8a28b,trim:0x73796a,name:'BREAK ROOM'},
  {walls:0x728c9c,carpet:0x495f74,desk:0x9f8166,trim:0x3c6173,name:'NIGHT SHIFT'},
  {walls:0xa5a096,carpet:0x686260,desk:0xb19677,trim:0x70635e,name:'ARCHIVE'},
  {walls:0xd4ddd2,carpet:0x78958a,desk:0xcdb18f,trim:0x477976,name:'RECEPTION'},
  {walls:0xb1a8a2,carpet:0x656273,desk:0xbca283,trim:0x6e5b65,name:'AWARDS OFFICE'},
  {walls:0xa1afb0,carpet:0x5c7073,desk:0xb09775,trim:0x5a737b,name:'SHIPPING DOCK'},
  {walls:0x667e91,carpet:0x42586b,desk:0x977f6d,trim:0x416a80,name:'SERVER ROOM'}
 ];
 const theme=sets[settings.sceneId],roomEnd=settings.targetZ-4.15;
 const artPlan=stageArtPlan(settings);
 // Ten authored-looking layouts: each room has a day/night and workday/after-hours state,
 // and the challenge layout changes its foreground props per individual level.
 const lightingMode=(level-1)%10>=5;
 const sceneTone=[0x526977,0x756e68,0x526574,0x776f5f,0x4f5e70,0x5a5450,0x657874,0x605866,0x5f6e71,0x394f61][settings.sceneId];
 const nearDeskTone=settings.roomVariant?0x695348:theme.desk;
 const roomMiddle=(LAUNCH_Z+5+roomEnd)/2,roomLength=LAUNCH_Z+5-roomEnd;
 const wallMat=createMat(theme.walls,.91),carpet=createMat(theme.carpet,.94);
 wallMat.map=roomTexture('wall',level,5,3);
 wallMat.bumpMap=surfaceRelief('wall',level,5,3);wallMat.bumpScale=.009;
 carpet.map=roomTexture('carpet',level+23,9,8);
 carpet.bumpMap=surfaceRelief('carpet',level+23,9,8);carpet.bumpScale=.014;
 const wood=createMat(nearDeskTone,.48,.04),darkWood=createMat(0x45392f,.68);
 wood.map=roomTexture('wood',level+39,3,2);
 wood.bumpMap=surfaceRelief('wood',level+39,3,2);wood.bumpScale=.012;
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
  for(const x of [-3.5,3.5])for(const dz of [-.48,.48])
   meshBox(group,.13,1.23,.13,x,.615,roomEnd+1.25+dz,metal);
  roundedPoster(group,'WELCOME',0,4.8,roomEnd+.42);
  }else if(settings.sceneId===7){
  // Awards Office: no opaque frames across the left-hand skyline window.
  for(let i=0;i<6;i++){
   const xx=1.48+(i%3)*1.49,yy=3.09+Math.floor(i/3)*1.54;
   meshBox(group,1.12,1.13,.08,xx,yy,roomEnd+.36,wood);
   meshBox(group,.96,.97,.09,xx,yy,roomEnd+.42,
    createMat([0xae956e,0x7d8997,0x9c897e][i%3],.35,.22));
   const disk=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.09,24),
    createMat(0xc8a05e,.34,.48));
   disk.rotation.x=Math.PI/2;disk.position.set(xx,yy+.13,roomEnd+.52);group.add(disk);
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
 roomArchitecture(roomEnd,roomLength,settings.sceneId,settings.roomVariant,theme);
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
 // Avoid two wall displays competing in the Awards Office.
 if(settings.sceneId!==7){
  const cork=meshBox(group,2.8,1.55,.19,3.75,4.1,roomEnd+.22,
   createMat(0x95755b));
  const noteMat=[0xffe5a4,0xcad8b0,0xe4c0d9,0xc0d8e5];
  for(let i=0;i<6;i++){
   const note=meshBox(group,.52+(i%3)*.15,.39+(i%2)*.10,.02,
    2.8+(i%3)*.8,4.55-Math.floor(i/3)*.62,roomEnd+.35,
    createMat(noteMat[(i+level)%4],.92));
   note.rotation.z=(i%3-1)*.075;
  }
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
 // Deliberate side dressing: always frame the cup rather than filling the
 // entire flight corridor with four copy-pasted desks and loose boxes.
 // Early stages feel lived-in; harder stages progressively clear the view.
 for(const side of [-1,1]){
  const showSideDesk=artPlan.sideDesks===2||
   (artPlan.sideDesks===1&&side=== (settings.x>=0?-1:1));
  if(showSideDesk){
   const z=roomEnd+2.55+(settings.roomVariant?.36:0),x=side*5.65;
   const sideSet=new THREE.Group();group.add(sideSet);
   desk(sideSet,x,z,2.9,1.48,1.00,wood,metal);
   if(artPlan.heroExtras)officeMonitor(sideSet,x,1.08,z-.22,-side*.16);
   else stackBooks(sideSet,x,1.15,z-.25,2,level);
   officeChair(sideSet,x,z+1.18);
   // Decorations can retreat if they silhouette a needed hoop or cup.
   decorCandidates.push({obj:sideSet,side,anchorX:x,label:'side-office'});
  }
  if(artPlan.sidePlants){
   const cornerPlant=new THREE.Group();group.add(cornerPlant);
   plant(cornerPlant,side*6.82,roomEnd+1.05,.91);
   decorCandidates.push({obj:cornerPlant,side,anchorX:side*6.82,
    label:'corner-plant'});
  }
 }
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
 // Physically grounded launch cradle follows horizontal aim and supports
 // the ball instead of leaving it hovering above the near desk.
 launcher=new THREE.Group();launcher.position.set(launchOffset(),0,LAUNCH_Z);
 group.add(launcher);
 const cradle=createMat(0x314d55,.33,.52),bronze=createMat(0xd6ae7b,.38,.30);
 const cradleBase=new THREE.Mesh(new THREE.CylinderGeometry(.24,.27,.048,36),cradle);
 cradleBase.position.y=1.145;cradleBase.castShadow=true;launcher.add(cradleBase);
 const cradleStem=new THREE.Mesh(new THREE.CylinderGeometry(.077,.106,.072,28),bronze);
 cradleStem.position.y=1.196;launcher.add(cradleStem);
 const cradleSeat=new THREE.Mesh(new THREE.TorusGeometry(.090,.019,12,32),cradle);
 cradleSeat.rotation.x=-Math.PI/2;cradleSeat.position.y=1.228;launcher.add(cradleSeat);
 // Keep the foreground clear so the ball and target remain unobstructed.
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
 // A quiet, grounded highlight brings attention to the exact scoring table.
 // It behaves like a soft inlay, not a glowing billboard blocking the target.
 const accentDisc=new THREE.Mesh(new THREE.CircleGeometry(Math.min(1.21,settings.radius*2.12),48),
  new THREE.MeshBasicMaterial({color:artPlan.focusColor,transparent:true,
   opacity:.12,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
 accentDisc.rotation.x=-Math.PI/2;accentDisc.position.set(0,stationY+.155,0);
 accentDisc.renderOrder=1;farDesk.add(accentDisc);
 const accentLine=new THREE.Mesh(new THREE.TorusGeometry(settings.radius*1.43,.020,9,50),
  new THREE.MeshBasicMaterial({color:artPlan.focusColor,transparent:true,
   opacity:.44,depthWrite:false}));
 accentLine.rotation.x=Math.PI/2;accentLine.position.y=stationY+.16;
 farDesk.add(accentLine);
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
 if(!artPlan.worktopClutter){
  // An uncluttered target silhouette wins over background storytelling.
  // The station geometry itself still identifies the office setting.
 }else if(settings.sceneId===0){
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
  const plantCorner=new THREE.Group();group.add(plantCorner);
  plant(plantCorner,settings.x+2.4,settings.targetZ-.4,1.1);
  decorCandidates.push({obj:plantCorner,side:Math.sign(settings.x+2.4)||1,
   anchorX:settings.x+2.4,label:'side-plant'});
 }else{
  // Distinct desktop computers at the two rear corners instead of
  // a wall of four overlapping black rectangles directly behind the cup.
  for(const side of [-1,1]){
   officeMonitor(farDesk,side*1.48,stationY+.20,-.80,side*.06);
   meshBox(farDesk,.70,.035,.27,side*1.48,stationY+.24,-.30,dark);
  }
 }
 // Variety: the actual cup is always open and visible on its own tray.
 cupGroup=new THREE.Group();cupGroup.position.set(settings.x,.19+settings.topPad,settings.targetZ);group.add(cupGroup);
 targetShadow=softContactShadow(group,settings.x,settings.topPad+.14,
  settings.targetZ,settings.radius*1.75,settings.radius*1.55);
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
 // Subtle dark ring outlines a pale target against bright shelves/windows.
 const contrastRim=new THREE.Mesh(new THREE.TorusGeometry(r*1.055,.017,8,40),
  new THREE.MeshBasicMaterial({color:0x2c525f,depthWrite:false}));
 contrastRim.rotation.x=Math.PI/2;contrastRim.position.y=h+.015;
 cupGroup.add(contrastRim);
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
 // A rounded ceramic coaster moves with the cup instead of a square slab.
 const saucer=new THREE.Mesh(new THREE.CylinderGeometry(r*1.27,r*1.31,.092,48),
  createMat(0xf1e6d4,.43,.07));
 saucer.position.y=-.095;saucer.receiveShadow=true;cupGroup.add(saucer);
 const saucerRim=new THREE.Mesh(new THREE.TorusGeometry(r*1.23,.019,8,48),
  createMat(0xd5bca3,.31,.11));
 saucerRim.rotation.x=Math.PI/2;saucerRim.position.y=-.045;cupGroup.add(saucerRim);
 // A lively original coworker anchors the office perspective. Always
 // placed on the opposite side from the target so they never hide its rim.
 // Outfit and desk pose change by stage rather than repeating one backdrop.
 const coworkerX=settings.x>=0?-2.25:2.25;
 const coworkerZ=settings.targetZ-1.55;
 if(settings.sceneId!==2||settings.tier%2===0){
  // One coherent vignette: desk, chair and colleague travel together.
  const vignette=new THREE.Group();group.add(vignette);
  const colleague=officeColleague(vignette,coworkerX,coworkerZ,level);
  colleague.rotation.y=(settings.tier%3-1)*.19;
  ambient.push({type:'colleague',obj:colleague});
  officeChair(vignette,coworkerX,coworkerZ+.43);
  meshBox(vignette,2.25,.13,1.05,coworkerX,1.07,coworkerZ-.23,wood);
  officeMug(vignette,coworkerX+((level%2)?-.68:.68),1.15,
   coworkerZ-.38,0xb8a18d,.73);
  decorCandidates.push({obj:vignette,side:Math.sign(coworkerX),
   anchorX:coworkerX,label:'colleague'});
 }
 // The cup's warm rim and coaster identify the target; no floating sign
 // obscures the throw trajectory or turns the 3D scene into a HUD.
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
   const isPaper=settings.feature==='sticky'||settings.feature==='letters';
   const woodFrame=createMat(0x8b7460,.67,.08),cork=createMat(0xb99b7e,.93);
   if(isPaper){
    // A corkboard on a proper freestanding easel: pinned, angled paper
    // and real pushpins, instead of 12 flat rectangles floating in space.
    meshBox(feature,2.08,1.73,.14,0,2.23,0,woodFrame);
    meshBox(feature,1.86,1.51,.04,0,2.23,-.103,cork);
    for(const sx of [-1,1]){
     const leg=meshBox(feature,.10,2.07,.11,sx*.81,1.08,.12,woodFrame);
     leg.rotation.z=-sx*.09;
    }
    meshBox(feature,1.82,.082,.33,0,1.26,-.10,woodFrame);
    for(let i=0;i<9;i++){
     const col=i%3,row=Math.floor(i/3);
     const x=(col-1)*.53,y=2.69-row*.44;
     const paperMat=createMat([0xf1e5b9,0xcbdccf,0xd6dfed,0xf0ccbd][(i+level)%4],.94);
     const note=meshBox(feature,.35,.30,.012,x,y,-.137,paperMat);
     note.rotation.z=Math.sin(i*2.40+level)*.065;
     for(let k=0;k<2;k++){
      const dash=meshBox(feature,.24-k*.045,.008,.007,
       x-.025,y+.04-k*.077,-.145,createMat(0x8b8e82,.92));
      dash.rotation.z=note.rotation.z;dash.castShadow=false;
     }
     const pin=new THREE.Mesh(new THREE.SphereGeometry(.028,10,8),
      createMat([0xda867b,0x87b9aa,0xe5bc7c][i%3],.33,.2));
     pin.position.set(x,y+.133,-.165);feature.add(pin);
    }
   }else{
    // A proper filing shelf, back rail and upright labeled binders.
    const shelf=createMat(0x677b83,.43,.31);
    for(const sx of [-1,1])
     meshBox(feature,.12,2.15,.69,sx*.90,1.34,.04,shelf);
    for(let row=0;row<3;row++){
     const yy=.57+row*.78;
     meshBox(feature,2.03,.13,.82,0,yy,0,wood);
     for(let i=0;i<5;i++){
      const bx=-.68+i*.34,shade=[0x82a6a6,0xb68b85,0xa3a188,0x8593a7][(i+row+level)%4];
      const binder=meshBox(feature,.27,.49,.57,bx,yy+.32,-.05,
       createMat(shade,.62));
      binder.rotation.z=Math.sin(i+row)*.036;
      meshBox(feature,.16,.12,.013,bx,yy+.39,-.343,
       createMat(0xf3ead7,.88));
      const hole=new THREE.Mesh(new THREE.TorusGeometry(.024,.007,6,12),
       createMat(0xbec8c8,.37,.45));
      hole.position.set(bx,yy+.17,-.345);feature.add(hole);
     }
    }
   }
   break;
  }
  case 'kettle':case 'coffee':case 'lunch':case 'teapot':{
   const counter=desk(feature,0,0,2.4,1.05,1.04,wood,metal);
   const kettleBody=new THREE.Mesh(new THREE.SphereGeometry(.40,24,18),
    createMat(0xb9c4c3,.29,.48));
   kettleBody.scale.set(.96,.92,.83);kettleBody.position.set(-.58,1.44,0);
   kettleBody.castShadow=true;feature.add(kettleBody);
   const kettleLid=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.07,24),ink);
   kettleLid.position.set(-.58,1.80,0);feature.add(kettleLid);
   const knob=new THREE.Mesh(new THREE.SphereGeometry(.072,10,9),ink);
   knob.position.set(-.58,1.87,0);feature.add(knob);
   const spout=new THREE.Mesh(new THREE.ConeGeometry(.13,.39,16),
    createMat(0xc1cccb,.34,.36));
   spout.rotation.z=-1.20;spout.position.set(-.13,1.58,0);feature.add(spout);
   const handle=new THREE.Mesh(new THREE.TorusGeometry(.24,.066,9,30,Math.PI*1.48),
    ink);
   handle.position.set(-.95,1.54,0);handle.rotation.z=-.20;feature.add(handle);
   for(let i=0;i<3;i++){
    const mug=officeMug(feature,.27+i*.34,1.17,0,
     [0xe0a78c,0x86bdba,0xe0c48e][i],.88);
    mug.rotation.y=i*.65;
   }
   break;
  }
  case 'printer':case 'scanner':case 'shredder':{
   meshBox(feature,2.05,1.04,1.24,0,.56,0,drawer);
   meshBox(feature,2.15,.11,1.28,0,1.11,0,stone);
   for(let i=0;i<2;i++){
    meshBox(feature,1.65,.18,.035,0,.33+i*.29,.64,ink);
    meshBox(feature,.48,.035,.047,0,.33+i*.29,.675,metal);
   }
   officePrinter(feature,0,1.51,-.04,createMat(0xb2bdbb,.34,.25),1.48);
   break;
  }
  case 'sunblind':case 'glass':case 'whiteboard':{
   for(const side of [-1,1]){
    meshBox(feature,.12,1.91,.12,side*.93,.955,.14,metal);
    meshBox(feature,.38,.07,.50,side*.93,.05,.15,ink);
   }
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
   const counter=desk(feature,0,0,3.2,1.20,1.08,wood,metal);
   for(const [i,xx] of [-.80,.80].entries()){
    officeMonitor(feature,xx,1.41,-.12,(i===0?-.13:.13));
    meshBox(feature,.63,.045,.23,xx,1.19,.40,ink);
   }
   const mouse=new THREE.Mesh(new THREE.SphereGeometry(.095,12,10),
    createMat(0x627b83,.42,.20));
   mouse.scale.set(.82,.32,1.4);
   mouse.position.set(0,1.19,.44);feature.add(mouse);
   break;
  }
  case 'archive':case 'packages':case 'conveyor':case 'forklift':{
   // Grounded packing rack, with readable tape, seams and shipping labels.
   const rack=createMat(0x627984,.42,.43),brace=createMat(0x465b65,.54,.36);
   for(const sx of [-1,1]){
    meshBox(feature,.13,3.15,.14,sx*1.07,1.64,.04,rack);
    meshBox(feature,.14,3.15,.14,sx*1.07,1.64,-.68,rack);
   }
   for(let row=0;row<3;row++){
    const yy=.42+row*.96;
    meshBox(feature,2.34,.12,1.52,0,yy,-.30,rack);
    for(let col=0;col<3;col++){
     const p=officeParcel(feature,(col-1)*.70,yy+.067,-.32,
      row*3+col+level);
     p.rotation.y=(col-1)*.09;
    }
   }
   meshBox(feature,2.18,.08,.08,0,1.55,-.73,brace);
   break;
  }
  case 'trophies':case 'mailbox':{
   if(settings.feature==='mailbox'){
    const steel=createMat(0x81929c,.33,.46),accent=createMat(0x536e7a,.51,.2);
    meshBox(feature,2.3,2.18,.73,0,1.27,0,steel);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
     const xx=(col-1)*.65,yy=.65+row*.61;
     meshBox(feature,.57,.47,.04,xx,yy,-.4,accent);
     const slit=meshBox(feature,.34,.024,.04,xx,yy+.12,-.442,woodPaper);
     slit.castShadow=false;
     const knob=new THREE.Mesh(new THREE.SphereGeometry(.033,10,7),
      createMat(0xd1bc8a,.31,.52));
     knob.position.set(xx,yy-.12,-.446);feature.add(knob);
    }
   }else{
    const stand=desk(feature,0,0,2.32,.89,.92,wood,metal);
    meshBox(feature,2.05,.16,.66,0,1.52,0,wood);
    for(let i=0;i<3;i++){
     const xx=(i-1)*.70;
     officeTrophy(feature,xx,i===1?1.59:.99,-.08,i+level);
    }
   }
   break;
  }
  case 'fan':case 'airvent':{
   // A passive HVAC duct (not a pretend functional desk fan). All animated
   // fans elsewhere use their own physical airflow emitters.
   meshBox(feature,1.68,1.65,.59,0,.825,.1,drawer);
   meshBox(feature,1.85,.12,.69,0,1.71,.08,metal);
   meshBox(feature,1.84,.86,.47,0,2.05,0,stone);
   const vent=meshBox(feature,1.66,.72,.07,0,2.06,-.28,ink);
   for(let i=0;i<7;i++){
    const fin=meshBox(feature,1.43,.048,.044,0,1.81+i*.086,-.33,metal);
    fin.rotation.x=.10;
   }
   for(const side of [-1,1]){
    const duct=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.92,16),metal);
    duct.rotation.z=Math.PI/2;duct.position.set(side*1.15,2.06,0);
    feature.add(duct);
   }
   break;
  }
  default:{
   pole(1.7);
   meshBox(feature,2.0,.18,.80,0,1.47,0,wood);
   for(let i=0;i<5;i++)
    meshBox(feature,.27,.36,.41,(i-2)*.33,1.73,0,
     createMat([0x779ca2,0xbcaa8a,0x8f8a9e][i%3]));
  }
 }
 // A set piece is visual flavor, never a reason to conceal a required target.
 decorCandidates.push({obj:feature,side:featureSide,
  anchorX:feature.position.x,label:'setpiece'});
 // Level name already appears in the HUD; no duplicate floating wall sign.
 // Level-specific set dressing: practical office obstacles at distinctly
 // different heights, foreground silhouettes, and a different challenge path.
 if(settings.sceneId===0){
  // Cabinet beneath the document stack: papers no longer hover.
  meshBox(group,1.11,1.07,.92,-2.4,.535,settings.targetZ+.66,wood);
  meshBox(group,1.20,.10,1.00,-2.4,1.12,settings.targetZ+.66,metal);
  stackBooks(group,-2.4,1.18,settings.targetZ+.66,2+(level%4),level+1);
  plant(group,3.3,settings.targetZ-1.4,.9);
 }else if(settings.sceneId===1){
  // Projector stands on a wheeled AV table, not free-floating.
  const projector=meshBox(group,1.28,.35,.85,2.0,2.2,settings.targetZ+.8,dark);
  meshBox(group,1.52,.12,1.08,2,1.97,settings.targetZ+.8,wood);
  for(const dx of [-.55,.55])for(const dz of [-.38,.38])
   meshBox(group,.10,1.88,.10,2+dx,.94,settings.targetZ+.8+dz,metal);
  projector.rotation.y=.14;
  const paperworkZ=settings.targetZ+.9;
  meshBox(group,2.65,.10,.85,-2.1,1.12,paperworkZ,wood);
  for(const xx of [-3.16,-1.04])
   meshBox(group,.11,1.07,.11,xx,.535,paperworkZ,metal);
  for(let k=0;k<3;k++)meshBox(group,.65,.025,.38,-2.8+k*.7,1.17,paperworkZ,paper);
 }else if(settings.sceneId===2){
  for(let k=0;k<3;k++){
   meshBox(group,.9,.63,.75,3.7,(k+.5)*.66,settings.targetZ+.8,
    createMat(k%2?0x9e927d:0x8f9d99,.85));
  }
 }else if(settings.sceneId===3){
  const kettleMat=createMat(0xa8acaa,.3,.48);
  meshBox(group,1.15,1.19,.94,-2.6,.595,settings.targetZ+.65,metal);
  meshBox(group,1.20,.10,.98,-2.6,1.22,settings.targetZ+.65,wood);
  const urn=new THREE.Mesh(new THREE.CylinderGeometry(.27,.34,.67,20),kettleMat);
  urn.position.set(-2.6,1.6,settings.targetZ+.65);group.add(urn);
  // Ceramic dishes stack on a grounded side counter rather than in the air.
  meshBox(group,1.03,1.12,.86,2.9,.56,settings.targetZ+.6,metal);
  meshBox(group,1.14,.09,.94,2.9,1.16,settings.targetZ+.6,wood);
  for(let k=0;k<3;k++){
   const tray=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.045,16),cream);
   tray.position.set(2.9,1.15+k*.09,settings.targetZ+.6);group.add(tray);
  }
 }else{
  // Late-shift cubicle: clusters of luminous monitors on the side desk.
  meshBox(group,2.85,.14,.92,-1.6,1.45,settings.targetZ+.6,wood);
  for(const xx of [-2.76,-.44])
   meshBox(group,.10,1.36,.10,xx,.68,settings.targetZ+.6,metal);
  for(let k=0;k<3;k++){
   const screen=meshBox(group,.65,.53,.10,-2.4+k*.8,1.84,settings.targetZ+.6,dark);
   meshBox(group,.085,.20,.085,screen.position.x,1.53,screen.position.z,metal);
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
  // Shared neutral treatment lets colored trick-shot objects stand out.
  const paint=createMat(style==='plant'?0x7c9b89:style==='cart'?0x6a8894:0x84949b,.67);
  let oy=1.65,w=.80,h=.86,depth=.52;
  if(style==='screen'||style==='monitor'){
   oy=2.16;w=1.48;h=1.06;depth=.30;
   officeMonitor(g,0,1.60,0,(i%2?-.07:.07));
   meshBox(g,.75,.03,.27,0,1.44,-.24,dark);
   for(let k=0;k<6;k++)
    meshBox(g,.055,.012,.028,-.25+k*.10,1.462,-.24,cream).castShadow=false;
  }else if(style==='partition'){
   oy=2.02;w=.82;h=1.82;depth=.24;
   meshBox(g,w,h,depth,0,oy,0,createMat(0x7d9298));
   meshBox(g,w*.9,.14,.29,0,oy+h*.5,0,metal);
   for(let k=0;k<3;k++)meshBox(g,.46,.10,.025,0,oy+.3-k*.22,-.135,paper);
  }else if(style==='printer'||style==='projector'){
   oy=1.77;w=1.15;h=.55;depth=.88;
   officePrinter(g,0,oy,0,createMat(0xaebabc,.38,.25));
   if(style==='projector'){
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.07,20),
     createMat(0x3d5662,.20,.50));
    lens.rotation.x=Math.PI/2;lens.position.set(0,oy,-.48);g.add(lens);
   }
  }else if(style==='mugstack'||style==='teapot'){
   oy=1.51;w=.62;h=.78;depth=.55;
   for(let k=0;k<3;k++){
    const cup=officeMug(g,Math.sin(k*2.3)*.07,1.19+k*.225,
     Math.cos(k*2.1)*.025,[0xc29d82,0x8eb6bb,0xc9b17d][k],.91);
    cup.rotation.y=k*1.25;
   }
  }else if(style==='plant'){
   oy=1.57;w=.72;h=1.12;depth=.72;plant(g,0,0,.98);
   // Grounded pot: avoid the unexplained one-metre floating plant.
  }else if(style==='lamp'){
   oy=2.04;w=.65;h=.98;depth=.53;
   officeLamp(g,0,1.45,0,1.1);
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
  // Floor-supported modular obstacle furniture. Every raised prop uses the
  // same four-legged low stand instead of levitating above the shot lane.
  if(style==='partition'){
   for(const side of [-1,1]){
    meshBox(g,.10,1.23,.20,side*.33,.615,0,metal);
    meshBox(g,.34,.06,.50,side*.33,.04,0,dark);
   }
  }else if(style==='cart'){
   for(const side of [-1,1])for(const depthSide of [-1,1]){
    meshBox(g,.11,1.05,.11,side*.42,.525,depthSide*.43,metal);
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.07,12),dark);
    wheel.rotation.z=Math.PI/2;wheel.position.set(side*.42,.11,depthSide*.43);g.add(wheel);
   }
  }else if(style!=='plant'){
   const surface=style==='screen'||style==='monitor'?1.30:
    style==='printer'||style==='projector'?1.44:
    style==='mugstack'||style==='teapot'?1.16:
    style==='lamp'?1.42:
    style==='books'||style==='files'||style==='folders'?1.34:1.16;
   const width=Math.max(1.10,w+.25),length=Math.max(.88,depth+.24);
   meshBox(g,width,.10,length,0,surface-.05,0,paint);
   const supportHeight=surface-.10;
   for(const side of [-1,1])for(const depthSide of [-1,1])
    meshBox(g,.10,supportHeight,.10,side*(width/2-.13),supportHeight/2,
     depthSide*(length/2-.13),metal);
   meshBox(g,width-.20,.06,.10,0,.23,length*.35,dark);
  }
  obstacles.push({type:style,obj:g,x,y:style==='plant'?.78:oy,
   z,w,h,d:depth});
 }
 // Only Chapter 4+ introduces moving blockers. Their positions and timing
 // are explicit in each level blueprint, not a repeated evenly spaced gate.
 for(let i=0;i<settings.barrierPlan.length;i++){
  const [style,t,offset,midY]=settings.barrierPlan[i];
  const x=settings.x*t+offset,z=LAUNCH_Z-settings.d*t;
  const g=new THREE.Group();g.position.set(x,midY,z);group.add(g);
  const mount=new THREE.Group();mount.position.set(x,0,z);group.add(mount);
  const shutter=style==='panel';
  const body=createMat(shutter?0x889fab:0xa08b82,.55,.18);
  meshBox(g,shutter?1.05:1.14,shutter?.52:.31,.24,0,0,0,body);
  meshBox(g,.53,.042,.05,0,.04,-.15,cream);
  // Common coral hazard trim differentiates moving blockers from furniture.
  const warning=createMat(0xf0b27f,.42,.08,0xa25938);
  for(const side of [-1,1])
   meshBox(g,.075,shutter?.52:.32,.255,side*(shutter?.50:.545),0,0,warning);
  // Ceiling-mounted shutter lifts vertically; filing drawers slide sideways.
  if(shutter){
   for(const side of [-1,1]){
    meshBox(mount,.09,1.18,.13,side*.61,midY+.49,0,metal);
     const railTop=midY+1.08,postHeight=Math.max(.1,7.25-railTop);
     meshBox(mount,.08,postHeight,.12,side*.61,railTop+postHeight/2,0,metal);
   }
  }else{
   meshBox(mount,2.18,.055,.28,0,midY-.26,0,dark);
    for(const side of [-1,1]){
     const height=Math.max(.30,midY-.26);
     meshBox(mount,.10,height,.12,side*1.02,height/2,0,metal);
     meshBox(mount,.28,.06,.35,side*1.02,.045,0,dark);
    }
  }
  const amp=shutter?.48:.64;
  obstacles.push({type:'barrier',style,obj:g,support:mount,x,y:midY,z,
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
  addFanJet({kind:'cross',side,power:1.3+Math.abs(settings.wind)*4.5},
   side*2.75,z,fan,'ROOM VENT');
 }

 // Wall-cushion ricochet: actual mesh AND actual side-plane collision. An
 // illuminated frame clearly shows the only surface that counts as a wall bank.
 // Independently located bank walls. Their orange faces are the only
 // surfaces that count as a wall bank; multiple walls are sequential.
 for(let i=0;i<settings.wallPlan.length;i++){
  const spec=settings.wallPlan[i],side=spec.side,
   x=side*(spec.x||2.16),z=LAUNCH_Z-settings.d*spec.fraction,
   length=spec.length||3.65;
  const wall=new THREE.Group();wall.position.set(x,2.42,z);group.add(wall);
  specialSurfaces.push(wall);
  const rubber=createMat(0x617780,.78,.04),
   stripe=createMat(0xf2bb7a,.40,.04,0x4a291a);
  meshBox(wall,.17,3.55,length,0,0,0,rubber);
  for(const zz of [-length*.38,length*.38]){
   meshBox(wall,.16,.76,.15,0,-2.06,zz,metal);
   meshBox(wall,.65,.08,.52,0,-2.38,zz,dark);
  }
  for(let k=0;k<7;k++)
   meshBox(wall,.026,3.17,.065,-side*.112,0,
    -length*.42+k*(length*.84/6),stripe);
  for(const zz of [-length/2-.04,length/2+.04])
   meshBox(wall,.23,3.7,.10,0,0,zz,dark);
  for(const yy of [-1.76,1.76])
   meshBox(wall,.23,.10,length+.15,0,yy,0,dark);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.68,.31),
   makeText(settings.wallCount>1?'BANK '+(i+1):'BANK HERE',42,'#ffeac0','#485d65'));
  sign.rotation.y=side*Math.PI/2;
  sign.position.set(-side*.15,1.41,0);wall.add(sign);
  const indicator=new THREE.PointLight(0xf6c18d,1.7,3.4,2);
  indicator.position.set(-side*.38,.4,0);wall.add(indicator);
  const pad={x,z,side,y:2.42,height:3.55,length,mesh:wall,index:i};
  wallPads.push(pad);if(i===0)wallPad=pad;
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
  // Numbered hoops hang from a ceiling track, never float without support.
  const rig=new THREE.Group();group.add(rig);
  ambient.push({type:'scenery',obj:rig});
  const track=meshBox(rig,radius*2.75,.085,.22,x,7.24,z,metal);
  track.castShadow=false;
  const hangers=[];
  for(const side of [-1,1]){
   const pole=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,1,8),metal);
   pole.castShadow=false;rig.add(pole);hangers.push({pole,side});
  }
  const alignHoopRope=(hx,hy)=>{
   const bottom=hy+radius*.98,top=7.2,height=Math.max(.09,top-bottom);
   for(const holder of hangers){
    holder.pole.position.set(hx+holder.side*radius*.68,bottom+height/2,z);
    holder.pole.scale.y=height;
   }
  };
  alignHoopRope(x,y);
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
   material,glows,coreMaterial,ringLight,passed:false,alignHoopRope,
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
 // Distinct spaced launch carts: late-game pads no longer sit at one
 // fixed halfway point. A numbered sequence must be completed in order.
 for(let i=0;i<settings.padCount;i++){
  const fraction=settings.springFractions[i],z=LAUNCH_Z-settings.d*fraction,
   x=settings.x*fraction+(settings.padCount>1?(i===0?-.15:.10):0),
   padY=1.14+(settings.padCount>1&&i===1?.16:0);
  const cart=new THREE.Group();cart.position.set(x,0,z);group.add(cart);
  specialSurfaces.push(cart);
  const frame=createMat(0x55727a,.42,.36),rubber=createMat(0x2c4d53,.72,.10),
   springMaterial=createMat(0x63aaa5,.27,.23,0x276d65);
  meshBox(cart,1.75,.13,1.75,0,padY-.15,0,frame);
  meshBox(cart,1.59,.05,1.59,0,padY-.055,0,rubber);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   meshBox(cart,.12,padY-.24,.12,sx*.69,(padY-.24)/2,sz*.69,frame);
   const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.075,14),rubber);
   wheel.rotation.z=Math.PI/2;wheel.position.set(sx*.69,.13,sz*.69);cart.add(wheel);
  }
  meshBox(cart,1.38,.045,.07,0,.34,.63,frame);
  meshBox(cart,1.38,.045,.07,0,.79,.63,frame);
  const spring=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.09,40),
   springMaterial);spring.position.y=padY;cart.add(spring);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.74,.047,12,48),
   new THREE.MeshBasicMaterial({color:0xb6ffe1,transparent:true,opacity:.90}));
  ring.rotation.x=Math.PI/2;ring.position.y=padY+.065;cart.add(ring);
  for(let k=0;k<6;k++){
   const coil=new THREE.Mesh(new THREE.TorusGeometry(.26+k*.043,.012,6,40),
    createMat(0x91cabe,.30,.49));
   coil.rotation.x=Math.PI/2;coil.position.y=padY-.03-k*.018;cart.add(coil);
  }
  if(settings.padCount>1){
   const number=new THREE.Mesh(new THREE.PlaneGeometry(.51,.24),
    makeText('PAD '+(i+1),39,'#e9fff0','#29565e'));
   number.rotation.x=-Math.PI/2;
   number.position.set(0,padY+.071,0);cart.add(number);
  }
  // Far single-spring stages use a visibly textured high-grip pad:
  // it bleeds off speed rather than hurling the ball beyond the close cup.
  // The surface NEVER uses target coordinates to correct a rebound.
  const closePad=settings.padCount===1&&fraction>=.67;
  if(closePad){
   for(let dot=0;dot<11;dot++){
    const a=dot*2.4,radius=.28+.035*(dot%4);
    const grip=new THREE.Mesh(new THREE.SphereGeometry(.021,8,6),rubber);
    grip.position.set(Math.cos(a)*radius,padY+.056,Math.sin(a)*radius);
    cart.add(grip);
   }
  }
  pads.push({type:'spring',index:i,x,z,r:.71,y:padY+.05,mat:spring.material,
   plate:spring,glow:ring,lastImpact:-10,
   forwardGrip:closePad?.30:.53,sideGrip:closePad?.27:.79});
 }
 // Unlike set dressing, ambient haze should not compete with the ball.
 // Subtle dust motes in illuminated air. Each room feels occupied,
 // especially when viewed toward the window; purely decorative.
 const motes=new THREE.Group();group.add(motes);
 const moteMat=new THREE.MeshBasicMaterial({
  color:settings.roomVariant?0xb6d0dc:0xffe8c0,transparent:true,
  opacity:.20,depthWrite:false
 });
 for(let i=0;i<(artPlan.tricks>=3?5:10);i++){
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
 ballShadow=softContactShadow(group,0,1.15,LAUNCH_Z,.25,.25);
 if(ballShadow)ballShadow.material.opacity=.34;
 impactRing=new THREE.Mesh(new THREE.TorusGeometry(.21,.024,8,32),
  new THREE.MeshBasicMaterial({color:0xffd49a,transparent:true,opacity:0,
   depthWrite:false,side:THREE.DoubleSide}));
 impactRing.rotation.x=-Math.PI/2;impactRing.visible=false;group.add(impactRing);
 const impactHalo=new THREE.Mesh(new THREE.TorusGeometry(.22,.085,12,40),
  new THREE.MeshBasicMaterial({color:0xffd8a2,transparent:true,
   opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
 impactHalo.renderOrder=4;impactRing.add(impactHalo);
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
 camera.lookAt(settings.x*.42,1.64,settings.targetZ*.67);
 camera.updateMatrixWorld();
 const view=el.viewport.getBoundingClientRect();
 camera.aspect=Math.max(.40,view.width/Math.max(1,view.height));
 camera.fov=view.width<580?57:47;
 camera.updateProjectionMatrix();
 readabilityAspect=camera.aspect;
 separateBlockersOnScreen();
 validateLevelReadability();
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
  settings.springRequired?Math.hypot(LAUNCH_Z-settings.springZ,settings.springX):
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
  return settings.wind*1.32*(.2+.8*Math.max(0,wave));
 }
 return settings.wind*1.32*(.66+.34*Math.sin(time*.88+.7));
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
 const skip=[launcher,cupGroup,trajectoryGroup,ballMesh,ballShadow,
  impactRing,airZone?.cloud,...specialSurfaces,...ballTrailMeshes];
 for(const item of ambient)if(item.type==='dust'||item.type==='scenery')skip.push(item.obj);
 const moving=new Map();
 for(const obstacle of obstacles)if(obstacle.type==='barrier')
  obstacle.obj.traverse(m=>{if(m.isMesh)moving.set(m,obstacle);});
 physicsBodies=[];physicsGrid=new Map();physicsGlobal=[];physicsMoving=[];
 group.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry)return;
  for(let p=mesh;p;p=p.parent)if(!p.visible||skip.includes(p))return;
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
  const spread=f.kind==='lift'?.83+progress*.92:1.05+progress*1.40;
  const dy=f.kind==='lift'?(x-f.x)/spread:(y-f.y)/spread;
  const dz=(z-f.z)/(spread*1.05);
  const radial=dy*dy+dz*dz;
  if(radial>=1)continue;
  const flow=Math.pow(1-radial,1.18)*(.96-.28*progress)*
   (.86+.14*Math.sin(time*6.2+f.phase));
  // Air applies a noticeable acceleration only inside the visible plume.
  // Stage-safe fan force. The previous 6.2 multiplier could impart more
  // lateral velocity than the entire controllable throw, making some late
  // stages impossible. Keep the push visible but strictly recoverable.
  const push=Math.min(8.6,f.power*flow*2.65);
  if(f.kind==='lift'){fy+=push;fx+=f.side*push*.12;}
  else{fx+=f.dir*push;fy+=push*.09;}
 }
 return {x:clamp(fx,-9.0,9.0),y:clamp(fy,-9.0,9.0)};
}
function wallCollision(projectile,previousX,preview=false){
 let collided=false;
 for(const w of wallPads){
  const before=previousX-w.x,after=projectile.x-w.x;
  const fromSide=before<0?-1:1;
  const crossed=before*fromSide>BALL_R&&after*fromSide<=BALL_R;
  if(!crossed||Math.abs(projectile.z-w.z)>w.length*.5||
     Math.abs(projectile.y-w.y)>w.height*.5)continue;
  projectile.x=w.x+fromSide*(BALL_R+.025);
  projectile.vx=-projectile.vx*.90;projectile.vz*=.97;projectile.vy+=.18;
  // A later wall cannot stand in for an earlier one, nor can repeatedly
  // bouncing on the same wall clear a two-wall requirement.
  const credited=w.index===(projectile.wallHits||0);
  if(credited)projectile.wallHits=(projectile.wallHits||0)+1;
  if(!preview){
   updateBounceCount();
   message(credited?'WALL BANK '+Math.min(projectile.wallHits,wallPads.length)+
    '/'+wallPads.length+'!':'FOLLOW THE NUMBERED BANKS',1.1);
   updateObjective();hear(550,.12,'triangle',.05);
  }
  collided=true;break;
 }
 return collided;
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
   updateObjective();
   
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
   vx:projectile.vx*(pad.sideGrip??.79)+offsetX*.44,
   vy:clamp(5.65+impact*.43,5.65,8.2),
   vz:projectile.vz*(pad.forwardGrip??.53)+offsetZ*.35
  };
 }
 // High-friction rubber tray absorbs forward speed. Offset hits deflect subtly.
 return {
  vx:projectile.vx*.78+offsetX*.52,
  vy:clamp(2.75+impact*.79,3.3,7.3),
  vz:projectile.vz*.42+offsetZ*.29
 };
}
// Shared by live flight and the dotted guide: a direct cup entry is invalid
// until the REAL designated wall, rubber tray, spring or hoops were cleared.
function missingRequiredContact(projectile){
 if(settings.wallCount&&(projectile.wallHits||0)<settings.wallCount)return 'WALL PAD';
 if(settings.bankRequired&&projectile.bankHits<1)return 'RUBBER PAD';
 if(settings.springRequired&&(projectile.springHits||0)<settings.padCount)return 'SPRING PAD';
 if(settings.hoops&&projectile.hoopsPassed<settings.hoops)return 'HOOPS';
 return null;
}
function cupEntryGate(projectile,previousY,time,preview=false){
 const at=preview?targetLocation(time):target;
 const top=at.y+settings.targetHeight;
 const radius=preview?settings.radius:target.r;
 const inside=Math.hypot(projectile.x-at.x,projectile.z-at.z);
 if(previousY<top-BALL_R||projectile.y>top-BALL_R||
    projectile.vy>=0||inside>=radius-BALL_R*.7)
  return {entered:false,missing:null,rejected:false};
 const missing=missingRequiredContact(projectile);
 const open=!settings.lid||lidFraction(time)>.61;
 if(!missing||!open)return {entered:true,missing,rejected:false};
 // An attempted bypass rebounds at the cup mouth; it cannot settle inside.
 // The same calculation applies to trajectory prediction and real shots.
 if(time-(projectile.lastCupReject??-10)<.15)
  return {entered:true,missing,rejected:false};
 projectile.lastCupReject=time;
 projectile.y=top+BALL_R+.014;
 projectile.vy=Math.max(1.6,Math.abs(projectile.vy)*.55);
 projectile.vz=Math.max(.8,Math.abs(projectile.vz)*.27);
 projectile.vx+=(projectile.x-at.x)*.9;
 if(!preview){
  projectile.contacts++;
  updateBounceCount();
  el.status.textContent=missing==='HOOPS'?
   'PASS ALL HOOPS BEFORE SCORING':'BOUNCE OFF THE '+missing+' FIRST';
  message(missing==='HOOPS'?'HOOPS FIRST!':missing+' FIRST!',1.15);
  hear(270,.13,'triangle',.035);
  if(impactRing){
   impactRing.position.set(projectile.x,top+.035,projectile.z);
   impactRing.material.color.setHex(0xf0a18b);
   impactAge=0;impactRing.visible=true;
  }
 }
 return {entered:true,missing,rejected:true};
}
function paintAim(){
 if(!hasRenderer||!aimLine.length)return;
 const p=charging?power:idealPower(),v=makeVelocity(p);
 const preview={x:launchOffset(),y:LAUNCH_Y,z:LAUNCH_Z,vx:v.vx,vy:v.vy,vz:v.vz,
  wallHits:0,hoopsPassed:0,springHits:0,bankHits:0};
 const count=settings.springRequired||settings.bankRequired||settings.wall?79:
  settings.hoops?73:settings.barrierCount?70:62;
 // Show the launch path, the FIRST impact and ONE rebound path only. A
 // second collision ends the preview instead of drawing distracting chains.
 let predictedBounces=0,lastImpact=-10,previewEnded=false;
 const noteImpact=(time)=>{
  if(time-lastImpact<.12)return; // suppress chatter at the same contact
  lastImpact=time;
  predictedBounces++;
  if(predictedBounces>=2)previewEnded=true;
 };
 const start=simTime,dt=.048,substeps=2;
 for(let i=0;i<aimLine.length;i++){
  const dot=aimLine[i];
  dot.visible=!flight&&playing&&i<count&&!previewEnded;
  if(!dot.visible)continue;
  if(i>0){
   for(let sub=0;sub<substeps;sub++){
    const t=start+(i-1+sub/substeps)*dt,h=dt/substeps;
    const prior={x:preview.x,y:preview.y,z:preview.z};
    const fan=airForce(preview.x,preview.y,preview.z,t);
    preview.vx+=(windAt(t)+fan.x)*h;
    preview.vy+=(fan.y-GRAVITY)*h;
    preview.x+=preview.vx*h;preview.y+=preview.vy*h;preview.z+=preview.vz*h;
    if(wallCollision(preview,prior.x,true))noteImpact(t+h);
    checkHoopCross(prior,preview,t+h,true);
    if(hoopRimCollision(preview,t+h,true))noteImpact(t+h);
    if(resolveEnvironment(preview,true))noteImpact(t+h);
    const cupGate=cupEntryGate(preview,prior.y,t+h,true);
    if(cupGate.rejected)noteImpact(t+h);
    if(cupGate.entered&&!cupGate.missing&&
       (!settings.lid||lidFraction(t+h)>.61))previewEnded=true;
    if(!previewEnded&&cupSurfaceCollision(preview,true,t+h))noteImpact(t+h);
    if(previewEnded)break;
    if(preview.vy<0){
     for(const pad of pads){
      if(prior.y>=pad.y+BALL_R&&preview.y<=pad.y+BALL_R&&
        Math.hypot(preview.x-pad.x,preview.z-pad.z)<pad.r-BALL_R){
       preview.y=pad.y+BALL_R;
       Object.assign(preview,padRebound(preview,pad));
       if(pad.type==='spring'&&pad.index===(preview.springHits||0))
        preview.springHits=(preview.springHits||0)+1;
       if(pad.type==='bank')preview.bankHits=(preview.bankHits||0)+1;
       noteImpact(t+h);
       break;
      }
     }
    }
    if(previewEnded)break;
   }
  }
  if(previewEnded){dot.visible=false;continue;}
  dot.position.set(preview.x,preview.y,preview.z);
  if(preview.y<-.12||preview.z<settings.targetZ-4.8)dot.visible=false;
  const next=targetLocation(start+i*dt);
  const nearOpening=Math.hypot(preview.x-next.x,preview.z-next.z)<settings.radius*.95&&
   Math.abs(preview.y-next.y-settings.targetHeight)<.42;
  const cue=predictedBounces?0xffbd77:
   preview.hoopsPassed?0xa4efc7:i%3===0?0xffdda4:0x86bec8;
  dot.material.color.setHex(cue);
  dot.scale.setScalar(nearOpening?2.1:preview.hoopsPassed?1.2:1);
 }
}
function updatePower(){
 if(!flight&&ballMesh){
  if(launcher)launcher.position.x=launchOffset();
  ballMesh.position.x=launchOffset();
  if(ballShadow)ballShadow.position.x=launchOffset();
 }
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
 aimYaw=clamp(baseline+(nx-.5)*1.65,-MAX_AIM_YAW,MAX_AIM_YAW);
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
 // Keep charging even if the player drags to adjust their shot.
 const sec=(now-chargeFrom)/1000;
 power=clamp(chargeAnchor+sec*.58,.06,1);
 updatePower();
}
function launch(){
 if(!playing||paused||flight||!charging)return;
 chargeTick(performance.now());
 charging=false;chargeSource=null;gesture=null;flight=true;attempts++;
 const v=makeVelocity(power);
 ball={x:launchOffset(),y:LAUNCH_Y,z:LAUNCH_Z,vx:v.vx,vy:v.vy,vz:v.vz,
  active:true,bounces:0,bankHits:0,springHits:0,wallHits:0,hoopsPassed:0,contacts:0,trail:[]};
 shotT=0;shotStart=performance.now();
 el.status.textContent='BALL IN FLIGHT · WATCH THE ARC';
 el.attempts.textContent=String(attempts);
 updateBounceCount();
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
 completed[level]=true;
 best[level]=Math.min(best[level]||Infinity,attempts);
 if(level>=unlocked&&unlocked<50)unlocked=level+1;
 save();buildUi();
 showOverlay('LEVEL '+fmtLevel(level)+' COMPLETE','NICE SHOT!',
  'Cleared in '+attempts+' throw'+(attempts===1?'':'s')+'. '+
  (level===50?'All 50 levels are now available to replay.':'Level '+fmtLevel(Math.min(50,level+1))+' is ready.'),
  level===50?'CHOOSE A LEVEL':'NEXT LEVEL →','win');
 el.secondary.hidden=false;el.secondary.textContent='LEVEL MENU';
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
 if(targetShadow){
  targetShadow.position.x=position.x;
  targetShadow.position.z=position.z;
  targetShadow.material.opacity=clamp(.72-(position.y-(.19+settings.topPad))*.25,.25,.72);
 }
 for(const pad of pads){
  if(!pad.plate)continue;
  const elapsed=t-pad.lastImpact;
  const pulse=elapsed>=0&&elapsed<.55?Math.sin(elapsed*16)*Math.exp(-elapsed*5):0;
  pad.plate.position.y=pad.y-.05-pulse*.055;
  const active=(pad.index===(ball.springHits||0)),done=pad.index<(ball.springHits||0);
  pad.glow.material.color.setHex(done?0xffddae:active?0xc5ffdf:0x8bb2b8);
  pad.glow.material.opacity=done?.88:active?.86:.38;
 }
 for(const gate of hoops){
  const pos=hoopMotion(gate,t);
  gate.x=pos.x;gate.y=pos.y;
  gate.mesh.position.set(pos.x,pos.y,pos.z);
  gate.alignHoopRope?.(pos.x,pos.y);
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
   updateObjective();
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
  if(Math.abs(air.x)+Math.abs(air.y)>1.8){
   el.wind.hidden=false;
   el.windLabel.textContent=air.y>Math.abs(air.x)?
    'UPDRAFT LIFTING ↑':(air.x>0?'FAN PUSHING →':'← FAN PUSHING');
  }else if(step===0){
   el.wind.hidden=Math.abs(settings.wind)<.001&&!settings.fanZone;
   if(!el.wind.hidden)el.windLabel.textContent=
    settings.fanZone?.kind==='lift'?'UPDRAFT NEARBY ↑':
    settings.fanZone||Math.abs(settings.wind)>.001?'WATCH THE WIND':'';
  }
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
  const cupGate=cupEntryGate(ball,prevY,simTime);
  if(cupGate.entered&&!cupGate.missing&&
     (!settings.lid||lidFraction(simTime)>.61)){complete();return;}
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
      updateObjective();
      const impulse=padRebound(ball,pad);
      ball.vx=impulse.vx;ball.vy=impulse.vy;ball.vz=impulse.vz;
      message('BANK BOUNCE! · NOW LAND THE SHOT',1.0);
      hear(650,.13,'triangle',.045);
     }else{
      const rebound=padRebound(ball,pad);
      ball.vy=rebound.vy;ball.vz=rebound.vz;ball.vx=rebound.vx;
      const credited=pad.index===(ball.springHits||0);
      if(credited)ball.springHits++;
      updateObjective();
      message(credited?'SPRING '+ball.springHits+'/'+settings.padCount+'!':
       'HIT PAD '+(ball.springHits+1)+' NEXT',1.0);
      hear(480,.18,'sine',.06);
     }
     if(impactRing){
      impactRing.position.set(ball.x,pad.y+.075,ball.z);
      impactRing.material.color.setHex(pad.type==='spring'?0x9ef3c8:0xffdc9e);
      impactAge=0;impactRing.visible=true;
     }
     if(pad.type==='spring')pad.lastImpact=simTime;
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
  if(ballShadow){
   ballShadow.position.set(ball.x,shadowY+.025,ball.z);
   const spread=.25*clamp(1+(ball.y-shadowY)*.25,.7,2.5);
   ballShadow.scale.set(spread,spread,1);
   ballShadow.material.opacity=clamp(.48-(ball.y-shadowY)*.07,.035,.46);
  }
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
  if(flight){
   tickFlight(dt);
   // Ball surface and seam spin from the actual flight velocity.
   if(ballMesh){
    ballMesh.rotation.x-=ball.vz*dt*2.7;
    ballMesh.rotation.z+=ball.vx*dt*2.7;
    ballMesh.rotation.y+=ball.vy*dt*.45;
   }
  }
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
  if(impactRing.children[0])
   impactRing.children[0].material.opacity=Math.max(0,.27-impactAge*.53);
  if(impactAge>.55)impactRing.visible=false;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<720?1.50:2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
  scene.add(new THREE.HemisphereLight(0xffebd8,0x526b7b,1.05));
  const sun=new THREE.DirectionalLight(0xffddac,2.32);
  sun.position.set(-5,13,8);sun.castShadow=true;
  sun.shadow.mapSize.set(window.innerWidth>900?2048:1024,
   window.innerWidth>900?2048:1024);
  sun.shadow.radius=2.5;sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;
  sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
  sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;sun.shadow.camera.far=75;
  scene.add(sun);
  const fill=new THREE.PointLight(0xa8d0e5,2.7,22,2);fill.position.set(4,5,1);scene.add(fill);
  const bounce=new THREE.DirectionalLight(0xa8dfe0,.58);
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
 camera.fov=w<580?57:47;camera.updateProjectionMatrix();
 if(Math.abs(camera.aspect-readabilityAspect)>.055){
  readabilityAspect=camera.aspect;
  separateBlockersOnScreen();
  validateLevelReadability();
  buildPhysicsBodies();
 }
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
  paused=true;playing=false;charging=false;chargeSource=null;gesture=null;
  showOverlay('GAME PAUSED','TAKE A BREATHER','Your ball and moving obstacles are frozen. Resume whenever you are ready.',
    'RESUME','resume');
 }else if(el.primary.dataset.action==='resume')hideOverlay();
}
el.primary.addEventListener('click',action);
el.secondary.addEventListener('click',openLevelMenu);
el.menu.addEventListener('click',openLevelMenu);
el.resume.addEventListener('click',()=>loadLevel(unlocked));
function openLevelMenu(){
 charging=false;chargeSource=null;gesture=null;flight=false;playing=false;paused=true;
 el.overlay.hidden=true;chosenChapter=chapterIndex(unlocked);buildChapters();
 el.selection.scrollIntoView({behavior:'smooth',block:'start'});
}
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
 const dx=(e.clientX-gesture.x)/Math.max(1,rect.width);
 const dy=(gesture.y-e.clientY)/Math.max(1,rect.height);
 if(Math.abs(dx)>.002||Math.abs(dy)>.002)gesture.moved=true;
 // No angle jump: begin at the aim selected on pointer-down.
 // Power stays independent and increases for as long as the pointer is held.
 aimYaw=clamp(gesture.yaw+dx*2.15,-MAX_AIM_YAW,MAX_AIM_YAW);
 aimPitch=clamp(gesture.pitch+dy*.92,
  settings.bankRequired||settings.springRequired?.13:.27,1.10);
 updatePower();
}
el.canvas.addEventListener('pointermove',e=>{
 if(!playing||flight)return;
 if(gesture&&gesture.id===e.pointerId)flickAim(e);
 else if(e.pointerType!=='touch')inputAim(e.clientX,e.clientY);
});
el.canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!playing||paused||flight||charging)return;
 e.preventDefault();
 el.canvas.setPointerCapture?.(e.pointerId);
 inputAim(e.clientX,e.clientY);
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:aimYaw,pitch:aimPitch,moved:false};
 startCharge('pointer');
});
const release=e=>{
 if(chargeSource!=='pointer'||!gesture||gesture.id!==e.pointerId)return;
 e.preventDefault();
 flickAim(e);
 launch();
 try{el.canvas.releasePointerCapture?.(e.pointerId);}catch{}
};
el.canvas.addEventListener('pointerup',release);
el.canvas.addEventListener('pointercancel',e=>{
 if(chargeSource!=='pointer'||gesture?.id!==e.pointerId)return;
 charging=false;chargeSource=null;gesture=null;updatePower();
});
document.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName||'';
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag)||e.ctrlKey||e.altKey||e.metaKey)return;
 const key=e.key.toLowerCase();
 if(key==='r'){e.preventDefault();loadLevel(level);return;}
 if(key==='escape'){e.preventDefault();togglePause();return;}
 if(!playing||flight)return;
 if(['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s'].includes(key)){
  e.preventDefault();
  const amount=e.shiftKey?.038:.024;
  if(key==='arrowleft'||key==='a')aimYaw=clamp(aimYaw-amount,-MAX_AIM_YAW,MAX_AIM_YAW);
  if(key==='arrowright'||key==='d')aimYaw=clamp(aimYaw+amount,-MAX_AIM_YAW,MAX_AIM_YAW);
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
 if(charging){charging=false;chargeSource=null;gesture=null;}
 if(playing)togglePause();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)togglePause();});
loadLevel(level);
await init();
})();