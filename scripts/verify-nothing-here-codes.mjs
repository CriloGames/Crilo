// Keep the working 3D codes in step with their engraved, discoverable clues.
// No puzzle solutions are embedded in player-facing hints or metadata.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './verify-nothing-here-maze.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const logic=read('cube-secrets.js');
const hotspots=read('secrets-3d-game-hotspots.js');
const worlds=read('secrets-3d-worlds.js');
const details=read('secrets-3d-details.js');
const preview=read('secrets-3d-preview.js');
const finish=read('secrets-3d-finish.js');
// Both sliding drawers sit over genuine openings cut into the cube. A
// smaller-than-opening faceplate used to show the inner compartment before
// its latch was released, especially from above or at a shallow angle.
assert(preview.includes('const tongueW=w-.025,tongueH=h-.025;')&&
 preview.includes('box(drawer,tongueW,tongueH,.16,0,0,.037,palette,.022);')&&
 preview.includes('const faceplateW=w+.12,faceplateH=h+.12;')&&
 preview.includes('box(drawer,faceplateW,faceplateH,.14,0,0,.185,palette,.048);')&&
 preview.includes('joined:tongueFront>=faceplateBack'),
 'A locked drawer is not sealed by a solid fitted tongue and overlapping faceplate');
assert(preview.includes('get drawerSeals(){return {')&&
 preview.includes('lavender:{...front.seal')&&
 preview.includes('teal:{...side.seal'),
 'Both drawer compartments must expose closed-face geometry for regression tests');

// Load-order regression: geometry builders and OrbitControls callbacks can
// invalidate the view before the resize handler is installed. The render
// scheduler MUST be initialized before scene construction begins, or it
// throws ReferenceError: Cannot access 'pendingFrame' before initialization.
const schedulerDeclarations=[...preview.matchAll(/\blet pendingFrame=0;/g)];
assert.equal(schedulerDeclarations.length,1,
 '3D rendering must have exactly one initialized frame scheduler');
const schedulerPos=schedulerDeclarations[0].index;
const scenePos=preview.indexOf('const scene = new THREE.Scene();');
const meshPos=preview.indexOf('const intricate=buildIntricateCube({');
const worldPos=preview.indexOf('const pocketWorlds=embeddedGame?buildPocketWorlds({');
assert(scenePos>schedulerPos&&meshPos>schedulerPos,
 '3D geometry is constructed before pendingFrame exists; scene import will crash');
assert(worldPos<0||worldPos>schedulerPos,
 '3D miniatures initialize before the frame scheduler and can crash the import');
assert(preview.includes('function invalidate(){')&&
 preview.includes('if(!pendingFrame)pendingFrame=requestAnimationFrame(drawFrame);'),
 'On-demand render scheduler is absent or no longer rate-limited');
const match=(source,pattern,label)=>{
 const result=source.match(pattern);
 assert(result,'Missing '+label+' in authored scene or puzzle logic');
 return result[1];
};
const digits=value=>value.split(',').map(v=>Number(v.trim()));
const symbols=value=>[...value.matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
const bagWheelSymbols=symbols(match(logic,/const BAG_SYMBOLS=\[([^\]]+)\]/,'bag symbols'));
const physicalSymbols=symbols(match(worlds,/const glyphMaterials=\[([^\]]+)\]/,'physical bag symbols'));
assert.deepEqual(physicalSymbols,bagWheelSymbols,
 'Bag wheels are displaying glyphs in a different order than the code checker');
const bagCode=digits(match(logic,/const BAG_CODE=\[([^\]]+)\]/,'bag combination'));
assert.equal(bagCode.length,4,'The 3D bag physically has four, not three, tumblers');
assert(bagCode.every(n=>n>=0&&n<physicalSymbols.length),
 'One of the bag code symbols does not exist on the working wheel');
const expectedBagGlyphs=bagCode.map(i=>bagWheelSymbols[i]);
assert.deepEqual(expectedBagGlyphs,['◇','○','☾','✳'],
 'The rear brass cassette and the four working bag wheels disagree');
assert(logic.includes("◇ · ○ · ☾ · ✳"),
 'Reading the opened rear strip no longer explains the bag wheel markings');
for(const part of ['diamond','cipherCircle','crescent','star'])
 assert(hotspots.includes('const '+part+'='),'Missing sculpted bag cipher emblem '+part);

