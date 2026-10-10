/* Run the production profile and collection JS against 346 realistic badge definitions.
 * Validates top-50 rarity ranking, set completion, all locked/earned tiles, and navigation. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const profileSource=fs.readFileSync(path.join(root,'profile.js'),'utf8');
const modelSource=fs.readFileSync(path.join(root,'badge-collection.js'),'utf8');
const setsSource=fs.readFileSync(path.join(root,'badge-sets.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-rules.json'),'utf8'));
const badges=catalog.map((b,i)=>({
 id:i+1,badge_key:b.key,name:b.name||b.key,description:b.condition||'',
 category:b.category||'other',requirement:{rarity:b.rarity||'common'},
 is_secret:Boolean(b.is_secret),sort_order:i+1
}));
assert.equal(badges.length,346);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

async function run(awards){
 const elements=new Map(),listeners={};
 const getElementById=id=>{
  if(elements.has(id))return elements.get(id);
  const e={id,innerHTML:'',textContent:'',value:'',href:'',dataset:{},style:{},
   classList:{add(){},remove(){},toggle(){},contains(){return false}},
   addEventListener(){},querySelectorAll(){return []},querySelector(){return null},disabled:false};
  elements.set(id,e);return e;
 };
 const profile={id:'fixture-player',username:'PreviewTester',name_color:'#181818',
  account_code:'QA',is_owner:false};
 const rows=badges.slice(0,awards).map((b,i)=>({
  badge_id:b.id,earned_at:new Date(Date.UTC(2026,9,9)+i*1000).toISOString()
 }));
 const tables={profiles:[profile],badges,user_badges:rows,
  featured_badges:[],game_scores:[],daily_runs:[]};
 const client={
  from(table){
   const data=tables[table]||[];
   const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},
    maybeSingle:async()=>({data:data[0]||null,error:null}),
    single:async()=>({data:data[0]||null,error:null}),
    then(ok,bad){return Promise.resolve({data,error:null}).then(ok,bad)}
   };
   return q;
  },
  rpc:async name=>({data:name==='get_crilo_player_stats'?[{}]:{},error:null})
 };
 const player={user:{id:'fixture-player'},profile,esc};
 const win={addEventListener:(name,cb)=>listeners[name]=cb,
  CriloRarity:{classify:()=>({label:'common'})}};
 const ctx={window:win,document:{
  getElementById,createElement:()=>getElementById('created'),querySelectorAll:()=>[]},
  location:{search:''},URLSearchParams,Crilo:player,criloDB:client,
  localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(modelSource,ctx,{filename:'badge-collection.js',timeout:1500});
 const model=win.CriloBadgeCollection;
 assert.equal(model.active(badges).length,346);
 const sets=model.sets(badges,rows);
 assert.equal(sets.reduce((n,set)=>n+set.total,0),346,'All definitions belong to one set');
 assert.equal(sets.reduce((n,set)=>n+set.unlocked,0),awards,'All awards counted once');

 vm.runInNewContext(profileSource,ctx,{filename:'profile.js',timeout:1500});
 assert.equal(typeof listeners['crilo-auth-ready'],'function');
 await listeners['crilo-auth-ready']();
 const html=getElementById('badgeGrid').innerHTML;
 const chipMatches=[...html.matchAll(/<span class="badge-top-chip" data-badge-rarity="([^"]+)"/g)];
 assert.equal(chipMatches.length,Math.min(50,awards),
  'Top badge showcase must contain no more than 50 earned badges');
 assert.ok(!html.includes('badge-set-head')&&!html.includes('badge-card locked'),
  'Profile should not render locked sets');
 assert.equal(getElementById('badgeProgress').textContent,
  awards+' unique badges collected'+(awards>50?' · Best 50 shown':''));
 assert.equal(getElementById('badgeSetsLink').href,'badge-sets.html?id=fixture-player');
 assert.match(getElementById('featuredBadges').innerHTML,/featured-slot/);

 const expected=model.bestEarned(badges,rows,50);
 const displayed=[...html.matchAll(/<span class="badge-top-chip" data-badge-rarity="([^"]+)" title="[^"]*">([^<]+)<\/span>/g)];
 assert.equal(displayed.length,expected.length);
 for(let i=0;i<expected.length;i++){
  assert.equal(displayed[i][1],model.rarity(expected[i]),'Rarity order '+i);
  assert.equal(displayed[i][2],esc(expected[i].name),'Name order '+i);
 }
 assert.ok(!/<svg|<img|badge-set-icon/.test(html),'Profile badges must have no symbols');

 // Run the actual collection page script with the same fixtures.
 vm.runInNewContext(setsSource,ctx,{filename:'badge-sets.js',timeout:1500});
 await listeners['crilo-auth-ready']();
 const collection=getElementById('collectionSets').innerHTML;
 assert.equal((collection.match(/<details class="collection-card">/g)||[]).length,sets.length);
 assert.equal((collection.match(/<article class="collection-tile/g)||[]).length,346);
 assert.equal((collection.match(/<article class="collection-tile locked"/g)||[]).length,346-awards);
 assert.ok(!/<svg|<img|badge-set-icon/.test(collection),'Collection sets must be icon-free');
 assert.equal(getElementById('setsCompleted').textContent,
  sets.filter(set=>set.complete).length+' / '+sets.length);
 console.log('PASS: '+awards+' earned; '+chipMatches.length+' Mythic-first profile tiles; '+
  sets.length+' expandable sets, 346 text-only collection tiles.');
}
(async()=>{
 await run(0);
 await run(1);
 await run(125);
})().catch(err=>{console.error(err);process.exitCode=1});
