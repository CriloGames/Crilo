import * as THREE from "three";
import {batchStaticGeometry} from "./secrets-3d-batching.js?v=2";

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
  function machinedPanel(face,accent) {
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
      }else if(face===frontFace&&s===1){
        // End the gold and graphite border strips beside the raised
        // circular lens instead of continuing straight through its rim.
        // The round sleeve takes the place of the missing middle span.
        const rails=[
          {half:1.29,stop:.56,y:1.22,z:.105,h:.030,d:.041,paint:accent,r:.012},
          {half:1.20,stop:.66,y:1.125,z:.130,h:.010,d:.024,paint:deep,r:.004}
        ];
        for(const rail of rails)for(const sign of [-1,1]){
          const length=rail.half-rail.stop;
          B(face,length,rail.h,rail.d,
            sign*(rail.stop+length/2),rail.y,rail.z,
            rail.paint,rail.r);
        }
      }else{
        B(face,2.58,.030,.041,0,s*1.22,.105,accent,.012);
        B(face,2.40,.010,.024,0,s*1.125,.13,deep,.004);
      }
      B(face,.030,2.52,.041,s*1.22,0,.105,accent,.012);
      B(face,.010,2.40,.024,s*1.125,0,.13,deep,.004);
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
  torus(frontLens,.758,.035,0,0,-.181,metal); // touches enamel
  torus(frontLens,.758,.020,0,0,-.018,deep); // joins front rim
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
  torus(frontLens,.310,.024,0,0,.145,deep);
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
      B(g,w+.24,t,.12,0,s*(h/2+.07),0,brass,.019);
      B(g,t,h+.18,.12,s*(w/2+.07),0,0,brass,.019);
      for(const X of [-w/2+.08,w/2-.08])stud(g,X,s*(h/2+.07),.085,.027);
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
    dynamicRoots:[front.drawer,side.drawer,lidPivot],
    label:"artisan"
  });
  return {
    meshCount:()=>partCount,
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
