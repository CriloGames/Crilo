import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://crilo.fun","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Sign in required"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return reply({error:"Moderation unavailable"},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 const owner=auth.user?.id;
 if(authError||!owner)return reply({error:"Invalid session"},401);
 const {data:profile}=await db.from("profiles").select("is_owner").eq("id",owner).single();
 if(!profile?.is_owner)return reply({error:"Owner only"},403);
 const mfaClient=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
 const {error:mfaError}=await mfaClient.rpc("crilo_require_owner_mfa");
 if(mfaError)return reply({error:"Owner authenticator verification required. Open Crilo Settings and verify your 6-digit code."},403);

 const json=await req.json().catch(()=>null);
 const runId=Number(json?.run_id);
 const profileTarget=typeof json?.user_id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(json.user_id)?json.user_id:null;
 if(json?.action!=="ban")return reply({error:"Invalid action"},400);
 let banTarget=profileTarget;
 if(!banTarget){
  if(!Number.isSafeInteger(runId)||runId<=0)return reply({error:"Invalid target"},400);
  const {data:review,error:reviewError}=await db.from("crilo_drawing_reviews").select("user_id").eq("run_id",runId).single();
  if(reviewError||!review)return reply({error:"Drawing not found"},404);
  banTarget=review.user_id;
 }
 if(banTarget===owner)return reply({error:"Cannot ban the owner account"},400);
 const {data:targetProfile,error:profileError}=await db.from("profiles").select("id,is_owner").eq("id",banTarget).maybeSingle();
 if(profileError||!targetProfile)return reply({error:"Player not found"},404);
 if(targetProfile.is_owner)return reply({error:"Cannot ban an owner account"},403);
 const {data:target,error:targetError}=await db.auth.admin.getUserById(banTarget);
 if(targetError||!target?.user?.email)return reply({error:"Cannot determine account email"},503);
 const normalizedEmail=target.user.email.trim().toLowerCase();
 const {error:emailError}=await db.from("crilo_banned_emails").upsert({email:normalizedEmail,banned_by:owner,reason:"Inappropriate drawing"},{onConflict:"email"});
 if(emailError)return reply({error:"Could not protect against email re-registration"},503);
 const {error:banError}=await db.auth.admin.updateUserById(banTarget,{ban_duration:"876000h"});
 if(banError)return reply({error:"Could not suspend account"},503);
 const {error:recordError}=await db.from("crilo_banned_accounts").upsert({user_id:banTarget,banned_by:owner,reason:"Inappropriate drawing"},{onConflict:"user_id"});
 if(recordError)return reply({error:"Account disabled, but audit record failed. Contact administrator."},503);
 // Optional owner-confirmed delete also removes the score and run statistics.
 // A normal ban leaves the official score intact and hides only the drawing.
 let runDeleted=false;
 if(!profileTarget&&json?.delete_run===true){
  const {count,error:removeError}=await db.from("daily_runs").delete({count:"exact"})
   .eq("id",runId).eq("user_id",banTarget).eq("is_test",false);
  if(removeError||count!==1)
   return reply({error:"Player was banned, but the requested run deletion failed. Review account and leaderboard separately.",banned:true,run_deleted:false},500);
  runDeleted=true;
 }else if(!profileTarget){
  const {error:hideError}=await db.from("daily_runs").update({drawing:null,drawing_is_blank:true})
   .eq("id",runId).eq("user_id",banTarget).eq("is_test",false);
  if(hideError)return reply({error:"Player was banned, but hiding the drawing failed.",banned:true,run_deleted:false},500);
  await db.from("crilo_drawing_reviews").update({status:"removed",reason:"Owner banned account for drawing",reviewed_at:new Date().toISOString(),reviewed_by:owner}).eq("run_id",runId);
 }
 return reply({ok:true,banned:true,run_deleted:runDeleted});
});