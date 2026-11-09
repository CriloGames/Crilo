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
 root.userData.neckGeometry="continuous-short-sculpt";
 root.userData.neckSeams=0;
 root.userData.stillFacingAxis="+Z";
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
 // One continuous, SHORT curved neck flowing into the head instead of
 // three overlapping outlined balls. The old separate neck/head shells
 // caused an obvious dark ring and a long stacked-sausage silhouette.
 oval(root,yellow,[0,.73,-.18],[.52,.44,.72],.028);
 const headProfile=[
  // [y, radius, forward offset] — natural shoulder -> throat -> head.
  [.56,.025,.10],[.65,.165,.17],[.78,.205,.245],
  [.94,.215,.315],[1.06,.245,.35],[1.19,.295,.39],
  [1.31,.342,.42],[1.42,.330,.43],[1.52,.260,.43],
  [1.585,.142,.43],[1.61,.012,.43]
 ];
 const profileCurve=new THREE.SplineCurve(
  headProfile.map(([y,r])=>new THREE.Vector2(r,y))
 );
 const headGeometry=new THREE.LatheGeometry(profileCurve.getPoints(56),40);
 const position=headGeometry.getAttribute("position");
 // Curve the neck forward toward the face, keeping its rear side seated
 // in the body. There are NO horizontal intersecting neck/head outlines.
 function centerZ(y){
  for(let i=1;i<headProfile.length;i++){
   if(y<=headProfile[i][0]){
    const a=headProfile[i-1],b=headProfile[i];
    const t=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
    return THREE.MathUtils.lerp(a[2],b[2],t);
   }
  }
  return headProfile[headProfile.length-1][2];
 }
 for(let i=0;i<position.count;i++){
  const y=position.getY(i);
  const dz=position.getZ(i);
  position.setZ(i,dz*1.08+centerZ(y));
 }
 position.needsUpdate=true;
 headGeometry.computeVertexNormals();
 headGeometry.computeBoundingBox();
 headGeometry.computeBoundingSphere();
 const smoothHead=new THREE.Mesh(headGeometry,yellow);
 smoothHead.castShadow=true;smoothHead.receiveShadow=true;
 smoothHead.name="Continuous smooth Crilo duck neck and head";
 root.add(smoothHead);
 // Fine silhouette around the head, tapering out through the neck.
 // Scaling the whole lathe creates a dark neckline, so only inflate the
 // upper profile and keep the shoulder/body intersection untouched.
 const headEdgeGeometry=headGeometry.clone();
 const headEdgePosition=headEdgeGeometry.getAttribute("position");
 for(let i=0;i<headEdgePosition.count;i++){
  const y=headEdgePosition.getY(i);
  const taper=THREE.MathUtils.smoothstep(y,.96,1.24);
  const cz=centerZ(y);
  headEdgePosition.setXYZ(i,
   headEdgePosition.getX(i)*(1+.065*taper),
   y+.013*taper,
   cz+(headEdgePosition.getZ(i)-cz)*(1+.055*taper));
 }
 headEdgePosition.needsUpdate=true;
 headEdgeGeometry.computeVertexNormals();
 const headOutline=new THREE.Mesh(headEdgeGeometry,outline);
 headOutline.name="Fine black silhouette around duck head";
 root.add(headOutline);
 // The Classic duck has one rounded rear tail with a pointed feather.
 // A back-face shell alone is not enough: the body intersects the tail,
 // so its dark rim disappears during side and rear turns. Keep the shell
 // AND put fine strokes right on the actual visible curved 3D surface.
 const tail=oval(root,yellow,[0,.92,-.83],[.29,.235,.28],.012);
 tail.rotation.x=-.32;
 tail.name="Rounded body of Classic duck tail";
 // A single physical curve follows the rounded bulb's silhouette as
 // viewed from any direction. Previously three fixed rings crossed each
 // other during rear spins, leaving ugly parallel stripes on the tail.
 // The ring sits on a unit sphere, which a parent group scales to match
 // the rounded ellipsoid. Rotating it in that normalized space keeps one
 // continuous fine black line without changing the duck's actual shape.
 const tailEdgeRig=new THREE.Group();
 tailEdgeRig.name="Single smoothly view-aligned tail contour";
 tailEdgeRig.scale.set(.29,.235,.28);
 tail.add(tailEdgeRig);
 const fullTailContour=new THREE.Mesh(
  new THREE.TorusGeometry(1.005,.056,10,96),line
 );
 fullTailContour.name="One complete outline around rounded duck tail";
 fullTailContour.castShadow=false;
 tailEdgeRig.add(fullTailContour);
 const tailContours=[fullTailContour];
 const tailEye=new THREE.Vector3();
 const tailNormal=new THREE.Vector3();
 const localForward=new THREE.Vector3(0,0,1);
 root.userData.updateTailContour=(camera)=>{
  if(!camera)return;
  tail.updateWorldMatrix(true,false);
  camera.getWorldPosition(tailEye);
  tail.worldToLocal(tailEye);
  tailNormal.set(
   tailEye.x/.29,tailEye.y/.235,tailEye.z/.28
  ).normalize();
  // The mesh keeps its own 3D depth test, so the body naturally hides
  // the embedded portion of the tail instead of drawing through it.
  fullTailContour.quaternion.setFromUnitVectors(localForward,tailNormal);
 };
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.21,.43,8),yellow);
 tip.rotation.x=-.48;tip.position.set(0,1.15,-.97);
 tip.castShadow=true;root.add(tip);
 // Continue the same subtle outline around the pointed feather tip.
 const tipEdge=new THREE.Mesh(new THREE.ConeGeometry(.222,.449,8),outline);
 tipEdge.rotation.copy(tip.rotation);
 tipEdge.position.copy(tip.position);
 tipEdge.name="Subtle dark tail-tip silhouette";
 root.add(tipEdge);
 // Viewed from behind, the yellow fin itself can hide its BackSide shell
 // where it intersects the bulb. Trace BOTH exposed upper slopes of the
 // pointed feather on its real conical surface (not a floating 2D decal).
 // The lower ends sink into the rounded tail, leaving one continuous crest.
 const tailTopRidges=[];
 for(const sign of [-1,1]){
  const ridgePoints=[0,.18,.40,.63,.82].map(t=>{
   const radius=.21*t;
   return new THREE.Vector3(
    sign*(radius*.96+.002),
    .215-.43*t,
    -radius*.28-.006
   );
  });
  const ridge=new THREE.Mesh(
   new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePoints),
    24,.009,6,false),
   line
  );
  ridge.name=sign<0?"Left black upper tail-feather edge":
   "Right black upper tail-feather edge";
  ridge.castShadow=false;
  tip.add(ridge);
  tailTopRidges.push(ridge);
 }
 // Wide, flattened orange top bill and thinner lower bill, facing +Z.
 const upper=oval(root,billOrange,[0,1.18,.75],[.285,.078,.22],.018);
 upper.rotation.x=-.07;
 oval(root,billOrange,[0,1.12,.76],[.245,.049,.165],.012);
 lineTube([[-.225,1.114,.84],[0,1.105,.94],[.225,1.114,.84]],line,.011);
 // Two small dark dot eyes (same black-brown as Classic SVG), with tiny
 // reflections. They remain readable when spinning or stationary.
 const walkLegs=[];
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
  // Dot eyes sit just in front of the curved forehead, not buried inside
  // the neck. When stationary, BOTH eyes and the bill face the player.
  oval(root,line,[sign*.205,1.375,.711],[.053,.054,.045],0);
  oval(root,shine,[sign*.195,1.391,.750],[.014,.014,.009],0);
  // Keep the leg, dark outline, paddle and toes attached to one hip.
  // The pivot is still during the main finale, then swings naturally
  // when this SAME duck waddles away after laying the egg.
  const hip=new THREE.Group();
  hip.position.set(sign*.22,.41,.085);
  root.add(hip);walkLegs.push(hip);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.026,.034,.36,12),footBrown);
  leg.position.set(0,-.16,0);
  leg.castShadow=true;hip.add(leg);
  const legEdge=new THREE.Mesh(
   new THREE.CylinderGeometry(.035,.043,.365,12),outline);
  legEdge.position.copy(leg.position);
  legEdge.name="Fine dark duck-leg silhouette";
  hip.add(legEdge);
  const foot=oval(hip,footBrown,[0,-.315,.105],[.155,.06,.205],.012);
  foot.rotation.y=sign*.08;
  for(const dx of [-.075,0,.075])
   oval(hip,footBrown,[dx,-.34,.24],[.045,.04,.072],.008);
 }
 // Quieter chest scallop hints at the original hand-drawn outline without
 // inventing a hat, crown, logo or changing the mascot's palette.
 lineTube([[-.17,.72,.488],[0,.67,.54],[.17,.72,.488]],wingLine,.014);
 // Hold exactly FACE-ON to the camera during every still cue.
 // Previously the model was permanently rotated 1.12 radians, so even
 // when the spin animation stopped it remained conspicuously sideways.
 // When the music says spin, the same unmodified model rotates about Y.
 root.rotation.y=0;
 root.scale.setScalar(.85); // deliberately smaller than the former tabby
 root.userData.headOutline=true;
 root.userData.toeOutline=true;
 root.userData.tailOutline=true;
 root.userData.tailContours=tailContours;
 root.userData.tailTopRidges=tailTopRidges;
 root.userData.tailTopRidgeCount=tailTopRidges.length;
 root.userData.completeTailContourCount=tailContours.length;
 root.userData.legOutline=true;
 root.userData.walkLegs=walkLegs;
 root.userData.materialPalette={
  body:"#ffe076",beak:"#f7ab67",outline:"#453b35",feet:"#c88a58"
 };
 return root;
}
