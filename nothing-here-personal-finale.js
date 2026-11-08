/* User-owned browser-local finale audio.
 * Selection stays on this device in IndexedDB, never submitted to a server
 * or copied into the public GitHub Pages build. Clearing removes the Blob.
 */
(()=>{
 'use strict';
 const audio=window.NothingHereAudio;
 if(!audio||typeof audio.setPersonalFinaleFile!=='function')return;
 const database='crilo_nothing_here_personal_audio_v1';
 const storeName='tracks',recordKey='finale';
 const maxBytes=25*1024*1024;
 let changedByVisitor=false;
 const $=id=>document.getElementById(id);

 function storedRecord(mode,action){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB)return reject(Error('Local browser storage unavailable'));
   const open=indexedDB.open(database,1);
   open.onupgradeneeded=()=>{
    if(!open.result.objectStoreNames.contains(storeName))
     open.result.createObjectStore(storeName);
   };
   open.onerror=()=>reject(open.error||Error('Unable to access local audio'));
   open.onsuccess=()=>{
    const db=open.result;
    let result;
    try{
     const transaction=db.transaction(storeName,mode);
     const request=action(transaction.objectStore(storeName));
     request.onsuccess=()=>{result=request.result};
     request.onerror=()=>reject(request.error||Error('Audio storage failure'));
     transaction.oncomplete=()=>{db.close();resolve(result)};
     transaction.onerror=()=>{db.close();reject(transaction.error)};
     transaction.onabort=()=>{db.close();reject(transaction.error)};
    }catch(error){db.close();reject(error)}
   };
  });
 }
 function showTrack(name,warning=''){
  const button=$('ncPersonalFinaleChoose'),state=$('ncPersonalFinaleState');
  const clear=$('ncPersonalFinaleClear');
  if(!button||!state||!clear)return;
  state.textContent=warning|| (name?'Local':'Default');
  button.title=name
   ?'Using '+name+' (only in this browser; click to replace)'
   :'Choose an MP3 for private finale playback, saved only in this browser';
  button.setAttribute('aria-label',button.title);
  clear.hidden=!name;
  clear.setAttribute('aria-label','Remove personal finale track');
 }
 function useTrack(file,name){
  if(!file||file.size>maxBytes||!audio.setPersonalFinaleFile(file,name)){
   showTrack(audio.getState().personalFinaleName||'', 'Unavailable');
   return false;
  }
  showTrack(name);
  return true;
 }
 function bind(){
  const choose=$('ncPersonalFinaleChoose');
  const field=$('ncPersonalFinaleInput');
  const clear=$('ncPersonalFinaleClear');
  if(!choose||!field||!clear)return;
  choose.addEventListener('click',()=>field.click());
  field.addEventListener('change',async()=>{
   const file=field.files?.[0];
   field.value='';
   if(!file)return;
   changedByVisitor=true;
   const allowed=file.type.startsWith('audio/')||
    /\.(mp3|m4a|ogg|wav|aac|opus|webm)$/i.test(file.name);
   if(!allowed||file.size<=0||file.size>maxBytes){
    showTrack(audio.getState().personalFinaleName||'', 'Use audio under 25 MB');
    return;
   }
   if(!useTrack(file,file.name))return;
   try{
    await storedRecord('readwrite',store=>
     store.put({blob:file,name:file.name},recordKey));
    if(audio.getState().personalFinaleName===file.name)showTrack(file.name);
   }catch(error){
    // A private-mode browser may block IndexedDB: the selected track
    // still works until the tab is closed or refreshed.
    console.warn('Personal track is for this tab only:',error?.message||error);
    showTrack(file.name,'This tab');
   }
  });
  clear.addEventListener('click',async()=>{
   changedByVisitor=true;
   audio.setPersonalFinaleFile(null);
   showTrack('');
   try{await storedRecord('readwrite',store=>store.delete(recordKey))}
   catch(error){console.warn('Could not clear local track storage:',error?.message||error)}
  });
  // Restoring the user's file must never override a more recent selection.
  storedRecord('readonly',store=>store.get(recordKey)).then(saved=>{
   if(changedByVisitor||!saved?.blob)return;
   useTrack(saved.blob,saved.name||'Saved personal track');
  }).catch(()=>{});
  showTrack('');
 }
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',bind,{once:true});
 else bind();
})();
