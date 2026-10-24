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
 ['tag','The dog was never lost.']
];
const title=new Map(catalog);
const names={tooth:'key teeth',ring:'brass ring',thread:'red thread',pipe:'hollow pipe',reed:'tiny reed',
 flute:'flute',key:'little key',coin:'coin',treat:'dog biscuit',prism:'glass prism',
 acorn:'acorn',spring:'clock spring',raindrop:'a drop of rain',bird:'paper bird',
 kite:'a kite',sugar:'sugar cube',bell:'tiny bell',tag:'collar tag'};
const glyphs={tooth:'⌗',ring:'◌',thread:'〰',pipe:'╱',reed:'ː',flute:'♫',
 key:'⚿',coin:'◉',treat:'♧',prism:'◇',acorn:'♠',spring:'⌁',
 raindrop:'◕',bird:'➤',kite:'◈',sugar:'□',bell:'♧',tag:'04'};
const recipe={
 'pipe+reed':['flute','flute','The hollow pipe finally remembers how to sing.'],
 'ring+tooth':['key','key','Those two pieces click together, perfectly.'],
 'prism+thread':['kite','kite','You have made a kite from almost nothing.']
};
const sorted=(a,b)=>[a,b].sort().join('+');
let raw={};
try{raw=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const seen=new Set((Array.isArray(raw.seen)?raw.seen:[]).filter(k=>title.has(k)));
const pocket=new Set((Array.isArray(raw.pocket)?raw.pocket:[]).filter(k=>Object.hasOwn(names,k)));
const defaults={a:false,b:false,top:false,bottom:false,left:false,back:false,bag:false,
 bagOpen:false,bagSolved:false,door:false,doorOpen:false,barked:false,squirrel:false,
 vase:false,plant:false,tree:false,cloud:false,music:false,watch:false,machine:false,
 cup:false,moon:false,mouse:false,tag:false,kite:false,drawerTaken:false,sideTaken:false,pipeTaken:false,ringTaken:false};
const s={...defaults};
for(const k of Object.keys(defaults))if(typeof raw[k]==='boolean')s[k]=raw[k];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
s.topHits=clamp(Number(raw.topHits)||0,0,12);
s.redHits=clamp(Number(raw.redHits)||0,0,30);
s.dogHits=clamp(Number(raw.dogHits)||0,0,12);
s.bagDials=Array.isArray(raw.bagDials)&&raw.bagDials.length===3?raw.bagDials.map(x=>clamp(Number(x)||0,0,3)):[0,0,0];
s.fluteNotes=Array.isArray(raw.fluteNotes)?raw.fluteNotes.filter(x=>Number.isInteger(x)&&x>=1&&x<=3).slice(-3):[];
s.rx=clamp(Number.isFinite(raw.rx)?raw.rx:-18,-4000,4000);
s.ry=clamp(Number.isFinite(raw.ry)?raw.ry:-24,-4000,4000);
let selected=null,previousFocus=null,panel=null,dragging=false,dragMoved=false,dragStart=null,blockedClick=false;
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
  pocket.add(id);if(message)tell(message);render();flyToPocket(id,origin);
 }
}
function spend(id){if(!pocket.has(id))return false;pocket.delete(id);if(selected===id)selected=null;return true}
function turn(){ $('ncCube').style.transform='rotateX('+s.rx+'deg) rotateY('+s.ry+'deg)';store(); }
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
 const from=origin?.getBoundingClientRect?.()||$('ncCube').getBoundingClientRect();
 if(!dest||!from)return;
 const node=document.createElement('div');node.className='nc-inventory-fly';
 node.textContent=glyphs[id]||'✧';
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
 $('ncDrawerA')?.classList.toggle('nc-emptied',s.drawerTaken);
 $('ncDrawerB')?.classList.toggle('nc-emptied',s.sideTaken);
 $('ncLid')?.classList.toggle('nc-emptied',s.pipeTaken);
 $('ncDoorScene').hidden=!s.door;
 $('ncDoorPlace').hidden=!s.doorOpen;
 if($('ncDoor'))$('ncDoor').classList.toggle('nc-door-open',s.doorOpen);
 for(const [name,on] of Object.entries({
 bag:s.bag, vase:s.doorOpen, squirrel:s.squirrel&&(!s.barked||fleeing),
 pot:s.vase, musicbox:s.vase, cloud:s.cloud,
 cup:s.music,clock:s.watch,machine:s.mouse
 })){const node=prop(name);if(node)node.hidden=!on}
 let str=[...pocket].map(id=>'<button type="button" class="nc-item'+(id===selected?' nc-selected':'')+
   (selected&&id!==selected&&recipe[sorted(selected,id)]?' nc-valid':'')+
   '" data-item="'+id+'" aria-pressed="'+String(selected===id)+'" draggable="true"><span aria-hidden="true">'+glyphs[id]+'</span>'+
   names[id]+'</button>').join('');
 $('ncInventory').innerHTML=str||'<span class="nc-empty">Nothing. Yet.</span>';
 $('ncUnselect').hidden=!selected;
 document.querySelectorAll('[data-thing]').forEach(node=>{
  node.classList.toggle('nc-receptive',!!selected&&accepts(selected,node.dataset.thing));
 });
 store();
}
function collection(id){gain(id,'You found '+names[id]+'.')}
function cubeHit(name){
 bloom('first');
 if(name==='latch'){
  if(!s.a){s.a=true;bloom('drawer','A drawer slides straight out of a wall that cannot contain drawers.')}
  else tell(s.drawerTaken?'This tiny drawer is empty now.':'There is a strange, key-shaped piece inside.');
 }else if(name==='drawer-a'){
  if(!s.drawerTaken){s.drawerTaken=true;collection('tooth');tell('The teeth of something that once opened a lock.')}
 }else if(name==='seam'){
  if(!s.b){s.b=true;bloom('thread','A horizontal compartment seems to have been there all along.')}
  else tell(s.sideTaken?'Only a loose red fiber remains.':'That is definitely a spool of thread.');
 }else if(name==='drawer-b'){
  if(!s.sideTaken){s.sideTaken=true;collection('thread');tell('It is red thread. It refuses to explain itself.')}
 }else if(name==='triangle'){
  s.topHits++;
  if(s.topHits>=3&&!s.top){s.top=true;bloom('pipe','A lid rises. There is something that looks like a flute before it became a flute.')}
  else tell(s.top?'Something hollow lies under the lid.':'The triangle clicks. '+(3-s.topHits)+' more?');
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
 ||item==='bell'&&thing==='dog'&&s.doorOpen;
}
function use(item,thing){
 if(!pocket.has(item)||!accepts(item,thing))return false;
 selected=null;
 if(item==='key'&&thing==='bag'){
  spend('key');s.bagOpen=true;
  tell('The key fits the bag. Its inside is bigger than its outside.');openBag();
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
 return true;
}
function take(item){
 if(!pocket.has(item))return;
 if(!selected){selected=item;tell('Holding '+names[item]+'. Choose another pocket item or an object in the world.');render();return}
 if(item===selected){selected=null;render();return}
 const result=recipe[sorted(selected,item)];
 if(!result){selected=null;tell('Those have no business being combined. Neither was used up.');sound(185);render();return}
 spend(selected);spend(item);gain(result[0],result[2]);selected=null;bloom(result[1],result[2]);render();
}
function openBag(){
 if(!s.bagOpen){tell('The bag is locked. Its little brass keyhole seems very specific.');return}
 const sym=['○','✳','◇','☾'];
 modal('INSIDE THE BAG',s.bagSolved?'A suspicious lining':'The three hidden wheels',
  '<p>Three small wheels are sewn into the lining. A faded stitch reads: <strong>DIAMOND · CIRCLE · MOON.</strong></p>'+ 
  '<div class="nc-bag-interior" id="ncBagInterior"><div class="nc-bag-wheels">'+[0,1,2].map(i=>'<button class="nc-dial" type="button" data-dial="'+i+'" aria-label="Turn wheel '+(i+1)+'">'+sym[s.bagDials[i]]+'</button>').join('')+'</div>'+
  '</div><p class="nc-modal-note" id="ncBagNote">'+(s.bagSolved?'The false bottom has already opened.':'These are not ordinary luggage wheels.')+'</p>','bag');
}
function turnBag(i){
 if(s.bagSolved)return;
 s.bagDials[i]=(s.bagDials[i]+1)%4;
 document.querySelector('[data-dial="'+i+'"]').textContent=['○','✳','◇','☾'][s.bagDials[i]];
 if(s.bagDials.join('')==='203'){
  s.bagSolved=true;gain('reed');gain('treat');gain('prism');
  bloom('bag-code','Under the false bottom: a reed, a biscuit and a glass prism.');
  $('ncBagNote').textContent='A tiny false bottom has opened. Its contents are in your pocket.';
  cue('ncBagInterior','nc-unlatched',1100);scatter('#d2b5a1',13,document.querySelector('#ncBagInterior'));
  incident('✳');
 }else sound(350+i*50);
 store();
}
function openFlute(){
 s.fluteNotes=[];
 modal('A VERY UNNECESSARY INSTRUMENT','The flute',
  '<p>It has three holes. Every breath becomes a different note.</p><div class="nc-flute-model" id="ncFluteModel"><span></span><span></span><span></span></div><div class="nc-flute-keys">'+
  [1,2,3].map(i=>'<button type="button" data-note="'+i+'" aria-label="Blow flute note '+i+'">'+i+'</button>').join('')+
  '</div><div class="nc-flute-track" id="ncFluteTrack">♪  ·  ·  ·</div>', 'flute');
}
function note(i){
 s.fluteNotes.push(i);s.fluteNotes=s.fluteNotes.slice(-3);sound(390+i*135);
 cue('ncFluteModel','nc-playing',380);floatNote($('ncFluteModel'));
 $('ncFluteTrack').textContent='♪  '+s.fluteNotes.map(n=>['Ⅰ','Ⅱ','Ⅲ'][n-1]).join('  ');
 if(s.fluteNotes.join('')==='213'){
  if(!s.door){
    s.door=true;bloom('door','The flute has summoned a very real door from an extremely empty wall.');
    cue('ncDoorScene','nc-arriving',1430);cue('ncWorld','nc-shudder',430);scatter('#e5c8aa',12,$('ncDoorScene'));
   }
  else tell('The door recognizes that tune.');
  closeModal();setTimeout(()=>$('ncDoorScene').scrollIntoView({behavior:'smooth',block:'nearest'}),80);
 }else if(s.fluteNotes.length===3){
  $('ncFluteTrack').textContent+='  ...nothing.';
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
 }else if(s.dogHits<3)tell('The dog likes that. Keep petting.');
 else tell('The dog is now very proud of itself.');
 render();
}
function clickThing(name){
 if(selected){
  if(use(selected,name))return;
  tell('That '+names[selected]+' will not help here.');selected=null;render();return;
 }
 bloom('first');
 if(name==='bag')openBag();
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
  modal('CLOCK DEPARTMENT','4:17','<p>Nothing is wrong with this clock. It just refuses to acknowledge the existence of other times.</p>','clock');
 }else if(name==='machine')tell('INSERT COIN. It is remarkably confident.');
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
  '<p>Drag the cube to rotate it. Arrow keys also work. Try touching specific spots, even the ones that seem like decorations.</p>'+
  '<p>Some things you find can be used on other things. Select an item from your pocket to see what accepts it. Two pocket items only combine when they are actually compatible.</p>'+
  '<p>There are no levels. Things will happen without permission. Progress saves on this device.</p>','info');
}
function hit(e){
 const el=e.target.closest('[data-hit]');if(!el||!$('ncCube').contains(el))return;
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
 if(blockedClick){e.stopImmediatePropagation();e.preventDefault();blockedClick=false;return}
 // The engraved square is a real touch target, also usable by keyboard.
 if(selected&&e.target.closest('[data-thing="cube"]')){
  if(!use(selected,'cube')){tell('The cube refuses that offering.');selected=null;render();}
  e.stopPropagation();return;
 }
 if(selected&&!e.target.closest('button,[data-hit]')){
  if(use(selected,'cube')){e.stopPropagation();return}
  tell('The cube refuses that offering.');selected=null;render();
 }
},true);
$('ncModalBody').addEventListener('click',e=>{
 const dial=e.target.closest('[data-dial]');if(dial&&panel==='bag'){turnBag(Number(dial.dataset.dial));return}
 const noteEl=e.target.closest('[data-note]');if(noteEl&&panel==='flute'){note(Number(noteEl.dataset.note));return}
});
let draggingStart=null;
$('ncCubeZone').addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('.nc-rotate-controls'))return;
 draggingStart={x:e.clientX,y:e.clientY,rx:s.rx,ry:s.ry};
 dragMoved=false;dragging=true;
 $('ncCubeZone').classList.add('nc-dragging');
});
window.addEventListener('pointermove',e=>{
 if(!dragging||!draggingStart)return;
 const dx=e.clientX-draggingStart.x,dy=e.clientY-draggingStart.y;
 if(Math.abs(dx)+Math.abs(dy)>8)dragMoved=true;
 if(!dragMoved)return;
 s.ry=draggingStart.ry+dx*.48;
 s.rx=clamp(draggingStart.rx-dy*.48,-85,85);
 turn();
});
window.addEventListener('pointerup',()=>{
 if(!dragging)return;
 dragging=false;$('ncCubeZone').classList.remove('nc-dragging');
 if(dragMoved){blockedClick=true;setTimeout(()=>blockedClick=false,130)}
 draggingStart=null;
});
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
window.CriloNothingHereCube={getState:()=>({...s,pocket:[...pocket],seen:[...seen]}),rotate:(x,y)=>{s.rx=x;s.ry=y;turn()}};
})();