import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),ctx={};vm.runInNewContext(read('afterimage-core.js'),ctx);const E=ctx.Afterimage;
const unique=new Set(),themes=new Set();let count=0;
for(let seed=0;seed<10000;seed++){const g=E.generate(seed),r=g.room;unique.add(JSON.stringify(r));themes.add(r.theme);assert.equal(g.scan,25);assert.equal(g.answer,15);assert.equal(g.questions.length,5);assert.equal(new Set(g.questions.map(q=>q.id)).size,5);
 for(const q of g.questions){assert(q.answer);assert(E.correct(q,q.answer));assert(!E.correct(q,''));assert.equal(E.grade(q,q.answer).points,100);const expected={mug:r.mug[0],furniture:r.furniture[0],weather:r.weather,prop:r.prop,picture:r.picture,books:String(r.books),plant:r.plant,rug:r.rug[0],curtain:r.curtain[0],cushions:String(r.cushions),hour:String(r.hour)};assert.equal(q.answer,expected[q.id]);count++}
 if(seed<300){const svg=E.roomSVG(r);assert(svg.startsWith('<svg'));assert(svg.endsWith('</svg>'));assert(!/undefined|NaN/.test(svg));}
}
assert(unique.size>9900);assert.equal(themes.size,3);assert.equal(count,50000);assert(E.correct({answer:'3',aliases:[]},'three'));assert(E.correct({answer:'3',aliases:[]},'3:00'));assert(E.correct({answer:'camera',aliases:[]},'The Camera!'));
const html=read('afterimage.html'),js=read('afterimage.js');new Function(js);assert.match(html,/id="aiGame" hidden inert/);assert.match(js,/profile\.is_owner!==true/);assert.match(read('test-games.html'),/href="afterimage\.html"/);
for(const m of js.matchAll(/\$\('([^']+)'\)/g))assert(html.includes('id="'+m[1]+'"'),'missing element '+m[1]);
console.log('PASS: 10,000 rooms, 50,000 exact answers, three room types, five questions per session and owner gate');
