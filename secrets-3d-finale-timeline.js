/* Nothing Here — Ethel-style reference motion and music-driven stage.
 * The supplied 134.699s video is the timing reference; no original frames
 * or footage are embedded. The 150 BPM soundtrack is the master clock.
 *
 * Crucial distinction from v1: the reference DOES NOT rotate a standing
 * cat continuously. It holds still, flips into a sideways spin, returns to
 * the same front-facing pose, then accelerates to beat-by-beat tumbling.
 */
export const CAT_REFERENCE_DURATION=134.699;
export const CAT_MUSIC_BPM=150;
export const CAT_BEAT_SECONDS=60/CAT_MUSIC_BPM;
export const CAT_SPIN_BEATS=8;
export const CAT_SCENES=[
 [0.00,"green",0,.48],
 [27.36,"nebula",1,.70],
 [33.29,"tunnel",2,1.00],
 [42.0,"kaleidoscope",7,1.0],
 [47.35,"laser",2,1.00],
 [59.13,"white",3,.18],
 [62.28,"redstars",1,.80],
 [75.47,"bluerays",4,.86],
 [79.50,"black",5,.12],
 [81.20,"green",0,.50],
 [87.52,"ice",6,.56],
 [93.85,"white",3,.18],
 [101.8,"redstars",1,.57],
 [107.25,"tunnel",2,1.0],
 [119.35,"kaleidoscope",7,1.0],
 [131.55,"white",3,.16],
 [134.699,"white",3,0]
];
const TAU=Math.PI*2;
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,t)=>{
 const x=clip((t-a)/(b-a),0,1);return x*x*(3-2*x);
};
const fract=x=>x-Math.floor(x);
// Precisely observed slow half-turn segments in the supplied video.
const INTRO_SPINS=[[1.37,2.81],[4.53,5.96],[7.80,9.22],
 [14.19,15.61]];
