/* KEEP IT UP: CARGO BAY
 * Original low-poly industrial 3D arena using Three.js.
 * One independent browser-local record. No Daily / badge / account writes.
 */
(async()=>{
'use strict';
const $=id=>document.getElementById(id);
const stage=$('balloonStage'),host=$('cargoViewport3d'),overlay=$('balloonOverlay');
const start=$('balloonStart'),pause=$('balloonPause'),sound=$('balloonSound'),full=$('balloonFullscreen'),select=$('balloonLevelSelect'),levelText=$('balloonLevel'),goalText=$('balloonGoal'),gateText=$('cargoGateHint'),levelName=$('cargoLevelName'),statusLevel=$('balloonStatusLevel'),stageTrack=$('cargoStagesTrack'),stagesProgress=$('cargoStagesProgress');
const scoreLabel=$('balloonScore'),bestLabel=$('balloonBest'),title=$('balloonOverlayTitle');
const kicker=$('balloonOverlayKicker'),description=$('balloonOverlayText');
const status=$('balloonStatus'),telemetry=$('cargoTelemetry'),warning=$('cargoFloorWarning');
const word=$('balloonPopWord'),cursor=$('cargoCrosshair'),errorBox=$('balloonLoadError'),rangeLabel=$('cargoRangeStatus');
if(![stage,host,overlay,start,pause,sound,full,select,levelText,goalText,gateText,levelName,statusLevel,stageTrack,stagesProgress,scoreLabel,bestLabel,title,kicker,description,status,telemetry,warning,word,cursor,errorBox,rangeLabel].every(Boolean))return;
const BEST_KEY='crilo_keep_it_up_best_v1';
const SOUND_KEY='crilo_cargo_audio_v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const displayNumber=n=>String(Math.min(999999,n)).padStart(3,'0');
const LEVEL_PROGRESS='crilo_balloon_course_unlocked_v1';
const LEVELS=[
 ['Orientation',2,[[0,-.95,3.4,.45]],[],[]],
 ['First Jump',3,[[0,.2,9,.85]],[],[]],
 ['Zigzag Run',3,[[0,.9,9,.7],[-2,-1.3,5.8,.7],[2,-2.15,5.8,.7]],[],[]],
 ['The Sweeper',4,[[0,1.3,9,.6]],[[0,-.8,7,1.3,0]],[]],
 ['Blink Bridge',4,[[0,-1.6,9,.65]],[],[[0,.5,9,.8,2.1,0],[0,-.65,9,.65,1.75,.7]]],
 ['Crossfire',5,[[0,-2,9,.7]],[[0,.65,7,1.7,0],[0,-.9,7,-1.5,1]],[]],
 ['Pressure Plates',5,[[0,1.4,9,.7],[0,-1.3,9,.7]],[[0,-.25,7,1.5,.9]],[[0,.45,9,.7,1.4,0]]],
 ['Laser Corridor',6,[[0,1.4,9,.65],[0,-2,9,.7]],[[0,.7,7,1.9,0],[0,-.3,7,-2.1,.6],[0,-1.4,7,2.4,1.5]],[]],
 ['Panic Station',6,[[0,1.38,9,.7],[0,-1.85,9,.7]],[[0,-.25,7.5,2.55,0],[0,-1.1,7.2,-2.3,1]],[[0,.67,9,.7,1.25,.3]]],
 ['Final Inspection',7,[[0,1.38,9,.75],[0,.1,9,.7],[0,-2.75,9,.65]],[[0,.9,7.3,2.8,0],[0,-.7,7.3,-2.65,1.2],[0,-1.75,7.4,3.1,2.3]],[[0,-.1,9,.6,1.3,.3],[0,-2.35,9,.6,1.15,.7]]]
];
let unlocked=1,level=0,levelHits=0,checkpointScore=0,levelWorld=null,staticHazards=[],movingHazards=[],flashHazards=[],exitMat=null,awaitFirstHit=true;
try{unlocked=clamp(parseInt(localStorage.getItem(LEVEL_PROGRESS),10)||1,1,LEVELS.length);}catch{}
level=unlocked-1;
let best=0,enabled=true,state='ready',score=0,context=null;
try{const old=Number(localStorage.getItem(BEST_KEY));if(Number.isSafeInteger(old)&&old>=0&&old<=999999)best=old;}catch{}
try{enabled=localStorage.getItem(SOUND_KEY)!=='off';}catch{}
bestLabel.textContent=displayNumber(best);
sound.textContent=enabled?'♫ AUDIO ON':'♫ AUDIO OFF';
sound.setAttribute('aria-pressed',String(enabled));
const showStatus=message=>{status.textContent=message;};
let THREE,scene,camera,renderer,room,balloon,balloonBody,shadow,redLight,warningLight,raycaster,ndc,worker,hitRing,ringMaterial,glove;
const HIT_RADIUS=2.55, WALK_SPEED=3.6;
const player={x:0,z:2.2,yaw:0,pitch:.04,feet:0,vy:0,grounded:true};
const CAMERA_FOLLOW_DISTANCE=3.15, CAMERA_FOLLOW_HEIGHT=2.95;
const held=new Set(),activeTouches=new Map();
let lookDrag=null;
const moving=()=>state==='playing'&&ready;
function releaseMovement(){held.clear();activeTouches.clear();lookDrag=null;document.querySelectorAll('[data-move]').forEach(b=>b.classList.remove('is-pressed'));}
function mouseUnlock(){if(document.pointerLockElement===stage)document.exitPointerLock?.();}
function mouseLock(){
 if(!moving()||!stage.requestPointerLock||!window.matchMedia?.('(pointer:fine)').matches)return;
 try{stage.requestPointerLock()?.catch?.(()=>{});}catch{}
}
function refreshStages(){
 stageTrack.replaceChildren();
 stagesProgress.textContent=(stage.dataset.allCleared==='true'?10:unlocked-1)+' / 10 CLEARED';
 LEVELS.forEach((c,i)=>{
 const b=document.createElement('button');b.type='button';b.className='cargo-stage-chip';
 b.classList.add(i===level?'is-current':i<unlocked?'is-cleared':'is-locked');
 b.dataset.stage=String(i);b.title='Stage '+(i+1)+' · '+c[0]+(i>=unlocked?' (LOCKED)':'');
 b.setAttribute('aria-label',b.title);if(i===level)b.setAttribute('aria-current','step');
 const num=document.createElement('strong');num.textContent=(i<unlocked?'● ':'◇ ')+String(i+1).padStart(2,'0');
 const name=document.createElement('span');name.textContent=c[0];
 b.append(num,name);stageTrack.append(b);
 });
}
function refreshLevels(){
 select.replaceChildren();
 LEVELS.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.disabled=i>=unlocked;
 o.textContent=String(i+1).padStart(2,'0')+' · '+c[0]+(i>=unlocked?' · LOCKED':'');select.append(o);});
 select.value=String(level);
 refreshStages();
}
function hudLevel(){
 const c=LEVELS[level];
 levelText.textContent=String(level+1).padStart(2,'0')+' / 10';
 goalText.textContent=levelHits+' / '+c[1]+' HITS · REACH EXIT';
 gateText.textContent=levelHits>=c[1]?'EXIT OPEN · STEP INSIDE':'GATE LOCKED · '+(c[1]-levelHits)+' HITS';
 levelName.textContent='LEVEL '+String(level+1).padStart(2,'0')+' · '+c[0].toUpperCase();
 statusLevel.textContent='COURSE '+String(level+1).padStart(2,'0')+' / 10';
 if(exitMat)exitMat.color.setHex(levelHits>=c[1]?0x74efa6:0xe9a16a);
 stage.dataset.level=String(level+1);stage.dataset.levelHits=String(levelHits);
}
function previewLevel(){
 kicker.textContent='LEVEL '+String(level+1).padStart(2,'0')+' // '+LEVELS[level][0].toUpperCase();
 title.textContent=LEVELS[level][0].toUpperCase()+'.';
 description.textContent='Get '+LEVELS[level][1]+' balloon hits, jump red hazards with Space, and reach the glowing exit. Moving beams and flashing traps get harder each level. Keep the balloon up.';
 start.innerHTML='BEGIN LEVEL '+String(level+1).padStart(2,'0')+' <span aria-hidden="true">↗</span>';
 refreshLevels();hudLevel();
}
function buildLevel(){
 if(!scene)return;
 if(levelWorld){scene.remove(levelWorld);const geo=new Set(),mat=new Set();
  levelWorld.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mat.add(m));});
  geo.forEach(g=>g.dispose());mat.forEach(m=>{m.map?.dispose?.();m.dispose();});}
 levelWorld=new THREE.Group();scene.add(levelWorld);
 staticHazards=[];movingHazards=[];flashHazards=[];
 // Visible low-poly obby walkway and colored checkpoint platforms, including on stage one.
 const palette=[0x65cbbd,0xd9b974,0xb5a2e3,0x9de0c2,0xb8db75,0xdd9677,0x8ebecf,0xe0a4df,0xf2ae73,0xf27c70];
 const tint=palette[level];
 const platform=color(0x52605b,.77,.4),trim=color(tint,.55,.12,{emissive:tint,emissiveIntensity:.9});
 const dark=color(0x253531,.91,.55);
 [1.92,1.12,.32,-.48,-1.28,-2.08,-2.88].forEach((z,i)=>{
  box(levelWorld,3.25,.09,.7,0,.045,z,platform,false);
  box(levelWorld,3.25,.045,.065,0,.105,z+.30,trim,false);
  for(const x of [-1.66,1.66])box(levelWorld,.08,.18,.7,x,.10,z,dark,false);
  if(i%2===0)box(levelWorld,.38,.015,.22,0,.10,z,trim,false);
 });
 // Colored side pylons and numbered in-world stage signage make each room distinct.
 for(const x of [-3.05,3.05]){
  box(levelWorld,.27,1.9,.27,x,.95,-2.95,dark,false);
  box(levelWorld,.4,.34,.4,x,2.05,-2.95,trim,false);
 }
 const stageBoard=new THREE.Mesh(new THREE.PlaneGeometry(2.3,.72),
  signage('STAGE '+String(level+1).padStart(2,'0'),LEVELS[level][0].toUpperCase()));
 stageBoard.position.set(0,4.7,-4.38);levelWorld.add(stageBoard);
 const red=color(0xd64a3c,.65,.1,{emissive:0xc32b20,emissiveIntensity:1.5});
 const amber=color(0xf5b767,.5,.2,{emissive:0xac5d2c,emissiveIntensity:1});
 LEVELS[level][2].forEach(([x,z,w,d])=>{box(levelWorld,w,.055,d,x,.155,z,red,false);staticHazards.push({x,z,w,d});});
 LEVELS[level][3].forEach(([x,z,length,speed,phase])=>{
  const arm=box(levelWorld,length,.25,.24,x,.6,z,red,false);
  box(levelWorld,.45,.9,.45,x,.45,z,amber,false);
  movingHazards.push({x,z,length,speed,phase,arm,angle:0});
 });
 LEVELS[level][4].forEach(([x,z,w,d,period,phase])=>{
  const mat=new THREE.MeshBasicMaterial({color:0xff6650,transparent:true,opacity:.85});
  const mesh=box(levelWorld,w,.055,d,x,.16,z,mat,false);
  flashHazards.push({x,z,w,d,period,phase,mesh,on:true});
 });
 exitMat=new THREE.MeshBasicMaterial({color:0xe9a16a});
 box(levelWorld,.2,3.5,.24,-1.2,1.75,-3.64,exitMat,false);
 box(levelWorld,.2,3.5,.24,1.2,1.75,-3.64,exitMat,false);
 box(levelWorld,2.6,.18,.24,0,3.55,-3.64,exitMat,false);
 box(levelWorld,2.1,.06,.5,0,.08,-3.5,exitMat,false);
 hudLevel();
}
function intersects(t){return Math.abs(player.x-t.x)<t.w/2+.17&&Math.abs(player.z-t.z)<t.d/2+.17;}
function updateHazards(now){
 const t=now/1000;
 for(const h of movingHazards){h.angle=t*h.speed+h.phase;h.arm.rotation.y=h.angle;}
 for(const h of flashHazards){
  h.on=((t+h.phase)%h.period)/h.period<.57;
  h.mesh.material.color.setHex(h.on?0xff634d:0x34453d);
  h.mesh.material.opacity=h.on?.95:.23;
 }
}
function checkCourse(){
 if(!moving())return;
 // The spawn pad remains safe until the player walks into the obstacle course.
 if(Math.hypot(player.x,player.z-2.2)<.38)return;
 if(player.feet<.7&&(staticHazards.some(intersects)||flashHazards.some(h=>h.on&&intersects(h)))){finishRun('obstacle');return;}
 for(const h of movingHazards){
  const x=player.x-h.x,z=player.z-h.z;
  if(Math.abs(x*Math.cos(h.angle)-z*Math.sin(h.angle))<h.length/2+.2&&
     Math.abs(x*Math.sin(h.angle)+z*Math.cos(h.angle))<.36&&player.feet<1){finishRun('obstacle');return;}
 }
 if(player.z<-3.3&&Math.abs(player.x)<1.05){
  if(levelHits>=LEVELS[level][1])clearLevel();
  else if(!stage.dataset.gateMessageAt||performance.now()-Number(stage.dataset.gateMessageAt)>1300){
   stage.dataset.gateMessageAt=String(performance.now());
   showStatus('EXIT LOCKED · '+(LEVELS[level][1]-levelHits)+' MORE BALLOON HITS.');
  }
 }
}
function jump(){if(moving()&&!awaitFirstHit&&player.grounded){player.grounded=false;player.vy=5.4;}}

