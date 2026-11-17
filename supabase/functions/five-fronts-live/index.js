/* Five Fronts live game authority.
 * Game state changes ONLY here; the browser never submits a game snapshot.
 * Supabase service-role credentials remain on the Edge runtime.
 */
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
import E from "./engine.js";

const url=Deno.env.get("SUPABASE_URL");
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if(!url||!secret)throw new Error("Missing Supabase server credentials");
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const ALLOWED=new Set([
 "https://crilo.fun","https://www.crilo.fun",
 "https://crilogames.github.io","http://localhost:4173","http://127.0.0.1:4173"
]);
const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const roomCode=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(6));
 return Array.from(bytes,v=>ALPHABET[v%ALPHABET.length]).join("");
};
const response=(body,status=200,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  ...(ALLOWED.has(origin)?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})
 }
});
const error=(message,status=400)=>Object.assign(new Error(message),{httpStatus:status});
const requireInt=(v,min,max,name)=>{
 if(!Number.isInteger(v)||v<min||v>max)throw error(name+" is invalid.");
 return v;
};
function roomId(value){
 if(typeof value!=="string"||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
  throw error("Invalid room.");
 return value;
}
async function findRoom(input){
 if(input.roomId){
  const {data,error:problem}=await admin.from("ff_live_rooms").select("*")
   .eq("id",roomId(input.roomId)).maybeSingle();
  if(problem)throw problem;
  if(!data)throw error("Room not found.",404);
  return data;
 }
 const code=String(input.code||"").toUpperCase().trim();
 if(!/^[A-Z2-9]{6}$/.test(code))throw error("Enter a valid six-character room code.");
 const {data,error:problem}=await admin.from("ff_live_rooms").select("*").eq("code",code).maybeSingle();
 if(problem)throw problem;
 if(!data)throw error("Room not found.",404);
 return data;
}
async function roster(roomId){
 const {data,error:problem}=await admin.from("ff_live_players")
  .select("user_id,seat,display_name,last_seen").eq("room_id",roomId).order("seat");
 if(problem)throw problem;
 return data||[];
}
async function snapshot(room,userId,players){
 const members=players||await roster(room.id);
 const mine=members.find(p=>p.user_id===userId);
 if(!mine)throw error("You are not a member of this match.",403);
 const now=Date.now();
 return {
  id:room.id,code:room.code,status:room.status,capacity:room.capacity,
  fast:room.fast,revision:Number(room.revision),meSeat:mine.seat,
  isHost:room.host_id===userId,
  players:members.map(p=>({
   seat:p.seat,name:p.display_name,
   connected:now-new Date(p.last_seen).getTime()<17000
  })),
  game:room.game||null
 };
}
async function touchPlayer(roomId,userId){
 // Updated only when stale: minimizes writes for crowded 30-minute games.
 const now=new Date();
 const {data}=await admin.from("ff_live_players").select("last_seen")
  .eq("room_id",roomId).eq("user_id",userId).maybeSingle();
 if(data&&now.getTime()-new Date(data.last_seen).getTime()>8000)
  await admin.from("ff_live_players").update({last_seen:now.toISOString()})
   .eq("room_id",roomId).eq("user_id",userId);
}
async function getName(userId){
 const {data}=await admin.from("profiles").select("username").eq("id",userId).maybeSingle();
 return String(data?.username||"Player").replace(/[\u0000-\u001F\u007F<>]/g,"").trim().slice(0,24)||"Player";
}
function advanceToNow(room,now){
 if(room.status!=="playing"||!room.game)return {game:room.game,progressed:false};
 const elapsed=Math.max(0,(now-new Date(room.tick_at).getTime())/1000);
 // More than 2 game seconds must elapse before making a replicated write.
 if(elapsed*(room.fast?5:1)<2)return {game:room.game,progressed:false};
 const game=structuredClone(room.game);
 let remaining=Math.min(Math.max(0,game.limit-game.time),elapsed*game.speed);
 let guard=0;
 while(remaining>0.001&&!game.ended&&guard++<420){
  const step=Math.min(5,remaining);
  E.advance(game,step);remaining-=step;
 }
 return {game,progressed:true};
}
async function compareSave(room,game,now,status){
 const next=Number(room.revision)+1;
 const {data,error:problem}=await admin.from("ff_live_rooms")
  .update({game,status:status||((game&&game.ended)?"finished":room.status),
   revision:next,tick_at:new Date(now).toISOString(),
   updated_at:new Date(now).toISOString()})
  .eq("id",room.id).eq("revision",room.revision)
  .eq("status",room.status).select("*").maybeSingle();
 if(problem)throw problem;
 return data;
}
function executeCommand(game,seat,command,args){
 if(!game?.online||game.ended)throw error("This campaign has ended.");
 if(!E.ownedCount(game,seat))throw error("Your nation has been eliminated.");
 if(!args||typeof args!=="object"||Array.isArray(args))throw error("Invalid orders.");
 let outcome;
 if(command==="train")
  outcome=E.train(game,seat,requireInt(args.stateId,0,29,"State"));
 else if(command==="fortify")
  outcome=E.fortify(game,seat,requireInt(args.stateId,0,29,"State"));
 else if(command==="march")
  outcome=E.march(game,seat,requireInt(args.from,0,29,"Origin"),
   requireInt(args.to,0,29,"Destination"),requireInt(args.troops,1,9999,"Troops"));
 else if(command==="policy"){
  if(typeof args.policy!=="string"||!Object.hasOwn(E.STRATEGIES,args.policy))
   throw error("Unknown national directive.");
  outcome=E.applyStrategy(game,seat,args.policy);
 }else throw error("Unknown order.");
 if(!outcome.ok)throw error(outcome.error||"Order could not be completed.");
 return outcome;
}
async function create(userId,params){
 const capacity=requireInt(params.capacity,2,6,"Player count");
 const fast=params.fast===true;
 for(let tries=0;tries<6;tries++){
  const {data:room,error:problem}=await admin.from("ff_live_rooms").insert({
   code:roomCode(),host_id:userId,capacity,fast,status:"waiting"
  }).select("*").single();
  if(problem){
   if(problem.code==="23505")continue;
   throw problem;
  }
  const {error:joinError}=await admin.from("ff_live_players").insert({
   room_id:room.id,user_id:userId,seat:0,display_name:await getName(userId)
  });
  if(joinError){
   await admin.from("ff_live_rooms").update({status:"cancelled"}).eq("id",room.id);
   throw joinError;
  }
  return snapshot(room,userId);
 }
 throw error("Could not create a unique room. Retry.",503);
}
async function join(userId,params){
 const room=await findRoom(params);
 let members=await roster(room.id);
 if(members.some(p=>p.user_id===userId)){
  await touchPlayer(room.id,userId);
  return snapshot(room,userId,await roster(room.id));
 }
 if(room.status!=="waiting")throw error("This match already started. Only existing players may reconnect.");
 for(let attempt=0;attempt<6;attempt++){
  const latest=await findRoom({roomId:room.id});
  if(latest.status!=="waiting")throw error("This room already started.");
  members=await roster(room.id);
  const used=new Set(members.map(p=>p.seat));
  let seat=0;
  while(used.has(seat)&&seat<latest.capacity)seat++;
  if(seat>=latest.capacity)throw error("This room is full.");
  const {error:insertError}=await admin.from("ff_live_players").insert({
   room_id:room.id,user_id:userId,seat,display_name:await getName(userId)
  });
  if(insertError){
   if(insertError.code==="23505")continue; // Another player claimed the seat first.
   throw insertError;
  }
  return snapshot(latest,userId,await roster(room.id));
 }
 throw error("This seat was just claimed. Try joining again.",409);
}
async function operate(userId,params){
 const id=roomId(params.roomId);
 const operation=String(params.operation||"sync");
 const authorized=await roster(id);
 const member=authorized.find(p=>p.user_id===userId);
 if(!member)throw error("Only players in this room may access it.",403);
 await touchPlayer(id,userId);
 if(operation==="leave"){
  const room=await findRoom({roomId:id});
  if(room.status==="waiting"){
   if(room.host_id===userId){
    await admin.from("ff_live_rooms").update({status:"cancelled",revision:Number(room.revision)+1})
     .eq("id",room.id).eq("status","waiting");
   }else await admin.from("ff_live_players").delete().eq("room_id",id).eq("user_id",userId);
  }
  return {left:true};
 }
 for(let attempt=0;attempt<6;attempt++){
  const room=await findRoom({roomId:id});
  if(operation==="start"){
   if(room.host_id!==userId)throw error("Only the host can start the battle.",403);
   if(room.status!=="waiting")return snapshot(room,userId,authorized);
   const list=await roster(id);
   if(list.length!==room.capacity)throw error("All "+room.capacity+" players must join before starting.");
   const game=E.createMatch({countries:room.capacity,fast:room.fast,online:true});
   const saved=await compareSave(room,game,Date.now(),"playing");
   if(saved)return snapshot(saved,userId,list);
   continue;
  }
  if(room.status!=="playing")return snapshot(room,userId,await roster(id));
  const now=Date.now(),tick=advanceToNow(room,now);
  if(operation==="sync"){
   if(!tick.progressed)return snapshot(room,userId,await roster(id));
   const saved=await compareSave(room,tick.game,now);
   if(saved)return snapshot(saved,userId,await roster(id));
   continue;
  }
  if(operation!=="command")throw error("Unknown operation.");
  const key=String(params.requestId||"");
  if(!/^[0-9a-f-]{8,50}$/i.test(key))throw error("Invalid action ID.");
  const duplicateKey=member.seat+":"+key;
  if(room.game?.recentActions?.includes(duplicateKey))
   return {snapshot:await snapshot(room,userId,await roster(id)),result:{ok:true,duplicate:true}};
  const game=tick.progressed?tick.game:structuredClone(room.game);
  if(game.ended)throw error("This campaign has ended.");
  const outcome=executeCommand(game,member.seat,params.command,params.args);
  game.recentActions=[...(game.recentActions||[]),duplicateKey].slice(-60);
  const saved=await compareSave(room,game,now);
  if(saved)return {snapshot:await snapshot(saved,userId,await roster(id)),result:outcome};
 }
 throw error("Other players are acting right now. Retry.",409);
}
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"";
 const cors={
  ...(ALLOWED.has(origin)?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{}),
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Max-Age":"600"
 };
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(origin&&!ALLOWED.has(origin))return response({error:"Origin not allowed."},403,origin);
 if(req.method!=="POST")return response({error:"POST required."},405,origin);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)throw error("Sign in to play online.",401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user)throw error("Sign in to play online.",401);
  // Honor site-wide bans: a banned account cannot create a lobby or
  // continue issuing multiplayer orders using an old browser session.
  const {data:ban,error:banError}=await admin.from("crilo_banned_accounts")
   .select("user_id").eq("user_id",user.id).maybeSingle();
  if(banError)throw banError;
  if(ban)throw error("This account cannot join Crilo multiplayer.",403);
  const params=await req.json();
  if(!params||typeof params!=="object"||Array.isArray(params))
   throw error("Invalid request.");
  const kind=String(params.operation||"");
  let data;
  if(kind==="create")data=await create(user.id,params);
  else if(kind==="join")data=await join(user.id,params);
  else data=await operate(user.id,params);
  return response({ok:true,data},200,origin);
 }catch(cause){
  if(cause?.httpStatus)return response({error:cause.message},cause.httpStatus,origin);
  console.error("Five Fronts server error",cause);
  return response({error:"The game server could not complete the request. Try again."},503,origin);
 }
});
