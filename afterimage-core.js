/* AFTERIMAGE — a single illustrated room, five objectively scored questions. */
(function(root){
'use strict';
const SCAN=25,ANSWER=15;
const PALETTE=[['red','#b94f4d'],['blue','#467eac'],['green','#51835c'],['yellow','#d8ae46'],['purple','#8761a6'],['orange','#d18546']];
const THEMES=['living room','bedroom','study'];
const PROPS=['camera','headphones','vase','alarm clock','telescope'];
const ART=['mountains','sailboat','sunflower'];
const WEATHER=['sunny','rainy','snowy'];
function random(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296}}
function shuffle(xs,r){const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function generate(seed){
 const r=random(seed),pick=a=>a[Math.floor(r()*a.length)],int=(a,b)=>a+Math.floor(r()*(b-a+1));
 const [furniture,mug,rug,curtain]=shuffle(PALETTE,r);
 const theme=pick(THEMES),room={theme,furniture,mug,rug,curtain,books:int(2,5),cushions:int(1,3),hour:int(1,12),weather:pick(WEATHER),picture:pick(ART),prop:pick(PROPS),plant:pick(['left','right']),mirror:r()<.5,wall:pick(['#e6ddcd','#dce8dd','#e5e2ee','#f1e0d2']),floor:pick(['#b48c68','#a88b70','#c4a17b'])};
 // Each question refers to a single visible object or an exact count.
 const q=(id,prompt,answer,aliases=[],why='')=>({id,prompt,answer:String(answer),aliases,why});
 const seat=theme==='living room'?'sofa':theme==='bedroom'?'bedspread':'desk chair';
 const cushionName=theme==='bedroom'?'pillows':'cushions';
 const colors=a=>a==='purple'?['violet']:a==='green'?[]:a==='yellow'?['gold']:a==='orange'?[]:[];
 const easy=[
 q('mug','What color was the mug on the table?',mug[0],[...colors(mug[0])],'Look at the mug on the small table.'),
 q('furniture','What color was the '+seat+'?',furniture[0],colors(furniture[0]),'Look at the '+seat+'.'),
 q('weather','What was the weather outside the window?',room.weather,{sunny:['sun','clear','clear skies','sunshine'],rainy:['rain','raining','rainfall'],snowy:['snow','snowing','snowfall']}[room.weather],'Look through the window.'),
 q('prop','What object, besides the mug, was on the small table?',room.prop,{camera:['photo camera'],headphones:['headset','earphones'],vase:['flower vase','flowers'], 'alarm clock':['clock','alarm'],telescope:['spyglass']}[room.prop],'The two items on the table were a mug and '+(room.prop==='headphones'?'headphones':'a '+room.prop)+'.'),
 q('picture','What was depicted in the framed picture on the wall?',room.picture,{mountains:['mountain','mountain range','hills'],sailboat:['boat','sailing boat','ship'],sunflower:['flower','sun flower']}[room.picture],'Look at the framed artwork.')];
 const medium=[
 q('books','How many books were standing on the wall shelf?',room.books,[],'Count the books on the shelf.'),
 q('plant','Was the large potted plant on the left or right side of the room?',room.plant,[room.plant+' side','on the '+room.plant],'Look at the large floor plant.'),
 q('rug','What color was the rug on the floor?',rug[0],colors(rug[0]),'Look at the floor rug.'),
 q('curtain','What color were the curtains?',curtain[0],colors(curtain[0]),'Look on either side of the window.')];
 if(theme!=='study')medium.push(q('cushions','How many '+cushionName+' were on the '+(theme==='bedroom'?'bed':'sofa')+'?',room.cushions,[],'Count the '+cushionName+' on the furniture.'));
 const hard=[q('hour','What hour was shown on the wall clock? (It was exactly on the hour.)',room.hour,[room.hour+':00',room.hour+' o clock',room.hour+" o'clock"],'The long hand points to 12 and the short hand points to '+room.hour+'.')];
 // Five questions are revealed only after the room disappears: 2 easy, 2 medium, 1 challenging.
 const questions=[...shuffle(easy,r).slice(0,2),...shuffle(medium,r).slice(0,2),...hard];
 return {seed:seed>>>0,room,questions,scan:SCAN,answer:ANSWER};
}
const EQUIVALENTS={
 "prop": {
  "camera": [
   "photo camera",
   "digital camera",
   "film camera",
   "camera with a lens"
  ],
  "headphones": [
   "headphone",
   "headset",
   "earphones",
   "earbuds",
   "pair of headphones",
   "over ear headphones"
  ],
  "vase": [
   "flower vase",
   "vase of flowers",
   "vase with flowers",
   "vase containing flowers",
   "flower pot",
   "flowerpot",
   "pot of flowers",
   "pot with flowers",
   "flowers",
   "flower",
   "potted flowers",
   "flower arrangement",
   "bouquet",
   "bouquet of flowers",
   "plant",
   "potted plant",
   "pot plant",
   "plant pot",
   "flower pot with flowers"
  ],
  "alarm clock": [
   "clock",
   "alarm",
   "table clock",
   "desk clock",
   "analog clock",
   "analogue clock",
   "small clock",
   "bedside clock"
  ],
  "telescope": [
   "spyglass",
   "spy glass",
   "scope",
   "small telescope",
   "telescope on a tripod",
   "spotting scope"
  ]
 },
 "picture": {
  "mountains": [
   "mountain",
   "mountain range",
   "mountain landscape",
   "mountain scenery",
   "snow capped mountains",
   "snowy mountains",
   "mountain scene",
   "hills",
   "picture of mountains"
  ],
  "sailboat": [
   "sail boat",
   "boat",
   "sailing boat",
   "sailing ship",
   "ship",
   "boat on water",
   "boat on the water",
   "boat at sea"
  ],
  "sunflower": [
   "flower",
   "flowers",
   "sun flower",
   "sunflowers",
   "yellow flower",
   "picture of a flower"
  ]
 },
 "weather": {
  "sunny": [
   "sun",
   "clear",
   "clear skies",
   "sunshine",
   "sunny day",
   "clear sky",
   "bright and sunny",
   "sunny outside"
  ],
  "rainy": [
   "rain",
   "raining",
   "rainfall",
   "rainy day",
   "wet weather",
   "rainy outside"
  ],
  "snowy": [
   "snow",
   "snowing",
   "snowfall",
   "snowy day",
   "snowy outside"
  ]
 },
 "color": {
  "red": [
   "reddish",
   "brick red",
   "dark red",
   "light red",
   "muted red",
   "rust red",
   "maroon",
   "burgundy"
  ],
  "blue": [
   "bluish",
   "light blue",
   "dark blue",
   "sky blue",
   "navy blue",
   "navy",
   "muted blue",
   "steel blue"
  ],
  "green": [
   "greenish",
   "light green",
   "dark green",
   "sage",
   "sage green",
   "olive",
   "olive green",
   "forest green",
   "muted green"
  ],
  "yellow": [
   "yellowish",
   "gold",
   "golden",
   "golden yellow",
   "mustard",
   "mustard yellow",
   "light yellow",
   "dark yellow"
  ],
  "purple": [
   "purplish",
   "violet",
   "lavender",
   "lilac",
   "light purple",
   "dark purple",
   "muted purple"
  ],
  "orange": [
   "orangish",
   "orangeish",
   "burnt orange",
   "rust orange",
   "light orange",
   "dark orange",
   "muted orange",
   "terracotta"
  ]
 },
 "plant": {
  "left": [
   "left side",
   "on the left",
   "on the left side",
   "left hand side",
   "left of the room",
   "left side of the room",
   "on the left side of the room"
  ],
  "right": [
   "right side",
   "on the right",
   "on the right side",
   "right hand side",
   "right of the room",
   "right side of the room",
   "on the right side of the room"
  ]
 }
};
const nums={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
function normalize(raw){
 let s=String(raw??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/[.!?]+$/,'').replace(/[’‘]/g,"'").replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
 s=s.replace(/^(?:i (?:think|remember) (?:it was |there were |there was )?|it (?:was|is) |there (?:were|was) )/,'').replace(/^(?:the|a|an)\s+/,'').trim();
 if(/^\d+$/.test(s))return String(Number(s));
 return nums[s]||s;
}
function category(q){return ['mug','furniture','rug','curtain'].includes(q.id)?'color':q.id}
function parseNumber(s,q){
 if(q.id==='hour'||q.id==null){
  const m=s.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?::00(?:\s*(?:am|pm|a\.m\.?|p\.m\.?))?|\s*(?:am|pm|a\.m\.?|p\.m\.?)|\s+o(?:'|\s)?clock)$/);
  if(m)return nums[m[1]]||String(Number(m[1]));
 }
 if(q.id==='books'||q.id==='cushions'){
  const m=s.match(/^(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(books?|pillows?|cushions?)$/);
  if(m&&(q.id==='books'?/^books?$/.test(m[2]):/^(pillows?|cushions?)$/.test(m[2])))return nums[m[1]]||String(Number(m[1]));
 }
 return s;
}
function oneTypo(a,b){
 if(a===b||Math.min(a.length,b.length)<4||Math.abs(a.length-b.length)>1||!(/^[a-z ]+$/.test(a)&&/^[a-z ]+$/.test(b))||a.includes(' ')!==b.includes(' '))return false;
 if(a.length===b.length){const dif=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])dif.push(i);
 return (a.length>=5&&dif.length===1)||(dif.length===2&&dif[1]===dif[0]+1&&a[dif[0]]===b[dif[1]]&&a[dif[1]]===b[dif[0]])}
 if(a.length>b.length)[a,b]=[b,a];let i=0;while(i<a.length&&a[i]===b[i])i++;return a.slice(i)===b.slice(i+1);
}
function correct(q,a){
 let s=normalize(a);if(!s)return false;const expected=normalize(q.answer);
 if(/^\d+$/.test(expected))return parseNumber(s,q)===expected;
 const group=EQUIVALENTS[category(q)]||{};
 const accepted=[q.answer,...(q.aliases||[]),...(group[q.answer]||[])].map(normalize);
 if(category(q)==='color')s=s.replace(/\s+(?:colored|coloured|color|colour)$/,'');
 if(accepted.includes(s))return true;
 const others=Object.entries(group).filter(([key])=>key!==q.answer).flatMap(([key,aliases])=>[key,...aliases]).map(normalize);
 if(others.includes(s)||others.some(x=>oneTypo(s,x)))return false;
 return accepted.some(x=>oneTypo(s,x));
}
function grade(q,a){const ok=correct(q,a);return {answer:String(a??'').trim(),correct:ok,points:ok?100:0}}
// All room art is drawn from the same data used to produce the questions.
// Fixed perspective and clear silhouettes avoid ambiguous or hidden details.
function roomSVG(r){
 const {theme}=r;const furniture=r.furniture[1],mug=r.mug[1],rug=r.rug[1],curtain=r.curtain[1];
 const rect=(x,y,w,h,fill,rx=0,stroke='none',sw=1)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
 const line=(x,y,x2,y2,stroke='#594d42',sw=2)=>'<path d="M'+x+' '+y+'L'+x2+' '+y2+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round" fill="none"/>';
 const circle=(x,y,rad,fill,stroke='none',sw=1)=>'<circle cx="'+x+'" cy="'+y+'" r="'+rad+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
 const path=(d,fill,stroke='none',sw=1)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linejoin="round" stroke-linecap="round"/>';
 const group=(x,y,s)=>'<g transform="translate('+x+' '+y+')">'+s+'</g>';
 const shadow=(x,y,rx,ry)=>'<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="#382d2a" opacity=".13"/>';
 const outside=r.weather==='sunny'?'#9ecde0':r.weather==='rainy'?'#a1b3bf':'#c4d7e1';
 let sky=rect(0,0,164,134,outside);
 if(r.weather==='sunny'){sky+=circle(124,30,17,'#ffe5a0')+path('M0 110L46 66L84 108L126 83L164 109V134H0Z','#85ad8c')+path('M0 126Q41 93 83 117T164 111V134H0Z','#729c7c')}
 else if(r.weather==='rainy'){sky+=path('M10 37Q9 24 23 23Q29 4 49 12Q68 5 76 23Q92 23 91 39Z','#e0e5e6')+path('M98 31Q100 18 112 20Q119 6 134 15Q149 13 155 31Z','#d4dce2');for(let i=0;i<12;i++)sky+=line(12+(i%6)*26,53+Math.floor(i/6)*36,6+(i%6)*26,68+Math.floor(i/6)*36,'#5d829b',3)}
 else {sky+=path('M0 110Q47 82 86 110T164 108V134H0Z','#f7f9fb');for(let i=0;i<13;i++)sky+=circle(10+(i*37)%148,12+(i*19)%92,3,'#fff')}
 const window=group(61,55,rect(-8,-8,180,150,'#f9f5e9',4,'#776e61',2)+sky+line(82,0,82,134,'#f8f5ed',6)+line(0,67,164,67,'#f8f5ed',6)+rect(-13,135,190,10,'#f7f2e5',2,'#9c8978')+line(-20,-10,184,-10,'#715a48',5)+path('M-14 -7H22Q10 50 24 91L22 141H-19Z',curtain,'#63584c',1.5)+path('M142 -7H178L183 141H142L140 91Q154 51 142 -7Z',curtain,'#63584c',1.5)+path('M-9 0V132M4 0L1 132M162 0L165 132M174 0L175 132','none','#fff',1.2));
 let picture;
 if(r.picture==='mountains')picture=rect(0,0,124,79,'#b3d4df')+circle(94,17,10,'#ffe3a5')+path('M0 79L37 22L70 70L93 39L124 79Z','#577e7c')+path('M23 45L37 22L52 44L38 37Z','#f8f6e9');
 else if(r.picture==='sailboat')picture=rect(0,0,124,79,'#c4e0e7')+rect(0,47,124,32,'#538eb0')+path('M20 55H96L82 68H36Z','#a96743')+path('M61 9V52H23Z','#fff4da','#64594b')+path('M65 17L91 49H65Z','#e4b762');
 else picture=rect(0,0,124,79,'#e8dfc8')+line(62,40,62,79,'#5f845c',5)+path('M62 64Q35 45 31 60Q48 78 62 64 M62 65Q88 44 93 61Q81 78 62 65Z','#719d63'); 
 if(r.picture==='sunflower'){for(let i=0;i<10;i++){const a=i*Math.PI/5;picture+=circle(62+Math.cos(a)*18,30+Math.sin(a)*18,9,'#d9a536')}picture+=circle(62,30,12,'#82592f')}
 const frame=group(303,42,rect(-8,-8,140,95,'#765b43',3)+rect(-4,-4,132,87,'#f8efdc',2)+picture);
 let clock=circle(0,0,38,'#6c5541')+circle(0,0,33,'#fff8e9');
 for(let i=0;i<12;i++){const a=i*Math.PI/6;clock+=line(Math.sin(a)*27,-Math.cos(a)*27,Math.sin(a)*30,-Math.cos(a)*30,'#806d54',2)}
 clock+='<text x="0" y="-19" text-anchor="middle" font-size="9" fill="#564c42">12</text><text x="24" y="3" text-anchor="middle" font-size="9" fill="#564c42">3</text><text x="0" y="27" text-anchor="middle" font-size="9" fill="#564c42">6</text><text x="-24" y="3" text-anchor="middle" font-size="9" fill="#564c42">9</text>';
 const angle=r.hour*Math.PI/6;clock+=line(0,0,Math.sin(angle)*17,-Math.cos(angle)*17,'#473c35',5)+line(0,0,0,-25,'#473c35',2.5)+circle(0,0,3,'#473c35');
 const shelf=group(526,105,rect(-12,0,156,9,'#86674e',2)+path('M0 9H10L0 27ZM125 9H135L135 27Z','#80634f')+Array.from({length:r.books},(_,i)=>{const h=[48,38,43,33,46][i];return rect(5+i*23,-h,19,h,['#728f9a','#a35e50','#8c9c69','#d3ae57','#897da2'][i],1,'#544c43')+line(8+i*23,-h+6,20+i*23,-h+6,'#fff2d2',2)+line(8+i*23,-6,20+i*23,-6,'#fff2d2',2)}).join(''));
 const wallClock=group(474,77,clock);
 let big='';
 if(theme==='living room'){
 big=shadow(375,342,146,17)+rect(234,310,12,34,'#74563d',3)+rect(503,310,12,34,'#74563d',3)+rect(240,192,274,127,furniture,25,'#64574d',2)+rect(252,206,250,83,furniture,17,'#6a665e',1)+path('M257 282Q375 266 497 282V316H257Z',furniture,'#635a51',2)+rect(220,260,44,67,furniture,15,'#64574d',2)+rect(490,260,44,67,furniture,15,'#64574d',2)+line(267,307,487,307,'#ffffff55',2);
 for(let i=0;i<r.cushions;i++){const x=276+i*72;big+=rect(x,217,55,55,['#f1d9ab','#d7e2d3','#e9d4d0'][i],9,'#776d60',1.5)+line(x+7,224,x+48,264,'#ffffff88',2)}
 }else if(theme==='bedroom'){
 big=shadow(369,355,152,17)+rect(234,173,280,127,'#886a52',14,'#64574d',2)+rect(244,236,260,108,'#eae3d5',11,'#76695b',2)+rect(235,320,12,37,'#74563d',3)+rect(502,320,12,37,'#74563d',3)+rect(240,266,268,80,furniture,8,'#64574d',2)+path('M240 283H508V303H240Z','#ffffff29')+line(244,333,504,333,'#ffffff66',2);
 for(let i=0;i<r.cushions;i++)big+=rect(254+i*80,212,71,48,'#f9f4e7',11,'#9f927f',1.5);
 }else{
 big=shadow(380,342,126,15)+rect(239,227,279,13,'#94755b',4,'#685444',1.5)+rect(250,240,12,102,'#84664d',2)+rect(495,240,12,102,'#84664d',2)+rect(431,241,64,61,'#a3866a',4)+line(439,271,487,271,'#74583f')+line(456,259,469,259,'#574434',3)+line(456,286,469,286,'#574434',3)+rect(332,162,90,60,'#47565a',5)+rect(338,168,78,47,'#b5d0d3',2)+rect(371,222,12,6,'#586463')+rect(350,226,54,5,'#4d5b5a')+rect(343,257,65,64,furniture,11,'#5c554b',2)+rect(329,308,93,23,furniture,8,'#5c554b',2)+line(376,332,376,353,'#5a514a',7)+line(342,353,410,353,'#5a514a',5)+circle(343,356,5,'#504943')+circle(409,356,5,'#504943');
 }
 const plantX=r.plant==='left'?106:647;
 const plant=group(plantX,276,shadow(0,83,43,8)+path('M-29 40H29L21 81H-21Z','#b37551','#77533d',2)+rect(-32,35,64,12,'#c68a62',4,'#77533d')+line(0,36,0,-55,'#4c7852',4)+path('M0 14Q-40 1-41-30Q-9-33 0 14 M0-8Q31-50 39-24Q35-2 0-8 M0-28Q-24-63-35-50Q-44-29 0-28 M0-44Q12-82 29-70Q44-43 0-44Z','#65966a','#446e4b',2)+path('M0 22Q33-16 45 5Q42 27 0 22Z','#83aa77','#446e4b',2));
 const mugArt=group(0,0,rect(0,0,28,32,mug,5,'#544b42',1.5)+path('M28 7Q46 4 42 17Q40 24 28 24','none',mug,6)+path('M5 6H23','none','#ffffff99',2)+path('M8-4Q3-12 10-17 M18-4Q13-12 20-17','none','#f2eee4',2));
 let prop='';
 if(r.prop==='camera')prop=rect(0,2,53,34,'#41494b',6,'#2d3637',2)+rect(7,-4,18,9,'#4d5758',2)+circle(27,19,13,'#b0b9b5','#292d2c',2)+circle(27,19,8,'#546a78')+circle(24,16,3,'#b9d6e1');
 else if(r.prop==='headphones')prop=path('M4 26V15Q4-8 27-8T50 15V26','none','#3c484c',8)+rect(0,15,15,27,'#4e5c61',5,'#263538',2)+rect(39,15,15,27,'#4e5c61',5,'#263538',2);
 else if(r.prop==='vase')prop=path('M14 9H36L31 23Q49 45 25 48Q1 45 19 23Z','#d9a86a','#7d674d',2)+line(24,8,14,-21,'#61885b',3)+line(26,8,38,-18,'#61885b',3)+circle(14,-23,8,'#c76664')+circle(38,-20,8,'#d5aa52');
 else if(r.prop==='alarm clock')prop=circle(26,20,22,'#a58462','#66523e',2)+circle(26,20,17,'#f7f0de')+line(26,20,26,8,'#554a3d',2)+line(26,20,35,24,'#554a3d',2)+path('M4 0Q5-12 18-5M34-5Q47-12 48 0','none','#695445',5)+line(10,40,6,47,'#66523e',3)+line(42,40,46,47,'#66523e',3);
 else prop=path('M3 13L43-5L51 6L12 25Z','#738d98','#41545c',2)+path('M42-5L51-9L57 2L51 6Z','#394b51')+line(28,15,26,42,'#645441',4)+line(26,25,8,42,'#645441',3)+line(26,25,46,42,'#645441',3);
 const tableX=r.plant==='left'?586:105;
 const table=group(tableX,355,shadow(0,63,76,10)+path('M-61 8H-49L-54 64H-65ZM49 8H61L65 64H54Z','#75583f','#5b4939')+rect(-75,-3,150,18,'#9c7757',8,'#634e3b',2)+group(-54,-35,mugArt)+group(13,-40,prop));
 let floorLines='';for(let i=0;i<8;i++)floorLines+=line(0,306+i*25,760,306+i*25,'#80634544',1.5);
 const room='<svg class="ai-room" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 480" role="img" aria-label="Illustrated '+theme+'"><defs><linearGradient id="roomLight" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#655742" stop-opacity=".05"/></linearGradient></defs>'+rect(0,0,760,480,r.wall)+rect(0,0,760,290,'url(#roomLight)')+rect(0,290,760,190,r.floor)+floorLines+rect(0,283,760,13,'#e9e1d3',0,'#aa9a86')+path('M0 0H760V8H0Z','#f5ece0')+window+frame+wallClock+shelf+shadow(380,413,240,32)+rect(146,369,468,86,rug,32,'#6c5f53',1.5)+rect(156,378,448,68,'none',25,'#fff3d8',2)+line(185,387,575,387,'#ffffff55',2)+line(185,438,575,438,'#ffffff55',2)+big+plant+table+'</svg>';
 // Never mirror text or clock hands; variations come from layout, objects and palette.
 return room;
}
root.Afterimage=Object.freeze({generate,normalize,correct,grade,roomSVG,SCAN,ANSWER});
})(typeof globalThis==='object'?globalThis:window);
