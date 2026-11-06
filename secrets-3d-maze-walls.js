// Connected maze relief. Every wall is the exact complement of a real
// traversable edge; joins share mathematical endpoints, not arbitrary trims.
export function buildMazeWalls({THREE,plate,openEdges,key,sectors,rings,
 innerRadius,pitch,startAngle,bevel,ink}){
 const step=Math.PI*2/sectors,paths=[],blocked=new Set();
 const radial=(angle,a,b)=>paths.push([
  {x:a*Math.cos(angle),y:a*Math.sin(angle)},
  {x:b*Math.cos(angle),y:b*Math.sin(angle)}
 ]);
 const arc=(radius,start,end)=>{
  const n=Math.max(6,Math.ceil(radius*(end-start)*180));
  paths.push(Array.from({length:n},(_,i)=>{
   const a=start+(end-start)*i/(n-1);
   return {x:radius*Math.cos(a),y:radius*Math.sin(a)};
  }));
 };
 const curvedRuns=mask=>{
  const first=mask.findIndex(open=>!open);
  if(first<0)return [[0,sectors]];
  const runs=[];let begin=-1;
  for(let i=1;i<=sectors;i++){
   const raw=first+i;
   if(mask[raw%sectors]){if(begin<0)begin=raw;}
   else if(begin>=0){runs.push([begin,raw]);begin=-1;}
  }
  return runs;
 };
 const drawBoundary=(radius,mask)=>{
  for(const [start,end] of curvedRuns(mask))
   arc(radius,startAngle+(start-.5)*step,
    startAngle+(end-.5)*step);
 };
 for(let ring=0;ring<rings;ring++){
  const radius=innerRadius+ring*pitch;
  for(let sector=0;sector<sectors;sector++){
   const a=ring*sectors+sector;
   const b=ring*sectors+(sector+1)%sectors;
   const edge=key(a,b);
   if(openEdges.has(edge))continue;
   blocked.add(edge);
   radial(startAngle+(sector+.5)*step,
    radius-pitch/2,radius+pitch/2);
  }
  if(ring===rings-1)continue;
  const mask=Array.from({length:sectors},(_,sector)=>{
   const a=ring*sectors+sector,b=a+sectors,edge=key(a,b);
   if(openEdges.has(edge))return false;
   blocked.add(edge);return true;
  });
  drawBoundary(radius+pitch/2,mask);
 }
 const goal=rings*sectors;
 const innerMask=Array.from({length:sectors},(_,sector)=>{
  const edge=key(sector,goal);
  if(openEdges.has(edge))return false;
  blocked.add(edge);return true;
 });
 // Widen the final top-facing goal mouth without opening another
 // navigable route. Connected tapered cheeks link the flared inner lip
 // to each adjoining ring-zero radial wall at its exact endpoint.
 const innerLip=innerRadius-pitch/2;
 const flare=.12*step;
 for(const [start,end] of curvedRuns(innerMask)){
  const left=startAngle+(start-.5)*step;
  const right=startAngle+(end-.5)*step;
  const flaredLeft=left+flare,flaredRight=right-flare;
  arc(innerLip,flaredLeft,flaredRight);
  // The shoulders join the existing radial walls at radius innerRadius.
  // No detached maze lines or accessible false center entrances.
  paths.push([
   {x:innerRadius*Math.cos(left),y:innerRadius*Math.sin(left)},
   {x:innerLip*Math.cos(flaredLeft),y:innerLip*Math.sin(flaredLeft)}
  ]);
  paths.push([
   {x:innerLip*Math.cos(flaredRight),y:innerLip*Math.sin(flaredRight)},
   {x:innerRadius*Math.cos(right),y:innerRadius*Math.sin(right)}
  ]);
 }
 // Bottom perimeter opening is centered on sector zero.
 arc(innerRadius+(rings-.5)*pitch,
  startAngle+step/2,startAngle+Math.PI*2-step/2);
 const totalPossible=(2*rings)*sectors;
 if(blocked.size!==totalPossible-openEdges.size||
    [...openEdges].some(e=>blocked.has(e)))
  throw Error("3D walls disagree with the maze movement graph");
 function relief(width,height,material){
  const vertices=[],half=width/2;
  const triangle=(a,b,c)=>vertices.push(
   a.x,a.y,height,b.x,b.y,height,c.x,c.y,height);
  for(const points of paths){
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len*half,ny=dx/len*half;
    const al={x:a.x+nx,y:a.y+ny},ar={x:a.x-nx,y:a.y-ny};
    const bl={x:b.x+nx,y:b.y+ny},br={x:b.x-nx,y:b.y-ny};
    triangle(al,br,bl);triangle(al,ar,br);
   }
   // Round caps seal the endpoint of each wall and every curved join.
   for(const p of points)for(let k=0;k<8;k++){
    const a=k*Math.PI/4,b=(k+1)*Math.PI/4;
    triangle(p,
     {x:p.x+half*Math.cos(a),y:p.y+half*Math.sin(a)},
     {x:p.x+half*Math.cos(b),y:p.y+half*Math.sin(b)});
   }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",
   new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  material.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geometry,material);
  mesh.castShadow=false;mesh.frustumCulled=false;
  plate.add(mesh);
  return mesh;
 }
 relief(.009,.174,bevel);
 relief(.006,.183,ink);
 return {wallRuns:paths.length,blockedEdges:blocked.size,
  wallLayers:2,entranceSector:0,exitSector:sectors/2,
  centerFlareRadians:2*flare};
}
