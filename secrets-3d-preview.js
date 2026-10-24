import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { buildIntricateCube } from "./secrets-3d-details.js?v=3";
import { finishMechanicalArtifact } from "./secrets-3d-finish.js?v=1";

// A genuine hollow box: panels leave real holes for the two sliding trays
// and the top hatch. Drawers have separate floors, walls, backs and fronts.
const stage = document.getElementById("stage");
const status = document.getElementById("status");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
camera.position.set(5.7, 4.7, 7.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.09;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute("aria-label", "Real three-dimensional cube with moving box drawers and lid");
renderer.domElement.setAttribute("tabindex", "0");
stage.prepend(renderer.domElement);
// Physically based studio reflections are essential for enameled metal, glass,
// and brass to read as volumes rather than flat pastel faces.
const pmrem=new THREE.PMREMGenerator(renderer);
const studioRoom=new RoomEnvironment();
const studioReflection=pmrem.fromScene(studioRoom,.035);
scene.environment=studioReflection.texture;
studioRoom.dispose();pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .075;
controls.rotateSpeed = .40;
controls.zoomSpeed = .30;
controls.minDistance = 6.7;
controls.maxDistance = 14;
controls.enablePan = false;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xfff9ee, 0xb4a5a1, 1.35));
const key = new THREE.DirectionalLight(0xfff9ef, 3.15);
key.position.set(-3.4, 10.5, 6.6); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.normalBias = .025;
key.shadow.radius = 4;
key.shadow.camera.left = -8; key.shadow.camera.right = 8;
key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
key.shadow.bias = -.00028;
scene.add(key);
const fill = new THREE.DirectionalLight(0xc6e2ee, 1.15);
fill.position.set(7, 4, -6); scene.add(fill);
const rim = new THREE.PointLight(0xffd3aa, 20, 20);
rim.position.set(1, 5, -4); scene.add(rim);

const mat = (color, metalness = .07, roughness = .36) =>
 new THREE.MeshPhysicalMaterial({color, metalness, roughness, clearcoat: .22, clearcoatRoughness: .25});
const ivory = mat(0xfff4dc, .12, .34);
const metal = mat(0xb8946e, .65, .23);
const darkMetal = mat(0x515966, .56, .39);
const rubber = mat(0x5e5d68, .09, .6);
const brass = mat(0xedcf8f, .69, .24);
const cavityMaterial = mat(0x443f50, .11, .78);
const enamel = {
 front:mat(0xd8c8e6), right:mat(0xa8d4d6), left:mat(0xf0caba),
 top:mat(0xf0dfb2), bottom:mat(0xbeb7de), back:mat(0xcbe0c1)
};
const faceSize = 3.22;
const cube = new THREE.Group();
cube.rotation.set(-.19, -.33, .02);
scene.add(cube);
let objectCount = 0;
const interactiveMeshes = [];

function box(parent, w, h, d, x, y, z, material, radius=.035) {
 const r=Math.min(radius,w*.2,h*.2,d*.2);
 const geometry = new RoundedBoxGeometry(w,h,d,3,r);
 const mesh=new THREE.Mesh(geometry,material);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);objectCount++;
 return mesh;
}
function cylinder(parent,radius,depth,x,y,z,material) {
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,22),material);
 mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);
 mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);objectCount++;return mesh;
}
function setHit(obj,action){
 obj.traverse(node => {if(node.isMesh){node.userData.action=action;interactiveMeshes.push(node)}});
 return obj;
}
function label(parent,text,w,h,x,y,z,background="#fff2de",ink="#6d6176"){
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext("2d");
 ctx.fillStyle=background;ctx.fillRect(0,0,512,128);
 ctx.strokeStyle="rgba(65,72,75,.25)";ctx.lineWidth=7;ctx.strokeRect(5,5,502,118);
 ctx.fillStyle=ink;ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.font="800 39px system-ui, sans-serif";
 ctx.fillText(text,256,64,485);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
 plane.position.set(x,y,z);parent.add(plane);objectCount++;return plane;
}

