'use strict';
// Actual Chromium tests the exact drawing encoder extracted from production
// game.js, without creating any player records.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('game.js','utf8');
const start=src.indexOf('function optimizedDailyDrawing('),end=src.indexOf('\nasync function endRun()',start);
assert.ok(start>=0&&end>start,'Production encoder missing');
const encoderSource=src.slice(start,end);
(async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await b.newPage();
  const results=await page.evaluate(async js=>{
   const codec=Function(js+';return optimizedDailyDrawing')();
   const c=document.createElement('canvas');c.width=200;c.height=200;
   const x=c.getContext('2d');
   const blank=codec(c,true);
   if(blank!==null)throw Error('Blank images must not consume database bytes');
   // Deliberately realistic bright handwritten line art on transparency.
   const colors=['#17191e','#fa7199','#92bde9','#45b18f','#edb647'];
   for(let i=0;i<110;i++){
    x.strokeStyle=colors[i%colors.length];x.lineWidth=2+(i%5);
    x.lineJoin='round';x.beginPath();
    x.moveTo((i*37)%200,(i*53)%200);
    x.bezierCurveTo((i*17)%200,(i*23)%200,(i*11)%200,(i*49)%200,(i*71)%200,(i*29)%200);
    x.stroke();
   }
   const png=c.toDataURL('image/png'),webp=c.toDataURL('image/webp',0.96),selected=codec(c,false);
   if(!selected.startsWith('data:image/'))throw Error('Encoder output not an image data URL');
   if(selected.length>png.length)throw Error('Optimization increased image payload');
   const img=new Image();img.src=selected;await img.decode();
   if(img.width!==200||img.height!==200)throw Error('Encoded image dimensions changed');
   if(selected.startsWith('data:image/webp')&&selected.length>png.length*.8)throw Error('WebP chosen without material savings');
   // Browser fallback retains full PNG with no forced quality loss.
   const fallback=codec({toDataURL:type=>png},false);
   if(fallback!==png)throw Error('Unsupported WebP must retain PNG');
   return {pngChars:png.length,webpChars:webp.length,selectedChars:selected.length,format:selected.slice(5,15)};
  },encoderSource);
  console.log('PASS: blank canvas saves no image, complex drawing decodes at original dimensions, PNG fallback remains valid.');
  console.log('SAMPLE_DRAWING_COMPRESSION '+JSON.stringify(results));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
