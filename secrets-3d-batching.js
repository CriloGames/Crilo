import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Collapse fixed ornamental meshes into material-grouped geometry.
 *
 * Only individually tracked DECORATIVE meshes may be merged. Controls, drawer
 * contents, moving gears, and the hinged lid are excluded. The coordinates are
 * baked into the main cube's reference frame, so rotating the cube still turns
 * every rivet, routed cable and embossed trim correctly.
 *
 * A handcrafted model can have many physical features without requiring a
 * separate GPU draw call for each small screw or engraving stroke.
 */
export function batchStaticGeometry(cube,candidates,{
  dynamicRoots=[],
  protectedMeshes=[],
  minGroupSize=3,
  label="decor"
}={}) {
  const dynamic=new Set(dynamicRoots);
  const protectedSet=new Set(protectedMeshes);
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
  cube.updateWorldMatrix(true,true);
  const toCube=cube.matrixWorld.clone().invert();
  const groups=new Map();
  for(const mesh of candidates){
    if(!mesh?.isMesh||!mesh.parent||!belongsToCube(mesh)||blocked(mesh))continue;
    if(Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.opacity<1)continue;
    if(!mesh.geometry?.attributes?.position||!mesh.geometry.attributes.normal)continue;
    const shadow=mesh.castShadow?1:0;
    const key=mesh.material.uuid+":"+shadow;
    if(!groups.has(key))groups.set(key,{material:mesh.material,shadow,meshes:[]});
    groups.get(key).meshes.push(mesh);
  }
  let sourceMeshes=0,mergedMeshes=0,groupsCreated=0;
  for(const {material,shadow,meshes} of groups.values()){
    if(meshes.length<minGroupSize)continue;
    const pieces=meshes.map(mesh=>{
      mesh.updateWorldMatrix(true,false);
      const g=mesh.geometry.clone();
      g.applyMatrix4(toCube.clone().multiply(mesh.matrixWorld));
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
    out.castShadow=!!shadow;out.receiveShadow=true;
    out.frustumCulled=true;
    cube.add(out);
    sourceMeshes+=meshes.length;
    mergedMeshes+=1;groupsCreated++;
    for(const mesh of meshes){
      mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    }
  }
  return {sourceMeshes,mergedMeshes,drawCallsSaved:sourceMeshes-mergedMeshes,groupsCreated};
}
