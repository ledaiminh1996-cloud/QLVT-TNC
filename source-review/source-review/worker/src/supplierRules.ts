import type { Env,Row,User } from './types.ts';
import { ApiError,json } from './http.ts';
export function supplierFailure(failure: unknown): never {
 const text=String(failure);
 if(text.includes('suppliers_tax_code_unique'))throw new ApiError(409,'DUPLICATE_TAX_CODE','Mã số thuế đã tồn tại ở nhà cung cấp khác.');
 if(text.includes('suppliers.code'))throw new ApiError(409,'DUPLICATE_SUPPLIER_CODE','Mã NCC đã tồn tại.');
 if(text.includes('supplier_code_sequence') || /last_value\s+BETWEEN\s+0\s+AND\s+99999/i.test(text))throw new ApiError(409,'SUPPLIER_CODE_EXHAUSTED','Đã sử dụng hết dải mã NCC99999.');
 if(text.includes('SUPPLIER_HAS_DOCUMENTS'))throw new ApiError(409,'SUPPLIER_HAS_DOCUMENTS','NCC đã liên kết chứng từ hoặc có phát sinh dữ liệu, không được xóa.');
 if(text.includes('SUPPLIER_INVALID_FIELDS'))throw new ApiError(400,'VALIDATION_ERROR','Mã NCC phải theo mẫu NCC00001.');
 throw failure;
}
export async function createSupplier(env:Env,user:User,values:Row,requestId:string):Promise<Response>{
 const id=crypto.randomUUID();const keys=Object.keys(values).filter(key=>key!=='code');
 const statements:D1PreparedStatement[]=[];
 if(!values.code)statements.push(env.DB.prepare("INSERT INTO supplier_code_sequence(id,last_value) SELECT 1,COALESCE(MAX(CAST(substr(code,4) AS INTEGER)),0)+1 FROM suppliers WHERE length(code)=8 AND code GLOB 'NCC[0-9][0-9][0-9][0-9][0-9]' ON CONFLICT(id) DO UPDATE SET last_value=MAX(supplier_code_sequence.last_value,excluded.last_value-1)+1"));
 const index=statements.length;
 statements.push(env.DB.prepare('INSERT INTO suppliers(id,code,'+keys.join(',')+") SELECT ?, "+(values.code?'?':"'NCC'||printf('%05d',(SELECT last_value FROM supplier_code_sequence WHERE id=1))")+','+keys.map(()=>'?').join(',')+' RETURNING *').bind(id,...(values.code?[values.code]:[]),...keys.map(key=>values[key])));
 const snapshot=['id','code',...keys,'version'].map(key=>"'"+key+"',"+key).join(',');
 statements.push(env.DB.prepare("INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,after_json,request_id) SELECT ?,?,'catalog.create','suppliers',id,json_object("+snapshot+"),? FROM suppliers WHERE id=?").bind(crypto.randomUUID(),user.id,requestId,id));
 try{const result=await env.DB.batch(statements);return json({data:result[index].results[0]},201);}catch(failure){return supplierFailure(failure);}
}
