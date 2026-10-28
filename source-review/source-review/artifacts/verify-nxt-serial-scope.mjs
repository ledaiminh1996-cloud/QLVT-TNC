import {getPlatformProxy} from '../worker/node_modules/wrangler/wrangler-dist/cli.js';
const {handleInventoryBooks}=await import(new URL('../worker/src/inventoryBooks.ts',import.meta.url).href);
import {writeFileSync} from 'node:fs';
const proxy=await getPlatformProxy({configPath:new URL('../worker/wrangler.jsonc',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),persist:false,remoteBindings:true,envFiles:[]});
try {
 const db=proxy.env.tnc_vattu;
 const part=await db.prepare("SELECT id FROM parts WHERE sku=?").bind('M-DC-CBXE-0006').first();
 if(!part)throw new Error('Không thấy vật tư yêu cầu');
 const filter={book:'card',part_id:part.id,from:'2026-10-01',to:'2026-10-31',q:'B65006700',page_size:'50'};
 const response=await handleInventoryBooks(new Request('https://qlvt.tannamchinh.workers.dev/api/inventory-books?'+new URLSearchParams(filter)),{DB:db},{id:'operator-read-only-verification',role:'admin'});
 const result=await response.json();
 if(response.status!==200)throw new Error(JSON.stringify(result));
 writeFileSync(new URL('./nxt-serial-actual-result.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify({serial:result.serial_filter,rows:result.data.map(r=>({date:r.business_at,code:r.code,serial:r.serials,in:r.in_quantity_milli,out:r.out_quantity_milli,balance:r.balance_quantity_milli,in_value:r.in_value_vnd,out_value:r.out_value_vnd,balance_value:r.balance_value_vnd})),groups:result.groups.map(g=>({open:g.opening_quantity_milli,in:g.in_quantity_milli,out:g.out_quantity_milli,close:g.closing_quantity_milli})),totals:result.totals}));
} finally {await proxy.dispose()}
