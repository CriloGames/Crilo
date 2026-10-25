import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { buildIntricateCube } from "./secrets-3d-details.js?v=12";
import { finishMechanicalArtifact } from "./secrets-3d-finish.js?v=6";
import {buildGameHotspots} from "./secrets-3d-game-hotspots.js?v=16";
import {buildPocketWorlds} from "./secrets-3d-worlds.js?v=24";

// A genuine hollow box: panels leave real holes for the two sliding trays
// and the top hatch. Drawers have separate floors, walls, backs and fronts.
const embeddedGame=document.body.classList.contains("nc-page");
const stage = document.getElementById("stage");
const status = document.getElementById("status");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
camera.position.set(3.85,3.2,5.9);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
// A software-rendered or memory-constrained browser needs a lighter GPU
// budget, not a frozen puzzle. Hardware renderers retain premium lighting,
// shadows and full pixel density.
const gl=renderer.getContext();
const rendererInfo=gl.getExtension("WEBGL_debug_renderer_info");
const gpuName=String(rendererInfo
 ?gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)
 :gl.getParameter(gl.RENDERER)||"");
const softwareGL=/swiftshader|llvmpipe|lavapipe|software raster/i.test(gpuName)
 ||/HeadlessChrome/i.test(navigator.userAgent);
const constrainedDevice=softwareGL||
 (typeof navigator.deviceMemory==="number"&&navigator.deviceMemory<=2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .76;
renderer.setPixelRatio(constrainedDevice
 ?Math.min(window.devicePixelRatio||1,.85)
 :Math.min(window.devicePixelRatio||1,1.5));
renderer.shadowMap.enabled = !constrainedDevice;
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
scene.environmentIntensity=.62;
studioRoom.dispose();pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .075;
controls.rotateSpeed = .40;
controls.zoomSpeed = .30;
controls.minDistance = 5.2;
controls.maxDistance = 14;
// Allow the box to move freely in frame without panning so far that it
// becomes impossible to find. This does not constrain how it rotates.
controls.minTargetRadius=0;
controls.maxTargetRadius=3.0;
// Normal drag orbits. Right-drag / two fingers moves the floating cube in
// the viewport; the Move button uses one-finger/left-drag for the same action.
controls.enablePan = true;
// Explicit input mapping is necessary on browsers that default the secondary
// mouse button to an alternative orbit gesture. Pan must behave consistently.
controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
controls.touches.ONE=THREE.TOUCH.ROTATE;
controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xfff7e8, 0xa7a4b2, .57));
const key = new THREE.DirectionalLight(0xfff6e7, 1.52);
key.position.set(-3.4, 10.5, 6.6); key.castShadow = !constrainedDevice;
key.shadow.mapSize.set(1024, 1024);
key.shadow.normalBias = .025;
key.shadow.radius = 3;
key.shadow.camera.left = -8; key.shadow.camera.right = 8;
key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
key.shadow.bias = -.00028;
scene.add(key);
const fill = new THREE.DirectionalLight(0xb6daeb, .43);
fill.position.set(7, 4, -6); scene.add(fill);
const rim = new THREE.PointLight(0xffd0a0, 3.1, 20);
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
const interactiveMeshSet = new Set();
// The solid enamel casing must block rays to clues on the opposite side.
// Do not use all decorative geometry as blockers: a bezel or glass lens
// could otherwise make a deliberately raised control unclickable.
const occlusionMeshes = [];

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
 obj.traverse(node => {
  if(!node.isMesh)return;
  // Miniature controls inherit their parent's initial registration. Later
  // action overrides must not double raycast work on the same geometry.
  node.userData.action=action;
  if(!interactiveMeshSet.has(node)){
   interactiveMeshSet.add(node);interactiveMeshes.push(node);
  }
 });
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
  occlusionMeshes.push(box(group,x2-x1,y2-y1,T,(x1+x2)/2,(y1+y2)/2,0,material,.035));
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
 occlusionMeshes.push(box(group,faceSize,faceSize,.145,0,0,0,material,.065));
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
const front=makeCompartment(frontFace,frontHole,enamel.front,"01 · DRAWER");
const side=makeCompartment(rightFace,sideHole,enamel.right,"02 · DRAWER");
front.drawer.userData.action="front";
side.drawer.userData.action="side";
setHit(front.drawer,"front");setHit(side.drawer,"side");

function keyShape(parent) {
 const found=new THREE.Group();parent.add(found);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.032,12,30),brass);
 ring.position.set(-.13,-.1,-.12);ring.rotation.x=Math.PI/2;
 found.add(ring);ring.castShadow=true;objectCount++;
 box(found,.44,.055,.066,.09,-.10,-.12,brass,.012);
 box(found,.065,.15,.066,.22,-.045,-.12,brass,.006);
 return found;
}
const looseKey=keyShape(front.drawer);
function spoolShape(parent) {
 const g=new THREE.Group();g.position.set(0,-.09,-.19);g.rotation.z=.40;parent.add(g);
 const wood=mat(0xd5ac84,.05,.5),thread=mat(0xb883a9,.09,.53);
 cylinder(g,.115,.37,0,0,0,thread);
 cylinder(g,.18,.045,0,0,.205,wood);cylinder(g,.18,.045,0,0,-.205,wood);
 return g;
}
const looseSpool=spoolShape(side.drawer);