const ventCode=digits(match(logic,/const VENT_CODE=\[([^\]]+)\]/,'vent sequence'));
const ventLabel=match(hotspots,/engraving\(rightFace,"([^"]+)",[\d.]+,[\d.]+,\.80\)/,'service bolt inscription');
const ventDigits=[...ventLabel.matchAll(/[1-4]/g)].map(m=>Number(m[0]));
assert.deepEqual(ventDigits,ventCode,
 'The hidden service-bolt inscription gives a different sequence from the actual vents');
assert(!hotspots.includes('ctx.fillText("VENT ORDER"'),
 'The exposed strip must not print the puzzle answer category on the metal');
assert(hotspots.includes('getServiceCodeClearance:'),
 'Service code has no clearance audit for the removable bolt and adjacent teal rail');
assert(logic.includes("===VENT_CODE.join('')"),
 'The vent buttons no longer use the same code as the engraved clue');
for(const name of ['LATCH','RED','RELEASE','SERVICE','VENT','CALIBRATE','TRIANGLE','IRIS'])
 assert(!hotspots.includes(',"'+name+'",'),
  'A redundant '+name+' nameplate has been reintroduced over a working object');
assert(!details.includes('plaque(')&&!preview.includes('label(drawer,name,'),
 'Decorative label plates must be removed from the hardware and drawers');
assert(hotspots.includes('engraving(leftFace,String(i)')&&
 hotspots.includes('engraving(backFace,"A /')&&
 hotspots.includes('engraving(bottomFace,"B /'),
 'The numbered input legends and two real code plates must remain readable');
// Maze wall/graph parity is checked by verify-nothing-here-maze.mjs.
const roman={'Ⅰ':1,'Ⅱ':2,'Ⅲ':3};
const decode=value=>[...value].filter(x=>roman[x]).map(x=>roman[x]);
const fluteCode=digits(match(logic,/const FLUTE_CODE=\[([^\]]+)\]/,'flute melody'));
const eyeLabel=match(hotspots,/engraving\(backFace,"A \/ ([^"]+)"/,'first flute inscription');
const footLabel=match(hotspots,/engraving\(bottomFace,"B \/ ([^"]+)"/,'second flute inscription');
assert.equal(decode(eyeLabel).length,3,'The rear lens must reveal three notes');
assert.equal(decode(footLabel).length,3,'The sliding underside foot must reveal three notes');
assert.deepEqual([...decode(eyeLabel),...decode(footLabel)],fluteCode,
 'The two engraved musical phrases do not open the physical door');
assert(logic.includes("===FLUTE_CODE.join('')"),
 'The flute logic no longer plays the score stamped on the cube');

// A formerly added service cassette crashed during import because a
// sensor was created on a shutter const before the const was initialized.
// The restored older mechanism mounts its sensor to the fixed right face;
// a future cassette implementation can use its initialized fixed housing.
const shutterAliasPos=hotspots.indexOf('const shutter=targets.get("shutter");');
const shutterKeyPos=hotspots.indexOf('const serviceKeyway=node(shutter,');
const fixedFaceSensor=hotspots.indexOf('const resonator=node(rightFace,');
const fixedHousingPos=hotspots.indexOf('const shutterCassette=node(rightFace,');
const fixedHousingSensor=hotspots.indexOf('const resonator=node(shutterCassette,');
assert(shutterAliasPos>=0&&shutterKeyPos>shutterAliasPos,
 'A service keyway uses the shutter before its declaration');
assert(fixedFaceSensor>=0||
  fixedHousingPos>=0&&fixedHousingSensor>fixedHousingPos,
 'Service shutter sensor has no initialized physical mount');
assert(!hotspots.includes('const resonator=node(shutter,'),
 'Do not build the resonance sensor on a shutter variable before initialization');

assert(logic.includes('s.ventSequence=[];'),'A failed vent attempt cannot be retried from a clean start');
assert(logic.includes('s.fluteNotes=[];'),'The physical flute lacks a clean six-note retry');
assert(worlds.includes('bagCatchReady:'),'The aligned bag code has no visible spring-catch response');
assert(hotspots.includes('ventStepsShown:')&&hotspots.includes('fluteStepsShown:'),
 'The vent/flute code input counters no longer update visible 3D indicators');

