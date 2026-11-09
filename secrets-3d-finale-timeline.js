/* Nothing Here: full-134.699s reference-directed 3D choreography.
 * Derived from the owner-uploaded 1080p MP4 (30fps), not approximate
 * repeating motion. Front-vs-loaf cut points for the first 27 seconds
 * were measured at 10fps from foreground silhouette width/height; all
 * later pose, color and scene changes were audited from the full video.
 *
 * 4fps exposure trace encodes only scene brightness, not any video pixels
 * or commercial frames. Licensed audio.currentTime remains authoritative.
 */
export const CAT_REFERENCE_DURATION=134.699;
export const CAT_MUSIC_BPM=150;
export const CAT_BEAT_SECONDS=60/CAT_MUSIC_BPM;
export const CAT_SPIN_BEATS=8;
// [start, label, shader scene ID, animation intensity]
export const CAT_SCENES=[
 [0.00,"green",0,.48],
 [26.87,"nebula",1,.72],
 [33.0,"tunnel",2,1],
 [39.85,"kaleidoscope",7,1],
 [45.82,"laser",9,1],
 [50.90,"digital",10,1],
 [58.99,"white",3,.16],
 [62.01,"redstars",8,.82],
 [74.81,"bluerays",4,.88],
 [77.87,"gray",12,.15],
 [78.88,"black",5,.09],
 [81.70,"green",0,.46],
 [87.48,"ice",11,.71],
 [89.71,"white",3,.18],
 [90.60,"ice",11,.76],
 [91.63,"white",3,.16],
 [92.64,"ice",11,.78],
 [93.80,"white",3,.15],
 [94.68,"ice",11,.77],
 [95.57,"white",3,.15],
 [96.64,"ice",11,.78],
 [97.61,"white",3,.15],
 [98.68,"ice",11,.78],
 [99.75,"white",3,.15],
 [101.18,"redstars",8,.73],
 [106.88,"tunnel",2,1],
 [114.02,"kaleidoscope",7,1],
 [119.81,"laser",9,1],
 [124.97,"digital",10,1],
 [130.79,"white",3,.22],
 [132.03,"green",0,.40],
 [134.52,"black",5,0]
];
// The original video alternates still holds ("front") and high-speed spin
// passages ("loaf"). These labels are animation cues on ONE textured cat,
// never instructions to display different models.
export const CAT_POSE_CUTS=[
 [0,"front"],
 [1.5,"loaf"],[2.9,"front"],
 [4.5,"loaf"],[6.1,"front"],
 [7.9,"loaf"],[9.2,"front"],
 [11.1,"loaf"],[12.4,"front"],
 [14.3,"loaf"],[15.6,"front"],
 [17.5,"loaf"],[18.8,"front"],
 [20.7,"loaf"],[26.8,"front"],
 [29.55,"loaf"],[35.93,"front"],
 [36.45,"loaf"],[58.95,"front"],
 [62.22,"loaf"],[63.84,"front"],
 [65.25,"loaf"],[66.33,"front"],
 [68.28,"loaf"],[69.78,"front"],
 [71.25,"loaf"],[72.78,"front"],
 [74.85,"loaf"],[77.82,"front"],
 [81.74,"loaf"],[84.75,"front"],
 [87.58,"loaf"],[100.12,"front"],
 [103.87,"loaf"],[115.78,"front"],
 [116.89,"loaf"],[118.78,"front"],
 [119.28,"loaf"],[130.82,"front"],
 [132.39,"loaf"],[134.699,"loaf"]
];
// Every 250ms: quantized average frame luminance in the provided video,
// measured OUTSIDE the cat's central bounding region. This allows exact
// white-outs, pauses, dark cuts and changes in exposure in the 3D stage.
const VIDEO_LUMA_4HZ=
"bbbbbbfedccbbbbbbbdeedcbbbbbbbbceedcbaaaaaaabbbbbbbbbbbbbfeddcbbbccccbbbbddddbbb"+
"beeeebbbbffbfbbfbffbfbbffffb5555555555555555555685555f5798d55b676444d89b484798d4"+
"9d9b98a8dcbd6775574684650411121113113111132212242336daba6769a8d769898965d9abffff"+
"ffffffffeedca86421112222222222222222222222222222221112222222b811111111111d200000"+
"000200ebbbbbbbbbbbbdbbbbbbbbbbbe41151771911bbcc1111eeef1111ffff1111ffff1111ff1f1"+
"1fafeeedcb986432122222322c2ef3c88a745876c54b776546b88b448aa9d98daaa7775756685367"+
"123121111121121114222222336a9ca876d88a5679aefffffeeedddc940";
const TAU=Math.PI*2;
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,t)=>{
 const x=clip((t-a)/(b-a),0,1);
 return x*x*(3-2*x);
};
const fract=x=>x-Math.floor(x);
function entryAt(list,t){
 let i=list.length-1;
 while(i>0&&t<list[i][0])i--;
 return i;
}
export function referenceLumaAt(seconds){
 const idx=clip(seconds,0,CAT_REFERENCE_DURATION)*4;
 const a=Math.floor(idx),b=Math.min(a+1,VIDEO_LUMA_4HZ.length-1);
 const value=i=>parseInt(VIDEO_LUMA_4HZ[i]||"0",16)/15;
 return value(Math.min(a,VIDEO_LUMA_4HZ.length-1))*(1-fract(idx))+
  value(b)*fract(idx);
}
export function sceneAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION),i=entryAt(CAT_SCENES,t);
 return {name:CAT_SCENES[i][1],scene:CAT_SCENES[i][2],
  pulse:CAT_SCENES[i][3],start:CAT_SCENES[i][0],
  end:CAT_SCENES[Math.min(i+1,CAT_SCENES.length-1)][0],
  index:i};
}
// Revolutions per SECOND sampled from the owner's 30fps reference MP4.
// In the opening (1.5–2.9s) a side-on cat repeats roughly every five
// frames: 30/5 ~= 6 complete horizontal Y-axis revolutions per second.
// At 8s it repeats about every six frames (~5 rps), accelerating again
// during the 34s neon tunnel. Keep the changes phase-continuous, never
// recompute localTime*newRate at a scene cut (which caused sudden jumps).
export const CAT_YAW_TURN_RATES=[
 [0,6.0],[4.5,5.6],[7.9,5.0],[20.7,5.4],
 [26.87,5.5],[33,6.0],[59,5.6],[75,5.3],
 [88,5.7],[101,5.8],[107,6.0],[131,5.6]
];
function spinRate(t){
 let index=CAT_YAW_TURN_RATES.length-1;
 while(index>0&&t<CAT_YAW_TURN_RATES[index][0])index--;
 return CAT_YAW_TURN_RATES[index][1];
}
function turnsBetween(start,end){
 let turns=0,current=start;
 for(let i=1;i<CAT_YAW_TURN_RATES.length;i++){
  const change=CAT_YAW_TURN_RATES[i][0];
  if(change<=current||change>=end)continue;
  turns+=(change-current)*spinRate(current);
  current=change;
 }
 return turns+(end-current)*spinRate(current);
}
export function motionAt(seconds){
 const t=clip(seconds,0,CAT_REFERENCE_DURATION);
 const scene=sceneAt(t),pIndex=entryAt(CAT_POSE_CUTS,t);
 const mode=CAT_POSE_CUTS[pIndex][1],start=CAT_POSE_CUTS[pIndex][0];
 const next=CAT_POSE_CUTS[Math.min(pIndex+1,CAT_POSE_CUTS.length-1)][0];
 const duration=Math.max(.01,next-start),local=Math.max(0,t-start);
 const loaf=mode==="loaf";
 const beat=(t-.04)/CAT_BEAT_SECONDS;
 const beatPhase=fract(beat),beatIndex=Math.max(0,Math.floor(beat));
 // Reference footage: the loaf turns LEFT / RIGHT around a vertical
 // axis, showing right side -> back -> left side -> face. It does NOT
 // tumble as a barrel roll. Six rotations/second in the opening section.
 const rate=spinRate(t);
 const turn=turnsBetween(start,t);
 const spinRadians=loaf?TAU*turn:0;
 const radialTilt=loaf?.24*Math.sin(local*6.3):0;
 const dip=loaf?Math.sin(local*5.6)*.08:0;
 const kickPulse=Math.pow(Math.max(0,1-beatPhase),6);
 const halfPulse=Math.pow(Math.max(0,1-fract(beat*2)),10);
 const referenceLuma=referenceLumaAt(t);
 const luma0=referenceLumaAt(Math.max(0,t-.25));
 const luma1=referenceLumaAt(Math.min(CAT_REFERENCE_DURATION,t+.25));
 const sceneCut=CAT_SCENES.slice(1,-1).reduce((acc,[at])=>
  Math.max(acc,Math.max(0,1-Math.abs(t-at)/.16)),0);
 // White flashes are explicit edits in the original video. Brightness
 // trace supplements them so muted or buffering audio never loses sync.
 const diff=Math.max(0,referenceLuma-Math.min(luma0,luma1));
 const drop=[2,7,9,10,11].includes(scene.scene);
 // The reference's neon drops are near-white CAMERA CUTS, not slow
 // pastel brightness oscillations. Short, high-contrast attacks every
 // 150-BPM downbeat; never more than 2.5 pulses/second. The caller
 // disables these for reduced-motion visitors.
 // The source uses near-instant camera shutters (one to two 30fps
 // frames), not the old 150–200ms soft white pulse. Leave dark time
 // between downbeats so flashes have actual contrast.
 const beatFlash=drop?
  Math.pow(Math.max(0,1-beatPhase*8.0),3.6)*.985:0;
 const brightCut=drop?sceneCut*.995:0;
 const rawFlash=Math.max(beatFlash,brightCut,
  drop?Math.max(0,diff-.095)*1.85:0);
 const flash=clip(rawFlash,0,1);
 const stageLuma=clip(referenceLuma,0,1);
 const lumaBoost=clip(.74+1.1*stageLuma,.60,1.60);
 return {
  scene:scene.scene,sceneName:scene.name,sceneIndex:scene.index,
  sceneStart:scene.start,sceneEnd:scene.end,
  poseMode:mode,poseStart:start,poseEnd:next,
  spinMode:loaf?(rate>=5.75?"rapid":"yaw"):"front",
  spinAxis:"y",revolutionsPerSecond:loaf?rate:0,
  spinActive:loaf,spinning:loaf,spinRadians,
  spinProgress:clip(local/duration,0,1),sideways:loaf?1:0,
  rollRadians:0,tiltRadians:0,threeDRoll:0,
  bob:loaf?.08*Math.sin(t*11):.025*kickPulse,
  scale:loaf?.80:1,
  beatIndex,beatPhase,bpm:CAT_MUSIC_BPM,
  beatPulse:kickPulse,hiHatPulse:halfPulse,
  pulse:scene.pulse*(.15+.85*kickPulse),
  flash,backdropFlash:flash,
  referenceLuma:stageLuma,lumaBoost,
  // Strong mint green on spinning poses, true key green when standing.
  greenPale:scene.scene===0&&loaf?clip(.38+.35*stageLuma,0,1):0,
  brightness:[0,3,6,12].includes(scene.scene)?.82:1,
  // Reference changes the cat size, especially under the neon drops.
  photoScale:t>=33&&t<59?.75:t>=62&&t<78?.78:
   t>=88&&t<100?.81:t>=107&&t<131?.83:1
 };
}
