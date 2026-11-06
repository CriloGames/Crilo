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
// Audit the actual 9x9 carved network against the gameplay graph.
// Neither a scripted 29-step answer nor a fake selector controls the pin.
const gearSteps=digits(match(logic,
 /const GEAR_MAZE_DIRECTIONS=\[([^\]]+)\]/,'legacy turns'));
const physicalGearSteps=digits(match(details,
 /const gearMazeDirections=\[([^\]]+)\]/,'physical legacy turns'));
assert.deepEqual(gearSteps,physicalGearSteps,
 'A pre-upgrade saved step would be mapped to the wrong point');
const readRoute=(source,name)=>JSON.parse(match(source,
 new RegExp('const '+name+'=(\\[[^;]+\\]);'),name));
const route=readRoute(details,'mazeRouteCells');
assert.deepEqual(route,readRoute(logic,'MAZE_ROUTE_CELLS'),
 'The visible route and saved-position migration disagree');
const readPassages=(source,name)=>match(source,
 new RegExp('const '+name+'="([^"]+)"'),'passages '+name)
  .split(' ').map(pair=>pair.split('-').map(Number));
const passages=readPassages(details,'mazePassages');
assert.deepEqual(passages,readPassages(logic,'MAZE_PASSAGES'),
 'Some visible openings cannot be navigated or vice versa');
assert.equal(passages.length,93,'The maze should have 93 physical passages');
assert.equal(route[0],0,'The engraved entrance is not a start cell');
assert.equal(route.at(-1),40,'The central release hole must be the exit');
const edgeKey=(a,b)=>Math.min(a,b)+':'+Math.max(a,b);
const graph=new Map(),openEdges=new Set();
const addEdge=(a,b)=>{
 const key=edgeKey(a,b);
 assert(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b<81,
  'An opening is outside the metal grid');
 assert(b-a===9||
  (Math.floor(a/9)===Math.floor(b/9)&&b-a===1),
  'An opening diagonally crosses a raised maze wall');
 assert(!openEdges.has(key),'Two channels overlap the same passage');
 openEdges.add(key);
 if(!graph.has(a))graph.set(a,new Set());
 if(!graph.has(b))graph.set(b,new Set());
 graph.get(a).add(b);graph.get(b).add(a);
};
passages.forEach(([a,b])=>addEdge(a,b));
assert.equal(graph.size,81,'An area of the square labyrinth is disconnected');
assert.equal(openEdges.size-graph.size+1,13,
 'The labyrinth needs multiple loops, not a single obvious route');
for(let i=1;i<route.length;i++)
 assert(openEdges.has(edgeKey(route[i-1],route[i])),
  'Legacy progress mapping passes through a closed wall');
const seen=new Set([0]),queue=[0],dist=new Map([[0,0]]);
while(queue.length){
 const cell=queue.shift();
 for(const next of graph.get(cell)||[]){
  if(seen.has(next))continue;
  seen.add(next);dist.set(next,dist.get(cell)+1);queue.push(next);
 }
}
assert.equal(seen.size,81,'The pin cannot reach all of the carved passages');
assert(dist.get(40)>=20&&dist.get(40)<=32,
 'The central socket is either trivial or impossibly far away');
assert([...graph.values()].filter(links=>links.size>=3).length>=25,
 'There are not enough meaningful physical junctions');
assert((graph.get(40)?.size||0)>=3,
 'The socket has only one obvious approach');
const point=cell=>[(cell%9-4)*.056,(4-Math.floor(cell/9))*.056];
const gap=(p,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,
  ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy));
};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
 (b[1]-a[1])*(c[0]-a[0]);
const segmentGap=([a,b],[c,d])=>{
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)
  return 0;
 return Math.min(gap(a,c,d),gap(b,c,d),gap(c,a,b),gap(d,a,b));
};
const walls=[];
const segment=(x,y,w,h)=>walls.push(w>h?
 [[x-w/2,y],[x+w/2,y]]:[[x,y-h/2],[x,y+h/2]]);
const boundary=9*.056/2;
for(let r=0;r<9;r++)for(let c=0;c<9;c++){
 const n=r*9+c,x=(c-4)*.056,y=(4-r)*.056;
 if(c<8&&!openEdges.has(edgeKey(n,n+1)))
  segment(x+.028,y,.009,.054);
 if(r<8&&!openEdges.has(edgeKey(n,n+9)))
  segment(x,y-.028,.054,.009);
 if(r===0&&c!==0)segment(x,boundary,.054,.009);
 if(r===8)segment(x,-boundary,.054,.009);
 if(c===0)segment(-boundary,y,.009,.054);
 if(c===8)segment(boundary,y,.009,.054);
}
assert(walls.length>=80&&walls.length<=100,
 'The grid is missing its real raised boundary or inner walls');
for(const edge of passages){
 const corridor=edge.map(point);
 for(const wall of walls)
  assert(segmentGap(corridor,wall)>.019,
   'A playable passage touches a raised solid wall');
}
assert(details.includes('const mazePlate=group(leftFace,-.18,0,.19)')&&
 details.includes('const boundary=9*mazePitch/2')&&
 details.includes('const goalSocket=ring(mazePlate')&&
 !details.includes('function circularWall(radius,first,last)'),
 'The visible wheel is still a circular diagram, not a machined square maze');
for(const direction of ['maze-up','maze-down','maze-left','maze-right'])
 assert(details.includes('"'+direction+'"')&&
  logic.includes('"'+direction+'"')&&preview.includes('"'+direction+'"'),
  'Physical wheel control is missing '+direction);
assert(details.includes('wheelContacts.set(name,target)')&&
 details.includes('setHit(mazePlate,"gear-large")')&&
 !details.includes('wheelContact(wheelA,'),
 'The old visible four-button selector has returned');
assert(details.includes('const mazeTravel={from:mazeOrigin,to:mazeOrigin,t:1};')&&
 details.includes('const curve=mazeEdgeCurves.get(edgeKey(')&&
 details.includes('onUpdate:seatFollower,onComplete:seatFollower'),
 'The captive pin does not animate along open passages');
assert(logic.includes('function mazeDestination(cell,direction)')&&
 logic.includes('s.gearMazeCell=next;')&&logic.includes('if(next===MAZE_GOAL)'),
 'The maze gameplay does not use the carved walls');
assert(logic.includes('s.gearMazeLayoutVersion=MAZE_LAYOUT_VERSION')&&
 logic.includes('const legacyMazeCell='),
 'Previously saved puzzle progress has been lost');
const wheelMount=details.match(
 /const wheelA=gear\(leftFace,([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),gearMetal,15\)/);
const railMatch=details.match(
 /const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(wheelMount&&railMatch,'The real geared release hardware is missing');
assert(Math.hypot(+railMatch[1]-(+wheelMount[1]),
 +railMatch[2]-(+wheelMount[2]))<.0001&&
 Math.abs(+railMatch[3]-(+wheelMount[3]+.156))<.0001,
 'The center socket does not connect to the calibrated dial shaft');
assert(preview.includes('gameHotspots.targets.set("gear-large"')&&
 preview.includes('gameHotspots.targets.set("gear-small"'),
 'Players cannot directly press the exposed wheels');
assert(logic.includes('s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)'),
 'Maze solving bypasses the pressure dial');
 
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
