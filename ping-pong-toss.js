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
 attempts:$('ptAttempts'),total:$('ptTotalStars'),status:$('ptStatus'),
 power:$('ptPowerFill'),powerValue:$('ptPowerValue'),trajectoryLabel:$('ptTrajectoryLabel'),
 grid:$('ptLevelGrid'),chapters:$('ptChapters'),chapterDescription:$('ptChapterDescription'),
 prev:$('ptPrev'),next:$('ptNext'),retry:$('ptRetry'),pause:$('ptPause'),
 sound:$('ptSound'),full:$('ptFullscreen'),wind:$('ptWind'),windLabel:$('ptWindLabel'),
 aim:$('ptAimText'),tutorial:$('ptTutorial'),best:$('ptBest'),toast:$('ptToast')
};
if(Object.values(el).some(v=>!v))return;
let THREE,renderer,scene,camera,group,ballMesh,ballShadow,launcher,cupGroup,cupFloor,trajectoryGroup,throwingHand,throwMoment=-10000;
let aimLine=[],ringMat,particleGroup,obstacles=[],pads=[],target={x:0,z:-2.5,y:0,top:1,r:.64,kind:0},ambient=[];
const STORE='crilo_pong_toss_50_v1',MUTED='crilo_pong_toss_sound_v1';
const TWO_PI=Math.PI*2,GRAVITY=10.65,LAUNCH_Z=4.25,LAUNCH_Y=1.32,BALL_R=.115;
const CHAPTERS=[
 {name:'THE BASICS',desc:'Find the angle. Learn the arc. Clear static obstacles.',from:1,to:10,color:0x6ccab5,short:'Classic Toss'},
 {name:'MOVING TARGETS',desc:'Watch the rhythm. Time your release to land a moving cup.',from:11,to:20,color:0xeba1b5,short:'Moving Cups'},
 {name:'THE WIND ZONE',desc:'Crosswinds bend your shot. Read the indicator and compensate.',from:21,to:30,color:0x8ba8e9,short:'Wind'},
 {name:'OBSTACLE COURSE',desc:'Sliding walls and moving paddles stand between you and the cup.',from:31,to:40,color:0xebbc70,short:'Moving Barriers'},
 {name:'BOUNCE LAB',desc:'Glowing bounce pads relaunch your ball into hard-to-reach cups.',from:41,to:50,color:0xae8edc,short:'Bounce Pads'}
];
let level=1,unlocked=1,stars={},best={},attempts=0,score=0,chosenChapter=0;
let playing=false,paused=false,flight=false,charging=false,chargeFrom=0,chargeSource=null,gesture=null;
let aimYaw=0,aimPitch=.70,power=.32,chargeAnchor=.20,lastNow=0,toastUntil=0,toastMessage='';
let effectTimer=0,soundOn=true,hasRenderer=false,shotStart=0,shotT=0;
let ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:0,vy:0,vz:0,active:false,bounces:0,trail:[]};
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
el.sound.textContent=soundOn?'SOUND ON':'SOUND OFF';
el.sound.setAttribute('aria-pressed',String(soundOn));
chosenChapter=chapterIndex(level);
function message(str,time=2.0){toastMessage=str;toastUntil=performance.now()+time*1000;el.toast.textContent=str;el.toast.hidden=false;}
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
function stageSettings(n){
 const c=chapterIndex(n),tier=(n-1)%10;
 const d=5.05+(n-1)*.135+(tier%4)*.22;
 let x=(seeded(n*3)-.5)*2.15;
 if(n<4)x*=.37;
 const radius=Math.max(.38,.82-(n-1)*.008);
 const type=(n-1)%5;
 const moving=c>=1?(c===1?.45+tier*.048:.22+tier*.029):0;
 const wind=c>=2?((n%2?1:-1)*(.37+tier*.055)):0;
 const barrierCount=c>=3?Math.min(3,1+Math.floor(tier/4)):0;
 const padCount=c===4?(tier>=4?2:1):0;
 const baseHeight=[.88,1.00,1.28,1.06,1.44][(n-1)%5];
 const topPad=baseHeight+(c===4?(tier>=5?.46:.20):0);
 return {n,c,tier,d,x,kind:type,radius,
  targetZ:LAUNCH_Z-d,moving,wind,barrierCount,padCount,topPad,
  color:chapter(n).color,sceneId:(n-1)%5,roomVariant:Math.floor((n-1)%10/5),
  obstacles:n<=3?0:Math.min(3,1+Math.floor((n-4)/13)),
  targetHeight:.76+(type===2?.22:type===4?.1:0)};
}
let settings=stageSettings(level);
function buildUi(){
 const completed=Object.values(stars).reduce((a,n)=>a+clamp(Number(n)||0,0,3),0);
 el.total.textContent=String(completed)+' / 150';
 el.counter.textContent=fmtLevel(level)+' / 50';
 el.chapter.textContent='CHAPTER '+(settings.c+1)+' · '+CHAPTERS[settings.c].short.toUpperCase();
 el.title.textContent=CHAPTERS[settings.c].name;
 el.attempts.textContent=String(attempts);
 el.best.textContent=best[level]?best[level]+' THROW'+(best[level]===1?'':'S'):'—';
 el.prev.disabled=level<=1;
 el.next.disabled=level>=unlocked||level>=50;
 el.wind.hidden=settings.c<2;
 el.windLabel.textContent=settings.c<2?'NO WIND':(settings.wind>0?'WIND → ':'← WIND ')+Math.abs(settings.wind).toFixed(1);
 el.tutorial.textContent=settings.c===0?'SWIPE UP TO FLICK · OR HOLD & RELEASE':
 settings.c===1?'NEW: THE CUP MOVES. TIME YOUR THROW.':
 settings.c===2?'NEW: WIND PUSHES THE BALL SIDEWAYS.':
 settings.c===3?'NEW: DODGE THE SLIDING BLOCKERS.':
 'NEW: LAND ON A GLOWING PAD TO BOUNCE HIGHER.';
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
  const star=document.createElement('small');star.textContent=i>unlocked?'LOCK':stars[i]?'★'.repeat(stars[i]):'PLAY';
  button.append(label,star);button.disabled=i>unlocked;
  button.setAttribute('aria-label','Level '+i+(i>unlocked?' locked':stars[i]?' '+stars[i]+' stars':''));
  button.addEventListener('click',()=>loadLevel(i));
  el.grid.append(button);
 }
}
function showOverlay(tag,title,text,button,action){
 playing=false;charging=false;chargeSource=null;
 el.overlayTag.textContent=tag;el.overlayTitle.textContent=title;el.overlayText.textContent=text;
 el.primary.textContent=button;el.primary.dataset.action=action;
 el.secondary.hidden=action!=='win';
 el.overlay.hidden=false;
}
function hideOverlay(){el.overlay.hidden=true;playing=true;paused=false;}
function cupVariant(kind){
 return ['PAPER CUP','CERAMIC MUG','TALL BUCKET','COLOUR BOWL','HOOP BASKET'][kind];
}
function loadLevel(n){
 if(!Number.isInteger(n)||n<1||n>unlocked)return;
 level=n;settings=stageSettings(level);chosenChapter=chapterIndex(level);
 attempts=0;shotT=0;flight=false;paused=false;
 aimYaw=Math.atan2(settings.x,settings.d);aimPitch=.70;
 power=idealPower();ball.active=false;resetBall();
 if(hasRenderer){buildWorld();}
 buildUi();updatePower();
 showOverlay('LEVEL '+fmtLevel(level)+' · '+CHAPTERS[settings.c].short.toUpperCase(),
   level===1?'READY TO TOSS?':cupVariant(settings.kind)+' AHEAD',
   (level===1?'Swipe your finger or mouse upward to flick; you can also hold and release to charge. ':'')+
   (settings.c===0?'Your view is from behind the desk. Land inside the container — not the rim.':
    settings.c===1?'The target slides back and forth. Time your release.':
    settings.c===2?'Watch the crosswind and curve your shot into the target.':
    settings.c===3?'Moving blockers will knock the ball away. Find an opening.':
    'Use the glowing bounce pad to lift your shot toward the target.'),
   'PLAY LEVEL '+fmtLevel(level),'start');
 save();
}
function nextLevel(){
 if(level>=50){loadLevel(1);return;}
 const n=Math.min(level+1,unlocked);loadLevel(n);
}
function resetBall(){
 ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:0,vy:0,vz:0,active:false,bounces:0,trail:[]};
 if(ballMesh)ballMesh.position.set(0,LAUNCH_Y,LAUNCH_Z);
}
function createMat(color,rough=.75,metal=.02,emissive=null){
 return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,flatShading:true,
 ...(emissive?{emissive,emissiveIntensity:.25}:{})});
}
function meshBox(parent,w,h,d,x,y,z,mat){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
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
function officeMonitor(parent,x,y,z,angle=0){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);
 const plastic=createMat(0x313c47),screen=createMat(0x344e5b,.43,.14,0x283b46);
 meshBox(g,1.45,.88,.11,0,.56,0,plastic);
 meshBox(g,1.27,.69,.013,0,.57,-.064,screen);
 // Static neon bars resemble a work spreadsheet, not a copied game screenshot.
 const bars=[0x6fae96,0xeac27a,0x6c98b4];
 for(let i=0;i<4;i++){
  const mat=new THREE.MeshBasicMaterial({color:bars[i%3]});
  meshBox(g,.12+i*.10,.08,.016,-.43,.34+i*.13,-.079,mat);
 }
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
function officeFan(parent,x,y,z,mat,angle=0){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=angle;parent.add(g);
 const metal=createMat(0x6d777e,.3,.59);
 meshBox(g,.5,.08,.40,0,.02,0,mat);
 meshBox(g,.10,.62,.12,0,.33,0,metal);
 const cage=new THREE.Mesh(new THREE.TorusGeometry(.47,.034,6,29),metal);
 cage.position.y=.91;g.add(cage);
 for(let i=0;i<4;i++){
  const blade=new THREE.Mesh(new THREE.BoxGeometry(.19,.44,.027),mat);
  blade.position.y=.91;blade.position.x=Math.sin(i*Math.PI/2)*.19;
  blade.position.y+=Math.cos(i*Math.PI/2)*.19;
  blade.rotation.z=i*Math.PI/2;g.add(blade);
 }
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

function buildWorld(){
 if(!hasRenderer)return;
 worldClean();
 group=new THREE.Group();scene.add(group);
 obstacles=[];pads=[];ambient=[];aimLine=[];
 const sets=[
  {walls:0x71878a,carpet:0x546c69,desk:0x9d6c4b,trim:0x374d51,name:'THE CUBICLE'},
  {walls:0x948b7c,carpet:0x626c6b,desk:0x866249,trim:0x465b60,name:'MEETING ROOM'},
  {walls:0x79919a,carpet:0x5c6b76,desk:0x896b54,trim:0x4b5e70,name:'MAILROOM'},
  {walls:0x8c8b7d,carpet:0x68736c,desk:0x956c50,trim:0x52534f,name:'BREAK ROOM'},
  {walls:0x728494,carpet:0x475b6b,desk:0x8d634c,trim:0x414c61,name:'NIGHT SHIFT'}
 ];
 const theme=sets[settings.sceneId],roomEnd=settings.targetZ-4.15;
 const roomMiddle=(LAUNCH_Z+5+roomEnd)/2,roomLength=LAUNCH_Z+5-roomEnd;
 const wallMat=createMat(theme.walls,.91),carpet=createMat(theme.carpet,.94);
 const wood=createMat(theme.desk,.56),darkWood=createMat(0x543e34,.72);
 const metal=createMat(0x687985,.33,.41),dark=createMat(theme.trim,.6,.15);
 const cream=createMat(0xe3d9cb,.8),paper=createMat(0xdfddcf,.9);
 const highlight=createMat(settings.color,.38,.02,settings.color);
 const blue=createMat(0x66899b,.6),light=createMat(0xf0e0b9,.7);
 const lampGlow=new THREE.MeshBasicMaterial({color:0xffe9b3});
 // A full-size room: fixed eye-level perspective from behind the front desk.
 meshBox(group,16,.23,roomLength,0,-.53,roomMiddle,carpet);
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
 meshBox(winGroup,3.40,2.03,.015,0,0,.085,createMat(0x8faeb8,.2,.05,0x426478));
 for(let i=0;i<10;i++)
  meshBox(winGroup,3.33,.037,.016,0,-.95+i*.21,.105,createMat(0xd8d5bd,.85));
 meshBox(winGroup,.11,2.1,.18,0,0,.15,cream);
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
 // Ceiling LED fixtures create broad, moderate light with no overexposure.
 for(let i=0;i<3;i++){
  const z=roomEnd+2.0+i*roomLength/3.5;
  meshBox(group,2.5,.14,.9,-2.6,7.34,z,cream);
  meshBox(group,2.19,.035,.7,-2.6,7.20,z,lampGlow);
 }
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
 meshBox(hand,.48,.26,.70,0,0,0,skin);
 meshBox(hand,.53,.30,.30,0,-.08,.39,cuff);
 for(let i=0;i<4;i++)meshBox(hand,.083,.09,.35,-.15+i*.10,.16,-.30,skin);
 // A second office desk holds the actual throwing target.
 // Different scenes change its width and background arrangement.
 const targetW=settings.sceneId===1?6.5:settings.sceneId===3?4.2:5.2;
 const farDesk=desk(group,settings.x,settings.targetZ,targetW,3.3,settings.topPad+.03,
   settings.sceneId===3?createMat(0x8b9188):wood,metal);
 if(settings.sceneId===0){
  officeMonitor(farDesk,-1.6,1.04,-.75,.12);
  stackBooks(farDesk,1.75,1.08,-.7,2,level);
 }else if(settings.sceneId===1){
  for(let i=0;i<4;i++)meshBox(farDesk,.6,.09,.40,
   (i-1.5)*1.25,1.05,-1.03,paper);
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
 const colors=[0xa4bec8,0xd4b09e,0x879b96,0xc9a97e,0x7395a4];
 const cupMat=createMat(colors[kind],.45,.07),insideMat=createMat(0x5f6768,.78),lipMat=createMat(0xecedeb,.4,.18);
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(r,kind===3?r*.96:r*.73,h,32,1,true),cupMat);
 shell.position.y=h/2;shell.castShadow=true;cupGroup.add(shell);
 const inner=new THREE.Mesh(new THREE.CylinderGeometry(r*.93,r*.71,h*.91,30,1,true),
  new THREE.MeshStandardMaterial({color:0x505d61,side:THREE.BackSide,roughness:.7}));
 inner.position.y=h/2;cupGroup.add(inner);
 cupFloor=new THREE.Mesh(new THREE.CircleGeometry(r*.70,28),insideMat);
 cupFloor.rotation.x=-Math.PI/2;cupFloor.position.y=.045;cupGroup.add(cupFloor);
 const lip=new THREE.Mesh(new THREE.TorusGeometry(r*.98,.054,9,40),lipMat);
 lip.rotation.x=Math.PI/2;lip.position.y=h;cupGroup.add(lip);
 if(kind===1){
  const handle=new THREE.Mesh(new THREE.TorusGeometry(r*.4,.085,8,22),cupMat);
  handle.rotation.y=Math.PI/2;handle.position.set(r*1.12,h*.55,0);cupGroup.add(handle);
 }
 if(kind===2){
  for(const side of [-1,1])meshBox(cupGroup,.10,h*.75,.08,side*r*.85,h*.52,0,lipMat);
 }
 if(kind===4){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.96,r*.7,h*.77,20,1,true),
   new THREE.MeshStandardMaterial({color:0xabb7b1,transparent:true,opacity:.37,wireframe:true}));
  mesh.position.y=h*.4;cupGroup.add(mesh);
 }
 target={x:settings.x,z:settings.targetZ,y:.19+settings.topPad,top:.19+settings.topPad+h,r,kind};
 // The tray/pad follows lateral target motion, not the entire desk.
 meshBox(cupGroup,r*2.5,.09,r*2.5,0,-.10,0,cream);
 const targetMarker=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.42),
  makeText('IN THE CUP',31,'#f1eeee','#405c63'));
 targetMarker.position.set(settings.x+1.6,2.33,settings.targetZ-1.12);group.add(targetMarker);
 const count=settings.obstacles;
 for(let i=0;i<count;i++){
  const t=(i+1)/(count+1);
  const z=lerp(LAUNCH_Z-1.2,settings.targetZ+1.2,t);
  const x=(i%2===0?-1:1)*(1.00+.36*seeded(level*7+i));
  const height=.85+.29*(i%3)+settings.c*.06;
  const item=new THREE.Group();item.position.set(x,height*.5,z);group.add(item);
  if(settings.sceneId%2===0){
   for(let k=0;k<3;k++)meshBox(item,.62,.14,.54,0,(k-1)*.15,0,
    createMat([0x748a9e,0xc6a985,0x8d7274][k]));
  }else{
   meshBox(item,.63,height,.55,0,0,0,createMat(0xb2ada5,.75));
   for(let k=0;k<3;k++)meshBox(item,.5,.018,.018,0,.2-k*.15,-.29,createMat(0x566a6e));
  }
  obstacles.push({type:'box',obj:item,x,y:height/2,z,w:.62,h:height,d:.55});
 }
 // Office-themed obstacles: sliding file cabinets instead of flat neon bars.
 for(let i=0;i<settings.barrierCount;i++){
  const z=lerp(LAUNCH_Z-1.8,settings.targetZ+1.25,(i+1)/(settings.barrierCount+1));
  const item=new THREE.Group();group.add(item);item.position.set(0,1.6+i*.19,z);
  const front=meshBox(item,1.45,.38,.33,0,0,0,createMat(0x8498a0));
  meshBox(item,.64,.065,.035,0,.02,-.19,metal);
  obstacles.push({type:'barrier',obj:item,x:0,y:1.6+i*.19,z,w:1.45,h:.38,d:.33,
   amp:1.35+.19*i,speed:.75+.2*i,phase:i*2.4});
 }
 // A desk fan is also visible when the wind mechanic is active.
 if(settings.c>=2){
  const fan=officeFan(group,-3.65,1.03,settings.targetZ+.85,metal,.2);
  ambient.push({type:'fan',obj:fan});
 }
 // Chapter 5: rubber launch plates on actual rolling office carts.
 for(let i=0;i<settings.padCount;i++){
  const z=lerp(LAUNCH_Z-.9,settings.targetZ,(i+1)/(settings.padCount+1));
  const x=i===0?0:settings.x*.48,padY=1.16+(i===1?.27:0);
  const cart=new THREE.Group();cart.position.set(x,0,z);group.add(cart);
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
  pads.push({x,z,r:.74,y:padY+.05,mat:spring.material,last:-10});
 }
 // Projectile is deliberately warm orange, outlined, large enough to TRACK,
 // strongly contrasting with the dark gray office instead of washing out.
 const ballMaterial=new THREE.MeshStandardMaterial({color:0xf7b86b,roughness:.27,metalness:0,
  emissive:0x653112,emissiveIntensity:.22});
 ballMesh=new THREE.Mesh(new THREE.SphereGeometry(BALL_R*1.34,24,18),ballMaterial);
 ballMesh.castShadow=true;ballMesh.position.set(0,LAUNCH_Y,LAUNCH_Z);group.add(ballMesh);
 const ringPaint=new THREE.MeshBasicMaterial({color:0x8c4f39});
 for(const angle of [0,Math.PI/2]){
  const seam=new THREE.Mesh(new THREE.TorusGeometry(BALL_R*1.315,.005,5,36),ringPaint);
  seam.rotation.y=angle;ballMesh.add(seam);
 }
 // Soft contact shadow only, not a pale ball on a pale tabletop.
 ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.20,24),
  new THREE.MeshBasicMaterial({color:0x1c282f,transparent:true,opacity:.27,depthWrite:false}));
 ballShadow.rotation.x=-Math.PI/2;ballShadow.position.set(0,1.15,LAUNCH_Z);group.add(ballShadow);
 trajectoryGroup=new THREE.Group();group.add(trajectoryGroup);
 for(let i=0;i<42;i++){
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.040,7,6),
   new THREE.MeshBasicMaterial({color:i%3===0?0xf3b768:0x5c9199,transparent:true,
     opacity:Math.max(.18,.8-i*.014)}));
  dot.visible=false;trajectoryGroup.add(dot);
 }
 aimLine=trajectoryGroup.children;
 // Camera at human eye-height, not the old god's-eye tabletop view.
 camera.position.set(.0,3.25,8.55);
 camera.lookAt(settings.x*.11,1.37,settings.targetZ*.50);
 camera.updateMatrixWorld();
 scene.background.setHex([0x687f87,0x91877d,0x7a8994,0x8b887d,0x627585][settings.sceneId]);
 if(scene.fog)scene.fog.color.copy(scene.background);
 renderer.setClearColor(scene.background,1);
 resetBall();paintAim();
}

