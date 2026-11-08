/* Nothing Here completion spectacle: a REAL 3D grey tabby, animated lights
 * and scene transitions timed to the user's 134.699-second reference.
 * No frames, audio or copyrighted music are copied from that recording.
 * HD tabby GLB: 3DAssets.dev CC0-1.0, asset 28146/v1 (15,282 triangles).
 */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {CAT_REFERENCE_DURATION,sceneAt,motionAt,CAT_MUSIC_BPM} from "./secrets-3d-finale-timeline.js?v=4";
import {makeSpinningLoaf} from "./secrets-3d-finale-loaf.js?v=1";

export {CAT_REFERENCE_DURATION} from "./secrets-3d-finale-timeline.js?v=4";
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
   uReferenceLuma:{value:.5},uGreenPale:{value:0}},
  depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`
   varying vec2 vUv;
   void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}
  `,
  fragmentShader:`
   uniform float uTime,uScene,uAspect,uBeat,uFlash,uSideways;
   uniform float uReferenceLuma,uGreenPale;
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
     // Psytrance tunnel: blue/cyan shafts, magenta lightbars and a bright
     // spinning centre that rushes towards camera on every musical beat.
     float twist=a+.25*sin(r*13.-t*2.3);
     float v=log(max(r,.025));
     float tunnel=pow(.5+.5*cos(v*15.+t*11.),5.);
     float spokes=pow(.5+.5*cos(twist*10.+t*1.1),23.);
     float laser=pow(.5+.5*cos(twist*18.-t*.9),45.);
     float rail=pow(.5+.5*cos(p.x*17.+p.y*8.+t*3.),18.);
     vec3 base=mix(vec3(.018,.033,.19),vec3(.07,.26,.85),
       clamp(.6+.4*sin(t*.8+r*4.),0.,1.));
     vec3 light=vec3(.08,.75,1.)*(spokes*.8+tunnel*.28)+
       vec3(1.,.055,.81)*(laser*.85+rail*.16);
     light+=vec3(.8,.48,1.)*tunnel*.38;
     light+=vec3(.87,.91,1.)*exp(-r*6.5)*(.45+.55*uBeat);
     // Source frame 34s: a deep perspective corridor with two enormous
     // angular WHITE side gates, not a circular white vortex.
     float square=max(abs(p.x)*.82,abs(p.y)*1.36);
     float boxRails=pow(.5+.5*cos(log(max(.025,square))*15.5+t*8.0),20.);
     float gate=exp(-pow((abs(p.x)-.48)*27.,2.))*
      (1.-smoothstep(.29,.52,abs(p.y)));
     float gateAura=exp(-pow((abs(p.x)-.48)*10.,2.))*
      (1.-smoothstep(.25,.63,abs(p.y)));
     vec3 burst=vec3(.80,.91,1.)*gate*2.10+
      vec3(.95,.17,.98)*gateAura*.65+
      vec3(.21,.78,1.)*boxRails*.70;
     color=base+light*.75+burst;
     color+=vec3(.46,.70,1.)*exp(-r*3.6)*(.25+.45*uBeat);
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
     // The source video's later sections have intense multi-coloured
     // kaleidoscopic stars: make them visible even on mobile displays.
     float arms=pow(.5+.5*cos(a*12.+sin(t*.6)*1.9),13.);
     float bands=pow(.5+.5*cos(log(max(r,.025))*17.+t*13.),7.);
     float sparkle=pow(.5+.5*cos(a*33.-t*2.9),21.);
     vec3 neon=palette(a/6.28318*3.+t*.12);
     color=vec3(.008,.006,.04)+
       neon*(arms*.9+bands*.85)+
       vec3(1.,.15,.82)*sparkle*.68+
       vec3(.8,.94,1.)*exp(-r*4.)*(.35+.45*uBeat);
     color+=stars(uv*vec2(100.,68.),4.)*vec3(1.,.72,.98);
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
     // Frames 48s and 123s: a DARK circular psychedelic mandala.
     // Violet, fuchsia and lime tessellated rings surround a black core;
     // the previous pink rectangle was the wrong silhouette entirely.
     float angle=a+.10*sin(t*.55+r*17.);
     float oct=max(abs(p.x),abs(p.y));
     float inner=exp(-pow((r-.29-.018*sin(angle*12.+t*.8))*30.,2.));
     float outer=exp(-pow((r-.46-.03*sin(angle*16.-t*.6))*16.,2.));
     float petal=pow(.5+.5*cos(angle*12.+t*.36),9.);
     float teeth=pow(.5+.5*cos(angle*26.-r*22.+t*.8),13.);
     float weave=pow(.5+.5*cos(log(max(r,.02))*21.+angle*7.+t*2.),8.);
     float arch=exp(-pow((r-.63)*11.,2.));
     float filigree=pow(.5+.5*cos(angle*18.+sin(r*32.)*1.6),12.);
     color=vec3(.003,.002,.013)+
      vec3(.58,.006,.40)*inner*(.75+.4*teeth)+
      vec3(.24,.04,.68)*outer*(.65+.55*weave)+
      vec3(.08,.64,.09)*outer*(petal*.90+teeth*.30)+
      vec3(.21,.008,.23)*arch*(.5+filigree*.6)+
      vec3(.13,.03,.38)*exp(-r*4.)*.22;
     color+=vec3(.45,.04,.23)*stars(uv*vec2(125.,82.),3.)*.38;
    }else if(uScene<10.5){
     // Blue/pink luminous digital-star walls and light rays, 51–59s.
     vec2 grid=uv*vec2(145.,79.);
     float n=noise(grid*.4+vec2(t*.30,-t*.34));
     float dots=pow(.5+.5*cos(uv.x*450.+.6*sin(t+uv.y*12.)),22.);
     dots*=pow(.5+.5*cos(uv.y*200.-t*5.),26.);
     float pixels=step(.90,n)*(.6+.4*sin(t*6.+uv.x*27.));
     float rays=pow(.5+.5*cos(a*12.-t*.8),18.);
     color=vec3(.014,.012,.084)+
      vec3(.06,.42,.94)*(pixels*.57+fbm(uv*17.)*.45)+
      vec3(.92,.04,.62)*(dots*.96+fbm(uv*31.+t*.08)*.27)+
      vec3(.88,.83,1.)*rays*exp(-r*1.8)*(.45+.4*uBeat);
     color+=stars(uv*vec2(160.,98.),3.5)*vec3(.55,.84,1.);
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
    // Every big drop has a white-screen flash, like the reference edit.
    // The cat is lit separately so these are actual light events, not
    // barely perceptible shader hue changes.
    color=mix(color,vec3(1.),clamp(uFlash,0.,1.));
    gl_FragColor=vec4(clamp(color,0.,1.),1.);
   }
  `
 });
}
function phaseAt(t){return sceneAt(t).scene;}
export function createFinaleCatShow({scene,stage,invalidate,reducedMotion=false}){
 const reduceEffects=!!reducedMotion||
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
 let initialized=false,playing=false,modelLoaded=false,raf=0;
 let startTime=0,lastPaint=0,elapsed=0,source="procedural";
 let group,spinner,standingRoot,loafRoot,background,shader,key,rim,flashLight;
 let fallback=null,loadedModel=null;
 const loadCat=()=>{
  if(modelLoaded)return;
  modelLoaded=true;
  const install=(gltf,kind)=>{
   const cat=gltf.scene;
   // The CC0 GLB has a rigid, vertical tail extending far above its ears.
   // That extra height made the actual reference cat tiny, and cropped the
   // tail at the top edge. In the source the tail is tucked behind the body.
   // Deform ONLY rear, high vertices of the grey coat BEFORE normalizing
   // the standing cat; ears, eyes, paws and original UV texture stay intact.
   cat.traverse(child=>{
    if(!child.isMesh||child.name!=="domestic-shorthair_1")return;
    const geometry=child.geometry.clone();
    const positions=geometry.attributes.position;
    if(!positions||!child.scale.y||!child.scale.z)return;
    let tucked=0;
    for(let i=0;i<positions.count;i++){
     const y=positions.getY(i)*child.scale.y+child.position.y;
     const z=positions.getZ(i)*child.scale.z+child.position.z;
     if(y<=.345||z>=-.025)continue;
     const lowered=.345+(y-.345)*.055;
     positions.setY(i,(lowered-child.position.y)/child.scale.y);
     tucked++;
    }
    if(tucked){positions.needsUpdate=true;
     geometry.computeVertexNormals();
     geometry.computeBoundingBox();
     geometry.computeBoundingSphere();
     child.geometry=geometry;}
   });
   const box=new THREE.Box3().setFromObject(cat);
   if(box.isEmpty())return;
   const size=box.getSize(new THREE.Vector3());
   const scale=2.10*1.75/Math.max(.01,size.y);
   // GLB nose/eyes have +Z coordinates. Its unrotated orientation ALREADY
   // faces the game camera! The previous -90deg yaw showed only its side.
   // Bigger torso / shorter legs bring it closer to Ethel's stocky build.
   cat.rotation.y=0;
   cat.scale.set(scale*1.38,scale*.82,scale*1.20);
   const scaled=new THREE.Box3().setFromObject(cat);
   const center=scaled.getCenter(new THREE.Vector3());
   cat.position.set(-center.x,-scaled.min.y,-center.z);
   cat.traverse(child=>{
    if(!child.isMesh)return;
    child.castShadow=true;child.receiveShadow=true;
    const refine=material=>{
     if(!material)return material;
     const copy=material.clone();
     if(copy.color)copy.color.multiply(new THREE.Color(0xead6c8)).multiplyScalar(.79);
     if("roughness" in copy)copy.roughness=.93;
     if("metalness" in copy)copy.metalness=0;
     if("envMapIntensity" in copy)copy.envMapIntensity=.3;
     return copy;
    };
    child.material=Array.isArray(child.material)?
     child.material.map(refine):refine(child.material);
   });
   standingRoot.add(cat);loadedModel=cat;
   if(fallback)fallback.visible=false;
   source=kind;invalidate();
  };
  const remoteBackup=()=>{
   new GLTFLoader().load(CAT_MODEL_BACKUP,
    gltf=>install(gltf,"cc0-hd-tabby-cdn"),undefined,()=>{
     source="procedural-fallback";invalidate();
    });
  };
  // Load the actual textured 15k-face feline shipped in the repo first,
  // retaining a public-domain remote backup for stale Pages caches.
  new GLTFLoader().load(CAT_MODEL_URL,
   gltf=>install(gltf,"cc0-hd-tabby-local"),undefined,remoteBackup);
 };
 function ensure(){
  if(initialized)return;
  initialized=true;
  shader=backdropMaterial();
  background=new THREE.Mesh(new THREE.PlaneGeometry(2,2),shader);
  background.renderOrder=-1000;background.frustumCulled=false;
  background.visible=false;scene.add(background);
  group=new THREE.Group();group.visible=false;scene.add(group);
  spinner=new THREE.Group();
  spinner.position.y=.75; // pivot at the middle of the feline, NOT its feet
  group.add(spinner);
  standingRoot=new THREE.Group();
  standingRoot.name="Standing 3D tabby — foreground, not spinning";
  standingRoot.position.y=-.75; // keep standing feet on the puzzle platform
  spinner.add(standingRoot);
  fallback=fallbackCat();standingRoot.add(fallback);
  loafRoot=makeSpinningLoaf();
  // The compact spinning cat must be a main subject, not a tiny distant
  // pebble above the huge T. Enlarge relative to the puzzle and rotate
  // about the loaf's physical centre.
  loafRoot.scale.setScalar(1.75);
  loafRoot.position.y=-.525;
  spinner.add(loafRoot);
  loafRoot.visible=false;
  key=new THREE.PointLight(0xfff1dd,1.8,10);key.position.set(-2,4,4);
  rim=new THREE.PointLight(0x80bcff,1.15,10);rim.position.set(2,2,-2);
  flashLight=new THREE.PointLight(0xffffff,0,13);
  flashLight.position.set(0,3,4);
  group.add(key,rim,flashLight);
  loadCat();
 }
 function paint(t){
  elapsed=clip(t,0,CAT_REFERENCE_DURATION);
  const p=phaseAt(elapsed);
  const motion=motionAt(elapsed);
  shader.uniforms.uTime.value=elapsed;
  shader.uniforms.uScene.value=p;
  shader.uniforms.uAspect.value=Math.max(.5,stage.clientWidth/Math.max(1,stage.clientHeight));
  shader.uniforms.uBeat.value=motion.beatPulse;
  shader.uniforms.uFlash.value=reduceEffects?0:motion.flash;
  shader.uniforms.uSideways.value=motion.sideways;
  shader.uniforms.uReferenceLuma.value=motion.referenceLuma;
  shader.uniforms.uGreenPale.value=motion.greenPale;
  // The reference has TWO physically different silhouettes: a full tabby
  // standing still and a compact cat loaf spinning like a wheel in the
  // SCREEN plane. Rotating the standing cat around Y was the main defect.
  const loaf=motion.poseMode==="loaf"&&!reduceEffects;
  standingRoot.visible=!loaf;
  loafRoot.visible=loaf;
  // Frame-by-frame reference: the compact silhouette remains horizontal
  // while its BACK, SIDES and underside rotate around the cat's long X
  // axis. This is a BARREL ROLL, not an image-plane Z-axis pinwheel.
  // Neon sections occasionally turn end-on, as in the 34s/41s tunnel.
  const intense=[2,7,9,10].includes(motion.scene);
  const origin=elapsed>=106?108:34;
  const yaw=intense?
   1.03*Math.cos((elapsed-origin)*1.70):
   .11*Math.sin(elapsed*2.2);
  spinner.rotation.order="YXZ";
  spinner.rotation.x=loaf?motion.spinRadians:0;
  spinner.rotation.y=loaf?yaw:0;
  spinner.rotation.z=loaf?.055*Math.sin(elapsed*2.4):0;
  spinner.scale.setScalar((loaf?1.13:1)*motion.photoScale);
  // A meaningful head-and-body flip: when it stops, the actual standing
  // model returns in the SAME forward-facing pose as the source edit.
  // The real hinged T lies on the world XZ plane at approximately y=0
  // after its cube pivot is pitched -90 degrees. Keep the cat's paws just
  // ABOVE that surface and its raised puzzle hardware (rather than through
  // the platform or behind it), with each beat providing a subtle bounce.
  group.position.set(0,.23+(reduceEffects?0:motion.bob),-.3);
  const white=p===0||p===3||p===6;
  key.color.setHex(p===1?0xffb692:p===2||p===7?0xffc0ec:p===4?0xaddbff:0xfff2e6);
  rim.color.setHex(p===1?0xff4966:p===2||p===7?0x20bfff:p===4?0x4d75ff:0xb6d5ff);
  // Restore fur markings that the previous 4–7x lights bleached away.
  key.intensity=white?1.45:1.65+motion.pulse*.8;
  rim.intensity=white?.85:1.15+motion.pulse*.75;
  flashLight.intensity=reduceEffects?0:motion.flash*5.4;
  invalidate();
 }
 function tick(now){
  if(!playing)return;
  if(now-lastPaint>=1000/30){
   lastPaint=now;
   // Read HTMLAudioElement.currentTime when the licensed recording plays.
   // Falling back to performance.now keeps the original soundtrack working.
   const audioT=window.NothingHereAudio?.getFinaleClock?.();
   paint(Number.isFinite(audioT)?audioT:(now-startTime)/1000);
  }
  if(elapsed>=CAT_REFERENCE_DURATION-.05||now-startTime>=CAT_REFERENCE_DURATION*1000+500){
   playing=false;raf=0;paint(CAT_REFERENCE_DURATION);
  }else raf=requestAnimationFrame(tick);
 }
 function show(t=0){
  ensure();
  group.visible=true;background.visible=true;
  paint(t);
 }
 function start(){
  stop();
  show(0);
  playing=true;
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
  // Available only on local CI servers, never as an endgame skip for players.
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
  onResize(){if(initialized&&group.visible)paint(elapsed)},
  getState(){return {
   visible:!!group?.visible,dancing:playing,
   durationSeconds:CAT_REFERENCE_DURATION,
   bpm:CAT_MUSIC_BPM,
   motion:motionAt(elapsed),
   platformUnderCat:true,
   referencePose:motionAt(elapsed).spinMode,
   flash:motionAt(elapsed).flash,
   reducedEffects:reduceEffects,
   frontFacingTabby:true,
   realisticCatFacingAxis:"+Z",
   standingAndLoafScaleCorrected:true,
   volumetricLoaf:!!loafRoot,
   active3DPose:reduceEffects?"front":motionAt(elapsed).poseMode,
   rendered3DPose:loafRoot?.visible?"loaf":standingRoot?.visible?"front":"none",
   actualRotations:spinner?{
    x:+spinner.rotation.x.toFixed(4),
    y:+spinner.rotation.y.toFixed(4),
    z:+spinner.rotation.z.toFixed(4)
   }:null,
   stageScene:shader?.uniforms.uScene.value??null,
   stageFrameLuma:shader?.uniforms.uReferenceLuma.value??null,
   referenceFrameLuma:motionAt(elapsed).referenceLuma,
   totalReferencePoseCuts:41,
   elapsedSeconds:+elapsed.toFixed(2),
   catSource:source,
   meshCount:spinner?(()=>{let n=0;spinner.traverse(o=>{if(o.isMesh&&o.visible)n++});return n})():0,
   backdrop:initialized?phaseAt(elapsed):null,
   real3D:!!spinner,
   loadedModel:!!loadedModel
  }}
 };
}
