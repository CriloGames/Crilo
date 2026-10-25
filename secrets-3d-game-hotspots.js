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
 let fluteWaves=[];
 const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 let previousState=null;
 function pulse(action){
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
  const g=node(face,x,y,.19);
  C(g,size*1.20,.06,0,0,0,graphite);
  const cap=new THREE.Group();g.add(cap);
  C(cap,size,.075,0,0,.048,color);
  const cross=B(cap,size*.9,.014,.018,0,0,.093,graphite,.004);
  cross.rotation.z=Math.PI/4;
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
  const g=node(face,x,y,.18);
  B(g,w+.075,h+.06,.055,0,0,0,graphite,.025);
  const slider=new THREE.Group();g.add(slider);
  B(slider,w,h,.085,0,0,.057,color,.025);
  B(slider,w*.54,.016,.013,0,0,.113,ivory,.005);
  actuators.set(name,slider);
  setHit(g,name);targets.set(name,g);return g;
 }

 // Tiny engraved plates make the machine readable even when not hovering.
 // These are solid bolted-on housings, not detached 2D text overlays.
 function engraving(face,words,x,y,w=.47){
  const g=node(face,x,y,.158),h=.143;
  B(g,w+.055,h+.043,.054,0,0,0,graphite,.020);
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
 engraving(frontFace,"LATCH", -1.04,-.14,.43);
 control(frontFace,"dot",1.10,.15,red,.100);
 engraving(frontFace,"RED",1.08,-.12,.36);
 tab(frontFace,"serial",0,1.38,nickel,.66,.11);
 // Raised center receiver, used both to inspect and to offer objects.
 const offering=node(frontFace,0,.59,.52);
 const symbol=C(offering,.13,.065,0,0,0,ivory);
 C(offering,.080,.072,0,0,.052,glass);
 setHit(offering,"cube-offer");targets.set("cube-offer",offering);
 // Right: a service seam, sliding shutter and four genuine bolt heads.
 tab(rightFace,"seam",-.92,.26,copper,.22,.16);
 engraving(rightFace,"SEAM",-.91,.49,.43);
 tab(rightFace,"shutter",.80,-1.09,nickel,.40,.19);
 engraving(rightFace,"SERVICE",.78,-1.33,.50);
 for(const [n,x,y] of [[0,-1.23,1.20],[1,1.23,1.20],[2,-1.23,-1.24],[3,1.23,-1.24]])
  control(rightFace,"right-bolt-"+n,x,y,n===1?copper:nickel,.065);
 // The vent order is engraved INSIDE the empty fastener recess: it is
 // not visible until the player actually loosens the appropriate bolt.
 const ventCipher=engraving(rightFace,"3 · 1 · 2",.98,1.25,.50);
 ventCipher.visible=false;
 // Left: the same three numbered physical vent switches used by the
 // original 3-1-2 sequence and an adjustable real pressure control.
 for(let i=1;i<=3;i++){
  const y=1.08-(i-1)*.27;
  tab(leftFace,"vent-"+i,-.98,y,graphite,.27,.14);
  engraving(leftFace,String(i),-.65,y,.15);
 }
 engraving(leftFace,"VENT",-.95,.26,.37);
 control(leftFace,"pressure",.88,.64,brass,.15);
 engraving(leftFace,"GAUGE",.91,.36,.46);
 control(leftFace,"dent",.88,-1.04,copper,.11);
 engraving(leftFace,"DENT",.89,-1.31,.39);
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
 // The combined flute is an actual instrument in the opened top well.
 // It emerges only after the player finds and combines its components.
 // Three genuine spring keypads trigger the SAME old note sequence logic.
 // There is no flat popup and no combination printed on the instrument.
 const flute=node(topFace,-.025,-.435,-.265);
 const fluteTube=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.68,18),copper);
 fluteTube.rotation.z=Math.PI/2;
 flute.add(fluteTube);count++;
 for(const x of [-.33,.33]){
  const lip=new THREE.Mesh(new THREE.TorusGeometry(.065,.011,8,20),brass);
  lip.position.x=x;lip.rotation.y=Math.PI/2;flute.add(lip);count++;
 }
 for(const x of [-.24,.24]){
  B(flute,.07,.19,.075,x,-.045,-.033,graphite,.012);
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
  const key=control(flute,"flute-note-"+i,x,.015,ivory,.065);
  key.position.z=.135;
  // Slightly larger, completely invisible solid hit collar. Finger-size
  // input should work even when the rendered brass pad is only a few pixels.
  const touch=new THREE.Mesh(
   new THREE.CylinderGeometry(.093,.093,.11,16),
   new THREE.MeshBasicMaterial({
    colorWrite:false,depthWrite:false,transparent:true,opacity:0
   })
  );
  touch.rotation.x=Math.PI/2;touch.position.z=.115;
  key.add(touch);
  setHit(touch,"flute-note-"+i);
 }
 flute.visible=false;
 // Back: concentric optical controls and a rotating calibration gear.
 control(backFace,"eye",.07,-.12,glass,.17);
 const eyeCipher=engraving(backFace,"2 · 1 · 3",.03,-.55,.53);
 eyeCipher.visible=false;
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
 const exposedCog=node(frontFace,0,.59,.47);
 const gearHub=C(exposedCog,.12,.09,0,0,0,brass);
 for(let i=0;i<10;i++){
  const a=2*Math.PI*i/10;
  const spoke=B(exposedCog,.105,.039,.04,Math.cos(a)*.15,Math.sin(a)*.15,.06,nickel,.007);
  spoke.rotation.z=a;
 }
 exposedCog.visible=false;
 const resonator=node(rightFace,.80,-1.09,.15);
 C(resonator,.28,.055,0,0,-.14,graphite);
 const resonatorLight=C(resonator,.15,.055,0,0,-.10,glass);
 resonatorLight.material.emissive=new THREE.Color(0x3d898c);
 resonatorLight.material.emissiveIntensity=.3;
 resonator.visible=false;
 // Rear-face cipher: the bag combination is deliberately NOT printed inside
 // the bag. Calibrating the eye ring three times uncovers an inset brass
 // ribbon beside the lens. All three glyphs have true geometric relief.
 const cipherMount=node(backFace,-.93,-1.25,.225);
 B(cipherMount,.86,.29,.082,0,0,0,graphite,.034);
 B(cipherMount,.80,.24,.032,0,0,.040,nickel,.025);
 const cipherStrip=new THREE.Group();cipherStrip.position.set(0,0,.062);
 cipherMount.add(cipherStrip);
 B(cipherStrip,.76,.205,.045,0,0,.014,brass,.025);
 B(cipherStrip,.675,.145,.014,0,0,.047,ivory,.013);
 // ◇ : a die-cut, rotated metal lozenge.
 const diamond=B(cipherStrip,.104,.104,.024,-.220,0,.068,graphite,.008);
 diamond.rotation.z=Math.PI/4;
 const diamondPin=B(cipherStrip,.033,.033,.026,-.220,0,.085,nickel,.004);
 diamondPin.rotation.z=Math.PI/4;
 // ○ : a raised open circle, not a bitmap.
 const cipherCircle=new THREE.Mesh(new THREE.TorusGeometry(.072,.015,9,28),graphite);
 cipherCircle.position.set(0,0,.073);cipherCircle.castShadow=false;
 cipherStrip.add(cipherCircle);count++;
 // ☾ : a bevelled crescent cut from an extruded metal shape.
 const crescentShape=new THREE.Shape();
 crescentShape.moveTo(.019,.079);
 crescentShape.bezierCurveTo(-.103,.077,-.103,-.077,.019,-.079);
 crescentShape.bezierCurveTo(-.038,-.025,-.038,.025,.019,.079);
 const crescent=new THREE.Mesh(new THREE.ExtrudeGeometry(crescentShape,{
  depth:.017,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,
  bevelSegments:1,curveSegments:14
 }),graphite);
 crescent.position.set(.229,0,.062);
 crescent.castShadow=false;cipherStrip.add(crescent);count++;
 for(const x of [-.355,.355])C(cipherStrip,.024,.030,x,0,.065,nickel);
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
 // Bottom: actual protruding rubber support and a separate release hatch.
 const foot=control(bottomFace,"foot",-1.02,1.02,graphite,.16);
 function revealPlate(object,ready,wasReady,restore){
  const wasVisible=object.visible;
  if(!ready){
   gsap.killTweensOf(object.position);
   object.visible=false;
   object.position.z=.158;
   return;
  }
  object.visible=true;
  if(restore||reducedMotion){
   object.position.z=.158;
  }else if(!wasReady||!wasVisible){
   // An engraving slides out of a recessed slot instead of magically
   // appearing in front of opaque metal. No auto-revealed answer text.
   gsap.killTweensOf(object.position);
   object.position.z=.047;
   gsap.to(object.position,{
    z:.158,duration:.57,ease:"back.out(1.4)",onUpdate:invalidate
   });
  }
 }
 const undersideCipher=engraving(bottomFace,"Ⅱ · Ⅰ · Ⅲ",-1.01,1.00,.53);
 undersideCipher.visible=false;
 control(bottomFace,"underside",0,0,brass,.21);
 engraving(bottomFace,"BASE",.50,-.07,.39);
 return {
  count:()=>count,
  actions:[...targets.keys()],
  targets,
  pulse,
  getActuatorDepth:name=>actuators.get(name)?.position.z??null,
  fluteVisible:()=>flute.visible,
  getClueVisibility:()=>({
   serviceNumber:ventCipher.visible,
   footNumber:undersideCipher.visible,
   eyeNumber:eyeCipher.visible,
   bagCode:cipherStrip.visible
  }),
  cipherVisible:()=>cipherStrip.visible,
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
   pose(foot,"position","x",s.footChecked?-1.32:-1.02,
     previous.footChecked?-1.32:-1.02,restore,.46);
   flute.visible=!!s.top&&Array.isArray(s.pocket)&&s.pocket.includes("flute");
   portalGroup.visible=!!s.portal;
   miniMoon.visible=!!s.moon;
   // The cog has fallen directly into inventory after the panel is opened.
   // Only the socket stays behind; a second cog must not remain on the cube.
   exposedCog.visible=false;
   resonator.visible=!!s.resonance;
   pose(receiver,"position","x",s.plateOpen?.37:0,
    previous.plateOpen?.37:0,restore,.7);
   pose(eyeGear,"rotation","z",(s.eyeRingTicks||0)*Math.PI/8,
    (previous.eyeRingTicks||0)*Math.PI/8,restore,.48);
   pose(pressureKnob,"rotation","z",(s.pressureTicks||0)*Math.PI/6,
    (previous.pressureTicks||0)*Math.PI/6,restore,.58);
   pose(shutter,"position","x",s.serviceOpen?1.05:.80,
    previous.serviceOpen?1.05:.80,restore,.64);
   resonatorLight.material.emissiveIntensity=s.serviceOpen?1.4:.3;
   for(const [name,g] of targets){
    if(name==="top-reed")g.visible=!!s.top&&!s.pipeTaken;
    else if(name==="right-bolt-1")g.visible=!s.rightBoltLoose;
    else if(name.startsWith("hinge-"))g.visible=!s.hingePins?.includes(Number(name.slice(-1)));
    else if(name==="shutter")pose(g,"rotation","z",s.serviceOpen?.12:0,
      previous.serviceOpen?.12:0,restore,.60);
    else if(name.startsWith("vent-"))pose(g,"position","z",s.ventOpen?.23:.18,
      previous.ventOpen?.23:.18,restore,.65);
   }
   previousState={
    plateOpen:!!s.plateOpen,eyeRingTicks:s.eyeRingTicks||0,
    pressureTicks:s.pressureTicks||0,serviceOpen:!!s.serviceOpen,
    ventOpen:!!s.ventOpen,footChecked:!!s.footChecked,
    rightBoltLoose:!!s.rightBoltLoose,back:!!s.back
   };
   invalidate();
  }
 };
}
