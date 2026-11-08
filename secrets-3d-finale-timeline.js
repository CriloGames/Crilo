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
// "loaf" means the separate, crouched real-3D tabby shape is active.
// All other instants show the full forward-facing textured standing cat.
// These are EDIT transitions, not rotation periods for a standing model.
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
 [62.07,"loaf"],[63.84,"front"],
 [64.64,"loaf"],[66.77,"front"],
 [67.65,"loaf"],[69.56,"front"],
 [71.63,"loaf"],[72.90,"front"],
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
function spinRate(t){
 if(t<20.7)return 1.1; // quick intro spins interleaved with facing front
 if(t<26.87)return 1.65; // rapid build at 150 BPM
 if(t<33)return .78; // slower nebula entrance
 if(t<59)return 1.20; // very fast blue/pink tunnels
 if(t<75)return .85; // alternates red-stars pose with still upright
 if(t<88)return .9;
 if(t<101)return .80; // slow electrified blue portal with white-outs
 if(t<107)return .75;
 return 1.25; // closing tunnel/caleidoscope
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
 // The source swaps a full-size standing tabby for a compact, sideways
 // dark loaf. The loaf tumbles in SCREEN SPACE about the camera axis,
 // NOT around the standing cat's vertical (Y) axis.
 const rate=spinRate(t);
 const turn=local*rate;
 const accents=.085*smooth(0,.9,beatPhase);
 const spinRadians=loaf?TAU*(turn+accents):0;
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
 const beatFlash=drop&&beatIndex%2===0?
  Math.pow(Math.max(0,1-beatPhase*11),3)*.54:0;
 const brightCut=drop?sceneCut*.93:0;
 const rawFlash=Math.max(beatFlash,brightCut,
  drop?Math.max(0,diff-.13)*1.6:0);
 const flash=clip(rawFlash,0,1);
 const stageLuma=clip(referenceLuma,0,1);
 const lumaBoost=clip(.74+1.1*stageLuma,.60,1.60);
 return {
  scene:scene.scene,sceneName:scene.name,sceneIndex:scene.index,
  sceneStart:scene.start,sceneEnd:scene.end,
  poseMode:mode,poseStart:start,poseEnd:next,
  spinMode:loaf?(t<20.7||rate<=1.05?"slow":"beat"):"front",
  spinActive:loaf,spinning:loaf,spinRadians,
  spinProgress:clip(local/duration,0,1),sideways:loaf?1:0,
  rollRadians:loaf?Math.PI/2:0,
  tiltRadians:radialTilt,
  threeDRoll:dip,
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
