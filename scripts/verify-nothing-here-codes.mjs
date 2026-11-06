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
// The two gear wheels and four adjacent real buttons must now navigate a
// connected POLAR GRAPH. The 29-step sequence only exists for old saves:
// physical gameplay can travel around the rings and radially through
// twelve genuine alternate loops. No off-graph movement is permitted.
const gearSteps=digits(match(logic,
 /const GEAR_MAZE_DIRECTIONS=\[([^\]]+)\]/,'legacy gear route'));
const physicalGearSteps=digits(match(details,
 /const gearMazeDirections=\[([^\]]+)\]/,'legacy physical route'));
assert.deepEqual(gearSteps,physicalGearSteps,
 'Legacy saves must restore to the same old physical milestones');
const modelArray=(name)=>JSON.parse(match(details,
 new RegExp('const '+name+'=(\\[[\\s\\S]*?\\]);'),name));
const gameArray=(name)=>JSON.parse(match(logic,
 new RegExp('const '+name+'=(\\[[\\s\\S]*?\\]);'),name));
const mainCells=modelArray('mazeRouteCells');
const stepMarks=modelArray('mazeStepMarks');
const blindPaths=modelArray('mazeBlindCells');
const extraEdges=modelArray('mazeExtraEdges');
const modelJunctions=modelArray('mazeJunctions');
assert.deepEqual(gameArray('MAZE_ROUTE_CELLS'),mainCells,
 'The saved puzzle graph is not the actual carved main groove');
assert.deepEqual(gameArray('MAZE_STEP_MARKS'),stepMarks,
 'The legacy progress markers no longer point at the visible route');
assert.deepEqual(gameArray('MAZE_BLIND_CELLS'),blindPaths,
 'The wrong-turn branches no longer match the carved grooves');
assert.deepEqual(gameArray('MAZE_EXTRA_EDGES'),extraEdges,
 'The added shortcuts are visually present but not playable');
assert.deepEqual(gameArray('GEAR_MAZE_JUNCTIONS'),modelJunctions,
 'The classic release mechanism and sculpted branches disagree');
assert.equal(mainCells.length,64,'The legacy main route has been truncated');
assert.equal(stepMarks.length,30,'A previous save can no longer be restored');
assert.equal(mainCells.at(-1),96,'The maze still traps the ball before its central exit');
assert(extraEdges.length>=18,'The labyrinth lost its alternate passages');
const polarNeighbors=(a,b)=>{
 if(a===96||b===96)return (a===96&&b<16)||(b===96&&a<16);
 const ar=Math.floor(a/16),br=Math.floor(b/16);
 const ac=a%16,bc=b%16;
 return ar===br&&((ac+1)%16===bc||(bc+1)%16===ac)||
  ac===bc&&Math.abs(ar-br)===1;
};
const graph=new Map(),openEdges=new Set(),channelEdges=[];
const polarPoint=cell=>{
 if(cell===96)return [0,0];
 const radius=.082+Math.floor(cell/16)*.044;
 const angle=Math.PI/2+(cell%16)*Math.PI*2/16;
 return [Math.cos(angle)*radius,Math.sin(angle)*radius];
};
const edgeKey=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
const addRoute=cells=>{
 for(let i=1;i<cells.length;i++){
  const a=cells[i-1],b=cells[i],key=edgeKey(a,b);
  assert(polarNeighbors(a,b),'A maze corridor jumps through a brass wall');
  assert(!openEdges.has(key),'Duplicate channel tubes occupy the same physical corridor');
  openEdges.add(key);
  if(!graph.has(a))graph.set(a,new Set());
  if(!graph.has(b))graph.set(b,new Set());
  graph.get(a).add(b);graph.get(b).add(a);
  channelEdges.push([polarPoint(a),polarPoint(b)]);
 }
};
addRoute(mainCells);
blindPaths.forEach((path,i)=>
 addRoute([mainCells[stepMarks[modelJunctions[i]]],...path]));
extraEdges.forEach(path=>addRoute(path));
assert.equal(graph.size,97,
 'Every reachable ring cell and the center should be present');
assert.equal(openEdges.size-graph.size+1,12,
 'The maze must have a deliberately intricate twelve-loop layout');
const reachable=new Set([80]),queue=[80];
while(queue.length){
 const cell=queue.shift();
 for(const next of graph.get(cell)||[]){
  if(reachable.has(next))continue;
  reachable.add(next);queue.push(next);
 }
}
assert.equal(reachable.size,graph.size,
 'At least one carved maze corridor is disconnected from the entrance');
assert(reachable.has(96),'The central release socket cannot be entered');
const navigableChoices=[...graph.values()].filter(x=>x.size>=3).length;
assert(navigableChoices>=24,
 'The maze still offers too few meaningful navigation choices');
let radial=0;
for(const [cell,neighbors] of graph)
 for(const next of neighbors)
  if(cell!==96&&next!==96&&Math.floor(cell/16)!==Math.floor(next/16))
   radial++;
assert(radial>=40,
 'The up/down radial buttons have too few actual open crossovers');
