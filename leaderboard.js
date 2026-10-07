(() => {
const $=id=>document.getElementById(id);let tab="today";
const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today=localDate(new Date());const weekDate=(()=>{const d=new Date();d.setDate(d.getDate()-6);return localDate(d)})();
async function load(){
 $("leaderList").innerHTML='<div class="empty-state">Loading scores…</div>';
 let q=criloDB.from("daily_runs").select("user_id,run_date,score,spins,upgrades,doubles,ducks,drawing,created_at").order("score",{ascending:false}).limit(tab==="all"?100:60);
 if(tab==="today")q=q.eq("run_date",today);if(tab==="week")q=q.gte("run_date",weekDate);if(tab==="records")q=criloDB.from("daily_runs").select("user_id,run_date,score,spins,upgrades,doubles,ducks,drawing,created_at").order("upgrades",{ascending:false}).limit(60);
 const {data:runs,error}=await q;if(error){$("leaderList").innerHTML='<div class="empty-state">Could not load leaderboard.</div>';console.error(error);return}
 const ids=[...new Set((runs||[]).map(r=>r.user_id))];let profiles=[];
 if(ids.length){const res=await criloDB.from("profiles").select("id,username,name_color").in("id",ids);profiles=res.data||[]}
 const pm=new Map(profiles.map(p=>[p.id,p]));render(runs||[],pm);
}
function render(runs,pm){
 if(!runs.length){$("bestScore").textContent="—";$("bestUser").textContent="No completed runs yet";$("bestStats").textContent="Be the first.";$("bestDrawing").classList.add("hidden");$("leaderList").innerHTML='<div class="empty-state">No scores here yet.</div>';return}
 const best=runs[0],bp=pm.get(best.user_id);$("bestScore").textContent=Number(best.score).toLocaleString();$("bestUser").textContent=bp?.username||"Crilo player";$("bestUser").style.color=bp?.name_color||"#17191e";$("bestStats").textContent=`${best.spins} spins • ${best.upgrades} upgrades • ${best.doubles} doubles • ${best.ducks} ducks`;
 if(best.drawing){$("bestDrawing").src=best.drawing;$("bestDrawing").classList.remove("hidden")}else $("bestDrawing").classList.add("hidden");
 const medals=["🥇","🥈","🥉"];
 $("leaderList").innerHTML=runs.map((r,i)=>{const p=pm.get(r.user_id),metric=tab==="records"?`${r.upgrades} upgrades`:`${Number(r.score).toLocaleString()}`;return `<div class="leader-row"><div class="rank">${medals[i]||i+1}</div><div><span class="leader-name" style="color:${p?.name_color||"#17191e"}">${escapeHTML(p?.username||"Crilo player")}</span><span class="leader-mini">${r.spins} spins · ${r.upgrades} upgrades · ${r.doubles} doubles · ${r.ducks} ducks</span></div><div class="leader-score">${metric}</div></div>`}).join("");
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
document.querySelectorAll(".leader-tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".leader-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");tab=b.dataset.tab;load()}));load();
})();