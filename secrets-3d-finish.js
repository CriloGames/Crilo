import * as THREE from "three";
import {batchStaticGeometry} from "./secrets-3d-batching.js?v=3";
import {clearRailSegments,railClearanceFaults} from "./secrets-3d-rail-clearance.js?v=1";

/**
 * Physical finishing pass. Every ornamental element is a real 3D mesh,
 * attached to its own face, moving drawer or hinged lid. No billboards or
 * free-floating decorations; no extra raycast targets over existing puzzles.
 */
export function finishMechanicalArtifact({
  renderer, scene, cube, faces, front, side, lidPivot,
  box, cylinder, mat, materials
}) {
  const {frontFace,rightFace,leftFace,topFace,bottomFace,backFace}=faces;
  const {metal,brass,darkMetal,ivory,rubber,enamel,cavityMaterial}=materials;
  let partCount=0;
  const finishedMeshes=[];
  const borderRails=[],borderRailFaults=[];
  const deep=mat(0x2e3c47,.46,.48);
  const satin=mat(0x8b7c73,.54,.35);
  const smoked=mat(0x476e78,.28,.18);
  const cream=mat(0xffeed0,.12,.36);
  const copper=mat(0xc17f5e,.66,.31);
  const tinyGold=mat(0xffddb0,.58,.31);
  const nacre=mat(0xe3e0da,.24,.26);
  const teal=mat(0x668e88,.32,.47);
  const oxblood=mat(0x6c4858,.29,.47);

  // Small deterministic tileable manufacturing textures. They affect actual
  // surface roughness / microscopic relief, not just fake drawn shading.
  function noiseMap(direction=0) {
    const canvas=document.createElement("canvas");
    canvas.width=canvas.height=128;
    const ctx=canvas.getContext("2d"), im=ctx.createImageData(128,128);
    let seed=direction===1?82173:16991;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      seed=(1664525*seed+1013904223)>>>0;
      const rnd=(seed&255)/255;
      const streak=direction===1?Math.sin(y*.91)*18:Math.sin((x+y)*.18)*6;
      const v=Math.max(40,Math.min(235,149+(rnd-.5)*34+streak));
      const i=(y*128+x)*4;
      im.data[i]=im.data[i+1]=im.data[i+2]=v;
      im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);
    const tex=new THREE.CanvasTexture(canvas);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(3,3);
    tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
    tex.needsUpdate=true;
    return tex;
  }
  const enamelNoise=noiseMap(),brushedNoise=noiseMap(1);
  for(const paint of Object.values(enamel)){
    // Painted porcelain enamel should retain its pigment rather than reflecting
    // so much white studio light that the cube loses all contrast.
    paint.roughness=.54;
    paint.metalness=.08;
    paint.clearcoat=.42;
    paint.clearcoatRoughness=.28;
    paint.bumpMap=enamelNoise;
    paint.bumpScale=.010;
    paint.roughnessMap=enamelNoise;
    paint.envMapIntensity=.62;
    paint.needsUpdate=true;
  }
  for(const m of [metal,brass,copper,tinyGold,satin]){
    m.roughness=Math.max(m.roughness,.46);
    m.roughnessMap=brushedNoise;
    m.bumpMap=brushedNoise;
    m.bumpScale=.007;
    m.clearcoat=.16;
    m.envMapIntensity=.84;
    m.needsUpdate=true;
  }
  deep.clearcoat=.35;

  const B=(g,w,h,d,x,y,z,m,r=.018)=>{
    const o=box(g,w,h,d,x,y,z,m,r);
    o.castShadow=w>.38&&h>.20&&d>.08;
    partCount++;finishedMeshes.push(o);return o;
  };
  const C=(g,r,d,x,y,z,m)=>{
    const o=cylinder(g,r,d,x,y,z,m);
    o.castShadow=r>.29&&d>.09;
    partCount++;finishedMeshes.push(o);return o;
  };
  const torus=(g,r,t,x,y,z,m)=>{
    const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,9,48),m);
    o.position.set(x,y,z);o.castShadow=false;o.receiveShadow=true;
    g.add(o);partCount++;finishedMeshes.push(o);return o;
  };
  function path(g,points,radius,material) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(15,points.length*7),radius,8,false),material);
    mesh.castShadow=false;mesh.receiveShadow=true;g.add(mesh);partCount++;
    finishedMeshes.push(mesh);return mesh;
  }
  const group=(parent,x=0,y=0,z=0)=>{
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;
  };
  const stud=(g,x,y,z=.14,r=.039)=>{
    // A real fixed screw has a shaft that goes INTO its parent part.
    // On the hinged lid / sliding drawers the head must move together
    // with that parent. Keep the shank and head in the same local group.
    const screw=group(g,x,y,z);
    C(screw,r*.60,.144,0,0,-.072,brass);
    C(screw,r,.033,0,0,0,brass);
    const groove=B(screw,r*.94,.012,.008,0,0,.023,deep,.003);
    groove.rotation.z=Math.PI/4;
  };
  // A manufactured edge has two separate flush trims and a narrow gasket.
  // Track decorative caps separately from REAL puzzle fasteners; duplicating
  // both at the same corner previously produced stacks of overlapping screws.
  const decorativeCornerCaps=[];
  const borderFaceName=new Map([
    [frontFace,"frontFace"],[backFace,"backFace"],[rightFace,"rightFace"],
    [leftFace,"leftFace"],[topFace,"topFace"],[bottomFace,"bottomFace"]
  ]);
  // No continuous black/silver inlay may run through another fixture.
  // This is the SAME clearance calculation as the larger detail-frame rails.
  const trimRail=(face,axis,fixed,from,to,width,depth,z,paint,rounding)=>{
    const name=borderFaceName.get(face);
    const segments=clearRailSegments(name,axis,fixed,from,to,width);
    borderRailFaults.push(...railClearanceFaults(name,axis,fixed,segments,width));
    borderRails.push({face:name,axis,fixed,from,to,width,segments});
    for(const seg of segments){
      const mesh=axis==="x"
       ?B(face,seg.length,width,depth,seg.center,fixed,z,paint,rounding)
       :B(face,width,seg.length,depth,fixed,seg.center,z,paint,rounding);
      mesh.userData.clearanceTrim=true;
      // Returned terminal shoes bolt each shortened inlay back to the
      // underlying enamel. They stay INSIDE the safe rail path, rather
      // than creating a second line that pierces the adjacent hardware.
      for(const [isCut,end] of [
        [seg.from>from+.001,seg.from+.050],
        [seg.to<to-.001,seg.to-.050]
      ]){
        if(!isCut||seg.length<.18)continue;
        const bottom=.069,top=z+depth*.36;
        const footDepth=top-bottom,footZ=(top+bottom)/2;
        const foot=axis==="x"
         ?B(face,.075,width*1.24,footDepth,end,fixed,footZ,metal,.008)
         :B(face,width*1.24,.075,footDepth,fixed,end,footZ,metal,.008);
        foot.userData.mechanicalMount=true;
      }
    }
  };
  function machinedPanel(face,accent) {
    // A single fine, continuous frame complements the strong outer rim.
    // No second black rectangle, split-off black sticks or free endcaps.
    // The eye face already has a machined cassette and only needs the
    // proper outer structural rail, not another overlapping border.
    if(face===backFace)return;
    const inset=face===rightFace?1.445:1.425;
    // True butt-jointed frame: horizontal bars stop precisely at the
    // vertical bars' inner edges. Four coplanar full-size bars USED to
    // overlap at each corner and look like crossed sticks.
    const straight=inset-.015,span=inset+.015;
    if(face===frontFace){
      for(const sign of [-1,1]){
        trimRail(face,"x",sign*inset,-straight,straight,
          .030,.041,.105,accent,.012);
        trimRail(face,"y",sign*inset,-span,span,
          .030,.041,.105,accent,.012);
      }
      return;
    }
    for(const s of [-1,1]){
      // The brass and dark inlays have nearly matching slender profiles:
      // the brass is only slightly wider, never a chunky raised bar.
      // Each remains one piece with a short downward turn at its port.
      if(face===topFace&&s===-1){
        const traces=[
          {y:-1.22,z:.105,width:.022,depth:.023,material:accent,
           end:1.29,port:.390},
          {y:-1.125,z:.112,width:.019,depth:.020,material:deep,
           end:1.20,port:.390}
        ];
        function roofInlay(trace,sign){
          const inner=trace.port,curveStart=inner+.070;
          const stations=[];
          for(let i=0;i<=34;i++){
            const x=trace.end+(curveStart-trace.end)*i/34;
            stations.push(new THREE.Vector3(sign*x,trace.y,trace.z));
          }
          // Bend the FULL-WIDTH strip into the well. Move almost all of the
          // way in before descending, so its corners clear the slim metal
          // socket rim; the final tangent points straight into the hole.
          const bend=new THREE.CubicBezierCurve3(
            new THREE.Vector3(sign*curveStart,trace.y,trace.z),
            new THREE.Vector3(sign*(inner+.007),trace.y,trace.z),
            new THREE.Vector3(sign*inner,trace.y,trace.z),
            new THREE.Vector3(sign*inner,trace.y,.063)
          );
          for(let i=1;i<=24;i++)stations.push(bend.getPoint(i/24));
          const profile=[[-1,-.75],[-.75,-1],[.75,-1],[1,-.75],
           [1,.75],[.75,1],[-.75,1],[-1,.75]];
          const positions=[],uv=[],indices=[],ring=profile.length;
          for(let i=0;i<stations.length;i++){
            const p=stations[i],prev=stations[Math.max(0,i-1)];
            const next=stations[Math.min(stations.length-1,i+1)];
            const tangent=next.clone().sub(prev).normalize();
            const nx=-tangent.z,nz=tangent.x;
            // Solid, constant-section inlay: no narrowing as it enters the socket.
            const halfWidth=trace.width*.5;
            const halfDepth=trace.depth*.5;
            for(const [u,v] of profile){
              positions.push(p.x+nx*v*halfDepth,
               p.y+u*halfWidth,p.z+nz*v*halfDepth);
              uv.push(i/(stations.length-1),u*.5+.5);
            }
          }
          for(let i=0;i<stations.length-1;i++)for(let j=0;j<ring;j++){
            const a=i*ring+j,b=i*ring+(j+1)%ring;
            const c=(i+1)*ring+j,d=(i+1)*ring+(j+1)%ring;
            indices.push(a,b,c,b,d,c);
          }
          for(let j=1;j<ring-1;j++){
            indices.push(0,j+1,j);
            const tail=(stations.length-1)*ring;
            indices.push(tail,tail+j,tail+j+1);
          }
          const geometry=new THREE.BufferGeometry();
          geometry.setAttribute("position",
            new THREE.Float32BufferAttribute(positions,3));
          geometry.setAttribute("uv",
            new THREE.Float32BufferAttribute(uv,2));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          const paint=trace.material.clone();
          paint.side=THREE.DoubleSide;
          const strip=new THREE.Mesh(geometry,paint);
          strip.castShadow=false;strip.receiveShadow=true;
          face.add(strip);finishedMeshes.push(strip);partCount++;
        }
        for(const trace of traces)for(const sign of [-1,1]){
          roofInlay(trace,sign);
          const x=sign*trace.port,y=trace.y;
          // Keep the original small circular hole, but lower its rim
          // until it is almost flush with the enamel. The slim strip
          // passes OVER the ring and disappears below its dark center.
          C(face,.027,.012,x,y,.076,metal);
          C(face,.019,.010,x,y,.079,deep);
          torus(face,.026,.004,x,y,.084,accent);
        }
      }
      // The roof inlays enter their real sockets *inside* this complete
      // perimeter. There is no floating bottom border endpoint.
      trimRail(face,"x",s*inset,-straight,straight,
        .030,.041,.105,accent,.012);
      trimRail(face,"y",s*inset,-span,span,
        .030,.041,.105,accent,.012);
    }
    // No second set of corner rivets: the precision panel already has
    // fixed screwheads at (+/-1.31,+/-1.33). Even the reduced .036 caps at
    // (+1.22,+/-1.22) sat against those screws, producing the overlapping
    // clusters shown in the user's close-up. One modeled fastener per spot.

  }
  machinedPanel(frontFace,tinyGold);
  machinedPanel(rightFace,teal);
  machinedPanel(leftFace,copper);
  machinedPanel(topFace,brass);
  machinedPanel(bottomFace,satin);
  machinedPanel(backFace,teal);

  // SECONDARY ENGRAVED TRACKWORK — the original layered machinery aesthetic.
  // The previous pass removed this entire tier and made all six faces look
  // empty. These are physical, low-profile inlays, not wall stickers.
  // They follow two nested, butt-joined rectangular routes. Interference
  // at actual controls is handled here by ending in a small *mounted*
  // contact, rather than chopping a full-width bar into floating sticks.
  const ornamentSummary=[];
  const engrave=(face,inset,paint,width,depth,z,{openBottom=false}={})=>{
    const name=borderFaceName.get(face);
    const spanX=inset-width/2,spanY=inset+width/2;
    // On the observatory roof the two vertical return tracks must end
    // exactly at their existing gold/graphite inlay, rather than piercing
    // those conductors or producing a third disconnected lower border.
    const roofJoin=openBottom?(inset>1.2?-1.22:-1.125)+width/2:-spanY;
    const edges=[
      ["x",inset,-spanX,spanX],
      ["x",-inset,-spanX,spanX],
      ["y",-inset,roofJoin,spanY],
      ["y",inset,roofJoin,spanY]
    ].filter(([axis,fixed])=>!(openBottom&&axis==="x"&&fixed<0));
    for(const [axis,fixed,from,to] of edges){
      const raw=clearRailSegments(name,axis,fixed,from,to,width);
      const spans=raw.map(seg=>{
        // Withdraw the metal a little farther from each fitting to make
        // room for the terminal socket's own radius and chamfer.
        const cutStart=seg.from>from+.001,cutEnd=seg.to<to-.001;
        const start=seg.from+(cutStart?.028:0);
        const end=seg.to-(cutEnd?.028:0);
        return {from:start,to:end,length:end-start,
          center:(start+end)/2,cutStart,cutEnd};
      }).filter(s=>s.length>=.25);
      borderRails.push({face:name,axis,fixed,from,to,width,segments:spans});
      borderRailFaults.push(...railClearanceFaults(name,axis,fixed,spans,width));
      for(const seg of spans){
        const trace=axis==="x"
          ?B(face,seg.length,width,depth,seg.center,fixed,z,paint,.005)
          :B(face,width,seg.length,depth,fixed,seg.center,z,paint,.005);
        trace.userData.clearanceTrim=true;
        trace.userData.engravedRail=true;
        // Low-profile socket heads replace the unconnected blunt ends.
        // Each has a real shaft back into the enamel; no oversized gold
        // end pieces, no fake crosspieces and no rail pierced by a control.
        for(const [cut,at] of [
          [seg.cutStart,seg.from],[seg.cutEnd,seg.to]
        ]){
          if(!cut)continue;
          const x=axis==="x"?at:fixed,y=axis==="x"?fixed:at;
          C(face,.014,.049,x,y,.093,metal);
          C(face,.008,.014,x,y,.124,tinyGold);
        }
      }
      ornamentSummary.push({face:name,axis,fixed,width,
        count:spans.length,segments:spans.map(s=>[s.from,s.to])});
    }
  };
  const ornamentFace=(face,accent,{roof=false}={})=>{
    // Gold/colored pilot trace + graphite return trace, with generous
    // spacing between them. Together they recover the dense hand-built
    // appearance without returning to the old overlapping black lattice.
    engrave(face,1.255,accent,.023,.026,.126,{openBottom:roof});
    engrave(face,1.140,deep,.012,.017,.119,{openBottom:roof});
  };
  ornamentFace(frontFace,tinyGold);
  ornamentFace(rightFace,teal);
  ornamentFace(backFace,teal);
  ornamentFace(leftFace,copper);
  ornamentFace(bottomFace,satin);
  ornamentFace(topFace,brass,{roof:true});

  // REAR OPTICAL PANEL — add purposeful detail around the glass eye.
  // The eye itself, the hidden score-A strip, the bottom-left symbol
  // cassette, the bottom-right iris actuator and the upper three
  // miniature mounts are all reserved for working hardware.
  // This uses shallow, permanently fixed non-clickable geometry ONLY.
  const rearEyeRelief=[];
  const rearFit=(name,w,h,d,x,y,z,paint,round=.006)=>{
    const mesh=B(backFace,w,h,d,x,y,z,paint,round);
    rearEyeRelief.push({name,x,y,w,h,z,d});
    return mesh;
  };
  // A thin mechanical bus connects the original eye housing's upper
  // rim to two captive contact points. It stays BELOW all three future
  // miniature plinths (whose support footprints start near y=.59).
  rearFit("optic header",1.36,.028,.035,0,.475,.088,teal);
  for(const sign of [-1,1]){
    rearFit("header support",.027,.178,.038,sign*.55,.390,.088,teal);
    C(backFace,.019,.050,sign*.55,.475,.111,tinyGold);
    // Little side service cassettes use the otherwise bare strips
    // beside the eye. Their outer edge stops BEFORE the dark border
    // at |x|=1.14; none sit on the eye or on its moving iris.
    const x=sign*1.012;
    rearFit("side carrier",.160,.440,.030,x,-.200,.087,metal,.015);
    rearFit("side enamel",.128,.403,.012,x,-.200,.109,teal,.010);
    // Captive link seats in the existing eye casting, not in the glass.
    rearFit("optical transfer",.108,.022,.034,
      sign*.909,-.180,.092,tinyGold,.006);
    for(const offset of [-.105,-.035,.035,.105])
      rearFit("service flute",.070,.007,.009,
        x,-.200+offset,.119,smoked,.002);
    for(const offset of [-.17,.17]){
      C(backFace,.013,.045,x,-.200+offset,.115,tinyGold);
    }
  }
  // The lower support is a physical return from the cassette to a slim
  // inspection plate. It is placed ABOVE both clue carriers, and cannot
  // cover the musical note strip when the eye is pressed.
  for(const sign of [-1,1])
    rearFit("lower optic stay",.025,.133,.039,
      sign*.18,-.725,.087,teal,.006);
  rearFit("lower service backing",.56,.190,.030,
    0,-.875,.087,metal,.014);
  rearFit("lower service inlay",.508,.144,.012,
    0,-.875,.109,cream,.010);
  for(const x of [-.175,-.087,0,.087,.175]){
    rearFit("lower inspection etch",.047,.007,.008,
      x,-.875,.120,smoked,.002);
  }
  for(const sign of [-1,1])
    C(backFace,.013,.049,sign*.247,-.875,.114,tinyGold);
  // No click targets or new puzzles are assigned to this relief.
  // Lower clues, iris calibration and discoveries remain authoritative.

  // Substantial three-dimensional beveled corner gussets instead of
  // independent square caps. These are mounted to the fixed frame.
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const crown=group(cube,x*1.615,y*1.615,z*1.615);
    B(crown,.28,.28,.28,0,0,0,metal,.085);
    B(crown,.19,.19,.06,0,0,z*.126,tinyGold,.052);
    C(crown,.047,.036,0,0,z*.175,darkMetal);
    for(const dy of [-.06,.06])B(crown,.026,.014,.016,0,dy,z*.191,cream,.005);
  }

  // Lens: multiple glass layers, physical hood, inner iris and precise brass
  // retaining ring. The transparent convex cap catches the environment.
  const frontLens=group(frontFace,0,.56,.27);
  // The ornamental outer optic used to hover well above the enamel.
  // A hollow cast-metal sleeve physically bridges the cube skin and lens;
  // leave the center open for the working iris and transparent objective.
  const lensBarrel=new THREE.Mesh(new THREE.CylinderGeometry(
    .758,.758,.183,72,1,true),metal);
  lensBarrel.rotation.x=Math.PI/2;
  lensBarrel.position.z=-.0915;
  lensBarrel.castShadow=false;
  lensBarrel.userData.mechanicalMount=true;
  lensBarrel.userData.noBatch=true;
  frontLens.add(lensBarrel);partCount++;
  finishedMeshes.push(lensBarrel);
  torus(frontLens,.758,.035,0,0,-.181,metal); // anchored to enamel
  // The second .758-radius graphite torus physically occupied the SAME
  // volume as the gold lip. Remove it; the existing .69-radius inset is
  // the clean dark gasket, safely inside the single gold edge.
  torus(frontLens,.76,.031,0,0,0,tinyGold);
  torus(frontLens,.69,.014,0,0,.03,deep);
  // The old radial metal bars pierced both the gold and the black
  // retaining rings. Use tiny face-on rivets that sit IN the gold band.
  // Their shallow shanks seat into the ring; nothing sticks past its edges.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    C(frontLens,.010,.008,Math.cos(a)*.76,
      Math.sin(a)*.76,.033,cream);
  }
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.31,32,18,0,Math.PI*2,0,Math.PI*.47),
    new THREE.MeshPhysicalMaterial({
      color:0xb2dde1,metalness:0,roughness:.11,transmission:.28,thickness:.15,
      transparent:true,opacity:.55,clearcoat:1,clearcoatRoughness:.05,depthWrite:false
    }));
  dome.rotation.x=Math.PI/2;
  dome.scale.z=.42;
  dome.position.set(0,0,.14);
  frontLens.add(dome);partCount++;
  // A captured glass bezel makes the convex optic feel installed rather
  // than a translucent cone floating in front of the instrument.
  // Two independent coaxial bands with actual radial/depth clearance;
  // the old thick graphite bezel cut through the thin gold bezel.
  torus(frontLens,.330,.012,0,0,.142,deep);
  torus(frontLens,.314,.013,0,0,.169,tinyGold);
  C(frontLens,.045,.06,-.085,.09,.235,cream);
  // The previous copper tubing and black rectangular terminal blocks sat
  // directly under LATCH (-1.05,.11) and RED (+1.10,.15). As a result,
  // the round live actuators physically cut through two fake housings.
  // Leave the real button collars and their engraved nameplates unobscured.
  // No dead-end conduit or fake fastener is needed at these positions.
  // Extra bolted sealing frame around the full-size key drawer.
  function bezel(face,hole) {
    const {x,y,w,h}=hole;
    const g=group(face,x,y,.088);
    const t=.058;
    for(const s of [-1,1]){
      if(face===frontFace&&s===1){
        // The old straight header cut across the bottom arc of the
        // huge optic, even though it sits behind the gold ring in depth.
        // Retain a proper drawer bezel with TWO attached shoulder wings.
        // The centre is clear of the round lens; both wings return into
        // their existing side posts and have real, bolted end shoes.
        const edge=(w+.24)/2,clearCentre=.51;
        for(const sideSign of [-1,1]){
          const length=edge-clearCentre;
          const centre=sideSign*(edge+clearCentre)/2;
          B(g,length,t,.12,centre,s*(h/2+.07),0,brass,.019);
          // Small retained brass terminal, aligned within its wing.
          C(g,.023,.018,sideSign*(clearCentre+.040),
            s*(h/2+.07),.073,tinyGold);
        }
      }else{
        B(g,w+.24,t,.12,0,s*(h/2+.07),0,brass,.019);
      }
      B(g,t,h+.18,.12,s*(w/2+.07),0,0,brass,.019);
      for(const X of [-w/2+.08,w/2-.08])
        stud(g,X,s*(h/2+.07),.085,.027);
    }
    return g;
  }
  bezel(frontFace,{x:0,y:-.67,w:1.40,h:.90});
  bezel(rightFace,{x:-.06,y:-.18,w:1.35,h:.83});

  // Drawer facades are engraved enclosures. Each detail is the drawer's child
  // so the markings slide WITH the complete physical tray.
  for(const [tray,tint] of [[front,oxblood],[side,teal]]) {
    const face=tray.drawer;
    B(face,.97,.010,.030,0,.29,.275,deep,.003);
    B(face,.97,.010,.030,0,-.28,.275,deep,.003);
    for(const x of [-.56,.56]){
      B(face,.025,.43,.04,x,0,.274,tint,.009);
      stud(face,x,.28,.305,.023);
      stud(face,x,-.27,.305,.023);
    }
    // Weighty recessed latch handle with a through-hole and two side mounts.
    const clasp=group(face,0,-.11,.28);
    B(clasp,.35,.18,.062,0,0,0,deep,.036);
    B(clasp,.25,.085,.066,0,-.015,.049,ivory,.032);
    for(const x of [-.145,.145])stud(clasp,x,0,.095,.026);
  }

  // Right-face service parts are already modeled with raised rails,
  // real corner bolts, a shutter and two mounted miniature characters.
  // Independent copper pipes and braces previously pierced the dog/door
  // sculptures and the drawer bezel, so the fake pipe overlay is omitted.

  // The left and underside already have real numbered vents, a dent,
  // corner feet, and a lock dial. Prior finishing-pass grilles covered
  // those live controls and their plaques (visible as a vent *inside*
  // a circular knob). Do not layer cosmetic louvers on those faces.
  // All service ventilation is now modeled once, in the authored controls.

  // Hatch: real underside bracing, raised edge hem, and fixed hinge
  // knuckles. Nothing protrudes into an unsupported empty plane.
  for(const s of [-1,1]){
    B(lidPivot,.055,1.12,.062,s*.69,-.69,-.083,metal,.015);
    B(lidPivot,.14,.18,.082,s*.57,-1.12,-.11,deep,.026);
    stud(lidPivot,s*.56,-.22,.18,.035);
    stud(lidPivot,s*.56,-1.16,.17,.026);
  }
  for(const y of [-.23,-1.18]){
    B(lidPivot,1.27,.043,.055,0,y,-.093,satin,.016);
  }
  // The two interior studs now sit in U-shaped wall brackets, not midair.
  // The side-well casting already exists at |x|≈.815 and covers z=-.74..0.
  // Each short bracket overlaps the stud at |x|=.65 and sidewall at .815.
  // Decorative guide pipes now terminate in the actual tube saddle.
  for(const sign of [-1,1]){
    B(topFace,.19,.082,.079,sign*.772,.25,-.18,metal,.014);
    const g=group(topFace,sign*.65,.25,-.18);
    C(g,.105,.10,0,0,0,metal);
    C(g,.054,.042,0,0,.065,tinyGold);
    path(topFace,[
      [sign*.65,.25,-.18],[sign*.58,.14,-.36],
      [sign*.48,.02,-.34],[sign*.36,-.10,-.42],
      [sign*.29,-.22,-.52]
    ],.016,copper);
  }

  // The player-facing box is now fully suspended. Do not construct an
  // unrelated showroom podium or low circular trim under the cube.
  const batching=batchStaticGeometry(cube,finishedMeshes,{
    // Merge only within a single hinged face. Batching in cube coordinates
    // made the decorative geometry appear to float when panels rotated.
    panelRoots:[frontFace,backFace,leftFace,rightFace,topFace,bottomFace],
    faceRoot:frontFace.parent, // all six faces share this root before folding
    dynamicRoots:[front.drawer,side.drawer,lidPivot],
    label:"artisan"
  });
  return {
    meshCount:()=>partCount,
    getEngravedTrackAudit:()=>ornamentSummary.map(line=>({
      ...line,segments:line.segments.map(pair=>[...pair])
    })),
    getRearEyeReliefAudit:()=>rearEyeRelief.map(item=>({...item})),
    getTrimClearanceAudit:()=>({railCount:borderRails.length,
      partCount:borderRails.reduce((n,r)=>n+r.segments.length,0),
      clipped:borderRails.filter(r=>r.segments.length!==1||
       Math.abs(r.segments[0]?.length-(r.to-r.from))>.0001).length,
      faults:borderRailFaults.map(x=>({...x}))}),
    getDecorativeCornerCaps:()=>decorativeCornerCaps.map(cap=>({...cap})),
    batching,
    getLensMountAudit:()=>({
      face:frontLens.parent===frontFace?"frontFace":"unexpected",
      skinZ:.0725,backFlangeZ:.27-.181,
      barrelBottomZ:.27+lensBarrel.position.z-
       lensBarrel.geometry.parameters.height/2,
      barrelTopZ:.27+lensBarrel.position.z+
       lensBarrel.geometry.parameters.height/2,
      outerRimRearZ:.27-.031,
      glassSeatRadius:.310,
      barrelRetained:lensBarrel.parent===frontLens,
      backFlangeTouchesSkin:(.27-.181-.035)<=.0725,
      connectedToFrontRim:(.27+lensBarrel.position.z+
       lensBarrel.geometry.parameters.height/2)>.27-.031
    }),
    get quality(){return "enamel, brushed brass, smoked optics, layered hardware"},
    textures:[enamelNoise,brushedNoise]
  };
}