function slowSpin(t,offset=0){
 const segment=INTRO_SPINS.find(([a,b])=>t>=a&&t<b);
 if(!segment)return null;
 const [a,b]=segment,p=(t-a)/(b-a);
 // An accelerating, tilted barrel/tumble rather than an endless pirouette.
 const turn=smooth(0,1,p)*2;
 const lift=smooth(0,.14,p)*(1-smooth(.85,1,p));
 return {spinRadians:TAU*turn,sideways:.98*lift,
  spinActive:true,spinProgress:p,spinMode:"slow",spinPhaseOffset:offset};
}
function fastSpin(t,origin,rate=1){
 const localBeat=(t-origin)/CAT_BEAT_SECONDS;
 const step=Math.floor(localBeat);
 const phase=fract(localBeat);
 // A marked rotation on EVERY beat. Sudden stops and quick turns are
 // deliberate: the source uses edited front holds and loaf spins.
 const ease=smooth(.05,.82,phase);
 const turn=(step+ease)*rate/3;
 // Every fourth beat comes briefly upright, then drops into the spin.
 const upright=step%4===0?smooth(.0,.16,phase)*(1-smooth(.38,.9,phase)):0;
 const sideways=.91*(1-upright);
 return {spinRadians:TAU*turn,sideways,
  spinActive:true,spinProgress:phase,spinMode:"beat"};
}
function repeatingSpin(t,origin,hold=1.45,cycle=3.2){
 const local=(t-origin)%cycle;
 if(local<hold)return {spinRadians:0,sideways:0,
  spinActive:false,spinProgress:0,spinMode:"front"};
 const p=(local-hold)/(cycle-hold),lift=smooth(0,.15,p)*(1-smooth(.85,1,p));
 return {spinRadians:TAU*(2*smooth(0,1,p)),
  sideways:.95*lift,spinActive:true,spinProgress:p,spinMode:"slow"};
}
export function sceneAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION);
 let i=CAT_SCENES.length-1;
 while(i>0&&t<CAT_SCENES[i][0])i--;
 return {name:CAT_SCENES[i][1],scene:CAT_SCENES[i][2],
  pulse:CAT_SCENES[i][3],start:CAT_SCENES[i][0],
  end:CAT_SCENES[Math.min(i+1,CAT_SCENES.length-1)][0],
  index:i};
}
export function motionAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION);
 const scene=sceneAt(t),beat=(t-.04)/CAT_BEAT_SECONDS;
 const beatPhase=fract(beat),beatIndex=Math.max(0,Math.floor(beat));
 let pose;
 if(t<15.61)pose=slowSpin(t)||
   {spinRadians:0,sideways:0,spinActive:false,spinProgress:0,spinMode:"front"};
 else if(t<27.35)pose=fastSpin(t,15.61,1.3);
 else if(t<33.29)pose=repeatingSpin(t,27.36,1.18,2.9);
 else if(t<59.13)pose=fastSpin(t,33.29,1);
 else if(t<62.28)pose={spinRadians:0,sideways:0,
   spinActive:false,spinProgress:0,spinMode:"front"};
 else if(t<79.5)pose=repeatingSpin(t,62.28,.92,2.7);
 else if(t<81.2)pose={spinRadians:0,sideways:0,
   spinActive:false,spinProgress:0,spinMode:"hidden"};
 else if(t<87.52)pose=repeatingSpin(t,81.2,1.25,3.14);
 else if(t<101.8)pose=repeatingSpin(t,87.52,1.26,3.1);
 else if(t<107.25)pose=repeatingSpin(t,101.8,1.1,2.8);
 else if(t<131.55)pose=fastSpin(t,107.25,1);
 else pose={spinRadians:0,sideways:0,
   spinActive:false,spinProgress:0,spinMode:"front"};
 const kickPulse=Math.pow(1-beatPhase,5);
 const hiHat=Math.pow(1-fract(beat*2),9);
 const impact=scene.pulse*(.10+.9*kickPulse);
 const drop=scene.name==="tunnel"||scene.name==="laser"||
   scene.name==="kaleidoscope";
 const bright=scene.name==="green"||scene.name==="white"||scene.name==="ice";
 // Reference white-out flashes arrive on strong bar boundaries and at the
 // vertical tunnel cuts, not just as a dim color change at 2 Hz.
 const bar=Math.floor((t+.04)/1.6);
 const downbeat=fract((t+.04)/1.6);
 const barFlash=drop&&bar%2===0?
   Math.pow(Math.max(0,1-downbeat*12),3)*.91:0;
 const downbeatFlash=drop&&beatIndex%2===0?
   Math.pow(Math.max(0,1-beatPhase*12),3)*.34:0;
 const editFlash=CAT_SCENES.slice(1,-1).reduce((v,[start,name])=>
   Math.max(v,drop&&Math.abs(t-start)<.14?
     1-smooth(0,.14,Math.abs(t-start)):0),0);
 const flash=clip(Math.max(barFlash,downbeatFlash,editFlash),0,1);
 const paleFlash=scene.name==="green"&&pose.spinActive?.57:0;
 return {
  ...pose,scene:scene.scene,sceneName:scene.name,sceneIndex:scene.index,
  sceneStart:scene.start,sceneEnd:scene.end,beatIndex,beatPhase,
  bpm:CAT_MUSIC_BPM,beatPulse:kickPulse,hiHatPulse:hiHat,
  pulse:impact,flash,backdropFlash:Math.max(flash,paleFlash),
  beatBounce:kickPulse*scene.pulse*.095,
  rollRadians:pose.sideways*Math.PI*.46,
  tiltRadians:pose.sideways*.14*Math.sin(t*4.8)+
   (drop?.07*Math.sin(t*5.5):0),
  bob:pose.spinActive?(.085*Math.sin(t*13)+.03):0,
  scale:pose.spinActive?(.78+.10*pose.sideways):1,
  brightness:bright?.65:1,
  spinning:pose.spinActive
 };
}
