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
    C(g,r,.033,x,y,z,brass);
    const groove=B(g,r*.94,.012,.008,x,y,z+.023,deep,.003);
    groove.rotation.z=Math.PI/4;
  };
  // A manufactured edge has two separate flush trims, narrow gasket line,
  // and corner fasteners. Keep edges inside the real shell.
  function machinedPanel(face,accent) {
    for(const s of [-1,1]){
      B(face,2.58,.030,.041,0,s*1.22,.105,accent,.012);
      B(face,.030,2.52,.041,s*1.22,0,.105,accent,.012);
      B(face,2.40,.010,.024,0,s*1.125,.13,deep,.004);
      B(face,.010,2.40,.024,s*1.125,0,.13,deep,.004);
    }
    for(const x of [-1.22,1.22])for(const y of [-1.22,1.22]){
      C(face,.092,.045,x,y,.15,darkMetal);
      C(face,.068,.042,x,y,.185,tinyGold);
      stud(face,x,y,.212,.035);
    }
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
  torus(frontLens,.76,.031,0,0,0,tinyGold);
  torus(frontLens,.69,.014,0,0,.03,deep);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    const s=B(frontLens,i%4===0?.11:.05,.012,.015,Math.cos(a)*.73,Math.sin(a)*.73,.05,deep,.003);
    s.rotation.z=a;
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
  C(frontLens,.045,.06,-.085,.09,.235,cream);
  // Real conduit loops, small terminals and raised switch labels.
  path(frontFace,[[-.91,.02,.13],[-.82,.13,.20],[-.63,.16,.21],[-.59,.33,.18]],.018,copper);
  path(frontFace,[[.91,.04,.13],[.85,.20,.23],[.65,.26,.21],[.61,.38,.18]],.018,copper);
  for(const x of [-.91,.91]){
    B(frontFace,.21,.12,.075,x,.04,.18,darkMetal,.024);
    stud(frontFace,x,.04,.24,.031);
  }
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

  // Side: visible copper pipes have elbows, collars, clamps and service seals.
  path(rightFace,[[-.94,1.22,.19],[-.94,.94,.19],[-.84,.83,.22],[-.76,.83,.21]],.026,copper);
  path(rightFace,[[.95,.20,.18],[1.04,.11,.23],[1.04,-.64,.22],[.87,-.81,.20]],.026,copper);
  for(const y of [.98,.42,-.13,-.57]){
    B(rightFace,.24,.09,.07,1.04,y,.25,metal,.023);
    stud(rightFace,1.04,y,.30,.021);
  }
  for(const x of [-1.01,.98])for(const y of [-.38,-.21]){
    B(rightFace,.17,.029,.035,x,y,.20,cream,.005);
  }

  // Other faces: authentic enamel-backed vent cavities, their louvers
  // floating above the recessed opening, tiny copper mechanical feed lines.
  // The rear face has its own compact, integrated iris grille. Adding
  // the old generic vent there produced an overlapping, unreadable stack.
  for(const face of [leftFace,bottomFace]){
    const g=group(face,.83,-.95,.14);
    B(g,.69,.36,.06,0,0,0,brass,.042);
    B(g,.57,.25,.068,0,0,.049,deep,.024);
    for(let i=0;i<7;i++){
      B(g,.46,.017,.021,0,(i-3)*.031,.094,satin,.004);
    }
    for(const s of [-1,1])stud(g,s*.28,0,.109,.023);
  }
  for(const face of [leftFace]){
    const end=.92;
    path(face,[[-1.04,-1.01,.19],[-.74,-1.01,.18],[-.64,-.91,.18],[-.64,-.69,.18]],.016,copper);
    for(const y of [-.98,-.74])B(face,.12,.045,.048,-.63,y,.21,steelFinish(),.01);
  }
  function steelFinish(){return satin}

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
  // Hatch interior retaining studs and wire guides, mounted to fixed top.
  for(const s of [-1,1]){
    const g=group(topFace,s*.65,.25,-.18);
    C(g,.105,.10,0,0,0,metal);
    C(g,.054,.042,0,0,.065,tinyGold);
    path(topFace,[[s*.58,.14,-.36],[s*.48,.02,-.34],[s*.36,-.10,-.42]],.016,copper);
  }

  // The player-facing box is now fully suspended. Do not construct an
  // unrelated showroom podium or low circular trim under the cube.
  const batching=batchStaticGeometry(cube,finishedMeshes,{
    dynamicRoots:[front.drawer,side.drawer,lidPivot],
    label:"artisan"
  });
  return {
    meshCount:()=>partCount,
    batching,
    get quality(){return "enamel, brushed brass, smoked optics, layered hardware"},
    textures:[enamelNoise,brushedNoise]
  };
}
