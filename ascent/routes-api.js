(() => {
'use strict';
const base='https://mqozqigwkobnhijvvboy.supabase.co/rest/v1/rpc/';
const key='sb_publishable__AqZ1h05YLDbnKZf8FC-Tw_WahZdQot';
window.ascentRpc=async function(name,args){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch(base+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
  if(!response.ok){const e=new Error('Unable to load climb');e.status=response.status;throw e;}
  return await response.json();
 }finally{clearTimeout(timeout)}
};
})();