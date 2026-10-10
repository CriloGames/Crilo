/* Regression: the featured badge picker uses only earned active badges,
 * shows true rarity colors, persists immediate visual updates, and moves/removes
 * selected badges without changing the account's actual badge awards. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const script=fs.readFileSync(path.join(root,'profile.js'),'utf8');
const modelScript=fs.readFileSync(path.join(root,'badge-collection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
const css=fs.readFileSync(path.join(root,'badge-collection.css'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-rules.json'),'utf8'));
const badges=catalog.map((b,i)=>({
 id:i+1,badge_key:b.key,name:b.name||b.key,description:b.condition||'',
 category:b.category||'other',requirement:{rarity:b.rarity||'common'},
 is_secret:Boolean(b.is_secret),sort_order:i+1
}));
assert.equal(badges.length,346);
assert.match(html,/id="featuredBadgeOptions"/);
assert.match(html,/id="featuredBadgeSearch"/);
assert.match(html,/id="featuredClear"/);
assert.match(html,/badge-collection\.css\?v=7/);
assert.match(html,/profile\.js\?v=92/);
assert.match(css,/\.featured-slot\.featured-filled\[data-badge-rarity\]/);
assert.match(css,/\.featured-pick-option\{/);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
function fixture(earnedCount,preFeatured=[]){
 const nodes=new Map(),events={},saved=[];
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const states=new Set(['hidden']);
  const el={id,innerHTML:'',textContent:'',value:'',href:'',dataset:{},style:{},disabled:false,
   classList:{
    add(...xs){xs.forEach(x=>states.add(x))},
    remove(...xs){xs.forEach(x=>states.delete(x))},
    contains:x=>states.has(x),toggle(){return false}},
   addEventListener(){},querySelectorAll(){return []},
   querySelector(selector){return {focus(){el.lastFocusedChild=selector}}},
   contains(){return true},focus(){this.focused=true}};
  nodes.set(id,el);return el;
 }
 const user={id:'fixture-player',username:'Fixture',name_color:'#151515',account_code:'QA',is_owner:false};
 const owned=badges.slice(0,earnedCount).map((b,i)=>({
  badge_id:b.id,earned_at:new Date(Date.UTC(2026,9,9)+i*1000).toISOString()
 }));
 const tables={profiles:[user],badges,user_badges:owned,featured_badges:preFeatured,
  game_scores:[],daily_runs:[]};
 const db={from(table){
  const rows=tables[table]||[];
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},
   maybeSingle:async()=>({data:rows[0]||null,error:null}),
   single:async()=>({data:rows[0]||null,error:null}),
   then(ok,bad){return Promise.resolve({data:rows,error:null}).then(ok,bad)}};
  return q;
 },rpc:async(name,args)=>{
  if(name==='crilo_set_featured_badge'){saved.push(args);return {data:null,error:null}}
  return {data:name==='get_crilo_player_stats'?[{}]:{},error:null};
 }};
 const win={addEventListener:(n,fn)=>{events[n]=fn},
  CriloRarity:{classify:()=>({label:'common'})},CriloBadgeEvents:{track(){}}};
 const ctx={window:win,document:{getElementById:node,
  createElement:()=>node('created'),querySelectorAll:()=>[]},
  location:{search:''},URLSearchParams,Crilo:{user:{id:user.id},profile:user,esc},
  criloDB:db,localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(modelScript,ctx,{filename:'badge-collection.js',timeout:1500});
 vm.runInNewContext(script,ctx,{filename:'profile.js',timeout:1500});
 return {node,events,saved,win};
}
function chooseSlot(instance,position){
 instance.node('featuredBadges').onclick({
  target:{closest:()=>({dataset:{position:String(position)},focus(){}})}});
}
function chooseBadge(instance,id){
 instance.node('featuredBadgeOptions').onclick({
  target:{closest:()=>({dataset:{badgeId:String(id)}})}});
}
async function run(){
 for(const count of [0,1,82,346]){
  const instance=fixture(count);
  await instance.events['crilo-auth-ready']();
  const rows=instance.node('featuredBadges').innerHTML;
  assert.equal((rows.match(/class="featured-slot/g)||[]).length,5);
  chooseSlot(instance,1);
  const options=instance.node('featuredBadgeOptions').innerHTML;
  assert.equal((options.match(/class="featured-pick-option/g)||[]).length,count,
   count+' earned selection count');
  for(const badge of badges.slice(count)){
   assert.ok(!options.includes('data-badge-id="'+badge.id+'"'),
    'An unearned badge must never be offered');
  }
  if(count===0){
   assert.match(options,/No earned badges yet/);
   assert.equal(instance.node('featuredSave').disabled,true);
  }else{
   assert.ok(options.includes('data-badge-rarity="'+
    instance.win.CriloBadgeCollection.rarity(badges[0])+'"'));
  }
  console.log('PASS '+count+' earned badges: picker offers exactly '+count+', never locked');
 }
 const fixtureWithExisting=fixture(82,[{position:1,badge_id:4}]);
 await fixtureWithExisting.events['crilo-auth-ready']();
 const row=fixtureWithExisting.node('featuredBadges');
 assert.ok(row.innerHTML.includes('data-badge-rarity="'+
  fixtureWithExisting.win.CriloBadgeCollection.rarity(badges[3])+'"'));
 assert.ok(row.innerHTML.includes(badges[3].name),'Saved featured badge renders on first load');
 chooseSlot(fixtureWithExisting,2);
 chooseBadge(fixtureWithExisting,4);
 await fixtureWithExisting.node('featuredSave').onclick();
 assert.deepEqual(JSON.parse(JSON.stringify(fixtureWithExisting.saved[0])),
  {p_position:2,p_badge_id:4});
 const slots=row.innerHTML.split('<button type="button" class="featured-slot');
 assert.ok(!slots[1].includes(badges[3].name),'Moving badges clears their prior slot');
 assert.ok(slots[2].includes(badges[3].name),'New slot shows selected earned badge');
 assert.equal(slots.length,6);
 chooseSlot(fixtureWithExisting,2);
 await fixtureWithExisting.node('featuredClear').onclick();
 assert.equal(fixtureWithExisting.saved[1].p_badge_id,null);
 assert.equal((row.innerHTML.match(/featured-filled/g)||[]).length,0);
 console.log('PASS: existing feature, rarity colors, move without duplicates, and remove');
}
run().catch(e=>{console.error(e);process.exitCode=1});
