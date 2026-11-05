// Real-browser regression of the refurbished vending machine and every
// dependent late-game delivery mechanism. Tests run in isolated storage;
// never touch a player's live Crilo account or saved progress.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"
]});
const base="http://127.0.0.1:4173/secrets.html";
const saveKey="crilo_nothing_here_cube_v3";
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
const state=page=>page.evaluate(()=>window.CriloNothingHereCube.getState());
const act=(page,action)=>page.evaluate(a=>window.__nothing3DPreview.clickAction(a),action);
const useItem=async(page,item,thing)=>{
 await page.locator('#ncInventory [data-item="'+item+'"]').click();
 assert.equal((await state(page)).selected,item,
  "Selecting "+item+" in inventory failed");
 assert(await page.evaluate(a=>window.CriloNothingHereCube.canUseSelectedWithAction(a),"thing:"+thing),
  item+" has no valid physical target "+thing);
 await act(page,"thing:"+thing);
};
const collect=async(page,item)=>{
 assert((await state(page)).pendingPickups.includes(item),
  item+" was not physically produced by the preceding mechanism");
 assert((await page.evaluate(id=>window.__nothing3DPreview.getPhysicalPickupRevealState(id),item))?.visible,
  "The "+item+" pickup is not visible in its real 3D holder");
 await act(page,"pickup:"+item);
 assert((await state(page)).pocket.includes(item),
  "The "+item+" pickup could not be collected into inventory");
};
async function scenario(name,seed){
 const ctx=await browser.newContext({viewport:{width:1280,height:860},reducedMotion:"reduce"});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
  r=>r.fulfill({status:200,body:mock,contentType:"application/javascript"}));
 await page.addInitScript(({key,data})=>{
  if(!sessionStorage.getItem("nc_coin_seeded")){
   localStorage.setItem(key,JSON.stringify(data));
   sessionStorage.setItem("nc_coin_seeded","yes");
  }
 },{key:saveKey,data:seed});
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>
  !!window.CriloNothingHereCube&&window.__nothing3DPreview?.ready&&
  document.body.classList.contains("nc-physical-ready"),null,{timeout:90000});
 return {page,close:async()=>{
  assert.deepEqual(errors,[],name+" had uncaught browser errors");
  await ctx.close();
 }};
}
async function refundCoin(page,{realPointer=false}={}){
 let s=await state(page);
 assert(s.coinReturned&&s.shimUsed&&!s.refundRedeemed,
  "The repair must return one coin before its final redemption");
 assert(s.pendingPickups.includes("coin")&&!s.pocket.includes("coin"),
  "The second coin must wait for a real pickup, not materialize in the pocket");
 const layout=await page.evaluate(()=>
  window.__nothing3DPreview.physicalPickupLayout.find(x=>x.id==="coin"));
 assert.equal(layout?.source,"machine",
  "The returned coin must appear AT the machine rather than in the bag");
 if(realPointer){
  await page.evaluate(()=>window.__nothing3DPreview.setRotation(0,0));
  const p=await page.evaluate(()=>{
   const v=window.__nothing3DPreview;
   const target=v.projectPhysicalPickup("coin");
   return target?{...target,actual:v.getPhysicalActionAt(target.x,target.y)}:null;
  });
  assert(p?.pick==="pickup:coin"&&p.actual==="pickup:coin",
   "Refunded coin cannot be physically clicked: "+JSON.stringify(p));
  await page.locator("#stage canvas").click({position:{x:p.x,y:p.y},timeout:20000});
  assert((await state(page)).pocket.includes("coin"),
   "Real mouse click missed the refunded coin");
 }else await collect(page,"coin");
 await useItem(page,"coin","machine");
 s=await state(page);
 assert(s.refundRedeemed&&s.seen.includes("service-bolt"),
  "Second coin did not reveal the separate service-drawer discovery");
 assert(!s.pocket.includes("coin")&&!s.pendingPickups.includes("coin"),
  "Second coin was not consumed exactly once");
 assert(!s.pendingPickups.includes("sugar"),
  "Second coin dispensed an unusable duplicate sugar reward");
 assert(await page.evaluate(()=>
  window.__nothing3DPreview.physicalScenePose.vendingServiceSealVisible),
  "The service certificate has no visible physical counterpart");
 assert((await page.evaluate(()=>window.__nothing3DPreview.physicalScenePose.vendingTrayDepth))>.44,
  "The vending machine's second tray is still closed");
 assert.match(await page.locator("#ncNarrator").innerText(),/brass service seal/i);
 await act(page,"thing:machine");
 assert(!(await state(page)).pendingPickups.includes("coin"),
  "A completed machine spawned another refunded coin on inspection");
}

