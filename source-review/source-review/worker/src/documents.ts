import {applyIssueInstallation} from "./issueInstallation.ts";
import {recoveryList} from "./recoveryList.ts";
import {documentSymbol} from "../../shared/documents.ts";
import {openingCanModify,openingDependencySql,openingReplacement,openingClearStatements} from "./openingMutations.ts";
import {hasOpeningAssessment,openingUsageAssessment,openingUsageTotals} from "../../shared/openingUsageAssessment.ts";
import {sourceAccessSql,checkSourceAccess} from "./openingManagement.ts";
import {openingVehicleLabel} from "../../shared/openingVehicleLabel.ts";
import {pendingStockValue} from "./pendingValuation.ts";
import {recoveryValuation} from "./recoveryValuation.ts";
import {issueStockCutoff} from "../../shared/issueStockDate.ts";
import {mountPositionLabel} from "../../shared/mountPositionLabel.ts";
import { serialIssueCost, costRound } from "./issuePricing.ts";
import {requireIssueDetails} from "../../shared/issueDetails.ts";
import { issueContext } from "./issueContext.ts";
import { normalizeReceiptUnits } from "../../shared/receiptTotals.ts";
import { receiptPriceSummary } from "../../shared/receiptSummary.ts";
import { inventoryPosting, receiveRetread } from "./inventoryPosting.ts";
import {
  receiptRollback,
  receiptCanModify,
  dependencySql,
} from "./receiptMutations.ts";
import { receiptPosting } from "./receiptPosting.ts";
import { lineSerials, serialKey } from "../../shared/documentSerials.ts";
import {
  documentKinds,
  draftTotals,
  parseDraft,
  editableDraft,
  scaledDecimal,
} from "../../shared/documents.ts";
import type {
  DraftLine,
  DocumentKind,
  DocumentDraft,
  DocumentRecord,
  DocumentWorkflow,
  ApprovalStep,
  DraftStatus,
} from "../../shared/documents.ts";
import {
  foldDocumentSearch,
  documentSearchPattern,
} from "../../shared/documentSearch.ts";
import type { Env, User, Row } from "./types.ts";
import { ApiError, json, readJson } from "./http.ts";
import { requireRole } from "./auth.ts";
const fail = (message: string): never => {
  throw new ApiError(400, "DOCUMENT_VALIDATION", message);
};
function parse(value: unknown) {
  try {
    return parseDraft(value);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Phiếu không hợp lệ.");
  }
}
const str = (value: unknown, max = 1000) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    return fail("Thiếu nội dung hoặc nội dung quá dài.");
  return value.trim();
};
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    return fail("Thiếu phiên bản phiếu.");
  return Number(value);
}
function paging(url: URL) {
  const page = Number(url.searchParams.get("page") ?? 1),
    size = Number(url.searchParams.get("page_size") ?? 25);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  )
    return fail("Trang không hợp lệ.");
  return { page, size };
}
const own = (user: User) => user.role === "warehouse";
const approver = (row: Row, user: User) =>
  row.workflow_json &&
  JSON.parse(String(row.workflow_json)).steps.some((step: ApprovalStep) =>
    step.approver_ids.includes(user.id),
  );
