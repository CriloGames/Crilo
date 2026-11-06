// Keep the working 3D codes in step with their engraved, discoverable clues.
// No puzzle solutions are embedded in player-facing hints or metadata.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const logic=read('cube-secrets.js');
const hotspots=read('secrets-3d-game-hotspots.js');
const worlds=read('secrets-3d-worlds.js');
const details=read('secrets-3d-details.js');
const preview=read('secrets-3d-preview.js');
// The previous six-ring rewrite accidentally assumed Array.from supplies
// the output array as a third mapper argument. It does not, and the whole
// WebGL scene failed during construction with 'undefined.length'.
assert(details.includes('const count=Math.max(5,Math.ceil(Math.abs(a1-a0)*radius*150))')&&
 details.includes('i/(count-1)')&&
 !details.includes('(_,i,arr)=>')&&!details.includes('arr.length'),
 'Curved maze wall sampling uses an undefined Array.from third argument');
// Execute the wall-sampling helper with a tiny Three.js geometry stub.
// This catches runtime problems such as undefined.length even when the full
// module has valid JavaScript syntax and the static string checks pass.
const arcStart=details.indexOf('const curvedWall=(radius,a0,a1)=>{');
const arcEnd=details.indexOf('// Merge consecutive CLOSED',arcStart);
assert(arcStart>=0&&arcEnd>arcStart,
 'The physical labyrinth lost its curved-wall generator');
const curveResults=[];
const checkArc=new Function('THREE','strokeWall',
 details.slice(arcStart,arcEnd)+
 '\ncurvedWall(.29,-Math.PI/2,Math.PI/2);'+
 '\ncurvedWall(.046,0,Math.PI*2);');
checkArc({
 Vector3:class{
  constructor(x,y,z){
   assert([x,y,z].every(Number.isFinite),
    'Non-finite carved-wall vertex during geometry construction');
   this.x=x;this.y=y;this.z=z;
  }
 },
 CatmullRomCurve3:class{
  constructor(points){
   assert(points.length>=5,
    'Circular wall produced an incomplete curve');
   curveResults.push(points);
  }
 }
},curve=>assert(curve,'Wall sampler did not produce a curve'));
assert.equal(curveResults.length,2,
 'Both outer and inner carved arcs must initialize successfully');

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
// Verify 100% parity between the rendered SIX-RING maze and the game.
// Walls, not broad dark filled corridors, define the actual open spaces.
const gearSteps=digits(match(logic,
 /const GEAR_MAZE_DIRECTIONS=\[([^\]]+)\]/,'legacy directions'));
const physicalSteps=digits(match(details,
 /const gearMazeDirections=\[([^\]]+)\]/,'sculpture legacy directions'));
assert.deepEqual(gearSteps,physicalSteps,
 'Recorded turn milestones cannot migrate to the wrong part of the maze');
const readRoute=(source,name)=>JSON.parse(match(source,
 new RegExp('const '+name+'=(\\[[^;]+\\]);'),name));
const route=readRoute(details,'mazeRouteCells');
assert.deepEqual(route,readRoute(logic,'MAZE_ROUTE_CELLS'),
 'Game migration points differ from the physical carved route');
const passages=(source,name)=>match(source,
 new RegExp('const '+name+'="([^"]+)"'),name)
 .split(' ').map(x=>x.split('-').map(Number));
const edges=passages(details,'mazePassages');
assert.deepEqual(edges,passages(logic,'MAZE_PASSAGES'),
 'A visual opening is blocked in the playable map (or vice versa)');
assert.equal(edges.length,116,'The six-ring labyrinth lost carved passages');
assert.equal(route[0],90,'The entrance must be on the outside at six o’clock');
assert.equal(route.at(-1),108,'The visible path must reach the central socket');
const edgeKey=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
const graph=new Map(),open=new Set(),goal=108,sectorCount=18;
for(const [x,y] of edges){
 const a=Math.min(x,y),b=Math.max(x,y);
 assert(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b<=goal,
  'Physical track leaves the circular plate');
 const same=a<goal&&b<goal&&Math.floor(a/sectorCount)===
  Math.floor(b/sectorCount);
 const angle=same&&((a%sectorCount+1)%sectorCount===b%sectorCount||
  (b%sectorCount+1)%sectorCount===a%sectorCount);
 const radial=b-a===sectorCount||b===goal&&a<sectorCount;
 assert(angle||radial,'One carved path crosses an inaccessible diagonal');
 const key=edgeKey(a,b);
 assert(!open.has(key),'A channel has duplicate overlapping geometry');
 open.add(key);
 if(!graph.has(a))graph.set(a,new Set());
 if(!graph.has(b))graph.set(b,new Set());
 graph.get(a).add(b);graph.get(b).add(a);
}
assert.equal(graph.size,109,'One of the six circular tracks is disconnected');
assert.equal(edges.length-graph.size+1,8,
 'The maze must have real alternative routes and some dead ends');
