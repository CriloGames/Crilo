/* Offline/public QuickDraw only. NSFWJS is a whole-image classifier, not a sketch detector. */
const fs=require('node:fs'),path=require('node:path');
const tf=require('@tensorflow/tfjs');const nsfw=require('nsfwjs');
const {loadImage,createCanvas}=require('canvas');
(async()=>{
 await tf.setBackend('cpu');await tf.ready();
 const model=await nsfw.load();
 const folder='research/outputs/public-comparison';
 const records=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 const pred=[];
 for(const item of records){
  const img=await loadImage(path.join(folder,item.file));
  const canvas=createCanvas(224,224);const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);ctx.drawImage(img,0,0,224,224);
  const result=await model.classify(canvas,5);
  const probability=result.filter(x=>['Porn','Hentai'].includes(x.className)).reduce((a,x)=>a+x.probability,0);
  pred.push({...item,score:probability});
 }
 for(const cut of [.2,.5]){
  const tp=pred.filter(x=>x.label==='positive'&&x.score>=cut).length;
  const fn=pred.filter(x=>x.label==='positive'&&x.score<cut).length;
  const fp=pred.filter(x=>x.label==='negative'&&x.score>=cut).length;
  const tn=pred.filter(x=>x.label==='negative'&&x.score<cut).length;
  console.log(`NSFWJS threshold=${cut.toFixed(2)} TN=${tn} FP=${fp} FN=${fn} TP=${tp} recall=${(tp/Math.max(tp+fn,1)).toFixed(3)} FPR=${(fp/Math.max(fp+tn,1)).toFixed(3)}`);
 }
 model.dispose();
})().catch(e=>{console.error(e);process.exit(1)});