async function rowFor(env: Env, id: string, user: User): Promise<Row> {
  const row = await env.DB.prepare(
    "SELECT d.*,u.display_name AS created_by_name FROM document_drafts d JOIN app_users u ON u.id=d.created_by WHERE d.id=?",
  )
    .bind(id)
    .first<Row>();
  if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiếu.");
  if (own(user) && row.created_by !== user.id && !approver(row, user))
    throw new ApiError(403, "FORBIDDEN", "Chỉ được mở phiếu do mình lập.");
  return row;
}
async function detail(env: Env, row: Row): Promise<DocumentRecord> {
  const lines = await env.DB.prepare(
    "SELECT line_json FROM document_draft_lines WHERE document_id=? ORDER BY line_number",
  )
    .bind(row.id)
    .all<{ line_json: string }>();
  const serialRows = await env.DB.prepare(
    "SELECT line_id,serial_number FROM document_draft_serials WHERE document_id=? ORDER BY rowid",
  )
    .bind(row.id)
    .all<{ line_id: string; serial_number: string }>();
  const header = JSON.parse(String(row.header_json));
  const mountedOpening=header.kind==="opening"&&header.opening_mode==="in_use";

  const savedLabels = JSON.parse(String(row.labels_json));
  if(mountedOpening)for(const raw of lines.results){const l=JSON.parse(raw.line_json);delete savedLabels["valuation_pending:"+l.id];delete savedLabels["valuation_reason:"+l.id];}

  if(header.kind === "opening" && header.opening_mode === "in_use"){
    const vehicles = await env.DB.prepare("SELECT DISTINCT v.id,v.plate_number,v.type,v.brand_model FROM document_draft_lines dl JOIN vehicles v ON v.id=json_extract(dl.line_json,'$.target_id') AND json_extract(dl.line_json,'$.target_type')='vehicle' WHERE dl.document_id=?").bind(row.id).all<Row>();
    for(const vehicle of vehicles.results)savedLabels["vehicles:"+String(vehicle.id)]=openingVehicleLabel(vehicle);
  }

  if(header.kind==="recovery"){
    const eligible=await env.DB.prepare("SELECT json_extract(dl.line_json,'$.id') AS line_id FROM document_draft_lines dl JOIN stock_usages u ON u.id=json_extract(dl.line_json,'$.usage_id') JOIN opening_usage_lines ou ON ou.inventory_line_id=u.root_line_id WHERE dl.document_id=? AND ou.original_unit_price_known=0").bind(row.id).all<Row>();
    for(const item of eligible.results)savedLabels["recovery_market_eligible:"+String(item.line_id)]="1";
  }
  // Legacy receipts did not snapshot supplier tax/address: read current catalog only for missing metadata.
  if (
    header.kind === "receipt" &&
    header.supplier_id &&
    !("tax:suppliers:" + header.supplier_id in savedLabels)
  ) {
    const supplier = await env.DB.prepare(
      "SELECT tax_code,address,province_name FROM suppliers WHERE id=?",
    )
      .bind(header.supplier_id)
      .first<Row>();
    if (supplier) {
      savedLabels["tax:suppliers:" + header.supplier_id] = String(
        supplier.tax_code ?? "",
      );
      savedLabels["address:suppliers:" + header.supplier_id] = String(
        supplier.address ?? "",
      );
      savedLabels["province:suppliers:" + header.supplier_id] = String(
        supplier.province_name ?? "",
      );
    }
  }
  if(header.kind==="recovery"&&row.posted_inventory_id){const amounts=await env.DB.prepare("SELECT line_number,amount_vnd,unit_price_vnd_milli FROM inventory_document_lines WHERE document_id=? ORDER BY line_number").bind(row.posted_inventory_id).all<Row>();for(const entry of amounts.results){const raw=lines.results[Number(entry.line_number)-1];if(raw){const line=JSON.parse(raw.line_json);savedLabels["recovery_amount:"+line.id]=String(entry.amount_vnd);savedLabels["recovery_unit_price:"+line.id]=String(entry.unit_price_vnd_milli);}}}
  if(header.kind==="issue"&&row.posted_inventory_id){const amounts=await env.DB.prepare("SELECT line_number,amount_vnd,quantity_milli,unit_price_vnd_milli FROM inventory_document_lines WHERE document_id=? ORDER BY line_number").bind(row.posted_inventory_id).all<Row>();for(const entry of amounts.results){const raw=lines.results[Number(entry.line_number)-1];if(raw){const line=JSON.parse(raw.line_json);savedLabels["issue_amount:"+line.id]=String(entry.amount_vnd);savedLabels["issue_quantity:"+line.id]=String(entry.quantity_milli);savedLabels["issue_unit_price:"+line.id]=String(entry.unit_price_vnd_milli)}}}
  if(row.posted_inventory_id){const flags=await env.DB.prepare("SELECT l.line_number,f.reason FROM inventory_valuation_flags f JOIN inventory_document_lines l ON l.id=f.inventory_line_id WHERE l.document_id=? AND f.status='pending'").bind(row.posted_inventory_id).all<Row>();for(const flag of flags.results){if(mountedOpening&&flag.reason==="Chưa có giá gốc của vật tư đang sử dụng đầu kỳ.")continue;const raw=lines.results[Number(flag.line_number)-1];if(!raw)continue;const line=JSON.parse(raw.line_json);savedLabels["valuation_pending:"+line.id]="1";savedLabels["valuation_reason:"+line.id]=String(flag.reason);for(const key of ["issue_amount:","issue_unit_price:","issue_serial_costs:","recovery_amount:","recovery_unit_price:","recovery_serial_costs:"])delete savedLabels[key+line.id];}}
  return {
    id: String(row.id),
    version: Number(row.version),
    code: String(row.code),
    status:
      row.status === "cancelled"
        ? "cancelled"
        : row.posted_inventory_id
          ? "posted"
          : (row.status as DraftStatus),
    can_modify: header.kind==="opening"&&header.opening_mode==="in_use"?await openingCanModify(env,String(row.id)):await receiptCanModify(env,String(row.id)),
    operation_state: String(row.operation_state ?? ""),
    draft: {
      ...JSON.parse(String(row.header_json)),
      lines: lines.results.map((l) => {
        const item = JSON.parse(l.line_json);
        const values = serialRows.results
          .filter((s) => s.line_id === item.id)
          .map((s) => s.serial_number);
        return {
          ...item,
          serial: values.length === 1 ? values[0] : item.serial,
          ...(values.length ? { serials: values } : {}),
        };
      }),
    } as DocumentDraft,
    labels: savedLabels,
    totals: mountedOpening?draftTotals({...header,lines:lines.results.map(raw=>JSON.parse(raw.line_json))}):JSON.parse(String(row.totals_json)),
    created_by: String(row.created_by),
    created_by_name: String(row.created_by_name),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    workflow_snapshot: row.workflow_json
      ? JSON.parse(String(row.workflow_json))
      : null,
    approval_step: Number(row.approval_step),
    approval_votes: JSON.parse(String(row.approval_votes)),
  };
}
async function scope(env: Env, user: User, draft: DocumentDraft) {
  requireRole(user, ["admin", "accountant", "warehouse"]);
  if (own(user) && !(draft.kind === "opening" && draft.opening_mode === "in_use")) {
    for (const id of new Set(
      [draft.warehouse_id, draft.to_warehouse_id].filter(Boolean),
    )) {
      if (
        !(await env.DB.prepare(
          "SELECT 1 AS allowed FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?",
        )
          .bind(user.id, id)
          .first())
      )
        throw new ApiError(
          403,
          "WAREHOUSE_SCOPE",
          "Kho chưa được cấp quyền lập chứng từ cho tài khoản.",
        );
    }
  }
}
async function references(
  env: Env,
  draft: DocumentDraft,
  previous?: DocumentRecord,
  complete = false,
) {
  const labels: Record<string, string> = {};
  const old = previous?.draft;
  if(draft.kind==="opening"&&draft.opening_mode==="in_use"&&draft.opening_details){
    const info=draft.opening_details,prior=old?.opening_details;
    if(prior&&["driver_id","driver_name","vehicle_id","vehicle_plate","trailer_number","generator_code"].every(key=>info[key as keyof typeof info]===prior[key as keyof typeof prior])){
      draft.opening_details={...prior,vehicle_odo:info.vehicle_odo??prior.vehicle_odo??"",trailer_odo:info.trailer_odo??prior.trailer_odo??""};
    }else{
      const context=await issueContext(env,"","",info.driver_id);
      if(info.vehicle_id&&info.vehicle_id!==context.vehicle_id)return fail("Xe được phân công cho tài xế đã thay đổi. Chọn lại tài xế.");
      const trailer=context.trailer_number?await env.DB.prepare("SELECT current_odo_km FROM vehicles WHERE plate_number=? AND type='trailer'").bind(context.trailer_number).first<Row>():null;
      draft.opening_details={driver_id:context.driver_id,driver_name:context.driver_name,vehicle_id:context.vehicle_id,vehicle_plate:context.vehicle_plate,trailer_number:context.trailer_number,generator_code:context.other,vehicle_odo:context.vehicle_id?(info.vehicle_odo||context.odo):"",trailer_odo:context.trailer_number?(info.trailer_odo||String(trailer?.current_odo_km??"")):""};
    }
  }
  if(draft.kind==="recovery"&&draft.recovery_details){
    const info=draft.recovery_details,prior=old?.recovery_details;
    if(info.vehicle_id){
      if(prior?.vehicle_id===info.vehicle_id&&prior.driver_id===info.driver_id){Object.assign(info,{vehicle_plate:prior.vehicle_plate,driver_name:prior.driver_name});}
      else{const context=await issueContext(env,"",info.vehicle_id,info.driver_id);info.vehicle_plate=context.vehicle_plate;info.driver_id=context.driver_id;info.driver_name=context.driver_name;}
    }
    for(const [i,line]of draft.lines.entries()){
      if(complete&&line.recovery_quality_percent===undefined)return fail(`Dòng ${i+1}: nhập Chất lượng (% còn lại).`);
      if(!line.odo&&info.odo)line.odo=info.odo;if(!line.hours&&info.hours)line.hours=info.hours;
    }
  }
  if(draft.kind==="issue"&&complete){try{requireIssueDetails(draft.issue_details)}catch(e){return fail((e as Error).message)}}
  if (draft.kind === "issue" && draft.issue_details) {
    const info = draft.issue_details,
      prior = old?.issue_details;
    const unchanged =
      prior &&
      prior.recipient_staff_id === info.recipient_staff_id &&
      prior.vehicle_id === info.vehicle_id &&
      prior.driver_id === info.driver_id;
    if (unchanged) {
      draft.issue_details = {
        ...info,
        department_id: prior.department_id,
        department_name: prior.department_name,
        vehicle_plate: prior.vehicle_plate,
        vehicle_group: prior.vehicle_group,
        driver_name: prior.driver_name,
      };
      if (info.recipient_staff_id) draft.recipient = old!.recipient;
    } else {
      const context = await issueContext(
        env,
        info.recipient_staff_id,
        info.vehicle_id,
        info.driver_id,
      );
      draft.issue_details = {
        ...info,
        department_id: context.department_id,
        department_name: context.department_name,
        driver_id: context.driver_id,
        driver_name: context.driver_name,
        vehicle_plate: context.vehicle_plate,
        vehicle_group: context.vehicle_group,
      };
      if (info.recipient_staff_id) draft.recipient = context.recipient;
    }
  }

  if (draft.kind === "receipt") {
    const rates = (
      await env.DB.prepare(
        "SELECT rate_pct FROM vat_rates WHERE is_active=1",
      ).all<{ rate_pct: number }>()
    ).results.map((r) => String(r.rate_pct));
    for (const [index, line] of draft.lines.entries()) {
      const prior = old?.lines.find((l) => l.id === line.id);
      if (
        !rates.includes(String(Number(line.vat_rate))) &&
        prior?.vat_rate !== line.vat_rate
      )
        return fail(
          `Dòng ${index + 1}: chọn VAT đang sử dụng trong danh mục VAT.`,
        );
    }
    for (const [index, item] of (draft.related_cost_items ?? []).entries()) {
      const prior = old?.related_cost_items?.find((i) => i.id === item.id);
      if (
        !rates.includes(String(Number(item.vat_rate))) &&
        prior?.vat_rate !== item.vat_rate
      )
        return fail(
          `Chi phí ${index + 1}: chọn VAT đang sử dụng trong danh mục VAT.`,
        );
    }
  }

  for (const [key, table] of [
    ["warehouse_id", "warehouses"],
    ["to_warehouse_id", "warehouses"],
    ["supplier_id", "suppliers"],
    ["department_id", "departments"],
  ] as const) {
    const id = draft[key];
    if (!id) continue;
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`)
      .bind(id)
      .first<Row>();
    if (!row || (row.is_active !== 1 && old?.[key] !== id))
      return fail(
        "Chọn lại " +
          {
            warehouse_id: "Kho",
            to_warehouse_id: "Kho nhận",
            supplier_id: "Nhà cung cấp",
            department_id: "Bộ phận đề xuất",
          }[key] +
          " đang hoạt động.",
      );
    labels[table + ":" + id] = row.code + " — " + row.name;
    labels["code:" + table + ":" + id] = String(row.code);
    if (table === "suppliers") {
      labels["tax:suppliers:" + id] = String(row.tax_code ?? "");
      labels["address:suppliers:" + id] = String(row.address ?? "");
      labels["province:suppliers:" + id] = String(row.province_name ?? "");
    }
  }
  const ids = [...new Set(draft.lines.map((l) => l.part_id))],
    parts = await env.DB.prepare(
      `SELECT * FROM parts WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
      .bind(...ids)
      .all<Row>();
  const byId = new Map(parts.results.map((p) => [String(p.id), p]));
  if(draft.kind==="opening"&&draft.opening_mode==="in_use")for(const [index,line]of draft.lines.entries()){
    if(!hasOpeningAssessment(line))continue;
    if(!line.opening_current_unit_price&&Number(byId.get(line.part_id)?.unit_price_vnd)>0)line.opening_current_unit_price=String(byId.get(line.part_id)!.unit_price_vnd);
    if(complete){
      let amount:number|null;
      try{amount=openingUsageAssessment(line).amount_vnd}catch(e){return fail(`Dòng ${index+1}: ${e instanceof Error?e.message:"Số liệu định giá không hợp lệ."}`)}
      if(amount===null)return fail(`Dòng ${index+1}: nhập đủ Nguyên giá, Tỷ lệ còn lại (%) và Người xác nhận.`);
    }
  }

  if (complete) {
    const missing = draft.lines.flatMap((line, index) =>
      byId.get(line.part_id)?.is_serialized === 1 &&
      BigInt(lineSerials(line).length) * 1000n !==
        scaledDecimal(line.quantity, 3, "Số lượng")
        ? [index + 1]
        : [],
    );
    if (missing.length)
      return fail(
        "Có " +
          missing.length +
          " dòng chưa đủ serial: " +
          missing.map((n) => "Dòng " + n).join(", "),
      );
  }
  for (const [index, line] of draft.lines.entries()) {
    try {
      const part = byId.get(line.part_id);
      if (
        !part ||
        (part.is_active !== 1 &&
          !old?.lines.some((l) => l.part_id === line.part_id))
      )
        return fail("Vật tư không tồn tại hoặc đã ngừng hoạt động.");
      labels["parts:" + part.id] = part.sku + " — " + part.name;
      labels["unit:" + part.id] = String(part.unit);
      labels["sku:" + part.id] = String(part.sku);
      labels["serialized:" + part.id] = String(part.is_serialized);
      labels["fuel:" + part.id] = String(part.is_fuel);
      labels["data:" + part.id] = String(part.needs_data_package);
      if (lineSerials(line).length && part.is_serialized !== 1)
        return fail("Vật tư không quản lý SERIAL, không nhập Serial.");
      if (line.tank_id && part.is_fuel !== 1)
        return fail("Vật tư không phải nhiên liệu, không được chọn bồn.");
      if (line.data_package && part.needs_data_package !== 1)
        return fail("Vật tư không sử dụng gói Data.");
      if (part.is_serialized === 1) {
        const qty = scaledDecimal(line.quantity, 3, "Số lượng")!;
        if (qty % 1000n !== 0n)
          return fail("Số lượng vật tư SERIAL phải là số nguyên.");
        if (complete && BigInt(lineSerials(line).length) * 1000n !== qty)
          return fail("Chưa đủ serial theo số lượng thực tế.");
      }
      if (
        ["receipt", "opening"].includes(draft.kind) &&
        lineSerials(line).length
      ) {
        const conflicts = await serialConflicts(
          env,
          line.part_id,
          lineSerials(line),
          ["receipt","opening"].includes(previous?.draft.kind??"") && previous?.status === "posted"
            ? previous.id
            : undefined,
        );
        if (conflicts.length)
          return fail("Serial đã tồn tại trong kho: " + conflicts.join(", "));
      }
      if (
        draft.kind === "retread" &&
        (part.is_serialized !== 1 || part.category !== "tires")
      )
        return fail("Phiếu đắp vỏ chỉ nhận vật tư lốp quản lý SERIAL.");
      const oil = part.is_fuel === 1;
      if(oil&&draft.kind==="opening"&&draft.opening_mode==="in_use")return fail("Không khai báo dầu tiêu hao trong vật tư đang sử dụng đầu kỳ.");
      if (oil && draft.kind === "recovery")
        return fail("Dầu tiêu hao đã cấp dùng không được nhập thu hồi.");
      if (oil && ["receipt", "opening"].includes(draft.kind) && !line.tank_id)
        return fail("Dòng dầu DO cần chọn bồn nhập.");
      if (line.tank_id) {
        const tank = await env.DB.prepare("SELECT * FROM fuel_tanks WHERE id=?")
          .bind(line.tank_id)
          .first<Row>();
        if (
          !tank ||
          tank.warehouse_id !== draft.warehouse_id ||
          tank.is_active !== 1
        )
          return fail("Bồn dầu phải đang hoạt động và thuộc kho của phiếu.");
        labels["fuel-tanks:" + line.tank_id] = tank.code + " — " + tank.name;
      }
    } catch (error) {
      if (error instanceof ApiError)
        return fail("Dòng " + (index + 1) + ": " + error.message);
      throw error;
    }
  }
  await applyIssueInstallation(env,draft,old,complete);
  if(draft.kind==="issue") for(const [index,line] of draft.lines.entries()) {
    if(!line.mount_position_id) continue;
    const prior=old?.lines.find(l=>l.id===line.id);
    if(prior?.mount_position_id===line.mount_position_id&&old?.issue_details?.installation_target===draft.issue_details?.installation_target){line.to_position=prior.to_position;continue;}
    const position=await env.DB.prepare("SELECT code,name,notes,is_active FROM mount_positions WHERE id=?").bind(line.mount_position_id).first<Row>();
    if(!position || position.is_active!==1) return fail(`Dòng ${index+1}: chọn vị trí lắp đang sử dụng.`);
    const selected=draft.issue_details?.installation_target;
    if(selected&&position.notes&&((position.notes==='Rơ moóc'&&selected!=='trailer')||(position.notes==='Đầu kéo'&&selected!=='vehicle')))return fail(`Dòng ${index+1}: Vị trí lắp không phù hợp Phương tiện lắp thiết bị.`);
    line.to_position=mountPositionLabel(position).slice(0,256);
  }
  for (const targetType of ["vehicle", "equipment"] as const) {
    const targetIds = [
      ...new Set(
        draft.lines
          .filter((l) => l.target_type === targetType && l.target_id)
          .map((l) => l.target_id),
      ),
    ];
    if (!targetIds.length) continue;
    const table = targetType === "vehicle" ? "vehicles" : "equipment";
    const rows = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE id IN (${targetIds.map(() => "?").join(",")})`,
    )
      .bind(...targetIds)
      .all<Row>();
    for (const id of targetIds) {
      const row = rows.results.find((r) => r.id === id);
      if (
        !row ||
        (row.status !== "active" &&
          !old?.lines.some(
            (l) => l.target_type === targetType && l.target_id === id,
          ))
      )
        return fail(
          "Dòng " +
            (draft.lines.findIndex(
              (l) => l.target_type === targetType && l.target_id === id,
            ) +
              1) +
            ": Thiết bị nhận không tồn tại hoặc ngừng hoạt động.",
        );
      labels["type:"+table+":"+id]=String(row.source_group??row.type??"");
      labels[table + ":" + id] =
        draft.kind === "opening" && draft.opening_mode === "in_use" && targetType === "vehicle" ? openingVehicleLabel(row) : String(row.plate_number ?? row.code) +
        " — " +
        String(row.name ?? row.brand_model ?? "");
    }
  }
  return labels;
}
async function checkLock(env: Env, draft: DocumentDraft) {
  const period = await env.DB.prepare(
    "SELECT max(period) AS period FROM accounting_periods WHERE is_locked=1",
  ).first<{ period: string | null }>();
  if (period?.period && draft.business_at.slice(0, 7) <= period.period)
    throw new ApiError(409, "PERIOD_LOCKED", "Ngày chứng từ thuộc kỳ đã khóa.");
}
function searchText(
  draft: DocumentDraft,
  labels: Record<string, string>,
  code = "",
) {
  return foldDocumentSearch(
    [
      code,
      ...Object.values(labels),
      draft.recipient,
      draft.invoice_number,
      draft.notes,
      draft.purpose,
      ...Object.values(draft.issue_details ?? {}),
      ...Object.values(draft.opening_details ?? {}),
      ...Object.values(draft.recovery_details ?? {}),
      ...draft.lines.flatMap((l) => [
        ...lineSerials(l),
        l.tank_id,
        l.data_package,
        l.notes,
      ]),
    ].join(" "),
  );
}
function header(draft: DocumentDraft) {
  const { lines, ...fields } = draft;
  return JSON.stringify(fields);
}
async function serialConflicts(
  env: Env,
  partId: string,
  values: string[],
  excludeDocument?: string,
): Promise<string[]> {
  const conflicts: string[] = [];
  for (let start = 0; start < values.length; start += 50) {
    const batch = values.slice(start, start + 50);
    const rows = await env.DB.prepare(
      `SELECT serial_number FROM inventory_serials WHERE part_id=? AND status IN ('in_stock','mounted') AND (?='' OR document_line_id NOT IN (SELECT id FROM inventory_document_lines WHERE document_id=?)) AND serial_key IN (${batch.map(() => "?").join(",")})`,
    )
      .bind(
        partId,
        excludeDocument ?? "",
        excludeDocument ?? "",
        ...batch.map(serialKey),
      )
      .all<{ serial_number: string }>();
    conflicts.push(...rows.results.map((r) => r.serial_number));
  }
  return conflicts;
}
function lines(env: Env, id: string, draft: DocumentDraft) {
  return draft.lines.flatMap((line, index) => {
    const { serials, ...fields } = line;
    const values = lineSerials(line);
    const statement = env.DB.prepare(
      "INSERT INTO document_draft_lines(id,document_id,line_number,part_id,line_json) VALUES (?,?,?,?,?)",
    ).bind(
      line.id,
      id,
      index + 1,
      line.part_id,
      JSON.stringify({ ...fields, serial: "" }),
    );
    return [
      statement,
      ...(values.length
        ? [
            env.DB.prepare(
              "INSERT INTO document_draft_serials(document_id,line_id,part_id,serial_number,serial_key,stock_state) SELECT ?,?,?,json_extract(value,'$.number'),json_extract(value,'$.key'),? FROM json_each(?)",
            ).bind(
              id,
              line.id,
              line.part_id,
              line.stock_state,
              JSON.stringify(
                values.map((value) => ({
                  number: value,
                  key: serialKey(value),
                })),
              ),
            ),
          ]
        : []),
    ];
  });
}
function audit(
  env: Env,
  id: string,
  user: User,
  action: string,
  reason: string,
  before: unknown,
  after: unknown,
  requestId: string,
) {
  return env.DB.prepare(
    "INSERT INTO document_draft_events(id,document_id,actor_id,action,reason,before_json,after_json,request_id) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(
    crypto.randomUUID(),
    id,
    user.id,
    action,
    reason,
    before ? JSON.stringify(before) : null,
    JSON.stringify(after),
    requestId,
  );
}
async function batch(env: Env, statements: D1PreparedStatement[]) {
  try {
    await env.DB.batch(statements);
  } catch (e) {
    if(/OPENING_HAS_DEPENDENCIES|OPENING_EDIT_ONLY/.test(String(e)))throw new ApiError(409,"OPENING_HAS_DEPENDENCIES","Phiếu đầu kỳ đã có thu hồi hoặc giao dịch liên kết; không được sửa trực tiếp.");
    if (/RECEIPT_HAS_DEPENDENCIES/.test(String(e)))
      throw new ApiError(
        409,
        "RECEIPT_HAS_DEPENDENCIES",
        "Phiếu nhập đã có xuất kho hoặc liên kết; không được sửa/xóa.",
      );
    if (/RECEIPT_VERSION_CONFLICT/.test(String(e)))
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "Phiếu đã thay đổi. Tải lại để đối chiếu.",
      );
    if(/UNIQUE constraint failed: opening_usage_lines/.test(String(e)))throw new ApiError(409,"OPENING_USAGE_EXISTS","Vật tư/đối tượng/vị trí đã có khai báo đang sử dụng đầu kỳ. Kiểm tra phiếu đã lập.");
    if (/OPENING_HAS_HISTORY|opening_groups/.test(String(e)))
      throw new ApiError(
        409,
        "OPENING_HAS_HISTORY",
        "Vật tư/kho đã có số dư hoặc lịch sử; không khởi tạo lại.",
      );
    if (
      /CHECK constraint failed:.*(quantity_milli|remaining_quantity|open_quantity|stage)/.test(
        String(e),
      )
    )
      throw new ApiError(
        409,
        "STOCK_CHANGED",
        "Tồn hoặc nguồn đã thay đổi, không đủ số lượng. Tải lại để đối chiếu.",
      );
    if (/RECEIPT_PERIOD_LOCKED/.test(String(e)))
      throw new ApiError(
        409,
        "PERIOD_LOCKED",
        "Ngày chứng từ thuộc kỳ đã khóa.",
      );
    if (/POSTED_DOCUMENT_IMMUTABLE/.test(String(e)))
      throw new ApiError(
        409,
        "POSTED_DOCUMENT_IMMUTABLE",
        "Phiếu đã nhập kho, không sửa trực tiếp.",
      );
    if (/UNIQUE constraint failed: inventory_serials/.test(String(e)))
      throw new ApiError(
        409,
        "SERIAL_IN_STOCK",
        "Serial đã có trong sổ kho; tải lại để đối chiếu.",
      );
    if (
      /UNIQUE constraint failed: document_workflows.department_id, document_workflows.proposal_type/i.test(
        String(e),
      )
    )
      throw new ApiError(
        409,
        "WORKFLOW_EXISTS",
        "Đã có quy trình cho bộ phận và loại này",
      );
    if (/version>=1/.test(String(e)))
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "Phiếu đã thay đổi. Tải lại để đối chiếu.",
      );
    throw e;
  }
}
export async function handleDocuments(
  request: Request,
  env: Env,
  user: User,
  id: string | undefined,
  requestId: string,
): Promise<Response> {
  const url = new URL(request.url);
  if(request.method==="POST"&&id==="recovery-price"){
    const body=await readJson(request);
    if(typeof body.usage_id!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(body.usage_id)||typeof body.part_id!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(body.part_id)||typeof body.quantity!=="string"||!/^\d{1,12}(?:\.\d{1,3})?$/.test(body.quantity)||(body.quality_percent!==undefined&&(typeof body.quality_percent!=="string"||!/^\d{1,3}(?:\.\d{1,2})?$/.test(body.quality_percent)||Number(body.quality_percent)>100)))return fail("Số lượng/chất lượng thu hồi không hợp lệ.");
    if((body.current_unit_price!==undefined&&(typeof body.current_unit_price!=="string"||! /^(?:\d{1,12}(?:\.\d{1,3})?)?$/.test(body.current_unit_price)))||(body.assessor!==undefined&&(typeof body.assessor!=="string"||body.assessor.length>256)))return fail("Giá mua hiện tại/kỹ thuật xác nhận không hợp lệ.");
    const usage=await env.DB.prepare("SELECT u.*,l.from_warehouse_id FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id WHERE u.id=? AND u.part_id=?").bind(body.usage_id,body.part_id).first<Row>();
    if(!usage)return fail("Chọn lần xuất/lắp còn mở.");
    await checkSourceAccess(env,user,String(usage.root_line_id));
    if(["odo","hours"].some(key=>body[key]!==undefined&&(typeof body[key]!=="string"||!/^(?:\d{1,12}(?:\.\d{1,3})?)?$/.test(body[key]as string)))||typeof body.business_at!=="string"||!Array.isArray(body.serials)||body.serials.length>1000||body.serials.some(v=>typeof v!=="string"||v.length>128))return fail("Mốc tháo/serial thu hồi không hợp lệ.");
    const valuation=await recoveryValuation(env,usage,{quantity:body.quantity,business_at:body.business_at,odo:String(body.odo??""),hours:String(body.hours??""),serials:body.serials as string[],current_unit_price:body.current_unit_price as string|undefined,quality_percent:body.quality_percent as string|undefined,assessor:body.assessor as string|undefined});
    return json({data:valuation});
  }
  if(request.method==="GET"&&!id&&url.searchParams.get("view")==="recovery-sources"){
    const vehicleId=url.searchParams.get("vehicle_id")??"",q=url.searchParams.get("q")?.trim()??"";
    if(q.length>128||(vehicleId&&!/^[a-zA-Z0-9_-]{1,128}$/.test(vehicleId)))return fail("Bộ lọc vật tư đang sử dụng không hợp lệ.");
    const {page,size}=paging(url),args:unknown[]=[];
    let where="u.open_quantity_milli>0 AND (d.type='OUT' OR (d.type='OPENING' AND ou.inventory_line_id IS NOT NULL)) AND d.status='posted' AND (p.is_serialized=0 OR (us.active=1 AND s.status='mounted'))";
    if(vehicleId){where+=" AND EXISTS(SELECT 1 FROM vehicles v WHERE v.id=? AND ((u.target_type='vehicle' AND u.target_id=v.id) OR EXISTS(SELECT 1 FROM equipment_pairing_drafts ep WHERE ep.parent_code=v.plate_number AND ep.is_active=1 AND ep.child_code=CASE u.target_type WHEN 'vehicle' THEN (SELECT plate_number FROM vehicles WHERE id=u.target_id) ELSE (SELECT code FROM equipment WHERE id=u.target_id) END)))";args.push(vehicleId);}
    if(own(user)){where+=" AND "+sourceAccessSql();args.push(user.id,user.id);}
    if(q){const pattern="%"+q.toUpperCase().replace(/[\\%_]/g,c=>"\\"+c)+"%";where+=" AND (upper(p.sku) LIKE ? ESCAPE '\\' OR upper(coalesce(us.serial_key,'')) LIKE ? ESCAPE '\\' OR upper(d.code) LIKE ? ESCAPE '\\')";args.push(pattern,pattern,pattern);}
    const from=" FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id JOIN inventory_documents d ON d.id=l.document_id JOIN parts p ON p.id=u.part_id LEFT JOIN opening_usage_lines ou ON ou.inventory_line_id=u.root_line_id LEFT JOIN document_drafts od ON od.posted_inventory_id=l.document_id LEFT JOIN document_draft_lines odl ON odl.document_id=od.id AND odl.line_number=l.line_number LEFT JOIN usage_serials us ON us.usage_id=u.id AND us.active=1 LEFT JOIN inventory_serials s ON s.part_id=us.part_id AND s.serial_key=us.serial_key WHERE "+where;
    const result=await env.DB.batch([env.DB.prepare("SELECT u.id AS usage_id,u.root_line_id,p.id AS part_id,p.sku,p.name,p.unit,p.version AS part_version,p.is_serialized,s.serial_number AS serial_number,CASE u.target_type WHEN 'vehicle' THEN (SELECT plate_number FROM vehicles WHERE id=u.target_id) ELSE (SELECT code FROM equipment WHERE id=u.target_id) END AS target_label,u.position,d.code,u.started_at,u.odo_milli,u.hours_milli,CASE WHEN p.is_serialized=1 THEN 1000 ELSE u.open_quantity_milli END AS quantity_milli,u.quantity_milli AS issued_quantity_milli,u.open_quantity_milli,CASE WHEN ou.inventory_line_id IS NOT NULL THEN 'opening_usage' ELSE 'issue' END AS source_kind,ou.installed_at AS opening_installed_at,ou.original_unit_price_known AS opening_original_unit_price_known,json_extract(odl.line_json,'$.opening_current_unit_price') AS opening_current_unit_price,json_extract(odl.line_json,'$.opening_quality_percent') AS opening_quality_percent,json_extract(odl.line_json,'$.opening_assessor') AS opening_assessor,json_extract(odl.line_json,'$.opening_confirmation_basis') AS opening_confirmation_basis,EXISTS(SELECT 1 FROM inventory_valuation_flags f WHERE f.inventory_line_id=u.root_line_id AND f.status='pending' AND NOT (ou.inventory_line_id IS NOT NULL AND f.reason='Chưa có giá gốc của vật tư đang sử dụng đầu kỳ.')) AS valuation_pending"+from+" ORDER BY u.started_at DESC,u.id,us.serial_key LIMIT ? OFFSET ?").bind(...args,size,(page-1)*size),env.DB.prepare("SELECT count(*) AS total"+from).bind(...args)]);
    return json({data:result[0].results,pagination:{page,page_size:size,total:Number((result[1].results[0]as Row).total)}});
  }
  if(request.method==="GET"&&!id&&url.searchParams.get("view")==="recovery-serials"){
    const usageId=url.searchParams.get("usage_id")??"",q=url.searchParams.get("q")??"";
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(usageId)||q.length>128)return fail("Nguồn thu hồi không hợp lệ.");
    const usage=await env.DB.prepare("SELECT u.id,u.root_line_id,l.from_warehouse_id FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id WHERE u.id=? AND u.open_quantity_milli>0").bind(usageId).first<Row>();
    if(!usage)return fail("Lần xuất/lắp không còn mở.");
    await checkSourceAccess(env,user,String(usage.root_line_id));
    const {page,size}=paging(url),pattern="%"+serialKey(q).replace(/[\\%_]/g,c=>"\\"+c)+"%";
    const where="u.usage_id=? AND u.active=1 AND s.status='mounted' AND s.serial_key LIKE ? ESCAPE '\\'";
    const result=await env.DB.batch([env.DB.prepare("SELECT s.serial_number FROM usage_serials u JOIN inventory_serials s ON s.part_id=u.part_id AND s.serial_key=u.serial_key WHERE "+where+" ORDER BY s.serial_key LIMIT ? OFFSET ?").bind(usageId,pattern,size,(page-1)*size),env.DB.prepare("SELECT count(*) AS total FROM usage_serials u JOIN inventory_serials s ON s.part_id=u.part_id AND s.serial_key=u.serial_key WHERE "+where).bind(usageId,pattern)]);
    return json({data:result[0].results,pagination:{page,page_size:size,total:Number((result[1].results[0]as Row).total)}});
  }
  if (request.method === "POST" && id === "issue-price") {
    const body=await readJson(request), part=body.part_id, warehouse=body.warehouse_id, state=body.stock_state;
    if(typeof part!=="string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(part) || typeof warehouse!=="string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(warehouse) || !["new","recovered"].includes(String(state)) || typeof body.quantity!=="string" || !/^\d{1,12}(?:\.\d{1,3})?$/.test(body.quantity)) return fail("Thông tin tính giá xuất không hợp lệ.");
    if(own(user) && !await env.DB.prepare("SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?").bind(user.id,warehouse).first()) throw new ApiError(403,"WAREHOUSE_SCOPE","Kho chưa được cấp quyền.");
    let cutoff:string|undefined;
    if(body.business_at){try{cutoff=issueStockCutoff(String(body.business_at));}catch{return fail("Ngày chứng từ không hợp lệ.");}}
    const q=Number(scaledDecimal(body.quantity,3,"Số lượng"));
    const item=await env.DB.prepare("SELECT is_serialized FROM parts WHERE id=?").bind(part).first<Row>();
    const bucket=await env.DB.prepare("SELECT quantity_milli,value_vnd FROM stock_buckets WHERE part_id=? AND warehouse_id=? AND stock_state=?").bind(part,warehouse,state).first<Row>();
    if(!item || q<=0 || !bucket || q>Number(bucket.quantity_milli)) return fail("Không đủ tồn kho để tính giá xuất.");
    let amount: number;
    const serialPrices=new Map<string,number>();
    if(item.is_serialized===1){
      if(!Array.isArray(body.serials) || body.serials.length>1000 || body.serials.length*1000!==q || body.serials.some(v=>typeof v!=="string" || v.length>128)) return fail("Chọn đủ serial để tính giá xuất.");
      amount=await serialIssueCost(env,part,warehouse,String(state),body.serials as string[],cutoff,serialPrices);
      if(q===Number(bucket.quantity_milli) && Math.abs(amount-Number(bucket.value_vnd))<=body.serials.length) amount=Number(bucket.value_vnd);
      if(amount>Number(bucket.value_vnd)) return fail("Giá trị tồn kho không đủ theo giá nhập serial đã chọn.");
    } else {
      if(cutoff && await env.DB.prepare("SELECT 1 FROM stock_lots WHERE part_id=? AND warehouse_id=? AND stock_state=? AND remaining_quantity_milli>0 AND available_at>? LIMIT 1").bind(part,warehouse,state,cutoff).first())return fail("Ngày giờ xuất trước thời điểm nhập của hàng đang tham gia giá bình quân.");
      amount=q===Number(bucket.quantity_milli)?Number(bucket.value_vnd):costRound(BigInt(String(bucket.value_vnd))*BigInt(q),BigInt(String(bucket.quantity_milli)));
    }
    const pending=await pendingStockValue(env,part,warehouse,String(state),item.is_serialized===1?body.serials as string[]:[]);if(pending)return json({data:{amount_vnd:null,unit_price_vnd_milli:null,valuation_status:"pending",warning:"Chưa xác định giá trị – vẫn được xuất, cần bổ sung sau. "+String(pending.reason)}});
    return json({data:{amount_vnd:amount,unit_price_vnd_milli:item.is_serialized===1?costRound([...serialPrices.values()].reduce((sum,price)=>sum+BigInt(price),0n),BigInt(serialPrices.size)):costRound(BigInt(String(bucket.value_vnd))*1000000n,BigInt(String(bucket.quantity_milli)))}});
  }
  if (
    request.method === "GET" &&
    !id &&
    url.searchParams.get("view") === "creators"
  ) {
    const creatorKind = url.searchParams.get("kind") ?? "receipt";
    if (!["receipt", "issue"].includes(creatorKind))
      return fail("Loại chứng từ không hợp lệ.");
    const rows = own(user)
      ? await env.DB.prepare("SELECT id,display_name FROM app_users WHERE id=?")
          .bind(user.id)
          .all()
      : await env.DB.prepare(
          "SELECT id,display_name FROM app_users WHERE EXISTS(SELECT 1 FROM document_drafts d WHERE d.created_by=app_users.id AND d.kind=?) ORDER BY display_name,id",
        )
          .bind(creatorKind)
          .all();
    return json({ data: rows.results });
  }

  if (request.method === "GET") {
    if (!id && url.searchParams.get("view") === "issue-context") {
      const ids = ["staff_id", "vehicle_id", "driver_id"].map(
        (k) => url.searchParams.get(k) ?? "",
      );
      if (ids.some((v) => v.length > 128))
        return fail("Lựa chọn không hợp lệ.");
      return json({ data: await issueContext(env, ids[0], ids[1], ids[2]) });
    }

    if (
      !id &&
      ["sources", "usages"].includes(url.searchParams.get("view") ?? "")
    ) {
      const part = url.searchParams.get("part_id") ?? "",
        warehouse = url.searchParams.get("warehouse_id") ?? "",
        state = url.searchParams.get("stock_state") ?? "new";
      const { page, size } = paging(url);
      if (
        !part ||
        part.length > 128 ||
        warehouse.length > 128 ||
        (url.searchParams.get("view")==="sources" && !["new", "recovered", "pending_scrap"].includes(state))
      )
        return fail("Bộ lọc nguồn không hợp lệ.");
      if (
        url.searchParams.get("view") === "sources" &&
        own(user) &&
        (!warehouse ||
          !(await env.DB.prepare(
            "SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?",
          )
            .bind(user.id, warehouse)
            .first()))
      )
        throw new ApiError(403, "WAREHOUSE_SCOPE", "Kho chưa được cấp quyền.");
      if (url.searchParams.get("view") === "sources") {
        const where =
          "s.part_id=? AND s.warehouse_id=? AND s.stock_state=? AND s.remaining_quantity_milli>0 AND d.status='posted'";
        const result = await env.DB.batch([
          env.DB.prepare(
            `SELECT s.source_line_id AS id,d.code,s.remaining_quantity_milli AS quantity_milli,s.available_at FROM stock_lots s JOIN inventory_document_lines l ON l.id=s.source_line_id JOIN inventory_documents d ON d.id=l.document_id WHERE ${where} ORDER BY s.available_at,s.source_line_id LIMIT ? OFFSET ?`,
          ).bind(part, warehouse, state, size, (page - 1) * size),
          env.DB.prepare(
            `SELECT count(*) AS total FROM stock_lots s JOIN inventory_document_lines l ON l.id=s.source_line_id JOIN inventory_documents d ON d.id=l.document_id WHERE ${where}`,
          ).bind(part, warehouse, state),
        ]);
        return json({
          data: result[0].results,
          pagination: {
            page,
            page_size: size,
            total: Number((result[1].results[0] as Row).total),
          },
        });
      }
      const scopeSql = own(user)
        ? " AND EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.user_id=? AND a.warehouse_id=l.from_warehouse_id)"
        : "";
      const vehicleId=url.searchParams.get("vehicle_id")??"";
      if(vehicleId&&!/^[a-zA-Z0-9_-]{1,128}$/.test(vehicleId))return fail("Phương tiện lọc nguồn không hợp lệ.");
      const vehicleSql=vehicleId?" AND EXISTS(SELECT 1 FROM vehicles v WHERE v.id=? AND ((u.target_type='vehicle' AND u.target_id=v.id) OR EXISTS(SELECT 1 FROM equipment_pairing_drafts ep WHERE ep.parent_code=v.plate_number AND ep.is_active=1 AND ep.child_code=CASE u.target_type WHEN 'vehicle' THEN (SELECT plate_number FROM vehicles WHERE id=u.target_id) ELSE (SELECT code FROM equipment WHERE id=u.target_id) END)))":"";
      const args: unknown[] = [part, ...(vehicleId?[vehicleId]:[]), ...(own(user) ? [user.id] : [])];
      const result = await env.DB.batch([
        env.DB.prepare(
          `SELECT u.id,d.code,u.open_quantity_milli AS quantity_milli,u.target_id,u.target_type,u.position,u.started_at,CASE u.target_type WHEN 'vehicle' THEN (SELECT plate_number FROM vehicles WHERE id=u.target_id) ELSE (SELECT code FROM equipment WHERE id=u.target_id) END AS target_label FROM stock_usages u JOIN inventory_documents d ON d.id=u.document_id JOIN inventory_document_lines l ON l.id=u.root_line_id WHERE u.part_id=? AND u.open_quantity_milli>0 ${vehicleSql} ${scopeSql} ORDER BY u.started_at,u.id LIMIT ? OFFSET ?`,
        ).bind(...args, size, (page - 1) * size),
        env.DB.prepare(
          `SELECT count(*) AS total FROM stock_usages u JOIN inventory_document_lines l ON l.id=u.root_line_id WHERE u.part_id=? AND u.open_quantity_milli>0 ${vehicleSql} ${scopeSql}`,
        ).bind(...args),
      ]);
      return json({
        data: result[0].results,
        pagination: {
          page,
          page_size: size,
          total: Number((result[1].results[0] as Row).total),
        },
      });
    }

    if (!id && url.searchParams.get("view") === "available-serials") {
      const part = url.searchParams.get("part_id") ?? "",
        warehouse = url.searchParams.get("warehouse_id") ?? "",
        state = url.searchParams.get("stock_state") ?? "new",
        q = url.searchParams.get("q") ?? "";
      if (
        !part ||
        !warehouse ||
        part.length > 128 ||
        warehouse.length > 128 ||
        q.length > 128 ||
        !["new", "recovered"].includes(state)
      )
        return fail("Bộ lọc serial không hợp lệ.");
      if (
        own(user) &&
        !(await env.DB.prepare(
          "SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?",
        )
          .bind(user.id, warehouse)
          .first())
      )
        throw new ApiError(403, "WAREHOUSE_SCOPE", "Kho chưa được cấp quyền.");
      const { page, size } = paging(url);
      const pattern =
        "%" + serialKey(q).replace(/[\\%_]/g, (c) => "\\" + c) + "%";
      let cutoff:string|undefined;
      const businessAt=url.searchParams.get("business_at");
      if(businessAt){try{cutoff=issueStockCutoff(businessAt);}catch{return fail("Ngày chứng từ không hợp lệ.");}}
      const where =
        "part_id=? AND warehouse_id=? AND stock_state=? AND status='in_stock' AND serial_key LIKE ? ESCAPE '\\'" + (cutoff ? " AND EXISTS(SELECT 1 FROM stock_lots l WHERE l.source_line_id=inventory_serials.document_line_id AND l.available_at<=?)" : "");
      const args=[part,warehouse,state,pattern,...(cutoff?[cutoff]:[])];
      const result = await env.DB.batch([
        env.DB.prepare(
          "SELECT serial_number,CASE WHEN EXISTS(SELECT 1 FROM inventory_valuation_flags f WHERE f.inventory_line_id=inventory_serials.document_line_id AND f.status='pending') THEN NULL ELSE coalesce(round(cost_vnd_milli/1000.0),(SELECT round(original_value_vnd*1000.0/initial_quantity_milli) FROM stock_lots WHERE source_line_id=inventory_serials.document_line_id)) END AS unit_cost_vnd FROM inventory_serials WHERE " +
            where +
            " ORDER BY serial_key LIMIT ? OFFSET ?",
        ).bind(...args, size, (page - 1) * size),
        env.DB.prepare(
          "SELECT count(*) total FROM inventory_serials WHERE " + where,
        ).bind(...args),
      ]);
      return json({
        data: result[0].results,
        pagination: {
          page,
          page_size: size,
          total: (result[1].results[0] as { total: number }).total,
        },
      });
    }
    if (!id && url.searchParams.get("view") === "stock") {
      const part = url.searchParams.get("part_id") ?? "",
        warehouse = url.searchParams.get("warehouse_id") ?? "";
      if (!part || part.length > 128 || warehouse.length > 128)
        return fail("Vật tư hoặc kho không hợp lệ.");
      if (
        own(user) &&
        (!warehouse ||
          !(await env.DB.prepare(
            "SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?",
          )
            .bind(user.id, warehouse)
            .first()))
      )
        throw new ApiError(403, "WAREHOUSE_SCOPE", "Kho chưa được cấp quyền.");
      const state = url.searchParams.get("stock_state") ?? "";
      if (state && !["new", "recovered", "pending_scrap"].includes(state))
        return fail("Trạng thái hàng không hợp lệ.");
      const result = await env.DB.prepare(
        state
          ? "SELECT coalesce(sum(quantity_milli),0) AS quantity_milli,coalesce(sum(value_vnd),0) AS value_vnd FROM stock_buckets WHERE part_id=? AND (?='' OR warehouse_id=?) AND stock_state=?"
          : "SELECT coalesce(sum(quantity_milli),0) AS quantity_milli,coalesce(sum(value_vnd),0) AS value_vnd FROM stock_balances WHERE part_id=? AND (?='' OR warehouse_id=?)",
      )
        .bind(
          ...(state
            ? [part, warehouse, warehouse, state]
            : [part, warehouse, warehouse]),
        )
        .first<{
          quantity_milli: number;
          value_vnd: number;
          quantity_known?: boolean;
        }>();
      const exclude = url.searchParams.get("exclude_document");
      if (exclude) {
        const old = await rowFor(env, exclude, user);
        if (old.kind !== "receipt")
          return fail("Chỉ loại trừ tồn của phiếu nhập.");
        const delta = await env.DB.prepare(
          "SELECT coalesce(sum(m.quantity_delta_milli),0) AS q,coalesce(sum(m.value_delta_vnd),0) AS v FROM stock_movements m JOIN inventory_document_lines l ON l.id=m.document_line_id JOIN inventory_documents d ON d.id=l.document_id WHERE d.id=? AND d.status='posted' AND m.part_id=? AND (?='' OR m.warehouse_id=?)",
        )
          .bind(old.posted_inventory_id ?? "", part, warehouse, warehouse)
          .first<{ q: number; v: number }>();
        if (result && delta) {
          const snapshot = await env.DB.prepare(
            "SELECT min(r.stock_before_quantity_milli) AS q,min(r.stock_before_value_vnd) AS v FROM receipt_line_details r JOIN inventory_document_lines l ON l.id=r.inventory_line_id JOIN inventory_documents d ON d.id=l.document_id WHERE d.id=? AND d.status='posted' AND l.part_id=? AND (?='' OR l.to_warehouse_id=?)",
          )
            .bind(old.posted_inventory_id ?? "", part, warehouse, warehouse)
            .first<{ q: number | null; v: number | null }>();
          if (delta.q !== 0 && snapshot?.q == null)
            result.quantity_known = false;
          result.quantity_milli =
            snapshot?.q ?? result.quantity_milli - delta.q;
          result.value_vnd = snapshot?.v ?? result.value_vnd - delta.v;
        }
      }
      const pending=await env.DB.prepare("SELECT 1 FROM stock_lots l JOIN inventory_valuation_flags f ON f.inventory_line_id=l.source_line_id AND f.status='pending' WHERE l.part_id=? AND (?='' OR l.warehouse_id=?) AND (?='' OR l.stock_state=?) AND l.remaining_quantity_milli>0 LIMIT 1").bind(part,warehouse,warehouse,state,state).first();
      return json({ data: {...result,...(pending?{value_vnd:null,valuation_status:"pending"}:{})} });
    }

    if (!id && url.searchParams.get("view") === "serial-check") {
      const partId = url.searchParams.get("part_id") ?? "",
        values = url.searchParams.getAll("serial");
      if (
        !partId ||
        partId.length > 128 ||
        values.length > 50 ||
        values.some((v) => !v || v.length > 128)
      )
        return fail("Yêu cầu kiểm tra serial không hợp lệ.");
      const exclude = url.searchParams.get("exclude_document") ?? "";
      if (exclude) {
        const previous = await detail(env, await rowFor(env, exclude, user));
        if (previous.draft.kind !== "receipt" || !previous.can_modify)
          return fail("Phiếu không được sửa serial.");
      }
      return json({
        data: {
          conflicts: await serialConflicts(env, partId, values, exclude),
        },
      });
    }

    if (!id && url.searchParams.get("view") === "next-number") {
      const kind = url.searchParams.get("kind") ?? "",
        date = url.searchParams.get("date") ?? "",
        departmentId = url.searchParams.get("department_id") ?? "";
      if (
        !Object.hasOwn(documentKinds, kind) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date + "T00:00Z")) ||
        new Date(date + "T00:00Z").toISOString().slice(0, 10) !== date ||
        departmentId.length > 128
      )
        return fail("Loại phiếu hoặc ngày chứng từ không hợp lệ.");
      const openingMode=url.searchParams.get("opening_mode");
      if(openingMode!==null&&(kind!=="opening"||!["stock","in_use"].includes(openingMode)))return fail("Loại đầu kỳ không hợp lệ.");
      const symbol = documentSymbol(kind as DocumentKind,openingMode==="in_use"?"in_use":"stock");
      const counter = await env.DB.prepare(
        "SELECT last_no FROM document_counters WHERE period=? AND kind=?",
      )
        .bind(date.slice(0, 7), symbol)
        .first<{ last_no: number }>();
      const number = (counter?.last_no ?? 0) + 1;
      if (number > 99999)
        throw new ApiError(
          409,
          "NUMBER_EXHAUSTED",
          "Đã hết dãy số phiếu trong tháng.",
        );
      let suffix = "";
      if (kind === "proposal" && departmentId) {
        const dept = await env.DB.prepare(
          "SELECT code FROM departments WHERE id=? AND is_active=1",
        )
          .bind(departmentId)
          .first<{ code: string }>();
        if (!dept) return fail("Chọn bộ phận đề xuất đang hoạt động.");
        suffix = "/" + dept.code;
      }
      return json({
        data: {
          code:
            date.slice(5, 7) +
            "." +
            date.slice(2, 4) +
            "." +
            String(number).padStart(5, "0") +
            "/" +
            symbol +
            suffix,
        },
      });
    }
    if (id) {
      const row = await rowFor(env, id, user);
      if (url.searchParams.get("view") === "history") {
        const { page, size } = paging(url);
        const results = await env.DB.batch([
          env.DB.prepare(
            "SELECT e.*,u.display_name AS actor_name FROM document_draft_events e JOIN app_users u ON u.id=e.actor_id WHERE document_id=? ORDER BY e.created_at DESC,e.rowid DESC LIMIT ? OFFSET ?",
          ).bind(id, size, (page - 1) * size),
          env.DB.prepare(
            "SELECT count(*) AS total FROM document_draft_events WHERE document_id=?",
          ).bind(id),
        ]);
        return json({
          data: results[0].results,
          pagination: {
            page,
            page_size: size,
            total: (results[1].results[0] as { total: number }).total,
          },
        });
      }
      return json({ data: await detail(env, row) });
    }
    if(url.searchParams.get("kind")==="recovery")return recoveryList(url,env,user);
    const { page, size } = paging(url),
      kind = url.searchParams.get("kind") ?? "receipt",
      status = url.searchParams.get("status") ?? "",
      q = url.searchParams.get("q") ?? "",
      from = url.searchParams.get("from") ?? "",
      to = url.searchParams.get("to") ?? "",
      warehouse = url.searchParams.get("warehouse_id") ?? "",
      supplier = url.searchParams.get("supplier_id") ?? "",
      creator = url.searchParams.get("created_by") ?? "";
    if (
      !Object.hasOwn(documentKinds, kind) ||
      ![
        "",
        "draft",
        "posted",
        "pending",
        "approved",
        "returned",
        "rejected",
        "cancelled",
      ].includes(status) ||
      q.length > 200 ||
      [from, to].some(
        (v) =>
          v &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
            !Number.isFinite(Date.parse(v + "T00:00Z")) ||
            new Date(v + "T00:00Z").toISOString().slice(0, 10) !== v),
      ) ||
      (from && to && from > to) ||
      warehouse.length > 128 ||
      supplier.length > 128 ||
      creator.length > 128
    )
      return fail("Bộ lọc không hợp lệ.");

    const conditions = ["d.kind=?", "(d.deleted_at IS NULL OR ?='cancelled')"],
      args: unknown[] = [kind, status];
    if (status) {
      conditions.push(
        "(CASE WHEN d.status='cancelled' THEN 'cancelled' WHEN d.posted_inventory_id IS NOT NULL THEN 'posted' ELSE d.status END)=?",
      );
      args.push(status);
    }
    if (q) {
      conditions.push(
        "(d.search_text LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM document_draft_serials ds WHERE ds.document_id=d.id AND ds.serial_key LIKE ? ESCAPE '\\') OR (d.kind='opening' AND EXISTS(SELECT 1 FROM json_each(d.header_json,'$.opening_details') od WHERE od.key IN ('driver_name','vehicle_plate','trailer_number','generator_code') AND od.value LIKE ? ESCAPE '\\')))",
      );
      args.push(
        documentSearchPattern(q),
        "%" + serialKey(q).replace(/[\\%_]/g, (c) => "\\" + c) + "%",
        "%"+q.trim().replace(/[\\%_]/g,c=>"\\"+c)+"%",
      );
    }
    if (from) {
      conditions.push("d.business_at>=?");
      args.push(from);
    }
    if (to) {
      conditions.push("d.business_at<?");
      args.push(to + "T23:59:59");
    }
    if (warehouse) {
      conditions.push("d.warehouse_id=?");
      args.push(warehouse);
    }
    const pendingFilter=url.searchParams.get("valuation_pending")??"0";if(!["0","1"].includes(pendingFilter))return fail("Bộ lọc định giá không hợp lệ.");
    if(pendingFilter==="1")conditions.push("EXISTS(SELECT 1 FROM inventory_valuation_flags f JOIN inventory_document_lines l ON l.id=f.inventory_line_id WHERE l.document_id=d.posted_inventory_id AND f.status='pending' AND NOT (d.kind='opening' AND json_extract(d.header_json,'$.opening_mode')='in_use' AND f.reason='Chưa có giá gốc của vật tư đang sử dụng đầu kỳ.'))");
    const openingMode=url.searchParams.get("opening_mode");if(openingMode!==null){if(kind!=="opening"||!["stock","in_use"].includes(openingMode))return fail("Loại đầu kỳ không hợp lệ.");conditions.push("coalesce(json_extract(d.header_json,'$.opening_mode'),'stock')=?");args.push(openingMode);}
    if (supplier) {
      conditions.push("d.supplier_id=?");
      args.push(supplier);
    }
    if (creator) {
      conditions.push("d.created_by=?");
      args.push(creator);
    }
    if (own(user)) {
      conditions.push(
        "(d.created_by=? OR EXISTS(SELECT 1 FROM json_each(d.workflow_json,'$.steps') step,json_each(step.value,'$.approver_ids') voter WHERE voter.value=?))",
      );
      args.push(user.id, user.id);
    }
    const sort = url.searchParams.get("sort") ?? "business_at",
      direction = url.searchParams.get("direction") ?? "desc";
    const sortColumns: Record<string, string> = {
      code: "d.code",
      business_at: "d.business_at",
      gross: "json_extract(d.totals_json,'$.gross')",
    };
    if (
      !Object.hasOwn(sortColumns, sort) ||
      !["asc", "desc"].includes(direction)
    )
      return fail("Sắp xếp không hợp lệ.");
    const orderBy =
      (sort === "gross"
        ? "(json_extract(d.totals_json,'$.gross') IS NULL) ASC,"
        : "") +
      sortColumns[sort] +
      " " +
      direction.toUpperCase() +
      ",d.id " +
      direction.toUpperCase();
    const totalsOption = url.searchParams.get("include_totals") ?? "1";
    if (!["0", "1"].includes(totalsOption))
      return fail("Tùy chọn tổng không hợp lệ.");
    const includeTotals =
      ["receipt", "issue"].includes(kind) && totalsOption !== "0";
    const where = conditions.join(" AND ");
    const selected =
      "d.id,d.version,d.code,d.kind,d.business_at,CASE WHEN d.status='cancelled' THEN 'cancelled' WHEN d.posted_inventory_id IS NOT NULL THEN 'posted' ELSE d.status END AS status,d.totals_json,d.created_by,d.created_at,d.updated_at,u.display_name AS created_by_name,(SELECT count(*) FROM document_draft_lines l WHERE l.document_id=d.id) AS line_count,(SELECT json_group_array(json(l.line_json)) FROM document_draft_lines l WHERE l.document_id=d.id) AS summary_lines_json,(SELECT json_group_array(ds.serial_number) FROM document_draft_serials ds WHERE ds.document_id=d.id) AS serial_numbers_json,(SELECT eu.display_name FROM document_draft_events e JOIN app_users eu ON eu.id=e.actor_id WHERE e.document_id=d.id AND e.action='save' AND e.before_json IS NOT NULL ORDER BY e.created_at DESC,e.rowid DESC LIMIT 1) AS last_edited_by_name,d.labels_json,d.header_json,d.operation_state" +
      `,CASE WHEN d.status<>'cancelled' AND d.deleted_at IS NULL AND d.posted_inventory_id IS NOT NULL AND ((d.kind='receipt' AND NOT (${dependencySql()})) OR (d.kind='opening' AND json_extract(d.header_json,'$.opening_mode')='in_use' AND NOT (${openingDependencySql()}) AND coalesce(substr(d.business_at,1,7)>(SELECT max(period) FROM accounting_periods WHERE is_locked=1),1))) THEN 1 ELSE 0 END AS can_modify`;
    const results = await env.DB.batch([
      env.DB.prepare(
        `SELECT ${selected} FROM document_drafts d JOIN app_users u ON u.id=d.created_by WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      ).bind(...args, size, (page - 1) * size),
      env.DB.prepare(
        includeTotals
          ? `SELECT count(*) AS total, coalesce(sum(CASE WHEN d.status<>'cancelled' AND d.posted_inventory_id IS NOT NULL THEN 1 ELSE 0 END),0) AS posted_count,coalesce(sum(CASE WHEN d.status='cancelled' THEN 1 ELSE 0 END),0) AS cancelled_count, ${["net", "vat", "gross"].map((k) => `CASE WHEN count(*)=count(json_extract(d.totals_json,'$.${k}')) THEN CAST(coalesce(sum(json_extract(d.totals_json,'$.${k}')),0) AS TEXT) ELSE NULL END AS ${k}`).join(",")} FROM document_drafts d WHERE ${where}`
          : `SELECT count(*) AS total FROM document_drafts d WHERE ${where}`,
      ).bind(...args),
      ...(includeTotals
        ? [
            env.DB.prepare(
              `SELECT CAST(coalesce(sum(CAST(json_extract(l.line_json,'$.quantity') AS INTEGER)*1000 + CASE WHEN instr(json_extract(l.line_json,'$.quantity'),'.')>0 THEN CAST(substr(substr(json_extract(l.line_json,'$.quantity'),instr(json_extract(l.line_json,'$.quantity'),'.')+1)||'000',1,3) AS INTEGER) ELSE 0 END),0) AS TEXT) AS quantity_milli, json_group_array(DISTINCT coalesce(json_extract(d.labels_json,'$."unit:'||l.part_id||'"'),'')) AS units_json FROM document_drafts d JOIN document_draft_lines l ON l.document_id=d.id WHERE ${where}`,
            ).bind(...args),
          ]
        : []),
    ]);
    const rows = results[0].results.map((raw) => {
      const r = raw as Row,
        labels = JSON.parse(String(r.labels_json)),
        head = JSON.parse(String(r.header_json)),
        {
          labels_json,
          header_json,
          totals_json,
          summary_lines_json,
          serial_numbers_json,
          ...rest
        } = r;
      const summaryLines = JSON.parse(
        String(summary_lines_json),
      ) as DraftLine[];
      return {
        ...rest,
        ...(r.kind === "receipt" ? receiptPriceSummary(summaryLines) : {}),
        ...(r.kind==="opening"&&head.opening_mode==="in_use"?{...(head.opening_details?{opening_details:head.opening_details}:{}),opening_original_value_vnd:openingUsageTotals(summaryLines).base_vnd,opening_target_labels:[...new Set(summaryLines.map(l=>labels[(l.target_type==="vehicle"?"vehicles:":"equipment:")+l.target_id]).filter((value):value is string=>typeof value==="string"&&!!value))]}:{}),
        total_quantity: String(
          summaryLines.reduce(
            (sum, l) => sum + BigInt(scaledDecimal(l.quantity, 3, "Số lượng")!),
            0n,
          ),
        ),
        quantity_units: normalizeReceiptUnits(
          summaryLines.map((l) => String(labels["unit:" + l.part_id] ?? "")),
        ),
        serial_numbers: JSON.parse(String(serial_numbers_json)),
        invoice_number: head.invoice_number ?? "",
        purpose: head.purpose ?? "",
        can_modify: r.can_modify === 1,
        totals: r.kind==="opening"&&head.opening_mode==="in_use"?draftTotals({...head,lines:summaryLines}):JSON.parse(String(totals_json)),
        warehouse_label: labels["warehouses:" + head.warehouse_id] ?? "",

        partner_label:
          r.kind === "issue"
            ? head.recipient
            : (labels["suppliers:" + head.supplier_id] ?? head.recipient),
      };
    });
    const overall = results[1].results[0] as {
      total: number;
      posted_count?: number;
      cancelled_count?: number;
      net: string | null;
      vat: string | null;
      gross: string | null;
    };
    const quantities = results[2]?.results[0] as {
      quantity_milli: string;
      units_json: string;
    };
    return json({
      data: rows,
      ...(includeTotals
        ? {
            receipt_totals: {
              count: overall.total,
              status_counts: {
                posted: overall.posted_count ?? 0,
                cancelled: overall.cancelled_count ?? 0,
              },
              net: overall.net,
              vat: overall.vat,
              gross: overall.gross,
              quantity_milli: quantities.quantity_milli,
              units: normalizeReceiptUnits(JSON.parse(quantities.units_json)),
            },
          }
        : {}),
      pagination: {
        page,
        page_size: size,
        total: (results[1].results[0] as { total: number }).total,
      },
    });
  }
  if (request.method === "POST" && !id) {
    const body = await readJson(request, 256 * 1024);
    if (
      Object.keys(body).some(
        (k) => !["draft", "idempotency_key", "commit"].includes(k),
      )
    )
      return fail("Trường yêu cầu không hợp lệ.");
    const key = str(body.idempotency_key, 128),
      draft = parse(body.draft);
    await scope(env, user, draft);
    if (body.commit !== undefined && typeof body.commit !== "boolean")
      return fail("Yêu cầu lưu phiếu không hợp lệ.");
    const commit = body.commit === true;
    if (commit && draft.kind === "proposal")
      return fail("Chỉ phiếu nhập được lưu cập nhật tồn trong bước này.");
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify(commit ? { draft, commit: true } : draft),
        ),
      ),
      hash = Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const existing = await env.DB.prepare(
      "SELECT id,create_hash,created_by FROM document_drafts WHERE create_key=?",
    )
      .bind(key)
      .first<Row>();
    if (existing) {
      if (existing.create_hash !== hash || existing.created_by !== user.id)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Mã yêu cầu đã dùng cho nội dung khác.",
        );
      return json({
        data: await detail(env, await rowFor(env, String(existing.id), user)),
      });
    }
    await checkLock(env, draft);
    const labels = await references(env, draft, undefined, commit),
      id = crypto.randomUUID(),
      period = draft.business_at.slice(0, 7),
      symbol = documentSymbol(draft.kind,draft.opening_mode);
    const suffix =
      draft.kind === "proposal"
        ? "/" + (labels["code:departments:" + draft.department_id] ?? "")
        : "";
    const search = searchText(draft, labels);
    const statements = [
      env.DB.prepare(
        "INSERT INTO document_counters(period,kind,last_no) VALUES (?,?,1) ON CONFLICT(period,kind) DO UPDATE SET last_no=last_no+1",
      ).bind(period, symbol),
      env.DB.prepare(
        "INSERT INTO document_drafts(id,code,kind,business_at,warehouse_id,to_warehouse_id,supplier_id,department_id,header_json,labels_json,totals_json,search_text,created_by,create_key,create_hash) SELECT ?,printf('%s.%s.%05d/%s',?,?,last_no,?)||?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM document_counters WHERE period=? AND kind=?",
      ).bind(
        id,
        draft.business_at.slice(5, 7),
        draft.business_at.slice(2, 4),
        symbol,
        suffix,
        draft.kind,
        draft.business_at,
        draft.warehouse_id || null,
        draft.to_warehouse_id || null,
        draft.supplier_id || null,
        draft.department_id || null,
        header(draft),
        JSON.stringify(labels),
        JSON.stringify(draftTotals(draft)),
        search,
        user.id,
        key,
        hash,
        period,
        symbol,
      ),
      env.DB.prepare(
        "UPDATE document_drafts SET search_text=search_text||' '||lower(replace(code,'Đ','d')) WHERE id=?",
      ).bind(id),
      ...lines(env, id, draft),
      ...(commit
        ? draft.kind === "receipt"
          ? await receiptPosting(env, id, draft, user, labels)
          : await inventoryPosting(env, id, draft, user, labels)
        : []),
      audit(
        env,
        id,
        user,
        commit ? "post" : "create",
        commit ? "Lưu và ghi sổ" : "Lập phiếu",
        null,
        { draft, labels, status: commit ? "posted" : "draft" },
        requestId,
      ),
    ];
    try {
      await batch(env, statements);
    } catch (e) {
      const retry = await env.DB.prepare(
        "SELECT * FROM document_drafts WHERE create_key=?",
      )
        .bind(key)
        .first<Row>();
      if (retry && retry.create_hash === hash && retry.created_by === user.id)
        return json({
          data: await detail(env, await rowFor(env, String(retry.id), user)),
        });
      throw e;
    }
    return json({ data: await detail(env, await rowFor(env, id, user)) }, 201);
  }
  if (request.method === "PATCH" && id) {
    const body = await readJson(request, 256 * 1024);
    if (
      Object.keys(body).some(
        (k) => !["version", "action", "reason", "draft", "commit"].includes(k),
      )
    )
      return fail("Trường yêu cầu không hợp lệ.");
    const expected = version(body.version),
      reason = str(body.reason),
      action = str(body.action, 32),
      row = await rowFor(env, id, user),
      before = await detail(env, row);
    if (before.version !== expected)
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "Phiếu đã thay đổi. Tải lại để đối chiếu.",
      );
    if (before.status === "posted") {
      await scope(env, user, before.draft);
      if (before.draft.kind === "retread" && action === "receive") {
        const draft = parse(body.draft);
        if (
          draft.kind !== "retread" ||
          draft.warehouse_id !== before.draft.warehouse_id ||
          draft.business_at < before.draft.business_at
        )
          return fail("Ngày nhận hoặc kho nhận đắp không hợp lệ.");
        await checkLock(env, draft);
        const labels = await references(env, draft, before, true);
        await batch(env, [
          env.DB.prepare(
            "INSERT INTO receipt_mutation_locks(document_id,expected_version,actor_id,mode) VALUES (?,?,?,'receive')",
          ).bind(id, expected, user.id),
          ...(await receiveRetread(env, id, draft, user, labels)),
          audit(
            env,
            id,
            user,
            "receive",
            reason,
            before,
            { draft, labels, status: "posted", operation_state: "received" },
            requestId,
          ),
          env.DB.prepare(
            "DELETE FROM receipt_mutation_locks WHERE document_id=?",
          ).bind(id),
        ]);
        return json({ data: await detail(env, await rowFor(env, id, user)) });
      }
      if(before.draft.kind==="opening"&&before.draft.opening_mode==="in_use"&&action==="save"){
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
      if (
        before.draft.kind !== "receipt" ||
        !["save", "delete"].includes(action)
      )
        throw new ApiError(
          409,
          "POSTED_DOCUMENT_IMMUTABLE",
          "Phiếu đã ghi sổ; không sửa/hủy trực tiếp.",
        );
      await checkLock(env, before.draft);
      if (!(await receiptCanModify(env, id)))
        throw new ApiError(
          409,
          "RECEIPT_HAS_DEPENDENCIES",
          "Phiếu nhập đã có xuất kho hoặc giao dịch liên kết; không được sửa/xóa.",
        );
      if (action === "delete") {
        const statements = await receiptRollback(env, id, expected, user, true);
        await batch(env, [
          ...statements,
          audit(
            env,
            id,
            user,
            "delete",
            reason,
            before,
            { draft: before.draft, labels: before.labels, status: "cancelled" },
            requestId,
          ),
          env.DB.prepare(
            "DELETE FROM receipt_mutation_locks WHERE document_id=?",
          ).bind(id),
        ]);
        return json({ data: await detail(env, await rowFor(env, id, user)) });
      }
      const draft = parse(body.draft);
      if (
        draft.kind !== "receipt" ||
        draft.business_at.slice(0, 7) !== before.draft.business_at.slice(0, 7)
      )
        return fail("Không đổi loại hoặc tháng của phiếu đã cấp số.");
      await scope(env, user, draft);
      await checkLock(env, draft);
      const labels = await references(env, draft, before, true);
      await batch(env, [
        ...(await receiptRollback(env, id, expected, user)),
        env.DB.prepare(
          "UPDATE document_drafts SET version=version+1,business_at=?,warehouse_id=?,supplier_id=?,header_json=?,labels_json=?,totals_json=?,search_text=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        ).bind(
          draft.business_at,
          draft.warehouse_id,
          draft.supplier_id || null,
          header(draft),
          JSON.stringify(labels),
          JSON.stringify(draftTotals(draft)),
          searchText(draft, labels, before.code),
          id,
        ),
        env.DB.prepare(
          "DELETE FROM document_draft_lines WHERE document_id=?",
        ).bind(id),
        ...lines(env, id, draft),
        ...(await receiptPosting(env, id, draft, user, labels, true)),
        audit(
          env,
          id,
          user,
          "save",
          reason,
          before,
          { draft, labels, status: "posted" },
          requestId,
        ),
        env.DB.prepare(
          "DELETE FROM receipt_mutation_locks WHERE document_id=?",
        ).bind(id),
      ]);
      return json({ data: await detail(env, await rowFor(env, id, user)) });
    }
    if (["post", "receive", "resume"].includes(action))
      throw new ApiError(
        409,
        "POSTING_NOT_ENABLED",
        "Bước này chỉ chuẩn bị chứng từ; chưa bật ghi sổ kho.",
      );
    await checkLock(env, before.draft);
    if (action === "save") {
      if (!editableDraft(before.status))
        throw new ApiError(
          409,
          "INVALID_STATE",
          "Chỉ sửa phiếu Nháp hoặc Trả về.",
        );
      const draft = parse(body.draft);
      if (
        draft.kind !== before.draft.kind ||
        draft.business_at.slice(0, 7) !== before.draft.business_at.slice(0, 7)
      )
        return fail("Không đổi loại hoặc tháng sau khi đã cấp số.");
      await scope(env, user, draft);
      await checkLock(env, draft);
      const commit = body.commit === true;
      if (body.commit !== undefined && typeof body.commit !== "boolean")
        return fail("Yêu cầu lưu không hợp lệ.");
      if (commit && draft.kind === "proposal")
        return fail("Chỉ phiếu nhập được lưu cập nhật tồn.");
      const labels = await references(env, draft, before, commit);
      await batch(env, [
        env.DB.prepare(
          "UPDATE document_drafts SET version=CASE WHEN version=? THEN version+1 ELSE -1 END,business_at=?,warehouse_id=?,to_warehouse_id=?,supplier_id=?,department_id=?,header_json=?,labels_json=?,totals_json=?,search_text=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        ).bind(
          expected,
          draft.business_at,
          draft.warehouse_id || null,
          draft.to_warehouse_id || null,
          draft.supplier_id || null,
          draft.department_id || null,
          header(draft),
          JSON.stringify(labels),
          JSON.stringify(draftTotals(draft)),
          searchText(draft, labels, before.code),
          id,
        ),
        env.DB.prepare(
          "DELETE FROM document_draft_lines WHERE document_id=?",
        ).bind(id),
        ...lines(env, id, draft),
        ...(commit
          ? draft.kind === "receipt"
            ? await receiptPosting(env, id, draft, user, labels)
            : await inventoryPosting(env, id, draft, user, labels)
          : []),
        audit(
          env,
          id,
          user,
          action,
          reason,
          before,
          { draft, labels, status: commit ? "posted" : before.status },
          requestId,
        ),
      ]);
    } else {
      let status = before.status,
        snapshot = before.workflow_snapshot,
        step = before.approval_step,
        votes = [...before.approval_votes];
      if (action === "cancel") {
        requireRole(user, ["admin", "accountant"]);
        if (status === "cancelled")
          throw new ApiError(409, "INVALID_STATE", "Phiếu đã hủy.");
        status = "cancelled";
      } else if (action === "submit") {
        await scope(env, user, before.draft);
        if (before.draft.kind !== "proposal" || !editableDraft(status))
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Chỉ gửi đề xuất Nháp hoặc Trả về.",
          );
        await references(env, before.draft, before, true);
        const workflow = await env.DB.prepare(
          "SELECT * FROM document_workflows WHERE department_id=? AND proposal_type=? AND is_active=1",
        )
          .bind(before.draft.department_id, before.draft.proposal_type)
          .first<Row>();
        if (!workflow)
          throw new ApiError(
            409,
            "WORKFLOW_REQUIRED",
            "Chưa có quy trình duyệt cho bộ phận và loại đề xuất.",
          );
        snapshot = {
          name: String(workflow.name),
          steps: JSON.parse(String(workflow.steps_json)),
        };
        status = "pending";
        step = 0;
        votes = [];
      } else if (action === "revoke") {
        requireRole(user, ["admin", "accountant"]);
        if (status !== "approved")
          throw new ApiError(
            409,
            "INVALID_STATE",
            "Phiếu chưa được duyệt xong.",
          );
        status = "returned";
      } else if (["approve", "return", "reject"].includes(action)) {
        if (
          status !== "pending" ||
          !snapshot?.steps[step]?.approver_ids.includes(user.id)
        )
          throw new ApiError(
            403,
            "APPROVAL_SCOPE",
            "Không thuộc bước duyệt hiện tại.",
          );
        if (action === "approve")
          await references(env, before.draft, before, true);
        if (action === "return") status = "returned";
        else if (action === "reject") status = "rejected";
        else {
          if (votes.includes(user.id))
            throw new ApiError(
              409,
              "ALREADY_APPROVED",
              "Bạn đã duyệt bước này.",
            );
          votes.push(user.id);
          const current = snapshot.steps[step];
          if (
            current.mode === "any" ||
            current.approver_ids.every((id) => votes.includes(id))
          ) {
            step++;
            votes = [];
            if (step >= snapshot.steps.length) status = "approved";
          }
        }
      } else return fail("Thao tác không được hỗ trợ.");
      await batch(env, [
        env.DB.prepare(
          "UPDATE document_drafts SET version=CASE WHEN version=? THEN version+1 ELSE -1 END,status=?,workflow_json=?,approval_step=?,approval_votes=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
        ).bind(
          expected,
          status,
          snapshot ? JSON.stringify(snapshot) : null,
          step,
          JSON.stringify(votes),
          id,
        ),
        audit(
          env,
          id,
          user,
          action,
          reason,
          before,
          {
            draft: before.draft,
            labels: before.labels,
            status,
            snapshot,
            step,
            votes,
          },
          requestId,
        ),
      ]);
    }
    return json({ data: await detail(env, await rowFor(env, id, user)) });
  }
  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Thao tác không được hỗ trợ.");
}
export async function handleDocumentWorkflows(
  request: Request,
  env: Env,
  user: User,
  id: string | undefined,
  requestId: string,
): Promise<Response> {
  if (request.method === "GET") {
    if (new URL(request.url).searchParams.get("view") === "approvers") {
      requireRole(user, ["admin", "accountant"]);
      const users = await env.DB.prepare(
        "SELECT id,display_name,role FROM app_users WHERE is_active=1 ORDER BY display_name",
      ).all();
      return json({ data: users.results });
    }
    const rows = await env.DB.prepare(
      "SELECT * FROM document_workflows ORDER BY name,id LIMIT 200",
    ).all<Row>();
    return json({
      data: rows.results.map((row) => ({
        ...row,
        steps: JSON.parse(String(row.steps_json)),
        steps_json: undefined,
      })),
    });
  }
  if (!(
    (request.method === "POST" && !id) ||
    (request.method === "PATCH" && id)
  ))
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      "Thao tác không được hỗ trợ.",
    );
  requireRole(user, ["admin"]);
  const body = await readJson(request);
  if (
    Object.keys(body).some(
      (k) =>
        ![
          "version",
          "name",
          "department_id",
          "proposal_type",
          "steps",
          "is_active",
        ].includes(k),
    )
  )
    return fail("Cấu hình có trường không hợp lệ.");
  const name = str(body.name, 256),
    department = str(body.department_id, 128),
    kind = str(body.proposal_type, 32);
  if (
    !["purchase", "issue", "transfer", "repair"].includes(kind) ||
    typeof body.is_active !== "number" ||
    ![0, 1].includes(body.is_active)
  )
    return fail("Cấu hình không hợp lệ.");
  if (
    !(await env.DB.prepare(
      "SELECT id FROM departments WHERE id=? AND is_active=1",
    )
      .bind(department)
      .first())
  )
    return fail("Bộ phận không hoạt động.");
  if (
    !Array.isArray(body.steps) ||
    body.steps.length < 1 ||
    body.steps.length > 10
  )
    return fail("Quy trình cần 1–10 bước.");
  const steps: ApprovalStep[] = [];
  for (const raw of body.steps) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return fail("Bước duyệt không hợp lệ.");
    const s = raw as Record<string, unknown>;
    if (
      Object.keys(s).some(
        (k) => !["label", "mode", "approver_ids"].includes(k),
      ) ||
      !["any", "all"].includes(String(s.mode)) ||
      !Array.isArray(s.approver_ids) ||
      s.approver_ids.length < 1 ||
      s.approver_ids.length > 20
    )
      return fail("Bước duyệt cần người được phân công.");
    const ids = [...new Set(s.approver_ids.map((value) => str(value, 128)))];
    for (const userId of ids)
      if (
        !(await env.DB.prepare(
          "SELECT id FROM app_users WHERE id=? AND is_active=1 AND role!='viewer'",
        )
          .bind(userId)
          .first())
      )
        return fail("Người duyệt không hợp lệ.");
    steps.push({
      label: str(s.label, 256),
      mode: s.mode as "any" | "all",
      approver_ids: ids,
    });
  }
  const previous = id
    ? await env.DB.prepare("SELECT * FROM document_workflows WHERE id=?")
        .bind(id)
        .first<Row>()
    : null;
  if (id && !previous)
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy quy trình.");
  const key = id ?? crypto.randomUUID();
  let statement: D1PreparedStatement;
  if (id) {
    statement = env.DB.prepare(
      "UPDATE document_workflows SET version=CASE WHEN version=? THEN version+1 ELSE -1 END,name=?,department_id=?,proposal_type=?,steps_json=?,is_active=? WHERE id=?",
    ).bind(
      version(body.version),
      name,
      department,
      kind,
      JSON.stringify(steps),
      body.is_active,
      key,
    );
  } else
    statement = env.DB.prepare(
      "INSERT INTO document_workflows(id,name,department_id,proposal_type,steps_json,is_active) VALUES (?,?,?,?,?,?)",
    ).bind(key, name, department, kind, JSON.stringify(steps), body.is_active);
  await batch(env, [
    statement,
    env.DB.prepare(
      "INSERT INTO audit_events(id,actor_id,action,entity_type,entity_id,before_json,after_json,reason,request_id) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      crypto.randomUUID(),
      user.id,
      id ? "update" : "create",
      "document_workflow",
      key,
      previous ? JSON.stringify(previous) : null,
      JSON.stringify({
        name,
        department,
        kind,
        steps,
        is_active: body.is_active,
      }),
      "Cấu hình quy trình duyệt",
      requestId,
    ),
  ]);
  return json(
    {
      data: {
        id: key,
        version: previous ? Number(previous.version) + 1 : 1,
        name,
        department_id: department,
        proposal_type: kind,
        steps,
        is_active: body.is_active,
      } as DocumentWorkflow,
    },
    id ? 200 : 201,
  );
}


