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
 let bagDialPanel=null,bagCover=null,bagCoverSettleTimer=null,liftStatusGlass=null;
 let doorLeaf=null,musicLid=null,vaseWhole=null,vaseFragments=null;
 let watchHourHand=null,watchMinuteHand=null,vendingTray=null;
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
 // Top face: outer brackets must not intersect the real hinged lid's
 // -.85..+.85 sweep. The two miniatures sit entirely on its fixed rails.
 // Right face: the dog is shifted off the teal sliding drawer's bezel,
 // including the opened state where its depth increases.
 const slots=[
  ["bag","frontFace",-1.17,-.81],["machine","frontFace",1.18,.74],
  ["door","rightFace",-1.01,.80],["dog","rightFace",1.16,.08],
  // Vase sits with the squirrel underneath: the previous left-face mount
  // clipped the playable pressure gauge and its label.
  ["vase","bottomFace",0,1.12],
  ["pot","backFace",-1.16,.73],["musicbox","backFace",0,1.19],
  ["cloud","backFace",1.16,.73],["squirrel","bottomFace",-1.03,.28],
  ["cup","leftFace",.0,-1.20],["clock","frontFace",1.17,-.83],
  ["elevator","leftFace",-1.01,-.96],
  ["moth","topFace",-1.15,.21],["telescope","topFace",1.15,-.65],
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
  B(stand,.53,.42,.055,0,.15,-.04,m.dark,.020);
  const inlay=B(stand,.48,.36,.023,0,.16,.008,mountAccents[name],.018);
  // A narrow captive trim follows the top edge without inventing extra
  // labels or interfering with precision bag and elevator controls.
  B(stand,.38,.018,.018,0,.331,.035,m.gold,.006);
  B(stand,.56,.051,.37,0,-.035,.19,m.dark,.018);
  B(stand,.50,.029,.35,0,.009,.19,m.gold,.012);
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
  items.set(name,{fixture,toy,stand,inlay,hitVolume,visible:false});
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
  // The three combination tumblers are actual rotating bronze cylinders,
  // fixed to a machined backplate on the bag, not modal-only buttons.
  bagDialPanel=new THREE.Group();g.add(bagDialPanel);
  B(bagDialPanel,.43,.12,.034,0,.275,.153,m.dark,.017);
  for(let i=0;i<3;i++){
   const dial=new THREE.Group();
   dial.position.set((i-1)*.13,.275,.197);bagDialPanel.add(dial);
   C(dial,.047,.030,0,0,0,m.gold,"z");
   // Seven small, physically raised grips give the tiny bronze drum
   // useful machining detail without overlapping the adjacent wheels.
   for(let notch=0;notch<7;notch++){
    const angle=notch*Math.PI*2/7;
    const grip=B(dial,.011,.021,.011,Math.cos(angle)*.042,
     Math.sin(angle)*.042,.028,m.dark,.003);
    grip.rotation.z=angle;
   }
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
 function inspect(name){
  const instance=items.get(name);
  if(!instance?.fixture.visible)return false;
  // The precision tumblers should never move under the player's finger.
  if(name==="bag"&&bagDialPanel?.visible)return true;
  // Limit repeated spring restarts on the same miniature. A quick series
  // of taps should not monopolize frames on low-end mobile hardware.
  const now=Date.now();
  if(instance.lastInspectionAt&&now-instance.lastInspectionAt<220)return true;
  instance.lastInspectionAt=now;
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
  // The miniatures recoil along their mounting axis, not by floating and
  // tilting into adjacent dials and shutters.
  instance.inspectionMotion=gsap.timeline({onUpdate:invalidate,onComplete:settle})
   .to(object.position,{z:rest+.047,duration:.12,ease:"power2.out"})
   .to(object.position,{z:rest,duration:.30,ease:"back.out(1.35)"});
  // Software renderers sometimes stall requestAnimationFrame indefinitely.
  instance.inspectionSettleTimer=setTimeout(settle,900);
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
  const vendValue=s.shimUsed ? .39 :
   (Array.isArray(s.seen)&&s.seen.includes("machine") ? .32 : .225);
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
  const newDialValues=[0,1,2].map(i=>(s.bagDials?.[i]||0)%4);
  for(let i=0;i<bagDials.length;i++){
   const value=newDialValues[i],dial=bagDials[i],glyph=bagDialGlyphs[i];
   if(!lastDialValues||firstRestore){
    if(bagDialSettleTimers[i])clearTimeout(bagDialSettleTimers[i]);
    bagDialSettleTimers[i]=null;
    gsap.killTweensOf(dial.rotation);
    gsap.killTweensOf(glyph.rotation);
    bagDialGoals[i]=value*Math.PI/2;
    dial.rotation.z=bagDialGoals[i];
    glyph.rotation.z=-bagDialGoals[i];
   }else if(value!==lastDialValues[i]){
    const turns=(value-lastDialValues[i]+4)%4;
    // Every click adds a complete detent to the intended angle, even if
    // the previous tween has barely started. Four quick turns must make a
    // whole revolution instead of four attempts at the same quarter-turn.
    const end=(bagDialGoals[i]??dial.rotation.z)+turns*Math.PI/2;
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
   seedSproutVisible:sprout.visible,
   treeGrowthScale:branches.scale.y
  }),
  setState,
  meshCount:()=>parts,
  visibleNames:()=>[...items].filter(([,v])=>v.fixture.visible).map(([n])=>n),
  getMountPositions:()=>mounts,
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
   const padded=mounts.map(v=>({name:v.name,face:v.face,x:v.x,y:v.y,
    w:.56,h:.59}));
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
    {face:"rightFace",name:"pressure instrument",x:.12,y:.77,r:.42},
    {face:"backFace",name:"rear iris bezel",x:0,y:-.18,r:.97},
    {face:"bottomFace",name:"underbody lock",x:0,y:0,r:.67},
    {face:"leftFace",name:"clockwork gear A",x:-.20,y:.04,r:.31},
    {face:"leftFace",name:"clockwork gear B",x:.39,y:-.40,r:.235}
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
   return {visible:fixture.visible,scale:fixture.scale.x,depth:fixture.position.z,
    inlayColor:instance.inlay.material.color.getHexString()};
  }
 };
}
