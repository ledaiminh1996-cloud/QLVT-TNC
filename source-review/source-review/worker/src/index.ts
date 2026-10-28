import {handleStockLedger} from "./stockLedger.ts";
import {handleInventoryBooks} from "./inventoryBooks.ts";
import {handleNativeAuth,nativeSession,nativeSessionData,resetUserPassword} from "./nativeAuth.ts";
import {handleUserAccess} from "./userAccess.ts";
import {handleDocuments,handleDocumentWorkflows} from './documents.ts';
import { handlePairingSets } from './pairingSets.ts';
import { createAccessVerifier, findUser, requireUser } from './auth.ts';
import { handleCatalog } from './catalogs.ts';
import { ApiError, json } from './http.ts';
import type { Env } from './types.ts';
import { importParts } from './partNumbering.ts';

export function createHandler(verifyIdentity = createAccessVerifier()) {
  return async (request: Request, env: Env): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    let checkpoint = started;
    const timings: string[] = [];
    const mark = (name:string) => { const end=performance.now(); timings.push(`${name};dur=${(end-checkpoint).toFixed(1)}`); checkpoint=end; };
    let response: Response;
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }
    try {
      if (!['GET','HEAD'].includes(request.method)) {
        const origin=request.headers.get('Origin');
        if((origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new ApiError(403,'ORIGIN_DENIED','Nguồn gửi yêu cầu không được phép.');
      }
      const nativeResponse=env.AUTH_MODE==='native'?await handleNativeAuth(request,env,requestId):null;
      if(nativeResponse){response=nativeResponse;} else if(url.pathname==='/api/auth/login'&&request.method==='GET'){
        if(!/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'')||!env.ACCESS_AUD)throw new ApiError(503,'AUTH_NOT_CONFIGURED','Đăng nhập chưa được cấu hình.');
        const target=new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/login/${url.hostname}`);target.searchParams.set('kid',env.ACCESS_AUD);target.searchParams.set('redirect_url','/');response=new Response(null,{status:302,headers:{Location:target.href}});
      } else if (url.pathname === '/api/health'  && request.method === 'GET') {
        await env.DB.prepare('SELECT 1 AS ok').first();
        response = json({ data: { status: 'ok', service: 'tnc-inventory-api' } });
      } else {
        if (!['GET', 'HEAD'].includes(request.method)) {
          const origin = request.headers.get('Origin');
          if (origin && origin !== url.origin) throw new ApiError(403, 'ORIGIN_DENIED', 'Nguồn gửi yêu cầu không được phép.');
          if (request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'ORIGIN_DENIED', 'Nguồn gửi yêu cầu không được phép.');
        }
        const native=env.AUTH_MODE==='native'?await nativeSession(request,env):null;
        if(env.AUTH_MODE==='native'&&!native)throw new ApiError(401,'UNAUTHENTICATED','Vui lòng đăng nhập bằng email và mật khẩu.');
        const identity=native?{subject:native.user.auth_subject,email:native.user.email}:await verifyIdentity(request,env);
        mark('auth');
        const user=native?.user??await findUser(env,identity);
        if(native?.must_change)throw new ApiError(403,'PASSWORD_CHANGE_REQUIRED','Đổi mật khẩu tạm trước khi sử dụng phần mềm.');
        mark('user_db');
        if(url.pathname==='/api/stock-ledger'){requireUser(user);response=await handleStockLedger(request,env,user);} else if(url.pathname==='/api/inventory-books'){requireUser(user);response=await handleInventoryBooks(request,env,user);} else if (url.pathname === '/api/auth/me' && request.method === 'GET') {
          response = json({ data: { identity, user: user?.is_active === 1 ? user : null, access_granted: user?.is_active === 1 } });
        } else {
          requireUser(user);
          const usersRoute=url.pathname.match(/^\/api\/user-management(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/);
          const passwordRoute=url.pathname.match(/^\/api\/user-passwords\/([a-zA-Z0-9_-]{1,128})$/);
          if(passwordRoute&&request.method==='POST'&&env.AUTH_MODE==='native'){response=await resetUserPassword(request,env,user,passwordRoute[1],requestId);}else if(usersRoute){response=await handleUserAccess(request,env,user,usersRoute[1],requestId);} else if (url.pathname === '/api/parts/import'  && request.method === 'POST') {
            response = await importParts(request, env, user, requestId);
          } else {
          const documentRoute=url.pathname.match(/^\/api\/(document-drafts|document-workflows)(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/);
          if(documentRoute){response=await (documentRoute[1]==='document-drafts'?handleDocuments:handleDocumentWorkflows)(request,env,user,documentRoute[2],requestId);}else {
          const pairingRoute=url.pathname.match(/^\/api\/equipment-pairing-sets(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/);
          if(pairingRoute) {response=await handlePairingSets(request,env,user,pairingRoute[1],requestId);} else {
          const route = url.pathname.match(/^\/api\/(mount-positions|vat-rates|parts|part-objects|part-groups|fuel-tanks|warehouses|vehicles|equipment|equipment-parameters|equipment-pairings|staff|org-units|departments|suppliers|users)(?:\/([a-zA-Z0-9_-]{1,128}))?\/?$/);
          if (!route) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API.');
          if(env.AUTH_MODE==='native'&&route[1]==='users'&&!['GET','HEAD'].includes(request.method))throw new ApiError(405,'USE_USER_MANAGEMENT','Dùng trang Người dùng, phân quyền để quản lý tài khoản.');
          response = await handleCatalog(request, env, user, route[1], route[2], requestId);
          }}
          }
        }
      }
    } catch (error) {
      let failure: ApiError;
      if (error instanceof ApiError) failure = error;
      else {
        const message = error instanceof Error ? error.message : '';
        if (/PAIRING_INVALID_REFERENCE/.test(message)) failure = new ApiError(409,'INVALID_REFERENCE','Chọn đầu kéo và thiết bị con đúng loại trong danh mục.');
        else if (/DRIVER_PAIRING_IN_USE/.test(message)) failure = new ApiError(409,'PAIRING_IN_USE','Tài xế đã được ghép ở đầu kéo khác.');
        else if (/PAIRING_REFERENCED_CODE/.test(message)) failure = new ApiError(409,'REFERENCED_CODE','Mã thiết bị đã có trong bản ghép nháp, không đổi mã hoặc loại.');
        else if (/UNIQUE constraint failed/i.test(message)) failure = new ApiError(409, 'DUPLICATE', 'Mã hoặc định danh đã tồn tại.');
        else if (/FOREIGN KEY constraint failed/i.test(message)) failure = new ApiError(409, 'INVALID_REFERENCE', 'Bản ghi tham chiếu không tồn tại hoặc đang được sử dụng.');
        else if (/CHECK constraint failed|NOT NULL constraint failed/i.test(message)) failure = new ApiError(400, 'CONSTRAINT_FAILED', 'Dữ liệu không đáp ứng ràng buộc.');
        else {
          console.error(JSON.stringify({ event: 'api.internal_error', request_id: requestId }));
          failure = new ApiError(500, 'INTERNAL_ERROR', 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
        }
      }
      response = json({ error: { code: failure.code, message: failure.message, request_id: requestId } }, failure.status);
    }
    mark('handler');
    timings.push(`total;dur=${(performance.now()-started).toFixed(1)}`);
    response.headers.set('Server-Timing',timings.join(', '));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Request-Id', requestId);
    return response;
  };
}

export default { fetch: createHandler() };
