import fs from 'node:fs';
const config=fs.readFileSync('C:/Users/BaOBaODz/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8');
const match=config.match(/^oauth_token\s*=\s*"([^"]+)"/m);if(!match)throw Error('Không tìm thấy phiên cấu hình hiện có.');
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/724d10675edc2184ad32fd3588e11760/access/apps',{headers:{Authorization:'Bearer '+match[1]}});
const result=await response.json();console.log(JSON.stringify({status:response.status,success:result.success,errors:result.errors?.map(e=>({code:e.code,message:e.message})),apps:result.success?result.result.map(a=>({id:a.id,name:a.name,domain:a.domain,type:a.type,aud:a.aud,allowed_idps:a.allowed_idps,app_launcher_visible:a.app_launcher_visible,self_hosted_domains:a.self_hosted_domains,destinations:a.destinations})):undefined}));
