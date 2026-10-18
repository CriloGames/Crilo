/* Escape the Box: a self-contained, five-room sliding puzzle.
 * No accounts, Daily scores, badges, backend requests or persistent storage. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const trigger=$('criloHiddenBox'),panel=$('criloHiddenBoxNote');
 const shade=$('criloEscapeShade'),board=$('criloEscapeBoard');
 const player=$('criloEscapePlayer'),overlay=$('criloEscapeOverlay');
 const roomLabel=$('criloEscapeRoom'),sparksLabel=$('criloEscapeSparks');
 const slidesLabel=$('criloEscapeSlides'),status=$('criloEscapeStatus');
 const restart=$('criloEscapeRestart'),close=$('criloEscapeClose');
 if(!trigger||!panel||!shade||!board||!player||!overlay||!restart||!close)return;

 // Each room has exactly three sparks (*), one start (S), and one exit (E).
 // Every puzzle has a verified solution using only slide-until-wall moves.
 const levels=[
  ["#########","#......*#","#.....#.#","#.......#","#.......#","#S......#","#..#...E#","#**...#.#","#########"],
  ["#########","#.#.....#","#.....S.#","#*###...#","#E......#","##......#","#.*.....#","#....*..#","#########"],
  ["#########","#..*..#.#","#....#*.#","#...#..##","##......#","#.SE*.#.#","#.......#","#..#....#","#########"],
  ["#########","##..*#..#","#......##","##..*...#","#*#.##..#","#.......#","##.....S#","##.E....#","#########"],
  ["#########","#.##.*..#","#.#....##","###.....#","#.......#","#*##....#","#.#.#...#","##.S..E*#","#########"]
 ];
 const directions={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
 let room=0,moves=0,roomMoves=0,level=null,location={x:0,y:0};
 let collected=new Set(),busy=false,initialized=false,transitionTimer=null;
 let activePointer=null;

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
  slidesLabel.textContent=String(moves);
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
  room=index;roomMoves=0;collected=new Set();
  level=levels[index];
  initialized=true;
  overlay.hidden=true;
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
  status.textContent=first?'Collect 3 sparks, then reach the exit.':'Room '+(room+1);
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
  overlay.hidden=false;
  overlay.replaceChildren();
  const title=document.createElement('strong');
  title.textContent=won?'YOU ESCAPED!':'ROOM CLEAR!';
  const detail=document.createElement('span');
  detail.textContent=won?'5 rooms · '+moves+' slides':'3 sparks collected';
  const next=document.createElement('button');
  next.type='button';next.className='crilo-escape-next';
  next.textContent=won?'Play again':'Next room →';
  next.addEventListener('click',()=>{
   if(won){moves=0;loadRoom(0,true);}
   else loadRoom(room+1);
  });
  overlay.append(title,detail,next);
  status.textContent=won?'All five rooms cleared in '+moves+' slides.':'Room '+(room+1)+' cleared.';
  next.focus({preventScroll:true});
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
  location={x,y};
  const duration=Math.min(420,110+distance*38);
  markPosition(x,y,duration);
  updateHud();
  busy=true;
  transitionTimer=setTimeout(()=>{
   transitionTimer=null;busy=false;
   if(escaped)finishRoom();
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
