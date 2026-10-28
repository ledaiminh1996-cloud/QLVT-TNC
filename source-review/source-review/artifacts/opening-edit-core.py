from pathlib import Path
Path('worker/src/openingMutations.ts').write_text('''import type {Env,Row} from "./types.ts";
import type {DocumentRecord} from "../../shared/documents.ts";
import type {OpeningReplacement} from "./inventoryPosting.ts";
/** Rechecked by the mutation-lock trigger in the same atomic batch as the edit. */
export function openingDependencySql(alias="d"):string{
 return `EXISTS(SELECT 1 FROM inventory_document_lines l WHERE l.document_id=${alias}.posted_inventory_id AND (NOT EXISTS(SELECT 1 FROM opening_usage_lines ou WHERE ou.inventory_line_id=l.id) OR (SELECT count(*) FROM stock_usages u WHERE u.root_line_id=l.id)<>1 OR EXISTS(SELECT 1 FROM stock_usages u WHERE u.root_line_id=l.id AND (u.parent_usage_id IS NOT NULL OR u.open_quantity_milli<>u.quantity_milli)) OR EXISTS(SELECT 1 FROM stock_movements m WHERE m.document_line_id=l.id) OR EXISTS(SELECT 1 FROM stock_lots lot WHERE lot.source_line_id=l.id) OR EXISTS(SELECT 1 FROM stock_cost_dependencies c WHERE c.source_line_id=l.id OR c.consumer_line_id=l.id) OR EXISTS(SELECT 1 FROM stock_source_allocations a WHERE a.source_line_id=l.id OR a.consumer_line_id=l.id) OR EXISTS(SELECT 1 FROM inventory_valuation_flags f WHERE f.origin_line_id=l.id AND f.inventory_line_id<>l.id) OR EXISTS(SELECT 1 FROM equipment_operations e JOIN stock_usages u ON u.id=e.from_usage_id OR u.id=e.to_usage_id WHERE u.root_line_id=l.id) OR EXISTS(SELECT 1 FROM retread_jobs j WHERE j.send_line_id=l.id OR j.received_line_id=l.id) OR EXISTS(SELECT 1 FROM usage_serials us JOIN stock_usages u ON u.id=us.usage_id WHERE u.root_line_id=l.id AND (us.active<>1 OR NOT EXISTS(SELECT 1 FROM inventory_serials s WHERE s.part_id=us.part_id AND s.serial_key=us.serial_key AND s.document_line_id=l.id AND s.status='mounted'))) OR EXISTS(SELECT 1 FROM document_draft_lines dl JOIN document_drafts other ON other.id=dl.document_id JOIN stock_usages u ON u.id=json_extract(dl.line_json,'$.usage_id') WHERE u.root_line_id=l.id AND other.id<>${alias}.id AND other.deleted_at IS NULL AND other.status<>'cancelled')))`;
}
export async function openingCanModify(env:Env,id:string){const row=await env.DB.prepare(`SELECT d.kind,d.status,d.header_json,d.deleted_at,d.posted_inventory_id,(${openingDependencySql()}) AS used,coalesce(substr(d.business_at,1,7)>(SELECT max(period) FROM accounting_periods WHERE is_locked=1),1) AS unlocked FROM document_drafts d WHERE d.id=?`).bind(id).first<Row>();return !!row&&row.kind==="opening"&&JSON.parse(String(row.header_json)).opening_mode==="in_use"&&row.status!=="cancelled"&&!row.deleted_at&&!!row.posted_inventory_id&&row.used===0&&row.unlocked===1;}
export async function openingReplacement(env:Env,before:DocumentRecord):Promise<OpeningReplacement>{
 const roots=await env.DB.prepare("SELECT l.id,l.line_number,u.id AS usage_id,u.version AS usage_version FROM inventory_document_lines l JOIN stock_usages u ON u.root_line_id=l.id WHERE l.document_id=? ORDER BY l.line_number").bind(before.id).all<Row>();
 return {sources:Object.fromEntries(roots.results.map(root=>[before.draft.lines[Number(root.line_number)-1].id,{line_id:String(root.id),usage_id:String(root.usage_id),usage_version:Number(root.usage_version)}]))};
}
export function openingClearStatements(env:Env,id:string){return [
 env.DB.prepare("DELETE FROM usage_serials WHERE usage_id IN (SELECT u.id FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id WHERE l.document_id=?)").bind(id),
 env.DB.prepare("DELETE FROM stock_usages WHERE root_line_id IN (SELECT id FROM inventory_document_lines WHERE document_id=?)").bind(id),
 env.DB.prepare("DELETE FROM inventory_serials WHERE document_line_id IN (SELECT id FROM inventory_document_lines WHERE document_id=?) AND status='mounted'").bind(id),
 env.DB.prepare("DELETE FROM inventory_valuation_flags WHERE inventory_line_id IN (SELECT id FROM inventory_document_lines WHERE document_id=?)").bind(id),
 env.DB.prepare("DELETE FROM opening_usage_lines WHERE inventory_line_id IN (SELECT id FROM inventory_document_lines WHERE document_id=?)").bind(id),
 env.DB.prepare("DELETE FROM inventory_document_lines WHERE document_id=?").bind(id),
 ];}
''',encoding='utf-8')
p=Path('worker/src/inventoryPosting.ts');s=p.read_text(encoding='utf-8').replace('class Plan {','export interface OpeningReplacement {sources:Record<string,{line_id:string;usage_id:string;usage_version:number}>}\nclass Plan {');s=s.replace('  readonly labels: Record<string, string>;','  readonly labels: Record<string, string>;\n  readonly replacement?:OpeningReplacement;');s=s.replace('    labels: Record<string, string>,\n  ) {','    labels: Record<string, string>,\n    replacement?:OpeningReplacement,\n  ) {',1).replace('    this.labels = labels;','    this.labels = labels;\n    this.replacement=replacement;',1);s=s.replace('    const q = qty(line);\n    this.stmt(\n      "INSERT INTO stock_usages','    const q = qty(line);\n    id=this.replacement?.sources[line.id]?.usage_id??id;\n    this.stmt(\n      "INSERT INTO stock_usages',1);s=s.replace('started_at,odo_milli,hours_milli) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)','started_at,odo_milli,hours_milli,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');s=s.replace('      line.hours ? Number(scaledDecimal(line.hours, 3, "Giờ")) : null,\n    );','      line.hours ? Number(scaledDecimal(line.hours, 3, "Giờ")) : null,\n      (this.replacement?.sources[line.id]?.usage_version??0)+1,\n    );',1);s=s.replace('  labels: Record<string, string>,\n): Promise<D1PreparedStatement[]> {','  labels: Record<string, string>,\n  replacement?:OpeningReplacement,\n): Promise<D1PreparedStatement[]> {',1);s=s.replace('  const plan = new Plan(env, id, draft, labels);\n  plan.statements.push(','  if(replacement&&!(draft.kind==="opening"&&draft.opening_mode==="in_use"))error("Chỉ thay thế dữ liệu đầu kỳ đang sử dụng.");\n  const plan = new Plan(env, id, draft, labels,replacement);\n  if(!replacement)plan.statements.push(',1);s=s.replace('      const lineId = crypto.randomUUID();','      const lineId = replacement?.sources[line.id]?.line_id??crypto.randomUUID();',1);p.write_text(s,encoding='utf-8')
p=Path('worker/src/documents.ts');s=p.read_text(encoding='utf-8');s='import {openingCanModify,openingDependencySql,openingReplacement,openingClearStatements} from "./openingMutations.ts";\n'+s;s=s.replace('can_modify: await receiptCanModify(env, String(row.id)),','can_modify: (await receiptCanModify(env, String(row.id)))||(await openingCanModify(env,String(row.id))),');s=s.replace('previous?.draft.kind === "receipt" && previous.status === "posted"','["receipt","opening"].includes(previous?.draft.kind??"") && previous?.status === "posted"');needle='''  } catch (e) {
    if (/RECEIPT_HAS_DEPENDENCIES/.test(String(e)))''';s=s.replace(needle,'''  } catch (e) {
    if(/OPENING_HAS_DEPENDENCIES|OPENING_EDIT_ONLY/.test(String(e)))throw new ApiError(409,"OPENING_HAS_DEPENDENCIES","Phiếu đầu kỳ đã có thu hồi hoặc giao dịch liên kết; không được sửa trực tiếp.");
    if (/RECEIPT_HAS_DEPENDENCIES/.test(String(e)))''',1);needle='''      if (
        before.draft.kind !== "receipt" ||''';branch='''      if(before.draft.kind==="opening"&&before.draft.opening_mode==="in_use"&&action==="save"){
        if(!reason.trim())return fail("Nhập lý do sửa phiếu.");
        await checkLock(env,before.draft);
        if(!await openingCanModify(env,id))throw new ApiError(409,"OPENING_HAS_DEPENDENCIES","Phiếu đầu kỳ đã có thu hồi hoặc giao dịch liên kết; không được sửa trực tiếp.");
        const draft=parse(body.draft);
        if(draft.kind!=="opening"||draft.opening_mode!=="in_use"||draft.business_at.slice(0,7)!==before.draft.business_at.slice(0,7))return fail("Không đổi loại hoặc tháng của phiếu đã cấp số.");
        await scope(env,user,draft);await checkLock(env,draft);
        const labels=await references(env,draft,before,true),replacement=await openingReplacement(env,before);
        const posting=await inventoryPosting(env,id,draft,user,labels,replacement);
        await batch(env,[
          env.DB.prepare("INSERT INTO receipt_mutation_locks(document_id,expected_version,actor_id,mode) VALUES(?,?,?,'edit')").bind(id,expected,user.id),
          ...openingClearStatements(env,id),
          env.DB.prepare("UPDATE inventory_documents SET business_date=?,notes=? WHERE id=?").bind(draft.business_at.slice(0,10),draft.notes||null,id),
          env.DB.prepare("UPDATE document_drafts SET version=version+1,business_at=?,warehouse_id=NULL,header_json=?,labels_json=?,totals_json=?,search_text=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(draft.business_at,header(draft),JSON.stringify(labels),JSON.stringify(draftTotals(draft)),searchText(draft,labels,before.code),id),
          env.DB.prepare("DELETE FROM document_draft_serials WHERE document_id=?").bind(id),
          env.DB.prepare("DELETE FROM document_draft_lines WHERE document_id=?").bind(id),
          ...lines(env,id,draft),...posting,
          audit(env,id,user,"save",reason,before,{draft,labels,status:"posted"},requestId),
          env.DB.prepare("DELETE FROM receipt_mutation_locks WHERE document_id=?").bind(id),
        ]);
        return json({data:await detail(env,await rowFor(env,id,user))});
      }
''';assert needle in s;s=s.replace(needle,branch+needle,1);old="CASE WHEN d.kind='receipt' AND d.status<>'cancelled' AND d.deleted_at IS NULL AND d.posted_inventory_id IS NOT NULL AND NOT (${dependencySql()}) THEN 1 ELSE 0 END AS can_modify";new="CASE WHEN d.status<>'cancelled' AND d.deleted_at IS NULL AND d.posted_inventory_id IS NOT NULL AND ((d.kind='receipt' AND NOT (${dependencySql()})) OR (d.kind='opening' AND json_extract(d.header_json,'$.opening_mode')='in_use' AND NOT (${openingDependencySql()}) AND coalesce(substr(d.business_at,1,7)>(SELECT max(period) FROM accounting_periods WHERE is_locked=1),1))) THEN 1 ELSE 0 END AS can_modify";assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
