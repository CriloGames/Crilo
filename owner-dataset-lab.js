(()=>{
'use strict';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
let strokes=[],active=null,examples=[];
const paint=()=>{
 ctx.fillStyle='white';ctx.fillRect(0,0,200,200);
 ctx.strokeStyle='#181818';ctx.fillStyle='#181818';ctx.lineCap='round';ctx.lineJoin='round';
 for(const s of strokes.concat(active?[active]:[])){
  ctx.lineWidth=s.width;ctx.beginPath();
  s.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  if(s.points.length===1){const p=s.points[0];ctx.beginPath();ctx.arc(p[0],p[1],s.width/2,0,2*Math.PI);ctx.fill();}
  else ctx.stroke();
 }
};
const coords=e=>{const r=canvas.getBoundingClientRect();return [
 Math.max(0,Math.min(200,(e.clientX-r.left)*200/r.width)),
 Math.max(0,Math.min(200,(e.clientY-r.top)*200/r.height))];};
canvas.addEventListener('pointerdown',e=>{
 if(active)return;
 canvas.setPointerCapture(e.pointerId);active={width:Number($('pen').value),points:[coords(e)]};
 paint();});
canvas.addEventListener('pointermove',e=>{if(!active)return;active.points.push(coords(e));paint()});
const finish=e=>{if(!active)return;active.points.push(coords(e));strokes.push(active);active=null;paint()};
canvas.addEventListener('pointerup',finish);
canvas.addEventListener('pointercancel',()=>{active=null;paint()});
$('undo').addEventListener('click',()=>{strokes.pop();paint()});
$('clear').addEventListener('click',()=>{strokes=[];paint()});
const redraw=()=>{
 $('status').textContent=examples.length+' labeled drawings saved locally in this tab. '+examples.filter(e=>e.expected==='harmless').length+' harmless, '+examples.filter(e=>e.expected==='prohibited').length+' prohibited.';
 const tiles=$('tiles');tiles.replaceChildren();
 examples.slice(-20).forEach(e=>{
  const img=document.createElement('img');img.src=e.image;img.alt=e.expected+' example';img.title=e.expected;tiles.appendChild(img);
 });
 $('export').disabled=!examples.length;$('remove').disabled=!examples.length;
};
$('save').addEventListener('click',()=>{
 const label=$('label').value;
 if(!['harmless','prohibited'].includes(label)){alert('Select a human-verified label first.');return}
 if(!strokes.length){alert('Draw something first. Blank drawings should be collected separately as harmless controls.');return}
 const image=canvas.toDataURL('image/png');
 if(examples.some(x=>x.image===image)){alert('This exact drawing is already saved.');return}
 examples.push({expected:label,image,source:'human-crilo-style',collected_at:new Date().toISOString()});
 strokes=[];$('label').value='';paint();redraw();
});
$('remove').addEventListener('click',()=>{examples.pop();redraw()});
$('import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>20000000)throw new Error('File exceeds the 20 MB import limit.');
  const parsed=JSON.parse(await file.text());
  if(parsed.format!=='crilo-labeled-private-v1'||!Array.isArray(parsed.samples))
   throw new Error('This is not a labeled dataset export from the drawing lab.');
  if(parsed.samples.length>2000)throw new Error('Too many samples in this file.');
  let added=0;
  const known=new Set(examples.map(x=>x.image));
  for(const x of parsed.samples){
   if(!x||!['harmless','prohibited'].includes(x.expected)||typeof x.image!=='string'
     ||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(x.image)
     ||x.image.length>3000000)throw new Error('File contains an invalid drawing or label.');
   if(!known.has(x.image)){
    examples.push({expected:x.expected,image:x.image,source:'human-crilo-style',
     collected_at:typeof x.collected_at==='string'?x.collected_at:null});
    known.add(x.image);added++;
   }
  }
  redraw();$('status').textContent+=' Restored '+added+' unique drawings from the imported file.';
 }catch(err){alert('Import unsuccessful: '+(err.message||err))}
 finally{e.target.value=''}
});

$('export').addEventListener('click',()=>{
 if(!examples.length)return;
 const payload={format:'crilo-labeled-private-v1',notice:'PRIVATE labeled images. Do not publish.',samples:examples};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='crilo-labeled-private-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
});
paint();redraw();
})();