const faceRoot = new THREE.Group();
cube.add(faceRoot);
const frontFace = new THREE.Group();frontFace.position.z=faceSize/2;faceRoot.add(frontFace);
const backFace = new THREE.Group();backFace.position.z=-faceSize/2;backFace.rotation.y=Math.PI;faceRoot.add(backFace);
const rightFace = new THREE.Group();rightFace.position.x=faceSize/2;rightFace.rotation.y=Math.PI/2;faceRoot.add(rightFace);
const leftFace = new THREE.Group();leftFace.position.x=-faceSize/2;leftFace.rotation.y=-Math.PI/2;faceRoot.add(leftFace);
const topFace = new THREE.Group();topFace.position.y=faceSize/2;topFace.rotation.x=-Math.PI/2;faceRoot.add(topFace);
const bottomFace = new THREE.Group();bottomFace.position.y=-faceSize/2;bottomFace.rotation.x=Math.PI/2;faceRoot.add(bottomFace);

// Cutout-shaped paneling: the face is assembled around the opening, rather
// than drawing a dark rectangle on a solid cube.
function faceAround(group, material, cutW, cutH, cx=0, cy=0) {
 const S=faceSize,T=.145, left=-S/2, right=S/2, top=S/2, bottom=-S/2;
 const xl=cx-cutW/2,xr=cx+cutW/2, yt=cy+cutH/2,yb=cy-cutH/2;
 function piece(x1,x2,y1,y2){
  if(x2-x1<.015||y2-y1<.015)return;
  box(group,x2-x1,y2-y1,T,(x1+x2)/2,(y1+y2)/2,0,material,.035);
 }
 piece(left,xl,bottom,top); piece(xr,right,bottom,top);
 piece(xl,xr,yt,top); piece(xl,xr,bottom,yb);
}
// Make a real shell with three through-cut openings.
const frontHole={x:0,y:-.67,w:1.40,h:.90};
const sideHole={x:-.06,y:-.18,w:1.35,h:.83};
const topHole={x:0,y:0,w:1.70,h:1.36};
faceAround(frontFace,enamel.front,frontHole.w,frontHole.h,frontHole.x,frontHole.y);
faceAround(rightFace,enamel.right,sideHole.w,sideHole.h,sideHole.x,sideHole.y);
faceAround(topFace,enamel.top,topHole.w,topHole.h);
for(const [group,material] of [[backFace,enamel.back],[leftFace,enamel.left],[bottomFace,enamel.bottom]]){
 box(group,faceSize,faceSize,.145,0,0,0,material,.065);
}
// Twelve physical connecting beams and eight machined brass corner fittings.
for(const s1 of [-1,1])for(const s2 of [-1,1]){
 box(cube,3.45,.13,.13,0,s1*1.61,s2*1.61,metal,.045);
 box(cube,.13,3.45,.13,s1*1.61,0,s2*1.61,metal,.045);
 box(cube,.13,.13,3.45,s1*1.61,s2*1.61,0,metal,.045);
 for(const s3 of [-1,1])box(cube,.22,.22,.22,s1*1.61,s2*1.61,s3*1.61,brass,.068);
}
// Integral depth: floor/side walls/back are visible after a drawer opens.
function makeCompartment(face,hole,palette,name){
 const {x,y,w,h}=hole, cavityDepth=.79;
 const cavity = new THREE.Group();cavity.position.set(x,y,0);face.add(cavity);
 box(cavity,w-.07,.06,cavityDepth,0,-h/2+.045,-cavityDepth/2,cavityMaterial,.018);
 box(cavity,w-.07,.06,cavityDepth,0,h/2-.045,-cavityDepth/2,cavityMaterial,.018);
 box(cavity,.065,h-.06,cavityDepth,-w/2+.037,0,-cavityDepth/2,cavityMaterial,.018);
 box(cavity,.065,h-.06,cavityDepth,w/2-.037,0,-cavityDepth/2,cavityMaterial,.018);
 box(cavity,w,h,.08,0,0,-cavityDepth,mat(0x71647a,.14,.7));
 for(const sy of [-1,1])box(cavity,w+.09,.045,.11,0,sy*h/2,.075,brass,.018);
 for(const sx of [-1,1])box(cavity,.045,h+.11,.11,sx*w/2,0,.075,brass,.018);
 const drawer=new THREE.Group();drawer.position.set(x,y,0);face.add(drawer);
 const W=w-.13,H=h-.15;
 box(drawer,W,.075,.69,0,-H/2+.04,-.26,palette,.025);
 box(drawer,.075,H,.69,-W/2+.035,0,-.26,palette,.025);
 box(drawer,.075,H,.69,W/2-.035,0,-.26,palette,.025);
 box(drawer,W,H,.08,0,0,-.60,palette,.03);
 box(drawer,W,H,.135,0,0,.18,palette,.048);
 box(drawer,W-.13,.03,.11,0,-H/2+.16,.28,metal,.012);
 box(drawer,.30,.08,.045,0,-.13,.275,ivory,.032);
 label(drawer,name,w*.55,.11,0,.16,.263,"#efe8db","#60686b");
 return {drawer,cavity,open:false};
}
const front=makeCompartment(frontFace,frontHole,enamel.front,"01 · KEY");
const side=makeCompartment(rightFace,sideHole,enamel.right,"02 · THREAD");
front.drawer.userData.action="front";
side.drawer.userData.action="side";
setHit(front.drawer,"front");setHit(side.drawer,"side");

