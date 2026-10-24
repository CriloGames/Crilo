import * as THREE from "three";

/**
 * An actual miniature world attached to the 3D machine. Every story actor
 * has a small sculpted counterpart with its own solids, rather than an HTML
 * illustration pasted over the WebGL stage.
 *
 * Puzzle logic and localStorage remain entirely in cube-secrets.js.
 */
export function buildPocketWorlds({scene,box,cylinder,mat,setHit}){
 const m={
  brass:mat(0xbda174,.67,.34),gold:mat(0xf1d8a6,.32,.32),
  dark:mat(0x454653,.35,.53),wood:mat(0x916b5b,.17,.69),
  cream:mat(0xf4e6d4,.12,.43),pink:mat(0xd9a3a9,.07,.62),
  blue:mat(0xa6cbd1,.12,.43),green:mat(0x92baa0,.1,.62),
  velvet:mat(0x7b6887,.03,.83),leaf:mat(0x659273,.03,.68),
  white:mat(0xe8e6df,.07,.4),black:mat(0x272f39,.19,.54),
  glass:mat(0xaacddc,.06,.18),copper:mat(0xba826a,.57,.42)
 };
 const root=new THREE.Group();
 scene.add(root);
 let parts=0;
 const items=new Map(),locations=new Map();
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
 // Positions are on the machined presentation ring, not pasted on the
 // rotating cube. Each miniature rises from a little socket on the stand.
 const slots=[
  ["bag",-2.22,1.10],["door",-1.33,2.05],["dog",-.28,2.28],
  ["vase",.78,2.25],["pot",1.72,1.69],["musicbox",2.30,.65],
  ["cloud",-2.45,-.18],["cup",2.40,-.55],["clock",1.90,-1.46],
  ["machine",1.03,-2.17],["elevator",-.06,-2.28],
  ["moth",-1.19,-2.06],["telescope",-2.12,-1.20],
  ["train",.08,1.69],["squirrel",-.95,1.51]
 ];
 for(const [name,x,z] of slots){
  const fixture=new THREE.Group();
  fixture.position.set(x,-2.035,z);
  root.add(fixture);locations.set(name,fixture);
  const stand=new THREE.Group();fixture.add(stand);
  C(stand,.31,.045,0,-.014,0,m.dark);
  C(stand,.27,.03,0,.017,0,m.brass);
  C(stand,.225,.014,0,.038,0,m.cream);
  const toy=new THREE.Group();toy.position.y=.075;fixture.add(toy);
  items.set(name,{fixture,toy,stand,visible:false});
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
 }
 // Real opening doorway, jamb, inset raised panel, solid knob.
 {
  const g=toy("door");
  B(g,.55,.73,.10,0,.39,0,m.brass,.032);
  B(g,.40,.63,.07,0,.40,.07,m.wood,.018);
  B(g,.30,.27,.026,0,.49,.115,m.cream,.014);
  B(g,.29,.16,.025,0,.20,.113,m.velvet,.012);
  C(g,.041,.05,.135,.36,.136,m.gold,"z");
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
  C(g,.17,.29,0,.22,0,m.pink);
  C(g,.105,.18,0,.44,0,m.pink);
  C(g,.135,.035,0,.53,0,m.cream);
  C(g,.084,.009,0,.552,0,m.dark);
  for(let i=0;i<4;i++){
   const t=i*Math.PI/2;
   wire(g,[[Math.sin(t)*.15,.12,Math.cos(t)*.15],
    [Math.sin(t)*.17,.28,Math.cos(t)*.17],
    [Math.sin(t)*.08,.45,Math.cos(t)*.08]],.009,m.gold);
  }
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
  B(g,.53,.052,.43,0,.39,-.04,m.brass,.021);
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
  for(const x of [-.105,.105])B(g,.20,.52,.045,x,.39,.17,m.gold,.016);
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
 function setState(state){
  const s=state||{};
  const show={
   bag:s.bag,door:s.door,dog:s.doorOpen,vase:s.doorOpen,
   squirrel:s.squirrel, pot:s.vase,musicbox:s.vase,
   cloud:s.cloud,cup:s.music,clock:s.watch,machine:s.mouse,
   elevator:s.watch&&s.tag,moth:s.floorFour,
   telescope:s.moon,train:s.train
  };
  for(const [name,instance] of items){
   const visible=!!show[name];
   instance.fixture.visible=visible;
   instance.visible=visible;
  }
  branches.visible=!!s.tree;
  dancer.visible=!!s.dancer;
  // The vase is part of the dog sequence: after it breaks it is replaced
  // with loose, disconnected pieces rather than a still-intact vase.
  const vase=items.get("vase");
  if(vase)vase.toy.scale.y=s.vase?.24:1;
 }
 // Raycast targets must be registered AFTER sculpting the miniatures:
 // otherwise setHit traverses an empty group and none of them are clickable.
 for(const [name,{toy}] of items)setHit(toy,"thing:"+name);
 // Focus and hover belong to the outer stage; this geometry awards nothing.
 setState({});
 return {
  names:[...items.keys()],
  targets:new Map([...items].map(([n,v])=>[n,v.toy])),
  setState,
  meshCount:()=>parts,
  visibleNames:()=>[...items].filter(([,v])=>v.fixture.visible).map(([n])=>n)
 };
}
