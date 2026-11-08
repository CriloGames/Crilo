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
  const coarse=Math.sin(u*27+2.3*Math.sin(v*14+seed)+.55*Math.sin(u*13));
  const stripes=Math.pow(Math.max(0,coarse),6);
  const mottles=Math.sin(u*69+v*43)*Math.sin(u*21-v*17);
  const dark= .43*stripes+.06*mottles;
  const light=.91+grain*.18+Math.sin(y*.35+x*.13)*.04;
  const color=bright?[124,112,101]:[87,80,74];
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
 root.name="Reference video: compact 3D spinning tabby silhouette";
 const back=furTexture(3),shoulder=furTexture(7,true);
 const body=fur(back),top=fur(shoulder),shadow=new THREE.MeshStandardMaterial({
  color:0x322e2a,roughness:.98
 }),muzzle=new THREE.MeshStandardMaterial({
  color:0x948879,roughness:.97
 }),nose=new THREE.MeshStandardMaterial({
  color:0x725453,roughness:.88
 });
 // Cat loaf: widest at shoulders, low and round, horizontal in the video.
 // x is the cat's longitudinal direction; z adds real visible 3D depth.
 ellipsoid(root,body,[.72,.34,.44],[-.03,.30,0]);
 ellipsoid(root,top,[.46,.345,.43],[.21,.34,.01]);
 ellipsoid(root,body,[.29,.255,.31],[-.60,.29,.01]);
 // Shoulder, head bump and a small muzzle are visible as the loaf rolls.
 ellipsoid(root,top,[.285,.27,.315],[.58,.35,.08]);
 ellipsoid(root,muzzle,[.125,.15,.205],[.80,.26,.105]);
 ellipsoid(root,nose,[.042,.031,.045],[.908,.23,.205]);
 // Crouched paws appear as a narrow dark underside, not long legs.
 ellipsoid(root,shadow,[.61,.11,.33],[-.06,.072,.02]);
 for(const x of [-.45,.40]){
  ellipsoid(root,body,[.16,.09,.18],[x,.10,.17]);
 }
 // Short folded tail, tucked against the hips. A raised upright tail was
 // the most visible mismatch with the original spinning-cat clip.
 ellipsoid(root,body,[.20,.17,.19],[-.70,.27,-.21]);
 ellipsoid(root,shadow,[.13,.12,.14],[-.73,.21,-.31]);
 // Subtle ear outlines just above the right-hand head bump.
 for(const z of [-.11,.20]){
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.096,.18,6),top);
  ear.position.set(.68,.57,z);ear.rotation.z=-.22;
  ear.castShadow=true;root.add(ear);
 }
 // Half-shadows/striping on the outer shell preserve a realistic tabby
 // impression as the model rotates through light, including the rear view.
 const bandMaterial=new THREE.MeshStandardMaterial({
  color:0x312d2a,transparent:true,opacity:.24,roughness:.99
 });
 for(let i=0;i<9;i++){
  const x=-.53+i*.14;
  const a= -.2+i*.54;
  const stripe=ellipsoid(root,bandMaterial,
   [.035,.018,.17],[x,.60-Math.abs(x)*.075,.23*Math.sin(a)]);
  stripe.rotation.z=.28*Math.sin(i*2.1);
 }
 // Center geometry about a true 3D rotation axis. The pose controller
 // moves this whole cat, not a 2D photograph.
 root.position.set(0,0,0);
 root.userData.kind="volumetric-tabby-loaf";
 return root;
}