function inRange(){
 return Math.hypot(physics.x-player.x,physics.z-player.z)<=HIT_RADIUS;
}
function movePlayer(dt){
 // Keep the worker stationary until the first real balloon hit.
 if(!moving()||dt<=0||awaitFirstHit)return;
 let dx=(held.has('d')?1:0)-(held.has('a')?1:0);
 let dz=(held.has('s')?1:0)-(held.has('w')?1:0);
 for(const key of activeTouches.values()){
  dx+=(key==='d'?1:key==='a'?-1:0);
  dz+=(key==='s'?1:key==='w'?-1:0);
 }
 const length=Math.hypot(dx,dz);
 if(length){
  // Move relative to where the player is looking, not world directions.
  const side=dx/length,forward=-dz/length;
  const worldX=side*Math.cos(player.yaw)-forward*Math.sin(player.yaw);
  const worldZ=side*Math.sin(player.yaw)-forward*Math.cos(player.yaw);
  player.x=clamp(player.x+worldX*WALK_SPEED*dt,-4.55,4.55);
  player.z=clamp(player.z+worldZ*WALK_SPEED*dt,-3.5,2.95);
 }
 if(!player.grounded){player.vy-=11.5*dt;player.feet+=player.vy*dt;
  if(player.feet<=0){player.feet=0;player.vy=0;player.grounded=true;}}
 checkCourse();
}
function syncCamera(){
 if(!camera)return;
 // Third person: orbit behind the actual worker while moving and looking.
 camera.position.set(
  player.x+Math.sin(player.yaw)*CAMERA_FOLLOW_DISTANCE,
  CAMERA_FOLLOW_HEIGHT+player.feet,
  player.z+Math.cos(player.yaw)*CAMERA_FOLLOW_DISTANCE
 );
 camera.rotation.order='YXZ';
 camera.rotation.y=player.yaw;
 camera.rotation.x=player.pitch;
 camera.updateMatrixWorld();
}

