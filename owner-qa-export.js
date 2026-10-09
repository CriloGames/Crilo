(()=>{
 const button=document.getElementById('ownerQaExport');
 const status=document.getElementById('ownerQaExportStatus');
 if(!button||!status)return;
 button.addEventListener('click',async()=>{
  if(!window.Crilo?.user||!window.Crilo?.profile?.is_owner){
   status.textContent='Owner sign-in required.';return;
  }
  button.disabled=true;status.textContent='Preparing private owner QA export…';
  try{
   const {data,error}=await criloDB.rpc('crilo_owner_qa_export_drawings');
   if(error)throw error;
   const rows=(data||[]).filter(row=>typeof row.drawing==='string'&&row.drawing.startsWith('data:image/'));
   if(!rows.length){status.textContent='No saved Test Run drawings found.';return;}
   const output={
    format:'crilo-owner-private-qa-v1',
    notice:'PRIVATE: Contains saved owner Test Run images. Do not upload or commit to the public GitHub repository.',
    label_instructions:'Set expected to harmless or prohibited for each image before validation; unknown means unlabelled.',
    exported_at:new Date().toISOString(),
    samples:rows.map(row=>({
     id:row.run_id,submitted_at:row.submitted_at,score:row.score,
     ai_status:row.ai_status,expected:'unknown',image:row.drawing
    }))
   };
   const blob=new Blob([JSON.stringify(output)],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;a.download='crilo-owner-qa-private.json';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
   status.textContent='Downloaded '+rows.length+' privately saved Test Run drawings. The file stays on your computer unless you share it.';
  }catch(err){status.textContent='Export failed: '+String(err.message||err)}
  finally{button.disabled=false}
 });
})();