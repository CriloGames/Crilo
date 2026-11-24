(() => {
'use strict';
const base='https://mqozqigwkobnhijvvboy.supabase.co/rest/v1/rpc/';
const key='sb_publishable__AqZ1h05YLDbnKZf8FC-Tw_WahZdQot';
window.ascentRpc=async function(name,args){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(base+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
  if(!response.ok)throw new Error('Unable to load climb');
  return await response.json();
 }finally{clearTimeout(timeout)}
};
})();