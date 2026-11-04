import * as THREE from "three";
import {gsap} from "gsap";

// Faithful three-dimensional replacements for the original game's actual
// interaction targets. The authoritative puzzle logic stays in cube-secrets.js.
// Nothing in this module writes saves or awards secrets by itself.
export function buildGameHotspots({faces,lidPivot,box,cylinder,setHit,mat,animate,invalidate=()=>{}}) {
 const {frontFace,rightFace,leftFace,topFace,bottomFace,backFace}=faces;
 const brass=mat(0xd0ac75,.7,.32),nickel=mat(0xa0a8ae,.65,.36);
 const graphite=mat(0x46505c,.43,.52),glass=mat(0xa4d8cc,.16,.22);
 const ivory=mat(0xffefd5,.12,.39),red=mat(0xd67378,.1,.32),copper=mat(0xc18f7a,.58,.32);
 let count=0;const targets=new Map();
 // The housing stays bolted to the face; only its independently modeled
 // actuator travels into the socket. Clicks never move entire puzzle faces.
 const actuators=new Map();
 // Reserve two-dimensional footprints on the actual solid cube face, not
 // arbitrary HTML positions. A CI audit catches any new plaque or control
 // placed inside another active touch area.
 const clearanceFootprints=[];
 const faceName=face=>Object.entries(faces)
  .find(([,root])=>root===face)?.[0]||null;
 function reserve(face,name,x,y,w,h){
  const faceId=faceName(face);
  if(faceId)clearanceFootprints.push({face:faceId,name,x,y,w,h});
 }
 function getClearanceViolations(padding=.035){
  const faults=[];
  for(let i=0;i<clearanceFootprints.length;i++)for(let j=i+1;j<clearanceFootprints.length;j++){
   const a=clearanceFootprints[i],b=clearanceFootprints[j];
   if(a.face!==b.face)continue;
   if(Math.abs(a.x-b.x)<(a.w+b.w)/2+padding&&
      Math.abs(a.y-b.y)<(a.h+b.h)/2+padding)
    faults.push(a.face+": "+a.name+" overlaps "+b.name);
  }
  return faults;
 }
 let fluteWaves=[];
 const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 let previousState=null,ventSettleTimer=null,bellSettleTimer=null;
 const releasingFasteners=new Map();
 function fastenerPose(id,part,removed,wasRemoved,restore){
  const inFlight=releasingFasteners.get(id);
  if(inFlight&&removed)return; // Other secrets can re-render mid-animation.
  if(inFlight){
   clearTimeout(inFlight.timer);
   inFlight.tween.kill();releasingFasteners.delete(id);
  }
  gsap.killTweensOf(part.position);gsap.killTweensOf(part.rotation);
  if(!removed){
   part.visible=true;part.position.z=.19;part.rotation.z=0;
   return;
  }
  if(restore||reducedMotion||wasRemoved){
   part.visible=false;part.position.z=.19;part.rotation.z=0;
   return;
  }
  // A real unscrewing action: rotate, pull outward from the threaded seat,
  // then leave the recess EMPTY. Never merely wobble and spring back.
  part.visible=true;
  const finish=()=>{
   const motion=releasingFasteners.get(id);
   if(motion){clearTimeout(motion.timer);releasingFasteners.delete(id);}
   gsap.killTweensOf(part.position);gsap.killTweensOf(part.rotation);
   part.visible=false;invalidate();
  };
  const tween=gsap.timeline({onUpdate:invalidate,onComplete:finish})
   .to(part.rotation,{z:Math.PI*2,duration:.55,ease:"power1.inOut"},0)
   .to(part.position,{z:.43,duration:.55,ease:"power2.out"},0);
  // Throttled GPUs cannot leave a half-extracted fastener covering the
  // exposed clue or reward forever. Always settle on a wall-clock deadline.
  const timer=setTimeout(finish,950);
  releasingFasteners.set(id,{tween,timer});
 }
 function pulse(action){
  if(action==="eye"){
   // The player sees the eyelid close and reopen at the touched model.
   gsap.killTweensOf(blinkLid.scale);
   blinkLid.scale.y=reducedMotion?0:1;
   if(!reducedMotion)gsap.to(blinkLid.scale,{
    y:0,duration:.42,ease:"power2.out",onUpdate:invalidate
   });
   invalidate();return true;
  }
  if(action.startsWith("flute-note-")&&flute.visible&&!reducedMotion){
   // Only show the note produced by the player; the correct melody
   // remains a secret. A tiny brass-colored sound ripple escapes the pipe.
   const index=Number(action.slice(-1))-1;
   const wave=fluteWaves[index];
   if(wave){
    gsap.killTweensOf(wave.scale);
    gsap.killTweensOf(wave.material);
    wave.scale.setScalar(.45);
    wave.material.opacity=.72;
    wave.visible=true;
    gsap.to(wave.scale,{x:1.8,y:1.8,z:1.8,duration:.48,
     ease:"power1.out",onUpdate:invalidate});
    gsap.to(wave.material,{opacity:0,duration:.46,ease:"power1.out",
     onUpdate:invalidate,onComplete:()=>{wave.visible=false;invalidate()}});
   }
  }
  const head=actuators.get(action);
  if(!head)return false;
  gsap.killTweensOf(head.position);
  if(reducedMotion){head.position.z=0;invalidate();return true;}
  // Immediately sink the actuator in its socket, then let its return spring
  // rebound. A click must feel responsive even on slow mobile/WebGL GPUs.
  head.position.z=-.064;
  invalidate();
  gsap.to(head.position,{z:0,delay:.085,duration:.34,ease:"back.out(2.1)",
   onUpdate:invalidate});
  return true;
 }
 function pose(obj,axis,key,target,oldValue,restore,duration=.52){
  if(restore){gsap.killTweensOf(obj[axis]);obj[axis][key]=target;return;}
  if(oldValue===target)return;
  gsap.killTweensOf(obj[axis]);
  if(reducedMotion){obj[axis][key]=target;invalidate();return;}
  gsap.to(obj[axis],{[key]:target,duration,ease:"power2.inOut",onUpdate:invalidate});
 }
 function node(face,x,y,z=0){
  const g=new THREE.Group();g.position.set(x,y,z);face.add(g);return g;
 }
 function B(g,w,h,d,x,y,z,m,r=.025){
  const a=box(g,w,h,d,x,y,z,m,r);a.castShadow=false;count++;return a;
 }
 function C(g,r,d,x,y,z,m){
  const a=cylinder(g,r,d,x,y,z,m);a.castShadow=false;count++;return a;
 }
 function control(face,name,x,y,color=brass,size=.115){
  const radius=["dot","pressure","dent","eye-ring","foot","underside"].includes(name)
   ?Math.max(.14,size*1.35):size*1.2;
  reserve(face,name,x,y,radius*2,radius*2);
  const g=node(face,x,y,.19);
  // Satin-metal annular socket instead of a thick black puck over a gauge.
  C(g,size*1.12,.040,0,0,0,nickel);
  const cap=new THREE.Group();g.add(cap);
  if(name==="dent"){
   // Shape the copper itself with a genuine concave die-struck depression.
   // The middle of this lathed surface is ~.063 deeper than its raised lip:
   // it cannot be mistaken for the flat, slotted screws on the other faces.
   const profile=[
    new THREE.Vector2(0,-.025),
    new THREE.Vector2(size*.85,-.025),
    new THREE.Vector2(size,0),
    new THREE.Vector2(size,.055),
    new THREE.Vector2(size*.85,.072),
    new THREE.Vector2(size*.67,.065),
    new THREE.Vector2(size*.51,.047),
    new THREE.Vector2(size*.30,.023),
    new THREE.Vector2(0,.009)
   ];
   const dieMetal=color.clone();
   dieMetal.side=THREE.DoubleSide;
   const dentSurface=new THREE.Mesh(new THREE.LatheGeometry(profile,48),dieMetal);
   dentSurface.rotation.x=Math.PI/2;
   dentSurface.position.z=.025;
   dentSurface.castShadow=true;cap.add(dentSurface);count++;
   // Fine diagonal score INSIDE the depressed metal, not a slot screwed
   // onto a flat outer cap. Its slight offset looks actually stamped.
   const strike=B(cap,.034,.006,.004,-.025,.017,.054,graphite,.002);
   strike.rotation.z=-.32;
   g.userData.dentProfile={rim:.097,center:.034,depth:.063};
  }else{
   C(cap,size,.075,0,0,.048,color);
   const cross=B(cap,size*.56,.011,.012,0,0,.093,graphite,.003);
   cross.rotation.z=Math.PI/4;
  }
  // Tiny switches must be playable by fingers, not just a precision mouse.
  // The extra hit area is invisible and grows only on major named controls;
  // fasteners and closely spaced code buttons remain individually selectable.
  if(["dot","pressure","dent","eye-ring","foot","underside"].includes(name)){
   const touchRadius=Math.max(.14,size*1.35);
   const touch=new THREE.Mesh(
    new THREE.CylinderGeometry(touchRadius,touchRadius,.042,20),
    new THREE.MeshBasicMaterial({
     transparent:true,opacity:0,colorWrite:false,depthWrite:false,
     side:THREE.DoubleSide
    })
   );
   touch.rotation.x=Math.PI/2;touch.position.z=.142;
   g.add(touch);
  }
  actuators.set(name,cap);
  setHit(g,name);targets.set(name,g);return g;
 }
 function tab(face,name,x,y,color=brass,w=.27,h=.12){
  reserve(face,name,x,y,w+.075,h+.06);
  const g=node(face,x,y,.18);
  // Physical side-tab on a slender polished-metal carrier, not a tall
  // black cuboid that looks accidentally pasted over neighboring labels.
  B(g,w+.048,h+.034,.037,0,0,0,nickel,.017);
  const slider=new THREE.Group();g.add(slider);
  B(slider,w,h,.063,0,0,.046,color,.019);
  B(slider,w*.42,.012,.012,0,0,.088,ivory,.004);
  actuators.set(name,slider);
  setHit(g,name);targets.set(name,g);return g;
 }

 // Tiny engraved plates make the machine readable even when not hovering.
 // These are solid bolted-on housings, not detached 2D text overlays.
 function engraving(face,words,x,y,w=.47){
  // The four numbered vent legends are closer together than the larger
  // descriptive nameplates. Give the numerals compact fitted bezels so
  // none of their neighbouring metal frames collide or trigger the
  // cross-face safety margin used by geometric QA.
  const h=/^[1-4]$/.test(words)?.116:.143;
  // Conditional inscriptions are only exposed after their covering control
  // has physically moved; audit permanent visible faceplates separately.
  if(!["3 · 1 · 4 · 2 · 3","A / Ⅱ · Ⅰ · Ⅲ","B / Ⅰ · Ⅲ · Ⅱ"].includes(words))
   reserve(face,"plaque "+words,x,y,w+.055,h+.043);
  const g=node(face,x,y,.158);
  B(g,w+.045,h+.029,.036,0,0,0,nickel,.014);
  B(g,w,h,.020,0,0,.035,ivory,.012);
  const canvas=document.createElement("canvas");canvas.width=384;canvas.height=108;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,384,108);
  ctx.fillStyle="#58616a";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="bold 52px system-ui,sans-serif";
  ctx.fillText(words,192,58,360);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(w*.90,h*.79),
   new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  sheet.position.z=.048;g.add(sheet);count++;
  for(const sign of [-1,1]){
   C(g,.016,.014,sign*(w/2-.033),0,.053,brass);
  }
  return g;
 }
 // Front: actual fasteners are supplied by the base physical model.
 control(frontFace,"latch",-1.05,.11,brass,.145);
 engraving(frontFace,"LATCH", -1.04,-.30,.43);
 const redSwitch=control(frontFace,"dot",1.10,.15,red,.100);
 // The red button's retaining collar turns a small detent on every press,
 // and only glows AFTER the hidden reward is collected. No popup, visible
 // click counter, or advance clue about the required press count.
 const redCollarMaterial=mat(0xd6b29a,.54,.30);
 redCollarMaterial.emissive.setHex(0x659e83);
 redCollarMaterial.emissiveIntensity=0;
 const redCollar=new THREE.Group();redCollar.position.z=.111;redSwitch.add(redCollar);
 const redIndex=new THREE.Mesh(
  new THREE.TorusGeometry(.155,.012,7,36,Math.PI*.46),redCollarMaterial);
 redCollar.add(redIndex);count++;
 engraving(frontFace,"RED",1.08,-.25,.36);
 // The three removable front screws mechanically free a captive
 // service hatch. The reward gear is seated BEHIND this hatch, not in the
 // main lens or in an unrelated cube offering button.
 // The slim left rail lies between SERIAL, LATCH and the optical bezel.
 reserve(frontFace,"cog service hatch",-1.15,.56,.34,.32);
 const cogPort=node(frontFace,-1.15,.56,.19);
 C(cogPort,.168,.035,0,0,0,nickel);
 C(cogPort,.132,.021,0,0,.027,graphite);
 const cogPocket=node(cogPort,0,0,.047);
 targets.set("front-cog-pocket",cogPocket);
 // A real pin on the left edge supports the small cover; its hinge travels
 // sideways into the adjacent clear rail without masking the reward.
 const cogCover=node(cogPort,-.149,0,.079);
 C(cogCover,.024,.062,0,0,.007,brass);
 const cogCoverDisc=node(cogCover,.149,0,.031);
 C(cogCoverDisc,.162,.030,0,0,0,graphite);
 C(cogCoverDisc,.144,.017,0,0,.024,nickel);
 C(cogCoverDisc,.026,.025,0,0,.046,brass);
 for(const y of [-.08,.08])C(cogCoverDisc,.013,.012,.09,y,.043,brass);
 // The socket is a pocket: its cover moves, but does not spawn the gear.
 // A loaded save restores the open cover immediately without reanimation.
 const cogDoorPose=()=>cogCover.rotation.y;
 // A smaller real maker-stamp actuator sits beside the outer lens rather
 // than directly through its upper brass rim and decorative inscription.
 tab(frontFace,"serial",-.99,.96,nickel,.38,.10);
 // Raised center receiver, used both to inspect and to offer objects.
 const offering=node(frontFace,0,.59,.52);
 const symbol=C(offering,.13,.065,0,0,0,ivory);
 C(offering,.080,.072,0,0,.052,glass);
 setHit(offering,"cube-offer");targets.set("cube-offer",offering);
 // Right: a service seam, sliding shutter and four genuine bolt heads.
 // This slim service switch belongs on the *outer rail*, not partly
 // inside the real teal drawer bezel. Its plaque sits below the switch.
 tab(rightFace,"seam",-1.13,.31,copper,.22,.16);
 engraving(rightFace,"RELEASE",-1.13,.02,.43);
 tab(rightFace,"shutter",.58,-1.08,nickel,.40,.19);
 engraving(rightFace,"SERVICE",.58,-1.39,.43);
 // There is ONE removable service bolt on this face. The other three
 // were fake moving screwheads with no unlock effect, duplicated again by
 // the base model and confused with corner trim. Remove those click targets
 // entirely rather than pretending every decorative rivet is a mechanism.
 const serviceSocket=node(rightFace,1.23,1.20,.133);
 C(serviceSocket,.083,.019,0,0,0,graphite);
 C(serviceSocket,.060,.018,0,0,.015,nickel);
 const serviceBolt=control(rightFace,"right-bolt-1",1.23,1.20,copper,.065);
 // The vent order is engraved INSIDE the empty fastener recess: it is
 // not visible until the player actually loosens the appropriate bolt.
 const ventCipher=engraving(rightFace,"3 · 1 · 4 · 2 · 3",.91,1.25,.75);
 ventCipher.visible=false;
 // Once exposed, the actual engraved strip can be pressed to read its
 // tiny marks. This adds no pop-up or duplicate off-box clue.
 setHit(ventCipher,"read:vents");targets.set("read:vents",ventCipher);
 // Four small numbered switches run a five-step service sequence.
 // Each has a separate finger-size contact without overlap; the matching
 // code stays behind the removable rivet on the opposite side.
 for(let i=1;i<=4;i++){
  const y=1.165-(i-1)*.22;
  tab(leftFace,"vent-"+i,-.98,y,graphite,.23,.115);
  engraving(leftFace,String(i),-.65,y,.15);
 }
 engraving(leftFace,"VENT",-.95,.26,.37);
 // The numbered vent keys must have a consequence *on the metal face*.
 // Their shared hatch is tucked below the label, above the elevator mount,
 // and left of the gears, with a true recessed cavity under its shutter.
 // No flat reward screen or extra selectable fake vent.
 const ventHatch=node(leftFace,-.99,-.04,.155);
 B(ventHatch,.47,.26,.048,0,0,0,brass,.020);
 B(ventHatch,.393,.193,.024,0,0,.035,graphite,.016);
 for(const y of [-.068,-.017,.034,.085])
  B(ventHatch,.33,.009,.012,0,y,.054,nickel,.004);
 // The shim actually lives UNDER the sliding grille, rather than
 // materializing on the third numbered vent button.
 const ventPocket=node(ventHatch,0,.015,.085);
 targets.set("vent-pocket",ventPocket);
 const ventCover=new THREE.Group();ventCover.position.set(0,0,.075);ventHatch.add(ventCover);
 B(ventCover,.365,.166,.039,0,0,0,graphite,.014);
 B(ventCover,.306,.012,.016,0,0,.028,brass,.005);
 for(const x of [-.14,.14])C(ventCover,.013,.013,x,0,.031,nickel);
 // Five fixed inlaid lamps show the number of received key presses. The
 // hidden sequence still must be found; the lamps do not disclose it.
 const ventStepLights=[];
 for(let i=0;i<5;i++){
  const x=(i-2)*.065;
  C(ventHatch,.020,.011,x,.114,.109,graphite);
  const lamp=mat(0x7ca29b,.13,.27);
  lamp.emissive=new THREE.Color(0x5eb59d);
  lamp.emissiveIntensity=0;
  C(ventHatch,.012,.012,x,.114,.121,lamp);
  ventStepLights.push(lamp);
 }
 control(leftFace,"pressure",.88,.64,brass,.15);
 engraving(leftFace,"CALIBRATE",.89,.27,.55);
 // The copper plunger's off-center depression identifies it physically.
 // A redundant DENT plaque made it look like a labelled mystery button,
 // and collided with the lower panel trim, so omit that plate entirely.
 control(leftFace,"dent",.88,-.95,copper,.11);
 // Top: three separate hinge pins, and a tappable triangle physically
 // attached to the moving hatch. The pipe sits INSIDE the fixed well.
 for(const [i,x] of [-.54,0,.54].entries())control(topFace,"hinge-"+i,x,.86,nickel,.075);
 const triangle=tab(lidPivot,"triangle",0,-.42,brass,.30,.19);
 // API alias for the actual top lid, not the underside hatch.
 targets.set("hatch",triangle);
 // The engraving identifies the component without disclosing a click count.
 engraving(lidPivot,"TRIANGLE",0,-.92,.64);
 // The collectible is a genuine HOLLOW cylindrical pipe held inside a
 // recessed bracket, not another flat switch sitting on the cube face.
 const reed=node(topFace,.07,-.22,-.43);
 const pipeBody=new THREE.Mesh(new THREE.CylinderGeometry(.074,.074,.56,20,1,true),
  mat(0xa27758,.1,.66));
 pipeBody.rotation.z=Math.PI/2;pipeBody.castShadow=true;reed.add(pipeBody);count++;
 for(const xx of [-.27,.27]){
  const lip=new THREE.Mesh(new THREE.TorusGeometry(.074,.014,10,24),brass);
  lip.position.x=xx;lip.rotation.y=Math.PI/2;reed.add(lip);count++;
 }
 C(reed,.038,.045,0,0,0,graphite);
 setHit(reed,"top-reed");targets.set("top-reed",reed);
 // The physical flute is clamped to the FIXED lower rail of the top
 // face. Previously it was parented to the hinged lid and rotated nearly
 // edge-on when that lid opened: the instrument appeared unclickable from
 // any normal top view. The permanent rail keeps all three keys facing
 // the player without floating over the compartment or obstructing its
 // triangle latch. The nameplate occupies the opposite half of the rail.
 const flute=node(topFace,-.66,-1.12,.17);
 const fluteTube=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.68,18),copper);
 fluteTube.rotation.z=Math.PI/2;
 flute.add(fluteTube);count++;
 // The curved body itself was never a registered hit target. Players
 // naturally clicked the flute, but only three tiny separate keys worked.
 // Touching its body now opens the instrument in the inventory.
 setHit(fluteTube,"flute-body");targets.set("flute-body",fluteTube);
 for(const x of [-.33,.33]){
  const lip=new THREE.Mesh(new THREE.TorusGeometry(.065,.011,8,20),brass);
  lip.position.x=x;lip.rotation.y=Math.PI/2;flute.add(lip);count++;
  setHit(lip,"flute-body");
 }
 for(const x of [-.24,.24]){
  const brace=B(flute,.07,.19,.075,x,-.045,-.033,graphite,.012);
  setHit(brace,"flute-body");
  C(flute,.029,.024,x,0,.063,brass);
 }
 for(let i=1;i<=3;i++){
  const x=(i-2)*.205;
  const wave=new THREE.Mesh(new THREE.TorusGeometry(.116,.013,7,32),
   new THREE.MeshBasicMaterial({
    color:0xe3c78c,transparent:true,opacity:0,depthWrite:false
   }));
  wave.position.set(x,.11,.075);
  wave.rotation.y=Math.PI/2;
  wave.visible=false;
  flute.add(wave);fluteWaves.push(wave);count++;
  // Each key has a solid stem joining its raised socket to the tube.
  B(flute,.038,.055,.20,x,.015,.065,brass,.012);
  const key=control(flute,"flute-note-"+i,x,.015,ivory,.065);
  key.position.z=.18;
  // Slightly larger, completely invisible solid hit collar. Finger-size
  // input should work even when the rendered brass pad is only a few pixels.
  const touch=new THREE.Mesh(
   new THREE.CylinderGeometry(.097,.097,.14,20),
   new THREE.MeshBasicMaterial({
    colorWrite:false,depthWrite:false,transparent:true,opacity:0
   })
  );
  touch.rotation.x=Math.PI/2;touch.position.z=.145;
  key.add(touch);
  setHit(touch,"flute-note-"+i);
 }
 // Six small inlaid dots along the physical flute show input progress.
 // They are part of the instrument and are not extra clickable controls.
 const fluteStepLights=[];
 for(let i=0;i<6;i++){
  const x=(i-2.5)*.095;
  const lamp=mat(0x7e9b87,.11,.31);
  lamp.emissive=new THREE.Color(0x7dd3b2);
  lamp.emissiveIntensity=0;
  C(flute,.011,.010,x,-.018,.072,lamp);
  fluteStepLights.push(lamp);
 }
 flute.visible=false;
 // The rear eye must look like an actual eye, rather than the old
 // circular control marked with a cross. Sculpt an almond-shaped white
 // eyeball inside two curved mechanical eyelids, a colored iris, a black
 // pupil and two real glass highlights. This is the sole clickable eye.
 reserve(backFace,"eye",0,-.18,1.48,.77);
 const eyeBody=node(backFace,0,-.18,.192);
 const eyeShape=new THREE.Shape();
 eyeShape.moveTo(-.68,0);
 eyeShape.bezierCurveTo(-.38,.35,.37,.35,.68,0);
 eyeShape.bezierCurveTo(.37,-.35,-.38,-.35,-.68,0);
 eyeShape.closePath();
 const eyeOuter=new THREE.Mesh(new THREE.ExtrudeGeometry(eyeShape,{
  depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,
  bevelSegments:2,curveSegments:32
 }),graphite);
 eyeOuter.castShadow=false;eyeBody.add(eyeOuter);count++;
 const eyeWhiteMaterial=mat(0xf1e9d7,.10,.20);
 const white=new THREE.Mesh(new THREE.ShapeGeometry(eyeShape,32),eyeWhiteMaterial);
 white.scale.set(.90,.81,1);white.position.z=.078;eyeBody.add(white);count++;
 const eyeLidMaterial=mat(0xc7976b,.69,.30);
 const eyeLidLine=(upper)=>{
  const curve=new THREE.CubicBezierCurve3(
   new THREE.Vector3(-.68,0,.092),
   new THREE.Vector3(-.39,upper?.37:-.37,.105),
   new THREE.Vector3(.39,upper?.37:-.37,.105),
   new THREE.Vector3(.68,0,.092)
  );
  const lid=new THREE.Mesh(new THREE.TubeGeometry(curve,36,.034,8,false),eyeLidMaterial);
  lid.castShadow=false;eyeBody.add(lid);count++;
 };
 eyeLidLine(true);eyeLidLine(false);
 const eyeIris=new THREE.Group();
 eyeIris.position.set(.07,-.018,.108);eyeBody.add(eyeIris);
 const irisMaterial=mat(0x5a9d9e,.26,.16);
 irisMaterial.emissive=new THREE.Color(0x255c61);
 irisMaterial.emissiveIntensity=.12;
 const irisDisc=new THREE.Mesh(new THREE.SphereGeometry(.212,28,20),irisMaterial);
 irisDisc.scale.set(1,1,.28);eyeIris.add(irisDisc);count++;
 const irisRim=new THREE.Mesh(new THREE.TorusGeometry(.20,.020,9,40),eyeLidMaterial);
 irisRim.position.z=.027;eyeIris.add(irisRim);count++;
 // Tiny radial etched fibers distinguish this from another plain blue dial.
 for(let i=0;i<20;i++){
  const a=i*Math.PI/10,ray=new THREE.Mesh(
   new THREE.BoxGeometry(.043,.007,.006),i%2?graphite:ivory);
  ray.position.set(Math.cos(a)*.139,Math.sin(a)*.139,.039);
  ray.rotation.z=a;eyeIris.add(ray);count++;
 }
 const eyePupilMaterial=mat(0x15212a,.15,.10);
 const eyePupil=new THREE.Mesh(new THREE.SphereGeometry(.098,24,18),eyePupilMaterial);
 eyePupil.scale.z=.40;eyePupil.position.z=.061;eyeIris.add(eyePupil);count++;
 for(const [x,y,r] of [[-.050,.061,.033],[.052,-.038,.014]]){
  const reflection=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),ivory);
  reflection.scale.z=.4;reflection.position.set(x,y,.107);
  eyeIris.add(reflection);count++;
 }
 // Pressing the eye briefly closes a captive upper eyelid, then the iris
 // centers as the hidden engraved code is mechanically revealed below.
 const blinkShape=new THREE.Shape();
 blinkShape.moveTo(-.61,0);
 blinkShape.bezierCurveTo(-.38,.275,.38,.275,.61,0);
 blinkShape.lineTo(-.61,0);
 const blinkLid=new THREE.Mesh(new THREE.ShapeGeometry(blinkShape,24),eyeLidMaterial);
 blinkLid.position.z=.196;blinkLid.scale.y=0;eyeBody.add(blinkLid);count++;
 setHit(eyeBody,"eye");targets.set("eye",eyeBody);
 // Keep the 2 · 1 · 3 clue on the free bottom-center rail, NOT inside
 // the eyelids or the circular lens. It has its own clear embossed plate.
 // Left is the bag-code cassette, right is the iris gear enclosure.
 const eyeCipher=engraving(backFace,"A / Ⅱ · Ⅰ · Ⅲ",.075,-1.395,.70);
 eyeCipher.visible=false;
 setHit(eyeCipher,"read:score-a");targets.set("read:score-a",eyeCipher);
 // One purposeful, flush-mounted iris control. The engraved header,
 // protected grille and small ratcheting dial share a single bolted housing,
 // with deliberate gaps so the large optical lens remains visually dominant.
 const irisModule=node(backFace,1.055,-1.095,.102);
 B(irisModule,.49,.725,.055,0,0,0,graphite,.036);
 B(irisModule,.445,.68,.030,0,0,.039,nickel,.029);
 B(irisModule,.405,.635,.016,0,0,.059,ivory,.024);
 for(const x of [-.207,.207])for(const y of [-.302,.302]){
   C(irisModule,.023,.027,x,y,.080,brass);
 }
 engraving(backFace,"IRIS",1.055,-.817,.335);
 const irisGrille=node(backFace,1.055,-1.060,.181);
 B(irisGrille,.350,.157,.038,0,0,0,graphite,.020);
 B(irisGrille,.295,.105,.024,0,0,.032,nickel,.013);
 for(let i=-2;i<=2;i++) B(irisGrille,.252,.009,.013,0,i*.020,.051,graphite,.003);
 // A single short conduit enters the side of the module. There are no
 // dangling loops, detached terminals or stacked clock-face mechanisms.
 B(backFace,.072,.021,.024,.811,-1.061,.189,copper,.007);
 C(backFace,.033,.025,.831,-1.061,.207,brass);
 control(backFace,"eye-ring",1.055,-1.30,brass,.105);
 // Story changes have real volume, not state indicators drawn over a canvas.
 const portalGroup=node(frontFace,0,.59,.69);
 const halo=new THREE.Mesh(new THREE.TorusGeometry(.245,.024,10,48),mat(0xb3a6df,.52,.20));
 halo.castShadow=false;halo.receiveShadow=true;portalGroup.add(halo);count++;
 const portalCore=C(portalGroup,.165,.046,0,0,-.013,mat(0x9bd9dd,.05,.19));
 portalCore.material.emissive=new THREE.Color(0x407c8c);
 portalCore.material.emissiveIntensity=.37;
 const tinyLandscape=B(portalGroup,.24,.052,.037,0,-.075,.04,mat(0x7eae95,.12,.49),.02);
 portalGroup.visible=false;
 // The real cog is a single collectible in cogPocket. Do not draw
 // a duplicated fake gear on the center optic or offer a ghost reward.
 // The wax cylinder is seated behind the actual service shutter.
 // Keep its carrier anchored to the fixed face, not the moving button.
 const servicePocket=node(rightFace,.58,-1.08,.15);
 targets.set("service-pocket",servicePocket);
 const resonator=node(rightFace,.58,-1.08,.15);
 C(resonator,.28,.055,0,0,-.14,graphite);
 const resonatorLight=C(resonator,.15,.055,0,0,-.10,glass);
 resonatorLight.material.emissive=new THREE.Color(0x3d898c);
 resonatorLight.material.emissiveIntensity=.3;
 resonator.visible=false;
 // The four-symbol sequence is engraved on a separate rear optical
 // cassette, hidden until the player calibrates the iris. Never print the
 // solution on the bag's own four metal wheels or on a hover tooltip.
 const cipherMount=node(backFace,-.93,-1.25,.225);
 B(cipherMount,.86,.29,.082,0,0,0,graphite,.034);
 B(cipherMount,.80,.24,.032,0,0,.040,nickel,.025);
 const cipherStrip=new THREE.Group();cipherStrip.position.set(0,0,.062);
 cipherMount.add(cipherStrip);
 B(cipherStrip,.76,.205,.045,0,0,.014,brass,.025);
 B(cipherStrip,.695,.145,.014,0,0,.047,ivory,.013);
 // Four actually sculpted emblems: diamond, ring, crescent and eight-rayed
 // asterisk, each seated in a distinct column of the metal cassette.
 const symbolX=[-.275,-.092,.092,.275];
 const diamond=B(cipherStrip,.082,.082,.022,symbolX[0],0,.068,graphite,.007);
 diamond.rotation.z=Math.PI/4;
 const diamondPin=B(cipherStrip,.024,.024,.026,symbolX[0],0,.084,nickel,.003);
 diamondPin.rotation.z=Math.PI/4;
 const cipherCircle=new THREE.Mesh(new THREE.TorusGeometry(.053,.012,9,28),graphite);
 cipherCircle.position.set(symbolX[1],0,.073);cipherCircle.castShadow=false;
 cipherStrip.add(cipherCircle);count++;
 const crescentShape=new THREE.Shape();
 crescentShape.moveTo(.019,.079);
 crescentShape.bezierCurveTo(-.103,.077,-.103,-.077,.019,-.079);
 crescentShape.bezierCurveTo(-.038,-.025,-.038,.025,.019,.079);
 const crescent=new THREE.Mesh(new THREE.ExtrudeGeometry(crescentShape,{
  depth:.017,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,
  bevelSegments:1,curveSegments:14
 }),graphite);
 crescent.position.set(symbolX[2],0,.062);
 crescent.scale.set(.78,.78,1);
 crescent.castShadow=false;cipherStrip.add(crescent);count++;
 const starShape=new THREE.Shape();
 for(let n=0;n<16;n++){
  const a=n*Math.PI/8-Math.PI/2,r=n%2===0?.073:.026;
  const px=Math.cos(a)*r,py=Math.sin(a)*r;
  if(n===0)starShape.moveTo(px,py);else starShape.lineTo(px,py);
 }
 starShape.closePath();
 const star=new THREE.Mesh(new THREE.ExtrudeGeometry(starShape,{
  depth:.015,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,
  bevelSegments:1,curveSegments:1
 }),graphite);
 star.position.set(symbolX[3],0,.068);
 star.castShadow=false;cipherStrip.add(star);count++;
 for(const x of [-.355,.355])C(cipherStrip,.017,.026,x,0,.066,nickel);
 setHit(cipherStrip,"cipher-strip");targets.set("cipher-strip",cipherStrip);
 cipherStrip.visible=false;
 const miniMoon=node(backFace,-.72,.42,.24);
 C(miniMoon,.18,.085,0,0,0,ivory);
 for(const xy of [[-.05,.035],[.07,-.035]])C(miniMoon,.034,.015,xy[0],xy[1],.053,nickel);
 miniMoon.visible=false;
 // A round peephole slides out to show a real mechanical pocket once the
 // player has removed the three correct screws.
 const receiver=targets.get("cube-offer");
 const eyeGear=targets.get("eye-ring");
 const pressureKnob=targets.get("pressure");
 const shutter=targets.get("shutter");
 // One genuine movable rubber foot conceals the second musical phrase.
 // The other three fixed feet are purely structural, in the details layer.
 // A short VERTICAL captive slide retracts toward the outside upper rim.
 // Moving down the face would clip into the squirrel's physical sculpture.
 // The final position clears the musical engraving and all three miniatures.
 const footTrack=node(bottomFace,-1.02,1.19,.145);
 B(footTrack,.062,.43,.024,0,0,0,nickel,.012);
 B(footTrack,.021,.40,.014,0,0,.022,graphite,.006);
 const foot=control(bottomFace,"foot",-1.02,1.02,graphite,.16);
 C(foot,.186,.055,0,0,.018,graphite);
 C(foot,.165,.020,0,0,.049,nickel);
 const engravedSettleTimers=new WeakMap();
 function revealPlate(object,ready,wasReady,restore){
  const wasVisible=object.visible;
  const clearDeadline=()=>{
   const timer=engravedSettleTimers.get(object);
   if(timer!==undefined){
    clearTimeout(timer);engravedSettleTimers.delete(object);
   }
  };
  if(!ready){
   clearDeadline();gsap.killTweensOf(object.position);
   object.visible=false;
   object.position.z=.158;
   return;
  }
  object.visible=true;
  if(restore||reducedMotion){
   clearDeadline();gsap.killTweensOf(object.position);
   object.position.z=.158;
  }else if(!wasReady||!wasVisible){
   // Reveal by sliding up from the actual slot. Never stop with the
   // numbers buried in opaque enamel if a mobile/SwiftShader frame stalls.
   clearDeadline();gsap.killTweensOf(object.position);
   object.position.z=.047;
   gsap.to(object.position,{
    z:.158,duration:.57,ease:"back.out(1.4)",onUpdate:invalidate
   });
   engravedSettleTimers.set(object,setTimeout(()=>{
    engravedSettleTimers.delete(object);
    if(!object.visible)return;
    gsap.killTweensOf(object.position);
    object.position.z=.158;invalidate();
   },1150));
  }
 }
 const undersideCipher=engraving(bottomFace,"B / Ⅰ · Ⅲ · Ⅱ",-1.01,1.00,.62);
 undersideCipher.visible=false;
 setHit(undersideCipher,"read:score-b");targets.set("read:score-b",undersideCipher);
 control(bottomFace,"underside",0,0,brass,.21);
 // A concealed return slot in the cube underside opens when the fourth
 // red-button detent catches. The bell is a separate collectible seated
 // inside this port (created by the pickups module), not a black cube
 // mysteriously appearing on the red button's face.
 const bellPort=node(bottomFace,0,-1.16,.125);
 B(bellPort,.294,.237,.028,0,0,0,nickel,.016);
 B(bellPort,.229,.179,.017,0,0,.027,graphite,.009);
 const bellHatch=node(bellPort,0,0,.052);
 B(bellHatch,.256,.205,.031,0,0,0,nickel,.014);
 B(bellHatch,.216,.151,.012,0,0,.023,brass,.008);
 B(bellHatch,.084,.012,.012,0,0,.031,graphite,.003);
 // No floating BASE plaque across the working central underside dial.
 return {
  count:()=>count,
  getClearanceViolations,
  getCogHatchPose:()=>({angle:cogDoorPose(),open:Math.abs(cogDoorPose())>1.0}),
  getPermanentFaceFootprints:()=>clearanceFootprints.map(item=>({...item})),
  getDentedCopperShape:()=>{
   const obj=targets.get("dent"),data=obj?.userData.dentProfile;
   return obj&&data?{
    x:obj.position.x,y:obj.position.y,depth:data.depth,
    rim:data.rim,center:data.center,
    profileMesh:obj.children.some(group=>group.children?.some(mesh=>
     mesh.isMesh&&mesh.geometry?.type==="LatheGeometry")),
    labelOnFace:clearanceFootprints.some(row=>
     row.face==="leftFace"&&row.name==="plaque DENT")
   }:null;
  },
  actions:[...targets.keys()],
  targets,
  pulse,
  getActuatorDepth:name=>actuators.get(name)?.position.z??null,
  getMechanicalFeedback:()=>({
   ventHatchOffset:ventCover.position.y,
   redCollarAngle:redCollar.rotation.z,
   redRewardGlow:redCollarMaterial.emissiveIntensity,
   bellHatchOffset:bellHatch.position.x,
   ventStepsShown:ventStepLights.filter(lamp=>lamp.emissiveIntensity>.25).length,
   fluteStepsShown:fluteStepLights.filter(lamp=>lamp.emissiveIntensity>.25).length
  }),
  fluteVisible:()=>flute.visible,
  getClueVisibility:()=>({
   serviceNumber:ventCipher.visible,
   footNumber:undersideCipher.visible,
   eyeNumber:eyeCipher.visible,
   bagCode:cipherStrip.visible
  }),
  cipherVisible:()=>cipherStrip.visible,
  getEyeClueObject:()=>eyeCipher,
  getEyeClueLayout:()=>({
   eye:{x:0,y:-.18,width:1.48,height:.77},
   clue:{x:eyeCipher.position.x,y:eyeCipher.position.y,width:.755,height:.19,
    z:eyeCipher.position.z,visible:eyeCipher.visible},
   iris:{x:1.055,y:-1.095,width:.49,height:.725},
   bagCode:{x:-.93,y:-1.25,width:.86,height:.29},
   eyeVisual:{hasAlmond:true,irisX:eyeIris.position.x,pupilVisible:eyePupil.visible}
  }),
  setState(s){
   const restore=!previousState;
   const previous=previousState||{};
   const cipherReady=(s.eyeRingTicks||0)>=3;
   if(cipherReady&&!cipherStrip.visible){
    cipherStrip.visible=true;
    cipherStrip.position.y=restore||reducedMotion?0:.085;
    if(!restore&&!reducedMotion){
     gsap.killTweensOf(cipherStrip.position);
     gsap.to(cipherStrip.position,{
      y:0,duration:.48,ease:"power2.out",onUpdate:invalidate
     });
    }
   }else if(!cipherReady){
    gsap.killTweensOf(cipherStrip.position);
    cipherStrip.visible=false;
    cipherStrip.position.y=0;
   }
   revealPlate(ventCipher,!!s.rightBoltLoose,!!previous.rightBoltLoose,restore);
   revealPlate(undersideCipher,!!s.footChecked,!!previous.footChecked,restore);
   revealPlate(eyeCipher,!!s.back,!!previous.back,restore);
   pose(eyeIris,"position","x",s.back?0:.07,
    previous.back?0:.07,restore,.50);
   irisMaterial.emissiveIntensity=s.back?.28:.12;
   // Correctly ordered vent keys withdraw the captive shutter over the
   // physical grille. A restored save shows the final pose immediately.
   pose(ventCover,"position","y",s.ventOpen?-.20:0,
    previous.ventOpen?-.20:0,restore,.68);
   // Only replace an outstanding settle deadline when the actual puzzle
   // changes. Re-rendering an unchanged state must NOT cancel the one-shot
   // fallback while a software GPU has stalled its animation frames.
   const ventChanged=!!s.ventOpen!==!!previous.ventOpen;
   if(restore||reducedMotion||ventChanged){
    if(ventSettleTimer!==null)clearTimeout(ventSettleTimer);
    ventSettleTimer=null;
   }
   if(!restore&&!reducedMotion&&ventChanged){
    const end=s.ventOpen?-.20:0;
    ventSettleTimer=setTimeout(()=>{
     gsap.killTweensOf(ventCover.position);
     ventCover.position.y=end;
     ventSettleTimer=null;invalidate();
    },1100);
   }
   const clicks=Math.max(0,Number(s.redHits)||0);
   pose(redCollar,"rotation","z",clicks*.28,
    (Number(previous.redHits)||0)*.28,restore,.27);
   redCollarMaterial.emissiveIntensity=clicks>=4?.75:0;
   pose(bellHatch,"position","x",clicks>=4?.305:0,
    (Number(previous.redHits)||0)>=4?.305:0,restore,.46);
   // With slow software WebGL the browser can delay animation frames
   // beyond the click and collection. Guarantee the hatch completes its
   // REAL sliding motion, even if GSAP's animation loop is starved.
   const bellReady=clicks>=4;
   const bellWasReady=(Number(previous.redHits)||0)>=4;
   if(restore||reducedMotion||bellReady!==bellWasReady){
    if(bellSettleTimer!==null)clearTimeout(bellSettleTimer);
    bellSettleTimer=null;
   }
   if(!restore&&!reducedMotion&&bellReady!==bellWasReady){
    bellSettleTimer=setTimeout(()=>{
     gsap.killTweensOf(bellHatch.position);
     bellHatch.position.x=bellReady?.305:0;
     bellSettleTimer=null;
     invalidate();
    },1050);
   }
   pose(foot,"position","y",s.footChecked?1.35:1.02,
     previous.footChecked?1.35:1.02,restore,.46);
   // A crafted flute exists on the outside of the lid even when an older
   // save is missing its top-open flag. Pocket ownership is authoritative.
   flute.visible=Array.isArray(s.pocket)&&s.pocket.includes("flute");
   portalGroup.visible=!!s.portal;
   miniMoon.visible=!!s.moon;
   // Removing the third screw releases the cover on a real hinge,
   // exposing the gear's already-machined socket. No second decorative
   // gear ever appears on the large glass eye.
   pose(cogCover,"rotation","y",s.plateOpen?-1.30:0,
    previous.plateOpen?-1.30:0,restore,.72);
   resonator.visible=!!s.resonance;
   pose(eyeGear,"rotation","z",(s.eyeRingTicks||0)*Math.PI/8,
    (previous.eyeRingTicks||0)*Math.PI/8,restore,.48);
   pose(pressureKnob,"rotation","z",(s.pressureTicks||0)*Math.PI/6,
    (previous.pressureTicks||0)*Math.PI/6,restore,.58);
   pose(shutter,"position","x",s.serviceOpen?.78:.58,
    previous.serviceOpen?.78:.58,restore,.64);
   resonatorLight.material.emissiveIntensity=s.serviceOpen?1.4:.3;
   for(const [name,g] of targets){
    if(name==="top-reed")g.visible=!!s.top&&!s.pipeTaken;
    else if(name==="right-bolt-1")
     fastenerPose(name,g,!!s.rightBoltLoose,!!previous.rightBoltLoose,restore);
    else if(name.startsWith("hinge-"))
     fastenerPose(name,g,!!s.hingePins?.includes(Number(name.slice(-1))),
      !!previous.hingePins?.includes(Number(name.slice(-1))),restore);
    else if(name==="shutter")pose(g,"rotation","z",s.serviceOpen?.12:0,
      previous.serviceOpen?.12:0,restore,.60);
    else if(name.startsWith("vent-"))pose(g,"position","z",s.ventOpen?.23:.18,
      previous.ventOpen?.23:.18,restore,.65);
   }
   // Saved code buffers drive the small lamp inlays. An incorrect five-
   // or six-step attempt visibly resets its respective indicator row.
   const ventSteps=s.ventOpen?5:Math.min(5,s.ventSequence?.length||0);
   const fluteSteps=s.door?6:Math.min(6,s.fluteNotes?.length||0);
   ventStepLights.forEach((lamp,i)=>lamp.emissiveIntensity=i<ventSteps?1.1:0);
   fluteStepLights.forEach((lamp,i)=>lamp.emissiveIntensity=i<fluteSteps?.85:0);
   previousState={
    plateOpen:!!s.plateOpen,eyeRingTicks:s.eyeRingTicks||0,
    pressureTicks:s.pressureTicks||0,serviceOpen:!!s.serviceOpen,
    ventOpen:!!s.ventOpen,redHits:Number(s.redHits)||0,
    footChecked:!!s.footChecked,
    rightBoltLoose:!!s.rightBoltLoose,
    hingePins:[...(s.hingePins||[])],back:!!s.back
   };
   invalidate();
  }
 };
}