for(let i=1;i<route.length;i++)
 assert(open.has(edgeKey(route[i-1],route[i])),
  'The saved route cannot be traversed through the carved walls');
const dist=new Map([[90,0]]),q=[90];
while(q.length){
 const cur=q.shift();
 for(const next of graph.get(cur)||[]){
  if(dist.has(next))continue;
  dist.set(next,dist.get(cur)+1);q.push(next);
 }
}
assert.equal(dist.size,109,'A pocket of the maze is unreachable');
assert.equal(dist.get(goal),44,'The exit is unexpectedly easy or impossible');
assert.equal(route.length,45,'The migration route has gaps or a shortcut');
assert([...graph.values()].filter(links=>links.size>=3).length>=20,
 'The labyrinth needs genuinely meaningful branching paths');
assert(graph.get(90).has(91)&&graph.get(90).has(107),
 'Players must be able to turn either wheel at the entrance');
assert.deepEqual([...graph.get(goal)].sort((a,b)=>a-b),[2,11],
 'The central socket must have two real entrance mouths');
assert(details.includes('mazeSectors=18,mazeRings=6')&&
 details.includes('mazeStartAngle=-Math.PI/2')&&
 details.includes('const mazeInnerRadius=.075')===false&&
 details.includes('mazeInnerRadius=.075,mazePitch=.048')&&
 details.includes('function closedArcRuns(radius,blocked)')&&
 details.includes('const outerRimRadius=.338'),
 'The sculpture is not the clean six-ring design');
assert(details.includes('const mazeWall=mat(0x292521')&&
 details.includes('strokeWall(new THREE.LineCurve3(')&&
 details.includes('strokeWall(new THREE.CatmullRomCurve3(')&&
 !details.includes('function carvedRibbon(')&&
 !details.includes('const trenchBevel='),
 'Wide black route tiles have reappeared instead of thin curved walls');
assert(details.includes('const mazeGraph=new Map(),mazeEdgeCurves=new Map(),openEdges=new Set()')&&
 details.includes('!openEdges.has(edgeKey(r*mazeSectors+k,')&&
 details.includes('if(openEdges.has(edgeKey(a,b)))continue;'),
 'Rendered gaps and stopped walls are not derived from gameplay graph');
for(const action of ['gear-large','gear-small','maze-in','maze-out'])
 assert(preview.includes('"'+action+'"'),
  'A physical wheel or radial dial has lost its hover action');
assert(details.includes('radialDialTarget("maze-in",true)')&&
 details.includes('radialDialTarget("maze-out",false)')&&
 details.includes('setHit(wheelA,"gear-large")')&&
 details.includes('setHit(wheelB,"gear-small")')&&
 preview.includes('gameHotspots.targets.set("gear-large"')&&
 preview.includes('gameHotspots.targets.set("gear-small"'),
 'Both gears and the independently accessible radial dial must remain usable');
assert(logic.includes('name==="gear-large"?"maze-ccw"')&&
 logic.includes('name==="gear-small"?"maze-cw"')&&
 logic.includes('direction==="maze-in"')&&
 logic.includes('direction==="maze-out"')&&
 logic.includes('s.gearMazeCell=next;'),
 'Drag operations are not following the curved reachable paths');
assert(logic.includes('MAZE_LAYOUT_VERSION=4')&&
 logic.includes('const legacyMazeCell=')&&
 logic.includes('s.gearMazeLayoutVersion=MAZE_LAYOUT_VERSION'),
 'Existing saves are not migrated without wiping earned rewards');
assert(details.includes('meter.scale.setScalar(.90)')&&
 hotspots.includes('control(leftFace,"pressure",.88,.64,brass,.115)')&&
 details.includes('new THREE.RingGeometry(.203,.307,48,1,'),
 'The smaller gauge with the exposed outer rim has been lost');
assert(preview.includes('renderer.domElement.setPointerCapture(e.pointerId)')&&
 preview.includes('controls.enabled=false;clickStart=null;')&&
 preview.includes('const diff=Math.atan2(Math.sin(angle-drag.lastAngle)')&&
 preview.includes('clickAction(inward?"maze-in":"maze-out")'),
 'The physical gears and radial dial no longer accept hold-and-drag input');