function idealPower(){
 const d=Math.hypot(settings.d,settings.x);
 const t=Math.tan(aimPitch),co=Math.cos(aimPitch);
 const denom=2*co*co*(d*t+LAUNCH_Y-(.19+settings.topPad+settings.targetHeight));
 const v=Math.sqrt(Math.max(1,GRAVITY*d*d/Math.max(.1,denom)));
 return clamp((v-5.6)/8.2,.06,.96);
}
function makeVelocity(p){
 const speed=5.6+8.2*p;
 return {
  vx:Math.sin(aimYaw)*Math.cos(aimPitch)*speed,
  vy:Math.sin(aimPitch)*speed,
  vz:-Math.cos(aimYaw)*Math.cos(aimPitch)*speed
 };
}
function paintAim(){
 if(!hasRenderer||!aimLine.length)return;
 const p=charging?power:idealPower();
 let x=0,y=LAUNCH_Y,z=LAUNCH_Z,t=0;
 const v=makeVelocity(p);let vx=v.vx,vy=v.vy,vz=v.vz;
 const maxDots=settings.c>=3?24:settings.c>=2?30:48;
 for(let i=0;i<aimLine.length;i++){
  const dot=aimLine[i];dot.visible=!flight&&playing&&i<maxDots;
  const dt=.05;
  if(i>0){vx+=settings.wind*dt;vy-=GRAVITY*dt;
   x+=vx*dt;y+=vy*dt;z+=vz*dt;}
  dot.position.set(x,y,z);
  if(y<.2||z<settings.targetZ-3)dot.visible=false;
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
 aimPitch=clamp(.70+(.5-ny)*.52,.27,1.04);
 if(!charging)power=idealPower();
 updatePower();
}
function startCharge(source){
 if(!playing||paused||flight||charging)return;
 charging=true;chargeSource=source;chargeFrom=performance.now();
 chargeAnchor=clamp(idealPower()-.13,.06,.87);
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
  active:true,bounces:0,trail:[]};
 shotT=0;shotStart=performance.now();
 el.attempts.textContent=String(attempts);
 throwMoment=performance.now();
 hear(880,.12,'sine',.045);message('PONG!',.55);
 paintAim();
}
function miss(reason='MISS!'){
 if(!flight)return;
 flight=false;ball.active=false;
 hear(230,.16,'triangle',.027);
 message(reason+' · TRY AGAIN',1.65);
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
function tickObstacles(time){
 if(!cupGroup)return;
 const t=time/1000;
 const move=settings.moving?Math.sin(t*(.8+settings.tier*.058))*settings.moving:0;
 cupGroup.position.x=settings.x+move;
 target.x=cupGroup.position.x;
 for(const item of ambient){
  if(item.type==='fan')item.obj.rotation.y=.2+Math.sin(t*.88)*.56;
 }
 for(const obj of obstacles){
  if(obj.type==='barrier'){
   obj.x=Math.sin(t*obj.speed+obj.phase)*obj.amp;
   obj.obj.position.x=obj.x;
  }
 }
}
function collideObstacles(){
 for(const o of obstacles){
  const nearX=Math.abs(ball.x-o.x)<o.w*.5+BALL_R;
  const nearY=Math.abs(ball.y-o.y)<o.h*.5+BALL_R;
  const nearZ=Math.abs(ball.z-o.z)<o.d*.5+BALL_R;
  if(nearX&&nearY&&nearZ){miss(o.type==='barrier'?'BLOCKED!':'OBSTACLE HIT!');return true;}
 }
 return false;
}
function tickFlight(dt){
 if(!flight)return;
 const substeps=3,h=dt/substeps;
 for(let step=0;step<substeps;step++){
  if(!flight)break;
  const prevY=ball.y,prevX=ball.x,prevZ=ball.z;
  ball.vx+=settings.wind*h;
  ball.vy-=GRAVITY*h;
  ball.x+=ball.vx*h;ball.y+=ball.vy*h;ball.z+=ball.vz*h;
  shotT+=h;
  if(collideObstacles())return;
  const inside=Math.hypot(ball.x-target.x,ball.z-target.z);
  if(prevY>=target.top-BALL_R&&ball.y<=target.top-BALL_R&&ball.vy<0&&
   inside<target.r-BALL_R*.7){
   complete();return;
  }
  if(Math.abs(ball.y-target.top)<BALL_R*.8&&inside>target.r-BALL_R*.8&&
   inside<target.r+BALL_R*.65){
   miss('SO CLOSE!');return;
  }
  // Reject side-entry through the visible cup shell. Only a downward crossing
  // through its opening can score, never a ghost shot through the walls.
  const wasInside=Math.hypot(prevX-target.x,prevZ-target.z);
  if(ball.y<target.top-BALL_R*.5&&ball.y>target.y+.06&&
     inside<target.r+BALL_R&&wasInside>=target.r+BALL_R){
   miss('CUP WALL!');return;
  }
  // Bounce Lab: a spring pad can relaunch one descending ball.
  if(settings.padCount&&ball.vy<0){
   for(const pad of pads){
    if(prevY>=pad.y+BALL_R&&ball.y<=pad.y+BALL_R&&
     Math.hypot(ball.x-pad.x,ball.z-pad.z)<pad.r-BALL_R){
     ball.y=pad.y+BALL_R;ball.vy=6.8;
     ball.vz-=1.95;
     ball.vx+=(target.x-ball.x)*.30;
     ball.bounces++;hear(480,.18,'sine',.06);
     message('SPRING SHOT! +1 BOUNCE',.85);break;
    }
   }
  }
  // Physically solid desk surfaces: an unsuccessful toss cannot ghost through
  // the tabletop beneath the target or the player's own work area.
  const onFarDesk=ball.z>settings.targetZ-1.62&&ball.z<settings.targetZ+1.62&&
   Math.abs(ball.x-settings.x)<(settings.sceneId===1?3.2:settings.sceneId===3?2.0:2.55);
  const onNearDesk=ball.z>3.70&&ball.z<7.55&&Math.abs(ball.x)<6.30;
  const surface=onFarDesk?(settings.topPad+.03):onNearDesk?1.02:0;
  if(ball.vy<0&&prevY>=surface+BALL_R&&ball.y<surface+BALL_R){
   if(settings.padCount&&pads.some(p=>Math.hypot(ball.x-p.x,ball.z-p.z)<p.r)){}
   else{miss(surface?'DESK BOUNCE!':'FLOOR!');return;}
  }
  if(ball.y<BALL_R+.02){miss('FLOOR!');return;}
  if(Math.abs(ball.x)>7.2||ball.z<settings.targetZ-4.5||ball.z>LAUNCH_Z+1.4||shotT>6.0){
   miss('OUT OF BOUNDS!');return;
  }
 }
 if(ballMesh){
  ballMesh.position.set(ball.x,ball.y,ball.z);
  ballMesh.rotation.x+=dt*ball.vz*.6;
  ballMesh.rotation.z+=dt*ball.vx*.6;
  ballShadow.position.set(ball.x,.015,ball.z);
  ballShadow.scale.setScalar(clamp(1+(ball.y-.2)*.3,.6,2.1));
  ballShadow.material.opacity=clamp(.22-ball.y*.035,.04,.19);
 }
}
function animate(now){
 requestAnimationFrame(animate);
 const dt=lastNow?clamp((now-lastNow)/1000,0,.04):0;lastNow=now;
 if(!hasRenderer)return;
 if(playing&&!paused){
  tickObstacles(now);
  if(charging)chargeTick(now);
  if(flight)tickFlight(dt);
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
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  scene.add(new THREE.HemisphereLight(0xf2e5cb,0x596c71,1.45));
  const sun=new THREE.DirectionalLight(0xffeac9,2.25);
  sun.position.set(-5,13,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
  sun.shadow.camera.top=16;sun.shadow.camera.bottom=-26;sun.shadow.camera.far=75;
  scene.add(sun);
  const fill=new THREE.PointLight(0xa8d0e5,5,22,2);fill.position.set(4,5,1);scene.add(fill);
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
 soundOn=!soundOn;el.sound.textContent=soundOn?'SOUND ON':'SOUND OFF';
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
 el.full.textContent=active?'EXIT FULLSCREEN':'FULLSCREEN';resize();
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
 aimPitch=clamp(.37+dy*.79,.29,1.10);
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
  if(key==='arrowup'||key==='w')aimPitch=clamp(aimPitch+amount,.27,1.04);
  if(key==='arrowdown'||key==='s')aimPitch=clamp(aimPitch-amount,.27,1.04);
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