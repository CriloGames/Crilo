/* Crilo score rarity: deterministic reference distribution from the same wheel rules.
   A score's tail percentage = simulated runs with score >= it / reference runs. */
window.CriloRarity=(()=>{
 const COUNT=100000;
 const levels=[
  {key:'mythic',label:'MYTHIC',max:1/90},
  {key:'anomaly',label:'ANOMALY',max:0.05},
  {key:'epic',label:'EPIC',max:0.10},
  {key:'rare',label:'RARE',max:0.25},
  {key:'uncommon',label:'UNCOMMON',max:0.50},
  {key:'common',label:'COMMON',max:0.99},
  {key:'trash',label:'TRASH',max:1}
 ];
 const scoreBands=[
 {key:'trash',min:0,max:6},
 {key:'common',min:7,max:24},
 {key:'uncommon',min:25,max:48},
 {key:'rare',min:49,max:92},
 {key:'epic',min:93,max:141},
 {key:'anomaly',min:142,max:300},
 {key:'mythic',min:301,max:Infinity}
 ];
 let sorted;
 function sample(){
  if(sorted)return sorted;
  let seed=0xC4102026;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const data=new Array(COUNT);
  for(let k=0;k<COUNT;k++){
   let left=5,score=0,multiplier=1,upgrades=0,steps=0;
   const segments=[1,1,1,2,2,3,5,'double','upgrade','spins','duck','duck'];
   while(left>0&&steps++<250){
    left--;
    const v=segments[Math.floor(rand()*segments.length)];
    if(typeof v==='number')score+=v*multiplier;
    else if(v==='double'){score*=2;left++}
    else if(v==='upgrade'){
     multiplier*=3;left++;upgrades++;
     const bases=[1,1,2,2,3,3,5,5,8,10];
     for(let i=0;i<4+Math.min(upgrades,8);i++)segments.push(bases[Math.floor(rand()*bases.length)]);
    }else if(v==='spins')left+=2;
    else left++;
   }
   data[k]=score;
  }
  sorted=data.sort((a,b)=>a-b);return sorted;
 }
 function classify(score){
  const band=scoreBands.find(b=>score<=b.max)||scoreBands[scoreBands.length-1];
  const values=sample(),n=values.length;let lo=0,hi=n;
  while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<score)lo=mid+1;else hi=mid}
  const hits=n-lo,tail=hits/n;
  return{label:band.key.toUpperCase(),color:band.key,probability:tail,
   odds:hits?Math.max(1,Math.round(n/hits)):null,hits,trials:n,
   explanation:'Score tier based on 2,000,000 simulated runs: '+band.key.toUpperCase()+
    '. '+(tail*100).toFixed(2)+'% of simulated runs scored at least this high.'};
 }
 function thresholds(){return scoreBands.filter(b=>b.key!=='trash').map(b=>({label:b.key.toUpperCase(),minScore:b.min}));}
 return{classify,thresholds,levels,scoreBands};
})();