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
 // The live QA can inspect real modeled fastener coordinates and confirm
 // that every miniature has continuous mounting shafts, seated screwheads,
 // and no unsupported floating fittings.
 const mountHardware=[];
 let parts=0;
 const items=new Map(),locations=new Map();
 const puzzleControls=new Map(),bagDials=[],bagDialGlyphs=[],liftDoors=[];
 let bagReleaseCap=null;
 // Only the actual brass catch uses this material: a correctly aligned
 // combination gets a gentle glint, rather than lighting every brass part.
 const bagCatchMetal=mat(0xbca078,.67,.32);
 bagCatchMetal.emissive=new THREE.Color(0x4da88a);
 bagCatchMetal.emissiveIntensity=0;
 // The bag code wheels have legible stamped symbols directly on their metal
 // faces. Updating a dial changes its own inlay instead of showing a popup.
 const glyphMaterials=["○","✳","◇","☾","△","□"].map(symbol=>{
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
 let bagDialPanel=null,bagCover=null,bagCoverSettleTimer=null,liftStatusGlass=null;
 let doorLeaf=null,musicLid=null,vaseWhole=null,vaseFragments=null;
 let watchHourHand=null,watchMinuteHand=null,vendingTray=null,vendingServiceSeal=null;
 let dogTail=null;
 const cloudDrops=[],mothWings=[],trainWheels=[];
 let lastDogHits=0,lastRain=false,lastMothTouched=false,lastTrain=false;
 let lastVaseBroken=false,lastDancerVisible=false,lastSeedPlanted=false,lastTreeGrown=false;
 let lastVendingDepth=.225,lastTapeRead=false;
 const microTimers=new Map();
 const settleMicro=(name,delay,settle)=>{
  if(microTimers.has(name))clearTimeout(microTimers.get(name));
  microTimers.set(name,setTimeout(()=>{
   microTimers.delete(name);settle();invalidate();
  },delay));
 };
 let loadedOriginalStory=false;
 let lastDialValues=null,lastFloorFour=false,lastBagOpen=false;
 const bagDialGoals=[],bagDialSettleTimers=[];
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
 // Reuse the existing enamel materials for sixteen-piece-free color
 // variation. Previously every micro-world sat in the same brass socket,
 // making neighboring miniatures merge into one visual cluster on phones.
 // These accents only appear AFTER a world is discovered. They contain no
 // numbers, symbols, instructions, or clues.
 const mountAccents={
  bag:m.velvet,machine:m.copper,door:m.blue,dog:m.pink,
  vase:m.cream,pot:m.green,musicbox:m.velvet,cloud:m.blue,
  squirrel:m.wood,cup:m.cream,clock:m.gold,elevator:m.blue,
  moth:m.velvet,telescope:m.copper,train:m.wood
 };
 // Every bolted miniature needs a separate bit of real panel area.
 // Previous locations sat inside the live maker stamp, pressure instrument,
 // red switch, service lever and the four underside shock feet.
 // Keep the display sockets clear of those permanent puzzle mechanisms.
 // Top face: dome shifted toward the center, safely clear of the front
 // gold rail and still separated from the hinged compartment's frame.
 // Right face: the dog is shifted off the teal sliding drawer's bezel,
 // including the opened state where its depth increases.
 const slots=[
  ["bag","frontFace",-1.17,-.81],["machine","frontFace",1.18,.74],
  ["door","rightFace",-.76,.80],["dog","rightFace",1.16,.08],
  // Vase sits with the squirrel underneath: the previous left-face mount
  // clipped the playable pressure gauge and its label.
  ["vase","bottomFace",0,1.12],
  ["pot","backFace",-1.16,.73],["musicbox","backFace",0,1.09],
  ["cloud","backFace",1.16,.73],["squirrel","bottomFace",-1.03,.28],
  ["cup","leftFace",.0,-1.20],["clock","frontFace",1.17,-.83],
  ["elevator","leftFace",-1.01,-.96],
  ["moth","topFace",-1.15,.21],["telescope","topFace",0,-1.045],
  ["train","bottomFace",1.03,.28]
 ];
 for(const [name,faceName,x,y] of slots){
  const face=faces[faceName],fixture=new THREE.Group();
  fixture.position.set(x,y,.27);
  face.add(fixture);locations.set(name,fixture);
  mounts.push({name,face:faceName,x,y});
  // A structural shelf, a backplate and two visible tiny bolts secure each
  // model to the cube. No independent gallery base exists beneath the box.
  const stand=new THREE.Group();fixture.add(stand);
  // Slim captive brackets replace the heavy mini-gallery plinths. The
  // machined metal is attached directly to the rotating cube face.
  // Four machined stand-off sleeves BRIDGE the real enamel face and this
  // fixture. Previously the mount sat at z=.27 with no metal behind its
  // decorative screws, so the entire plaque looked suspended in midair.
  // Sleeve local range [-.245,-.015] crosses the cube's actual skin near
  // world z=.07 and reaches the fixture's rear rails near world z=.22.
  const mountStandoffs=[];
  for(const px of [-.21,.21])for(const py of [.28,-.035]){
   mountStandoffs.push(C(stand,.032,.230,px,py,-.130,m.brass,"z"));
   C(stand,.041,.018,px,py,-.012,m.gold,"z");
  }
  // The old solid black plinths made every unlocked scene look like
  // a stack of dark shoeboxes. These are small open brass brackets,
  // while the pastel inlay is flush with the actual cube face.
  for(const x of [-.221,.221])
   B(stand,.024,.34,.044,x,.15,-.055,m.brass,.006);
  const crossbar=B(stand,.43,.021,.035,0,.319,-.036,m.brass,.006);
  const inlay=B(stand,.43,.305,.016,0,.16,-.024,mountAccents[name],.012);
  B(stand,.34,.014,.012,0,.322,.011,m.gold,.004);
  // The floor is a thin shelf rooted to the frame, rather than a
  // .37-deep black block protruding beneath the miniature.
  const shelf=B(stand,.49,.031,.17,0,-.040,.115,m.brass,.010);
  B(stand,.44,.013,.15,0,-.014,.120,m.gold,.006);
  // The upper rivet must sit ON the upper crossbar (front z=-.018),
  // and the lower rivet ON the projecting shelf (front z=.200).
  // The old lower cap was centered at z=.416, over .20 away from metal.
  const upperHeads=[],lowerHeads=[];
  for(const px of [-.225,.225]){
   // Upper heads align with the .319-high crossbar and their captive
   // sleeves, not empty enamel beside it.
   upperHeads.push(C(stand,.024,.03,px,.312,-.005,m.brass,"z"));
   lowerHeads.push(C(stand,.024,.03,px,-.03,.212,m.brass,"z"));
  }
  mountHardware.push({name,fixture,mountStandoffs,crossbar,shelf,upperHeads,lowerHeads});
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
  // The roof fitting has two curved doors; flat display shutters retired.
  const shutters=null;
  items.set(name,{fixture,toy,stand,inlay,hitVolume,visible:false,shutters});
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
  // A hinged metal shroud physically conceals the tumblers before unlock.
  // Its hinge pins remain anchored to the bag, never floating in space.
  bagCover=new THREE.Group();bagCover.position.set(0,.395,.295);g.add(bagCover);
  const metalFlap=B(bagCover,.43,.155,.046,0,-.077,0,m.dark,.019);
  metalFlap.castShadow=true;metalFlap.receiveShadow=true;
  B(bagCover,.345,.025,.020,0,-.072,.035,m.gold,.006);
  C(bagCover,.024,.018,0,-.119,.045,m.black,"z");
  for(const x of [-.17,.17]){
   C(g,.022,.048,x,.395,.29,m.brass,"x");
   C(bagCover,.015,.018,x,-.041,.044,m.gold,"z");
  }
  // Four independently rotating, stamped bronze wheels. Each has six
  // positions; their smaller fingertip colliders never overlap next door.
  bagDialPanel=new THREE.Group();g.add(bagDialPanel);
  B(bagDialPanel,.43,.119,.034,0,.275,.153,m.dark,.017);
  for(let i=0;i<4;i++){
   const dial=new THREE.Group();
   dial.position.set((i-1.5)*.101,.275,.197);bagDialPanel.add(dial);
   C(dial,.040,.030,0,0,0,m.gold,"z");
   for(let notch=0;notch<8;notch++){
    const angle=notch*Math.PI/4;
    const grip=B(dial,.008,.016,.009,Math.cos(angle)*.036,
     Math.sin(angle)*.036,.028,m.dark,.003);
    grip.rotation.z=angle;
   }
   B(dial,.008,.012,.010,0,.032,.030,m.black,.003);
   const glyph=new THREE.Mesh(new THREE.PlaneGeometry(.057,.057),glyphMaterials[0]);
   glyph.position.z=.047;dial.add(glyph);parts++;
   const dialTouch=new THREE.Mesh(new THREE.CylinderGeometry(.046,.046,.034,22),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,
     depthWrite:false,side:THREE.DoubleSide}));
   dialTouch.rotation.x=Math.PI/2;dialTouch.position.z=.067;
   dial.add(dialTouch);parts++;
   bagDialGlyphs.push(glyph);
   puzzleControls.set("thing:bag-dial-"+i,dial);bagDials.push(dial);
  }
  // Separate spring-loaded catch under the row of wheels. Turning a wheel
  // does not touch this control or open the false bottom automatically.
  const release=new THREE.Group();
  release.position.set(0,.105,.185);g.add(release);
  B(release,.19,.078,.026,0,0,0,m.dark,.012);
  bagReleaseCap=new THREE.Group();bagReleaseCap.position.z=.032;
  release.add(bagReleaseCap);
  B(bagReleaseCap,.155,.051,.029,0,0,.010,bagCatchMetal,.009);
  B(bagReleaseCap,.085,.009,.010,0,0,.030,m.black,.003);
  const pushVolume=new THREE.Mesh(new THREE.BoxGeometry(.173,.072,.038),
   new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,
    depthWrite:false,side:THREE.DoubleSide}));
  pushVolume.position.z=.051;release.add(pushVolume);parts++;
  puzzleControls.set("thing:bag-release",release);
  release.userData.mechanicalActuator=bagReleaseCap;
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
  // A separate operating knob. Touching the wooden door only inspects it.
  const doorKnob=new THREE.Group();
  doorKnob.position.set(.352,.28,.086);doorLeaf.add(doorKnob);
  C(doorKnob,.049,.062,0,0,0,m.gold,"z");
  // The invisible fingertip sphere stays over the raised knob rather than
  // claiming the whole door. This makes mobile activation forgiving.
  const knobTouch=new THREE.Mesh(
   new THREE.SphereGeometry(.105,14,10),
   new THREE.MeshBasicMaterial({transparent:true,opacity:0,
    colorWrite:false,depthWrite:false})
  );
  knobTouch.position.z=.078;doorKnob.add(knobTouch);
  puzzleControls.set("thing:door-handle",doorKnob);
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
  // The tail's pivot stays attached to the body during touch feedback.
  dogTail=new THREE.Group();dogTail.position.set(.18,.37,-.16);g.add(dogTail);
  ball(dogTail,.09,.047,0,0,m.cream,[1.7,.48,.62]);
  wire(dogTail,[[.02,.01,0],[.12,.085,0],[.14,.17,0]],.024,m.cream);
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
   shard.userData.restPosition=shard.position.clone();
   shard.userData.restRotation=shard.rotation.clone();
   shard.scale.setScalar(.85+(i%4)*.14);
   shard.castShadow=false;shard.receiveShadow=true;
   vaseFragments.add(shard);parts++;
  }
  vaseFragments.visible=false;
 }
 // Both planting and watering have their own real 3D result. The seed
 // sprouts above the pot rim, then becomes a tree anchored in that SAME
 // opening; there are no detached leaf or popup animations.
 const branches=new THREE.Group(),sprout=new THREE.Group();
 {
  const g=toy("pot");
  const pot=C(g,.21,.30,0,.19,0,m.wood);
  pot.scale.set(1.0,1,1);
  C(g,.24,.035,0,.36,0,m.brass);
  C(g,.18,.015,0,.38,0,m.dark);
  sprout.position.set(0,.37,0);g.add(sprout);
  wire(sprout,[[0,0,0],[.014,.07,0],[0,.15,.01]],.015,m.wood);
  ball(sprout,.067,-.062,.13,.02,m.leaf,[1.12,.56,.64]);
  ball(sprout,.066,.065,.16,-.02,m.leaf,[1.10,.54,.66]);
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
  // Seat the dancer's spindle in the actual music-box housing. Its old
  // floating .44 pivot left a visible gap and pushed the figure across
  // the cube's upper frame after the music-box reward unlocked.
  dancer.position.set(0,.32,0);g.add(dancer);
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
   cloudDrops.push(ball(g,.035,x,.23,.065,m.blue,[.65,1.6,.65]));
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
  // Both hands pivot on a real central pin. Feeding punched tape to the
  // watch drives the metal hands to the time in the recovered letter, rather
  // than just granting an inventory item with no visible cube response.
  watchHourHand=new THREE.Group();
  watchHourHand.position.set(0,.35,.099);g.add(watchHourHand);
  B(watchHourHand,.026,.135,.018,0,.056,0,m.wood,.007);
  watchMinuteHand=new THREE.Group();
  watchMinuteHand.position.set(0,.35,.108);g.add(watchMinuteHand);
  B(watchMinuteHand,.017,.175,.018,0,.080,0,m.dark,.006);
  C(g,.024,.018,0,.35,.128,m.gold,"z");
  C(g,.055,.043,0,.60,0,m.gold);
 }
 // Vending machine has a physical glass panel and dispensed sugar tray.
 {
  const g=toy("machine");
  B(g,.44,.70,.34,0,.39,0,m.blue,.027);
  B(g,.29,.29,.024,-.032,.51,.184,m.dark,.015);
  for(let i=0;i<4;i++)B(g,.22,.013,.016,-.032,.4+i*.056,.204,m.brass,.006);
  // A real coin-return mouth with a captive sliding sugar tray. The tray
  // extends when money is accepted and a little farther after the jam is
  // cleared; rewards still go straight to inventory with no pop-out sprite.
  B(g,.29,.10,.09,0,.17,.19,m.dark,.016);
  vendingTray=new THREE.Group();
  vendingTray.position.set(0,.17,.225);g.add(vendingTray);
  B(vendingTray,.245,.072,.068,0,0,0,m.brass,.013);
  B(vendingTray,.169,.022,.011,0,.013,.040,m.cream,.005);
  // The refunded SECOND coin drives its own shallow brass inspection
  // seal, NOT another sugar cube. The seal sits in the real sliding tray
  // and persists on reload instead of popping out as a 2D overlay.
  vendingServiceSeal=new THREE.Group();
  vendingServiceSeal.position.set(0,0,.064);
  vendingTray.add(vendingServiceSeal);
  B(vendingServiceSeal,.172,.080,.019,0,0,0,m.gold,.008);
  const firstCheck=B(vendingServiceSeal,.009,.033,.006,-.031,-.004,.014,m.dark,.002);
  firstCheck.rotation.z=-.65;
  const secondCheck=B(vendingServiceSeal,.009,.059,.006,.004,.008,.015,m.dark,.002);
  secondCheck.rotation.z=.67;
  vendingServiceSeal.visible=false;
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
   // These shallow vertical ribs travel with the sliding door instead of
   // hanging in the air when its leaves separate.
   B(door,.013,.39,.012,x<0?-.071:.071,0,.033,m.brass,.004);
   B(door,.105,.012,.012,0,-.14,.035,m.dark,.004);
   liftDoors.push(door);
  }
  // Four mechanically mounted brass call buttons next to the cage.
  B(g,.18,.68,.16,.32,.39,.055,m.dark,.024);
  for(let floor=1;floor<=4;floor++){
   const button=new THREE.Group();
   button.position.set(.32,.15+floor*.11,.159);g.add(button);
   C(button,.043,.025,0,0,0,m.brass,"z");
   // A uniquely colored correct floor would spoil the collar-tag clue.
   C(button,.036,.028,0,0,.020,m.cream,"z");
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
  // A single arrival light above the floor controls only switches on
  // AFTER a successful call; it is not an advance hint about floor four.
  liftStatusGlass=mat(0x89cbb4,.1,.29);
  liftStatusGlass.emissive.set(0x2fbb8d);
  liftStatusGlass.emissiveIntensity=.04;
  C(g,.049,.028,.32,.705,.164,m.brass,"z");
  C(g,.032,.022,.32,.705,.185,liftStatusGlass,"z");
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
   mothWings.push({wing,side:s});
   // Fine raised metal veins keep the physical wings recognizable up close.
   for(const sign of [-1,1])wire(wing,[[0,0,.12],
    [sign*.055,.025,.12],[sign*.10,.04,.10]],.006,m.brass);
   wire(g,[[0,.51,0],[s*.095,.63,0],[s*.16,.67,0]],.008,m.brass);
  }
  C(g,.07,.02,0,.34,0,m.brass);
 }
 
 // Reference-matched ivory observatory. A genuine spherical shell has a
 // wide arched front opening, terracotta interior, and a continuous ring.
 // The centered telescope never rises; a shutter rolls beneath the shell.
 const OBSERVATORY_RADIUS=.278,OBSERVATORY_RING_TOP=.058;
 // Expose more of the telescope through the front arch without lifting the dome.
  const OBSERVATORY_OPEN_HALF_ANGLE=1.50,OBSERVATORY_ARCH_RISE=1.22;
 const OBSERVATORY_SLAT_COUNT=16,OBSERVATORY_ROWS=4,OBSERVATORY_COLUMNS=32;
 const observatoryShutter={progress:0},observatoryPanels=[];
 const observatoryGuideRollers=[];
 let observatoryRivetCount=0;
 let telescopeLensGlass=null,telescopeIrisGlass=null;
 let observatoryScope=null,observatoryRearCap=null,observatoryBarrel=null;
 const apertureHeight=az=>{
  const u=Math.abs(az)/OBSERVATORY_OPEN_HALF_ANGLE;
  return u>=1?0:OBSERVATORY_ARCH_RISE*Math.sqrt(Math.max(0,1-u*u));
 };
 const domePoint=(az,elev,r=OBSERVATORY_RADIUS)=>[
  r*Math.cos(elev)*Math.sin(az),
  -r*Math.cos(elev)*Math.cos(az),
  r*Math.sin(elev)
 ];
 // Fine satin enamel, softly brushed rather than the flat white plastic of
 // the old roof. A deterministic procedural canvas supplies actual UV-based
 // grain, so the finish works offline and doesn't depend on image servers.
 const paintCanvas=document.createElement("canvas");
 paintCanvas.width=paintCanvas.height=512;
 const paintCtx=paintCanvas.getContext("2d");
 const paintPixels=paintCtx.createImageData(512,512);
 let grainSeed=13791;
 for(let p=0;p<paintPixels.data.length;p+=4){
  grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;
  const n=((grainSeed>>>16)&31)-15;
  const tone=Math.max(230,Math.min(255,248+n*.32));
  paintPixels.data[p]=tone;
  paintPixels.data[p+1]=Math.max(0,tone-2);
  paintPixels.data[p+2]=Math.max(0,tone-5);
  paintPixels.data[p+3]=255;
 }
 paintCtx.putImageData(paintPixels,0,0);
 // Subtle color shifts across enamel panels, not grime or strong patches.
 for(let col=0;col<24;col++)for(let row=0;row<8;row++){
  const patch=(col*17+row*11+col*row*3)%7;
  paintCtx.fillStyle=patch<3?"rgba(255,254,248,.048)":
   patch>4?"rgba(169,153,131,.018)":"rgba(255,255,255,.012)";
  paintCtx.fillRect(col*512/24+1,row*64+1,512/24-2,62);
 }
 paintCtx.strokeStyle="rgba(149,132,105,.033)";
 paintCtx.lineWidth=1;
 for(let i=0;i<52;i++){
  const y=i*10+.5;
  paintCtx.beginPath();paintCtx.moveTo(0,y);
  paintCtx.lineTo(512,y+2);paintCtx.stroke();
 }
 const enamelGrain=new THREE.CanvasTexture(paintCanvas);
 enamelGrain.colorSpace=THREE.SRGBColorSpace;
 enamelGrain.wrapS=THREE.RepeatWrapping;
 enamelGrain.anisotropy=4;
 const ivory=m.cream.clone();
 ivory.side=THREE.DoubleSide;
 ivory.map=enamelGrain;
 ivory.roughness=.56;
 ivory.metalness=.065;
 ivory.clearcoat=.17;
 ivory.bumpMap=enamelGrain;
 ivory.bumpScale=.0009;
 ivory.needsUpdate=true;
 // A softly lit warm stone lining, like the chosen miniature concept.
 const terracotta=mat(0xc6b5a3,.10,.67);
 terracotta.side=THREE.DoubleSide;
 const engrave=new THREE.LineBasicMaterial({
  color:0xada396,transparent:true,opacity:.30,depthWrite:false
 });
 const interiorSeam=new THREE.LineBasicMaterial({
  color:0x847366,transparent:true,opacity:.39,depthWrite:false
 });
 const line=(parent,points,material)=>{
  const geo=new THREE.BufferGeometry().setFromPoints(
   points.map(p=>new THREE.Vector3(...p)));
  const obj=new THREE.Line(geo,material);
  parent.add(obj);parts++;return obj;
 };
 // Outer and inner shells have the SAME physical arched cutout.
 const domeSkin=r=>{
  const pos=[],normal=[],uv=[],indices=[],A=96,E=28;
  for(let i=0;i<=A;i++){
   const az=-Math.PI+2*Math.PI*i/A,cut=apertureHeight(az);
   for(let j=0;j<=E;j++){
    const el=cut+(Math.PI/2-cut)*j/E;
    pos.push(...domePoint(az,el,r));
    normal.push(Math.cos(el)*Math.sin(az),
     -Math.cos(el)*Math.cos(az),Math.sin(el));
    uv.push((az+Math.PI)/(2*Math.PI),el/(Math.PI/2));
   }
  }
  for(let i=0;i<A;i++)for(let j=0;j<E;j++){
   const x=i*(E+1)+j,y=x+E+1;
   indices.push(x,y,x+1,y,y+1,x+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("normal",new THREE.Float32BufferAttribute(normal,3));
  geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);
  return geo;
 };
 {
  const item=items.get("telescope"),g=item.toy;
  item.stand.visible=false;
  item.fixture.position.z=.060;
  g.position.set(0,0,0);g.scale.setScalar(1);
  item.hitVolume.geometry.dispose();
  item.hitVolume.geometry=new THREE.BoxGeometry(.64,.64,.65);
  item.hitVolume.position.set(0,0,.160);
  // The complete round wall intersects the yellow enamel. Neither a
  // black disk nor a rectangle is visible under the reference dome.
  const band=new THREE.Mesh(new THREE.CylinderGeometry(
   OBSERVATORY_RADIUS+.004,OBSERVATORY_RADIUS+.004,.073,72,1,true),ivory);
  band.rotation.x=Math.PI/2;
  band.position.z=.0205;
  band.castShadow=true;band.receiveShadow=true;g.add(band);parts++;
  item.mountRing=band;
  // A shallow sloped cast-in collar hides the joint between the upright
  // ring and the box enamel. It remains beneath the existing vent details.
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(
   OBSERVATORY_RADIUS+.004,OBSERVATORY_RADIUS+.026,.025,
   72,1,true),m.cream);
  collar.rotation.x=Math.PI/2;collar.position.z=.0015;
  collar.receiveShadow=true;g.add(collar);parts++;
  torus(g,OBSERVATORY_RADIUS+.024,.0025,0,0,-.010,m.brass,"z");
  torus(g,OBSERVATORY_RADIUS+.004,.0038,0,0,OBSERVATORY_RING_TOP,m.cream,"z");
  torus(g,OBSERVATORY_RADIUS+.004,.0025,0,0,-.013,m.brass,"z");
  for(let i=0;i<28;i++){
   const angle=i*2*Math.PI/28;
   const x=(OBSERVATORY_RADIUS+.005)*Math.cos(angle);
   const y=(OBSERVATORY_RADIUS+.005)*Math.sin(angle);
   line(g,[[x,y,-.01],[x,y,.054]],engrave);
  }
  // The reference's low circular wall is panelled and joined to the
  // box, with recessed dark vent grilles rather than an empty plastic rim.
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   const support=new THREE.Group();
   support.position.set((OBSERVATORY_RADIUS+.004)*Math.sin(a),
    -(OBSERVATORY_RADIUS+.004)*Math.cos(a),.020);
   support.rotation.z=a;
   g.add(support);
   B(support,.011,.012,.068,0,0,0,m.cream,.003);
   B(support,.014,.014,.006,0,0,.033,m.gold,.003);
  }
  for(const a of [-1.12,-.57,0,.57,1.12]){
   const vent=new THREE.Group();
   vent.position.set((OBSERVATORY_RADIUS+.006)*Math.sin(a),
    -(OBSERVATORY_RADIUS+.006)*Math.cos(a),.023);
   vent.rotation.z=a;g.add(vent);
   B(vent,.057,.008,.022,0,-.003,0,m.dark,.004);
   for(const z of [-.006,0,.006])
    B(vent,.050,.004,.002,0,-.009,z,m.brass,.001);
   for(const side of [-1,1])
    ball(vent,.0025,side*.029,-.009,.012,m.gold);
  }
  // A quiet circular stone-enamel deck, engraved with floor segments.
  // Its top is immediately above the yellow face but beneath the yoke.
  const deckMaterial=mat(0xcac0b4,.055,.68);
  C(g,.258,.009,0,0,.015,deckMaterial,"z");
  torus(g,.204,.002,0,0,.022,m.brass,"z");
  const floorJoint=new THREE.LineBasicMaterial({
   color:0x938778,transparent:true,opacity:.42,depthWrite:false
  });
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   line(g,[[.205*Math.sin(a),-.205*Math.cos(a),.022],
    [.247*Math.sin(a),-.247*Math.cos(a),.022]],floorJoint);
  }
  for(let i=0;i<10;i++){
   const a=i*2*Math.PI/10;
   ball(g,.0023,.239*Math.cos(a),.239*Math.sin(a),.023,m.brass);
  }
  const roofShell=new THREE.Group();
  roofShell.position.z=OBSERVATORY_RING_TOP;
  g.add(roofShell);
  observatoryRearCap=new THREE.Mesh(domeSkin(OBSERVATORY_RADIUS),ivory);
  observatoryRearCap.castShadow=true;
  observatoryRearCap.receiveShadow=true;
  roofShell.add(observatoryRearCap);parts++;
  const lining=new THREE.Mesh(domeSkin(OBSERVATORY_RADIUS-.010),terracotta);
  roofShell.add(lining);parts++;
  // Smooth thickened arch and a fine inset band along its cut edge.
  const lip=[];
  for(let i=0;i<=80;i++){
   const az=-OBSERVATORY_OPEN_HALF_ANGLE+
    2*OBSERVATORY_OPEN_HALF_ANGLE*i/80;
   lip.push(domePoint(az,apertureHeight(az)));
  }
  wire(roofShell,lip,.006,m.cream);
  wire(roofShell,lip.map(([x,y,z])=>[x*.964,y*.964,z*.964]),.0023,m.gold);
  // Physical twin guide channels follow the cutout's inner edges.
  // They continue toward the shutter's receiving pocket at the crown,
  // rather than hanging in mid-air like the previous decorative traces.
  const guideMetal=mat(0xa89c8e,.34,.50);
  for(const side of [-1,1]){
   const track=[],trackInset=[];
   for(let i=0;i<=32;i++){
    const elev=.025+(OBSERVATORY_ARCH_RISE-.05)*i/32;
    const ratio=elev/OBSERVATORY_ARCH_RISE;
    const az=side*OBSERVATORY_OPEN_HALF_ANGLE*
     Math.sqrt(Math.max(0,1-ratio*ratio));
    track.push(domePoint(az,elev,OBSERVATORY_RADIUS-.015));
    trackInset.push(domePoint(az,elev,OBSERVATORY_RADIUS-.023));
   }
   wire(roofShell,track,.003,guideMetal);
   wire(roofShell,trackInset,.0015,m.brass);
   const carriage=new THREE.Group();
   roofShell.add(carriage);
   C(carriage,.007,.010,0,0,0,m.brass,"x");
   C(carriage,.004,.012,side*.006,0,0,m.dark,"x");
   observatoryGuideRollers.push({carriage,side});
  }
  // Two small captive door rollers support the edge at the actual
  // arch endpoints instead of hanging in empty space.
  for(const side of [-1,1]){
   const p=domePoint(side*OBSERVATORY_OPEN_HALF_ANGLE,.012,
    OBSERVATORY_RADIUS-.004);
   C(roofShell,.011,.014,p[0],p[1],p[2]+.010,m.brass,"x");
   C(roofShell,.006,.016,p[0]+side*.006,p[1],p[2]+.010,m.dark,"x");
  }
  // A top pole plate and flush gold edge are fixed to the ivory shell.
  C(roofShell,.026,.004,0,0,OBSERVATORY_RADIUS+.001,m.cream,"z");
  torus(roofShell,.027,.002,0,0,OBSERVATORY_RADIUS+.005,m.brass,"z");
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   ball(roofShell,.0019,.019*Math.cos(a),.019*Math.sin(a),
    OBSERVATORY_RADIUS+.006,m.brass);
  }
  // Evenly spaced precision grid-lines on the exterior, clipped to the
  // actual opening so none run through the empty space.
  for(let i=0;i<24;i++){
   const az=-Math.PI+2*Math.PI*i/24;
   const min=apertureHeight(az)+.020,pts=[];
   for(let j=0;j<=22;j++){
    const e=min+(1.50-min)*j/22;
    pts.push(domePoint(az,e,OBSERVATORY_RADIUS+.0014));
   }
   line(roofShell,pts,engrave);
  }
  for(const elev of [.22,.42,.62,.82,1.02,1.21,1.40]){
   const verts=[];
   for(let i=0;i<160;i++){
    const a=-Math.PI+2*Math.PI*i/160,b=-Math.PI+2*Math.PI*(i+1)/160;
    if(elev<apertureHeight(a)||elev<apertureHeight(b))continue;
    verts.push(...domePoint(a,elev,OBSERVATORY_RADIUS+.0014));
    verts.push(...domePoint(b,elev,OBSERVATORY_RADIUS+.0014));
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
   roofShell.add(new THREE.LineSegments(geo,engrave));parts++;
  }
  for(let i=0;i<14;i++){
   const az=-Math.PI+i*2*Math.PI/14,low=apertureHeight(az)+.05,pts=[];
   for(let j=0;j<=18;j++){
    const elev=low+(1.48-low)*j/18;
    pts.push(domePoint(az,elev,OBSERVATORY_RADIUS-.011));
   }
   line(roofShell,pts,interiorSeam);
  }
  // Cream-colored physical ribs on the inside surface of the shell.
  // Unlike the old floating pieces, every brace follows the hemisphere.
  const braceFinish=mat(0xdbcfbd,.13,.51);
  for(let i=0;i<12;i++){
   const az=-Math.PI+(i+.5)*2*Math.PI/12;
   const min=apertureHeight(az)+.035,points=[];
   for(let j=0;j<=16;j++){
    const elev=min+(1.46-min)*j/16;
    points.push(domePoint(az,elev,OBSERVATORY_RADIUS-.014));
   }
   wire(roofShell,points,.0027,braceFinish);
  }
  // Recessed amber instrument lamps on the fixed inner rear wall.
  // These are luminous meshes rather than costly shadow-casting lights.
  const warmLamp=mat(0xffe3a4,.04,.32);
  warmLamp.emissive=new THREE.Color(0xffbb66);
  warmLamp.emissiveIntensity=.86;
  for(const az of [-2.45,-1.8,1.8,2.45]){
   const p=domePoint(az,.25,OBSERVATORY_RADIUS-.026);
   B(roofShell,.025,.011,.036,p[0],p[1],p[2],m.brass,.004);
   B(roofShell,.015,.012,.026,p[0],p[1]-.002,p[2],warmLamp,.003);
  }
  // Tiny rivets at the manufactured panel intersections. Instancing
  // keeps this detailing to one draw call instead of 100 extra meshes.
  const domeRivets=[];
  for(let i=0;i<12;i++){
   const az=-Math.PI+(i+.5)*2*Math.PI/12;
   for(const elev of [.35,.69,1.02,1.32]){
    if(elev<apertureHeight(az)+.070)continue;
    domeRivets.push(domePoint(az,elev,OBSERVATORY_RADIUS+.0013));
   }
  }
  observatoryRivetCount=domeRivets.length;
  // Low-contrast pale hardware reads as manufactured fasteners, not dots.
  const quietRivet=mat(0xb5a797,.18,.48);
  const rivetMesh=new THREE.InstancedMesh(
   new THREE.SphereGeometry(.00135,6,4),quietRivet,domeRivets.length);
  const rivetPose=new THREE.Object3D();
  for(let i=0;i<domeRivets.length;i++){
   rivetPose.position.set(...domeRivets[i]);
   rivetPose.updateMatrix();
   rivetMesh.setMatrixAt(i,rivetPose.matrix);
  }
  rivetMesh.instanceMatrix.needsUpdate=true;
  roofShell.add(rivetMesh);parts++;
  // The garage shutter is sixteen spherical strips only INSIDE the
  // aperture. As they move up, the fixed shell hides them completely.
  const slatGeometry=(lo,hi)=>{
   const pos=[],normal=[],uv=[],indices=[];
   for(let row=0;row<=OBSERVATORY_ROWS;row++){
    const elev=lo+(hi-lo)*row/OBSERVATORY_ROWS;
    const width=OBSERVATORY_OPEN_HALF_ANGLE*
     Math.sqrt(Math.max(0,1-(elev/OBSERVATORY_ARCH_RISE)**2));
    for(let col=0;col<=OBSERVATORY_COLUMNS;col++){
     const az=width*(2*col/OBSERVATORY_COLUMNS-1);
     pos.push(...domePoint(az,elev,OBSERVATORY_RADIUS-.004));
     normal.push(Math.cos(elev)*Math.sin(az),
      -Math.cos(elev)*Math.cos(az),Math.sin(elev));
     uv.push((az+Math.PI)/(2*Math.PI),elev/(Math.PI/2));
    }
   }
   for(let row=0;row<OBSERVATORY_ROWS;row++)
    for(let col=0;col<OBSERVATORY_COLUMNS;col++){
     const x=row*(OBSERVATORY_COLUMNS+1)+col;
     const y=x+OBSERVATORY_COLUMNS+1;
     indices.push(x,x+1,y,y,x+1,y+1);
    }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
   geo.setAttribute("normal",new THREE.Float32BufferAttribute(normal,3));
   geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
   geo.setIndex(indices);
   return geo;
  };
  for(let i=0;i<OBSERVATORY_SLAT_COUNT;i++){
   const lo=i*OBSERVATORY_ARCH_RISE/OBSERVATORY_SLAT_COUNT;
   const hi=(i+1)*OBSERVATORY_ARCH_RISE/OBSERVATORY_SLAT_COUNT;
   const panel=new THREE.Mesh(slatGeometry(lo,hi),ivory);
   panel.castShadow=true;
   roofShell.add(panel);parts++;
   observatoryPanels.push({panel,lo,hi});
  }
  // The centered telescope stays on a captive stationary pedestal.
  observatoryScope=new THREE.Group();
  observatoryScope.position.set(0,-.015,.038);
  observatoryScope.scale.setScalar(.80);
  observatoryScope.rotation.y=0;
  g.add(observatoryScope);
  C(observatoryScope,.100,.026,0,0,.002,m.brass,"z");
  C(observatoryScope,.082,.025,0,0,.026,m.gold,"z");
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   ball(observatoryScope,.0032,.089*Math.cos(a),
    .089*Math.sin(a),.018,m.cream);
  }
  B(observatoryScope,.240,.064,.043,0,0,.066,m.cream,.014);
  for(const side of [-1,1]){
   B(observatoryScope,.041,.064,.106,side*.106,0,.114,m.cream,.013);
   C(observatoryScope,.031,.018,side*.121,0,.146,m.gold,"x");
  }
  const tube=new THREE.Group();
  tube.position.set(0,-.014,.150);
  tube.rotation.x=Math.PI/2-.16;
  observatoryScope.add(tube);
  observatoryBarrel=tube;
  // The telescope itself gets a painted optical tube, not a solid
  // copper cylinder. Its brass focus rings remain functional-looking.
  C(tube,.067,.245,0,0,0,ivory,"z");
  C(tube,.075,.045,0,0,-.070,m.brass,"z");
  for(const z of [-.085,.045,.098])torus(tube,.076,.009,0,0,z,m.gold,"z");
  C(tube,.081,.025,0,0,.124,m.gold,"z");
  C(tube,.069,.014,0,0,.140,m.black,"z");
  C(tube,.055,.008,0,0,.147,mat(0x294354,.40,.22),"z");
  const opticalCoating=mat(0x21394a,.31,.16);
  opticalCoating.clearcoat=.86;
  C(tube,.054,.004,0,0,.153,opticalCoating,"z");
  // A bolted finder-scope saddle grows FROM the main barrel.
  B(tube,.026,.045,.034,0,.065,-.013,m.brass,.006);
  B(tube,.039,.009,.056,0,.087,-.013,m.gold,.004);
  const finder=new THREE.Group();
  finder.position.set(0,.098,-.014);
  tube.add(finder);
  C(finder,.018,.125,0,0,0,m.dark,"z");
  for(const z of [-.046,.042])
   C(finder,.021,.011,0,0,z,m.brass,"z");
  C(finder,.020,.012,0,0,.067,m.gold,"z");
  C(finder,.014,.007,0,0,.075,mat(0x244457,.35,.18),"z");
  telescopeLensGlass=C(tube,.063,.011,0,0,.151,m.glass,"z");
  telescopeLensGlass.visible=false;
  // A compact, captive side focuser replaces the oversized brass block.
  B(tube,.049,.054,.061,.060,0,-.020,m.brass,.008);
  C(tube,.027,.016,.092,0,-.020,m.dark,"x");
  torus(tube,.028,.005,.102,0,-.020,m.gold,"x");
  telescopeIrisGlass=C(tube,.023,.009,.108,0,-.020,m.glass,"x");
  telescopeIrisGlass.visible=false;
  
  item.shutterHub=roofShell;
  item.rearCap=observatoryRearCap;
  item.instrument=observatoryScope;
 }
 const applyObservatoryRoll=()=>{
  const travel=observatoryShutter.progress*(OBSERVATORY_ARCH_RISE+.10);
  for(const {panel,lo,hi} of observatoryPanels){
   const begin=lo+travel;
   panel.visible=begin<OBSERVATORY_ARCH_RISE+.035;
   if(!panel.visible)continue;
   const pos=panel.geometry.getAttribute("position");
   const normal=panel.geometry.getAttribute("normal");
   const texcoord=panel.geometry.getAttribute("uv");
   for(let row=0;row<=OBSERVATORY_ROWS;row++){
    const source=lo+(hi-lo)*row/OBSERVATORY_ROWS;
    const elev=Math.min(Math.PI/2-.015,source+travel);
    const width=OBSERVATORY_OPEN_HALF_ANGLE*
     Math.sqrt(Math.max(0,1-(source/OBSERVATORY_ARCH_RISE)**2));
    for(let col=0;col<=OBSERVATORY_COLUMNS;col++){
     const az=width*(2*col/OBSERVATORY_COLUMNS-1);
     const n=row*(OBSERVATORY_COLUMNS+1)+col;
     pos.setXYZ(n,...domePoint(az,elev,OBSERVATORY_RADIUS-.004));
     normal.setXYZ(n,Math.cos(elev)*Math.sin(az),
      -Math.cos(elev)*Math.cos(az),Math.sin(elev));
     texcoord.setXY(n,(az+Math.PI)/(2*Math.PI),elev/(Math.PI/2));
    }
   }
   pos.needsUpdate=true;normal.needsUpdate=true;texcoord.needsUpdate=true;
   panel.geometry.computeBoundingSphere();
  }
  // Small roller carriages move along the physically seated guide rails.
  // After the shutter retracts, both roll out of view under the fixed dome.
  for(const {carriage,side} of observatoryGuideRollers){
   carriage.visible=observatoryShutter.progress<.98;
   if(!carriage.visible)continue;
   const elev=.025+observatoryShutter.progress*(OBSERVATORY_ARCH_RISE-.08);
   const az=side*OBSERVATORY_OPEN_HALF_ANGLE*
    Math.sqrt(Math.max(0,1-(elev/OBSERVATORY_ARCH_RISE)**2));
   carriage.position.set(...domePoint(az,elev,OBSERVATORY_RADIUS-.018));
   carriage.rotation.z=-side*elev*.4;
  }
  invalidate();
 };
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
  for(const z of [-.15,.14])for(const x of [-.16,.16]){
   const wheel=new THREE.Group();
   wheel.position.set(x,.16,z);g.add(wheel);
   C(wheel,.071,.035,0,0,0,m.gold,"x");
   C(wheel,.025,.044,0,0,0,m.dark,"x");
   // Raised studs and hub are captive to the spinning axle.
   for(let n=0;n<5;n++){
    const a=n*Math.PI*2/5;
    ball(wheel,.012,x<0?-.031:.031,
     Math.cos(a)*.05,Math.sin(a)*.05,m.brass);
   }
   trainWheels.push(wheel);
  }
  B(g,.30,.038,.085,0,.145,.005,m.brass,.008);
  B(g,.10,.05,.07,0,.61,.076,m.copper,.012);
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
 // Captive mounts between the existing bolted shelves and the actual
 // miniature objects. Previously the metal DISPLAY was attached to the box,
 // but many figures hovered above their own shelf. Use each model's real
 // visible geometry, excluding all invisible pointer-capture volumes.
 const modelSupports=[];
 const modelBases=[];
 for(const [name,item] of items){
  const toy=item.toy;
  if(name==="telescope"){
   modelBases.push({name,method:"direct",toy,lowest:-.31});
   continue;
  }
  toy.updateWorldMatrix(true,true);
  const toToy=toy.matrixWorld.clone().invert();
  let lowest=Infinity;
  toy.traverse(mesh=>{
   if(!mesh.isMesh||mesh===item.hitVolume)return;
   let visible=true;
   for(let node=mesh;node&&node!==toy;node=node.parent)
    if(!node.visible){visible=false;break;}
   if(!visible)return;
   const paints=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   if(paints.every(p=>p?.opacity===0||p?.colorWrite===false))return;
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   mesh.updateWorldMatrix(true,false);
   const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(
    toToy.clone().multiply(mesh.matrixWorld));
   lowest=Math.min(lowest,bounds.min.y);
  });
  if(!Number.isFinite(lowest))throw Error("No physical base: "+name);
  // Cloud droplets and moth wings hang below their central bodies.
  // Keep their supports reaching the sculpture, not a dangling detail.
  const top=Math.max(lowest+.025,
   name==="cloud"?.32:name==="moth"?.18:-Infinity);
  const bottom=-.109;
  if(top<=bottom+.03){
   modelBases.push({name,method:"direct",toy,lowest});
   continue;
  }
  const post=C(toy,.034,top-bottom,0,(top+bottom)/2,0,m.brass,"y");
  post.userData.mechanicalMount=true;
  const saddle=B(toy,.31,.030,.105,0,top-.013,0,m.dark,.009);
  saddle.userData.mechanicalMount=true;
  const foot=C(toy,.049,.024,0,bottom+.015,0,m.gold,"y");
  foot.userData.mechanicalMount=true;
  const hardware={name,toy,post,saddle,foot,bottom,top,lowest,
   method:"captive post"};
  modelSupports.push(hardware);
  modelBases.push(hardware);
 }
 function inspect(name){
  const instance=items.get(name);
  if(!instance?.fixture.visible||!instance.toy.visible)return false;
  // The precision tumblers should never move under the player's finger.
  if(name==="bag"&&bagDialPanel?.visible)return true;
  // Limit repeated spring restarts on the same miniature. A quick series
  // of taps should not monopolize frames on low-end mobile hardware.
  const now=Date.now();
  if(instance.lastInspectionAt&&now-instance.lastInspectionAt<220)return true;
  instance.lastInspectionAt=now;
  // Optical inspection tilts the telescope on its permanent turntable.
  if(name==="telescope"){
   const scope=instance.instrument;
   gsap.killTweensOf(scope.rotation);
   if(reducedMotion){scope.rotation.y=0;invalidate();return true;}
   gsap.to(scope.rotation,{y:.27,duration:.23,ease:"sine.out",
    onUpdate:invalidate,onComplete:()=>{
     gsap.to(scope.rotation,{y:0,duration:.42,
      ease:"sine.inOut",onUpdate:invalidate});
    }});
   return true;
  }
  const object=instance.toy,rest=.205;
  instance.inspectionMotion?.kill();
  if(instance.inspectionSettleTimer){
   clearTimeout(instance.inspectionSettleTimer);
   instance.inspectionSettleTimer=null;
  }
  gsap.killTweensOf(object.position);
  gsap.killTweensOf(object.rotation);
  // Restart from a real captive rest pose. Rapid repeated taps cannot
  // add offsets until the model drifts out of its mounting socket.
  object.position.set(0,.03,rest);
  object.rotation.set(0,0,0);
  const settle=()=>{
   if(instance.inspectionSettleTimer){
    clearTimeout(instance.inspectionSettleTimer);
    instance.inspectionSettleTimer=null;
   }
   instance.inspectionMotion?.kill();instance.inspectionMotion=null;
   object.position.set(0,.03,rest);
   object.rotation.set(0,0,0);
   invalidate();
  };
  if(reducedMotion){settle();return true;}
  // A restrained twist around the mounted center spindle replaces the old
  // .047-forward bounce, which visually pulled the figure off its shelf.
  // The post and foot now stay seated throughout inspection.
  instance.inspectionMotion=gsap.timeline({onUpdate:invalidate,onComplete:settle})
   .to(object.rotation,{y:.10,duration:.12,ease:"power2.out"})
   .to(object.rotation,{y:0,duration:.30,ease:"back.out(1.35)"});
  // Software renderers sometimes stall requestAnimationFrame indefinitely.
  instance.inspectionSettleTimer=setTimeout(settle,900);
  return true;
 }
 function pulse(action){
  const control=puzzleControls.get(action);
  if(action==="thing:bag-release"&&bagReleaseCap&&control?.visible){
   gsap.killTweensOf(bagReleaseCap.position);
   bagReleaseCap.position.z=reducedMotion?.032:.007;
   invalidate();
   if(!reducedMotion)gsap.to(bagReleaseCap.position,{z:.032,
    duration:.29,delay:.07,ease:"back.out(2)",onUpdate:invalidate});
   return true;
  }
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
   // A discovered maker's stamp exposes the side lift independently of
   // the dog/watch chain. The old path still reveals the same machine.
   elevator:!!s.serialRead||!!(s.watch&&s.tag)||!!s.floorFour||!!s.train,
   moth:s.floorFour,
   // The hinged panel and empty wooden tube cradle release the roll-back dome.
   telescope:!!s.observatoryRaised||!!s.observed||
    !!s.telescopeLensMounted||!!s.telescopeIrisMounted||!!s.secondSky,
   train:s.train
  };
  for(const [name,instance] of items){
   const visible=!!show[name];
   const newlyFound=visible&&!instance.visible;
   instance.fixture.visible=name==="telescope"?true:visible;
   instance.visible=visible;
   if(name==="telescope"){
     // A garage-style shutter rolls away. Dome and scope never rise.
     instance.toy.visible=true;
     const settle=opened=>{
      gsap.killTweensOf(observatoryShutter);
      gsap.killTweensOf(instance.instrument.rotation);
      observatoryShutter.progress=opened?1:0;
      instance.instrument.rotation.y=0;
      applyObservatoryRoll();
     };
     if(newlyFound){
      if(firstRestore||reducedMotion)settle(true);
      else{
       settle(false);
       gsap.to(observatoryShutter,{
        progress:1,duration:3.15,ease:"power2.inOut",
        onUpdate:applyObservatoryRoll,
        onComplete:()=>{observatoryShutter.progress=1;applyObservatoryRoll();}
       });

      }
     }else if(!visible)settle(false);
     continue;
    }
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
    if(firstRestore||reducedMotion||name==="telescope"){
     // Restored discoveries must be immediately stable. The telescope
     // is permanent from the start and must not erupt from an empty mount.
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
    instance.lastInspectionAt=0;
    instance.inspectionMotion?.kill();instance.inspectionMotion=null;
    if(instance.inspectionSettleTimer){
     clearTimeout(instance.inspectionSettleTimer);
     instance.inspectionSettleTimer=null;
    }
    instance.toy.position.set(0,.03,.205);
    instance.toy.rotation.set(0,0,0);
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
  telescopeLensGlass.visible=!!s.telescopeLensMounted;
  telescopeIrisGlass.visible=!!s.telescopeIrisMounted;
  sprout.visible=!!s.plant&&!s.tree;
  branches.visible=!!s.tree;
  if(sprout.visible&&!lastSeedPlanted&&!firstRestore&&!reducedMotion){
   gsap.killTweensOf(sprout.scale);
   sprout.scale.setScalar(.16);
   gsap.to(sprout.scale,{x:1,y:1,z:1,duration:.66,
    ease:"back.out(1.18)",onUpdate:invalidate});
   settleMicro("seed",1000,()=>{
    gsap.killTweensOf(sprout.scale);sprout.scale.setScalar(1);
   });
  }else if(firstRestore||reducedMotion) sprout.scale.setScalar(1);
  if(s.tree&&!lastTreeGrown&&!firstRestore&&!reducedMotion){
   gsap.killTweensOf(branches.scale);
   branches.scale.setScalar(.17);
   gsap.to(branches.scale,{x:1,y:1,z:1,duration:1.18,
    ease:"back.out(1.06)",onUpdate:invalidate});
   settleMicro("tree",1650,()=>{
    gsap.killTweensOf(branches.scale);branches.scale.setScalar(1);
   });
  }else if(firstRestore||reducedMotion) branches.scale.setScalar(1);
  lastSeedPlanted=!!s.plant;
  lastTreeGrown=!!s.tree;
  dancer.visible=!!s.dancer;
  // Starting the tiny dancer now physically turns the figure on the
  // music-box spindle instead of only toggling a static model. A restored
  // game keeps the settled pose and never replays completed discoveries.
  if(s.dancer&&!lastDancerVisible&&!firstRestore&&!reducedMotion){
   gsap.killTweensOf(dancer.rotation);
   dancer.rotation.y=0;
   gsap.to(dancer.rotation,{y:Math.PI*2,duration:1.45,
    ease:"power2.inOut",onUpdate:invalidate,
    onComplete:()=>{dancer.rotation.y=0;invalidate()}});
   settleMicro("dancer",1900,()=>{
    gsap.killTweensOf(dancer.rotation);dancer.rotation.y=0;
   });
  }else if(!s.dancer){
   gsap.killTweensOf(dancer.rotation);dancer.rotation.y=0;
  }
  lastDancerVisible=!!s.dancer;
  setPose(doorLeaf,"rotation","y",s.doorOpen?-.98:0,.65,firstRestore);
  setPose(musicLid,"rotation","x",s.music?-.91:0,.65,firstRestore);
  if(vaseWhole)vaseWhole.visible=!s.vase;
  if(vaseFragments)vaseFragments.visible=!!s.vase;
  if(vaseFragments&&s.vase&&!lastVaseBroken&&!firstRestore&&!reducedMotion){
   // A dog bark fractures the real pottery. Twelve captive ceramic pieces
   // scatter onto their existing little shelf, not off the face or into a
   // separate popup. Their end poses are deterministic and save-safe.
   vaseFragments.children.forEach((piece,i)=>{
    const p=piece.userData.restPosition,r=piece.userData.restRotation;
    gsap.killTweensOf(piece.position);gsap.killTweensOf(piece.rotation);
    piece.position.set(0,.31,0);piece.rotation.set(-.4,0,0);
    gsap.to(piece.position,{x:p.x,y:p.y,z:p.z,
     duration:.45+i*.025,ease:"power2.out",onUpdate:invalidate});
    gsap.to(piece.rotation,{x:r.x,y:r.y,z:r.z,
     duration:.43+i*.025,ease:"power2.out",onUpdate:invalidate});
   });
   settleMicro("vase",1150,()=>{
    vaseFragments.children.forEach(piece=>{
     gsap.killTweensOf(piece.position);gsap.killTweensOf(piece.rotation);
     piece.position.copy(piece.userData.restPosition);
     piece.rotation.copy(piece.userData.restRotation);
    });
   });
  }else if(!s.vase){
   vaseFragments?.children.forEach(piece=>{
    gsap.killTweensOf(piece.position);gsap.killTweensOf(piece.rotation);
    piece.position.copy(piece.userData.restPosition);
    piece.rotation.copy(piece.userData.restRotation);
   });
  }
  lastVaseBroken=!!s.vase;
  // The 4:17 correspondence changes the watch's *actual* dial. Keep
  // the final angle on reload and don't replay the discovery animation.
  const tapeRead=!!s.tapeInserted;
  const hourEnd=tapeRead?-(4+17/60)*Math.PI/6:0;
  const minuteEnd=tapeRead?-17*Math.PI/30:0;
  setPose(watchHourHand,"rotation","z",hourEnd,1.08,firstRestore);
  setPose(watchMinuteHand,"rotation","z",minuteEnd,1.08,firstRestore);
  if(tapeRead!==lastTapeRead&&!firstRestore&&!reducedMotion){
   settleMicro("watch",1550,()=>{
    gsap.killTweensOf(watchHourHand.rotation);
    gsap.killTweensOf(watchMinuteHand.rotation);
    watchHourHand.rotation.z=hourEnd;watchMinuteHand.rotation.z=minuteEnd;
   });
  }
  lastTapeRead=tapeRead;
  const vendValue=s.refundRedeemed ? .47 : s.shimUsed ? .39 :
   (Array.isArray(s.seen)&&s.seen.includes("machine") ? .32 : .225);
  if(vendingServiceSeal)vendingServiceSeal.visible=!!s.refundRedeemed;
  setPose(vendingTray,"position","z",vendValue,.62,firstRestore);
  if(Math.abs(vendValue-lastVendingDepth)>.001&&!firstRestore&&!reducedMotion){
   const target=vendValue;
   settleMicro("vending",1100,()=>{
    if(lastVendingDepth!==target)return;
    gsap.killTweensOf(vendingTray.position);
    vendingTray.position.z=target;
   });
  }
  lastVendingDepth=vendValue;
  // The code wheels are hidden inside the luggage lining until the
  // original key has released its catch; before then, clicking the bag
  // still reaches the locked-bag clue instead of an inaccessible dial.
  if(bagDialPanel)bagDialPanel.visible=!!s.bagOpen;
  const bagRelease=puzzleControls.get("thing:bag-release");
  if(bagRelease)bagRelease.visible=!!s.bagOpen;
  if(!!s.bagOpen!==lastBagOpen&&bagCover){
   if(bagCoverSettleTimer){clearTimeout(bagCoverSettleTimer);bagCoverSettleTimer=null;}
   const coverAngle=s.bagOpen?-1.42:0;
   setPose(bagCover,"rotation","x",coverAngle,.46,firstRestore);
   if(!firstRestore&&!reducedMotion){
    // A wall-clock end stop guarantees the newly exposed wheels stay free
    // even on throttled software-rendered devices.
    bagCoverSettleTimer=setTimeout(()=>{
     gsap.killTweensOf(bagCover.rotation);
     bagCover.rotation.x=coverAngle;
     bagCoverSettleTimer=null;
     invalidate();
    },950);
   }
  }
  if(s.bagOpen&&!lastBagOpen){
   // An inventory key unlocks a mechanism. End any previous inspection
   // wobble before its delicate controls become reachable by the pointer.
   const bag=items.get("bag")?.toy;
   if(bag){
    gsap.killTweensOf(bag.position);gsap.killTweensOf(bag.rotation);
    bag.position.set(0,.03,.205);bag.rotation.set(0,0,0);
    invalidate();
   }
  }
  lastBagOpen=!!s.bagOpen;
  // These generic transparent inspection boxes used to sit IN FRONT of
  // real puzzle controls. The bag's actual leather stays selectable after
  // opening, while its dials and all four elevator keys win the raycast.
  const bagVolume=items.get("bag")?.hitVolume;
  if(bagVolume)bagVolume.visible=!s.bagOpen;
  const liftVolume=items.get("elevator")?.hitVolume;
  if(liftVolume)liftVolume.visible=false;
  const newDialValues=bagDials.map((_,i)=>(s.bagDials?.[i]||0)%glyphMaterials.length);
  for(let i=0;i<bagDials.length;i++){
   const value=newDialValues[i],dial=bagDials[i],glyph=bagDialGlyphs[i];
   if(!lastDialValues||firstRestore){
    if(bagDialSettleTimers[i])clearTimeout(bagDialSettleTimers[i]);
    bagDialSettleTimers[i]=null;
    gsap.killTweensOf(dial.rotation);
    gsap.killTweensOf(glyph.rotation);
    bagDialGoals[i]=value*Math.PI/3;
    dial.rotation.z=bagDialGoals[i];
    glyph.rotation.z=-bagDialGoals[i];
   }else if(value!==lastDialValues[i]){
    const turns=(value-lastDialValues[i]+glyphMaterials.length)%glyphMaterials.length;
    // Count clockwise detents even when the player clicks faster than
    // GSAP can render; six clicks return to exactly the same glyph.
    const end=(bagDialGoals[i]??dial.rotation.z)+turns*Math.PI/3;
    bagDialGoals[i]=end;
    setPose(dial,"rotation","z",end,.33);
    setPose(glyph,"rotation","z",-end,.33);
    // SwiftShader and background tabs can throttle animation frames. Force
    // the precise final mechanical position on a fixed deadline without
    // allowing an old timer to rewind a newer click.
    if(bagDialSettleTimers[i])clearTimeout(bagDialSettleTimers[i]);
    bagDialSettleTimers[i]=setTimeout(()=>{
     if(bagDialGoals[i]!==end)return;
     gsap.killTweensOf(dial.rotation);
     gsap.killTweensOf(glyph.rotation);
     dial.rotation.z=end;glyph.rotation.z=-end;
     bagDialSettleTimers[i]=null;
     invalidate();
    },950);
   }
   glyph.material=glyphMaterials[value];
  }
  lastDialValues=newDialValues;
  // A physical confirmation that the correct four glyphs were entered,
  // but never an automatic release of the bag's false bottom.
  const matching=s.bagOpen&&Array.isArray(s.bagDials)&&
   s.bagDials.length===4&&s.bagDials.every((value,i)=>value===[2,0,3,1][i]);
  bagCatchMetal.emissiveIntensity=matching&&!s.bagSolved?.78:0;
  liftDoors.forEach((panel,i)=>{
   const target=(i===0?-1:1)*(s.floorFour?.18:.105);
   if(firstRestore||reducedMotion)panel.position.x=target;
   else if(lastFloorFour!==!!s.floorFour)
    setPose(panel,"position","x",target,.83);
  });
  lastFloorFour=!!s.floorFour;
  if(liftStatusGlass)liftStatusGlass.emissiveIntensity=s.floorFour?.9:.04;
  // Mechanisms react to completed actions, without looping or handing out
  // extra rewards. Restored saves show their settled physical state.
  const dogHits=Math.max(0,Number(s.dogHits)||0);
  if(dogTail&&dogHits!==lastDogHits&&dogHits>0&&!firstRestore){
   gsap.killTweensOf(dogTail.rotation);
   if(reducedMotion){dogTail.rotation.z=0;invalidate();}
   else{
    gsap.timeline({onUpdate:invalidate})
     .to(dogTail.rotation,{z:.46,duration:.16,ease:"sine.out"})
     .to(dogTail.rotation,{z:-.28,duration:.18,ease:"sine.inOut"})
     .to(dogTail.rotation,{z:0,duration:.24,ease:"sine.out"});
    settleMicro("dog",1100,()=>{
     gsap.killTweensOf(dogTail.rotation);dogTail.rotation.z=0;
    });
   }
  }
  lastDogHits=dogHits;
  const raining=!!(s.cloud&&s.music);
  if(raining!==lastRain){
   cloudDrops.forEach((drop,i)=>{
    gsap.killTweensOf(drop.position);
    setPose(drop,"position","y",raining?.11+(i%2)*.043:.23,.48+i*.10,firstRestore);
   });
  }
  lastRain=raining;
  const mothTouched=!!s.mothTouched;
  if(mothTouched!==lastMothTouched){
   for(const {wing,side} of mothWings)
    setPose(wing,"rotation","z",side*(mothTouched?.73:.33),.56,firstRestore);
  }
  lastMothTouched=mothTouched;
  const movingTrain=!!s.train;
  if(movingTrain!==lastTrain){
   for(const wheel of trainWheels){
    gsap.killTweensOf(wheel.rotation);
    wheel.rotation.x=0;
    if(movingTrain&&!firstRestore&&!reducedMotion)
     gsap.to(wheel.rotation,{x:Math.PI*4,duration:1.45,
      ease:"power2.out",onUpdate:invalidate});
   }
   if(movingTrain&&!firstRestore&&!reducedMotion)
    settleMicro("train",1900,()=>{
     for(const wheel of trainWheels){
      gsap.killTweensOf(wheel.rotation);wheel.rotation.x=Math.PI*4;
     }
    });
  }
  lastTrain=movingTrain;
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
  // Collectibles bolt to the same moving cube face as the object that
  // dispenses them. No duplicate flat or floating reward panel.
  getPickupHost:name=>items.get(name)?.fixture||null,
  targets:new Map([...items].map(([n,v])=>[n,v.toy])),
  puzzleTargets:puzzleControls,
  pickVolumes:new Map([...items].map(([n,v])=>[n,v.hitVolume])),
  puzzleActions:[...puzzleControls.keys()],
  pulse,
  inspect,
  getInspectionPose:name=>{
   const instance=items.get(name);
   return instance?{depth:instance.toy.position.z,
    tilt:instance.toy.rotation.z,visible:instance.fixture.visible}:null;
  },
  getDialAngles:()=>bagDials.map(d=>d.rotation.z),
  getLiftDoorPositions:()=>liftDoors.map(d=>d.position.x),
  getElevatorButtonDepth:n=>puzzleControls.get("thing:elevator-floor-"+n)?.position.z??null,
  getPose:()=>({
   dogTailAngle:dogTail?.rotation.z??null,
   cloudDropHeights:cloudDrops.map(drop=>drop.position.y),
   mothWingAngles:mothWings.map(({wing})=>wing.rotation.z),
   trainWheelAngles:trainWheels.map(wheel=>wheel.rotation.x),
   bagCoverAngle:bagCover?.rotation.x??0,
   bagCatchReady:bagCatchMetal.emissiveIntensity>.25,
   liftLampLevel:liftStatusGlass?.emissiveIntensity??null,
   doorAngle:doorLeaf?.rotation.y??0,
   musicLidAngle:musicLid?.rotation.x??0,
   vaseWholeVisible:vaseWhole?.visible??false,
   shardsVisible:vaseFragments?.visible??false,
   shardCount:vaseFragments?.children.length??0,
   vaseShardSpread:vaseFragments?.children.reduce((sum,shard)=>sum+Math.hypot(shard.position.x,shard.position.z),0)??0,
   dancerRotation:dancer.rotation.y,
   watchHourAngle:watchHourHand?.rotation.z??null,
   watchMinuteAngle:watchMinuteHand?.rotation.z??null,
   vendingTrayDepth:vendingTray?.position.z??null,
   vendingServiceSealVisible:vendingServiceSeal?.visible??false,
   seedSproutVisible:sprout.visible,
   treeGrowthScale:branches.scale.y,
   observatory:{
     installed:!!items.get("telescope")?.fixture.visible,
     deployed:!!items.get("telescope")?.visible,
     shutterProgress:observatoryShutter.progress,
     slatCount:observatoryPanels.length,
     visibleSlats:observatoryPanels.filter(({panel})=>panel.visible).length,
     rearCapVisible:!!observatoryRearCap?.visible,
     guideRailCount:observatoryGuideRollers.length,
     visibleGuideRollers:observatoryGuideRollers.filter(({carriage})=>carriage.visible).length,
     visibleRivetCount:observatoryRivetCount,
     enamelTextureApplied:ivory.map===enamelGrain,
     retainedDomeFraction:1-(OBSERVATORY_OPEN_HALF_ANGLE*
      Math.sin(OBSERVATORY_ARCH_RISE*.72))/Math.PI,
     domeSeamHeight:items.get("telescope")?.fixture.position.z+
      OBSERVATORY_RING_TOP,
     canopyFrontY:-OBSERVATORY_RADIUS*Math.cos(OBSERVATORY_ARCH_RISE),
     canopyCrownZ:OBSERVATORY_RING_TOP+OBSERVATORY_RADIUS,
     frontSillTopZ:OBSERVATORY_RING_TOP,
     mouthWidth:2*OBSERVATORY_RADIUS*Math.sin(OBSERVATORY_OPEN_HALF_ANGLE),
     openingRise:OBSERVATORY_RADIUS*Math.sin(OBSERVATORY_ARCH_RISE),
     objectiveFrontY:observatoryScope.position.y+
      observatoryScope.scale.y*(observatoryBarrel.position.y-
       .151*Math.sin(observatoryBarrel.rotation.x)),
     objectiveCenterZ:observatoryScope.position.z+
      observatoryScope.scale.z*(observatoryBarrel.position.z+
       .151*Math.cos(observatoryBarrel.rotation.x)),
     scopeTilt:observatoryScope?.rotation.y??null,
     barrelForwardY:observatoryBarrel?-Math.sin(observatoryBarrel.rotation.x):null,
     barrelUpZ:observatoryBarrel?Math.cos(observatoryBarrel.rotation.x):null
    },
    telescopeOptics:{
    lens:telescopeLensGlass?.visible??false,
    iris:telescopeIrisGlass?.visible??false,
    both:!!(telescopeLensGlass?.visible&&telescopeIrisGlass?.visible)
   }
  }),
  setState,
  meshCount:()=>parts,
  visibleNames:()=>[...items].filter(([,v])=>v.visible).map(([n])=>n),
  getMountPositions:()=>mounts,
  getMiniatureBodyMountAudit:()=>modelBases.map(mount=>{
   const supported=mount.method==="captive post";
   const tripod=mount.method==="tripod";
   return {
    name:mount.name,method:mount.method,lowestBodyY:mount.lowest,
    reachesShelf:supported?.03+.69*(mount.bottom-.012)<=-.0245:
     .03+.69*mount.lowest<=-.0245+.012,
    touchesModel:!supported||mount.top>=mount.lowest+.01,
    staysWithMiniature:!supported||
     (mount.post.parent===mount.toy&&mount.saddle.parent===mount.toy&&
      mount.foot.parent===mount.toy),
    rearTouchesShelf:tripod?
     (.205+.69*(-.118))<=.115+.17/2:
     .205-.69*.034<=.115+.17/2
   };
  }),
  getHardwareAttachmentAudit:()=>{
   // All values below come from the actual Three.js geometric parameters,
   // not a second manually maintained map of where screws SHOULD be.
   // The face's outer enamel is about z=.0725. Every stand-off needs to
   // cross that surface and touch the miniature's fixed upper rail.
   const extent=(mesh)=>{
    const p=mesh.geometry.parameters;
    const depth=mesh.geometry.type==="CylinderGeometry"?p.height:p.depth;
    return [mesh.position.z-depth/2,mesh.position.z+depth/2];
   };
   return mountHardware.map(h=>{
    if(h.name==="telescope"){
      const base=items.get("telescope");
      return {name:h.name,standoffs:1,
       shellMounted:!!base?.mountRing&&base.mountRing.parent===base.toy&&
        Math.abs(base.fixture.position.z-.060)<.002,
       upperSeated:base?.shutterHub?.parent===base?.toy,
       lowerSeated:base?.instrument?.parent===base?.toy};
     }
     const bar=extent(h.crossbar),shelf=extent(h.shelf);
    const shellMounted=h.mountStandoffs.every(stem=>
     h.fixture.position.z+extent(stem)[0]<=.073 &&
     extent(stem)[1]>=bar[0]-.025);
    const upperSeated=h.upperHeads.every(head=>
     extent(head)[0]<=bar[1]+.008 &&
     Math.abs(head.position.y-h.crossbar.position.y)<=
      h.crossbar.geometry.parameters.height/2+head.geometry.parameters.radiusTop+.003);
    const lowerSeated=h.lowerHeads.every(head=>
     extent(head)[0]<=shelf[1]+.008 &&
     Math.abs(head.position.y-h.shelf.position.y)<=
      h.shelf.geometry.parameters.height/2+head.geometry.parameters.radiusTop+.003);
    return {name:h.name,standoffs:h.mountStandoffs.length,
     shellMounted,upperSeated,lowerSeated};
   });
  },
  // Measure rendered solids in the *face's local coordinate system* after
  // unlock animations. Static socket spacing cannot catch a raised tree,
  // opened door, extended vending tray, or rewards in front of a mount.
  // Ignore invisible raycast meshes and undiscovered models.
  getUnlockedGeometryAudit:()=>{
   cube.updateMatrixWorld(true);
   const bounds=[];
   for(const {name,face:faceName} of mounts){
    const item=items.get(name);
    if(!item?.fixture.visible)continue;
    const face=faces[faceName];
    const inverse=face.matrixWorld.clone().invert();
    const min=new THREE.Vector3(Infinity,Infinity,Infinity);
    const max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
    let solids=0;
    item.fixture.traverse(mesh=>{
     if(!mesh.isMesh)return;
     for(let node=mesh;node&&node!==item.fixture.parent;node=node.parent)
      if(!node.visible)return;
     const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
     if(mats.every(m=>m?.colorWrite===false||m?.opacity===0))return;
     const geometry=mesh.geometry;
     if(!geometry.boundingBox)geometry.computeBoundingBox();
     const b=geometry.boundingBox;
     if(!b)return;
     const matrix=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
     for(const x of [b.min.x,b.max.x])
      for(const y of [b.min.y,b.max.y])
       for(const z of [b.min.z,b.max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(matrix);
        min.min(p);max.max(p);
       }
     solids++;
    });
    if(solids)bounds.push({name,face:faceName,solids,
     min:min.toArray().map(x=>+x.toFixed(3)),
     max:max.toArray().map(x=>+x.toFixed(3))});
   }
   const clashes=[],overhangs=[],protrusions=[];
   // Visible miniatures should fit *inside* their physical cube edge.
   // Small bevels and inset shells are allowed; no prop floats across a
   // corner or pokes a long distance outward when its mechanism activates.
   for(const b of bounds){
    if(b.min[0]<-1.62||b.max[0]>1.62||
       b.min[1]<-1.62||b.max[1]>1.62)
     overhangs.push({name:b.name,face:b.face,min:b.min,max:b.max});
    if(b.max[2]>1.03)
     protrusions.push({name:b.name,face:b.face,depth:b.max[2]});
   }
   for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
    const a=bounds[i],b=bounds[j];
    if(a.face!==b.face)continue;
    const dx=Math.min(a.max[0],b.max[0])-Math.max(a.min[0],b.min[0]);
    const dy=Math.min(a.max[1],b.max[1])-Math.max(a.min[1],b.min[1]);
    const dz=Math.min(a.max[2],b.max[2])-Math.max(a.min[2],b.min[2]);
    if(dx>.06&&dy>.06&&dz>.06)
     clashes.push({first:a.name,second:b.name,face:a.face,
      overlap:[dx,dy,dz].map(x=>+x.toFixed(3))});
   }
   return {bounds,clashes,overhangs,protrusions};
  },
  // A compact layout audit only considers actual physical mount plates and
  // permanent real controls, not intentionally nested pieces within a model.
  // The name and face are supplied to browser QA without revealing clues.
  getMountClearanceViolations:(controls=[])=>{
   // The old symmetric .59-tall test rectangle wrongly extended far
   // below the actual bolted plate. Its physical support runs roughly
   // from -.06 to +.36, so center the clearance envelope .10 higher.
   // This permits lowering the tall opened music-box lid INSIDE the cube
   // rim without pretending it overlaps the optical assembly below.
   const padded=mounts.map(v=>({name:v.name,face:v.face,
    x:v.x,y:v.y+.10,w:.56,h:.48}));
   const faults=[];
   for(let i=0;i<padded.length;i++)for(let j=i+1;j<padded.length;j++){
    const a=padded[i],b=padded[j];
    if(a.face===b.face&&
      Math.abs(a.x-b.x)<(a.w+b.w)/2+.02&&
      Math.abs(a.y-b.y)<(a.h+b.h)/2+.02)
     faults.push(a.face+": "+a.name+" miniature overlaps "+b.name);
   }
   for(const a of padded)for(const b of controls){
    if(a.face===b.face&&
      Math.abs(a.x-b.x)<(a.w+b.w)/2+.02&&
      Math.abs(a.y-b.y)<(a.h+b.h)/2+.02)
     faults.push(a.face+": "+a.name+" miniature clips "+b.name);
   }
   // Circle-versus-rectangle envelopes catch collisions with the permanent
   // sculpted lens, rear iris, underside lock and meter, even though those
   // background mechanisms are authored by independent geometry modules.
   const fixed=[
    {face:"frontFace",name:"front optical bezel",x:0,y:.56,r:.76},
    {face:"leftFace",name:"pressure instrument",x:.88,y:.64,r:.312},
    {face:"backFace",name:"rear iris bezel",x:0,y:-.18,r:.97},
    {face:"bottomFace",name:"underbody lock",x:0,y:0,r:.67},
    {face:"leftFace",name:"clockwork gear A",x:-.20,y:.04,r:.31},
    {face:"leftFace",name:"clockwork gear B",x:.23,y:-.27,r:.235}
   ];
   for(const a of padded)for(const b of fixed){
    if(a.face!==b.face)continue;
    const dx=Math.max(0,Math.abs(a.x-b.x)-a.w/2);
    const dy=Math.max(0,Math.abs(a.y-b.y)-a.h/2);
    if(Math.hypot(dx,dy)<b.r+.025)
     faults.push(a.face+": "+a.name+" sculpture clips "+b.name);
   }
   return faults;
  },
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
   return {visible:instance.visible,scale:fixture.scale.x,depth:fixture.position.z,
    inlayColor:instance.inlay.material.color.getHexString()};
  }
 };
}
