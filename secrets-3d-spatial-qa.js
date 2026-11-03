// Dev-only, on-demand precise collision audit of Nothing Here's physical 3D parts.
// Real triangles are checked by three-mesh-bvh AFTER broad-phase world-space
// bounding boxes. Never import this file on the ordinary player's critical path.
import * as THREE from "three";
import {MeshBVH} from "three-mesh-bvh";

const bounds=new THREE.Box3();
const temp=new THREE.Box3();
const transform=new THREE.Matrix4();
const cache=new WeakMap();

function effectivelyVisible(node){
 for(let p=node;p;p=p.parent)if(!p.visible)return false;
 return true;
}
function visibleMesh(mesh){
 if(!mesh.isMesh||!effectivelyVisible(mesh))return false;
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 return materials.some(m=>m&&m.visible!==false&&m.colorWrite!==false&&m.opacity!==0);
}
function groupInfo(kind,map){
 const output=[];
 for(const [name,root] of map||[]){
  if(!root||!effectivelyVisible(root))continue;
  const meshes=[];
  const aabb=new THREE.Box3().makeEmpty();
  root.traverse(mesh=>{
   if(!visibleMesh(mesh))return;
   const position=mesh.geometry?.getAttribute?.("position");
   if(!position||position.count<3)return;
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   aabb.expandByObject(mesh,true);
   meshes.push(mesh);
  });
  if(!meshes.length||aabb.isEmpty())continue;
  output.push({kind,name,root,meshes,aabb});
 }
 return output;
}
function overlap(a,b){
 bounds.copy(a.aabb).intersect(b.aabb);
 if(bounds.isEmpty())return null;
 const size=bounds.getSize(new THREE.Vector3());
 if(size.x<.018||size.y<.018||size.z<.018)return null;
 return size.toArray().map(x=>Math.round(x*1000)/1000);
}
function intersects(meshA,meshB){
 const a=meshA.geometry,b=meshB.geometry;
 if(!a||!b)return false;
 temp.copy(a.boundingBox||a.computeBoundingBox()||a.boundingBox).applyMatrix4(meshA.matrixWorld);
 bounds.copy(b.boundingBox||b.computeBoundingBox()||b.boundingBox).applyMatrix4(meshB.matrixWorld);
 if(!temp.intersectsBox(bounds))return false;
 let bvh=cache.get(a);
 if(!bvh){
  // Work with a clone: MeshBVH generates an index for non-indexed meshes.
  // The game meshes must not be mutated by the debugger.
  const copy=a.clone();
  bvh=new MeshBVH(copy,{maxLeafTris:12});
  cache.set(a,bvh);
 }
 transform.copy(meshA.matrixWorld).invert().multiply(meshB.matrixWorld);
 return bvh.intersectsGeometry(b,transform);
}
function isAncestor(parent,child){
 for(let p=child;p;p=p.parent)if(p===parent)return true;
 return false;
}

/**
 * Compare independent physical assemblies. A miniature's own screws and
 * cradle are intentionally embedded in its mesh and must not be reported
 * as a collision with themselves. This is a diagnostic; the existing
 * spatial bounds/overhang checks continue to gate mechanical integrity.
 */
export function scanSpatialIntersections({
 models=new Map(),rewards=new Map(),mechanisms=new Map(),
 maxCandidates=180,maxMeshChecks=5000
}={}){
 // Confirm the external library actually performs triangle intersection
 // rather than silently falling back to broad bounding boxes. The near
 // cubes cross surfaces, while the distant cubes cannot touch.
 const testA=new THREE.BoxGeometry(1,1,1);
 const testB=new THREE.BoxGeometry(1,1,1);
 const testBVH=new MeshBVH(testA);
 const selfTest={
  intersecting:testBVH.intersectsGeometry(testB,
   new THREE.Matrix4().makeTranslation(.7,0,0)),
  separated:!testBVH.intersectsGeometry(testB,
   new THREE.Matrix4().makeTranslation(3,0,0))
 };
 testA.dispose();testB.dispose();
 const groups=[
  ...groupInfo("model",models),
  ...groupInfo("reward",rewards),
  ...groupInfo("mechanism",mechanisms)
 ];
 let broadPhasePairs=0,meshPairsTested=0,skippedMeshChecks=0;
 const intersections=[],aabbOnly=[];
 const considered={models:0,rewards:0,mechanisms:0};
 for(const g of groups)considered[g.kind==="model"?"models":
   g.kind==="reward"?"rewards":"mechanisms"]++;
 for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
  const a=groups[i],b=groups[j];
  if(a.kind==="mechanism"&&b.kind==="mechanism")continue;
  // Reward models deliberately touch their source's own bracket.
  // They are audited against other rewards and moving mechanisms.
  if((a.kind==="model"&&b.kind==="reward")||
     (a.kind==="reward"&&b.kind==="model"))continue;
  if(isAncestor(a.root,b.root)||isAncestor(b.root,a.root))continue;
  const shared=overlap(a,b);
  if(!shared)continue;
  broadPhasePairs++;
  if(broadPhasePairs>maxCandidates)continue;
  let hits=0;
  const examples=[];
  outer:for(const ma of a.meshes)for(const mb of b.meshes){
   if(meshPairsTested>=maxMeshChecks){skippedMeshChecks++;break outer;}
   meshPairsTested++;
   try{
    if(intersects(ma,mb)){
     hits++;
     if(examples.length<3)examples.push({
      meshA:ma.name||ma.geometry.type||"mesh",
      meshB:mb.name||mb.geometry.type||"mesh"
     });
    }
   }catch(e){
    examples.push({error:String(e).slice(0,160)});
    hits++;
    break outer;
   }
  }
  const result={first:a.kind+":"+a.name,second:b.kind+":"+b.name,
   aabbOverlap:shared,triangleCrossings:hits,examples};
  if(hits)intersections.push(result);
  else if(aabbOnly.length<24)aabbOnly.push(result);
 }
 return {
  library:"three-mesh-bvh",selfTest,groups:considered,totalAssemblies:groups.length,
  broadPhasePairs,meshPairsTested,skippedMeshChecks,
  truncated:broadPhasePairs>maxCandidates||skippedMeshChecks>0,
  intersections:intersections.slice(0,40),totalIntersections:intersections.length,
  boundsOnlySamples:aabbOnly
 };
}
