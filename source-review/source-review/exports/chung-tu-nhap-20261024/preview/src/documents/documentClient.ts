import {CatalogApiError} from '../api/catalogClient';
import type {DocumentDraft,DocumentRecord,DocumentSummary,DocumentWorkflow} from '../../shared/documents';
export interface DocumentPage<T>{data:T[];pagination:{page:number;page_size:number;total:number}}
export interface DocumentEvent{id:string;actor_name:string;action:string;reason:string;created_at:string;before_json:string|null;after_json:string}
export interface Approver{id:string;display_name:string;role:string}
export interface ListDocuments{kind:string;page?:number;q?:string;status?:string;from?:string;to?:string;signal?:AbortSignal}
export interface DocumentClient {
 list(options:ListDocuments):Promise<DocumentPage<DocumentSummary>>;
 get(id:string,signal?:AbortSignal):Promise<DocumentRecord>;
 save(draft:DocumentDraft,key:string,row?:DocumentRecord,reason?:string):Promise<DocumentRecord>;
 action(row:DocumentRecord,action:string,reason:string):Promise<DocumentRecord>;
 history(id:string,page:number,signal?:AbortSignal):Promise<DocumentPage<DocumentEvent>>;
 workflows(signal?:AbortSignal):Promise<DocumentWorkflow[]>;
 approvers(signal?:AbortSignal):Promise<Approver[]>;
 saveWorkflow(workflow:Omit<DocumentWorkflow,'id'|'version'>,row?:DocumentWorkflow):Promise<DocumentWorkflow>;
}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function invalid():never{throw new CatalogApiError(502,'INVALID_RESPONSE','Phản hồi chứng từ không hợp lệ.');}
function record(value:unknown):DocumentRecord{if(!object(value)||typeof value.id!=='string'||!Number.isSafeInteger(value.version)||!object(value.draft)||!Array.isArray(value.draft.lines)||!object(value.totals)||!object(value.labels))return invalid();return value as unknown as DocumentRecord;}
function page<T>(body:Record<string,unknown>):DocumentPage<T>{const p=body.pagination;if(!Array.isArray(body.data)||!object(p)||!Number.isSafeInteger(p.page)||Number(p.page)<1||!Number.isSafeInteger(p.page_size)||Number(p.page_size)<1||!Number.isSafeInteger(p.total)||Number(p.total)<0)return invalid();return body as unknown as DocumentPage<T>;}
export function createDocumentClient(fetcher:typeof fetch=globalThis.fetch.bind(globalThis)):DocumentClient{
 async function request(path:string,options:RequestInit={}):Promise<Record<string,unknown>>{
  const response=await fetcher('/api/'+path,{...options,credentials:'same-origin',cache:'no-store',redirect:'manual',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})}});
  if(response.type==='opaqueredirect'||response.status===302||response.status===401)throw new CatalogApiError(401,'LOGIN_REQUIRED','Phiên đăng nhập đã hết hạn.');
  if(!response.headers.get('content-type')?.includes('application/json'))throw new CatalogApiError(502,'INVALID_RESPONSE','Máy chủ chưa trả dữ liệu chứng từ.');
  const value:unknown=await response.json();if(!object(value))return invalid();if(!response.ok){const e=object(value.error)?value.error:{};throw new CatalogApiError(response.status,String(e.code??'DOCUMENT_ERROR'),String(e.message??'Không lưu được phiếu.'),typeof e.request_id==='string'?e.request_id:undefined);}return value;
 }
 return {
  async list(options){const params=new URLSearchParams({kind:options.kind,page:String(options.page??1),page_size:'25'});for(const key of ['q','status','from','to'] as const)if(options[key])params.set(key,options[key]!);return page<DocumentSummary>(await request('document-drafts?'+params,{signal:options.signal}));},
  async get(id,signal){return record((await request('document-drafts/'+encodeURIComponent(id),{signal})).data);},
  async save(draft,key,row,reason){return record((await request('document-drafts'+(row?'/'+row.id:''),{method:row?'PATCH':'POST',body:JSON.stringify(row?{action:'save',version:row.version,reason,draft}:{draft,idempotency_key:key})})).data);},
  async action(row,action,reason){return record((await request('document-drafts/'+row.id,{method:'PATCH',body:JSON.stringify({version:row.version,action,reason})})).data);},
  async history(id,current,signal){return page<DocumentEvent>(await request(`document-drafts/${id}?view=history&page=${current}&page_size=25`,{signal}));},
  async workflows(signal){const result=await request('document-workflows',{signal});if(!Array.isArray(result.data))return invalid();return result.data as DocumentWorkflow[];},
  async approvers(signal){const result=await request('document-workflows?view=approvers',{signal});if(!Array.isArray(result.data))return invalid();return result.data as Approver[];},
  async saveWorkflow(workflow,row){const result=await request('document-workflows'+(row?'/'+row.id:''),{method:row?'PATCH':'POST',body:JSON.stringify({...workflow,...(row?{version:row.version}:{})})});if(!object(result.data)||typeof result.data.id!=='string')return invalid();return result.data as unknown as DocumentWorkflow;},
 };
}