function keyShape(parent) {
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.032,12,30),brass);
 ring.position.set(-.13,-.1,-.12);ring.rotation.x=Math.PI/2;
 parent.add(ring);ring.castShadow=true;objectCount++;
 box(parent,.44,.055,.066,.09,-.10,-.12,brass,.012);
 box(parent,.065,.15,.066,.22,-.045,-.12,brass,.006);
}
keyShape(front.drawer);
function spoolShape(parent) {
 const g=new THREE.Group();g.position.set(0,-.09,-.19);g.rotation.z=.40;parent.add(g);
 const wood=mat(0xd5ac84,.05,.5),thread=mat(0xb883a9,.09,.53);
 cylinder(g,.115,.37,0,0,0,thread);
 cylinder(g,.18,.045,0,0,.205,wood);cylinder(g,.18,.045,0,0,-.205,wood);
}
spoolShape(side.drawer);

// The top door pivots on a real axis along its rear edge.
const hatch = new THREE.Group();topFace.add(hatch);
for(const sy of [-1,1])box(topFace,topHole.w+.11,.053,.12,0,sy*topHole.h/2,.07,metal,.024);
for(const sx of [-1,1])box(topFace,.053,topHole.h+.1,.12,sx*topHole.w/2,0,.07,metal,.024);
const chamber = new THREE.Group();topFace.add(chamber);
box(chamber,topHole.w-.13,.07,topHole.h-.15,0,0,-.64,cavityMaterial,.022);
for(const sx of [-1,1])box(chamber,.065,.77,topHole.h-.1,sx*(topHole.w/2-.035),-.35,-.27,cavityMaterial,.015);
box(chamber,topHole.w-.13,.77,.065,0,-.35,-topHole.h/2+.04,cavityMaterial,.015);
box(chamber,topHole.w-.13,.77,.065,0,-.35,topHole.h/2-.04,cavityMaterial,.015);
for(const [x,y] of [[-.29,-.12],[.31,.16]]) {
 const gear=cylinder(chamber,.19,.08,x,y,-.52,brass);
 gear.rotation.x=Math.PI/2;
 for(let i=0;i<9;i++){
  const theta=i*Math.PI*2/9;
  box(chamber,.09,.06,.09,x+Math.cos(theta)*.18,y+Math.sin(theta)*.18,-.47,darkMetal,.01);
 }
}
const lidPivot=new THREE.Group();lidPivot.position.set(0,topHole.h/2,.15);topFace.add(lidPivot);
box(lidPivot,topHole.w,topHole.h,.13,0,-topHole.h/2,0,enamel.top,.07);
box(lidPivot,topHole.w-.19,topHole.h-.19,.038,0,-topHole.h/2,.082,ivory,.05);
// Engraved nameplate is a solid two-layer metal insert attached directly
// to the physical lid, not a flat double-sided label plane that can appear
// to float when seen from the hatch underside.
box(lidPivot,1.05,.17,.058,0,-topHole.h/2,.139,ivory,.026);
box(lidPivot,.83,.028,.024,0,-topHole.h/2,.186,metal,.007);
for(const xx of [-.49,0,.49]){
 const pin = cylinder(topFace,.083,.34,xx,topHole.h/2,.15,metal);
 // Hinge axle follows the X axis, not the direction of the screw heads.
 pin.rotation.y=Math.PI/2;
}
lidPivot.userData.action="hatch";setHit(lidPivot,"hatch");
// Articulated gas struts connect the stationary cavity to the moving lid.
// Each cylinder is recomputed in the top face's true local 3D coordinates,
// rather than faking contact with an overlay.
const hingeBraces=[-.56,.56].map(x=>{
 const body = new THREE.Mesh(
  new THREE.CylinderGeometry(.037,.048,1,10),
  metal
 );
 body.castShadow=true;body.receiveShadow=true;
 topFace.add(body);objectCount++;
 const piston = new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1,10),brass);
 piston.castShadow=true;piston.receiveShadow=true;topFace.add(piston);objectCount++;
 const foot=cylinder(topFace,.071,.05,x,-.42,-.19,brass);
 return {x,body,piston,foot};
});
const yAxis=new THREE.Vector3(0,1,0);
function aimBar(mesh,a,b,portion=1){
 const segment=new THREE.Vector3().subVectors(b,a);
 const len=Math.max(.01,segment.length());
 mesh.position.copy(a).addScaledVector(segment,.5);
 mesh.scale.y=len*portion;
 mesh.quaternion.setFromUnitVectors(yAxis,segment.normalize());
}
// Time-based interpolation is frame-rate independent: heavy WebGL scenes can
// run at very low FPS in SwiftShader, but the hinge remains physically correct.
let hatchMotion=null;
function syncHatchMotion(){
 if(!hatchMotion)return;
 const t=Math.min(1,(performance.now()-hatchMotion.start)/hatchMotion.duration);
 const eased=1-Math.pow(1-t,3);
 lidPivot.rotation.x=hatchMotion.from+(hatchMotion.to-hatchMotion.from)*eased;
 if(t>=1){lidPivot.rotation.x=hatchMotion.to;hatchMotion=null}
}
function updateHatchBraces(){
 syncHatchMotion();
 for(const {x,body,piston} of hingeBraces){
  const mount=new THREE.Vector3(x,-.42,-.19);
  const moving=new THREE.Vector3(x,-.98,.04)
    .applyEuler(lidPivot.rotation).add(lidPivot.position);
  aimBar(body,mount,moving,.91);
  const middle=mount.clone().lerp(moving,.28);
  aimBar(piston,middle,moving,.76);
 }
}
let lidOpen=false;

