(() => {
const $=id=>document.getElementById(id);
const wheel=$("wheel"),ctx=wheel.getContext("2d"),drawing=$("drawing"),dctx=drawing.getContext("2d");
const spinBtn=$("spinButton"),scoreEl=$("score"),spinsEl=$("spins"),levelEl=$("level"),msg=$("message");
let started=false,spinning=false,drawingLocked=false,score=0,spins=5,multiplier=1,upgrades=0,doubles=0,ducks=0,totalSpins=0,rotation=0,user=null,profile=null,playedToday=false;
let segments=[];
const palette=["#ffd86b","#9bd9ef","#ffb8d2","#c6dcff","#c8f4bd","#efc5ef","#aee9f4","#fff0a8","#c9f1df","#dfc8f6","#ffc8a8"];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
function fmt(n){if(n<1e3)return Math.round(n).toLocaleString();const u=[["Qa",1e15],["T",1e12],["B",1e9],["M",1e6],["K",1e3]];for(const [s,v] of u)if(n>=v)return(n/v>=100?(n/v).toFixed(0):(n/v).toFixed(1)).replace(".0","")+s;return String(n)}
function resetSegments(){segments=[{type:"num",base:1},{type:"num",base:1},{type:"num",base:1},{type:"num",base:2},{type:"num",base:2},{type:"num",base:3},{type:"num",base:5},{type:"double",label:"×2"},{type:"upgrade",label:"UP! ↑"},{type:"spins",label:"+2"},{type:"duck",label:"DUCK"}]}
function label(s){return s.type==="num"?fmt(s.base*multiplier):s.label}
function drawDuckIcon(x,y,size){ctx.save();ctx.translate(x,y);ctx.strokeStyle="#17191e";ctx.lineWidth=Math.max(2,size*.08);ctx.fillStyle="#ffe06a";ctx.beginPath();ctx.ellipse(-size*.08,size*.08,size*.34,size*.24,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(size*.22,-size*.13,size*.19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#17191e";ctx.beginPath();ctx.arc(size*.28,-size*.17,size*.035,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ff9d4d";ctx.beginPath();ctx.moveTo(size*.39,-size*.11);ctx.lineTo(size*.58,-size*.04);ctx.lineTo(size*.39,size*.01);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function drawWheel(){
 const w=wheel.width,c=w/2,r=c-12,N=segments.length,a=Math.PI*2/N;
 ctx.clearRect(0,0,w,w);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);
 segments.forEach((s,i)=>{const st=i*a-Math.PI/2,en=st+a;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,st,en);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
 const ang=st+a/2,tx=Math.cos(ang)*r*.69,ty=Math.sin(ang)*r*.69;
 if(s.type==="duck"){drawDuckIcon(tx,ty,Math.max(28,Math.min(48,280/N)))}else{ctx.save();ctx.translate(tx,ty);ctx.rotate(ang+Math.PI/2);ctx.fillStyle="#17191e";ctx.textAlign="center";ctx.textBaseline="middle";const special=s.type!=="num";ctx.font=`1000 ${Math.max(13,Math.min(special?22:30,230/N))}px system-ui`;ctx.strokeStyle="rgba(255,255,255,.8)";ctx.lineWidth=5;ctx.strokeText(label(s),0,0);ctx.fillText(label(s),0,0);ctx.restore()}});
 ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle="#17191e";ctx.lineWidth=7;ctx.stroke();ctx.restore();
}
function update(){scoreEl.textContent=fmt(score);spinsEl.textContent=spins;levelEl.textContent="×"+fmt(multiplier);drawWheel()}
function duckHTML(){return `<div class="duck-body"><div class="duck-head"><i class="duck-eye"></i><i class="duck-beak"></i></div><i class="duck-wing"></i><i class="duck-foot one"></i><i class="duck-foot two"></i></div>`}
function addDuck(){ducks++;const d=document.createElement("div");d.className="duck";d.innerHTML=duckHTML();d.addEventListener("animationend",()=>d.remove());$("creatures").appendChild(d)}
function pop(text){const p=$("eventPop");p.textContent=text;p.classList.remove("show");void p.offsetWidth;p.classList.add("show")}
function bump(){const w=$("wheelWrap");w.classList.remove("upgrade-bump");void w.offsetWidth;w.classList.add("upgrade-bump")}
function addNumbers(){const count=4+Math.min(upgrades,8),bases=[1,1,2,2,3,3,5,5,8,10];for(let i=0;i<count;i++)segments.push({type:"num",base:bases[Math.floor(Math.random()*bases.length)]})}
function resolve(s){
 if(s.type==="num"){const v=s.base*multiplier;score+=v;msg.textContent="+"+fmt(v)}
 if(s.type==="double"){score*=2;spins++;doubles++;pop("×2!");msg.textContent="DOUBLE — score ×2 and this spin is free."}
 if(s.type==="upgrade"){multiplier*=3;upgrades++;spins++;addNumbers();bump();pop("UP! ↑");msg.textContent="UPGRADE — number values ×3. The wheel grew."}
 if(s.type==="spins"){spins+=2;pop("+2!");msg.textContent="+2 SPINS"}
 if(s.type==="duck"){spins++;addDuck();pop("DUCK!");msg.textContent="DUCK — free spin. He is on the move."}
 update();if(spins<=0)endRun();
}
function spin(){
 if(spinning||!started||spins<=0)return;spinning=true;spinBtn.disabled=true;spins--;totalSpins++;update();msg.textContent="...";
 const N=segments.length,a=Math.PI*2/N,index=Math.floor(Math.random()*N),target=index*a+a/2-Math.PI/2,current=((rotation%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
 let desired=(-Math.PI/2-target)%(Math.PI*2);if(desired<0)desired+=Math.PI*2;let delta=desired-current;if(delta<0)delta+=Math.PI*2;
 const start=rotation,end=rotation+Math.PI*2*(5+Math.floor(Math.random()*3))+delta,t0=performance.now(),dur=2800;
 function anim(t){let p=Math.min(1,(t-t0)/dur),ease=1-Math.pow(1-p,4);rotation=start+(end-start)*ease;drawWheel();if(p<1)requestAnimationFrame(anim);else{rotation=end;spinning=false;resolve(segments[index]);if(spins>0)spinBtn.disabled=false}}
 requestAnimationFrame(anim);
}
async function getProfile(){
 if(!user)return null;
 const {data}=await criloDB.from("profiles").select("id,username,name_color").eq("id",user.id).maybeSingle();
 profile=data||null;return profile;
}
async function checkPlayed(){
 if(!user){playedToday=false;return}
 const {data}=await criloDB.from("daily_runs").select("score,spins,upgrades,doubles,ducks").eq("user_id",user.id).eq("run_date",today()).maybeSingle();
 playedToday=!!data;
 if(playedToday){$("drawPanel").classList.add("hidden");spinBtn.classList.add("hidden");$("playedPanel").classList.remove("hidden");$("playedText").textContent=`You scored ${Number(data.score).toLocaleString()} today. Come back tomorrow.`;msg.textContent="Today's run is already complete."}
}
function open(id){$(id).classList.remove("hidden")}
function close(id){$(id).classList.add("hidden")}
async function start(){
 if(playedToday)return;
 if(!user){open("authModal");return}
 if(!profile){open("profileModal");return}
 started=true;drawingLocked=true;score=0;spins=5;multiplier=1;upgrades=0;doubles=0;ducks=0;totalSpins=0;rotation=0;resetSegments();$("wheelWrap").classList.add("locked");$("drawPanel").classList.add("hidden");$("result").classList.add("hidden");spinBtn.disabled=false;msg.textContent="Good luck.";update();
}
async function endRun(){
 spinBtn.disabled=true;started=false;
 const drawingData=drawing.toDataURL("image/png");
 const payload={user_id:user.id,run_date:today(),score:Math.round(score),spins:totalSpins,upgrades,doubles,ducks,drawing:drawingData};
 const {error}=await criloDB.from("daily_runs").insert(payload);
 $("result").classList.remove("hidden");$("finalScore").textContent=fmt(score);$("statSpins").textContent=totalSpins;$("statUpgrades").textContent=upgrades;$("statDoubles").textContent=doubles;$("statDucks").textContent=ducks;
 if(error){msg.textContent=error.code==="23505"?"Daily already submitted for today.":"Run finished, but saving failed. Please screenshot your score.";console.error(error)}
 else{playedToday=true;msg.textContent="Daily saved. See how you ranked."}
}
async function sendMagicLink(){
 const email=$("emailInput").value.trim();if(!email){$("authStatus").textContent="Enter your email first.";return}
 $("sendLinkBtn").disabled=true;$("authStatus").textContent="Sending…";
 const {error}=await criloDB.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
 $("sendLinkBtn").disabled=false;$("authStatus").textContent=error?error.message:"Check your email for the sign-in link.";
}
async function saveProfile(){
 const username=$("usernameInput").value.trim(),name_color=$("nameColorInput").value;
 if(!/^[A-Za-z0-9_]{3,20}$/.test(username)){$("profileStatus").textContent="Use 3–20 letters, numbers, or underscores.";return}
 const {error}=await criloDB.from("profiles").upsert({id:user.id,username,name_color},{onConflict:"id"});
 if(error){$("profileStatus").textContent=error.code==="23505"?"That username is taken.":error.message;return}
 await getProfile();close("profileModal");$("accountBtn").textContent=profile.username.toUpperCase();msg.textContent="Draw something, then start your Daily.";
}
async function authInit(){
 const {data:{session}}=await criloDB.auth.getSession();user=session?.user||null;
 if(user){await getProfile();$("accountBtn").textContent=profile?.username?.toUpperCase()||"SET USERNAME";if(!profile)open("profileModal");await checkPlayed()}
 criloDB.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;if(user){await getProfile();$("accountBtn").textContent=profile?.username?.toUpperCase()||"SET USERNAME";close("authModal");if(!profile)open("profileModal");await checkPlayed()}else{$("accountBtn").textContent="SIGN IN"}});
}
$("startRun").addEventListener("click",start);spinBtn.addEventListener("click",spin);$("clearDrawing").addEventListener("click",()=>{if(!drawingLocked)dctx.clearRect(0,0,drawing.width,drawing.height)});
$("helpBtn").addEventListener("click",()=>open("helpModal"));$("accountBtn").addEventListener("click",async()=>{if(!user)open("authModal");else if(!profile)open("profileModal");else if(confirm(`Signed in as ${profile.username}. Sign out?`)){await criloDB.auth.signOut();location.reload()}});
$("sendLinkBtn").addEventListener("click",sendMagicLink);$("saveProfileBtn").addEventListener("click",saveProfile);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));document.querySelectorAll(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m&&m.id!=="profileModal")close(m.id)}));
let painting=false,last=null;function point(e){const r=drawing.getBoundingClientRect();return{x:(e.clientX-r.left)*drawing.width/r.width,y:(e.clientY-r.top)*drawing.height/r.height}}
drawing.addEventListener("pointerdown",e=>{if(drawingLocked)return;painting=true;drawing.setPointerCapture(e.pointerId);last=point(e)});
drawing.addEventListener("pointermove",e=>{if(!painting||drawingLocked)return;const p=point(e);dctx.strokeStyle=$("drawColor").value;dctx.lineWidth=6;dctx.lineCap="round";dctx.lineJoin="round";dctx.beginPath();dctx.moveTo(last.x,last.y);dctx.lineTo(p.x,p.y);dctx.stroke();last=p});
drawing.addEventListener("pointerup",()=>{painting=false;last=null});drawing.addEventListener("pointercancel",()=>{painting=false;last=null});
resetSegments();drawWheel();update();authInit();
})();