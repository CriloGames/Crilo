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
 let eggButton=null,endCard=null,origin=null,baseY=0,baseZ=0;
 const legs=duck.userData.walkLegs||[];
 const up=new THREE.Vector3(),projected=new THREE.Vector3();

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

  const makeHalf=(start,length)=>{
   const part=new THREE.Group();
   const geometry=new THREE.SphereGeometry(1,36,28,0,Math.PI*2,start,length);
   const core=new THREE.Mesh(geometry,shell);
   core.scale.set(.37,.48,.34);
   part.add(core);
   const border=new THREE.Mesh(geometry,outline);
   border.scale.set(.389,.499,.359);
   part.add(border);
   part.visible=false;eggRoot.add(part);
   return part;
  };
  topHalf=makeHalf(0,1.38);
  bottomHalf=makeHalf(1.38,Math.PI-1.38);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.43,40),
   new THREE.MeshBasicMaterial({
    color:0x4d5965,transparent:true,opacity:.12,
    depthWrite:false,side:THREE.DoubleSide
   }));
  shadow.rotation.x=-Math.PI/2;
  shadow.position.set(0,-.49,-.015);
  eggRoot.add(shadow);
  // A short hairline zigzag hints at movement INSIDE the shell.
  // It only becomes visible once the duck has walked off.
  const crackPoints=[
   [-.11,.14,.304],[-.042,.082,.331],[.013,.114,.334],
   [.047,.026,.338],[.113,-.018,.31]
  ].map(p=>new THREE.Vector3(...p));
  eggCrack=new THREE.Mesh(
   new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crackPoints),24,.007,6,false),
   new THREE.MeshBasicMaterial({color:0x655145})
  );
  eggCrack.visible=false;
  eggRoot.add(eggCrack);
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
   '<div class="nc-finale-end-title" tabindex="-1">THE END.</div>'+
   '<div class="nc-finale-end-question">NOTHING HERE?</div>'+
   '<div class="nc-finale-end-answer">Turns out there was <em>SOMETHING</em> after all.</div>'+
   '<div class="nc-finale-end-congrats">Congrats. You found it! 🥚</div>';
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
  const lay=ease((t-.70)/.44);
  const departure=ease((t-1.55)/3.10);
  const wobble=phase==="egg"||t>1.0?
   (reducedMotion?0:(.055+.024*Math.sin(t*2.6))*Math.sin(t*16.5)):0;
  eggRoot.visible=t>=.87;
  eggRoot.scale.setScalar(.001+.999*ease((t-.87)/.38));
  eggRoot.rotation.z=wobble;
  eggRoot.position.y=baseY+.48+
   (reducedMotion?0:Math.abs(Math.sin(t*9))*.018)*(t>=1.3?1:0);

  // A short crouch gives the laying motion weight, then the SAME rig
  // walks right with alternating articulated feet and a little waddle.
  const crouch=Math.sin(lay*Math.PI)*.19;
  const walking=t>=1.55&&t<4.65;
  const gait=walking&&!reducedMotion?Math.sin((t-1.55)*15):0;
  const distance=camera.position.distanceTo(origin);
  const halfWidth=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*
   camera.aspect;
  const exitDistance=Math.max(4.8,halfWidth+2.8);
  group.position.set(origin.x+.35+exitDistance*departure,
   baseY-crouch+Math.abs(gait)*.045,
   baseZ+.20);
  duckShadow.position.set(group.position.x,baseY-.025,baseZ+.20);
  duckShadow.visible=t<4.65;
  spinner.rotation.y=walking?Math.PI*.5*ease((t-1.35)/.36):0;
  catRig.rotation.z=walking&&!reducedMotion?.043*gait:0;
  for(let i=0;i<legs.length;i++)
   legs[i].rotation.x=walking&&!reducedMotion?
    (i===0?1:-1)*.29*gait:0;
  catRig.visible=t<4.65;
  group.visible=t<4.65;
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
   const crack=ease((performance.now()-crackTime)/670);
   eggWhole.visible=false;eggOutline.visible=false;
   eggCrack.visible=false;
   topHalf.visible=true;bottomHalf.visible=true;
   eggRoot.rotation.z=0;
   eggRoot.position.y=baseY+.48;
   topHalf.position.set(crack*.19,crack*.30,0);
   topHalf.rotation.z=crack*.25;
   bottomHalf.position.set(0,0,0);
   if(crack>=1){
    phase="message";
    endCard.hidden=false;
    endCard.querySelector(".nc-finale-end-title")?.focus({preventScroll:true});
   }
  }else{
   eggWhole.visible=true;eggOutline.visible=true;
   eggCrack.visible=phase==="egg"||t>=4.65;
   topHalf.visible=false;bottomHalf.visible=false;
   topHalf.position.set(0,0,0);topHalf.rotation.set(0,0,0);
   if(phase==="egg")renderWalking(Math.max(t,5.0));
   else renderWalking(t);
   if(t>=4.65){
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
  eggButton.hidden=true;
  crackTime=performance.now();
  if(frameId)cancelAnimationFrame(frameId);
  frameId=requestAnimationFrame(tick);
  return true;
 }
 function start({restore=false}={}){
  stop();ensure();
  origin=getAnchor?.()?.clone?.()||new THREE.Vector3(0,0,-.3);
  baseY=origin.y+1.00;baseZ=origin.z;
  eggRoot.position.set(origin.x-.47,baseY+.48,baseZ-.20);
  eggRoot.rotation.set(0,0,0);
  eggRoot.scale.setScalar(1);
  startTime=performance.now()-(restore?5000:0);
  phase=restore?"egg":"laying";
  stageForEgg();
  eggWhole.visible=true;eggOutline.visible=true;
  topHalf.visible=false;bottomHalf.visible=false;
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
  if(eggButton)eggButton.hidden=true;
  if(endCard)endCard.hidden=true;
  if(catRig)resetBody();
 }
 function onResize(){if(phase!=="idle"){placeEggButton();invalidate();}}
 function seekForVisualTest(t){
  if(!["localhost","127.0.0.1"].includes(window.location.hostname))
   return null;
  start({restore:t>=4.65});
  if(frameId)cancelAnimationFrame(frameId);
  frameId=0;
  phase=t>=4.65?"egg":"laying";
  render(Math.max(0,Number(t)||0));
  return getState();
 }
 function getState(){
  return {
   postludePhase:phase,
   postludeElapsed:+elapsed.toFixed(3),
   eggVisible:!!eggRoot?.visible,
   eggShaking:phase==="egg"&&!reducedMotion,
   eggClickable:phase==="egg"&&!!eggButton&&!eggButton.hidden,
   duckWalkingAway:phase==="laying"&&elapsed>=1.55&&elapsed<4.65,
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
 return {start,stop,onResize,getState,seekForVisualTest,clickEgg};
}