// The top door pivots on a real axis along its rear edge.
const hatch = new THREE.Group();topFace.add(hatch);
for(const sy of [-1,1])box(topFace,topHole.w+.11,.053,.12,0,sy*topHole.h/2,.07,metal,.024);
for(const sx of [-1,1])box(topFace,.053,topHole.h+.1,.12,sx*topHole.w/2,0,.07,metal,.024);
const chamber = new THREE.Group();topFace.add(chamber);
// Well geometry must use local Z as depth. Earlier dimensions accidentally
// swapped height and depth, leaving dark slabs protruding above the lid.
box(chamber,topHole.w-.13,topHole.h-.15,.07,0,0,-.76,cavityMaterial,.022);
for(const sx of [-1,1])
 box(chamber,.065,topHole.h-.11,.74,sx*(topHole.w/2-.035),0,-.37,cavityMaterial,.015);
for(const sy of [-1,1])
 box(chamber,topHole.w-.13,.065,.74,0,sy*(topHole.h/2-.035),-.37,cavityMaterial,.015);
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
  // Every screw passes through a permanent counterbore and retaining ring.
  // When a removable screw comes out there is a real recessed socket behind it.
  const socket=new THREE.Group();socket.position.set(x,y,.077);face.add(socket);
  cylinder(socket,.077,.018,0,0,.006,cavityMaterial).castShadow=false;
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.077,.014,8,28),metal);
  collar.position.z=.021;socket.add(collar);
  assembly.position.set(x,y,.13);
  face.add(assembly);
  cylinder(assembly,.035,.16,0,0,-.034,darkMetal);
  cylinder(assembly,.068,.065,0,0,.035,brass);
  box(assembly,.092,.012,.016,0,0,.080,darkMetal,.006);
  const key=tag+"-screw-"+i;
  setHit(assembly,key);screws.push({id:key,assembly,removed:false});
 }
}
screwsFor(frontFace,"front", [[-1.33,1.33],[1.33,1.33],[-1.33,-1.33],[1.33,-1.33]]);
screwsFor(rightFace,"side",[[-1.33,1.33],[1.33,1.33],[-1.33,-1.33],[1.33,-1.33]]);
screwsFor(topFace,"top",[[-1.25,1.25],[1.25,1.25],[-1.25,-1.25],[1.25,-1.25]]);
// The ring is a separate physical collectible on the underside. Once
// discovered it MUST leave the cube; the empty brass seat remains.
const undersideRingSeat=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.05,32),cavityMaterial);
undersideRingSeat.rotation.x=Math.PI/2;
undersideRingSeat.position.set(-.43,-.23,.128);bottomFace.add(undersideRingSeat);
const undersideRing=new THREE.Group();undersideRing.position.set(-.43,-.23,.174);
bottomFace.add(undersideRing);
const ringArtifact=new THREE.Mesh(new THREE.TorusGeometry(.15,.040,10,36),brass);
ringArtifact.castShadow=true;undersideRing.add(ringArtifact);
const ringHub=new THREE.Mesh(new THREE.TorusGeometry(.205,.012,7,40),metal);
ringHub.position.z=-.035;undersideRing.add(ringHub);
// A lift pin, rather than a painted symbol, marks where to inspect the ring.
const ringPin=box(undersideRing,.10,.036,.035,0,-.13,.040,ivory,.009);
setHit(undersideRing,"underside");
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
const gameHotspots=embeddedGame?buildGameHotspots({
 faces:{frontFace,backFace,rightFace,leftFace,topFace,bottomFace},
 lidPivot,box,cylinder,setHit,mat,animate,invalidate
}):null;
// The miniature discoveries attach to actual cube faces, never an
// unrelated ground pedestal.
const pocketWorlds=embeddedGame?buildPocketWorlds({
 cube,faces:{frontFace,backFace,leftFace,rightFace,topFace,bottomFace},
 box,cylinder,mat,setHit,invalidate
}):null;
let currentGameState={};
let physicalStateInitialized=false;

