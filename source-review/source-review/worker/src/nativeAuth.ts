import {ApiError,json,readJson} from "./http.ts";
import {hashPassword,validatePassword,verifyPassword,randomToken,tokenHash} from "./passwords.ts";
import {requireRole} from "./auth.ts";
import type {Env,User} from "./types.ts";
export const sessionCookie="__Host-tnc_session";
const seconds=()=>Math.floor(Date.now()/1000),absolute=8*3600,idle=3600;
interface Credential {user_id:string;password_hash:string;credential_version:number;must_change:number}
export interface NativeSession {user:User;must_change:boolean;credential_version:number;token_hash:string}
export function cookieToken(request:Request){const matches=(request.headers.get("Cookie")??"").split(";").map(v=>v.trim()).filter(v=>v.startsWith(sessionCookie+"="));if(matches.length!==1)return "";const token=matches[0].slice(sessionCookie.length+1);return /^[a-f0-9]{64}$/.test(token)?token:"";}
const cookie=(token:string,maxAge=absolute)=>`${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export async function nativeSession(request:Request,env:Env):Promise<NativeSession|null>{
 const token=cookieToken(request);if(!token)return null;const hash=await tokenHash(token),now=seconds();
 const row=await env.DB.prepare("SELECT u.id,u.auth_subject,u.email,u.display_name,u.role,u.is_active,u.version,c.must_change,c.credential_version,s.idle_expires_at,s.expires_at FROM native_sessions s JOIN app_users u ON u.id=s.user_id JOIN native_credentials c ON c.user_id=u.id WHERE s.token_hash=? AND s.credential_version=c.credential_version AND s.expires_at>? AND s.idle_expires_at>? AND u.is_active=1").bind(hash,now,now).first<User&{must_change:number;credential_version:number;idle_expires_at:number;expires_at:number}>();
 if(!row)return null;
 if(row.idle_expires_at<now+idle-300)await env.DB.prepare("UPDATE native_sessions SET idle_expires_at=min(expires_at,?) WHERE token_hash=?").bind(now+idle,hash).run();
 const {must_change,credential_version,idle_expires_at,expires_at,...user}=row;return {user,must_change:must_change===1,credential_version,token_hash:hash};
}
export function nativeSessionData(session:NativeSession){return {identity:{subject:session.user.auth_subject,email:session.user.email},user:session.user,access_granted:true,auth_method:"password",must_change_password:session.must_change}}
function authError():never{throw new ApiError(401,"INVALID_CREDENTIALS","Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được phép truy cập.")}
async function rateLimit(env:Env,request:Request,identifier:string){
 const now=seconds(),window=Math.floor(now/900)*900,ip=request.headers.get("CF-Connecting-IP")??"unknown";
 const keys=await Promise.all([tokenHash("ip:"+ip),tokenHash("email:"+identifier)]);
 const result=await env.DB.batch<{attempts:number}>(keys.map(bucket=>env.DB.prepare("INSERT INTO native_login_limits(bucket,window_start,attempts) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts").bind(bucket,window)));
 if(Number(result[0].results[0].attempts)>60||Number(result[1].results[0].attempts)>8)throw new ApiError(429,"LOGIN_RATE_LIMIT","Thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút rồi thử lại.");
 await env.DB.prepare("DELETE FROM native_login_limits WHERE window_start<?").bind(now-86400*2).run();
}
const audit=(env:Env,userId:string,action:string,requestId:string,actorId=userId)=>env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_json,request_id) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actorId,action,"users",userId,JSON.stringify({authentication:"password"}),requestId);
async function newSession(env:Env,userId:string,version:number){const token=randomToken(),hash=await tokenHash(token),now=seconds();return {token,statement:env.DB.prepare("INSERT INTO native_sessions(token_hash,user_id,credential_version,created_at,expires_at,idle_expires_at) VALUES (?,?,?,?,?,?)").bind(hash,userId,version,now,now+absolute,now+idle)}}
// Keep token material exclusively in HttpOnly cookie, never in JSON or audit.
function sessionReply(token:string){const response=json({data:{ok:true}});response.headers.set("Set-Cookie",cookie(token));return response;}
export async function handleNativeAuth(request:Request,env:Env,requestId:string):Promise<Response|null>{
 const path=new URL(request.url).pathname;
 if(!path.startsWith("/api/auth/"))return null;
 if(request.method==="GET"&&path==="/api/auth/login")return new Response(null,{status:302,headers:{Location:"/"}});
 if(request.method==="GET"&&path==="/api/auth/me"){const session=await nativeSession(request,env);if(!session)throw new ApiError(401,"UNAUTHENTICATED","Vui lòng đăng nhập bằng email và mật khẩu.");return json({data:nativeSessionData(session)})}
 if(request.method!=="POST")throw new ApiError(405,"METHOD_NOT_ALLOWED","Thao tác đăng nhập không được hỗ trợ.");
 if(path==="/api/auth/logout"){const token=cookieToken(request);if(token)await env.DB.prepare("DELETE FROM native_sessions WHERE token_hash=?").bind(await tokenHash(token)).run();const response=json({data:{ok:true}});response.headers.set("Set-Cookie",cookie("",0));return response;}
 const body=await readJson(request,4096);
 if(path==="/api/auth/login"){
  if(Object.keys(body).some(k=>!["email","password"].includes(k))||typeof body.email!=="string"||body.email.length>254||typeof body.password!=="string"||body.password.length>512||!body.password)authError();
  const email=body.email.trim().toLowerCase();await rateLimit(env,request,email);
  const record=await env.DB.prepare("SELECT c.* FROM native_credentials c JOIN app_users u ON u.id=c.user_id WHERE u.email=? COLLATE NOCASE AND u.is_active=1").bind(email).first<Credential>();
  const valid=await verifyPassword(env,body.password,record?.password_hash??"");if(!record||!valid)authError();
  const fresh=await newSession(env,record.user_id,record.credential_version);
  // Conditional credential/user recheck prevents a concurrent reset/lock from issuing a usable session.
  await env.DB.batch([fresh.statement,audit(env,record.user_id,"auth.login",requestId),env.DB.prepare("DELETE FROM native_sessions WHERE expires_at<=? OR idle_expires_at<=?").bind(seconds(),seconds())]);
  return sessionReply(fresh.token);
 }
 if(path==="/api/auth/activate"){
  if(Object.keys(body).some(k=>!["token","password"].includes(k))||typeof body.token!=="string"||! /^[a-f0-9]{64}$/.test(body.token))throw new ApiError(400,"ACTIVATION_INVALID","Liên kết thiết lập không hợp lệ hoặc đã hết hạn.");
  const hash=await tokenHash(body.token);await rateLimit(env,request,"activation:"+hash);validatePassword(body.password);
  const activation=await env.DB.prepare("SELECT a.user_id,a.version FROM native_activation_tokens a JOIN app_users u ON u.id=a.user_id WHERE a.token_hash=? AND a.used=0 AND a.expires_at>? AND u.is_active=1 AND u.role='admin' AND NOT EXISTS(SELECT 1 FROM native_credentials c WHERE c.user_id=u.id)").bind(hash,seconds()).first<{user_id:string;version:number}>();
  if(!activation)throw new ApiError(400,"ACTIVATION_INVALID","Liên kết thiết lập không hợp lệ hoặc đã hết hạn.");
  const encoded=await hashPassword(env,body.password),fresh=await newSession(env,activation.user_id,1);
  await env.DB.batch([env.DB.prepare("UPDATE native_activation_tokens SET used=1,version=CASE WHEN used=0 AND version=? AND expires_at>? THEN version+1 ELSE -1 END WHERE token_hash=?").bind(activation.version,seconds(),hash),env.DB.prepare("INSERT INTO native_credentials(user_id,password_hash,must_change) VALUES(?,?,0)").bind(activation.user_id,encoded),fresh.statement,audit(env,activation.user_id,"auth.activate",requestId)]);
  return sessionReply(fresh.token);
 }
 if(path==="/api/auth/change-password"){
  const session=await nativeSession(request,env);if(!session)throw new ApiError(401,"UNAUTHENTICATED","Phiên đăng nhập đã hết hạn.");
  if(Object.keys(body).some(k=>!["current_password","new_password"].includes(k))||typeof body.current_password!=="string"||body.current_password.length>512)throw new ApiError(400,"VALIDATION_ERROR","Nhập mật khẩu hiện tại.");validatePassword(body.new_password);
  await rateLimit(env,request,"change:"+session.user.id);
  const current=await env.DB.prepare("SELECT * FROM native_credentials WHERE user_id=?").bind(session.user.id).first<Credential>();
  if(!current||!await verifyPassword(env,body.current_password,current.password_hash))throw new ApiError(400,"CURRENT_PASSWORD_INVALID","Mật khẩu hiện tại không đúng.");
  if(body.current_password===body.new_password)throw new ApiError(400,"PASSWORD_POLICY","Mật khẩu mới cần khác mật khẩu hiện tại.");
  const encoded=await hashPassword(env,body.new_password),fresh=await newSession(env,session.user.id,current.credential_version+1);
  await env.DB.batch([env.DB.prepare("UPDATE native_credentials SET password_hash=?,must_change=0,credential_version=CASE WHEN credential_version=? THEN credential_version+1 ELSE -1 END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=?").bind(encoded,current.credential_version,session.user.id),env.DB.prepare("DELETE FROM native_sessions WHERE user_id=?").bind(session.user.id),fresh.statement,audit(env,session.user.id,"auth.password_change",requestId)]);return sessionReply(fresh.token);
 }
 throw new ApiError(404,"NOT_FOUND","Không tìm thấy thao tác tài khoản.");
}
export async function resetUserPassword(request:Request,env:Env,user:User,id:string,requestId:string){
 requireRole(user,["admin"]);if(user.id===id)throw new ApiError(400,"SELF_PASSWORD_RESET","Dùng Đổi mật khẩu cho tài khoản đang đăng nhập.");
 const body=await readJson(request,4096);if(Object.keys(body).some(k=>!["password","version"].includes(k)))throw new ApiError(400,"VALIDATION_ERROR","Thông tin đặt mật khẩu không hợp lệ.");validatePassword(body.password);
 const target=await env.DB.prepare("SELECT id,version FROM app_users WHERE id=?").bind(id).first<{id:string;version:number}>();if(!target)throw new ApiError(404,"NOT_FOUND","Không tìm thấy tài khoản.");if(body.version!==target.version)throw new ApiError(409,"VERSION_CONFLICT","Tài khoản vừa thay đổi. Tải lại trước khi đặt mật khẩu.");
 const encoded=await hashPassword(env,body.password);
 await env.DB.batch([env.DB.prepare("UPDATE app_users SET version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?").bind(target.version,id),env.DB.prepare("INSERT INTO native_credentials(user_id,password_hash,must_change) VALUES(?,?,1) ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,must_change=1,credential_version=credential_version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(id,encoded),env.DB.prepare("DELETE FROM native_sessions WHERE user_id=?").bind(id),audit(env,id,"auth.admin_password_reset",requestId,user.id)]);return json({data:{ok:true}});
}
