import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=(s:unknown)=>typeof s==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
const word=(s:unknown)=>typeof s==="string"&&s.length<=60&&/^[a-z0-9]+(?: [a-z0-9]+){0,5}$/.test(s);
const prompt=`Create an entirely original five-pitch English word association game, not from a supplied word bank. Generate fresh common English answers and clues using the random seed as creative inspiration. Each pitch has exactly six different clues (2 or 3 multiword phrases), a distinct hidden target, six concise factual explanations in clue order, and two tempting partial answers with a concise factual reason for each matched clue and null for unmatched clues. Every target must connect directly to all six clues, without obscure trivia or invented phrases. No target or partial answer may be a word contained in any clue. Do not reuse clues or targets in the five pitches. Do not use any target on the supplied avoid list. Pitch 1 is a familiar specific theme; pitch 2 combines two meanings or settings; pitch 3 combines three; pitch 4 combines four and has a tempting 4/6 or 5/6 alternative; pitch 5 combines five and has a tempting 4/6 or 5/6 alternative. Partial answers must be distinct and connect to at least 2 but no more than 5 clues. Use true, obvious-on-reveal associations, including wordplay and familiar idioms, not vague shared contexts. Reasons 4-12 words. Return only JSON: {"pitches":[{"target":"word","clues":["..."],"reasons":["..."],"alternatives":[{"word":"...","reasons":["...",null,null,"...",null,null]}]}]}. Exactly five pitches.`;
Deno.serve(async req=>{
 try{
 if(req.method!=="POST")return respond({error:"method"},405);
 const token=req.headers.get("x-ascent-token")||"";
 if(!/^[a-f0-9-]{72}$/.test(token))return respond({error:"unauthorized"},401);
 const raw=await req.text();if(raw.length>24000)return respond({error:"size"},400);
 const b=JSON.parse(raw);
 if(!uuid(b.ticket)||!uuid(b.seed)||!Array.isArray(b.avoid)||b.avoid.length>250||!b.avoid.every(word))return respond({error:"input"},400);
 const base=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),account=Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim(),api=Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim();
 if(!base||!key||!account||!api)return respond({error:"configuration"},503);
 const reserve=await fetch(base+"/rest/v1/rpc/ascent_llm_reserve",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_token:token,p_ticket:b.ticket}),signal:AbortSignal.timeout(1800)});
 if(!reserve.ok||await reserve.json()!==true)return respond({error:"quota_or_auth"},429);
 const cf=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast",{method:"POST",headers:{Authorization:"Bearer "+api,"Content-Type":"application/json"},body:JSON.stringify({messages:[{role:"system",content:prompt},{role:"user",content:JSON.stringify({seed:b.seed,avoid:b.avoid})}],max_tokens:2600,temperature:.85,response_format:{type:"json_object"}}),signal:AbortSignal.timeout(23000)});
 const data=await cf.json();if(!cf.ok||data.success!==true)return respond({error:"model_request",code:data.errors?.[0]?.code??null},503);
 let out=data.result?.response;if(typeof out==="string")out=JSON.parse(out);
 if(!Array.isArray(out?.pitches)||out.pitches.length!==5)return respond({error:"invalid_pitches"},422);
 return respond({pitches:out.pitches});
 }catch(e){return respond({error:"generation_unavailable"},503)}
});