/* Crilo local example matching: simple, owner-approved visual neighbors.
 No paid AI. Stores only 64 hex chars of coarse monochrome shape features,
 never drawing pixels, URLs, model weights, or training images. */
(function(root){
'use strict';
const SIZE=16;
const VALID=/^[0-9a-f]{64}$/;
function fingerprint(rgba,w,h){
 if(!rgba||w<32||h<32||rgba.length<w*h*4)return null;
 let minx=w,miny=h,maxx=-1,maxy=-1,ink=0;
 const dark=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,k=i*4,alpha=rgba[k+3]/255;
  const brightness=(0.21*rgba[k]+0.72*rgba[k+1]+0.07*rgba[k+2])*alpha+255*(1-alpha);
  if(brightness<185){
   dark[i]=1;ink++;minx=Math.min(minx,x);maxx=Math.max(maxx,x);
   miny=Math.min(miny,y);maxy=Math.max(maxy,y);
  }
 }
 // Don't learn blank squares or almost solid scribbles.
 if(ink<w*h*0.0025||ink>w*h*0.38||maxx-minx<5||maxy-miny<5)return null;
 const breadth=Math.max(maxx-minx+1,maxy-miny+1);
 const pad=Math.max(1,Math.round(breadth*0.12));
 const cx=(minx+maxx)/2,cy=(miny+maxy)/2,side=breadth+pad*2;
 let hex='',word=0,wordBits=0;
 for(let gy=0;gy<SIZE;gy++)for(let gx=0;gx<SIZE;gx++){
  let seen=0,sampled=0;
  for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++){
   const x=Math.floor(cx-side/2+(gx+(sx+.5)/3)*side/SIZE);
   const y=Math.floor(cy-side/2+(gy+(sy+.5)/3)*side/SIZE);
   if(x>=0&&x<w&&y>=0&&y<h)seen+=dark[y*w+x];
   sampled++;
  }
  const pixel=seen>=2?1:0;
  word=(word<<1)|pixel;wordBits++;
  if(wordBits===4){hex+=word.toString(16);word=0;wordBits=0}
 }
 return hex;
}
function distance(a,b){
 if(!VALID.test(a||'')||!VALID.test(b||''))return 256;
 let n=0;
 for(let i=0;i<64;i++){
  let bits=parseInt(a[i],16)^parseInt(b[i],16);
  while(bits){bits&=bits-1;n++}
 }
 return n;
}
function classify(hash,examples){
 if(!VALID.test(hash||'')||!Array.isArray(examples))return null;
 let bad=null,safe=256;
 for(const e of examples.slice(0,300)){
  if(!VALID.test(e?.fingerprint||''))continue;
  const d=distance(hash,e.fingerprint);
  if(e.verdict==='safe')safe=Math.min(safe,d);
  else if(e.verdict==='inappropriate' &&
   (!bad||d<bad.distance))bad={category:e.category,distance:d};
 }
 // Require close visual resemblance, not a loosely related category.
 // A similarly close or closer safe example blocks an inappropriate match.
 if(!bad||bad.distance>22||safe<=bad.distance+7)return null;
 return {category:bad.category,similarity:Math.round(100*(1-bad.distance/256))};
}
root.CriloExampleFeatures={fingerprint,distance,classify};
})(typeof self!=='undefined'?self:globalThis);