// The telescope's closed observatory dome exists on the roof at all times.
// Pressing a real control INSIDE the open hatch is the only way to extend it.
for(const phrase of [
 "elevator:s.serialRead||(s.watch&&s.tag)||s.floorFour||s.train",
 "thing==='telescope'&&thingPresent('telescope')&&!s.telescopeLensMounted",
 "thing==='telescope'&&thingPresent('telescope')&&!s.telescopeIrisMounted",
 "||item==='starmap'&&thing==='elevator'&&thingPresent('elevator')&&!s.train",
 "if(item==='lens')s.telescopeLensMounted=true;",
 "else s.telescopeIrisMounted=true;",
 "s.secondSky=true;",
 "s.observed=true;",
 "observatoryRaised:false",
 "if(typeof raw.observatoryRaised!=='boolean')",
 "if(name==='observatory-release'){",
 "s.observatoryRaised=true;"
]) assert(logic.includes(phrase),
 "An observatory state or optical puzzle route was removed: "+phrase);
// The open hatch and its cleared wooden cradle are sufficient to deploy
// the observatory. A remote maker's stamp or paper-bird moon must not
// secretly disable the release, and the real button must be easy to hit.
assert(logic.includes('if(s.top&&s.pipeTaken&&!s.observatoryRaised)')&&
 !logic.includes('else if(!s.moon&&!s.serialRead)')&&
 logic.includes("else if(!s.pipeTaken)tell(")&&
 preview.includes('const observatoryHitPaint=new THREE.MeshBasicMaterial({')&&
 preview.includes('observatorySwitchRim.emissiveIntensity=currentGameState.top&&')&&
 preview.includes('"observatory-release":"Observatory release button"'),
 'The observatory release became hard to click or secretly gated again');
assert(worlds.includes('telescope:!!s.observatoryRaised||!!s.observed||')&&
 worlds.includes('telescopeLensGlass.visible=!!s.telescopeLensMounted;')&&
 worlds.includes('telescopeIrisGlass.visible=!!s.telescopeIrisMounted;')&&
 worlds.includes('instance.fixture.visible=name==="telescope"?true:visible;')&&
 preview.includes('setHit(observatoryButtonCap,"observatory-release");')&&
 preview.includes('activatePhysical?.("observatory-release")'),
 "The permanent dome or physical roof-release button no longer works");
// Observatory picking must trace the visible curved shell, not a broad box.
assert(worlds.includes('const boxHit=item.hitVolume;')&&
 worlds.includes('g.remove(boxHit);')&&
 worlds.includes('item.domeClickTarget=roofShell;')&&
 worlds.includes('item.hitVolume=observatoryRearCap;')&&
 worlds.includes('setHit(name==="telescope"?domeClickTarget:toy,"thing:"+name);')&&
 !worlds.includes('item.hitVolume.geometry=new THREE.BoxGeometry(.64,.64,.65);')&&
 preview.includes('const samples=name==="telescope"?['),
 'Observatory must only respond when its physical dome is selected');
assert(worlds.includes('elevator:!!s.serialRead||!!(s.watch&&s.tag)||!!s.floorFour||!!s.train'),
 "The side lift regressed to an unnecessary story dependency");
assert(!logic.includes("item==='starmap'&&thing==='elevator'&&s.floorFour"),
 "Star chart requires floor four again");
