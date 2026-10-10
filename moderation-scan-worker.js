/* CRILO | free drawing analyzer, dedicated Web Worker.
   Work never runs on the UI thread. Advisory only; no actions on player accounts.
   QR: jsQR, text: Tesseract worker, pictures: quantized SigLIP. */
'use strict';
const LABELS=[
 'A hand drawn Nazi swastika or extremist hate symbol',
 'An extremist hate group insignia',
 'An explicit hand drawing of a penis or testicles',
 'An explicit hand drawing of a vulva or vagina',
 'A sexually explicit pornographic image or nude adult',
 'A sexually explicit cartoon illustration',
 'Graphic blood, gore, or severe injury',
 'A black and white QR code with a grid of square patterns',
 'A harmless smiley face doodle','A harmless duck cartoon doodle',
 'A harmless abstract scribble','A harmless flower or landscape drawing',
 'A harmless cartoon character drawing','A handwritten sentence on white paper',
 'A blank white square'
];
let ocr=null,qr=null,vision=null,qrFailed=false,ocrFailed=false,visionFailed=false;
function progress(id,step,detail){self.postMessage({type:'progress',id,step,detail});}
function createCanvas(bitmap,maxSide){
 const factor=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
 const canvas=new OffscreenCanvas(
  Math.max(1,Math.round(bitmap.width*factor)),
  Math.max(1,Math.round(bitmap.height*factor))
 );
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 return canvas;
}
function scaleCanvas(bitmap,side){
 const f=side/Math.max(bitmap.width,bitmap.height);
 const canvas=new OffscreenCanvas(Math.max(1,Math.round(bitmap.width*f)),Math.max(1,Math.round(bitmap.height*f)));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 return canvas;
}
async function getBitmap(src){
 if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src) || src.length>3e6)
  throw Error('Invalid or oversized drawing');
 const data=await fetch(src);
 if(!data.ok)throw Error('Could not decode data URL');
 return createImageBitmap(await data.blob());
}
async function readQR(bitmap,id){
 if(qrFailed)throw Error('QR library unavailable');
 progress(id,'qr','Checking QR codes');
 try{
  if(!qr){importScripts('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js');qr=self.jsQR;}
  if(typeof qr!=='function')throw Error('QR decoder did not initialize');
  // A second modestly upscaled pass helps with pixel-studio QR artwork.
  for(const side of [Math.max(300,Math.min(600,bitmap.width)),900]){
   const c=scaleCanvas(bitmap,side);
   const data=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);
   if(qr(data.data,c.width,c.height,{inversionAttempts:'attemptBoth'}))return true;
  }
  return false;
 }catch(e){qrFailed=true;throw Error('QR unavailable: '+String(e.message||e).slice(0,100))}
}
async function readOCR(bitmap,id){
 if(ocrFailed)throw Error('Text recognition unavailable');
 progress(id,'ocr','Reading text');
 try{
  if(!ocr){
   importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
   ocr=await self.Tesseract.createWorker('eng');
  }
  const canvas=scaleCanvas(bitmap,620); // was 900 px + second CPU-heavy pass on UI thread
  const blob=await canvas.convertToBlob({type:'image/png'});
  const answer=await ocr.recognize(blob);
  return String(answer?.data?.text||'').slice(0,4096);
 }catch(e){ocrFailed=true;throw Error('OCR unavailable: '+String(e.message||e).slice(0,100))}
}
async function readVision(bitmap,id){
 if(visionFailed)throw Error('Image model unavailable');
 progress(id,'visual','Checking image symbols');
 try{
  if(!vision){
   progress(id,'visual','Loading image model (once)');
   // Dynamic import is supported in modern dedicated workers; no UI-thread imports.
   const library=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
   vision=await library.pipeline('zero-shot-image-classification','Xenova/siglip-base-patch16-224',{device:'wasm',dtype:'q8'});
  }
  const canvas=createCanvas(bitmap,288);
  const blob=await canvas.convertToBlob({type:'image/png'});
  const src=new FileReaderSync().readAsDataURL(blob);
  return (await vision(src,LABELS)).map(x=>({label:x.label,score:Number(x.score)}));
 }catch(e){visionFailed=true;throw Error('Visual scan unavailable: '+String(e.message||e).slice(0,100))}
}
let busy=false;
self.onmessage=async event=>{
 const msg=event.data;
 if(msg?.type!=='scan'||busy)return;
 busy=true;
 const id=msg.id;
 let bitmap=null;
 const out={type:'result',id,ocrText:'',qrFound:false,shapeSuspected:false,shapeDetail:'',visualResults:[],errors:[],stages:{}};
 try{
  progress(id,'decode','Preparing image');
  bitmap=await getBitmap(msg.drawing);
  try{out.qrFound=await readQR(bitmap,id);out.stages.qr='done';}
  catch(e){out.errors.push(String(e.message||e));out.stages.qr='unavailable';}
  try{out.ocrText=await readOCR(bitmap,id);out.stages.ocr='done';}
  catch(e){out.errors.push(String(e.message||e));out.stages.ocr='unavailable';}
  if(msg.checkVisual!==false){
   // Small, deterministic outline-shape advisory supplements weak generic
   // image classifiers. This still runs when SigLIP cannot load.
   try{
    importScripts('moderation-shape-review.js?v=1');
    const canvas=createCanvas(bitmap,192);
    const pixels=canvas.getContext('2d',{willReadFrequently:true})
      .getImageData(0,0,canvas.width,canvas.height);
    const hint=self.CriloShapeReview.analyze(pixels.data,canvas.width,canvas.height);
    out.shapeSuspected=hint.suspected===true;
    out.shapeDetail=hint.detail||'';
    out.stages.shape='done';
   }catch(e){
    out.stages.shape='unavailable';
    out.errors.push('Outline check unavailable: '+String(e.message||e).slice(0,95));
   }
   try{out.visualResults=await readVision(bitmap,id);out.stages.visual='done';}
   catch(e){out.errors.push(String(e.message||e));out.stages.visual='unavailable';}
  }else{out.stages.visual='skipped';out.stages.shape='skipped';}
 }catch(e){
  out.errors.push('Cannot read drawing: '+String(e.message||e).slice(0,130));
 }finally{
  if(bitmap)bitmap.close();
  self.postMessage(out);
  busy=false;
 }
};