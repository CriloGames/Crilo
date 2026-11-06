// Verify that every apparently open channel is actually passable and
// that every blocked direction has a visible, joined physical boundary.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const game=read("cube-secrets.js"),scene=read("secrets-3d-details.js");
const walls=read("secrets-3d-maze-walls.js");
const body=read("secrets-3d-maze-assembly.js");
const extract=(code,name)=>{
 const m=code.match(new RegExp("const "+name+"=\\\"([0-9a-f]+)\\\""));
 assert(m,"Missing maze layout "+name);
 return m[1].match(/.{4}/g).map(e=>
  [parseInt(e.slice(0,2),16),parseInt(e.slice(2),16)]);
};
const edges=extract(game,"MAZE_PASSAGES");
assert.deepEqual(edges,extract(scene,"mazePassages"));
const route=JSON.parse(game.match(/const MAZE_ROUTE_CELLS=(\[[^;]+\]);/)[1]);
assert.deepEqual(route,JSON.parse(scene.match(/const mazeRouteCells=(\[[^;]+\]);/)[1]));
const key=(a,b)=>Math.min(a,b)+":"+Math.max(a,b);
const open=new Set(edges.map(([a,b])=>key(a,b)));
assert.equal(open.size,96);
const graph=new Map();
for(const [a,b] of edges)
 for(const [u,v] of [[a,b],[b,a]]){
  if(!graph.has(u))graph.set(u,new Set());
  graph.get(u).add(v);
 }
const reached=new Set([80]),queue=[80],distance=new Map([[80,0]]);
for(let i=0;i<queue.length;i++)
 for(const n of graph.get(queue[i])||[])
  if(!reached.has(n)){
   reached.add(n);queue.push(n);distance.set(n,distance.get(queue[i])+1);
  }
assert.equal(graph.size,97);
assert.equal(reached.size,97);
assert.equal(edges.length,graph.size-1); // unique solution, zero cycles
assert.deepEqual([...graph.get(96)],[8]); // center mouth exactly TOP
assert(graph.get(80).has(81)&&graph.get(80).has(95)); // both directions start
assert.equal(route[0],80);
assert.equal(route.at(-1),96);
assert.equal(distance.get(96),route.length-1);
for(let i=1;i<route.length;i++)
 assert(open.has(key(route[i-1],route[i])),
  "An advertised solution crosses a real wall");

const TH={DoubleSide:2,
 BufferGeometry:class{setAttribute(name,x){this.vertices=x.array}
  computeVertexNormals(){}},
 Float32BufferAttribute:class{constructor(array){this.array=array}},
 Mesh:class{constructor(geometry,material){
  assert(geometry.vertices.length>0,"Missing actual physical wall polygons");
  this.geometry=geometry;this.material=material;
 }}};
const meshes=[],plate={add:x=>meshes.push(x)};
const build=new Function(walls.replace(/^export /gm,"")+"\nreturn buildMazeWalls;")();
const result=build({THREE:TH,plate,key,openEdges:open,sectors:16,
 rings:6,innerRadius:.092,pitch:.040,startAngle:-Math.PI/2,
 bevel:{},ink:{}});
assert.equal(result.blockedEdges,96);
assert.equal(result.wallLayers,2);
assert(result.wallRuns>30&&meshes.length===2);
assert.equal(result.entranceSector,0);
assert.equal(result.exitSector,8);
// Both mouth widths must exceed the actual sphere, including line thickness.
const ballDiameter=.0084*2,sectorWidth=2*Math.PI/16;
const innerOpening=.072*sectorWidth-.006;
const collarOpening=2*.027*Math.sin((3.5*sectorWidth)/2)-.006;
assert(innerOpening>ballDiameter+.002);
assert(collarOpening>ballDiameter+.002);
assert(scene.includes('new THREE.SphereGeometry(.0084,20,16)'));
assert(scene.includes('mazePlate.rotation.z=0'));
assert(body.includes('const goalSector=sectors/2'));
assert(body.includes('goalSocket.rotation.z=centerMouthAngle+goalCollarGap/2'));
assert(game.includes("MAZE_LAYOUT_VERSION=6"));
// Test every possible directional input against the graph itself.
const from=game.indexOf("const MAZE_ROUTE_CELLS=");
const to=game.indexOf("let raw={};",from);
const nav=new Function(game.slice(from,to)+
 "\nreturn {move:mazeDestination};")();
for(let r=0;r<6;r++)for(let k=0;k<16;k++){
 const cell=r*16+k;
 for(const [direction,next] of [
  ["maze-ccw",r*16+(k+1)%16],
  ["maze-cw",r*16+(k+15)%16],
  ["maze-in",r===0?96:cell-16],
  ["maze-out",r===5?null:cell+16]
 ]){
  const actual=nav.move(cell,direction);
  assert.equal(actual,next!==null&&open.has(key(cell,next))?next:null,
   "An invisible wall or phantom opening at "+cell+" "+direction);
 }
}
console.log("PASS: fully visible maze barriers, 97 connected cells, opposite goal, 52-move unique solution");
