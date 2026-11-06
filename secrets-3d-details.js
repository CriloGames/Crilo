import * as THREE from "three";
import {gsap} from "gsap";
import {batchStaticGeometry} from "./secrets-3d-batching.js?v=2";

// All of these are genuine, individually lit 3D meshes, not CSS overlays.
// All coordinates below are local to their own solid cube face.
export function buildIntricateCube({
  cube, faces, front, side, lidPivot, topHole,
  box, cylinder, label, setHit, mat, animate, invalidate=()=>{}, materials,
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
  // Compact pressure dial; the outer ring remains exposed for dragging.
  meter.scale.setScalar(.90);
  // Deliberately recessed under the working brass actuator; only the
  // needle's outer tip emerges from the central control.
  C(meter,.312,.032,0,0,0,darkMetal);
  C(meter,.280,.030,0,0,.027,gold);
  C(meter,.249,.018,0,0,.051,pearl);
  ring(meter,.283,.015,0,0,.071,brass);
  ring(meter,.291,.008,0,0,.103,steel);
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
  // Solid circular mechanism: five deep concentric tracks, twelve angular
  // sectors, real raised walls and several routes to the open central socket.
  // This layout is shared byte-for-byte with cube-secrets.js's saved graph.
  const gearMazeDirections=[
   1,1,1,1,-1,-1,-1,-1,-1,1,1,1,1,1,-1,-1,-1,-1,-1,
   1,1,1,1,1,-1,-1,-1,-1,-1
  ];



  // A proper hand-cut radial labyrinth, like an antique brass puzzle.
  // The dark marks represent WALLS, not painted corridors or square
  // positions. Every visible opening below comes from the exact same
  // graph used by the saved game and its collision checks.
  const mazeRouteCells=[168,169,170,146,122,98,74,50,49,48,24,47,46,22,21,20,19,43,42,41,17,16,40,64,63,39,15,14,13,37,36,60,84,108,132,133,134,135,159,183,182,181,180,179,178,177,176,175,151,150,126,127,128,104,80,81,57,58,59,35,34,10,11,192];
  const mazePassages="0-1 0-23 1-2 2-3 3-27 4-5 5-6 5-29 7-8 7-31 8-9 9-33 10-11 10-34 11-12 11-192 13-14 13-37 14-15 15-39 16-17 16-40 17-41 18-42 19-20 19-43 20-21 21-22 22-23 22-46 23-47 24-47 24-48 25-49 26-50 27-51 28-29 28-52 30-31 31-32 32-33 33-57 34-35 35-59 36-37 36-60 37-61 38-39 38-62 39-63 40-64 41-42 42-43 44-45 45-69 46-47 48-49 49-50 49-73 50-74 51-75 52-53 53-77 54-55 54-78 55-56 56-57 57-58 57-81 58-59 59-83 60-84 62-63 62-86 63-64 63-87 64-88 65-66 66-67 67-68 68-69 69-70 70-71 70-94 71-95 72-95 73-97 74-98 75-76 76-100 77-78 78-102 79-103 80-81 80-104 82-83 82-106 84-85 84-108 85-109 86-87 88-89 89-90 91-115 92-93 92-116 93-94 93-117 94-118 95-119 96-97 96-120 98-122 99-100 101-102 102-103 103-127 104-128 105-106 105-129 107-108 107-131 108-132 109-110 110-111 112-113 112-136 113-114 113-137 114-115 114-138 116-117 117-141 119-143 120-121 120-143 120-144 121-122 121-145 122-146 123-124 124-125 124-148 125-126 126-127 126-150 127-128 129-130 130-154 131-132 132-133 133-134 134-135 135-159 136-137 138-162 139-140 140-141 141-165 142-166 144-145 144-167 145-146 146-170 147-171 148-172 149-150 149-173 150-151 151-175 152-153 153-154 154-155 155-156 156-157 157-158 159-183 160-161 160-184 161-162 163-164 164-165 164-188 165-166 166-167 166-190 168-169 168-191 169-170 170-171 173-174 175-176 176-177 177-178 178-179 179-180 180-181 181-182 182-183 184-185 185-186 186-187 187-188 188-189 190-191".split(" ").map(e=>e.split("-").map(Number));
  const mazeOrigin=168,mazeGoal=192,mazeSectors=24,mazeRings=8;
  const mazeStartAngle=-Math.PI/2,mazeInnerRadius=.068,mazePitch=.0345;
  const mazePlate=group(leftFace,-.18,0,.19);
  const edgeKey=(a,b)=>Math.min(a,b)+":"+Math.max(a,b);
  const mazeGraph=new Map(),mazeEdgeCurves=new Map(),openEdges=new Set();
  const sectorWidth=Math.PI*2/mazeSectors;
  const mazeCellPoint=cell=>{
    if(cell===mazeGoal)return new THREE.Vector3(0,0,.156);
    const radius=mazeInnerRadius+Math.floor(cell/mazeSectors)*mazePitch;
    const a=mazeStartAngle+(cell%mazeSectors)*sectorWidth;
    return new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius,.156);
  };
  const mazeEdgeCurve=(a,b)=>{
    if(a===mazeGoal||b===mazeGoal||
      Math.floor(a/mazeSectors)!==Math.floor(b/mazeSectors))
      return new THREE.LineCurve3(mazeCellPoint(a),mazeCellPoint(b));
    let delta=((b%mazeSectors)-(a%mazeSectors)+mazeSectors)%mazeSectors;
    if(delta>mazeSectors/2)delta-=mazeSectors;
    const r=mazeInnerRadius+Math.floor(a/mazeSectors)*mazePitch;
    const points=Array.from({length:12},(_,i)=>{
      const angle=mazeStartAngle+(a%mazeSectors+
        delta*i/11)*sectorWidth;
      return new THREE.Vector3(r*Math.cos(angle),r*Math.sin(angle),.156);
    });
    return new THREE.CatmullRomCurve3(points,false,"centripetal",.18);
  };
  for(const [x,y] of mazePassages){
    const a=Math.min(x,y),b=Math.max(x,y);
    const sameRing=a!==mazeGoal&&b!==mazeGoal&&
      Math.floor(a/mazeSectors)===Math.floor(b/mazeSectors);
    const angular=sameRing&&
      ((a%mazeSectors+1)%mazeSectors===b%mazeSectors||
       (b%mazeSectors+1)%mazeSectors===a%mazeSectors);
    const radial=b-a===mazeSectors||b===mazeGoal&&a<mazeSectors;
    if(!angular&&!radial)
      throw Error("Physical labyrinth contains a diagonal or sealed passage");
    const key=edgeKey(a,b);
    if(openEdges.has(key))throw Error("Duplicate machined corridor");
    openEdges.add(key);
    mazeEdgeCurves.set(key,mazeEdgeCurve(a,b));
    if(!mazeGraph.has(a))mazeGraph.set(a,new Set());
    if(!mazeGraph.has(b))mazeGraph.set(b,new Set());
    mazeGraph.get(a).add(b);mazeGraph.get(b).add(a);
  }
  if(mazeGraph.size!==193||openEdges.size!==205)
    throw Error("Circular labyrinth sculpture disagrees with game topology");
  const gearMazePoints=mazeRouteCells.map(mazeCellPoint);
  const grooveSegments=mazeRouteCells.slice(1).map((cell,i)=>
    mazeEdgeCurves.get(edgeKey(mazeRouteCells[i],cell)));
  const startPoint=gearMazePoints[0],finishPoint=gearMazePoints.at(-1);

  // Clean ivory face with recessed ink-dark ENGRAVED BOUNDARIES.
  // No black filled-in route ribbons, repeating squares or loose wire ends.
  const mazeFace=mat(0xf5ead7,.43,.29);
  const mazeWall=mat(0x292521,.22,.68);
  const wallBevel=mat(0xd6c3a0,.4,.36);
  const goalMetal=mat(0xe1aa52,.35,.27);
  const goalLit=mat(0xffda94,.32,.2);
  goalLit.emissive.setHex(0xac752a);goalLit.emissiveIntensity=.9;
  mazeWall.emissive=new THREE.Color(0x080707);
  // The ivory maze is fixed to its bearing plate. Only the meshed gear
  // carrier underneath rotates when the black drive cog is dragged.
  for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4])
    C(mazePlate,.016,.077,Math.cos(a)*.327,
      Math.sin(a)*.327,.076,steel);
  C(mazePlate,.365,.034,0,0,.112,darkMetal);
  C(mazePlate,.354,.024,0,0,.143,mazeFace);
  C(mazePlate,.334,.012,0,0,.160,mazeFace);
  ring(mazePlate,.358,.007,0,0,.161,brass);
  ring(mazePlate,.375,.006,0,0,.132,steel);
  ring(mazePlate,.389,.005,0,0,.124,brass);

  let mazeWallCount=0;
  const strokeWall=curve=>{
    // A shallow warmer bevel below the charcoal ridge gives the look of
    // a properly milled groove, while the 2mm-dark line stays razor crisp.
    for(const [radius,z,material] of [
      [.0055,.183,wallBevel],[.0028,.189,mazeWall]
    ]){
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(
        curve,Math.max(12,Math.round(curve.getLength()*240)),
        radius,8,false),material);
      mesh.position.z=z-.156;
      mesh.castShadow=false;mazePlate.add(mesh);detailsCount++;
    }
    mazeWallCount++;
  };
  const radialWall=(angle,r0,r1)=>{
    strokeWall(new THREE.LineCurve3(
      new THREE.Vector3(r0*Math.cos(angle),r0*Math.sin(angle),.156),
      new THREE.Vector3(r1*Math.cos(angle),r1*Math.sin(angle),.156)));
  };
  const curvedWall=(radius,a0,a1)=>{
    // Array.from's mapper receives (value,index), not the result array.
    // Compute count up front so wall segments always initialize correctly.
    const count=Math.max(5,Math.ceil(Math.abs(a1-a0)*radius*150));
    const points=Array.from({length:count},(_,i)=>{
      const a=a0+(a1-a0)*i/(count-1);
      return new THREE.Vector3(radius*Math.cos(a),radius*Math.sin(a),.156);
    });
    strokeWall(new THREE.CatmullRomCurve3(points,false,"centripetal",.14));
  };
  // Merge consecutive CLOSED radial sectors into long, flowing arc
  // strokes. Rendering one little square per cell was the old visual bug.
  function closedArcRuns(radius,blocked){
    const firstOpen=blocked.findIndex(v=>!v);
    if(firstOpen<0){
      curvedWall(radius,mazeStartAngle,mazeStartAngle+Math.PI*2);
      return;
    }
    const order=Array.from({length:mazeSectors},(_,i)=>
      (firstOpen+1+i)%mazeSectors);
    let run=[];
    const flush=()=>{
      if(!run.length)return;
      const a0=mazeStartAngle+(run[0]-.48)*sectorWidth;
      const a1=a0+(run.length-.04)*sectorWidth;
      curvedWall(radius,a0,a1);run=[];
    };
    for(const sector of order){
      if(blocked[sector])run.push(sector);
      else flush();
    }
    flush();
  }
  // Seven detailed circular boundaries fill the inner and outer tracks, with
  // openings only where the pin can actually traverse radially.
  for(let r=0;r<mazeRings-1;r++){
    const blocked=Array.from({length:mazeSectors},(_,k)=>
      !openEdges.has(edgeKey(r*mazeSectors+k,
        (r+1)*mazeSectors+k)));
    closedArcRuns(mazeInnerRadius+(r+.5)*mazePitch,blocked);
  }
  // Staggered radial cross-walls. Rounded continuous curves, not boxes.
  for(let r=0;r<mazeRings;r++)for(let k=0;k<mazeSectors;k++){
    const a=r*mazeSectors+k;
    const b=r*mazeSectors+(k+1)%mazeSectors;
    if(openEdges.has(edgeKey(a,b)))continue;
    const angle=mazeStartAngle+(k+.5)*sectorWidth;
    const radius=mazeInnerRadius+r*mazePitch;
    radialWall(angle,radius-mazePitch*.47,
      radius+mazePitch*.47);
  }
  // Inner socket wall has TWO real open mouths, matching the physical
  // approach routes; never cover these mouths with a solid fake bolt.
  closedArcRuns(.046,Array.from({length:mazeSectors},(_,k)=>
    !openEdges.has(edgeKey(k,mazeGoal))));

  // The outer circle is continuous except for the clear entry notch at
  // six o'clock. The captive roller remains constrained inside this rim.
  const outerRimRadius=.338;
  curvedWall(outerRimRadius,mazeStartAngle+sectorWidth*.37,
    mazeStartAngle+Math.PI*2-sectorWidth*.37);
  const entryArrow=new THREE.Shape();
  entryArrow.moveTo(-.009,0);entryArrow.lineTo(.009,0);
  entryArrow.lineTo(0,.014);entryArrow.closePath();
  const entryMark=new THREE.Mesh(new THREE.ShapeGeometry(entryArrow),
    goalMetal);
  entryMark.position.set(startPoint.x,-.354,.188);
  mazePlate.add(entryMark);detailsCount++;
  // A real opening in the central brass collar lines up with the only
  // permitted inner-ring mouth (sector 11). Never make the roller appear to
  // pass through a solid ring at the goal.
  const innerMouthAngle=mazeStartAngle+11*sectorWidth;
  const goalSocket=new THREE.Mesh(new THREE.TorusGeometry(
    .025,.003,8,60,Math.PI*2-sectorWidth),goalMetal);
  goalSocket.rotation.z=innerMouthAngle+sectorWidth/2;
  goalSocket.position.z=.186;
  mazePlate.add(goalSocket);detailsCount++;
  C(mazePlate,.022,.007,0,0,.173,ebony);

  // Four small flush rivets on the carrier, not distracting fasteners
  // scattered across the maze itself.
  for(let i=0;i<4;i++){
    const a=(i+.5)*Math.PI/2;
    const x=.378*Math.cos(a),y=.378*Math.sin(a);
    C(mazePlate,.009,.009,x,y,.147,steel);
  }
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


  // A clockwise rotation of the small gear and a counterclockwise
  // rotation of the large wheel are now genuinely distinct actions.
  // The radial shift is selected by touching the TOP or BOTTOM OF THE
  // ALREADY EXISTING calibration dial. Its central pressure switch keeps
  // its original three-step calibration function.
  const dialTargets=new Map();
  const dialTouchMat=new THREE.MeshBasicMaterial({
    transparent:true,opacity:0,colorWrite:false,
    depthWrite:false,side:THREE.DoubleSide
  });
  function radialDialTarget(action,top){
    const cy=top?.252:-.252;
    const target=group(meter,0,cy,.168);
    const touch=new THREE.Mesh(
      new THREE.RingGeometry(.203,.307,48,1,
        top?0:Math.PI,Math.PI),dialTouchMat);
    touch.position.y=-cy;target.add(touch);
    dialTargets.set(action,target);
    if(liveGame)setHit(target,action);
    // Small inlaid chevrons on the existing bezel, not extra buttons.
    const indicator=group(meter,0,cy,.095);
    for(const sign of [-1,1])
      flatLine(indicator,sign*.022,top?-.011:.011,
        0,top?.018:-.018,.002,.004,brass);
  }
  radialDialTarget("maze-in",true);
  radialDialTarget("maze-out",false);
  const follower=new THREE.Group();mazePlate.add(follower);
  follower.position.copy(startPoint);follower.position.z=.211;
  const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};
  // Queue consecutive real channels during quick wheel turns instead of
  // restarting the ball animation and teleporting between maze positions.
  const mazeQueue=[];
  let mazeVisualTarget=mazeOrigin,mazeTween=null;
  function animateNextMazeEdge(){
    if(mazeTween||!mazeQueue.length)return;
    const next=mazeQueue.shift(),from=mazeTravel.to;
    if(!mazeGraph.get(from)?.has(next))
      throw Error("The wheel queued a closed corridor");
    mazeTravel.from=from;mazeTravel.to=next;mazeTravel.t=0;
    seatFollower();invalidate();
    mazeTween=gsap.to(mazeTravel,{t:1,duration:.16,ease:"none",
      onUpdate:()=>{seatFollower();invalidate();},
      onComplete:()=>{
        mazeTween=null;seatFollower();invalidate();
        animateNextMazeEdge();
      }
    });
  }
  let mazeLastProgress=0;
  const mazeTravelPoint=()=>{
    if(mazeTravel.from===mazeTravel.to)return mazeCellPoint(mazeTravel.to);
    const curve=mazeEdgeCurves.get(edgeKey(mazeTravel.from,mazeTravel.to));
    if(!curve)throw Error("Maze ball attempted a blocked groove");
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
  C(follower,.007,.044,0,0,-.011,steel);
  const captiveBall=new THREE.Mesh(new THREE.SphereGeometry(.0085,18,14),gold);
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
    setHit(wheelA,"gear-large");setHit(wheelB,"gear-small");
    // Re-apply the two dial sectors after the gauge's own pressure switch
    // has registered, so each bezel sector has one unambiguous action.
    for(const [name,target] of dialTargets)setHit(target,name);
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
    // A drag notch needs immediate visible hardware feedback. The next
    // gear action can arrive before the previous ball segment finishes.
    const turnPose=(part,value)=>{
     if(instant){part.rotation.z=value;return;}
     gsap.killTweensOf(part.rotation);
     animate(part.rotation,{z:value},.16);
    };
    turnPose(wheelA,gearRotation);
    // The ivory face is fixed to the box. The black pinion drives only
    // the toothed carrier behind it, while the roller follows its channels.
    gsap.killTweensOf(mazePlate.rotation);
    mazePlate.rotation.z=0;
    turnPose(wheelB,-gearRotation*(.405/.235));
    const cell=Number.isInteger(s.gearMazeCell)&&
     mazeGraph.has(s.gearMazeCell)?s.gearMazeCell:legacyMazeCell(s);
    mazeLastProgress=Math.max(0,Math.min(gearMazeDirections.length,
     Number(s.gearMazeIndex)||0));
    if(instant){
     gsap.killTweensOf(mazeTravel);
     mazeTween=null;mazeQueue.length=0;
     mazeVisualTarget=cell;
     mazeTravel.from=cell;mazeTravel.to=cell;mazeTravel.t=1;
     seatFollower();invalidate();
    }else if(cell!==mazeVisualTarget){
     if(mazeGraph.get(mazeVisualTarget)?.has(cell)){
      mazeQueue.push(cell);mazeVisualTarget=cell;
      animateNextMazeEdge();
     }else{
      // Old saves can jump between layouts. Only restore those directly;
      // live wheel inputs ALWAYS travel along the contiguous physical edge.
      gsap.killTweensOf(mazeTravel);
      mazeTween=null;mazeQueue.length=0;mazeVisualTarget=cell;
      mazeTravel.from=cell;mazeTravel.to=cell;mazeTravel.t=1;
      seatFollower();invalidate();
     }
    }else if(!mazeTween&&!mazeQueue.length)seatFollower();
    // At the end the captive screw backs OUT of its channel. Simultaneously
    // the adjacent lock tongue withdraws from the calibration dial.
    // Seat the pin DOWN into the central receiving pocket when solved;
    // the previous animation lifted it off the wheel as though escaping
    // through an invisible roof.
    pose(follower,"position","z",s.gearMazeSolved?.183:.211);
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
    dynamicRoots:[front.drawer,side.drawer,lidPivot,wheelA,wheelB,mazePlate,needle],
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
       large:mazePlate,small:wheelB,dial:meter,
       directional:new Map(dialTargets)
     }),
     getGearMazeAssembly:()=>({
       face:wheelA.parent===leftFace&&wheelB.parent===leftFace?"leftFace":"unexpected",
       large:{x:wheelA.position.x,y:wheelA.position.y,angle:wheelA.rotation.z,pitchRadius:.405},
       small:{x:wheelB.position.x,y:wheelB.position.y,angle:wheelB.rotation.z,pitchRadius:.235},
       directions:[...gearMazeDirections],
       grooveCount:gearMazePoints.length,
       grooveSegments:grooveSegments.length,
       mazeCellSize:mazePitch,
       mazeStyle:"stationary eight-ring circular labyrinth",
       networkCells:mazeGraph.size,
       networkChannels:mazeEdgeCurves.size,
       extraConnections:mazeEdgeCurves.size-mazeGraph.size+1,
       wheelTouchControls:["gear-large","gear-small",...dialTargets.keys()],
       raisedWalls:mazeWallCount,
       exitReached:mazeTravel.to===mazeGoal&&mazeTravel.t>=.999,
       faceAngle:mazePlate.rotation.z,
       carrierAngle:wheelA.rotation.z,
       blackCogAngle:wheelB.rotation.z,
       stationaryFace:true,
       goalSocketOpen:true,
       branches:[...mazeGraph.values()].filter(x=>x.size>=3).length,
       cell:mazeTravel.to,
       followerFrom:mazeTravel.from,
       followerPhase:mazeTravel.t,
       availableDirections:(()=>{
         const c=mazeTravel.to,links=mazeGraph.get(c)||new Set();
         if(c===mazeGoal)return ["maze-out"];
         const ring=Math.floor(c/mazeSectors),sector=c%mazeSectors;
         return [...links].map(n=>n===mazeGoal?"maze-in":
           Math.floor(n/mazeSectors)<ring?"maze-in":
           Math.floor(n/mazeSectors)>ring?"maze-out":
           (n%mazeSectors)===(sector+1)%mazeSectors?
           "maze-ccw":"maze-cw");
       })(),
       followerProgress:mazeLastProgress,
       followerTrackDistance:Math.hypot(
         follower.position.x-mazeTravelPoint().x,
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
      radius:.281,needleAngle:needle.rotation.z
    }),
    getCollectibleVisibility:()=>({tooth:false,thread:false}),
    operate
  };
}
