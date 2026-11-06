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
// Circular mechanical labyrinth: verify the exact drawn graph is the graph
// the player actually navigates. The antique 29-step route is migration only.
const gearSteps=digits(match(logic,
 /const GEAR_MAZE_DIRECTIONS=\[([^\]]+)\]/,'legacy directions'));
const modelSteps=digits(match(details,
 /const gearMazeDirections=\[([^\]]+)\]/,'model legacy directions'));
assert.deepEqual(gearSteps,modelSteps,
 'Old saved turns must migrate without changing the recorded milestone');
const readRoute=(source,name)=>JSON.parse(match(source,
 new RegExp('const '+name+'=(\\[[^;]+\\]);'),name));
const route=readRoute(details,'mazeRouteCells');
assert.deepEqual(route,readRoute(logic,'MAZE_ROUTE_CELLS'),
 'Old progress maps to a different physical passage');
const readPassages=(source,name)=>match(source,
 new RegExp('const '+name+'="([^"]+)"'),name)
 .split(' ').map(x=>x.split('-').map(Number));
const passages=readPassages(details,'mazePassages');
assert.deepEqual(passages,readPassages(logic,'MAZE_PASSAGES'),
 'Sculpted channels and traversable paths disagree');
const sectors=12,goal=60,origin=48,edgeKey=(a,b)=>
 Math.min(a,b)+':'+Math.max(a,b);
assert.equal(passages.length,70,'The ring maze lost its alternate passages');
assert.equal(route[0],origin,'The start is not on the exterior ring');
assert.equal(route.at(-1),goal,'The route must reach the open center');
const graph=new Map(),openEdges=new Set();
for(const [x,y] of passages){
 const a=Math.min(x,y),b=Math.max(x,y);
 assert(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b<=goal,
  'A corridor leaves the circular maze');
 const sameRing=a<goal&&b<goal&&
  Math.floor(a/sectors)===Math.floor(b/sectors);
 const angular=sameRing&&(
  (a%sectors+1)%sectors===b%sectors||
  (b%sectors+1)%sectors===a%sectors);
 const radial=b-a===sectors||b===goal&&a<sectors;
 assert(angular||radial,'A path crosses a raised maze wall');
 const key=edgeKey(a,b);
 assert(!openEdges.has(key),'Two independent track meshes overlap');
 openEdges.add(key);
 if(!graph.has(a))graph.set(a,new Set());
 if(!graph.has(b))graph.set(b,new Set());
 graph.get(a).add(b);graph.get(b).add(a);
}
assert.equal(graph.size,61,'One of the five concentric rings is missing');
assert.equal(openEdges.size-graph.size+1,10,
 'The maze must offer multiple loops, not one obvious route');
for(let i=1;i<route.length;i++)
 assert(openEdges.has(edgeKey(route[i-1],route[i])),
  'The winning route passes through solid material');
const visited=new Set([origin]),queue=[origin],distance=new Map([[origin,0]]);
while(queue.length){
 const cell=queue.shift();
 for(const next of graph.get(cell)||[]){
  if(visited.has(next))continue;
  visited.add(next);distance.set(next,distance.get(cell)+1);queue.push(next);
 }
}
assert.equal(visited.size,61,'A carved section is isolated');
assert(distance.get(goal)>=18&&distance.get(goal)<=26,
 'The central goal is either trivial or cannot be reached');
assert([...graph.values()].filter(x=>x.size>=3).length>=15,
 'The labyrinth needs meaningful junctions and alternate routes');
assert(graph.get(origin).has(49)&&graph.get(origin).has(59),
 'At the entrance, one gear cannot turn in the opposite direction');
assert.deepEqual([...graph.get(goal)].sort((a,b)=>a-b),[2,7],
 'The socket must have two physically open inward mouths');
assert([...graph.keys()].every(cell=>
 cell===goal||Math.floor(cell/12)<5),
 'The graph uses an invalid radius');
assert(details.includes('mazeSectors=12,mazeRings=5')&&
 details.includes('new THREE.ArcCurve(0,0,radius')&&
 details.includes('const goalMouthSectors=[2,7]')&&
 details.includes('const goalSocket=goalCollarParts[0]'),
 'The round sculpture does not match the circular graph');
assert(details.includes('function carvedRibbon(curve,width,z,material)')&&
 details.includes('carvedRibbon(curve,.028,.180,channelDark)')&&
 details.includes('const mazeWall=mat(0xf4ead7')&&
 !details.includes('const boundary=9*mazePitch/2'),
 'The reference-inspired sculptural ivory walls or dark grooves are missing');
assert(details.includes('radialDialTarget("maze-in",true)')&&
 details.includes('radialDialTarget("maze-out",false)')&&
 details.includes('setHit(wheelA,"gear-large")')&&
 details.includes('setHit(wheelB,"gear-small")')&&
 !details.includes('const mazePad='),
 'The three physical control assemblies are no longer independent');
assert(logic.includes('name==="gear-large"?"maze-ccw"')&&
 logic.includes('name==="gear-small"?"maze-cw"')&&
 logic.includes('direction==="maze-in"')&&
 logic.includes('direction==="maze-out"')&&
 logic.includes('s.gearMazeCell=next;'),
 'The clockwise/counterclockwise or radial movement logic is missing');
assert(logic.includes('s.gearMazeLayoutVersion=MAZE_LAYOUT_VERSION')&&
 logic.includes('const legacyMazeCell='),
 'Previously saved puzzle progress has been discarded');
for(const action of ['gear-large','gear-small','maze-in','maze-out'])
 assert(preview.includes('"'+action+'"'),
  'A physical wheel or dial action lacks a hover description');
assert(preview.includes('gameHotspots.targets.set("gear-large"')&&
 preview.includes('gameHotspots.targets.set("gear-small"')&&
 preview.includes('for(const [action,part] of gears.directional||[])'),
 'Visible wheel and dial controls cannot be selected');
assert(details.includes('const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};')&&
 details.includes('const curve=mazeEdgeCurves.get(edgeKey(')&&
 details.includes('onUpdate:seatFollower,onComplete:seatFollower'),
 'The captive ball no longer follows a real open groove');
const wheelMount=details.match(
 /const wheelA=gear\(leftFace,([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),gearMetal,15\)/);
const railMatch=details.match(
 /const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(wheelMount&&railMatch,'The maze is missing its release mechanism');
assert(Math.hypot(+railMatch[1]-(+wheelMount[1]),
 +railMatch[2]-(+wheelMount[2]))<.0001&&
 Math.abs(+railMatch[3]-(+wheelMount[3]+.156))<.0001,
 'The central socket is not aligned with the retaining linkage');
assert(logic.includes('s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)'),
 'The maze reward no longer respects pressure calibration');

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
