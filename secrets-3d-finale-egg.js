/* Nothing Here — original, interactive post-credit egg ending.
 * The existing 134.699s music finale finishes BEFORE this scene starts.
 * One duck lays one egg, waddles off, and leaves an accessible egg to tap.
 */
import * as THREE from "three";

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{const u=clamp(t);return u*u*(3-2*u);};

export function createFinaleEggEnding({
 scene,stage,camera,controls,invalidate,reducedMotion,
 getAnchor,group,spinner,catRig,duck,shader,background
}){
 let phase="idle",startTime=0,crackTime=0,elapsed=0,frameId=0,lastFrame=0;
 let eggRoot=null,eggWhole=null,eggOutline=null,topHalf=null,bottomHalf=null,eggCrack=null,duckShadow=null;
 let eggFracture=null,shellFlakes=[],crackProgress=0,openingProgress=0;
 const shellRadius=new THREE.Vector3(.37,.48,.34);
 const shellSegments=80,shellRows=20,teethCount=40;
 const toothAngles=Array.from({length:teethCount},(_,i)=>
  Math.PI*.49+.054*Math.sin(i*2.31)+.034*Math.sin(i*5.13));
 function seamTheta(phi){
  const t=((phi/(2*Math.PI))%1+1)%1*teethCount;
  const j=Math.floor(t);
  return THREE.MathUtils.lerp(toothAngles[j],
   toothAngles[(j+1)%teethCount],t-j);
 }
 function shellPoint(phi,theta,radius=1){
  return new THREE.Vector3(
   shellRadius.x*Math.sin(theta)*Math.cos(phi)*radius,
   shellRadius.y*Math.cos(theta)*radius,
   shellRadius.z*Math.sin(theta)*Math.sin(phi)*radius);
 }
 // One continuous jagged cut around the ACTUAL ellipsoidal shell:
 // exterior, slightly recessed interior and an ivory-colored cut lip.
 // No flat caps, clean circular cuts or hollow floating spherical slices.
 function crackedShellGeometry(isTop){
  const verts=[],uvs=[],indices=[],groups=[];
  function surface(radius,isInner){
   const first=indices.length,offset=verts.length/3;
   for(let i=0;i<=shellSegments;i++){
    const phi=2*Math.PI*i/shellSegments,seam=seamTheta(phi);
    for(let j=0;j<=shellRows;j++){
     const u=j/shellRows;
     const theta=isTop?seam*u:seam+(Math.PI-seam)*u;
     const p=shellPoint(phi,theta,radius);
     verts.push(p.x,p.y,p.z);uvs.push(i/shellSegments,u);
    }
   }
   const row=shellRows+1;
   for(let i=0;i<shellSegments;i++)for(let j=0;j<shellRows;j++){
    const a=offset+i*row+j,b=a+row,c=a+1,d=b+1;
    if(isInner)indices.push(a,c,b,b,c,d);
    else indices.push(a,b,c,b,d,c);
   }
   groups.push({start:first,count:indices.length-first,
    materialIndex:isInner?1:0});
  }
  surface(1,false);
  surface(.958,true);
  // Bridge the two skins with a physical thin shell lip, instead of
  // leaving the edge as zero-thickness spherical geometry.
  const edgeStart=indices.length,offset=verts.length/3;
  for(let i=0;i<=shellSegments;i++){
   const phi=i*2*Math.PI/shellSegments,theta=seamTheta(phi);
   for(const radius of [1,.958]){
    const p=shellPoint(phi,theta,radius);
    verts.push(p.x,p.y,p.z);uvs.push(i/shellSegments,radius);
   }
  }
  for(let i=0;i<shellSegments;i++){
   const k=offset+i*2;
   indices.push(k,k+1,k+2,k+1,k+3,k+2);
  }
  groups.push({start:edgeStart,count:indices.length-edgeStart,
   materialIndex:2});
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  for(const g of groups)geo.addGroup(g.start,g.count,g.materialIndex);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
 }
 let eggButton=null,endCard=null,origin=null,baseY=0,baseZ=0;
 const legs=duck.userData.walkLegs||[];
 const up=new THREE.Vector3(),projected=new THREE.Vector3();
 const screenRight=new THREE.Vector3();
 const eggFloorHeight=.48;

 function createEgg(){
  const shell=new THREE.MeshStandardMaterial({
   color:0xfff3db,roughness:.72,metalness:0
  });
  const outline=new THREE.MeshBasicMaterial({
   color:0x453b35,side:THREE.BackSide
  });
  eggRoot=new THREE.Group();
  eggRoot.name="Nothing Here mysterious shaking egg";
  scene.add(eggRoot);
  const whole=new THREE.SphereGeometry(1,36,28);
  eggWhole=new THREE.Mesh(whole,shell);
  eggWhole.scale.set(.37,.48,.34);
  eggWhole.castShadow=true;eggRoot.add(eggWhole);
  eggOutline=new THREE.Mesh(whole,outline);
  eggOutline.scale.set(.389,.499,.359);
  eggRoot.add(eggOutline);

  const inside=new THREE.MeshStandardMaterial({
   color:0xe8dac6,roughness:.89,metalness:0,side:THREE.DoubleSide
  });
  const cutEdge=new THREE.MeshStandardMaterial({
   color:0xe0cdb3,roughness:.94,metalness:0,side:THREE.DoubleSide
  });
  function makeHalf(isTop){
   const part=new THREE.Group();
   part.name=isTop?"Jagged top eggshell cap":"Jagged bottom eggshell cup";
   // Pivot at the BACK lip, so the cap peels backward rather than
   // hovering straight upward as a detached circular hemisphere.
   const hinge=new THREE.Vector3(0,.026,-.27);
   if(isTop)part.position.copy(hinge);
   const body=new THREE.Group();
   if(isTop)body.position.copy(hinge).negate();
   part.add(body);
   const mesh=new THREE.Mesh(crackedShellGeometry(isTop),
    [shell,inside,cutEdge]);
   mesh.name=isTop?"Ivory egg cap with cut lip":
    "Ivory lower egg cup with cut lip";
   mesh.castShadow=true;mesh.receiveShadow=true;
   body.add(mesh);
   const seamPoints=[];
   for(let i=0;i<=shellSegments;i++){
    const phi=2*Math.PI*i/shellSegments;
    seamPoints.push(shellPoint(phi,seamTheta(phi),1.003));
   }
   const seam=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(seamPoints),
    new THREE.LineBasicMaterial({color:0x8a7966})
   );
   seam.name="Uneven visible eggshell cut edge";
   body.add(seam);
   part.visible=false;
   eggRoot.add(part);
   return part;
  }
  topHalf=makeHalf(true);
  bottomHalf=makeHalf(false);
  // Full fracture grows from the initial central hairline, around the
  // entire egg's equator. Each little segment follows the SAME crack
  // profile as both solid shell edges; nothing jumps to a smooth circle.
  const fracturePoints=[];
  for(let i=0;i<=shellSegments;i++){
   const phi=Math.PI/2+i*2*Math.PI/shellSegments;
   fracturePoints.push(shellPoint(phi,seamTheta(phi),1.014));
  }
  eggFracture=new THREE.Line(
   new THREE.BufferGeometry().setFromPoints(fracturePoints),
   new THREE.LineBasicMaterial({color:0x67584d})
  );
  eggFracture.name="Growing jagged eggshell fracture";
  eggFracture.visible=false;
  eggFracture.geometry.setDrawRange(0,0);
  eggRoot.add(eggFracture);
  // Two restrained flakes tumble down and settle ON the ground. They
  // never stay suspended next to the cracked egg.
  shellFlakes=[-1,1].map(sign=>{
   const flake=new THREE.Mesh(
    new THREE.TetrahedronGeometry(.042,0),shell);
   flake.name="Loose tiny eggshell flake";
   flake.userData.sign=sign;
   flake.scale.set(1,.55,.62);
   flake.visible=false;eggRoot.add(flake);
   return flake;
  });
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.43,40),
   new THREE.MeshBasicMaterial({
    color:0x4d5965,transparent:true,opacity:.12,
    depthWrite:false,side:THREE.DoubleSide
   }));
  shadow.rotation.x=-Math.PI/2;
  shadow.position.set(0,-.49,-.015);
  eggRoot.add(shadow);
  // The waiting egg shows a tiny real surface crack; a tap extends this
  // SAME jagged line into the full fracture before the cap opens.
  const initialHairline=[];
  for(let i=-4;i<=4;i++){
   const phi=Math.PI/2+i*2*Math.PI/shellSegments;
   initialHairline.push(shellPoint(phi,seamTheta(phi),1.014));
  }
  eggCrack=new THREE.Line(
   new THREE.BufferGeometry().setFromPoints(initialHairline),
   new THREE.LineBasicMaterial({color:0x67584d})
  );
  eggCrack.visible=false;eggRoot.add(eggCrack);
  const fill=new THREE.PointLight(0xffffff,.95,4.5);
  fill.position.set(-.7,1.1,1.2);
  eggRoot.add(fill);
  eggRoot.visible=false;
  // The duck leaves a grounding shadow behind while it waddles away;
  // the egg retains its own tiny oval contact shadow.
  duckShadow=new THREE.Mesh(new THREE.CircleGeometry(.60,36),
   new THREE.MeshBasicMaterial({
    color:0x62576a,transparent:true,opacity:.11,
    side:THREE.DoubleSide,depthWrite:false
   }));
  duckShadow.rotation.x=-Math.PI/2;
  duckShadow.scale.set(1.25,.73,1);
  duckShadow.visible=false;scene.add(duckShadow);
 }
 function createControls(){
  eggButton=document.createElement("button");
  eggButton.type="button";
  eggButton.id="ncFinaleEgg";
  eggButton.className="nc-finale-egg-hit";
  eggButton.setAttribute("aria-label",
   "Open the shaking egg and discover the ending of Nothing Here");
  eggButton.innerHTML='<span aria-hidden="true">Tap the egg</span>';
  eggButton.hidden=true;
  eggButton.addEventListener("pointerdown",event=>event.stopPropagation());
  eggButton.addEventListener("click",event=>{
   event.preventDefault();event.stopPropagation();clickEgg();
  });
  stage.appendChild(eggButton);

  endCard=document.createElement("div");
  endCard.id="ncFinaleEndCard";
  endCard.className="nc-finale-end-card";
  endCard.setAttribute("role","status");
  endCard.setAttribute("aria-live","polite");
  endCard.hidden=true;
  endCard.innerHTML=
   '<div class="nc-finale-end-title" tabindex="-1">YOU FOUND'+
   '<span>SOMETHING.</span></div>'+
   '<div class="nc-finale-end-answer">woah...</div>'+
   '<div class="nc-finale-end-congrats">THE END.</div>';
  stage.appendChild(endCard);
  controls?.addEventListener("change",()=>{
   if(phase!=="idle")placeEggButton();
  });
 }
 function ensure(){
  if(eggRoot)return;
  createEgg();createControls();
 }
 function placeEggButton(){
  if(!eggRoot||!eggButton||phase==="idle")return;
  camera.updateMatrixWorld(true);
  eggRoot.getWorldPosition(up);
  projected.copy(up).project(camera);
  const visible=projected.z>-1&&projected.z<1&&
   Math.abs(projected.x)<1.22&&Math.abs(projected.y)<1.22;
  eggButton.style.left=(50+projected.x*50)+"%";
  eggButton.style.top=(50-projected.y*50)+"%";
  eggButton.style.visibility=visible?"visible":"hidden";
 }
 function resetBody(){
  catRig.position.y=-.93;
  catRig.rotation.set(0,0,0);
  catRig.scale.setScalar(1.04);
  catRig.visible=true;
  spinner.rotation.set(0,0,0);
  spinner.scale.setScalar(1);
  for(const leg of legs)leg.rotation.set(0,0,0);
 }
 function stageForEgg(){
  background.visible=true;
  shader.uniforms.uScene.value=13;
  shader.uniforms.uFlash.value=0;
  shader.uniforms.uBeat.value=0;
  shader.uniforms.uTime.value=0;
  shader.uniforms.uVortexTravel.value=0;
  group.scale.setScalar(1);
  resetBody();
  group.visible=true;
 }
 function renderWalking(t){
  // Hold the SAME duck in the middle of the stage until it has laid the
  // egg. Its body dips, the egg visibly descends from underneath it, then
  // it straightens, turns right, and walks out leaving the egg behind.
  const squat=ease((t-.38)/.46)*(1-ease((t-1.14)/.52));
  // The egg is genuinely tiny when laid. It lands at about one quarter
  // size, stays small until the duck starts waddling, then grows while
  // the duck exits. The shell's bottom stays on the ground as it grows.
  const drop=ease((t-.90)/.63);
  const grow=ease((t-1.82)/2.84);
  const eggSize=.23+.77*grow;
  const walking=t>=1.78&&t<4.70;
  const sideTurn=ease((t-.24)/.43);
  const departure=ease((t-1.78)/2.92);
  const gait=walking&&!reducedMotion?Math.sin((t-1.78)*15):0;
  const distance=camera.position.distanceTo(origin);
  const halfWidth=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*
   camera.aspect;
  const exitDistance=Math.max(4.8,halfWidth+2.8);

  // Rotate to a side view BEFORE laying, so players can actually see
  // the egg leave the rear of the duck. The small 0.64-unit shift keeps
  // the tail directly over screen-center, where the egg will remain.
  group.position.set(origin.x+.64*sideTurn+exitDistance*departure,
   baseY-.095*squat+Math.abs(gait)*.045,
   baseZ+.18);
  catRig.scale.set(1.04,1.04*(1-.09*squat),1.04);
  catRig.rotation.x=.11*squat;
  catRig.rotation.z=walking&&!reducedMotion?.043*gait:0;
  spinner.rotation.y=Math.PI*.5*sideTurn;
  for(let i=0;i<legs.length;i++)
   legs[i].rotation.x=walking&&!reducedMotion?
    (i===0?1:-1)*.29*gait:(i===0?1:-1)*.075*squat;
  catRig.visible=t<4.70;
  group.visible=t<4.70;
  duckShadow.position.set(group.position.x,baseY-.025,baseZ+.18);
  duckShadow.visible=t<4.70;

  // The small shell drops from under the raised tail, then grows
  // gradually from the floor while the duck walks away. Never pop the
  // entire full-sized egg through the body at its first visible frame.
  eggRoot.visible=t>=.90;
  eggRoot.scale.setScalar(eggSize);
  eggRoot.position.set(origin.x,
   baseY+eggFloorHeight*eggSize+.27*(1-drop),
   baseZ+.28);
  const shaking=ease((t-4.40)/.40);
  eggRoot.rotation.z=reducedMotion?0:
   shaking*(.055+.024*Math.sin(t*2.6))*Math.sin(t*16.5);
  // The same moving tail outline remains seated while the duck crouches
  // and turns; there are no detached CSS proxies or model swaps.
  duck.userData.updateTailContour?.(camera);
 }
 function render(t){
  if(phase==="idle"||phase==="message")return;
  elapsed=Math.max(0,t);
  stageForBackground();
  if(phase==="cracking"){
   eggRoot.visible=true;
   group.visible=false;
   duckShadow.visible=false;
   catRig.visible=false;
   eggRoot.scale.setScalar(1);
   const seconds=Math.max(0,(performance.now()-crackTime)/1000);
   crackProgress=ease((seconds-.035)/.34);
   openingProgress=ease((seconds-.39)/.68);
   const settle=ease((seconds-1.09)/.52);
   const split=seconds>=.39;
   eggWhole.visible=!split;eggOutline.visible=!split;
   eggCrack.visible=!split;
   eggFracture.visible=!split;
   eggFracture.geometry.setDrawRange(0,
    Math.min(shellSegments+1,Math.floor((shellSegments+1)*crackProgress)));
   topHalf.visible=split;bottomHalf.visible=split;
   eggRoot.position.y=baseY+eggFloorHeight;
   // One small physical shiver when the fracture spreads, then the
   // stationary lower cup stays planted exactly where the egg was.
   eggRoot.rotation.z=seconds<.39&&!reducedMotion?
    .019*Math.sin(seconds*33)*(1-crackProgress):0;
   bottomHalf.position.set(0,0,0);
   bottomHalf.rotation.set(0,0,0);
   topHalf.position.set(.43*settle,
    .026+.050*openingProgress-.34*settle,
    -.27-.12*settle);
   topHalf.rotation.set(-1.12*openingProgress,
    .12*openingProgress,-.14*openingProgress-.46*settle);
   for(const flake of shellFlakes){
    const sign=flake.userData.sign;
    const fall=ease((seconds-.51)/.66);
    flake.visible=split&&openingProgress>.05;
    flake.position.set(sign*(.14+.19*fall),
     THREE.MathUtils.lerp(.01,-.446,fall),.312+.06*fall);
    flake.rotation.set(fall*1.8,sign*fall*.8,sign*fall*2.1);
   }
   if(seconds>=1.9){
    phase="message";
    endCard.hidden=false;
    endCard.querySelector(".nc-finale-end-title")?.focus({preventScroll:true});
   }
  }else{
   eggWhole.visible=true;eggOutline.visible=true;
   eggCrack.visible=phase==="egg"||t>=4.65;
   eggFracture.visible=false;
   eggFracture.geometry.setDrawRange(0,0);
   for(const flake of shellFlakes)flake.visible=false;
   topHalf.visible=false;bottomHalf.visible=false;
   topHalf.position.set(0,.026,-.27);topHalf.rotation.set(0,0,0);
   bottomHalf.position.set(0,0,0);bottomHalf.rotation.set(0,0,0);
   if(phase==="egg")renderWalking(Math.max(t,5.0));
   else renderWalking(t);
   if(t>=4.70){
    phase="egg";
    eggButton.hidden=false;
   }
  }
  placeEggButton();
  invalidate();
 }
 function stageForBackground(){
  background.visible=true;
  shader.uniforms.uScene.value=13;
  shader.uniforms.uFlash.value=0;
  shader.uniforms.uBeat.value=0;
  shader.uniforms.uVortexTravel.value=0;
 }
 function tick(now){
  frameId=0;
  if(phase==="idle"||phase==="message")return;
  // A waiting egg only needs 30 scene updates per second, not 60.
  if(phase==="egg"&&now-lastFrame<1000/30){
   frameId=requestAnimationFrame(tick);return;
  }
  lastFrame=now;
  if(phase==="cracking")render(5);
  else render(phase==="egg"?
   5+(now-startTime)/1000:Math.max(0,(now-startTime)/1000));
  if(phase!=="message"&&phase!=="idle"&&!reducedMotion)
   frameId=requestAnimationFrame(tick);
  else if(phase!=="message"&&phase!=="idle"&&phase!=="egg")
   frameId=requestAnimationFrame(tick);
 }
 function clickEgg(){
  if(phase!=="egg")return false;
  phase="cracking";
  crackProgress=0;openingProgress=0;
  eggButton.hidden=true;
  crackTime=performance.now();
  if(frameId)cancelAnimationFrame(frameId);
  frameId=requestAnimationFrame(tick);
  return true;
 }
 function start({restore=false}={}){
  stop();ensure();
  origin=getAnchor?.()?.clone?.()||new THREE.Vector3(0,0,-.3);
  // Align both the duck AND the egg to the horizontal camera center.
  // Camera may have been orbited during the last secret, so hard-coding
  // world x=0 or borrowing the unfolded box position is not reliable.
  camera.updateMatrixWorld(true);
  screenRight.setFromMatrixColumn(camera.matrixWorld,0).normalize();
  const offset=origin.clone().sub(camera.position).dot(screenRight);
  origin.addScaledVector(screenRight,-offset);
  baseY=origin.y+1.00;baseZ=origin.z;
  eggRoot.position.set(origin.x,baseY+eggFloorHeight,baseZ+.28);
  eggRoot.rotation.set(0,0,0);
  eggRoot.scale.setScalar(1);
  startTime=performance.now()-(restore?5000:0);
  phase=restore?"egg":"laying";
  stageForEgg();
  eggWhole.visible=true;eggOutline.visible=true;
  topHalf.visible=false;bottomHalf.visible=false;
  if(eggFracture)eggFracture.visible=false;
  for(const flake of shellFlakes)flake.visible=false;
  crackProgress=0;openingProgress=0;
  endCard.hidden=true;eggButton.hidden=!restore;
  render(restore?5:0);
  if(!reducedMotion)frameId=requestAnimationFrame(tick);
  else if(!restore)frameId=requestAnimationFrame(tick);
  return getState();
 }
 function stop(){
  if(frameId)cancelAnimationFrame(frameId);
  frameId=0;phase="idle";elapsed=0;lastFrame=0;
  if(eggRoot)eggRoot.visible=false;
  if(duckShadow)duckShadow.visible=false;
  if(eggCrack)eggCrack.visible=false;
  if(eggFracture)eggFracture.visible=false;
  for(const flake of shellFlakes)flake.visible=false;
  crackProgress=0;openingProgress=0;
  if(eggButton)eggButton.hidden=true;
  if(endCard)endCard.hidden=true;
  if(catRig)resetBody();
 }
 function onResize(){if(phase!=="idle"){placeEggButton();invalidate();}}
 function seekForVisualTest(t){
  if(!["localhost","127.0.0.1"].includes(window.location.hostname))
   return null;
  start({restore:t>=4.70});
  if(frameId)cancelAnimationFrame(frameId);
  frameId=0;
  phase=t>=4.70?"egg":"laying";
  render(Math.max(0,Number(t)||0));
  return getState();
 }
 function seekCrackForVisualTest(seconds){
  if(!["localhost","127.0.0.1"].includes(window.location.hostname))
   return null;
  // Re-enter the settled egg on each sample. These fixed offsets let the
  // browser regression inspect the first fracture, separated jagged shell,
  // and grounded pieces without relying on software-renderer frame timing.
  start({restore:true});
  if(frameId)cancelAnimationFrame(frameId);
  frameId=0;
  phase="cracking";
  eggButton.hidden=true;
  crackTime=performance.now()-Math.max(0,Number(seconds)||0)*1000;
  render(5);
  return getState();
 }
 function getState(){
  return {
   postludePhase:phase,
   postludeElapsed:+elapsed.toFixed(3),
   eggVisible:!!eggRoot?.visible,
   eggShaking:phase==="egg"&&!reducedMotion,
   eggWobble:+(eggRoot?.rotation.z??0).toFixed(4),
   eggHairlineCrackVisible:!!eggCrack?.visible,
   eggCrackProgress:+crackProgress.toFixed(3),
   eggOpeningProgress:+openingProgress.toFixed(3),
   eggJaggedSeamTeeth:toothAngles.length,
   eggShellThickness:.042,
   eggLowerShellStationary:!!bottomHalf&&
    bottomHalf.position.lengthSq()<.000001&&
    bottomHalf.rotation.x===0&&bottomHalf.rotation.z===0,
   eggTopCapTilt:+(topHalf?.rotation.x||0).toFixed(3),
   eggTopCapVisible:!!topHalf?.visible,
   eggLowerCupVisible:!!bottomHalf?.visible,
   eggFragmentCount:shellFlakes.length,
   eggFragmentsRested:shellFlakes.length===2&&
    shellFlakes.every(f=>!f.visible||f.position.y<-.43),
   eggDropProgress:+ease((elapsed-.90)/.63).toFixed(3),
   eggGrowProgress:+ease((elapsed-1.82)/2.84).toFixed(3),
   eggScale:+(eggRoot?.scale.x??0).toFixed(3),
   duckCrouching:phase==="laying"&&elapsed>=.48&&elapsed<1.53,
   duckSideFacingToLay:phase==="laying"&&
    elapsed>=.70&&elapsed<1.78&&spinner.rotation.y>1.2,
   eggGrounded:elapsed>=1.53&&!!eggRoot?.visible,
   eggHorizontalCenterOffset:eggRoot&&origin?
    +eggRoot.position.clone().sub(origin).dot(screenRight).toFixed(4):null,
   duckHorizontalCenterOffset:group&&origin?
    +group.position.clone().sub(origin).dot(screenRight).toFixed(4):null,
   eggAndDuckSameLane:!!eggRoot&&!!group&&
    Math.abs(eggRoot.position.x-group.position.x)<.85&&
    elapsed<1.78,
   eggUnderDuckTail:(()=>{
    if(!eggRoot||!duck||elapsed<.90||elapsed>=1.78)return false;
    const tail=duck.getObjectByName("Rounded body of Classic duck tail");
    if(!tail)return false;
    const pos=tail.getWorldPosition(new THREE.Vector3());
    return Math.abs(pos.x-eggRoot.position.x)<.34&&
     pos.y>eggRoot.position.y;
   })(),
   walkLegAngles:legs.map(leg=>+leg.rotation.x.toFixed(3)),
   eggClickable:phase==="egg"&&!!eggButton&&!eggButton.hidden,
   duckWalkingAway:phase==="laying"&&elapsed>=1.78&&elapsed<4.70,
   duckGone:phase==="egg"||phase==="cracking"||phase==="message",
   eggCracked:phase==="cracking"||phase==="message",
   endMessageVisible:phase==="message"&&!!endCard&&!endCard.hidden,
   eggButtonPresent:!!eggButton,
   sameDuck:!!duck,
   eggPosition:eggRoot?{
    x:+eggRoot.position.x.toFixed(3),
    y:+eggRoot.position.y.toFixed(3),
    z:+eggRoot.position.z.toFixed(3)
   }:null
  };
 }
 return {start,stop,onResize,getState,seekForVisualTest,
  seekCrackForVisualTest,clickEgg};
}
