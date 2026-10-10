/* Owner-only example labeling. This is local fingerprint matching, not neural training. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let selected=null,saving=false,preview=null;
const owner=()=>!!(window.Crilo?.user&&window.Crilo?.profile?.is_owner);
const status=s=>{if($('reviewExampleStatus'))$('reviewExampleStatus').textContent=s};
const identity=d=>(d.is_test?'test:':'official:')+d.run_id;
async function sourceFingerprint(d){
 if(!window.CriloExampleFeatures)throw Error('Example matching module could not load');
 const im=new Image();im.src=d.drawing;
 if(im.decode)await im.decode();
 else await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject});
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Canvas is unavailable');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,160,160);
 ctx.drawImage(im,0,0,160,160);
 const data=ctx.getImageData(0,0,160,160);
 const fp=window.CriloExampleFeatures.fingerprint(data.data,160,160);
 if(!fp)throw Error('This drawing is blank or too uniform to use as an example');
 return fp;
}
async function refreshLabel(d){
 if(!owner()||!d)return;
 try{
  const result=await criloDB.rpc('crilo_owner_example_list');
  if(result.error)throw result.error;
  if(!selected||identity(selected)!==identity(d))return;
  const rows=result.data||[];
  const label=rows.find(x=>identity(x)===identity(d));
  preview=label||null;
  status(label?
   'Saved example: '+(label.verdict==='safe'?'Safe':label.category)+'. You can change or remove this label.':
   rows.length+' examples saved. Labeling this drawing improves similar-drawing suggestions.');
  $('reviewExampleRemove').disabled=!label;
 }catch(err){status('Could not load examples: '+err.message)}
}
async function save(verdict){
 if(!owner()||!selected||saving)return;
 const d=selected;
 saving=true;
 for(const name of ['reviewExampleBad','reviewExampleSafe','reviewExampleRemove'])$(name).disabled=true;
 status('Adding the drawing to the private example gallery…');
 try{
  const category=verdict==='safe'?'safe':$('reviewExampleCategory').value;
  const fingerprint=await sourceFingerprint(d);
  const {data,error}=await criloDB.rpc('crilo_owner_example_save',{
   p_run_id:String(d.run_id),p_is_test:!!d.is_test,
   p_verdict:verdict,p_category:category,p_fingerprint:fingerprint
  });
  if(error)throw error;
  if(data!==true)throw Error('Drawing was not found');
  window.criloOwnerExamplesChanged?.();
  await refreshLabel(d);
  status('Example saved ('+(verdict==='safe'?'safe':category)+
   '). Similar future artwork can be suggested for review. Current scan results change after rescanning.');
 }catch(err){status('Could not save example: '+err.message)}
 finally{
  saving=false;
  for(const name of ['reviewExampleBad','reviewExampleSafe'])$(name).disabled=false;
  $('reviewExampleRemove').disabled=!preview;
 }
}
async function remove(){
 if(!owner()||!selected||saving)return;
 const d=selected;
 saving=true;
 status('Removing example…');
 try{
  const {error}=await criloDB.rpc('crilo_owner_example_delete',
   {p_run_id:String(d.run_id),p_is_test:!!d.is_test});
  if(error)throw error;
  preview=null;window.criloOwnerExamplesChanged?.();
  await refreshLabel(d);
  status('Removed from your saved examples. Existing scan suggestions will update after rescanning.');
 }catch(err){status('Could not remove example: '+err.message)}
 finally{saving=false}
}
window.criloFeedbackShow=d=>{
 selected=owner()?d:null;preview=null;
 if(!$('reviewExampleBad'))return;
 for(const name of ['reviewExampleBad','reviewExampleSafe'])$(name).disabled=!selected;
 $('reviewExampleRemove').disabled=true;
 status('Loading your saved examples…');
 if(selected)refreshLabel(selected);
};
$('reviewExampleBad').addEventListener('click',()=>save('inappropriate'));
$('reviewExampleSafe').addEventListener('click',()=>save('safe'));
$('reviewExampleRemove').addEventListener('click',remove);
})();
