/* Small, local, deterministic shape hint for simple outlined doodles.
   An advisory geometry match, NOT a genitalia classifier or safety verdict.
   Runs only inside moderation-scan-worker.js, never on the UI thread. */
(function(root){
'use strict';
const DIST=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function regions(imageData,width,height){
 if(!imageData||!imageData.length||width<32||height<32||width*height>300000)return [];
 const count=width*height,dark=new Uint8Array(count),dilated=new Uint8Array(count);
 let ink=0;
 for(let i=0;i<count;i++){
  const n=i*4,a=imageData[n+3];
  const r=(imageData[n]*a+255*(255-a))/255;
  const g=(imageData[n+1]*a+255*(255-a))/255;
  const b=(imageData[n+2]*a+255*(255-a))/255;
  dark[i]=Math.min(r,g,b)<205?1:0;ink+=dark[i];
 }
 // Restrict to mostly unfilled sparse drawings, not photos/color-filled art.
 if(ink/count<0.008||ink/count>0.27)return [];
 const offsets=[[0,0],[-1,0],[1,0],[0,-1],[0,1]];
 // A one-pixel CROSS closing helps join tiny gaps in pixelated outlines.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;
  for(const [dx,dy] of offsets){
   const xx=x+dx,yy=y+dy;
   if(xx>=0&&xx<width&&yy>=0&&yy<height&&dark[yy*width+xx]){dilated[i]=1;break}
  }
 }
 const closed=new Uint8Array(count);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;let keep=true;
  for(const [dx,dy] of offsets){
   const xx=x+dx,yy=y+dy;
   if(xx<0||xx>=width||yy<0||yy>=height||!dilated[yy*width+xx]){keep=false;break}
  }
  closed[i]=keep?1:0;
 }
 const seen=new Uint8Array(count),queue=new Int32Array(count),shapes=[];
 const minimal=count*0.005,largest=count*0.19;
 for(let start=0;start<count;start++){
  if(closed[start]||seen[start])continue;
  let head=0,tail=1;queue[0]=start;seen[start]=1;
  let area=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
  let xmin=width,xmax=0,ymin=height,ymax=0,touches=false;
  while(head<tail){
   const i=queue[head++],x=i%width,y=(i-x)/width;
   area++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
   if(x<xmin)xmin=x;if(x>xmax)xmax=x;
   if(y<ymin)ymin=y;if(y>ymax)ymax=y;
   if(x===0||x===width-1||y===0||y===height-1)touches=true;
   if(x>0&&!seen[i-1]&&!closed[i-1]){seen[i-1]=1;queue[tail++]=i-1}
   if(x+1<width&&!seen[i+1]&&!closed[i+1]){seen[i+1]=1;queue[tail++]=i+1}
   if(y>0&&!seen[i-width]&&!closed[i-width]){seen[i-width]=1;queue[tail++]=i-width}
   if(y+1<height&&!seen[i+width]&&!closed[i+width]){seen[i+width]=1;queue[tail++]=i+width}
  }
  if(touches||area<minimal||area>largest)continue;
  const cx=sx/area,cy=sy/area,xx=sxx/area-cx*cx,yy=syy/area-cy*cy,xy=sxy/area-cx*cy;
  const half=Math.sqrt(Math.max(0,((xx-yy)/2)**2+xy**2));
  const high=(xx+yy)/2+half,low=(xx+yy)/2-half;
  if(low<1||high<=0)continue;
  const theta=0.5*Math.atan2(2*xy,xx-yy),major=4*Math.sqrt(high);
  const ux=Math.cos(theta),uy=Math.sin(theta);
  shapes.push({area,ratio:Math.sqrt(high/low),center:{x:cx,y:cy},
   diameter:Math.sqrt(4*area/Math.PI),
   tipA:{x:cx+ux*major/2,y:cy+uy*major/2},
   tipB:{x:cx-ux*major/2,y:cy-uy*major/2},
   bbox:[xmin,ymin,xmax,ymax]});
 }
 return shapes;
}
function analyze(imageData,width,height){
 const shapes=regions(imageData,width,height);
 if(shapes.length<3)return {suspected:false,detail:'No matching outlined regions'};
 // An elongated enclosed region next to TWO separate rounded enclosed regions.
 // Scales/rotation invariant; potential false positives are owner-reviewed only.
 for(let i=0;i<shapes.length;i++){
  const shaft=shapes[i];
  if(shaft.ratio<1.85||shaft.ratio>6.5)continue;
  for(let j=0;j<shapes.length;j++){
   if(j===i)continue;
   const a=shapes[j];
   if(a.ratio>1.65||a.ratio<1||a.area<shaft.area*0.17||a.area>shaft.area*1.75)continue;
   for(let k=j+1;k<shapes.length;k++){
    if(k===i)continue;
    const b=shapes[k];
    if(b.ratio>1.65||b.ratio<1||b.area<shaft.area*0.17||b.area>shaft.area*1.75)continue;
    const diameter=(a.diameter+b.diameter)/2;
    if(DIST(a.center,b.center)>diameter*1.55||DIST(a.center,b.center)<diameter*0.52)continue;
    // Both lobes have to cluster at the SAME tip of the shaft.
    const nearTip=[shaft.tipA,shaft.tipB].some(tip=>
     DIST(a.center,tip)<diameter*1.12&&DIST(b.center,tip)<diameter*1.12);
    const otherTip=[shaft.tipA,shaft.tipB].some(tip=>
     DIST(a.center,tip)<diameter*1.12&&DIST(b.center,tip)<diameter*1.12);
    if(!nearTip||!otherTip)continue;
    return {suspected:true,detail:'Possible genital-like outline: one elongated and two rounded connected-region shapes'};
   }
  }
 }
 return {suspected:false,detail:'No matching outlined shape'};
}
root.CriloShapeReview={analyze,regions};
})(typeof self!=='undefined'?self:globalThis);
