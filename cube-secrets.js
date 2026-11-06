/* Nothing Here — impossible object. A stateful surreal chain-reaction toy.
 * Saves independently from both earlier versions. No network or auth required. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
if(!$('ncCube'))return;
const KEY='crilo_nothing_here_cube_v3';
const catalog=[
 ['first','The cube has noticed you.'],
 ['drawer','A very small secret drawer.'],
 ['thread','The sideways spool.'],
 ['pipe','A tube full of silence.'],
 ['ring','Something from underneath.'],
 ['mouse','You have disturbed a mechanical mouse.'],
 ['eye','An eye that gives directions.'],
 ['dot','The forbidden little red dot.'],
 ['bell','A bell with a surprisingly loud voice.'],
 ['key','That is definitely a key.'],
 ['bag','Luggage, for no reason.'],
 ['bag-code','The bag has a false bottom.'],
 ['flute','This is suddenly a flute.'],
 ['door','There was not a door a moment ago.'],
 ['dog','An unlikely resident.'],
 ['bark','The bark heard around the page.'],
 ['squirrel','An accomplice in the chaos.'],
 ['vase','One less intact vase.'],
 ['acorn','One tiny tree, pending.'],
 ['spring','A very inconvenient spring.'],
 ['music','The music box has opinions.'],
 ['cloud','Indoor weather.'],
 ['rain','The cloud has cried.'],
 ['tree','It grew far too quickly.'],
 ['bird','An origami escape artist.'],
 ['kite','Extremely unlikely aerodynamics.'],
 ['machine','A transactional mystery.'],
 ['teacup','Tea for somebody absent.'],
 ['clock','Time refuses to cooperate.'],
 ['moon','There is a moon in the cube.'],
 ['tag','The dog was never lost.'],
 ['lift','A lift for impossibly small passengers.'],
 ['fourth','The fourth floor is not listed anywhere.'],
 ['moth','A wind-up moth with impeccable manners.'],
 ['observatory','A telescope pointed at nothing.'],
 ['constellation','Five stars and a very strange address.'],
 ['dancer','A waltz for an audience of one.'],
 ['railway','The railway goes under the page.'],
 ['parcel','Special delivery from nowhere.'],
 ['postcard','The dog has become the postmaster.'],
 ['portal','A landscape where a cube should be.'],
 ['fastener','A screw that actually comes out.'],
 ['false-screw','One of these screws is lying.'],
 ['faceplate','Underneath the enamel.'],
 ['vent-sequence','The service vents were listening.'],
 ['eye-dial','An iris calibrated by hand.'],
 ['hidden-optic','A second eye in the machine.'],
 ['second-sky','Two skies, one telescope.'],
 ['service-bolt','Maintenance is unexpectedly lucrative.'],
 ['hinge-pin','A tiny piece of engineering.'],
 ['clockwork-heart','An irregular mechanical heartbeat.'],
 ['underside-foot','A clue hiding in plain underside.'],
 ['maker-stamp','The manufacturer denies everything.'],
 ['pressure-dial','The needle knows a note.'],
 ['resonance','A tuning fork opens another reality.'],
 ['service-shutter','A service compartment behind sound.'],
 ['wax-cylinder','The music box remembers a voice.'],
 ['paper-tape','Time keeps a written record.'],
 ['outgoing-mail','The train is accepting letters.'],
 ['return-letter','The door has written back.']
];
const title=new Map(catalog);
const names={tooth:'key teeth',ring:'brass ring',thread:'red thread',pipe:'hollow pipe',reed:'tiny reed',
 flute:'flute',key:'little key',coin:'coin',treat:'dog biscuit',prism:'glass prism',
 acorn:'acorn',spring:'clock spring',raindrop:'a drop of rain',bird:'paper bird',
 kite:'a kite',sugar:'sugar cube',bell:'tiny bell',tag:'collar tag',
 lens:'silver telescope lens',stardust:'luminous moth dust',starmap:'folded star chart',
 parcel:'miniature parcel',postcard:'postcard from nowhere',
 cog:'brass drive cog',iris:'glass eye',shim:'thin copper shim',washer:'hinge washer',
 fork:'silver tuning fork',cylinder:'wax sound cylinder',tape:'punched paper tape',
 letter:'folded letter',envelope:'sealed return envelope',seal:'brass service key'};
const glyphs={tooth:'M7 10V22l4 3 4-4 4 4 4-4 2-11M7 10q9-9 18 0M12 12v8m4-8v8m4-8v8',
 ring:'M16 5a11 11 0 1 0 0 22 11 11 0 1 0 0-22M16 9a7 7 0 1 0 0 14 7 7 0 1 0 0-14',
 thread:'M6 24q11-3 6-12t11-1-2 9-6 2 1 6 10-5',
 pipe:'M5 21 21 5l6 6-16 16-6-6Zm15-14 5 5M8 21l3 3',
 reed:'M13 4h6l2 24H11L13 4Zm-1 5h8m-8 14h8m-4-10v2m0 3v2',
 flute:'M4 12h23v9H4v-9Zm4-2v13m14-13v13M12 16h1m4 0h1m8-4v9',
 key:'M11 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12Zm0 4v4m5 1 11 11m-2-4-3 3m-3-6-3 3',
 coin:'M16 4a12 12 0 1 0 0 24 12 12 0 1 0 0-24Zm0 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16Zm0 2-4 6 4 6 4-6-4-6',
 treat:'M7 13Q2 10 5 7t6 2h10q6-5 8-1t-4 6q6 4 3 7t-7-1H11q-3 5-6 2t2-9',
 prism:'M16 4 28 27H4L16 4Zm0 0v23M4 27l12-9 12 9',
 acorn:'M9 14q-2 10 7 14 9-4 7-14M7 14q1-9 9-9t9 9q-9 6-18 0M16 5V2m0 2 4-2',
 spring:'M7 4v6q0 4 18 4t-18 7 18 7M5 4h4m14 24h4',
 raindrop:'M16 3Q7 16 7 20a9 9 0 0 0 18 0Q25 16 16 3ZM11 20q0 5 5 5',
 bird:'M3 18 16 5l2 13 11 5-13 2-13-7Zm13-13-3 14-10-1m15 0-2 7',
 kite:'M16 3 27 15 16 25 5 15 16 3Zm0 0v22M5 15h22m-11 10 5 3-4 3',
 sugar:'M16 4 27 10v12l-11 6-11-6V10l11-6ZM5 10l11 6 11-6M16 16v12',
 bell:'M10 20v-8q0-7 6-7t6 7v8l3 4H7l3-4Zm3 7q3 4 6 0M16 5V3',
 tag:'M5 7h12l10 10-10 10L5 15V7Zm6 3a2 2 0 1 0 0 4 2 2 0 1 0 0-4',
 lens:'M15 5a10 10 0 1 0 0 20 10 10 0 1 0 0-20Zm0 4a6 6 0 1 0 0 12 6 6 0 1 0 0-12M22 22l7 7',
 stardust:'M14 3l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Zm11 19 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3',
 starmap:'M4 7l8-3 8 3 8-3v21l-8 3-8-3-8 3V7Zm8-3v21m8-18v21m-4-17 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3',
 parcel:'M16 3 28 10v13l-12 7-12-7V10l12-7ZM4 10l12 7 12-7M16 17v13M10 6l12 8',
 postcard:'M3 6h26v20H3V6Zm14 3v14m3-8h6m-6 4h6m-6 4h5m-19-3 4-5 5 5',
 cog:'M13 3h6l1 4 3 2 4-1 3 6-3 2v3l3 2-3 6-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-6 3-2v-3l-3-2 3-6 4 1 3-2 1-4ZM16 12a5 5 0 1 0 0 10 5 5 0 1 0 0-10',
 iris:'M16 4a12 12 0 1 0 0 24 12 12 0 1 0 0-24M16 6l6 5-1 8-8 4-6-7 3-7 6-3Zm6 5 5 5-6 3m-8 4-2 4',
 shim:'M5 11 23 4l4 7-18 7-4-7Zm4 7 5 10 12-5-3-6',
 washer:'M16 5a11 11 0 1 0 0 22 11 11 0 1 0 0-22Zm0 6a5 5 0 1 0 0 10 5 5 0 1 0 0-10',
 fork:'M9 4v12a7 7 0 0 0 14 0V4M16 23v7m-4 0h8M9 4h3m8 0h3',
 cylinder:'M6 7a10 4 0 1 0 20 0 10 4 0 1 0-20 0m0 0v18a10 4 0 0 0 20 0V7M6 14a10 4 0 0 0 20 0M6 20a10 4 0 0 0 20 0',
 tape:'M4 7h24v18H4V7Zm0 4h24M4 21h24m-20-5h1m5 0h1m7 0h1m3 0h1',
 letter:'M9 3h13l5 5v21H9V3Zm13 0v6h5M13 14h10m-10 5h10m-10 5h6',
 envelope:'M3 8h26v18H3V8Zm0 2 13 10 13-10M3 26l10-9m16 9-10-9',
 seal:'M4 10h15l3 4-3 4H4v-8Zm6 3h4m8 1h6v6h-3v3h-3v-3l-3-3'};
const recipe={
 'pipe+reed':['flute','flute','The hollow pipe finally remembers how to sing.'],
 'ring+tooth':['key','key','Those two pieces click together, perfectly.'],
 'prism+thread':['kite','kite','You have made a kite from almost nothing.']
};
// Author-drawn silhouettes render identically across operating systems.
// Each pocket label remains visible, so identity never depends on color.
const pocketMetal=new Set(['tooth','ring','flute','key','coin','spring','bell','tag','cog','shim','washer','fork','seal']);
const pocketGlass=new Set(['prism','raindrop','sugar','lens','stardust','iris']);
const pocketPaper=new Set(['bird','starmap','parcel','postcard','tape','letter','envelope']);
const pocketMaterial=id=>pocketMetal.has(id)?'metal':pocketGlass.has(id)?'glass':pocketPaper.has(id)?'paper':'organic';
const inventoryIcon=id=>'<svg class="nc-item-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="'+(glyphs[id]||glyphs.stardust)+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// A pocket item can matter beyond simply being collected. The marking below
// shows POTENTIAL, not which unseen puzzle it solves. We only confirm a match
// after the player deliberately inspects an object while holding the item.
const craftParts=new Set(Object.keys(recipe).flatMap(pair=>pair.split('+')));
const worldUseItems=new Set([
 'key','treat','acorn','raindrop','spring','coin','kite','sugar','bird',
 'bell','lens','stardust','starmap','parcel','postcard','cog','iris',
 'shim','washer','fork','cylinder','tape','letter','envelope','seal'
]);
const itemMayReact=id=>craftParts.has(id)||worldUseItems.has(id);
const sorted=(a,b)=>[a,b].sort().join('+');
// Six distinct stamped symbols and four independently turning wheels.
// A dedicated mechanical release must be pressed AFTER the correct code;
// simply cycling past an answer never opens the bag's false bottom.
const BAG_SYMBOLS=['○','✳','◇','☾','△','□'];
const BAG_CODE=[2,0,3,1];
// These are mirrored by the ACTUAL engraved codes on the six 3D faces.
const VENT_CODE=[3,1,4,2,3];
const FLUTE_CODE=[2,1,3,1,3,2];
// Eight closely spaced concentric rings, rendered as engraved WALLS
// rather than dark square-looking route tiles. Each logical passage is
// matched to the physical opening on the sculpted 3D labyrinth.
const GEAR_MAZE_DIRECTIONS=[
 1,1,1,1,-1,-1,-1,-1,-1,1,1,1,1,1,-1,-1,-1,-1,-1,
 1,1,1,1,1,-1,-1,-1,-1,-1
];
const MAZE_ROUTE_CELLS=[168,169,170,146,122,98,74,50,49,48,24,47,46,22,21,20,19,43,42,41,17,16,40,64,63,39,15,14,13,37,36,60,84,108,132,133,134,135,159,183,182,181,180,179,178,177,176,175,151,150,126,127,128,104,80,81,57,58,59,35,34,10,11,192];
const MAZE_PASSAGES="0-1 0-23 1-2 2-3 3-27 4-5 5-6 5-29 7-8 7-31 8-9 9-33 10-11 10-34 11-12 11-192 13-14 13-37 14-15 15-39 16-17 16-40 17-41 18-42 19-20 19-43 20-21 21-22 22-23 22-46 23-47 24-47 24-48 25-49 26-50 27-51 28-29 28-52 30-31 31-32 32-33 33-57 34-35 35-59 36-37 36-60 37-61 38-39 38-62 39-63 40-64 41-42 42-43 44-45 45-69 46-47 48-49 49-50 49-73 50-74 51-75 52-53 53-77 54-55 54-78 55-56 56-57 57-58 57-81 58-59 59-83 60-84 62-63 62-86 63-64 63-87 64-88 65-66 66-67 67-68 68-69 69-70 70-71 70-94 71-95 72-95 73-97 74-98 75-76 76-100 77-78 78-102 79-103 80-81 80-104 82-83 82-106 84-85 84-108 85-109 86-87 88-89 89-90 91-115 92-93 92-116 93-94 93-117 94-118 95-119 96-97 96-120 98-122 99-100 101-102 102-103 103-127 104-128 105-106 105-129 107-108 107-131 108-132 109-110 110-111 112-113 112-136 113-114 113-137 114-115 114-138 116-117 117-141 119-143 120-121 120-143 120-144 121-122 121-145 122-146 123-124 124-125 124-148 125-126 126-127 126-150 127-128 129-130 130-154 131-132 132-133 133-134 134-135 135-159 136-137 138-162 139-140 140-141 141-165 142-166 144-145 144-167 145-146 146-170 147-171 148-172 149-150 149-173 150-151 151-175 152-153 153-154 154-155 155-156 156-157 157-158 159-183 160-161 160-184 161-162 163-164 164-165 164-188 165-166 166-167 166-190 168-169 168-191 169-170 170-171 173-174 175-176 176-177 177-178 178-179 179-180 180-181 181-182 182-183 184-185 185-186 186-187 187-188 188-189 190-191".split(" ").map(x=>x.split("-").map(Number));
const MAZE_ORIGIN=168,MAZE_GOAL=192,MAZE_LAYOUT_VERSION=5;
const MAZE_SECTORS=24,MAZE_RINGS=8;
const MAZE_GRAPH=new Map();
for(const [x,y] of MAZE_PASSAGES){
 const a=Math.min(x,y),b=Math.max(x,y);
 const sameRing=a!==MAZE_GOAL&&b!==MAZE_GOAL&&
  Math.floor(a/MAZE_SECTORS)===Math.floor(b/MAZE_SECTORS);
 const angular=sameRing&&(
  (a%MAZE_SECTORS+1)%MAZE_SECTORS===b%MAZE_SECTORS||
  (b%MAZE_SECTORS+1)%MAZE_SECTORS===a%MAZE_SECTORS);
 const radial=b-a===MAZE_SECTORS||
  b===MAZE_GOAL&&a<MAZE_SECTORS;
 if(!angular&&!radial)throw Error("Carved maze route crosses solid brass");
 if(!MAZE_GRAPH.has(a))MAZE_GRAPH.set(a,new Set());
 if(!MAZE_GRAPH.has(b))MAZE_GRAPH.set(b,new Set());
 if(MAZE_GRAPH.get(a).has(b))throw Error("Duplicate physical corridor");
 MAZE_GRAPH.get(a).add(b);MAZE_GRAPH.get(b).add(a);
}
if(MAZE_GRAPH.size!==193||MAZE_PASSAGES.length!==205)
 throw Error("Maze model and navigation map disagree");
function mazeDestination(cell,direction){
 if(!MAZE_GRAPH.has(cell))return null;
 if(cell===MAZE_GOAL)
  return direction==="maze-out"?[...MAZE_GRAPH.get(cell)][0]:null;
 const sector=cell%MAZE_SECTORS,ring=Math.floor(cell/MAZE_SECTORS);
 const next=direction==="maze-ccw"?
  ring*MAZE_SECTORS+(sector+1)%MAZE_SECTORS:
  direction==="maze-cw"?
  ring*MAZE_SECTORS+(sector+MAZE_SECTORS-1)%MAZE_SECTORS:
  direction==="maze-in"?(ring===0?MAZE_GOAL:cell-MAZE_SECTORS):
  direction==="maze-out"?(ring===MAZE_RINGS-1?null:cell+MAZE_SECTORS):null;
 return next!==null&&MAZE_GRAPH.get(cell).has(next)?next:null;
}

let raw={};
try{raw=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const seen=new Set((Array.isArray(raw.seen)?raw.seen:[]).filter(k=>title.has(k)));
const pocket=new Set((Array.isArray(raw.pocket)?raw.pocket:[]).filter(k=>Object.hasOwn(names,k)));
// A physical pickup is a found object still lying in its real 3D source.
// Persist it separately from collected inventory so refreshing cannot
// magically pocket an item or lose an unlocked reward.
const pendingPickups=new Set((Array.isArray(raw.pendingPickups)?raw.pendingPickups:[])
 .filter(k=>Object.hasOwn(names,k)&&!pocket.has(k)));
const defaults={a:false,b:false,top:false,bottom:false,left:false,back:false,bag:false,
 bagOpen:false,bagSolved:false,door:false,doorOpen:false,barked:false,squirrel:false,
 vase:false,plant:false,tree:false,cloud:false,music:false,watch:false,machine:false,
 cup:false,moon:false,mouse:false,tag:false,kite:false,
 floorFour:false,mothTouched:false,observed:false,telescopeLensMounted:false,telescopeIrisMounted:false,dancer:false,train:false,parcelTaken:false,portal:false,
 drawerTaken:false,sideTaken:false,pipeTaken:false,ringTaken:false,
 plateOpen:false,ventOpen:false,opticOpened:false,secondSky:false,
 shimUsed:false,coinReturned:false,refundRedeemed:false,serviceSealInserted:false,clockHeart:false,footChecked:false,rightBoltLoose:false,
 serialRead:false,pressureReady:false,gearMazeSolved:false,gearMazePlayed:false,legacyGearBypass:false,resonance:false,serviceOpen:false,
 cylinderMounted:false,tapeInserted:false,letterMailed:false,doorReplied:false};
const s={...defaults};
for(const k of Object.keys(defaults))if(typeof raw[k]==='boolean')s[k]=raw[k];
// The telescope now has TWO real optical fittings, usable in either order.
// Older runs always installed the silver lens before the glass iris. Honor
// their already-completed constellation and second-sky secrets without
// duplicating either pickup or relocking the telescope.
if(typeof raw.telescopeLensMounted!=='boolean')
 s.telescopeLensMounted=!!s.observed;
if(typeof raw.telescopeIrisMounted!=='boolean')
 s.telescopeIrisMounted=!!s.secondSky;
// Older runs opened the service shutter before the key existed. Respect
// their completed chain; never relock a wax cylinder or final mailed letter.
if(s.serviceOpen||s.cylinderMounted||s.tapeInserted||s.letterMailed||s.doorReplied)
 s.serviceSealInserted=true;
// Older saves predate a distinct coin-return origin. Only migrate a
// returning, still-uncollected coin as a vending-machine reward; a coin
// waiting in the original bag must not teleport when the machine is fixed.
if(typeof raw.coinReturned!=="boolean")
 s.coinReturned=!!s.shimUsed&&pendingPickups.has("coin")&&!pocket.has("coin");
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
s.topHits=clamp(Number(raw.topHits)||0,0,12);
s.redHits=clamp(Number(raw.redHits)||0,0,30);
s.dogHits=clamp(Number(raw.dogHits)||0,0,12);
// Migrate the original three-wheel save without erasing solved bags,
// pocket items or earlier dial choices. The fourth wheel starts at zero.
s.bagDials=Array.from({length:4},(_,i)=>
 clamp(Number(Array.isArray(raw.bagDials)?raw.bagDials[i]:0)||0,0,BAG_SYMBOLS.length-1));
// A code attempt is not a permanent discovery. If the door is still
// locked, a refreshed game begins a new six-note phrase, not an invisible
// suffix left from yesterday. Completed melodies retain their history.
s.fluteNotes=s.door&&Array.isArray(raw.fluteNotes)?
 raw.fluteNotes.filter(x=>Number.isInteger(x)&&x>=1&&x<=3).slice(-6):[];
s.rx=clamp(Number.isFinite(raw.rx)?raw.rx:-18,-4000,4000);
// Orientation is a view, not story progress. Always start from an attractive
// three-quarter front angle even if the player left the cube upside down.
s.rx=-22;
s.ry=-32;
s.screws=Array.isArray(raw.screws)?[...new Set(raw.screws.filter(n=>[0,1,2].includes(n)))]:[];
s.hingePins=Array.isArray(raw.hingePins)?[...new Set(raw.hingePins.filter(n=>[0,1,2].includes(n)))]:[];
// Partial vent presses are transient, not progression. They reset on
// reload so an old attempt cannot silently pollute the next five presses.
s.ventSequence=s.ventOpen&&Array.isArray(raw.ventSequence)?
 raw.ventSequence.filter(n=>[1,2,3,4].includes(n)).slice(-5):[];
// Older saves allowed this mechanical ratchet to overrun indefinitely.
// Normalize those poses to its real three-detent end stop without touching
// the player's completed secrets or inventory.
s.eyeRingTicks=clamp(Number(raw.eyeRingTicks)||0,0,3);
s.falseScrewTurns=clamp(Number(raw.falseScrewTurns)||0,0,20);
s.pressureTicks=clamp(Number(raw.pressureTicks)||0,0,3);
s.gearMazeIndex=clamp(Number(raw.gearMazeIndex)||0,0,GEAR_MAZE_DIRECTIONS.length);
s.gearMazeBranch=0;
s.gearMazeTurns=clamp(Number(raw.gearMazeTurns)||0,-720,720);
// Respect the tuning fork already earned in older versions WITHOUT
// silently auto-solving the newly playable gears. The first release
// mistakenly marked previous pressure-dial players' gears complete. That
// auto-migration always left the wheel at turn=0; a genuinely solved maze
// advances the net wheel by two steps. Reopen only those synthetic saves.
// The previously collected/used fork is never deleted or duplicated.
const preMazeReward=s.pressureReady||s.resonance||pocket.has('fork')||
 pendingPickups.has('fork')||seen.has('pressure-dial');
const autoSolvedOldMaze=raw.gearMazeSolved===true&&
 [10,GEAR_MAZE_DIRECTIONS.length].includes(Number(raw.gearMazeIndex))&&
 !Number(raw.gearMazeTurns)&&preMazeReward&&!raw.legacyGearBypass&&
 !raw.gearMazePlayed&&
 !(Array.isArray(raw.recentChanges)&&
   raw.recentChanges.some(e=>e?.id==='calibration-gear'));
if(preMazeReward&&(typeof raw.gearMazeSolved!=='boolean'||autoSolvedOldMaze)){
 s.legacyGearBypass=true;
 s.gearMazeSolved=false;
 s.gearMazeIndex=0;
 s.gearMazeTurns=0;
}
if(s.gearMazeSolved){
 s.gearMazeIndex=GEAR_MAZE_DIRECTIONS.length;
 s.gearMazeBranch=0;
}
// Earlier maze layouts used different circular coordinates. Never interpret
// an old cell ID as a position on the new eight-ring sculpture.
// Recover the nearest milestone instead, preserving earned inventory,
// calibration progress and all legitimate completed puzzle rewards.
const legacyMazeCell=MAZE_ROUTE_CELLS[Math.round(
 s.gearMazeIndex/GEAR_MAZE_DIRECTIONS.length*(MAZE_ROUTE_CELLS.length-1))];
s.gearMazeCell=s.gearMazeSolved?MAZE_GOAL:
 raw.gearMazeLayoutVersion===MAZE_LAYOUT_VERSION&&
 Number.isInteger(raw.gearMazeCell)&&MAZE_GRAPH.has(raw.gearMazeCell)?
 raw.gearMazeCell:legacyMazeCell;
s.gearMazeLayoutVersion=MAZE_LAYOUT_VERSION;
if(raw.gearMazeLayoutVersion!==MAZE_LAYOUT_VERSION&&!s.gearMazeSolved)
 s.gearMazeTurns=0;
// Repair orphaned physical rewards from saves made before independent
// "found but not picked up" state was consistently persisted. Never
// restore something that a downstream puzzle has already consumed.
// Recovered items return to THEIR ORIGINAL PHYSICAL HOLDER, not the pocket.
const recoveredFromSave=[];
const recoverReward=(id,unspent)=>{
 if(!unspent||pocket.has(id)||pendingPickups.has(id))return;
 pendingPickups.add(id);
 recoveredFromSave.push(id);
};
recoverReward('coin',s.mouse&&!seen.has('machine'));
// The first purchase is recorded by "machine". Once a shim has repaired
// that already-paid machine, ANY remaining coin is the RETURNED coin:
// this includes older saves where coinReturned was incorrectly false while
// the player had already collected the refund into their pocket. Previously
// those users could spend that coin and receive useless extra sugar instead
// of the second service drawer. Reconcile the saved origin without deleting
// or auto-collecting the physical coin.
if(s.shimUsed&&seen.has('machine')){
 s.coinReturned=true;
 if(!s.refundRedeemed)recoverReward('coin',!pocket.has('coin'));
}
recoverReward('reed',s.bagSolved&&!seen.has('flute')&&!pocket.has('flute'));
recoverReward('treat',s.bagSolved&&!s.tag);
recoverReward('prism',s.bagSolved&&!seen.has('kite')&&!pocket.has('kite'));
recoverReward('tag',s.tag&&s.doorOpen);
recoverReward('sugar',seen.has('machine')&&!s.watch);
recoverReward('acorn',s.vase&&!s.plant);
recoverReward('spring',s.vase&&!s.music);
recoverReward('raindrop',s.music&&!s.tree);
recoverReward('bird',s.tree&&!s.moon);
recoverReward('bell',s.redHits>=4);
recoverReward('fork',s.pressureReady&&(s.gearMazeSolved||s.legacyGearBypass)&&!s.resonance);
recoverReward('shim',s.ventOpen&&!s.shimUsed);
recoverReward('cog',s.plateOpen&&!s.opticOpened);
recoverReward('washer',s.hingePins.length===3&&!s.clockHeart);
recoverReward('cylinder',s.serviceOpen&&!s.cylinderMounted);
// A previously redeemed second coin made a decorative seal with no use.
// Upgrade that earned discovery into an actual physical service key at
// the machine, without granting it directly or duplicating spent keys.
recoverReward('seal',s.refundRedeemed&&!s.serviceSealInserted&&!s.serviceOpen);
recoverReward('iris',s.opticOpened&&!s.telescopeIrisMounted);
recoverReward('lens',s.floorFour&&!s.telescopeLensMounted);
recoverReward('starmap',s.observed&&!s.train);
recoverReward('stardust',s.mothTouched&&!s.dancer);
recoverReward('parcel',s.parcelTaken&&!seen.has('postcard'));
recoverReward('postcard',seen.has('postcard')&&!s.portal);
recoverReward('tape',s.cylinderMounted&&!s.tapeInserted);
recoverReward('letter',s.tapeInserted&&!s.letterMailed);
recoverReward('envelope',s.letterMailed&&!s.doorReplied);
// Crafted tools are immediately put in inventory when built. If an older
// save lost one but records its crafting discovery, restore that ownership.
// Reusing an already consumed key or kite must never unlock a second puzzle.
for(const [id,owned] of [
 ['key',seen.has('key')&&!s.bagOpen],
 ['flute',seen.has('flute')],
 ['kite',seen.has('kite')&&!s.kite]
]){
 if(owned&&!pocket.has(id)){
  pocket.add(id);pendingPickups.delete(id);recoveredFromSave.push(id);
 }
}
let selected=null,fluteTrayOpen=false,previousFocus=null,panel=null,dragging=false,dragMoved=false,dragStart=null,blockedClick=false;
let changesOpen=false,mechanismsOpen=false;
const changeNotes={
 drawer:'Front latch released. The lavender drawer opened on its runners.',
 thread:'Side release moved. The teal drawer opened with a red spool inside.',
 pipe:'Top hatch opened. A hollow tube is lying in the exposed well.',
 ring:'Underside return slot opened. A brass ring is waiting in its holder.',
 mouse:'Copper catch released a mouse. A bag and vending machine appeared on the front.',
 machine:'The vending machine accepted a coin. A sugar cube is in its little tray.',
 rain:'The cloud produced a drop of water in its holder.',
 parcel:'The tiny train delivered a wrapped parcel.',
 eye:'The rear eye opened, exposing an engraved musical phrase marked A.',
 dot:'The red button moved a ratchet behind the front panel.',
 bell:'An underside shutter opened, exposing a little bell.',
 key:'Two metal pieces locked together to make a key.',
 'bag-code':'The bag catch opened its false bottom. Three small objects are inside.',
 flute:'The hollow tube and reed became a playable flute.',
 door:'The melody released a tiny door on the cube.',
 dog:'The little door opened. A dog is behind it.',
 vase:'The vase broke. Check its fragments for loose contents.',
 music:'The music box started. A tiny cloud appeared.',
 tree:'The small plant grew. Something is caught in its branches.',
 moon:'A paper bird disappeared into the cube. A tiny moon appeared.',
 fourth:'The fourth-floor lift opened. A lens and clockwork moth appeared.',
 constellation:'The first fitted optic brought a constellation into focus. A star chart slid into its holder.',
 dancer:'The music-box dancer emerged after its mechanism was fed.',
 railway:'A tiny railway and train appeared on the cube.',
 portal:'The postcard passed through the enamel. A little landscape appeared.',
 faceplate:'The front fasteners released a small service hatch beside the lens.',
 'vent-sequence':'The five vent presses released a sliding grille with a copper shim inside.',
 'eye-dial':'The rear optical ring reached its stop. A small brass strip is exposed.',
 'hidden-optic':'The drive cog engaged the eye mechanism. A loose glass iris was exposed.',
 'service-bolt':'The repaired machine opened a second drawer. A small brass service key is inside.',
 'hinge-pin':'The last removable hinge pin came free. A washer remains in its seat.',
 'clockwork-heart':'The washer repaired the music box’s small clockwork mechanism.',
 'underside-foot':'A rubber foot slid aside, revealing a musical phrase marked B.',
 'pressure-dial':'The pressure needle reached its stop. A tuning fork sits in the holder above.',
 resonance:'The tuning fork released the catch that holds the service shutter.',
 'service-shutter':'The service shutter opened. A grooved wax cylinder is inside.',
 'wax-cylinder':'The wax cylinder fitted the music box. Punched paper tape emerged.',
 'paper-tape':'The clock read the paper tape and produced a letter.',
 'outgoing-mail':'The tiny train took the letter and returned a sealed envelope.',
 'return-letter':'The door opened the returned letter.'
};
const recentChanges=(Array.isArray(raw.recentChanges)?raw.recentChanges:[])
 .filter(entry=>entry&&typeof entry.id==='string'&&
  typeof entry.message==='string'&&entry.message.length<=230).slice(0,4);
const itemInspections={
 tooth:'A toothed shaft with a two-prong coupling. The handle is missing.',
 ring:'A heavy brass ring with a small flat mounting lug.',
 thread:'A short spool of thread, good for tying something lightweight.',
 pipe:'A hollow tube with a gap for a reed.',
 reed:'A small reed that could vibrate inside a tube.',
 key:'A complete metal key. Its teeth are cut to fit a small lock.',
 coin:'A stamped coin, sized for a narrow slot.',
 treat:'A biscuit with little tooth marks on the edge.',
 prism:'A glass triangle that can catch and bend light.',
 acorn:'The shell is intact. It could still grow.',
 spring:'A tightly wound spring, made to power something small.',
 raindrop:'A bead of water that has somehow kept its shape.',
 bird:'A folded paper bird, delicate but surprisingly sturdy.',
 kite:'A tiny kite. Its thread is taut.',
 sugar:'A little cube of sugar.',
 bell:'Its clapper is loose. It rings when moved.',
 tag:'A metal collar tag with a number stamped on it.',
 lens:'A glass lens with a fitted metal rim.',
 stardust:'Fine glitter from the clockwork moth.',
 starmap:'A star chart folded into a small square.',
 parcel:'A wrapped package with no sender.',
 postcard:'A small postcard with a strange scene on its front.',
 cog:'A brass gear, machined for a drive socket.',
 iris:'A loose glass iris with curved edges.',
 shim:'A thin copper wedge. The edge looks shaped to free a tight mechanism.',
 seal:'A flat brass service key with a narrow notched tip. It came from the machine’s second drawer.',
 washer:'A flat metal ring from the hinge.',
 fork:'Two polished metal tines. They hum when touched.',
 cylinder:'A grooved cylinder made to rotate inside a mechanism.',
 tape:'A strip of punched paper with uneven rows of holes.',
 letter:'A folded letter waiting to be delivered.',
 envelope:'A sealed envelope addressed to someone.'
};
function rememberChange(id,message=changeNotes[id]){
 if(!message)return;
 if(recentChanges[0]?.id===id&&recentChanges[0]?.message===message)return;
 recentChanges.unshift({id,message});
 recentChanges.length=Math.min(4,recentChanges.length);
}
// A compact, opt-in record of only the mechanisms a player has PHYSICALLY
// discovered. Never show undiscovered items, future puzzle destinations,
// code digits, or a prescribed solution. This is an observation log, not an
// automatic hint system. It prevents losing track after rotating six faces.
function ongoingMechanisms(){
 const list=[],add=(name,detail)=>list.push({name,detail});
 if(s.a&&!s.drawerTaken)
  add('Front drawer','The latch is open. A toothed metal piece is still in the drawer.');
 if(s.b&&!s.sideTaken)
  add('Side drawer','The teal drawer is open. Its red spool has not been picked up.');
 if(s.top&&!s.pipeTaken)
  add('Top hatch','The lid lifted the twin gears and drew the tube clips open. A wooden tube is resting in its cradle.');
 if(s.bottom&&!s.ringTaken)
  add('Underside pocket','The bottom compartment is open. Its brass ring is still there.');
 if(s.bag&&!s.bagOpen)
  add('Bag lock','The bag has a small metal keyhole beneath its clasp.');
 if(s.bagOpen&&!s.bagSolved)
  add('Bag wheels','Four wheels rotate independently. The spring catch is a separate control.'+
   (s.eyeRingTicks===3?' A four-symbol strip is visible near the rear iris.':''));
 if(s.bagSolved&&['reed','treat','prism'].some(id=>pendingPickups.has(id)))
  add('Bag lining','The false bottom is open. Loose objects are still in its individual holders.');
 if(s.rightBoltLoose&&!s.ventOpen)
  add('Vent switches','A five-mark service plate is exposed on the right. Four numbered switches are on the left. Registered: '+s.ventSequence.length+'/5.');
 if(s.ventOpen&&pendingPickups.has('shim'))
  add('Vent grille','The grille is open. The copper piece inside is still waiting to be collected.');
 if(!s.gearMazeSolved&&(s.gearMazeIndex>0||s.pressureTicks>0))
  add('Calibration gears','A captive screw moves through connected channels in the large wheel. The two gears turn in opposite directions.'+
   ' The labyrinth wheel turns the pin around a ring; the smaller gear shifts it at open radial crossovers.'+
   (s.legacyGearBypass?' Your previously earned calibration item is still yours.':
    s.pressureReady?' The dial is at its stop; its small brass retaining tongue remains engaged.':''));
 if(s.gearMazeSolved&&!s.pressureReady)
  add('Released calibration latch','The grooved screw has reached its end stop. The brass tongue beside the dial is withdrawn.');
 if(pocket.has('flute')&&!s.door)
  add('Flute','The instrument has three keys and needs six notes. Visible score fragments: '+
   (s.back?'A':'—')+' / '+(s.footChecked?'B':'—')+'.');
 if(s.vase&&['acorn','spring'].some(id=>pendingPickups.has(id)))
  add('Broken vase','The squirrel knocked the vase loose. Its acorn and spring have not both been collected.');
 if(s.music&&pendingPickups.has('raindrop'))
  add('Little cloud','The music box started. A raindrop is waiting in the cloud’s collector.');
 if(s.tree&&pendingPickups.has('bird'))
  add('Grown tree','There is a folded bird caught in the miniature tree.');
 if(s.tag&&pendingPickups.has('tag'))
  add('Dog collar','The numbered collar tag is resting in the dog’s tray.');
 if(seen.has('machine')&&!s.shimUsed&&!s.refundRedeemed)
  add('Vending machine','The first purchase worked, but the coin-return slot is still jammed.');
 if(s.shimUsed&&seen.has('machine')&&!s.refundRedeemed)
  add('Coin return','The return slot has been repaired. The machine now has a working coin return.'+
   (pendingPickups.has('coin')?' A coin is in the tray.':''));
 if(s.refundRedeemed&&!s.serviceSealInserted&&!s.serviceOpen)
  add('Service key','The second vending tray opened.'+
   (pendingPickups.has('seal')?' Its brass key has not been picked up.':
    pocket.has('seal')?' You are carrying the brass key.':''));
 if(!s.serviceOpen&&(s.serviceSealInserted||s.resonance||seen.has('pressure-dial'))){
  const key=s.serviceSealInserted?'Keyway engaged':'Keyway empty';
  const catchState=s.resonance?'Spring catch released':'Spring catch engaged';
  add('Service shutter',key+' · '+catchState+'. Both fittings are part of the same shutter.');
 }
 if(s.serviceOpen&&!s.cylinderMounted)
  add('Open service shutter','The shutter is open. A grooved wax cylinder came out of this compartment.'+
   (pendingPickups.has('cylinder')?' It is still in its holder.':''));
 if(s.cylinderMounted&&!s.tapeInserted)
  add('Music box drive','The wax cylinder is installed. Punched paper emerged from the music box.');
 if(s.tapeInserted&&!s.letterMailed)
  add('Clock reader','The clock has read the tape. A folded letter is available.'+
   (pendingPickups.has('letter')?' It is still at the clock.':''));
 if((s.serialRead||s.watch&&s.tag)&&!s.floorFour)
  add('Miniature lift','A small four-floor carriage is exposed, with separate numbered controls.');
 if(s.floorFour&&!s.observed)
  add('Fourth-floor lift','The lift opened onto a lens and a clockwork moth.'+
   (pendingPickups.has('lens')?' The lens is still in the lift.':''));
 if(s.mothTouched&&pendingPickups.has('stardust'))
  add('Clockwork moth','A little glowing dust remains in the moth’s holder.');
 if(seen.has('observatory')&&!s.observed)
  add('Telescope','The barrel has two distinct optical sockets. Neither contains a fitted piece.');
 if(s.observed){
  if(!s.secondSky&&s.telescopeLensMounted!==s.telescopeIrisMounted)
   add('Optical fittings','The star chart was produced, but one of the telescope’s two fitted sockets is still empty.');
  if(!s.train)
   add('Star chart','The telescope produced a folded chart.'+
    (pendingPickups.has('starmap')?' It is still in its holder.':''));
 }
 if(s.letterMailed&&!s.doorReplied)
  add('Returned mail','The train has returned a sealed envelope.'+
   (pendingPickups.has('envelope')?' It is waiting at the station.':''));
 return list;
}
// The pocket is re-rendered after every mechanical action. Newly found
// highlights and keyboard focus must survive those renders.
const pocketArrivalUntil=new Map();
let toastTimeout=null,animationTimeout=null,fleeing=false;
const story={};
function store(){
 try{localStorage.setItem(KEY,JSON.stringify({...s,seen:[...seen],pocket:[...pocket],pendingPickups:[...pendingPickups],recentChanges}))}catch{}
}
function tell(message){$('ncNarrator').textContent=message}
function sound(freq=530){
 // Real CC0 mechanical samples replace the old generic oscillator beep.
 window.NothingHereAudio?.toneFor?.(freq);
}
function bloom(id,comment){
 if(!title.has(id)||seen.has(id))return false;
 seen.add(id);
 rememberChange(id);
 // In physical 3D, the reward lives in the inventory and journal, not as
 // an oversized flying notification pasted over the mechanical box.
 const physical=document.body.classList.contains('nc-physical-ready');
 const t=$('ncToast');
 clearTimeout(toastTimeout);
 t.hidden=physical;
 if(!physical){
  t.textContent='✳  '+title.get(id);
  toastTimeout=setTimeout(()=>t.hidden=true,2700);
 }
 if(comment)tell(comment);
 window.NothingHereAudio?.play?.('discovery');render();return true;
}
function gain(id,message,direct=false){
 if(!Object.hasOwn(names,id)||pocket.has(id))return;
 if(!direct&&document.body.classList.contains('nc-physical-ready')){
  // Actual rewards remain where they were revealed. The player must
  // press the little 3D model to move it to inventory; no automatic
  // pick-up timer, generated reward popup or duplicate entry.
  if(!pendingPickups.has(id)){
   pendingPickups.add(id);
   window.NothingHereAudio?.play?.('reveal');
   tell('A '+names[id]+' is ready to collect. Find it on the cube and press it.');
   render();
  }
  return;
 }
 pendingPickups.delete(id);
 if(!pocket.has(id)){
  const origin=document.activeElement?.closest?.('[data-hit],[data-thing],[data-dial]')||null;
  pocket.add(id);
  // Record only actually collected objects, never clues still locked away.
  if(direct)rememberChange('collected:'+id,'Collected '+names[id]+'. It is now in your pocket.');
  window.NothingHereAudio?.play?.('pickup');
  pocketArrivalUntil.set(id,Date.now()+1150);
  if(message)tell(message);
  render();
  flyToPocket(id,origin);
  window.setTimeout(()=>{
   pocketArrivalUntil.delete(id);
   document.querySelector('#ncInventory [data-item="'+id+'"]')
    ?.classList.remove('nc-item-new');
  },1150);
 }
}
function spend(id){if(!pocket.has(id))return false;pocket.delete(id);if(selected===id)selected=null;return true}
function turn(){
 $('ncCube').style.transform='rotateX('+s.rx+'deg) rotateY('+s.ry+'deg)';
 window.__nothing3DPreview?.setRotation?.(s.rx,s.ry);
 store();
}
function modal(kicker,heading,body,type){
 previousFocus=document.activeElement;panel=type||'note';
 $('ncModalEyebrow').textContent=kicker;
 $('ncModalTitle').textContent=heading;
 $('ncModalBody').innerHTML=body;
 $('ncModal').querySelector('.nc-modal')?.classList.toggle('nc-reset-dialog',type==='reset');
 $('ncModal').hidden=false;$('gameInfoBtn')?.setAttribute('aria-expanded',String(type==='info'));
 $('ncModalClose').focus();
}
function closeModal(){
 if($('ncModal').hidden)return;
 $('ncModal').hidden=true;panel=null;
 $('ncModal').querySelector('.nc-modal')?.classList.remove('nc-reset-dialog');
 $('gameInfoBtn')?.setAttribute('aria-expanded','false');
 if(previousFocus?.isConnected)previousFocus.focus();
}
// Destructive progress reset is opt-in and limited to this game's local
// save slot. The first click opens a small accessible dialog; only pressing
// the SECOND Reset button deletes progress. Other Crilo data is untouched.
function openCubeResetConfirmation(){
 modal('START AGAIN?','Reset the cube?',
  '<p>Erase your Nothing Here discoveries, collected items, and puzzle progress saved in this browser? This cannot be undone.</p>'+
  '<p>Other Crilo games and your account will not be affected.</p>'+
  '<div class="nc-reset-actions">'+
   '<button type="button" id="ncCancelCubeReset">Cancel</button>'+
   '<button type="button" id="ncConfirmCubeReset" aria-label="Reset the Cube and erase local progress">Reset</button>'+
  '</div>','reset');
 // Put the safe action first, not the destructive button.
 $('ncCancelCubeReset')?.focus();
}
function confirmCubeReset(){
 if(panel!=='reset'||$('ncModal').hidden)return;
 try{
  localStorage.removeItem(KEY);
  if(localStorage.getItem(KEY)!==null)throw new Error('Save is still present');
 }catch(error){
  tell('The browser could not clear this cube\'s save.');
  const body=$('ncModalBody');
  body.querySelector('.nc-reset-error')?.remove();
  const notice=document.createElement('p');
  notice.className='nc-reset-error';
  notice.textContent='This browser did not allow the saved game to be cleared. Check site storage permissions and try again.';
  body.prepend(notice);
  return;
 }
 // The authoritative in-memory game state belongs to the old document.
 // Reload once so puzzles, models, timers and inventory start together.
 location.reload();
}
const prop=key=>document.querySelector('[data-thing="'+key+'"]');
// Scene animation director. Events change immediately; motion is a visual
// rendition of the same authoritative state, never a puzzle prerequisite.
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
const cueTimers=new WeakMap();
function cue(el,className,duration=1150){
 if(typeof el==='string')el=$(el);
 if(!el)return;
 const previous=cueTimers.get(el);
 if(previous)clearTimeout(previous);
 el.classList.remove(className);
 void el.offsetWidth;
 el.classList.add(className);
 const timer=setTimeout(()=>{el.classList.remove(className);cueTimers.delete(el)},reducedMotion?40:duration);
 cueTimers.set(el,timer);
}
function scatter(color='#e4b2af',count=10,source=null){
 if(reducedMotion||document.body.classList.contains('nc-physical-ready'))return;
 const area=$('ncWorld'),layer=$('ncFragments');
 if(!area||!layer)return;
 const world=area.getBoundingClientRect();
 const r=source?.getBoundingClientRect?.()||$('ncCube').getBoundingClientRect();
 const x=(r.left+r.width/2-world.left)/world.width*100;
 const y=(r.top+r.height/2-world.top)/world.height*100;
 for(let i=0;i<count;i++){
  const node=document.createElement('i');
  node.className='nc-spark-shard';
  const angle=(i/count)*Math.PI*2,radial=42+(i%4)*14;
  node.style.cssText='--x:'+x+'%;--y:'+y+'%;--fill:'+color+';--size:'+(i%3===0?12:7)+
  'px;--dx:'+(Math.cos(angle)*radial)+'px;--dy:'+(Math.sin(angle)*radial-24)+
  'px;--spin:'+(i%2?-150:190)+'deg;--duration:'+(0.7+(i%4)*.1)+'s';
  layer.appendChild(node);
  setTimeout(()=>node.remove(),1350);
 }
}
function flyToPocket(id,origin){
 // Collected objects disappear from their real socket and reappear inside
 // the pocket. No 2D sprite should float in front of the Three.js artifact.
 if(reducedMotion||document.body.classList.contains('nc-physical-ready'))return;
 const target=document.querySelector('#ncInventory [data-item="'+id+'"]');
 const dest=target?.getBoundingClientRect();
 const physical=document.body.classList.contains('nc-physical-ready')
  ?window.__nothing3DPreview?.projectItemSource?.(id):null;
 const from=physical&&Number.isFinite(physical.x)&&Number.isFinite(physical.y)
  ?{left:physical.x-20,top:physical.y-20,width:40,height:40}
  :origin?.getBoundingClientRect?.()||$('ncCube').getBoundingClientRect();
 if(!dest||!from)return;
 const node=document.createElement('div');node.className='nc-inventory-fly';
 node.innerHTML=inventoryIcon(id);
 const x=from.left+from.width/2-20,y=from.top+from.height/2-20;
 node.style.left=x+'px';node.style.top=y+'px';
 node.style.setProperty('--tx',dest.left+dest.width/2-x-20+'px');
 node.style.setProperty('--ty',dest.top+dest.height/2-y-20+'px');
 document.body.appendChild(node);
 setTimeout(()=>node.remove(),900);
}
function floatNote(origin){
 if(reducedMotion||!origin||document.body.classList.contains('nc-physical-ready'))return;
 const node=document.createElement('span');node.className='nc-musical-note';node.textContent='♪';
 origin.appendChild(node);setTimeout(()=>node.remove(),1260);
}
function incident(symbol){
 if(document.body.classList.contains('nc-physical-ready'))return;
 const node=$('ncIncident');$('ncIncidentIcon').textContent=symbol;
 node.classList.remove('nc-incident-pop');void node.offsetWidth;node.classList.add('nc-incident-pop');
 clearTimeout(animationTimeout);animationTimeout=setTimeout(()=>node.classList.remove('nc-incident-pop'),1100);
}
function render(){
 $('ncCount').textContent=seen.size;
 const recent=$('ncLastChanges'),toggleChanges=$('ncChangesToggle');
 const listChanges=$('ncChangesList'),countChanges=$('ncChangesCount');
 if(recent&&toggleChanges&&listChanges&&countChanges){
  recent.hidden=!recentChanges.length;
  countChanges.textContent=recentChanges.length?'('+recentChanges.length+')':'';
  toggleChanges.setAttribute('aria-expanded',String(changesOpen));
  listChanges.hidden=!changesOpen;
  if(changesOpen){
   const shown=recentChanges.map(e=>e.id+':'+e.message).join('|');
   if(listChanges.dataset.shown!==shown){
    listChanges.replaceChildren();
    for(const entry of recentChanges){
     const li=document.createElement('li');
     li.textContent=entry.message;
     listChanges.append(li);
    }
    listChanges.dataset.shown=shown;
   }
  }
 }
 const mechanisms=$('ncMechanisms'),mechanismsToggle=$('ncMechanismsToggle');
 const mechanismsList=$('ncMechanismsList'),mechanismsCount=$('ncMechanismsCount');
 if(mechanisms&&mechanismsToggle&&mechanismsList&&mechanismsCount){
  const active=ongoingMechanisms();
  mechanisms.hidden=!active.length;
  mechanismsCount.textContent=active.length?'('+active.length+')':'';
  mechanismsToggle.setAttribute('aria-expanded',String(mechanismsOpen));
  mechanismsList.hidden=!mechanismsOpen;
  if(mechanismsOpen){
   const snapshot=active.map(e=>e.name+':'+e.detail).join('|');
   if(mechanismsList.dataset.shown!==snapshot){
    mechanismsList.replaceChildren();
    for(const entry of active){
     const li=document.createElement('li');
     const heading=document.createElement('strong');
     heading.textContent=entry.name;
     const detail=document.createElement('span');
     detail.textContent=entry.detail;
     li.append(heading,detail);
     mechanismsList.append(li);
    }
    mechanismsList.dataset.shown=snapshot;
   }
  }
 }
 document.body.classList.toggle('nc-a-open',s.a);
 document.body.classList.toggle('nc-b-open',s.b);
 document.body.classList.toggle('nc-top-open',s.top);
 document.body.classList.toggle('nc-under-open',s.bottom);
 document.body.classList.toggle('nc-mouse-awake',s.left);
 document.body.classList.toggle('nc-bag-open',s.bagOpen);
 document.body.classList.toggle('nc-fallen',s.vase);
 document.body.classList.toggle('nc-tree-grown',s.tree);
 document.body.classList.toggle('nc-raining',s.cloud&&s.music);
 document.body.classList.toggle('nc-moon',s.moon);
 document.body.classList.toggle('nc-music',s.music);
 document.body.classList.toggle('nc-barked',s.barked);
 document.body.classList.toggle('nc-lift-open',s.floorFour);
 document.body.classList.toggle('nc-observed',s.observed);
 document.body.classList.toggle('nc-dancer',s.dancer);
 document.body.classList.toggle('nc-train-running',s.train);
 document.body.classList.toggle('nc-portal-view',s.portal);
 document.body.classList.toggle('nc-front-plate-free',s.plateOpen);
 document.body.classList.toggle('nc-vent-open',s.ventOpen);
 document.body.classList.toggle('nc-back-dial-aligned',s.eyeRingTicks>=3);
 document.body.classList.toggle('nc-second-sky',s.secondSky);
 document.body.classList.toggle('nc-clockwork-heart',s.clockHeart);
 document.body.classList.toggle('nc-serial-read',s.serialRead);
 document.body.classList.toggle('nc-pressure-ready',s.pressureReady);
 document.body.classList.toggle('nc-resonance',s.resonance);
 document.body.classList.toggle('nc-service-open',s.serviceOpen);
 document.body.classList.toggle('nc-cylinder-mounted',s.cylinderMounted);
 document.body.classList.toggle('nc-tape-inserted',s.tapeInserted);
 document.body.classList.toggle('nc-letter-mailed',s.letterMailed);
 document.body.classList.toggle('nc-door-replied',s.doorReplied);
 const pressure=document.querySelector('.nc-pressure-dial');
 if(pressure)pressure.style.setProperty('--nc-pressure-angle',(-105+s.pressureTicks*70)+'deg');
 document.querySelectorAll('[data-hit^="front-screw-"]').forEach(el=>{
  const n=Number(el.dataset.hit.slice(-1));
  el.classList.toggle('nc-fastener-removed',s.screws.includes(n));
  el.classList.toggle('nc-fastener-fake',n===3);
 });
 const concealedStrip=document.querySelector('[data-hit="cipher-strip"]');
 if(concealedStrip)concealedStrip.hidden=s.eyeRingTicks<3;
 document.querySelectorAll('[data-hit^="hinge-"]').forEach(el=>{
  el.classList.toggle('nc-hinge-shifted',s.hingePins.includes(Number(el.dataset.hit.slice(-1))));
 });
 document.querySelectorAll('[data-hit^="vent-"]').forEach(el=>{
  el.classList.toggle('nc-vent-pressed',s.ventOpen);
 });
 const rightBolt=document.querySelector('[data-hit="right-bolt-1"]');
 if(rightBolt)rightBolt.classList.toggle('nc-fastener-removed',s.rightBoltLoose);
 if(s.portal)$('ncOfferingTarget')?.setAttribute('aria-label','Inspect the tiny landscape inside the cube');
 $('ncDrawerA')?.classList.toggle('nc-emptied',s.drawerTaken);
 $('ncDrawerB')?.classList.toggle('nc-emptied',s.sideTaken);
 $('ncLid')?.classList.toggle('nc-emptied',s.pipeTaken);
 $('ncDoorScene').hidden=!s.door;
 $('ncDoorPlace').hidden=!s.doorOpen;
 if($('ncDoor'))$('ncDoor').classList.toggle('nc-door-open',s.doorOpen);
 for(const [name,on] of Object.entries({
 bag:s.bag, vase:s.doorOpen, squirrel:s.squirrel&&(!s.barked||fleeing),
 pot:s.vase, musicbox:s.vase, cloud:s.cloud,
 cup:s.music,clock:s.watch,machine:s.mouse,
  elevator:s.watch&&s.tag,moth:s.floorFour,telescope:s.moon,train:s.train
 })){const node=prop(name);if(node)node.hidden=!on}
 const inventory=$('ncInventory');
 const count=$('ncPocketCount');
 if(count){
  count.textContent=pocket.size+' carried';
  count.setAttribute('aria-label',pocket.size+' items carried');
 }
 // Clear feedback for the new physical-only pickup behavior. Do not
 // list items, signal which mechanism they belong to, or spoil a recipe.
 const awaiting=$('ncAwaitingPickups'),awaitingLabel=$('ncAwaitingCount');
 if(awaiting&&awaitingLabel){
  const n=pendingPickups.size;
  awaiting.hidden=n===0;
  if(n){
   awaitingLabel.textContent=n===1
    ?'1 object is waiting on the cube. Press it to collect.'
    :n+' objects are waiting on the cube. Press each one to collect.';
  }
 }
 const combineGuide=$('ncCombineGuide');
 $('ncPocket')?.classList.toggle('nc-holding',!!selected);
 if(combineGuide){
  const action=selected
   ?(itemInspections[selected]||'Look closely at the object you are holding.')+
    ' If a fitting glows green while you inspect it, try the item there. You can also choose another inventory item to combine.'
   :'Pick an item to inspect it. Some fit together in your pocket; others work on the cube.';
  const strong=combineGuide.querySelector('strong');
  if(strong)strong.textContent=selected?'Try it: ':'Try things: ';
  const current=combineGuide.querySelector('.nc-combine-instructions');
  if(current)current.textContent=action;
  else{
   combineGuide.textContent='';
   const heading=document.createElement('strong');
   heading.textContent=selected?'Try it: ':'Try things: ';
   combineGuide.append(heading);
   const prose=document.createElement('span');
   prose.className='nc-combine-instructions';
   prose.textContent=action;
   combineGuide.append(prose);
  }
 }
 const focusedItem=inventory.contains(document.activeElement)
  ?document.activeElement.closest('[data-item]')?.dataset.item:null;
 const now=Date.now();
 // Rebuilding the entire pocket after each physical 3D action used to
 // discard every button and SVG, causing focus loss, flickering arrival
 // animations, and unnecessary layout work as the collection grew.
 // Keep a stable DOM node for each actual item. Only changed pocket
 // contents are inserted or removed; no undiscovered item is created.
 const existing=new Map([...inventory.querySelectorAll('.nc-item')]
  .map(button=>[button.dataset.item,button]));
 for(const [id,button] of existing){
  if(!pocket.has(id)){button.remove();existing.delete(id)}
 }
 if(!pocket.size){
  if(!inventory.querySelector('.nc-empty'))
   inventory.innerHTML='<span class="nc-empty">Nothing. Yet.</span>';
 }else{
  inventory.querySelector('.nc-empty')?.remove();
  for(const id of pocket){
   let button=existing.get(id);
   if(!button){
    button=document.createElement('button');
    button.type='button';
    button.className='nc-item';
    button.dataset.item=id;
    button.draggable=true;
    button.dataset.material=pocketMaterial(id);
    button.innerHTML='<span class="nc-item-icon" aria-hidden="true">'+
     inventoryIcon(id)+'</span>'+names[id];
    inventory.appendChild(button);
   }
   const combinesWithHeld=!!selected&&id!==selected&&
    !!recipe[sorted(selected,id)];
   button.classList.toggle('nc-selected',id===selected);
   button.classList.toggle('nc-item-reactive',itemMayReact(id));
   button.classList.toggle('nc-item-playable',id==='flute');
   if(id==='flute')button.setAttribute('aria-expanded',String(fluteTrayOpen));
   else button.removeAttribute('aria-expanded');
   button.classList.toggle('nc-item-combine-match',combinesWithHeld);
   button.classList.toggle('nc-item-new',(pocketArrivalUntil.get(id)||0)>now);
   button.title=combinesWithHeld?'Fits with the item you are holding':
    id===selected?'Click again to put it down':
    id==='flute'?'Open the flute keys below to play six notes':
    craftParts.has(id)&&worldUseItems.has(id)?'Might work on the cube or with another item':
    craftParts.has(id)?'Might fit with another item':
    worldUseItems.has(id)?'Might work on the cube':'Collected item';
   button.setAttribute('aria-label',names[id]+'. '+button.title);
   button.setAttribute('aria-pressed',String(id===selected));
  }
 }
 // Keyboard players must not lose focus just because an unrelated gear
 // was clicked or the same pocket item was selected again.
 if(focusedItem&&pocket.has(focusedItem))
  inventory.querySelector('[data-item="'+focusedItem+'"]')?.focus({preventScroll:true});
 const held=$('ncPocketSelection');
 if(held){
  held.textContent=selected?'Holding '+names[selected]:'';
  held.hidden=!selected;
 }
 $('ncUnselect').hidden=!selected;
 // This playable instrument is in the pocket, not a detached fullscreen
 // dialog. It uses the SAME canonical note engine as the physical keys.
 const fluteTray=$('ncFluteTray');
 if(fluteTray){
  const show=fluteTrayOpen&&pocket.has('flute');
  fluteTray.hidden=!show;
  if(show){
   const progress=fluteTray.querySelectorAll('#ncFluteNoteSteps i');
   const entered=s.door?Math.min(6,s.fluteNotes.length):s.fluteNotes.length;
   progress.forEach((lamp,i)=>lamp.classList.toggle('is-lit',i<entered));
   const scoreState=$('ncFluteScores');
   if(scoreState){
    scoreState.textContent='Engraved scores: A '+(s.back?'found':'not found')+
     ' · B '+(s.footChecked?'found':'not found')+'.';
   }
   const status=$('ncFluteStatus');
   if(status)status.textContent=s.door?
    'The tiny door is already open. You can still play the flute.':
    entered?'Notes played: '+s.fluteNotes.map(n=>['Ⅰ','Ⅱ','Ⅲ'][n-1]).join(' · ')+
     ' ('+entered+' of 6).':
     'Ready. Play six notes. A wrong phrase resets so you can try again.';
  }
 }
 // A selected item is clearly marked in the pocket, but never highlight
 // the correct combinations or recipient targets before discovery.
 document.querySelectorAll('[data-thing]').forEach(node=>{
  node.classList.remove('nc-receptive');
 });
 store();
 // The physical renderer reflects the same authoritative puzzle state;
 // neither the 3D mesh nor its animation grants secrets independently.
 window.dispatchEvent(new CustomEvent('nc:statechange',{
  // Always send the discovery catalog alongside the physical inventory.
  // Story props (such as the vending tray) depend on awarded discoveries,
  // not just boolean puzzle flags. Missing "seen" rewound their movements
  // on the next render even though the save itself was correct.
  detail:{...s,seen:[...seen],pocket:[...pocket],pendingPickups:[...pendingPickups],selected}
 }));
}
function collection(id){gain(id,'You found '+names[id]+'.',true)}
function collectPhysicalPickup(id){
 if(!Object.hasOwn(names,id))return false;
 // A visible key or spool is not a free shortcut into a sealed mechanism.
 // The canonical story state, not raycast visibility alone, authorizes it.
 if((id==='tooth'&&!s.a)||(id==='thread'&&!s.b)||
    (id==='pipe'&&!s.top)||(id==='ring'&&!s.bottom))return false;
 if(id==='tooth'&&s.a&&!s.drawerTaken){cubeHit('drawer-a');return true}
 if(id==='thread'&&s.b&&!s.sideTaken){cubeHit('drawer-b');return true}
 if(id==='pipe'&&s.top&&!s.pipeTaken){cubeHit('top-reed');return true}
 if(id==='ring'&&s.bottom&&!s.ringTaken){
  s.ringTaken=true;collection('ring');render();return true;
 }
 if(!pendingPickups.has(id))return false;
 gain(id,'You picked up '+names[id]+'.',true);
 render();
 return true;
}
// Exposed 3D objects wait for a deliberate click; never auto-add them.
function inspectHardware(name){
 // Codes are read from their actual, exposed metal plates. A hidden plate
 // remains silent even if a script tries to call its action directly.
 if(name==='read:vents'){
  tell(s.rightBoltLoose?
   'Five marks stamped below the empty bolt socket: 3 · 1 · 4 · 2 · 3.':
   'The service bolt still covers the engraved strip.');
  return true;
 }
 if(name==='read:score-a'){
  tell(s.back?
   'Inscription A, beneath the eye: Ⅱ · Ⅰ · Ⅲ. These are musical notes for the small flute.':
   'The eye still covers this part of the brass.');
  return true;
 }
 if(name==='read:score-b'){
  tell(s.footChecked?
   'Inscription B, under the moved rubber foot: Ⅰ · Ⅲ · Ⅱ. The flute has three matching keys.':
   'A rubber foot is still covering this inscription.');
  return true;
 }
 if(name==='serial'){
  const newlyOpened=!s.serialRead;
  s.serialRead=true;
  bloom('maker-stamp','Stamped beneath the maker\'s seal: PROPERTY OF NOBODY / 04 / CALIBRATE TO THREE.');
  tell(newlyOpened
   ?'The maker’s stamp trips an internal catch. A little lift rises from its bolted side rail. The inspection plate is marked 04.'
   :'The inspection plate still reads 04. Its neighboring lift stays accessible.');
  cue(document.querySelector('[data-hit="serial"]'),'nc-fastener-turning',550);
  return true;
 }
 if(name==='gear-small'||name==='gear-large'||
   ["maze-cw","maze-ccw","maze-in","maze-out"].includes(name)){
  const direction=name==="gear-large"?"maze-ccw":
   name==="gear-small"?"maze-cw":name;
  if(s.gearMazeSolved){
   tell('The captive roller has entered the center socket. The dial latch is released.');
   return true;
  }
  s.gearMazePlayed=true;
  const next=mazeDestination(s.gearMazeCell,direction);
  if(next===null){
   tell('The roller meets a solid wall. Try a different opening.');
   sound(210);return true;
  }
  s.gearMazeCell=next;
  // The black cog drives the exposed toothed carrier, while the white
  // labyrinth face stays fixed. Drag either direction to move the pin
  // clockwise/counterclockwise along an actual curved lane; the dial only
  // controls radial passages.
  if(direction==="maze-ccw"||direction==="maze-cw")
   s.gearMazeTurns=clamp(s.gearMazeTurns+
    (direction==="maze-cw"?1:-1),-720,720);
  const mainNode=MAZE_ROUTE_CELLS.indexOf(next);
  if(mainNode>=0)s.gearMazeIndex=Math.round(
   mainNode/(MAZE_ROUTE_CELLS.length-1)*GEAR_MAZE_DIRECTIONS.length);
  s.gearMazeBranch=0;
  if(next===MAZE_GOAL){
   s.gearMazeSolved=true;
   s.gearMazeIndex=GEAR_MAZE_DIRECTIONS.length;
   rememberChange('calibration-gear',
    'The roller passes through the center socket. The linkage withdraws the calibration latch.');
   if(s.pressureReady&&!s.resonance){
    gain('fork');
    tell('The roller seats in the socket and the calibrated dial releases a tuning fork into its bracket.');
   }else tell('The center socket releases the latch, but the needle still needs calibrating.');
  }else{
   tell(direction==="maze-in"?'The dial guides the roller into an inner ring.':
    direction==="maze-out"?'The dial guides the roller into an outer ring.':
    'The drive cog turns beneath the stationary maze while the pin travels through the carved groove.');
  }
  sound(290+(s.gearMazeCell%MAZE_SECTORS)*12);
  return true;
 }
 if(name==='pressure'){
  if(!s.pressureReady){
   s.pressureTicks++;
   sound(265+s.pressureTicks*130);
   if(s.pressureTicks>=3){
    s.pressureReady=true;
    if(s.gearMazeSolved)gain('fork');
    bloom('pressure-dial',s.gearMazeSolved
     ?'The needle reaches its third mark. The released brass tongue lets the tuning fork slide into its holder.'
     :'The needle reaches its third mark, but a short brass tongue still holds the tuning-fork retainer. The nearby meshed gears carry a captive screw in a grooved track.');
    scatter('#e4c99b',9,document.querySelector('[data-hit="pressure"]'));
   }else tell('The calibration knob advances the needle by one marked step. A small catch beside the dial remains closed.');
  }else tell(!s.gearMazeSolved&&!s.legacyGearBypass
   ?'The needle is aligned at its third mark, but a brass latch still holds the tuning-fork retainer. The grooved gears beside it have not released the latch.'
   :!s.gearMazeSolved&&s.legacyGearBypass
    ?'The dial was calibrated in an earlier run. Its earned item remains yours, though the two meshed gears still have a captive screw to investigate.'
   :pendingPickups.has('fork')
    ?'The dial is calibrated and its catch is clear. The tuning fork is still in the bracket beside the dial.'
    :'The calibration mechanism is open. Its empty bracket shows where the tuning fork was held.');
  return true;
 }
 if(name==='shutter'){
  if(selected&&use(selected,'shutter'))return true;
  if(s.serviceOpen){tell(pendingPickups.has('cylinder')
    ?'The service shutter is already open. A wax cylinder is resting in its holder.'
    :'The service shutter is open and its wax-cylinder holder is empty.');return true}
  if(!s.serviceSealInserted){
   tell('The service shutter has a small rectangular keyway beside its vibrating spring catch. The keyway is empty.');
   return true;
  }
  if(!s.resonance){
   tell('The brass service key is seated in its lock, but the vibrating spring catch still holds the shutter shut.');
   return true;
  }
  if(!s.serviceOpen){
   s.serviceOpen=true;gain('cylinder');
   bloom('service-shutter','The service shutter slides aside and exposes a grooved wax cylinder in its recessed holder.');
   cue('ncWorld','nc-shudder',450);scatter('#a4cbca',11,document.querySelector('[data-hit="shutter"]'));
  }else tell(pendingPickups.has('cylinder')
    ?'There’s a wax cylinder inside. Pick it up if you want it.'
    :'That compartment’s already empty.');
  return true;
 }
 if(name.startsWith('front-screw-')){
  const n=Number(name.slice(-1));
  if(n===3){
   if(!s.falseScrewTurns){
    s.falseScrewTurns=1;
    bloom('false-screw','The captive fastener depresses once. It is a spring button, not a screw.');
    tell('This unusual fastener has a captive spring. It settles firmly against its end stop.');
    cue(document.querySelector('[data-hit="'+name+'"]'),'nc-fastener-turning',550);
   }else tell('That button won’t go any farther.');
  }else if(!s.screws.includes(n)){
   s.screws.push(n);bloom('fastener','The front screw comes free, leaving an empty threaded socket in the service cover.');
   if(s.screws.length===3){
    s.plateOpen=true;gain('cog');
    bloom('faceplate','The third screw releases a small service hatch beside the front lens. Inside its captive brass socket is a drive cog you can pick up.');
    cue('ncCube','nc-scene-blink',800);
   }else tell('The screw has been removed from the front cover. The remaining fasteners still hold it closed.');
   scatter('#c7b8a5',5,document.querySelector('[data-hit="'+name+'"]'));
   sound(620);
  }else tell('Nothing to unscrew here. The empty hole is threaded.');
  return true;
 }
 if(name.startsWith('right-bolt-')){
  const n=Number(name.slice(-1));
  if(n===1&&!s.rightBoltLoose){
   s.rightBoltLoose=true;
   tell('The service bolt withdraws. A narrow strip with five stamped numbers is exposed below its empty socket.');
   scatter('#9ec7c9',7,document.querySelector('[data-hit="'+name+'"]'));
  }else if(n===1)tell('The bolt is already out. The five-number strip remains visible below the empty socket.');
  else tell(['The first rivet has a slot shaped like a minus sign.',
   '', 'The third rivet was installed backwards.','The fourth rivet holds the drawer rail.'][n]);
  return true;
 }
 if(name.startsWith('vent-')){
  const n=Number(name.slice(-1));
  if(s.ventOpen){tell('The grille’s already open.');return true}
  if(!Number.isInteger(n)||n<1||n>4)return true;
  s.ventSequence.push(n);
  if(s.ventSequence.join('')===VENT_CODE.join('')){
   s.ventOpen=true;gain('shim');
   bloom('vent-sequence','The five-step mechanism releases. The slotted shutter retracts, exposing a copper shim in its cavity.');
   tell('All five vent switches seat correctly. The grille slides aside and exposes a copper shim in its holder.');
   cue('ncWorld','nc-shudder',430);scatter('#d1a996',9,document.querySelector('[data-hit="'+name+'"]'));
  }else if(s.ventSequence.length>=VENT_CODE.length){
   // Every failed attempt really resets. Retaining the last key used to
   // leave a hidden partial attempt between full retries.
   s.ventSequence=[];
   tell('The five vent switches spring back. Nothing opened; try the sequence again from the first switch.');
   sound(200);
  }else{
   tell('Vent switch '+n+' clicks. '+s.ventSequence.length+' of five presses registered.');
   sound(270+n*90);
  }
  return true;
 }
 if(name==='eye-ring'){
  const oldTicks=Math.min(3,s.eyeRingTicks||0);
  s.eyeRingTicks=Math.min(3,oldTicks+1);
  if(oldTicks<3&&s.eyeRingTicks===3)
   bloom('eye-dial','The optical collar reaches its stop. A narrow brass inscription appears beside the lens.');
  else tell(oldTicks===3?'The optical ring is against its mechanical stop.':'The iris ratchet clicks to its next detent.');
  cue(document.querySelector('[data-hit="eye-ring"]'),'nc-fastener-turning',500);
  return true;
 }
 if(name==='cipher-strip'){
  if(s.eyeRingTicks<3){tell('There is only a closed seam here. The optical ring might move it.');return true}
  tell('Beneath the calibrated rear lens, a brass ribbon bears four distinct marks: ◇ · ○ · ☾ · ✳.');
  sound(575);
  return true;
 }
 if(name.startsWith('hinge-')){
  const n=Number(name.slice(-1));
  if(!s.hingePins.includes(n)){
   s.hingePins.push(n);sound(350+n*125);
   if(s.hingePins.length===3){
    gain('washer');bloom('hinge-pin','The third hinge pin withdraws. A loose washer is now resting in the empty hinge seat.');
    scatter('#e0c88a',8,document.querySelector('[data-hit="'+name+'"]'));
   }else tell('The hinge pin pulls clear of its bracket, leaving one open mounting hole.');
  }else tell('You’ve already pulled this pin out.');
  return true;
 }
 if(name==='foot'){
  if(!s.footChecked){
   s.footChecked=true;
   bloom('underside-foot','The rubber foot slides along its track, revealing a short musical inscription in the exposed metal.');
   tell('The foot slides aside. Three musical marks stamped B appear in the metal, with another fragment marked A elsewhere on the cube.');
  }else tell('The foot won’t slide any farther. Three marks are showing underneath.');
  return true;
 }
 return false;
}
function cubeHit(name){
 // The 2D fallback, keyboard activation and Three.js raycasts share ONE
 // authority. Being able to address a hidden item never bypasses its catch.
 if(name==='drawer-a'&&!s.a||name==='drawer-b'&&!s.b||
    name==='top-reed'&&!s.top){
  tell('The object is still sealed behind its compartment.');
  return;
 }
 bloom('first');
 if(inspectHardware(name)){render();return}
 if(selected&&name==='eye'&&use(selected,'eye'))return;
 if(name==='latch'){
  if(!s.a){s.a=true;bloom('drawer','The front latch retracts. The drawer extends on its two metal runners, revealing a key-shaped piece.')}
  else tell(s.drawerTaken
   ?'That drawer’s empty now.'
   :'The front drawer is open. A small toothed metal piece is still resting in its tray.');
 }else if(name==='drawer-a'){
  if(!s.drawerTaken){s.drawerTaken=true;collection('tooth');tell('The teeth of something that once opened a lock.')}
 }else if(name==='seam'){
  if(!s.b){s.b=true;bloom('thread','The side release disengages. The teal drawer slides outward, exposing a red spool in its tray.')}
  else tell(s.sideTaken
   ?'The teal drawer is still open. Its spool holder is empty.'
   :'The teal drawer is open. A red spool is resting in its holder; press the spool to collect it.');
 }else if(name==='drawer-b'){
  if(!s.sideTaken){s.sideTaken=true;collection('thread');tell('It is red thread. It refuses to explain itself.')}
 }else if(name==='triangle'){
  if(s.top)tell('The lid is already resting against its open hinge stops.');
  else{
   s.topHits++;
   if(s.topHits>=3){s.top=true;bloom('pipe','The third catch releases the hatch. As the lid rises, two meshed gears draw back the retaining clips around a wooden tube in its cradle.')}
   else tell(s.topHits===1
    ?'The triangular button sinks in. One internal catch moves, but the lid is still fastened.'
    :'Another metal detent releases inside the lid. The catch has not let go completely.');
  }
 }else if(name==='top-reed'){
  if(!s.pipeTaken){s.pipeTaken=true;collection('pipe');bloom('pipe');tell('The wooden tube lifts out of the open cradle. The two metal clips stay retracted at its ends.')}
 }else if(name==='hatch'){
  if(!s.bottom){s.bottom=true;bloom('ring','The underside release opens a separate return pocket. A brass ring slides forward into view.');}
  if(!s.ringTaken){
   if(document.body.classList.contains('nc-physical-ready'))
    tell('The brass ring is resting in its own return socket, away from the central dial. Press the ring to collect it.');
   else{s.ringTaken=true;collection('ring')}
  }else tell('Nothing left in that slot. You already took the ring.');
 }else if(name==='dent'){
  if(!s.mouse){s.mouse=true;s.left=true;s.bag=true;s.machine=true;
   bloom('mouse','The recessed copper catch releases a spring inside the box. A clockwork mouse escapes, leaving a small bag and coin in their front-face holders.');
   bloom('bag');gain('coin');incident('🐁');
  } else tell('The mouse is gone. It left a little bag on the front.');
 }else if(name==='eye'){
  if(!s.back){s.back=true;bloom('eye','The rear eyelid slides aside. A short sequence of musical marks becomes visible beneath the lens.');}
  else if(document.body.classList.contains('nc-physical-ready'))
  tell('Below the eye is the first three-note fragment. The optical ring beside it also turns.');
 else modal('REVERSE SIDE','A message with no sender','<p class="nc-clue">A / Ⅱ · Ⅰ · Ⅲ</p><p>There may be another half of this musical sequence.</p>','eye');
 }else if(name==='dot'){
  if(s.redHits>=4)tell('The red switch won’t push in any farther.');
  else{
   s.redHits++;
   if(s.redHits===1)bloom('dot','The small red switch depresses into its collar. A ratchet advances behind the faceplate.');
   if(s.redHits===4){
    bloom('bell','The red ratchet reaches its stop. A shutter on the underside slides aside, exposing a bell in its small return tray.');
    gain('bell');
   }else tell('The red switch clicks in a little farther.');
  }
 }
 render();
 if(name==='latch'&&s.a)cue('ncWorld','nc-shudder',400);
 if(name==='seam'&&s.b)cue('ncWorld','nc-shudder',400);
 if(name==='triangle'&&s.top)cue('ncWorld','nc-shudder',400);
 if(name==='hatch'&&s.bottom)scatter('#d3bf8b',13,document.querySelector('[data-hit="hatch"]'));
 if(name==='dent'&&s.mouse){
  cue('ncAnimatedMouse','nc-running',1800);
  scatter('#a3b5c3',6,document.querySelector('[data-hit="dent"]'));
 }
 if(name==='dot'){scatter('#e6a2b3',4,document.querySelector('[data-hit="dot"]'));cue('ncWorld','nc-shudder',400)}
 if(name==='eye')cue('ncCube','nc-scene-blink',850);
}
function accepts(item,thing){
 return item==='key'&&thing==='bag'&&!s.bagOpen
 ||item==='treat'&&thing==='dog'&&s.doorOpen
 ||item==='acorn'&&thing==='pot'&&!s.plant
 ||item==='raindrop'&&thing==='pot'&&s.plant&&!s.tree
 ||item==='spring'&&thing==='musicbox'&&!s.music
 ||item==='coin'&&thing==='machine'&&!s.refundRedeemed
 ||item==='seal'&&thing==='shutter'&&s.refundRedeemed&&!s.serviceSealInserted&&!s.serviceOpen
 ||item==='kite'&&thing==='cloud'&&s.cloud&&!s.kite
 ||item==='sugar'&&thing==='cup'&&s.cup
 ||item==='bird'&&thing==='cube'&&s.tree&&!s.moon
 ||item==='bell'&&thing==='dog'&&s.doorOpen
 ||item==='lens'&&thing==='telescope'&&!s.telescopeLensMounted
 ||item==='stardust'&&thing==='musicbox'&&s.music&&!s.dancer
 ||item==='starmap'&&thing==='elevator'&&thingPresent('elevator')&&!s.train
 ||item==='parcel'&&thing==='dog'&&s.doorOpen
 ||item==='postcard'&&thing==='cube'&&!s.portal
 ||item==='cog'&&thing==='eye'&&s.eyeRingTicks>=3&&!s.opticOpened
 ||item==='iris'&&thing==='telescope'&&!s.telescopeIrisMounted
 ||item==='shim'&&thing==='machine'&&!s.shimUsed
 ||item==='washer'&&thing==='musicbox'&&s.music&&!s.clockHeart
 ||item==='fork'&&thing==='cube'&&s.pressureReady&&!s.resonance
 ||item==='cylinder'&&thing==='musicbox'&&s.music&&!s.cylinderMounted
 ||item==='tape'&&thing==='clock'&&s.watch&&!s.tapeInserted
 ||item==='letter'&&thing==='train'&&s.train&&!s.letterMailed
 ||item==='envelope'&&thing==='door'&&s.doorOpen&&!s.doorReplied;
}
// One shared source of truth for raycast, mouse hover and touch/keyboard
// compatibility feedback. This checks the REAL item-use conditions. It
// cannot reveal locked props or grant the result by itself.
function canUseSelectedWithAction(action){
 if(!selected||!pocket.has(selected)||!action)return false;
 const thing=action==='cube-offer'?'cube':
  action==='thing:door-handle'?'door':
  action.startsWith('thing:')&&!action.startsWith('thing:bag-dial-')&&
    !action.startsWith('thing:elevator-floor-')&&action!=='thing:bag-release'
   ?action.slice(6):
  action==='eye'?'eye':action==='shutter'?'shutter':null;
 return !!thing&&accepts(selected,thing);
}
function use(item,thing){
 if(!pocket.has(item)||!accepts(item,thing))return false;
 selected=null;
 if(item==='key'&&thing==='bag'){
  spend('key');s.bagOpen=true;
  if(document.body.classList.contains('nc-physical-ready'))
   tell('The key turns. A small brass cover springs open on the bag.');
  else{tell('The key fits the bag. Its inside is bigger than its outside.');openBag()}
 }else if(item==='treat'&&thing==='dog'){
  spend('treat');s.tag=true;gain('tag');bloom('tag','The dog shakes a numbered tag loose from its collar. It rests in the nearby tray, marked 04.');
 }else if(item==='acorn'&&thing==='pot'){
  spend('acorn');s.plant=true;bloom('acorn','The acorn sprouts in dry dirt. It looks expectant.');
 }else if(item==='raindrop'&&thing==='pot'){
  spend('raindrop');s.tree=true;bloom('tree','The tiny tree grows into a giant tiny tree.');
  gain('bird','A paper bird falls from its branches.');bloom('bird');
 }else if(item==='spring'&&thing==='musicbox'){
  spend('spring');s.music=true;s.cloud=true;s.cup=true;
  bloom('music','The music box plays a song that attracts a miniature rain cloud.');
  bloom('cloud');incident('♪');
 }else if(item==='coin'&&thing==='machine'){
  spend('coin');
  if(s.shimUsed&&seen.has('machine')&&s.coinReturned&&!s.refundRedeemed){
   // The returned coin opens a MEANINGFUL physical repair tool, not a
   // cosmetic certificate or another useless sugar cube.
   s.refundRedeemed=true;
   gain('seal');
   bloom('service-bolt','The returned coin opens the vending machine’s second drawer. A notched brass service key rests in its holder.');
   tell('A small brass service key is sitting in the machine’s second tray. Press it to collect it.');
  }else{
   gain('sugar');
   bloom('machine','The vending machine accepts the first coin and dispenses a sugar cube.');
   // If repairs preceded the purchase, issue the owed return now.
   if(s.shimUsed&&!s.coinReturned&&!s.refundRedeemed){
    s.coinReturned=true;
    gain('coin');
    tell('The repaired return drops the coin back into a second little tray. The sugar cube is waiting beside it.');
   }
  }
 }else if(item==='kite'&&thing==='cloud'){
  spend('kite');s.kite=true;bloom('kite','The kite becomes a weather vane and flies out of this dimension.');incident('◇');
 }else if(item==='sugar'&&thing==='cup'){
  spend('sugar');s.watch=true;bloom('teacup','The teacup burps and produces an antique pocket watch.');
 }else if(item==='bird'&&thing==='cube'){
  spend('bird');s.moon=true;bloom('moon','The paper bird flies into the cube. A tiny moon takes its place.');incident('☾');
 }else if(item==='bell'&&thing==='dog'){
  // The bell is NOT a dead-end inventory item. Its audible cause has a
  // concrete effect on the dog, squirrel, and physically cracked vase.
  // Petting three times remains a second, fully valid way to start this.
  sound(820);
  if(!s.barked)bark('bell');
  else tell('The bell rings again. The dog looks toward the empty ledge where the startled squirrel used to sit.');
 }else if((item==='lens'||item==='iris')&&thing==='telescope'){
  // Two independently obtainable optical components fit separate sockets:
  // one from the elevator, the other from the opened rear-eye mechanism.
  // Either one focuses the first star chart; the second produces the
  // two-sky secret. Neither tool can be installed twice or lost on reload.
  spend(item);
  if(item==='lens')s.telescopeLensMounted=true;
  else s.telescopeIrisMounted=true;
  bloom('observatory','A brass telescope waits on its fixed tripod.');
  if(!s.observed){
   s.observed=true;
   bloom('constellation','The fitted optical element focuses the miniature sky. A folded star chart slides out of the telescope.');
   gain('starmap','A folded star chart is resting beside the telescope.');
  }else if(s.telescopeLensMounted&&s.telescopeIrisMounted&&!s.secondSky){
   s.secondSky=true;
   bloom('second-sky','The second element seats in its own socket. The paired optics split the view into two different skies.');
  }
 }else if(item==='stardust'&&thing==='musicbox'){
  spend('stardust');s.dancer=true;
  bloom('dancer','A tiny ballerina unfolds from the music box and begins to waltz.');
 }else if(item==='starmap'&&thing==='elevator'){
  spend('starmap');s.train=true;
  bloom('railway','The elevator prints a railway from a constellation. A train appears.');
 }else if(item==='parcel'&&thing==='dog'){
  spend('parcel');gain('postcard');
  bloom('postcard','The dog sniffs the parcel, signs for it, and produces a postcard.');
 }else if(item==='postcard'&&thing==='cube'){
  spend('postcard');s.portal=true;
  bloom('portal','The paper sinks through solid enamel. A tiny landscape appears inside the cube.');
 }else if(item==='cog'&&thing==='eye'){
  spend('cog');s.opticOpened=true;gain('iris');
  bloom('hidden-optic','The drive cog engages the optical mechanism. A glass iris slips into the eye’s small side retainer.');
 }else if(item==='shim'&&thing==='machine'){
  spend('shim');s.shimUsed=true;
  // A coin can only be returned if the original was spent. If it is
  // still in the player's pocket or uncollected at the mouse's bag,
  // repairing the machine opens an EMPTY return slot instead.
  const coinOwed=!pocket.has('coin')&&!pendingPickups.has('coin');
  s.coinReturned=coinOwed;
  if(coinOwed)gain('coin');
  tell(coinOwed
   ?'The copper shim frees the jammed return. A spent coin rolls out of the machine. The service wheel behind its slot is now exposed.'
   :'The copper shim frees the jammed return. No coin is inside yet; its service wheel is ready for the next purchase.');
 }else if(item==='seal'&&thing==='shutter'){
  spend('seal');s.serviceSealInserted=true;
  tell('The brass service key slides into the matching keyway beside the shutter. Its locking bar withdraws. The spring catch still needs to disengage before the shutter can open.');
 }else if(item==='washer'&&thing==='musicbox'){
  spend('washer');s.clockHeart=true;
  bloom('clockwork-heart','You repaired the tiny escapement. The music box begins to tick between songs.');
 }else if(item==='fork'&&thing==='cube'){
  spend('fork');s.resonance=true;
  bloom('resonance','The tuning fork vibrates against the cube. Its resonance disengages the shutter on the teal side.');
 }else if(item==='cylinder'&&thing==='musicbox'){
  spend('cylinder');s.cylinderMounted=true;gain('tape');
  bloom('wax-cylinder','The wax cylinder seats in the music-box mechanism. As it turns, a narrow strip of punched tape emerges from the paper slot.');
 }else if(item==='tape'&&thing==='clock'){
  spend('tape');s.tapeInserted=true;gain('letter');
  bloom('paper-tape','The clock reads the perforations, coughs at 4:17, and folds a letter for someone.');
 }else if(item==='letter'&&thing==='train'){
  spend('letter');s.letterMailed=true;gain('envelope');
  bloom('outgoing-mail','The little train stamps your letter and returns a sealed envelope.');
 }else if(item==='envelope'&&thing==='door'){
  spend('envelope');s.doorReplied=true;
  bloom('return-letter','The door opens a letter addressed to YOU. It simply says: I KNOW.');
 }
 render();
 if(item==='key'&&thing==='bag')cue(prop('bag'),'nc-scene-blink',900);
 if(item==='acorn'&&thing==='pot'){cue(prop('pot'),'nc-scene-blink',1000);scatter('#bdd1a5',8,prop('pot'))}
 if(item==='raindrop'&&thing==='pot'){
  cue(prop('pot'),'nc-sprouting',1750);scatter('#9dcbae',14,prop('pot'));
 }
 if(item==='spring'&&thing==='musicbox'){
  cue(prop('musicbox'),'nc-scene-blink',1200);floatNote(prop('musicbox'));
  setTimeout(()=>floatNote(prop('musicbox')),350);
  setTimeout(()=>floatNote(prop('musicbox')),700);
 }
 if(item==='coin'&&thing==='machine')cue(prop('machine'),'nc-vending',900);
 if(item==='sugar'&&thing==='cup')cue(prop('cup'),'nc-scene-blink',850);
 if(item==='bird'&&thing==='cube'){cue('ncAnimatedBird','nc-running',2100);scatter('#e5c6d3',12);}
 if(item==='kite'&&thing==='cloud')scatter('#d2add7',10,prop('cloud'));
 if((item==='lens'||item==='iris')&&thing==='telescope'){
  cue(prop('telescope'),'nc-scope-zoom',1600);
  scatter('#c7d7ef',13,prop('telescope'));
 }
 if(item==='stardust'&&thing==='musicbox'){cue(prop('musicbox'),'nc-dance-begin',1800);scatter('#e4c9ef',16,prop('musicbox'))}
 if(item==='starmap'&&thing==='elevator'){cue(prop('elevator'),'nc-ticket-stamp',1400);scatter('#c2b6dd',13,prop('elevator'))}
 if(item==='parcel'&&thing==='dog')cue('ncDog','nc-petting',520);
 if(item==='postcard'&&thing==='cube'){cue('ncCube','nc-scene-blink',950);scatter('#eab9aa',16)}
 if(item==='fork'&&thing==='cube'){
  cue('ncWorld','nc-shudder',650);scatter('#c2e6e6',17,$('ncCube'));sound(760);
 }
 if(item==='cylinder'&&thing==='musicbox'){
  cue(prop('musicbox'),'nc-dance-begin',1300);floatNote(prop('musicbox'));sound(390);
 }
 if(item==='tape'&&thing==='clock'){cue(prop('clock'),'nc-scene-blink',1100);scatter('#ead1b3',8,prop('clock'))}
 if(item==='letter'&&thing==='train')cue(prop('train'),'nc-train-whistle',1050);
 if(item==='envelope'&&thing==='door')cue('ncDoor','nc-scene-blink',1800);
 return true;
}
function take(item){
 if(!pocket.has(item))return;
 if(!selected){selected=item;window.NothingHereAudio?.play?.('select');tell('Holding '+names[item]+'. '+(itemInspections[item]||'Try fitting it to something on the cube.'));render();return}
 if(item===selected){selected=null;window.NothingHereAudio?.play?.('release');render();return}
 const result=recipe[sorted(selected,item)];
 if(!result){tell('The '+names[selected]+' and '+names[item]+' do not join. Both items are still in your pocket.');sound(185);render();return}
 spend(selected);spend(item);
 window.NothingHereAudio?.play?.('select');
 // Combining is an intentional inventory interaction, not a hidden
 // world reward. The assembled tool stays in the pocket immediately.
 gain(result[0],result[2],true);selected=null;bloom(result[1],result[2]);render();
}
function openBag(){
 if(!s.bagOpen){tell('The bag is locked. Its little brass keyhole seems very specific.');return}
 modal('INSIDE THE BAG',s.bagSolved?'A suspicious lining':'The captive symbol mechanism',
  '<p>Four stamped wheels are retained by a separate brass release. Each has six marks, and none of them opens the compartment just by turning.</p>'+
  '<div class="nc-bag-interior" id="ncBagInterior"><div class="nc-bag-wheels">'+
   [0,1,2,3].map(i=>'<button class="nc-dial" type="button" data-dial="'+i+
    '" aria-label="Turn wheel '+(i+1)+'">'+BAG_SYMBOLS[s.bagDials[i]]+'</button>').join('')+
  '</div><button type="button" id="ncBagRelease" data-bag-release aria-label="Press bag release">Press brass catch</button>'+
  '</div><p class="nc-modal-note" id="ncBagNote">'+(s.bagSolved?'The false bottom has already opened.':'The four wheels do not operate the release themselves.')+'</p>','bag');
}
function turnBag(i){
 if(!Number.isInteger(i)||i<0||i>=BAG_CODE.length||!s.bagOpen||s.bagSolved)return;
 s.bagDials[i]=(s.bagDials[i]+1)%BAG_SYMBOLS.length;
 const dialButton=document.querySelector('[data-dial="'+i+'"]');
 if(dialButton)dialButton.textContent=BAG_SYMBOLS[s.bagDials[i]];
 sound(350+i*50);
 if(s.bagDials.every((n,j)=>n===BAG_CODE[j]))
  tell('All four bag wheels settle into their notches. The brass catch below is still closed.');
 else tell('Bag wheel '+(i+1)+' now shows '+BAG_SYMBOLS[s.bagDials[i]]+'. Release the separate catch only when the four markings match.');
 // The symbols turning alone never grant the reward; release is deliberate.
 render();
}
function pressBagRelease(){
 if(!s.bagOpen){tell('The little brass catch is still beneath the locked cover.');return false}
 if(s.bagSolved){tell('The false bottom has already opened.');return true}
 if(s.bagDials.some((n,i)=>n!==BAG_CODE[i])){
  tell(s.eyeRingTicks>=3?
   'The catch resists. Those four marks do not match the strip beside the rear eye.':
   'The catch resists. Four matching marks are engraved on another part of the box.');
  sound(210);render();return false;
 }
 s.bagSolved=true;
 gain('reed');gain('treat');gain('prism');
 bloom('bag-code','The brass catch releases the false bottom. Three separate objects are seated inside.');
 const bagNote=$('ncBagNote');
 if(bagNote)bagNote.textContent='The lining is open. Its three objects can be picked up separately.';
 cue('ncBagInterior','nc-unlatched',1100);
 scatter('#d2b5a1',13,document.querySelector('#ncBagInterior'));
 incident('✳');
 render();
 return true;
}
function openElevator(){
 bloom('lift','A tiny four-stop lift is mounted to the cube. Its four separate buttons operate the carriage.');
 modal('AT THE EDGE OF THE ROOM',s.floorFour?'The fourth-floor lift':'The miniature elevator',
  '<p>Four brass buttons, four floors. Somewhere on the cube is a stamped destination.</p>'+
  '<div class="nc-lift-puzzle"><div class="nc-lift-miniature"><i class="nc-lift-glass"></i><i class="nc-lift-innerdoors"></i><span>'+(s.floorFour?'04':'—')+'</span></div>'+
  '<div class="nc-lift-buttons">'+[1,2,3,4].map(n=>'<button type="button" data-floor="'+n+'" aria-label="Visit miniature floor '+n+'" class="nc-lift-call">'+String(n).padStart(2,'0')+'</button>').join('')+'</div></div>'+
  '<p class="nc-modal-note" id="ncLiftMessage">'+(s.floorFour?'The fourth floor is open. Look for the tiny moth outside.':'The lift needs a destination. Examine the markings on the cube.')+'</p>','elevator');
}
function callElevator(floor){
 const text=$('ncLiftMessage')||{textContent:''};
 sound(240+floor*110);
 document.querySelectorAll('[data-floor]').forEach(b=>b.classList.toggle('nc-floor-active',Number(b.dataset.floor)===floor));
 if(floor!==4){
  const answer=['','Floor 01: no one is home.','Floor 02: a miniature tumbleweed rolls by.','Floor 03: a painted brick wall.'][floor];
  text.textContent=answer;
  // There is no modal in 3D, so a dummy text object silently discarded
  // all non-fourth-floor results before this fix.
  if(document.body.classList.contains('nc-physical-ready'))tell(answer);
  return;
 }
 if(!s.floorFour){
  s.floorFour=true;
  gain('lens','The tiny lift delivers a silver lens wrapped in tissue.');
  bloom('fourth','The doors open on floor four. A clockwork moth flies out of the lift.');
  cue(prop('elevator'),'nc-lift-arrived',1400);
  scatter('#c6b7d9',16,prop('elevator'));
  cue(prop('moth'),'nc-moth-arrive',1700);
  text.textContent='Floor 04: a silver lens, and something fluttering nearby.';
  if(document.body.classList.contains('nc-physical-ready'))
   tell('Floor 04 opens. A silver lens waits in the lift tray, and a tiny mechanical moth appears.');
 }else{
  text.textContent='Floor 04 is open. The lens either still rests in its holder or has been collected.';
  if(document.body.classList.contains('nc-physical-ready'))tell(text.textContent);
 }
 render();
}
function openFlute(){
 if(!pocket.has('flute')){
  tell('A hollow tube and a tiny reed can make an instrument, but it has to be assembled first.');
  return;
 }
 // Clicking the inventory flute OPENS actual note buttons, even if the
 // hinged lid is facing away from the player or an old save lacks top=true.
 fluteTrayOpen=true;
 selected=null;
 render();
 tell('The flute is ready in your inventory. Press its three keys. Two engraved phrases on the cube, A and B, form a six-note melody.');
}
function closeFlute(){
 fluteTrayOpen=false;
 render();
 tell('The flute keys are put away. Click the flute in your inventory to play again.');
}
function resetFlutePhrase(){
 if(!pocket.has('flute'))return;
 s.fluteNotes=[];
 render();
 tell('The flute returns to its starting note. Try a fresh six-note phrase.');
}
function note(i){
 if(!Number.isInteger(i)||i<1||i>3||!pocket.has('flute'))return;
 if(s.door){
  // The instrument remains playable after unlocking the door; this also
  // keeps keyboard interaction and audio functional on completed saves.
  s.fluteNotes.push(i);s.fluteNotes=s.fluteNotes.slice(-FLUTE_CODE.length);
  window.NothingHereAudio?.playFluteNote?.(i);
  tell('The little door is already open, but the flute can still be played.');
  render();return;
 }
 if(s.fluteNotes.length>=FLUTE_CODE.length)s.fluteNotes=[];
 s.fluteNotes.push(i);
 window.NothingHereAudio?.playFluteNote?.(i);
 const physical=document.body.classList.contains('nc-physical-ready');
 if(!physical){
  cue('ncFluteModel','nc-playing',380);floatNote($('ncFluteModel'));
  $('ncFluteTrack').textContent='♪  '+s.fluteNotes.map(n=>['Ⅰ','Ⅱ','Ⅲ'][n-1]).join('  ');
 }
 if(s.fluteNotes.join('')===FLUTE_CODE.join('')){
  if(!s.door){
    s.door=true;
    bloom('door','The six-note melody unlatches a miniature door on the box.');
    tell('The six notes match the two engraved phrases. A little door swings loose on the box.');
    cue('ncDoorScene','nc-arriving',1430);cue('ncWorld','nc-shudder',430);scatter('#e5c8aa',12,$('ncDoorScene'));
   }
  else tell('The door recognizes that tune.');
  if(!physical){
   closeModal();setTimeout(()=>$('ncDoorScene').scrollIntoView({behavior:'smooth',block:'nearest'}),80);
  }
 }else if(s.fluteNotes.length===FLUTE_CODE.length){
  // Each melody is a complete six-key attempt, never a hidden rolling
  // six-note buffer that confuses the next attempt after failure.
  s.fluteNotes=[];
  if(!physical)$('ncFluteTrack').textContent+='  ...nothing. Try again.';
  tell('Those six notes did not open anything. The flute resets for a fresh six-note phrase.');
 }else{
  tell('Flute: '+s.fluteNotes.map(n=>['Ⅰ','Ⅱ','Ⅲ'][n-1]).join(' · ')+
   ' ('+s.fluteNotes.length+' of six notes).');
 }
 render();
}
function bark(trigger='pet'){
 if(trigger==='bell'&&!s.barked)s.dogHits=Math.max(2,s.dogHits);
 s.dogHits++;
 cue('ncDog','nc-petting',520);
 if(s.dogHits===1)bloom('dog','The dog tilts its head, wondering whether you are real.');
 if(s.dogHits>=3&&!s.barked){
  s.barked=true;s.squirrel=true;s.vase=true;
  bloom('bark',trigger==='bell'
   ?'The small bell rings. The surprised dog lets out a loud bark, startling the squirrel perched on the ledge above the door.'
   :'After three pats, the dog lets out a loud bark that startles the squirrel above its door.');
  bloom('squirrel','A squirrel bolts. It was balanced on top of the door.');
  bloom('vase','The squirrel knocks the underside’s ceramic vase off balance. Its cracked base reveals an acorn and a clockwork spring.');
  gain('acorn');gain('spring');bloom('spring');fleeing=true;
   cue('ncDog','nc-howling',1250);
   cue('ncImpactWave','nc-running',1250);
   cue('ncActionSquirrel','nc-running',2000);
   cue(prop('vase'),'nc-shattering',1550);
   cue('ncWorld','nc-shudder',430);
   scatter('#add0d0',17,prop('vase'));
  setTimeout(()=>{fleeing=false;render()},1350);
  sound(215);
 }else if(s.dogHits<3)tell('The dog turns toward your hand. Its numbered collar tag remains fastened.');
 else tell('The dog is now very proud of itself.');
 render();
}
// Only physically present miniatures can be used. The old invisible DOM
// event nodes and exported 3D control API must not bypass discoveries.
function thingPresent(name){
 return !!({
  bag:s.bag,door:s.door,dog:s.doorOpen,vase:s.doorOpen,
  squirrel:s.squirrel,pot:s.vase,musicbox:s.vase,cloud:s.cloud,
  cup:s.music,clock:s.watch,machine:s.mouse,
  elevator:s.serialRead||(s.watch&&s.tag)||s.floorFour||s.train,
  moth:s.floorFour,telescope:true,train:s.train
 })[name];
}
function inspectPhysicalSurface(name){
 const messages={
  front:s.a?'The drawer is extended on its rails.':'The drawer front will not pull free of its catch.',
  side:s.b?'The side drawer’s already open.':'The side drawer is held in its metal frame.',
  hatch:s.top?'The top hatch is resting open on its hinges.':'The top hatch is held shut by its catch.'
 };
 if(Object.hasOwn(messages,name))tell(messages[name]);
}
function clickThing(name,actuator=false){
 if(!thingPresent(name)){
  tell('There is nothing to operate here yet.');
  return;
 }
 if(selected){
  if(use(selected,name))return;
  tell('That '+names[selected]+' does not seem to fit there.');render();return;
 }
 bloom('first');
 if(name==='bag'){
   if(s.bagOpen&&document.body.classList.contains('nc-physical-ready')){
    const waiting=['reed','treat','prism'].filter(id=>pendingPickups.has(id));
    tell(s.bagSolved
     ?waiting.length
       ?'The false bottom is open. '+waiting.length+' small objects are still resting in their separate holders.'
       :'The false bottom is open. All three objects have been collected.'
     :'Four symbol wheels and a separate spring catch are visible inside the opened bag.');
   }else openBag();
 }
 else if(name==='door'){
  if(document.body.classList.contains('nc-physical-ready')&&!actuator&&!s.doorOpen){
   tell('The little door is shut. Its knob is still in place.');
  }else if(!s.doorOpen){
    s.doorOpen=true;bloom('dog','Behind the door: a polite little dog and something balanced overhead.');
    cue('ncDoor','nc-opening',1190);
    scatter('#e8ceae',8,$('ncDoor'));
   }
  else tell('There is no place on the other side of this door. Just a dog.');
 }else if(name==='dog')bark();
 else if(name==='vase')tell(s.vase?'The vase is in at least seventeen pieces.':'How is this vase so perfectly balanced?');
 else if(name==='squirrel')tell('The squirrel is about to have a very bad afternoon.');
 else if(name==='pot')tell(s.tree?'An impossible tiny tree, growing indoors.':s.plant?'The acorn is thirsty.':'It is a pot with some dry soil.');
 else if(name==='musicbox')tell(s.music?'The music box smells faintly of rain.':'There is a spring-shaped hole in its clockwork.');
 else if(name==='cloud'){
  if(s.music){gain('raindrop','A raindrop settles in the cloud’s attached collecting tray.');bloom('rain');incident('💧')}
  else tell('A cloud the size of a sandwich.');
 }else if(name==='cup')tell(s.watch?'The bottom of the cup is a tiny hole in time.':'It could use some sugar.');
 else if(name==='clock'){
  bloom('clock','It is 4:17. It has been 4:17 for a very long time.');
  if(document.body.classList.contains('nc-physical-ready'))
   tell('The miniature clock has stopped at 4:17. Another object might make its mechanism run.');
  else modal('CLOCK DEPARTMENT','4:17','<p>Nothing is wrong with this clock. It just refuses to acknowledge the existence of other times.</p>','clock');
 }else if(name==='machine')tell(s.refundRedeemed
  ?(pendingPickups.has('seal')
    ?'A brass service key is still resting in the machine’s second tray. Press it to pick it up.'
    :'The repaired machine has completed its second transaction. The service-key tray is empty.')
  :s.shimUsed
   ?'The repaired return mechanism has a second little slot beneath the sugar tray.'
   :'INSERT COIN. The return slot beneath the tray is jammed.');
 else if(name==='elevator'){
  if(document.body.classList.contains('nc-physical-ready')){
   bloom('lift','The lift has four brass buttons. Its moving doors look strangely real.');
   tell('Press one of the numbered buttons directly on the 3D elevator.');
  }else openElevator();
 }
 else if(name==='moth'){
  if(!s.mothTouched){
   s.mothTouched=true;gain('stardust','The mechanical moth leaves a handful of luminous dust.');
   bloom('moth','The little moth does a somersault and sheds glittering clockwork dust.');
   cue(prop('moth'),'nc-moth-burst',1000);scatter('#d5b5ea',17,prop('moth'));
  }else{cue(prop('moth'),'nc-moth-burst',1000);tell('The moth bows once. That is all.')}
 }
 else if(name==='telescope'){
  bloom('observatory','A delicate brass telescope peers at a sky that is not quite there.');
  if(!s.observed)tell('Two differently shaped optical sockets are empty. The barrel is still out of focus.');
  else{
   tell(s.secondSky?'Both optical fittings are seated; the telescope has two distinct views.':
    'The star chart has been focused, but one optical socket remains empty.');
   cue(prop('telescope'),'nc-scope-zoom',1550);
  }
 }
 else if(name==='train'){
  if(!s.parcelTaken){
   s.parcelTaken=true;gain('parcel','The tiny train delivers a parcel with no return address.');
   bloom('parcel','A steam-powered locomotive has delivered you one absurdly small parcel.');
  }else tell('The little train has nothing left to deliver.');
  cue(prop('train'),'nc-train-whistle',900);
 }
 render();
}
function journal(){
 const found=[...seen].map(id=>'<span>✳ '+title.get(id)+'</span>').join('');
 modal('YOUR DISCOVERIES','Secrets uncovered',
 '<p>The cube has plenty to hide. These are the secrets you\'ve managed to find.</p>'+
 '<div class="nc-journal">'+(found||'<span>Nothing uncovered yet. Keep looking.</span>')+'</div>'+
 '<p class="nc-modal-note">Your discoveries are saved on this device.</p>','journal');
}
function info(){
 modal('A SLIGHTLY UNHELPFUL EXPLANATION','Turn it.',
  '<p>Drag to rotate, use the arrows, or zoom with the + / − buttons, your mouse wheel, or a two-finger pinch. Select ✥ to move a zoomed-in view. Press ↺ to reset.</p><p>Screws, vents, tiny markings, dial wheels and hinge pins are all worth inspecting.</p>'+
  '<p>Some discoveries are useful somewhere else. You can select an item and experiment with the other objects, or try combining two things in your pocket.</p>'+
  '<p>Small engravings identify parts of the mechanism. In real 3D, hover with a mouse or touch and hold on a phone to identify an object without activating it. Found items stay physically on the cube until you press them, then move to your pocket below.</p>'+ 
  '<p>Keyboard: focus the 3D cube, use arrow keys to turn it, I to inspect a visible fitting (Shift+I to go back), Enter to activate it, and Escape to stop inspecting. Tab moves to the other controls.</p>'+
 '<p>Sounds and lobby music have independent on/off controls above the cube. Music begins only after you enable it. The licensed audio sources are listed in the project credits.</p>'+
 '<p>The journal records what you have discovered. “What changed?” below the cube keeps a short history of mechanisms you actually opened. Neither list reveals untouched codes.</p><p>Your progress saves on this device.</p>','info');
}
const tactileHit=name=>name==='dot'||name==='foot'||name==='eye-ring'||name==='serial'||name==='pressure'||name==='shutter'||
 /^(?:front-screw-|right-bolt-|hinge-|vent-)/.test(name);
function hit(e){
 const el=e.target.closest('[data-hit]');if(!el||!$('ncCube').contains(el))return;
 // Pointer activation of the moving red dot is handled on pointerdown.
 // Preserve keyboard and screen-reader synthetic clicks (detail === 0).
 if(tactileHit(el.dataset.hit)&&e.detail!==0)return;
 e.stopPropagation();cubeHit(el.dataset.hit);
}
function eventThing(e){
 const node=e.target.closest('[data-thing]');
 if(!node)return;
 clickThing(node.dataset.thing);
}
function clickInventory(e){
 const item=e.target.closest('[data-item]');
 if(!item)return;
 if(item.dataset.item==='flute'){openFlute();return}
 take(item.dataset.item);
}
// Chromium can project a hinged 3D control at one screen coordinate while
// routing the pointer to its flat parent instead. Fall back to the actual
// projected screw rectangle so visual mechanical controls remain operable.
// Only service the currently facing top panel; never activate backface clues.
$('ncWorld').addEventListener('pointerdown',event=>{
 if(event.target.closest?.('#stage'))return; // Physical raycasting has its own hit targets.
 if(event.button!==0||!event.isPrimary)return;
 if(event.target.closest?.('button,[data-hit]'))return;
 // Only check the currently front-facing horizontal surface.
 const controls=s.rx<=-45?[...document.querySelectorAll('[data-hit^="hinge-"]')]:
  s.rx>=45?[...document.querySelectorAll('[data-hit="foot"]')]:[];
 for(const button of controls){
  const r=button.getBoundingClientRect();
  if(r.width<4||r.height<4)continue;
  if(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom){
   cubeHit(button.dataset.hit);
   event.preventDefault();event.stopImmediatePropagation();return;
  }
 }
},true);
// Moving 3D trays can shift a few pixels between pointerdown and pointerup.
// Picking up their contents on pointerdown prevents a click being retargeted to
// a face behind the tray during its opening animation. Keyboard clicks still
// use the normal delegated click handler; every pickup is idempotent.
$('ncCube').addEventListener('pointerdown',event=>{
 const target=event.target.closest('[data-hit]');
 if(!target||event.button!==0||!event.isPrimary)return;
 if(!['drawer-a','drawer-b','top-reed'].includes(target.dataset.hit)&&!tactileHit(target.dataset.hit))return;
 event.stopPropagation();
 cubeHit(target.dataset.hit);
},true);
$('ncCube').addEventListener('click',hit);
$('ncSideObjects').addEventListener('click',eventThing);
$('ncDoorScene').addEventListener('click',eventThing);
$('ncInventory').addEventListener('click',clickInventory);
$('ncJournalBtn').addEventListener('click',journal);
$('ncChangesToggle')?.addEventListener('click',()=>{
 changesOpen=!changesOpen;
 render();
});
$('ncMechanismsToggle')?.addEventListener('click',()=>{
 mechanismsOpen=!mechanismsOpen;
 render();
});
$('ncResetCubeBtn')?.addEventListener('click',openCubeResetConfirmation);
$('gameInfoBtn')?.addEventListener('click',info);
$('ncModalClose').addEventListener('click',closeModal);
$('ncModal').addEventListener('click',e=>{if(e.target===$('ncModal'))closeModal()});
$('ncUnselect').addEventListener('click',()=>{selected=null;render()});
$('ncCubeZone').addEventListener('click',e=>{
 if(e.target.closest?.('#stage'))return; // Routed through 3D clickAction, not an empty-zone offering.
 if(blockedClick){e.stopImmediatePropagation();e.preventDefault();blockedClick=false;return}
 // Only physically removing the required fasteners can release the
 // service cover. Clicking the engraved receiver is not a substitute.
 // The engraved square is a real touch target, also usable by keyboard.
 if(selected&&e.target.closest('[data-thing="cube"]')){
  if(!use(selected,'cube')){tell('The cube refuses that offering.');render();}
  e.stopPropagation();return;
 }
 // An inventory object must be placed on its actual receiver. Clicking
 // empty cube space must never quietly use it or complete a puzzle.
 // This rule applies to mouse, touch, keyboard and any legacy DOM layer.
 
},true);
$('ncModalBody').addEventListener('click',e=>{
 if(panel==='reset'){
  if(e.target.closest('#ncCancelCubeReset'))closeModal();
  else if(e.target.closest('#ncConfirmCubeReset'))confirmCubeReset();
  return;
 }
 if(e.target.closest('[data-bag-release]')&&panel==='bag'){pressBagRelease();return}
 const dial=e.target.closest('[data-dial]');if(dial&&panel==='bag'){turnBag(Number(dial.dataset.dial));return}
 const noteEl=e.target.closest('[data-note]');if(noteEl&&panel==='flute'){note(Number(noteEl.dataset.note));return}
 const floorEl=e.target.closest('[data-floor]');if(floorEl&&panel==='elevator'){callElevator(Number(floorEl.dataset.floor));return}
});
// View manipulation is deliberately separate from saved puzzle progress.
// Zooming never consumes an item, and a reset also restores a readable angle.
// The cube starts pulled back so every side fits. Zoom is strictly 82–200%.
const MIN_ZOOM=.82,MAX_ZOOM=2;
const view={zoom:MIN_ZOOM,panX:0,panY:0,panMode:false};
const pointers=new Map();
let dragOrigin=null,pinchOrigin=null;
function viewLimits(){
 const world=$('ncWorld');
 return {x:Math.max(0,Math.min(world.clientWidth*.34,160*(view.zoom-1))),
         y:Math.max(0,Math.min(world.clientHeight*.31,145*(view.zoom-1)))};
}
function updateView(){
 const limits=viewLimits();
 view.panX=clamp(view.panX,-limits.x,limits.x);
 view.panY=clamp(view.panY,-limits.y,limits.y);
 const zone=$('ncCubeZone');
 zone.style.setProperty('--nc-zoom',String(view.zoom));
 zone.style.setProperty('--nc-pan-x',view.panX+'px');
 zone.style.setProperty('--nc-pan-y',view.panY+'px');
 $('ncZoomAmount').textContent=Math.round(view.zoom*100)+'%';
 $('ncPanMode').setAttribute('aria-pressed',String(view.panMode));
 zone.classList.toggle('nc-pan-mode',view.panMode);
}
function zoomTo(value){
 const newZoom=clamp(Math.round(value*100)/100,MIN_ZOOM,MAX_ZOOM);
 if(newZoom===view.zoom)return;
 view.zoom=newZoom;
 updateView();
 window.__nothing3DPreview?.setZoom?.(view.zoom);
}
function resetView(){
 view.zoom=MIN_ZOOM;view.panX=0;view.panY=0;view.panMode=false;
 s.rx=-22;s.ry=-32;
 const physical=document.body.classList.contains('nc-physical-ready')&&
  !!window.__nothing3DPreview?.resetCameraView;
 // A 3D camera reset handles the visible scene; the legacy orientation
 // remains an internal state value for backwards-compatible saved games.
 // In 3D, let the scene interpolate the orbit, camera and box together.
 if(!physical)turn();
 updateView();
 if(physical){
  window.__nothing3DPreview.setPanMode(false);
  window.__nothing3DPreview.resetCameraView();
 }else window.__nothing3DPreview?.setZoom?.(MIN_ZOOM);
 tell('The mysterious object is back in its usual orientation.');
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=e=>({x:e.clientX,y:e.clientY});
$('ncCubeZone').addEventListener('pointerdown',e=>{
 if(e.target.closest?.('#stage'))return; // Real 3D orbit controls own this gesture.
 if(e.button!==0)return;
 pointers.set(e.pointerId,point(e));
 if(pointers.size===2){
  const [p,q]=[...pointers.values()];
  pinchOrigin={distance:Math.max(1,distance(p,q)),zoom:view.zoom};
  dragOrigin=null;dragging=false;dragMoved=true;return;
 }
 if(e.target.closest('button,[data-hit]'))return;
 dragOrigin={...point(e),rx:s.rx,ry:s.ry,px:view.panX,py:view.panY,pan:view.panMode||e.shiftKey};
 dragging=true;dragMoved=false;
 $('ncCubeZone').classList.add('nc-dragging');
});
window.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 pointers.set(e.pointerId,point(e));
 if(pointers.size>=2){
  const [a,b]=[...pointers.values()];
  if(!pinchOrigin)pinchOrigin={distance:Math.max(1,distance(a,b)),zoom:view.zoom};
  // Pinch gestures are deliberately damped to avoid sudden camera jumps.
  const change=distance(a,b)/pinchOrigin.distance-1;
  zoomTo(pinchOrigin.zoom*(1+change*.55));
  dragMoved=true;return;
 }
 if(!dragging||!dragOrigin)return;
 const dx=e.clientX-dragOrigin.x,dy=e.clientY-dragOrigin.y;
 if(Math.abs(dx)+Math.abs(dy)>7)dragMoved=true;
 if(!dragMoved)return;
 if(dragOrigin.pan){
  view.panX=dragOrigin.px+dx;view.panY=dragOrigin.py+dy;updateView();
 }else{
  s.ry=dragOrigin.ry+dx*(.52/Math.max(.9,view.zoom));
  s.rx=clamp(dragOrigin.rx-dy*(.52/Math.max(.9,view.zoom)),-85,85);
  turn();
 }
});
const endPointer=e=>{
 const had=pointers.delete(e.pointerId);
 if(!had)return;
 if(pointers.size<2)pinchOrigin=null;
 if(dragging){
  dragging=false;$('ncCubeZone').classList.remove('nc-dragging');
  if(dragMoved){blockedClick=true;setTimeout(()=>blockedClick=false,145)}
 }
 dragOrigin=null;
};
window.addEventListener('pointerup',endPointer);
window.addEventListener('pointercancel',endPointer);
$('ncWorld').addEventListener('wheel',e=>{
 if(e.target.closest('#stage'))return; // Physical WebGL camera zooms itself.
 if(e.target.closest('.nc-inspection-controls'))return;
 e.preventDefault();
 // One notch used to leap 14%. Normalize wheels and trackpads to a gentle
 // multiplicative movement; cap extreme deltas, including inertial scrolling.
 const unit=e.deltaMode===1?16:e.deltaMode===2?$('ncWorld').clientHeight:1;
 const delta=clamp(e.deltaY*unit,-120,120);
 zoomTo(view.zoom*Math.exp(-delta*.00045));
},{passive:false});
$('ncCubeZone').addEventListener('dblclick',e=>{
 if(e.target.closest('#stage'))return;
 if(e.target.closest('button,[data-hit]'))return;
 zoomTo(view.zoom<1.4?1.55:1);
});
$('ncZoomIn').addEventListener('click',()=>zoomTo(view.zoom+.12));
$('ncZoomOut').addEventListener('click',()=>zoomTo(view.zoom-.12));
$('ncPanMode').addEventListener('click',()=>{
 view.panMode=!view.panMode;updateView();
 window.__nothing3DPreview?.setPanMode?.(view.panMode);
 tell(view.panMode?'Move mode: drag the zoomed object to inspect another area.':'Rotate mode: drag to turn the cube.');
});
$('ncViewReset').addEventListener('click',resetView);
updateView();
document.querySelectorAll('[data-rotate]').forEach(b=>b.addEventListener('click',()=>{
 const d=b.dataset.rotate;
 s.ry+=(d==='left'?-55:d==='right'?55:0);
 s.rx=clamp(s.rx+(d==='up'?55:d==='down'?-55:0),-85,85);
 turn();tell('The cube turns without complaining.');
}));
$('ncCubeZone').addEventListener('keydown',e=>{
 if(e.target!==$('ncCubeZone'))return;
 const mapping={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
 if(mapping[e.key]){e.preventDefault();document.querySelector('[data-rotate="'+mapping[e.key]+'"]').click();}
});
document.addEventListener('keydown',e=>{
 if($('ncModal').hidden){
  if(e.key==='Escape'&&selected){selected=null;render()}
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
  if(!typing&&(e.key==='+'||e.key==='=')){e.preventDefault();zoomTo(view.zoom+.25)}
  else if(!typing&&e.key==='-'){e.preventDefault();zoomTo(view.zoom-.25)}
  else if(!typing&&e.key==='0'){e.preventDefault();resetView()}
  return;
 }
 if(e.key==='Escape'){e.preventDefault();closeModal();return}
 if(e.key==='Tab'){
  const controls=[...$('ncModal').querySelectorAll('button,input,a[href]')]
   .filter(el=>!el.disabled&&el.getClientRects().length);
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)){
   e.preventDefault();(e.shiftKey?last:first).focus();
  }
 }
});
// The inventory flute opens real inline keys on the FIRST click.
// Avoid two competing click handlers that used to select then immediately
// deselect the same tool, leaving only an unhelpful sentence.
$('ncFluteTray')?.addEventListener('click',e=>{
 const key=e.target.closest('[data-flute-key]');
 if(key){note(Number(key.dataset.fluteKey));return}
 if(e.target.closest('#ncFluteClose')){closeFlute();return}
 if(e.target.closest('#ncFluteStartOver'))resetFlutePhrase();
});
$('ncInventory').addEventListener('dragstart',e=>{
 const el=e.target.closest('[data-item]');
 if(!el)return;e.dataTransfer.setData('text/plain',el.dataset.item);e.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',e=>{if(e.target.closest('[data-item],[data-thing]'))e.preventDefault()});
document.addEventListener('drop',e=>{
 const item=e.dataTransfer?.getData('text/plain');
 if(!pocket.has(item))return;
 const target=e.target.closest('[data-item],[data-thing]');
 if(!target)return;e.preventDefault();
 if(target.dataset.item){selected=item;take(target.dataset.item);}
 else if(!use(item,target.dataset.thing))tell('That object does not belong there.');
});
turn();render();
// Restore an already-open mechanism if the player refreshed mid-animation.
window.CriloNothingHereCube={getState:()=>({...s,pocket:[...pocket],pendingPickups:[...pendingPickups],seen:[...seen],selected}),
 getSaveRecoveryAudit:()=>[...recoveredFromSave],
 getItemName:id=>names[id]||null,
 // The physical six-symbol wheels are small. Inspection can name what is
 // CURRENTLY on a visible dial without revealing the target combination.
 getBagDialSymbol:index=>Number.isInteger(index)&&index>=0&&index<4&&s.bagOpen
  ?BAG_SYMBOLS[s.bagDials[index]]:null,
 canUseSelectedWithAction,
 getView:()=>({...view}),zoomTo,resetView,
 updatePhysicalViewZoom(value){
  // OrbitControls owns physical mouse-wheel zoom. Mirror only its value
  // into the already-visible zoom percentage and subsequent button steps.
  if(!Number.isFinite(value))return;
  view.zoom=clamp(Math.round(value*100)/100,MIN_ZOOM,MAX_ZOOM);
  updateView();
 },
 rotate:(x,y)=>{s.rx=x;s.ry=y;turn()},
 inspectPhysicalSurface,
 activatePhysicalPickup:collectPhysicalPickup,
 activatePhysical(name){
  if(name==='cube-offer'){
   // This is an offering port, not an all-purpose secret-unlock button.
   // The service faceplate is freed by removing its screws only.
   if(!selected){tell('The receiver is empty. Its metal rim is smooth.');return;}
   if(!use(selected,'cube')){
    tell('That offering does not fit the receiver.');
    render();
   }
  }else cubeHit(name);
 },
 // The physical miniatures are visual counterparts of the EXISTING world
 // props. Selecting an inventory item and then a 3D object uses the same
 // recipe, discovery, modal and storage rules as clicking its HTML button.
 openFluteFromBox(){
  if(!pocket.has('flute'))return;
  fluteTrayOpen=true;
  selected=null;
  render();
  tell('The flute is playable. Press one of its three raised keys, or use the larger keys in your inventory below.');
  $('ncFluteTray')?.scrollIntoView({behavior:'smooth',block:'nearest'});
 },
 activatePhysicalFluteNote(index){
  // Inventory ownership is the condition for playing. An old save with
  // the completed flute must never get stuck behind a missing lid flag.
  if(!Number.isInteger(index)||index<1||index>3||!pocket.has('flute'))return;
  note(index);
 },
 activatePhysicalBagDial(index){
  if(!Number.isInteger(index)||index<0||index>=BAG_CODE.length)return;
  if(!s.bagOpen){
   tell('The small brass wheels are fixed firmly beneath the locked clasp.');
   return;
  }
  turnBag(index);
 },
 activatePhysicalBagRelease(){
  if(!thingPresent('bag'))return false;
  return pressBagRelease();
 },
 activatePhysicalElevatorFloor(floor){
  if(!Number.isInteger(floor)||floor<1||floor>4||!thingPresent('elevator'))return;
  bloom('lift');
  callElevator(floor);
 },
 activatePhysicalThing(name){
  const supported=new Set(['bag','door','dog','vase','squirrel','pot','musicbox',
   'cloud','cup','clock','machine','elevator','moth','telescope','train']);
  if(supported.has(name))clickThing(name);
 },
 activatePhysicalDoorHandle(){
  if(!thingPresent('door'))return;
  clickThing('door',true);
 },
 get physicalReady(){return document.body.classList.contains('nc-physical-ready')}
};
})();