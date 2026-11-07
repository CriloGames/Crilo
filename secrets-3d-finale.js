/* Nothing Here — original six-panel completion finale.
 * A real hinged cube net: front at the T's shoulder, two folding wings,
 * then the underside, rear and roof forming its three-section stem.
 * No video, images or third-party copyrighted song are used. */
import * as THREE from "three";
import {gsap} from "gsap";

export function createNothingHereFinale({
 cube,faceRoot,faces,camera,controls,stage,invalidate,reducedMotion,
 dismissInspection
}){
 const {frontFace,leftFace,rightFace,bottomFace,backFace,topFace}=faces;
 const S=3.22,half=S/2;
 const banner=document.getElementById("ncFinaleBanner");
 const replayButton=document.getElementById("ncFinaleReplay");
 const originalCamera=camera.position.clone();
 const originalTarget=controls.target.clone();
 const originalRotation=cube.rotation.clone();
 const originalScale=cube.scale.clone();
 const framePieces=cube.children.filter(node=>node!==faceRoot)
  .map(node=>({node,visible:node.visible}));
 const panels=[
  ["front",frontFace],["left",leftFace],["right",rightFace],
  ["bottom",bottomFace],["back",backFace],["top",topFace]
 ];
 let joints=null,frameRims=[],timeline=null,phase="idle",hasPlayed=false;
 const END=THREE.MathUtils;
 const cue=()=>{window.NothingHereAudio?.playFinale?.()};
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
  for(const [,panel] of panels){
   const rim=new THREE.Group();
   rim.visible=false;
   panel.add(rim);
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
  cube.rotation.set(0,0,0);
  cube.scale.setScalar(fit());
  controls.target.set(0,0,0);
  camera.position.set(0,0,10.5);
  camera.lookAt(controls.target);
  controls.update();
  setFrames(true);
  invalidate();
 }
 function resetForReplay(){
  timeline?.kill();
  timeline=null;
  ensureJoints();
  for(const joint of Object.values(joints))joint.rotation.set(0,0,0);
  faceRoot.position.set(0,0,0);
  cube.rotation.copy(originalRotation);
  cube.scale.copy(originalScale);
  camera.position.copy(originalCamera);
  controls.target.copy(originalTarget);
  controls.update();
  setFrames(false);
  invalidate();
 }
 function finish(){
  placeNet();
  phase="open";
  showBanner("open");
  controls.enabled=true; // Orbit the unfolded object; never reactivate puzzles.
  controls.enableRotate=true;
  if(stage.querySelector("canvas"))
   stage.querySelector("canvas").setAttribute("aria-label",
    "Finished Nothing Here puzzle: six real cube faces unfolded into a T shape. Drag to orbit the finished sculpture.");
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
  if(audio)cue(); // A real click supplies the browser gesture for Web Audio.
  if(!animate||reducedMotion){finish();return true;}
  setFrames(false);
  const scale=fit();
  timeline=gsap.timeline({onUpdate:invalidate,onComplete:finish});
  // Pull back first, before the real hinged panels begin to fall.
  timeline.to(camera.position,{x:0,y:0,z:10.5,duration:1.5,ease:"power2.inOut"},0)
   .to(controls.target,{x:0,y:0,z:0,duration:1.5,ease:"power2.inOut"},0)
   .to(cube.rotation,{x:0,y:0,z:0,duration:1.5,ease:"power2.inOut"},0)
   .to(cube.scale,{x:scale,y:scale,z:scale,duration:2.7,ease:"power2.inOut"},0)
   .to(faceRoot.position,{x:0,y:1.18*S,z:-half,duration:3.8,ease:"power2.inOut"},.25)
   .call(()=>setFrames(true),null,.60)
   .to(joints.left.rotation,{y:Math.PI/2,duration:1.1,ease:"power2.inOut"},.72)
   .to(joints.right.rotation,{y:-Math.PI/2,duration:1.1,ease:"power2.inOut"},.92)
   .to(joints.bottom.rotation,{x:-Math.PI/2,duration:1.2,ease:"power2.inOut"},1.25)
   .to(joints.back.rotation,{x:-Math.PI/2,duration:1.1,ease:"power2.inOut"},2.10)
   .to(joints.top.rotation,{x:Math.PI/2,duration:1.15,ease:"power2.inOut"},2.88);
  return true;
 }
 function restoreComplete(){
  if(phase!=="idle")return false;
  ensureJoints();
  phase="open";
  hasPlayed=true;
  document.body.classList.add("nc-finale-active");
  showBanner("open");
  finish();
  return true;
 }
 replayButton?.addEventListener("click",()=>{
  if(phase==="open")begin({animate:true,audio:true});
 });
 return {
  begin,restoreComplete,
  onResize(){if(phase==="open"){cube.scale.setScalar(fit());invalidate();}},
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
      z:+center.z.toFixed(3),normal:+normal.z.toFixed(3)};
    }
   }
   return {phase,hasPlayed,panels:positions,
    banner:!!banner&&!banner.hidden,
    replay:!!replayButton&&!replayButton.hidden,
    normalControls:controls.enabled,
    scale:+cube.scale.x.toFixed(3),
    outerFrameHidden:framePieces.every(({node})=>!node.visible),
    centerFit:Math.abs(controls.target.y)<.01};
  }
 };
}