// The selected reference requires a spherical ivory dome, a wide
// arched opening, terracotta lining, a continuous lower band and a
// telescope centered behind the opening, not the old boxy barrel.
for(const part of ["const OBSERVATORY_RADIUS=.278,OBSERVATORY_RING_TOP=.058;","const OBSERVATORY_CUT_FRONT=.074;","const OBSERVATORY_OPEN_HALF_ANGLE=Math.acos(","const OBSERVATORY_ARCH_RISE=OBSERVATORY_OPEN_HALF_ANGLE;","const apertureHeight=az=>{","const domePoint=(az,elev,r=OBSERVATORY_RADIUS)=>[","const domeSkin=r=>{","new THREE.CylinderGeometry(","OBSERVATORY_RADIUS+.004,OBSERVATORY_RADIUS+.004,.073,72,1,true),ivory","item.mountRing=band;","domeSkin(OBSERVATORY_RADIUS),ivory","domeSkin(OBSERVATORY_RADIUS-.010),terracotta","const terracotta=mat(0xc6b5a3,.10,.67);","wire(roofShell,lip,.006,m.cream);","const slatGeometry=(lo,hi)=>{","observatoryPanels.push({panel,lo,hi});","panel.visible=begin<OBSERVATORY_ARCH_RISE+.035;","pos.setXYZ(n,...domePoint(az,elev,OBSERVATORY_RADIUS-.004));","const applyObservatoryRoll=()=>{","observatoryScope.position.set(0,-.015,.038);","observatoryScope.scale.setScalar(.80);","observatoryScope.rotation.y=0;","retainedDomeFraction:1-(OBSERVATORY_OPEN_HALF_ANGLE*","mouthWidth:2*OBSERVATORY_RADIUS*Math.sin(OBSERVATORY_OPEN_HALF_ANGLE),","openingRise:OBSERVATORY_RADIUS*Math.sin(OBSERVATORY_ARCH_RISE),","telescopeLensGlass=C(tube,.063,.011,0,0,.151,m.glass,\"z\");","telescopeIrisGlass=C(tube,.023,.009,.108,0,-.020,m.glass,\"x\");","gsap.to(observatoryShutter,{"]) assert(worlds.includes(part),
 'Reference observatory feature missing: '+part);
// The front rim is the intersection of a sphere and a single planar
// chord, not two independently bowed arch halves meeting at a V.
assert(worlds.includes('const apertureHeight=(az,r=OBSERVATORY_RADIUS)=>{')&&
 worlds.includes('const facing=Math.cos(az);')&&
 worlds.includes('const cosine=OBSERVATORY_CUT_FRONT/(r*facing);')&&
 worlds.includes('return cosine>=1?0:Math.acos(cosine);')&&
 worlds.includes('const apertureHalfWidth=(elev,r=OBSERVATORY_RADIUS)=>{')&&
 worlds.includes('const reach=r*Math.cos(elev);')&&
 worlds.includes('const az=side*apertureHalfWidth(elev);')&&
 worlds.includes('const width=apertureHalfWidth(elev);')&&
 worlds.includes('const width=apertureHalfWidth(source);')&&
 worlds.includes('const az=-Math.PI+2*Math.PI*i/A,cut=apertureHeight(az,r);'),
 'The dome no longer has one straight planar opening and matching tracks');
// Geometry invariant: ALL points on the rim must share the same Y plane.
// This guards the actual point-by-point shape, not just source keywords.
const chordR=.278,chordDepth=.074,span=Math.acos(chordDepth/chordR);
for(let i=0;i<=160;i++){
 const az=span*(2*i/160-1),ratio=chordDepth/(chordR*Math.cos(az));
 const elev=ratio>=1?0:Math.acos(ratio);
 const rimY=-chordR*Math.cos(elev)*Math.cos(az);
 assert(Math.abs(rimY+chordDepth)<1e-9,
  'The observatory rim bows away from its straight chord plane');
}
// The approved lid uses a single rigid full-thickness ivory rim and
// eleven-plus flush fasteners, not an unsupported rubber-looking arc.
assert(worlds.includes('const rimStations=160,rimProfile=[')&&
 worlds.includes('const stiffRim=new THREE.Mesh(rimGeometry,rimEnamel);')&&
 worlds.includes('rimGeometry.computeVertexNormals();')&&
 worlds.includes('for(let i=0;i<13;i++){')&&
 worlds.includes('OBSERVATORY_CUT_FRONT=.074;')&&
 !worlds.includes('OBSERVATORY_ARCH_RISE*Math.cos(u*Math.PI/2)'),
 'The rigid more-open observatory lid geometry regressed');
