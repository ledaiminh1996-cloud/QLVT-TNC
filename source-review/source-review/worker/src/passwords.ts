import {ApiError} from "./http.ts";
import type {Env} from "./types.ts";
const bytes=(value:string)=>new TextEncoder().encode(value);
export const hex=(value:ArrayBuffer|Uint8Array)=>Array.from(value instanceof Uint8Array?value:new Uint8Array(value),v=>v.toString(16).padStart(2,"0")).join("");
export const unhex=(value:string)=>Uint8Array.from(value.match(/../g)??[],v=>parseInt(v,16));
export function randomToken(){return hex(crypto.getRandomValues(new Uint8Array(32)))}
export async function tokenHash(value:string){return hex(await crypto.subtle.digest("SHA-256",bytes(value)))}
export function validatePassword(value:unknown):asserts value is string {
 if(typeof value!=="string"||Array.from(value).length<12||Array.from(value).length>128||!value.trim())throw new ApiError(400,"PASSWORD_POLICY","Mật khẩu cần từ 12 đến 128 ký tự.");
}
function pepper(env:Env){if(!env.AUTH_PASSWORD_PEPPER||env.AUTH_PASSWORD_PEPPER.length<32)throw new ApiError(503,"AUTH_NOT_CONFIGURED","Đăng nhập đang được cấu hình. Vui lòng thử lại sau.");return env.AUTH_PASSWORD_PEPPER;}
async function derive(env:Env,password:string,salt:string){
 const key=await crypto.subtle.importKey("raw",bytes(pepper(env)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const protectedPassword=await crypto.subtle.sign("HMAC",key,bytes(password));
 const source=await crypto.subtle.importKey("raw",protectedPassword,"PBKDF2",false,["deriveBits"]);
 // workerd currently caps PBKDF2 at 100k; a separately stored secret pepper protects a D1-only leak.
 return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:unhex(salt),iterations:100000},source,256));
}
export async function hashPassword(env:Env,password:string){validatePassword(password);const salt=hex(crypto.getRandomValues(new Uint8Array(16)));return "pbkdf2-sha256$100000$"+salt+"$"+await derive(env,password,salt)}
export async function verifyPassword(env:Env,password:string,encoded:string){
 const match=/^pbkdf2-sha256\$100000\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(encoded);
 const actual=await derive(env,password,match?.[1]??"00000000000000000000000000000000"),expected=match?.[2]??"0".repeat(64);
 let diff=0;for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return !!match&&diff===0;
}
