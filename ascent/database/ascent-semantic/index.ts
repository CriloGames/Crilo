// Ascent private embedding service. All scoring and quota decisions stay in Postgres.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const model=new Supabase.ai.Session("gte-small");
const cache=new Map<string,number[]>();
function response(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}})}
async function authorized(token:string){
 if(!/^[a-f0-9-]{72}$/.test(token))return false;
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),base=Deno.env.get("SUPABASE_URL");
 if(!key||!base)return false;
 const r=await fetch(base+"/rest/v1/rpc/ascent_semantic_authorize",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_token:token}),signal:AbortSignal.timeout(1600)});
 return r.ok&&await r.json()===true;
}
const valid=(s:unknown):s is string=>typeof s==="string"&&s.length>=1&&s.length<=120&&/^[a-z0-9]+(?: [a-z0-9]+){0,15}$/.test(s);
async function embed(word:string){
 const found=cache.get(word);if(found){cache.delete(word);cache.set(word,found);return found;}
 const raw=await model.run(word,{mean_pool:true,normalize:true});
 const vector=Array.from(raw as ArrayLike<number>);
 if(vector.length!==384||!vector.every(Number.isFinite))throw Error("Invalid embedding");
 cache.set(word,vector);if(cache.size>512)cache.delete(cache.keys().next().value!);
 return vector;
}
Deno.serve(async req=>{
 try{
  if(req.method!=="POST")return response({error:"Method not allowed"},405);
  if(!await authorized(req.headers.get("x-ascent-token")||""))return response({error:"Unauthorized"},401);
  const body=await req.json();
  if(body.mode!=="vectors"||!Array.isArray(body.terms)||body.terms.length<1||body.terms.length>4||!body.terms.every(valid))return response({error:"Invalid input"},400);
  const vectors=[];
  for(const word of [...new Set<string>(body.terms)])vectors.push({word,vector:await embed(word)});
  return response({vectors});
 }catch(e){console.error("Ascent inference unavailable",e instanceof Error?e.name:"Error");return response({error:"Inference unavailable"},503)}
});