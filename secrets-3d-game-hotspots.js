import * as THREE from "three";

// Faithful three-dimensional replacements for the original game's actual
// interaction targets. The authoritative puzzle logic stays in cube-secrets.js.
// Nothing in this module writes saves or awards secrets by itself.
export function buildGameHotspots({faces,lidPivot,box,cylinder,setHit,mat,animate}) {
 const {frontFace,rightFace,leftFace,topFace,bottomFace,backFace}=faces;
 const brass=mat(0xd0ac75,.7,.32),nickel=mat(0xa0a8ae,.65,.36);
 const graphite=mat(0x46505c,.43,.52),glass=mat(0xa4d8cc,.16,.22);
 const ivory=mat(0xffefd5,.12,.39),red=mat(0xd67378,.1,.32),copper=mat(0xc18f7a,.58,.32);
 let count=0;const targets=new Map();
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
  C(g,size,.075,0,0,.048,color);
  const cross=B(g,size*.9,.014,.018,0,0,.093,graphite,.004);
  cross.rotation.z=Math.PI/4;
  setHit(g,name);targets.set(name,g);return g;
 }
 function tab(face,name,x,y,color=brass,w=.27,h=.12){
  const g=node(face,x,y,.18);
  B(g,w+.075,h+.06,.055,0,0,0,graphite,.025);
  B(g,w,h,.085,0,0,.057,color,.025);
  B(g,w*.54,.016,.013,0,0,.113,ivory,.005);
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
 engraving(frontFace,"PULL", -1.04,-.14,.35);
 control(frontFace,"dot",1.10,.15,red,.100);
 engraving(frontFace,"PRESS",1.08,-.12,.43);
 tab(frontFace,"serial",0,1.38,nickel,.66,.11);
 // Raised center receiver, used both to inspect and to offer objects.
 const offering=node(frontFace,0,.59,.52);
 const symbol=C(offering,.13,.065,0,0,0,ivory);
 C(offering,.080,.072,0,0,.052,glass);
 setHit(offering,"cube-offer");targets.set("cube-offer",offering);
 // Right: a service seam, sliding shutter and four genuine bolt heads.
 tab(rightFace,"seam",-.92,.26,copper,.22,.16);
 engraving(rightFace,"SLIDE",-.91,.49,.43);
 tab(rightFace,"shutter",.80,-1.09,nickel,.40,.19);
 engraving(rightFace,"SERVICE",.78,-1.33,.50);
 for(const [n,x,y] of [[0,-1.23,1.20],[1,1.23,1.20],[2,-1.23,-1.24],[3,1.23,-1.24]])
  control(rightFace,"right-bolt-"+n,x,y,n===1?copper:nickel,.065);
 // Left: the same three numbered physical vent switches used by the
 // original 3-1-2 sequence and an adjustable real pressure control.
 for(let i=1;i<=3;i++)tab(leftFace,"vent-"+i,-.98,1.08-(i-1)*.27,graphite,.27,.14);
 engraving(leftFace,"VENT",-.95,.26,.37);
 control(leftFace,"pressure",.88,.64,brass,.15);
 engraving(leftFace,"TURN",.91,.36,.35);
 control(leftFace,"dent",.88,-1.04,copper,.11);
 engraving(leftFace,"PUSH",.89,-1.31,.35);
 // Top: three separate hinge pins, and a tappable triangle physically
 // attached to the moving hatch. The pipe sits INSIDE the fixed well.
 for(const [i,x] of [-.54,0,.54].entries())control(topFace,"hinge-"+i,x,.86,nickel,.075);
 const triangle=tab(lidPivot,"triangle",0,-.42,brass,.30,.19);
 // The lid itself carries the prompt so it rotates with the mechanism.
 engraving(lidPivot,"TAP 3×",0,-.92,.52);
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
 // Back: concentric optical controls and a rotating calibration gear.
 control(backFace,"eye",.07,-.12,glass,.17);
 control(backFace,"eye-ring",1.02,-1.03,brass,.14);
 engraving(backFace,"ROTATE",1.01,-.75,.49);
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
 control(bottomFace,"foot",-1.02,1.02,graphite,.16);
 control(bottomFace,"hatch",0,0,brass,.21);
 engraving(bottomFace,"OPEN",.50,-.07,.39);
 return {
  count:()=>count,
  actions:[...targets.keys()],
  targets,
  cipherVisible:()=>cipherStrip.visible,
  setState(s){
   const cipherReady=(s.eyeRingTicks||0)>=3;
   if(cipherReady&&!cipherStrip.visible){
    cipherStrip.visible=true;
    cipherStrip.position.y=.085;
    if(animate)animate(cipherStrip.position,{y:0},.48);
    else cipherStrip.position.y=0;
   }else if(!cipherReady){
    cipherStrip.visible=false;
    cipherStrip.position.y=0;
   }
   portalGroup.visible=!!s.portal;
   miniMoon.visible=!!s.moon;
   // The cog has fallen directly into inventory after the panel is opened.
   // Only the socket stays behind; a second cog must not remain on the cube.
   exposedCog.visible=false;
   resonator.visible=!!s.resonance;
   receiver.position.x=s.plateOpen?.37:0;
   eyeGear.rotation.z=(s.eyeRingTicks||0)*Math.PI/8;
   pressureKnob.rotation.z=(s.pressureTicks||0)*Math.PI/6;
   shutter.position.x=s.serviceOpen?1.05:.80;
   resonatorLight.material.emissiveIntensity=s.serviceOpen?1.4:.3;
   for(const [name,g] of targets){
    if(name==="top-reed")g.visible=!!s.top&&!s.pipeTaken;
    else if(name==="right-bolt-1")g.visible=!s.rightBoltLoose;
    else if(name.startsWith("hinge-"))g.visible=!s.hingePins?.includes(Number(name.slice(-1)));
    else if(name==="shutter")g.rotation.z=s.serviceOpen?.12:0;
    else if(name.startsWith("vent-"))g.position.z=s.ventOpen?.23:.18;
   }
  }
 };
}
