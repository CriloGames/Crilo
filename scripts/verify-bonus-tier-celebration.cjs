/* Offline regression: a Bonus Run tier popup is a short, account-specific
 * celebration of a newly confirmed server milestone, not a retroactive alert. */
'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const read=file=>readFileSync(join(__dirname,'..',file),'utf8');
const source=read('bonus-runs.js');
const css=read('bonus-runs.css');
const game=read('game.js');
const html=read('index.html');

class Element {
 constructor(tag='div',id=''){
  this.tag=tag;this.id=id;this.className='';this.children=[];
  this.parent=null;this.textContent='';this.attributes={};this.styles={};
  this.style={setProperty:(key,value)=>{this.styles[key]=value}};
  const classes=new Set(['criloBonusPanel','criloMysteryModal'].includes(id)?['hidden']:[]);
  this.classList={
   contains:name=>classes.has(name),
   add:name=>classes.add(name),
   remove:name=>classes.delete(name),
   toggle:(name,force)=>{
    const value=force===undefined?!classes.has(name):Boolean(force);
    if(value)classes.add(name);else classes.delete(name);
    return value;
   }
  };
 }
 append(...children){
  for(const child of children){this.children.push(child);child.parent=this}
 }
 replaceChildren(...children){this.children=[];this.append(...children)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null}
 setAttribute(key,value){this.attributes[key]=String(value)}
 removeAttribute(key){delete this.attributes[key]}
 addEventListener(){}
 scrollIntoView(){}
}
function harness({reduced=false,storage=new Map()}={}){
 const ids=new Map(),events={},created=[];
 for(const id of ['criloBonusPanel','criloBonusSummary','criloBonusLead',
  'criloBonusRemaining','criloBonusPrimary','criloBonusList',
  'criloBonusProgress','criloBonusTrack','criloBonusTrackFill',
  'criloBonusRunsCount','criloBonusDetails','criloBonusStatus',
  'criloMysteryModal'])ids.set(id,new Element('div',id));
 const body=new Element('body');
 const originalAppend=body.append.bind(body);
 body.append=(...nodes)=>{originalAppend(...nodes);
  for(const node of nodes)if(node.id==='criloBonusTierToast')created.push(node);
 };
 const document={
  body,getElementById:id=>ids.get(id)||null,
  createElement:tag=>new Element(tag)
 };
 const window={
  Crilo:{user:{id:'user-a'},profile:{id:'p-a'},authResolved:false},
  matchMedia:()=>({matches:reduced}),
  addEventListener:(type,cb)=>{(events[type]??=[]).push(cb)},
  dispatchEvent:e=>{for(const cb of events[e.type]||[])cb(e)}
 };
 let status={badge_count:49,bonus_unlocked:0,official_done:true,runs:[]};
 let nextTimer=0;
 const timers=new Map();
 const setTimeout=(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id};
 const clearTimeout=id=>timers.delete(id);
 const localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
 };
 const criloDB={rpc:async name=>{
  assert.equal(name,'crilo_bonus_status');
  return {data:status,error:null};
 }};
 new Function('window','document','criloDB','localStorage',
  'setTimeout','clearTimeout',source)(
  window,document,criloDB,localStorage,setTimeout,clearTimeout
 );
 return {
  ids,window,created,storage,timers,
  setStatus:(badges,tier,official=true)=>{
   status={badge_count:badges,bonus_unlocked:tier,official_done:official,runs:[]};
  },
  refresh:options=>window.CriloBonusRuns.refresh(options),
  toast:()=>body.children.find(node=>node.id==='criloBonusTierToast')
 };
}
async function run(){
 const h=harness();
 await h.refresh();
 assert.equal(h.created.length,0,'Initial existing tier must not celebrate');
 h.setStatus(50,1);
 await h.refresh({badgeCountBefore:49});
 assert.equal(h.created.length,1,'50 badges must celebrate exactly once');
 assert.equal(h.toast().children[1].textContent,'Bonus Run 1 unlocked!');
 assert.equal(h.toast().children[2].textContent,'50 unique badges · 5 free spins');
 assert.equal(h.toast().children[0].children.length,18,'Confetti should be small and brief');
 assert.equal(h.toast().attributes.role,'status','Toast must be announced accessibly');
 assert.equal(h.timers.size,1,'Toast must automatically dismiss itself');
 assert([...h.timers.values()][0].delay<=3500,'Toast should not linger');
 await h.refresh({badgeCountBefore:49});
 assert.equal(h.created.length,1,'Repeated RPC must not repeat the celebration');
 h.setStatus(99,1);await h.refresh();
 assert.equal(h.created.length,1,'Badge count alone does not unlock next tier');
 h.ids.get('criloMysteryModal').classList.remove('hidden');
 h.setStatus(100,2);await h.refresh({badgeCountBefore:99});
 assert.equal(h.created.length,1,'Never show behind the Mystery Gift');
 h.ids.get('criloMysteryModal').classList.add('hidden');
 h.window.dispatchEvent({type:'crilo-mystery-closed'});
 assert.equal(h.created.length,2,'Show queued tier once after the gift closes');
 assert.equal(h.toast().children[1].textContent,'Bonus Run 2 unlocked!');
 h.setStatus(149,2);await h.refresh();
 assert.equal(h.created.length,2,'149 badges must not celebrate tier 3');
 h.setStatus(150,3);await h.refresh({badgeCountBefore:149});
 assert.equal(h.created.length,3,'150 badges must celebrate tier 3');
 assert.equal(h.toast().children[1].textContent,'Bonus Run 3 unlocked!');
 h.window.Crilo.user={id:'user-b'};h.window.Crilo.profile={id:'p-b'};
 h.setStatus(205,4);await h.refresh();
 assert.equal(h.created.length,3,'Old 205-badge account must not receive four old popups');
 assert.equal(h.toast(),undefined,'Switching users must clear an old toast');
 h.window.Crilo.user={id:'user-c'};h.window.Crilo.profile={id:'p-c'};
 h.setStatus(200,4);await h.refresh({badgeCountBefore:199});
 assert.equal(h.created.length,4,'First 200-badge guest claim must celebrate tier 4');
 assert.equal(h.toast().children[1].textContent,'Bonus Run 4 unlocked!');
 await h.refresh({badgeCountBefore:199});
 assert.equal(h.created.length,4,'Claim retry must never double celebrate');
 const reloaded=harness({storage:h.storage});
 reloaded.window.Crilo.user={id:'user-c'};reloaded.window.Crilo.profile={id:'p-c'};
 reloaded.setStatus(200,4);await reloaded.refresh();
 assert.equal(reloaded.created.length,0,'Reload must never replay a previous tier');
 const quiet=harness({reduced:true});
 await quiet.refresh();quiet.setStatus(50,1);await quiet.refresh({badgeCountBefore:49});
 assert.equal(quiet.toast().children[0].children.length,0,
  'Reduced-motion players must not receive animated confetti');
 const noOfficial=harness();
 await noOfficial.refresh();noOfficial.setStatus(50,1,false);await noOfficial.refresh();
 assert.equal(noOfficial.created.length,0,'An unverified run must not produce a popup');
 assert.match(source,/Math\.min\(4,Math\.trunc\(Number\(data\?\.bonus_unlocked\)/,
  'Use the server-confirmed unlocked count, not the raw displayed badge count');
 assert.match(source,/TIER_SEEN_PREFIX='crilo-bonus-milestone-seen-v1:'/);
 assert.match(source,/if\(mysteryOpen\(\)\)/,'Gift queue must have priority');
 assert.match(css,/\.crilo-bonus-tier-toast\{/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(game,/badgeCountBefore:priorBadges\?\.size/,
  'Official saved Daily must provide its before-badge baseline');
 assert.match(game,/badgeCountBefore:data\.status==='saved'\?priorBadges\?\.size/,
  'Only successful guest claims can report a newly crossed milestone');
 assert.match(html,/bonus-runs\.js\?v=5/);
 assert.match(html,/bonus-runs\.css\?v=3/);
 console.log('PASS bonus tiers: 50/100/150/200 badges, one-time per account, gift priority, guest claim, reduced motion, first load, automatic dismissal');
}
run().catch(error=>{console.error(error);process.exitCode=1});
