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
assert(details.includes('new THREE.TubeGeometry(grooveCurve')&&
 details.includes('getGearMazeTargets:')&&details.includes('getGearMazeAssembly:'),
 'The meshed gears need a visible continuous groove, follower and touch targets');
 // The final carved groove must enter the real, raised release rail after
 // the wheel's last turn. Otherwise the player sees two unrelated devices.
const gearOrientation=Number(match(details,
 /const gearMazeOrientation=([\d.-]+);/,'clockwork groove orientation'));
const wheelMount=details.match(/const wheelA=gear\(leftFace,([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)\)/);
assert(wheelMount,'Missing large physical gear bearing');
const stages=[...details.matchAll(/\{r:([\d.]+),start:([-\d.]+),end:([-\d.]+)\}/g)];
assert.equal(stages.length,6,'The gear labyrinth no longer has six physical lanes');
const [lastRadius,,lastEnd]=stages.at(-1).slice(1).map(Number);
const finalWheelAngle=gearSteps.reduce((sum,turn)=>sum-turn*15,0);
const exitAngle=(lastEnd+gearOrientation+finalWheelAngle)*Math.PI/180;
const exitX=Number(wheelMount[1])+Math.cos(exitAngle)*lastRadius;
const exitY=Number(wheelMount[2])+Math.sin(exitAngle)*lastRadius;
const exitZ=Number(wheelMount[3])+.145;
const railMatch=details.match(/const gearRailEntry=\{x:([-\d.]+),y:([-\d.]+),z:([-\d.]+)\}/);
assert(railMatch,'Missing raised physical release rail');
const [,railX,railY,railZ]=railMatch.map(Number);
assert(Math.hypot(exitX-railX,exitY-railY)<.023&&
 Math.abs(exitZ-railZ)<.025,
 'The final gear-maze notch does not physically meet the latch rail');
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

console.log('PASS: all three playable codes agree with their physical clues, alignable controls and retry indicators.');
