/**
 * Clearance envelopes for fixed ornamental rails on the six physical faces.
 *
 * These are intentionally conservative 2-D projections of the REAL visible
 * controls and housings (including their outer bezels), not hit targets.
 * A decorative strip must never run through a raised control, dial, drawer,
 * fixed lens rim, observatory, or the nearby rotating machinery.
 *
 * The same splitter is used for both the precision layer and the finishing
 * layer.  Keeping the clearances in one place prevents the black inlays from
 * clipping things which the silver/gold rails correctly avoid (and vice versa).
 */
const disc=(x,y,r,name)=>({x,y,rx:r,ry:r,shape:"disc",name});
const rect=(x,y,w,h,name)=>({x,y,rx:w/2,ry:h/2,shape:"rect",name});

export const RAIL_KEEP_OUTS={
 frontFace:[
  disc(0,.56,.82,"main optical housing"),
  rect(0,-.67,1.70,1.12,"sliding lavender drawer and bezel"),
  disc(-1.15,.56,.235,"captive cog hatch"),
  rect(-.99,.96,.52,.24,"serial slider"),
  disc(-1.05,.11,.225,"latch"),
  disc(1.10,.15,.195,"red switch")
 ],
 rightFace:[
  rect(-.06,-.18,1.64,1.12,"teal drawer and guide bezel"),
  rect(-1.13,.31,.38,.30,"side release"),
  rect(.58,-1.08,.52,.30,"service shutter"),
  disc(1.23,1.20,.16,"service bolt")
 ],
 leftFace:[
  disc(-.18,0,.52,"labyrinth casting"),
  disc(.28,-.38,.31,"black drive cog"),
  disc(.88,.64,.34,"calibration gauge"),
  disc(.88,-.95,.23,"dented copper switch"),
  rect(-.99,-.04,.56,.35,"vent housing"),
  ...[1.165,.945,.725,.505].map((y,i)=>
   rect(-.98,y,.36,.21,"vent key "+(i+1)))
 ],
 topFace:[
  disc(0,-1.045,.325,"fixed observatory dome"),
  rect(-.74,-1.12,.37,.30,"wooden tube and flute clamp"),
  ...[-.54,0,.54].map((x,i)=>
   disc(x,.86,.145,"hinge pin "+i))
 ],
 bottomFace:[
  disc(0,0,.72,"engraved stationary underside dial"),
  disc(-1.02,1.02,.25,"sliding rubber foot"),
  disc(1.03,-.28,.265,"brass-ring return socket"),
  disc(0,-1.16,.19,"bell cassette")
 ],
 backFace:[
  rect(0,-.18,1.86,1.15,"eye cassette"),
  rect(-.93,-1.25,.96,.37,"lower cipher cassette"),
  disc(1.055,-1.16,.27,"iris calibration receiver")
 ]
};

/**
 * Clip ONE straight decorative rail in face-local XY coordinates.
 *
 * axis="x" means a horizontal rail, axis="y" a vertical rail.
 * fixed is the other axis's coordinate. [start,end] is the intended
 * along-rail span. 'thickness' is its visible perpendicular thickness.
 *
 * The geometric split includes the rail's OWN half-thickness, an additional
 * manufacturing gap, and each control's bezel. It doesn't shorten or
 * hide the physical controls, their shafts, or real functional guide bars.
 */
export function clearRailSegments(faceName,axis,fixed,start,end,thickness){
 if(axis!=="x"&&axis!=="y")throw Error("Invalid rail axis");
 if(!(end>start&&thickness>0))throw Error("Invalid rail dimensions");
 const padding=thickness/2+.021;
 let intervals=[[start,end]];
 for(const part of RAIL_KEEP_OUTS[faceName]||[]){
  const along=axis==="x"?part.x:part.y;
  const across=axis==="x"?part.y:part.x;
  const halfAlong=axis==="x"?part.rx:part.ry;
  const halfAcross=axis==="x"?part.ry:part.rx;
  const d=Math.abs(fixed-across);
  const bound=halfAcross+padding;
  if(d>=bound)continue;
  let extent;
  if(part.shape==="rect"){
   extent=halfAlong+padding;
  }else{
   // Intersect the cross-sectional line with the disk's padded ellipse.
   const ratio=d/bound;
   extent=(halfAlong+padding)*Math.sqrt(Math.max(0,1-ratio*ratio));
  }
  const lo=along-extent,hi=along+extent;
  intervals=intervals.flatMap(([a,b])=>{
   if(hi<=a||lo>=b)return [[a,b]];
   const pieces=[];
   if(lo-a>.001)pieces.push([a,Math.min(lo,b)]);
   if(b-hi>.001)pieces.push([Math.max(hi,a),b]);
   return pieces;
  });
  if(!intervals.length)break;
 }
 // Tiny slivers floating between two metal fittings look worse than the
 // original intersection; discard them rather than making a loose stud.
 return intervals.filter(([a,b])=>b-a>=.075)
  .map(([a,b])=>({from:a,to:b,length:b-a,center:(a+b)/2}));
}

/** Independent point-based check of a surviving strip against the hardware. */
export function railClearanceFaults(faceName,axis,fixed,segments,thickness){
 const issues=[];
 const margin=thickness/2+.020;
 for(const seg of segments){
  for(const part of RAIL_KEEP_OUTS[faceName]||[]){
   // Probe 12 positions, including ends, using the actual strip width.
   for(let i=0;i<=12;i++){
    const along=seg.from+(seg.to-seg.from)*i/12;
    const x=axis==="x"?along:fixed;
    const y=axis==="x"?fixed:along;
    const rx=part.rx+margin,ry=part.ry+margin;
    const dx=Math.abs(x-part.x),dy=Math.abs(y-part.y);
    const collides=part.shape==="rect"
     ?dx<rx&&dy<ry
     :(dx/rx)**2+(dy/ry)**2<1;
    if(collides){
     issues.push({face:faceName,rail:axis,hardware:part.name,
      x:+x.toFixed(3),y:+y.toFixed(3)});
     break;
    }
   }
  }
 }
 return issues;
}