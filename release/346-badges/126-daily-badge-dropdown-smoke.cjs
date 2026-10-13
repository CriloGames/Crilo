'use strict';
const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const game=fs.readFileSync('game.js','utf8');
const css=fs.readFileSync('daily-badge-dropdown.css','utf8');
a.match(html,/<details id="newBadgePanel" class="new-badge-panel hidden">/);
a.match(html,/<summary class="new-badge-panel-header">/);
a.match(html,/id="newBadgeList"/);
a.match(html,/daily-badge-dropdown\.css\?v=\d+/);
a.match(html,/game\.js\?v=\d+/);
a.doesNotMatch(html,/id="newBadgePanel"[^>]*open(?:\s|>)/);
a.match(game,/if\(guestRun\)\{completeGuestDaily\(\);renderResult\(r\);showGuestBadgePreview\(r\);/);
a.match(game,/if\(priorBadges\)await showNewBadges\(priorBadges\)/);
a.match(game,/badgePanel\.open=false/);
a.match(css,/#newBadgePanel\[open\]/);
a.match(css,/html\[data-theme="dark"\]/);
a.match(css,/@media\(max-width:520px\)/);
function section(from,to){
 const i=game.indexOf(from),j=game.indexOf(to,i+from.length);
 a.ok(i>=0&&j>i,'Missing game function boundaries '+from);
 return game.slice(i,j);
}
const previewFunction=section('function showGuestBadgePreview(r){','// Only compare badge IDs');
const awardsFunction=section('async function showNewBadges(prior,{review=false}={}){','/* Share one completed-state summary');
const elements=new Map();
function $(id){if(!elements.has(id)){
 const node={
  textContent:'',innerHTML:'',open:true,onclick:null,
  classList:{items:new Set(['hidden']),add(v){this.items.add(v)},remove(v){this.items.delete(v)},contains(v){return this.items.has(v)}}
 };elements.set(id,node);
}return elements.get(id)}
const ctx={$,window:{CriloBadgeCollection:{
 rarity:b=>b.requirement?.rarity||'common',
 rarityOrder:['trash','common','uncommon','rare','epic','anomaly','mythic'],
 tileHTML:()=>'<p>Badge preview</p>'
}},Crilo:{esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')},
 user:{id:'verified'},
 criloDB:{from:()=>{throw Error('Guest badge preview must never call database')}}};
vm.runInNewContext(previewFunction+'\n'+awardsFunction,ctx,{timeout:2000});
ctx.showGuestBadgePreview=vm.runInNewContext('showGuestBadgePreview',ctx);
ctx.showNewBadges=vm.runInNewContext('showNewBadges',ctx);
ctx.showGuestBadgePreview({color:'rare'});
a.equal($('newBadgePanel').open,false,'Guest preview begins collapsed');
a.equal($('newBadgePanel').classList.contains('hidden'),false);
a.match($('newBadgeCount').textContent,/BADGES YOU COULD EARN/);
a.match($('newBadgeList').innerHTML,/Rare Score/);
a.match($('newBadgeList').innerHTML,/Guest runs do not earn or save badges/);
a.doesNotMatch($('newBadgeList').innerHTML,/UNLOCKED|EARNED/,'Guest previews must not claim awards');
ctx.criloDB={from:table=>({
 select(){return this},
 eq(){return Promise.resolve({data:[{badge_id:10},{badge_id:11}],error:null})},
 in(){return Promise.resolve({data:[
 {id:10,badge_key:'a',name:'Regular',description:'Common badge',requirement:{rarity:'common'}},
 {id:11,badge_key:'b',name:'Extraordinary',description:'Rare badge',requirement:{rarity:'mythic'}}
 ],error:null})}
})};
(async()=>{
 await ctx.showNewBadges(new Set());
 a.equal($('newBadgePanel').open,false,'Official badges begin collapsed');
 a.equal($('newBadgePanel').classList.contains('hidden'),false);
 a.equal($('newBadgePanel').classList.contains('guest-badge-mode'),false);
 a.match($('newBadgeCount').textContent,/2 BADGES EARNED/);
 a.ok($('newBadgeList').innerHTML.indexOf('Regular')<$('newBadgeList').innerHTML.indexOf('Extraordinary'),'Keep rarity ordering');
 a.match($('newBadgeList').innerHTML,/Preview newly earned Regular badge/);
 a.match($('newBadgeList').innerHTML,/Preview newly earned Extraordinary badge/);
 ctx.criloDB={from:()=>({select(){return this},eq(){return Promise.resolve({data:[{badge_id:10}],error:null})}})};
 await ctx.showNewBadges(new Set(['10']));
 a.equal($('newBadgePanel').open,false);
 a.match($('newBadgeCount').textContent,/NO NEW BADGES/);
 a.match($('newBadgeList').textContent,/No new badges/);
 console.log('DAILY_BADGE_DROPDOWN_SMOKE_PASS guest preview, real awards, rarity order, empty state, collapsed default');
})().catch(err=>{console.error('DAILY_BADGE_DROPDOWN_SMOKE_FAIL',err);process.exitCode=1});