assert(details.includes('turnPose(mazePlate,gearRotation)')&&
 details.includes('const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};')&&
 details.includes('mazeQueue.push(cell);mazeVisualTarget=cell;')&&
 details.includes('onUpdate:()=>{seatFollower();invalidate();}'),
 'The captive ball must animate through connected grooves, never skip walls');
const wheelMount=details.match(
 /const wheelA=gear\(leftFace,([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),gearMetal,15\)/);
const railMatch=details.match(
 /const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(wheelMount&&railMatch,'Physical gear output shaft is missing');
assert(Math.hypot(+railMatch[1]-(+wheelMount[1]),
 +railMatch[2]-(+wheelMount[2]))<.0001&&
 Math.abs(+railMatch[3]-(+wheelMount[3]+.156))<.0001,
 'The center release shaft is not attached to the dial linkage');
assert(logic.includes('s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)'),
 'Calibrating the pressure dial is no longer required for the fork reward');

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

// The side-lift, telescope, and clockwork story must be parallel routes.
// The first telescope optic can come from EITHER the removable front
// screws / rear eye, OR the fourth-floor carriage. Its second fitting
// should remain useful regardless of which was discovered first.
for(const phrase of [
 "elevator:s.serialRead||(s.watch&&s.tag)||s.floorFour||s.train",
 "moth:s.floorFour,telescope:true,train:s.train",
 "||item==='lens'&&thing==='telescope'&&!s.telescopeLensMounted",
 "||item==='iris'&&thing==='telescope'&&!s.telescopeIrisMounted",
 "||item==='starmap'&&thing==='elevator'&&thingPresent('elevator')&&!s.train",
 "if(item==='lens')s.telescopeLensMounted=true;",
 "else s.telescopeIrisMounted=true;",
 "s.secondSky=true;",
 "s.observed=true;",
 "if(typeof raw.telescopeLensMounted!=='boolean')",
 "if(typeof raw.telescopeIrisMounted!=='boolean')"
]) assert(logic.includes(phrase),
 "The parallel optical / side-lift progression lost: "+phrase);
assert(worlds.includes('telescope:true,train:s.train')&&
 worlds.includes('telescopeLensGlass.visible=!!s.telescopeLensMounted')&&
 worlds.includes('telescopeIrisGlass.visible=!!s.telescopeIrisMounted'),
 "The physical scope is still gated behind the moon or has fake permanent optics");
assert(worlds.includes('elevator:!!s.serialRead||!!(s.watch&&s.tag)||!!s.floorFour||!!s.train'),
 "The physical lift is still exclusively gated behind the dog and clock");
assert(!logic.includes("item==='starmap'&&thing==='elevator'&&s.floorFour"),
 "The star chart still needs the elevator's floor-four reward before it can be used");

// The telescope must look and function like a mounted optical instrument,
// not the former three floating wooden sticks around a plain brass pipe.
// Both removable optic meshes still respond to independently saved state.
for(const expected of [
 'const footPositions=[[-.194,-.084,-.118],[.194,-.084,-.118],',
 'const joint=[0,.288,-.047];',
 'wire(g,[joint,[x*.44,.102,z*.48],[x,y,z]],.022,m.wood);',
 'const tube=new THREE.Group();',
 'C(tube,.095,.50,-.003,0,0,m.brass,"x");',
 'C(tube,.034,.011,-.435,0,0,m.black,"x");',
 'torus(tube,.120,.010,.332,0,0,m.gold,"x");',
 'telescopeLensGlass=C(tube,.103,.014,.339,0,0,m.glass,"x");',
 'B(tube,.100,.074,.116,.095,.010,.085,m.brass,.014);',
 'telescopeIrisGlass=C(tube,.047,.012,.095,.010,.187,m.glass,"z");',
 'telescopeLensGlass.visible=!!s.telescopeLensMounted;',
 'telescopeIrisGlass.visible=!!s.telescopeIrisMounted;'
]) assert(worlds.includes(expected),
 'The telescope lost a structural mount or a working optical fitting: '+expected);
assert(!worlds.includes('wire(g,[[0,.37,0],[Math.cos(a)*.22,.09'),
 'The obsolete floating-rod telescope model has returned');

console.log('PASS: all three playable codes agree with their physical clues, alignable controls and retry indicators.');
