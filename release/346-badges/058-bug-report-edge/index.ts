import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const RESEND_KEY=Deno.env.get("RESEND_API_KEY")||"";
const FROM=Deno.env.get("CRILO_REPORT_FROM_EMAIL")||"Crilo Bug Reports <onboarding@resend.dev>";
const TO="crilogame@gmail.com";
const responseJson=(body:unknown,status=200,origin="https://crilo.fun")=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}});
function clean(x:unknown,n:number){return typeof x==="string"?x.trim().slice(0,n):""}
Deno.serve(async req=>{
 const clientOrigin=req.headers.get("origin");
 const json=(body:unknown,status=200)=>responseJson(body,status,clientOrigin==="https://www.crilo.fun"?"https://www.crilo.fun":"https://crilo.fun");
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 // The bug beetle is hosted on Crilo. Reject cross-site browser requests before
 // they reach the service-role database client or email delivery.
 const origin=req.headers.get("origin");
 if(origin && origin!=="https://crilo.fun" && origin!=="https://www.crilo.fun")
   return json({error:"Cross-site reporting is not allowed"},403);
 if(Number(req.headers.get("content-length")||0)>10000)return json({error:"Report too large"},413);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return json({error:"Invalid request"},400)}
 const description=clean(body.description,3000),steps=clean(body.steps,1500),
 page=clean(body.page_url,500),agent=clean(body.user_agent,500);
 if(description.length<15)return json({error:"Please describe the issue in at least 15 characters."},400);
 if(page && !/^https:\/\/(crilo\.fun|www\.crilo\.fun)(\/|$)/i.test(page) && !/^http:\/\/127\.0\.0\.1(:\d+)?\//.test(page))
   return json({error:"Invalid page URL"},400);
 if(!SERVICE_KEY||!SUPABASE_URL)return json({error:"Reporting is not configured"},503);
 const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer /i,"");
 let userId:string|null=null;
 if(token){const {data}=await admin.auth.getUser(token);userId=data.user?.id||null}
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 const ipBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode((Deno.env.get("BUG_REPORT_SALT")||SERVICE_KEY)+ip));
 const ipHash=Array.from(new Uint8Array(ipBytes),b=>b.toString(16).padStart(2,"0")).join("");
 const since=new Date(Date.now()-60*60*1000).toISOString();
 const {count,error:countError}=await admin.from("crilo_bug_reports").select("id",{count:"exact",head:true}).eq("ip_hash",ipHash).gte("created_at",since);
 if(countError)return json({error:"Reporting temporarily unavailable"},503);
 if((count||0)>=3)return json({error:"Too many reports. Please try again later."},429);
 // Apply the 60-second cooldown at the server as well, not only in the browser.
 // Prevent accidental repeated emails for the same report on later visits.
 const {data:previous,error:previousError}=await admin.from("crilo_bug_reports")
   .select("created_at,description").eq("ip_hash",ipHash)
   .gte("created_at",since).order("created_at",{ascending:false}).limit(3);
 if(previousError)return json({error:"Reporting temporarily unavailable"},503);
 if(previous?.some((r:{created_at:string})=>Date.now()-Date.parse(r.created_at)<60_000))
   return json({error:"Please wait a minute before sending another report"},429);
 if(previous?.some((r:{description:string})=>r.description===description))
   return json({error:"This report has already been received"},429);
 const {data:report,error}=await admin.from("crilo_bug_reports").insert({user_id:userId,description,steps:steps||null,page_url:page||null,user_agent:agent||null,ip_hash:ipHash}).select("id").single();
 if(error||!report)return json({error:"Could not save report"},503);
 if(!RESEND_KEY){
   await admin.from("crilo_bug_reports").update({email_status:"failed"}).eq("id",report.id);
   return json({error:"Your report was saved, but email notifications are not yet configured. Please contact crilogame@gmail.com."},503);
 }
 const content=["A new Crilo bug report was submitted.","", "Description:",description,"","Steps:",steps||"(none)","","Page:",page||"(not supplied)","Browser:",agent||"(not supplied)","Report ID:",report.id].join("\n");
 let sent=false;
 try{
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:[TO],subject:"🪲 Crilo bug report",text:content})});
   sent=response.ok;
   if(!sent)console.error("Resend rejected bug report email",response.status,await response.text());
 }catch(e){console.error("Bug report email error",e)}
 await admin.from("crilo_bug_reports").update({email_status:sent?"sent":"failed"}).eq("id",report.id);
 return sent?json({ok:true}):json({error:"Report saved, but email delivery is not configured correctly. Please contact crilogame@gmail.com."},503);
});