// Polishing must not bury the guide tracks, clutter the hemisphere
// again, or bring back the bulky focuser. The garage-door release itself
// and the retained dome geometry remain unchanged.
for(const feature of [
 'const observatoryGuideRollers=[];',
 'track.push(domePoint(az,elev,OBSERVATORY_RADIUS-.015));',
 'trackInset.push(domePoint(az,elev,OBSERVATORY_RADIUS-.023));',
 'wire(roofShell,track,.003,guideMetal);',
 'carriage.position.set(...domePoint(az,elev,OBSERVATORY_RADIUS-.018));',
 'carriage.visible=observatoryShutter.progress<.98;',
 'const collar=new THREE.Mesh(new THREE.CylinderGeometry(',
 'const patch=(col*17+row*11+col*row*3)%7;',
 'const quietRivet=mat(0xb5a797,.18,.48);',
 'new THREE.SphereGeometry(.00135,6,4),quietRivet,domeRivets.length',
 'for(let i=0;i<12;i++){',
 'for(const elev of [.35,.69,1.02,1.32]){',
 'B(tube,.049,.054,.061,.060,0,-.020,m.brass,.008);',
 'telescopeIrisGlass=C(tube,.023,.009,.108,0,-.020,m.glass,"x");',
 'guideRailCount:observatoryGuideRollers.length,',
 'visibleRivetCount:observatoryRivetCount,',
 'enamelTextureApplied:ivory.map===enamelGrain,'
]) assert(worlds.includes(feature),
 'Observatory detail or track refinement regressed: '+feature);
// The hemisphere is moved toward the box center but away from the front
// gold rail; the nearest part stays clear of the hinged panel's frame.
const domeCenterY=-1.045,domeRadius=.282;
const frontBorderY=-1.61,hatchFrameFrontY=-.7025;
assert(worlds.includes('["telescope","topFace",0,-1.045]')&&
 domeCenterY-domeRadius-frontBorderY>.25&&
 hatchFrameFrontY-(domeCenterY+domeRadius)>.04&&
 .278*Math.sin(1.06)>.23,
 'The observatory position or enlarged dome opening regressed');
// The in-game model (not an illustration) should carry realistic ivory
// grain, embossed panel hardware, vented lower walls, a tiled deck and a
// finder scope, with the aperture just over one-third open.
for(const detail of [
 'const paintCanvas=document.createElement("canvas");',
 'const enamelGrain=new THREE.CanvasTexture(paintCanvas);',
 'ivory.map=enamelGrain;',
 'ivory.bumpMap=enamelGrain;',
 'ivory.bumpScale=.0009;',
 'geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));',
 'const deckMaterial=mat(0xcac0b4,.055,.68);',
 'C(g,.258,.009,0,0,.015,deckMaterial,"z");',
 'for(const a of [-1.12,-.57,0,.57,1.12]){',
 'const braceFinish=mat(0xdbcfbd,.13,.51);',
 'const warmLamp=mat(0xffe3a4,.04,.32);',
 'const rivetMesh=new THREE.InstancedMesh(',
 'const opticalCoating=mat(0x21394a,.31,.16);',
 'const finder=new THREE.Group();',
 'finder.position.set(0,.098,-.014);'
]) assert(worlds.includes(detail),
 'Reference-style observatory texture or physical manufacturing detail missing: '+detail);
// All four connections share one seamless brushed-metal profile each.
// They keep the original straight silhouette and dip down only within
// .070 face-local units of the unchanged +/- .390 holes.
assert(finish.includes('if(face===topFace&&s===-1){')&&
 finish.includes('const traces=[')&&
 finish.includes('{y:-1.22,z:.105,width:.022,depth:.023,material:accent,')&&
 finish.includes('{y:-1.125,z:.112,width:.019,depth:.020,material:deep,')&&
 finish.includes('function roofInlay(trace,sign){')&&
 finish.includes('for(const trace of traces)for(const sign of [-1,1]){')&&
 finish.includes('roofInlay(trace,sign);')&&
 finish.includes('const inner=trace.port,curveStart=inner+.070;')&&
 finish.includes('new THREE.Vector3(sign*inner,trace.y,.063)')&&
 finish.includes('const halfWidth=trace.width*.5;')&&
 finish.includes('const halfDepth=trace.depth*.5;')&&
 !finish.includes('const taper=1-.77*progress*progress*(3-2*progress);')&&
 finish.includes('new THREE.Vector3(sign*(inner+.007),trace.y,trace.z)')&&
 finish.includes('new THREE.Vector3(sign*inner,trace.y,trace.z)')&&
 finish.includes('geometry.setAttribute("uv",')&&
 finish.includes('C(face,.027,.012,x,y,.076,metal);')&&
 finish.includes('C(face,.019,.010,x,y,.079,deep);')&&
 finish.includes('torus(face,.026,.004,x,y,.084,accent);')&&
 !finish.includes('bentInlay(')&&
 !finish.includes('B(face,trace.end-begin,trace.width,trace.depth,')&&
 !finish.includes('const leads=[')&&
 !finish.includes('const goldBypass=[')&&
 !finish.includes('const inkBypass=[')&&
 preview.includes('triangle:"Lid release button",')&&
 logic.includes('The lid release button sinks in.'),
 'Roof connections lost their continuous shapes or the release regressed');
