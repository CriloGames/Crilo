/* Nothing Here completion spectacle: a REAL 3D grey tabby, animated lights
 * and scene transitions timed to the user's 134.699-second reference.
 * No frames, audio or copyrighted music are copied from that recording.
 * HD tabby GLB: 3DAssets.dev CC0-1.0, asset 28146/v1 (15,282 triangles).
 */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {CAT_REFERENCE_DURATION,sceneAt,motionAt,CAT_MUSIC_BPM} from "./secrets-3d-finale-timeline.js?v=6";

export {CAT_REFERENCE_DURATION} from "./secrets-3d-finale-timeline.js?v=6";
const CAT_MODEL_URL="assets/nothing-here/cat-tabby.glb?v=1";
const CAT_MODEL_BACKUP="https://cdn.3dassets.dev/assets/28146/v1/model.glb";
const TAU=Math.PI*2;
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));

function fallbackCat(){
 // Always keep a tangible 3D cat even if an external CC0 CDN is unavailable.
 const root=new THREE.Group(),fur=new THREE.MeshStandardMaterial({
  color:0x706c6c,roughness:.92,metalness:0
 }),dark=new THREE.MeshStandardMaterial({color:0x393b3b,roughness:.92}),
 pale=new THREE.MeshStandardMaterial({color:0xc1b8ac,roughness:.91}),
 eye=new THREE.MeshStandardMaterial({color:0xd8c28e,roughness:.2}),
 pupil=new THREE.MeshStandardMaterial({color:0x131713,roughness:.25});
 function ell(parent,x,y,z,a,b,c,mat){
  const o=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),mat);
  o.position.set(x,y,z);o.scale.set(a,b,c);parent.add(o);return o;
 }
 ell(root,0,.8,-.13,.53,.68,.74,fur);
 ell(root,0,1.48,.46,.47,.43,.43,fur);
 ell(root,0,1.28,.77,.31,.20,.17,pale);
 for(const x of [-.35,.35]){
  ell(root,x,.34,.32,.18,.35,.22,fur);
  ell(root,x,.16,.52,.21,.13,.23,pale);
  ell(root,x,.35,-.59,.22,.36,.21,fur);
  ell(root,x,.13,-.46,.21,.13,.23,pale);
  ell(root,x*.56,1.57,.817,.105,.10,.067,eye);
  ell(root,x*.56,1.57,.878,.036,.086,.018,pupil);
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.21,.37,3),fur);
  ear.position.set(x*.92,1.91,.40);ear.rotation.z=-x*.30;
  root.add(ear);
 }
 ell(root,0,1.42,.92,.09,.055,.03,new THREE.MeshStandardMaterial({color:0xbd858b}));
 // Rounded, striped floating tabby. The horizontal rings wrap its body.
 for(let i=0;i<9;i++){
  const angle=i*2.40, x=Math.sin(angle)*.50, z=Math.cos(angle)*.65-.13;
  const stripe=ell(root,x,.42+i*.103,z,.08,.044,.13,dark);
  stripe.rotation.z=Math.sin(angle)*.4;
 }
 const tail=new THREE.Group();tail.position.set(.35,.63,-.73);root.add(tail);
 for(let i=0;i<7;i++){
  const piece=ell(tail,Math.sin(i*.34)*.23,i*.13,-i*.04,.14,.18,.14,
   i%2?fur:dark);
  piece.rotation.z=i*.14;
 }
 return root;
}
function backdropMaterial(){
 // Full-viewport original procedural stage, keyed to exact scene cuts in the
 // supplied video. Bright, high-contrast lights (not low-key purple fog).
 return new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uScene:{value:0},uAspect:{value:1},
   uBeat:{value:0},uFlash:{value:0},uSideways:{value:0},
   uReferenceLuma:{value:.5},uGreenPale:{value:0},uVortexTravel:{value:0}},
  depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`
   varying vec2 vUv;
   void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}
  `,
  fragmentShader:`
   uniform float uTime,uScene,uAspect,uBeat,uFlash,uSideways;
   uniform float uReferenceLuma,uGreenPale,uVortexTravel;
   varying vec2 vUv;
   const float PI=3.14159265359;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
      mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
   }
   float fbm(vec2 p){
    float n=0.,a=.5;
    for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.13+vec2(3.,7.);a*=.5;}
    return n;
   }
   float stars(vec2 p,float power){
    vec2 cell=floor(p),f=fract(p)-.5;
    float h=hash(cell);
    float s=step(.972,h)*pow(1.-smoothstep(.015,.14,length(f)),power);
    return s*(.65+.35*sin(uTime*(1.+h)*1.9));
   }
   vec3 palette(float x){
    return .5+.5*cos(6.28318*(vec3(0.,.36,.72)+x));
   }
   // Project an infinite square-tube tunnel into screen space. Each dot
   // and each luminous door belongs to a deeper wall segment; the
   // logarithmic perspective makes the viewer fly through the wormhole.
   vec3 ledWormhole(vec2 p,float t,float phase){
    vec2 q=p+vec2(.065*sin(t*.76),.047*cos(t*.81))*
      exp(-length(p)*1.7);
    q+=.032*vec2(sin(q.y*8.+t*1.8),cos(q.x*8.-t*1.6));
    float wall=max(abs(q.x)*.77,abs(q.y)*1.12);
    float depth=-log(max(.009,wall));
    float horizontal=step(abs(q.y)*1.12,abs(q.x)*.77);
    float lane=mix(q.x/max(.018,abs(q.y)*1.12),
      q.y/max(.018,abs(q.x)*.77),horizontal);
    float dotX=pow(max(0.,.5+.5*cos(lane*55.+
      sin(depth*3.+t*.9)*1.1)),23.);
    float dotY=pow(max(0.,.5+.5*cos(depth*37.-t*23.)),22.);
    float dots=dotX*dotY;
    float door=pow(max(0.,.5+.5*cos(depth*12.-t*10.)),24.);
    float wire=pow(max(0.,.5+.5*cos(lane*9.+
      .35*sin(depth*4.-t*1.2))),19.);
    float farGlow=exp(-wall*9.);
    float flood=exp(-wall*2.);
    vec3 tint=palette(phase+lane*.13+depth*.062+t*.03);
    vec3 col=vec3(.005,.002,.034)+
      tint*(dots*2.45+door*(.4+.45*uBeat)+wire*.14)+
      vec3(.44,.72,1.)*farGlow*(.22+.36*uBeat)+
      vec3(.035,.025,.17)*flood;
    float forward=pow(max(0.,1.-wall*1.2),5.);
    col+=vec3(.79,.90,1.)*forward*(.12+.17*uBeat);
    return col;
   }
   // Continuous volumetric vortex: radial depth, folded light shafts
   // and advancing luminous portal rings rather than a flat LED grid.
   vec3 cinematicWormhole(vec2 p,float t,float alternate){
    vec2 q=p-vec2(.028*sin(t*.6),.025*cos(t*.43));
    float r=max(.012,length(q)),a=atan(q.y,q.x);
    float depth=1./(.16+r*2.45);
    float bend=.30*sin(a*3.+t*.3)+.14*sin(a*7.-t*.52);
    float theta=a+bend/(1.+r*3.);
    float flow=depth*9.5-t*3.8-uVortexTravel*4.2;
    float filament=pow(max(0.,.5+.5*cos(theta*18.+
      1.8*sin(flow*.63+theta*5.))),15.);
    float streak=pow(max(0.,.5+.5*cos(theta*9.+
      .6*sin(flow*.49))),10.);
    float ring=pow(max(0.,.5+.5*cos(flow*5.6)),9.);
    float second=pow(max(0.,.5+.5*cos(flow*3.8+1.4)),12.);
    float clouds=fbm(vec2(theta*2.9,flow*.16)+vec2(t*.20,-t*.18));
    float shift=.5+.5*sin(theta*4.+flow*.23+t*.3);
    vec3 blue=vec3(.026,.30,1.),pink=vec3(1.,.05,.81);
    vec3 col=mix(blue,pink,shift);
    col=mix(col,vec3(.55,.08,1.),clouds*.4);
    col*=.20+filament*1.8+streak*.56;
    col+=pink*ring*(.52+.4*uBeat)+blue*second*.58;
    col+=mix(blue,pink,.5+.5*sin(t*1.2))*
      exp(-r*7.5)*(.68+.24*uBeat);
    col=mix(col,vec3(.015,.02,.27),exp(-r*27.)*.46);
    col+=pink*smoothstep(.26,.82,r)*
      (.10+.26*pow(max(0.,sin(theta*6.-t*.7)),4.));
    col+=vec3(.45,.65,1.)*filament*
      (1.-smoothstep(.03,.95,r))*.42;
    if(alternate>.5){
     float tracer=pow(max(0.,.5+.5*cos(theta*14.-flow*.12)),10.);
     col+=vec3(.17,1.,.95)*tracer*(.25+.68*ring);
    }
    return col;
   }
   void main(){
    float t=uTime;
    vec2 p=(vUv-.5)*vec2(uAspect,1.);
    vec2 uv=vUv;
    float r=length(p),a=atan(p.y,p.x);
    vec3 color=vec3(.012);
    if(uScene<.5){
     // Actual first 27s use vivid chroma green, switching to near-white
     // mint when the cat flips into its sideways rapid rotation.
     vec3 green=vec3(.008,.97,.014);
     vec3 pale=vec3(.91,.995,.91);
     color=mix(green,pale,clamp(uGreenPale,0.,1.));
     color+=vec3(.07,.13,.0)*exp(-r*3.5)*pow(uBeat,3.);
    }else if(uScene<1.5){
     // Gold/red/pink nebula rather than the old flat maroon noise.
     vec2 q=p*2.2;
     float cloud=fbm(q*2.2+vec2(t*.11,-t*.06));
     float detail=fbm(q*5.2-vec2(t*.09,t*.06));
     float halo=exp(-r*1.95);
     vec3 warm=mix(vec3(.11,.007,.045),vec3(.96,.18,.13),
       smoothstep(.32,.83,cloud));
     warm+=vec3(.95,.62,.18)*pow(smoothstep(.45,.94,detail),2.)*.65;
     warm+=vec3(.83,.27,.64)*halo*.35;
     color=warm+stars(uv*vec2(96.,62.),3.)*vec3(1.,.91,.82);
    }else if(uScene<2.5){
     // 33–40s / 107–114s: fly THROUGH a deep blue-pink vortex.
     vec2 warped=p+vec2(.03*sin(t*.9),.04*cos(t*.7));
     color=cinematicWormhole(warped,t,0.);
     float blade=exp(-pow((abs(warped.x)-.51)*17.,2.))*
      (1.-smoothstep(.32,.70,abs(warped.y)));
     color+=vec3(1.,.96,1.)*blade*(1.45+.55*uBeat);
     color+=vec3(.32,.42,1.)*
      exp(-pow((abs(warped.x)-.51)*5.7,2.))*.30;
    }else if(uScene<3.5){
     color=vec3(.982,.986,1.);
    }else if(uScene<4.5){
     // Sapphire/ultraviolet radial laser forest.
     float beams=pow(.5+.5*cos(a*20.-t*.35),24.);
     float sweep=pow(.5+.5*cos(a*7.+t*.9),21.);
     float ring=pow(.5+.5*cos(log(max(.03,r))*22.+t*9.),7.);
     color=vec3(.014,.018,.10)+vec3(.10,.23,.83)*(1.-smoothstep(.1,1.,r));
     color+=vec3(.17,.78,1.)*(beams*.78+ring*.34);
     color+=vec3(.94,.09,.91)*sweep*.68;
     color+=stars(uv*vec2(85.,55.),4.)*vec3(.79,.86,1.);
    }else if(uScene<5.5){
     color=vec3(.001,.001,.002);
    }else if(uScene<6.5){
     float ring=exp(-pow((r-.42-.05*sin(t*1.1))*13.,2.));
     color=vec3(.91,.95,1.)+vec3(.04,.19,.34)*ring*.45;
     color+=vec3(.07,.13,.26)*(.5+.5*sin(a*13.+t))*ring*.3;
    }else if(uScene<7.5){
     // Rotating kaleidoscopic tunnel; geometric ribs rush toward camera.
     float theta=atan(p.y,p.x),rr=length(p);
     float bent=theta+.14*sin(rr*12.-t*1.1);
     vec2 folded=vec2(cos(bent)*rr,sin(bent)*rr);
     vec3 rushing=cinematicWormhole(folded,t,1.);
     float ribs=pow(max(0.,.5+.5*cos(
      7.4/(.13+rr)-t*17.+sin(bent*9.))),15.);
     float shafts=pow(max(0.,.5+.5*cos(bent*12.-
      t*.37+2.*sin(rr*7.-t))),15.);
     color=rushing*1.28+
      vec3(1.,.09,.85)*abs(sin(bent*6.+t*.19))*ribs*.83+
      vec3(.1,.81,1.)*shafts*(.22+.8*uBeat);
     color+=vec3(.84,.79,1.)*pow(ribs,2.)*pow(uBeat,2.)*.55;
    }else if(uScene<8.5){
     // Frames 63–74: thousands of pinpoint stars in a vivid pink/red
     // Milky Way with a bright asymmetric red nebula behind the tabby.
     // The old low-frequency red fog and 90x50 sparse dots were too flat.
     vec2 q=p*3.;
     float cloud=fbm(q*1.6+vec2(.13*t,-.04*t));
     float web=fbm(q*4.3-vec2(.05*t,.08*t));
     float wisps=fbm(q*10.0+vec2(-.04*t,.07*t));
     float plume=exp(-length((p-vec2(.15,.09))*vec2(1.05,1.35))*2.1);
     float mottled=smoothstep(.29,.73,cloud*.85+web*.4);
     color=vec3(.014,.001,.018)+
      vec3(.94,.012,.15)*mottled*1.28+
      vec3(.88,.10,.29)*plume*(.25+.9*wisps)+
      vec3(.33,.018,.15)*pow(web,1.6);
     float starA=stars(uv*vec2(190.,112.),1.75);
     float starB=stars(uv*vec2(300.,175.),2.1);
     float starC=stars(uv*vec2(74.,47.),1.5);
     color+=vec3(1.,.86,.95)*(starA*2.30+starB*.93)+
      vec3(1.,.72,.84)*starC*2.15;
    }else if(uScene<9.5){
     // Dark psychedelic RING / ornate wormhole, as in reference 48s
     // and 123s. A distinct circular black central eye must survive.
     float angle=a+.07*sin(t*.45+r*11.);
     float ringA=exp(-pow((r-.31-.013*sin(angle*12.+t*2.))*27.,2.));
     float ringB=exp(-pow((r-.48-.028*sin(angle*12.-t*1.))*19.,2.));
     float ringC=exp(-pow((r-.64-.034*sin(angle*18.+t*.8))*12.,2.));
     float petals=pow(max(0.,.5+.5*cos(angle*12.-t*.2)),8.);
     float teeth=pow(max(0.,.5+.5*cos(angle*32.+r*29.-t*.8)),13.);
     float tess=pow(max(0.,.5+.5*cos(angle*24.-r*19.+t*1.7)),14.);
     float core=1.-smoothstep(.20,.32,r);
     color=vec3(.002,.001,.009)+
      vec3(.77,.015,.59)*ringA*(.56+.75*teeth)+
      vec3(.06,.93,.09)*ringB*(.48+petals*.87)+
      vec3(.23,.044,.66)*ringC*(.60+.7*tess)+
      vec3(.32,.017,.39)*petals*ringB*.31+
      vec3(.06,.18,.75)*exp(-pow((r-.36)*17.,2.))*.35;
     color=mix(color,vec3(.001,.001,.004),core*.92);
    }else if(uScene<10.5){
     // Digital hyperdrive: a deep square tunnel overlaid with neon
     // circuitry and pixel glitter, moving through the screen.
     vec3 rush=ledWormhole(p,t,.53);
     vec2 grid=uv*vec2(135.,81.);
     float pixel=step(.87,noise(floor(grid*.43)+vec2(t*.51,-t*.3)));
     float scan=pow(max(0.,.5+.5*cos(p.y*225.-t*16.)),28.);
     float rays=pow(max(0.,.5+.5*cos(a*21.-t*.75)),24.);
     color=rush*.94+vec3(.06,.09,.31)+
       vec3(.1,.59,1.)*pixel*.63+
       vec3(.94,.045,.87)*scan*.37+
       vec3(.80,.88,1.)*rays*exp(-r*2.)*(.28+.34*uBeat);
     color+=stars(uv*vec2(188.,105.),2.2)*vec3(.55,.84,1.);
    }else if(uScene<11.5){
     // Cyan electrified portal alternating with pure-white frames.
     float warped=a+.4*sin(r*8.-t*1.5);
     float ring=exp(-pow((r-.35-.043*sin(warped*8.-t*3.))*12.,2.));
     float coils=pow(.5+.5*cos(warped*13.+20.*r-t*6.),14.);
     float jag=fbm(p*14.+vec2(t*2.,-t));
     color=vec3(.012,.026,.048)+
      vec3(.014,.38,.70)*ring*(.3+.7*coils)+
      vec3(.10,.94,1.)*ring*pow(jag,2.)*.95+
      vec3(.19,.28,.56)*exp(-r*5.)*.30;
     float shimmers=pow(.5+.5*cos(a*92.+r*18.-t*1.8),22.);
     float spokes=pow(.5+.5*cos(a*180.-t*.4),25.);
     color+=vec3(.22,.95,1.)*(ring*shimmers*.90+ring*spokes*.45);
     color+=vec3(.66,.96,1.)*stars(uv*vec2(170.,108.),3.)*.7;
    }else{
     // Gray video cut just before total-black interstitial.
     color=vec3(.68,.70,.72);
    }
    // The 1080p upload's measured background exposure follows the MP3.
    // This matters especially during one-second whiteouts / black flashes.
    if(uScene>.5&&uScene<11.8&&abs(uScene-3.)>.49)
     color*=mix(.55,1.38,clamp(uReferenceLuma,0.,1.));
    // Drive genuinely high-contrast camera-white strobes from the track.
    // Reduced-motion users receive zero flash from the caller.
    float flash=clamp(uFlash,0.,1.);
    color=mix(color,vec3(1.),flash);
    gl_FragColor=vec4(clamp(color,0.,1.),1.);
   }
  `
 });
}
function phaseAt(t){return sceneAt(t).scene;}
export function createFinaleCatShow({
 scene,stage,invalidate,reducedMotion=false,getCatAnchor,onTimelineFrame
}){
 const reduceEffects=!!reducedMotion||
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
 let initialized=false,playing=false,modelRequested=false,raf=0;
 let startTime=0,lastPaint=0,elapsed=0,source="procedural-fallback";
 let group,spinner,catRig,background,shader,key,rim,flashLight;
 let fallback=null,loadedModel=null;
 const identity="single-textured-grey-tabby";
 // The published CC0 GLB contains a separate, unrigged upright-tail
 // connected component (643 vertices) and four overly long leg components.
 // Remove ONLY the isolated tail triangles and shorten ONLY the separate
 // leg + paw components, leaving the face, whiskers, UVs and body intact.
 // This is a real mesh topology edit, not the previous destructive vertex
 // crush that distorted the animal's entire head/back silhouette.
 let anatomyRetouched=false;
 function refineCatAnatomy(cat){
  let retouched=false;
  cat.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name!=="domestic-shorthair_1")return;
   const geo=mesh.geometry.clone();
   const pos=geo.getAttribute("position"),index=geo.getIndex();
   if(!pos||!index)return;
   const roots=new Int32Array(pos.count);
   for(let i=0;i<roots.length;i++)roots[i]=i;
   const find=i=>{
    while(roots[i]!==i){
     roots[i]=roots[roots[i]];
     i=roots[i];
    }
    return i;
   };
   const unite=(a,b)=>{
    const ra=find(a),rb=find(b);
    if(ra!==rb)roots[rb]=ra;
   };
   for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    unite(a,b);unite(a,c);
   }
   const components=new Map();
   for(let i=0;i<pos.count;i++){
    const root=find(i);
    let c=components.get(root);
    if(!c){c={count:0,minY:Infinity,maxY:-Infinity,
     minZ:Infinity,maxZ:-Infinity};components.set(root,c);}
    const y=pos.getY(i),z=pos.getZ(i);
    c.count++;
    c.minY=Math.min(c.minY,y);c.maxY=Math.max(c.maxY,y);
    c.minZ=Math.min(c.minZ,z);c.maxZ=Math.max(c.maxZ,z);
   }
   const tailRoots=new Set(),legRoots=new Set(),headRoots=new Set();
   for(const [root,c] of components){
    if(c.count>150&&c.maxY>.82&&c.minZ<-.45&&
       c.maxZ<-.35&&c.minY>-.25)tailRoots.add(root);
    if(c.count>120&&c.maxY<-.10&&c.minY<-.80)
     legRoots.add(root);
    // The mesh includes two giant, round mouse-like ear lobes around
    // the top of the head. Lower the oversized upper vertex silhouettes
    // while keeping the eyes, muzzle and cheeks untouched.
    if(c.count>400&&c.count<600&&c.minZ>.28&&
       c.maxZ>.70&&c.maxY>.22)headRoots.add(root);
   }
   if(tailRoots.size!==1||legRoots.size<4)return;
   // Discard the vertical tail as a complete separate connected island.
   // Collapsing its UNUSED vertices keeps the bounding box tight.
   const keep=[];
   for(let i=0;i<index.count;i+=3){
    if(tailRoots.has(find(index.getX(i))))continue;
    keep.push(index.getX(i),index.getX(i+1),index.getX(i+2));
   }
   for(let i=0;i<pos.count;i++){
    const root=find(i);
    if(tailRoots.has(root))pos.setXYZ(i,0,-.11,-.62);
    else if(legRoots.has(root)){
     const y=pos.getY(i);
     pos.setY(i,-.15+(y+.15)*.42);
    }else if(headRoots.has(root)){
     const y=pos.getY(i);
     if(y>.12){
      // An average 30% ear-height reduction, feathered into the crown.
      pos.setY(i,.09+(y-.09)*.34);
      const x=pos.getX(i);
      if(Math.abs(x)>.075)
       pos.setX(i,Math.sign(x)*(.075+(Math.abs(x)-.075)*.64));
     }
    }
   }
   pos.needsUpdate=true;
   geo.setIndex(keep);
   geo.deleteAttribute("normal");
   geo.computeVertexNormals();
   geo.computeBoundingBox();geo.computeBoundingSphere();
   mesh.geometry=geo;
   retouched=true;
  });
  return retouched;
 }
 const loadCat=()=>{
  if(modelRequested)return;
  modelRequested=true;
  const install=(gltf,kind)=>{
   // ONE identity throughout the whole show: no loaf copy, hidden
   // standing cat, split models, or scene-timed GLB replacement.
   const cat=gltf.scene;
   anatomyRetouched=refineCatAnatomy(cat);
   const bounds=new THREE.Box3().setFromObject(cat);
   if(bounds.isEmpty())return;
   const size=bounds.getSize(new THREE.Vector3());
   const scale=2.18/Math.max(.01,size.y);
   cat.rotation.y=0; // The GLB's actual face is +Z.
   cat.scale.setScalar(scale);
   const scaled=new THREE.Box3().setFromObject(cat);
   const center=scaled.getCenter(new THREE.Vector3());
   cat.position.set(-center.x,-scaled.min.y,-center.z);
   // Preserve the real tabby texture, proportions, nose, ears and paws.
   // Removing the previous blanket recolor and tail-vertex flattening
   // prevents a muddy face and a broken back/tail silhouette.
   cat.traverse(child=>{
    if(!child.isMesh)return;
    // The source reference is a DARK tabby with a subtle chest. The
    // low-detail GLB has a giant faceted cream diamond on its front that
    // resembles a metal bib. Reveal the continuous gray body instead.
    if(child.name==="domestic-shorthair_2"){
     child.visible=false;
     return;
    }
    child.castShadow=true;
    child.receiveShadow=true;
    const fix=mat=>{
     if(!mat)return mat;
     const copy=mat.clone();
     if("roughness" in copy)copy.roughness=Math.max(.86,copy.roughness||0);
     // The source footage shows a DARK charcoal/brown mackerel tabby,
     // not the overexposed white ceramic look in earlier builds.
     if(copy.color&&child.name==="domestic-shorthair_1")
      copy.color.multiplyScalar(.60);
     if("metalness" in copy)copy.metalness=0;
     if("envMapIntensity" in copy)copy.envMapIntensity=.18;
     return copy;
    };
    child.material=Array.isArray(child.material)?
     child.material.map(fix):fix(child.material);
   });
   catRig.add(cat);
   if(fallback)fallback.visible=false;
   loadedModel=cat;
   source=kind;
   invalidate();
  };
  const remoteBackup=()=>new GLTFLoader().load(CAT_MODEL_BACKUP,
   gltf=>install(gltf,"cc0-hd-tabby-cdn"),undefined,()=>{
    source="procedural-fallback";invalidate();
   });
  new GLTFLoader().load(CAT_MODEL_URL,
   gltf=>install(gltf,"cc0-hd-tabby-local"),undefined,remoteBackup);
 };
 function ensure(){
  if(initialized)return;
  initialized=true;
  shader=backdropMaterial();
  background=new THREE.Mesh(new THREE.PlaneGeometry(2,2),shader);
  background.renderOrder=-1000;
  background.frustumCulled=false;
  background.visible=false;
  scene.add(background);
  group=new THREE.Group();
  group.visible=false;
  scene.add(group);
  spinner=new THREE.Group();
  spinner.name="One 3D cat, stationary or rotating around its own Y axis";
  spinner.position.y=.93;
  group.add(spinner);
  catRig=new THREE.Group();
  catRig.position.y=-.93;
  spinner.add(catRig);
  fallback=fallbackCat();
  catRig.add(fallback);
  key=new THREE.PointLight(0xfff0dc,1.55,14);
  key.position.set(-2.5,4.0,4.5);
  rim=new THREE.PointLight(0x9ecfff,.83,13);
  rim.position.set(2.5,2.5,-2.7);
  flashLight=new THREE.PointLight(0xffffff,0,16);
  flashLight.position.set(0,4,4);
  group.add(key,rim,flashLight);
  loadCat();
 }
 function paint(t){
  elapsed=clip(t,0,CAT_REFERENCE_DURATION);
  const motion=motionAt(elapsed);
  const p=phaseAt(elapsed);
  const spinning=motion.spinning&&!reduceEffects;
  shader.uniforms.uTime.value=elapsed;
  shader.uniforms.uScene.value=p;
  shader.uniforms.uAspect.value=Math.max(.5,stage.clientWidth/Math.max(1,stage.clientHeight));
  shader.uniforms.uBeat.value=motion.beatPulse;
  shader.uniforms.uFlash.value=reduceEffects?0:motion.flash;
  shader.uniforms.uSideways.value=spinning?1:0;
  shader.uniforms.uReferenceLuma.value=motion.referenceLuma;
  shader.uniforms.uGreenPale.value=motion.greenPale;
  const wormhole=[2,7].includes(p);
  const tunnelLocal=Math.max(0,elapsed-motion.sceneStart);
  shader.uniforms.uVortexTravel.value=wormhole?tunnelLocal:0;
  // Same cat, same actual meshes, same stripes: only its animation changes.
  spinner.rotation.order="YXZ";
  spinner.rotation.set(0,spinning?motion.spinRadians:0,0);
  // The fast spin in the supplied video is a compact, low silhouette.
  // Compress the whole single rig gently, without melting its head or
  // swapping to a second fake cylinder/loaf geometry.
  const photo=motion.photoScale;
  // One animal with ONE anatomical shape through front holds and spins;
  // the former .78x vertical squeeze produced a melted spinning silhouette.
  catRig.scale.setScalar(photo*1.08);
  const tunnelZoom=wormhole&&!reduceEffects?
   1+.17*Math.sin(tunnelLocal*1.7)+.08*Math.sin(tunnelLocal*4.8):1;
  spinner.scale.setScalar((spinning?1.06:1.09)*tunnelZoom);
  const anchor=getCatAnchor?.();
  group.position.set(
   Number.isFinite(anchor?.x)?anchor.x:0,
   (Number.isFinite(anchor?.y)?anchor.y:0)+
    (spinning?.82:.70)+(reduceEffects?0:motion.bob),
   (Number.isFinite(anchor?.z)?anchor.z:-.3)-
    (wormhole&&!reduceEffects?.45*Math.sin(tunnelLocal*1.9):0)
  );
  const white=p===0||p===3||p===6;
  key.color.setHex(p===2||p===7?0xd1dbff:p===1?0xffd8cb:
   p===8?0xffa2c2:0xfff2e6);
  rim.color.setHex(p===2||p===7?0x56caff:p===8?0xff1a80:
   p===4?0x7ba5ff:0xb6d5ff);
  key.intensity=white?1.18:1.20+motion.pulse*.74;
  rim.intensity=white?.52:.88+motion.pulse*.90;
  // Match the *cat's* actual colored light to the tunnel and flash.
  // Previously only the background changed while the fur stayed gray.
  if(wormhole&&!reduceEffects){
   const hue=.5+.5*Math.sin(elapsed*4.8);
   key.color.setRGB(1.,.10+.36*hue,.65+.30*hue);
   rim.color.setRGB(.13+.10*hue,.69+.23*(1-hue),1.);
   key.intensity=2.1+motion.beatPulse*1.4;
   rim.intensity=2.1+motion.beatPulse*1.8;
  }
  const flash=reduceEffects?0:motion.flash;
  flashLight.intensity=flash*13.;
  key.intensity+=flash*1.7;
  rim.intensity+=flash*1.5;
  // The 3D cat briefly catches the hard white strobe as in the footage.
  onTimelineFrame?.(elapsed);
  invalidate();
 }
 function tick(now){
  if(!playing)return;
  if(now-lastPaint>=1000/30){
   lastPaint=now;
   const audioT=window.NothingHereAudio?.getFinaleClock?.();
   paint(Number.isFinite(audioT)?audioT:(now-startTime)/1000);
  }
  if(elapsed>=CAT_REFERENCE_DURATION-.05||
     now-startTime>=CAT_REFERENCE_DURATION*1000+500){
   playing=false;raf=0;paint(CAT_REFERENCE_DURATION);
  }else raf=requestAnimationFrame(tick);
 }
 function show(t=0){
  ensure();
  group.visible=true;
  background.visible=true;
  paint(t);
 }
 function start(){
  stop();show(0);playing=true;
  startTime=performance.now();lastPaint=0;
  raf=requestAnimationFrame(tick);
 }
 function stop(){
  playing=false;
  if(raf)cancelAnimationFrame(raf);
  raf=0;
  if(group)group.visible=false;
  if(background)background.visible=false;
  invalidate();
 }
 return {
  start,stop,
  seekForVisualTest(t){
   if(!["localhost","127.0.0.1"].includes(window.location.hostname))
    return null;
   playing=false;
   if(raf)cancelAnimationFrame(raf);
   raf=0;
   show(clip(Number(t)||0,0,CAT_REFERENCE_DURATION));
   return this.getState();
  },
  restore(){stop();show(CAT_REFERENCE_DURATION);},
  onResize(){if(initialized&&group.visible)paint(elapsed);},
  getState(){
   const motion=motionAt(elapsed);
   const spinning=motion.spinning&&!reduceEffects;
   return {
    visible:!!group?.visible,dancing:playing,
    durationSeconds:CAT_REFERENCE_DURATION,bpm:CAT_MUSIC_BPM,
    motion,platformUnderCat:true,hoveringOverBox:true,
    spinAxis:"y",revolutionsPerSecond:motion.revolutionsPerSecond,
    catIdentity:identity,distinctCatModels:1,identitySwaps:0,
    anatomicalTailTrimmed:anatomyRetouched,
    singleModelBothPoses:true,
    catWorldPosition:group?{
     x:+group.position.x.toFixed(3),
     y:+group.position.y.toFixed(3),
     z:+group.position.z.toFixed(3)
    }:null,
    referencePose:motion.spinMode,flash:motion.flash,
    reducedEffects:reduceEffects,
    frontFacingTabby:true,realisticCatFacingAxis:"+Z",
    standingAndLoafScaleCorrected:true,
    volumetricLoaf:!!catRig, // compatibility: the spinning form is real 3D
    active3DPose:spinning?"loaf":"front",
    rendered3DPose:spinning?"loaf":"front",
    actualRotations:spinner?{
     x:+spinner.rotation.x.toFixed(4),
     y:+spinner.rotation.y.toFixed(4),
     z:+spinner.rotation.z.toFixed(4)
    }:null,
    stageScene:shader?.uniforms.uScene.value??null,
    wormholeActive:[2,7].includes(motion.scene),
    wormholeForwardTravel:shader?.uniforms.uVortexTravel.value??null,
    unifiedCatScale:+(catRig?.scale.y??0).toFixed(4),
    sourceTimedHardStrobe:motion.flash,
    stageFrameLuma:shader?.uniforms.uReferenceLuma.value??null,
    referenceFrameLuma:motion.referenceLuma,
    totalReferencePoseCuts:41,elapsedSeconds:+elapsed.toFixed(2),
    catSource:source,
    meshCount:catRig?(()=>{
     let n=0;
     catRig.traverse(o=>{if(o.isMesh&&o.visible&&o.parent?.visible!==false)n++;});
     return n;
    })():0,
    backdrop:initialized?phaseAt(elapsed):null,
    real3D:!!spinner,loadedModel:!!loadedModel
   };
  }
 };
}