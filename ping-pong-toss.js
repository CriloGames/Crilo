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
let THREE,renderer,scene,camera,group,ballMesh,ballShadow,launcher,cupGroup,cupFloor,trajectoryGroup;
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
let playing=false,paused=false,flight=false,charging=false,chargeFrom=0,chargeSource=null;
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
 const d=5.15+(n-1)*.135+(tier%4)*.22;
 let x=(seeded(n*3)-.5)*2.15;
 if(n<4)x*=.37;
 const radius=Math.max(.38,.82-(n-1)*.008);
 const type=(n-1)%5;
 const moving=c>=1?(c===1?.47+tier*.055:.24+tier*.033):0;
 const wind=c>=2?((n%2?1:-1)*(.37+tier*.055)):0;
 const barrierCount=c>=3?Math.min(3,1+Math.floor(tier/4)):0;
 const padCount=c===4?(tier>=4?2:1):0;
 const topPad=c===4?(tier>=5?.55:.2):0;
 return {n,c,tier,d,x,kind:type,radius,
  targetZ:LAUNCH_Z-d,moving,wind,barrierCount,padCount,topPad,
  color:chapter(n).color,
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
 el.tutorial.textContent=settings.c===0?'AIM • HOLD TO POWER UP • RELEASE TO TOSS':
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
   (level===1?'Aim with your mouse, hold to charge, and release to toss. ':'')+
   (settings.c===0?'Clear the obstacles and land inside the container.':
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
function buildWorld(){
 if(!hasRenderer)return;
 worldClean();
 group=new THREE.Group();scene.add(group);
 obstacles=[];pads=[];ambient=[];
 const c=settings.color;
 const table=createMat(0xf9f2e3),wood=createMat(0xd6bda6),woodDark=createMat(0x816f84);
 const accent=createMat(c,.54,.06),cream=createMat(0xfffdf6),navy=createMat(0x344967);
 const chapterAccent=createMat(CHAPTERS[settings.c].color,.5,.02,CHAPTERS[settings.c].color);
 const laneLength=settings.d+5.6,laneMid=(LAUNCH_Z+settings.targetZ)/2;
 // Big polished tabletop with graphic lane markings.
 meshBox(group,11,.32,laneLength,0,-.21,laneMid,table);
 meshBox(group,11,.17,laneLength,0,-.45,laneMid,wood);
 for(const x of [-5.3,5.3]){
  meshBox(group,.065,.016,laneLength-.3,x,.01,laneMid,accent);
 }
 for(let z=LAUNCH_Z-1;z>settings.targetZ-1;z-=1.2){
  const stripe=meshBox(group,.14,.022,.41,0,.01,z,accent);stripe.castShadow=false;
 }
 // Gradually introduce readable decor that never blocks shots.
 for(const side of [-1,1]){
  for(let k=0;k<4;k++){
   const z=LAUNCH_Z-1.1-k*Math.max(1.6,settings.d/4);
   meshBox(group,.7,.20,.7,side*4.85,.12,z,navy);
   const block=meshBox(group,.44,.55,.44,side*4.85,.50,z,chapterAccent);
   block.rotation.y=(k+.2)*.22;
  }
 }
 for(const side of [-1,1]){
  meshBox(group,.16,1.9,.16,side*4.7,.95,settings.targetZ-.95,woodDark);
  const pennant=meshBox(group,.75,.52,.06,side*4.28,1.5,settings.targetZ-.95,accent);
  pennant.rotation.y=side*.26;
 }
 // Launch hand and presentation pedestal.
 const launchBase=new THREE.Group();launchBase.position.set(0,0,LAUNCH_Z);group.add(launchBase);
 meshBox(launchBase,1.75,.20,1.0,0,.06,.25,wood);
 meshBox(launchBase,1.42,.10,.73,0,.21,.25,accent);
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.16,20),cream);
 plate.position.set(0,.31,0);launchBase.add(plate);
 const word=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.31),makeText('TOSS HERE',34,'#fff','#476a85'));
 word.rotation.x=-Math.PI/2;word.position.set(0,.012,LAUNCH_Z+1.03);group.add(word);
 // Cup marker and shallow podium.
 const podium=meshBox(group,2.45,.19,2.4,settings.x,.055,settings.targetZ,accent);
 const disc=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.07,.06,26),cream);
 disc.position.set(settings.x,.17,settings.targetZ);group.add(disc);
 // The cup will be moved as one group by the chapter 2 mechanic.
 cupGroup=new THREE.Group();
 cupGroup.position.set(settings.x,.19,settings.targetZ);group.add(cupGroup);
 const r=settings.radius,kind=settings.kind,h=settings.targetHeight;
 const palette=[0xff8c9e,0x8db8eb,0xffc679,0x9cdbb8,0xbb9def];
 const cupMat=createMat(palette[kind],.45,.06),insideMat=createMat(0xf5e9e3),lipMat=createMat(0xfff8e6,.36,.05);
 const bottomR=kind===3?r*.99:r*.73;
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(r,bottomR,h,32,1,true),cupMat);
 shell.position.y=h/2;shell.castShadow=true;cupGroup.add(shell);
 const inner=new THREE.Mesh(new THREE.CylinderGeometry(r*.92,bottomR*.92,h*.93,32,1,true),
  new THREE.MeshStandardMaterial({color:palette[kind],roughness:.6,side:THREE.BackSide}));
 inner.position.y=h/2;cupGroup.add(inner);
 cupFloor=new THREE.Mesh(new THREE.CircleGeometry(bottomR*.92,28),insideMat);
 cupFloor.rotation.x=-Math.PI/2;cupFloor.position.y=.06;cupGroup.add(cupFloor);
 const lip=new THREE.Mesh(new THREE.TorusGeometry(r*.98,.055,8,40),lipMat);
 lip.rotation.x=Math.PI/2;lip.position.y=h;cupGroup.add(lip);
 if(kind===1){
  const handle=new THREE.Mesh(new THREE.TorusGeometry(r*.4,.09,8,20),cupMat);
  handle.rotation.y=Math.PI/2;handle.position.set(r*1.12,h*.56,0);cupGroup.add(handle);
 }
 if(kind===2){
  for(const side of [-1,1])meshBox(cupGroup,.11,h*.78,.09,side*r*.85,h*.5,0,lipMat);
 }
 if(kind===4){
  const net=new THREE.Mesh(new THREE.CylinderGeometry(r*.98,r*.67,h*.73,24,1,true),
   new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.21,wireframe:true}));
  net.position.y=h*.45;cupGroup.add(net);
 }
 target={x:settings.x,z:settings.targetZ,y:.19,top:.19+h,r:r,kind};
 // Target spotlight decal and stage sign, behind the target.
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.75,.67),
  makeText('LEVEL '+fmtLevel(level),42,'#fff','#3d6485'));
 sign.position.set(settings.x,2.45,settings.targetZ-1.25);group.add(sign);
 // Distinct physical obstacles along the flight path. Blockers never intersect
 // the container itself, making all 50 goals geometrically possible.
 const count=settings.obstacles;
 for(let i=0;i<count;i++){
  const t=(i+1)/(count+1);
  const z=lerp(LAUNCH_Z-1.5,settings.targetZ+1.25,t);
  const left=i%2===0?-1:1;
  const x=left*(.7+.42*seeded(level*7+i));
  const height=.8+.35*(i%3);
  const obj=meshBox(group,.57,height,.57,x,height/2,z,
   createMat(i%2?0xffc57c:0x8abed2));
  meshBox(group,.61,.13,.61,x,height+.04,z,navy);
  obstacles.push({type:'box',obj,x,y:height/2,z,w:.57,h:height,d:.57});
 }
 // Moving gates arrive at levels 31–40; keep readable openings.
 for(let i=0;i<settings.barrierCount;i++){
  const pos=(i+1)/(settings.barrierCount+1);
  const z=lerp(LAUNCH_Z-1.8,settings.targetZ+1.25,pos);
  const obj=meshBox(group,1.45,.33,.30,0,1.65+i*.22,z,createMat(0xe889a8));
  for(const side of [-1,1]){
   meshBox(group,.16,1.8,.18,side*2.5,.9,z,woodDark);
  }
  obstacles.push({type:'barrier',obj,x:0,y:1.65+i*.22,z,w:1.45,h:.33,d:.3,
   amp:1.6+.22*i,speed:.9+.17*i,phase:i*2.4});
 }
 // Bounce Lab introduces spring pads that pop the ball upward on contact.
 for(let i=0;i<settings.padCount;i++){
  const z=lerp(LAUNCH_Z,settings.targetZ,(i+1)/(settings.padCount+1));
  const x=i===0?0:(settings.x*.45);
  const padBase=new THREE.Mesh(new THREE.CylinderGeometry(.85,.95,.14,26),
   createMat(0x3f587c,.35,.1));padBase.position.set(x,.08,z);group.add(padBase);
  const padFace=new THREE.Mesh(new THREE.CylinderGeometry(.76,.76,.05,26),
   createMat(0xcfb1fa,.25,.05,0xae8aff));
  padFace.position.set(x,.17,z);group.add(padFace);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.79,.065,8,28),
   new THREE.MeshBasicMaterial({color:0xfff2a5}));
  ring.rotation.x=Math.PI/2;ring.position.set(x,.21,z);group.add(ring);
  pads.push({x,z,r:.75,y:.24,mat:padFace.material,last:-10});
 }
 // Scene background scenery deliberately does not affect physical collision.
 const stone=createMat(0xb7c7cb),grass=createMat(0xb2dfc2);
 for(let i=0;i<16;i++){
  const side=i%2===0?-1:1,x=side*(7+(i*5%9));
  const z=settings.targetZ-8+(i*3)%30;
  const h=1.1+(i%3)*.55;
  const island=new THREE.Mesh(new THREE.DodecahedronGeometry(.6+i%3*.19,0),stone);
  island.position.set(x,-.65,z);group.add(island);
  const leaf=new THREE.Mesh(new THREE.ConeGeometry(.48,h,7),grass);
  leaf.position.set(x,-.25+h*.5,z);group.add(leaf);
 }
 // Ball and preview dots are recreated every stage.
 ballMesh=new THREE.Mesh(new THREE.SphereGeometry(BALL_R,20,16),
  new THREE.MeshStandardMaterial({color:0xfefefe,roughness:.25,metalness:.02}));
 ballMesh.castShadow=true;ballMesh.position.set(0,LAUNCH_Y,LAUNCH_Z);group.add(ballMesh);
 const seamMat=new THREE.MeshBasicMaterial({color:0xf49c70,transparent:true,opacity:.8});
 for(const rot of [0,Math.PI*.5]){
  const seam=new THREE.Mesh(new THREE.TorusGeometry(BALL_R*.985,.004,5,44),seamMat);
  seam.rotation.y=rot;ballMesh.add(seam);
 }
 ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.25,26),
  new THREE.MeshBasicMaterial({color:0x31506b,transparent:true,opacity:.16,depthWrite:false}));
 ballShadow.rotation.x=-Math.PI/2;ballShadow.position.set(0,.02,LAUNCH_Z);group.add(ballShadow);
 trajectoryGroup=new THREE.Group();group.add(trajectoryGroup);
 for(let i=0;i<48;i++){
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),
   new THREE.MeshBasicMaterial({color:i%3===0?0xffcc84:0xffffff,
    transparent:true,opacity:Math.max(.13,.84-i*.013)}));
  dot.visible=false;trajectoryGroup.add(dot);aimLine.push(dot);
 }
 aimLine=trajectoryGroup.children;
 camera.position.set(0,7.8+settings.d*.17,10.0+settings.d*.17);
 camera.lookAt(settings.x*.17,1.0,settings.targetZ*.41);
 camera.updateMatrixWorld();
 scene.background.setHex([0xd8eff3,0xf4e7ef,0xdcebf8,0xffeedb,0xeee3f8][settings.c]);
 const floor=scene.fog;if(floor)floor.color.copy(scene.background);
 renderer.setClearColor(scene.background,1);
 resetBall();
 paintAim();
}
function idealPower(){
 const d=Math.hypot(settings.d,settings.x);
 const t=Math.tan(aimPitch),co=Math.cos(aimPitch);
 const denom=2*co*co*(d*t+LAUNCH_Y-(.19+settings.targetHeight));
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
 const sec=(now-chargeFrom)/1000;
 power=clamp(chargeAnchor+sec*.58,.06,1);
 updatePower();
}
function launch(){
 if(!playing||paused||flight||!charging)return;
 chargeTick(performance.now());charging=false;chargeSource=null;flight=true;attempts++;
 const v=makeVelocity(power);
 ball={x:0,y:LAUNCH_Y,z:LAUNCH_Z,vx:v.vx,vy:v.vy,vz:v.vz,
  active:true,bounces:0,trail:[]};
 shotT=0;shotStart=performance.now();
 el.attempts.textContent=String(attempts);
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
  const prevY=ball.y;
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
  // Bounce Lab: a spring pad can relaunch one descending ball.
  if(settings.padCount&&ball.vy<0){
   for(const pad of pads){
    if(prevY>=pad.y+BALL_R&&ball.y<=pad.y+BALL_R&&
     Math.hypot(ball.x-pad.x,ball.z-pad.z)<pad.r-BALL_R){
     ball.y=pad.y+BALL_R;ball.vy=6.1;
     ball.vz-=1.45;
     ball.vx+=(target.x-ball.x)*.18;
     ball.bounces++;hear(480,.18,'sine',.06);
     message('BOING! +1 BOUNCE',.85);break;
    }
   }
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
 if(toastUntil&&now>toastUntil){el.toast.hidden=true;toastUntil=0;}
 if(renderer)renderer.render(scene,camera);
}
async function init(){
 try{
  THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  scene=new THREE.Scene();scene.background=new THREE.Color(0xe0f3f1);
  scene.fog=new THREE.Fog(0xe0f3f1,24,62);
  camera=new THREE.PerspectiveCamera(47,1,.1,95);
  renderer=new THREE.WebGLRenderer({canvas:el.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
  scene.add(new THREE.HemisphereLight(0xffffff,0xbecac3,2.25));
  const sun=new THREE.DirectionalLight(0xffffff,2.4);
  sun.position.set(-5,13,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
  sun.shadow.camera.top=16;sun.shadow.camera.bottom=-26;sun.shadow.camera.far=75;
  scene.add(sun);
  const fill=new THREE.PointLight(0xffd0a5,18,27,2);fill.position.set(4,7,1);scene.add(fill);
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
el.canvas.addEventListener('pointermove',e=>{
 if(!playing||flight)return;
 inputAim(e.clientX,e.clientY);
});
el.canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||!playing||flight)return;
 e.preventDefault();
 el.canvas.setPointerCapture?.(e.pointerId);
 inputAim(e.clientX,e.clientY);
 startCharge('pointer');
});
const release=e=>{
 if(chargeSource!=='pointer')return;
 e.preventDefault();launch();
 try{el.canvas.releasePointerCapture?.(e.pointerId);}catch{}
};
el.canvas.addEventListener('pointerup',release);
el.canvas.addEventListener('pointercancel',()=>{charging=false;chargeSource=null;});
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