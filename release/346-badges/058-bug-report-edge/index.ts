import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const RESEND_KEY=Deno.env.get("RESEND_API_KEY")||"";
const FROM=Deno.env.get("CRILO_REPORT_FROM_EMAIL")||"Crilo Bug Reports <onboarding@resend.dev>";
const TO="crilogame@gmail.com";
const responseJson=(body:unknown,status=200,origin="https://crilo.fun")=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}});
function clean(x:unknown,n:number){return typeof x==="string"?x.trim().slice(0,n):""}

// Do not trust Content-Length alone: a streaming client may omit or lie about it.
async function readBoundedJson(req:Request,maxBytes=10000):Promise<unknown>{
 const reader=req.body?.getReader();
 if(!reader)return null;
 const parts:Uint8Array[]=[];
 let size=0;
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>maxBytes){
   await reader.cancel().catch(()=>{});
   throw new Error("REQUEST_TOO_LARGE");
  }
  parts.push(value);
 }
 const full=new Uint8Array(size);
 let offset=0;
 for(const part of parts){full.set(part,offset);offset+=part.byteLength;}
 return JSON.parse(new TextDecoder().decode(full));
}
Deno.serve(async req=>{
 const clientOrigin=req.headers.get("origin");
 const json=(body:unknown,status=200)=>responseJson(body,status,clientOrigin==="https://www.crilo.fun"?"https://www.crilo.fun":"https://crilo.fun");
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const origin=req.headers.get("origin");
 if(origin && origin!=="https://crilo.fun" && origin!=="https://www.crilo.fun")
  return json({error:"Cross-site reporting is not allowed"},403);
 if(Number(req.headers.get("content-length")||0)>10000)return json({error:"Report too large"},413);
 let body:Record<string,unknown>;
 try{
  const parsed=await readBoundedJson(req);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return json({error:"Invalid request"},400);
  body=parsed as Record<string,unknown>;
 }catch(error){
  return error instanceof Error&&error.message==="REQUEST_TOO_LARGE"?
   json({error:"Report too large"},413):json({error:"Invalid request"},400);
 }
 const description=clean(body.description,3000),steps=clean(body.steps,1500),
 page=clean(body.page_url,500),agent=clean(body.user_agent,500);
 if(description.length<15)return json({error:"Please describe the issue in at least 15 characters."},400);
 if(page && !/^https:\/\/(crilo\.fun|www\.crilo\.fun)(\/|$)/i.test(page) && !/^http:\/\/127\.0\.0\.1(:\d+)?\//.test(page))
  return json({error:"Invalid page URL"},400);
 if(!SERVICE_KEY||!SUPABASE_URL)return json({error:"Reporting is not configured"},503);
 const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer /i,"");
 let userId:string|null=null;
 if(token){
  const {data}=await admin.auth.getUser(token);
  userId=data.user?.id||null;
 }
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 const ipBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode((Deno.env.get("BUG_REPORT_SALT")||SERVICE_KEY)+ip));
 const ipHash=Array.from(new Uint8Array(ipBytes),b=>b.toString(16).padStart(2,"0")).join("");
 // Server-serialized check-and-insert: no multi-request count/insert race.
 const {data:reportId,error:insertError}=await admin.rpc("crilo_accept_bug_report",{
  p_user_id:userId,p_description:description,p_steps:steps||null,
  p_page_url:page||null,p_user_agent:agent||null,p_ip_hash:ipHash
 });
 if(insertError){
  if(insertError.message.includes("BUG_REPORT_RATE_LIMIT"))
   return json({error:"Too many reports. Please try again later."},429);
  if(insertError.message.includes("BUG_REPORT_COOLDOWN"))
   return json({error:"Please wait a minute before sending another report"},429);
  if(insertError.message.includes("BUG_REPORT_DUPLICATE"))
   return json({error:"This report has already been received"},429);
  console.error("Bug report intake error",insertError.message);
  return json({error:"Reporting temporarily unavailable"},503);
 }
 if(!reportId)return json({error:"Could not save report"},503);
 if(!RESEND_KEY){
  await admin.from("crilo_bug_reports").update({email_status:"failed"}).eq("id",reportId);
  return json({error:"Your report was saved, but email notifications are not yet configured. Please contact crilogame@gmail.com."},503);
 }
 const content=["A new Crilo bug report was submitted.","","Description:",description,"","Steps:",steps||"(none)","","Page:",page||"(not supplied)","Browser:",agent||"(not supplied)","Report ID:",reportId].join("\n");
 let sent=false;
 try{
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[TO],subject:"🪲 Crilo bug report",text:content})});
  sent=response.ok;
  if(!sent)console.error("Resend rejected bug report email",response.status,await response.text());
 }catch(error){console.error("Bug report email error",error)}
 await admin.from("crilo_bug_reports").update({email_status:sent?"sent":"failed"}).eq("id",reportId);
 return sent?json({ok:true}):json({error:"Report saved, but email delivery is not configured correctly. Please contact crilogame@gmail.com."},503);
});
