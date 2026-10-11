(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const cols=['daily_visitors','guest_starts','guest_completions','verified_sessions','official_completions','returning_players','new_accounts','result_shares'];
 const names=['Daily visitors*','Guest starts*','Guest finishes*','Official starts','Official finishes','Returning players','New accounts','Shares*'];
 async function load(){
  $('analyticsReport').classList.add('hidden');
  if(!window.Crilo?.user?.id||!window.Crilo?.profile?.is_owner){
   $('analyticsStatus').textContent='This page is only available to the Crilo owner account.';return;
  }
  $('analyticsStatus').textContent='Loading verified activity…';
  const days=Number($('analyticsDays').value)||30;
  try{
   const {data,error}=await criloDB.rpc('crilo_owner_growth_report',{p_days:days});
   if(error)throw error;
   const rows=Array.isArray(data)?data:[];
   const sums=cols.map(k=>rows.reduce((sum,row)=>sum+(Number(row[k])||0),0));
   $('analyticsSummary').replaceChildren(...names.map((name,i)=>{
    const card=document.createElement('div');card.className='analytics-card';
    const label=document.createElement('span');label.textContent=name;
    const value=document.createElement('strong');value.textContent=sums[i].toLocaleString();
    card.append(label,value);return card;
   }));
   const body=$('analyticsRows');body.replaceChildren();
   for(const r of rows){
    const tr=document.createElement('tr');
    for(const v of [r.day,...cols.map(k=>Number(r[k])||0)]){
     const td=document.createElement('td');td.textContent=typeof v==='number'?v.toLocaleString():v;tr.append(td);
    }
    body.append(tr);
   }
   $('analyticsStatus').textContent=rows.length+' days loaded. Analytics began when this feature was installed; previous visitor counts are not available.';
   $('analyticsReport').classList.remove('hidden');
  }catch(e){$('analyticsStatus').textContent='Could not load owner metrics: '+(e?.message||'Permission denied');}
 }
 $('analyticsReload').addEventListener('click',load);
 $('analyticsDays').addEventListener('change',load);
 window.addEventListener('crilo-auth-ready',load);
 if(Crilo.user)load();
})();
