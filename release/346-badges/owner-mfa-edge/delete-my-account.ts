import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return reply({error:"Sign in required"},401);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return reply({error:"Account deletion is temporarily unavailable"},503);
 const token=auth.slice(7);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await client.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return reply({error:"Please sign in again before deleting your account."},401);
 let payload:unknown;
 try{payload=await req.json()}catch{return reply({error:"Invalid request"},400)}
 if(!payload||typeof payload!=="object"||!("confirmation" in payload)||(payload as {confirmation:unknown}).confirmation!=="DELETE")return reply({error:"Type DELETE to confirm."},400);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error:profileError}=await admin.from("profiles").select("is_owner").eq("id",user.id).maybeSingle();
 if(profileError)return reply({error:"Account protection temporarily unavailable"},503);
 if(profile?.is_owner){
  const mfaClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
  const {error:mfaError}=await mfaClient.rpc("crilo_require_owner_mfa");
  if(mfaError)return reply({error:"Verify your owner authenticator in Crilo Settings before deleting the owner account."},403);
 }
 const {error}=await admin.auth.admin.deleteUser(user.id);
 if(error){console.error("Account deletion failed",error.message);return reply({error:"Unable to delete account. Please try again or contact support."},500)}
 return reply({deleted:true});
});