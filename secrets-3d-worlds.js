import * as THREE from "three";
import {gsap} from "gsap";

/**
 * An actual miniature world attached to the 3D machine. Every story actor
 * has a small sculpted counterpart with its own solids, rather than an HTML
 * illustration pasted over the WebGL stage.
 *
 * Puzzle logic and localStorage remain entirely in cube-secrets.js.
 */
export function buildPocketWorlds({cube,faces,box,cylinder,mat,setHit,invalidate=()=>{}}){
 const m={
  brass:mat(0xbda174,.67,.34),gold:mat(0xf1d8a6,.32,.32),
  dark:mat(0x454653,.35,.53),wood:mat(0x916b5b,.17,.69),
  cream:mat(0xf4e6d4,.12,.43),pink:mat(0xd9a3a9,.07,.62),
  blue:mat(0xa6cbd1,.12,.43),green:mat(0x92baa0,.1,.62),
  velvet:mat(0x7b6887,.03,.83),leaf:mat(0x659273,.03,.68),
  white:mat(0xe8e6df,.07,.4),black:mat(0x272f39,.19,.54),
  glass:mat(0xaacddc,.06,.18),copper:mat(0xba826a,.57,.42)
 };
 const mounts=[];
 let parts=0;
 const items=new Map(),locations=new Map();
 const puzzleControls=new Map(),bagDials=[],bagDialGlyphs=[],liftDoors=[];
 // The bag code wheels have legible stamped symbols directly on their metal
 // faces. Updating a dial changes its own inlay instead of showing a popup.
 const glyphMaterials=["○","✳","◇","☾"].map(symbol=>{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=256;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,256,256);
  ctx.fillStyle="#3a4850";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="bold 190px Georgia,serif";
  ctx.fillText(symbol,128,136,214);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
 });
 const numerals=[1,2,3,4].map(n=>{
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#323f47";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="bold 95px system-ui,sans-serif";ctx.fillText(String(n),64,71);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
 });
 let bagDialPanel=null;
 let doorLeaf=null,musicLid=null,vaseWhole=null,vaseFragments=null;
 let loadedOriginalStory=false;
 let lastDialValues=null,lastFloorFour=false;
 const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 const setPose=(object,axis,key,target,duration=.65,instant=false)=>{
  if(!object||Math.abs(object[axis][key]-target)<.001)return;
  gsap.killTweensOf(object[axis]);
  // On a saved-game reload the prior puzzle state must appear immediately:
  // animating every old prop from its initial pose can confuse the player and
  // take multiple seconds on mobile/SwiftShader.
  if(reducedMotion||instant){object[axis][key]=target;invalidate();return;}
  gsap.to(object[axis],{[key]:target,duration,ease:"power2.inOut",onUpdate:invalidate});
 };
 const B=(g,w,h,d,x,y,z,color,r=.027)=>{
  const o=box(g,w,h,d,x,y,z,color,r);
  o.castShadow=w>.13&&h>.12&&d>.09;parts++;return o;
 };
 const C=(g,r,h,x,y,z,color,axis="y")=>{
  const o=cylinder(g,r,h,x,y,z,color);o.rotation.set(0,0,0);
  if(axis==="x")o.rotation.z=Math.PI/2;
  if(axis==="z")o.rotation.x=Math.PI/2;
  o.castShadow=r>.12;parts++;return o;
 };
 const ball=(g,r,x,y,z,material,scale=null)=>{
  const o=new THREE.Mesh(new THREE.SphereGeometry(r,12,9),material);
  o.position.set(x,y,z);
  if(scale)o.scale.set(...scale);
  o.castShadow=r>.1;o.receiveShadow=true;g.add(o);parts++;return o;
 };
 const wire=(g,points,r,material)=>{
  const o=new THREE.Mesh(new THREE.TubeGeometry(
   new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),
   Math.max(12,points.length*5),r,5,false),material);
  o.castShadow=false;g.add(o);parts++;return o;
 };
 const torus=(g,r,t,x,y,z,color,axis="y")=>{
  const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,7,24),color);
  o.position.set(x,y,z);
  if(axis==="y")o.rotation.x=Math.PI/2;
  if(axis==="x")o.rotation.y=Math.PI/2;
  g.add(o);parts++;return o;
 };
 // Discoveries live in little bolt-on mechanical display sockets ON THE
 // CUBE. They cannot stay on a stationary pedestal after the player rotates
 // the floating box. Each socket is screwed into a specific actual face.
 // Staggered positions leave the principal drawers, iris and switches clear.
 const slots=[
  ["bag","frontFace",-1.00,.70],["machine","frontFace",1.02,.68],
  ["door","rightFace",1.00,.71],["dog","rightFace",0,.70],
  ["vase","rightFace",-1.0,-.96],
  ["pot","backFace",-1.02,.68],["musicbox","backFace",0,.72],
  ["cloud","backFace",1.03,.70],["squirrel","bottomFace",-1.04,-.86],
  ["cup","leftFace",.0,-1.0],["clock","leftFace",1.03,.7],
  ["elevator","leftFace",-1.01,-.96],
  ["moth","topFace",-1.04,.21],["telescope","topFace",1.04,-.65],
  ["train","bottomFace",1.03,-.90]
 ];
 for(const [name,faceName,x,y] of slots){
  const face=faces[faceName],fixture=new THREE.Group();
  fixture.position.set(x,y,.27);
  face.add(fixture);locations.set(name,fixture);
  mounts.push({name,face:faceName,x,y});
  // A structural shelf, a backplate and two visible tiny bolts secure each
  // model to the cube. No independent gallery base exists beneath the box.
  const stand=new THREE.Group();fixture.add(stand);
  B(stand,.56,.45,.065,0,.15,-.04,m.dark,.020);
  B(stand,.50,.37,.024,0,.16,.008,m.brass,.020);
  B(stand,.57,.065,.42,0,-.035,.19,m.dark,.022);
  B(stand,.53,.037,.39,0,.009,.19,m.gold,.020);
  for(const px of [-.225,.225]){
   C(stand,.024,.03,px,.28,.027,m.brass,"z");
   C(stand,.024,.03,px,-.03,.416,m.brass,"z");
  }
  const toy=new THREE.Group();
  toy.position.set(0,.03,.205);
  toy.scale.setScalar(.69);
  fixture.add(toy);
  const hitVolume=new THREE.Mesh(
   new THREE.BoxGeometry(.61,.71,.50),
   new THREE.MeshBasicMaterial({transparent:true,opacity:0,
    depthWrite:false,colorWrite:false,side:THREE.DoubleSide})
  );
  hitVolume.position.set(0,.33,.11);
  toy.add(hitVolume);toy.userData.pickVolume=hitVolume;parts++;
  items.set(name,{fixture,toy,stand,hitVolume,visible:false});
 }
 const toy=name=>items.get(name).toy;
 // Travel bag: sculpted leather box, curved handle, buckles and working
 // interior cue on the same real mesh group.
 {
  const g=toy("bag");
  B(g,.44,.37,.25,0,.22,0,m.velvet,.09);
  B(g,.45,.08,.275,0,.38,0,m.dark,.025);
  B(g,.32,.045,.12,0,.18,.14,m.brass,.016);
  for(const x of [-.16,.16]){
   B(g,.055,.31,.025,x,.24,.147,m.gold,.01);
   C(g,.034,.02,x,.22,.161,m.dark,"z");
  }
  wire(g,[[-.12,.41,0],[-.10,.55,0],[.10,.55,0],[.12,.41,0]],.024,m.brass);
  // The three combination tumblers are actual rotating bronze cylinders,
  // fixed to a machined backplate on the bag, not modal-only buttons.
  bagDialPanel=new THREE.Group();g.add(bagDialPanel);
  B(bagDialPanel,.43,.12,.034,0,.275,.153,m.dark,.017);
  for(let i=0;i<3;i++){
   const dial=new THREE.Group();
   dial.position.set((i-1)*.13,.275,.197);bagDialPanel.add(dial);
   C(dial,.047,.030,0,0,0,m.gold,"z");
   B(dial,.012,.014,.012,0,.039,.030,m.black,.003);
   const glyph=new THREE.Mesh(new THREE.PlaneGeometry(.067,.067),glyphMaterials[0]);
   glyph.position.z=.047;dial.add(glyph);parts++;
   // Dedicated fingertip hit target; it cannot overlap the next dial.
   const dialTouch=new THREE.Mesh(new THREE.CylinderGeometry(.056,.056,.035,20),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,
     depthWrite:false,side:THREE.DoubleSide}));
   dialTouch.rotation.x=Math.PI/2;dialTouch.position.z=.067;
   dial.add(dialTouch);parts++;
   bagDialGlyphs.push(glyph);
   puzzleControls.set("thing:bag-dial-"+i,dial);bagDials.push(dial);
  }
 }
 // Real opening doorway, jamb, inset raised panel, solid knob.
 {
  const g=toy("door");
  B(g,.55,.73,.10,0,.39,0,m.brass,.032);
  // A true hinge: every inset panel and the brass knob are children of the
  // moving timber leaf. The surround stays bolted to its original socket.
  B(g,.46,.65,.027,0,.40,.072,m.dark,.012);
  doorLeaf=new THREE.Group();
  doorLeaf.position.set(-.214,.08,.085);g.add(doorLeaf);
  B(doorLeaf,.405,.625,.072,.214,.32,0,m.wood,.018);
  B(doorLeaf,.30,.27,.029,.214,.41,.053,m.cream,.014);
  B(doorLeaf,.29,.16,.029,.214,.12,.053,m.velvet,.012);
  C(doorLeaf,.041,.05,.352,.28,.070,m.gold,"z");
  for(const y of [.16,.49])C(g,.026,.075,-.22,y,.102,m.brass);
 }
 // Dog with actual muzzle, paws, nose, ears and collar.
 {
  const g=toy("dog");
  ball(g,.22,0,.32,0,m.cream,[1.10,.87,1.26]);
  ball(g,.16,0,.50,.145,m.cream,[1.1,1.15,.88]);
  ball(g,.12,0,.45,.27,m.wood,[1.12,.66,.79]);
  ball(g,.034,0,.52,.342,m.black);
  for(const x of [-.105,.105]){
   ball(g,.045,x,.58,.23,m.dark);
   ball(g,.032,x*.57,.54,.289,m.black);
   B(g,.095,.16,.14,x*1.65,.155,.12,m.cream,.034);
   B(g,.085,.14,.13,x*1.65,.155,-.15,m.cream,.033);
  }
  torus(g,.13,.024,0,.47,.125,m.brass);
  ball(g,.09,.19,.38,-.16,m.cream,[1.8,.5,.65]);
 }
 // Fragile ceramic vase with narrow neck and dark opening.
 {
  const g=toy("vase");
  vaseWhole=new THREE.Group();g.add(vaseWhole);
  vaseFragments=new THREE.Group();g.add(vaseFragments);
  C(vaseWhole,.17,.29,0,.22,0,m.pink);
  C(vaseWhole,.105,.18,0,.44,0,m.pink);
  C(vaseWhole,.135,.035,0,.53,0,m.cream);
  C(vaseWhole,.084,.009,0,.552,0,m.dark);
  for(let i=0;i<4;i++){
   const t=i*Math.PI/2;
   wire(vaseWhole,[[Math.sin(t)*.15,.12,Math.cos(t)*.15],
    [Math.sin(t)*.17,.28,Math.cos(t)*.17],
    [Math.sin(t)*.08,.45,Math.cos(t)*.08]],.009,m.gold);
  }
  // Broken state is NOT a tiny compressed intact pot: twelve differently
  // oriented ceramic shards are real beveled solid pieces scattered around
  // the impact point and still rest on the miniature's display socket.
  for(let i=0;i<12;i++){
   const angle=i*Math.PI*2/12,radius=.07+(i%3)*.065;
   const shape=new THREE.Shape();
   shape.moveTo(-.052,-.025);shape.lineTo(.052,-.027);
   shape.lineTo(.078,.024);shape.lineTo(-.018,.081);shape.closePath();
   const shard=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{
    depth:.017,bevelEnabled:true,bevelSegments:1,steps:1,
    bevelSize:.007,bevelThickness:.006
   }),i%4===0?m.cream:m.pink);
   shard.position.set(Math.cos(angle)*radius,.071+Math.min(.02,i%4*.005),Math.sin(angle)*radius);
   shard.rotation.set(-Math.PI/2+(i%4)*.15,angle,(i%3-1)*.20);
   shard.scale.setScalar(.85+(i%4)*.14);
   shard.castShadow=false;shard.receiveShadow=true;
   vaseFragments.add(shard);parts++;
  }
  vaseFragments.visible=false;
 }
 // Flowerpot and actual little tree. Its branches only appear once watered.
 const branches=new THREE.Group();
 {
  const g=toy("pot");
  const pot=C(g,.21,.30,0,.19,0,m.wood);
  pot.scale.set(1.0,1,1);
  C(g,.24,.035,0,.36,0,m.brass);
  C(g,.18,.015,0,.38,0,m.dark);
  branches.position.set(0,.37,0);g.add(branches);
  C(branches,.045,.38,0,.19,0,m.wood);
  for(const [x,y,z] of [[-.14,.40,.00],[.12,.51,.04],[0,.63,0]]){
   ball(branches,.16,x,y,z,m.leaf,[1.15,.72,1.0]);
  }
 }
 // Music box has a hinged lid, crank, keys, and recognizable moving dancer.
 const dancer=new THREE.Group();
 {
  const g=toy("musicbox");
  B(g,.49,.30,.40,0,.20,0,m.wood,.026);
  musicLid=new THREE.Group();
  musicLid.position.set(0,.39,-.205);g.add(musicLid);
  B(musicLid,.53,.052,.43,0,0,.165,m.brass,.021);
  for(const x of [-.17,.17]){
   C(g,.038,.045,x,.38,-.20,m.gold,"x");
  }
  for(let i=0;i<7;i++)B(g,.043,.022,.10,-.17+i*.055,.31,.22,i%2?m.cream:m.dark,.008);
  torus(g,.07,.018,.275,.24,.01,m.gold,"x");
  wire(g,[[.27,.27,.01],[.34,.34,.01],[.38,.34,.01]],.013,m.brass);
  dancer.position.set(0,.44,0);g.add(dancer);
  C(dancer,.025,.16,0,.09,0,m.brass);
  ball(dancer,.064,0,.24,0,m.cream);
  C(dancer,.13,.073,0,.055,0,m.pink);
  wire(dancer,[[-.11,.18,0],[.0,.16,0],[.11,.23,0]],.012,m.brass);
 }
 // Tiny real three-ball cloud, dangling raindrops.
 {
  const g=toy("cloud");
  for(const [x,y,r] of [[-.15,.42,.16],[0,.50,.23],[.18,.40,.18]]){
   ball(g,r,x,y,0,m.white,[1.2,.76,1]);
  }
  for(const x of [-.16,0,.16]){
   ball(g,.035,x,.23,.065,m.blue,[.65,1.6,.65]);
  }
 }
 // Small porcelain teacup with liquid and a physical ring handle.
 {
  const g=toy("cup");
  C(g,.18,.23,0,.20,0,m.cream);
  C(g,.17,.02,0,.315,0,m.brass);
  C(g,.13,.01,0,.329,0,m.wood);
  torus(g,.115,.027,.20,.22,0,m.gold,"x");
  C(g,.21,.025,0,.078,0,m.cream);
 }
 // Intricate pocket watch, dial, hands, external winding crown.
 {
  const g=toy("clock");
  C(g,.22,.09,0,.35,0,m.brass,"z");
  C(g,.18,.022,0,.35,.063,m.cream,"z");
  torus(g,.20,.016,0,.35,.07,m.gold,"z");
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   B(g,.025,.011,.01,Math.cos(a)*.155,.35+Math.sin(a)*.155,.083,m.dark,.005);
  }
  wire(g,[[0,.35,.087],[.00,.47,.087]],.009,m.dark);
  wire(g,[[0,.35,.087],[.092,.27,.087]],.009,m.wood);
  C(g,.055,.043,0,.60,0,m.gold);
 }
 // Vending machine has a physical glass panel and dispensed sugar tray.
 {
  const g=toy("machine");
  B(g,.44,.70,.34,0,.39,0,m.blue,.027);
  B(g,.29,.29,.024,-.032,.51,.184,m.dark,.015);
  for(let i=0;i<4;i++)B(g,.22,.013,.016,-.032,.4+i*.056,.204,m.brass,.006);
  B(g,.27,.083,.09,0,.17,.20,m.dark,.016);
  B(g,.12,.06,.03,.135,.39,.187,m.gold,.007);
  C(g,.045,.022,.13,.53,.193,m.cream,"z");
 }
 // Brass elevator with cage, doors, rails, counterweight.
 {
  const g=toy("elevator");
  for(const x of [-.23,.23])B(g,.033,.72,.042,x,.39,0,m.brass,.012);
  for(const y of [.12,.71])B(g,.5,.035,.37,0,y,0,m.brass,.012);
  for(const x of [-.105,.105]){
   const door=B(g,.20,.52,.045,x,.39,.17,m.gold,.016);
   liftDoors.push(door);
  }
  // Four mechanically mounted brass call buttons next to the cage.
  B(g,.18,.68,.16,.32,.39,.055,m.dark,.024);
  for(let floor=1;floor<=4;floor++){
   const button=new THREE.Group();
   button.position.set(.32,.15+floor*.11,.159);g.add(button);
   C(button,.043,.025,0,0,0,m.brass,"z");
   C(button,.036,.028,0,0,.020,floor===4?m.pink:m.cream,"z");
   const digit=new THREE.Mesh(new THREE.PlaneGeometry(.053,.053),numerals[floor-1]);
   digit.position.z=.040;button.add(digit);parts++;
   // Each floor has its own tappable collar with clearance between keys.
   const floorTouch=new THREE.Mesh(new THREE.CylinderGeometry(.051,.051,.034,20),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,
     depthWrite:false,side:THREE.DoubleSide}));
   floorTouch.rotation.x=Math.PI/2;floorTouch.position.z=.063;
   button.add(floorTouch);parts++;
   puzzleControls.set("thing:elevator-floor-"+floor,button);
  }
  C(g,.07,.03,0,.77,0,m.black,"z");
  C(g,.045,.014,0,.77,.04,m.blue,"z");
 }
 // Clockwork moth: visible wings, real wire antennae, and body.
 {
  const g=toy("moth");
  ball(g,.045,0,.42,0,m.dark,[1,2.5,1]);
  for(const s of [-1,1]){
   const wing=ball(g,.15,s*.15,.48,0,m.velvet,[1.05,.52,.35]);
   wing.rotation.z=s*.33;
   wire(g,[[0,.51,0],[s*.095,.63,0],[s*.16,.67,0]],.008,m.brass);
  }
  C(g,.07,.02,0,.34,0,m.brass);
 }
 // Real tripod and brass telescope barrel with contrasting black optic.
 {
  const g=toy("telescope");
  for(const a of [0,2.09,4.18]){
   wire(g,[[0,.37,0],[Math.cos(a)*.22,.09,Math.sin(a)*.22]],.018,m.wood);
  }
  const barrel=C(g,.095,.52,0,.47,0,m.brass,"z");
  barrel.rotation.x=-.37;
  C(g,.078,.04,0,.55,.24,m.dark,"z");
  C(g,.11,.035,0,.39,-.23,m.gold,"z");
  C(g,.07,.017,0,.555,.263,m.glass,"z");
 }
 // Working railroad carriage: continuous track, ties, locomotive wheels
 // and chimney are solids that catch lighting from every angle.
 {
  const g=toy("train");
  for(const x of [-.17,.17])B(g,.029,.045,.61,x,.08,0,m.dark,.008);
  for(let i=-3;i<=3;i++)B(g,.41,.027,.046,0,.064,i*.085,m.wood,.009);
  B(g,.26,.19,.33,0,.28,0,m.dark,.024);
  C(g,.10,.35,0,.39,0,m.brass,"z");
  B(g,.26,.21,.15,0,.43,-.18,m.green,.02);
  C(g,.050,.18,0,.57,.075,m.black);
  for(const z of [-.15,.14])for(const x of [-.16,.16])C(g,.071,.035,x,.16,z,m.gold,"x");
 }
 // Squirrel, with copper whiskers and genuinely curved swept tail.
 {
  const g=toy("squirrel");
  ball(g,.13,0,.28,0,m.wood,[.86,1.22,.95]);
  ball(g,.10,0,.46,.095,m.wood);
  ball(g,.034,-.045,.50,.18,m.black);
  ball(g,.034,.045,.50,.18,m.black);
  for(const x of [-.075,.075])ball(g,.042,x,.57,.057,m.pink);
  wire(g,[[.08,.27,-.11],[.22,.38,-.17],[.22,.58,-.20],[.10,.69,-.16]],.055,m.wood);
 }
 function inspect(name){
  const instance=items.get(name);
  if(!instance?.fixture.visible)return false;
  const object=instance.toy;
  gsap.killTweensOf(object.position);
  gsap.killTweensOf(object.rotation);
  // Objects acknowledge touch by briefly shifting in their captive
  // mount. Never auto-rotate to a solution or falsely eject inventory.
  if(reducedMotion){invalidate();return true;}
  const front=object.position.z;
  const lean=name==="bag"||name==="door"?-.055:.045;
  gsap.timeline({onUpdate:invalidate})
   .to(object.position,{z:front+.095,duration:.13,ease:"power2.out"},0)
   .to(object.rotation,{z:lean,duration:.13,ease:"power2.out"},0)
   .to(object.position,{z:front,duration:.42,ease:"back.out(1.8)"},.14)
   .to(object.rotation,{z:0,duration:.40,ease:"back.out(1.8)"},.14);
  return true;
 }
 function pulse(action){
  const control=puzzleControls.get(action);
  if(!control||!action.startsWith("thing:elevator-floor-"))return false;
  gsap.killTweensOf(control.position);
  if(reducedMotion){control.position.z=.159;invalidate();return true;}
  control.position.z=.105;invalidate();
  gsap.to(control.position,{z:.159,duration:.32,delay:.085,
   ease:"back.out(2)",onUpdate:invalidate});
  return true;
 }
 function setState(state){
  const s=state||{};
  const firstRestore=!loadedOriginalStory&&Object.keys(s).length>0;
  if(firstRestore)loadedOriginalStory=true;
  const show={
   bag:s.bag,door:s.door,dog:s.doorOpen,vase:s.doorOpen,
   squirrel:s.squirrel, pot:s.vase,musicbox:s.vase,
   cloud:s.cloud,cup:s.music,clock:s.watch,machine:s.mouse,
   elevator:s.watch&&s.tag,moth:s.floorFour,
   telescope:s.moon,train:s.train
  };
  for(const [name,instance] of items){
   const visible=!!show[name];
   const newlyFound=visible&&!instance.visible;
   instance.fixture.visible=visible;
   instance.visible=visible;
   if(visible&&newlyFound){
    gsap.killTweensOf(instance.fixture.scale);
    gsap.killTweensOf(instance.fixture.position);
    if(instance.finishTimer){clearTimeout(instance.finishTimer);instance.finishTimer=null}
    const settle=()=>{
     if(!instance.fixture.visible)return;
     if(instance.finishTimer){clearTimeout(instance.finishTimer);instance.finishTimer=null}
     instance.entranceMotion?.kill();
     instance.entranceMotion=null;
     instance.entranceStartedAt=0;
     instance.fixture.scale.setScalar(1);
     instance.fixture.position.z=.27;
     invalidate();
    };
    if(firstRestore||reducedMotion){
     // Restored discoveries must be immediately stable.
     settle();
    }else{
     // A collectible physically emerges from its fastened display socket.
     instance.fixture.scale.setScalar(.62);
     instance.fixture.position.z=.13;
     instance.entranceStartedAt=Date.now();
     instance.entranceMotion=gsap.timeline({onUpdate:invalidate,onComplete:settle})
      .to(instance.fixture.scale,{
       x:1.045,y:1.045,z:1.045,duration:.43,ease:"power2.out"
      },0)
      .to(instance.fixture.position,{z:.31,duration:.43,ease:"power2.out"},0)
      .to(instance.fixture.scale,{
       x:1,y:1,z:1,duration:.23,ease:"sine.out"
      },.43)
      .to(instance.fixture.position,{z:.27,duration:.23,ease:"sine.out"},.43);
     // A slow graphics driver can throttle RAF for seconds. The mechanical
     // end pose must still be reached on a fixed wall-clock deadline.
     instance.finishTimer=setTimeout(()=>{
      if(!instance.fixture.visible)return;
      instance.entranceMotion?.kill();
      gsap.killTweensOf(instance.fixture.scale);
      gsap.killTweensOf(instance.fixture.position);
      settle();
     },1350);
    }
   }else if(!visible){
    if(instance.finishTimer){clearTimeout(instance.finishTimer);instance.finishTimer=null}
    instance.entranceMotion?.kill();
    instance.entranceMotion=null;
    instance.entranceStartedAt=0;
    gsap.killTweensOf(instance.fixture.scale);
    gsap.killTweensOf(instance.fixture.position);
    instance.fixture.scale.setScalar(1);
    instance.fixture.position.z=.27;
   }
  }
  branches.visible=!!s.tree;
  dancer.visible=!!s.dancer;
  setPose(doorLeaf,"rotation","y",s.doorOpen?-.98:0,.65,firstRestore);
  setPose(musicLid,"rotation","x",s.music?-.91:0,.65,firstRestore);
  if(vaseWhole)vaseWhole.visible=!s.vase;
  if(vaseFragments)vaseFragments.visible=!!s.vase;
  // The code wheels are hidden inside the luggage lining until the
  // original key has released its catch; before then, clicking the bag
  // still reaches the locked-bag clue instead of an inaccessible dial.
  if(bagDialPanel)bagDialPanel.visible=!!s.bagOpen;
  // These generic transparent inspection boxes used to sit IN FRONT of
  // real puzzle controls. The bag's actual leather stays selectable after
  // opening, while its dials and all four elevator keys win the raycast.
  const bagVolume=items.get("bag")?.hitVolume;
  if(bagVolume)bagVolume.visible=!s.bagOpen;
  const liftVolume=items.get("elevator")?.hitVolume;
  if(liftVolume)liftVolume.visible=false;
  const newDialValues=[0,1,2].map(i=>(s.bagDials?.[i]||0)%4);
  for(let i=0;i<bagDials.length;i++){
   const value=newDialValues[i],dial=bagDials[i],glyph=bagDialGlyphs[i];
   if(!lastDialValues||firstRestore){
    gsap.killTweensOf(dial.rotation);
    gsap.killTweensOf(glyph.rotation);
    dial.rotation.z=value*Math.PI/2;
    glyph.rotation.z=-dial.rotation.z;
   }else if(value!==lastDialValues[i]){
    const turns=(value-lastDialValues[i]+4)%4;
    // Forward-only ratchet: wrapping 3 -> 0 advances one detent, not
    // backwards through three other symbols.
    const end=dial.rotation.z+turns*Math.PI/2;
    setPose(dial,"rotation","z",end,.33);
    setPose(glyph,"rotation","z",-end,.33);
   }
   glyph.material=glyphMaterials[value];
  }
  lastDialValues=newDialValues;
  liftDoors.forEach((panel,i)=>{
   const target=(i===0?-1:1)*(s.floorFour?.18:.105);
   if(firstRestore||reducedMotion)panel.position.x=target;
   else if(lastFloorFour!==!!s.floorFour)
    setPose(panel,"position","x",target,.83);
  });
  lastFloorFour=!!s.floorFour;
  // The vase remains full-size in object space: its genuine fragments replace
  // the intact geometry, rather than squashing the original to fake breakage.
 }
 // Raycast targets must be registered AFTER sculpting the miniatures:
 // otherwise setHit traverses an empty group and none of them are clickable.
 for(const [name,{toy}] of items)setHit(toy,"thing:"+name);
 // Register small control meshes AFTER their parent miniatures; otherwise
 // the generic "inspect the bag" action would overwrite all dial hit IDs.
 for(const [action,part] of puzzleControls)setHit(part,action);
 // Focus and hover belong to the outer stage; this geometry awards nothing.
 setState({});
 return {
  names:[...items.keys()],
  targets:new Map([...items].map(([n,v])=>[n,v.toy])),
  puzzleTargets:puzzleControls,
  pickVolumes:new Map([...items].map(([n,v])=>[n,v.hitVolume])),
  puzzleActions:[...puzzleControls.keys()],
  pulse,
  inspect,
  getDialAngles:()=>bagDials.map(d=>d.rotation.z),
  getLiftDoorPositions:()=>liftDoors.map(d=>d.position.x),
  getElevatorButtonDepth:n=>puzzleControls.get("thing:elevator-floor-"+n)?.position.z??null,
  getPose:()=>({
   doorAngle:doorLeaf?.rotation.y??0,
   musicLidAngle:musicLid?.rotation.x??0,
   vaseWholeVisible:vaseWhole?.visible??false,
   shardsVisible:vaseFragments?.visible??false,
   shardCount:vaseFragments?.children.length??0
  }),
  setState,
  meshCount:()=>parts,
  visibleNames:()=>[...items].filter(([,v])=>v.fixture.visible).map(([n])=>n),
  getMountPositions:()=>mounts,
  getMountVisualState:name=>{
   const instance=items.get(name);
   if(!instance)return null;
   // Extremely slow software WebGL can delay requestAnimationFrame for
   // seconds. Reading an already-expired entrance resolves its real final
   // physical pose rather than allowing an old tween to hang indefinitely.
   if(instance.entranceStartedAt&&
      Date.now()-instance.entranceStartedAt>1600){
     instance.entranceMotion?.kill();
     instance.entranceMotion=null;
     instance.entranceStartedAt=0;
     if(instance.finishTimer){clearTimeout(instance.finishTimer);instance.finishTimer=null}
     instance.fixture.scale.setScalar(1);
     instance.fixture.position.z=.27;
     invalidate();
   }
   const fixture=instance.fixture;
   return {visible:fixture.visible,scale:fixture.scale.x,depth:fixture.position.z};
  }
 };
}