assert(details.includes('getGearMazeTargets:()=>({')&&
 details.includes('directional:new Map(wheelContacts)')&&
 details.includes('wheelContact(wheelA,"maze-ccw",-.374,0,.190')&&
 details.includes('wheelContact(wheelA,"maze-cw",.374,0,.190')&&
 details.includes('wheelContact(wheelB,"maze-in",0,.149,.223')&&
 details.includes('wheelContact(wheelB,"maze-out",0,-.149,.223')&&
 preview.includes('for(const [action,part] of gears.directional||[])')&&
 !details.includes('const mazePad=')&&
 !preview.includes('clickAction(mazeKey[event.key.toLowerCase()]'),
 'Both wheels must carry their own four tactile contacts, never a D-pad');
assert(details.includes('const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};')&&
 details.includes('const curve=mazeEdgeCurves.get(edgeKey(')&&
 details.includes('onUpdate:seatFollower,onComplete:seatFollower')&&
 !details.includes('pose(follower,"position","x"'),
 'The moving ball is not confined to a carved open edge');
assert(logic.includes('function mazeDestination(cell,direction)')&&
 logic.includes('s.gearMazeCell=next;')&&
 logic.includes('if(next===MAZE_GOAL)')&&
 logic.includes('if(next===null){'),
 'Maze navigation still follows the scripted win path or crosses solid brass');
assert(logic.includes('Number.isInteger(raw.gearMazeCell)')&&
 logic.includes('const legacyMazeCell='),
 'Existing saved maze positions would be lost after the graph update');

// Collision audit: compute exactly the same 2D wall outlines as the
// physical scene. Wall strips are 0.010 wide, channel lips are .010;
// their centerlines must stay separated, as must independent walls.
const wallEdges=[];
for(let ring=0;ring<6;ring++)for(let sector=0;sector<16;sector++){
 const radius=.082+ring*.044,cell=ring*16+sector;
 const next=ring*16+(sector+1)%16;
 if(!openEdges.has(edgeKey(cell,next))){
  const angle=Math.PI/2+(sector+.5)*Math.PI*2/16;
  const r0=radius-(ring===0?.003:.013),r1=radius+.013;
  wallEdges.push([[Math.cos(angle)*r0,Math.sin(angle)*r0],
   [Math.cos(angle)*r1,Math.sin(angle)*r1]]);
 }
 if(ring<5&&!openEdges.has(edgeKey(cell,cell+16))){
  const r=radius+.022,a=Math.PI/2+(sector-.35)*Math.PI*2/16;
  const b=Math.PI/2+(sector+.35)*Math.PI*2/16;
  wallEdges.push([[Math.cos(a)*r,Math.sin(a)*r],
   [Math.cos(b)*r,Math.sin(b)*r]]);
 }
}
assert(wallEdges.length>=65&&wallEdges.length<=80,
 'The radial maze has broken wall geometry or missing blockers');
const pointDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const projectPoint=(p,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,
  ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 return [a[0]+t*dx,a[1]+t*dy];
};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
 (b[1]-a[1])*(c[0]-a[0]);
const segmentGap=([a,b],[c,d])=>{
 if(cross(a,b,c)*cross(a,b,d)<0&&
    cross(c,d,a)*cross(c,d,b)<0)return 0;
 return Math.min(
  pointDistance(a,projectPoint(a,c,d)),
  pointDistance(b,projectPoint(b,c,d)),
  pointDistance(c,projectPoint(c,a,b)),
  pointDistance(d,projectPoint(d,a,b))
 );
};
for(const wall of wallEdges)
 for(const channel of channelEdges)
  assert(segmentGap(wall,channel)>.01490,
   'The ball would collide with a wall across a playable corridor');
for(let i=0;i<wallEdges.length;i++)
 for(let j=i+1;j<wallEdges.length;j++)
  assert(segmentGap(wallEdges[i],wallEdges[j])>.00990,
   'Two nearby raised maze walls overlap');
assert(details.includes('flatLine(wheelA,x1,y1,x2,y2,.170,.007,wallColor);')&&
 details.includes('function circularWall(radius,first,last)')&&
 details.includes('circularWall(r,a0,a1);'),
 'The raised maze walls are no longer seated against the brass plate');
const wheelMount=details.match(
 /const wheelA=gear\(leftFace,([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),gearMetal,15\)/);
const railMatch=details.match(
 /const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(wheelMount&&railMatch,'The maze or its receiving axle is missing');
const [railX,railY,railZ]=railMatch.slice(1).map(Number);
assert(Math.hypot(railX-Number(wheelMount[1]),railY-Number(wheelMount[2]))<.0001&&
 Math.abs(railZ-(Number(wheelMount[3])+.156))<.0001,
 'The center socket no longer meets its mechanical release shaft');
assert(2*.035*Math.sin(1.25/2)>.032+.005,
 'The opened center aperture is narrower than the captive ball');
assert(preview.includes('gameHotspots.targets.set("gear-large"')&&
 preview.includes('gameHotspots.targets.set("gear-small"'),
 'The real gear wheels have lost their hit targets');
assert(logic.includes('s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)'),
 'The central maze reward no longer respects the pressure dial');

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
