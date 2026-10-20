/* KEEP IT UP: CARGO BAY
 * Outdoor third-person vertical climbing obby using Three.js.
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
 ['Trailhead',2],['Hurdle Hill',3],['Skyward Steps',3],['Summit Sweep',4],
 ['Ridge Runners',4],['Pinecrest Rise',5],['Windy Way',5],
 ['Cliffhanger',6],['Above the Clouds',6],['Final Ascent',7]
];
const COURSE_HALF_WIDTH=2.35,JUMP_POWER=8.2,JUMP_GRAVITY=12.2;
let courseSegments=[],courseEndZ=-17.15,courseTopY=3,courseRises=3;
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
const HIT_RADIUS=2.9, WALK_SPEED=4.3;
const player={x:0,z:2.2,yaw:0,pitch:.025,groundY:0,feet:0,vy:0,grounded:true};
const CAMERA_FOLLOW_DISTANCE=3.8, CAMERA_FOLLOW_HEIGHT=3.25;
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
 goalText.textContent=levelHits+' / '+c[1]+' HITS · CLIMB TO SUMMIT';
 gateText.textContent=levelHits>=c[1]?'SUMMIT OPEN · REACH THE TOP':'SUMMIT LOCKED · '+(c[1]-levelHits)+' HITS';
 levelName.textContent='LEVEL '+String(level+1).padStart(2,'0')+' · '+c[0].toUpperCase();
 statusLevel.textContent='COURSE '+String(level+1).padStart(2,'0')+' / 10';
 if(exitMat)exitMat.color.setHex(levelHits>=c[1]?0x74efa6:0xe9a16a);
 stage.dataset.level=String(level+1);stage.dataset.levelHits=String(levelHits);
}
function previewLevel(){
 kicker.textContent='STAGE '+String(level+1).padStart(2,'0')+' // '+LEVELS[level][0].toUpperCase();
 title.textContent=LEVELS[level][0].toUpperCase()+'.';
 description.textContent='Hit the balloon to unlock movement. Keep it flying while climbing ramps and jumping over raised hurdles. Reach the high summit gate. No surrounding walls or wall-bounces.';
 start.innerHTML='BEGIN STAGE '+String(level+1).padStart(2,'0')+' <span aria-hidden="true">↗</span>';
 refreshLevels();hudLevel();
}
function groundAt(z){
 if(!courseSegments.length)return 0;
 for(const seg of courseSegments){
  if(z<=seg.front&&z>=seg.back){
   const t=(seg.front-z)/(seg.front-seg.back);
   return seg.y0+(seg.y1-seg.y0)*t;
  }
 }
 return z>courseSegments[0].front?0:courseTopY;
}
function buildLevel(){
 if(!scene)return;
 if(levelWorld){
  scene.remove(levelWorld);
  const geos=new Set(),materials=new Set();
  levelWorld.traverse(o=>{
   if(o.geometry)geos.add(o.geometry);
   if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));
  });
  geos.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose?.();m.dispose();});
 }
 levelWorld=new THREE.Group();scene.add(levelWorld);
 staticHazards=[];movingHazards=[];flashHazards=[];courseSegments=[];
 const stages=[0x75d4b7,0xd4ad63,0x8fccdc,0xe6b48a,0xc2c875,
  0xa8cbaa,0x83bfcc,0xe9bf91,0xcebaeb,0xffb27c];
 const tint=stages[level];
 const plank=color(0xa5a08a,.94,.12),edge=color(tint,.58,.15,{emissive:tint,emissiveIntensity:.28});
 const shadowTrim=color(0x43514a,.91,.19);
 const bar=color(0xe85d47,.68,.08,{emissive:0x832c19,emissiveIntensity:.35});
 const white=color(0xf8e6d1,.86,.09);
 const width=COURSE_HALF_WIDTH*2,rise=.89+level*.065;
 courseRises=3+Math.floor(level/2);
 courseTopY=courseRises*rise;
 let z=-.65;
 courseSegments.push({front:3.8,back:z,y0:0,y1:0});
 for(let i=0;i<courseRises;i++){
  const from=i*rise,to=(i+1)*rise;
  const rampEnd=z-2.5;
  courseSegments.push({front:z,back:rampEnd,y0:from,y1:to});
  z=rampEnd;
  const flatEnd=z-3;
  courseSegments.push({front:z,back:flatEnd,y0:to,y1:to});
  z=flatEnd;
 }
 courseEndZ=z;
 courseSegments.forEach((seg,i)=>{
  const length=seg.front-seg.back,change=seg.y1-seg.y0;
  const ramp=Math.abs(change)>.01,angle=Math.atan2(change,length);
  const deck=box(levelWorld,width,.32,Math.hypot(length,change),
   0,(seg.y0+seg.y1)/2-.17,(seg.front+seg.back)/2,plank,false);
  if(ramp)deck.rotation.x=angle;
  const edgeBand=box(levelWorld,width,.075,.09,0,seg.y0+.02,seg.front-.11,edge,false);
  for(const x of [-width/2,width/2]){
   const rim=box(levelWorld,.09,.12,Math.hypot(length,change),
    x,(seg.y0+seg.y1)/2+.015,(seg.front+seg.back)/2,shadowTrim,false);
   if(ramp)rim.rotation.x=angle;
  }
  if(i%2===0){
   const centerZ=(seg.front+seg.back)/2;
   for(const x of [-1.7,1.7]){
    const h=(seg.y0+seg.y1)/2+12;
    box(levelWorld,.38,h,.43,x,(seg.y0+seg.y1)/4-6,centerZ,shadowTrim,false);
    box(levelWorld,.56,.18,.56,x,(seg.y0+seg.y1)/2-.3,centerZ,edge,false);
   }
  }
 });
 const hurdleCount=Math.min(courseRises,1+Math.floor(level*.7));
 for(let i=0;i<hurdleCount;i++){
  const k=Math.round(i*(courseRises-1)/Math.max(1,hurdleCount-1));
  const landing=courseSegments[2*k+2],y=landing.y0;
  const zH=landing.front-1.45,height=.75+level*.045,w=3.25;
  const x=level>=4&&i%2?-.22:.22;
  for(const side of [-1,1]){
   box(levelWorld,.15,height,.2,x+side*w/2,y+height/2,zH,white);
   box(levelWorld,.38,.10,.38,x+side*w/2,y+.035,zH,shadowTrim,false);
  }
  box(levelWorld,w+.1,.19,.24,x,y+height,zH,bar);
  for(let stripe=-1;stripe<=1;stripe++)
   box(levelWorld,.22,.198,.25,x+stripe*.82,y+height,zH,white,false);
  staticHazards.push({x,z:zH,w:w+.12,d:.29,y,height});
 }
 if(level>=3){
  for(let i=0;i<(level>=7?2:1);i++){
   const section=Math.max(0,courseRises-2-i*2);
   const landing=courseSegments[2*section+2];
   const zH=landing.front-2.3,y=landing.y0;
   box(levelWorld,.35,.85,.35,0,y+.425,zH,shadowTrim);
   const arm=box(levelWorld,3.4,.24,.2,0,y+.85,zH,bar);
   movingHazards.push({x:0,z:zH,y,length:3.4,angle:0,arm,speed:1.1+level*.13,phase:i*1.6});
  }
 }
 exitMat=new THREE.MeshBasicMaterial({color:0xe9a16a});
 const gateZ=courseEndZ+.43,finishY=courseTopY;
 for(const x of [-1.56,1.56])box(levelWorld,.2,3.15,.25,x,finishY+1.58,gateZ,exitMat,false);
 box(levelWorld,3.35,.2,.3,0,finishY+3.16,gateZ,exitMat,false);
 box(levelWorld,3.05,.07,.45,0,finishY+.075,gateZ,exitMat,false);
 const marker=new THREE.Mesh(new THREE.PlaneGeometry(3,.9),
  signage('SUMMIT '+String(level+1).padStart(2,'0'),LEVELS[level][0].toUpperCase()));
 marker.position.set(0,finishY+4.0,gateZ-.10);levelWorld.add(marker);
 hudLevel();
}
function updateHazards(now){
 const t=now/1000;
 for(const h of movingHazards){h.angle=t*h.speed+h.phase;h.arm.rotation.y=h.angle;}
}
function checkCourse(){
 if(!moving()||awaitFirstHit)return;
 if(Math.abs(player.x)>COURSE_HALF_WIDTH-.12){finishRun('fall');return;}
 const foot=player.groundY+player.feet;
 for(const h of staticHazards){
  if(Math.abs(player.x-h.x)<h.w/2+.19&&Math.abs(player.z-h.z)<h.d/2+.24&&
     foot<h.y+h.height+.07){finishRun('obstacle');return;}
 }
 for(const h of movingHazards){
  const x=player.x-h.x,z=player.z-h.z;
  if(Math.abs(x*Math.cos(h.angle)-z*Math.sin(h.angle))<h.length/2+.18&&
     Math.abs(x*Math.sin(h.angle)+z*Math.cos(h.angle))<.31&&
     foot<h.y+1.14){finishRun('obstacle');return;}
 }
 if(player.z<courseEndZ+.75&&Math.abs(player.x)<1.42){
  if(levelHits>=LEVELS[level][1])clearLevel();
  else if(!stage.dataset.gateMessageAt||performance.now()-Number(stage.dataset.gateMessageAt)>1300){
   stage.dataset.gateMessageAt=String(performance.now());
   showStatus('SUMMIT LOCKED · HIT THE BALLOON '+(LEVELS[level][1]-levelHits)+' MORE TIMES.');
  }
 }
}
function jump(){if(moving()&&!awaitFirstHit&&player.grounded){player.grounded=false;player.vy=JUMP_POWER;}}
function inRange(){
 return Math.hypot(physics.x-player.x,physics.z-player.z)<=HIT_RADIUS;
}
function movePlayer(dt){
 if(!moving()||dt<=0||awaitFirstHit)return;
 let dx=(held.has('d')?1:0)-(held.has('a')?1:0);
 let dz=(held.has('s')?1:0)-(held.has('w')?1:0);
 for(const key of activeTouches.values()){
  dx+=(key==='d'?1:key==='a'?-1:0);
  dz+=(key==='s'?1:key==='w'?-1:0);
 }
 const length=Math.hypot(dx,dz);
 if(length){
  const side=dx/length,forward=-dz/length;
  const worldX=side*Math.cos(player.yaw)-forward*Math.sin(player.yaw);
  const worldZ=side*Math.sin(player.yaw)-forward*Math.cos(player.yaw);
  player.x=clamp(player.x+worldX*WALK_SPEED*dt,-7,7);
  player.z=clamp(player.z+worldZ*WALK_SPEED*dt,courseEndZ-1,4.4);
 }
 player.groundY=groundAt(player.z);
 if(!player.grounded){
  player.vy-=JUMP_GRAVITY*dt;player.feet+=player.vy*dt;
  if(player.feet<=0){player.feet=0;player.vy=0;player.grounded=true;}
 }
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
 // Wide, open outdoor valley with decorative hills far below the obby.
 room=new THREE.Group();scene.add(room);
 const grass=color(0x72976c,.97,.02),dirt=color(0x887a60,.96,.03);
 const mountainA=color(0x7e9f84,.95,.03),mountainB=color(0x91aa95,.93,.03);
 const snow=color(0xe0ebe5,.97,.0);
 box(room,170,.9,170,0,-12.35,-18,grass,false);
 box(room,170,2.2,170,0,-13.9,-18,dirt,false);
 // Background ridgelines sit outside the climb: no solid enclosing walls.
 for(let i=0;i<19;i++){
  const side=i%2===0?-1:1;
  const x=side*(12+(i*7%24)),z=-52+(i*13%85);
  const h=7+(i*7%14);
  const peak=new THREE.Mesh(new THREE.ConeGeometry(5+(i%4),h,5),i%3?mountainA:mountainB);
  peak.position.set(x,-11.8+h/2,z);room.add(peak);
  if(i%3===0){
   const cap=new THREE.Mesh(new THREE.ConeGeometry(1.5,h*.17,5),snow);
   cap.position.set(x,-11.8+h*.92,z);room.add(cap);
  }
 }
 // Scattered trees and stones add outdoor depth without stopping the player.
 const trunk=color(0x6a5645,.98,.0),needle=color(0x446f58,.93,.03),rock=color(0x87908a,.93,.02);
 for(let i=0;i<31;i++){
  const side=i%2===0?-1:1;
  const x=side*(7+(i*5%13)),z=5-i*2.15;
  const treeH=2.2+(i%4)*.7;
  box(room,.28,treeH*.45,.29,x,-11.6+treeH*.22,z,trunk,false);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(treeH*.41,treeH,6),needle);
  cone.position.set(x,-11.4+treeH*.68,z);room.add(cone);
  if(i%4===0){
   const boulder=new THREE.Mesh(new THREE.DodecahedronGeometry(.8+(i%3)*.2,0),rock);
   boulder.position.set(x+2,-11.55,z-1.5);boulder.scale.y=.65;room.add(boulder);
  }
 }
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
 hitRing.position.set(player.x,player.groundY,player.z);
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
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9ecce6);
  scene.fog=new THREE.FogExp2(0x9ecce6,.0085);
  camera=new THREE.PerspectiveCamera(47,1,.1,135);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe7f3ff,0x628462,2.6));
  const key=new THREE.DirectionalLight(0xffe6b4,3.25);
  key.position.set(-12,24,11);key.target.position.set(0,2,-14);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0008;
  key.shadow.camera.near=1;key.shadow.camera.far=100;
  key.shadow.camera.left=-25;key.shadow.camera.right=25;
  key.shadow.camera.top=25;key.shadow.camera.bottom=-45;
  scene.add(key,key.target);
  const fill=new THREE.PointLight(0x9ac4d9,22,24,2);
  fill.position.set(4,4,1.2);scene.add(fill);
  redLight=new THREE.PointLight(0xf4ad77,14,16,2);
  redLight.position.set(-3.4,4.65,-3.0);scene.add(redLight);
  warningLight=new THREE.PointLight(0xffc95f,0,7,2);
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
  worker.position.set(player.x,player.groundY+player.feet,player.z);
  worker.rotation.y=player.yaw;
  worker.visible=true;
 }
 if(balloon){
  balloon.position.set(physics.x,physics.y,physics.z);
  balloon.rotation.z=Math.sin(now*.0016)*.065+physics.vx*.012;
  balloon.rotation.x=Math.sin(now*.0011)*.04;
  shadow.position.x=physics.x;shadow.position.z=physics.z;
  shadow.position.y=groundAt(physics.z)+.045;
  shadow.scale.setScalar(1+(5.0-(physics.y-groundAt(physics.z)))*.07);
  shadow.material.opacity=clamp(.32-(physics.y-1)*.055,.09,.35);
  const projected=balloon.position.clone().project(camera);
  stage.dataset.hitX=String(Math.round((projected.x+1)*host.clientWidth/2));
  stage.dataset.hitY=String(Math.round((1-projected.y)*host.clientHeight/2));
 }
 if(hitRing){
  hitRing.position.set(player.x,player.groundY,player.z);
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
  stage.dataset.elevation=player.groundY.toFixed(2);
  stage.dataset.finishElevation=courseTopY.toFixed(2);
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
 physics.vx=0;physics.vy=0;physics.vz=0;
}
function advancePhysics(dt,now){
 if(dt<=0)return;
 const difficulty=Math.min(levelHits,9);
 // Balloon floats freely: NO wall reflections or artificial side bouncing.
 const grav=2.9+level*.075+difficulty*.048;
 physics.vy-=grav*dt;
 physics.vx*=Math.pow(.982,dt*60);
 physics.vz*=Math.pow(.985,dt*60);
 physics.x+=physics.vx*dt;physics.y+=physics.vy*dt;physics.z+=physics.vz*dt;
 const terrain=groundAt(physics.z);
 if(physics.y>terrain+8.5){physics.y=terrain+8.5;physics.vy=Math.min(0,physics.vy);}
 const danger=physics.y<terrain+1.85&&physics.vy<0;
 warning.classList.toggle('is-visible',danger);
 telemetry.textContent=danger?'CRITICAL · PLATFORM NEAR':'AIRBORNE · CLIMBING';
 if(physics.y<=terrain+.69){physics.y=terrain+.69;finishRun('balloon');return;}
 if(Math.abs(physics.x)>COURSE_HALF_WIDTH+2.5||
    physics.z>7||physics.z<courseEndZ-7||
    physics.z>player.z+7){finishRun('lost');}
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
 const push=away.multiplyScalar(3.15+level*.06).addScaledVector(right,-side*1.05);
 physics.vx=clamp(push.x+physics.vx*.12,-4.6,4.6);
 physics.vz=clamp(push.z+physics.vz*.12,-4.6,4.6);
 // Preserve enough vertical lift for the keep-it-up game; bottom hits lift
 // harder and top hits lift less, so where you strike matters vertically too.
 const lowHit=clamp(-contact.y/.64,-1,1);
 physics.vy=clamp(5.1-level*.025+lowHit*.52+hit.rayDirection.y*.28,4.55,5.85);
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
 title.textContent=reason==='obstacle'?'HURDLE HIT.':reason==='fall'?'OFF THE COURSE.':reason==='lost'?'BALLOON LOST.':'BALLOON DOWN.';
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
 player.x=0;player.z=2.2;player.yaw=0;player.pitch=.025;player.groundY=0;player.feet=0;player.vy=0;player.grounded=true;
 resetPhysics();buildLevel();refreshLevels();syncCamera();
 state='playing';stage.dataset.state=state;overlay.hidden=true;
 pause.disabled=false;select.disabled=true;pause.textContent='Ⅱ PAUSE';
 warning.classList.remove('is-visible');telemetry.textContent='AIRBORNE · CONTAINED';
 showStatus('STAGE '+(level+1)+' READY · HIT THE BALLOON, THEN CLIMB THE COURSE.');
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