// Tiny independent machined screws. Clicking really extracts a screw along
// its 3D normal rather than swapping a flat graphic.
const screws=[];
function screwsFor(face,tag,spots) {
 for(let i=0;i<spots.length;i++){
  const [x,y]=spots[i],assembly=new THREE.Group();
  assembly.position.set(x,y,.13);
  face.add(assembly);
  cylinder(assembly,.068,.065,0,0,.035,brass);
  box(assembly,.092,.012,.016,0,0,.080,darkMetal,.006);
  const key=tag+"-screw-"+i;
  setHit(assembly,key);screws.push({id:key,assembly,removed:false});
 }
}
screwsFor(frontFace,"front", [[-1.33,1.33],[1.33,1.33],[-1.33,-1.33],[1.33,-1.33]]);
screwsFor(rightFace,"side",[[-1.33,1.33],[1.33,1.33],[-1.33,-1.33],[1.33,-1.33]]);
screwsFor(topFace,"top",[[-1.25,1.25],[1.25,1.25],[-1.25,-1.25],[1.25,-1.25]]);
label(backFace,"IS ANYONE THERE?",2.35,.32,0,.95,.102,"#e1eecf","#698267");
// Raised physical ring on the back face.
const lensOuter=new THREE.Mesh(new THREE.TorusGeometry(.72,.083,15,72),metal);
lensOuter.position.set(0,-.18,.19);backFace.add(lensOuter);objectCount++;
const lens=cylinder(backFace,.50,.12,0,-.18,.18,mat(0x8ea7a3,.12,.20));
const pupil=cylinder(backFace,.22,.14,.16,-.21,.27,mat(0x4e6774,.12,.25));

