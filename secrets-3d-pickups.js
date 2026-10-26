import * as THREE from "three";
import {gsap} from "gsap";

// Every reward lives in a real, selectable three-dimensional cradle attached
// to its source miniature or mechanism. Puzzle state and inventory decisions
// remain solely in cube-secrets.js; this module only displays saved pickups.
export function buildPhysicalPickups({faces,worlds,hotspots,box,cylinder,mat,setHit,invalidate=()=>{}}){
 const metal=mat(0xe6c994,.72,.32);
 const copper=mat(0xc58b72,.65,.36);
 const ink=mat(0x38444c,.35,.52);
 const paper=mat(0xf7e7cb,.04,.82);
 const glass=mat(0x9bd9dc,.15,.20);
 const leaf=mat(0x9cb78b,.08,.75);
 const sugar=mat(0xfffaf0,.04,.78);
 const porcelain=mat(0xd6b5b9,.08,.65);
 // The first four original collectibles already have dedicated models
 // inside the sliding compartments and under the cube.
 const sources={
  coin:["bag",0],reed:["bag",1],treat:["bag",2],prism:["bag",3],
  sugar:["machine",0],tag:["dog",0],postcard:["dog",1],
  // The vase breaks and its contents spill out there. Neither reward
  // should materialize at the squirrel that merely knocked it over.
  acorn:["vase",0],spring:["vase",1],
  raindrop:["cloud",0],bird:["pot",0],
  lens:["elevator",0],stardust:["moth",0],starmap:["telescope",0],
  parcel:["train",0],envelope:["train",1],
  tape:["musicbox",0],letter:["clock",0],
  // Each mechanism reward originates in its unlocked recess, not on
  // whichever actuator triggered the mechanism. Bell releases underneath.
  bell:["underside",0],fork:["pressure",0],shim:["vent-pocket",0],
  cog:["front-cog-pocket",0],washer:["hinge-0",0],
  cylinder:["service-pocket",0],iris:["eye",0]
 };
 const instances=new Map();
 // Collectibles are carried by captive, shallow slide-out trays; they
 // never hover out in front of the miniature when a secret unlocks.
 const trays=new Map();
 const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 let firstState=true,revealCount=0;
 // Center spacing remains 0.32 x 0.25 for separately tappable objects.
 // Move the lower row toward its mount: the previous -.37 offset left
 // objects dangling beyond the shelf and in front of corner screws.
 const locations={
  0:[-.16,-.04],1:[.16,-.04],2:[-.16,-.29],3:[.16,-.29]
 };
 const slotCount=new Map();
 for(const [source,slot] of Object.values(sources))
  slotCount.set(source,Math.max(slotCount.get(source)||0,slot+1));
 function miniTray(host,source){
  let tray=trays.get(source);
  if(tray)return tray;
  const group=new THREE.Group();
  group.position.z=.385;
  host.add(group);
  const rows=(slotCount.get(source)||1)>2?2:1;
  const height=rows===2?.44:.27;
  const middle=rows===2?-.165:-.065;
  // Open brass carrier rails replace the old *solid black rectangle*.
  // Players can see the enamel and original mechanics between the objects.
  // The two short stems connect the rail to the underlying miniature shelf.
  for(const x of [-.237,.237]){
   box(group,.018,height-.06,.017,x,middle,.017,metal,.006);
   box(group,.025,.040,.24,x,-.005,-.118,copper,.006);
  }
  box(group,.49,.019,.025,0,middle-height/2+.02,.041,metal,.006);
  box(group,.49,.014,.013,0,middle+height/2-.015,.020,copper,.004);
  // The carrier retracts completely once its final visible item is taken.
  group.visible=false;
  tray={group,source};
  trays.set(source,tray);
  return tray;
 }
 function built(group,id){
  const material=["prism","raindrop","sugar","lens","stardust","iris"].includes(id)
   ?(id==="sugar"?sugar:glass):
   ["bird","starmap","parcel","postcard","tape","letter","envelope"].includes(id)?paper:
   ["acorn","treat","reed"].includes(id)?leaf:metal;
  const add=(geo,m=material,x=0,y=0,z=0)=>{
   const part=new THREE.Mesh(geo,m);
   part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;
   group.add(part);return part;
  };
  const B=(w,h,d,x=0,y=0,z=0,m=material)=>
   add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const C=(r,d,x=0,y=0,z=0,m=material)=>
   add(new THREE.CylinderGeometry(r,r,d,18),m,x,y,z);
  const ring=(r,t=0.023,z=.045,m=material)=>
   add(new THREE.TorusGeometry(r,t,8,24),m,0,0,z);
  if(["coin","tag","lens","iris"].includes(id)){
   const disc=C(.093,.032,0,0,.025);
   disc.rotation.x=Math.PI/2;
   ring(.073,.014,.052,id==="tag"?copper:metal);
   if(id==="tag")B(.040,.030,.023,0,0,.065,ink);
  }else if(["washer"].includes(id)){
   ring(.090,.026,.045);
  }else if(id==="bell"){
   const cone=add(new THREE.ConeGeometry(.10,.15,18),copper,0,-.015,.04);
   cone.rotation.z=Math.PI;
   ring(.105,.016,.047);
   const clapper=C(.027,.04,0,-.095,.05,ink);
   clapper.rotation.x=Math.PI/2;
  }else if(id==="fork"){
   B(.02,.18,.028,0,-.012,.05,metal);
   for(const x of [-.05,.05])B(.020,.132,.026,x,.062,.05);
   B(.10,.024,.02,0,.01,.05);
  }else if(id==="spring"){
   const curve=new THREE.CatmullRomCurve3(Array.from({length:33},(_,i)=>{
    const t=i/32*Math.PI*7;
    return new THREE.Vector3(Math.cos(t)*.058,-.097+i/32*.194,
     .050+Math.sin(t)*.058);
   }));
   add(new THREE.TubeGeometry(curve,64,.013,6,false),copper);
  }else if(id==="prism"){
   add(new THREE.TetrahedronGeometry(.115),glass,0,0,.06).rotation.y=.35;
  }else if(id==="raindrop"){
   add(new THREE.SphereGeometry(.08,16,12),glass,0,-.012,.06)
    .scale.set(.68,1.37,.55);
  }else if(id==="acorn"){
   add(new THREE.SphereGeometry(.075,14,10),leaf,0,-.020,.07);
   const cap=C(.083,.03,0,.046,.07,copper);cap.rotation.x=Math.PI/2;
  }else if(["cog","shim"].includes(id)){
   if(id==="cog"){
    C(.067,.04,0,0,.05,copper).rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){
     const a=i*Math.PI/4;
     B(.043,.036,.035,Math.cos(a)*.09,Math.sin(a)*.09,.050);
    }
    ring(.034,.012,.078,ink);
   }else B(.16,.042,.027,0,0,.06,copper).rotation.z=.28;
  }else if(id==="sugar"){
   const cube=B(.135,.135,.135,0,0,.075,sugar);
   cube.rotation.set(.19,.27,.15);
  }else if(["cylinder","reed"].includes(id)){
   const tube=C(.062,.18,0,0,.06,id==="reed"?leaf:copper);
   tube.rotation.z=Math.PI/2;
   for(const x of [-.08,.08]){
    const cap=C(.064,.026,x,0,.06,ink);cap.rotation.z=Math.PI/2;
   }
  }else if(["stardust"].includes(id)){
   const star=new THREE.Shape();
   for(let i=0;i<10;i++){
    const a=i*Math.PI/5-Math.PI/2,r=i%2?.04:.109;
    if(i===0)star.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    else star.lineTo(Math.cos(a)*r,Math.sin(a)*r);
   }
   star.closePath();
   add(new THREE.ExtrudeGeometry(star,{depth:.035,bevelEnabled:true,
    bevelSize:.009,bevelThickness:.007,bevelSegments:1}),glass,0,0,.048);
  }else if(["bird"].includes(id)){
   const left=B(.14,.095,.016,-.045,.018,.06,paper);
   const right=B(.14,.095,.016,.045,.018,.06,paper);
   left.rotation.z=-.6;right.rotation.z=.6;
   B(.044,.15,.018,0,-.023,.069,porcelain);
  }else if(id==="starmap"){
   // A folded chart with tiny star punches and an embossed constellation.
   B(.185,.138,.024,0,0,.064,paper);
   B(.009,.137,.008,-.035,0,.081,copper);
   for(const [x,y] of [[-.057,.029],[.003,.045],[.054,.011],[-.021,-.035],[.069,-.044]])
    add(new THREE.SphereGeometry(.011,7,5),metal,x,y,.081);
   for(const [x,y,ang] of [[-.028,.035,.25],[.027,.023,-.43],[.016,-.025,.3]]){
    const link=B(.064,.007,.007,x,y,.082,ink);link.rotation.z=ang;
   }
  }else if(id==="postcard"){
   B(.185,.125,.021,0,0,.061,paper);
   B(.174,.114,.006,0,0,.075,copper);
   B(.161,.103,.006,0,0,.079,paper);
   B(.041,.039,.011,.055,.027,.088,leaf);
   for(let i=0;i<3;i++)B(.064,.007,.006,-.036,.027-i*.032,.089,ink);
  }else if(id==="tape"){
   // A literal punched music tape with staggered holes, not another page.
   B(.208,.083,.021,0,0,.064,paper);
   B(.201,.008,.009,0,.033,.081,copper);
   B(.201,.008,.009,0,-.033,.081,copper);
   for(let i=0;i<9;i++)
    B(.010,.011,.009,-.084+i*.021,i%3===0?.016:-.016,.082,ink);
  }else if(id==="letter"){
   B(.164,.173,.024,0,0,.060,paper).rotation.z=-.075;
   B(.140,.007,.008,0,.053,.082,copper);
   for(let i=0;i<4;i++)
    B(i===3?.075:.113,.007,.009,-(i===3?.018:0),.027-i*.035,.084,ink);
  }else if(id==="envelope"){
   B(.186,.123,.032,0,0,.061,paper);
   // An actual folded triangular flap sits on top of the sealed envelope.
   const triangle=new THREE.Shape();
   triangle.moveTo(-.083,.045);triangle.lineTo(.083,.045);
   triangle.lineTo(0,-.041);triangle.closePath();
   const flapMaterial=copper.clone();
   flapMaterial.side=THREE.DoubleSide;
   add(new THREE.ShapeGeometry(triangle),flapMaterial,0,0,.081);
   add(new THREE.SphereGeometry(.015,10,7),porcelain,0,-.022,.089);
  }else if(id==="parcel"){
   const packageBody=B(.145,.122,.112,0,0,.085,paper);
   packageBody.rotation.z=.07;
   B(.021,.124,.012,0,0,.147,copper);
   B(.149,.019,.012,0,0,.147,copper);
   B(.044,.023,.012,.028,.028,.157,ink);
  }else if(id==="treat"){
   // A small baked dog biscuit: connected bone-shaped ends in warm clay.
   B(.143,.064,.045,0,0,.065,copper);
   for(const x of [-.078,.078]){
    add(new THREE.SphereGeometry(.034,10,8),copper,x,.021,.065);
    add(new THREE.SphereGeometry(.034,10,8),copper,x,-.021,.065);
   }
  }else{
   B(.13,.085,.055,0,0,.065,material);
   B(.09,.018,.013,0,.008,.10,ink);
  }
 }
 for(const [id,[source,slot]] of Object.entries(sources)){
  const host=worlds?.getPickupHost?.(source)||
   hotspots?.targets?.get(source);
  if(!host)throw Error("No physical pickup origin for "+id+": "+source);
  const atMini=!!worlds?.getPickupHost?.(source);
  // A washer discovered by extracting all three hinge pins cannot be
  // parented to hinge-0: that pin is already hidden and would make the
  // essential washer permanently invisible. Anchor it to the empty seat.
  // Likewise, do not hide the mechanical eye behind its loose glass iris.
  const surface=id==="washer"
   // The last pin is physically withdrawn, so keep the washer in the
   // permanently attached top hinge seat, not in a vanished pin.
   ?{face:faces.topFace,x:-.54,y:.86,z:.20}
   :id==="iris"
    // Small output recess joined to the right shoulder of the glass eye.
    ?{face:faces.backFace,x:.91,y:.25,z:.20}
   :id==="fork"
    // A narrow instrument holder above the gauge clears the actual needle.
    ?{face:faces.leftFace,x:.95,y:1.23,z:.20}
   :id==="bell"
    // The red switch releases a bell from a hidden underside slot.
    ?{face:faces.bottomFace,x:0,y:-1.16,z:.20}:null;
  const root=new THREE.Group();
  const [px,py]=locations[slot]||locations[0];
  // The carrier is supported by its own face-mounted bracket. Item
  // models sit just forward of it, not separated from the cube by air.
  if(atMini){
   const tray=miniTray(host,source);
   root.position.set(px,py,.10);
   root.scale.setScalar(.78);
   tray.group.add(root);
  }else{
   const retainer=new THREE.Group();
   if(surface){
    retainer.position.set(surface.x,surface.y,surface.z);
    surface.face.add(retainer);
   }else host.add(retainer);
   // Machined lead-ins make each output an identifiable part of the
   // mechanism before unlock, without exposing the reward or answer.
   // Their fixed components are shallow and avoid covering buttons.
   if(id==="fork"){
    const link=new THREE.Group();
    faces.leftFace.add(link);
    box(link,.028,.22,.031,.95,1.065,.175,copper,.006);
    box(link,.18,.026,.038,.95,1.175,.176,metal,.008);
   }
   if(id==="iris"){
    box(faces.backFace,.21,.025,.030,.80,.22,.162,copper,.007);
   }
   if(id==="bell"){
    box(faces.bottomFace,.26,.034,.045,0,-1.34,.157,copper,.009);
   }
   // The collectible and its bracket are a single physical assembly,
   // hidden together when the player has not yet earned the object.
   // Gauge and face fittings need a tiny socket, not the thick black
   // square that covered the manometer and pressure needle.
   root.position.set(0,0,.125);
   root.scale.setScalar(.87);
   retainer.add(root);
   box(retainer,.145,.074,.065,0,-.105,.026,metal,.008);
   box(retainer,.105,.018,.035,0,-.141,.064,copper,.005);
   retainer.visible=false;
   root.userData.pickupRetainer=retainer;
  }
  // Every small found object has a bolted shallow cradle with a dark
  // machined inset. The object rests in the socket; it is not a flat
  // cartoon, a badge, or a reward that floats away from the cube.
  // Give each socket its own tiny emissive enamel insert. The glow is
  // reserved for items that have ALREADY been revealed by puzzle logic;
  // it never points at undiscovered mechanisms or correct answers.
  const socketMaterial=ink.clone();
  socketMaterial.emissive.setHex(0xa18a55);
  socketMaterial.emissiveIntensity=0;
  // A narrow recess and retaining lip, not another black tile behind
  // each item. Keep the fine physical detail and its subtle found glow.
  box(root,.151,.019,.065,0,-.097,-.027,socketMaterial,.007);
  box(root,.175,.014,.048,0,-.085,-.002,metal,.005);
  for(const x of [-.082,.082]){
   const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.014,8),copper);
   bolt.rotation.x=Math.PI/2;
   bolt.position.set(x,-.095,.035);
   root.add(bolt);
  }
  const model=new THREE.Group();model.position.y=.005;root.add(model);
  built(model,id);
  // Tiny objects still have a reliable fingertip-sized, depth-aware
  // physical picking surface, restricted to the object itself.
  const target=new THREE.Mesh(new THREE.BoxGeometry(.21,.23,.095),
   new THREE.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,
    depthWrite:false,side:THREE.DoubleSide}));
  target.position.z=.085;root.add(target);
  setHit(root,"pickup:"+id);
  root.userData.pickupModel=model;
  root.userData.pickupSocketMaterial=socketMaterial;
  root.visible=false;
  instances.set(id,root);
 }
 return {
  ids:[...instances.keys()],
  targets:instances,
  getPending:()=>[...instances].filter(([,v])=>v.visible).map(([id])=>id),
  getLayout:()=>[...instances].map(([id,root])=>({
   id,source:sources[id][0],slot:sources[id][1],
   position:root.position.toArray(),scale:root.scale.x,
   mounted:root.parent===trays.get(sources[id][0])?.group||
    root.parent===root.userData.pickupRetainer,
   // Full protrusion from the fixture's face, including the item itself.
   faceDepth:trays.has(sources[id][0])?.585:.43
  })),
  getTrayState:()=>[...trays].map(([source,{group}])=>({
   source,visible:group.visible,
   depth:group.position.z,
   visibleItems:group.children.filter(node=>node.userData.pickupModel&&node.visible).length
  })),
  // Examine the *actual transformed reward geometry* in the coordinate
  // frame of the face it is mounted to. This catches items colliding
  // after all 60 secrets are restored, not merely static socket centers.
  getPlacementAudit:()=>{
   const measured=[],overlaps=[],overhangs=[];
   const parents=Object.entries(faces);
   for(const [id,root] of instances){
    if(!root.visible)continue;
    let ancestor=root,faceName=null,face=null,sceneVisible=true;
    while(ancestor){
     if(!ancestor.visible)sceneVisible=false;
     const match=parents.find(([,node])=>node===ancestor);
     if(match){[faceName,face]=match;break;}
     ancestor=ancestor.parent;
    }
    if(!sceneVisible||!face){overhangs.push({id,problem:"detached or hidden source"});continue;}
    root.updateWorldMatrix(true,true);
    const toFace=face.matrixWorld.clone().invert();
    const min=new THREE.Vector3(Infinity,Infinity,Infinity);
    const max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
    let pieces=0;
    root.traverse(mesh=>{
     if(!mesh.isMesh||!mesh.visible)return;
     const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
     if(mats.every(m=>m?.colorWrite===false||m?.opacity===0))return;
     if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
     const b=mesh.geometry.boundingBox;
     if(!b)return;
     const matrix=new THREE.Matrix4().multiplyMatrices(toFace,mesh.matrixWorld);
     for(const x of [b.min.x,b.max.x])
      for(const y of [b.min.y,b.max.y])
       for(const z of [b.min.z,b.max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(matrix);
        min.min(p);max.max(p);
       }
     pieces++;
    });
    if(!pieces){overhangs.push({id,problem:"no visible item geometry"});continue;}
    const item={id,source:sources[id][0],face:faceName,pieces,
     min:min.toArray().map(v=>+v.toFixed(3)),
     max:max.toArray().map(v=>+v.toFixed(3))};
    measured.push(item);
    if(min.x< -1.63||max.x>1.63||min.y< -1.63||max.y>1.63||
      max.z>1.05)overhangs.push(item);
   }
   for(let i=0;i<measured.length;i++)for(let j=i+1;j<measured.length;j++){
    const a=measured[i],b=measured[j];
    if(a.face!==b.face)continue;
    const shared=[0,1,2].map(k=>
     Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]));
    if(shared[0]>.024&&shared[1]>.024&&shared[2]>.018)
     overlaps.push({first:a.id,second:b.id,face:a.face,
      shared:shared.map(v=>+v.toFixed(3))});
   }
   return {measured,overlaps,overhangs};
  },
  getRevealCount:()=>revealCount,
  getRevealState:id=>{
   const root=instances.get(id);
   if(!root)return null;
   let onScene=true;
   for(let part=root;part;part=part.parent)if(!part.visible){onScene=false;break;}
   return {visible:root.visible,onScene,depth:root.userData.pickupModel.position.z,
    scale:root.userData.pickupModel.scale.x,
    socketGlow:root.userData.pickupSocketMaterial.emissiveIntensity};
  },
  setState(state){
   const pending=new Set(state?.pendingPickups||[]);
   for(const [id,root] of instances){
    const visible=pending.has(id);
    if(root.visible===visible)continue;
    const model=root.userData.pickupModel;
    const material=root.userData.pickupSocketMaterial;
    gsap.killTweensOf(model.position);
    gsap.killTweensOf(model.scale);
    gsap.killTweensOf(material);
    root.visible=visible;
    if(root.userData.pickupRetainer)
     root.userData.pickupRetainer.visible=visible;
    model.position.z=0;
    model.scale.setScalar(1);
    // A faint, steady rim remains while the discovered object is awaiting
    // collection. This never points at undiscovered puzzle targets.
    material.emissiveIntensity=visible?.14:0;
    if(visible&&!firstState){
     revealCount++;
     if(!reducedMotion){
      // A short rise from the real socket, not a floating 2D reward popup.
      // The cradle and hit target never move, keeping pointer selection
      // reliable even on slow phones and software WebGL.
      model.position.z=-.105;
      model.scale.setScalar(.66);
      material.emissiveIntensity=.72;
      gsap.to(model.position,{z:0,duration:.54,ease:"back.out(1.3)",onUpdate:invalidate});
      gsap.to(model.scale,{x:1,y:1,z:1,duration:.54,
       ease:"back.out(1.45)",onUpdate:invalidate});
      gsap.to(material,{emissiveIntensity:.14,duration:1.1,
       ease:"power2.out",onUpdate:invalidate});
     }
    }
    invalidate();
   }
   for(const [source,{group}] of trays){
    const active=[...instances].some(([id,root])=>
     sources[id][0]===source&&root.visible);
    if(group.visible!==active){group.visible=active;invalidate();}
   }
   firstState=false;
  }
 };
}
