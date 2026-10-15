/* Crilo score rarity: percentile bands calibrated against one million wheel
   simulations with a fixed RNG seed. Integer-score ties prevent exact shares.
   The displayed tail odds are estimated independently with 100k samples. */
window.CriloRarity=(()=>{
 const COUNT=100000;
 const levels=[
  {key:'divine',label:'DIVINE',max:0.001},{key:'mythic',label:'MYTHIC',max:0.01},
  {key:'anomaly',label:'ANOMALY',max:0.05},{key:'epic',label:'EPIC',max:0.10},
  {key:'rare',label:'RARE',max:0.25},{key:'uncommon',label:'UNCOMMON',max:0.50},
  {key:'common',label:'COMMON',max:0.99},{key:'trash',label:'TRASH',max:1}
 ];
 // Individual BADGE rarity measures chance of earning a badge per Daily,
 // unlike final SCORE rarity. The input is a percentage, not a fraction.
 const badgeBands=[
  {key:'common',min:10,label:'More than 10% of Dailies'},
  {key:'uncommon',min:1,label:'1–10% of Dailies'},
  {key:'rare',min:0.1,label:'0.1–1% of Dailies'},
  {key:'epic',min:0.01,label:'0.01–0.1% of Dailies'},
  {key:'anomaly',min:0.001,label:'0.001–0.01% of Dailies'},
  {key:'mythic',min:0,label:'Under 0.001% of Dailies'}
 ];
 function badgeTierFromPercent(value){
  if(value==null||value==='')return null;
  const chance=Number(value);
  if(!Number.isFinite(chance)||chance<0||chance>100)return null;
  if(chance>10)return 'common';
  if(chance>=1)return 'uncommon';
  if(chance>=.1)return 'rare';
  if(chance>=.01)return 'epic';
  if(chance>=.001)return 'anomaly';
  return 'mythic';
 }
 const scoreBands=[
  {key:'trash',min:0,max:120},{key:'common',min:121,max:440},
  {key:'uncommon',min:441,max:860},{key:'rare',min:861,max:1620},
  {key:'epic',min:1621,max:2460},{key:'anomaly',min:2461,max:5440},
  {key:'mythic',min:5441,max:14420},{key:'divine',min:14421,max:Infinity}
 ];
 let sorted;
 function sample(){
  if(sorted)return sorted;
  let seed=0xC4102026;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const data=new Array(COUNT);
  for(let k=0;k<COUNT;k++){
   let left=5,score=0,multiplier=1,upgrades=0,steps=0;
   const twelve=[20,20,20,40,40,60,80,'double','upgrade','spins','duck','duck'];
   const segments=twelve.concat(twelve);
   while(left>0&&steps++<250){
    left--;
    const v=segments[Math.floor(rand()*segments.length)];
    if(typeof v==='number')score+=v*multiplier;
    else if(v==='double'){score*=2;left++}
    else if(v==='upgrade'){
     multiplier*=3;left++;upgrades++;
     const bases=[20,20,40,40,60,60,80,80,120,160];
     for(let i=0;i<4+Math.min(upgrades,8);i++){const value=bases[Math.floor(rand()*bases.length)];segments.push(value,value)}
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
   explanation:(tail*100).toFixed(2)+'% of simulated runs scored at least this high.'};
 }
 function thresholds(){return scoreBands.filter(b=>b.key!=='trash').map(b=>({label:b.key.toUpperCase(),minScore:b.min}));}
 return{classify,thresholds,levels,scoreBands,badgeBands,badgeTierFromPercent};
})();