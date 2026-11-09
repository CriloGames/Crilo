/* Nothing Here — textured six-panel net and timed 3D cat celebration.
 * The original modeled cube remains the real opened sculpture; the cat
 * and its light show are new 3D geometry, never video frames. */
import * as THREE from "three";
import {gsap} from "gsap";
import {createFinaleCatShow,CAT_REFERENCE_DURATION} from "./secrets-3d-finale-cat.js?v=8";

export function createNothingHereFinale({
 cube,faceRoot,faces,camera,controls,stage,scene,invalidate,reducedMotion,
 dismissInspection
}){
 const {frontFace,leftFace,rightFace,bottomFace,backFace,topFace}=faces;
 const S=3.22,half=S/2;
 const banner=document.getElementById("ncFinaleBanner");
 const replayButton=document.getElementById("ncFinaleReplay");
 const originalCamera=camera.position.clone();
 const originalTarget=controls.target.clone();
 const originalRotation=cube.rotation.clone();
 const originalPosition=cube.position.clone();
 const originalScale=cube.scale.clone();
 const framePieces=cube.children.filter(node=>node!==faceRoot)
  .map(node=>({node,visible:node.visible}));
 const panels=[
  ["front",frontFace],["left",leftFace],["right",rightFace],
  ["bottom",bottomFace],["back",backFace],["top",topFace]
 ];
 let joints=null,frameRims=[],timeline=null,phase="idle",hasPlayed=false;
 let audioAtFinish=false;
 // The inspector must see every real mesh for its triangle-level collision
 // audit, even when a saved 60/60 run has already finished.
 const keepNetForInspection=new URLSearchParams(window.location.search)
  .get("inspect3d")==="1";
 let netOpacity=1,trackedNetMaterials=null;
 // The middle panel is the open box itself. Track its world position so the
 // cat remains exactly above the opening regardless of cube scale/orientation.
 const anchor=new THREE.Vector3();
 const catShow=createFinaleCatShow({
  scene,stage,invalidate,reducedMotion,
  getCatAnchor:()=>frontFace.getWorldPosition(anchor),
  onTimelineFrame:seconds=>setNetFade(seconds)
 });
 let completionWatchdog=null;
 function collectNetMaterials(){
  if(trackedNetMaterials)return;
  const unique=new Map();
  faceRoot.traverse(node=>{
   if(!node.material)return;
   for(const material of Array.isArray(node.material)?node.material:[node.material]){
    if(material&&!unique.has(material))unique.set(material,{
     opacity:material.opacity,transparent:material.transparent,
     depthWrite:material.depthWrite
    });
   }
  });
  trackedNetMaterials=[...unique.entries()];
 }
 function resetNetFade(){
  faceRoot.visible=true;
  // Intro-only moon is part of the box silhouette, not the laser show.
  document.body.style.setProperty("--nh-finale-moon-opacity","1");
  if(trackedNetMaterials)for(const [material,original] of trackedNetMaterials){
   const changing=material.transparent!==original.transparent;
   material.opacity=original.opacity;
   material.transparent=original.transparent;
   material.depthWrite=original.depthWrite;
   if(changing)material.needsUpdate=true;
  }
  netOpacity=1;
 }
 function setNetFade(seconds){
  if(phase!=="open")return;
  if(keepNetForInspection){resetNetFade();return;}
  // The net is visible as the melody starts, then dissolves away over the
  // first 1.8 seconds, leaving ONLY the floating cat and neon stage.
  const u=END.clamp(seconds/1.8,0,1);
  const amount=1-u*u*(3-2*u);
  netOpacity=amount;
  // Keep the top-left moon on the EXACT same 1.8s curve as the real T.
  // Set a CSS variable rather than toggling its pseudo-element abruptly.
  document.body.style.setProperty("--nh-finale-moon-opacity",
   String(amount));
  if(amount<=.001){
   faceRoot.visible=false; // skip expensive hidden machinery draw calls
   return;
  }
  faceRoot.visible=true;
  if(amount>=.999){resetNetFade();return;}
  collectNetMaterials();
  for(const [material,original] of trackedNetMaterials){
   material.opacity=original.opacity*amount;
   if(!material.transparent){material.transparent=true;material.needsUpdate=true;}
   material.depthWrite=false;
  }
 }
 function clearWatchdog(){
  if(completionWatchdog!==null)clearTimeout(completionWatchdog);
  completionWatchdog=null;
 }
 const END=THREE.MathUtils;
 const cue=()=>{window.NothingHereAudio?.playFinale?.(CAT_REFERENCE_DURATION)};
 // The face-root contains all the ORIGINAL puzzle detail. A unfolded panel's
 // reverse was a featureless back when the cubic frame disappeared; add an
 // enamel reverse with brushing, hairline engraving and bolted edgework.
 const enamels={front:"#d8c8e6",left:"#f0caba",right:"#a8d4d6",
  bottom:"#beb7de",back:"#cbe0c1",top:"#f0dfb2"};
 function reverseTexture(name){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=512;
  const ctx=canvas.getContext("2d"),color=enamels[name];
  ctx.fillStyle=color;ctx.fillRect(0,0,512,512);
  const gloss=ctx.createLinearGradient(0,0,512,512);
  gloss.addColorStop(0,"#ffffff71");gloss.addColorStop(.45,"#ffffff00");
  gloss.addColorStop(1,"#43383a25");
  ctx.fillStyle=gloss;ctx.fillRect(0,0,512,512);
  for(let i=0;i<110;i++){
   const y=9+i*4.55;
   ctx.strokeStyle=i%3===0?"#ffffff23":"#443f4d13";
   ctx.lineWidth=i%11===0?1.4:.48;
   ctx.beginPath();ctx.moveTo(5,y);ctx.lineTo(507,y);ctx.stroke();
  }
  ctx.strokeStyle="#63534466";ctx.lineWidth=2.6;
  ctx.strokeRect(23,23,466,466);
  ctx.strokeStyle="#faf4d399";ctx.lineWidth=1.7;
  ctx.strokeRect(31,31,450,450);
  for(const u of [61,451])for(const v of [61,451]){
   ctx.strokeStyle="#987956";ctx.lineWidth=4;
   ctx.beginPath();ctx.arc(u,v,10,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(u-5,v+5);ctx.lineTo(u+5,v-5);ctx.stroke();
  }
  // Distinct etched compass-like inlay without overriding puzzle lettering.
  ctx.strokeStyle="#7e685344";ctx.lineWidth=1.5;
  for(const r of [85,106,131]){
   ctx.beginPath();ctx.arc(256,256,r,Math.PI*.16,Math.PI*1.84);ctx.stroke();
  }
  for(let i=0;i<16;i++){
   const a=i*Math.PI/8;
   ctx.beginPath();ctx.moveTo(256+Math.cos(a)*124,256+Math.sin(a)*124);
   ctx.lineTo(256+Math.cos(a)*135,256+Math.sin(a)*135);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
 }
 function showBanner(next){
  if(!banner)return;
  banner.hidden=false;
  banner.dataset.phase=next;
  if(replayButton)replayButton.hidden=next!=="open";
 }
 function ensureJoints(){
  if(joints)return;
  // Attach each existing face to its REAL shared edge. Object3D.attach()
  // preserves its world pose before the first motion (no sudden jumps).
  function hinge(parent,position,child){
   const pivot=new THREE.Group();
   pivot.position.set(...position);
   parent.add(pivot);
   parent.updateWorldMatrix(true,true);
   pivot.attach(child);
   return pivot;
  }
  const left=hinge(faceRoot,[-half,0,half],leftFace);
  const right=hinge(faceRoot,[half,0,half],rightFace);
  const bottom=hinge(faceRoot,[0,-half,half],bottomFace);
  const back=hinge(bottomFace,[0,-half,0],backFace);
  const top=hinge(backFace,[0,half,0],topFace);
  joints={left,right,bottom,back,top};
  // New slim edge beads belong to each individual panel. The rigid outer
  // cubic frame goes away as the six actual panels spread into their net.
  const gold=new THREE.MeshPhysicalMaterial({
   color:0xd5b883,metalness:.65,roughness:.28,clearcoat:.28
  });
  const dark=new THREE.MeshPhysicalMaterial({
   color:0x4c4b57,metalness:.35,roughness:.48
  });
  for(const [name,panel] of panels){
   const rim=new THREE.Group();
   rim.visible=false;
   panel.add(rim);
   const backing=new THREE.Mesh(new THREE.PlaneGeometry(S-.07,S-.07),
    new THREE.MeshPhysicalMaterial({map:reverseTexture(name),side:THREE.DoubleSide,
     metalness:.23,roughness:.43,clearcoat:.52,clearcoatRoughness:.24}));
   // The reverse-only lamination sits BEHIND the existing 3D machinery.
   // No old puzzle mesh is hidden, cloned or flattened.
   backing.position.z=-.12;backing.receiveShadow=true;
   rim.add(backing);
   for(const x of [-half+.12,half-.12])for(const y of [-half+.12,half-.12]){
    const nut=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,.013,12),gold);
    nut.rotation.x=Math.PI/2;nut.position.set(x,y,-.145);rim.add(nut);
   }
   for(const edge of [-1,1]){
    const y=edge*(half-.034);
    const top=new THREE.Mesh(new THREE.BoxGeometry(S-.055,.07,.065),gold);
    top.position.set(0,y,.060);rim.add(top);
    const side=new THREE.Mesh(new THREE.BoxGeometry(.07,S-.055,.065),gold);
    side.position.set(edge*(half-.034),0,.060);rim.add(side);
    const engraved=new THREE.Mesh(new THREE.BoxGeometry(S-.17,.012,.013),dark);
    engraved.position.set(0,y-edge*.052,.102);rim.add(engraved);
   }
   frameRims.push(rim);
  }
 }
 function fit(){
  // Fit the ENTIRE 3 x 4 square net, not only the original single cube.
  const height=Math.max(1,stage.clientHeight),aspect=stage.clientWidth/height;
  const fov=END.degToRad(camera.fov);
  const vertical=2*10.5*Math.tan(fov/2);
  return END.clamp(Math.min(
   .43,.77*vertical/(4*S),.77*vertical*aspect/(3*S)
  ),.18,.43);
 }
 function setFrames(unfolded){
  for(const {node,visible} of framePieces)node.visible=unfolded?false:visible;
  for(const rim of frameRims)rim.visible=unfolded;
 }
 function placeNet(){
  joints.left.rotation.y=Math.PI/2;
  joints.right.rotation.y=-Math.PI/2;
  joints.bottom.rotation.x=-Math.PI/2;
  joints.back.rotation.x=-Math.PI/2;
  // BackFace has a 180-degree Y rotation, so local +X is world -X.
  joints.top.rotation.x=Math.PI/2;
  faceRoot.position.set(0,S*1.18,-half);
  // Rotate the actual hinge-linked six-face T onto its back so every
  // textured surface becomes a HORIZONTAL floor beneath the 3D cat.
  cube.rotation.set(-Math.PI/2,0,0);
  cube.position.set(0,0,3.5);
  cube.scale.setScalar(fit());
  controls.target.set(0,.55,0);
  camera.position.set(0,6.5,16.5);
  camera.lookAt(controls.target);
  controls.update();
  setFrames(true);
  invalidate();
 }
 function resetForReplay(){
  catShow.stop();
  resetNetFade();
  window.NothingHereAudio?.stopFinale?.();
  clearWatchdog();
  timeline?.kill();
  timeline=null;
  ensureJoints();
  for(const joint of Object.values(joints))joint.rotation.set(0,0,0);
  faceRoot.position.set(0,0,0);
  cube.rotation.copy(originalRotation);
  cube.position.copy(originalPosition);
  cube.scale.copy(originalScale);
  camera.position.copy(originalCamera);
  controls.target.copy(originalTarget);
  controls.update();
  setFrames(false);
  invalidate();
 }
 function finish(){
  clearWatchdog();
  if(timeline){timeline.kill();timeline=null;}
  placeNet();
  phase="open";
  resetNetFade();
  showBanner("open");
  catShow.start();
  if(audioAtFinish)cue();
  audioAtFinish=false;
  controls.enabled=true; // Orbit the unfolded object; never reactivate puzzles.
  controls.enableRotate=true;
  if(stage.querySelector("canvas"))
   stage.querySelector("canvas").setAttribute("aria-label",
    "Finished Nothing Here: all six textured panels form a horizontal T-shaped platform beneath the spinning three-dimensional cat. Drag to orbit.");
  invalidate();
 }
 function begin({animate=true,audio=true}={}){
  if(phase==="opening")return false;
  if(phase==="open")resetForReplay();
  ensureJoints();
  phase="opening";
  hasPlayed=true;
  showBanner("opening");
  document.body.classList.add("nc-finale-active");
  dismissInspection?.();
  controls.enabled=false;
  // Start the cat soundtrack only AFTER the final panel lands. The replay
  // click unlocks Web Audio; normal completion uses the last puzzle click.
  audioAtFinish=audio;
  if(audio)window.NothingHereAudio?.prepareFinale?.();
  catShow.stop();
  if(!animate||reducedMotion){finish();return true;}
  setFrames(false);
  const scale=fit();
  timeline=gsap.timeline({onUpdate:invalidate,onComplete:finish});
  // Pull back first, before the real hinged panels begin to fall.
  timeline.to(camera.position,{x:0,y:6.5,z:16.5,duration:3.6,ease:"power2.inOut"},0)
   .to(controls.target,{x:0,y:.55,z:0,duration:3.5,ease:"power2.inOut"},0)
   .to(cube.rotation,{x:-Math.PI/2,y:0,z:0,duration:2.2,ease:"power2.inOut"},1.95)
   .to(cube.position,{x:0,y:0,z:3.5,duration:3.5,ease:"power2.inOut"},.32)
   .to(cube.scale,{x:scale,y:scale,z:scale,duration:2.7,ease:"power2.inOut"},0)
   .to(faceRoot.position,{x:0,y:1.18*S,z:-half,duration:3.8,ease:"power2.inOut"},.25)
   .call(()=>setFrames(true),null,.60)
   .to(joints.left.rotation,{y:Math.PI/2,duration:1.1,ease:"power2.inOut"},.72)
   .to(joints.right.rotation,{y:-Math.PI/2,duration:1.1,ease:"power2.inOut"},.92)
   .to(joints.bottom.rotation,{x:-Math.PI/2,duration:1.2,ease:"power2.inOut"},1.25)
   .to(joints.back.rotation,{x:-Math.PI/2,duration:1.1,ease:"power2.inOut"},2.10)
   .to(joints.top.rotation,{x:Math.PI/2,duration:1.15,ease:"power2.inOut"},2.88);
  // Software WebGL can starve GSAP's frame ticker. Never trap a player
  // in a half-unfolded cube if Chromium stalls or goes into background.
  completionWatchdog=setTimeout(()=>{
   if(phase==="opening")finish();
  },9500);
  return true;
 }
 function restoreComplete(){
  if(phase!=="idle")return false;
  ensureJoints();
  phase="open";
  hasPlayed=true;
  document.body.classList.add("nc-finale-active");
  showBanner("open");
  audioAtFinish=false;
  finish();
  catShow.restore();
  return true;
 }
 replayButton?.addEventListener("click",()=>{
  if(phase==="open")begin({animate:true,audio:true});
 });
 return {
  begin,restoreComplete,
  seekForVisualTest:t=>phase==="open"?catShow.seekForVisualTest(t):null,
  onResize(){if(phase==="open"){cube.scale.setScalar(fit());catShow.onResize();invalidate();}},
  isActive:()=>phase!=="idle",
  getState(){
   const positions={};
   if(joints&&phase==="open"){
    faceRoot.updateWorldMatrix(true,true);
    for(const [name,panel] of panels){
     const center=faceRoot.worldToLocal(panel.getWorldPosition(new THREE.Vector3()));
     const normal=new THREE.Vector3(0,0,1).applyQuaternion(
      panel.getWorldQuaternion(new THREE.Quaternion()));
     positions[name]={x:+center.x.toFixed(3),y:+center.y.toFixed(3),
      z:+center.z.toFixed(3),normal:+normal.y.toFixed(3)};
    }
   }
   const cat=catShow.getState();
   const center=frontFace.getWorldPosition(new THREE.Vector3());
   return {phase,hasPlayed,panels:positions,cat,
    netOpacity:+netOpacity.toFixed(3),
    netFadeComplete:phase==="open"&&netOpacity<=.001&&!faceRoot.visible,
    catCenteredOverBox:!!cat.catWorldPosition&&
     Math.abs(cat.catWorldPosition.x-center.x)<.02&&
     Math.abs(cat.catWorldPosition.z-center.z)<.02&&
     cat.catWorldPosition.y>center.y+.5,
    reverseTexturedPanels:frameRims.filter(rim=>
     rim.children.some(node=>node.isMesh&&node.material?.map)).length,
    banner:!!banner&&!banner.hidden,
    replay:!!replayButton&&!replayButton.hidden,
    normalControls:controls.enabled,
    scale:+cube.scale.x.toFixed(3),
    outerFrameHidden:framePieces.every(({node})=>!node.visible),
    centerFit:Math.abs(controls.target.y-.55)<.1,
    platformHorizontal:Math.abs(cube.rotation.x+Math.PI/2)<.01,
    platformUnderCat:catShow.getState().platformUnderCat,
    cameraAbovePlatform:camera.position.y>2};
  }
 };
}
