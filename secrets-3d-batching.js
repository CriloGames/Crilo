import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Bake ornamental meshes into their OWN moving panel's local coordinates.
 *
 * The old optimizer baked every detail into the rigid cube coordinate frame
 * and added each combined mesh to cube itself. This looked correct in the
 * folded state, but after the six panels hinged open the optimization left
 * screws, gears, trims and other decoration suspended in mid-air.
 *
 * A batch can include meshes from only ONE panel. The merged geometry lives
 * under that same panel, so it keeps every original texture and follows its
 * hinge automatically. Drawer/gear/lid geometry remains unbatched.
 */
export function batchStaticGeometry(cube,candidates,{
  panelRoots=[],
  faceRoot=null,
  dynamicRoots=[],
  protectedMeshes=[],
  minGroupSize=3,
  label="decor"
}={}) {
  const dynamic=new Set(dynamicRoots);
  const protectedSet=new Set(protectedMeshes);
  const panels=new Set(panelRoots);
  const belongsToCube=node=>{
    for(let p=node;p;p=p.parent)if(p===cube)return true;
    return false;
  };
  const blocked=node=>{
    for(let p=node;p;p=p.parent){
      if(dynamic.has(p)||p.userData?.action||p.userData?.noBatch)return true;
      if(p===cube)break;
    }
    return protectedSet.has(node);
  };
  const batchParent=node=>{
    // Always use the closest owning hinged face, never the stationary cube.
    // Some finishing meshes live directly under faceRoot, which moves as a
    // whole during the final T transition; they use that intermediate root.
    for(let p=node.parent;p&&p!==cube;p=p.parent){
      if(panels.has(p))return p;
      if(faceRoot&&p===faceRoot)return faceRoot;
    }
    return cube;
  };
  cube.updateWorldMatrix(true,true);
  const groups=new Map();
  for(const mesh of candidates){
    if(!mesh?.isMesh||!mesh.parent||!belongsToCube(mesh)||blocked(mesh))continue;
    if(Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.opacity<1)continue;
    if(!mesh.geometry?.attributes?.position||!mesh.geometry.attributes.normal)continue;
    const owner=batchParent(mesh);
    const shadow=mesh.castShadow?1:0;
    // Material UUID alone is not enough: panels have separate transforms.
    const key=owner.uuid+":"+mesh.material.uuid+":"+shadow;
    if(!groups.has(key))
      groups.set(key,{owner,material:mesh.material,shadow,meshes:[]});
    groups.get(key).meshes.push(mesh);
  }
  let sourceMeshes=0,mergedMeshes=0,groupsCreated=0;
  const perPanel={};
  for(const {owner,material,shadow,meshes} of groups.values()){
    if(meshes.length<minGroupSize)continue;
    owner.updateWorldMatrix(true,false);
    const toOwner=owner.matrixWorld.clone().invert();
    const pieces=meshes.map(mesh=>{
      mesh.updateWorldMatrix(true,false);
      const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      // Keep each vertex in the moving panel's own coordinate frame.
      g.applyMatrix4(toOwner.clone().multiply(mesh.matrixWorld));
      return g;
    });
    let merged=null;
    try{merged=mergeGeometries(pieces,false)}catch(err){
      console.warn("Skipped one incompatible physical detail batch",err);
    }
    pieces.forEach(g=>g.dispose());
    if(!merged)continue;
    merged.computeBoundingSphere();
    const out=new THREE.Mesh(merged,material);
    out.name=label+"-physical-batch-"+groupsCreated;
    out.userData.finaleBatchOwner=owner.userData.finalePanelName||owner.name||"root";
    out.castShadow=!!shadow;out.receiveShadow=true;
    out.frustumCulled=true;
    owner.add(out);
    sourceMeshes+=meshes.length;
    mergedMeshes+=1;groupsCreated++;
    const ownerName=owner.userData.finalePanelName||owner.name||"cube";
    perPanel[ownerName]=(perPanel[ownerName]||0)+1;
    for(const mesh of meshes){
      mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    }
  }
  return {
    sourceMeshes,mergedMeshes,drawCallsSaved:sourceMeshes-mergedMeshes,
    groupsCreated,perPanel,coordinateSpace:"hinged-panel"
  };
}