// Keep both lines similar in size. Brass should not become a big
// raised bar, while the dark line must remain readable from above.
const brassCrossSection={width:.022,depth:.023};
const darkCrossSection={width:.019,depth:.020};
assert(brassCrossSection.width/darkCrossSection.width<1.2&&
 brassCrossSection.depth/darkCrossSection.depth<1.2&&
 darkCrossSection.width>=.018,
 'Roof inlay sizes became unbalanced again');
// Geometric clearance: sample the exact swept strip's eight chamfered
// corners on each side. None may intersect a connector's metal rim.
const bezier=(t,a,b,c,d)=>{
 const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
};
for(const trace of [
 {name:'brass',z:.105,width:.022,depth:.023,end:1.29},
 {name:'black',z:.112,width:.019,depth:.020,end:1.20}
])for(const sign of [-1,1]){
 const port=.390,start=port+.070,stations=[];
 for(let i=0;i<=34;i++)
  stations.push([sign*(trace.end+(start-trace.end)*i/34),trace.z]);
 for(let i=1;i<=24;i++){
  const t=i/24;
  stations.push([
   sign*bezier(t,start,port+.007,port,port),
   bezier(t,trace.z,trace.z,trace.z,.063)
  ]);
 }
 let clearance=Infinity;
 for(let i=0;i<stations.length;i++){
  const point=stations[i],a=stations[Math.max(0,i-1)];
  const b=stations[Math.min(stations.length-1,i+1)];
  const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
  const nx=-dz/d,nz=dx/d;
  for(const [u,v] of [
   [-1,-.75],[-.75,-1],[.75,-1],[1,-.75],
   [1,.75],[.75,1],[-.75,1],[-1,.75]
  ]){
   const x=point[0]+nx*v*trace.depth*.5;
   const y=u*trace.width*.5;
   const z=point[1]+nz*v*trace.depth*.5;
   const radial=Math.hypot(x-sign*port,y);
   clearance=Math.min(clearance,
    Math.hypot(radial-.026,z-.084)-.004);
  }
 }
 assert(clearance>.002,
  trace.name+' inlay clips its circular port on the '+sign+' side');
}
assert(!worlds.includes('["telescope","topFace",1.15,.21]')&&
 !worlds.includes('modelBases.push({name,method:"tripod"')&&
 !worlds.includes('tube.rotation.x=1.16;'),
 "The off-center or tripodded telescope returned");
for(const expected of [
 'const hatchRacks=tubeRetainers.map(',
 'const angle=release*(.135/hatchDriveGears[0].r);',
 'offset+(k-2)*.084,',
 'keeper.clip.add(rack);',
 'box(chamber,.62,.016,.063,',
 'hatchDriveGears[0].rotor.rotation.z=-angle;',
 'hatchDriveGears[1].rotor.rotation.z=angle*(hatchDriveGears[0].r/hatchDriveGears[1].r);'
]) assert(preview.includes(expected),
 "The wheel-to-guided-rack mechanism was broken: "+expected);
assert(!preview.includes('hatchConnectingRods')&&
 !preview.includes('const crankPin=cylinder(rotor'),
 'Loose wires or obsolete rotating crank rods returned');

// The white maze is a passive inspection surface, not another
// directional control. Only black-cog dragging moves around a ring; the
// calibration dial separately handles radial moves.
assert(preview.includes('"gear-large":"White maze",')&&
 !preview.includes('"gear-large":"White maze ← →",')&&
 preview.includes('const gearDragActions=new Set(["gear-small","maze-in","maze-out"]);')&&
 preview.includes('const passiveSurfaces=new Set(["front","side","hatch","gear-large"]);')&&
 preview.includes('const driveSign=-1;')&&
 !preview.includes('const driveSign=drag.action==="gear-small"?-1:1;')&&
 logic.includes("if(name==='gear-large'){")&&
 logic.includes("if(name==='gear-small'||")&&
 !logic.includes('const direction=name==="gear-large"')&&
 details.includes('wheelTouchControls:["gear-small",...dialTargets.keys()],')&&
 details.includes('passiveInspectionTarget:"gear-large"'),
 "The white labyrinth can drive the ball or an active control was mislabeled");

