/* Escape the Box: a 25-room puzzle with its own account-synced cosmetic.
 * Gold never changes Crilo's regular badges, spins, Daily scores, or stats. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const trigger=$('criloHiddenBox'),panel=$('criloHiddenBoxNote');
 const shade=$('criloEscapeShade'),board=$('criloEscapeBoard');
 const player=$('criloEscapePlayer'),overlay=$('criloEscapeOverlay');
 const roomLabel=$('criloEscapeRoom'),sparksLabel=$('criloEscapeSparks');
 const slidesLabel=$('criloEscapeSlides'),status=$('criloEscapeStatus');
 const budgetFill=$('criloEscapeBudgetFill');
 const restart=$('criloEscapeRestart'),close=$('criloEscapeClose');
 const goldenPanel=$('criloGoldenPanel'),goldenToggle=$('criloGoldenToggle');
 if(!trigger||!panel||!shade||!board||!player||!overlay||!restart||!close)return;

 // Each room has exactly three sparks (*), one start (S), and one exit (E).
 // Every puzzle has a verified solution using only slide-until-wall moves.
 const levels=[
  ["#########","#......*#","#.....#.#","#.......#","#.......#","#S......#","#..#...E#","#**...#.#","#########"],
  ["#########","#.#.....#","#.....S.#","#*###...#","#E......#","##......#","#.*.....#","#....*..#","#########"],
  ["#########","#..*..#.#","#....#*.#","#...#..##","##......#","#.SE*.#.#","#.......#","#..#....#","#########"],
  ["#########","##..*#..#","#......##","##..*...#","#*#.##..#","#.......#","##.....S#","##.E....#","#########"],
  ["#########","#.##.*..#","#.#....##","###.....#","#.......#","#*##....#","#.#.#...#","##.S..E*#","#########"],
  // The remaining rooms were checked with an independent shortest-path solver.
  ...[
   "#########/##.E.##.#/#....#..#/#*##.#.##/#.#*.#.##/#.#S##..#/###..#..#/##.#.*###/#########",
   "#########/#*.##...#/#.E.*...#/##.#.S###/#####...#/#.#.*#..#/#.##...##/###.###.#/#########",
   "#########/#..##.#.#/#.#..#.*#/##.#...##/#.#..E#.#/###S#...#/##.*##..#/#.#.##*##/#########",
   "#########/#....#.*#/#.#E..S.#/#.*##..##/##.####.#/#..#..#.#/#.#####.#/#*###..##/#########",
   "#########/##...#*.#/#.###*#.#/#####...#/#.##.#..#/#E..#..S#/#*#.#..##/###....##/#########",
   "#########/###..####/#.*.#...#/#.##...##/#..E.#..#/#S.*##.##/#..#.#.*#/###.#.###/#########",
   "#########/#E.##...#/#..*.*..#/##S##.###/#.##..#.#/##...#.##/#..##.###/#.*####.#/#########",
   "#########/##.#.E.##/##*..#..#/#...#..S#/#.#..##*#/##...####/#.*####.#/#..##.#.#/#########",
   "#########/######..#/#.E....##/###....##/#...#*.##/##...####/#..#.*..#/#.S*###.#/#########",
   "#########/#*.#.E..#/##..##.##/#.#.#..##/#*#...###/#.....###/##...S#.#/##.*#####/#########",
   "#########/###E....#/#.S*#.###/#..#.*###/#....#..#/##..#...#/###...#*#/##.###.##/#########",
   "#########/#*###..##/#..#S...#/##..#...#/#.#.#..##/##......#/##.*.##*#/###E...##/#########",
   "#########/#..#.####/####E..##/#*#...###/#...#..##/#.*##..##/#..#.#.S#/###.#*..#/#########",
   "#########/##..S.#.#/#..#...##/#...##.##/#.#*##E##/#.##*.*.#/#....#..#/#.###...#/#########",
   "#########/#E.#..*##/#...#.*.#/##....###/##.#...##/#..####*#/#S#.#...#/#.......#/#########",
   "#########/##*.#..S#/#.#..#..#/##.#..*##/##...#.##/#...#...#/#E...##*#/####....#/#########",
   "#########/####S...#/##......#/#..#.####/#.#..E###/#..##..*#/##*#...##/##.#.*.##/#########",
   "#########/#..#.####/#..##...#/#.#.....#/#....S###/#E#.*#*.#/#..#.*#.#/#####...#/#########",
   "#########/#*....#S#/#..#..*.#/##..##.##/#.#..E.##/##.#.#..#/#....##.#/#.#..#.*#/#########",
   "#########/#...#*..#/#....##.#/#.S#.E*.#/#*.#....#/###....##/#.......#/#....#..#/#########"
  ].map(roomText=>roomText.split('/'))
 ];
 // "Par" is the shortest number of slides needed to collect every spark and exit.
 // The early rooms allow four extra slides; later rooms tighten to three or two.
 const parMoves=[5,9,12,14,18,18,18,19,19,19,20,20,20,21,21,21,22,22,22,23,23,24,24,25,27];
 const moveLimits=parMoves.map((par,index)=>par+(index<10?4:index<15?3:2));
 const directions={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
 let room=0,moves=0,roomMoves=0,level=null,location={x:0,y:0};
 let collected=new Set(),busy=false,initialized=false,transitionTimer=null;
 let activePointer=null,roomRoute='',clearedRoutes=Array(25).fill(null);
 let unlocked=false,equipped=true,syncing=false;
 const proofKey='crilo_escape_golden_guest_proof_v1';
 const equippedKey='crilo_escape_golden_equipped_v1';
 function safeRead(key){try{return localStorage.getItem(key);}catch{return null;}}
 function safeWrite(key,value){try{localStorage.setItem(key,value);}catch{/* no storage available */}}
 function guestProof(){
  try{
   const arr=JSON.parse(safeRead(proofKey)||'null');
   return Array.isArray(arr)&&arr.length===25&&arr.every(s=>typeof s==='string'&&/^[URDL]{1,30}$/.test(s))?arr:null;
  }catch{return null;}
 }
 unlocked=!!guestProof();
 equipped=safeRead(equippedKey)!=='white';
 function applyCosmetic(){
  board.classList.toggle('is-golden',unlocked&&equipped);
  if(goldenPanel){
   goldenPanel.hidden=!unlocked;
   if(goldenToggle){
    goldenToggle.textContent=equipped?'Use white box':'Use Golden Box';
    goldenToggle.setAttribute('aria-pressed',String(unlocked&&equipped));
   }
  }
 }
 function setUnlocked(){
  unlocked=true;
  equipped=true;
  safeWrite(equippedKey,'gold');
  applyCosmetic();
 }
 async function syncGoldenAccount(){
  if(syncing||typeof criloDB==='undefined'||!criloDB?.auth)return;
  syncing=true;
  try{
   const {data:who,error:authError}=await criloDB.auth.getUser();
   if(authError||!who?.user)return;
   const {data:existing,error:lookupError}=await criloDB.from('crilo_escape_cosmetics')
    .select('golden_unlocked_at').eq('user_id',who.user.id).maybeSingle();
   if(lookupError)return;
   if(existing?.golden_unlocked_at){if(!unlocked)setUnlocked();return;}
   const proof=guestProof();
   if(!proof)return;
   const {data:awarded,error:claimError}=await criloDB.rpc('crilo_unlock_golden_box',{p_routes:proof});
   if(!claimError&&awarded===true){setUnlocked();}
  }catch{/* No interruption to Crilo login or gameplay on network errors. */}
  finally{syncing=false;}
 }

 function cancelTransition(){
  if(transitionTimer!==null){clearTimeout(transitionTimer);transitionTimer=null;}
  busy=false;
 }
 function setOpen(open){
  panel.hidden=!open;
  shade.hidden=!open;
  trigger.setAttribute('aria-expanded',String(open));
  if(open){
   if(!initialized)loadRoom(0,true);
   applyCosmetic();
   void syncGoldenAccount();
   close.focus({preventScroll:true});
  }else{
   cancelTransition();
   trigger.focus({preventScroll:true});
  }
 }
 function markPosition(x,y,duration=0){
  player.style.setProperty('--x',String(x));
  player.style.setProperty('--y',String(y));
  player.style.setProperty('--slide-duration',duration+'ms');
  player.style.transform='translate('+(x*100)+'%,'+(y*100)+'%)';
  player.dataset.x=String(x);player.dataset.y=String(y);
  board.dataset.position=x+','+y;
 }
 function updateHud(){
  roomLabel.textContent='ROOM '+(room+1)+' / '+levels.length;
  sparksLabel.textContent=collected.size+' / 3';
  slidesLabel.textContent=roomMoves+' / '+moveLimits[room];
  if(budgetFill)budgetFill.style.width=(roomMoves/moveLimits[room]*100)+'%';
  panel.classList.toggle('low-moves',moveLimits[room]-roomMoves<=2);
  board.dataset.movesLeft=String(moveLimits[room]-roomMoves);
  board.dataset.moveLimit=String(moveLimits[room]);
  board.dataset.room=String(room+1);
  board.dataset.sparks=String(collected.size);
  board.dataset.slides=String(moves);
  const exit=board.querySelector('.crilo-escape-exit');
  if(exit)exit.classList.toggle('unlocked',collected.size===3);
 }
 function drawRoom(){
  const fragment=document.createDocumentFragment();
  for(let y=0;y<level.length;y++){
   for(let x=0;x<level[y].length;x++){
    const symbol=level[y][x];
    const cell=document.createElement('div');
    cell.className='crilo-escape-cell';
    cell.dataset.cell=x+','+y;
    if(symbol==='#')cell.classList.add('wall');
    if(symbol==='*')cell.classList.add('spark');
    if(symbol==='E')cell.classList.add('crilo-escape-exit');
    if(symbol==='S')cell.classList.add('start');
    fragment.appendChild(cell);
   }
  }
  board.replaceChildren(fragment,player,overlay);
 }
 function loadRoom(index,first=false){
  cancelTransition();
  room=index;roomMoves=0;roomRoute='';collected=new Set();
  level=levels[index];
  initialized=true;
  overlay.hidden=true;
  overlay.classList.remove('is-failure');
  for(let y=0;y<level.length;y++){
   const x=level[y].indexOf('S');
   if(x>=0){location={x,y};break;}
  }
  drawRoom();
  // Do not animate the player across rooms or after restarting.
  player.classList.add('no-motion');
  markPosition(location.x,location.y);
  void player.offsetWidth;
  player.classList.remove('no-motion');
  updateHud();
  applyCosmetic();
  status.textContent=first?'Collect 3 sparks, then reach the exit.':'Room '+(room+1)+' · '+moveLimits[room]+' moves available.';
 }
 function resetRoom(){
  moves=Math.max(0,moves-roomMoves);
  loadRoom(room);
  status.textContent='Try a different route!';
 }
 function tile(x,y){return level[y]?.[x]||'#'}
 function collect(x,y){
  if(tile(x,y)!=='*')return;
  const key=x+','+y;
  if(collected.has(key))return;
  collected.add(key);
  board.querySelectorAll('.crilo-escape-cell.spark').forEach(cell=>{
   if(cell.dataset.cell===key)cell.classList.add('collected');
  });
 }
 function finishRoom(){
  busy=true;
  const won=room===levels.length-1;
  clearedRoutes[room]=roomRoute;
  if(won){
   const proof=clearedRoutes.slice();
   if(proof.length===levels.length&&proof.every(s=>typeof s==='string'&&s.length>0)){
    safeWrite(proofKey,JSON.stringify(proof));
    setUnlocked();
    void syncGoldenAccount();
   }
  }
  overlay.hidden=false;
  overlay.replaceChildren();
  const title=document.createElement('strong');
  title.textContent=won?'GOLDEN BOX UNLOCKED!':'ROOM CLEAR!';
  if(won){
   const prize=document.createElement('span');
   prize.className='crilo-golden-prize';
   prize.textContent='✦';
   prize.setAttribute('aria-hidden','true');
   overlay.append(prize);
  }
  const detail=document.createElement('span');
  detail.textContent=won?levels.length+' rooms · '+moves+' slides':'3 sparks collected · '+(moveLimits[room]-roomMoves)+' moves left';
  const next=document.createElement('button');
  next.type='button';next.className='crilo-escape-next';
  next.textContent=won?'Play with Golden Box':'Next room →';
  next.addEventListener('click',()=>{
   if(won){moves=0;loadRoom(0,true);}
   else loadRoom(room+1);
  });
  overlay.append(title,detail,next);
  status.textContent=won?'All '+levels.length+' rooms cleared in '+moves+' slides.':'Room '+(room+1)+' cleared.';
  next.focus({preventScroll:true});
 }
 function failRoom(){
  busy=true;
  overlay.hidden=false;
  overlay.replaceChildren();
  overlay.classList.add('is-failure');
  const title=document.createElement('strong');
  title.textContent='OUT OF MOVES!';
  const detail=document.createElement('span');
  detail.textContent='Room '+(room+1)+' · '+collected.size+'/3 sparks';
  const retry=document.createElement('button');
  retry.type='button';retry.className='crilo-escape-next';
  retry.textContent='Retry room ↻';
  retry.addEventListener('click',resetRoom);
  overlay.append(title,detail,retry);
  status.textContent='Out of moves. Try a shorter route.';
  retry.focus({preventScroll:true});
 }
 function slide(dir){
  if(panel.hidden||busy||overlay.hidden===false)return false;
  const delta=directions[dir];if(!delta)return false;
  let {x,y}=location;
  let distance=0,escaped=false;
  while(true){
   const nx=x+delta[0],ny=y+delta[1];
   if(tile(nx,ny)==='#')break;
   x=nx;y=ny;distance++;
   collect(x,y);
   if(tile(x,y)==='E'&&collected.size===3){escaped=true;break;}
  }
  if(distance===0)return false;
  moves++;roomMoves++;
  roomRoute+=({up:'U',right:'R',down:'D',left:'L'})[dir];
  location={x,y};
  const duration=Math.min(420,110+distance*38);
  markPosition(x,y,duration);
  updateHud();
  busy=true;
  transitionTimer=setTimeout(()=>{
   transitionTimer=null;busy=false;
   if(escaped)finishRoom();
   else if(roomMoves>=moveLimits[room])failRoom();
   else if(collected.size===3)status.textContent='Exit open! Slide through the door.';
   else status.textContent='';
  },duration+35);
  return true;
 }
 function dirFromKey(key){
  const keys={
   ArrowUp:'up',w:'up',W:'up',
   ArrowRight:'right',d:'right',D:'right',
   ArrowDown:'down',s:'down',S:'down',
   ArrowLeft:'left',a:'left',A:'left'
  };
  return keys[key]||null;
 }
 trigger.addEventListener('click',()=>setOpen(panel.hidden));
 close.addEventListener('click',()=>setOpen(false));
 shade.addEventListener('click',()=>setOpen(false));
 restart.addEventListener('click',resetRoom);
 goldenToggle?.addEventListener('click',()=>{
  if(!unlocked)return;
  equipped=!equipped;
  safeWrite(equippedKey,equipped?'gold':'white');
  applyCosmetic();
 });
 if(typeof criloDB!=='undefined'&&criloDB?.auth?.onAuthStateChange){
  criloDB.auth.onAuthStateChange(()=>window.setTimeout(()=>{void syncGoldenAccount();},0));
 }
 applyCosmetic();
 panel.querySelectorAll('[data-secret-direction]').forEach(btn=>{
  btn.addEventListener('click',()=>slide(btn.dataset.secretDirection));
 });
 document.addEventListener('keydown',event=>{
  if(panel.hidden)return;
  if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const dir=dirFromKey(event.key);
  if(dir){
   // Only capture directions while this secret is actually open.
   event.preventDefault();
   slide(dir);
  }
 });
 board.addEventListener('pointerdown',event=>{
  if(event.button!==0&&event.pointerType==='mouse')return;
  activePointer={id:event.pointerId,x:event.clientX,y:event.clientY};
 });
 board.addEventListener('pointerup',event=>{
  const start=activePointer;
  activePointer=null;
  if(!start||start.id!==event.pointerId)return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  slide(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
 });
 board.addEventListener('pointercancel',()=>{activePointer=null;});
})();
