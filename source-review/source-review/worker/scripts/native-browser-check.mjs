import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {hashPassword,randomToken,tokenHash} from '../src/passwords.ts';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/BaOBaODz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),assets=new Map();
for(const name of readdirSync(join(root,'dist'),{recursive:true})){try{assets.set('/'+name.replaceAll('\\','/'),readFileSync(join(root,'dist',name)))}catch{}}
const built=await build({stdin:{contents:'import worker from "./src/index.ts";export default worker;',resolveDir:join(root,'worker'),sourcefile:'native-browser-entry.ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const pepper='native-browser-test-only-pepper-not-production-2026';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-20',https:true,host:'127.0.0.1',port:4185,d1Databases:{DB:'native-browser-only'},bindings:{AUTH_MODE:'native',AUTH_PASSWORD_PEPPER:pepper,ACCESS_TEAM_DOMAIN:'unused.cloudflareaccess.com',ACCESS_AUD:'unused'},serviceBindings:{ASSETS:async request=>{const path=new URL(request.url).pathname,data=assets.get(path)??assets.get('/index.html');return new Response(data,{headers:{'Content-Type':({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(path)]??'text/html')}})}}}));
let browser;
try{
 const db=await mf.getD1Database('DB'),migrations=join(root,'migrations');
 for(const name of readdirSync(migrations).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){
  const text=readFileSync(join(migrations,name),'utf8').replace(/--[^\n]*/g,'').replace(/CREATE TRIGGER[\s\S]*?END;/g,b=>b.slice(0,-1).replaceAll(';','__SEMICOLON__')+';');
  await db.batch(text.split(';').map(s=>s.replaceAll('__SEMICOLON__',';').trim()).filter(Boolean).map(s=>db.prepare(s)));
 }
 await db.prepare("INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES('browser-admin','old-admin-subject','browser-admin@example.invalid','Quản trị thử giao diện','admin')").run();
 await db.prepare("INSERT INTO native_credentials(user_id,password_hash,must_change) VALUES('browser-admin',?,0)").bind(await hashPassword({AUTH_PASSWORD_PEPPER:pepper},'Browser administrator password!')).run();
 const base=(await mf.ready).href;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:960}}),page=await context.newPage();
 const errors=[],navigations=[];let inventoryCalls=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())navigations.push(f.url())});page.on('request',r=>{if(new URL(r.url()).pathname==='/api/parts')inventoryCalls++});
 await page.goto(base);await page.getByLabel('Mật khẩu',{exact:true}).waitFor();
 if(inventoryCalls!==0)throw Error('Inventory before login');
 await page.screenshot({path:join(root,'artifacts/native-login-desktop.png'),fullPage:true});
 await page.getByLabel('Email đăng nhập',{exact:true}).fill('browser-admin@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('wrong password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('alert').filter({hasText:'Email hoặc mật khẩu không đúng'}).waitFor();
 await page.getByLabel('Mật khẩu',{exact:true}).fill('Browser administrator password!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('navigation',{name:'Vị trí trang'}).waitFor();
 await page.getByTitle('browser-admin@example.invalid',{exact:true}).click();await page.getByRole('button',{name:'Thêm người dùng'}).click();
 const dialog=page.getByRole('dialog',{name:'Thêm người dùng'});
 await dialog.getByLabel('Họ tên *').fill('Nhân viên sử dụng');await dialog.getByLabel('Email đăng nhập *').fill('employee@example.invalid');await dialog.getByLabel('Mật khẩu tạm *',{exact:true}).fill('Employee temporary password!');await dialog.getByLabel('Vai trò *').selectOption('viewer');await dialog.getByRole('button',{name:'Lưu tài khoản'}).click();await page.getByRole('button',{name:'Đặt lại mật khẩu employee@example.invalid'}).waitFor();
 await page.screenshot({path:join(root,'artifacts/native-user-management.png'),fullPage:true});
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByLabel('Mật khẩu',{exact:true}).waitFor();
 await page.getByLabel('Email đăng nhập',{exact:true}).fill('employee@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Employee temporary password!');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Đổi mật khẩu tạm'}).waitFor();
 if((await page.request.get(new URL('/api/parts',base).href)).status()!==403)throw Error('Temporary password bypass');
 await page.screenshot({path:join(root,'artifacts/native-password-change.png'),fullPage:true});
 await page.getByLabel('Mật khẩu hiện tại',{exact:true}).fill('Employee temporary password!');await page.getByLabel('Mật khẩu mới',{exact:true}).fill('Employee personal password!');await page.getByLabel('Xác nhận mật khẩu mới',{exact:true}).fill('Employee personal password!');await page.getByRole('button',{name:'Đổi mật khẩu',exact:true}).click();await page.getByRole('navigation',{name:'Vị trí trang'}).waitFor();
 await page.getByTitle('employee@example.invalid',{exact:true}).click();await page.getByRole('heading',{name:'Tài khoản của tôi'}).waitFor();if(await page.getByRole('button',{name:'Thêm người dùng'}).count())throw Error('Viewer management exposure');
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByLabel('Mật khẩu',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Chế độ tối',exact:true}).click();await page.screenshot({path:join(root,'artifacts/native-login-dark.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(root,'artifacts/native-login-mobile.png'),fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await db.prepare("INSERT INTO app_users(id,auth_subject,email,display_name,role) VALUES('bootstrap-owner','original-access-id','bootstrap@example.invalid','Quản trị thiết lập','admin')").run();const token=randomToken();await db.prepare("INSERT INTO native_activation_tokens(token_hash,user_id,expires_at) VALUES(?,'bootstrap-owner',?)").bind(await tokenHash(token),Math.floor(Date.now()/1000)+3600).run();
 await page.goto(base+'#setup='+token);await page.getByRole('heading',{name:'Thiết lập quản trị'}).waitFor();await page.getByLabel('Tạo mật khẩu quản trị',{exact:true}).fill('Bootstrap administrator private password!');await page.getByLabel('Xác nhận mật khẩu',{exact:true}).fill('Bootstrap administrator private password!');await page.getByRole('button',{name:'Tạo mật khẩu và vào phần mềm',exact:true}).click();await page.getByRole('navigation',{name:'Vị trí trang'}).waitFor();
 if(new URL(page.url()).hash)throw Error('Activation token left in address');if(navigations.some(v=>v.includes('cloudflareaccess.com')))throw Error('Navigated to Cloudflare');if(errors.length)throw Error(errors.join(';'));
 console.log('Native browser end-to-end passed: login, wrong password, user creation, forced change, viewer permissions, logout, admin setup, dark/mobile, no Access navigation.');
}finally{if(browser)await browser.close();await mf.dispose()}
