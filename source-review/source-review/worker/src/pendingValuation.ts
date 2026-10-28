import type{Env,Row}from"./types.ts";
export async function pendingStockValue(env:Env,part:string,warehouse:string,state:string,serials:string[]=[]):Promise<Row|null>{
 const args:unknown[]=[part,warehouse,state];let serialFilter="";
 if(serials.length){serialFilter=" AND EXISTS(SELECT 1 FROM inventory_serials s WHERE s.document_line_id=l.source_line_id AND s.part_id=l.part_id AND s.warehouse_id=l.warehouse_id AND s.status='in_stock' AND s.serial_key IN ("+serials.map(()=>"?").join(",")+"))";args.push(...serials.map(s=>s.normalize("NFKC").trim().toUpperCase()));}
 return env.DB.prepare("SELECT f.inventory_line_id,f.origin_line_id,f.reason FROM stock_lots l JOIN inventory_valuation_flags f ON f.inventory_line_id=l.source_line_id AND f.status='pending' WHERE l.part_id=? AND l.warehouse_id=? AND l.stock_state=? AND l.remaining_quantity_milli>0"+serialFilter+" ORDER BY l.available_at,l.source_line_id LIMIT 1").bind(...args).first<Row>();
}
