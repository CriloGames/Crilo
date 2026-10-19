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
 const goldenStatus=$('criloGoldenStatus');
 const character=player?.querySelector('.crilo-escape-character');
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
 // Exact shortest-path budgets; no extra moves on any of the 25 rooms.
 const parMoves=[5,9,12,14,18,18,18,19,19,19,20,20,20,21,21,21,22,22,22,23,23,24,24,25,27];
 const moveLimits=parMoves.slice();
 const directions={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
 let room=0,moves=0,roomMoves=0,level=null,location={x:0,y:0};
 let collected=new Set(),busy=false,initialized=false,transitionTimer=null;
 let activePointer=null,roomRoute='',clearedRoutes=Array(25).fill(null);
 let unlocked=false,equipped=true,syncing=false,syncPending=false;
 const proofKey='crilo_escape_golden_guest_proof_v1';
 const equippedKey='crilo_escape_golden_equipped_v1';
 const progressKey='crilo_escape_progress_v2';
 function safeRead(key){try{return localStorage.getItem(key);}catch{return null;}}
 function safeWrite(key,value){try{localStorage.setItem(key,value);}catch{/* no storage available */}}
 function saveProgress(){
  // Only secret-maze values: do not write Daily, badges or account records.
  safeWrite(progressKey,JSON.stringify({v:2,room,cleared:clearedRoutes.slice(0,room),route:roomRoute}));
 }
 // Replay persisted inputs rather than blindly trusting saved coordinates,
 // spark counts, or room numbers. This also restores mid-room progress.
 function replayRoute(index,route){
  const map=levels[index];
  let x=-1,y=-1,mask=0,escaped=false,valid=true,ex=-1,ey=-1;
  const stars=[];
  for(let yy=0;yy<9;yy++)for(let xx=0;xx<9;xx++){
   const s=map[yy][xx];
   if(s==='S'){x=xx;y=yy;}
   else if(s==='*')stars.push(xx+','+yy);
   else if(s==='E'){ex=xx;ey=yy;}
  }
  if(x<0||stars.length!==3||typeof route!=='string'||route.length>moveLimits[index]||/[^URDL]/.test(route))return null;
  for(let i=0;i<route.length;i++){
   const vector={U:[0,-1],R:[1,0],D:[0,1],L:[-1,0]}[route[i]];
   let distance=0;
   while(true){
    const nx=x+vector[0],ny=y+vector[1];
    if(!map[ny]||map[ny][nx]==='#'||map[ny][nx]===undefined)break;
    x=nx;y=ny;distance++;
    const star=stars.indexOf(x+','+y);
    if(star>=0)mask|=1<<star;
    if(x===ex&&y===ey&&mask===7){escaped=true;break;}
   }
   if(distance===0||(escaped&&i!==route.length-1)){valid=false;break;}
  }
  return valid?{x,y,mask,escaped,failed:route.length===moveLimits[index]&&!escaped}:null;
 }
 function restoreProgress(){
  let saved;
  try{saved=JSON.parse(safeRead(progressKey)||'null');}catch{return false;}
  if(!saved||saved.v!==2||!Number.isInteger(saved.room)||saved.room<0||saved.room>=levels.length||
   !Array.isArray(saved.cleared)||saved.cleared.length!==saved.room||
   typeof saved.route!=='string')return false;
  for(let i=0;i<saved.cleared.length;i++){
   const result=replayRoute(i,saved.cleared[i]);
   if(!result||!result.escaped)return false;
  }
  const active=replayRoute(saved.room,saved.route);
  if(!active)return false;
  clearedRoutes=[...saved.cleared,...Array(levels.length-saved.cleared.length).fill(null)];
  moves=saved.cleared.reduce((total,r)=>total+r.length,0);
  loadRoom(saved.room);
  roomRoute=saved.route;
  roomMoves=roomRoute.length;
  moves+=roomMoves;
  location={x:active.x,y:active.y};
  collected=new Set();
  const stars=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){
   if(levels[room][y][x]==='*')stars.push(x+','+y);
  }
  stars.forEach((key,i)=>{
   if(active.mask&(1<<i))collected.add(key);
  });
  for(const cell of board.querySelectorAll('.crilo-escape-cell.spark')){
   cell.classList.toggle('collected',collected.has(cell.dataset.cell));
  }
  markPosition(location.x,location.y,0);
  updateHud();
  if(active.escaped)finishRoom();
  else if(active.failed)failRoom();
  else status.textContent='Progress restored · room '+(room+1)+'.';
  return true;
 }
 function guestProof(){
  try{
   const arr=JSON.parse(safeRead(proofKey)||'null');
   return Array.isArray(arr)&&arr.length===25&&arr.every(s=>typeof s==='string'&&/^[URDL]{1,30}$/.test(s))?arr:null;
  }catch{return null;}
 }
 unlocked=!!guestProof();
 equipped=safeRead(equippedKey)!=='white';
 function applyCosmetic(){
  // Style the actual character, not just its board container. The equipped
  // state is visible immediately and survives replays, refreshes and reloads.
  const gold=Boolean(unlocked&&equipped);
  board.classList.toggle('is-golden',gold);
  board.dataset.cosmetic=gold?'gold':'white';
  player.classList.toggle('is-golden',gold);
  if(character)character.classList.toggle('is-golden',gold);
  if(goldenPanel){
   goldenPanel.hidden=!unlocked;
   goldenPanel.classList.toggle('gold-equipped',gold);
   if(goldenStatus)goldenStatus.textContent=gold?'Equipped: Golden Box':'Equipped: White Box';
   if(goldenToggle){
    goldenToggle.textContent=gold?'Use White Box':'Use Golden Box';
    goldenToggle.setAttribute('aria-pressed',String(gold));
    goldenToggle.setAttribute('aria-label',gold?'Switch to White Box':'Switch to Golden Box');
   }
  }
 }
 function setUnlocked(autoEquip=true){
  unlocked=true;
  // Only a new victory (or a new successful claim) equips gold automatically.
  // Rehydrating an already-owned reward must honor the player's saved choice.
  if(autoEquip){
   equipped=true;
   safeWrite(equippedKey,'gold');
  }
  applyCosmetic();
 }
 async function syncGoldenAccount(){
  if(typeof criloDB==='undefined'||!criloDB?.auth)return;
  if(syncing){syncPending=true;return;}
  syncing=true;
  try{
   const {data:who,error:authError}=await criloDB.auth.getUser();
   if(authError||!who?.user)return;
   const {data:existing,error:lookupError}=await criloDB.from('crilo_escape_cosmetics')
    .select('golden_unlocked_at').eq('user_id',who.user.id).maybeSingle();
   if(lookupError)return;
   if(existing?.golden_unlocked_at){if(!unlocked)setUnlocked(false);return;}
   const proof=guestProof();
   if(!proof)return;
   const {data:awarded,error:claimError}=await criloDB.rpc('crilo_unlock_golden_box',{p_routes:proof});
   if(!claimError&&awarded===true){setUnlocked();}
  }catch{/* No interruption to Crilo login or gameplay on network errors. */}
  finally{
   syncing=false;
   if(syncPending){syncPending=false;void syncGoldenAccount();}
  }
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
   if(!initialized){
    if(!restoreProgress()){moves=0;clearedRoutes=Array(levels.length).fill(null);loadRoom(0,true);saveProgress();}
   }else if(overlay.hidden&&roomRoute){
    // A player may close the secret during the last movement animation.
    // Resolve any interrupted win/loss when the box is reopened.
    const state=replayRoute(room,roomRoute);
    if(state?.escaped)finishRoom();
    else if(state?.failed)failRoom();
   }
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
  status.textContent=first?'Collect 3 stars, then reach the exit.':'Room '+(room+1)+' · '+moveLimits[room]+' moves available.';
 }
 function resetRoom(){
  moves=Math.max(0,moves-roomMoves);
  loadRoom(room);
  saveProgress();
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
  const firstUnlock=won&&!unlocked;
  clearedRoutes[room]=roomRoute;
  if(won&&firstUnlock){
   const proof=clearedRoutes.slice();
   if(proof.length===levels.length&&proof.every(s=>typeof s==='string'&&s.length>0)){
    safeWrite(proofKey,JSON.stringify(proof));
    setUnlocked();
    void syncGoldenAccount();
   }
  }
  saveProgress();
  overlay.hidden=false;
  overlay.replaceChildren();
  const title=document.createElement('strong');
  title.textContent=won?(firstUnlock?'GOLDEN BOX UNLOCKED!':'YOU ESCAPED AGAIN!'):'ROOM CLEAR!';
  if(firstUnlock){
   const prize=document.createElement('span');
   prize.className='crilo-golden-prize';
   prize.textContent='✦';
   prize.setAttribute('aria-hidden','true');
   overlay.append(prize);
  }
  const detail=document.createElement('span');
  detail.textContent=won?(firstUnlock?'25 rooms · one-time Golden Box · '+moves+' slides':'25 rooms replayed · no more rewards · '+moves+' slides'):'3 stars collected · '+(moveLimits[room]-roomMoves)+' moves left';
  const next=document.createElement('button');
  next.type='button';next.className='crilo-escape-next';
  next.textContent=won?'Play again · Room 1':'Next room →';
  next.addEventListener('click',()=>{
   if(won){
    moves=0;
    clearedRoutes=Array(levels.length).fill(null);
    loadRoom(0,true);
   }else loadRoom(room+1);
   saveProgress();
  });
  overlay.append(title,detail,next);
  status.textContent=won?(firstUnlock?'Golden Box unlocked permanently! Replay any time.':'No extra rewards for replays. Start again at Room 1.'):'Room '+(room+1)+' cleared.';
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
  detail.textContent='Room '+(room+1)+' · '+collected.size+'/3 stars';
  const retry=document.createElement('button');
  retry.type='button';retry.className='crilo-escape-next';
  retry.textContent='Retry room ↻';
  retry.addEventListener('click',resetRoom);
  overlay.append(title,detail,retry);
  status.textContent='Out of moves. Retry for the exact shortest path.';
  saveProgress();
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
  saveProgress();
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
  if(event.key==='r'||event.key==='R'){
   // Only while Escape the Box is open; never hijack R on the Daily page.
   event.preventDefault();
   if(!event.repeat)resetRoom();
   return;
  }
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
