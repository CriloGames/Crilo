/* Crilo score rarity: deterministic reference distribution from the same wheel rules.
   A score's tail percentage = simulated runs with score >= it / reference runs. */
window.CriloRarity=(()=>{
 const COUNT=100000;
 const levels=[
  {key:'mythic',label:'MYTHIC',max:0.0001},
  {key:'legendary',label:'LEGENDARY',max:0.001},
  {key:'epic',label:'EPIC',max:0.01},
  {key:'rare',label:'RARE',max:0.05},
  {key:'uncommon',label:'UNCOMMON',max:0.20},
  {key:'common',label:'COMMON',max:1}
 ];
 let sorted;
 function sample(){
  if(sorted)return sorted;
  let seed=0xC4102026;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const data=new Array(COUNT);
  for(let k=0;k<COUNT;k++){
   let left=5,score=0,multiplier=1,upgrades=0,steps=0;
   const segments=[1,1,1,2,2,3,5,'double','upgrade','spins','duck'];
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
  const values=sample(),n=values.length;
  let lo=0,hi=n;
  while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<score)lo=mid+1;else hi=mid}
  const hits=n-lo,tail=hits/n;
  // If none of 100k runs reached this score, don't claim an exact 1-in-X chance.
  const level=levels.find(l=>tail<=l.max)||levels[levels.length-1];
  return{label:level.label,color:level.key,probability:tail,odds:hits?Math.max(1,Math.round(n/hits)):n,hits,trials:n,
    explanation:hits===0?'An extraordinary score — higher than every run in our 100,000-run simulation!':'Your score beats about '+((1-tail)*100).toFixed(tail<0.01?3:tail<1?2:1)+'% of simulated runs!'};
 }
 function thresholds(){const data=sample();return levels.slice(0,-1).map(l=>({label:l.label,minScore:data[Math.max(0,Math.ceil(data.length*(1-l.max))-1)]}))}
 return{classify,thresholds,levels};
})();