// The puzzle box floats in an empty room. The player can orbit and pan
// the whole object without a pedestal, ground plane or support rods.
const floatingScene=true;
function announce(message){status.textContent=message;}
const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function animate(object,props,duration=.82){
 if(reducedMotion){Object.assign(object,props);return}
 gsap.to(object,{...props,duration,ease:"power3.inOut",onUpdate:invalidate});
}
function toggleDrawer(target,caption){
 target.open=!target.open;
 // Cancel the entire previous timeline, including any queued settle tween.
 // Killing only active properties can leave an old follow-through scheduled.
 if(target.motion){target.motion.kill();target.motion=null;}
 if(reducedMotion){target.drawer.position.z=target.open?.76:0;}
 else{
  target.motion=gsap.timeline({onUpdate:invalidate}).to(target.drawer.position,{z:target.open?.88:-.05,duration:.46,ease:"power2.out"})
    .to(target.drawer.position,{z:target.open?.76:0,duration:.24,ease:"back.out(1.15)"});
 }
 invalidate();
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
 invalidate();
 announce("The top hatch "+(lidOpen?"swings on its actual brass hinge.":"closes flush with the cube."));
}
function turnFixedFastener(action){
 const screw=screws.find(item=>item.id===action);
 if(!screw||!screw.assembly.visible)return;
 screw.motion?.kill();
 gsap.killTweensOf(screw.assembly.position);
 gsap.killTweensOf(screw.assembly.rotation);
 if(reducedMotion){invalidate();return;}
 const depth=screw.assembly.position.z;
 screw.motion=gsap.timeline({onUpdate:invalidate})
  .to(screw.assembly.rotation,{z:screw.assembly.rotation.z+Math.PI*.6,
   duration:.28,ease:"power2.inOut"},0)
  .to(screw.assembly.position,{z:depth+.085,duration:.25,ease:"power2.out"},0)
  .to(screw.assembly.position,{z:depth,duration:.27,ease:"back.out(1.6)"});
}
let lastClickedAction=null;
function clickAction(action){
 lastClickedAction=action;
 if(embeddedGame){
  if(action.startsWith("flute-note-")){
   gameHotspots?.pulse(action);
   window.CriloNothingHereCube?.activatePhysicalFluteNote?.(Number(action.slice(-1)));
   return;
  }
  if(action.startsWith("thing:bag-dial-")){
   window.CriloNothingHereCube?.activatePhysicalBagDial?.(Number(action.slice(-1)));
   return;
  }
  if(action.startsWith("thing:elevator-floor-")){
   pocketWorlds?.pulse?.(action);
   window.CriloNothingHereCube?.activatePhysicalElevatorFloor?.(Number(action.slice(-1)));
   return;
  }
  if(action.startsWith("thing:")){
   // Using a pocket item can instantly expose a precision control. Avoid
   // jostling the entire sculpture while the player is aiming at it.
   const usingInventory=!!window.CriloNothingHereCube?.getState?.().selected;
   window.CriloNothingHereCube?.activatePhysicalThing?.(action.slice(6));
   if(!usingInventory)pocketWorlds?.inspect?.(action.slice(6));
   return;
  }
  const translate={
   front:currentGameState.a?"drawer-a":"latch",
   side:currentGameState.b?"drawer-b":"seam",
   hatch:"triangle",
   optic:"eye-ring",
   pressure:"pressure",
   lever:"dent",
   latch:"latch",
   "service-latch":"shutter",
   eye:"eye",
   underside:"hatch",
   "hatch-latch":"triangle",
   "cube-offer":"cube-offer"
  };
  // Two families of precision fasteners share the original service clues,
  // rather than pretending to be clickable but silently doing nothing.
  const name=action.startsWith("side-screw-")?"right-bolt-"+action.slice(-1):
    action.startsWith("top-screw-")?"hinge-"+Math.min(2,Number(action.slice(-1))):
    translate[action]||action;
  if(name==="top-reed"&&!currentGameState.top)return;
  // The hardware reacts to touch even if the original secret does not
  // unlock. Motion conveys interactivity but never reveals a solution.
  if(gameHotspots){
   if(!gameHotspots.pulse(action))gameHotspots.pulse(name);
  }
  if(action.startsWith("side-screw-")||action.startsWith("top-screw-"))
   turnFixedFastener(action);
  window.CriloNothingHereCube?.activatePhysical?.(name);
  return;
 }
 if(action==="front")toggleDrawer(front,"The lavender drawer");
 else if(action==="side")toggleDrawer(side,"The teal drawer");
 else if(action==="hatch")toggleHatch();
 else if(intricate.actions.includes(action)||action==="service-latch"){
  const description=intricate.operate(action==="service-latch"?"latch":action);
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
document.getElementById("drawerFront")?.addEventListener("click",()=>clickAction("front"));
document.getElementById("drawerRight")?.addEventListener("click",()=>clickAction("side"));
document.getElementById("hatchTop")?.addEventListener("click",()=>clickAction("hatch"));
let cameraReturnMotion=null;
let cameraReturnDeadline=null;
function cancelCameraReturn(){
 if(cameraReturnDeadline!==null){clearTimeout(cameraReturnDeadline);cameraReturnDeadline=null}
 cameraReturnMotion?.kill();cameraReturnMotion=null;
 controls.enableDamping=true;
}
function returnCameraHome(){
 const home=stage.clientWidth<720?[5.6,4.7,7.45]:[3.85,3.2,5.9];
 cancelCameraReturn();
 // Reset the *camera's real orbit point* synchronously. An animated GSAP
 // target used to fight OrbitControls' inertia and, on low-power hardware,
 // could leave the cube off-center indefinitely. The box still gets a
 // gentle mechanical settling turn when motion is allowed.
 controls.enableDamping=false;
 // First update clears OrbitControls' accumulated gesture deltas. With
 // panning enabled a queued _panOffset may otherwise get re-applied to
 // target AFTER we set it to zero, visibly undoing the Reset button.
 controls.target.set(0,0,0);
 camera.position.set(...home);
 controls.update();
 controls.target.set(0,0,0);
 camera.position.set(...home);
 controls.update();
 controls.enableDamping=true;
 gsap.killTweensOf(cube.rotation);
 if(reducedMotion)cube.rotation.set(-.19,-.33,.02);
 else gsap.to(cube.rotation,{
  x:-.19,y:-.33,z:.02,duration:.42,ease:"power2.out",
  onUpdate:invalidate,onComplete:invalidate
 });
 invalidate();
 announce("Camera returned to the physical cube.");
}
document.getElementById("reset")?.addEventListener("click",returnCameraHome);
let cameraDragging=false;
controls.addEventListener("start",()=>{
 // A user's next drag should override a camera animation immediately.
 cancelCameraReturn();
 cameraDragging=true;
 renderer.domElement.style.cursor="grabbing";
 setPartHint(null);
});
controls.addEventListener("end",()=>{
 cameraDragging=false;
 renderer.domElement.style.cursor="grab";
 setPartHint(null);
});
const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
let clickStart=null;
// Identify the actual object when hovered, not a generic "tap anywhere"
// message. Inventory clues remain optional and never reveal a combination.
// Name what an object IS. Never tell the player its solution, use count,
// compatible inventory item, or required sequence in a hover tooltip.
const controlNames={
 "flute-note-1":"Flute key I","flute-note-2":"Flute key II","flute-note-3":"Flute key III",
 front:"Lavender drawer",latch:"Front drawer latch",
 "drawer-a":"Small metal teeth",side:"Teal drawer",
 seam:"Side panel seam","drawer-b":"Red thread spool",
 hatch:"Hinged top panel",triangle:"Brass triangle",
 "top-reed":"Hollow wooden tube",foot:"Rubber foot",
 underside:"Underside mechanism",dent:"Dented copper switch",
 dot:"Small red button",pressure:"Pressure gauge",
 "eye-ring":"Iris adjustment ring",eye:"Glass eye",
 "cube-offer":"Circular brass receiver",
 optic:"Optical collar",serial:"Maker's stamp",
 shutter:"Service shutter","service-latch":"Service catch",
 "hatch-latch":"Lid latch","cipher-strip":"Engraved brass strip",
 "right-bolt-1":"Service bolt",
 "front-screw-3":"Unusual fastener"
};
const miniatureNames={
 bag:"Locked leather bag",dog:"Little dog",door:"Little door",vase:"Ceramic vase",
 squirrel:"Clockwork squirrel",pot:"Plant pot",musicbox:"Music box",
 cloud:"Indoor cloud",cup:"Teacup",clock:"Pocket watch",
 machine:"Vending machine",elevator:"Miniature elevator",moth:"Clockwork moth",
 telescope:"Telescope",train:"Miniature train"
};
const partHint=document.createElement("output");
partHint.id="ncPartHint";partHint.setAttribute("aria-live","off");partHint.hidden=true;
if(!embeddedGame){
 partHint.style.cssText="position:absolute;z-index:9;pointer-events:none;transform:translateX(-50%);background:#fff9e9ee;border:1px solid #a0b5ae;border-radius:9px;padding:6px 11px;box-shadow:0 4px 14px #384b5230;color:#4b6568;font:700 12px system-ui,sans-serif;max-width:230px;text-align:center;";
}
stage.appendChild(partHint);
function describeAction(action){
 if(!action)return "";
 if(action.startsWith("thing:bag-dial-"))return "Bag dial "+(Number(action.slice(-1))+1);
 if(action.startsWith("thing:elevator-floor-"))return "Elevator button "+action.slice(-1);
 if(action.startsWith("thing:"))return miniatureNames[action.slice(6)]||"Miniature object";
 if(action.startsWith("front-screw-"))return "Faceplate screw";
 if(action.startsWith("right-bolt-")||action.startsWith("side-screw-"))return "Service fastener";
 if(action.startsWith("hinge-")||action.startsWith("top-screw-"))return "Hinge pin";
 if(action.startsWith("vent-"))return "Vent switch "+action.slice(-1);
 return controlNames[action]||"Mechanical fitting";
}
function setPartHint(action,e){
 if(!action){partHint.hidden=true;return}
 partHint.textContent=describeAction(action);
 partHint.classList.remove("nc-can-use");
 partHint.hidden=false;
 if(e){
  const b=stage.getBoundingClientRect();
  partHint.style.left=Math.max(14,Math.min(b.width-32,e.clientX-b.left))+"px";
  partHint.style.top=Math.max(24,Math.min(b.height-50,e.clientY-b.top-46))+"px";
 }
}
function isMeshEffectivelyVisible(mesh){
 for(let p=mesh;p;p=p.parent)if(!p.visible)return false;
 return true;
}
function pickVisibleAction(clientX,clientY){
 const bounds=renderer.domElement.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return null;
 pointer.set(((clientX-bounds.left)/bounds.width)*2-1,-((clientY-bounds.top)/bounds.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
 const casing=raycaster.intersectObjects(occlusionMeshes,false)
  .find(hit=>isMeshEffectivelyVisible(hit.object));
 const limit=casing?casing.distance+.025:Infinity;
 return raycaster.intersectObjects(interactiveMeshes,false)
  .find(hit=>hit.distance<=limit && hit.object.userData.action &&
    isMeshEffectivelyVisible(hit.object))?.object.userData.action||null;
}
renderer.domElement.addEventListener("pointerdown",e=>{
 if(e.button===0){
  // Capture the intended real 3D control at press time. Under slow WebGL
  // the key or its parent may animate before the matching pointer release;
  // stationary clicks must not turn into misses or neighbouring actions.
  clickStart={x:e.clientX,y:e.clientY,pointerId:e.pointerId,
   action:pickVisibleAction(e.clientX,e.clientY)};
 }
});
let hoverFrame=0,hoverPoint=null;
function clearHover(){
 if(hoverFrame){cancelAnimationFrame(hoverFrame);hoverFrame=0;}
 hoverPoint=null;
 renderer.domElement.style.cursor="grab";
 setPartHint(null);
}
renderer.domElement.addEventListener("pointermove",e=>{
 if(cameraDragging||
   clickStart&&Math.hypot(e.clientX-clickStart.x,e.clientY-clickStart.y)>7){
  clearHover();return;
 }
 // Mouse movement may fire hundreds of times during a slow WebGL frame.
 // Query actual geometry just once per display frame, never each pixel.
 hoverPoint={clientX:e.clientX,clientY:e.clientY};
 if(hoverFrame)return;
 hoverFrame=requestAnimationFrame(()=>{
  hoverFrame=0;
  const point=hoverPoint;
  if(!point||clickStart)return;
  const action=pickVisibleAction(point.clientX,point.clientY);
  renderer.domElement.style.cursor=action?"pointer":"grab";
  setPartHint(action,point);
 });
});
renderer.domElement.addEventListener("pointerleave",clearHover);
renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
renderer.domElement.addEventListener("pointerup",e=>{
 const start=clickStart;clickStart=null;
 if(!start||start.pointerId!==e.pointerId||
    Math.hypot(e.clientX-start.x,e.clientY-start.y)>7)return;
 // A click below the drag threshold belongs to the object touched on
 // pointerdown, not whichever moving mesh happens to be under pointerup.
 const action=start.action||pickVisibleAction(e.clientX,e.clientY);
 if(action)clickAction(action);
 clearHover();
});
renderer.domElement.addEventListener("pointercancel",()=>{clickStart=null;clearHover()});
renderer.domElement.addEventListener("keydown",event=>{
 if(!embeddedGame||!gameHotspots?.fluteVisible?.())return;
 // Keyboard and assistive-technology players use these three instrument
 // keys instead of hunting tiny 3D keycaps with a pointer.
 if(["1","2","3"].includes(event.key)){
  event.preventDefault();
  clickAction("flute-note-"+event.key);
 }
});
let pendingFrame=0;
let cameraMode=null;
const onResize=()=>{
 const r=stage.getBoundingClientRect();
 const mode=r.width<720?"mobile":"desktop";
 // Initial mobile framing makes the entire box visible. Every subsequent
 // breakpoint crossing preserves the player's orbit, pan and zoom.
 if(cameraMode===null){
  const initial=mode==="mobile"?[5.6,4.7,7.45]:[3.85,3.2,5.9];
  camera.position.set(...initial);
 }
 cameraMode=mode;
 camera.aspect=Math.max(.3,r.width/r.height);
 camera.updateProjectionMatrix();
 renderer.setSize(r.width,r.height,false);
 invalidate();
};
new ResizeObserver(onResize).observe(stage);
onResize();
// On-demand rendering: a finished museum object should not spin its GPU at
// 60 FPS forever. Orbit controls, mechanical animations, resize, and hatch
// movement request frames only when something actually changes.
function invalidate(){
 if(!pendingFrame)pendingFrame=requestAnimationFrame(drawFrame);
}
function drawFrame(){
 pendingFrame=0;
 // OrbitControls emits "change" while damped motion is still settling,
 // which schedules successive frames; a resting scene stays on demand.
 controls.update();
 updateHatchBraces();
 renderer.render(scene,camera);
 if(hatchMotion)invalidate();
}
controls.addEventListener("change",()=>{
 invalidate();
 if(embeddedGame){
  const base=stage.clientWidth<720?
   Math.hypot(5.6,4.7,7.45):Math.hypot(3.85,3.2,5.9);
  window.CriloNothingHereCube?.updatePhysicalViewZoom?.(
   base/camera.position.distanceTo(controls.target)
  );
 }
});
invalidate();
window.__nothing3DPreview={
 ready:true,
 engine:"three.js",
 get meshCount(){
  let n=0;
  scene.traverse(node=>{if(node.isMesh)n++});
  return n;
 },
 get finishMeshCount(){return finish.meshCount()},
 get raycastTargets(){return {total:interactiveMeshes.length,unique:interactiveMeshSet.size}},
 get gameControls(){return gameHotspots?.actions||[]},
 get revealedPhysicalCipher(){return gameHotspots?.cipherVisible()||false},
 get physicalStoryObjects(){return pocketWorlds?.names||[]},
 projectItemSource(item){
  const sources={
   tooth:looseKey,thread:looseSpool,pipe:gameHotspots?.targets.get("top-reed"),
   ring:undersideRing,cog:gameHotspots?.targets.get("cube-offer"),
   fork:gameHotspots?.targets.get("pressure"),
   shim:gameHotspots?.targets.get("vent-3"),
   washer:gameHotspots?.targets.get("hinge-0"),
   iris:gameHotspots?.targets.get("eye"),
   cylinder:gameHotspots?.targets.get("shutter"),
   coin:pocketWorlds?.targets.get("bag"),
   treat:pocketWorlds?.targets.get("bag"),
   reed:pocketWorlds?.targets.get("bag"),
   prism:pocketWorlds?.targets.get("bag"),
   sugar:pocketWorlds?.targets.get("machine"),
   bell:gameHotspots?.targets.get("dot"),
   tag:pocketWorlds?.targets.get("dog"),
   lens:pocketWorlds?.targets.get("elevator"),
   raindrop:pocketWorlds?.targets.get("cloud"),
   acorn:pocketWorlds?.targets.get("squirrel"),
   spring:pocketWorlds?.targets.get("squirrel"),
   stardust:pocketWorlds?.targets.get("moth"),
   parcel:pocketWorlds?.targets.get("train"),
   postcard:pocketWorlds?.targets.get("dog")
  };
  const object=sources[item]||cube;
  scene.updateWorldMatrix(true,true);
  const projected=object.getWorldPosition(new THREE.Vector3()).project(camera);
  const rect=renderer.domElement.getBoundingClientRect();
  return {x:rect.left+(projected.x+1)*rect.width/2,
          y:rect.top+(1-projected.y)*rect.height/2,depth:projected.z};
 },
 describeAction,
 get physicalCollectiblesVisible(){return {
  tooth:looseKey.visible,thread:looseSpool.visible,ring:undersideRing.visible,
  extraKey:intricate.getCollectibleVisibility?.().tooth??null,
  extraThread:intricate.getCollectibleVisibility?.().thread??null,
  pipe:gameHotspots?.targets.get("top-reed")?.visible??null,
  cog:gameHotspots?.targets.get("cube-offer")?.visible??null
 }},
 get physicalPuzzleActions(){return pocketWorlds?.puzzleActions||[]},
 get physicalScenePose(){return pocketWorlds?.getPose()||null},
 get visiblePhysicalStoryObjects(){return pocketWorlds?.visibleNames()||[]},
 getPhysicalActionAt(x,y){
  const r=renderer.domElement.getBoundingClientRect();
  return pickVisibleAction(r.left+x,r.top+y);
 },
 projectPhysicalStoryObject(name){
  const obj=pocketWorlds?.targets.get(name);
  const volume=pocketWorlds?.pickVolumes.get(name);
  if(!obj||!volume||!isMeshEffectivelyVisible(obj))return null;
  scene.updateWorldMatrix(true,true);
  // Find a truly clickable point ON the visible volume, not the group
  // origin or the AABB center: those could be hidden by the cube or floor.
  const samples=[
   [0,0,.18],[.14,0,.18],[-.14,0,.18],
   [0,.14,.18],[0,-.14,.18],
   [.14,.13,.18],[-.14,.13,.18],
   [0,0,0],[.16,0,0],[-.16,0,0],
   [0,.14,0],[0,-.14,0]
  ];
  const rect=renderer.domElement.getBoundingClientRect();
  let fallback=null;
  for(const [x,y,z] of samples){
   const p=volume.localToWorld(new THREE.Vector3(x,y,z)).project(camera);
   const point={x:(p.x+1)*.5*stage.clientWidth,
    y:(1-p.y)*.5*stage.clientHeight,depth:p.z};
   if(!fallback)fallback=point;
   if(p.z>=-1&&p.z<=1&&
     pickVisibleAction(rect.left+point.x,rect.top+point.y)==="thing:"+name)
     return {...point,pick:"thing:"+name};
  }
  return {...fallback,pick:null};
 },
 projectPhysicalPuzzleControl(name){
  const obj=pocketWorlds?.puzzleTargets.get(name);
  if(!obj||!isMeshEffectivelyVisible(obj))return null;
  scene.updateWorldMatrix(true,true);
  const rect=renderer.domElement.getBoundingClientRect();
  let fallback=null;
  // The reported point must actually select THIS tiny control rather than
  // the parent model, its invisible selection box, or a neighbouring dial.
  for(const [x,y,z] of [
   [0,0,.095],[0,0,.065],[0,0,.035],
   [-.025,0,.078],[.025,0,.078],
   [0,-.025,.078],[0,.025,.078],[0,0,0]
  ]){
   const pos=obj.localToWorld(new THREE.Vector3(x,y,z)).project(camera);
   const point={x:(pos.x+1)*.5*rect.width,
    y:(1-pos.y)*.5*rect.height,depth:pos.z};
   if(!fallback)fallback=point;
   if(pos.z>=-1&&pos.z<=1&&point.x>=0&&point.x<=rect.width&&
      point.y>=0&&point.y<=rect.height&&
      pickVisibleAction(rect.left+point.x,rect.top+point.y)===name)
    return {...point,pick:name};
  }
  return {...fallback,pick:null};
 },
 projectGameControl(name){
  const obj=gameHotspots?.targets.get(name);
  if(!obj||!isMeshEffectivelyVisible(obj))return null;
  scene.updateWorldMatrix(true,true);
  const rect=renderer.domElement.getBoundingClientRect();
  let fallback=null;
  // Sample across the raised key's real invisible fingertip collider;
  // only return an actually reachable point verified by the real raycast.
  const sampleDepth=name.startsWith("flute-note-") ? .185 : .14;
  for(const [x,y,z] of [
   [0,0,sampleDepth],[0,0,.14],[0,0,.04],
   [.045,0,sampleDepth],[-.045,0,sampleDepth],
   [0,.045,sampleDepth],[0,-.045,sampleDepth],
   [.065,0,.14],[-.065,0,.14],
   [.055,.055,.11],[-.055,-.055,.11],[0,0,0]
  ]){
   const p=obj.localToWorld(new THREE.Vector3(x,y,z)).project(camera);
   const point={
    x:(p.x+1)*.5*stage.clientWidth,
    y:(1-p.y)*.5*stage.clientHeight,depth:p.z
   };
   if(!fallback)fallback=point;
   if(p.z>=-1&&p.z<=1&&
    pickVisibleAction(rect.left+point.x,rect.top+point.y)===name)
    return {...point,pick:name};
  }
  return {...fallback,pick:null};
 },
 get finishQuality(){return finish.quality},
 get batching(){return {artisan:finish.batching,precision:intricate.batching}},
 get detailMeshCount(){return intricate.meshCount()},
 get interactiveDetailCount(){return intricate.actions.length},
 get solidShellBlockerCount(){return occlusionMeshes.length},
 get floatingScene(){return floatingScene},
 get pedestalSupportLengths(){return []},
 get pedestalMeshCount(){return scene.children.filter(o=>/plinth|floor|support/i.test(o.name)).length},
 get storyMounts(){return pocketWorlds?.getMountPositions?.()||[]},
 getStoryMountVisualState(name){return pocketWorlds?.getMountVisualState?.(name)||null},
 get physicalMechanismState(){return intricate.getState()},
 get miniatureMechanismPose(){return {
  bagDials:pocketWorlds?.getDialAngles?.()||[],
  liftDoors:pocketWorlds?.getLiftDoorPositions?.()||[],
  elevatorButton4:pocketWorlds?.getElevatorButtonDepth?.(4)??null
 }},
 get physicalClueVisibility(){return gameHotspots?.getClueVisibility?.()||{}},
 get physicalFluteVisible(){return gameHotspots?.fluteVisible?.()||false},
 get physicalActuatorDepths(){return Object.fromEntries(
  ["latch","dot","triangle","pressure","vent-1","shutter","eye-ring"]
   .map(name=>[name,gameHotspots?.getActuatorDepth(name)??null]))},
 get drawerPositions(){return {front:front.drawer.position.z,side:side.drawer.position.z}},
 get visibleFrontScrews(){return screws.filter(v=>v.id.startsWith("front-screw-")&&v.assembly.visible).length},
 detailState:()=>intricate.getState(),
 get frontOpen(){return front.open},
 get sideOpen(){return side.open},
 get topOpen(){return lidOpen},
 get hatchBraceLengths(){updateHatchBraces();return hingeBraces.map(({body})=>body.scale.y)},
 get hatchAngle(){syncHatchMotion();return lidPivot.rotation.x},
 get renderMode(){return "on-demand"},
 get performanceMode(){return {
  softwareGL,constrainedDevice,rendererName:gpuName,
  pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled
 }},
 get navigationState(){return {panEnabled:controls.enablePan,
  target:controls.target.toArray(),camera:camera.position.toArray(),
  cameraReturning:!!cameraReturnMotion,
  panMode:controls.mouseButtons.LEFT===THREE.MOUSE.PAN,
  rightPan:controls.mouseButtons.RIGHT===THREE.MOUSE.PAN}} ,
 resetCameraView:returnCameraHome,
 get reducedMotion(){return reducedMotion},
 get screwsOut(){return screws.filter(s=>s.removed).length},
 clickAction,
 get lastClickedAction(){return lastClickedAction},
 setZoom(value){
  if(!embeddedGame)return;
  const mobile=stage.clientWidth<720;
  const base=mobile?
   Math.hypot(5.6,4.7,7.45):Math.hypot(3.85,3.2,5.9);
  const d=THREE.MathUtils.clamp(base/Math.max(.65,value),5.2,14);
  const offset=camera.position.clone().sub(controls.target).setLength(d);
  camera.position.copy(controls.target).add(offset);
  controls.update();invalidate();
 },
 setPanMode(enabled){
  if(!embeddedGame)return;
  controls.enablePan=true;
  controls.mouseButtons.LEFT=enabled?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
  controls.touches.ONE=enabled?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
 },
 setRotation(rx,ry){
  if(!embeddedGame)return;
  cube.rotation.x=THREE.MathUtils.degToRad(rx);
  cube.rotation.y=THREE.MathUtils.degToRad(ry);
  invalidate();
 },
 syncState(state){
  if(!embeddedGame)return;
  currentGameState=state||{};
  const restoring=!physicalStateInitialized;
  // Inventory changes are authoritative: empty trays and sockets physically
  // lose their parts on pickup, including every historically duplicated mesh.
  looseKey.visible=!currentGameState.drawerTaken;
  looseSpool.visible=!currentGameState.sideTaken;
  undersideRing.visible=!currentGameState.ringTaken;
  if(gameHotspots)gameHotspots.setState(currentGameState);
  renderer.domElement.setAttribute("aria-label",gameHotspots?.fluteVisible?.()
   ?"3D puzzle cube. The collected flute has three playable keys. With this canvas focused, keys 1, 2 and 3 play its tones."
   :"Rotatable three-dimensional puzzle cube with physical drawers, gears and hidden compartments.");
  if(pocketWorlds)pocketWorlds.setState(currentGameState);
  intricate.syncGameState(currentGameState,restoring);
  physicalStateInitialized=true;
  for(const [obj,open] of [[front,!!state.a],[side,!!state.b]]){
   if(obj.open!==open){
    obj.open=open;
    obj.motion?.kill();
    if(obj.finishTimer){clearTimeout(obj.finishTimer);obj.finishTimer=null;}
    const rest=open?.76:0;
    const finish=()=>{
     if(obj.open!==open)return; // A quick reversal wins.
     if(obj.finishTimer){clearTimeout(obj.finishTimer);obj.finishTimer=null}
     obj.drawer.position.z=rest;
     obj.motion=null;
     invalidate();
    };
    if(reducedMotion||restoring){obj.drawer.position.z=rest;invalidate();}
    else{
     // Extend on real tracks and lightly settle against the end stop.
     // The absolute timer prevents an overloaded WebGL renderer from
     // leaving a drawer permanently halfway through a timeline.
     obj.motion=gsap.timeline({
      onUpdate:invalidate,
      onComplete:finish
     }).to(obj.drawer.position,{
      z:open?.85:-.035,duration:.44,ease:"power2.out"
     }).to(obj.drawer.position,{
      z:rest,duration:.25,ease:"back.out(1.55)"
     });
     obj.finishTimer=setTimeout(()=>{
      if(obj.open!==open)return;
      obj.motion?.kill();
      finish();
     },1700);
    }
   }
  }
  if(lidOpen!==!!state.top){
   lidOpen=!!state.top;
   hatchMotion=reducedMotion||restoring?null:{start:performance.now(),duration:920,from:lidPivot.rotation.x,to:lidOpen?-1.08:0};
   if(reducedMotion||restoring)lidPivot.rotation.x=lidOpen?-1.08:0;
  }
  for(const screw of screws){
   const num=Number(screw.id.slice(-1));
   const removed=screw.id.startsWith("front-screw-")&&!!state.screws?.includes(num)
    ||screw.id.startsWith("top-screw-")&&num<3&&!!state.hingePins?.includes(num)
    ||screw.id==="side-screw-1"&&!!state.rightBoltLoose;
   // The fourth fastener is not a screw: its spring button depresses
   // and rebounds, rather than appearing to be unscrewed.
   if(screw.id==="front-screw-3"){
    const turned=(state.falseScrewTurns||0);
    if(screw.lastTurns!==turned){
     screw.lastTurns=turned;
     gsap.killTweensOf(screw.assembly.position);
     if(restoring||reducedMotion){screw.assembly.position.z=.13;}
     else{
      screw.motion=gsap.timeline({onUpdate:invalidate})
       .to(screw.assembly.position,{z:.067,duration:.11,ease:"power2.out"})
       .to(screw.assembly.position,{z:.13,duration:.28,ease:"back.out(2)"});
     }
    }
    continue;
   }
   if(screw.removed===removed)continue;
   screw.removed=removed;
   screw.motion?.kill();
   if(screw.removalTimer){clearTimeout(screw.removalTimer);screw.removalTimer=null;}
   gsap.killTweensOf(screw.assembly.position);
   gsap.killTweensOf(screw.assembly.rotation);
   gsap.killTweensOf(screw.assembly.scale);
   if(restoring||reducedMotion){
    screw.assembly.position.z=.13;
    screw.assembly.rotation.z=0;
    screw.assembly.scale.set(1,1,1);
    screw.assembly.visible=!removed;
   }else if(removed){
    screw.assembly.visible=true;
    // Keep the threaded shaft visible as it comes out of the counterbore.
    // Only after a full turn and axial extraction is it removed.
    screw.motion=gsap.timeline({onUpdate:invalidate})
     .to(screw.assembly.position,{z:.53,duration:.45,ease:"power2.out"},0)
     .to(screw.assembly.rotation,{z:Math.PI*2,duration:.45,ease:"power1.inOut"},0)
     .to(screw.assembly.scale,{x:.72,y:.72,z:.72,duration:.14},.35)
     .call(()=>{if(screw.removed){screw.assembly.visible=false;invalidate();}});
    // A throttled animation frame must never leave collected fasteners
    // attached to the cube. The logical removal is authoritative.
    screw.removalTimer=setTimeout(()=>{
     if(screw.removed){screw.assembly.visible=false;invalidate();}
     screw.removalTimer=null;
    },900);
   }else{
    screw.assembly.visible=true;
    screw.assembly.scale.set(1,1,1);
    screw.motion=gsap.timeline({onUpdate:invalidate})
     .fromTo(screw.assembly.position,{z:.53},{z:.13,duration:.40})
     .to(screw.assembly.rotation,{z:0,duration:.4},"<");
   }
  }
  invalidate();
 }
};
announce("A hand-built mechanical curiosity — inspect the dials, rails, lenses and hidden compartments.");
if(embeddedGame){
 window.addEventListener("nc:statechange",event=>window.__nothing3DPreview.syncState(event.detail));
 window.__nothing3DPreview.syncState(window.CriloNothingHereCube?.getState?.()||{});
 document.body.classList.add("nc-physical-ready");
 // Before physical mode activates the hidden canvas inherits the old CSS
 // cube's narrow width. Its initial ResizeObserver can incorrectly choose
 // MOBILE camera framing on a wide desktop, leaving the cube far away and
 // the zoom indicator at 74%. Re-frame ONCE using the actual visible stage.
 cameraMode=null;
 onResize();
 controls.update();
 window.CriloNothingHereCube?.updatePhysicalViewZoom?.(1);
 invalidate();
 document.getElementById("ncPhysicalToggle")?.setAttribute("aria-pressed","true");
}
