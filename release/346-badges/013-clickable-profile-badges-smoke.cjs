/* Acceptance: any badge earned in the 346-item catalog can open the exact
 * card shown in Badge Collections, with a deep link to that badge's set. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const profileSource=fs.readFileSync(path.join(root,'profile.js'),'utf8');
const sharedSource=fs.readFileSync(path.join(root,'badge-collection.js'),'utf8');
const setsSource=fs.readFileSync(path.join(root,'badge-sets.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profile.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-rules.json'),'utf8'));
assert.equal(catalog.length,346);
assert.match(html,/id="badgePreviewDialog"/);
assert.match(html,/id="badgePreviewClose"/);
assert.match(html,/id="badgePreviewCard"/);
assert.match(html,/badge-collection\.js\?v=4/);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const badges=catalog.map((b,i)=>({
 id:i+1,badge_key:b.key,name:b.name,description:b.condition,
 category:b.category,requirement:{rarity:b.rarity},is_secret:false,sort_order:i+1
}));
function fixture(batch){
 const elements=new Map(),events={};
 function element(id){
  if(elements.has(id))return elements.get(id);
  const el={id,innerHTML:'',textContent:'',href:'',value:'',dataset:{},style:{},open:false,
   classList:{add(){},remove(){},toggle(){},contains(){return false}},
   addEventListener(){},querySelectorAll(){return []},
   querySelector(){return {focus(){el.focusRestored=true}}},
   focus(){el.focused=true},showModal(){el.open=true},close(){el.open=false;el.onclose?.()},
   disabled:false};
  elements.set(id,el);return el;
 }
 const user={id:'qa-player',username:'PreviewTester',name_color:'#161616',
  account_code:'QA',is_owner:false};
 const awards=batch.map((b,i)=>({badge_id:b.id,earned_at:new Date(1780000000000+i*1000).toISOString()}));
 const rows={profiles:[user],badges,user_badges:awards,featured_badges:[],daily_runs:[],game_scores:[]};
 const db={from:name=>{
  const data=rows[name]||[];
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},
   maybeSingle:async()=>({data:data[0]||null,error:null}),
   single:async()=>({data:data[0]||null,error:null}),
   then(ok,bad){return Promise.resolve({data,error:null}).then(ok,bad)}};
  return q;
 },rpc:async name=>({data:name==='get_crilo_player_stats'?[{}]:{},error:null})};
 const win={addEventListener:(name,handler)=>{events[name]=handler},
  CriloRarity:{classify:()=>({label:'common'})}};
 const ctx={window:win,document:{getElementById:element,createElement:()=>element('created'),querySelectorAll:()=>[]},
  location:{search:''},URLSearchParams,Crilo:{user:{id:'qa-player'},profile:user,esc},criloDB:db,
  localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(sharedSource,ctx,{filename:'badge-collection.js',timeout:1500});
 vm.runInNewContext(profileSource,ctx,{filename:'profile.js',timeout:1500});
 return {win,element,events};
}
async function verifyProfiles(){
 let counted=0;
 for(let start=0;start<badges.length;start+=50){
  const batch=badges.slice(start,start+50);
  const {win,element,events}=fixture(batch);
  await events['crilo-auth-ready']();
  const model=win.CriloBadgeCollection,top=model.bestEarned(badges,
   batch.map((b,i)=>({badge_id:b.id,earned_at:new Date(1780000000000+i*1000).toISOString()})),50);
  assert.equal(top.length,batch.length);
  const markup=element('badgeGrid').innerHTML;
  assert.equal((markup.match(/<button type="button" class="badge-top-chip"/g)||[]).length,batch.length);
  for(const badge of top){
   assert.ok(markup.includes('data-badge-key="'+esc(badge.badge_key)+'"'),'Missing button '+badge.badge_key);
   let refocused=false;
   const button={dataset:{badgeKey:badge.badge_key},focus(){refocused=true}};
   element('badgeGrid').onclick({target:{closest:()=>button}});
   assert.equal(element('badgePreviewDialog').open,true,'Dialog failed '+badge.badge_key);
   assert.equal(element('badgePreviewCard').innerHTML,
    model.tileHTML(badge,true,esc,{expanded:true,interactive:false}),
    'Detail card differs from collection '+badge.badge_key);
   assert.match(element('badgePreviewCard').innerHTML,/class="collection-tile expanded"/);
   assert.ok(element('badgePreviewOpenSet').href.endsWith(
    'id=qa-player&badge='+encodeURIComponent(badge.badge_key)),
    'Wrong collection target '+badge.badge_key);
   element('badgePreviewClose').onclick();
   assert.equal(element('badgePreviewDialog').open,false);
   assert.equal(refocused,true,'Focus did not return '+badge.badge_key);
   counted++;
  }
 }
 return counted;
}
async function verifyDeepLink(){
 const target=badges.find(b=>b.name==='Double Duck')||badges[0],modelWindow={};
 const allBadgeNames=badges.map(b=>b.badge_key);
 const item={dataset:{badgeKey:target.badge_key},open:false,
  classList:{add(...items){this.names=items}},
  setAttribute(key,value){this[key]=value},
  closest(){return setNode},
  scrollIntoView(){this.scrolled=true}};
 const setNode={open:false};
 const listeners={},nodes={};
 function node(id){
  if(!nodes[id])nodes[id]={id,innerHTML:'',textContent:'',href:'',open:false,
   classList:{toggle(){return false}},addEventListener(){},contains(){return false},
   querySelectorAll(selector){return selector==='.collection-tile[data-badge-key]'?[item]:[]},
   querySelector(){return {focus(){}}}};
  return nodes[id];
 }
 const rows=badges;const earned=[{badge_id:target.id,earned_at:'2026-10-10'}];
 const db={from:name=>{
  const data=name==='badges'?rows:earned;
  const q={select(){return q},eq(){return q},order(){return q},
   then(ok,bad){return Promise.resolve({data,error:null}).then(ok,bad)}};
  return q;
 }};
 const ctx={window:{addEventListener(n,fn){listeners[n]=fn}},document:{
  getElementById:node,addEventListener(){}},
  location:{search:'?id=qa-player&badge='+encodeURIComponent(target.badge_key)},
  URLSearchParams,Crilo:{user:{id:'qa-player'},esc},criloDB:db,
  requestAnimationFrame(cb){cb()},console};
 vm.runInNewContext(sharedSource,ctx,{filename:'badge-collection.js'});
 vm.runInNewContext(setsSource,ctx,{filename:'badge-sets.js'});
 await listeners['crilo-auth-ready']();
 assert.ok(node('collectionSets').innerHTML.includes('data-badge-key="'+target.badge_key+'"'));
 assert.equal(setNode.open,true,'Target badge set did not expand');
 assert.equal(item['aria-expanded'],'true','Target badge did not expand');
 assert.ok(item.scrolled,'Did not scroll to target');
 assert.ok(allBadgeNames.includes(target.badge_key));
}
(async()=>{
 const count=await verifyProfiles();
 await verifyDeepLink();
 assert.equal(count,346,'Not every possible earned badge was tested');
 console.log('PASS: all '+count+' badges open the identical collection card; close/focus and deep-link expansion work.');
})().catch(e=>{console.error(e);process.exitCode=1});
