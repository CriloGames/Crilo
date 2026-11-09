// Deterministic 3D visual regression audit: all six faces in three distinct
// puzzle states, plus real PNG pixel comparisons across restored saves.
// Run from the repository root AFTER installing three-workbench dependencies
// and the root Playwright browser used by the other Nothing Here tests.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
import pixelmatch from "pixelmatch";
import {PNG} from "pngjs";

const output="test-results/nothing-here-visual";
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader",
 "--enable-unsafe-swiftshader"
]});
const page=await browser.newPage({
 viewport:{width:1160,height:800},reducedMotion:"reduce",deviceScaleFactor:1
});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
page.on("console",msg=>{
 if(msg.type()==="error"&&!msg.text().includes("supabase"))
  errors.push(msg.text().slice(0,220));
});
const mock=`window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
 signOut:async()=>({error:null})},
 rpc:async()=>({data:null,error:null}),
 from:()=>({select(){return this},eq(){return this},order(){return this},
 limit:async()=>({data:[],error:null}),
 in:async()=>({data:[],error:null}),
 maybeSingle:async()=>({data:null,error:null})})
})};`;
await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
 route=>route.fulfill({status:200,body:mock,contentType:"application/javascript"}));
const key="crilo_nothing_here_cube_v3";
const pending=[
 "coin","reed","treat","prism","sugar","tag","postcard",
 "acorn","spring","raindrop","bird","lens","stardust",
 "starmap","parcel","envelope","tape","letter","bell",
 "fork","shim","cog","washer","cylinder","iris"
];
const scenarios=[
 ["locked",{seen:[],pocket:[],pendingPickups:[]}],
 ["partly-unlocked",{
   pocket:["flute"],pendingPickups:["coin","cog","fork","bell"],
   a:true,b:true,top:true,mouse:true,bag:true,bagOpen:true,
   door:true,doorOpen:true,plateOpen:true,screws:[0,1,2],
   pressureReady:true,pressureTicks:3,redHits:4,footChecked:true
 }],
 ["fully-unlocked",{
   pocket:["flute","key"],pendingPickups:pending,
   a:true,b:true,top:true,bottom:true,back:true,mouse:true,
   bag:true,bagOpen:true,bagSolved:true,door:true,doorOpen:true,
   squirrel:true,vase:true,plant:true,tree:true,music:true,
   cloud:true,cup:true,watch:true,machine:true,tag:true,
   floorFour:true,mothTouched:true,moon:true,dancer:true,
   observatoryRaised:true,observed:true,telescopeLensMounted:true,
   telescopeIrisMounted:true,secondSky:true,
   train:true,portal:true,ventOpen:true,plateOpen:true,
   pressureReady:true,pressureTicks:3,eyeRingTicks:3,
   serviceOpen:true,tapeInserted:true,shimUsed:true,coinReturned:true,
   screws:[0,1,2],hingePins:[0,1,2],rightBoltLoose:true,
   footChecked:true,redHits:4
 }]
];
const faces=[
 ["front",-15,0],["left",-15,90],["back",-15,180],
 ["right",-15,270],["top",-75,0],["bottom",75,0]
];
// A perspective/three-quarter view can hide panel interpenetration.
// These six EXACT axis-on views reveal mismatched trim, exposed backs
// of sockets, asymmetrical rails, and miniature brackets slipping off
// their base plate.
const orthogonalFaces=[
 ["front-flat",0,0],["left-flat",0,90],["back-flat",0,180],
 ["right-flat",0,270],["top-flat",-90,0],["bottom-flat",90,0]
];
const images=new Map();
const compare=(name,first,second,{max=1,min=0}={})=>{
 const left=PNG.sync.read(first),right=PNG.sync.read(second);
 assert.equal(left.width,right.width,name+" screenshot width changed");
 assert.equal(left.height,right.height,name+" screenshot height changed");
 const diff=new PNG({width:left.width,height:left.height});
 const count=pixelmatch(left.data,right.data,diff.data,left.width,left.height,{
  threshold:.18,includeAA:false
 });
 const fraction=count/(left.width*left.height);
 writeFileSync(output+"/"+name+"-diff.png",PNG.sync.write(diff));
 assert(fraction>=min&&fraction<=max,
  name+" changed "+(fraction*100).toFixed(2)+
  "% (expected between "+(min*100)+"% and "+(max*100)+"%)");
 console.log("VISUAL DIFF",name,(fraction*100).toFixed(2)+"%");
 return fraction;
};
try{
 await page.goto("http://127.0.0.1:4173/secrets.html",{
  waitUntil:"domcontentloaded",timeout:30000
 });
 for(const [scenario,save] of scenarios){
  await page.evaluate(([storageKey,data])=>
   localStorage.setItem(storageKey,JSON.stringify(data)),[key,save]);
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready&&
   document.body.classList.contains("nc-physical-ready"),null,{timeout:60000});
  // Verify structural attachments in each actual puzzle state, not
  // only after all 60 secrets are unlocked. This detects detached mounts,
  // extra rails and newly intersecting mechanisms as drawers and roof
  // plates move through different states.
  const attachments=await page.evaluate(()=>
   window.__nothing3DPreview.physicalAttachmentAudit);
  assert(attachments?.okay&&attachments.issues.length===0,
   scenario+" has dangling brackets or trim crossings: "+
   JSON.stringify(attachments?.issues));
  const collisions=await page.evaluate(()=>
   window.__nothing3DPreview.getDetailedCollisionReport());
  assert(collisions?.selfTest?.intersecting&&
   collisions.selfTest.separated&&
   !collisions.truncated&&collisions.totalIntersections===0,
   scenario+" has real triangle intersections between distinct "+
   "assemblies: "+JSON.stringify(collisions));
  console.log("PASS VISUAL HARDWARE",scenario,JSON.stringify({
   attached:attachments.okay,
   groups:collisions.totalAssemblies,
   candidatePairs:collisions.broadPhasePairs,
   triangles:collisions.meshPairsTested,
   collisions:collisions.totalIntersections
  }));
  // Every screenshot is taken in the same browser, resolution, lighting
  // and reduced-motion mode to avoid platform-specific baseline drift.
  for(const [face,rx,ry] of faces){
   await page.evaluate(([x,y])=>
    window.__nothing3DPreview.setRotation(x,y),[rx,ry]);
   const screenshot=await page.locator("#stage canvas").screenshot({
    animations:"disabled",timeout:60000
   });
   const filename=scenario+"-"+face+".png";
   images.set(filename,screenshot);
   writeFileSync(output+"/"+filename,screenshot);
  }
  // Verify LEVEL, straight-on geometry as well as the previous angled
  // screenshots; save actual PNGs for manual front/rear/edge inspection.
  // Extra coverage is only needed while mechanisms are open.
  if(scenario!=="locked"){
   for(const [face,rx,ry] of orthogonalFaces){
    await page.evaluate(([x,y])=>
     window.__nothing3DPreview.setRotation(x,y),[rx,ry]);
    const screenshot=await page.locator("#stage canvas").screenshot({
     animations:"disabled",timeout:60000
    });
    writeFileSync(output+"/"+scenario+"-"+face+".png",screenshot);
   }
  }
 }
 // Test that unlocking has a visible effect, not merely a changed save.
 compare("lock-vs-open-front",images.get("locked-front.png"),
  images.get("fully-unlocked-front.png"),{min:.008});
 compare("lock-vs-open-top",images.get("locked-top.png"),
  images.get("fully-unlocked-top.png"),{min:.008});
 // Catch rendering that changes or extrudes at random after reloading an
 // identical fully solved save, which ordinary functional checks cannot see.
 await page.reload({waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>window.__nothing3DPreview?.ready,
  null,{timeout:60000});
 for(const [face,rx,ry] of faces.filter(v=>
  ["front","top","bottom"].includes(v[0]))){
  await page.evaluate(([x,y])=>
   window.__nothing3DPreview.setRotation(x,y),[rx,ry]);
  const current=await page.locator("#stage canvas").screenshot({
   animations:"disabled",timeout:60000
  });
  writeFileSync(output+"/reloaded-"+face+".png",current);
  compare("saved-state-"+face,images.get("fully-unlocked-"+face+".png"),
   current,{max:.025});
 }
 assert.deepEqual(errors,[],"The visual walkthrough emitted browser exceptions");
 console.log("PASS: 18 oblique + 12 axis-on 3D face screenshots, "+
  "three-state triangle-intersection and mount-clearance checks, "+
  "saved-game parity and unlock pixel differences");
}finally{await browser.close()}
