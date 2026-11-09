/* Crilo Classic duck in tangible 3D.
 * Palette and linework follow the site's own duck-classic.svg / DuckWorld.art
 * (Classic: #ffe076 body, #f7ab67 bill, #453b35 outlines, #c88a58 feet).
 * A single original rig is held still or rotated, never swapped by pose.
 */
import * as THREE from "three";

export function buildCriloClassicDuck(){
 const root=new THREE.Group();
 root.name="Crilo Classic duck mascot — one complete 3D rig";
 root.userData.criloMascot="classic";
 const yellow=new THREE.MeshStandardMaterial({
  color:0xffe076,roughness:.83,metalness:0
 });
 const wingYellow=new THREE.MeshStandardMaterial({
  color:0xffe58f,roughness:.84,metalness:0
 });
 const billOrange=new THREE.MeshStandardMaterial({
  color:0xf7ab67,roughness:.74,metalness:0
 });
 const footBrown=new THREE.MeshStandardMaterial({
  color:0xc88a58,roughness:.83,metalness:0
 });
 const outline=new THREE.MeshBasicMaterial({
  color:0x453b35,side:THREE.BackSide
 });
 const line=new THREE.MeshStandardMaterial({
  color:0x453b35,roughness:1,metalness:0
 });
 const wingLine=new THREE.MeshStandardMaterial({
  color:0xaa9a74,roughness:1,metalness:0
 });
 const shine=new THREE.MeshBasicMaterial({color:0xfffcdf});
 const sphere=new THREE.SphereGeometry(1,32,20);

 function oval(parent,mat,center,radii,edge=.038){
  const shell=new THREE.Group();
  shell.position.set(...center);
  parent.add(shell);
  if(edge){
   const rim=new THREE.Mesh(sphere,outline);
   rim.scale.set(radii[0]+edge,radii[1]+edge,radii[2]+edge);
   shell.add(rim);
  }
  const mesh=new THREE.Mesh(sphere,mat);
  mesh.scale.set(...radii);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  shell.add(mesh);
  return shell;
 }
 function lineTube(points,mat,r=.018){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,18,r,7,false),mat);
  mesh.castShadow=false;
  root.add(mesh);
  return mesh;
 }
 // DuckWorld's sideways oval body and upright neck are recognizable from
 // any angle, with the tiny rear tail and two sketch-like stick legs.
 oval(root,yellow,[0,.73,-.18],[.52,.44,.72],.028);
 oval(root,yellow,[0,1.02,.29],[.33,.41,.37],.019);
 oval(root,yellow,[0,1.39,.39],[.365,.335,.35],.025);
 // The familiar Classic mascot has one upturned pointed feather tail.
 const tail=oval(root,yellow,[0,.92,-.83],[.29,.235,.28],.018);
 tail.rotation.x=-.32;
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.21,.43,8),yellow);
 tip.rotation.x=-.48;tip.position.set(0,1.15,-.97);
 tip.castShadow=true;root.add(tip);
 // Wide, flattened orange top bill and thinner lower bill, facing +Z.
 const upper=oval(root,billOrange,[0,1.30,.755],[.31,.09,.255],.021);
 upper.rotation.x=-.07;
 oval(root,billOrange,[0,1.215,.77],[.255,.055,.185],.015);
 lineTube([[-.245,1.216,.855],[0,1.208,.95],[.245,1.216,.855]],line,.012);
 // Two small dark dot eyes (same black-brown as Classic SVG), with tiny
 // reflections. They remain readable when spinning or stationary.
 for(const sign of [-1,1]){
  const wing=oval(root,wingYellow,
   [sign*.455,.77,-.14],[.12,.235,.385],.025);
  wing.rotation.z=-sign*.18;
  wing.rotation.x=.14;
  // Draw the familiar curved feather seam in front of each wing.
  const x=sign*.571;
  lineTube([[x,.80,.13],[x,.67,-.025],[x,.60,-.25]],wingLine,.020);
  lineTube([[x,.67,-.03],[x,.62,-.16],[x,.67,-.33]],wingLine,.011);
  // Eye dots face outward/front so one dot is prominent from the side.
  oval(root,line,[sign*.267,1.475,.633],[.052,.055,.046],0);
  oval(root,shine,[sign*.277,1.493,.672],[.014,.015,.009],0);
  // Fine two-stick legs and little wide paddle feet.
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.026,.034,.26,12),footBrown);
  leg.position.set(sign*.22,.28,.015);
  leg.castShadow=true;root.add(leg);
  const foot=oval(root,footBrown,[sign*.22,.095,.19],[.155,.06,.205],.012);
  foot.rotation.y=sign*.08;
  for(const dx of [-.075,0,.075])
   oval(root,footBrown,[sign*.22+dx,.07,.325],[.045,.04,.072],0);
 }
 // Quieter chest scallop hints at the original hand-drawn outline without
 // inventing a hat, crown, logo or changing the mascot's palette.
 lineTube([[-.17,.72,.488],[0,.67,.54],[.17,.72,.488]],wingLine,.014);
 // Present Crilo's actual SIDE-FACING Classic duck silhouette during still
 // moments: tail/body left, head/beak right, one visible eye and wing.
 // Rotating the SAME root in the music keeps every spin physically coherent.
 root.rotation.y=1.12;
 root.scale.setScalar(.85); // deliberately smaller than the former tabby
 root.userData.materialPalette={
  body:"#ffe076",beak:"#f7ab67",outline:"#453b35",feet:"#c88a58"
 };
 return root;
}
