/* Regression: run actual profile.js against a 346-badge mock Supabase result.
   Ensures the gallery-rendering statement cannot accidentally be commented out. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'profile.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog-rules.json'),'utf8'));
const badges=catalog.map((b,i)=>({
  id:i+1,badge_key:b.key,name:b.name||b.key,description:b.description||'',
  category:b.category||'other',requirement:{rarity:b.rarity||'common'},
  is_secret:Boolean(b.is_secret),sort_order:i+1
}));
assert.equal(badges.length,346,'Full live badge catalog fixture expected');

async function run(awardOne){
 const elements=new Map(),listeners={};
 const element=id=>{
  if(elements.has(id))return elements.get(id);
  const e={id,innerHTML:'',textContent:'',value:'',dataset:{},style:{},
   classList:{add(){},remove(){},toggle(){},contains(){return false}},
   addEventListener(){},querySelectorAll(){return []},querySelector(){return null},disabled:false};
  elements.set(id,e);return e;
 };
 const profile={id:'fixture-player',username:'PreviewTester',name_color:'#181818',
   account_code:'QA',is_owner:false};
 const results={
  profiles:[profile],badges,user_badges:awardOne?
   [{badge_id:1,earned_at:'2026-10-09T12:00:00Z'}]:[],
  featured_badges:[],game_scores:[],daily_runs:[]
 };
 const client={
  from(table){
   const data=results[table]||[];
   const q={select(){return q},eq(){return q},order(){return q},limit(){return q},in(){return q},
    maybeSingle:async()=>({data:data[0]||null,error:null}),
    single:async()=>({data:data[0]||null,error:null}),
    then(ok,bad){return Promise.resolve({data,error:null}).then(ok,bad)}};
   return q;
  },
  rpc:async name=>({data:name==='get_crilo_player_stats'?[{}]:{},error:null})
 };
 const player={user:{id:'fixture-player'},profile,
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({
   '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char])};
 const ctx={window:{addEventListener:(name,cb)=>listeners[name]=cb,
    CriloRarity:{classify:()=>({label:'common'})}},
  document:{getElementById:element,createElement:()=>element('fixture-created'),querySelectorAll:()=>[]},
  location:{search:''},URLSearchParams,Crilo:player,criloDB:client,
  localStorage:{getItem:()=>null},console,confirm:()=>false};
 vm.runInNewContext(source,ctx,{filename:'profile.js',timeout:1500});
 assert.equal(typeof listeners['crilo-auth-ready'],'function','Profile initialization missing');
 await listeners['crilo-auth-ready']();
 const html=element('badgeGrid').innerHTML;
 assert.equal((html.match(/<article class="badge-card/g)||[]).length,346,
   'Profile must render all 346 badges, including locked badges');
 assert.ok((html.match(/<details class="badge-set"/g)||[]).length>=20,
   'Grouped badge sections missing');
 assert.equal(element('badgeProgress').textContent,(awardOne?1:0)+' / 346');
 assert.match(element('featuredBadges').innerHTML,/featured-slot/);
 console.log('PASS:',awardOne?'earned':'locked','catalog: 346 cards, progress',
   element('badgeProgress').textContent);
}
(async()=>{await run(false);await run(true)})().catch(e=>{console.error(e);process.exitCode=1});
