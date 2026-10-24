import * as THREE from "three";
import {batchStaticGeometry} from "./secrets-3d-batching.js?v=2";

// All of these are genuine, individually lit 3D meshes, not CSS overlays.
// All coordinates below are local to their own solid cube face.
export function buildIntricateCube({
  cube, faces, front, side, lidPivot, topHole,
  box, cylinder, label, setHit, mat, animate, materials
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
  const plaque=(face,s,x,y,w=.58)=>{
    B(face,w+.08,.19,.06,x,y,.122,enamelTrim,.025);
    label(face,s,w,.106,x,y,.17,"#f5e8cc","#655e62");
    for(const dx of [-w/2,w/2])C(face,.024,.031,x+dx,y,.166,steel);
  };
  const rivet=(face,x,y,z=.15)=>{
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
  plaque(frontFace,"MODEL NO. 004",0,1.16,.98);
  const frontKnob=group(frontFace,-.95,.26,.16);
  C(frontKnob,.17,.10,0,0,.05,darkMetal);
  C(frontKnob,.13,.13,0,0,.13,gold);
  for(let i=0;i<11;i++){
    const a=i*2*Math.PI/11;
    B(frontKnob,.025,.042,.045,Math.cos(a)*.13,Math.sin(a)*.13,.21,steel,.006);
  }
  setHit(frontKnob,"optic");
  registries.optic=frontKnob;
  const statusLight=group(frontFace,1.06,.20,.21);
  C(statusLight,.12,.05,0,0,0,darkMetal);
  const bulb=C(statusLight,.074,.06,0,0,.05,ebony);
  bulb.userData.noBatch=true;registries.bulb=bulb;
  vent(frontFace,-.98,-.16,.47,4);
  vent(frontFace,.95,-.16,.47,4);

  // RIGHT: precision pressure instrument, routed pipes and switch plate.
  plates(rightFace,verdigris);
  const meter=group(rightFace,.18,.85,.14);
  C(meter,.42,.14,0,0,0,darkMetal);
  C(meter,.35,.13,0,0,.11,gold);
  C(meter,.29,.08,0,0,.21,pearl);
  ring(meter,.335,.025,0,0,.26,brass);
  for(let i=0;i<12;i++){
    const a=-Math.PI*.85+i*(Math.PI*1.7/11);
    const mark=B(meter,i%3===0?.095:.060,.012,.014,Math.cos(a)*.25,Math.sin(a)*.25,.277,darkMetal,.002);
    mark.rotation.z=a;
  }
  const needle=group(meter,0,0,.307);
  const arrow=B(needle,.24,.022,.024,-.065,0,0,copper,.004);
  arrow.rotation.z=.08;
  C(needle,.044,.028,0,0,.024,metal);
  needle.rotation.z=-.5;
  plaque(rightFace,"PRESSURE",.18,1.35,.70);
  setHit(meter,"pressure");
  registries.needle=needle;
  // independent copper tubes, clamps and inspection bolts
  for(const p of [[-.99,.72,-.99,1.16],[-.99,.72,-.68,.72],[-.68,.72,-.68,1.05]]){
    flatLine(rightFace,...p,.19,.041,copper);
  }
  for(let i=0;i<3;i++)rivet(rightFace,-.99,.77+i*.18,.23);
  const lever=group(rightFace,-.99,-1.06,.16);
  B(lever,.48,.43,.12,0,0,0,metal,.045);
  const arm=B(lever,.11,.29,.11,0,0,.13,steel,.04);
  B(lever,.24,.09,.13,0,.17,.21,ebony,.025);
  setHit(lever,"lever");registries.lever=arm;
  label(rightFace,"SVC  3-1-2",.70,.145,0,-1.27,.18,"#e2f2e7","#55737a");
  vent(rightFace,1.03,1.0,.39,3,ebony);

  // LEFT: two gears with actual teeth, a clockwork escapement, and grille.
  plates(leftFace,copper);
  plaque(leftFace,"MAKER'S SERVICE",0,1.27,1.15);
  const wheelA=gear(leftFace,-.48,.33,.22,.44);
  const wheelB=gear(leftFace,.44,-.25,.22,.29,steel,9);
  registries.wheelA=wheelA;registries.wheelB=wheelB;
  flatLine(leftFace,-.48,.33,.44,-.25,.20,.09,darkMetal);
  for(let i=0;i<4;i++)vent(leftFace,-.97,-.93+i*.23,.43,4);
  const latch=group(leftFace,.84,.63,.18);
  B(latch,.26,.55,.13,0,0,.04,metal,.035);
  const latchHandle=B(latch,.18,.12,.18,0,.10,.17,ivory,.035);
  setHit(latch,"service-latch");registries.latchHandle=latchHandle;

  // BACK: real optical housing and clockwork collar around the existing lens.
  plates(backFace,verdigris);
  edgeTicks(backFace,0,-.18,.95,32);
  const lensGuard=group(backFace,0,-.18,.10);
  ring(lensGuard,.97,.043,0,0,.045,metal);
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5;
    const riv=C(lensGuard,.043,.035,Math.cos(a)*.84,Math.sin(a)*.84,.13,brass);
    riv.rotation.z=a;
  }
  // A low-profile backing collar for the ONE real iris control. The old
  // oversized raised clock-shaped dial duplicated the touch target and
  // physically overlapped its grille and label. This slim bezel sits UNDER
  // the actuator in the physical hotspot module; it has no second hit target.
  const backKnob=group(backFace,1.055,-1.30,.139);
  backKnob.userData.noBatch=true; // animated retaining ring must remain real, not frozen into a static batch
  C(backKnob,.156,.033,0,0,0,darkMetal);
  ring(backKnob,.142,.015,0,0,.016,brass);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const tick=B(backKnob,.027,.010,.012,Math.cos(a)*.131,Math.sin(a)*.131,.020,steel,.003);
    tick.rotation.z=a;
  }
  registries.backKnob=backKnob;
  plaque(backFace,"I SEE YOU",0,-1.36,.82);

  // TOP: telescopic hinge barrel, lid brackets, engraved hatch, gears below.
  plates(topFace,brass);
  plaque(topFace,"UPPER HATCH",0,-1.21,1.03);
  for(const x of [-.64,-.29,.06,.41,.65]){
    const riv=C(topFace,.060,.06,x,topHole.h/2,.21,steel);
    riv.rotation.z=Math.PI/2;
  }
  for(const x of [-.55,.55]){
    B(lidPivot,.19,.19,.10,x,-.21,.14,metal,.03);
    raisedScrew(lidPivot,x,-.21,.20);
    B(lidPivot,.18,.13,.06,x,-.95,.13,brass,.02);
  }
  B(lidPivot,1.22,.06,.06,0,-1.04,.13,metal,.02);
  const latchTop=group(topFace,0,-topHole.h/2-.16,.18);
  B(latchTop,.44,.17,.11,0,0,0,metal,.025);
  const tooth=B(latchTop,.17,.12,.13,0,0,.09,ivory,.02);
  setHit(latchTop,"hatch-latch");registries.tooth=tooth;
  for(const x of [-.24,.32]){
    gear(topFace,x,.12,-.51,.14,gearMetal,9);
  }

  // BOTTOM: actual shock-absorbing feet and circular lockwork.
  plates(bottomFace,satin);
  for(const x of [-1,1])for(const y of [-1,1]){
    const foot=group(bottomFace,x*1.08,y*1.08,.16);
    C(foot,.23,.18,0,0,.04,rubber);
    C(foot,.16,.02,0,0,.155,darkMetal);
    raisedScrew(foot,0,0,.19);
  }
  const baseDial=group(bottomFace,0,0,.15);
  C(baseDial,.67,.10,0,0,0,metal);
  C(baseDial,.53,.12,0,0,.08,satin);
  ring(baseDial,.60,.035,0,0,.15,brass);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    flatLine(baseDial,Math.cos(a)*.28,Math.sin(a)*.28,Math.cos(a)*.46,Math.sin(a)*.46,.16,.026,ivory);
  }
  C(baseDial,.16,.14,0,0,.19,gold);
  setHit(baseDial,"underside");registries.baseDial=baseDial;
  plaque(bottomFace,"NOTHING BELOW",0,-1.17,1.10);

  // Drawer interiors: fitted lining, runners and articulated possessions.
  for(const [obj,name] of [[front,"LAVENDER"],[side,"TEAL"]]){
    const g=obj.drawer;
    B(g,1.04,.031,.50,0,-.272,-.26,felt,.01);
    for(const x of [-.43,.43]){
      B(g,.041,.32,.54,x,-.11,-.26,metal,.01);
      for(const z of [-.47,-.26,-.05]) B(g,.068,.07,.060,x,-.11,z,steel,.01);
    }
    for(const x of [-.27,.27])B(g,.07,.25,.034,x,-.11,-.57,ivory,.012);
    // telescoping drawer guide visible only during extension
    for(const x of [-.59,.59]){
      B(g,.035,.045,.63,x,-.04,-.27,darkMetal,.01);
      B(obj.cavity,.047,.039,.66,x,-.04,-.39,metal,.01);
    }
    B(g,.22,.035,.08,0,.22,.28,metal,.009);
    B(g,.10,.052,.10,0,.22,.335,ivory,.015);
    label(g,name,.43,.066,0,-.29,.263,"#f3e6de","#6c6267");
  }
  // Align the detailed metalwork with the original collectible body: one
  // complete key is visible, never two overlapping pickups.
  const frontKey=group(front.drawer,.06,-.10,-.12);
  ring(frontKey,.105,.026,-.19,0,0,gold);
  B(frontKey,.38,.06,.06,.03,0,0,gold,.015);
  B(frontKey,.064,.11,.065,.18,-.045,0,gold,.008);
  const sideThread=group(side.drawer,0,-.09,-.19);
  sideThread.rotation.z=.40;
  for(let i=0;i<7;i++)ring(sideThread,.12+i*.007,.012,0,0,.05-i*.039,copper);

  // Physical scratch marks, satin brushed blocks and index screws at the edge
  // of each panel. These are all visible from rotating the scene.
  for(const f of [frontFace,leftFace,rightFace,topFace,bottomFace,backFace]){
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
    pose(arm,"rotation","x",s.mouse?-.46:0);
    pose(latchHandle,"position","y",s.serviceOpen?-.12:.10);
    pose(backKnob,"rotation","z",s.back?Math.PI/2:0);
    pose(baseDial,"rotation","z",s.bottom?Math.PI/3:0);
    pose(tooth,"position","z",s.top?-.06:.09);
    bulb.material=live.light?activeBulbMaterial:restoredBulbMaterial;
    // Collected components must physically disappear from the tray. Their
    // inventory record remains in the original saved 60-secret engine.
    frontKey.visible=!s.drawerTaken;
    sideThread.visible=!s.sideTaken;
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
    dynamicRoots:[front.drawer,side.drawer,lidPivot,wheelA,wheelB],
    protectedMeshes:[bulb,...irisBlades],
    label:"precision"
  });
  return {
    meshCount:()=>detailsCount,
    batching,
    actions:Object.keys(labels),
    getState:()=>({...live}),
    syncGameState,
    getCollectibleVisibility:()=>({tooth:frontKey.visible,thread:sideThread.visible}),
    operate
  };
}