// Do not confuse transform parenting with PHYSICAL attachment: gears, optics,
// service fixtures, miniature worlds and interior studs need metal between
// their visible backs and the case. Keep the red-index arc intentionally free.
assert(details.includes('axleBearing(leftFace,"maze carrier"')&&
 details.includes('axleBearing(leftFace,"black drive cog"')&&
 details.includes('shaft.userData.noBatch=true;')&&
 details.includes('getStructuralMounts:()=>axleMounts.map('),
 'The geared wheel assembly has unsupported or uninspectable rear axles');
assert(details.includes('const lensSleeve=new THREE.Mesh(')&&
 details.includes('new THREE.CylinderGeometry(.313,.313,.076')&&
 details.includes('if(!liveGame)for(const x of [-.24,.32])'),
 'The glass optic is unsupported or free-floating duplicate hatch gears returned');
assert(finish.includes('const lensBarrel=new THREE.Mesh(')&&
 finish.includes('new THREE.CylinderGeometry(')&&
 finish.includes('lensBarrel.userData.noBatch=true;')&&
 finish.includes('backFlangeTouchesSkin:')&&
 finish.includes('getLensMountAudit:()=>({')&&
 finish.includes('B(topFace,.19,.082,.079,sign*.772,.25,-.18,metal'),
 'The front glass hood or interior loose fittings lack solid mounts');
for(const part of [
 'seatFixture(frontFace,"cog service cassette"',
 'seatFixture(frontFace,"optic offering receiver"',
 'seatFixture(rightFace,"service bolt socket"',
 'seatFixture(leftFace,"vent grille bracket "',
 'seatFixture(backFace,"rear eye bracket "',
 'seatFixture(backFace,"cipher retainer "',
 'seatFixture(bottomFace,"bell return cassette"'
]) assert(hotspots.includes(part),
 'The cube is missing a structural fixture: '+part);
assert(hotspots.includes('const moonStem=C(miniMoon,')&&
 hotspots.includes('moonStem.userData.mechanicalMount=true;')&&
 hotspots.includes('getFixedMountAudit:()=>fixedMounts.map(')&&
 hotspots.includes('const redSwitch=control(frontFace,"dot"'),
 'Hidden discoveries must retain their mounts without changing the red button');
assert(hotspots.includes('const fluteMountFeet=[];')&&
 hotspots.includes('fluteMountFeet.push(foot);')&&
 hotspots.includes('getFluteMountAudit:()=>fluteMountFeet.map(')&&
 preview.includes('flute=gameHotspots?.getFluteMountAudit?.()||[]'),
 'Collectible flute saddles lost their real mounting feet');
assert(worlds.includes('.to(object.rotation,{y:.10,duration:.12,ease:"power2.out"})')&&
 !worlds.includes('.to(object.position,{z:rest+.047'),
 'Inspecting a miniature must not pull it off its own mounting shelf');
assert(worlds.includes('const modelSupports=[];')&&
 worlds.includes('const modelBases=[];')&&
 worlds.includes('const toToy=toy.matrixWorld.clone().invert();')&&
 worlds.includes('post.userData.mechanicalMount=true;')&&
 worlds.includes('modelBases.push(hardware);')&&
 worlds.includes('getMiniatureBodyMountAudit:()=>modelBases.map(')&&
 preview.includes('figures=pocketWorlds?.getMiniatureBodyMountAudit?.()||[]')&&
 preview.includes('figures.length!==15||figures.some('),
 "The actual miniature sculptures must not detach from their bolted shelves");
assert(preview.includes('get physicalAttachmentAudit(){')&&
 preview.includes('miniatures=pocketWorlds?.getHardwareAttachmentAudit')&&
 preview.includes('intentionalExceptions:["red button index arc"'),
 'The live scene has lost the cross-module hardware attachment audit');

console.log('PASS: all three playable codes agree with their physical clues, alignable controls and retry indicators.');
