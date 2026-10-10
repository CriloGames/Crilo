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
 // Conservative facial-expression veto: two round eyes with a broad, separate
 // mouth line extending under BOTH eyes are much likelier to be smiley doodles
 // than two anatomical lobes. Do not mistake a hanging tongue for a shaft.
 // Only affects geometric genital hints; other detection signals stay active.
 function hasBroadSmilingMouth(){
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
   const first=shapes[i],second=shapes[j];
   if(first.ratio>1.75||second.ratio>1.75)continue;
   const left=first.center.x<second.center.x?first:second;
   const right=left===first?second:first;
   const diam=(left.diameter+right.diameter)/2;
   const sep=right.center.x-left.center.x;
   if(sep<diam*0.85||sep>diam*3.5)continue;
   if(Math.abs(left.center.y-right.center.y)>diam*0.48)continue;
   const eyeBottom=Math.max(left.bbox[3],right.bbox[3]);
   const yMax=Math.min(h-1,Math.round(eyeBottom+diam*1.75));
   const yMin=Math.round(eyeBottom+Math.max(3,diam*0.14));
   if(yMax<=yMin)continue;
   // Count independent x-columns with a mouth segment BELOW both eyes.
   const xFrom=Math.max(0,Math.round(left.center.x-diam*0.12));
   const xTo=Math.min(w-1,Math.round(right.center.x+diam*0.12));
   let total=0,marked=0,firstMarked=false,lastMarked=false;
   for(let x=xFrom;x<=xTo;x+=2){
    total++;let hit=false;
    for(let y=yMin;y<=yMax;y+=2)if(dark[y*w+x]){
     hit=true;break;
    }
    if(hit){marked++;
     if(x<xFrom+(xTo-xFrom)*0.20)firstMarked=true;
     if(x>xTo-(xTo-xFrom)*0.20)lastMarked=true;
    }
   }
   if(total>=9&&marked/total>=0.73&&firstMarked&&lastMarked)return true;
  }
  return false;
 }
 if(hasBroadSmilingMouth())return {suspected:false,type:null,
  evidence:[],benignFace:true};
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
  const length=Math.hypot(ax,ay)||1,ux=ax/length,uy=ay/length,px=-uy,py=ux;
  // Petals/flowers often consist of 3+ small round enclosures and a stem.
  const extraRounded=shapes.some(r=>r!==pair.a&&r!==pair.b&&r.ratio<1.8&&
   r.area>Math.min(pair.a.area,pair.b.area)*0.22);
  if(extraRounded)continue;
  function twoSidedShaft(sign){
   let aligned=0,usable=0,extension=0;
   for(let t=d*0.95;t<d*3.4;t+=Math.max(2,d*0.09)){
    let first=null,last=null;
    for(let off=-d*0.85;off<=d*0.85;off+=1.2){
     const x=Math.round(mid.x+sign*px*t+ux*off),
           y=Math.round(mid.y+sign*py*t+uy*off);
     if(x<0||x>=w||y<0||y>=h)continue;
     if(!dark[y*w+x])continue;
     if(first===null)first=off;last=off;
    }
    if(first===null)continue;
    usable++;
    if(last-first>d*0.28&&last-first<d*1.4){aligned++;extension=t}
   }
   return aligned>=3&&aligned/Math.max(1,usable)>0.42&&extension>d*1.7;
  }
  if(twoSidedShaft(1)||twoSidedShaft(-1))
   return {suspected:true,type:'penis',evidence:[
    'Paired rounded features adjoining two long shaft boundaries']};
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
 // Also recognize an elongated outer labial outline with a central slit.
 // Unlike nested loops this works when the inner line is left open.
 for(const r of shapes){
  if(r.ratio<1.55||r.ratio>5.8)continue;
  const width=r.bbox[2]-r.bbox[0]+1,height=r.bbox[3]-r.bbox[1]+1;
  const majorY=height>width*1.35,majorX=width>height*1.35;
  if(!majorX&&!majorY)continue;
  const major=majorY?height:width,minor=majorY?width:height;
  if(major<30||minor<12)continue;
  let withCenter=0,checked=0;
  const center=r.center;
  for(let t=-0.32*major;t<=0.32*major;t+=2){
   const x=Math.round(center.x+(majorX?t:0)),
         y=Math.round(center.y+(majorY?t:0));
   checked++;
   let seen=false;
   for(let off=-minor*0.085;off<=minor*0.085;off+=1){
    const xx=Math.round(x+(majorY?off:0)),
          yy=Math.round(y+(majorX?off:0));
    if(xx>=0&&xx<w&&yy>=0&&yy<h&&dark[yy*w+xx]){seen=true;break}
   }
   if(seen)withCenter++;
  }
  if(checked>=10&&withCenter/checked>0.27)
   return {suspected:true,type:'vulva',evidence:[
    'Elongated outer outline with a central slit-like line']};
 }
 // Orientation-independent variation: an irregular, tilted outer outline can
 // contain an inner stroke while having no second fully closed region.
 for(const r of shapes){
  if(r.ratio<2.0||r.ratio>8||r.area<w*h*0.008)continue;
  const dx=r.tipA.x-r.tipB.x,dy=r.tipA.y-r.tipB.y,
        major=Math.hypot(dx,dy);
  if(major<27)continue;
  const ux=dx/major,uy=dy/major,vx=-uy,vy=ux;
  const halfMinor=Math.sqrt(r.area/(Math.PI*r.ratio));
  if(halfMinor<4||halfMinor>0.28*major)continue;
  let rows=0,covered=0;
  for(let t=-major*0.28;t<=major*0.28;t+=2){
   rows++;let matched=false;
   for(let off=-halfMinor*0.68;off<=halfMinor*0.68;off+=1.2){
    const x=Math.round(r.center.x+ux*t+vx*off),
          y=Math.round(r.center.y+uy*t+vy*off);
    if(x<0||x>=w||y<0||y>=h)continue;
    if(dark[y*w+x]){matched=true;break}
   }
   if(matched)covered++;
  }
  if(rows>12&&covered/rows>0.27){
   return {suspected:true,type:'vulva',evidence:[
    'Tilted elongated genital-like outer contour with central markings']};
  }
 }
 return {suspected:false,type:null,evidence:[]};
}
root.CriloGenitalReview={analyzePixels,version:HYPOTHESIS_VERSION};
})(typeof self!=='undefined'?self:globalThis);
