import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),ctx={};vm.runInNewContext(read('afterimage-scenes.js'),ctx);vm.runInNewContext(read('afterimage-core.js'),ctx);const E=ctx.Afterimage;
const lib=ctx.AfterimageScenes,templates=new Set(),places=new Set();let questions=0;
for(let seed=0;seed<10000;seed++){const g=E.generate(seed),r=g.room;templates.add(r.template);places.add(r.place);
 assert.equal(g.scan,25);assert.equal(g.answer,15);assert.equal(g.questions.length,5);assert.equal(new Set(g.questions.map(q=>q.id)).size,5);
 for(const q of g.questions){assert(E.correct(q,q.answer));assert(!E.correct(q,''));assert.equal(E.grade(q,q.answer).points,100);for(const a of q.aliases)assert(E.correct(q,a),q.id+' '+a);questions++}
 if(seed<300){const svg=E.roomSVG(r);assert(svg.startsWith('<svg'));assert(svg.endsWith('</svg>'));assert(!/undefined|NaN/.test(svg))}
}
assert.equal(templates.size,100);assert.equal(places.size,20);assert.equal(questions,50000);
let history={seen:[],deck:[]},previous=null;const images=new Set();
for(let i=0;i<500;i++){const n=lib.next(history,i*8191+392);assert(n);assert.notEqual(n.game.room.place,previous);previous=n.game.room.place;
 history=JSON.parse(JSON.stringify(n.history));const svg=E.roomSVG(n.game.room);assert(!images.has(svg));images.add(svg);assert.equal(new Set(history.seen).size,i+1);
 if((i+1)%100===0)assert.equal(new Set(history.deck).size,100);
}
const html=read('afterimage.html'),js=read('afterimage.js');new Function(js);assert.match(html,/id="aiGame" hidden inert/);assert.match(js,/profile\.is_owner!==true/);assert.match(read('test-games.html'),/href="afterimage\.html"/);
for(const m of js.matchAll(/\$\('([^']+)'\)/g))assert(html.includes('id="'+m[1]+'"'),'missing element '+m[1]);
console.log('PASS: 100 layouts, 20 locations, 50,000 questions, 500 distinct rendered scenes over five serialized decks');

const equivalenceCases=[["prop","vase",["flower pot","flowerpot","vase with flowers","a pot of flowers","flowers","a potted plant","flower vase","It was a flower pot","flowr pot","vsae"],["camera","mug","headphones","flower pot or camera","not a vase","table"]],["prop","camera",["digital camera","photo camera","camrea","camra"],["vase","headset","camera or vase","table"]],["prop","headphones",["headset","earphones","pair of headphones","headphons"],["camera","vase"]],["picture","sailboat",["boat","sailing boat","sail boat","boat on the water"],["mountain","flower"]],["mug","purple",["violet","lavender","light purple","purple colored","purpel"],["red","blue","orange","purple or red"]],["rug","yellow",["gold","golden yellow","mustard yellow"],["orange","red","green"]],["weather","rainy",["rain","raining","it was raining","rainy day"],["sunny","snowing","sun"]],["plant","left",["on the left","left side of the room","left-hand side"],["right","left or right"]],["books","4",["4","four","four books","there were 4 books","04"],["five","5 books","4 pillows","4 or 5","4.5"]],["hour","3",["3","three","3:00","three o’clock","3:00 pm","3 pm","3 o clock"],["4","3:30","13","3 or 4"]]];
for(const [id,answer,yes,no] of equivalenceCases){const q={id,answer,aliases:[]};for(const a of yes)assert(E.correct(q,a),id+': '+a+' should be accepted');for(const a of no)assert(!E.correct(q,a),id+': '+a+' should be rejected');}
console.log('PASS: '+equivalenceCases.reduce((n,[,,yes,no])=>n+yes.length+no.length,0)+' answer-variant checks');
