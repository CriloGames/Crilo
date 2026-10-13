/* Classic leaderboard ducks must be the very same drawing in Meet the Ducks.
 * Runs without accounts, network, or DB mutations. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('leaderboard.js','utf8');
const html=fs.readFileSync('leaderboard.html','utf8');
const css=fs.readFileSync('style.css','utf8');
const ducks=fs.readFileSync('ducks.js','utf8');
const svg=fs.readFileSync('duck-classic.svg','utf8');
assert.match(html,/data-tab="badges"><span class="leader-tab-label">ALL-TIME BADGES<\/span><\/button>/);
assert.ok(!html.includes('badge-medal.svg')&&!html.includes('🏅'),'All-Time Badges must be text only');
assert.ok(css.includes('.leader-tabs-wrap .leader-tab-icon-duck'),'Classic duck tab alignment must remain');
assert.match(html,/data-tab="ducks"><img class="leader-tab-icon leader-tab-icon-duck leader-duck-icon leader-duck-icon-tab" src="duck-classic\.svg"/);
assert.match(html,/leaderboard\.js\?v=\d+/,'Leaderboard script remains versioned');
assert.match(html,/style\.css\?v=\d+/,'Stylesheet remains versioned');
assert.ok(!src.includes('🦆')&&!html.includes('🦆'),'Native duck emoji still present');
assert.ok(css.includes('.leader-duck-icon-count')&&css.includes('.leader-duck-icon-tab'));
assert.match(svg,/viewBox="0 0 100 90"/);
for(const needle of [
 'M28 70L26 78M44 70L45 79',
 'M13 55Q10 36 29 35Q41 28 49 39Q63 31 73 45Q82 61 66 72Q40 82 21 68Q14 63 13 55Z',
 'M45 43Q49 25 64 26Q79 27 78 43Q78 53 65 56',
 'M72 42Q84 40 91 45Q85 53 72 50Z',
 'M27 54Q40 44 51 55Q44 65 32 63',
 'cx="68" cy="37" r="3" fill="#453b35"',
 'fill="#ffe076"'
]){
 assert.ok(svg.includes(needle),'Classic SVG missing original linework: '+needle);
 assert.ok(needle==='fill="#ffe076"'?ducks.includes("classic:'#ffe076'"):ducks.includes(needle),
  'Not identical to the Meet the Ducks artwork: '+needle);
}
const blocks=src.slice(src.indexOf('function duckCountHTML('),src.indexOf('async function loadDucks('))+
 src.slice(src.indexOf('function renderDuckLeaders('),src.indexOf('async function loadBadges('));
assert.ok(blocks.includes('function duckCountHTML')&&blocks.includes('function renderDuckLeaders'));
assert.ok(!blocks.includes('load()})();'),'Extract ONLY the two duck rendering helpers');
const elements=new Map();
function makeElement(){
 let text='',html='';
 const el={dataset:{},style:{},classList:{add(){},remove(){}}};
 Object.defineProperties(el,{
  textContent:{get:()=>text,set:v=>{text=String(v);html='';}},
  innerHTML:{get:()=>html,set:v=>{html=String(v);text='';}}
 });
 return el;
}
const $=id=>{
 if(!elements.has(id))elements.set(id,makeElement());
 return elements.get(id);
};
const env={
 $,Crilo:{esc:s=>String(s??'')},safeColor:x=>x,
 window:{CriloNameColors:{
  paint(el,profile){el.textContent=profile?.username||'Crilo player'},
  markup(profile){return String(profile?.username||'Crilo player')}
 }},
 setBestScoreRarity:score=>assert.equal(score,null),Map,Number,Math
};
vm.createContext(env);
vm.runInContext(blocks+';this.renderForTest=renderDuckLeaders;',env);
const players=[
 {user_id:'duck-one',count:5},
 {user_id:'duck-two',count:2}
];
const profiles=new Map([
 ['duck-one',{username:'FirstDuck',name_color:'#ca2323'}],
 ['duck-two',{username:'SecondDuck',name_color:'#334455'}]
]);
env.renderForTest(players,profiles);
assert.equal(($('bestScore').innerHTML.match(/duck-classic\.svg/g)||[]).length,1,'Featured duck icon');
assert.ok($('bestScore').innerHTML.includes('>5</span>'),'Featured count');
assert.equal(($('leaderList').innerHTML.match(/duck-classic\.svg/g)||[]).length,2,'Exactly one duck per ranking row');
assert.ok($('leaderList').innerHTML.includes('>2</span>'),'Second player duck count');
assert.ok($('leaderList').innerHTML.includes('FirstDuck')&&$('leaderList').innerHTML.includes('SecondDuck'));
assert.ok(!$('leaderList').innerHTML.includes('🦆')&&!$('bestScore').innerHTML.includes('🦆'));
env.renderForTest([],new Map());
assert.ok(!$('bestScore').innerHTML.includes('duck-classic.svg'),'No stale duck icon in empty state');
console.log('PASS: Classic art unchanged; leaderboard tab, featured duck total, rankings, and empty state.');