let raf=0,lastFrame=0,hitTimer=null,hitLabelTimer=null,lastBop=0,ready=false;
const physics={x:0,y:3.15,z:0,vx:0,vy:0,vz:0};
function setScore(n){score=n;scoreLabel.textContent=displayNumber(score);stage.dataset.hits=String(score);}
function saveBest(){
 if(score<=best)return;
 best=score;bestLabel.textContent=displayNumber(best);
 try{localStorage.setItem(BEST_KEY,String(best));}catch{}
}
function color(c,roughness=.85,metalness=.14,extra={}){
 return new THREE.MeshStandardMaterial({color:c,roughness,metalness,flatShading:true,...extra});
}
function box(parent,w,h,d,x,y,z,material,shadows=true){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
 mesh.position.set(x,y,z);mesh.castShadow=shadows;mesh.receiveShadow=shadows;parent.add(mesh);return mesh;
}
function lineBox(parent,a,b,r,material){
 const direction=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const center=new THREE.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,direction.length(),7),material);
 mesh.position.copy(center);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
 mesh.castShadow=true;parent.add(mesh);return mesh;
}
function signage(message,sub,w=360,h=116,bg='#111d1a',fg='#e5b781'){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');
 if(!ctx)return new THREE.MeshBasicMaterial({color:0x212e26});
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 ctx.lineWidth=5;ctx.strokeStyle='#657565';ctx.strokeRect(6,6,w-12,h-12);
 ctx.font='bold 41px monospace';ctx.textAlign='center';ctx.fillStyle=fg;ctx.fillText(message,w/2,54);
 ctx.font='bold 18px monospace';ctx.fillStyle='#a4b4a1';ctx.fillText(sub,w/2,85);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
}
function plate(text,smaller,x,y,z,width,height,material){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material||signage(text,smaller));
 mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
