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
// The two visible gears must drive a multi-lane captive-screw labyrinth,
// not a decorative couple of hooks or a one-button click counter.
const gearSteps=digits(match(logic,
 /const GEAR_MAZE_DIRECTIONS=\[([^\]]+)\]/,'gear maze directions'));
const physicalGearSteps=digits(match(details,
 /const gearMazeDirections=\[([^\]]+)\]/,'sculpted gear track'));
assert.deepEqual(physicalGearSteps,gearSteps,
 'The physical switchback channel differs from the turn directions needed by the game');
assert(gearSteps.length>=29&&
 gearSteps.filter((v,i)=>i>0&&v!==gearSteps[i-1]).length>=5,
 'The maze needs at least six genuine lanes and five directional switchbacks');
assert(details.includes('const grooveCurve=new THREE.CurvePath();')&&
 details.includes('new THREE.TubeGeometry(\n   grooveCurve,')&&
 details.includes('getGearMazeTargets:')&&details.includes('getGearMazeAssembly:'),
 'The meshed gears need a visible continuous groove, follower and touch targets');

// The physical labyrinth must have actual right-angle passages and five
// distinct false routes, rather than a mostly circular spiral texture.
// Every allowed movement remains on a spline cut in the visible metal.
const mainMatch=details.match(/const mazeGridPath=\[([\s\S]*?)\];/);
const forksMatch=details.match(/const mazeBlindPaths=\[([\s\S]*?)\];/);
assert(mainMatch&&forksMatch,
 'A large angular maze with real branches is absent from the gear face');
const cells=source=>[...source.matchAll(/\[(-?\d+),(-?\d+)\]/g)]
 .map(m=>[Number(m[1]),Number(m[2])]);
const mainCells=cells(mainMatch[1]);
const blindCells=cells(forksMatch[1]);
const modelJunctions=digits(match(details,
 /const mazeJunctions=\[([^\]]+)\]/,'physical junction indices'));
const gameJunctions=digits(match(logic,
 /const GEAR_MAZE_JUNCTIONS=\[([^\]]+)\]/,'working dead-end junctions'));
assert.deepEqual(modelJunctions,gameJunctions,
 'The real physical labyrinth forks do not agree with the playable controls');
assert.deepEqual(gameJunctions,[4,9,14,19,24],
 'The five working branches are no longer at the expected safe junctions');
assert.equal(mainCells.length,gearSteps.length+1,
 'Every gear click must terminate at an actual distinct maze cell');
assert.equal(blindCells.length,gameJunctions.length*2,
 'Each maze fork must contain two reachable cells and an end plug');
const address=cell=>cell.join(',');
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
assert.equal(new Set(mainCells.map(address)).size,mainCells.length,
 'Main gear-maze path crosses itself in the same cell');
const occupied=new Set(mainCells.map(address));
for(let i=1;i<mainCells.length;i++)
 assert.equal(distance(mainCells[i-1],mainCells[i]),1,
  'A main-channel segment skips a cell or cuts diagonally through metal');
for(let f=0;f<gameJunctions.length;f++){
 const origin=mainCells[gameJunctions[f]];
 const first=blindCells[f*2],second=blindCells[f*2+1];
 assert(distance(origin,first)===1&&distance(first,second)===1,
  'A branch has a floating jump or goes across a solid brass wall');
 for(const cell of [first,second]){
  const addr=address(cell);
  assert(!occupied.has(addr),'A maze fork crosses an occupied groove: '+addr);
  occupied.add(addr);
 }
}
const turnCount=mainCells.reduce((n,c,i,a)=>i>1&&
 (c[0]-a[i-1][0]!==a[i-1][0]-a[i-2][0]||
  c[1]-a[i-1][1]!==a[i-1][1]-a[i-2][1])?n+1:n,0);
assert(turnCount>=12,
 'The maze must contain meaningful angular switchbacks, not a simple spiral');
assert(details.includes('const grooveCurve=new THREE.CurvePath();')&&
 details.includes('const deadEndCurves=new Map();')&&
 details.includes('const mazeTravel={index:0,branch:0};')&&
 details.includes('const channelPoint=pointOnTrack(mazeTravel.index,')&&
 details.includes('onUpdate:seatFollower,onComplete:seatFollower')&&
 !details.includes('pose(follower,"position","x"')&&
 !details.includes('pose(follower,"position","y"'),
 'The captive screw is not bound to the same drawn spline as the maze');
assert(logic.includes('s.gearMazeBranch=1;')&&
 logic.includes('else if(dir===-forward&&beforeBranch<2)s.gearMazeBranch++;')&&
 logic.includes('if(moved)s.gearMazeTurns=clamp(')&&
 logic.includes('s.gearMazeBranch=0;'),
 'A wrong gear must enter a blind channel and physically stop at its tip');

// The final maze outlet must still meet the SAME fixed release linkage
// after the wheel has rotated through its original 29-move solution.
const cellSize=Number(match(details,
 /const mazeCellSize=([\d.]+);/,'machined cell pitch'));
const wheelMount=details.match(
 /const wheelA=gear\(leftFace,([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+),gearMetal,15\)/);
assert(wheelMount,'The upgraded labyrinth gear is missing its real bearing');
const [exitCellX,exitCellY]=mainCells.at(-1);
const localX=exitCellX*cellSize,localY=exitCellY*cellSize;
const finalWheelAngle=-gearSteps.reduce((sum,d)=>sum+d,0)*Math.PI/12;
const exitX=Number(wheelMount[1])+
 localX*Math.cos(finalWheelAngle)-localY*Math.sin(finalWheelAngle);
const exitY=Number(wheelMount[2])+
 localX*Math.sin(finalWheelAngle)+localY*Math.cos(finalWheelAngle);
const exitZ=Number(wheelMount[3])+.156;
const railMatch=details.match(/const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(railMatch,'The fixed mechanical release rail is absent');
const [,railX,railY,railZ]=railMatch.map(Number);
assert(Math.hypot(exitX-railX,exitY-railY)<.015&&
 Math.abs(exitZ-railZ)<.015,
 'The redesigned maze no longer connects to its calibration lock');
assert(preview.includes('gameHotspots.targets.set("gear-large"')&&
 preview.includes('gameHotspots.targets.set("gear-small"'),
 'The maze gears are not reachable by the 3D interaction raycaster');
assert(logic.includes("s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)")&&
 logic.includes("s.gearMazeIndex++"),
 'The real gear maze has stopped gating new tuning forks or preserving earned legacy forks');

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
