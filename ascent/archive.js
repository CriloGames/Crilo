(() => {
'use strict';
const status=document.getElementById('archiveStatus');
const older=document.getElementById('older'), retry=document.getElementById('retryArchive'),list=document.getElementById('days');
const fmt=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
let before=null,loading=false;
async function load(){
 if(loading)return;
 loading=true;older.disabled=true;retry.hidden=true;
 try{
  const page=await window.ascentRpc('ascent_archive',{p_before:before});
  for(const day of page.days){
   const row=document.createElement('li'),a=document.createElement('a'),label=document.createElement('span'),play=document.createElement('span');
   a.href='./?archive='+day;label.textContent=fmt.format(new Date(day+'T12:00:00Z'));play.textContent='Climb ↗';a.append(label,play);row.append(a);list.append(row);
  }
  status.textContent=list.children.length?'Replay the original five pitches. Your replay score stays separate from the official results.':'Today is the first daily climb. It joins the archive at 22:00 UTC. Until then, you can generate a practice climb.';
  before=page.older;older.hidden=!before;
 }catch{status.textContent='Couldn’t load the archive.';retry.hidden=false}
 finally{loading=false;older.disabled=false}
}
older.onclick=retry.onclick=load;load();
})();