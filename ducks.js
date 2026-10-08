// Crilo's hand-doodled duck companions. No emoji art.
window.DuckWorld=(()=>{
let catalog=[{id:1,slug:'classic',name:'Classic',tier:'Common',unlock_runs:0,appearance_weight:1000}],completed=0,spawned=0;
const colors={classic:'#ffe076',blue:'#a9dafa',pink:'#ffc4db',mallard:'#a9cba0',duckling:'#fff1ab',snow:'#f8f8f1',fire:'#ffa473',ice:'#bdeaff',galaxy:'#b6a1e5'};
const hats={cowboy:'<path d="M26 27L32 16H56L63 27M22 28Q44 34 68 28" fill="#bc9467" stroke="#453b35" stroke-width="3"/>',chef:'<path d="M29 27V17Q25 9 35 9Q45 2 53 10Q65 7 62 18V27Z" fill="#fff" stroke="#453b35" stroke-width="3"/>',wizard:'<path d="M28 27L46 5L63 27Z" fill="#ad95e0" stroke="#453b35" stroke-width="3"/>',royal:'<path d="M30 26L28 13L39 20L46 9L55 20L64 13L62 26Z" fill="#f4cc65" stroke="#453b35" stroke-width="3"/>',party:'<path d="M33 27L44 5L56 27Z" fill="#f8a2ca" stroke="#453b35" stroke-width="3"/>',pirate:'<path d="M27 27Q44 9 63 27Z" fill="#3e4057" stroke="#453b35" stroke-width="3"/>',astronaut:'<circle cx="47" cy="43" r="30" fill="none" stroke="#b4c9dd" stroke-width="7"/>',robot:'<path d="M30 28V15H62V28M46 15V7" fill="#c7d7dd" stroke="#453b35" stroke-width="3"/>',bee:'<path d="M30 53H65M37 62H64" stroke="#453b35" stroke-width="5"/>',angel:'<ellipse cx="46" cy="12" rx="16" ry="5" fill="none" stroke="#e4c474" stroke-width="3"/>',devil:'<path d="M30 27L28 13L40 23M55 23L66 13L64 27" fill="#f5a2a2" stroke="#453b35" stroke-width="3"/>',frog:'<circle cx="35" cy="26" r="8" fill="#9ad19a" stroke="#453b35" stroke-width="3"/><circle cx="59" cy="26" r="8" fill="#9ad19a" stroke="#453b35" stroke-width="3"/>'};
function art(d){const fill=colors[d.slug]||'#ffe1a2';return '<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round"><path d="M28 70L26 78M44 70L45 79" stroke="#c88a58" stroke-width="4"/><path d="M13 55Q10 36 29 35Q41 28 49 39Q63 31 73 45Q82 61 66 72Q40 82 21 68Q14 63 13 55Z" fill="'+fill+'" stroke="#453b35" stroke-width="3.5"/><path d="M45 43Q49 25 64 26Q79 27 78 43Q78 53 65 56" fill="'+fill+'" stroke="#453b35" stroke-width="3.5"/><path d="M72 42Q84 40 91 45Q85 53 72 50Z" fill="#f7ab67" stroke="#453b35" stroke-width="3"/><path d="M27 54Q40 44 51 55Q44 65 32 63" fill="none" stroke="#aa9a74" stroke-width="2"/><circle cx="68" cy="37" r="3" fill="#453b35"/>'+(hats[d.slug]||'')+'</g></svg>'}
async function load(db,user){if(!db||!user)return;const [a,b]=await Promise.all([db.from('duck_types').select('id,slug,name,tier,unlock_runs,appearance_weight').order('id'),db.rpc('crilo_duck_progress')]);if(!a.error&&a.data?.length)catalog=a.data;if(!b.error&&b.data?.length)completed=Number(b.data[0].completed_dailies)||0;else console.warn('Duck progress unavailable',b.error)}
function choose(){const available=catalog.filter(d=>d.unlock_runs<=completed);const list=available.length?available:[catalog[0]];let n=Math.random()*list.reduce((s,d)=>s+d.appearance_weight,0);for(const d of list){n-=d.appearance_weight;if(n<0)return d}return list[0]}
const moving=new Set();
// Each catalog duck has its own deterministic melodic/quack signature.
function quack(d){
 if(localStorage.getItem('crilo_sound')==='off'||window.Crilo?.profile?.sound_enabled===false)return;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  const ac=quack.context||(quack.context=new Audio());
  if(ac.state==='suspended')ac.resume().catch(()=>{});
  const now=ac.currentTime;
  const limiter=quack.limiter||(quack.limiter=(()=>{const c=ac.createDynamicsCompressor();c.threshold.value=-19;c.knee.value=12;c.ratio.value=7;c.attack.value=.003;c.release.value=.14;c.connect(ac.destination);return c})());
  const key=String(d?.slug||d?.id||'classic');
  let seed=2166136261;
  for(let i=0;i<key.length;i++)seed=Math.imul(seed^key.charCodeAt(i),16777619)>>>0;
  // One short, individual quack per duck. No secondary chimes or melodies.
  const duration=.15+((seed>>>7)%7)*.013;
  const pitch=360+(seed%320);
  const fall=.48+((seed>>>13)%28)/100;
  const waves=['triangle','sawtooth','square'];
  const wave=waves[(seed>>>5)%waves.length];
  const o=ac.createOscillator(),filter=ac.createBiquadFilter(),gain=ac.createGain();
  o.type=wave;
  o.frequency.setValueAtTime(pitch,now);
  o.frequency.exponentialRampToValueAtTime(pitch*fall,now+duration);
  filter.type='lowpass';
  filter.frequency.value=700+((seed>>>11)%9)*110;
  o.connect(filter);filter.connect(gain);gain.connect(limiter);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(.075,now+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  o.start(now);o.stop(now+duration+.01);
 }catch(e){console.warn('Duck sound unavailable',e)}
}
function bounds(){
 const header=document.querySelector('.topbar')?.getBoundingClientRect().bottom||70;
 const top=Math.min(innerHeight-90,Math.max(100,header+14));
 return {left:8,right:Math.max(8,innerWidth-85),top,bottom:Math.max(top,innerHeight-95)};
}
function roam(el){
 if(!moving.has(el)||!el.isConnected)return;
 const b=bounds(),x=Number(el.dataset.x),y=Number(el.dataset.y);
 // Small meandering movements with a gentle vertical bob, instead of teleport-like diagonal sweeps.
 const dx=(Math.random()-.5)*Math.min(350,innerWidth*.38);
 const dy=(Math.random()-.5)*Math.min(140,innerHeight*.2);
 const nx=Math.max(b.left,Math.min(b.right,x+dx));
 const ny=Math.max(b.top,Math.min(b.bottom,y+dy));
 const duration=3200+Math.random()*3300;
 const facing=nx<x?-1:1;
 el.querySelector('svg').style.transform='scaleX('+facing+')';
 const anim=el.animate([
  {transform:`translate(${x}px,${y}px)`},
  {transform:`translate(${x+(nx-x)*.35}px,${y+(ny-y)*.35-9}px)`,offset:.35},
  {transform:`translate(${x+(nx-x)*.7}px,${y+(ny-y)*.7+5}px)`,offset:.7},
  {transform:`translate(${nx}px,${ny}px)`}
 ],{duration,easing:'ease-in-out',fill:'forwards'});
 el.motion=anim;
 anim.onfinish=()=>{el.style.transform=`translate(${nx}px,${ny}px)`;el.dataset.x=nx;el.dataset.y=ny;roam(el)};
}
function spawn(){
 const d=choose(),el=document.createElement('button');
 el.type='button';el.className='duck-pal roaming-duck';el.title='Quack! '+d.name;el.setAttribute('aria-label','Hear '+d.name+' quack');
 el.innerHTML=art(d);
 const root=document.getElementById('creatures');if(!root)return d;
 root.appendChild(el);moving.add(el);
 const b=bounds(),x=b.left+Math.random()*(b.right-b.left),y=b.top+Math.random()*(b.bottom-b.top);
 el.dataset.x=x;el.dataset.y=y;el.style.transform=`translate(${x}px,${y}px)`;
 el.addEventListener('click',()=>{quack(d);el.classList.remove('duck-quacking');void el.offsetWidth;el.classList.add('duck-quacking')});
 roam(el);
 if(moving.size>15){const first=moving.values().next().value;first.motion?.cancel();first.remove();moving.delete(first)}
 return d;
}
function clear(){spawned=0;for(const el of moving){el.motion?.cancel();el.remove()}moving.clear();document.getElementById('creatures')?.replaceChildren()}
return{load,spawn,clear,art,playSound:quack,get catalog(){return catalog},get completed(){return completed}};
})();