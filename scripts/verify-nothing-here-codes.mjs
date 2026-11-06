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
assert(worlds.includes('elevator:!!s.serialRead||!!(s.watch&&s.tag)||!!s.floorFour||!!s.train'),
 "The side lift regressed to an unnecessary story dependency");
assert(!logic.includes("item==='starmap'&&thing==='elevator'&&s.floorFour"),
 "Star chart requires floor four again");
// Keep the observatory's roof a real barrel-vault garage enclosure:
// a constant-height arch sliding back to a fixed, full-height rear quarter.
for(const part of [
 '["moth","topFace",-1.15,.21],["telescope","topFace",0,-1.17]',
 'const OBSERVATORY_RADIUS=.275,OBSERVATORY_SEAM=.012;',
 'const OBSERVATORY_REAR=Math.PI/4;',
 'const OBSERVATORY_SLAT_COUNT=16;',
 'item.stand.visible=false;item.fixture.position.z=.060;',
 'item.mountRing=B(g,.59,.585,.023,0,0,-.012,m.brass,.047);',
 'B(g,.572,.568,.022,0,0,.002,m.cream,.044);',
 'B(g,.028,.462,.041,side*.266,-.031,.030,m.cream,.009);',
 'B(g,.534,.024,.020,0,-.269,.029,m.cream,.008);',
 'const domeStrip=(thetaA,thetaB,radius=OBSERVATORY_RADIUS)=>{',
 'positions.push(radius*Math.cos(phi),',
 'OBSERVATORY_RADIUS*2*theta/Math.PI,radius*Math.sin(phi));',
 'normals.push(Math.cos(phi),0,Math.sin(phi));',
 'domeStrip(thetaStart,thetaEnd,OBSERVATORY_RADIUS-.007)',
 'observatoryPanels.push({panel,thetaStart,thetaEnd});',
 'observatoryRearCap=new THREE.Mesh(domeStrip(OBSERVATORY_REAR,Math.PI/2),m.cream);',
 'domeStrip(OBSERVATORY_REAR+.014,Math.PI/2,OBSERVATORY_RADIUS-.018),burgundy',
 'const burgundy=mat(0x79413e,.13,.74);',
 'const canopyEdge=[],insideBraces=[.91,1.15,1.39];',
 'wire(roofShell,canopyEdge,.012,m.cream);',
 'observatoryRoller.rotation.x=travel*2.6;',
 'const begin=thetaStart+travel,end=thetaEnd+travel;',
 'position.setXYZ(id,(OBSERVATORY_RADIUS-.007)*nx,',
 'normal.setXYZ(id,nx,0,nz);',
 'panel.geometry.computeBoundingSphere();',
 'observatoryScope.position.set(0,.145,.021);',
 'observatoryScope.scale.setScalar(.77);',
 'telescopeLensGlass=C(tube,.063,.011,0,0,.151,m.glass,"z");',
 'telescopeIrisGlass=C(tube,.032,.012,.145,0,-.020,m.glass,"x");',
 'gsap.to(observatoryShutter,{',
 'progress:1,duration:3.15,ease:"power2.inOut",',
 'retainedDomeFraction:(Math.PI/2-OBSERVATORY_REAR)/Math.PI,'
]) assert(worlds.includes(part),
 'The barrel-vault observatory or its retracting roof is missing: '+part);
assert(!worlds.includes('const parapetOutline=new THREE.Shape();')&&
 !worlds.includes('const wallGeometry=new THREE.ExtrudeGeometry(parapetOutline,')&&
 !worlds.includes('C(g,.268,.014,0,0,.019,mat(0xb9aea1')&&
 !worlds.includes('observatoryLift')&&
 !worlds.includes('observatoryDoors')&&
 !worlds.includes('instance.lift.position'),
 'The old circular bowl or rising observatory mechanism returned');
// The roof's equator, its metal socket and the telescope all stay fixed.
assert(worlds.includes('domeSeamHeight:items.get("telescope")?.fixture.position.z+')&&
 worlds.includes('roofShell.position.z=OBSERVATORY_SEAM;g.add(roofShell);')&&
 worlds.includes('C(g,.256,.052,0,0,-.018,m.dark,"z");')&&
 preview.includes('observatoryButtonBase.position.set(0,-.476,-.218);')&&
 preview.includes('cylinder(chamber,.078,.530,0,-.476,-.475,darkMetal);')&&
 hotspots.includes('const flute=node(topFace,-.74,-1.12,.17);')&&
 finish.includes('if(face===topFace&&s===-1){')&&
 finish.includes('const traces=[')&&
 finish.includes('{y:-1.22,z:.105,width:.030,depth:.041,material:accent,')&&
 finish.includes('{y:-1.125,z:.112,width:.010,depth:.016,material:deep,')&&
 finish.includes('B(face,trace.end-begin,trace.width,trace.depth,')&&
 finish.includes('C(face,.027,.012,x,y,.076,metal);')&&
 finish.includes('torus(face,.026,.005,x,y,.096,accent);')&&
 !finish.includes('const leads=[')&&
 !finish.includes('const goldBypass=[')&&
 !finish.includes('const inkBypass=[')&&
 preview.includes('triangle:"Lid release button",')&&
 logic.includes('The lid release button sinks in.'),
 "The roof dome is no longer centered/recessed or its trim/button clearance regressed");
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
