/* Nothing Here: analyzed 134.699s W&W cat-video timeline.
 * Reference was inspected every two seconds (plus transitions), and the
 * accompanying 134.661s recording establishes a 150 BPM, 0.4s beat grid.
 * The model and effects remain original realtime Three.js geometry: no
 * video frames are replayed. Scene cuts/pose are driven by sound position.
 */
export const CAT_REFERENCE_DURATION=134.699;
export const CAT_MUSIC_BPM=150;
export const CAT_BEAT_SECONDS=60/CAT_MUSIC_BPM;
export const CAT_SPIN_BEATS=8; // one revolution every two 4/4 bars
// [start time, aesthetic, overlay tint, pulse]. Order matches the actual clip.
export const CAT_SCENES=[
 [0.0,  "green",      0,0.40],
 [27.45,"nebula",     1,0.75],
 [33.3, "tunnel",     2,1.00],
 [42.0, "kaleidoscope",7,1.00],
 [47.4, "laser",      2,1.00],
 [59.35,"white",      3,0.30],
 [63.5, "redstars",   1,0.80],
 [75.5, "bluerays",   4,0.80],
 [79.5, "black",      5,0.10],
 [81.2, "green",      0,0.40],
 [87.55,"ice",        6,0.55],
 [93.85,"white",      3,0.25],
 [101.8,"redstars",   1,0.50],
 [107.3,"tunnel",     2,1.00],
 [119.4,"kaleidoscope",7,1.00],
 [131.5,"white",      3,0.25],
 [134.699,"white",    3,0]
];
const clip=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=(a,b,t)=>{
 const x=clip((t-a)/(b-a),0,1);return x*x*(3-2*x);
};
export function sceneAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION);
 let i=CAT_SCENES.length-1;
 while(i>0&&t<CAT_SCENES[i][0])i--;
 return {
  name:CAT_SCENES[i][1],scene:CAT_SCENES[i][2],
  pulse:CAT_SCENES[i][3],start:CAT_SCENES[i][0],
  end:CAT_SCENES[Math.min(i+1,CAT_SCENES.length-1)][0],
  index:i
 };
}
export function motionAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION),spin=CAT_SPIN_BEATS*CAT_BEAT_SECONDS;
 const beat=(t-.38)/CAT_BEAT_SECONDS,beatPhase=(beat%1+1)%1;
 // This video alternates between the recognizable upright Ethel and a
 // sideways/loaf-like silhouette on alternating beats. A simple Y-axis
 // rotation missed that defining movement.
 const phase=(t%spin)/spin;
 const fall=smooth(.29,.48,phase),stand=smooth(.76,.95,phase);
 const sideways=fall*(1-stand);
 const scene=sceneAt(t);
 const excitation=Math.pow(Math.max(0,Math.cos(beatPhase*Math.PI*2)),5);
 const beatBounce=excitation*(scene.pulse*.09);
 const intensity=scene.pulse;
 const drop=scene.name==="tunnel"||scene.name==="laser"||scene.name==="kaleidoscope";
 const cycle=t/spin;
 return {
  spinRadians:2*Math.PI*cycle,
  rollRadians:(Math.PI*.42)*sideways,
  tiltRadians:(sideways*.18*Math.sin(t*2.6))+
    (drop?.09*Math.sin(t*5.3):.03*Math.sin(t*2.3)),
  bob:beatBounce+.025*Math.sin(t*5.7),
  scale:1+excitation*.06*intensity,
  sideways,beatPhase,beatIndex:Math.max(0,Math.floor(beat)),
  scene:scene.scene,sceneName:scene.name,sceneIndex:scene.index,
  pulse:scene.pulse,sceneStart:scene.start,sceneEnd:scene.end
 };
}
