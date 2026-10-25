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
 ['bell','A bell with no purpose.'],
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
 letter:'folded letter',envelope:'sealed return envelope'};
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
 envelope:'M3 8h26v18H3V8Zm0 2 13 10 13-10M3 26l10-9m16 9-10-9'};
const recipe={
 'pipe+reed':['flute','flute','The hollow pipe finally remembers how to sing.'],
 'ring+tooth':['key','key','Those two pieces click together, perfectly.'],
 'prism+thread':['kite','kite','You have made a kite from almost nothing.']
};
// Author-drawn silhouettes render identically across operating systems.
// Each pocket label remains visible, so identity never depends on color.
const pocketMetal=new Set(['tooth','ring','flute','key','coin','spring','bell','tag','cog','shim','washer','fork']);
const pocketGlass=new Set(['prism','raindrop','sugar','lens','stardust','iris']);
const pocketPaper=new Set(['bird','starmap','parcel','postcard','tape','letter','envelope']);
const pocketMaterial=id=>pocketMetal.has(id)?'metal':pocketGlass.has(id)?'glass':pocketPaper.has(id)?'paper':'organic';
const inventoryIcon=id=>'<svg class="nc-item-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="'+(glyphs[id]||glyphs.stardust)+'" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const sorted=(a,b)=>[a,b].sort().join('+');
let raw={};
try{raw=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const seen=new Set((Array.isArray(raw.seen)?raw.seen:[]).filter(k=>title.has(k)));
const pocket=new Set((Array.isArray(raw.pocket)?raw.pocket:[]).filter(k=>Object.hasOwn(names,k)));
const defaults={a:false,b:false,top:false,bottom:false,left:false,back:false,bag:false,
 bagOpen:false,bagSolved:false,door:false,doorOpen:false,barked:false,squirrel:false,
 vase:false,plant:false,tree:false,cloud:false,music:false,watch:false,machine:false,
 cup:false,moon:false,mouse:false,tag:false,kite:false,
 floorFour:false,mothTouched:false,observed:false,dancer:false,train:false,parcelTaken:false,portal:false,
 drawerTaken:false,sideTaken:false,pipeTaken:false,ringTaken:false,
 plateOpen:false,ventOpen:false,opticOpened:false,secondSky:false,
 shimUsed:false,clockHeart:false,footChecked:false,rightBoltLoose:false,
 serialRead:false,pressureReady:false,resonance:false,serviceOpen:false,
 cylinderMounted:false,tapeInserted:false,letterMailed:false,doorReplied:false};
const s={...defaults};
for(const k of Object.keys(defaults))if(typeof raw[k]==='boolean')s[k]=raw[k];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
s.topHits=clamp(Number(raw.topHits)||0,0,12);
s.redHits=clamp(Number(raw.redHits)||0,0,30);
s.dogHits=clamp(Number(raw.dogHits)||0,0,12);
s.bagDials=Array.isArray(raw.bagDials)&&raw.bagDials.length===3?raw.bagDials.map(x=>clamp(Number(x)||0,0,3)):[0,0,0];
s.fluteNotes=Array.isArray(raw.fluteNotes)?raw.fluteNotes.filter(x=>Number.isInteger(x)&&x>=1&&x<=3).slice(-3):[];
s.rx=clamp(Number.isFinite(raw.rx)?raw.rx:-18,-4000,4000);
// Orientation is a view, not story progress. Always start from an attractive
// three-quarter front angle even if the player left the cube upside down.
s.rx=-22;
s.ry=-32;
s.screws=Array.isArray(raw.screws)?[...new Set(raw.screws.filter(n=>[0,1,2].includes(n)))]:[];
s.hingePins=Array.isArray(raw.hingePins)?[...new Set(raw.hingePins.filter(n=>[0,1,2].includes(n)))]:[];
s.ventSequence=Array.isArray(raw.ventSequence)?raw.ventSequence.filter(n=>[1,2,3].includes(n)).slice(-3):[];
// Older saves allowed this mechanical ratchet to overrun indefinitely.
// Normalize those poses to its real three-detent end stop without touching
// the player's completed secrets or inventory.
s.eyeRingTicks=clamp(Number(raw.eyeRingTicks)||0,0,3);
s.falseScrewTurns=clamp(Number(raw.falseScrewTurns)||0,0,20);
s.pressureTicks=clamp(Number(raw.pressureTicks)||0,0,3);
let selected=null,previousFocus=null,panel=null,dragging=false,dragMoved=false,dragStart=null,blockedClick=false;
// The pocket is re-rendered after every mechanical action. Newly found
// highlights and keyboard focus must survive those renders.
const pocketArrivalUntil=new Map();
let toastTimeout=null,animationTimeout=null,fleeing=false;
const story={};
function store(){
 try{localStorage.setItem(KEY,JSON.stringify({...s,seen:[...seen],pocket:[...pocket]}))}catch{}
}
function tell(message){$('ncNarrator').textContent=message}
function sound(freq=530){
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  if(!sound.ctx)sound.ctx=new AC();
  const c=sound.ctx,o=c.createOscillator(),g=c.createGain();
  o.type='sine';o.frequency.setValueAtTime(freq,c.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq*.75,c.currentTime+.13);
  g.gain.setValueAtTime(.055,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18);
  o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.19);
 }catch{}
}
function bloom(id,comment){
 if(!title.has(id)||seen.has(id))return false;
 seen.add(id);
 let t=$('ncToast');t.textContent='✳  '+title.get(id);t.hidden=false;
 clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.hidden=true,2700);
 if(comment)tell(comment);
 sound(495+seen.size*12);render();return true;
}
function gain(id,message){
 if(!Object.hasOwn(names,id))return;
 if(!pocket.has(id)){
  const origin=document.activeElement?.closest?.('[data-hit],[data-thing],[data-dial]')||null;
  pocket.add(id);
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
 $('ncModal').hidden=false;$('gameInfoBtn')?.setAttribute('aria-expanded',String(type==='info'));
 $('ncModalClose').focus();
}
function closeModal(){
 if($('ncModal').hidden)return;
 $('ncModal').hidden=true;panel=null;
 $('gameInfoBtn')?.setAttribute('aria-expanded','false');
 if(previousFocus?.isConnected)previousFocus.focus();
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
 if(reducedMotion)return;
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
 if(reducedMotion)return;
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
 if(reducedMotion||!origin)return;
 const node=document.createElement('span');node.className='nc-musical-note';node.textContent='♪';
 origin.appendChild(node);setTimeout(()=>node.remove(),1260);
}
function incident(symbol){
 const node=$('ncIncident');$('ncIncidentIcon').textContent=symbol;
 node.classList.remove('nc-incident-pop');void node.offsetWidth;node.classList.add('nc-incident-pop');
 clearTimeout(animationTimeout);animationTimeout=setTimeout(()=>node.classList.remove('nc-incident-pop'),1100);
}
function render(){
 $('ncCount').textContent=seen.size;
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
 const focusedItem=inventory.contains(document.activeElement)
  ?document.activeElement.closest('[data-item]')?.dataset.item:null;
 const now=Date.now();
 const str=[...pocket].map(id=>'<button type="button" class="nc-item'+
   (id===selected?' nc-selected':'')+
   ((pocketArrivalUntil.get(id)||0)>now?' nc-item-new':'')+
   '" data-item="'+id+'" aria-pressed="'+String(selected===id)+
   '" draggable="true" data-material="'+pocketMaterial(id)+'"><span class="nc-item-icon" aria-hidden="true">'+inventoryIcon(id)+'</span>'+
   names[id]+'</button>').join('');
 inventory.innerHTML=str||'<span class="nc-empty">Nothing. Yet.</span>';
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
 // A selected item is clearly marked in the pocket, but never highlight
 // the correct combinations or recipient targets before discovery.
 document.querySelectorAll('[data-thing]').forEach(node=>{
  node.classList.remove('nc-receptive');
 });
 store();
 // The physical renderer reflects the same authoritative puzzle state;
 // neither the 3D mesh nor its animation grants secrets independently.
 window.dispatchEvent(new CustomEvent('nc:statechange',{
  detail:{...s,pocket:[...pocket],selected}
 }));
}
function collection(id){gain(id,'You found '+names[id]+'.')}
// The visible contents of moving 3D compartments are collected after the
// mechanical animation completes, even when a moving face retargets a tap.
// Directly tapping an exposed item still picks it up immediately.
const compartmentTimer=new Map();
function scheduleCompartment(thing){
 if(compartmentTimer.has(thing))return;
 const specs={tooth:['a','drawerTaken',1100],thread:['b','sideTaken',1100],pipe:['top','pipeTaken',1300]};
 const [open,taken,ms]=specs[thing];
 const captionAtOpen=$('ncNarrator')?.textContent;
 const timer=setTimeout(()=>{
  compartmentTimer.delete(thing);
  if(!s[open]||s[taken])return;
  s[taken]=true;
  // A delayed auto-pickup must not overwrite the clue the player is
  // actively reading from a newer interaction. The part still flies into
  // the pocket and is visibly highlighted.
  const caption=$('ncNarrator')?.textContent===captionAtOpen
   ?'A little '+names[thing]+' slides into your pocket.':null;
  gain(thing,caption);
  render();
 },ms);
 compartmentTimer.set(thing,timer);
}
function inspectHardware(name){
 if(name==='serial'){
  s.serialRead=true;
  bloom('maker-stamp','Stamped beneath the maker\'s seal: PROPERTY OF NOBODY / 04 / CALIBRATE TO THREE.');
  tell('Somebody signed the inspection tag with an X. The date is tomorrow.');
  cue(document.querySelector('[data-hit="serial"]'),'nc-fastener-turning',550);
  return true;
 }
 if(name==='pressure'){
  if(!s.pressureReady){
   s.pressureTicks++;
   sound(265+s.pressureTicks*130);
   if(s.pressureTicks>=3){
    s.pressureReady=true;gain('fork');
    bloom('pressure-dial','The brass manometer reaches three. A slender tuning fork unclips from the gauge.');
    scatter('#e4c99b',9,document.querySelector('[data-hit="pressure"]'));
   }else tell('The little gauge needle settles onto another engraved tick.');
  }else tell('The pressure holds steady at three, though there is nothing inside.');
  return true;
 }
 if(name==='shutter'){
  if(!s.resonance){tell('The blue service hatch shivers, but its sound-operated latch is sealed.');return true}
  if(!s.serviceOpen){
   s.serviceOpen=true;gain('cylinder');
   bloom('service-shutter','The resonator slides on brass rails. Inside is a grooved wax cylinder.');
   cue('ncWorld','nc-shudder',450);scatter('#a4cbca',11,document.querySelector('[data-hit="shutter"]'));
  }else tell('The little service cavity is empty now. Its spring still hums.');
  return true;
 }
 if(name.startsWith('front-screw-')){
  const n=Number(name.slice(-1));
  if(n===3){
   s.falseScrewTurns++;
   bloom('false-screw','The last screw turns freely but never rises. It is a disguised button.');
   tell(s.screws.length===3?'It clicks. The front panel can now be lifted.':'This screw is strange: no threads, just a spring.');
   cue(document.querySelector('[data-hit="'+name+'"]'),'nc-fastener-turning',550);
  }else if(!s.screws.includes(n)){
   s.screws.push(n);bloom('fastener','The screw spirals out and leaves a real threaded hole.');
   if(s.screws.length===3){
    s.plateOpen=true;gain('cog');
    bloom('faceplate','With the third screw out, a spring lifts the enamel plate. A brass drive cog drops into your pocket.');
    cue('ncCube','nc-scene-blink',800);
   }else tell('A real screw came out. The empty socket has surprisingly fine threads.');
   scatter('#c7b8a5',5,document.querySelector('[data-hit="'+name+'"]'));
   sound(620);
  }else tell('Nothing to unscrew here. The empty hole is threaded.');
  return true;
 }
 if(name.startsWith('right-bolt-')){
  const n=Number(name.slice(-1));
  if(n===1&&!s.rightBoltLoose){
   s.rightBoltLoose=true;
   tell('A service rivet comes out. Scratched behind it: THREE, ONE, TWO.');
   scatter('#9ec7c9',7,document.querySelector('[data-hit="'+name+'"]'));
  }else if(n===1)tell('The missing rivet exposes a tiny service number: 312.');
  else tell(['The first rivet has a slot shaped like a minus sign.',
   '', 'The third rivet was installed backwards.','The fourth rivet holds the drawer rail.'][n]);
  return true;
 }
 if(name.startsWith('vent-')){
  const n=Number(name.slice(-1));
  if(s.ventOpen){tell('The service grille has already opened.');return true}
  s.ventSequence.push(n);s.ventSequence=s.ventSequence.slice(-3);
  if(s.ventSequence.join('')==='312'){
   s.ventOpen=true;gain('shim');
   bloom('vent-sequence','Three—one—two. The vent grille moves and reveals a copper shim.');
   cue('ncWorld','nc-shudder',430);scatter('#d1a996',9,document.querySelector('[data-hit="'+name+'"]'));
  }else if(s.ventSequence.length===3){
   s.ventSequence=[n];tell('Wrong combination. The little vents reset with a hollow clack.');
   sound(200);
  }else{tell('Click. The vent holds the last button down for a moment.');sound(270+n*90)}
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
  tell('Beneath the calibrated rear lens, a miniature brass ribbon bears three marks: ◇ · ○ · ☾.');
  sound(575);
  return true;
 }
 if(name.startsWith('hinge-')){
  const n=Number(name.slice(-1));
  if(!s.hingePins.includes(n)){
   s.hingePins.push(n);sound(350+n*125);
   if(s.hingePins.length===3){
    gain('washer');bloom('hinge-pin','All three hinge pins have shifted. A miniature washer rolls out.');
    scatter('#e0c88a',8,document.querySelector('[data-hit="'+name+'"]'));
   }else tell('A tiny hinge pin moves. It seems to unlock another piece.');
  }else tell('This hinge pin is already loose.');
  return true;
 }
 if(name==='foot'){
  s.footChecked=true;bloom('underside-foot','Under the rubber foot: a mirrored maker\'s note. 2 · 1 · 3.');
  tell('The foot folds back. An inscription underneath reads 2 · 1 · 3.');
  return true;
 }
 return false;
}
function cubeHit(name){
 bloom('first');
 if(inspectHardware(name)){render();return}
 if(selected&&name==='eye'&&use(selected,'eye'))return;
 if(name==='latch'){
  if(!s.a){s.a=true;bloom('drawer','A drawer slides straight out of a wall that cannot contain drawers.');scheduleCompartment('tooth')}
  else tell(s.drawerTaken?'This tiny drawer is empty now.':'There is a strange, key-shaped piece inside.');
 }else if(name==='drawer-a'){
  if(!s.drawerTaken){s.drawerTaken=true;collection('tooth');tell('The teeth of something that once opened a lock.')}
 }else if(name==='seam'){
  if(!s.b){s.b=true;bloom('thread','A horizontal compartment seems to have been there all along.');scheduleCompartment('thread')}
  else tell(s.sideTaken?'Only a loose red fiber remains.':'That is definitely a spool of thread.');
 }else if(name==='drawer-b'){
  if(!s.sideTaken){s.sideTaken=true;collection('thread');tell('It is red thread. It refuses to explain itself.')}
 }else if(name==='triangle'){
  s.topHits++;
  if(s.topHits>=3&&!s.top){s.top=true;bloom('pipe','A lid rises. There is something that looks like a flute before it became a flute.');scheduleCompartment('pipe')}
  else tell(s.top?'Something hollow lies under the lid.':'A small catch shifts inside the lid.');
 }else if(name==='top-reed'){
  if(!s.pipeTaken){s.pipeTaken=true;collection('pipe');bloom('pipe');tell('A beautifully useless wooden pipe.')}
 }else if(name==='hatch'){
  if(!s.bottom){s.bottom=true;bloom('ring','A brass ring falls out of the underside.');}
  if(!s.ringTaken){s.ringTaken=true;collection('ring');}
 }else if(name==='dent'){
  if(!s.mouse){s.mouse=true;s.left=true;s.bag=true;s.machine=true;
   bloom('mouse','A clockwork mouse skitters away. It has left a handbag and a coin behind.');
   bloom('bag');gain('coin');incident('🐁');
  } else tell('Only the faint sound of tiny metallic footsteps remains.');
 }else if(name==='eye'){
  if(!s.back){s.back=true;bloom('eye','The eye blinks: TWO · ONE · THREE. Nobody says what that means.');}
  else if(document.body.classList.contains('nc-physical-ready'))
  tell('Engraved behind the eye: TWO · ONE · THREE. The optical ring beside it also turns.');
 else modal('REVERSE SIDE','A message with no sender','<p class="nc-clue">TWO · ONE · THREE</p><p>Someone scratched those words into the cube from the inside.</p>','eye');
 }else if(name==='dot'){
  s.redHits++;
  if(s.redHits===1)bloom('dot','Do not push the red dot. (You pushed the red dot.)');
  if(s.redHits===4){bloom('bell','Something jingles from the bottom of the cube.');gain('bell');}
  else if(s.redHits>4)tell('The red dot refuses to admit it has a function.');
  else tell('click.');
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
 ||item==='coin'&&thing==='machine'
 ||item==='kite'&&thing==='cloud'&&s.cloud&&!s.kite
 ||item==='sugar'&&thing==='cup'&&s.cup
 ||item==='bird'&&thing==='cube'&&s.tree&&!s.moon
 ||item==='bell'&&thing==='dog'&&s.doorOpen
 ||item==='lens'&&thing==='telescope'&&s.moon&&!s.observed
 ||item==='stardust'&&thing==='musicbox'&&s.music&&!s.dancer
 ||item==='starmap'&&thing==='elevator'&&s.floorFour&&!s.train
 ||item==='parcel'&&thing==='dog'&&s.doorOpen
 ||item==='postcard'&&thing==='cube'&&!s.portal
 ||item==='cog'&&thing==='eye'&&s.eyeRingTicks>=3&&!s.opticOpened
 ||item==='iris'&&thing==='telescope'&&s.observed&&!s.secondSky
 ||item==='shim'&&thing==='machine'&&!s.shimUsed
 ||item==='washer'&&thing==='musicbox'&&s.music&&!s.clockHeart
 ||item==='fork'&&thing==='cube'&&s.pressureReady&&!s.resonance
 ||item==='cylinder'&&thing==='musicbox'&&s.music&&!s.cylinderMounted
 ||item==='tape'&&thing==='clock'&&s.watch&&!s.tapeInserted
 ||item==='letter'&&thing==='train'&&s.train&&!s.letterMailed
 ||item==='envelope'&&thing==='door'&&s.doorOpen&&!s.doorReplied;
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
  spend('treat');s.tag=true;gain('tag');bloom('tag','The dog coughs up a numbered collar tag. It says 04.');
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
  spend('coin');gain('sugar');bloom('machine','The machine accepts money but dispenses sugar cubes.');
 }else if(item==='kite'&&thing==='cloud'){
  spend('kite');s.kite=true;bloom('kite','The kite becomes a weather vane and flies out of this dimension.');incident('◇');
 }else if(item==='sugar'&&thing==='cup'){
  spend('sugar');s.watch=true;bloom('teacup','The teacup burps and produces an antique pocket watch.');
 }else if(item==='bird'&&thing==='cube'){
  spend('bird');s.moon=true;bloom('moon','The paper bird flies into the cube. A tiny moon takes its place.');incident('☾');
 }else if(item==='bell'&&thing==='dog'){
  sound(820);tell('The dog looks offended. It prefers being petted.');
 }else if(item==='lens'&&thing==='telescope'){
  spend('lens');s.observed=true;
  bloom('constellation','The lens focuses on a constellation that has never existed.');
  gain('starmap','A tiny star chart unfolds from the telescope.');
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
  bloom('hidden-optic','The brass gear meshes with the eye. A tiny glass iris falls into your pocket.');
 }else if(item==='iris'&&thing==='telescope'){
  spend('iris');s.secondSky=true;
  bloom('second-sky','For an instant, the telescope sees two different skies at once.');
 }else if(item==='shim'&&thing==='machine'){
  spend('shim');s.shimUsed=true;gain('coin');
  bloom('service-bolt','The copper shim releases the machine\'s jammed coin-return mechanism.');
 }else if(item==='washer'&&thing==='musicbox'){
  spend('washer');s.clockHeart=true;
  bloom('clockwork-heart','You repaired the tiny escapement. The music box begins to tick between songs.');
 }else if(item==='fork'&&thing==='cube'){
  spend('fork');s.resonance=true;
  bloom('resonance','The tuning fork sings against the enamel. Something slides open on the blue side.');
 }else if(item==='cylinder'&&thing==='musicbox'){
  spend('cylinder');s.cylinderMounted=true;gain('tape');
  bloom('wax-cylinder','A tiny wax voice plays backwards. The box prints a narrow strip of punched tape.');
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
 if(item==='lens'&&thing==='telescope'){cue(prop('telescope'),'nc-scope-zoom',1600);scatter('#c7d7ef',13,prop('telescope'))}
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
 if(!selected){selected=item;tell('Holding '+names[item]+'. Choose another pocket item or an object in the world.');render();return}
 if(item===selected){selected=null;render();return}
 const result=recipe[sorted(selected,item)];
 if(!result){tell('Those pieces do not fit. Both are still in your pocket.');sound(185);render();return}
 spend(selected);spend(item);gain(result[0],result[2]);selected=null;bloom(result[1],result[2]);render();
}
function openBag(){
 if(!s.bagOpen){tell('The bag is locked. Its little brass keyhole seems very specific.');return}
 const sym=['○','✳','◇','☾'];
 modal('INSIDE THE BAG',s.bagSolved?'A suspicious lining':'The three hidden wheels',
  '<p>Three little wheels are sewn into the lining. The stitching is newer than the bag, and nothing explains their order.</p>'+
  '<div class="nc-bag-interior" id="ncBagInterior"><div class="nc-bag-wheels">'+[0,1,2].map(i=>'<button class="nc-dial" type="button" data-dial="'+i+'" aria-label="Turn wheel '+(i+1)+'">'+sym[s.bagDials[i]]+'</button>').join('')+'</div>'+
  '</div><p class="nc-modal-note" id="ncBagNote">'+(s.bagSolved?'The false bottom has already opened.':'These are not ordinary luggage wheels.')+'</p>','bag');
}
function turnBag(i){
 if(s.bagSolved)return;
 s.bagDials[i]=(s.bagDials[i]+1)%4;
 const dialButton=document.querySelector('[data-dial="'+i+'"]');
 if(dialButton)dialButton.textContent=['○','✳','◇','☾'][s.bagDials[i]];
 if(s.bagDials.join('')==='203'){
  s.bagSolved=true;gain('reed');gain('treat');gain('prism');
  bloom('bag-code','Under the false bottom: a reed, a biscuit and a glass prism.');
  const bagNote=$('ncBagNote');
  if(bagNote)bagNote.textContent='A tiny false bottom has opened. Its contents are in your pocket.';
  cue('ncBagInterior','nc-unlatched',1100);scatter('#d2b5a1',13,document.querySelector('#ncBagInterior'));
  incident('✳');
 }else sound(350+i*50);
 // Also update physical 3D dial positions and persist the very same save.
 render();
}
function openElevator(){
 bloom('lift','A brass elevator has appeared. It has four floors and absolutely no building.');
 modal('AT THE EDGE OF THE ROOM',s.floorFour?'The fourth-floor lift':'The miniature elevator',
  '<p>Four buttons. The elevator is smaller than the dog\'s collar tag.</p>'+
  '<div class="nc-lift-puzzle"><div class="nc-lift-miniature"><i class="nc-lift-glass"></i><i class="nc-lift-innerdoors"></i><span>04</span></div>'+
  '<div class="nc-lift-buttons">'+[1,2,3,4].map(n=>'<button type="button" data-floor="'+n+'" aria-label="Visit miniature floor '+n+'" class="nc-lift-call">'+String(n).padStart(2,'0')+'</button>').join('')+'</div></div>'+
  '<p class="nc-modal-note" id="ncLiftMessage">'+(s.floorFour?'The fourth floor is open. Look for the tiny moth outside.':'Somewhere, a small brass tag might tell you where to stop.')+'</p>','elevator');
}
function callElevator(floor){
 const text=$('ncLiftMessage')||{textContent:''};
 sound(240+floor*110);
 document.querySelectorAll('[data-floor]').forEach(b=>b.classList.toggle('nc-floor-active',Number(b.dataset.floor)===floor));
 if(floor!==4){text.textContent=['','Nobody lives on floor one.','A miniature tumbleweed rolls by.','The doors open onto a painted brick wall.'][floor];return}
 if(!s.floorFour){
  s.floorFour=true;
  gain('lens','The tiny lift delivers a silver lens wrapped in tissue.');
  bloom('fourth','The doors open on floor four. A clockwork moth flies out of the lift.');
  cue(prop('elevator'),'nc-lift-arrived',1400);
  scatter('#c6b7d9',16,prop('elevator'));
  cue(prop('moth'),'nc-moth-arrive',1700);
  text.textContent='Floor 04: a silver lens, and something fluttering nearby.';
 }else text.textContent='Floor 04 is still full of empty little corridors.';
 render();
}
function openFlute(){
 if(document.body.classList.contains('nc-physical-ready')){
  // The instrument is genuinely modeled inside the hinged top well.
  // Keep the puzzle on the real 3D box instead of opening an HTML modal.
  tell(s.top?'The little flute rests in the upper compartment.':
    'The flute sounds hollow. Something in the upper compartment may fit it.');
  return;
 }
 s.fluteNotes=[];
 modal('A VERY UNNECESSARY INSTRUMENT','The flute',
  '<p>It has three holes. Every breath becomes a different note.</p><div class="nc-flute-model" id="ncFluteModel"><span></span><span></span><span></span></div><div class="nc-flute-keys">'+
  [1,2,3].map(i=>'<button type="button" data-note="'+i+'" aria-label="Blow flute note '+i+'">'+i+'</button>').join('')+
  '</div><div class="nc-flute-track" id="ncFluteTrack">♪  ·  ·  ·</div>', 'flute');
}
function note(i){
 s.fluteNotes.push(i);s.fluteNotes=s.fluteNotes.slice(-3);sound(390+i*135);
 const physical=document.body.classList.contains('nc-physical-ready');
 if(!physical){
  cue('ncFluteModel','nc-playing',380);floatNote($('ncFluteModel'));
  $('ncFluteTrack').textContent='♪  '+s.fluteNotes.map(n=>['Ⅰ','Ⅱ','Ⅲ'][n-1]).join('  ');
 }
 if(s.fluteNotes.join('')==='213'){
  if(!s.door){
    s.door=true;bloom('door','The flute has summoned a very real door from an extremely empty wall.');
    cue('ncDoorScene','nc-arriving',1430);cue('ncWorld','nc-shudder',430);scatter('#e5c8aa',12,$('ncDoorScene'));
   }
  else tell('The door recognizes that tune.');
  if(!physical){
   closeModal();setTimeout(()=>$('ncDoorScene').scrollIntoView({behavior:'smooth',block:'nearest'}),80);
  }
 }else if(s.fluteNotes.length===3){
  if(!physical)$('ncFluteTrack').textContent+='  ...nothing.';
  else tell('The three tones fade into the machinery. Nothing else moves.');
 }
 render();
}
function bark(){
 s.dogHits++;
 cue('ncDog','nc-petting',520);
 if(s.dogHits===1)bloom('dog','The dog tilts its head, wondering whether you are real.');
 if(s.dogHits===3&&!s.barked){
  s.barked=true;s.squirrel=true;s.vase=true;
  bloom('bark','After three pats, the dog lets out a shockingly loud BARK!');
  bloom('squirrel','A squirrel bolts. It was balanced on top of the door.');
  bloom('vase','The squirrel knocks over an unseen vase. An acorn and a spring roll out.');
  gain('acorn');gain('spring');bloom('spring');fleeing=true;
   cue('ncDog','nc-howling',1250);
   cue('ncImpactWave','nc-running',1250);
   cue('ncActionSquirrel','nc-running',2000);
   cue(prop('vase'),'nc-shattering',1550);
   cue('ncWorld','nc-shudder',430);
   scatter('#add0d0',17,prop('vase'));
  setTimeout(()=>{fleeing=false;render()},1350);
  sound(215);
 }else if(s.dogHits<3)tell('The little dog leans against your hand, its collar jingling softly.');
 else tell('The dog is now very proud of itself.');
 render();
}
function clickThing(name){
 if(selected){
  if(use(selected,name))return;
  tell('That '+names[selected]+' does not seem to fit there.');render();return;
 }
 bloom('first');
 if(name==='bag'){
   if(s.bagOpen&&document.body.classList.contains('nc-physical-ready'))
    tell(s.bagSolved?'The false bottom is empty now.':'Three small metal tumblers sit beneath the open catch.');
   else openBag();
 }
 else if(name==='door'){
  if(!s.doorOpen){
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
  if(s.music){gain('raindrop','You caught a raindrop in your palm.');bloom('rain');incident('💧')}
  else tell('A cloud the size of a sandwich.');
 }else if(name==='cup')tell(s.watch?'The bottom of the cup is a tiny hole in time.':'It could use some sugar.');
 else if(name==='clock'){
  bloom('clock','It is 4:17. It has been 4:17 for a very long time.');
  if(document.body.classList.contains('nc-physical-ready'))
   tell('The miniature clock has stopped at 4:17. Another object might make its mechanism run.');
  else modal('CLOCK DEPARTMENT','4:17','<p>Nothing is wrong with this clock. It just refuses to acknowledge the existence of other times.</p>','clock');
 }else if(name==='machine')tell('INSERT COIN. It is remarkably confident.');
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
  if(!s.observed)tell('It is missing the little glass lens from the front.');
  else{tell('Five lights trace the same secret constellation.');cue(prop('telescope'),'nc-scope-zoom',1550);}
 }
 else if(name==='train'){
  if(!s.parcelTaken){
   s.parcelTaken=true;gain('parcel','The tiny train delivers a parcel with no return address.');
   bloom('parcel','A steam-powered locomotive has delivered you one absurdly small parcel.');
  }else tell('The tiny train continues its endless commute below the page.');
  cue(prop('train'),'nc-train-whistle',900);
 }
 render();
}
function journal(){
 const found=[...seen].map(id=>'<span>✳ '+title.get(id)+'</span>').join('');
 modal('NOT A CHECKLIST','Strange little occurrences',
 '<p>Things that have happened. Not all things are meant to be catalogued.</p>'+

 '<div class="nc-journal">'+(found||'<span>Nothing has happened. So far.</span>')+'</div>'+
 '<p class="nc-modal-note">Your discoveries save on this device.</p>','journal');
}
function info(){
 modal('A SLIGHTLY UNHELPFUL EXPLANATION','Turn it.',
  '<p>Drag to rotate, use the arrows, or zoom with the + / − buttons, your mouse wheel, or a two-finger pinch. Select ✥ to move a zoomed-in view. Press ↺ to reset.</p><p>Screws, vents, tiny markings, dial wheels and hinge pins are all worth inspecting.</p>'+
  '<p>Some discoveries are useful somewhere else. You can select an item and experiment with the other objects, or try combining two things in your pocket.</p>'+
  '<p>Small engravings identify parts of the mechanism. Hover to see an object\'s name, or tap to explore. Objects you collect move into your pocket below.</p>'+
 '<p>The journal records what you have discovered. Your progress saves on this device.</p>','info');
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
 if(item)take(item.dataset.item);
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
$('gameInfoBtn')?.addEventListener('click',info);
$('ncModalClose').addEventListener('click',closeModal);
$('ncModal').addEventListener('click',e=>{if(e.target===$('ncModal'))closeModal()});
$('ncUnselect').addEventListener('click',()=>{selected=null;render()});
$('ncCubeZone').addEventListener('click',e=>{
 if(e.target.closest?.('#stage'))return; // Routed through 3D clickAction, not an empty-zone offering.
 if(blockedClick){e.stopImmediatePropagation();e.preventDefault();blockedClick=false;return}
if(!selected&&e.target.closest('[data-thing="cube"]')&&s.screws.length===3&&!s.plateOpen){
  s.plateOpen=true;gain('cog');
  bloom('faceplate','The loosened faceplate shifts aside. A brass drive cog was hiding underneath.');
  cue('ncCube','nc-scene-blink',750);scatter('#bdabce',10,$('ncOfferingTarget'));
  render();e.stopPropagation();return;
 }
 // The engraved square is a real touch target, also usable by keyboard.
 if(selected&&e.target.closest('[data-thing="cube"]')){
  if(!use(selected,'cube')){tell('The cube refuses that offering.');render();}
  e.stopPropagation();return;
 }
 if(selected&&!e.target.closest('button,[data-hit]')){
  if(use(selected,'cube')){e.stopPropagation();return}
  tell('The cube refuses that offering.');render();
 }
},true);
$('ncModalBody').addEventListener('click',e=>{
 const dial=e.target.closest('[data-dial]');if(dial&&panel==='bag'){turnBag(Number(dial.dataset.dial));return}
 const noteEl=e.target.closest('[data-note]');if(noteEl&&panel==='flute'){note(Number(noteEl.dataset.note));return}
 const floorEl=e.target.closest('[data-floor]');if(floorEl&&panel==='elevator'){callElevator(Number(floorEl.dataset.floor));return}
});
// View manipulation is deliberately separate from saved puzzle progress.
// Zooming never consumes an item, and a reset also restores a readable angle.
const view={zoom:1,panX:0,panY:0,panMode:false};
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
 const newZoom=clamp(Math.round(value*100)/100,.82,2.35);
 if(newZoom===view.zoom)return;
 view.zoom=newZoom;
 updateView();
 window.__nothing3DPreview?.setZoom?.(view.zoom);
}
function resetView(){
 view.zoom=1;view.panX=0;view.panY=0;view.panMode=false;
 s.rx=-22;s.ry=-32;
 const physical=document.body.classList.contains('nc-physical-ready')&&
  !!window.__nothing3DPreview?.resetCameraView;
 // Classic view still uses its original synchronous 2D orientation.
 // In 3D, let the scene interpolate the orbit, camera and box together.
 if(!physical)turn();
 updateView();
 if(physical){
  window.__nothing3DPreview.setPanMode(false);
  window.__nothing3DPreview.resetCameraView();
 }else window.__nothing3DPreview?.setZoom?.(1);
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
// A flute is played, not combined indiscriminately. Inventory navigation is click and keyboard accessible.
$('ncInventory').addEventListener('dblclick',e=>{
 const el=e.target.closest('[data-item]');
 if(el?.dataset.item==='flute')openFlute();
});
$('ncInventory').addEventListener('click',e=>{
 const el=e.target.closest('[data-item]');
 if(el?.dataset.item==='flute'){selected=null;render();openFlute();}
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
if(s.a&&!s.drawerTaken)scheduleCompartment('tooth');
if(s.b&&!s.sideTaken)scheduleCompartment('thread');
if(s.top&&!s.pipeTaken)scheduleCompartment('pipe');
window.CriloNothingHereCube={getState:()=>({...s,pocket:[...pocket],seen:[...seen],selected}),
 getView:()=>({...view}),zoomTo,resetView,
 updatePhysicalViewZoom(value){
  // OrbitControls owns physical mouse-wheel zoom. Mirror only its value
  // into the already-visible zoom percentage and subsequent button steps.
  if(!Number.isFinite(value))return;
  view.zoom=clamp(Math.round(value*100)/100,.65,2.35);
  updateView();
 },
 rotate:(x,y)=>{s.rx=x;s.ry=y;turn()},
 activatePhysical(name){
  if(name==='cube-offer'){
   // Reuse the original item-combination and faceplate logic.
   $('ncOfferingTarget').click();
  }else cubeHit(name);
 },
 // The physical miniatures are visual counterparts of the EXISTING world
 // props. Selecting an inventory item and then a 3D object uses the same
 // recipe, discovery, modal and storage rules as clicking its HTML button.
 activatePhysicalFluteNote(index){
  if(!Number.isInteger(index)||index<1||index>3||!pocket.has('flute')||!s.top)return;
  note(index);
 },
 activatePhysicalBagDial(index){
  if(!Number.isInteger(index)||index<0||index>2)return;
  if(!s.bagOpen){
   tell('The small brass wheels are fixed firmly beneath the locked clasp.');
   return;
  }
  turnBag(index);
 },
 activatePhysicalElevatorFloor(floor){
  if(!Number.isInteger(floor)||floor<1||floor>4||!s.watch||!s.tag)return;
  bloom('lift');
  callElevator(floor);
 },
 activatePhysicalThing(name){
  const supported=new Set(['bag','door','dog','vase','squirrel','pot','musicbox',
   'cloud','cup','clock','machine','elevator','moth','telescope','train']);
  if(supported.has(name))clickThing(name);
 },
 get physicalReady(){return document.body.classList.contains('nc-physical-ready')}
};
})();