// Premium precision-mechanism model: raised/engraved detail on all six real
// faces and additional raycast-selectable hardware, kept separate from the
// underlying shell and cavity logic for future 60-secret migration.
const intricate=buildIntricateCube({
 cube,faces:{frontFace,backFace,rightFace,leftFace,topFace,bottomFace},
 front,side,lidPivot,topHole,
 box,cylinder,label,setHit,mat,animate:(object,props,duration=.8)=>animate(object,props,duration),
 materials:{brass,metal,darkMetal,ivory,cavityMaterial,rubber}
});
// Finishing stays on the real object: every visible feature remains spatial,
// lit and attached to the face, moving drawer or hinged panel it belongs to.
const finish=finishMechanicalArtifact({
 renderer,scene,cube,
 faces:{frontFace,backFace,rightFace,leftFace,topFace,bottomFace},
 front,side,lidPivot,box,cylinder,mat,
 materials:{brass,metal,darkMetal,ivory,rubber,cavityMaterial,enamel}
});

// Grounding is a real plane receiving the real shadow of the mechanism.
const floorMaterial=new THREE.MeshStandardMaterial({color:0xfdfdfb,roughness:.96});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(250,250),floorMaterial);
floor.rotation.x=-Math.PI/2;floor.position.y=-2.43;floor.receiveShadow=true;
const plinth = new THREE.Mesh(
 new THREE.CylinderGeometry(2.51,2.62,.20,88,1),
 new THREE.MeshPhysicalMaterial({color:0xf6f4ef,roughness:.51,metalness:.13,clearcoat:.27})
);
plinth.position.y=-2.30;plinth.receiveShadow=true;plinth.castShadow=true;
scene.add(plinth);
const plinthRim=new THREE.Mesh(new THREE.TorusGeometry(2.49,.018,8,104),brass);
plinthRim.rotation.x=Math.PI/2;plinthRim.position.y=-2.195;scene.add(plinthRim);
scene.add(floor);
function announce(message){status.textContent=message;}
const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function animate(object,props,duration=.82){
 if(reducedMotion){Object.assign(object,props);return}
 gsap.to(object,{...props,duration,ease:"power3.inOut"});
}
function toggleDrawer(target,caption){
 target.open=!target.open;
 // Cancel the entire previous timeline, including any queued settle tween.
 // Killing only active properties can leave an old follow-through scheduled.
 if(target.motion){target.motion.kill();target.motion=null;}
 if(reducedMotion){target.drawer.position.z=target.open?.76:0;}
 else{
  target.motion=gsap.timeline().to(target.drawer.position,{z:target.open?.88:-.05,duration:.46,ease:"power2.out"})
    .to(target.drawer.position,{z:target.open?.76:0,duration:.24,ease:"back.out(1.15)"});
 }
 announce(caption+(target.open?" opens into a real hollow box.":" slides fully into its socket."));
}
function toggleHatch(){
 syncHatchMotion();
 lidOpen=!lidOpen;
 const hingeAngle=stage.clientWidth<720?-1.00:-1.08;
 const target=lidOpen?hingeAngle:0;
 if(reducedMotion){lidPivot.rotation.x=target;hatchMotion=null;}
 else hatchMotion={start:performance.now(),duration:920,from:lidPivot.rotation.x,to:target};
 updateHatchBraces();
 announce("The top hatch "+(lidOpen?"swings on its actual brass hinge.":"closes flush with the cube."));
}
function clickAction(action){
 if(action==="front")toggleDrawer(front,"The lavender drawer");
 else if(action==="side")toggleDrawer(side,"The teal drawer");
 else if(action==="hatch")toggleHatch();
 else if(intricate.actions.includes(action)){
  const description=intricate.operate(action);
  if(description)announce(description);
 }
 else if(action.includes("-screw-")){
  const s=screws.find(item=>item.id===action);
  if(!s)return;
  s.removed=!s.removed;
  animate(s.assembly.position,{z:s.removed?.55:.13},.44);
  animate(s.assembly.rotation,{z:s.removed?Math.PI*2:0},.44);
  announce("A metal screw "+(s.removed?"unscrews out of the surface.":"threads back into its housing."));
 }
}
document.getElementById("drawerFront").addEventListener("click",()=>clickAction("front"));
document.getElementById("drawerRight").addEventListener("click",()=>clickAction("side"));
document.getElementById("hatchTop").addEventListener("click",()=>clickAction("hatch"));
document.getElementById("reset").addEventListener("click",()=>{
 const home=stage.clientWidth<720?[6.95,5.75,9.35]:[5.7,4.7,7.8];
 animate(camera.position,{x:home[0],y:home[1],z:home[2]});
 animate(cube.rotation,{x:-.19,y:-.33,z:.02});
 controls.target.set(0,0,0);
 announce("Camera returned to the physical cube.");
});
const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
let clickStart=null;
renderer.domElement.addEventListener("pointerdown",e=>{clickStart={x:e.clientX,y:e.clientY}});
renderer.domElement.addEventListener("pointermove",e=>{
 const bounds=renderer.domElement.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 pointer.set(((e.clientX-bounds.left)/bounds.width)*2-1,-((e.clientY-bounds.top)/bounds.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
 renderer.domElement.style.cursor=raycaster.intersectObjects(interactiveMeshes,false).length?"pointer":"grab";
});
renderer.domElement.addEventListener("pointerup",e=>{
 if(!clickStart||Math.hypot(e.clientX-clickStart.x,e.clientY-clickStart.y)>7)return;
 const bounds=renderer.domElement.getBoundingClientRect();
 pointer.set(((e.clientX-bounds.left)/bounds.width)*2-1,-((e.clientY-bounds.top)/bounds.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
 const intersects=raycaster.intersectObjects(interactiveMeshes,false);
 const picked=intersects.find(item=>item.object.userData.action);
 if(picked)clickAction(picked.object.userData.action);
 clickStart=null;
});
let cameraMode=null;
const onResize=()=>{
 const r=stage.getBoundingClientRect();
 const mode=r.width<720?"mobile":"desktop";
 if(mode!==cameraMode){
  cameraMode=mode;
  const home=mode==="mobile"?[6.95,5.75,9.35]:[5.7,4.7,7.8];
  camera.position.set(...home);
 }
 camera.aspect=Math.max(.3,r.width/r.height);
 camera.updateProjectionMatrix();
 renderer.setSize(r.width,r.height,false);
};
new ResizeObserver(onResize).observe(stage);
onResize();
renderer.setAnimationLoop(()=>{
 controls.update();
 updateHatchBraces();
 renderer.render(scene,camera);
});
window.__nothing3DPreview={
 ready:true,
 engine:"three.js",
 get meshCount(){
  let n=0;
  scene.traverse(node=>{if(node.isMesh)n++});
  return n;
 },
 get finishMeshCount(){return finish.meshCount()},
 get finishQuality(){return finish.quality},
 get detailMeshCount(){return intricate.meshCount()},
 get interactiveDetailCount(){return intricate.actions.length},
 detailState:()=>intricate.getState(),
 get frontOpen(){return front.open},
 get sideOpen(){return side.open},
 get topOpen(){return lidOpen},
 get hatchBraceLengths(){updateHatchBraces();return hingeBraces.map(({body})=>body.scale.y)},
 get hatchAngle(){syncHatchMotion();return lidPivot.rotation.x},
 get reducedMotion(){return reducedMotion},
 get screwsOut(){return screws.filter(s=>s.removed).length},
 clickAction
};
announce("A hand-built mechanical curiosity — inspect the dials, rails, lenses and hidden compartments.");
