(() => {
const wheel=document.getElementById("wheel"), ctx=wheel.getContext("2d");
const drawing=document.getElementById("drawing"), dctx=drawing.getContext("2d");
const spinBtn=document.getElementById("spinButton"), scoreEl=document.getElementById("score"), spinsEl=document.getElementById("spins"), levelEl=document.getElementById("level"), msg=document.getElementById("message");
const dailyBtn=document.getElementById("dailyBtn"), unlimitedBtn=document.getElementById("unlimitedBtn"), gameLabel=document.getElementById("gameLabel");
let mode="daily", started=false, spinning=false, score=0, spins=5, multiplier=1, upgrades=0, doubles=0, ducks=0, totalSpins=0, rotation=0;
let segments=[];
const palette=["#ffd166","#8ecae6","#ffafcc","#bde0fe","#caffbf","#f1c0e8","#a9def9","#fcf6bd","#d0f4de","#e4c1f9"];
function resetSegments(){segments=[
 {type:"num",base:1},{type:"num",base:1},{type:"num",base:1},{type:"num",base:2},
 {type:"num",base:2},{type:"num",base:3},{type:"num",base:5},
 {type:"double",label:"×2"},{type:"upgrade",label:"UP"},{type:"spins",label:"+2"},
 {type:"duck",label:"🦆"}
];}
function label(s){return s.type==="num"?fmt(s.base*multiplier):s.label}
function fmt(n){if(n<1e3)return Math.round(n).toLocaleString();const units=[["Qa",1e15],["T",1e12],["B",1e9],["M",1e6],["K",1e3]];for(const [u,v] of units)if(n>=v)return (n/v>=100?(n/v).toFixed(0):(n/v).toFixed(1)).replace(".0","")+u;return String(n)}
function drawWheel(){
 const w=wheel.width,c=w/2,r=c-10,N=segments.length,a=Math.PI*2/N;
 ctx.clearRect(0,0,w,w);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);
 segments.forEach((s,i)=>{const start=i*a-Math.PI/2,end=start+a;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,end);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
 ctx.save();ctx.rotate(start+a/2);ctx.translate(r*.69,0);ctx.rotate(Math.PI/2);ctx.fillStyle="#17191e";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`900 ${Math.max(12,Math.min(24,190/N))}px system-ui`;ctx.fillText(label(s),0,0);ctx.restore();});
 ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle="#17191e";ctx.lineWidth=6;ctx.stroke();ctx.restore();
}
function update(){scoreEl.textContent=fmt(score);spinsEl.textContent=spins;levelEl.textContent="×"+fmt(multiplier);drawWheel()}
function addDuck(){ducks++;const d=document.createElement("div");d.className="duck";d.textContent="🦆";d.style.animationDelay=(-Math.random()*7)+"s";document.getElementById("creatures").appendChild(d)}
function addNumbers(){
 const count=4+Math.min(upgrades,8);
 const bases=[1,1,2,2,3,3,5,5,8,10];
 for(let i=0;i<count;i++)segments.push({type:"num",base:bases[Math.floor(Math.random()*bases.length)]});
}
function resolve(s){
 if(s.type==="num"){const v=s.base*multiplier;score+=v;msg.textContent="+"+fmt(v)}
 if(s.type==="double"){score*=2;spins++;doubles++;msg.textContent="DOUBLE — score ×2 and this spin is free."}
 if(s.type==="upgrade"){multiplier*=3;upgrades++;spins++;addNumbers();msg.textContent="UPGRADE — number values ×3. The wheel grew."}
 if(s.type==="spins"){spins+=2;msg.textContent="+2 SPINS"}
 if(s.type==="duck"){spins++;addDuck();msg.textContent="DUCK — +1 free spin. He lives here now."}
 update();
 if(spins<=0)endRun();
}
function spin(){
 if(spinning||!started||spins<=0)return;
 spinning=true;spinBtn.disabled=true;spins--;totalSpins++;update();msg.textContent="...";
 const N=segments.length,a=Math.PI*2/N,index=Math.floor(Math.random()*N);
 const targetCenter=index*a+a/2-Math.PI/2;
 const current=((rotation%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
 let desired=(-Math.PI/2-targetCenter)%(Math.PI*2); if(desired<0)desired+=Math.PI*2;
 let delta=desired-current; if(delta<0)delta+=Math.PI*2;
 const start=rotation,end=rotation+Math.PI*2*(5+Math.floor(Math.random()*3))+delta;
 const t0=performance.now(),dur=2800;
 function anim(t){let p=Math.min(1,(t-t0)/dur),ease=1-Math.pow(1-p,4);rotation=start+(end-start)*ease;drawWheel();if(p<1)requestAnimationFrame(anim);else{rotation=end;spinning=false;resolve(segments[index]);if(spins>0){spinBtn.disabled=false}}}
 requestAnimationFrame(anim);
}
function start(){
 started=true;score=0;spins=5;multiplier=1;upgrades=0;doubles=0;ducks=0;totalSpins=0;rotation=0;resetSegments();document.getElementById("creatures").innerHTML="";document.getElementById("drawPanel").style.display="none";document.getElementById("result").classList.add("hidden");spinBtn.disabled=false;msg.textContent="Good luck.";update();
}
function endRun(){
 spinBtn.disabled=true;document.getElementById("result").classList.remove("hidden");document.getElementById("finalScore").textContent=fmt(score);document.getElementById("statSpins").textContent=totalSpins;document.getElementById("statUpgrades").textContent=upgrades;document.getElementById("statDoubles").textContent=doubles;document.getElementById("statDucks").textContent=ducks;msg.textContent=mode==="daily"?"Daily run complete.":"Run complete.";
}
dailyBtn.addEventListener("click",()=>{mode="daily";dailyBtn.classList.add("active");unlimitedBtn.classList.remove("active");gameLabel.textContent="DAILY WHEEL";});
unlimitedBtn.addEventListener("click",()=>{mode="unlimited";unlimitedBtn.classList.add("active");dailyBtn.classList.remove("active");gameLabel.textContent="UNLIMITED WHEEL";});
document.getElementById("startRun").addEventListener("click",start);spinBtn.addEventListener("click",spin);
document.getElementById("againButton").addEventListener("click",()=>{mode="unlimited";unlimitedBtn.click();dctx.clearRect(0,0,drawing.width,drawing.height);document.getElementById("drawPanel").style.display="flex";document.getElementById("result").classList.add("hidden");started=false;spinBtn.disabled=true;msg.textContent="Draw something, then start your run.";});
document.getElementById("clearDrawing").addEventListener("click",()=>dctx.clearRect(0,0,drawing.width,drawing.height));
let painting=false,last=null;
function point(e){const r=drawing.getBoundingClientRect();return{x:(e.clientX-r.left)*drawing.width/r.width,y:(e.clientY-r.top)*drawing.height/r.height}}
drawing.addEventListener("pointerdown",e=>{painting=true;drawing.setPointerCapture(e.pointerId);last=point(e)});
drawing.addEventListener("pointermove",e=>{if(!painting)return;const p=point(e);dctx.strokeStyle=document.getElementById("drawColor").value;dctx.lineWidth=6;dctx.lineCap="round";dctx.lineJoin="round";dctx.beginPath();dctx.moveTo(last.x,last.y);dctx.lineTo(p.x,p.y);dctx.stroke();last=p});
drawing.addEventListener("pointerup",()=>{painting=false;last=null});drawing.addEventListener("pointercancel",()=>{painting=false;last=null});
resetSegments();drawWheel();update();
})();