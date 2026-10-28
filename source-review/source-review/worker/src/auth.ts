import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { Env, Identity, User } from './types.ts';
import { ApiError } from './http.ts';

type KeyResolver = (issuer: string) => JWTVerifyGetKey;
const keySets = new Map<string, JWTVerifyGetKey>();
const remoteKeys: KeyResolver = (issuer) => {
  let keys = keySets.get(issuer);
  if (!keys) {
    if (keySets.size >= 8) keySets.clear();
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
    keySets.set(issuer, keys);
  }
  return keys;
};

// Tests can supply public keys; production always uses Access's remote JWKS.
export function createAccessVerifier(resolveKeys: KeyResolver = remoteKeys) {
  return async (request: Request, env: Env): Promise<Identity> => {
    const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
    const bearer = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    const token = assertion || bearer;
    if (!token || token.length > 16384) throw new ApiError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập qua Cloudflare Access.');
    if (!/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN || '') || !env.ACCESS_AUD?.trim()) {
      throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Đăng nhập chưa được cấu hình.');
    }
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    try {
      const { payload } = await jwtVerify(token, resolveKeys(issuer), {
        issuer,
        audience: env.ACCESS_AUD,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'email', 'exp', 'iat'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256 ||
          typeof payload.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.email.length > 254) {
        throw new Error('Invalid identity claims');
      }
      return { subject: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      throw new ApiError(401, 'INVALID_SESSION', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }
  };
}

export async function findUser(env: Env, identity: Identity): Promise<User | null> {
  let user=await env.DB.prepare(`SELECT id,auth_subject,email,display_name,role,is_active,version FROM app_users WHERE auth_subject=? AND email=? COLLATE NOCASE AND access_linked=1`).bind(identity.subject,identity.email).first<User>();
  if(user)return user;
  // Only an explicitly provisioned, active email may bind to a signed Access subject.
  const invited=await env.DB.prepare("SELECT id FROM app_users WHERE email=? COLLATE NOCASE AND access_linked=0 AND is_active=1").bind(identity.email).first<{id:string}>();
  if(!invited)return null;
  await env.DB.batch([
    env.DB.prepare("UPDATE app_users SET auth_subject=?,access_linked=1,access_linked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE id=? AND email=? COLLATE NOCASE AND access_linked=0 AND is_active=1").bind(identity.subject,invited.id,identity.email),
    env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_json,request_id) SELECT ?,?,'user_access.link','users',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),invited.id,invited.id,JSON.stringify({email:identity.email,access_linked:true}),crypto.randomUUID()),
  ]);
  user=await env.DB.prepare("SELECT id,auth_subject,email,display_name,role,is_active,version FROM app_users WHERE auth_subject=? AND email=? COLLATE NOCASE AND access_linked=1").bind(identity.subject,identity.email).first<User>();
  return user;
}

export function requireUser(user: User | null): asserts user is User {
  if (!user || user.is_active !== 1) throw new ApiError(403, 'ACCESS_DENIED', 'Tài khoản chưa được cấp quyền hoặc đã ngừng hoạt động.');
}

export function requireRole(user: User, roles: readonly string[]) {
  if (!roles.includes(user.role)) throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
}
