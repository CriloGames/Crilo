import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,apikey,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=(s:unknown)=>typeof s==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const word=(s:unknown)=>typeof s==="string"&&s.length<=60&&/^[a-z0-9]+(?: [a-z0-9]+){0,5}$/.test(s);
const prompt=`Create a fresh five-pitch English word-association game from the random seed, not from a fixed word pool. Every pitch has six distinct clues (2 or 3 multiword phrases), a distinct hidden target, six short factual reasons why it connects to every clue, and two tempting partial answers. For EACH clue independently, also propose two obvious everyday guesses other than the target, with a short specific factual reason for each. This is important: think about what an ordinary player would say, not just the intended solution. For instance if a clue means soil, consider seeds, gardening or digging; if it means a guitar, consider music or strings. Include direct functional relationships, materials, familiar compounds, idioms and alternate senses. Avoid arbitrary shared settings or intermediate objects. Every guess must be a different word from all displayed clues (including words inside phrases and singular/plural forms). Never reveal the target in any clue. All clues, targets and guesses use lowercase English letters, digits and spaces. No repeated clues or targets within the climb; do not use targets on the avoid list. Pitch 1 is a specific familiar theme; pitches 2 to 5 combine progressively more distinct meanings, with a tempting 4/6 or 5/6 alternative in pitches 4 and 5. Partial answers have six reason slots in clue order, with null for unmatched clues. The common array has six arrays in clue order, each containing two [guess,reason] pairs. Keep all reasons concise (4-9 words), truthful and specific. Return JSON only: {"pitches":[{"target":"word","clues":["..."],"reasons":["..."],"alternatives":[{"word":"...","reasons":["...",null,null,"...",null,null]}],"common":[[["guess","Specific reason"],["guess","Specific reason"]],[],[],[],[],[]]}]}. Exactly five pitches, exactly six clues and six common arrays per pitch.`;
Deno.serve(async req=>{
 try{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return respond({error:"method"},405);
 const raw=await req.text();if(raw.length>24000)return respond({error:"size"},400);
 const b=JSON.parse(raw);
 if(!uuid(b.ticket)||!uuid(b.seed))return respond({error:"input"},400);
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),account=Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim(),api=Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim();
 if(!base||!key||!account||!api)return respond({error:"configuration"},503);
 const rpc=async(name:string,args:unknown)=>fetch(base+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(4000)});
 const prep=await rpc("ascent_prepare_generated_practice",{p_seed:b.seed,p_ticket:b.ticket});
 if(!prep.ok)return respond({error:"preparation_unavailable"},503);
 const plan=await prep.json();
 if(plan.exists)return respond({ok:true});
 if(plan.quota)return respond({error:"generation_limit"},429);
 if(!Array.isArray(plan.avoid)||!plan.avoid.every(word))return respond({error:"invalid_plan"},503);
 const cf=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast",{method:"POST",headers:{Authorization:"Bearer "+api,"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"system",content:prompt},{role:"user",content:JSON.stringify({seed:b.seed,avoid:plan.avoid})}],max_tokens:4600,temperature:.65,response_format:{type:"json_object"}}),signal:AbortSignal.timeout(33000)});
 const data=await cf.json();if(!cf.ok||data.success!==true)return respond({error:"model_request",code:data.errors?.[0]?.code??null},503);
 let out=data.result?.response;if(typeof out==="string")out=JSON.parse(out);
 if(!Array.isArray(out?.pitches)||out.pitches.length!==5)return respond({error:"invalid_pitches"},422);
 const normalize=(s:unknown)=>typeof s==="string"?s.toLowerCase().trim().replace(/[-–—]+/g," ").replace(/\s+/g," ").replace(/[.!?]+$/,""):s;
 // Normalize harmless case and punctuation differences before strict DB validation.
 const pitches=out.pitches.map((x:any)=>({target:normalize(x?.target),clues:Array.isArray(x?.clues)?x.clues.map(normalize):x?.clues,reasons:x?.reasons,alternatives:Array.isArray(x?.alternatives)?x.alternatives.map((a:any)=>({word:normalize(a?.word),reasons:a?.reasons})):[],common:Array.isArray(x?.common)?x.common.map((c:any)=>Array.isArray(c)?c.map((a:any)=>Array.isArray(a)?[normalize(a[0]),a[1]]:a):c):[]}));
 const stored=await rpc("ascent_store_generated_practice",{p_seed:b.seed,p_ticket:b.ticket,p_reply:{pitches}});
 if(!stored.ok){console.warn("Generated route failed validation",stored.status);return respond({error:"route_validation"},422);}
 return respond({ok:true});
 }catch(e){return respond({error:"generation_unavailable"},503)}
});