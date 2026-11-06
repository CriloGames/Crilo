import * as THREE from "three";
import {gsap} from "gsap";
import {batchStaticGeometry} from "./secrets-3d-batching.js?v=2";

// All of these are genuine, individually lit 3D meshes, not CSS overlays.
// All coordinates below are local to their own solid cube face.
export function buildIntricateCube({
  cube, faces, front, side, lidPivot, topHole,
  box, cylinder, label, setHit, mat, animate, materials,
  liveGame=false
}) {
  const {frontFace,rightFace,leftFace,topFace,bottomFace,backFace}=faces;
  const {brass,metal,darkMetal,ivory,cavityMaterial,rubber}=materials;
  const satin=mat(0x806e7c,.52,.4),steel=mat(0x88929c,.72,.27);
  const gold=mat(0xf2d5a1,.57,.24),pearl=mat(0xfff2da,.08,.27);
  const verdigris=mat(0x80b1a9,.43,.39),ebony=mat(0x343d48,.14,.5);
  const copper=mat(0xc88c7a,.57,.33),glass=mat(0x8fbfca,.16,.13);
  glass.transparent=true;glass.opacity=.89;glass.clearcoat=1;
  const felt=mat(0x705d7a,.03,.91),gearMetal=mat(0xae9172,.8,.3);
  const enamelTrim=mat(0xe6dac7,.24,.35);
  const live={dialSteps:0,needle:false,lever:false,light:false,topLatch:false,backEye:false,underside:false,service:false};
  const registries={};
  const nameplates=[];
  const faceName=face=>[
   ["frontFace",frontFace],["backFace",backFace],
   ["leftFace",leftFace],["rightFace",rightFace],
   ["topFace",topFace],["bottomFace",bottomFace]
  ].find(([,root])=>face===root)?.[0]||null;
  let detailsCount=0;
  const authoredMeshes=[];
  // Small machined features receive normal PBR lighting but do not each
  // cast a 1024px shadow. Larger structural pieces retain genuine shadows.
  // This removes hundreds of redundant shadow draw calls on mobile hardware.
  const B=(parent,w,h,d,x,y,z,m,r=.024)=>{
    detailsCount++;
    const mesh=box(parent,w,h,d,x,y,z,m,r);
    mesh.castShadow=w>.48&&h>.38&&d>.10;
    authoredMeshes.push(mesh);
    return mesh;
  };
  const C=(parent,r,d,x,y,z,m)=>{
    detailsCount++;
    const mesh=cylinder(parent,r,d,x,y,z,m);
    mesh.castShadow=r>.35&&d>.09;
    authoredMeshes.push(mesh);
    return mesh;
  };
  const ring=(parent,r,t,x,y,z,m)=>{
    const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,10,60),m);
    o.position.set(x,y,z);o.castShadow=false;o.receiveShadow=true;
    parent.add(o);detailsCount++;authoredMeshes.push(o);return o;
  };
  const flatLine=(parent,x1,y1,x2,y2,z,width,m)=>{
    const dx=x2-x1,dy=y2-y1;
    const o=B(parent,Math.hypot(dx,dy),width,.022,(x1+x2)/2,(y1+y2)/2,z,m,.008);
    o.rotation.z=Math.atan2(dy,dx);return o;
  };
  const group=(face,x=0,y=0,z=0)=>{
    const g=new THREE.Group();g.position.set(x,y,z);face.add(g);return g;
  };
  // Nameplates are deliberately absent. Hover/keyboard focus identifies
  // hardware, while real cipher and numeric input plates remain elsewhere.
  const rivet=(face,x,y,z=.15)=>{
    // Actual shank behind the rivet joins the raised trim rail. Previously
    // its head began beyond the panel and looked like a loose gold stud.
    C(face,.030,.114,x,y,z-.057,steel);
    C(face,.046,.031,x,y,z,metal);
    B(face,.047,.008,.01,x,y,z+.022,ebony,.003);
  };
  const plates=(face,m)=>{
    // Inner panel is a real raised physical layer with corner detailing.
    for(const sy of [-1,1]){
      B(face,2.85,.055,.07,0,sy*1.38,.10,m,.016);
      for(const sx of [-1,1]){
        // The integrated iris service cassette occupies this corner.
        // Avoid an orphaned shell rivet running through its backplate.
        if(face===backFace&&sx>0&&sy<0)continue;
        // Front corner screws are real removable hardware; a second
        // decorative rivet in the same hole made both shapes collide.
        if(face===frontFace)continue;
        // The right-hand service bolt occupies this upper corner.
        if(face===rightFace&&sx>0&&sy>0)continue;
        rivet(face,sx*1.31,sy*1.33,.16);
      }
    }
    for(const sx of [-1,1])B(face,.055,2.63,.07,sx*1.39,0,.10,m,.018);
  };
  const vent=(face,x,y,w=.65,n=5,m=ebony)=>{
    const frame=group(face,x,y,.16);
    B(frame,w+.12,.22,.08,0,0,0,metal,.022);
    B(frame,w,.15,.07,0,0,.052,m,.02);
    for(let i=0;i<n;i++){
      const xx=(i-(n-1)/2)*((w-.10)/n);
      B(frame,.033,.116,.025,xx,0,.102,steel,.004);
    }
    return frame;
  };
  const gear=(face,x,y,z,r,m=gearMetal,teeth=11)=>{
    const g=group(face,x,y,z);
    C(g,r*.79,.06,0,0,0,m);ring(g,r*.70,r*.075,0,0,.045,brass);
    for(let i=0;i<teeth;i++){
      const a=i*2*Math.PI/teeth, obj=B(g,r*.30,r*.13,.07,Math.cos(a)*r*.81,Math.sin(a)*r*.81,.008,m,.009);
      obj.rotation.z=a;
    }
    C(g,r*.21,.085,0,0,.072,steel);
    return g;
  };
  const raisedScrew=(g,x,y,z=.22)=>{
    C(g,.045,.034,x,y,z,brass);
    const slot=B(g,.055,.010,.015,x,y,z+.026,ebony,.003);
    slot.rotation.z=.38;
  };
  const edgeTicks=(face,cx,cy,r,count=20)=>{
    for(let i=0;i<count;i++){
      const a=2*Math.PI*i/count;
      const w=(i%5===0)?.105:.055;
      const tick=B(face,w,.014,.018,cx+Math.cos(a)*r,cy+Math.sin(a)*r,.20,metal,.003);
      tick.rotation.z=a;
    }
  };

  // FRONT: nested cast bezel, lens, stamped numbers, iris blades, detents.
  plates(frontFace,metal);
  const frontDisc=group(frontFace,0,.56,.13);
  C(frontDisc,.54,.10,0,0,0,metal);
  C(frontDisc,.45,.105,0,0,.08,pearl);
  ring(frontDisc,.50,.035,0,0,.138,brass);
  ring(frontDisc,.37,.040,0,0,.172,darkMetal);
  const optic=C(frontDisc,.29,.06,0,0,.20,glass);
  const irisBlades=[];
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const blade=B(frontDisc,.15,.032,.023,Math.cos(a)*.20,Math.sin(a)*.20,.253,satin,.008);
    blade.rotation.z=a+.47;blade.userData.noBatch=true;irisBlades.push(blade);
  }
  C(frontDisc,.07,.045,.062,-.03,.276,ebony);
  edgeTicks(frontFace,0,.56,.66,28);
  // The actual serial control is the only nameplate; a second stamped
  // label above the large lens intersected the lens rim and its touch zone.
  // The physical front already has a working LATCH at (-1.05,.11)
  // and RED button at (1.10,.15). Additional decorative circular switches
  // were occupying those exact hit targets. Keep logical animation anchors
  // but do not render duplicate knobs over real puzzle controls.
  const frontKnob=group(frontFace,-.95,.26,.16);
  registries.optic=frontKnob;
  const statusLight=group(frontFace,1.06,.20,.09);
  const bulb=C(statusLight,.03,.018,0,0,0,ebony);
  bulb.userData.noBatch=true;registries.bulb=bulb;
  // The real LATCH and RED identification plaques occupy this belt.
  // Two extra cosmetic grilles were cutting through those plate edges.

  // One real gauge, directly behind its working pressure switch on the
  // left face. The former oversized right-hand dial was disconnected
  // from the button and its tuning-fork output bracket.
  plates(rightFace,verdigris);
  const meter=group(leftFace,.88,.64,.111);
  // Deliberately recessed under the working brass actuator; only the
  // needle's outer tip emerges from the central control.
  C(meter,.312,.032,0,0,0,darkMetal);
  C(meter,.280,.030,0,0,.027,gold);
  C(meter,.249,.018,0,0,.051,pearl);
  ring(meter,.283,.015,0,0,.071,brass);
  for(let i=0;i<12;i++){
    const a=-Math.PI*.85+i*(Math.PI*1.7/11);
    const mark=B(meter,i%3===0?.058:.033,.009,.009,
      Math.cos(a)*.220,Math.sin(a)*.220,.083,darkMetal,.002);
    mark.rotation.z=a;
  }
  const needle=group(meter,0,0,.093);
  const arrow=B(needle,.205,.014,.009,-.123,0,0,copper,.003);
  arrow.rotation.z=.08;
  C(needle,.024,.014,0,0,.008,metal);
  needle.rotation.z=-.5;
  // The hotspot's button is the ONLY hit target: no phantom dial clicks.
  registries.needle=needle;
  // The revealed door is now mounted on this upper-left section.
  // Decorative pipes and three ornamental rivets previously ran straight
  // through the physical door frame. No working plumbing is removed.
  // The old right-hand lever teleported actions to the unrelated left
  // dent/mouse puzzle. Keep its demo animation only: it should not appear
  // as a phantom working control on the actual 60-secret cube.
  let arm=null;
  if(!liveGame){
    const lever=group(rightFace,-.99,-1.06,.16);
    B(lever,.48,.43,.12,0,0,0,metal,.045);
    arm=B(lever,.11,.29,.11,0,0,.13,steel,.04);
    B(lever,.24,.09,.13,0,.17,.21,ebony,.025);
    setHit(lever,"lever");
  }
  registries.lever=arm;
  // The vent order must be discovered behind the service bolt, not printed
  // The real SERVICE engraving is already stamped next to the shutter.
  // A second SERVICE · ACCESS label ran across this rail, adding clutter
  // and nearly touching the real engraved plate. One clear label suffices.
  // No fake upper-right vent: it occupied the service-bolt socket.

  // LEFT: an integrated pressure dial, vent keys, and clockwork gears.
  plates(leftFace,copper);
  // A compact service inscription sits between the top bolt and numbered
  // keys; the former full-width sign overlapped switch 1's number plate.

  // Large machined labyrinth with a physically meshed auxiliary drive.
  // The previous 0.31-radius wheel made thirty tiny scratches unreadable;
  // this is enlarged but stays inside the vent keys and dial's own space.
  const wheelA=gear(leftFace,-.18,0,.19,.405,gearMetal,15);
  const wheelB=gear(leftFace,.28,-.38,.19,.235,steel,9);
  registries.wheelA=wheelA;registries.wheelB=wheelB;
  // A dense radial clockwork labyrinth: concentric passages, radial
  // crossovers, thirty playable positions, and five real blind corridors.
  // All corridors are physically connected. The very last segment reaches
  // a genuine OPEN socket at the center of the wheel, not a painted goal
  // that traps the screw before it can exit.

  const gearMazeDirections=[
   1,1,1,1,-1,-1,-1,-1,-1,1,1,1,1,1,-1,-1,-1,-1,-1,
   1,1,1,1,1,-1,-1,-1,-1,-1
  ];

  // Fixed machined grid, NOT another concentric ring diagram. Turning the
  // real paired gears drives a captive pin through connected square lanes.
  const mazeRouteCells=[0,9,18,19,28,37,36,45,54,63,64,73,74,75,66,57,48,39,30,21,22,31,40];
  const mazePassages="0-1 0-9 1-10 2-11 3-4 3-12 4-5 5-6 6-7 6-15 7-8 7-16 8-17 9-10 9-18 11-12 12-13 13-14 13-22 14-15 14-23 15-24 16-25 17-26 18-19 19-20 19-28 20-29 21-22 21-30 22-31 23-24 23-32 24-33 25-34 26-35 27-28 28-37 29-38 30-39 31-32 31-40 33-34 35-44 36-37 36-45 37-38 38-47 39-48 40-41 40-49 41-42 42-43 42-51 44-53 45-46 45-54 46-47 46-55 48-57 49-50 50-59 51-52 51-60 52-61 53-62 54-55 54-63 56-57 56-65 57-66 58-59 58-67 59-68 60-69 61-70 62-71 63-64 64-73 65-66 66-75 67-76 68-69 69-78 70-79 71-80 72-73 73-74 74-75 76-77 77-78 78-79 79-80".split(" ").map(e=>e.split("-").map(Number));
  const mazeOrigin=0,mazeGoal=40,mazeSide=9,mazePitch=.056;
  const mazePlate=group(leftFace,-.18,0,.19);
  const edgeKey=(a,b)=>Math.min(a,b)+":"+Math.max(a,b);
  const mazeGraph=new Map(),mazeEdgeCurves=new Map(),openEdges=new Set();
  const mazeCellPoint=cell=>new THREE.Vector3(
    (cell%9-4)*mazePitch,(4-Math.floor(cell/9))*mazePitch,.156);
  for(const [a,b] of mazePassages){
    if(a<0||b>80||!(b-a===9||
      (Math.floor(a/9)===Math.floor(b/9)&&b-a===1)))
      throw Error("Maze corridor crosses solid material");
    const key=edgeKey(a,b);
    if(openEdges.has(key))throw Error("Duplicate maze channel");
    openEdges.add(key);
    if(!mazeGraph.has(a))mazeGraph.set(a,new Set());
    if(!mazeGraph.has(b))mazeGraph.set(b,new Set());
    mazeGraph.get(a).add(b);mazeGraph.get(b).add(a);
    mazeEdgeCurves.set(key,new THREE.LineCurve3(mazeCellPoint(a),mazeCellPoint(b)));
  }
  if(mazeGraph.size!==81||openEdges.size!==93)throw Error("Invalid maze layout");
  const gearMazePoints=mazeRouteCells.map(mazeCellPoint);
  const grooveSegments=mazeRouteCells.slice(1).map((c,i)=>
    mazeEdgeCurves.get(edgeKey(mazeRouteCells[i],c)));
  const startPoint=gearMazePoints[0],finishPoint=gearMazePoints.at(-1);
  const mazeInset=mat(0x212a32,.35,.43);
  const mazeWalls=mat(0xf0e3cc,.43,.22);
  const mazeAccent=mat(0xb89967,.45,.30);
  const goalMetal=mat(0xf0c582,.35,.21);
  const goalLit=mat(0xffdea2,.3,.18);
  goalLit.emissive.setHex(0x9a6122);goalLit.emissiveIntensity=.95;
  // Four retained bearing posts bridge the fixed labyrinth plate to the
  // moving gear below. Seen from the side there is no unsupported floating
  // slab, while the toothed drive rim can still rotate beneath the plate.
  for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4])
    C(mazePlate,.018,.083,Math.cos(a)*.295,Math.sin(a)*.295,.074,steel);
  // Square floor recessed into a genuine circular gear carrier; the relief
  // walls are separate solid 3D metal ribs with real open intersections.
  C(mazePlate,.363,.034,0,0,.113,darkMetal);
  C(mazePlate,.358,.018,0,0,.143,ivory);
  B(mazePlate,.510,.510,.014,0,0,.152,mazeInset,.006);
  ring(mazePlate,.373,.008,0,0,.131,steel);
  ring(mazePlate,.386,.005,0,0,.124,mazeAccent);
  const boundary=9*mazePitch/2;
  let mazeWallCount=0;
  function wall(x,y,w,h){
    const m=B(mazePlate,w,h,.024,x,y,.169,mazeWalls,.001);
    m.castShadow=false;mazeWallCount++;
  }
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const cell=r*9+c,x=(c-4)*mazePitch,y=(4-r)*mazePitch;
    if(c<8&&!openEdges.has(edgeKey(cell,cell+1)))
      wall(x+mazePitch/2,y,.009,mazePitch-.002);
    if(r<8&&!openEdges.has(edgeKey(cell,cell+9)))
      wall(x,y-mazePitch/2,mazePitch-.002,.009);
    if(r===0&&c!==0)wall(x,boundary,mazePitch-.002,.009);
    if(r===8)wall(x,-boundary,mazePitch-.002,.009);
    if(c===0)wall(-boundary,y,.009,mazePitch-.002);
    if(c===8)wall(boundary,y,.009,mazePitch-.002);
  }
  // The only perimeter notch is the start; the center is a real open
  // receiving socket. Neither location reveals the correct route.
  const mazeEntryArrow=new THREE.Shape();
  mazeEntryArrow.moveTo(-.009,0);mazeEntryArrow.lineTo(.009,0);
  mazeEntryArrow.lineTo(0,-.014);mazeEntryArrow.closePath();
  const startMark=new THREE.Mesh(new THREE.ShapeGeometry(mazeEntryArrow),goalMetal);
  startMark.position.set(startPoint.x,boundary+.006,.178);
  mazePlate.add(startMark);detailsCount++;
  C(mazePlate,.018,.007,0,0,.154,ebony);
  const goalSocket=ring(mazePlate,.024,.003,0,0,.167,goalMetal);
  // Improve the small drive gear: a visible center spindle, four radial
  // machined spokes and a dark knurled grip. It remains one clickable gear.
  C(wheelB,.163,.027,0,0,.107,darkMetal);
  C(wheelB,.128,.021,0,0,.128,steel);
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2;
   const spoke=B(wheelB,.125,.024,.024,Math.cos(a)*.083,
    Math.sin(a)*.083,.149,brass,.006);
   spoke.rotation.z=a;
  }
  ring(wheelB,.150,.012,0,0,.155,brass);
  C(wheelB,.061,.032,0,0,.166,darkMetal);
  C(wheelB,.034,.021,0,0,.189,steel);
  const centerSlot=B(wheelB,.041,.007,.006,0,0,.203,ebony,.003);
  centerSlot.rotation.z=.43;

  // Four halves of the ACTUAL wheel surfaces, with no detachable button pad.
  const wheelContacts=new Map();
  const touchMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,
    colorWrite:false,depthWrite:false,side:THREE.DoubleSide});
  const half=(parent,name,inner,outer,start,z,x,y)=>{
    // The touch geometry remains on the gear while its target origin is
    // centered on the ACTUAL clickable metal sector, not the empty hole.
    const target=group(parent,x,y,0);
    const obj=new THREE.Mesh(new THREE.RingGeometry(
      inner,outer,32,1,start,Math.PI),touchMat);
    obj.position.set(-x,-y,z);target.add(obj);
    wheelContacts.set(name,target);
  };
  half(mazePlate,"maze-left",.359,.439,Math.PI/2,.214,-.395,0);
  half(mazePlate,"maze-right",.359,.439,-Math.PI/2,.214,.395,0);
  const smallTouchFace=group(leftFace,wheelB.position.x,
    wheelB.position.y,wheelB.position.z);
  half(smallTouchFace,"maze-up",.043,.199,0,.238,0,.131);
  half(smallTouchFace,"maze-down",.043,.199,Math.PI,.238,0,-.131);
  // Very small etched chevrons on the existing rims, not raised controls.
  for(const sign of [-1,1]){
    const m=group(mazePlate,sign*.397,0,.173);
    for(const d of [-1,1])
      flatLine(m,-sign*.006,d*.010,sign*.005,0,.001,.003,mazeAccent);
    const n=group(smallTouchFace,0,sign*.183,.223);
    for(const d of [-1,1])
      flatLine(n,d*.009,0,0,sign*.011,.001,.003,mazeAccent);
  }
  const follower=new THREE.Group();mazePlate.add(follower);
  follower.position.copy(startPoint);follower.position.z=.207;
  const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};
  let mazeLastProgress=0;
  const mazeTravelPoint=()=>{
    if(mazeTravel.from===mazeTravel.to)return mazeCellPoint(mazeTravel.to);
    const curve=mazeEdgeCurves.get(edgeKey(mazeTravel.from,mazeTravel.to));
    if(!curve)throw Error("The maze pin attempted to cross a wall");
    return curve.getPoint(mazeTravel.from<mazeTravel.to?
      mazeTravel.t:1-mazeTravel.t);
  };
  function seatFollower(){
    const p=mazeTravelPoint();follower.position.x=p.x;follower.position.y=p.y;
  }
  function legacyMazeCell(state){
    const i=Math.max(0,Math.min(29,Number(state.gearMazeIndex)||0));
    return mazeRouteCells[Math.round(i/29*(mazeRouteCells.length-1))];
  }
  C(follower,.010,.043,0,0,-.012,steel);
  const captiveBall=new THREE.Mesh(new THREE.SphereGeometry(.015,16,12),gold);
  captiveBall.position.z=.012;follower.add(captiveBall);detailsCount++;
  // A cam beneath the rotating labyrinth wheel drives an enclosed
  // mechanical linkage to the pressure dial. Earlier this was one thin
  // floating black stick, with a random stud halfway along it, suspended
  // OVER the maze. Keep the long rail BELOW the wheel face; it emerges
  // only outside the wheel rim. Structural bridge plates and axles secure
  // both ends of the actual linkage to the cube.
  const gearRailEntry={x:-.18,y:0,z:.346};
  const upperPivot={x:.22,y:.47};
  const latchPivot={x:.54,y:.66};
  // Fixed graphite guide behind the rotating disk; brass sliding rod
  // runs in its center and is visually retained by the side rails.
  flatLine(leftFace,gearRailEntry.x,gearRailEntry.y,
   upperPivot.x,upperPivot.y,.108,.083,darkMetal);
  flatLine(leftFace,gearRailEntry.x,gearRailEntry.y,
   upperPivot.x,upperPivot.y,.122,.024,brass);
  // A lower steel guide connects the transfer axle to the calibrated dial.
  flatLine(leftFace,upperPivot.x,upperPivot.y,
   latchPivot.x,latchPivot.y,.153,.092,darkMetal);
  flatLine(leftFace,upperPivot.x,upperPivot.y,
   latchPivot.x,latchPivot.y,.174,.030,steel);
  // Separate steel mounting plates and two fasteners keep the coupler
  // anchored. The axle joins both guide heights; no unmounted gold dots.
  for(const [x,y] of [[upperPivot.x,upperPivot.y],[.46,.612]]){
   B(leftFace,.127,.104,.040,x,y,.144,steel,.022);
   for(const offset of [-.039,.039]){
    C(leftFace,.014,.023,x+offset,y,.174,brass);
    B(leftFace,.016,.004,.007,x+offset,y,.192,ebony,.002);
   }
  }
  C(leftFace,.034,.109,upperPivot.x,upperPivot.y,.211,darkMetal);
  C(leftFace,.028,.078,upperPivot.x,upperPivot.y,.249,steel);
  C(leftFace,.047,.024,upperPivot.x,upperPivot.y,.303,brass);
  C(leftFace,.025,.024,latchPivot.x,latchPivot.y,.180,steel);
  const dialCatch=group(leftFace,.54,.66,.164);
  B(dialCatch,.175,.078,.039,0,0,0,steel,.009);
  const dialTongue=B(dialCatch,.101,.042,.040,.093,0,.025,brass,.006);
  for(const x of [-.054,.054])C(dialCatch,.013,.016,x,0,.030,gold);
  if(liveGame){
    setHit(mazePlate,"gear-large");
    for(const [name,part] of wheelContacts)setHit(part,name);
    setHit(wheelA,"gear-large");setHit(wheelB,"gear-small");
  }
  registries.gearMaze={follower,points:gearMazePoints,dialTongue,
    directions:gearMazeDirections,wheelA,wheelB};
  // Omit four cosmetic grille bars: they resembled the real numbered vents
  // and crowded the nearby hinged mechanisms.
  // Likewise, a lever drawn here used to activate the right-hand service
  // shutter remotely. That duplicate control had no physical linkage.
  let latchHandle=null;
  if(!liveGame){
    const latch=group(leftFace,.98,-1.05,.18);
    B(latch,.26,.55,.13,0,0,.04,metal,.035);
    latchHandle=B(latch,.18,.12,.18,0,.10,.17,ivory,.035);
    setHit(latch,"service-latch");
  }
  registries.latchHandle=latchHandle;

  // BACK: a single shaped optical cassette replaces the former circular
  // bullseye lens, redundant engraved tick ring and crowded rim screws.
  // The mechanical almond eye is constructed in the hotspot module at the
  // exact same center, and the lower code now has its own isolated socket.
  plates(backFace,verdigris);
  const eyeHousing=group(backFace,0,-.18,.095);
  B(eyeHousing,1.76,1.01,.060,0,0,0,darkMetal,.115);
  B(eyeHousing,1.68,.93,.028,0,0,.046,verdigris,.095);
  for(const x of [-.80,.80])for(const y of [-.39,.39])
    raisedScrew(eyeHousing,x,y,.068);
  // A low-profile backing collar for the ONE real iris control. The old
  // oversized raised clock-shaped dial duplicated the touch target and
  // physically overlapped its grille and label. This slim bezel sits UNDER
  // the actuator in the physical hotspot module; it has no second hit target.
  // The actual iris actuator already has its own captive rim. The second
  // dark rotating disc was co-planar with it and visually swallowed the knob.
  // Retain a transform group for legacy animation, but no duplicate mesh.
  const backKnob=group(backFace,1.055,-1.30,.139);
  registries.backKnob=backKnob;
  // Leave the bottom-center rail unobstructed. The revealed 2 · 1 · 3
  // clue slides into this space after the eye is pressed; it must never
  // be covered by a permanent "I SEE YOU" plaque.

  // TOP: telescopic hinge barrel, lid brackets, engraved hatch, gears below.
  plates(topFace,brass);
  // The working flute now occupies the left half of this stationary rail.
  // Move the purely identifying plate to the right so neither piece
  // masks the other (standalone demonstrator keeps its centered plate).

  // The live game has THREE functional hinge pins on this exact rail.
  // Five ornamental pins intersected them and concealed the working tips.
  if(!liveGame)for(const x of [-.64,-.29,.06,.41,.65]){
    const riv=C(topFace,.060,.06,x,topHole.h/2,.21,steel);
    riv.rotation.z=Math.PI/2;
  }
  for(const x of [-.55,.55]){
    B(lidPivot,.19,.19,.10,x,-.21,.14,metal,.03);
    raisedScrew(lidPivot,x,-.21,.20);
    B(lidPivot,.18,.13,.06,x,-.95,.13,brass,.02);
  }
  B(lidPivot,1.22,.06,.06,0,-1.04,.13,metal,.02);
  // The moving lid already contains its own working triangle catch.
  // A SECOND independent latch on the fixed frame used to open the same
  // hatch without moving the triangle. Omit that misleading shortcut in
  // the playable cube, retaining tactile controls in the standalone demo.
  let tooth=null;
  if(!liveGame){
   const latchTop=group(topFace,0,-topHole.h/2-.16,.18);
   B(latchTop,.44,.17,.11,0,0,0,metal,.025);
   tooth=B(latchTop,.17,.12,.13,0,0,.09,ivory,.02);
   setHit(latchTop,"hatch-latch");
  }
  registries.tooth=tooth;
  for(const x of [-.24,.32]){
    gear(topFace,x,.12,-.51,.14,gearMetal,9);
  }

  // BOTTOM: actual shock-absorbing feet and circular lockwork.
  plates(bottomFace,satin);
  for(const x of [-1,1])for(const y of [-1,1]){
    // The upper-left foot is a REAL sliding puzzle catch, authored in the
    // hotspot layer. A fourth fixed rubber foot here covered the hidden
    // musical inscription and physically merged with the live control.
    if(x===-1&&y===1)continue;
    const foot=group(bottomFace,x*1.08,y*1.08,.16);
    C(foot,.205,.13,0,0,.035,rubber);
    C(foot,.128,.019,0,0,.111,darkMetal);
    // Three flush, NONINTERACTIVE support feet need no movable screwheads.
    const inset=C(foot,.038,.011,0,0,.124,metal);
    inset.castShadow=false;
  }
  // This is the engraved STATIONARY FACE of the underside mechanism.
  // The earlier thick central brass hub reached z=.41, physically hiding
  // the live button below it. Recess the face and leave a true open central
  // socket: the functional smaller actuator now sits ABOVE every layer.
  const baseDial=group(bottomFace,0,0,.11);
  C(baseDial,.67,.085,0,0,0,metal);
  C(baseDial,.53,.085,0,0,.055,satin);
  ring(baseDial,.60,.026,0,0,.115,brass);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    flatLine(baseDial,Math.cos(a)*.28,Math.sin(a)*.28,
     Math.cos(a)*.46,Math.sin(a)*.46,.133,.023,ivory);
  }
  ring(baseDial,.275,.014,0,0,.15,gold);
  // In the standalone demo, this visual dial is the only mechanism.
  // The live game instead has its own genuinely clickable center button.
  if(!liveGame){
    C(baseDial,.135,.043,0,0,.174,gold);
    setHit(baseDial,"underside");
  }
  registries.baseDial=baseDial;
  // The lower central plate is a functioning bell-return chute. A large
  // "NOTHING BELOW" nameplate was installed directly UNDER its brass hatch:
  // the hatch covered the middle of the words and the caption contradicted
  // the real items on this face. Keep the output completely unobstructed.

  // Drawer interiors: fitted lining, runners and articulated possessions.
  for(const [obj,name] of [[front,"LAVENDER"],[side,"TEAL"]]){
    const g=obj.drawer;
    B(g,1.04,.031,.50,0,-.272,-.26,felt,.01);
    for(const x of [-.43,.43]){
      B(g,.041,.32,.54,x,-.11,-.26,metal,.01);
      // Captive guide shoes are mounted directly on the continuous rail
      // rather than existing as independent brass cubes beyond its face.
      for(const z of [-.47,-.26,-.05])
       B(g,.068,.07,.060,x,-.11,z,steel,.01);
    }
    for(const x of [-.27,.27])B(g,.07,.25,.034,x,-.11,-.57,ivory,.012);
    // Real captured telescoping slides. The previous .63/.66-long bars
    // separated by a visible .08 gap when the tray reached z=.60.
    // A .94 moving tongue and .88 fixed sleeve remain interlocked through
    // the full stroke, and the fixed sleeve meets its cavity sidewall.
    for(const x of [-.59,.59]){
      B(g,.046,.051,.94,x,-.04,-.28,darkMetal,.011);
      B(obj.cavity,.101,.061,.88,x*1.035,-.04,-.42,metal,.011);
      // Small rolling guide is a captive part OF the moving tray, not
      // an independent hovering stud inside its opened socket.
      B(g,.063,.063,.064,x,-.04,-.56,steel,.011);
    }
    B(g,.22,.035,.08,0,.22,.28,metal,.009);
    B(g,.10,.052,.10,0,.22,.335,ivory,.015);

  }
  // Original key and thread spool are already complete meshes in the base
  // model, with the actual selectable pickup action attached. The previous
  // "detail pass" sculpted a SECOND key at the exact same coordinates and
  // seven torus rings through the original spool. Those overlapping copies
  // caused z-fighting and visually muddied the real items. Never duplicate
  // them; the actual collectible geometry is the one source of truth.

  // Physical scratch marks, satin brushed blocks and index screws at the edge
  // of each panel. These are all visible from rotating the scene.
  // Six copies of these raised marks ran straight through the live
  // miniature shelves (bag, clock, elevator and rear displays). They are
  // workbench texture samples, not actual puzzle hardware.
  if(!liveGame)for(const f of [frontFace,leftFace,rightFace,topFace,bottomFace,backFace]){
    for(const y of [-1.08,-.97]){
      B(f,.34,.015,.010,-1.00,y,.105,ivory,.003);
    }
    for(const x of [-1.15,1.15])for(const y of [-.78,.78]){
      B(f,.08,.017,.019,x,y,.105,gold,.003);
    }
  }

  // The original sixty-secret state is authoritative in the live game.
  // Mirror its poses into the real moving hardware, never grant rewards here.
  const restoredBulbMaterial=bulb.material;
  const activeBulbMaterial=restoredBulbMaterial.clone();
  activeBulbMaterial.color.setHex(0xb0dba6);
  activeBulbMaterial.emissive.setHex(0x55a875);
  activeBulbMaterial.emissiveIntensity=.9;
  function syncGameState(state,instant=false){
    const s=state||{};
    const pose=(obj,axis,key,value)=>{
      if(instant){obj[axis][key]=value;return;}
      if(Math.abs(obj[axis][key]-value)>.01)animate(obj[axis],{[key]:value},.48);
    };
    const steps=Math.min(3,Math.max(0,s.eyeRingTicks||0));
    const pressure=Math.min(3,Math.max(0,s.pressureTicks||0));
    live.dialSteps=steps;
    live.needle=pressure>0;
    live.lever=!!s.mouse;
    live.service=!!s.serviceOpen;
    live.backEye=!!s.back;
    live.underside=!!s.bottom;
    live.topLatch=!!s.top;
    live.light=steps===3;
    pose(frontKnob,"rotation","z",steps*.5);
    irisBlades.forEach((blade,i)=>pose(blade,"rotation","z",i*Math.PI/4+.47+steps*.16));
    pose(needle,"rotation","z",-.5+pressure*(1.75/3));
    // Neither wheel spins magically when the vent grille opens. Only an
    // actual gear press turns the pair, with their tooth radii in ratio.
    const turns=Math.max(-720,Math.min(720,Number(s.gearMazeTurns)||0));
    const gearRotation=-turns*Math.PI/12;
    pose(wheelA,"rotation","z",gearRotation);
    pose(wheelB,"rotation","z",-gearRotation*(.405/.235));
    const cell=Number.isInteger(s.gearMazeCell)&&
     mazeGraph.has(s.gearMazeCell)?s.gearMazeCell:legacyMazeCell(s);
    mazeLastProgress=Math.max(0,Math.min(gearMazeDirections.length,
     Number(s.gearMazeIndex)||0));
    if(instant){
     gsap.killTweensOf(mazeTravel);
     mazeTravel.from=cell;mazeTravel.to=cell;mazeTravel.t=1;
     seatFollower();
    }else if(cell!==mazeTravel.to){
     gsap.killTweensOf(mazeTravel);
     const from=mazeTravel.to;
     if(mazeGraph.get(from)?.has(cell)){
      mazeTravel.from=from;mazeTravel.to=cell;mazeTravel.t=0;
      seatFollower();
      gsap.to(mazeTravel,{t:1,duration:.26,ease:"power2.inOut",
       onUpdate:seatFollower,onComplete:seatFollower});
     }else{
      // Saved games from an older version may identify a different
      // milestone. Restore directly; never animate through solid brass.
      mazeTravel.from=cell;mazeTravel.to=cell;mazeTravel.t=1;
      seatFollower();
     }
    }else seatFollower();
    // At the end the captive screw backs OUT of its channel. Simultaneously
    // the adjacent lock tongue withdraws from the calibration dial.
    // Seat the pin DOWN into the central receiving pocket when solved;
    // the previous animation lifted it off the wheel as though escaping
    // through an invisible roof.
    pose(follower,"position","z",s.gearMazeSolved?.186:.207);
    goalSocket.material=s.gearMazeSolved?goalLit:goalMetal;
    pose(dialTongue,"position","x",s.gearMazeSolved?-.015:.093);
    if(arm)pose(arm,"rotation","x",s.mouse?-.46:0);
    if(latchHandle)pose(latchHandle,"position","y",s.serviceOpen?-.12:.10);
    pose(backKnob,"rotation","z",s.back?Math.PI/2:0);
    pose(baseDial,"rotation","z",s.bottom?Math.PI/3:0);
    if(tooth)pose(tooth,"position","z",s.top?-.06:.09);
    bulb.material=live.light?activeBulbMaterial:restoredBulbMaterial;
    // The original pickup geometries independently disappear upon
    // collection. This detailing module contains no shadow duplicates.
  }

  const labels={
    optic:"An adjustable iris clicks beneath its brass bezel.",
    pressure:"The real pressure needle advances across its dial.",
    lever:"The nickel toggle engages a hidden cam.",
    latch:"The left-hand service latch shifts on its hinge.",
    eye:"The optical collar moves by one calibration mark.",
    underside:"The underside lock turns with a heavy metallic click.",
    "hatch-latch":"The hatch catch retracts from its machined slot."
  };
  function operate(action){
    switch(action){
      case "optic":
        live.dialSteps=(live.dialSteps+1)%9;
        animate(frontKnob.rotation,{z:live.dialSteps*.5},.48);
        for(const blade of irisBlades)animate(blade.rotation,{z:blade.rotation.z+.16},.65);
        if(live.dialSteps===3){live.light=true;registries.bulb.material=mat(0xb0dba6,.1,.2);
          registries.bulb.material.emissive=new THREE.Color(0x55a875);
          registries.bulb.material.emissiveIntensity=.9;}
        break;
      case "pressure": live.needle=!live.needle;animate(needle.rotation,{z:live.needle?1.25:-.50},.75);break;
      case "lever": live.lever=!live.lever;animate(arm.rotation,{x:live.lever?-.46:0},.5);break;
      case "latch":live.service=!live.service;animate(latchHandle.position,{y:live.service?-.12:.10},.5);break;
      case "eye":live.backEye=!live.backEye;animate(backKnob.rotation,{z:live.backEye?Math.PI/2:0},.65);break;
      case "underside":live.underside=!live.underside;animate(baseDial.rotation,{z:live.underside?Math.PI/3:0},.8);break;
      case "hatch-latch":live.topLatch=!live.topLatch;animate(tooth.position,{z:live.topLatch?-.06:.09},.43);break;
      default:return null;
    }
    return labels[action];
  }
  const batching=batchStaticGeometry(cube,authoredMeshes,{
    dynamicRoots:[front.drawer,side.drawer,lidPivot,wheelA,wheelB,needle],
    protectedMeshes:[bulb,...irisBlades],
    label:"precision"
  });
  return {
    meshCount:()=>detailsCount,
    batching,
    actions:Object.keys(labels),
    getState:()=>({...live}),
    syncGameState,
    getNameplates:()=>nameplates.map(n=>({...n})),
    getGearMazeTargets:()=>({
      large:mazePlate,small:wheelB,
      directional:new Map(wheelContacts)
    }),
    getGearMazeAssembly:()=>({
       face:wheelA.parent===leftFace&&wheelB.parent===leftFace?"leftFace":"unexpected",
       large:{x:wheelA.position.x,y:wheelA.position.y,angle:wheelA.rotation.z,pitchRadius:.405},
       small:{x:wheelB.position.x,y:wheelB.position.y,angle:wheelB.rotation.z,pitchRadius:.235},
       directions:[...gearMazeDirections],
       grooveCount:gearMazePoints.length,
       grooveSegments:grooveSegments.length,
       mazeCellSize:mazePitch,
       mazeStyle:"machined square labyrinth",
       networkCells:mazeGraph.size,
       networkChannels:mazeEdgeCurves.size,
       extraConnections:mazePassages.length-80,
       wheelTouchControls:[...wheelContacts.keys()],
       raisedWalls:mazeWallCount,
       exitReached:mazeTravel.to===mazeGoal&&mazeTravel.t>=.999,
       goalSocketOpen:true,
       branches:[...mazeGraph.values()].filter(x=>x.size>=3).length,
       cell:mazeTravel.to,
       followerFrom:mazeTravel.from,
       followerPhase:mazeTravel.t,
       availableDirections:(()=>{
         const c=mazeTravel.to,links=mazeGraph.get(c)||new Set();
         return [...links].map(n=>n===c-9?"maze-up":
           n===c+9?"maze-down":n===c-1?"maze-left":"maze-right");
       })(),
       followerProgress:mazeLastProgress,
       followerTrackDistance:Math.hypot(follower.position.x-mazeTravelPoint().x,
         follower.position.y-mazeTravelPoint().y),
       follower:{x:follower.position.x,y:follower.position.y,z:follower.position.z},
       exit:{x:mazePlate.position.x+finishPoint.x,
        y:mazePlate.position.y+finishPoint.y,
        z:mazePlate.position.z+finishPoint.z},
       railEntry:{...gearRailEntry},
       dialTongueX:dialTongue.position.x
     }),
     getGaugeAssembly:()=>({
      face:meter.parent===leftFace?"leftFace":"unexpected",
      x:meter.position.x,y:meter.position.y,
      radius:.312,needleAngle:needle.rotation.z
    }),
    getCollectibleVisibility:()=>({tooth:false,thread:false}),
    operate
  };
}
