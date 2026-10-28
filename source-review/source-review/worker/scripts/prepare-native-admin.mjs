import fs from 'node:fs';import crypto from 'node:crypto';
const configuration=fs.readFileSync('C:/Users/BaOBaODz/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8'),match=configuration.match(/^oauth_token\s*=\s*"([^"]+)"/m);
if(!match)throw Error('Phiên triển khai chưa sẵn sàng.');
const endpoint='https://api.cloudflare.com/client/v4/accounts/724d10675edc2184ad32fd3588e11760/d1/database/193f96eb-3091-4a3e-92e4-7868f8053e4c/query';
async function query(sql,params=[]){const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+match[1],'Content-Type':'application/json'},body:JSON.stringify({sql,params})});const result=await response.json();if(!response.ok||!result.success)throw Error('Không thực hiện được bước chuẩn bị quản trị: HTTP '+response.status);return result.result[0].results;}
const admins=await query("SELECT id,email FROM app_users WHERE role='admin' AND is_active=1 ORDER BY created_at,id");if(admins.length!==1)throw Error('Cần xác định tài khoản quản trị gốc trước khi tạo liên kết.');
const existing=await query('SELECT user_id FROM native_credentials WHERE user_id=?',[admins[0].id]);if(existing.length)throw Error('Tài khoản quản trị đã có mật khẩu; không tạo liên kết thiết lập mới.');
const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex'),expires=Math.floor(Date.now()/1000)+86400;
await query('INSERT INTO native_activation_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash,admins[0].id,expires]);
const file='artifacts/THIET-LAP-MAT-KHAU-QUAN-TRI.txt';
fs.writeFileSync(file,'TÂN NAM CHINH — THIẾT LẬP MẬT KHẨU QUẢN TRỊ\n\nEmail đăng nhập: '+admins[0].email+'\n\nSao chép liên kết dưới đây vào trình duyệt của bạn, tự chọn mật khẩu mới. Liên kết chỉ dùng một lần; không chia sẻ cho người khác.\n\nhttps://qlvt.tannamchinh.workers.dev/#setup='+token+'\n\nHết hạn: '+new Intl.DateTimeFormat('vi-VN',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(expires*1000))+'\n\nNếu Cloudflare vẫn hỏi đăng nhập: dùng trình duyệt quản trị đang có phiên Cloudflare để thiết lập. Chỉ gỡ chính sách Access cũ sau khi đã tạo mật khẩu và vào QLVT thành công.\n','utf8');
console.log(JSON.stringify({prepared:true,admins:admins.length,private_setup_file:file,valid_hours:24}));
