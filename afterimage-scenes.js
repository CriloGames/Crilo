/* Afterimage scene library. Twenty locations, five compositions each.
   Scene data is the sole source of both artwork and question answers. */
(function(root){'use strict';
const C=[['red','#b94c4c'],['blue','#487faf'],['green','#558660'],['yellow','#dfb342'],['purple','#8d68ae'],['orange','#d47e40']];
const B=[['cream','#e8dfce'],['mint','#dce8dd'],['lavender','#e8e2ef'],['peach','#eedbd0'],['sky','#d8e6ea']];
const S=[
 ['living-room','living room','sofa','table','bookshelf','book',['remote control','vase','camera','headphones'],'indoor'],
 ['bedroom','bedroom','bedspread','bedside table','shelf','book',['alarm clock','teddy bear','vase','lamp'],'indoor'],
 ['study','study','desk chair','side table','shelf','book',['headphones','camera','globe','lamp'],'indoor'],
 ['kitchen','kitchen','refrigerator','kitchen counter','counter','apple',['kettle','toaster','mixing bowl','bottle'],'indoor'],
 ['cafe','café','counter','café table','counter','cup',['teapot','cake','vase','coffee pot'],'indoor'],
 ['library','library','reading chair','reading table','bookcase','book',['globe','lamp','glasses','hourglass'],'indoor'],
 ['art-studio','art studio','easel','worktable','shelf','paint tube',['paintbrush','palette','vase','scissors'],'indoor'],
 ['music-room','music room','piano','side table','shelf','record',['guitar','headphones','metronome','trumpet'],'indoor'],
 ['classroom','classroom','chalkboard','teacher’s desk','shelf','book',['globe','apple','ruler','pencil'],'indoor'],
 ['workshop','workshop','tool cabinet','workbench','bench','bolt',['hammer','wrench','screwdriver','tape measure'],'indoor'],
 ['greenhouse','greenhouse','planting bench','potting table','bench','flower pot',['watering can','trowel','gloves','spray bottle'],'garden'],
 ['flower-shop','flower shop','display cabinet','shop counter','shelf','flower pot',['vase','watering can','scissors','basket'],'indoor'],
 ['bakery','bakery','display case','bakery counter','tray','bread roll',['cake','rolling pin','mixing bowl','teapot'],'indoor'],
 ['laundry','laundry room','washing machine','folding table','shelf','towel',['basket','detergent','iron','spray bottle'],'indoor'],
 ['gym','gym','exercise bench','equipment shelf','rack','dumbbell',['water bottle','jump rope','towel','stopwatch'],'indoor'],
 ['beach','beach','beach umbrella','picnic blanket','sand','shell',['bucket','sunglasses','beach ball','bottle'],'beach'],
 ['campsite','campsite','tent','camp table','ground','log',['lantern','compass','backpack','kettle'],'forest'],
 ['park','park','park bench','picnic table','grass','flower',['kite','basket','book','water bottle'],'garden'],
 ['playground','playground','slide','picnic table','grass','cone',['ball','kite','bucket','backpack'],'garden'],
 ['market','outdoor market','market stall','market counter','crate','apple',['basket','pineapple','bottle','flowers'],'garden']
];
// Each composition changes architecture, surface positions and placement; the
// scene index is stable across versions and never depends on the random seed.
const TEMPLATES=S.flatMap((s,i)=>Array.from({length:5},(_,layout)=>({id:i*5+layout,place:s[0],name:s[1],layout})));
const rand=seed=>{let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296}};
function shuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const plural={'book':'books','cup':'cups','apple':'apples','paint tube':'paint tubes','record':'records','bolt':'bolts','flower pot':'flower pots','bread roll':'bread rolls','towel':'towels','dumbbell':'dumbbells','shell':'shells','log':'logs','flower':'flowers','cone':'cones'};
const A={
 'remote control':['remote','tv remote'],'vase':['flowers','flower pot','flowerpot','pot of flowers','vase with flowers','bouquet','potted plant'],'alarm clock':['clock','alarm'],'teddy bear':['teddy','stuffed bear','stuffed animal','bear'],'lamp':['table lamp','light'],'headphones':['headset','earphones'],'globe':['world globe','earth'],'kettle':['tea kettle','teakettle'],'toaster':['bread toaster'],'mixing bowl':['bowl'],'bottle':['water bottle'],'teapot':['tea pot','kettle'],'cake':['birthday cake','dessert'],'coffee pot':['coffeepot','coffee kettle'],'glasses':['eyeglasses','spectacles'],'hourglass':['sand timer'],'paintbrush':['brush','paint brush'],'palette':['paint palette','paint tray'],'scissors':['shears'],'guitar':['acoustic guitar'],'metronome':['music timer'],'trumpet':['horn'],'ruler':['measuring stick'],'pencil':['pen'],'hammer':['mallet'],'wrench':['spanner'],'screwdriver':['screw driver'],'tape measure':['measuring tape'],'watering can':['water can','watering pot'],'trowel':['garden shovel','small shovel','spade'],'gloves':['gardening gloves'],'spray bottle':['sprayer'],'basket':['wicker basket'],'rolling pin':['roller'],'detergent':['soap','laundry detergent'],'iron':['clothes iron'],'water bottle':['bottle'],'jump rope':['skipping rope'],'towel':['cloth'],'stopwatch':['timer'],'bucket':['pail'],'sunglasses':['shades','glasses'],'beach ball':['ball'],'lantern':['lamp','camp lantern'],'compass':['navigation compass'],'backpack':['bag','rucksack'],'kite':['toy kite'],'book':['notebook'],'ball':['toy ball'],'pineapple':['pine apple'],'flowers':['flower','bouquet','bunch of flowers']
};
function make(template,seed){
 const r=rand(seed),t=TEMPLATES[template],s=S[Math.floor(template/5)],pick=a=>a[Math.floor(r()*a.length)];
 const [main,c1,c2]=shuffle(C,r),[p1,p2]=shuffle(s[6],r);
 const layout=t.layout,side=[0,1,1,0,1][layout]?'right':'left',other=side==='left'?'right':'left';
 const room={version:3,template,theme:s[1],place:s[0],layout,main,wall:pick(B)[1],floor:pick(['#bc9875','#a58a71','#cfb08a']),kind:s[7],feature:s[2],surface:s[3],countPlace:s[4],countItem:s[5],count:2+Math.floor(r()*4),objects:[{name:p1,color:c1,side},{name:p2,color:c2,side:other}],weather:pick(['sunny','rainy','snowy']),clock:1+Math.floor(r()*12),detail:pick(['circle','triangle','square'])};
 const q=(id,prompt,answer,aliases=[],why='')=>({id,prompt,answer:String(answer),aliases,why});
 const [a,b]=room.objects;
 const count=q('sceneCount','How many '+plural[s[5]]+' were grouped together in the '+s[4]+' area?',room.count,[], 'The grouped '+plural[s[5]]+' can be counted in the original scene.');
 // Numeric noun aliases are accepted, not merely the bare digit.
 const numWords=['zero','one','two','three','four','five'];
 count.aliases=[room.count+' '+plural[s[5]],numWords[room.count]+' '+plural[s[5]]];
 const color=q('furniture','What color was the '+s[2]+'?',main[0],[],'Look at the large '+s[2]+'.');
 const object=(o)=>q('sceneObject','What object was on the '+o.side+' side of the '+s[3]+'?',o.name,A[o.name]||[],'The '+o.name+' was on the '+o.side+'.');
 const objColor=o=>q('sceneColor','What was the main color of the '+o.name+'?',o.color[0],[],'Look at the '+o.name+' on the '+o.side+'.');
 const location=o=>q('plant','Was the '+o.name+' on the left or right side of the '+s[3]+'?',o.side,[],'The '+o.name+' was on the '+o.side+'.');
 const weather=q('weather','What was the weather '+(s[7]==='indoor'?'outside the window':'in the scene')+'?',room.weather,[],'Look at the sky.');
 const clock=q('hour','What hour did the wall clock show?',room.clock,[],'The short hand points to '+room.clock+'.');
 const [x,y]=r()<.5?[a,b]:[b,a];
 // Object color only when the drawing's main fill is the requested hue.
 const extra=s[7]==='indoor'?clock:weather;
 const questions=shuffle([count,color,object(x),location(y),extra],r);
 return {seed:seed>>>0,room,questions,scan:25,answer:15};
}
// A non-repeating shuffled deck of all 100 scene compositions. Across decks,
// each composition receives new randomized contents. No silent restart.
function next(history,seed){
 const seen=new Set(history.seen||[]),recent=new Set(history.deck||[]);
 let remaining=TEMPLATES.filter(t=>!recent.has(t.id));
 let deck=Array.from(recent);
 if(!remaining.length){remaining=TEMPLATES.slice();deck=[]}
 const r=rand(seed);remaining=shuffle(remaining,r);
 for(const t of remaining){
  for(let i=0;i<64;i++){
   const candidate=make(t.id,Math.floor(r()*4294967296)),fingerprint=signature(candidate.room);
   if(!seen.has(fingerprint))return {game:candidate,fingerprint,history:{seen:[...seen,fingerprint],deck:[...deck,t.id]}};
  }
 }
 return null;
}
// Only fields visible in the actual art count toward identity. Use the
// full serialization instead of a hash to avoid accidental collisions.
function signature(r){return JSON.stringify([r.template,r.main[0],r.wall,r.floor,r.count,r.objects.map(o=>[o.name,o.color[0],o.side]),r.weather,r.kind==='indoor'?r.clock:0])}
const R=(x,y,w,h,f,rx=0,s='none',sw=1)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+f+'" stroke="'+s+'" stroke-width="'+sw+'"/>';
const L=(x,y,X,Y,s='#5b4e42',sw=2)=>'<path d="M'+x+' '+y+'L'+X+' '+Y+'" fill="none" stroke="'+s+'" stroke-width="'+sw+'" stroke-linecap="round"/>';
const P=(d,f,s='none',sw=1)=>'<path d="'+d+'" fill="'+f+'" stroke="'+s+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"/>';
const O=(x,y,rad,f,s='none',sw=1)=>'<circle cx="'+x+'" cy="'+y+'" r="'+rad+'" fill="'+f+'" stroke="'+s+'" stroke-width="'+sw+'"/>';
const G=(x,y,s,k=1)=>'<g transform="translate('+x+' '+y+') scale('+k+')">'+s+'</g>';
const E=(x,y,rx,ry,f)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'"/>';
const ink='#574c41',white='#fff8e7',wood='#9b7654',dark='#404e52',leaf='#638e62';
function icon(name,c){
 const z=ink;
 switch(name){
 case 'remote control':return R(14,2,28,58,c,6,z,2)+O(28,14,4,white)+Array.from({length:6},(_,i)=>O(22+i%2*12,27+Math.floor(i/2)*10,2,white)).join('');
 case 'vase':case 'flowers':return P('M18 27H40L36 38Q58 64 29 64Q0 64 23 38Z',c,z,2)+L(27,27,12,9,leaf,3)+L(31,27,43,6,leaf,3)+O(12,9,8,'#d97070')+O(43,6,8,'#e6bd49');
 case 'camera':return R(2,16,56,37,c,7,z,2)+R(10,9,20,10,c,2,z)+O(32,34,15,dark,z,2)+O(32,34,9,'#a5c6d4');
 case 'headphones':return P('M5 36V22Q5-1 30-1T55 22V36','none',c,9)+R(0,26,16,28,c,5,z,2)+R(44,26,16,28,c,5,z,2);
 case 'alarm clock':case 'stopwatch':return O(30,30,24,c,z,2)+O(30,30,19,white)+L(30,30,30,15,z,3)+L(30,30,43,34,z,3)+L(20,53,16,60,z,4)+L(40,53,44,60,z,4)+R(24,0,12,7,c,2,z);
 case 'teddy bear':return O(13,12,10,c,z)+O(47,12,10,c,z)+O(30,22,19,c,z)+O(30,46,17,c,z)+O(17,51,9,c,z)+O(43,51,9,c,z)+O(23,19,2,z)+O(37,19,2,z)+E(30,29,9,6,white)+O(30,27,3,z);
 case 'lamp':return P('M14 5H46L57 34H3Z',c,z,2)+L(30,34,30,60,z,4)+R(14,58,32,5,wood,2,z);
 case 'globe':return O(30,25,23,c,z,2)+P('M13 13L24 6L29 17L19 22L28 35L17 40Z M39 16L49 21L45 35L36 31Z',leaf)+P('M49 7Q72 30 42 51','none',z,3)+L(31,49,31,60,z,4)+R(16,59,30,5,wood,2);
 case 'kettle':case 'teapot':case 'coffee pot':return E(29,40,23,21,c)+P('M12 27L0 10L4 8L22 29Z',c,z,2)+P('M48 24Q69 20 58 42L48 47','none',z,4)+R(15,16,28,8,c,4,z)+O(29,13,4,z);
 case 'toaster':return R(4,21,52,34,c,8,z,2)+R(13,8,16,22,'#d0a475',4,z)+R(33,12,14,18,'#d0a475',4,z)+L(49,29,49,43,z,3)+O(45,47,3,white);
 case 'mixing bowl':return P('M3 30H57Q52 61 30 61T3 30Z',c,z,2)+E(30,30,27,6,white);
 case 'bottle':case 'water bottle':case 'spray bottle':case 'detergent':return R(15,16,30,45,c,8,z,2)+R(23,7,14,12,c,2,z)+R(21,3,name==='spray bottle'?26:18,8,dark,2,z)+R(18,32,24,15,white,3);
 case 'cake':return R(7,25,46,29,c,5,z,2)+E(30,25,23,8,white)+P('M7 35Q15 44 23 35T39 35T53 35','none',white,3)+L(30,17,30,5,z,3)+O(30,3,4,'#e7ac47')+E(30,58,29,4,'#c9c4b9');
 case 'glasses':case 'sunglasses':return R(1,24,25,20,c,8,z,2)+R(34,24,25,20,c,8,z,2)+L(26,30,34,30,z,3)+L(3,26,0,14,z,3)+L(57,26,60,14,z,3);
 case 'hourglass':return R(8,3,44,5,c,2,z)+R(8,57,44,5,c,2,z)+P('M12 8Q12 23 30 32Q48 23 48 8Z M30 32Q12 42 12 57H48Q48 42 30 32Z','#e2e9e1',z,2)+P('M17 17H43L30 29Z M17 54L30 42L43 54Z',c);
 case 'paintbrush':return P('M24 1H36L34 40H26Z',c,z,2)+R(24,38,12,9,'#b5b6b4',1,z)+P('M24 47H36Q43 60 30 63Q19 61 24 47Z','#9b6a47',z);
 case 'palette':return P('M30 4Q64 4 59 36Q56 60 25 60Q0 59 1 30Q2 12 30 4Z',c,z,2)+O(43,44,7,white)+O(17,20,6,'#b94c4c')+O(34,15,6,'#487faf')+O(12,37,6,'#dfb342');
 case 'scissors':return L(17,38,49,4,'#a5aeaf',5)+L(43,38,11,4,'#a5aeaf',5)+O(15,48,12,'none',c,6)+O(45,48,12,'none',c,6);
 case 'guitar':return P('M32 21L47 0L55 5L40 28Q55 43 37 56Q11 73 4 51Q-2 33 16 30Q17 16 32 21Z',c,z,2)+O(23,42,8,z)+L(23,42,49,4,white,2);
 case 'metronome':return P('M30 4L53 60H7Z',c,z,2)+L(30,52,43,10,z,3)+R(36,20,8,9,white,1,z);
 case 'trumpet':return P('M1 23H38L60 10V49L38 37H1Z',c,z,2)+P('M13 38V50H39V37','none',c,6)+L(20,23,20,14,z,3)+L(30,23,30,14,z,3);
 case 'apple':return P('M30 16Q12 2 5 21Q-1 39 14 57Q22 66 30 59Q38 66 47 57Q62 39 55 21Q48 2 30 16Z',c,z,2)+L(30,17,33,4,z,3)+P('M34 9Q45-2 53 5Q43 17 34 9Z',leaf);
 case 'ruler':return R(23,1,15,61,c,2,z,2)+Array.from({length:7},(_,i)=>L(24,7+i*8,31+(i%2)*3,7+i*8,z,1.2)).join('');
 case 'pencil':return P('M24 4H36V49L30 62L24 49Z',c,z,2)+P('M24 49H36L30 62Z','#c9a57a',z)+P('M27 57H33L30 62Z',z);
 case 'hammer':return R(24,19,12,43,c,2,z)+P('M4 4H44L57 12L43 22H4Z',dark,z,2);
 case 'wrench':return P('M15 2L28 15L22 24L11 20L8 7Q-5 23 12 34L37 58Q48 65 54 54L29 28Q44 8 30 0L24 12Z',c,z,2);
 case 'screwdriver':return R(21,30,18,31,c,6,z,2)+R(27,4,6,29,'#aeb5b3',1,z)+R(25,0,10,8,dark,1);
 case 'tape measure':return R(4,13,49,40,c,10,z,2)+O(28,33,13,white,z)+P('M53 34H62V43H53Z','#b6b3a7',z);
 case 'watering can':return R(12,21,33,35,c,6,z,2)+P('M14 33L0 9L5 5L24 29Z',c,z,2)+P('M43 26Q65 18 59 40L45 47','none',c,6)+R(17,15,24,7,c,2,z);
 case 'trowel':return R(24,2,12,23,c,4,z)+L(30,25,30,35,z,4)+P('M10 35H50Q49 55 30 63Q11 55 10 35Z','#b5bcba',z,2);
 case 'gloves':return P('M6 31L3 14Q7 8 11 18L16 27V7Q22 1 23 10V24L28 8Q35 5 34 14L31 35Q34 60 16 60Q1 51 6 31Z M35 32L33 16Q39 10 43 20L47 28V10Q53 4 55 13L59 34Q62 59 47 61Q36 56 35 32Z',c,z,2);
 case 'basket':return P('M2 25H58L50 61H10Z',c,z,2)+P('M12 25Q12-7 30-7T48 25','none',wood,5)+L(10,38,50,38,z)+L(13,49,47,49,z);
 case 'rolling pin':return R(11,23,38,20,c,5,z,2)+R(0,29,12,8,wood,3,z)+R(48,29,12,8,wood,3,z);
 case 'iron':return P('M2 48L17 23H50L60 48V59H2Z',c,z,2)+P('M22 22Q17 4 40 8L49 22Z','none',z,5)+R(2,54,58,7,'#9aa6a7',2,z);
 case 'jump rope':return P('M5 16Q-3 64 30 64Q63 64 55 16','none',c,4)+R(1,1,10,20,c,3,z)+R(49,1,10,20,c,3,z);
 case 'towel':return R(7,12,46,49,c,4,z,2)+L(11,21,49,21,white,3)+L(11,51,49,51,white,3);
 case 'bucket':return P('M8 20H52L45 61H15Z',c,z,2)+P('M9 20Q9-10 30-10T51 20','none',z,3)+E(30,20,22,5,white);
 case 'beach ball':case 'ball':return O(30,31,28,c,z,2)+P('M30 3Q7 31 30 59Q53 31 30 3Z',white,z,1)+O(30,7,5,c);
 case 'lantern':return R(12,19,36,36,'#f9de96',6,z,2)+R(7,52,46,9,c,3,z)+R(10,12,40,8,c,3,z)+P('M17 12Q17-7 30-7T43 12','none',z,4)+L(18,22,18,51,z,2)+L(42,22,42,51,z,2);
 case 'compass':return O(30,30,27,c,z,2)+O(30,30,22,white)+P('M40 13L33 34L20 48L27 26Z','#b94c4c',z,1)+O(30,30,3,z);
 case 'backpack':return R(7,11,46,51,c,12,z,2)+P('M20 11V4H40V11','none',z,4)+R(14,36,32,19,c,5,z)+L(18,40,42,40,white,2);
 case 'kite':return P('M30 0L59 27L30 55L1 27Z',c,z,2)+L(30,0,30,55,z)+L(1,27,59,27,z)+P('M30 55Q45 57 37 68','none',z,2);
 case 'book':return P('M5 8Q18 4 30 12Q42 4 55 8V55Q42 51 30 59Q18 51 5 55Z',c,z,2)+L(30,12,30,59,z)+L(11,21,23,23,white,2)+L(37,23,49,21,white,2);
 case 'pineapple':return E(30,39,20,25,c)+P('M30 15L12 0L25 7L30-5L36 7L50 0Z',leaf,z)+P('M15 24L45 54M12 36L37 61M45 24L15 54M48 36L23 61','none',z,1.2);
 case 'paint tube':return P('M9 4H51L44 48H16Z',c,z,2)+R(20,48,20,12,white,2,z)+R(17,17,26,15,white,2);
 case 'record':return O(30,30,28,'#374044',z,2)+O(30,30,13,c)+O(30,30,3,white)+O(30,30,21,'none','#788185');
 case 'bolt':return P('M17 2H43L51 14L43 25H17L9 14Z',c,z,2)+R(24,25,12,37,'#a6b0ad',1,z)+Array.from({length:5},(_,i)=>L(24,30+i*6,36,27+i*6,z,1)).join('');
 case 'flower pot':return P('M12 29H48L42 61H18Z',c,z,2)+L(30,29,30,6,leaf,4)+P('M30 20Q5 7 8 0Q27 0 30 20 M30 15Q55 2 55 10Q48 25 30 15Z',leaf);
 case 'bread roll':return E(30,38,28,19,c)+P('M13 26L22 41M26 21L35 39M39 24L48 40','none',white,3);
 case 'dumbbell':return R(9,24,42,12,'#6c7776',3,z)+R(0,11,14,38,c,4,z)+R(46,11,14,38,c,4,z);
 case 'shell':return P('M30 59Q-8 42 4 19Q11 0 30 8Q49 0 56 19Q68 42 30 59Z',c,z,2)+P('M30 59L11 20M30 59L30 12M30 59L49 20','none',white,2);
 case 'log':return R(7,16,44,33,c,12,z,2)+E(48,32,11,17,'#d9b98c')+E(48,32,6,10,'none')+L(12,25,40,25,z);
 case 'flower':return L(30,33,30,62,leaf,4)+O(30,11,10,c)+O(12,25,10,c)+O(48,25,10,c)+O(30,40,10,c)+O(30,25,9,'#e4b64f');
 case 'cone':return P('M30 1L53 53H7Z',c,z,2)+P('M20 24H40L44 34H16Z',white)+R(2,52,56,10,c,2,z);
 case 'cup':return R(7,12,36,44,c,5,z,2)+P('M43 19Q66 16 58 38L43 42','none',c,5)+E(25,12,18,5,white);
 default:throw Error('Unknown scene object '+name);
 }
}
function clock(h){const a=h*Math.PI/6;return O(0,0,29,'#80664c',ink,2)+O(0,0,24,white)+Array.from({length:12},(_,i)=>L(Math.sin(i*Math.PI/6)*20,-Math.cos(i*Math.PI/6)*20,Math.sin(i*Math.PI/6)*23,-Math.cos(i*Math.PI/6)*23,ink,1.5)).join('')+L(0,0,Math.sin(a)*13,-Math.cos(a)*13,ink,4)+L(0,0,0,-19,ink,2)+O(0,0,2,ink)}
function sky(w,x,y,width,height){let a=R(x,y,width,height,w==='sunny'?'#a8d3e4':w==='rainy'?'#aabdc7':'#c9dce6');
 if(w==='sunny')a+=O(x+width*.77,y+height*.25,Math.min(24,height*.14),'#ffe4a0');
 else if(w==='rainy'){a+=E(x+width*.33,y+height*.18,width*.19,12,'#e6eaeb')+E(x+width*.72,y+height*.28,width*.18,10,'#e6eaeb');for(let i=0;i<18;i++){const X=x+12+(i*43)%(width-24),Y=y+25+(i*29)%(height-43);a+=L(X,Y,X-5,Y+10,'#6d8ea3',2)}}
 else for(let i=0;i<22;i++)a+=O(x+8+(i*37)%(width-16),y+8+(i*19)%(height-16),2.7,'#fff');
 return a}
function feature(r){const c=r.main[1],z=ink;let f='';
 switch(r.place){
 case 'living-room':f=R(0,100,290,100,c,18,z,2)+R(18,62,254,110,c,22,z,2)+R(-10,126,42,81,c,12,z,2)+R(258,126,42,81,c,12,z,2)+R(36,96,55,52,'#f4d9a4',8,z)+R(198,96,55,52,'#e3e7dc',8,z)+L(38,205,35,220,z,5)+L(252,205,255,220,z,5);break;
 case 'bedroom':f=R(0,42,280,130,wood,12,z,2)+R(8,102,264,105,white,10,z,2)+R(3,140,274,70,c,7,z,2)+R(18,100,100,40,white,9,z)+R(162,100,100,40,white,9,z)+L(18,210,18,220,z,6)+L(260,210,260,220,z,6);break;
 case 'study':f=R(0,92,280,12,wood,3,z)+R(12,104,12,115,wood,2,z)+R(256,104,12,115,wood,2,z)+R(100,26,90,62,dark,5,z)+R(107,33,76,46,'#accbd0',2)+R(141,88,10,9,z)+R(111,123,69,67,c,10,z,2)+R(95,185,100,16,c,7,z,2)+L(145,202,145,220,z,5)+L(111,220,180,220,z,4);break;
 case 'kitchen':f=R(0,135,295,85,wood,4,z)+R(0,130,295,10,'#e8d9bb',2,z)+R(0,54,142,57,'#eee4ce',4,z)+R(16,65,51,34,'#c7d1bf',3,z)+R(75,65,51,34,'#c7d1bf',3,z)+R(157,25,128,193,c,10,z,2)+L(157,94,285,94,z,3)+L(170,51,170,80,z,4)+L(170,114,170,146,z,4)+R(20,148,103,57,'#697573',4,z)+R(31,158,81,35,'#353d40',3);break;
 case 'cafe':f=R(0,122,294,96,c,5,z,2)+R(-5,116,304,12,wood,4,z)+R(23,143,248,52,'#f2e4ce',3,z)+R(15,41,263,46,dark,4,wood,3)+P('M38 56H93M38 69H82M135 56H190M135 69H201','none','#fff2d0',3)+R(107,91,70,25,'#9ca6a4',4,z)+O(142,104,8,dark);break;
 case 'library':f=R(-12,19,304,200,wood,3,z,2)+Array.from({length:4},(_,i)=>R(0,27+i*47,280,37,'#e0c9a7',1,z)+Array.from({length:7},(_,j)=>R(6+j*37,33+i*47+(j%3)*3,29,30-(j%3)*3,C[(i+j)%6][1],1,z)).join('')).join('')+R(80,135,117,80,c,16,z,2)+R(64,187,149,32,c,9,z,2);break;
 case 'art-studio':f=P('M46 220L130 8L218 220M133 91L268 220','none',c,13)+R(68,30,154,123,'#fff3d9',2,wood,3)+P('M71 147L113 77L151 128L183 85L218 147Z','#769d8f')+O(180,55,15,'#e4b353')+R(64,151,163,9,c,3,z);break;
 case 'music-room':f=R(7,53,280,150,c,8,z,2)+R(18,133,258,52,white,2,z)+Array.from({length:14},(_,i)=>L(19+i*18.4,134,19+i*18.4,184,z,1)).join('')+Array.from({length:10},(_,i)=>R(27+i*24,134,10,29,dark,1)).join('')+R(23,200,12,20,z)+R(263,200,12,20,z)+R(101,23,92,43,white,2,z)+P('M115 34H179M115 44H179M115 54H179','none',z,1);break;
 case 'classroom':f=R(0,19,290,140,wood,4,z,2)+R(10,29,270,120,c,3,z)+P('M30 62H100M30 81H127M167 49L227 112L150 112Z','none',white,3)+R(8,159,274,9,wood,2,z)+R(20,180,250,12,wood,2,z)+R(32,192,11,28,wood,1,z)+R(245,192,11,28,wood,1,z);break;
 case 'workshop':f=R(0,105,285,115,c,4,z,2)+Array.from({length:3},(_,i)=>R(12,117+i*32,261,25,c,2,z)+L(115,129+i*32,170,129+i*32,white,4)).join('')+R(-4,94,293,14,wood,3,z)+R(24,18,235,68,'#bba487',4,z)+P('M42 35H235M42 53H235M42 71H235','none','#836b55',2)+G(65,20,icon('hammer','#738596'),.8)+G(190,20,icon('wrench','#979e9c'),.8);break;
 case 'greenhouse':f=R(0,116,290,19,c,4,z,2)+R(10,135,12,84,c,2,z)+R(267,135,12,84,c,2,z)+Array.from({length:4},(_,i)=>G(12+i*70,54,icon('flower pot',['#b48160','#c89c71','#ad845f','#c28a63'][i]),1)).join('')+P('M0 0V116M290 0V116M145 0V116','none','#a9bdb1',3);break;
 case 'flower-shop':f=R(0,88,290,132,c,5,z,2)+R(9,99,272,52,'#f4e4d2',3,z)+R(9,158,272,52,'#e7d7c1',3,z)+G(25,25,icon('vase','#d1a87b'),.95)+G(120,25,icon('vase','#b9c5a5'),.95)+G(215,25,icon('vase','#c59ca2'),.95);break;
 case 'bakery':f=R(0,84,290,136,c,6,z,2)+R(12,27,266,143,'#e9e5d5',9,z,2)+R(20,37,250,123,'#f9f0da',6,z)+L(20,96,270,96,wood,5)+G(30,38,icon('cake','#c58468'),.8)+G(115,42,icon('cake','#c1a879'),.8)+G(200,38,icon('cake','#c79a84'),.8)+R(22,119,246,12,wood,2,z);break;
 case 'laundry':f=R(10,36,150,184,c,10,z,2)+R(20,49,130,30,c,3,z)+O(42,63,6,white,z)+O(125,63,7,dark,z)+O(85,145,53,dark,z,3)+O(85,145,42,'#99bbc4',z,3)+P('M57 156Q82 108 114 157','none','#d6e6db',10)+R(172,98,112,122,wood,4,z)+R(179,110,98,50,'#e7ddc7',3,z)+R(179,167,98,43,'#e7ddc7',3,z);break;
 case 'gym':f=R(18,149,246,29,c,10,z,2)+R(55,64,142,86,c,12,z,2)+L(35,178,35,218,z,9)+L(245,178,245,218,z,9)+L(198,145,231,217,z,7)+P('M4 25H284M35 25V70M252 25V70','none','#7b8886',7)+O(35,74,14,'#62706d')+O(252,74,14,'#62706d');break;
 case 'beach':f=P('M-5 89Q35 2 145 2T295 89Q258 71 220 89Q183 71 145 89Q108 71 70 89Q33 71-5 89Z',c,z,2)+P('M145 2Q103 45 145 89Q188 45 145 2Z',white,z)+L(145,89,145,220,z,5)+E(145,220,82,9,'#b28e65');break;
 case 'campsite':f=P('M0 220L130 31L290 220Z',c,z,3)+P('M130 31L211 220H58Z','#dac7a0',z,2)+P('M130 80L179 220H83Z','#534b41',z,2)+L(130,31,130,80,z,4)+L(2,220,-15,230,z,3)+L(288,220,305,230,z,3);break;
 case 'park':f=R(9,100,272,23,c,4,z,2)+R(9,129,272,23,c,4,z,2)+R(2,170,286,23,c,5,z,2)+L(35,100,35,220,z,7)+L(255,100,255,220,z,7)+L(4,145,4,178,z,6)+L(286,145,286,178,z,6)+L(4,145,28,145,z,5)+L(260,145,286,145,z,5);break;
 case 'playground':f=P('M25 220V43H96V220','none','#8e7759',9)+R(17,29,88,15,wood,3,z)+P('M95 51Q145 159 284 198L278 220Q129 182 77 58Z',c,z,3)+Array.from({length:5},(_,i)=>L(25,66+i*30,69,66+i*30,z,5)).join('');break;
 case 'market':f=R(0,120,290,100,c,4,z,2)+R(5,56,10,65,wood,2,z)+R(275,56,10,65,wood,2,z)+P('M-12 55L16 4H274L302 55Z',c,z,2)+Array.from({length:5},(_,i)=>P('M'+(18+i*54)+' 4H'+(42+i*54)+'L'+(54+i*58)+' 55H'+(25+i*58)+'Z',white)).join('')+R(-4,116,298,13,wood,3,z);break;
 }
 return f;
}
function render(r){
 const w=760,h=480,indoor=r.kind==='indoor',layout=r.layout,c=r.main[1];
 let bg='',outside=sky(r.weather,0,0,w,270);
 if(indoor){
  bg=R(0,0,w,h,r.wall)+R(0,292,w,188,r.floor)+R(0,286,w,12,'#f4ecdc',0,'#a89783');
  for(let i=0;i<7;i++)bg+=L(0,312+i*25,w,312+i*25,'#8e725444',1);
  const wx=[45,545,48,550,292][layout],wy=layout===4?17:40,ww=layout===4?176:158,wh=layout===4?95:141;
  bg+=R(wx-7,wy-7,ww+14,wh+14,white,3,ink,2)+sky(r.weather,wx,wy,ww,wh)+L(wx+ww/2,wy,wx+ww/2,wy+wh,white,5)+L(wx,wy+wh/2,wx+ww,wy+wh/2,white,5);
  const cx=[652,106,652,106,630][layout];bg+=G(cx,82,clock(r.clock));
  // Five compositions have visibly different wall accents.
  if(layout===0||layout===3)bg+=R(305,20,104,11,wood,2)+R(320,31,12,27,wood,2)+R(382,31,12,27,wood,2);
  if(layout===1||layout===2)bg+=R(310,25,88,44,'#d5c6a9',3,wood,4)+P('M324 56L346 33L373 56Z','#789384');
 }else{
  bg=outside+R(0,270,w,210,r.kind==='beach'?'#dfc69b':r.weather==='snowy'?'#edf1e9':'#9ab485');
  if(r.kind==='beach'){bg+=R(0,160,w,110,'#80b4ca')+P('M0 251Q80 237 160 251T320 251T480 251T640 251T800 251','none','#f7f6df',5)}
  else{for(let i=0;i<5;i++){const x=45+i*168;bg+=R(x,104,12,172,'#92745a')+P('M'+(x-52)+' 147L'+(x+6)+' 20L'+(x+64)+' 147Z','#769b70')+P('M'+(x-40)+' 105L'+(x+6)+' 9L'+(x+50)+' 105Z','#83a97d')}}
  if(r.weather==='snowy')bg+=P('M0 285Q120 268 240 285T480 285T760 285','none','#fff',7);
 }
 const fx=[230,225,95,375,230][layout],fy=layout===4?111:96;
 // Count group sits on its own clearly separated shelf/tray/ground area.
 const countX=[45,500,510,38,280][layout],countY=layout===4?306:252;
 let count=R(countX-7,countY+35,222,11,indoor?'#9d7958':'#b5a387',4,ink,1.5);
 const itemColor=['#c18b5e','#9aabd0','#b3ad82','#ca9d9c','#b0a2c3'];
 for(let i=0;i<r.count;i++)count+=G(countX+5+i*41,countY-5,icon(r.countItem,itemColor[i]),.62);
 // One coherent surface, two objects on opposite sides, away from count group.
 const tableX=[84,98,83,95,88][layout],tableY=399;
 let table;
 if(r.place==='beach')table=R(tableX,tableY-9,580,67,'#e8d0a0',9,ink,2)+P('M100 411H640M100 431H640M100 451H640','none','#fff0d1',3);
 else table=R(tableX,tableY,580,18,wood,7,ink,2)+R(tableX+18,tableY+17,13,54,wood,3,ink)+R(tableX+549,tableY+17,13,54,wood,3,ink);
 let objects='';
 for(const o of r.objects){const x=o.side==='left'?tableX+90:tableX+430;objects+=G(x,tableY-67,icon(o.name,o.color[1]),1.05)}
 const focus=G(fx,fy,feature(r),layout===4?.87:1);
 return '<svg class="ai-room" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" role="img" aria-label="Illustrated '+r.theme+'">'+bg+focus+count+table+objects+'</svg>';
}
root.AfterimageScenes=Object.freeze({TEMPLATES,make,next,signature,render});
})(typeof globalThis==='object'?globalThis:window);
