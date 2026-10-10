/* Crilo free genital-doodle review hints v1.
   Browser Web Worker only. These are unconfirmed SHAPE indicators and must
   never auto-delete a run or ban an account. No external services. */
(function(root){
'use strict';
const HYPOTHESIS_VERSION=3;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inkAt=(d,i)=>{const a=d[i*4+3]/255;return Math.min(
 d[i*4]*a+255*(1-a),d[i*4+1]*a+255*(1-a),d[i*4+2]*a+255*(1-a))<205};
function analyzePixels(rgba,w,h){
 if(!rgba||w<48||h<48||w*h>100000)return {suspected:false,type:null,evidence:[]};
 const dark=new Uint8Array(w*h);
 let n=0,minx=w,miny=h,maxx=0,maxy=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(inkAt(rgba,i)){dark[i]=1;n++;
   minx=Math.min(minx,x);miny=Math.min(miny,y);
   maxx=Math.max(maxx,x);maxy=Math.max(maxy,y)}
 }
 const fraction=n/(w*h);
 if(fraction<0.002||fraction>0.32)return {suspected:false,type:null,evidence:[]};
 const shapes=root.CriloShapeReview?.regions?.(rgba,w,h)||[];
 const regionPairs=[];
 // A common penis doodle consists of two rounded testicles adjacent to the
 // tip of a curved/tapered shaft. The previous rule insisted that ALL THREE
 // outlines were straight, separately enclosed, and centered on one axis.
 for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
  const a=shapes[i],b=shapes[j];
  if(a.ratio>1.9||b.ratio>1.9)continue;
  const smaller=Math.min(a.area,b.area),bigger=Math.max(a.area,b.area);
  if(smaller/bigger<0.25)continue;
  const diam=(a.diameter+b.diameter)/2,sep=dist(a.center,b.center);
  if(sep<0.45*diam||sep>2.8*diam)continue;
  regionPairs.push({a,b,mid:{x:(a.center.x+b.center.x)/2,y:(a.center.y+b.center.y)/2},diam});
 }
 function elongatedBodyNear(pair){
  for(const shaft of shapes){
   if(shaft===pair.a||shaft===pair.b)continue;
   if(shaft.ratio<1.35||shaft.ratio>10)continue;
   const d=pair.diam,mid=pair.mid,center=shaft.center;
   const centerDistance=dist(mid,center);
   if(centerDistance<d*0.47||centerDistance>d*3.6)continue;
   if(shaft.area<Math.min(pair.a.area,pair.b.area)*0.50)continue;
   if(shaft.area>Math.max(pair.a.area,pair.b.area)*6)continue;
   // Curved shafts have unreliable PCA tips; allow centroid to be offset.
   // Avoid smiley faces: the body and pair must each lie on opposite sides
   // of a plausible head/body division with close attachment.
   const t=Math.min(dist(shaft.tipA,mid),dist(shaft.tipB,mid));
   if(t>d*2.0&&centerDistance>d*2.25)continue;
   return true;
  }
  return false;
 }
 for(const pair of regionPairs){
  if(elongatedBodyNear(pair))return {suspected:true,type:'penis',
   evidence:['Two rounded features adjacent to an elongated outline']};
 }
 // Even if a curved shaft and one lobe touch, two rounded head/testicle
 // regions can remain distinct. Require a narrow outward extension with
 // substantial drawn ink beyond the two bulbs.
 for(const pair of regionPairs){
  const {mid,diam:d}=pair;
  const ax=pair.b.center.x-pair.a.center.x,ay=pair.b.center.y-pair.a.center.y;
  const magnitude=Math.hypot(ax,ay)||1,px=-ay/magnitude,py=ax/magnitude;
  const countOnSide=sign=>{
   let far=0,near=0,extent=0;
   for(let y=miny;y<=maxy;y+=2)for(let x=minx;x<=maxx;x+=2){
    if(!dark[y*w+x])continue;
    const t=((x-mid.x)*px+(y-mid.y)*py)*sign;
    const sideways=Math.abs((x-mid.x)*ax/magnitude+(y-mid.y)*ay/magnitude);
    if(t>d*0.80&&sideways<d*0.95){near++;extent=Math.max(extent,t);
     if(t>d*1.45)far++}
   }
   return {near,far,extent};
  };
  if([1,-1].some(sign=>{
   const s=countOnSide(sign);
   // This is only a shape hint. Avoid using mere paired eyes and a tiny mouth.
   return s.extent>d*1.8&&s.far>Math.max(7,n*0.015)&&s.near>s.far*1.1;
  }))return {suspected:true,type:'penis',evidence:[
   'Two rounded outlines with an extended narrow curved stroke']};
 }
 // Nested elongated regions / aligned labial contours suggest a vulva doodle.
 // Two concentric circles (target, eyes) are explicitly ruled out by requiring
 // an elongated outer contour with a significantly narrower internal contour.
 for(let i=0;i<shapes.length;i++){
  const outer=shapes[i];
  if(outer.ratio<1.5||outer.ratio>5.8)continue;
  for(let j=0;j<shapes.length;j++){
   if(i===j)continue;
   const inner=shapes[j];
   if(inner.ratio<1.25||inner.ratio>6.0)continue;
   if(inner.area/outer.area<0.08||inner.area/outer.area>0.65)continue;
   const ow=outer.bbox[2]-outer.bbox[0]+1,oh=outer.bbox[3]-outer.bbox[1]+1;
   const ic=inner.center;
   if(ic.x<=outer.bbox[0]+ow*0.09||ic.x>=outer.bbox[2]-ow*0.09||
      ic.y<=outer.bbox[1]+oh*0.09||ic.y>=outer.bbox[3]-oh*0.09)continue;
   if(dist(outer.center,inner.center)>Math.max(ow,oh)*0.18)continue;
   const iw=inner.bbox[2]-inner.bbox[0]+1,ih=inner.bbox[3]-inner.bbox[1]+1;
   if(iw/ow>0.85||ih/oh>0.85)continue;
   return {suspected:true,type:'vulva',evidence:[
    'Nested elongated outer and inner labial outlines']};
  }
 }
 return {suspected:false,type:null,evidence:[]};
}
root.CriloGenitalReview={analyzePixels,version:HYPOTHESIS_VERSION};
})(typeof self!=='undefined'?self:globalThis);
