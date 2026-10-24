import * as THREE from "three";

// Faithful three-dimensional replacements for the original game's actual
// interaction targets. The authoritative puzzle logic stays in cube-secrets.js.
// Nothing in this module writes saves or awards secrets by itself.
export function buildGameHotspots({faces,lidPivot,box,cylinder,setHit,mat}) {
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
 // Front: actual fasteners are supplied by the base physical model.
 control(frontFace,"latch",-1.05,.11,brass,.145);
 control(frontFace,"dot",1.10,.15,red,.100);
 tab(frontFace,"serial",0,1.38,nickel,.66,.11);
 // Raised center receiver, used both to inspect and to offer objects.
 const offering=node(frontFace,0,.59,.52);
 const symbol=C(offering,.13,.065,0,0,0,ivory);
 C(offering,.080,.072,0,0,.052,glass);
 setHit(offering,"cube-offer");targets.set("cube-offer",offering);
 // Right: a service seam, sliding shutter and four genuine bolt heads.
 tab(rightFace,"seam",-.92,.26,copper,.22,.16);
 tab(rightFace,"shutter",.80,-1.09,nickel,.40,.19);
 for(const [n,x,y] of [[0,-1.23,1.20],[1,1.23,1.20],[2,-1.23,-1.24],[3,1.23,-1.24]])
  control(rightFace,"right-bolt-"+n,x,y,n===1?copper:nickel,.065);
 // Left: the same three numbered physical vent switches used by the
 // original 3-1-2 sequence and an adjustable real pressure control.
 for(let i=1;i<=3;i++)tab(leftFace,"vent-"+i,-.98,1.08-(i-1)*.27,graphite,.27,.14);
 control(leftFace,"pressure",.88,.64,brass,.15);
 control(leftFace,"dent",.88,-1.04,copper,.11);
 // Top: three separate hinge pins, and a tappable triangle physically
 // attached to the moving hatch. The pipe sits INSIDE the fixed well.
 for(const [i,x] of [-.54,0,.54].entries())control(topFace,"hinge-"+i,x,.86,nickel,.075);
 const triangle=tab(lidPivot,"triangle",0,-.42,brass,.30,.19);
 // The lid pivot is offset, but the hollow pipe remains within the well.
 const reed=tab(topFace,"top-reed",.07,-.22,ivory,.48,.13);
 reed.position.z=-.44;
 // Back: concentric optical controls and a rotating calibration gear.
 control(backFace,"eye",.07,-.12,glass,.17);
 control(backFace,"eye-ring",1.02,-1.03,brass,.14);
 // Bottom: actual protruding rubber support and a separate release hatch.
 control(bottomFace,"foot",-1.02,1.02,graphite,.16);
 control(bottomFace,"hatch",0,0,brass,.21);
 return {
  count:()=>count,
  actions:[...targets.keys()],
  targets,
  setState(s){
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
