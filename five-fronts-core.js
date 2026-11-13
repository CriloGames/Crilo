/* Five Fronts — deterministic, offline single-player playtest simulation.
 * This module never accesses auth, public rankings, or Supabase.
 * Hex states have identical area: exactly five connected hexagons per country.
 */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.FiveFrontsEngine=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const COLORS=['#76b9a4','#e6ae76','#a5a2dc','#d28f9b','#8db5d9','#c9b27a'];
 const NAMES=['Mossvale','Solara','Northreach','Aster','Tideland','Cinderfall'];
 const TERRAIN=['plains','farms','forest','hills','river'];
 const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
 const COST={train:{metal:14,food:11,people:8},fortify:{metal:19,food:10}};
 const STRATEGIES={
  mobilize:{label:'Rapid Mobilization',detail:'Training produces 30 troops instead of 20 for the next five minutes.'},
  industry:{label:'Industrial Expansion',detail:'Metal and oil production increase by 35% for five minutes.'},
  defense:{label:'Border Fortifications',detail:'Defending armies gain a 25% bonus for five minutes.'},
  research:{label:'Military Research',detail:'Advance technology immediately and boost attacking strength for five minutes.'},
  harvest:{label:'Emergency Harvest',detail:'Gain 35 food instantly and increase food production for five minutes.'},
  intelligence:{label:'Reconnaissance',detail:'Reveal exact neighboring troop concentrations and improve attack power for five minutes.'}
 };
 const EVENTS={
  flood:{title:'River Flood',prompt:'Release the floodgate when the marker is inside the safe channel.',effect:'Troops in one state are swept away; food stores are damaged.',symbol:'◈',kind:'water'},
  fire:{title:'Factory Fire',prompt:'Drop the suppressant while the marker crosses the target zone.',effect:'Metal production stores burn; nearby units suffer losses.',symbol:'✷',kind:'fire'},
  signals:{title:'Signal Blackout',prompt:'Tune the emergency transmitter to the marked frequency.',effect:'An army loses equipment and its oil reserves are reduced.',symbol:'⌁',kind:'signals'},
  storm:{title:'Mountain Storm',prompt:'Deploy the emergency shelter at exactly the right moment.',effect:'The storm scatters troops and destroys food reserves.',symbol:'❄',kind:'storm'}
 };
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function roll(g){
  let x=g.rng>>>0||1;x^=x<<13;x^=x>>>17;x^=x<<5;g.rng=x>>>0;
  return g.rng/4294967296;
 }
 function randomRange(g,a,b){return a+Math.floor(roll(g)*(b-a+1))}
 function neighbors(a,b){return DIRS.some(([dq,dr])=>a.q+dq===b.q&&a.r+dr===b.r)}
 function idsFor(g,owner){return g.states.filter(s=>s.owner===owner)}
 function aliveCountries(g){return g.countries.filter(c=>idsFor(g,c.id).length>0)}
 function ownedCount(g,id){return idsFor(g,id).length}
 function connected(states,owner){
  const selected=states.filter(s=>s.owner===owner);
  if(!selected.length)return false;
  const visited=new Set([selected[0].id]),stack=[selected[0]];
  while(stack.length){
   const node=stack.pop();
   for(const other of selected)if(!visited.has(other.id)&&neighbors(node,other)){
    visited.add(other.id);stack.push(other);
   }
  }
  return visited.size===selected.length;
 }
 function createMap(g,n){
  const states=[];
  // First assign five hexagons to each country; swaps make the borders
  // irregular without changing area, breaking connectivity, or isolating land.
  for(let row=0;row<n;row++)for(let col=0;col<5;col++){
   states.push({id:row*5+col,col,row,q:col-Math.floor(row/2),r:row,
    owner:row,originalOwner:row,capital:false,
    terrain:'plains',troops:32,fort:0});
  }
  for(let pass=0;pass<340;pass++){
   const a=states[randomRange(g,0,states.length-1)];
   const frontier=states.filter(b=>b.owner!==a.owner&&neighbors(a,b));
   if(!frontier.length)continue;
   const b=frontier[randomRange(g,0,frontier.length-1)];
   const oldA=a.owner,oldB=b.owner;
   a.owner=oldB;b.owner=oldA;
   if(!connected(states,oldA)||!connected(states,oldB)){
    a.owner=oldA;b.owner=oldB;
   }
  }
  const terrainDeck=['plains','plains','farms','forest','hills','river'];
  for(const s of states){
   s.originalOwner=s.owner;
   s.terrain=terrainDeck[randomRange(g,0,terrainDeck.length-1)];
   s.troops=28+randomRange(g,0,15);
  }
  for(let id=0;id<n;id++){
   const owned=states.filter(s=>s.owner===id);
   const capital=owned.slice().sort((a,b)=>{
    const aSum=owned.reduce((v,x)=>v+Math.abs(a.q-x.q)+Math.abs(a.r-x.r),0);
    const bSum=owned.reduce((v,x)=>v+Math.abs(b.q-x.q)+Math.abs(b.r-x.r),0);
    return aSum-bSum;
   })[0];
   capital.capital=true;capital.troops=82;
  }
  for(const s of states){
   s.neighbors=states.filter(b=>neighbors(s,b)).map(b=>b.id);
  }
  return states;
 }
 function createMatch(options={}){
  const num=clamp(Math.floor(Number(options.countries)||3),2,6);
  const seed=(Number(options.seed)>>>0)||Math.floor(Math.random()*0xffffffff)||1;
  const g={
   version:1,seed,rng:seed,countryCount:num,
   time:0,limit:1800,speed:options.fast?5:1,paused:false,
   nextStrategy:300,nextEvent:120,ended:false,winner:null,log:[],
   pendingStrategy:null,pendingEvent:null,transits:[],
   states:[],countries:[]
  };
  g.states=createMap(g,num);
  const specialties=['metal','oil','food','knowledge','people','metal'];
  for(let i=0;i<num;i++){
   const specialty=specialties[i];
   const resources={food:85,metal:85,oil:70,knowledge:35,people:125};
   resources[specialty]+=35;
   g.countries.push({id:i,name:NAMES[i],color:COLORS[i],specialty,
    resources,tech:1,policy:'none',policyUntil:0,nextAi:38+randomRange(g,0,28),
    kills:0,lastAction:'Preparing defenses'});
  }
  note(g,'The war begins. Five states per country; one victor.');
  return g;
 }
 function note(g,message){g.log.unshift({time:Math.floor(g.time),text:message});g.log.length=Math.min(35,g.log.length)}
 function country(g,id){return g.countries[id]}
 function getState(g,id){return g.states.find(s=>s.id===Number(id))}
 function production(g,id){
  const c=country(g,id),lands=idsFor(g,id),r={food:0,metal:0,oil:0,knowledge:0,people:0};
  for(const state of lands){
   r.food+=state.terrain==='farms'?5:1.4;
   r.metal+=state.terrain==='hills'?4.3:1.45;
   r.oil+=state.terrain==='river'?1.7:1.3;
   r.knowledge+=state.capital?2.1:.55;
   r.people+=state.terrain==='plains'?2.2:.7;
  }
  if(c.specialty==='food')r.food*=1.27;
  if(c.specialty==='metal')r.metal*=1.25;
  if(c.specialty==='oil')r.oil*=1.25;
  if(c.specialty==='knowledge')r.knowledge*=1.30;
  if(c.specialty==='people')r.people*=1.25;
  if(c.policyUntil>g.time){
   if(c.policy==='industry'){r.metal*=1.35;r.oil*=1.35}
   if(c.policy==='harvest')r.food*=1.40;
  }
  return r; // production per in-game minute
 }
 function canPay(r,cost){return Object.entries(cost).every(([k,v])=>r[k]>=v)}
 function spend(r,cost){for(const [k,v] of Object.entries(cost))r[k]-=v}
 function train(g,id,stateId){
  const s=getState(g,stateId),c=country(g,id);
  if(g.ended||g.pendingEvent||g.pendingStrategy||!s||s.owner!==id)return {ok:false,error:'Select a state you control.'};
  if(!canPay(c.resources,COST.train))return {ok:false,error:'Not enough metal, food, or population.'};
  spend(c.resources,COST.train);
  const amount=c.policy==='mobilize'&&c.policyUntil>g.time?30:20;
  s.troops+=amount;
  note(g,c.name+' recruited '+amount+' soldiers in State '+(s.id+1)+'.');
  return {ok:true,amount};
 }
 function fortify(g,id,stateId){
  const s=getState(g,stateId),c=country(g,id);
  if(g.ended||g.pendingEvent||g.pendingStrategy||!s||s.owner!==id)return {ok:false,error:'Select a state you control.'};
  if(s.fort>=3)return {ok:false,error:'This state already has maximum fortifications.'};
  if(!canPay(c.resources,COST.fortify))return {ok:false,error:'Not enough metal or food.'};
  spend(c.resources,COST.fortify);s.fort++;
  note(g,c.name+' fortified State '+(s.id+1)+'.');
  return {ok:true};
 }
 function march(g,id,fromId,toId,amount){
  const from=getState(g,fromId),to=getState(g,toId);
  if(g.ended||g.pendingEvent||g.pendingStrategy)return {ok:false,error:'Resolve the current event first.'};
  if(!from||!to||from.owner!==id)return {ok:false,error:'Choose an army in your territory.'};
  if(!from.neighbors.includes(to.id))return {ok:false,error:'Armies can only move to adjoining states.'};
  const count=Math.floor(amount);
  if(!Number.isFinite(count)||count<12||count>from.troops-5)return {ok:false,error:'Send at least 12 troops, leaving five behind.'};
  const c=country(g,id);
  const travel=20+(to.terrain==='hills'?16:0)+(to.terrain==='forest'?8:0)+randomRange(g,0,8);
  from.troops-=count;
  g.transits.push({id:g.rng+g.transits.length,owner:id,from:from.id,to:to.id,
   troops:count,start:g.time,arrival:g.time+travel});
  note(g,c.name+' sent '+count+' troops toward State '+(to.id+1)+'.');
  return {ok:true,arrival:g.time+travel};
 }
 function supply(g,s,id){
  const c=country(g,id),lands=idsFor(g,id);
  if(!lands.length)return false;
  const capit=lands.find(p=>p.capital);
  if(!capit)return false;
  const seen=new Set([capit.id]),queue=[capit];
  while(queue.length){
   const a=queue.pop();
   for(const neighborId of a.neighbors){
    const t=getState(g,neighborId);
    if(t.owner===id&&!seen.has(t.id)){
     seen.add(t.id);queue.push(t);
    }
   }
  }
  return seen.has(s.id);
 }
 function battle(g,order){
  const target=getState(g,order.to),from=getState(g,order.from);
  if(!target||!country(g,order.owner))return;
  if(target.owner===order.owner){
   target.troops+=order.troops;
   if(order.owner===0)note(g,order.troops+' troops reached State '+(target.id+1)+'.');
   return;
  }
  const attacker=country(g,order.owner),defender=country(g,target.owner);
  const terrainFactor=target.terrain==='hills'?1.32:target.terrain==='forest'?1.20:target.terrain==='river'?1.12:1.02;
  const supplyBonus=supply(g,target,target.owner)?1.07:.75;
  const defendPolicy=defender.policyUntil>g.time&&defender.policy==='defense'?1.25:1;
  const attackPolicy=attacker.policyUntil>g.time&&['research','intelligence'].includes(attacker.policy)?1.18:1;
  const oilFactor=attacker.resources.oil<8?.84:1;
  const attackPower=order.troops*(1+.10*(attacker.tech-1))*attackPolicy*oilFactor*(.95+roll(g)*.10);
  const defendPower=Math.max(1,target.troops)*(1+target.fort*.28)*terrainFactor*supplyBonus*defendPolicy*(.95+roll(g)*.10);
  if(attackPower>defendPower){
   const losses=clamp(Math.round(order.troops*(.17+.52*(defendPower/attackPower))),1,order.troops-1);
   const survivor=Math.max(6,order.troops-losses);
   const previous=target.owner;
   target.owner=order.owner;target.troops=survivor;target.fort=0;
   attacker.kills++;defender.kills++;
   note(g,attacker.name+' captured State '+(target.id+1)+' from '+defender.name+' ('+survivor+' survivors).');
   if(ownedCount(g,previous)===0)note(g,defender.name+' has been eliminated.');
  }else{
   const losses=Math.min(target.troops-1,Math.round(order.troops*.35/(terrainFactor*supplyBonus)));
   target.troops=Math.max(5,target.troops-losses);
   if(order.owner===0||target.owner===0){
    note(g,defender.name+' held State '+(target.id+1)+' against '+attacker.name+'.');
   }
  }
 }
 function pickStrategies(g){
  const keys=Object.keys(STRATEGIES),options=[];
  while(options.length<3){
   const key=keys[randomRange(g,0,keys.length-1)];
   if(!options.includes(key))options.push(key);
  }
  return options;
 }
 function applyStrategy(g,id,key){
  if(!STRATEGIES[key]||g.ended)return {ok:false,error:'Unknown strategy.'};
  const c=country(g,id);
  if(!idsFor(g,id).length)return {ok:false,error:'This country was eliminated.'};
  if(id===0&&(!g.pendingStrategy||!g.pendingStrategy.options.includes(key))){
   return {ok:false,error:'Choose one of the offered strategies.'};
  }
  c.policy=key;c.policyUntil=g.time+300;
  if(key==='research'){c.tech=Math.min(5,c.tech+.4);c.resources.knowledge+=13}
  if(key==='harvest')c.resources.food+=35;
  if(key==='defense')idsFor(g,id).forEach(s=>{if(s.fort<2)s.fort++});
  if(key==='intelligence')c.resources.knowledge+=8;
  note(g,c.name+' adopted '+STRATEGIES[key].label+'.');
  if(id===0)g.pendingStrategy=null;
  return {ok:true};
 }
 function triggerEvent(g,forced=false){
  if(g.ended||g.pendingEvent||g.pendingStrategy)return false;
  if(!forced&&roll(g)>.27)return false;
  const candidates=aliveCountries(g);
  if(!candidates.length)return false;
  const receiver=forced?country(g,0):candidates[randomRange(g,0,candidates.length-1)];
  if(!receiver||!ownedCount(g,receiver.id))return false;
  const land=idsFor(g,receiver.id),state=land[randomRange(g,0,land.length-1)];
  const keys=Object.keys(EVENTS),type=keys[randomRange(g,0,keys.length-1)];
  const event={type,stateId:state.id,owner:receiver.id,created:g.time};
  if(receiver.id===0){g.pendingEvent=event;note(g,EVENTS[type].title+' threatens your territory!')}
  else resolveEvent(g,event,roll(g)>.46);
  return true;
 }
 function resolveEvent(g,event,success){
  const state=getState(g,event.stateId),c=country(g,event.owner);
  if(!state||!c){g.pendingEvent=null;return false}
  const factor=success?.18:1;
  const casualties=Math.min(state.troops-1,Math.round(state.troops*.16*factor));
  state.troops=Math.max(1,state.troops-casualties);
  const lossResource=event.type==='fire'?'metal':event.type==='signals'?'oil':'food';
  const damage=Math.round(19*factor);
  c.resources[lossResource]=Math.max(0,c.resources[lossResource]-damage);
  note(g,c.name+' '+(success?'contained':'suffered')+' '+EVENTS[event.type].title.toLowerCase()+
   ' in State '+(state.id+1)+'. '+casualties+' troops lost.');
  g.pendingEvent=null;return true;
 }
 function aiStep(g,id){
  if(g.ended||!ownedCount(g,id))return;
  const c=country(g,id),owned=idsFor(g,id);
  if(c.policyUntil<=g.time||c.policy==='none'){
   const options=pickStrategies(g);
   applyStrategy(g,id,options[randomRange(g,0,options.length-1)]);
  }
  const fronts=[];
  for(const s of owned)for(const dest of s.neighbors.map(k=>getState(g,k))){
   if(dest.owner!==id)fronts.push({from:s,to:dest,ratio:s.troops/Math.max(dest.troops,1)});
  }
  fronts.sort((a,b)=>b.ratio-a.ratio);
  const best=fronts[0];
  if(best&&best.from.troops>45&&best.ratio>1.27){
   march(g,id,best.from.id,best.to.id,Math.floor(best.from.troops*.78));
  }else if(canPay(c.resources,COST.train)){
   const target=best?best.from:owned.slice().sort((a,b)=>a.troops-b.troops)[0];
   train(g,id,target.id);
  }else if(best&&best.from.fort<2&&canPay(c.resources,COST.fortify)){
   fortify(g,id,best.from.id);
  }else{
   // Consolidate reserves if attacking is too risky.
   const candidates=owned.filter(s=>s.troops>50);
   if(candidates.length){
    const from=candidates[randomRange(g,0,candidates.length-1)];
    const dst=from.neighbors.map(k=>getState(g,k)).find(s=>s.owner===id&&
      s.neighbors.some(k=>getState(g,k).owner!==id));
    if(dst)march(g,id,from.id,dst.id,Math.floor(from.troops*.34));
   }
  }
  c.nextAi=g.time+randomRange(g,38,71);
 }
 function scoreCountry(g,c){
  const lands=idsFor(g,c.id);
  return {states:lands.length,troops:lands.reduce((v,s)=>v+s.troops,0),
   capitals:lands.filter(s=>s.capital).length,tech:c.tech,
   total:lands.length*1000+lands.reduce((v,s)=>v+s.troops,0)+c.tech*10};
 }
 function finishGame(g){
  if(g.ended)return;
  const eligible=aliveCountries(g);
  if(eligible.length>1&&g.time<g.limit)return;
  g.ended=true;
  eligible.sort((a,b)=>{
   const x=scoreCountry(g,a),y=scoreCountry(g,b);
   return y.total-x.total||a.id-b.id;
  });
  g.winner=eligible[0]?.id??null;
  note(g,(g.winner===null?'No winner':country(g,g.winner).name+' has won the war!'));
  g.pendingStrategy=null;g.pendingEvent=null;
 }
 function advance(g,dt){
  if(g.ended||g.paused||g.pendingStrategy||g.pendingEvent)return;
  const stop=Math.min(g.limit,g.time+clamp(Number(dt)||0,0,5));
  // Small deterministic steps keep income, dispatch and event boundaries stable.
  while(g.time+1e-7<stop&&!g.pendingStrategy&&!g.pendingEvent&&!g.ended){
   const step=Math.min(1,stop-g.time);g.time+=step;
   for(const c of g.countries){
    if(!ownedCount(g,c.id))continue;
    const r=production(g,c.id);
    for(const [k,rate] of Object.entries(r))c.resources[k]=Math.min(500,c.resources[k]+rate*step/60);
   }
   for(let i=g.transits.length-1;i>=0;i--){
    if(g.transits[i].arrival<=g.time){
     const transit=g.transits.splice(i,1)[0];battle(g,transit);
    }
   }
   if(Math.floor(g.time)%3===0){
    for(let i=1;i<g.countries.length;i++){
     if(g.countries[i].nextAi<=g.time)aiStep(g,i);
    }
   }
   if(g.time>=g.nextStrategy){
    g.nextStrategy+=300;
    for(let i=1;i<g.countries.length;i++)if(ownedCount(g,i)){
     const choices=pickStrategies(g);
     applyStrategy(g,i,choices[randomRange(g,0,2)]);
    }
    if(ownedCount(g,0)){
     g.pendingStrategy={options:pickStrategies(g)};
     note(g,'National council convened. Choose your next five-minute directive.');
    }
   }
   if(g.time>=g.nextEvent&&!g.pendingStrategy){
    g.nextEvent+=120;triggerEvent(g);
   }
   finishGame(g);
  }
 }
 return {createMatch,advance,march,train,fortify,applyStrategy,triggerEvent,resolveEvent,
  production,scoreCountry,ownedCount,idsFor,getState,neighbors,aliveCountries,
  TERRAIN,STRATEGIES,EVENTS,COST,COLORS,NAMES};
});
