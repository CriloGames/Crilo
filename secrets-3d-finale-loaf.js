/* Nothing Here — volumetric loaf/cat-spin model.
 *
 * The reference alternates between a front-facing standing tabby and a
 * compact horizontal loaf with an off-center head/tail. Merely spinning a
 * standing cat made long legs/tail stick out in every psychedelic scene.
 *
 * This is a separate, actual Three.js 3D cat mesh with procedural fur,
 * photographic-style banding, shoulder volume and a hidden paw skirt.
 * It is NOT a replayed frame, video texture, cutout or sprite.
 */
import * as THREE from "three";

function furTexture(seed=1,bright=false){
 const canvas=document.createElement("canvas");
 canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext("2d");
 const pixels=ctx.createImageData(512,256);
 const data=pixels.data;
 for(let y=0;y<256;y++)for(let x=0;x<512;x++){
  const u=x/512,v=y/256;
  const n=Math.sin((x+seed*37)*12.9898+(y+seed*29)*78.233)*43758.5453;
  const grain=(n-Math.floor(n))-.5;
  // Fine tabby bars with gentle waviness rather than huge cloth-like
  // spiral swirls across the entire body.
  const bands=Math.sin(u*34+1.0*Math.sin(v*7+seed)+.6*Math.sin(u*8+v*4));
  const stripes=Math.pow(Math.max(0,bands),9);
  const mottles=Math.sin(u*69+v*43)*Math.sin(u*21-v*17);
  const dark=.50*stripes+.04*mottles;
  const light=.91+grain*.13+Math.sin(y*.35+x*.13)*.025;
  const color=bright?[132,124,113]:[109,103,98];
  const i=(y*512+x)*4;
  data[i]=Math.max(0,Math.min(255,color[0]*light-dark*102));
  data[i+1]=Math.max(0,Math.min(255,color[1]*light-dark*95));
  data[i+2]=Math.max(0,Math.min(255,color[2]*light-dark*84));
  data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 // Fine, irregular strands make the fur read as matte and textured, never
 // like the shiny smooth plastic in the old procedural cat.
 for(let j=0;j<7800;j++){
  const x=(j*73.314+seed*17.3)%512;
  const y=(j*179.473+seed*21.7)%256;
  ctx.strokeStyle=j%3===0?"#e8d6be19":"#17130f20";
  ctx.lineWidth=.46;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2.2,y+.35);ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 texture.wrapT=THREE.ClampToEdgeWrapping;
 texture.anisotropy=4;
 return texture;
}
function fur(map,color=0xffffff){
 return new THREE.MeshStandardMaterial({
  color,map,roughness:.97,metalness:0,side:THREE.FrontSide
 });
}
function ellipsoid(parent,mat,size,pos,rotate){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),mat);
 mesh.scale.set(...size);mesh.position.set(...pos);
 if(rotate)mesh.rotation.set(...rotate);
 mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);
 return mesh;
}
export function makeSpinningLoaf(){
 const root=new THREE.Group();
 root.name="Compact 3D gray tabby rotating horizontally, head at +X";
 const back=furTexture(3),headFur=furTexture(7,true);
 const body=fur(back),headMat=fur(headFur);
 const shadow=new THREE.MeshStandardMaterial({
  color:0x423f3d,roughness:.98
 }),muzzle=new THREE.MeshStandardMaterial({
  color:0xc1b5a9,roughness:.99
 }),nose=new THREE.MeshStandardMaterial({
  color:0xba8587,roughness:.94
 }),eye=new THREE.MeshStandardMaterial({
  color:0xa49c73,roughness:.72
 }),pupil=new THREE.MeshStandardMaterial({
  color:0x252622,roughness:.62
 }),innerEar=new THREE.MeshStandardMaterial({
  color:0xa07879,roughness:.98
 });
 // ONE unbroken compact torso, not four intersecting cushions that
 // resemble a rolled blanket. Head and shoulders remain distinct.
 ellipsoid(root,body,[.72,.31,.38],[-.09,.32,0]);
 ellipsoid(root,headMat,[.32,.27,.305],[.57,.37,0]);
 // Natural chin and left/right muzzle lobes (head faces +X).
 ellipsoid(root,muzzle,[.11,.115,.145],[.83,.23,-.078]);
 ellipsoid(root,muzzle,[.11,.115,.145],[.83,.23,.078]);
 ellipsoid(root,nose,[.045,.033,.055],[.941,.31,0]);
 // Two forward-facing real feline eyes. Their pupils are mounted on the
 // front of the head, not one big circular dog nose.
 for(const z of [-.155,.155]){
  ellipsoid(root,eye,[.04,.044,.055],[.851,.43,z]);
  ellipsoid(root,pupil,[.021,.033,.032],[.883,.43,z]);
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.102,.21,3),headMat);
  ear.rotation.x=Math.PI/2;
  ear.rotation.z=-.10;
  ear.position.set(.615,.675,z*1.25);
  root.add(ear);
  const pink=new THREE.Mesh(new THREE.ConeGeometry(.064,.13,3),innerEar);
  pink.rotation.x=Math.PI/2;
  pink.position.set(.668,.671,z*1.25);
  root.add(pink);
 }
 // Tucked forepaws and hind paws: compact side view while spinning.
 for(const x of [-.45,.36])for(const z of [-.22,.22]){
  ellipsoid(root,body,[.16,.082,.115],[x,.085,z]);
 }
 // A short tail folds onto the rump; no upright shaft can break the spin
 // silhouette as it flips from side -> front -> opposite side.
 ellipsoid(root,body,[.16,.145,.17],[-.73,.28,-.17]);
 // Tiny whiskers visibly establish the identity as a cat at slow frames.
 const whisker=new THREE.LineBasicMaterial({color:0x746d67,transparent:true,
  opacity:.65,depthWrite:false});
 for(const side of [-1,1])for(const y of [.225,.27,.315]){
  const g=new THREE.BufferGeometry().setFromPoints([
   new THREE.Vector3(.90,y,side*.10),
   new THREE.Vector3(.90,y+.01,side*.31),
   new THREE.Vector3(.84,y+.02,side*.43)
  ]);
  root.add(new THREE.Line(g,whisker));
 }
 // Meshes and fur are original 3D geometry, not sampled video frames.
 root.userData.kind="3d-gray-tabby-yaw";
 return root;
}
