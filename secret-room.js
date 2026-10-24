/* NOTHING HERE. A game made entirely of secrets.
 * No login, Supabase, ads, badges or Daily writes.
 * All discoveries persist in one browser-local key.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORAGE='crilo_nothing_here_secrets_v1';
const catalog=[
 ['first-touch','The First Secret','Touch anything in the room.','It started the moment you became curious.'],
 ['notice','Official Notice','That notice looks unusually defensive.','A sign insisted nothing was there.'],
 ['peel-notice','Fine Print','Some signs need more than one reading.','Even the warning was concealing a warning.'],
 ['moon','Moonstruck','The night sky is within reach.','You touched something impossibly far away.'],
 ['eclipse','Red Moon','Be persistent with the pale moon.','The moon learned to blush.'],
 ['starlight','Starlight','Individual stars are not just decoration.','One small point of light answered.'],
 ['constellation','The Correct Stars','Try the third, first, then fifth star.','A constellation drew itself out of order.'],
 ['window','Fresh Air','The window can be opened.','The whole sky was closer than it looked.'],
 ['rain','Weather Report','Open the window more than once.','A forecast nobody asked for.'],
 ['clock','4:17','A clock tells more than the time.','Someone stopped time at 4:17.'],
 ['midnight','A Broken Clock','What happens when you disturb time twelve times?','The clock kept counting even while standing still.'],
 ['painting','Landscape No. 0','Pictures rarely tell the whole truth.','A valley without any roads.'],
 ['painting-back','A Painter’s Note','Look behind the painting by trying it again.','RED → BLUE → GOLD. An unusual color recipe.'],
 ['mirror','Not Quite You','Look into the standing mirror.','The reflection blinked first.'],
 ['dark-mirror','A Different Reflection','A mirror looks different without a lamp.','There was a doorway where a reflection belonged.'],
 ['through-glass','Through the Looking Glass','In darkness, the mirror can become a passage.','You visited somewhere facing the wrong way.'],
 ['lamp','Someone Turned Out the Light','The lamp has a real switch.','The room can keep a secret in the dark.'],
 ['book','A Page Without Words','Not all books are meant to be read.','A book opened in your imagination.'],
 ['book-code','Bookshelf Cipher','The painting knows a sequence of book colors.','RED. BLUE. GOLD. The books unlocked a console.'],
 ['radio','A Song Without Music','Old radios can be tuned.','The speaker remembered a different decade.'],
 ['dead-air','Station 0','Try tuning the radio five times.','You found the station between stations.'],
 ['plant','Green Thumb','Something is alive in the room.','The plant leaned closer.'],
 ['roots','Deep Roots','Examine the plant a few more times.','The pot was never connected to the floor.'],
 ['cup','Tea for Nobody','The ceramic cup can be picked up.','Someone had left their drink unfinished.'],
 ['rainwater','Borrowed Rain','A cup can catch rain from an open window.','You collected the sky in a teacup.'],
 ['watered','A Kind Thing','A thirsty plant might appreciate your cup.','A leaf grew where it should not have.'],
 ['candle','Tiny Flame','The candle is interactive.','The flame was brighter than the room.'],
 ['candle-dark','Second Sun','A candle seems stronger when the room is dark.','For a second, you had your own sun.'],
 ['rug','Underfoot','Not all carpets are innocent.','A rug nearly confessed something.'],
 ['brass-key','Under the Rug','Look under the rug again.','A brass key was hiding where everyone walks.'],
 ['drawer','The Empty Drawer','The desk has a handle.','You discovered a drawer that had nothing in it.'],
 ['letter','The Drawer’s Letter','An empty drawer is worth checking twice.','The letter read: THERE IS NO LAST SECRET.'],
 ['safe','The Locked Box','There is a small safe near the floor.','A safe guarded the idea of a password.'],
 ['safe-code','Four Seventeen','A wall clock might know the safe’s combination.','The code was 417. The safe disagreed that it was safe.'],
 ['inside-safe','Safe Inside','Revisit the safe after unlocking it.','Inside was a smaller, unlocked safe.'],
 ['vent','Through the Grate','The wall has a breathing hole.','The house exhaled.'],
 ['vent-silence','A Voice in the Wall','Try the vent while the radio is silent and lamp is off.','The vent whispered: BEHIND YOU.'],
 ['door','No Exit','The door has a handle.','It was never intended to keep you out.'],
 ['keyhole','A Keyhole’s View','Every locked door has a keyhole.','You saw an eye looking back.'],
 ['threshold','The Other Side','An ordinary key can unlock an extraordinary door.','A door led farther inside the room.'],
 ['floorboard','Wooden Secret','One plank near the floor looks loose.','The floor made an almost musical knock.'],
 ['hollow-floor','Hollow','Knock on the loose floorboard several times.','Something answered from under the floor.'],
 ['journal','A Record of Nothing','The journal records discovered secrets.','Even collecting secrets was secretly a secret.'],
 ['hints','Asking for Help','Try asking the room for hints more than once.','Help was hiding in the help.'],
 ['footer','Version Zero','Even small text can be tapped repeatedly.','The version number has no last digit.'],
 ['title','An Unusual Title','The game’s title is suspicious.','NOTHING HERE was the first lie.'],
 ['secret-word','Say the Word','Try typing the name of the game’s subject anywhere.','You typed SECRET without being asked.'],
 ['konami','Old Habits','Some secrets know very old controller codes.','↑ ↑ ↓ ↓ ← → ← → B A. Still works.'],
 ['terminal','The Hidden Terminal','The colored books can reveal a keyboard.','You reached a computer that refuses to compute.'],
 ['say-hello','Friendly Computer','Try introducing yourself to the secret terminal.','The terminal said hello back.'],
 ['xyzzy','A Very Old Spell','Some old adventure games share one magic word.','You are in a maze of twisty little secrets.'],
 ['crilo','A Familiar Name','Try the site’s name in the terminal.','The computer knew who made the universe.'],
 ['terminal-secret','Recursive Secret','Try asking the terminal for a secret.','The secret was that the terminal had secrets.'],
 ['box','Do Not Open','The other side has a box labeled clearly.','You opened the thing that asked you not to.'],
 ['box-inside','Smaller Box','Look into the forbidden box again.','Inside the box was another box.'],
 ['orbit','Almost a Planet','Touch the hovering orbit.','Gravity took the day off.'],
 ['eye','A Look Back','There is a very large eye on the other side.','It had been watching you play.'],
 ['stairs','Stairs to Nowhere','Not every staircase leads somewhere.','You climbed without moving.'],
 ['bell','Somebody Home?','Ring the little bell.','The bell rang where sound has no air.'],
 ['bell-three','Three Rings','Ring three times.','Somewhere, something answered.'],
 ['mail','Undelivered','A letter is floating on the other side.','Address: the person who found this.'],
 ['hole','An Even Smaller Room','A dark opening waits near the bottom.','The hole contained an entire second sky.'],
 ['other-side-return','The Same Door','The strange side has a return door.','You discovered that the way back was also a secret.'],
 ['black-sun','The Black Sun','Look for the opposite of sunlight in the mirror world.','The sun was made of shadow.'],
 ['mirror-eye','The Third Person','A giant reflection is staring at you.','There was someone else inside the glass.'],
 ['backwards','EMOCLEW','Try to read the mirror-world message.','WELCOME, if you read from the other side.'],
 ['mirror-fish','Sky Fish','Fish swim where they should not.','An ocean fit inside the air.'],
 ['mirror-clock','Counterclockwise','Even time is reversed in the mirror.','You borrowed a minute from tomorrow.'],
 ['silver-key','The Wrong Key','A shiny key floats in the mirror.','A key for a door that does not exist.'],
 ['mirror-return','Home Again','There is a way back from the reflection.','You returned, but not quite the same.']
];
const map=new Map(catalog.map(s=>[s[0],s]));
const dom={scene:$('srScene'),toast:$('srToast'),toastType:$('srToastType'),toastTitle:$('srToastTitle'),toastText:$('srToastText'),
 location:$('srLocation'),count:$('srCount'),bar:$('srBar'),whisper:$('srWhisper'),milestone:$('srMilestone'),
 dialog:$('srDialog'),dialogTitle:$('srDialogTitle'),dialogEyebrow:$('srDialogEyebrow'),dialogContent:$('srDialogContent'),
 journal:$('srJournalBtn'),hint:$('srHintBtn'),sound:$('srSoundBtn'),soundText:$('srSoundText'),status:$('srCursorNote'),
 back:$('srBackWorld'),mirror:$('srMirrorWorld'),coordinates:$('srCoordinates')};
if(!dom.scene||!dom.dialog)return;
let stored={};
try{stored=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{}}catch{}
const found=new Set((Array.isArray(stored.found)?stored.found:[]).filter(id=>map.has(id)));
const savedRoom=stored.room&&typeof stored.room==='object'?stored.room:{};
const remembered=(name,fallback)=>typeof savedRoom[name]==='boolean'?savedRoom[name]:fallback;
const flags={lamp:remembered('lamp',true),rain:remembered('rain',false),
 watered:remembered('watered',found.has('watered')),radio:remembered('radio',false),hasKey:found.has('brass-key'),
 cup:remembered('cup',false),cupFull:remembered('cupFull',found.has('rainwater')&&!found.has('watered')),
 safeOpen:found.has('safe-code'),
 mirrorAvailable:found.has('dark-mirror'),consoleAvailable:found.has('book-code')};
const taps={},order=[],stars=[],pressed=[];
let place='room',muted=stored.muted===true,audio=null,toastTimer=null,dialogLastFocus=null;
let keyboardBuffer='',lastClue=-1,visitCount=0,bookHistory=[];
let audioUnlocked=false;
const safeText=t=>String(t).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
function save(){
 try{localStorage.setItem(STORAGE,JSON.stringify({found:[...found],muted,
   room:{lamp:flags.lamp,rain:flags.rain,watered:flags.watered,radio:flags.radio,
    cup:flags.cup,cupFull:flags.cupFull}}))}catch{}
}
function beep(freq=460,duration=.065,type='sine',volume=.028){
 if(muted)return;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  if(!audio)audio=new AC();
  if(audio.state==='suspended')audio.resume();
  const osc=audio.createOscillator(),gain=audio.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);
  gain.gain.setValueAtTime(.0001,audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume,audio.currentTime+.008);
  gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
  osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration+.01);
 }catch{}
}
function feedback(text){
 dom.whisper.textContent=text;
 if(dom.status)dom.status.textContent=text;
}
function sync(){
 dom.count.innerHTML=found.size+' <small>/ '+catalog.length+'</small>';
 dom.bar.style.width=(100*found.size/catalog.length).toFixed(2)+'%';
 dom.scene.dataset.lamp=flags.lamp?'on':'off';
 dom.scene.dataset.rain=flags.rain?'yes':'no';
 dom.scene.dataset.watered=flags.watered?'yes':'no';
 dom.scene.dataset.radio=flags.radio?'on':'off';
 dom.scene.dataset.rug=flags.hasKey?'lift':'flat';
 dom.scene.dataset.eclipse=found.has('eclipse')?'yes':'no';
 dom.scene.dataset.cup=flags.cup?'held':'set';
 dom.scene.dataset.cupWater=flags.cupFull?'full':'empty';
 dom.scene.dataset.safe=flags.safeOpen?'open':'locked';
 dom.sound.setAttribute('aria-pressed',String(!muted));
 dom.sound.setAttribute('title',muted?'Turn sounds on':'Turn sounds off');
 dom.soundText.textContent=muted?'OFF':'ON';
 dom.coordinates.textContent=String(found.size).padStart(2,'0')+' / '+String(catalog.length).padStart(2,'0');
 if(found.size>=10)dom.milestone.textContent='SOME SECRETS MAKE MORE SECRETS';
 if(found.size>=25)dom.milestone.textContent='THE ROOM IS NOT THE WHOLE GAME';
 if(found.size===catalog.length)dom.milestone.textContent='EVERY SECRET FOUND. ARE YOU CERTAIN?';
 save();
}
function discover(id,comment){
 if(!map.has(id)){console.warn('Unknown secret id',id);return false}
 if(found.has(id)){if(comment)feedback(comment);return false}
 const [,title,,desc]=map.get(id);
 found.add(id);save();sync();
 dom.toast.hidden=false;dom.toastType.textContent='✦ SECRET '+String(found.size).padStart(2,'0')+' / '+catalog.length;
 dom.toastTitle.textContent=title;dom.toastText.textContent=desc;
 dom.toast.style.animation='none';void dom.toast.offsetWidth;dom.toast.style.animation='';
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>{dom.toast.hidden=true},3300);
 beep(520,.095,'sine');setTimeout(()=>beep(700,.11,'sine',.025),85);
 feedback(comment||desc);
 if(found.size===catalog.length){
  setTimeout(()=>openDialog('complete'),700);
 }
 return true;
}
function count(action){taps[action]=(taps[action]||0)+1;return taps[action]}
function setPlace(next){
 place=next;dom.scene.dataset.place=next;
 dom.back.hidden=next!=='back';dom.mirror.hidden=next!=='mirror';
 dom.location.textContent=next==='room'?"01 / THE ROOM THAT ISN'T HERE":
  next==='back'?'02 / THE OTHER SIDE OF THE DOOR':'?? / THE ROOM THAT LOOKS BACK';
 feedback(next==='room'?'Everything is exactly as it seems. Probably.':
  next==='back'?'You are still in the room. The room is simply somewhere else.':
  'Your reflection is facing the wrong way.');
}
function modal(eyebrow,title,markup){
 dialogLastFocus=document.activeElement;
 dom.dialogEyebrow.textContent=eyebrow;dom.dialogTitle.textContent=title;
 dom.dialogContent.innerHTML=markup;dom.dialog.hidden=false;
 $('srClose')?.focus();
}
function closeDialog(){
 if(dom.dialog.hidden)return;
 dom.dialog.hidden=true;
 if(dialogLastFocus?.isConnected)dialogLastFocus.focus();
}
function openDialog(kind){
 if(kind==='journal'){
  discover('journal','Found secrets are written down. Unfound secrets are... also here.');
  const entries=catalog.map(([id,name,,description],i)=> {
   const got=found.has(id);
   return '<div class="sr-journal-entry '+(got?'found':'')+'"><span class="sr-journal-number">'+
    String(i+1).padStart(2,'0')+'</span><div><strong>'+
    (got?'✧ '+safeText(name):'????????')+'</strong><small>'+
    (got?safeText(description):'Undiscovered')+'</small></div></div>';
  }).join('');
  modal('A COMPENDIUM OF ABSENCES','The Secret Journal',
   '<div class="sr-journal-progress"><span>'+found.size+' of '+catalog.length+' found</span><span>No achievements. Only curiosity.</span></div>'+
   '<div class="sr-journal-grid">'+entries+'</div>'+
   '<p style="margin-top:16px">All discoveries save automatically on this device. There is no timed challenge and nothing is lost when you leave.</p>');
 }else if(kind==='hint'){
  if(count('hint')>=3)discover('hints','A hint about the hint: the hint button is a secret too.');
  const available=catalog.filter(x=>!found.has(x[0]));
  const choice=available.length?available[(lastClue+1)%available.length]:null;
  lastClue++;
  modal('A VERY SMALL NUDGE','What if...',
   choice?'<p class="sr-hint-clue">'+safeText(choice[2])+'</p><p>Try looking at everything more than once. Some secrets have prerequisites.</p><button type="button" data-dialog="hint">ANOTHER NUDGE →</button>':
    '<p>You have found everything currently written in the journal. Congratulations, or something like it.</p>');
 }else if(kind==='safe'){
  if(flags.safeOpen){
   discover('inside-safe');modal('UNLOCKED','The safe is open',
    '<p>Inside the safe is a smaller safe. Its door is already unlocked.</p><p>It contains a piece of paper that says: <strong>“I knew you would look.”</strong></p>');
   return;
  }
  modal('A LOCK THAT KNOWS NUMBERS','The small safe',
   '<p>Three digits are carved into the lock. Somewhere in the room, a clock knows the answer.</p>'+
   '<form id="srSafeForm"><label for="srSafeInput">ENTER THREE DIGITS</label>'+
   '<input type="text" id="srSafeInput" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" autocomplete="off" required placeholder="___">'+
   '<button type="submit">TURN THE HANDLE</button></form><p id="srSafeFeedback" aria-live="polite"></p>');
  $('srSafeInput')?.focus();
 }else if(kind==='terminal'){
  if(!flags.consoleAvailable){feedback('There is no computer here. Yet.');return}
  discover('terminal');
  modal('UNLISTED INTERFACE','A terminal with no purpose',
   '<p>It appears to understand words, but not very many.</p>'+
   '<form id="srTerminalForm"><label for="srTerminalInput">COMMAND</label>'+
   '<input id="srTerminalInput" autocomplete="off" spellcheck="false" maxlength="30" placeholder="Type a word...">'+
   '<button type="submit">ENTER ↵</button></form><p id="srTerminalReply">UNKNOWN COMMAND IS AN ACCEPTABLE RESPONSE.</p>');
  $('srTerminalInput')?.focus();
 }else if(kind==='complete'){
  modal('THE THING AFTER THE LAST THING','You found every secret.',
   '<p>You looked under every rug, clicked the unreasonable things, went through both impossible doors, and read the words that were never written.</p>'+
   '<p><strong>There is no final boss.</strong> There is nothing here. That was the game.</p>'+
   '<button type="button" data-dialog="journal">READ YOUR JOURNAL</button>');
 }else if(kind==='info'){
  modal('THERE ARE NO RULES','How to play Nothing Here',
   '<p>Click, tap, examine, combine, repeat. If something looks like a decoration, it might still do something. Sometimes the room changes depending on what you did earlier.</p>'+
   '<p>Try the lamp, painting, books, clock, drawer, safe, window, floor, and door. You can also type on your keyboard. There are hidden places beyond this room.</p>'+
   '<p>The journal records discoveries; <strong>A NUDGE</strong> gives clues. Progress saves on this device. There are no scores, time limits, accounts, or paid content.</p>');
 }else if(kind==='reset'){
  modal('A VERY DANGEROUS BUTTON','Erase discoveries?',
   '<p>This would erase all discoveries from this game on this device, including the key, secret rooms, journal, and terminal. It does not touch any other Crilo progress.</p>'+
   '<button type="button" class="sr-danger" data-dialog="really-reset">YES, ERASE ONLY THESE SECRETS</button><button type="button" data-dialog="close">KEEP EVERYTHING</button>');
 }
}
const action=(which,target)=>{
 if(!which)return;
 if(which!=='return'&&which!=='back-hole'&&which!=='mirror-key'){
  if(!found.has('first-touch'))discover('first-touch');
 }
 let n=count(which);
 switch(which){
 case 'notice':
  discover('notice');if(n===3)discover('peel-notice','The sign says: PRESS THE COLORS IN THE RIGHT ORDER.');
  if(n>3)feedback('The sign is peeling at the corners.');break;
 case 'moon':
  discover('moon');if(n>=4)discover('eclipse');else feedback('You felt the moon shift slightly.');
  break;
 case 'star':
  discover('starlight');
  stars.push(Number(target.dataset.star));if(stars.length>3)stars.shift();
  if(stars.join(',')==='2,0,4')discover('constellation','Three points joined to form an impossible shape.');
  else feedback('The stars seem to be waiting for an order.');
  break;
 case 'window':
  discover('window');
  if(n>=2){
   flags.rain=!flags.rain;discover('rain');
   feedback(flags.rain?'Rain pours in. The empty cup might be useful.':'The rain has stopped.');
  }else feedback('Outside is almost, but not quite, the same sky.');
  sync();break;
 case 'clock':
  discover('clock','The hands are frozen at 4:17.');
  if(n>=12)discover('midnight');
  else feedback('It is exactly 4:17. Again.');
  break;
 case 'painting':
  discover('painting');if(n>=3)discover('painting-back','On its back: RED → BLUE → GOLD.');
  else feedback('There is something written behind the frame.');
  break;
 case 'mirror':
  if(flags.lamp){
   discover('mirror','Something in the mirror moved after you stopped moving.');
  }else if(!flags.mirrorAvailable){
   flags.mirrorAvailable=true;discover('dark-mirror','The dark glass ripples. Touch it again.');
  }else{
   discover('through-glass');setPlace('mirror');
  }break;
 case 'lamp':
  flags.lamp=!flags.lamp;discover('lamp');
  sync();feedback(flags.lamp?'The lamp hums back to life.':'The room grows dark. Something in the mirror changes.');
  break;
 case 'book':
  discover('book');
  const color=target.dataset.book;
  bookHistory.push(color);if(bookHistory.length>3)bookHistory.shift();
  if(bookHistory.join(',')==='red,blue,gold'){
   flags.consoleAvailable=true;discover('book-code','A silent computer awakens behind the books.');
   openDialog('terminal');
  }else feedback('The '+color+' book clicks. A different order could mean something.');
  break;
 case 'radio':
  flags.radio=!flags.radio;sync();
  discover('radio');
  if(n>=5)discover('dead-air','A voice whispers: “Nothing is broadcasting.”');
  else feedback(flags.radio?'A quiet song plays on a frequency that does not exist.':'The old radio falls silent.');
  if(flags.radio)beep(190,.15,'triangle',.018);
  break;
 case 'plant':
  discover('plant');
  if(flags.cupFull&&flags.cup){
   flags.watered=true;flags.cup=false;flags.cupFull=false;
   discover('watered');sync();break;
  }
  if(n>=6)discover('roots');
  else feedback(flags.cupFull?'You have rainwater. Hold the cup and try the plant.':'The leaves rustle although there is no wind.');
  break;
 case 'cup':
  flags.cup=!flags.cup;discover('cup');
  if(flags.cup&&flags.rain&&!flags.cupFull){
   flags.cupFull=true;discover('rainwater','You caught rainwater in the cup. Find something thirsty.');
  }else if(flags.cup&&flags.cupFull)feedback('You are holding a cup full of rainwater.');
  else feedback(flags.cup?'You picked up the cup.':'You set the cup down.');
  sync();break;
 case 'candle':
  discover('candle');if(!flags.lamp)discover('candle-dark');
  else feedback('The candle’s flame flutters. Try it without the lamp.');
  break;
 case 'rug':
  discover('rug');
  if(n>=2){
   flags.hasKey=true;discover('brass-key','You pocketed a brass key. A door has been waiting for it.');
  }else feedback('Something metal scrapes under the rug.');
  sync();break;
 case 'drawer':
  discover('drawer');if(n>=2)discover('letter');
  else feedback('The drawer looks empty. Look again.');
  break;
 case 'safe':discover('safe');openDialog('safe');break;
 case 'vent':
  discover('vent');
  if(!flags.lamp&&!flags.radio)discover('vent-silence');
  else feedback('There is an odd whisper behind the grate, hidden beneath the electrical hum.');
  break;
 case 'door':
  discover('door');
  if(flags.hasKey){discover('threshold');setPlace('back');}
  else feedback('Locked. A narrow brass keyhole sits beneath the handle.');
  break;
 case 'keyhole':discover('keyhole');break;
 case 'floorboard':
  discover('floorboard');
  if(n>=5)discover('hollow-floor');else feedback('A hollow knock. The floor seems to have a second layer.');
  break;
 case 'back-orbit':discover('orbit');break;
 case 'back-eye':discover('eye');break;
 case 'back-box':discover('box');if(n>=2)discover('box-inside');break;
 case 'back-stairs':discover('stairs');break;
 case 'back-bell':discover('bell');if(n>=3)discover('bell-three');break;
 case 'back-mail':discover('mail');break;
 case 'back-hole':discover('hole');break;
 case 'mirror-sun':discover('black-sun');break;
 case 'mirror-eye':discover('mirror-eye');break;
 case 'mirror-word':discover('backwards');break;
 case 'mirror-fish':discover('mirror-fish');break;
 case 'mirror-clock':discover('mirror-clock');break;
 case 'mirror-key':discover('silver-key');break;
 case 'return':
  if(place==='mirror')discover('mirror-return');else if(place==='back')discover('other-side-return');
  setPlace('room');break;
 }
};
document.addEventListener('click',event=>{
 const node=event.target.closest('[data-action]');
 if(!node||!dom.scene.contains(node))return;
 if(!dom.dialog.hidden)return;
 action(node.dataset.action,node);
});
function touchTitle(){if(count('title')>=3)discover('title');else feedback('The title insists it is not a button.')}
$('srTitle')?.addEventListener('click',touchTitle);
$('srJournalBtn')?.addEventListener('click',()=>openDialog('journal'));
$('srHintBtn')?.addEventListener('click',()=>openDialog('hint'));
$('gameInfoBtn')?.addEventListener('click',()=>openDialog('info'));
$('srFooterSecret')?.addEventListener('click',()=>{if(count('footer')>=3)discover('footer');else feedback('The version number is drifting.')});
$('srSoundBtn')?.addEventListener('click',()=>{
 muted=!muted;save();sync();feedback(muted?'It went quiet.':'The room is listening again.');
 if(!muted)beep();
});
$('srClose')?.addEventListener('click',closeDialog);
dom.dialog.addEventListener('click',e=>{
 if(e.target===dom.dialog){closeDialog();return}
 const button=e.target.closest('[data-dialog]');
 if(!button)return;
 const cmd=button.dataset.dialog;
 if(cmd==='close')closeDialog();
 else if(cmd==='really-reset'){
  try{localStorage.removeItem(STORAGE)}catch{}
  location.reload();
 }else openDialog(cmd);
});
dom.dialog.addEventListener('submit',event=>{
 event.preventDefault();
 if(event.target.id==='srSafeForm'){
  const code=String($('srSafeInput')?.value||'').trim();
  if(code==='417'){
   flags.safeOpen=true;discover('safe-code','The lock clicked on the fourth digit that was not there.');
   closeDialog();openDialog('safe');
  }else{
   $('srSafeFeedback').textContent='A quiet click. The safe remains closed.';
   beep(160,.13,'sawtooth',.015);
  }
 }else if(event.target.id==='srTerminalForm'){
  const word=String($('srTerminalInput')?.value||'').toLowerCase().trim();
  const responses={
   hello:['say-hello','HELLO, OTHER PERSON.'],xyzzy:['xyzzy','A HOLLOW VOICE SAYS PLUGH.'],
   crilo:['crilo','ORIGIN: CRILO. END: UNKNOWN.'],
   secret:['terminal-secret','THIS COMMAND IS A SECRET.'],
   open:[null,'ALL THINGS OPEN EVENTUALLY.'],
   help:[null,'ACCEPTED: HELLO / XYZZY / CRILO / SECRET'],
   42:[null,'THE ANSWER WAS ANOTHER QUESTION.']
  };
  const response=responses[word];
  if(response){
   if(response[0])discover(response[0]);
   $('srTerminalReply').textContent=response[1];
   beep(460,.065,'square',.014);
  }else $('srTerminalReply').textContent='COMMAND NOT FOUND. THAT TOO IS INFORMATION.';
  $('srTerminalInput').value='';$('srTerminalInput').focus();
 }
});
document.addEventListener('keydown',e=>{
 if(!dom.dialog.hidden){
  if(e.key==='Escape'){e.preventDefault();closeDialog()}
  return;
 }
 if(e.key==='Escape'&&place!=='room'){e.preventDefault();action('return');return}
 const inField=/input|textarea|select/i.test(document.activeElement?.tagName||'');
 if(inField||e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.toLowerCase();
 if(key.length===1&&/[a-z]/.test(key)){
  keyboardBuffer=(keyboardBuffer+key).slice(-16);
  if(keyboardBuffer.endsWith('secret'))discover('secret-word');
 }
 const mapped=e.key==='ArrowUp'?'up':e.key==='ArrowDown'?'down':
  e.key==='ArrowLeft'?'left':e.key==='ArrowRight'?'right':key;
 const combo=['up','up','down','down','left','right','left','right','b','a'];
 pressed.push(mapped);if(pressed.length>10)pressed.shift();
 if(pressed.join(',')===combo.join(','))discover('konami');
});
const originalHelp=$('gameInfoBtn');if(originalHelp)originalHelp.setAttribute('aria-expanded','false');
dom.dialog.addEventListener('click',()=>{if(originalHelp)originalHelp.setAttribute('aria-expanded',String(!dom.dialog.hidden))});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(toastTimer)});
window.addEventListener('storage',e=>{
 if(e.key!==STORAGE)return;
 try{
  const fresh=JSON.parse(e.newValue||'{}');
  if(fresh?.found){for(const id of fresh.found)if(map.has(id))found.add(id);sync()}
 }catch{}
});
sync();
feedback('Everything is exactly as it seems. Probably.');
})();