function buildRoom(){
 room=new THREE.Group();scene.add(room);
 const steel=color(0x4d5652,.94,.65),shadowSteel=color(0x242e2e,.95,.62);
 const floorMat=color(0x37403e,.96,.63),warmSteel=color(0x6a6656,.84,.4);
 const warningMat=color(0xc17d3a,.74,.28),yellow=color(0xe2a55f,.7,.32);
 const red=color(0xa3483a,.6,.25),cable=color(0x222b2d,.9,.55);
 // Geometrical room: textured by panels, riveted columns and actual depth.
 box(room,11,.25,8,0,-.16,-.75,floorMat);
 box(room,11,6.8,.24,0,3.2,-4.8,steel);
 box(room,.24,6.8,8,-5.55,3.2,-.75,steel);
 box(room,.24,6.8,8,5.55,3.2,-.75,steel);
 box(room,11,.28,8,0,6.63,-.75,shadowSteel);
 for(let i=-4;i<=4;i++){
  box(room,.045,.012,7.4,i*1.05,.005,-.75,shadowSteel,false);
 }
 for(let i=-4;i<=4;i++){
  const grate=box(room,.32,.013,7.3,i*1.05+0.3,.015,-.75,color(i%2?0x373e3a:0x404844,.97,.61),false);
  grate.receiveShadow=true;
 }
 for(let i=0;i<6;i++){
  const z=-4.35+i*1.45;
  box(room,.16,6.35,.19,-5.33,3.1,z,shadowSteel);
  box(room,.16,6.35,.19,5.33,3.1,z,shadowSteel);
  box(room,10.55,.17,.25,0,6.31,z,shadowSteel);
 }
 // Back wall steel tile plating and visible seams.
 for(let x=-4.5;x<=4.5;x+=1.5){
  for(let y=.6;y<6.2;y+=1.28)box(room,1.38,1.14,.035,x,y,-4.65,
   color((Math.round(x+y*5)%3===0)?0x505c55:0x3d4743,.9,.52),false);
 }
 // Cargo hatch and caution strips.
 box(room,3.25,4.36,.21,0,2.16,-4.36,shadowSteel);
 box(room,2.69,3.74,.11,0,2.15,-4.23,color(0x59615b,.88,.69));
 for(let i=-3;i<=3;i++){
  box(room,.09,3.85,.12,i*.37,2.15,-4.145,steel,false);
 }
 for(const x of [-1.56,1.56]){
  box(room,.18,4.4,.18,x,2.15,-4.03,warningMat,false);
  for(let i=0;i<11;i++){
   const stripe=box(room,.19,.12,.022,x,.19+i*.38,-3.915,shadowSteel,false);
   stripe.rotation.z=.3;
  }
 }
 // Vertical support bays, hand rails, floor hazards.
 for(let x of [-4.8,4.8]){
  for(const y of [1.12,2.4,4.8])lineBox(room,[x,y,-4.35],[x,y,2.7],.058,warmSteel);
 }
 for(let i=-4;i<5;i++){
  const stripe=box(room,.33,.012,.58,i*1.07,.016,2.85,i%2===0?warningMat:shadowSteel,false);
  stripe.rotation.y=.36;
 }
 // Distinct stacked cargo cases with low-poly bevel-free industrial geometry.
 const cases=[
  [-3.83,.52,-2.0,1.45,.95,1.2],[-4.04,1.42,-2.25,1.1,.86,1.15],
  [3.85,.45,-2.5,1.48,.86,1.3],[3.78,1.31,-2.55,1.28,.84,1.1],
  [-4.32,.47,1.48,1.1,.82,1.15],[4.3,.38,1.18,1,.72,1.3]
 ];
 for(let i=0;i<cases.length;i++){
  const [x,y,z,w,h,d]=cases[i];
  const base=color(i%2===0?0x626756:0x485452,.9,.38);
  box(room,w,h,d,x,y,z,base);
  box(room,w+.025,.1,d+.025,x,y+h*.37,z,shadowSteel,false);
  box(room,w+.025,.1,d+.025,x,y-h*.37,z,shadowSteel,false);
  for(const offset of [-1,1])box(room,.08,h*.85,d+.03,x+offset*w*.36,y,z,shadowSteel,false);
  box(room,.27,.13,.022,x,y,z+d/2+.015,warningMat,false);
 }
 // Plumbing and cable conduits: recognizably 3D silhouettes.
 for(const x of [-4.93,4.93]){
  const pipeMat=color(x<0?0x7e765c:0x53685b,.63,.8);
  lineBox(room,[x,5.78,-4.3],[x,5.78,3.1],.12,pipeMat);
  lineBox(room,[x,5.78,-4.3],[x,2.2,-4.3],.10,pipeMat);
 }
 // Overhead luminaire arrays emit light and cast short shadows.
 const lightPanel=color(0xffd3a0,.38,.05,{emissive:0xffbd76,emissiveIntensity:2.3});
 for(const x of [-2.6,2.6]){
  for(const z of [-2.55,.95]){
   box(room,1.15,.18,.58,x,6.36,z,shadowSteel);
   box(room,.9,.055,.36,x,6.21,z,lightPanel,false);
  }
 }
 // Mechanical rear signage, old CRT, glowing status switches.
 const signMat=signage('BAY 04','PROPERTY OF THE COMPANY');
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.65,.87),signMat);
 sign.position.set(-3.24,5.56,-4.46);scene.add(sign);
 box(room,1.52,1.05,.22,3.54,4.63,-4.26,shadowSteel);
 box(room,1.32,.83,.02,3.54,4.63,-4.125,color(0x253c37,.58,.24,{emissive:0x1d544a,emissiveIntensity:.8}),false);
 const crtMat=signage('02:14','OBJECT LIVE',360,116,'#18302a','#a7dbaf');
 const crt=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.42),crtMat);
 crt.position.set(3.54,4.69,-4.08);scene.add(crt);
 for(let i=0;i<4;i++){
  const dot=new THREE.Mesh(new THREE.BoxGeometry(.12,.1,.065),color(i===0?0xff6954:0x93b9a2,.35,.04,{
   emissive:i===0?0xcc251b:0x4cbe87,emissiveIntensity:1.5}));
  dot.position.set(3.10+i*.27,4.30,-4.06);scene.add(dot);
 }
 // Back wall red industrial warning strips.
 for(const x of [-2.02,2.02]){
  const warningBar=new THREE.Mesh(new THREE.BoxGeometry(.18,.9,.11),red);
  warningBar.position.set(x,4.52,-4.24);warningBar.castShadow=true;scene.add(warningBar);
 }
 // Floating dust points give atmosphere without external textures/models.
 const particles=new THREE.BufferGeometry(),positions=new Float32Array(75*3);
 for(let i=0;i<75;i++){
  positions[i*3]=(Math.random()-.5)*9.5;
  positions[i*3+1]=Math.random()*5.6+.25;
  positions[i*3+2]=(Math.random()-.5)*6.6-1;
 }
 particles.setAttribute('position',new THREE.BufferAttribute(positions,3));
 scene.add(new THREE.Points(particles,new THREE.PointsMaterial({
  color:0xd2bfa0,size:.025,transparent:true,opacity:.40,depthWrite:false})));
}
function buildBalloon(){
 balloon=new THREE.Group();
 // Low-poly inflated test specimen. Real shaded geometry, not a CSS sprite.
 const rubber=color(0xc64d38,.35,.02,{emissive:0x4c130b,emissiveIntensity:.25,side:THREE.FrontSide});
 const shell=new THREE.Mesh(new THREE.SphereGeometry(.55,18,14),rubber);
 shell.scale.set(.93,1.16,.87);shell.castShadow=true;balloon.add(shell);
 // Hit testing uses THIS rendered rubber surface, with its actual dimensions.
 // Do not expand the hit target beyond the visual balloon.
 balloonBody=shell;
 const gloss=new THREE.Mesh(new THREE.SphereGeometry(.12,9,7),new THREE.MeshBasicMaterial({
  color:0xffcab0,transparent:true,opacity:.42,depthWrite:false}));
 gloss.position.set(-.2,.31,.33);gloss.scale.set(.8,1.9,.32);balloon.add(gloss);
 const knot=new THREE.Mesh(new THREE.ConeGeometry(.13,.25,6),color(0x9b3025,.6,.04));
 knot.position.y=-.72;knot.rotation.z=Math.PI;knot.castShadow=true;balloon.add(knot);
 const stringPts=[];
 for(let i=0;i<10;i++){
  const t=i/9;
  stringPts.push(new THREE.Vector3(Math.sin(t*8)*.065,-.85-t*.70,.008));
 }
 const lineGeo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stringPts),24,.012,4,false);
 const string=new THREE.Mesh(lineGeo,color(0xd2c8b3,.96,.08));balloon.add(string);
 // Only balloonBody (the visible inflated rubber mesh) is clickable.
 // The string, knot, highlight and empty air are never hit targets.
 balloon.position.set(0,3.15,0);
 scene.add(balloon);
 const shadowMat=new THREE.MeshBasicMaterial({color:0x080b0a,transparent:true,opacity:.42,depthWrite:false});
 shadow=new THREE.Mesh(new THREE.CircleGeometry(.65,28),shadowMat);
 shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.025,0);scene.add(shadow);
}
function buildWorker(){
 worker=new THREE.Group();scene.add(worker);
 worker.visible=true; // The playable worker is visible in third person.
 const suit=color(0xc98440,.91,.1),trim=color(0x353d37,.85,.33);
 const dark=color(0x242a26,.8,.42),visor=color(0x687f78,.28,.65,{
  emissive:0x1b554c,emissiveIntensity:.25
 });
 // Deliberately original little utility worker, not a copied game character.
 box(worker,.69,.72,.39,0,.95,0,suit);
 box(worker,.52,.22,.47,0,1.28,0,trim);
 box(worker,.75,.58,.64,0,1.62,-.03,suit);
 box(worker,.59,.31,.12,0,1.64,-.35,visor);
 box(worker,.4,.25,.12,0,1.95,-.11,trim);
 for(const side of [-1,1]){
  box(worker,.23,.57,.28,side*.50,.92,0,suit);
  box(worker,.27,.20,.3,side*.50,.62,-.05,dark);
  box(worker,.26,.55,.32,side*.21,.29,.05,suit);
  box(worker,.3,.14,.52,side*.21,.07,-.14,dark);
 }
 box(worker,.44,.42,.28,0,.94,.3,trim);
 // Horizontal ring marks the physical balloon range. It follows the worker.
 ringMaterial=new THREE.MeshBasicMaterial({
  color:0xf2b766,transparent:true,opacity:.94,
  depthWrite:false,side:THREE.DoubleSide
 });
 const r=new THREE.Mesh(new THREE.RingGeometry(HIT_RADIUS-.065,HIT_RADIUS,64),ringMaterial);
 r.rotation.x=-Math.PI/2;
 r.renderOrder=2;r.position.y=.07;
 hitRing=new THREE.Group();hitRing.add(r);
 const innerMat=new THREE.MeshBasicMaterial({color:0xffce89,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
 const ring2=new THREE.Mesh(new THREE.RingGeometry(HIT_RADIUS-.27,HIT_RADIUS-.25,64),innerMat);
 ring2.rotation.x=-Math.PI/2;ring2.position.y=.075;ring2.renderOrder=2;hitRing.add(ring2);
 // Short radial markings improve legibility as the floor gets darker.
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  const mark=box(hitRing,.065,.018,.22,Math.cos(angle)*(HIT_RADIUS-.17),.077,Math.sin(angle)*(HIT_RADIUS-.17),ringMaterial,false);
  mark.rotation.y=-angle+Math.PI/2;mark.renderOrder=2;
 }
 scene.add(hitRing);
 worker.position.set(player.x,0,player.z);
 hitRing.position.set(player.x,0,player.z);
 // No first-person camera glove; hits come from the character.
 glove=null;
 scene.add(camera);
}
function showRenderingFailure(){
 state='unavailable';stage.dataset.state=state;
 errorBox.hidden=false;start.disabled=true;pause.disabled=true;
 showStatus('3D rendering unavailable on this browser.');
}
async function initialize(){
 try{
  THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  scene=new THREE.Scene();scene.background=new THREE.Color(0x14201d);
  scene.fog=new THREE.FogExp2(0x14201d,.032);
  camera=new THREE.PerspectiveCamera(47,1,.1,55);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xc5ddde,0x554639,2.0));
  const key=new THREE.SpotLight(0xffc58b,95,22,Math.PI/3,.65,1);
  key.position.set(-2,5.8,3.0);key.target.position.set(0,1.4,-.5);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0008;
  key.shadow.camera.near=.5;key.shadow.camera.far=20;
  scene.add(key,key.target);
  const fill=new THREE.PointLight(0x7bccc1,24,13,2);
  fill.position.set(4,4,1.2);scene.add(fill);
  redLight=new THREE.PointLight(0xf8402d,23,10,2);
  redLight.position.set(-3.4,4.65,-3.0);scene.add(redLight);
  warningLight=new THREE.PointLight(0xffbd5f,0,6,2);
  warningLight.position.set(0,.8,.3);scene.add(warningLight);
  raycaster=new THREE.Raycaster();ndc=new THREE.Vector2();
  buildRoom();buildBalloon();buildWorker();buildLevel();setDimensions();
  if('ResizeObserver' in window)new ResizeObserver(setDimensions).observe(stage);
  else window.addEventListener('resize',setDimensions,{passive:true});
  ready=true;stage.dataset.renderer='webgl';stage.dataset.state='ready';
  balloon.position.set(0,3.15,0);renderScene(performance.now());
  raf=requestAnimationFrame(frameLoop);
 }catch(error){
  console.warn('Cargo Bay 3D setup unavailable:',error);
  showRenderingFailure();
 }
}
function setDimensions(){
 if(!renderer||!camera)return;
 const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
 camera.aspect=w/h;camera.fov=w<460?67:64;
 camera.updateProjectionMatrix();
 syncCamera();
 renderer.setSize(w,h,false);
}
function renderScene(now){
 if(!renderer||!scene)return;
 syncCamera();
 if(worker){
  worker.position.set(player.x,player.feet,player.z);
  worker.rotation.y=player.yaw;
  worker.visible=true;
 }
 if(balloon){
  balloon.position.set(physics.x,physics.y,physics.z);
  balloon.rotation.z=Math.sin(now*.0016)*.065+physics.vx*.012;
  balloon.rotation.x=Math.sin(now*.0011)*.04;
  shadow.position.x=physics.x;shadow.position.z=physics.z;
  shadow.scale.setScalar(1+(5.0-physics.y)*.07);
  shadow.material.opacity=clamp(.32-(physics.y-1)*.055,.09,.35);
  const projected=balloon.position.clone().project(camera);
  stage.dataset.hitX=String(Math.round((projected.x+1)*host.clientWidth/2));
  stage.dataset.hitY=String(Math.round((1-projected.y)*host.clientHeight/2));
 }
 if(hitRing){
  hitRing.position.set(player.x,0,player.z);
  const inside=inRange();
  ringMaterial.color.setHex(inside?0x9bf5ad:0xf4ae6b);
  rangeLabel.textContent=awaitFirstHit?'HIT BALLOON FIRST · THEN MOVE':inside?'AIM AT BALLOON · CLICK TO HIT':'OUT OF RANGE · MOVE CLOSER';
  rangeLabel.classList.toggle('is-near',inside);
  stage.dataset.inRange=String(inside);
  stage.dataset.playerX=player.x.toFixed(2);
  stage.dataset.playerZ=player.z.toFixed(2);
  stage.dataset.playerYaw=player.yaw.toFixed(3);
  stage.dataset.playerPitch=player.pitch.toFixed(3);
  stage.dataset.cameraHeight=camera.position.y.toFixed(2);
  stage.dataset.view='third-person';
  stage.dataset.movementLocked=String(awaitFirstHit);
  stage.dataset.ringRadius=String(HIT_RADIUS);
 }
 if(redLight)redLight.intensity=17+Math.sin(now*.0038)*6;
 if(warningLight)warningLight.intensity=state==='playing'&&physics.y<1.55?15:0;
 renderer.render(scene,camera);
 if(state==='playing'||state==='paused'){
  stage.dataset.x=physics.x.toFixed(2);
  stage.dataset.y=physics.y.toFixed(2);
  stage.dataset.z=physics.z.toFixed(2);
  stage.dataset.vy=physics.vy.toFixed(2);
 }
}
function frameLoop(now){
 raf=requestAnimationFrame(frameLoop);
 const dt=lastFrame?clamp((now-lastFrame)/1000,0,.04):0;lastFrame=now;
 if(state==='playing'){
  updateHazards(now);movePlayer(dt);
  if(state==='playing'&&!awaitFirstHit)advancePhysics(dt,now);
 }
 renderScene(now);
}
function resetPhysics(){
 physics.x=0;physics.y=3.15;physics.z=0;
 physics.vx=.58;physics.vy=.8;physics.vz=.24;
}
function advancePhysics(dt,now){
 if(dt<=0)return;
 const difficulty=Math.min(levelHits,9);
 physics.vy-=(3.7+level*.28+difficulty*.07)*dt;
 physics.vx+=(Math.sin(now*.00155)*.18)*dt;
 physics.vz+=(Math.cos(now*.0009)*.12)*dt;
 physics.x+=physics.vx*dt;
 physics.y+=physics.vy*dt;
 physics.z+=physics.vz*dt;
 if(physics.x>3.75){physics.x=3.75;physics.vx=-Math.abs(physics.vx)*.82;}
 if(physics.x< -3.75){physics.x=-3.75;physics.vx=Math.abs(physics.vx)*.82;}
 if(physics.z>1.65){physics.z=1.65;physics.vz=-Math.abs(physics.vz)*.84;}
 if(physics.z< -1.65){physics.z=-1.65;physics.vz=Math.abs(physics.vz)*.84;}
 if(physics.y>5.28){physics.y=5.28;physics.vy=-Math.abs(physics.vy)*.4;}
 const danger=physics.y<1.65&&physics.vy<0;
 warning.classList.toggle('is-visible',danger);
 telemetry.textContent=danger?'CRITICAL · FLOOR NEAR':'AIRBORNE · CONTAINED';
 if(physics.y<=.72){
  physics.y=.72;renderScene(now);finishRun('balloon');
 }
}
function recordSound(kind){
 if(!enabled)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  if(!context)context=new C();
  if(context.state==='suspended')void context.resume();
  const time=context.currentTime;
  const osc=context.createOscillator(),gain=context.createGain();
  osc.type=kind==='floor'?'sawtooth':'triangle';
  osc.frequency.setValueAtTime(kind==='floor'?175:230,time);
  osc.frequency.exponentialRampToValueAtTime(kind==='floor'?58:420,time+.13);
  gain.gain.setValueAtTime(.0001,time);
  gain.gain.exponentialRampToValueAtTime(kind==='floor'?.10:.075,time+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,time+.21);
  osc.connect(gain);gain.connect(context.destination);osc.start(time);osc.stop(time+.22);
 }catch{}
}
function recordBest(){
 if(score<=best)return;best=score;bestLabel.textContent=displayNumber(best);
 try{localStorage.setItem(BEST_KEY,String(best));}catch{}
}
function flashHit(){
 word.textContent=score%10===0?'EXCELLENT':score%5===0?'GOOD HIT':'+01';
 word.classList.remove('is-visible');void word.offsetWidth;
 word.classList.add('is-visible');
 clearTimeout(hitLabelTimer);
 hitLabelTimer=setTimeout(()=>word.classList.remove('is-visible'),620);
}
function bop(hit){
 if(state!=='playing'||!ready||!hit?.point||!hit?.rayDirection)return;
 if(!inRange()){
  showStatus('OUT OF RANGE · MOVE CLOSER TO THE BALLOON.');
  return;
 }
 const now=performance.now();
 // Pointer events and synthetic clicks must not double-score a single action.
 if(now-lastBop<190)return;
 lastBop=now;
 if(awaitFirstHit){
  awaitFirstHit=false;
  releaseMovement(); // Discard any movement buttons pressed before the first hit.
 }
 setScore(score+1);levelHits++;hudLevel();recordBest();
 // Directional impact: push the balloon away along the line of the swing,
 // with side spin from which half of its visible surface the player struck.
 // No random left/right drift is added by a hit.
 const center=new THREE.Vector3();
 balloon.getWorldPosition(center);
 const contact=hit.point.clone().sub(center);
 const away=new THREE.Vector3(hit.rayDirection.x,0,hit.rayDirection.z);
 if(away.lengthSq()<.0001){
  camera.getWorldDirection(away);away.y=0;
 }
 away.normalize();
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
 right.y=0;right.normalize();
 // Striking the left side kicks right; striking the right side kicks left.
 const side=clamp(contact.dot(right)/.52,-1,1);
 const push=away.multiplyScalar(1.55+level*.045).addScaledVector(right,-side*1.20);
 physics.vx=clamp(push.x+physics.vx*.12,-2.8,2.8);
 physics.vz=clamp(push.z+physics.vz*.12,-2.8,2.8);
 // Preserve enough vertical lift for the keep-it-up game; bottom hits lift
 // harder and top hits lift less, so where you strike matters vertically too.
 const lowHit=clamp(-contact.y/.64,-1,1);
 physics.vy=clamp(4.08-level*.035+lowHit*.48+hit.rayDirection.y*.25,3.35,4.9);
 balloon.scale.set(1.14,.83,1.06);
 if(glove){glove.position.z=-1.68;glove.rotation.x=-.42;}
 clearTimeout(hitTimer);
 hitTimer=setTimeout(()=>{if(balloon)balloon.scale.set(1,1,1);if(glove){glove.position.z=-1.25;glove.rotation.x=0;}},135);
 warning.classList.remove('is-visible');
 telemetry.textContent='OBJECT BOUNCED · '+displayNumber(score);
 flashHit();recordSound('hit');
 showStatus(levelHits>=LEVELS[level][1]?'EXIT UNLOCKED · REACH THE GATE.':'BALLOON SAVED · '+(LEVELS[level][1]-levelHits)+' MORE HITS.');
}
function clearLevel(){
 if(state!=='playing')return;
 state=level===9?'won':'cleared';stage.dataset.state=state;releaseMovement();mouseUnlock();
 pause.disabled=true;select.disabled=false;
 if(level+2>unlocked&&unlocked<10){unlocked=level+2;try{localStorage.setItem(LEVEL_PROGRESS,String(unlocked));}catch{}}
 if(state==='won')stage.dataset.allCleared='true';
 refreshLevels();
 kicker.textContent='LEVEL '+String(level+1).padStart(2,'0')+' // CLEARED';
 title.textContent=state==='won'?'ALL LEVELS CLEARED!':'LEVEL CLEARED.';
 description.textContent=state==='won'?'All ten obby courses complete! Replay any level.':'Checkpoint saved! Level '+(level+2)+' is now unlocked.';
 start.innerHTML=(state==='won'?'REPLAY ALL LEVELS':'NEXT LEVEL '+String(level+2).padStart(2,'0'))+' <span aria-hidden="true">↗</span>';
 overlay.hidden=false;showStatus('COURSE CLEARED · CHECKPOINT SAVED.');start.focus({preventScroll:true});
}
function finishRun(reason='balloon'){
 if(state!=='playing')return;
 state='over';stage.dataset.state=state;releaseMovement();mouseUnlock();
 pause.disabled=true;select.disabled=false;pause.textContent='Ⅱ PAUSE';
 warning.classList.remove('is-visible');recordSound('floor');
 kicker.textContent='LEVEL '+String(level+1).padStart(2,'0')+' // FAILED';
 title.textContent=reason==='obstacle'?'OBSTACLE HIT.':'BALLOON DOWN.';
 description.textContent='Retry level '+(level+1)+' without losing any unlocked courses. You scored '+levelHits+' of '+LEVELS[level][1]+' required hits.';
 start.innerHTML='RETRY LEVEL '+String(level+1).padStart(2,'0')+' <span aria-hidden="true">↗</span>';
 overlay.hidden=false;showStatus('LEVEL FAILED · CHECKPOINT RETAINED.');start.focus({preventScroll:true});
}
function begin(){
 if(!ready)return;
 if(state==='paused'){
  releaseMovement();state='playing';stage.dataset.state=state;overlay.hidden=true;
  pause.disabled=false;select.disabled=true;pause.textContent='Ⅱ PAUSE';
  lastFrame=0;stage.focus({preventScroll:true});mouseLock();return;
 }
 if(!['ready','over','cleared','won'].includes(state))return;
 if(state==='cleared'){level++;checkpointScore=score;}
 else if(state==='won'){level=0;checkpointScore=0;setScore(0);}
 else if(state==='over'){setScore(checkpointScore);}
 else{checkpointScore=0;setScore(0);}
 levelHits=0;lastBop=0;awaitFirstHit=true;releaseMovement();
 player.x=0;player.z=2.2;player.yaw=0;player.pitch=.04;player.feet=0;player.vy=0;player.grounded=true;
 resetPhysics();buildLevel();refreshLevels();syncCamera();
 state='playing';stage.dataset.state=state;overlay.hidden=true;
 pause.disabled=false;select.disabled=true;pause.textContent='Ⅱ PAUSE';
 warning.classList.remove('is-visible');telemetry.textContent='AIRBORNE · CONTAINED';
 showStatus('STAGE '+(level+1)+' READY · HIT THE BALLOON TO UNLOCK WASD AND JUMP.');
 stage.focus({preventScroll:true});lastFrame=0;mouseLock();
}
function hold(){
 if(state==='playing'){
  releaseMovement();
  state='paused';stage.dataset.state='paused';mouseUnlock();select.disabled=false;pause.textContent='▶ RESUME';
  kicker.textContent='SHIFT SUSPENDED';title.textContent='ON HOLD.';
  description.textContent='The balloon and moving hazards are paused. Resume when ready. Space jumps but never hits the balloon.';
  start.innerHTML='RESUME SHIFT <span aria-hidden="true">↗</span>';overlay.hidden=false;
  warning.classList.remove('is-visible');showStatus('SHIFT PAUSED · NO PENALTY');
  start.focus({preventScroll:true});
 }else if(state==='paused')begin();
}
function projectHit(event){
 if(!ready||state!=='playing'||!balloonBody)return null;
 const rect=renderer.domElement.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0)return null;
 // In FPS mode the crosshair at the CENTER of the canvas is the aiming point.
 // Otherwise cast through the exact click/touch position on the canvas.
 if(document.pointerLockElement===stage)ndc.set(0,0);
 else{
  const x=(event.clientX-rect.left)/rect.width;
  const y=(event.clientY-rect.top)/rect.height;
  if(x<0||x>1||y<0||y>1)return null;
  ndc.set(x*2-1,1-y*2);
 }
 camera.updateMatrixWorld(true);
 balloon.updateMatrixWorld(true);
 raycaster.setFromCamera(ndc,camera);
 const impact=raycaster.intersectObject(balloonBody,false)[0];
 if(!impact)return null;
 return {point:impact.point.clone(),rayDirection:raycaster.ray.direction.clone()};
}
stage.addEventListener('pointerdown',event=>{
 if(!moving()||event.target.closest?.('.cargo-touch-controls, .cargo-jump, .cargo-overlay'))return;
 if(event.pointerType==='mouse'&&event.button!==0&&event.button!==2)return;
 const hit=event.button===0?projectHit(event):null;
 if(hit&&inRange()){
  event.preventDefault();
  bop(hit);return;
 }
 if(hit&&!inRange()){
  showStatus('BALLOON HIT MISSED · WALK CLOSER TO ENTER YOUR RANGE RING.');
  return;
 }
 // Click scenery to capture FPS mouse look; touch retains swipe.
 if(document.pointerLockElement===stage)return;
 if(event.pointerType==='mouse'&&stage.requestPointerLock){event.preventDefault();mouseLock();return;}
 event.preventDefault();
 lookDrag={id:event.pointerId,x:event.clientX,y:event.clientY};
 try{host.setPointerCapture?.(event.pointerId);}catch{/* Synthetic and unsupported pointers still drag safely. */}
});
host.addEventListener('pointermove',event=>{
 if(document.pointerLockElement===stage)return;
 if(lookDrag?.id===event.pointerId){
  const dx=event.clientX-lookDrag.x,dy=event.clientY-lookDrag.y;
  lookDrag.x=event.clientX;lookDrag.y=event.clientY;
  player.yaw-=dx*(event.pointerType==='touch'?.006:.0046);
  player.pitch=clamp(player.pitch-dy*(event.pointerType==='touch'?.005:.0038),-.98,1.08);
  syncCamera();
  stage.dataset.playerYaw=player.yaw.toFixed(3);
  stage.dataset.playerPitch=player.pitch.toFixed(3);
  event.preventDefault();return;
 }
 const hitting=Boolean(projectHit(event))&&inRange();
 cursor.classList.toggle('is-hover',hitting);
 host.style.cursor=hitting?'pointer':'crosshair';
},{passive:false});
document.addEventListener('mousemove',event=>{
 if(document.pointerLockElement!==stage||!moving())return;
 player.yaw-=event.movementX*.0029;
 player.pitch=clamp(player.pitch-event.movementY*.00265,-1.25,1.25);
 syncCamera();cursor.classList.toggle('is-hover',Boolean(projectHit(event))&&inRange());
});
document.addEventListener('pointerlockchange',()=>{
 stage.dataset.mouseLocked=String(document.pointerLockElement===stage);
 if(document.pointerLockElement!==stage&&state==='playing')hold();
});
const stopLook=event=>{if(lookDrag?.id===event.pointerId)lookDrag=null;};
host.addEventListener('pointerup',stopLook);
host.addEventListener('pointercancel',stopLook);
host.addEventListener('lostpointercapture',stopLook);
host.addEventListener('contextmenu',event=>event.preventDefault());
host.addEventListener('pointerleave',()=>{cursor.classList.remove('is-hover');host.style.cursor='crosshair';});
// Movement only. The Space bar and arrow keys NEVER hit the balloon.
document.addEventListener('keydown',event=>{
 if(!moving()||event.altKey||event.ctrlKey||event.metaKey)return;
 if(document.getElementById('gameInfoModal')?.hidden===false)return;
 const tag=document.activeElement?.tagName;
 if(tag&&/^(INPUT|TEXTAREA|SELECT)$/.test(tag))return;
 const key=event.key.toLowerCase();
 if(['w','a','s','d'].includes(key)){
  event.preventDefault();
  if(!event.repeat&&!awaitFirstHit)held.add(key);
 }else if(event.code==='Space'){
  event.preventDefault();if(!event.repeat)jump(); // Space jumps only, no balloon hit.
 }
});
document.addEventListener('keyup',event=>held.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{releaseMovement();if(state==='playing')hold();});
document.querySelectorAll('[data-move]').forEach(button=>{
 const key=button.dataset.move;
 const up=e=>{activeTouches.delete(e.pointerId);button.classList.remove('is-pressed');};
 button.addEventListener('pointerdown',e=>{
  if(!moving()||awaitFirstHit)return;
  e.preventDefault();button.setPointerCapture?.(e.pointerId);
  activeTouches.set(e.pointerId,key);button.classList.add('is-pressed');
 });
 button.addEventListener('pointerup',up);
 button.addEventListener('pointercancel',up);
 button.addEventListener('lostpointercapture',up);
});
function chooseStage(i){
 if(!Number.isInteger(i)||i<0||i>=unlocked||!['ready','paused','over','cleared','won'].includes(state))return false;
 level=i;levelHits=0;checkpointScore=0;setScore(0);state='ready';stage.dataset.state=state;
 awaitFirstHit=true;mouseUnlock();previewLevel();buildLevel();overlay.hidden=false;
 showStatus('STAGE '+(i+1)+' SELECTED · PRESS BEGIN TO PLAY.');return true;
}
stageTrack.addEventListener('click',event=>{
 const b=event.target.closest?.('[data-stage]');if(!b)return;
 const i=Number(b.dataset.stage);
 if(i>=unlocked){showStatus('STAGE '+(i+1)+' LOCKED · COMPLETE EARLIER STAGES FIRST.');return;}
 if(state==='playing'){showStatus('PAUSE THE GAME TO SWITCH STAGES.');return;}
 chooseStage(i);
});
select.addEventListener('change',()=>{
 if(!chooseStage(Number(select.value)))select.value=String(level);
});
full.addEventListener('click',async()=>{
 const root=stage.closest('.cargo-console');
 try{if(document.fullscreenElement===root)await document.exitFullscreen();else await root.requestFullscreen();}
 catch{showStatus('FULLSCREEN IS NOT AVAILABLE IN THIS BROWSER.');}
});
document.addEventListener('fullscreenchange',()=>{
 const active=document.fullscreenElement===stage.closest('.cargo-console');
 full.textContent=active?'⛶ EXIT FULLSCREEN':'⛶ FULLSCREEN';full.setAttribute('aria-pressed',String(active));setDimensions();
});
document.getElementById('balloonJump')?.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();jump();});
start.addEventListener('click',begin);
pause.addEventListener('click',hold);
sound.addEventListener('click',()=>{
 enabled=!enabled;
 sound.textContent=enabled?'♫ AUDIO ON':'♫ AUDIO OFF';
 sound.setAttribute('aria-pressed',String(enabled));
 try{localStorage.setItem(SOUND_KEY,enabled?'on':'off');}catch{}
});
document.getElementById('gameInfoBtn')?.addEventListener('click',()=>{if(state==='playing')hold();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')hold();});
window.addEventListener('pagehide',()=>{if(state==='playing')hold();lastFrame=0;});
window.addEventListener('pageshow',()=>{lastFrame=0;});
previewLevel();await initialize();
})();
