/* Nothing Here — textured six-panel net and timed 3D cat celebration.
 * The original modeled cube remains the real opened sculpture; the duck
 * and its light show are new 3D geometry, never video frames. */
import * as THREE from "three";
import {gsap} from "gsap";
import {createFinaleDuckShow,CAT_REFERENCE_DURATION} from "./secrets-3d-finale-cat.js?v=47";

export function createNothingHereFinale({
 cube,faceRoot,faces,camera,controls,stage,scene,renderer,invalidate,reducedMotion,
 dismissInspection
}){
 const {frontFace,leftFace,rightFace,bottomFace,backFace,topFace}=faces;
 const S=3.22,half=S/2;
 const banner=document.getElementById("ncFinaleBanner");
 const replayButton=document.getElementById("ncFinaleReplay");
 const skipButton=document.getElementById("ncFinaleSkip");
 const originalCamera=camera.position.clone();
 const originalTarget=controls.target.clone();
 const originalRotation=cube.rotation.clone();
 const originalPosition=cube.position.clone();
 const originalScale=cube.scale.clone();
 // These are the original twelve brass structural rails and eight fitted
 // corners. They used to be children of cube and were all hidden at 1.4s,
 // making a fully folded cube suddenly look stripped of its original trim.
 const framePieces=cube.children.filter(node=>node!==faceRoot)
  .map(node=>({node,visible:node.visible}));
 const panels=[
  ["front",frontFace],["left",leftFace],["right",rightFace],
  ["bottom",bottomFace],["back",backFace],["top",topFace]
 ];
 let joints=null,frameRims=[],timeline=null,phase="idle",hasPlayed=false;
 const rise={progress:0};
 const boxPoint=new THREE.Vector3(),landingPoint=new THREE.Vector3();
 const frontRimPoint=new THREE.Vector3();
 let audioAtFinish=false;
 // The inspector must see every real mesh for its triangle-level collision
 // audit, even when a saved 60/60 run has already finished.
 const keepNetForInspection=new URLSearchParams(window.location.search)
  .get("inspect3d")==="1";
 let netOpacity=1,trackedNetMaterials=null,netClipBounds=null;
 const clipNormal=new THREE.Vector3(1,.08,.08).normalize();
 const netClipPlane=new THREE.Plane(clipNormal,1e5);
 const originalRendererClipping=renderer.localClippingEnabled;
 let netClipActive=false;
 // This is a solid, world-space cutaway, NOT an opacity blend.
 // Everything on the remaining side keeps its exact depth, materials,
 // metallic highlights and texture. No semi-transparent floating fittings.
 // The middle panel is the open box itself. Track its world position so the
 // cat remains exactly above the opening regardless of cube scale/orientation.
 const anchor=new THREE.Vector3();
 const duckShow=createFinaleDuckShow({
  scene,stage,camera,controls,invalidate,reducedMotion,
  getCatAnchor:()=>frontFace.getWorldPosition(anchor),
  onTimelineFrame:seconds=>setNetFade(seconds)
 });
 // When enabled during the show, join the duck's current music beat
 // instead of accidentally starting the ordinary box menu soundtrack.
 window.addEventListener("nothing-here-finale-audio-request",()=>{
  if(phase==="opening"){
   window.NothingHereAudio?.syncWindUp?.(timeline?.time()||0);
   return;
  }
  if(phase!=="open"||!duckShow.getState().dancing)return;
  if(window.NothingHereAudio?.getState?.().finalePlaying)return;
  const seconds=duckShow.getState().elapsedSeconds;
  const accepted=window.NothingHereAudio?.playFinale?.(
   CAT_REFERENCE_DURATION,seconds);
  if(accepted)duckShow.syncToAudio();
 });
 window.addEventListener("nothing-here-finale-audio-muted",()=>{
  if(phase==="open")duckShow.continueSilently();
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
     depthWrite:material.depthWrite,
     clippingPlanes:material.clippingPlanes,
     clipShadows:material.clipShadows
    });
   }
  });
  trackedNetMaterials=[...unique.entries()];
 }
 function restoreClipMaterials(){
  if(!netClipActive)return;
  for(const [material,original] of trackedNetMaterials){
   material.clippingPlanes=original.clippingPlanes;
   material.clipShadows=original.clipShadows;
   material.needsUpdate=true;
  }
  netClipActive=false;
  netClipBounds=null;
  renderer.localClippingEnabled=originalRendererClipping;
 }
 function resetNetFade(){
  restoreClipMaterials();
  faceRoot.visible=true;
  document.body.style.setProperty("--nh-finale-moon-opacity","1");
  // Guarantee normal materials, including existing glass, remain untouched.
  if(trackedNetMaterials)for(const [material,original] of trackedNetMaterials){
   const changed=material.transparent!==original.transparent;
   material.opacity=original.opacity;
   material.transparent=original.transparent;
   material.depthWrite=original.depthWrite;
   if(changed)material.needsUpdate=true;
  }
  netOpacity=1;
 }
 function enableSolidWipe(){
  if(netClipActive)return;
  collectNetMaterials();
  // Compute this AFTER the entire physical T has settled. Its actual
  // position/size is needed because the T lies horizontally on the stage.
  faceRoot.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(faceRoot,true);
  const center=bounds.getCenter(new THREE.Vector3());
  const extent=bounds.getSize(new THREE.Vector3());
  const span=Math.abs(clipNormal.x*extent.x)+
   Math.abs(clipNormal.y*extent.y)+Math.abs(clipNormal.z*extent.z);
  const middle=center.dot(clipNormal);
  netClipBounds=[middle-span*.5-.10,middle+span*.5+.10];
  renderer.localClippingEnabled=true;
  for(const [material,original] of trackedNetMaterials){
   // Preserve pre-existing local clip planes, if any. Clip each material
   // with the SAME world plane so the box erases as a single solid.
   material.clippingPlanes=[
    ...(original.clippingPlanes||[]),netClipPlane
   ];
   material.clipShadows=true;
   material.needsUpdate=true;
  }
  netClipActive=true;
 }
 function applyNetOpacity(amount){
  if(keepNetForInspection){resetNetFade();return;}
  amount=END.clamp(amount,0,1);
  netOpacity=amount;
  document.body.style.setProperty("--nh-finale-moon-opacity",String(amount));
  if(amount<=.001){
   faceRoot.visible=false;
   return;
  }
  faceRoot.visible=true;
  if(amount>=.999){resetNetFade();return;}
  enableSolidWipe();
  const threshold=THREE.MathUtils.lerp(
   netClipBounds[0],netClipBounds[1],1-amount
  );
  netClipPlane.constant=-threshold;
 }
 function setNetFade(seconds){
  if(phase!=="open")return;
  // The duck video must start with NO residual semi-transparent machine
  // geometry; the box has already finished its own pre-music dissolve.
  applyNetOpacity(0);
 }
 function clearWatchdog(){
  if(completionWatchdog!==null)clearTimeout(completionWatchdog);
  completionWatchdog=null;
 }
 const END=THREE.MathUtils;
 const cue=()=>!!window.NothingHereAudio?.playFinale?.(CAT_REFERENCE_DURATION);
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
 function syncSkipButton(){
  if(!skipButton)return;
  const musicOn=window.NothingHereAudio?.getState?.().musicEnabled!==false;
  skipButton.hidden=phase!=="open"||musicOn||
   !duckShow.getState().dancing;
 }
 window.addEventListener("nothing-here-finale-music-state",syncSkipButton);
 window.addEventListener("nothing-here-finale-ended",()=>{
  requestAnimationFrame(syncSkipButton);
 });
 skipButton?.addEventListener("click",()=>{
  if(phase!=="open"||!duckShow.skipSilentVideo())return;
  window.NothingHereAudio?.stopFinale?.();
  syncSkipButton();
 });
 function showBanner(next){
  if(!banner)return;
  banner.hidden=false;
  banner.dataset.phase=next;
  if(replayButton)replayButton.hidden=next!=="open";
  syncSkipButton();
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
  // Preserve the ORIGINAL 3D brass frame by attaching every rail/corner
  // to an existing hinged panel. Object3D.attach keeps the EXACT folded
  // world transform, including textures and highlights, with no pop on
  // the first opening frame. The trim then follows the actual panels
  // instead of suddenly vanishing while the cube is still folded.
  const frameGroups={front:frontFace,back:backFace,left:leftFace,
   right:rightFace,top:topFace,bottom:bottomFace};
  for(const entry of framePieces){
   const node=entry.node,geometry=node.geometry;
   // Both meshes AND compound detail groups must follow a moving wall.
   // Previously non-Mesh cube children were simply skipped here, so
   // complicated ornaments stayed at the original cube coordinates.
   if(geometry&&!geometry.boundingBox)geometry.computeBoundingBox();
   const size=geometry?geometry.boundingBox.getSize(new THREE.Vector3()):
    new THREE.Vector3();
   const {x,y,z}=node.position;
   let owner;
   if(!geometry){
    // A compound fitting can be attached to the nearest physical face.
    // Its complete child hierarchy follows the same hinge afterward.
    const max=Math.max(Math.abs(x),Math.abs(y),Math.abs(z));
    owner=max===Math.abs(y)?(y>=0?"top":"bottom"):
     max===Math.abs(x)?(x>=0?"right":"left"):
     z>=0?"front":"back";
   }else if(Math.max(size.x,size.y,size.z)<.45){
    // Corner fittings stay with their matching top/bottom covers.
    owner=y>=0?"top":"bottom";
   }else if(size.x>size.y&&size.x>size.z){
    owner=y>0?(z>0?"top":"back"):(z>0?"front":"bottom");
   }else if(size.y>size.x&&size.y>size.z){
    owner=x<0?(z>0?"left":"back"):(z>0?"front":"right");
   }else{
    owner=y>0?(x<0?"top":"right"):(x<0?"left":"bottom");
   }
   frameGroups[owner].attach(node);
   node.userData.finaleAttachedFramePanel=owner;
  }
  // Reverse enamels are only revealed when panels actually separate;
  // these supplement their ORIGINAL front textures rather than replacing
  // or covering any geometry while the box is still upright.

  const gold=new THREE.MeshPhysicalMaterial({
   color:0xd5b883,metalness:.65,roughness:.28,clearcoat:.28
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
   // Do not overlay replacement rails on the original ones.
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
  // Never discard the frame during the duck's emergence, unfolding, or
  // finished T. Every original frame element belongs to a hinged panel.
  for(const {node,visible} of framePieces)node.visible=visible;
  // Add the six reverse panel textures once the sides actually spread.
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
  // textured surface becomes a HORIZONTAL floor beneath the 3D duck.
  cube.rotation.set(-Math.PI/2,0,0);
  cube.position.set(0,0,3.5);
  cube.scale.setScalar(fit());
  // Look at the duck nearly at eye level once the box opens. The earlier
  // high 6.5 viewpoint hid its muzzle and exaggerated the ears.
  controls.target.set(0,.55,0);
  camera.position.set(0,5.7,18.4);
  camera.lookAt(controls.target);
  controls.update();
  setFrames(true);
  invalidate();
 }
 function resetForReplay(){
  duckShow.stop();
  if(skipButton)skipButton.hidden=true;
  rise.progress=0;
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
  window.NothingHereAudio?.stopWindUp?.();
  placeNet();
  phase="open";
  if(keepNetForInspection)resetNetFade();
  else applyNetOpacity(0);
  showBanner("open");
  // Start the music FIRST, then authorize the duck's beat clock. If the
  // MP3 buffers for a second, it must remain still rather than sprinting
  // ahead using performance.now() while the speakers are silent.
  const audioAccepted=audioAtFinish?cue():false;
  // No soundtrack means no wall-clock-driven duck dance.
  duckShow.start({syncToAudio:true});
  syncSkipButton();
  audioAtFinish=false;
  controls.enabled=true; // Orbit the unfolded object; never reactivate puzzles.
  controls.enableRotate=true;
  if(stage.querySelector("canvas"))
   stage.querySelector("canvas").setAttribute("aria-label",
    "Finished Nothing Here: the three-dimensional Crilo Classic duck emerges from the box, then its six panels form a horizontal T and fade into a light show.");
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
  window.NothingHereAudio?.pauseLobbyMusic?.();
  dismissInspection?.();
  controls.enabled=false;
  // Start the duck soundtrack only AFTER the final panel lands. The replay
  // click unlocks Web Audio; normal completion uses the last puzzle click.
  audioAtFinish=audio;
  if(audio){
   window.NothingHereAudio?.prepareFinale?.();
   window.NothingHereAudio?.startWindUp?.();
  }
  duckShow.stop();
  rise.progress=0;
  // The opening is at the upright cube's actual top plane, not the
  // rotating front panel. Freeze this world-space point for the whole
  // emergence so later folding/translation cannot drag the duck through
  // any of the box's six physical faces.
  boxPoint.set(0,half+.12,-half*.14)
   .multiply(originalScale).add(originalPosition);
  cube.parent?.localToWorld(boxPoint);
  if(!animate||reducedMotion){finish();return true;}
  setFrames(false);
  const scale=fit();
  // Opening order: lid moves first; the very same cat floats up from
  // INSIDE the physical box; only then do its sides spread out into the
  // horizontal T. The music and T fade remain unchanged after this.
  timeline=gsap.timeline({
   onUpdate:()=>{
    if(phase==="opening"){
     window.NothingHereAudio?.syncWindUp?.(timeline.time());
     // All six faces and their detail fade as ONE sculpture while the
     // ordinary stage is still behind them. Never show their ghosted
     // glass/metal over the green music-video background.
     if(timeline.time()>=8.98)
      applyNetOpacity(1-END.smoothstep(timeline.time(),8.98,9.68));
     else if(netOpacity<.999)resetNetFade();
    }
    if(phase==="opening"&&timeline.time()>=1.55){
     cube.updateWorldMatrix(true,true);
     frontFace.updateWorldMatrix(true,false);
     frontFace.getWorldPosition(landingPoint);
     // Prevent the duck's feet from going through the real upper front
     // edge during the T rotation, not merely a guessed box-center offset.
     frontRimPoint.set(0,half,0);
     frontFace.localToWorld(frontRimPoint);
     // Entrance is deliberately two stages: rise out of the still-upright
     // box (1.55–4.55s), THEN drift forward as the box unfolds (4.8–8.85s).
     const departure=END.smoothstep(timeline.time(),4.8,8.85);
     const cameraFraction=END.clamp((timeline.time()-3.0)/5.8,0,1);
     const scaleCap=.46+.54*Math.pow(cameraFraction,3);
     duckShow.previewEmergence(rise.progress,boxPoint,landingPoint,
      scaleCap,departure,frontRimPoint.y);
    }
    invalidate();
   },
   onComplete:finish
  });
  // Pull the camera back BEFORE the duck emerges and aim higher during
  // its rise, then ease down to the normal front-facing light-show framing.
  timeline.to(camera.position,{x:0,y:4.7,z:14.2,duration:1.5,ease:"power2.out"},0)
   .to(camera.position,{x:0,y:5.7,z:18.4,duration:7.4,ease:"power2.inOut"},1.5)
   .to(controls.target,{x:0,y:1.45,z:0,duration:1.5,ease:"power2.out"},0)
   .to(controls.target,{x:0,y:.55,z:0,duration:7.4,ease:"power2.inOut"},1.5)
   // Square the object upright before the reveal even when the player
   // finishes the last puzzle with the cube rotated upside down.
   .to(cube.rotation,{x:0,y:0,z:0,duration:.85,ease:"power2.inOut"},0)
   // Crack open the far lid while the side walls still form a recognizable box.
   .to(joints.top.rotation,{x:Math.PI/2,duration:1.1,ease:"power2.inOut"},.35)
   // At 1.40s the entire original folded cube must remain fully detailed.
   // Do not show the replacement backings until the actual side unfolding.
   .call(()=>setFrames(true),null,6.14)
   // The duck exits all the way ABOVE the top rim while the cube stays
   // square and full size. Only once its feet clear the rim can the six
   // panels rotate into a horizontal T beneath it.
   .to(rise,{progress:1,duration:3.0,ease:"power2.out"},1.55)
   .to(cube.scale,{x:scale,y:scale,z:scale,duration:4.05,ease:"power2.inOut"},4.8)
   .to(cube.position,{x:0,y:0,z:3.5,duration:4.05,ease:"power2.inOut"},4.8)
   .to(faceRoot.position,{x:0,y:1.18*S,z:-half,duration:4.05,ease:"power2.inOut"},4.8)
   .to(cube.rotation,{x:-Math.PI/2,y:0,z:0,duration:2.55,ease:"power2.inOut"},4.95)
   .to(joints.left.rotation,{y:Math.PI/2,duration:1.3,ease:"power2.inOut"},6.15)
   .to(joints.right.rotation,{y:-Math.PI/2,duration:1.3,ease:"power2.inOut"},6.3)
   .to(joints.bottom.rotation,{x:-Math.PI/2,duration:1.25,ease:"power2.inOut"},6.75)
   .to(joints.back.rotation,{x:-Math.PI/2,duration:1.2,ease:"power2.inOut"},7.65)
   // This extra hold/dissolve happens while the game background is still
   // neutral. Starting the soundtrack is the clean cut to neon.
   .to({phase:0},{phase:1,duration:.7,ease:"power2.inOut"},8.98);
  // Software WebGL can starve GSAP's frame ticker. Never trap a player
  // in a half-unfolded cube if Chromium stalls or goes into background.
  completionWatchdog=setTimeout(()=>{
   if(phase==="opening")finish();
  },22000);
  return true;
 }
 function restoreComplete(){
  if(phase!=="idle")return false;
  ensureJoints();
  phase="open";
  hasPlayed=true;
  document.body.classList.add("nc-finale-active");
  window.NothingHereAudio?.pauseLobbyMusic?.();
  showBanner("open");
  audioAtFinish=false;
  finish();
  duckShow.restore();
  return true;
 }
 replayButton?.addEventListener("click",()=>{
  if(phase==="open")begin({animate:true,audio:true});
 });
 return {
  begin,restoreComplete,
  seekForVisualTest:t=>phase==="open"?duckShow.seekForVisualTest(t):null,
  seekEggEndingForVisualTest:t=>phase==="open"?
   duckShow.seekEggEndingForVisualTest(t):null,
  seekEggCrackForVisualTest:t=>phase==="open"?
   duckShow.seekEggCrackForVisualTest(t):null,
  testPendingAudioForVisualTest:()=>phase==="open"?
   duckShow.simulatePendingAudioForTest():null,
  // Deterministic WebGL regression for the pre-music physical reveal.
  seekOpeningForVisualTest(t){
   if(!["localhost","127.0.0.1"].includes(window.location.hostname))
    return null;
   if(phase!=="opening")begin({animate:true,audio:false});
   timeline.pause().seek(END.clamp(Number(t)||0,0,9.67),false);
   // A deliberately paused WebGL seek may take longer than the real
   // 12.5s watchdog when taking software-rendered screenshots; don't let
   // that timer start the soundtrack in the middle of a test capture.
   clearWatchdog();
   return this.getState();
  },
  onResize(){if(phase==="open"){cube.scale.setScalar(fit());duckShow.onResize();invalidate();}},
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
   const duck=duckShow.getState();
   const cat=duck; // compatibility for older saved-game and smoke-test clients
   const center=frontFace.getWorldPosition(new THREE.Vector3());
   return {phase,hasPlayed,panels:positions,cat,duck,
    entranceProgress:cat.emergenceProgress,
    openingLidAngle:+(joints?.top?.rotation.x??0).toFixed(3),
    openingSideAngle:+(joints?.left?.rotation.y??0).toFixed(3),
    openingCubeTilt:+cube.rotation.x.toFixed(3),
    duckRootClearanceOverFrontRim:duck.catWorldPosition?
     +(duck.catWorldPosition.y-frontFace.localToWorld(
      new THREE.Vector3(0,half,0)).y).toFixed(3):null,
    catRisingFromBox:phase==="opening"&&duck.emerging&&duck.visible,
    duckRisingFromBox:phase==="opening"&&duck.emerging&&duck.visible,
    catRevealedBeforeT:phase==="opening"&&duck.emergenceProgress>.25&&
     joints?.left?.rotation.y<1.20,
    netOpacity:+netOpacity.toFixed(3),
    netFadeTechnique:"opaque-solid-wipe",
    netClipActive,
    netClippedMaterialCount:netClipActive?trackedNetMaterials?.length||0:0,
    netAlteredTransparencyCount:trackedNetMaterials?.filter(([material,original])=>
     material.transparent!==original.transparent||
     material.depthWrite!==original.depthWrite||
     material.opacity!==original.opacity).length||0,
    netFadeComplete:phase==="open"&&netOpacity<=.001&&!faceRoot.visible,
    duckCenteredOverBox:!!duck.catWorldPosition&&
     Math.abs(duck.catWorldPosition.x-center.x)<.02&&
     Math.abs(duck.catWorldPosition.z-center.z)<.02&&
     duck.catWorldPosition.y>center.y+.5,
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
    originalFramePieceCount:framePieces.length,
    originalFrameAttachedCount:framePieces.filter(({node})=>
     !!node.userData.finaleAttachedFramePanel).length,
    originalFrameVisibleCount:framePieces.filter(({node,visible})=>
     node.visible===visible&&node.visible).length,
    originalFramePreserved:framePieces.every(({node,visible})=>
     node.visible===visible&&!!node.userData.finaleAttachedFramePanel),
    // The ONLY remaining direct cube child should be faceRoot. Every
    // physical piece, group, and optimized ornament must be hinged under it.
    rigidCubeOrphanCount:cube.children.filter(node=>node!==faceRoot).length,
    centerFit:Math.abs(controls.target.y-.55)<.1,
    platformHorizontal:Math.abs(cube.rotation.x+Math.PI/2)<.01,
    platformUnderCat:duckShow.getState().platformUnderCat,
    cameraAbovePlatform:camera.position.y>2};
  }
 };
}