try{
 // Order A: spend -> repair -> collect refund -> redeem -> reload.
 {
  const {page,close}=await scenario("spend-then-repair",{
   seen:["first","mouse","bag","machine","vent-sequence"],
   mouse:true,bag:true,machine:true,ventOpen:true,
   pocket:["shim","sugar"],pendingPickups:[]
  });
  await useItem(page,"shim","machine");
  await refundCoin(page,{realPointer:true});
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  const saved=await state(page);
  assert(saved.refundRedeemed&&saved.seen.includes("service-bolt")&&
    !saved.pendingPickups.includes("coin"),
   "Refreshing the solved machine rewound or duplicated the second coin");
  assert(await page.evaluate(()=>
   window.__nothing3DPreview.physicalScenePose.vendingServiceSealVisible),
   "The second drawer disappeared after save reload");
  await close();
  console.log("PASS: spent coin -> actual returned coin pointer -> sealed second drawer -> persistent save");
 }
 // Order B: repair before the very first coin is inserted. It must not
 // prematurely refund a coin still in the original bag/player pocket.
 {
  const {page,close}=await scenario("repair-before-spend",{
   seen:["first","mouse","bag","vent-sequence"],
   mouse:true,bag:true,machine:true,ventOpen:true,
   pocket:["coin","shim"],pendingPickups:[]
  });
  await useItem(page,"shim","machine");
  assert(!(await state(page)).coinReturned,
   "Repairing before spending minted a second coin from nowhere");
  await useItem(page,"coin","machine");
  const first=await state(page);
  assert(first.seen.includes("machine")&&first.pendingPickups.includes("sugar"),
   "The first payment stopped delivering its original sugar cube");
  await refundCoin(page);
  await close();
  console.log("PASS: repair-first ordering still makes first sugar, then one refund, then seal");
 }
 // Order C: older player save with a spent first coin and jam already
 // repaired, but no separate pending reward: recover it ON the cube.
 {
  const {page,close}=await scenario("legacy-repaired",{
   seen:["first","mouse","bag","machine","service-bolt"],
   mouse:true,bag:true,machine:true,shimUsed:true,
   coinReturned:false,refundRedeemed:false,
   pocket:["sugar"],pendingPickups:[]
  });
  assert((await state(page)).pendingPickups.includes("coin"),
   "An older repaired machine stranded its returned coin permanently");
  await refundCoin(page);
  await close();
  console.log("PASS: old saves recover the unspent second coin and it still physically redeems");
 }
 // After the machine, the other late mechanisms are independent, but
 // all must still lead to a reachable physical reward and the final letter.
 {
  const {page,close}=await scenario("late-game-chain",{
   seen:["first","mouse","bag","machine","service-bolt","music","teacup",
     "railway","door","dog","pressure-dial"],
   mouse:true,bag:true,machine:true,shimUsed:true,
   coinReturned:true,refundRedeemed:true,
   pressureReady:true,ventOpen:true,
   music:true,cloud:true,cup:true,watch:true,
   vase:true,train:true,door:true,doorOpen:true,
   pocket:["fork"],pendingPickups:[]
  });
  await page.locator('#ncInventory [data-item="fork"]').click();
  assert(await page.evaluate(()=>
   window.CriloNothingHereCube.canUseSelectedWithAction("cube-offer")),
   "The tuning fork cannot fit the actual physical receiver");
  await act(page,"cube-offer");
  assert((await state(page)).resonance,
   "Fork never releases the vibration-operated shutter");
  await act(page,"shutter");
  assert((await state(page)).serviceOpen,
   "Unlocked service shutter refuses to open");
  await collect(page,"cylinder");
  await useItem(page,"cylinder","musicbox");
  assert((await state(page)).cylinderMounted,"Wax cylinder failed to turn music box");
  await collect(page,"tape");
  await useItem(page,"tape","clock");
  assert((await state(page)).tapeInserted,"Punched tape failed to operate clock");
  await collect(page,"letter");
  await useItem(page,"letter","train");
  assert((await state(page)).letterMailed,"Train failed to mail the letter");
  await collect(page,"envelope");
  await useItem(page,"envelope","door");
  const final=await state(page);
  assert(final.doorReplied&&final.seen.includes("return-letter"),
   "Returned envelope never opened the last door secret");
  for(const item of ["fork","cylinder","tape","letter","envelope"])
   assert(!final.pocket.includes(item)&&!final.pendingPickups.includes(item),
    "Downstream mechanism duplicated spent "+item);
  await page.reload({waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForFunction(()=>window.__nothing3DPreview?.ready,null,{timeout:90000});
  const restored=await state(page);
  assert(restored.doorReplied&&restored.letterMailed&&restored.tapeInserted&&
   restored.cylinderMounted&&!restored.pendingPickups.includes("envelope"),
   "Reloading restored spent late-game parts or lost final secret");
  await close();
  console.log("PASS: fork -> shutter -> wax cylinder -> tape -> clock -> letter -> train -> envelope -> door");
 }
 console.log("PASS: all second-coin orders, actual 3D clicks, legacy save repair, and downstream mechanisms");
}finally{
 await browser.close();
}
