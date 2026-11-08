/* Nothing Here completion spectacle: a REAL 3D grey tabby, animated lights
 * and scene transitions timed to the user's 134.699-second reference.
 * No frames, audio or copyrighted music are copied from that recording.
 * HD tabby GLB: 3DAssets.dev CC0-1.0, asset 28146/v1 (15,282 triangles).
 */
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {CAT_REFERENCE_DURATION,sceneAt,motionAt,CAT_MUSIC_BPM} from "./secrets-3d-finale-timeline.js?v=1";

export {CAT_REFERENCE_DURATION} from "./secrets-3d-finale-timeline.js?v=1";
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
 return new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uScene:{value:0},uAspect:{value:1}},
  depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:`
   varying vec2 vUv;
   void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}
  `,
  fragmentShader:`
   uniform float uTime,uScene,uAspect;
   varying vec2 vUv;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float stars(vec2 p){
    vec2 cell=floor(p),f=fract(p)-.5;
    float sparkle=step(.981,hash(cell));
    return sparkle*pow(1.0-smoothstep(.02,.28,length(f)),2.0);
   }
   void main(){
    vec2 p=(vUv-.5)*vec2(uAspect,1.0);
    float t=uTime;
    vec3 color=vec3(.02);
    if(uScene<.5){
     color=mix(vec3(.025,.75,.025),vec3(.028,1.0,.014),.52+.15*sin(t*.9));
    }else if(uScene<1.5){
     float r=length(p);
     float cloud=sin(p.x*6.0+t*.22)*sin(p.y*5.8-t*.27);
     cloud+=.6*sin(p.x*17.0+p.y*10.0-t*.17);
     color=mix(vec3(.035,.018,.09),vec3(.68,.045,.16),clamp((cloud+.8)*.40,0.0,1.0));
     color+=vec3(.40,.13,.06)*exp(-r*3.2);
     color+=vec3(1.,.77,.80)*stars(vUv*vec2(70.,46.));
    }else if(uScene<2.5){
     float r=length(p)+.018;
     float a=atan(p.y,p.x);
     float tunnel=pow(.5+.5*cos(12.0*log(r)+t*5.8),8.0);
     float beams=pow(.5+.5*cos(a*8.0+sin(t*.7)),13.0);
     float grid=pow(.5+.5*cos(42.0/r+t*4.0),10.0);
     vec3 neon=mix(vec3(.03,.24,.99),vec3(1.,.025,.66),.5+.5*sin(a*3.0+t*.8));
     color=vec3(.015,.012,.09)+neon*(tunnel*.75+grid*.19+beams*.60);
     color+=vec3(.35,.65,1.)*exp(-r*9.0);
    }else if(uScene<3.5){
     float fog=.10*sin(p.x*12.+t*.55)*sin(p.y*13.-t*.6);
     color=vec3(.91,.94,.98)+fog;
    }else if(uScene<4.5){
     float r=length(p);
     float rays=pow(.5+.5*cos(atan(p.y,p.x)*18.+t*.18),14.);
     color=vec3(.014,.025,.15)+vec3(.07,.22,.64)*(1.-smoothstep(0.,.9,r));
     color+=vec3(.30,.43,.96)*rays*(1.-smoothstep(.0,1.0,r));
     color+=vec3(.75,.76,.99)*stars(vUv*vec2(85.,55.));
    }else if(uScene<5.5){
     // One-beat black strobe before the green-screen return.
     color=vec3(.0007,.0008,.001);
    }else if(uScene<6.5){
     // Cold translucent portal on chalk-white background.
     float radius=length(p);
     float ring=exp(-pow((radius-.39-.025*sin(t*1.3))*15.,2.));
     color=vec3(.90,.93,.98)+.07*sin(p.x*12.+t)*sin(p.y*11.-t);
     color+=vec3(.03,.4,.7)*ring*.22;
    }else{
     // Fast rainbow tunnel and kaleidoscopic panels for the last drops.
     float a=atan(p.y,p.x),r=length(p)+.009;
     float rings=pow(.5+.5*cos(11.*log(r)+t*8.),7.);
     float spokes=pow(.5+.5*cos(a*12.-t*1.4),16.);
     float pulses=.5+.5*sin(t*15.);
     color=vec3(.03,.01,.08)+
      vec3(.96,.07,.55)*(rings*.48+spokes*.62)+
      vec3(.1,.69,.98)*(rings*.45+spokes*.2)*pulses;
     color+=vec3(.95,.85,.15)*pow(.5+.5*cos(a*6.+t),15.)*.45;
    }
    gl_FragColor=vec4(clamp(color,0.,1.),1.);
   }
  `
 });
}
function phaseAt(t){return sceneAt(t).scene;}
export function createFinaleCatShow({scene,stage,invalidate}){
 let initialized=false,playing=false,modelLoaded=false,raf=0;
 let startTime=0,lastPaint=0,elapsed=0,source="procedural";
 let group,spinner,modelContainer,background,shader,key,rim;
 let fallback=null,loadedModel=null;
 const loadCat=()=>{
  if(modelLoaded)return;
  modelLoaded=true;
  const install=(gltf,kind)=>{
   const cat=gltf.scene,box=new THREE.Box3().setFromObject(cat);
   if(box.isEmpty())return;
   const size=box.getSize(new THREE.Vector3());
   cat.scale.setScalar(2.10/Math.max(.01,size.y));
   const scaled=new THREE.Box3().setFromObject(cat);
   const center=scaled.getCenter(new THREE.Vector3());
   cat.position.set(-center.x,-scaled.min.y,-center.z);
   cat.traverse(child=>{
    if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}
   });
   spinner.add(cat);loadedModel=cat;
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
  spinner=new THREE.Group();group.add(spinner);
  fallback=fallbackCat();spinner.add(fallback);
  key=new THREE.PointLight(0xfff1dd,5.0,9);key.position.set(-2,3,4);
  rim=new THREE.PointLight(0x80bcff,5.5,10);rim.position.set(2,1,-2);
  group.add(key,rim);
  loadCat();
 }
 function paint(t){
  elapsed=clip(t,0,CAT_REFERENCE_DURATION);
  const p=phaseAt(elapsed);
  shader.uniforms.uTime.value=elapsed;
  shader.uniforms.uScene.value=p;
  shader.uniforms.uAspect.value=Math.max(.5,stage.clientWidth/Math.max(1,stage.clientHeight));
  const motion=motionAt(elapsed);
  // Ethel's upright/front pose and sideways loaf shape alternate on an
  // eight-beat, 150 BPM cycle. Motion comes from the SAME audio clock as
  // the displayed soundtrack rather than an unrelated 2.6s oscillator.
  spinner.rotation.order="YXZ";
  spinner.rotation.y=motion.spinRadians;
  spinner.rotation.x=motion.rollRadians;
  spinner.rotation.z=motion.tiltRadians;
  spinner.scale.setScalar(motion.scale);
  // The unfolded T is a horizontal platform at y≈-1.61. The cat's feet
  // remain immediately above it, so the two are composed as one scene.
  group.position.set(0,-1.44+motion.bob,.45);
  const white=p===0||p===3||p===6;
  key.color.setHex(p===1?0xff728f:p===2||p===7?0xffb0ec:p===4?0x9ccfff:0xfff5e9);
  rim.color.setHex(p===1?0xff243c:p===2||p===7?0x2acaff:p===4?0x426bff:0xbed5ff);
  key.intensity=white?4.1:4.5+motion.pulse*1.5;
  rim.intensity=white?3.8:5.0+motion.pulse*1.8;
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
  restore(){stop();show(CAT_REFERENCE_DURATION);},
  onResize(){if(initialized&&group.visible)paint(elapsed)},
  getState(){return {
   visible:!!group?.visible,dancing:playing,
   durationSeconds:CAT_REFERENCE_DURATION,
   bpm:CAT_MUSIC_BPM,
   motion:motionAt(elapsed),
   platformUnderCat:true,
   elapsedSeconds:+elapsed.toFixed(2),
   catSource:source,
   meshCount:spinner?(()=>{let n=0;spinner.traverse(o=>{if(o.isMesh&&o.visible)n++});return n})():0,
   backdrop:initialized?phaseAt(elapsed):null,
   real3D:!!spinner,
   loadedModel:!!loadedModel
  }}
 };
}
