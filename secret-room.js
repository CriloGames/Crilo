/* NOTHING HERE. White-page curiosity playground.
   Independent of authentication, Daily, and older crilo_nothing_here_secrets_v1 saves. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
if(!$('nhField')||!$('nhOverlay'))return;
const STORAGE='crilo_nothing_here_playground_v2';
const LEGACY='crilo_nothing_here_secrets_v1'; // intentionally untouched
const SECRETS=[
 ['curious','Well, something happened.','Touch anything at all.'],
 ['button','You pressed it.','There is an obvious button.'],
 ['impatient','Five is a lot.','Maybe press the button some more.'],
 ['obsession','Twelve times?','Nobody asked you to press it twelve times.'],
 ['egg','A tiny crack.','Try the egg more than once.'],
 ['duck','What have you done?','Stay with the egg.'],
 ['feather','Soft evidence.','A cracked egg has its rewards.'],
 ['switch','Let there be something.','Something has an on/off switch.'],
 ['sunbeam','A pocketful of light.','A switch can give more than light.'],
 ['letter','Private mail.','An envelope wants opening.'],
 ['clock','4:17 forever.','Touch the clock.'],
 ['rewind','Borrowed a minute.','Time might need a new gear.'],
 ['dice','Chance encounter.','Some things are better rolled.'],
 ['lucky','Rent money.','Roll the dice enough.'],
 ['melody','The song that fits.','Memorize four colors.'],
 ['labyrinth','A tiny escape.','Find the far corner of a tiny maze.'],
 ['dot','Uncatchable?','Catch the dot five times.'],
 ['paint','Color theory.','Find the little paint kit.'],
 ['mint','Blue meets yellow.','Which two paints make green?'],
 ['violet','Red meets blue.','Which two paints make violet?'],
 ['seed','A beginning.','Inspect a packet of seeds.'],
 ['water','A glass half useful.','Collect a little water.'],
 ['pencil','Actually useful.','Take the pencil.'],
 ['magnet','Attraction.','Find a magnet.'],
 ['safe','Three little digits.','An old clock can help a safe.'],
 ['planted','Something green.','Seeds need water, then a home.'],
 ['bloom','It needed light.','A growing plant might need sunshine.'],
 ['spark','A reasonable circuit.','Batteries and wires get along.'],
 ['launched','Goodbye, rocket.','Rockets like energy.'],
 ['fuel','Machine food.','Machines like coins.'],
 ['key','Two become one.','A key is sometimes made of two pieces.'],
 ['open-door','Not a wall.','The door expects a proper key.'],
 ['mirror','Hello, you.','Something beyond the door looks back.'],
 ['cloud','Pocket weather.','Clouds are not always far away.'],
 ['stars','Three is a pattern.','Three stars are close together.'],
 ['mail','Sent to nobody.','An unusual envelope may have an address.'],
 ['ball','Bounce bounce bounce.','Try the ball three times.'],
 ['lever','One more time.','Pull a suspicious lever three times.'],
 ['compass','Nowhere north.','Magnetize a needle.'],
 ['map','A route to nowhere.','What can you do with paper and pencil?'],
 ['airmail','Air postage.','A feather could help a letter fly.'],
 ['title','Untrue advertising.','The title is a button.'],
 ['journal','Keeping tabs.','Check what you have found.'],
 ['hints','A hint inside a hint.','Ask for a nudge three times.']
];
const secretMap=new Map(SECRETS.map(x=>[x[0],x]));
const itemNames={
 battery:'BATTERY',wire:'WIRE',feather:'FEATHER',paper:'PAPER',gear:'CLOCK GEAR',
 seed:'SEED',water:'WATER',sprout:'SPROUT',sunbeam:'SUNBEAM',
 pencil:'PENCIL',magnet:'MAGNET',needle:'NEEDLE',coin:'COIN',
 shaft:'KEY HANDLE',tooth:'KEY TEETH',key:'BRASS KEY',
 spark:'SPARK',fuel:'ROCKET FUEL',green:'GREEN PAINT',purple:'PURPLE PAINT',
 compass:'COMPASS',map:'HAND-DRAWN MAP',airmail:'AIRMAIL'
};
const itemGlyphs={
 battery:'▣',wire:'⌁',feather:'〳',paper:'▤',gear:'⚙',seed:'✳',water:'◕',sprout:'♧',
 sunbeam:'☼',pencil:'✎',magnet:'∩',needle:'⌁',coin:'◉',shaft:'╷',tooth:'⌗',
 key:'⚿',spark:'✦',fuel:'◈',green:'●',purple:'●',compass:'⌖',map:'◇',airmail:'✉'
};
const RECIPES={
 'seed+water':['sprout',null,'A tiny stem is forming. Find somewhere to plant it.'],
 'battery+wire':['spark','spark','A tiny, friendly bolt of electricity.'],
 'shaft+tooth':['key','key','Two unrelated-looking pieces made a perfect key.'],
 'magnet+needle':['compass','compass','It points somewhere that isn\'t north.'],
 'paper+pencil':['map','map','You have drawn a map of a place that does not exist.'],
 'feather+paper':['airmail','airmail','Your letter has wings.']
};
const pair=(a,b)=>[a,b].sort().join('+');
let stored={};
try{stored=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{}}catch{}
const found=new Set((Array.isArray(stored.found)?stored.found:[]).filter(x=>secretMap.has(x)));
const inventory=new Set((Array.isArray(stored.inventory)?stored.inventory:[]).filter(x=>Object.hasOwn(itemNames,x)));
let state={
 presses:Math.max(0,Math.min(50,Number(stored.presses)||0)),
 egg:Math.max(0,Math.min(20,Number(stored.egg)||0)),
 clock:Math.max(0,Math.min(30,Number(stored.clock)||0)),
 dice:Math.max(0,Math.min(40,Number(stored.dice)||0)),
 light:stored.light===true,planted:stored.planted===true,bloom:stored.bloom===true,
 launched:stored.launched===true,door:stored.door===true,
 ball:Math.max(0,Math.min(10,Number(stored.ball)||0)),
 lever:Math.max(0,Math.min(10,Number(stored.lever)||0)),
 stars:Math.max(0,Math.min(10,Number(stored.stars)||0)),
 memory:stored.memory===true,maze:stored.maze===true,dot:stored.dot===true,
 green:stored.green===true,purple:stored.purple===true,
 hints:Math.max(0,Math.min(30,Number(stored.hints)||0)),
 title:Math.max(0,Math.min(10,Number(stored.title)||0))
};
let selected=null,activePanel=null,previousFocus=null,toastTimer=null;
let memoryIndex=0,memoryPlaying=false,dotHits=0,mazePosition=0,paintFirst=null;
const memoryCode=[0,2,1,3];
const mazeWalls=new Set([5,6,13]);
const clean=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
function save(){
 try{localStorage.setItem(STORAGE,JSON.stringify({...state,found:[...found],inventory:[...inventory]}))}catch{}
}
function status(message){
 $('nhMessage').textContent=message;
}
function beep(n=480){
 try{
  const A=window.AudioContext||window.webkitAudioContext;
  if(!A)return;
  if(!beep.context)beep.context=new A();
  const c=beep.context;
  if(c.state==='suspended')c.resume();
  const o=c.createOscillator(),g=c.createGain();
  o.frequency.value=n;o.type='sine';g.gain.setValueAtTime(.02,c.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.1);
  o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.11);
 }catch{}
}
function discover(id,message){
 if(!secretMap.has(id)||found.has(id))return;
 found.add(id);
 const name=secretMap.get(id)[1];
 const toast=$('nhToast');toast.innerHTML='<span>✳</span><strong>'+clean(name)+'</strong>';
 toast.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2300);
 status(message||name);beep(550+found.size*5);sync();
}
function item(id){
 if(!Object.hasOwn(itemNames,id))return;
 if(!inventory.has(id)){inventory.add(id);status('Pocketed: '+itemNames[id].toLowerCase()+'.');sync()}
}
function use(id){
 if(!inventory.has(id))return false;
 inventory.delete(id);if(selected===id)selected=null;return true;
}
function sync(){
 $('nhCount').textContent=found.size+' / '+SECRETS.length;
 $('nhPocketCount').textContent=inventory.size;
 $('nhExtra').hidden=!state.door;
 document.body.classList.toggle('nh-door-open',state.door);
 document.body.classList.toggle('nh-light-on',state.light);
 document.body.classList.toggle('nh-egg-cracked',state.egg>=3);
 document.body.classList.toggle('nh-duck-hatched',state.egg>=7);
 document.body.classList.toggle('nh-plant-grown',state.planted);
 document.body.classList.toggle('nh-plant-bloomed',state.bloom);
 document.body.classList.toggle('nh-rocket-launched',state.launched);
 document.body.classList.toggle('nh-button-tired',state.presses>=12);
 const growth=$('nhPotGrowth');growth.textContent=state.bloom?'✿':state.planted?'♧':'';
 $('nhDieOne').textContent=['⚀','⚁','⚂','⚃','⚄','⚅'][state.dice%6];
 $('nhDieTwo').textContent=['⚂','⚃','⚄','⚅','⚀','⚁'][(state.dice*2)%6];
 const wrapper=$('nhInventory');
 wrapper.innerHTML=inventory.size?[...inventory].map(id=>
  '<button type="button" draggable="true" data-item="'+id+'" class="nh-item'+(selected===id?' nh-selected':'')+
  (selected&&(RECIPES[pair(selected,id)]&&selected!==id)?' nh-compatible':'')+
  '" aria-pressed="'+String(selected===id)+'" title="'+clean(itemNames[id])+'">'+
  '<span class="nh-item-glyph" aria-hidden="true">'+itemGlyphs[id]+'</span>'+itemNames[id]+'</button>').join(''):
  '<p class="nh-pocket-empty">Nothing in your pockets. Yet.</p>';
 $('nhClearSelection').hidden=!selected;
 for(const toy of document.querySelectorAll('[data-toy]')){
  const id=toy.dataset.toy;
  toy.classList.toggle('nh-target',!!selected&&canApply(selected,id));
 }
 save();
}
function show(title,body,which='misc'){
 activePanel=which;previousFocus=document.activeElement;
 $('nhDialogKicker').textContent=which==='info'?'not really instructions':'a small distraction';
 $('nhDialogTitle').textContent=title;
 $('nhDialogBody').innerHTML=body;
 $('nhOverlay').hidden=false;
 $('gameInfoBtn')?.setAttribute('aria-expanded',String(which==='info'));
 $('nhClose').focus();
}
function hide(){
 if($('nhOverlay').hidden)return;
 $('nhOverlay').hidden=true;activePanel=null;memoryPlaying=false;
 $('gameInfoBtn')?.setAttribute('aria-expanded','false');
 if(previousFocus?.isConnected)previousFocus.focus();
}
function canApply(id,target){
 if(id==='sprout'&&target==='pot'&&!state.planted)return true;
 if(id==='sunbeam'&&target==='pot'&&state.planted&&!state.bloom)return true;
 if(id==='gear'&&target==='clock')return true;
 if((id==='spark'||id==='fuel')&&target==='rocket'&&!state.launched)return true;
 if(id==='coin'&&target==='vending')return true;
 if(id==='key'&&target==='door'&&!state.door)return true;
 if(id==='airmail'&&target==='mailbox'&&state.door)return true;
 if(id==='compass'&&target==='stars'&&state.door)return true;
 if(id==='purple'&&target==='mirror'&&state.door)return true;
 if(id==='green'&&target==='pot'&&state.planted)return true;
 return false;
}
function apply(id,target){
 if(!inventory.has(id)||!canApply(id,target))return false;
 use(id);
 if(id==='sprout'){state.planted=true;discover('planted','Something is growing in the pot.');}
 else if(id==='sunbeam'){state.bloom=true;discover('bloom','The flower opened like a small sunrise.');}
 else if(id==='gear'){discover('rewind','The hands spun backwards, but the clock stayed at 4:17.');}
 else if(id==='spark'||id==='fuel'){
  state.launched=true;document.querySelector('[data-toy="rocket"]')?.classList.add('nh-takeoff');
  discover('launched','The rocket has left this very ordinary page.');
 }else if(id==='coin'){item('fuel');discover('fuel','The vending machine dispensed rocket fuel. Of course.');}
 else if(id==='key'){
  state.door=true;discover('open-door','Another group of objects appeared below the page.');
  requestAnimationFrame(()=>setTimeout(()=>$('nhExtra').scrollIntoView({behavior:'smooth',block:'center'}),250));
 }else if(id==='airmail')discover('mail','A letter for nobody has been delivered.');
 else if(id==='compass')discover('stars','The stars connected into a tiny constellation.');
 else if(id==='purple')discover('mirror','Your reflection turned lavender.');
 else if(id==='green'){state.bloom=true;discover('bloom','The flower has taken on a fresh color.');}
 status('Those two belong together.');selected=null;sync();return true;
}
function combine(a,b){
 if(a===b){selected=null;sync();return}
 const recipe=RECIPES[pair(a,b)];
 if(!recipe){
  status('Nope. Those two do not fit together.');beep(210);
  // No item is consumed when a combination is invalid.
  selected=null;sync();return;
 }
 if(!inventory.has(a)||!inventory.has(b))return;
 use(a);use(b);item(recipe[0]);selected=null;
 if(recipe[1])discover(recipe[1],recipe[2]);
 else status(recipe[2]);
 sync();
}
function selectItem(id){
 if(!inventory.has(id))return;
 if(!selected){selected=id;status('Holding '+itemNames[id].toLowerCase()+'. What might it go with?');sync();return}
 combine(selected,id);
}
function ordinary(id){
 if(selected){
  if(apply(selected,id))return;
  status('The '+itemNames[selected].toLowerCase()+' does not go there.');
  selected=null;sync();return;
 }
 discover('curious');
 switch(id){
  case 'button':
   state.presses++;discover('button','Click.');beep(200+state.presses*30);
   if(state.presses===5){discover('impatient','The button has produced a battery.');item('battery')}
   if(state.presses===12)discover('obsession','The button would like a holiday.');
   if(state.presses>12)status('It still works. It just sighs now.');
   break;
  case 'egg':
   state.egg++;if(state.egg===3){discover('egg','A tiny crack appeared.');discover('feather');item('feather')}
   if(state.egg===7)discover('duck','A tiny duck stares at you. It looks familiar.');
   if(state.egg<3)status('...tap tap...');
   else if(state.egg<7)status('Something inside is counting.');
   else status('peep.');
   break;
  case 'switch':
   state.light=!state.light;
   discover('switch');
   if(state.light){item('sunbeam');discover('sunbeam','You caught a piece of the light.')}
   else status('The switch is off. The page stays white anyway.');
   break;
  case 'envelope':discover('letter','The note reads: THE TIME IS 4:17.');item('paper');break;
  case 'clock':
   state.clock++;discover('clock','Four seventeen.');if(state.clock===4)item('gear');
   if(state.clock>=17)discover('rewind','Time is a little tired.');
   else if(state.clock>=4)status('A little clock gear came loose.');
   break;
  case 'dice':
   state.dice++;discover('dice','What were you expecting?');
   if(state.dice===6){item('coin');discover('lucky','Six rolls earned you an actual coin.')}
   else status('The dice are not very good at randomness.');
   break;
  case 'record':openMemory();break;
  case 'maze':openMaze();break;
  case 'dot':openDot();break;
  case 'colors':openPaint();break;
  case 'seedbag':item('seed');discover('seed');break;
  case 'faucet':item('water');discover('water');break;
  case 'pot':status(state.bloom?'A little flower is very pleased.':state.planted?'Growing things still need light.':'It is a perfectly empty pot.');break;
  case 'pencil':item('pencil');discover('pencil');break;
  case 'magnet':item('magnet');discover('magnet');break;
  case 'safe':openSafe();break;
  case 'rocket':status(state.launched?'It has been replaced with a cardboard cutout.':'The rocket looks very underpowered.');break;
  case 'vending':status('INSERT COIN. It is very strict about this.');break;
  case 'door':status(state.door?'This door has already let you through.':'Locked. A brass key would help.');break;
  case 'mirror':discover('mirror','That reflection looks slightly disappointed.');break;
  case 'cloud':discover('cloud','The cloud squeezed out a drop of rain.');item('water');break;
  case 'stars':state.stars++;if(state.stars>=3)discover('stars','The stars lined up all by themselves.');else status('A star winked.');break;
  case 'mailbox':status(found.has('mail')?'The letter has already flown away.':'The mailbox is suspiciously empty.');break;
  case 'ball':state.ball++;if(state.ball>=3)discover('ball','The third bounce was the highest.');else status('boing.');break;
  case 'lever':state.lever++;if(state.lever>=3)discover('lever','You pulled the lever. Absolutely nothing exploded.');else status('Ka-chunk.');break;
 }
 sync();
}
function openMemory(){
 memoryIndex=0;memoryPlaying=false;
 show('Four little notes',
  '<p class="nh-panel-copy">Watch the buttons. Then repeat their order.</p>'+
  '<div class="nh-memory" id="nhMemory">'+[0,1,2,3].map(i=>
   '<button type="button" data-pad="'+i+'" class="nh-pad nh-pad-'+i+'" aria-label="Note '+(i+1)+'"></button>').join('')+'</div>'+
  '<button type="button" class="nh-action" data-mini="replay">SHOW ME THE NOTES</button>'+
  '<p id="nhMemoryStatus" class="nh-panel-feedback">Press SHOW ME THE NOTES to begin.</p>', 'memory');
}
function playMemory(){
 if(memoryPlaying)return;
 memoryPlaying=true;memoryIndex=0;
 $('nhMemoryStatus').textContent='Watch closely...';
 const pads=[...document.querySelectorAll('[data-pad]')];
 for(let i=0;i<memoryCode.length;i++){
  setTimeout(()=>{
   if(activePanel!=='memory')return;
   const pad=pads[memoryCode[i]];pad?.classList.add('nh-lit');beep(290+memoryCode[i]*120);
   setTimeout(()=>pad?.classList.remove('nh-lit'),400);
  },i*650+350);
 }
 setTimeout(()=>{if(activePanel==='memory'){memoryPlaying=false;$('nhMemoryStatus').textContent='Your turn. Four notes.';}},memoryCode.length*650+400);
}
function memoryTap(n){
 if(memoryPlaying)return;
 if(n!==memoryCode[memoryIndex]){
  memoryIndex=0;$('nhMemoryStatus').textContent='Not quite. Try the melody again.';beep(190);return;
 }
 memoryIndex++;beep(330+n*125);
 $('nhMemoryStatus').textContent=memoryIndex+' / 4';
 if(memoryIndex===4){state.memory=true;item('wire');discover('melody','That melody unlocked a little wire.');$('nhMemoryStatus').textContent='Perfect. A wire has appeared in your pocket.';sync()}
}
function openMaze(){
 mazePosition=0;show('The smallest maze',
  '<p class="nh-panel-copy">Move the dot to the other corner. Walls are real.</p>'+
  '<div id="nhMazeGrid" class="nh-maze-grid"></div>'+
  '<div class="nh-arrows"><button data-move="up" aria-label="Up">↑</button><button data-move="left" aria-label="Left">←</button><button data-move="down" aria-label="Down">↓</button><button data-move="right" aria-label="Right">→</button></div>'+
  '<p id="nhMazeStatus" class="nh-panel-feedback">Arrow keys work too.</p>', 'maze');
 paintMaze();
}
function paintMaze(){
 const grid=$('nhMazeGrid');if(!grid)return;
 grid.innerHTML=Array.from({length:16},(_,n)=>
  '<span class="nh-maze-cell'+(mazeWalls.has(n)?' nh-wall':'')+(mazePosition===n?' nh-player':'')+(n===15?' nh-finish':'')+'">'+
  (mazePosition===n?'●':n===15?'✳':'')+'</span>').join('');
}
function moveMaze(dir){
 const x=mazePosition%4,y=Math.floor(mazePosition/4);
 let nx=x,ny=y;if(dir==='up')ny--;if(dir==='down')ny++;if(dir==='left')nx--;if(dir==='right')nx++;
 if(nx<0||nx>3||ny<0||ny>3||mazeWalls.has(ny*4+nx)){beep(160);return}
 mazePosition=ny*4+nx;paintMaze();beep(370);
 if(mazePosition===15){state.maze=true;item('tooth');discover('labyrinth','You found half a key in the exit.');$('nhMazeStatus').textContent='Escaped! You found a piece of a key.';sync()}
}
function openDot(){
 dotHits=0;show('Catch that dot',
  '<p class="nh-panel-copy">Five catches. No timer.</p><div class="nh-dot-field" id="nhDotField"><button type="button" id="nhMovingDot" data-mini="catch" aria-label="Catch the moving dot"></button></div>'+
  '<p id="nhDotStatus" class="nh-panel-feedback">0 / 5</p>', 'dot');
 positionDot();
}
const dotPositions=[[15,55],[73,30],[42,72],[81,69],[28,25],[50,45]];
function positionDot(){
 const dot=$('nhMovingDot');if(!dot)return;const p=dotPositions[dotHits%dotPositions.length];
 dot.style.left=p[0]+'%';dot.style.top=p[1]+'%';
}
function catchDot(){
 dotHits++;beep(400+dotHits*70);
 $('nhDotStatus').textContent=Math.min(dotHits,5)+' / 5';
 if(dotHits===5){state.dot=true;item('needle');discover('dot','The dot left a very small needle behind.');$('nhDotStatus').textContent='You win. The dot is exhausted.';sync();return}
 positionDot();
}
function openPaint(){
 paintFirst=null;
 show('Mixing is allowed',
  '<p class="nh-panel-copy">Only certain color pairs become something useful.</p>'+
  '<div class="nh-paint-pots"><button data-color="red">RED</button><button data-color="blue">BLUE</button><button data-color="yellow">YELLOW</button></div>'+
  '<div class="nh-paint-preview" id="nhPaintStatus">Choose two colors.</div>', 'colors');
 discover('paint');
}
function mixPaint(color){
 if(!paintFirst){
  paintFirst=color;$('nhPaintStatus').textContent=color.toUpperCase()+' + ?';return;
 }
 const pairKey=pair(paintFirst,color);paintFirst=null;
 if(pairKey==='blue+yellow'){
  state.green=true;item('green');discover('mint','A pleasing shade of green.');$('nhPaintStatus').textContent='GREEN PAINT. Pocketed.';
 }else if(pairKey==='blue+red'){
  state.purple=true;item('purple');discover('violet','A very satisfying purple.');$('nhPaintStatus').textContent='PURPLE PAINT. Pocketed.';
 }else{$('nhPaintStatus').textContent='Not that pair. Try something else.';beep(200)}
 sync();
}
function openSafe(){
 discover('safe');
 show('A tiny locked safe',
  '<p class="nh-panel-copy">Three digits. Somewhere nearby, time has stopped.</p>'+
  '<form id="nhSafeForm"><label for="nhSafeInput">COMBINATION</label><input id="nhSafeInput" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" autocomplete="off" required placeholder="_ _ _">'+
  '<button type="submit" class="nh-action">UNLOCK</button></form><p id="nhSafeStatus" class="nh-panel-feedback"></p>', 'safe');
 $('nhSafeInput').focus();
}
function openJournal(){
 discover('journal');
 const entries=SECRETS.map(([id,name,hint],index)=>{
  const got=found.has(id);
  return '<div class="nh-journal-entry"><span>'+String(index+1).padStart(2,'0')+'</span><div><b>'+
  (got?clean(name):'???')+'</b><small>'+(got?'discovered':'not found yet')+'</small></div></div>';
 }).join('');
 show('Things you stumbled upon',
  '<p class="nh-panel-copy">'+found.size+' of '+SECRETS.length+'. Everything here can be found without guessing a random combination.</p>'+
  '<div class="nh-journal-list">'+entries+'</div>'+
  '<button type="button" class="nh-reset-link" data-mini="reset">start this playground over</button>', 'journal');
}
function openHints(){
 state.hints++;if(state.hints>=3)discover('hints');
 const missing=SECRETS.find(x=>!found.has(x[0]));
 show('One small nudge',
  '<p class="nh-hint-line">'+(missing?clean(missing[2]):'There are no hints left. Somehow.')+'</p>'+
  '<button type="button" class="nh-action" data-mini="next-hint">ANOTHER NUDGE →</button>', 'hints');
 sync();
}
function openInfo(){
 show('There are no rules',
  '<p class="nh-panel-copy">Click the strange things on the white page. Some open tiny games, some leave objects in your pocket, and some simply do something unexpected.</p>'+
  '<p class="nh-panel-copy">To combine two objects, tap one pocket item and then another. You can also drag it onto a compatible item. To use one on the page, select it and click an object with the dotted outline.</p>'+
  '<p class="nh-panel-copy">Only combinations that make sense in this little world work. Wrong combinations never consume items. Progress saves on this device.</p>', 'info');
}
document.addEventListener('click',event=>{
 const mini=event.target.closest('[data-mini]');
 if(mini&&$('nhOverlay').contains(mini)){
  const cmd=mini.dataset.mini;
  if(cmd==='replay')playMemory();
  if(cmd==='catch'&&dotHits<5)catchDot();
  if(cmd==='next-hint'){hide();openHints()}
  if(cmd==='reset')show('Start over?', '<p class="nh-panel-copy">Only this new playground will reset. Your earlier 70-secret game data is kept separately.</p><button data-mini="confirm-reset" class="nh-action">YES, RESET PLAYGROUND</button>', 'reset');
  if(cmd==='confirm-reset'){localStorage.removeItem(STORAGE);location.reload()}
  return;
 }
 const pad=event.target.closest('[data-pad]');
 if(pad&&activePanel==='memory'){memoryTap(Number(pad.dataset.pad));return}
 const move=event.target.closest('[data-move]');
 if(move&&activePanel==='maze'){moveMaze(move.dataset.move);return}
 const color=event.target.closest('[data-color]');
 if(color&&activePanel==='colors'){mixPaint(color.dataset.color);return}
 if(!$('nhOverlay').hidden)return;
 const chip=event.target.closest('[data-item]');
 if(chip&&$('nhInventory').contains(chip)){selectItem(chip.dataset.item);return}
 const toy=event.target.closest('[data-toy]');
 if(toy&&($('nhField').contains(toy)||$('nhExtra').contains(toy))){
  ordinary(toy.dataset.toy);return;
 }
});
$('nhTitle').addEventListener('click',()=>{
 state.title++;if(state.title>=3)discover('title','The title is the first lie.');else status('There is definitely something here.');
 sync();
});
$('nhJournalBtn').addEventListener('click',openJournal);
$('nhHintBtn').addEventListener('click',openHints);
$('gameInfoBtn')?.addEventListener('click',openInfo);
$('nhClearSelection').addEventListener('click',()=>{selected=null;status('Put it down.');sync()});
$('nhClose').addEventListener('click',hide);
$('nhOverlay').addEventListener('click',e=>{if(e.target===$('nhOverlay'))hide()});
$('nhOverlay').addEventListener('submit',e=>{
 if(e.target.id!=='nhSafeForm')return;
 e.preventDefault();
 if($('nhSafeInput').value.trim()!=='417'){$('nhSafeStatus').textContent='No click. Still locked.';beep(190);return}
 $('nhSafeStatus').textContent='Click! There was a key handle inside.';
 item('shaft');status('You opened the safe and took the key handle.');
});
document.addEventListener('keydown',event=>{
 if(!$('nhOverlay').hidden){
  if(event.key==='Escape'){event.preventDefault();hide();return}
  if(activePanel==='maze'&&/^Arrow/.test(event.key)){
   event.preventDefault();moveMaze(event.key.slice(5).toLowerCase());return;
  }
  if(event.key==='Tab'){
   const focusable=[...$('nhOverlay').querySelectorAll('button,input,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);
   const first=focusable[0],last=focusable[focusable.length-1];
   if(first&&(event.shiftKey?document.activeElement===first:document.activeElement===last)){
    event.preventDefault();(event.shiftKey?last:first).focus();
   }
  }
  return;
 }
 if(event.key==='Escape'&&selected){selected=null;sync()}
});
// Drag from pocket to compatible object or another pocket item; tapping always works on touch screens.
$('nhInventory').addEventListener('dragstart',e=>{
 const el=e.target.closest('[data-item]');if(!el)return;
 e.dataTransfer.setData('text/plain',el.dataset.item);
 e.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',e=>{
 if(e.target.closest('[data-toy],[data-item]'))e.preventDefault();
});
document.addEventListener('drop',e=>{
 const dest=e.target.closest('[data-toy],[data-item]');
 if(!dest)return;
 e.preventDefault();
 const id=e.dataTransfer.getData('text/plain');
 if(!inventory.has(id))return;
 if(dest.dataset.item)combine(id,dest.dataset.item);
 else if(!apply(id,dest.dataset.toy))status('Those do not go together. Nothing was lost.');
});
sync();
status('Everything is waiting.');
})();