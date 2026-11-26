/* AFTERIMAGE: deterministic randomized scenes and exact, local scoring. */
(function(root){
 'use strict';
 const ITEMS=[
 ['camera','M5 12h5l2-4h10l2 4h7v19H5z M18 15a6 6 0 1 0 0 12a6 6 0 1 0 0-12','photo camera'],
 ['key','M11 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M17 18l14 14 M24 25l4-4 M28 29l4-4','house key'],
 ['clock','M18 4a14 14 0 1 0 0 28a14 14 0 1 0 0-28 M18 9v10l7 4','watch,wall clock'],
 ['mug','M7 10h19v15q0 6-9 6t-10-6z M26 13h4q7 0 5 6t-9 5 M12 3v4 M20 3v4','cup,coffee mug'],
 ['umbrella','M3 17a15 15 0 0 1 30 0q-5-5-10 0q-5-5-10 0q-5-5-10 0z M18 3v26q0 5 5 5t5-5','parasol'],
 ['book','M3 8q8-3 15 2q7-5 15-2v24q-8-3-15 2q-7-5-15-2z M18 10v24 M7 15l7 1 M22 16l7-1','notebook'],
 ['bottle','M13 4h10v7l6 8v12q0 3-3 3H10q-3 0-3-3V19l6-8z M8 22h20','water bottle'],
 ['bell','M6 27q5-4 5-14a7 7 0 1 1 14 0q0 10 5 14z M15 30a3 3 0 0 0 6 0',''],
 ['compass','M18 3a15 15 0 1 0 0 30a15 15 0 1 0 0-30 M24 10l-3 11l-10 5l4-11z',''],
 ['scissors','M7 20a6 6 0 1 0 0 12a6 6 0 1 0 0-12 M28 20a6 6 0 1 0 0 12a6 6 0 1 0 0-12 M11 22L29 4 M24 22L7 4','shears'],
 ['lantern','M12 8h12l5 7v15H7V15z M12 8V5a6 6 0 0 1 12 0v3 M12 15v15 M24 15v15 M5 30h26','lamp'],
 ['globe','M18 4a12 12 0 1 0 0 24a12 12 0 1 0 0-24 M6 16h24 M18 4q-12 12 0 24q12-12 0-24 M18 28v5 M10 33h16','earth globe'],
 ['envelope','M3 8h30v21H3z M3 8l15 13L33 8 M3 29l11-12 M33 29L22 17','letter,mail'],
 ['headphones','M5 20v-4a13 13 0 0 1 26 0v4 M5 19h6v13H5z M25 19h6v13h-6z','headset'],
 ['pencil','M7 26L25 5l6 6L13 32l-8 2z M22 9l6 6 M7 26l6 6',''],
 ['flashlight','M4 15h13l10-6h5v18h-5l-10-6H4z M10 15v6 M27 9v18','torch'],
 ['shoe','M5 8h8l4 12l12 4q5 1 5 6H3v-7z M13 14l7-2 M15 18l7-2 M4 26h29','sneaker,trainer'],
 ['hourglass','M8 4h20 M8 32h20 M10 4q0 9 8 14q-8 5-8 14 M26 4q0 9-8 14q8 5 8 14 M12 9h12 M12 28h12','sand timer'],
 ['apple','M18 11q-8-8-13 1q-5 9 4 19q5 5 9 0q4 5 9 0q9-10 4-19q-5-9-13-1 M18 11q0-7 5-9 M19 7q6-6 12-1',''],
 ['anchor','M18 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M18 12v20 M10 15h16 M4 22q0 10 14 10t14-10 M4 22l5 5 M32 22l-5 5',''],
 ['trophy','M10 5h16v12q0 8-8 8t-8-8z M10 8H3v4q0 7 7 7 M26 8h7v4q0 7-7 7 M18 25v7 M10 32h16','cup trophy'],
 ['guitar','M22 14L31 3l3 3l-10 11 M21 14q-5-4-8 3q-8-2-10 6q-2 11 9 11q8 0 8-8q7-3 1-12z M12 22a3 3 0 1 0 0 6a3 3 0 1 0 0-6',''],
 ['glasses','M3 15h12l2 5h2l2-5h12v7q0 7-7 7t-7-7 M17 22q0 7-7 7t-7-7v-7 M3 15l3-5 M33 15l-3-5','eyeglasses,spectacles'],
 ['teapot','M9 15h19v10q0 7-10 7T8 25z M28 17q10-2 6 6l-6 2 M9 17L3 9l-2 2l7 13 M7 14h23 M16 10h6 M19 5v5','tea pot'],
 ['leaf','M30 4Q4 5 5 22q0 9 9 9q17-1 16-27z M4 33L25 10 M13 24l-1-9 M19 18l9 1',''],
 ['lock','M8 15h20v17H8z M12 15V9a6 6 0 1 1 12 0v6 M18 21v5','padlock'],
 ['brush','M13 3h10v18H13z M10 21h16v6l-4 7H14l-4-7z M15 27v5 M21 27v5','paintbrush,paint brush'],
 ['suitcase','M4 12h28v20H4z M12 12V6h12v6 M11 12v20 M25 12v20','luggage,case'],
 ['binoculars','M4 12h10l3 8v10H3V20z M22 12h10l1 8v10H19V20z M14 16h8 M3 25h14 M19 25h14',''],
 ['candle','M12 15h12v18H12z M18 3q8 9 0 10q-8-1 0-10z M18 13v3',''],
 ['hammer','M5 5h21v9H5z M13 14h5v19h-5z M26 5l6 2v5l-6 2',''],
 ['kite','M18 3L32 17L18 31L4 17z M18 3v28 M4 17h28 M18 31q10-1 12 4',''],
 ['hat','M10 9h16l3 17H7z M3 26h30v4H3z M10 20h16','cap'],
 ['fish','M5 18q9-12 21-4l7-6v20l-7-6q-12 8-21-4z M12 17h1',''],
 ['rocket','M18 3q10 9 9 21H9Q8 12 18 3z M9 17l-5 9h7 M27 17l5 9h-7 M14 27l4 7l4-7 M18 12a3 3 0 1 0 0 6a3 3 0 1 0 0-6','spaceship'],
 ['basket','M4 17h28l-4 15H8z M10 17q0-14 8-14t8 14 M12 21v7 M18 21v7 M24 21v7','']
 ];
 const COLORS=[['red','#be484f'],['blue','#3579b0'],['green','#438563'],['yellow','#bd912b'],['purple','#8a61ad'],['orange','#c46a38']];
 const MARKS=['circle','triangle','square','diamond'];
 const CONFIG=[{scan:20,answer:14},{scan:17,answer:13},{scan:14,answer:12}];
 const COUNT=12,COLS=4;
 function random(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296}}
 function shuffle(xs,r){const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
 function makeRound(index,r,items){
  // Exactly two of each color, three of each symbol; tags are distinct.
  const colors=shuffle(COLORS.flatMap(c=>[c,c]),r),marks=shuffle(MARKS.flatMap(m=>[m,m,m]),r),tags=shuffle(Array.from({length:90},(_,i)=>i+10),r);
  const board=items.map(([name,path,aliases],i)=>({name,path,aliases:aliases?aliases.split(','):[],color:colors[i][0],hex:colors[i][1],mark:marks[i],tag:tags[i],row:Math.floor(i/COLS),col:i%COLS}));
  const pick=a=>a[Math.floor(r()*a.length)],label=t=>t.name,word=(prompt,t,why)=>({prompt,answer:t.name,aliases:t.aliases,why,highlight:[board.indexOf(t)]}),num=(prompt,answer,why,highlight=[])=>({prompt,answer:String(answer),aliases:[],why,highlight}),attr=(prompt,t,k)=>({prompt,answer:String(t[k]),aliases:[],why:'The '+t.name+' had '+(k==='tag'?'tag '+t.tag:k==='color'?'a '+t.color+' color':'a '+t.mark+' symbol')+'.',highlight:[board.indexOf(t)]});
  const adj=shuffle(board.flatMap((t,i)=>[[0,-1,'left of'],[0,1,'right of'],[-1,0,'above'],[1,0,'below']].flatMap(([dr,dc,dir])=>{const y=t.row+dr,x=t.col+dc;return y>=0&&y<3&&x>=0&&x<4?[{a:t,b:board[y*4+x],dir}]:[]})),r);
  const pair=adj[0],pair2=adj.find(p=>![pair.a,pair.b].includes(p.a)&&![pair.a,pair.b].includes(p.b))||adj[1];
  const unique=shuffle(board,r), colorPair=pick(COLORS)[0], matching=board.filter(t=>t.color===colorPair),lower=matching.reduce((a,b)=>a.tag<b.tag?a:b);
  const row=1+Math.floor(r()*3),rowTiles=board.filter(t=>t.row===row-1),rowMax=rowTiles.reduce((a,b)=>a.tag>b.tag?a:b);
  const intersection=board.filter(t=>t.mark===pick(MARKS)); // unused; choose a real, uniquely identifying intersection below
  const signatures=board.filter(t=>board.filter(x=>x.color===t.color&&x.mark===t.mark).length===1),special=pick(signatures.length?signatures:board);
  const col=1+Math.floor(r()*4),colTiles=board.filter(t=>t.col===col-1),mark=pick(colTiles).mark,marked=colTiles.filter(t=>t.mark===mark);
  const corners=[board[0],board[3],board[8],board[11]],cornerMax=corners.reduce((a,b)=>a.tag>b.tag?a:b);
  let questions;
  if(index===0)questions=[
   attr('What color was the '+unique[0].name+'?',unique[0],'color'),
   word('Which object was directly '+pair.dir+' the '+label(pair.a)+'?',pair.b,'The '+pair.b.name+' sat directly '+pair.dir+' the '+pair.a.name+'.'),
   attr('What symbol was on the '+unique[2].name+'?',unique[2],'mark'),
   attr('What two-digit number was on the '+unique[3].name+'?',unique[3],'tag'),
   word('Which object was in row '+(unique[4].row+1)+', column '+(unique[4].col+1)+'?',unique[4],'Rows count from the top and columns from the left.')
  ];
  else if(index===1)questions=[
   word('Of the two '+colorPair+' objects, which had the lower tag number?',lower,'The tags were '+matching.map(t=>t.name+' '+t.tag).join(' and ')+'.'),
   attr('What color was the object directly '+pair.dir+' the '+pair.a.name+'?',pair.b,'color'),
   word('Which object had the largest tag number in row '+row+'?',rowMax,'The row contained '+rowTiles.map(t=>t.tag).join(', ')+'.'),
   attr('What symbol was on the object directly '+pair2.dir+' the '+pair2.a.name+'?',pair2.b,'mark'),
   word('Which object carried tag '+unique[4].tag+'?',unique[4],'Tag '+unique[4].tag+' belonged to the '+unique[4].name+'.')
  ];
  else questions=[
   word(signatures.length?'Which '+special.color+' object carried a '+special.mark+' symbol?':'Which object had tag '+special.tag+'?',special,'The '+special.name+' was '+special.color+' with a '+special.mark+' symbol.'),
   attr('What was the tag number of the object directly '+pair.dir+' the '+pair.a.name+'?',pair.b,'tag'),
   num('How many objects in column '+col+' had a '+mark+' symbol?',marked.length,'There '+(marked.length===1?'was one match.':'were '+marked.length+' matches.'),marked.map(t=>board.indexOf(t))),
   word('Among the four corners, which object had the highest tag number?',cornerMax,'Corner tags: '+corners.map(t=>t.name+' '+t.tag).join(', ')+'.'),
   attr('What color was the object directly '+pair2.dir+' the '+pair2.a.name+'?',pair2.b,'color')
  ];
  return {index,board,questions:shuffle(questions,r),...CONFIG[index]};
 }
 function generate(seed){const r=random(seed),all=shuffle(ITEMS,r);return {seed:seed>>>0,rounds:CONFIG.map((_,i)=>makeRound(i,r,all.slice(i*COUNT,(i+1)*COUNT)))}}
 const NUMBER_WORDS={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
 function normalize(raw){let s=String(raw??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/^(?:the|a|an)\s+/,'').replace(/[.!?]+$/,'').replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
  if(/^\d+$/.test(s))return String(Number(s));
  return NUMBER_WORDS[s]??s}
 function correct(q,answer){const a=normalize(answer);return !!a&&[q.answer,...q.aliases].some(x=>normalize(x)===a)}
 function grade(q,answer,expired=false){return {answer:String(answer??'').trim(),correct:!expired&&correct(q,answer),points:!expired&&correct(q,answer)?100:0}}
 root.Afterimage=Object.freeze({generate,normalize,correct,grade,CONFIG,COUNT,COLS});
})(typeof globalThis==='object'?globalThis:window);
