import {parseRecoveryDetails,recoveryClasses} from "../../shared/recoveryDetails";
import {
  parseIssueDetails,
  emptyIssueDetails,
} from "../../shared/issueDetails";
import { CatalogApiError } from "../api/catalogClient";
import type {
  DocumentDraft,
  DocumentRecord,
  DocumentSummary,
  DocumentWorkflow,
} from "../../shared/documents";
export interface DocumentPage<T> {
  data: T[];
  receipt_totals?: import("../../shared/receiptTotals").ReceiptTotals;
  pagination: { page: number; page_size: number; total: number };
}
export interface DocumentEvent {
  id: string;
  actor_name: string;
  action: string;
  reason: string;
  created_at: string;
  before_json: string | null;
  after_json: string;
}
export interface Approver {
  id: string;
  display_name: string;
  role: string;
}
export interface ListDocuments {
  kind: string;
  part_id?:string;recovery_classification?:string;recovery_vehicle?:string;recovery_recipient?:string;
  page?: number;
  pageSize?: number;
  includeTotals?: boolean;
  sort?: import("../../shared/receiptSort").ReceiptSort;
  direction?: import("../../shared/receiptSort").SortDirection;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  warehouse_id?: string;
  supplier_id?: string;
  created_by?: string;
  valuation_pending?:string;
  opening_mode?:"stock"|"in_use";
  signal?: AbortSignal;
}
export interface PriceQuote {amount_vnd:number|null;unit_price_vnd_milli:number|null;valuation_status?:"known"|"pending";warning?:string}
export interface DocumentClient {
  recoverySources?(q:string,current:number,vehicleId:string,signal?:AbortSignal):Promise<DocumentPage<import("../../shared/recoverySources").RecoverySourceRow>>;
  recoveryPrice?(input:{usage_id:string;part_id:string;quantity:string;quality_percent?:string;current_unit_price?:string;assessor?:string;business_at:string;odo:string;hours:string;serials:string[]},signal?:AbortSignal):Promise<PriceQuote&{base_vnd:number|null;valuation_method?:string;remaining_percent?:string|null;estimated_hours?:boolean}>;
  recoverySerials?(usageId:string,q:string,page:number,signal?:AbortSignal):Promise<DocumentPage<{serial_number:string}>>;
  issuePrice?(input: {part_id:string;warehouse_id:string;stock_state:string;quantity:string;serials:string[];business_at?:string},signal?:AbortSignal):Promise<PriceQuote>;
  issueContext?(
    staff: string,
    vehicle: string,
    driver: string,
    signal?: AbortSignal,
  ): Promise<
    import("../../shared/issueDetails").IssueDetails & { recipient: string }
  >;
  availableSerials?(
    part: string,
    warehouse: string,
    state: string,
    q: string,
    page: number,
    signal?: AbortSignal,
    businessAt?:string,
  ): Promise<DocumentPage<{ serial_number: string; unit_cost_vnd?: number|null }>>;
  creators?(
    signal?: AbortSignal,
    kind?: string,
  ): Promise<{ id: string; display_name: string }[]>;
  sources(
    view: "sources" | "usages",
    part: string,
    warehouse: string,
    state: string,
    page: number,
    signal?: AbortSignal,
    context?:{vehicle_id?:string},
  ): Promise<
    DocumentPage<{ id: string; code: string; quantity_milli: number; target_id?:string;target_type?:string;target_label?:string;position?:string;started_at?:string }>
  >;

  stock(
    partId: string,
    warehouseId: string,
    signal?: AbortSignal,
    excludeDocument?: string,
    stockState?: string,
  ): Promise<{
    quantity_milli: number;
    value_vnd: number|null;
    quantity_known?: boolean;
  }>;
  checkSerials(
    partId: string,
    serials: string[],
    signal?: AbortSignal,
    excludeDocument?: string,
  ): Promise<string[]>;
  nextNumber(
    kind: string,
    date: string,
    departmentId?: string,
    signal?: AbortSignal,
    openingMode?: "stock"|"in_use",
  ): Promise<string>;
  list(options: ListDocuments): Promise<DocumentPage<DocumentSummary>>;
  get(id: string, signal?: AbortSignal): Promise<DocumentRecord>;
  save(
    draft: DocumentDraft,
    key: string,
    row?: DocumentRecord,
    reason?: string,
  ): Promise<DocumentRecord>;
  action(
    row: DocumentRecord,
    action: string,
    reason: string,
  ): Promise<DocumentRecord>;
  history(
    id: string,
    page: number,
    signal?: AbortSignal,
  ): Promise<DocumentPage<DocumentEvent>>;
  workflows(signal?: AbortSignal): Promise<DocumentWorkflow[]>;
  approvers(signal?: AbortSignal): Promise<Approver[]>;
  saveWorkflow(
    workflow: Omit<DocumentWorkflow, "id" | "version">,
    row?: DocumentWorkflow,
  ): Promise<DocumentWorkflow>;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function invalid(): never {
  throw new CatalogApiError(
    502,
    "INVALID_RESPONSE",
    "Phản hồi chứng từ không hợp lệ.",
  );
}
function record(value: unknown): DocumentRecord {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !Number.isSafeInteger(value.version) ||
    !object(value.draft) ||
    !Array.isArray(value.draft.lines) ||
    !object(value.totals) ||
    !object(value.labels)
  )
    return invalid();
  return value as unknown as DocumentRecord;
}
function validRecoveryCounts(value:unknown){return object(value)&&Object.keys(recoveryClasses).every(k=>Number.isSafeInteger(value[k])&&Number(value[k])>=0)}
function validStatusCounts(value: unknown) {
  return (
    object(value) &&
    ["posted", "cancelled"].every(
      (k) => Number.isSafeInteger(value[k]) && Number(value[k]) >= 0,
    )
  );
}
function page<T>(body: Record<string, unknown>): DocumentPage<T> {
  const p = body.pagination;
  if (
    !Array.isArray(body.data) ||
    !object(p) ||
    !Number.isSafeInteger(p.page) ||
    Number(p.page) < 1 ||
    !Number.isSafeInteger(p.page_size) ||
    Number(p.page_size) < 1 ||
    !Number.isSafeInteger(p.total) ||
    Number(p.total) < 0
  )
    return invalid();
  for(const row of body.data){if(!object(row))continue;
    if(row.recovery_details!==undefined){try{parseRecoveryDetails(row.recovery_details)}catch{return invalid()}}
    if(row.recovery_counts!==undefined&&!validRecoveryCounts(row.recovery_counts))return invalid();
    if(row.opening_original_value_vnd!==undefined&&row.opening_original_value_vnd!==null&&(!Number.isSafeInteger(row.opening_original_value_vnd)||Number(row.opening_original_value_vnd)<0))return invalid();
    if(row.opening_target_labels!==undefined&&(!Array.isArray(row.opening_target_labels)||row.opening_target_labels.some(v=>typeof v!=="string")))return invalid();
    const opening=row.opening_details; if(object(opening)&&["vehicle_odo","trailer_odo"].some(k=>opening[k]!==undefined&&typeof opening[k]!=="string"))return invalid();
    if(row.opening_details!==undefined&&(!object(row.opening_details)||!["driver_id","driver_name","vehicle_id","vehicle_plate","trailer_number","generator_code"].every(k=>typeof (row.opening_details as Record<string,unknown>)[k]==="string")))return invalid();
  }
  const totals = body.receipt_totals;
  if (
    totals !== undefined &&
    (!object(totals) ||
      totals.count !== p.total ||
      (totals.recovery_counts!==undefined&&!validRecoveryCounts(totals.recovery_counts)) ||
      typeof totals.quantity_milli !== "string" ||
      !/^\d+$/.test(totals.quantity_milli) ||
      !Array.isArray(totals.units) ||
      !totals.units.every((u) => typeof u === "string") ||
      (totals.status_counts !== undefined &&
        !validStatusCounts(totals.status_counts)) ||
      !["net", "vat", "gross"].every(
        (k) =>
          totals[k] === null ||
          (typeof totals[k] === "string" && /^\d+$/.test(totals[k] as string)),
      ))
  )
    return invalid();
  return body as unknown as DocumentPage<T>;
}
export function createDocumentClient(
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): DocumentClient {
  async function request(
    path: string,
    options: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    const response = await fetcher("/api/" + path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (
      response.type === "opaqueredirect" ||
      response.status === 302 ||
      response.status === 401
    )
      throw new CatalogApiError(
        401,
        "LOGIN_REQUIRED",
        "Phiên đăng nhập đã hết hạn.",
      );
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new CatalogApiError(
        502,
        "INVALID_RESPONSE",
        "Máy chủ chưa trả dữ liệu chứng từ.",
      );
    const value: unknown = await response.json();
    if (!object(value)) return invalid();
    if (!response.ok) {
      const e = object(value.error) ? value.error : {};
      throw new CatalogApiError(
        response.status,
        String(e.code ?? "DOCUMENT_ERROR"),
        String(e.message ?? "Không lưu được phiếu."),
        typeof e.request_id === "string" ? e.request_id : undefined,
      );
    }
    return value;
  }
  return {
    async recoverySources(q,current,vehicleId,signal){const result=page<import("../../shared/recoverySources").RecoverySourceRow>(await request("document-drafts?"+new URLSearchParams({view:"recovery-sources",q,page:String(current),page_size:"25",...(vehicleId?{vehicle_id:vehicleId}:{})}),{signal}));if(result.data.some(row=>["opening_current_unit_price","opening_quality_percent","opening_assessor","opening_confirmation_basis"].some(key=>{const value=(row as unknown as Record<string,unknown>)[key];return value!==undefined&&value!==null&&typeof value!=="string"})||!["usage_id","root_line_id","part_id","sku","name","unit","code","started_at"].every(key=>typeof (row as unknown as Record<string,unknown>)[key]==="string")||![row.quantity_milli,row.issued_quantity_milli,row.open_quantity_milli,row.part_version].every(value=>Number.isSafeInteger(value)&&value>0)||![0,1].includes(row.is_serialized)||!(row.serial_number===null||typeof row.serial_number==="string")||![row.odo_milli,row.hours_milli].every(value=>value===null||(Number.isSafeInteger(value)&&value>=0))))return invalid();return result;},
    async recoveryPrice(input,signal){const result=await request("document-drafts/recovery-price",{method:"POST",body:JSON.stringify(input),signal});if(!object(result.data))return invalid();if(result.data.valuation_status==="pending"){if(result.data.amount_vnd!==null||result.data.unit_price_vnd_milli!==null||typeof result.data.warning!=="string")return invalid();}else if(!["base_vnd","amount_vnd","unit_price_vnd_milli"].every(k=>Number.isSafeInteger((result.data as Record<string,unknown>)[k])&&Number((result.data as Record<string,unknown>)[k])>=0))return invalid();return result.data as unknown as PriceQuote&{base_vnd:number|null;valuation_method?:string;remaining_percent?:string|null;estimated_hours?:boolean};},
    async recoverySerials(usageId,q,current,signal){return page<{serial_number:string}>(await request("document-drafts?"+new URLSearchParams({view:"recovery-serials",usage_id:usageId,q,page:String(current),page_size:"25"}),{signal}));},
    async issuePrice(input,signal){const r=await request("document-drafts/issue-price",{method:"POST",body:JSON.stringify(input),signal});if(!object(r.data))return invalid();if(r.data.valuation_status==="pending"){if(r.data.amount_vnd!==null||r.data.unit_price_vnd_milli!==null||typeof r.data.warning!=="string")return invalid();}else if(!Number.isSafeInteger(r.data.amount_vnd)||!Number.isSafeInteger(r.data.unit_price_vnd_milli)||Number(r.data.amount_vnd)<0||Number(r.data.unit_price_vnd_milli)<0)return invalid();return r.data as unknown as PriceQuote;},
    async issueContext(staff, vehicle, driver, signal) {
      const result = await request(
        "document-drafts?" +
          new URLSearchParams({
            view: "issue-context",
            staff_id: staff,
            vehicle_id: vehicle,
            driver_id: driver,
          }),
        { signal },
      );
      if (!object(result.data) || typeof result.data.recipient !== "string")
        return invalid();
      const { recipient, ...fields } = result.data;
      if (
        Object.keys(emptyIssueDetails()).some(
          (k) => typeof fields[k] !== "string",
        )
      )
        return invalid();
      try {
        return { ...parseIssueDetails(fields), recipient };
      } catch {
        return invalid();
      }
    },
    async availableSerials(part, warehouse, state, q, current, signal, businessAt) {
      return page<{ serial_number: string }>(
        await request(
          "document-drafts?" +
            new URLSearchParams({
              view: "available-serials",
              ...(businessAt?{business_at:businessAt}:{}),
              part_id: part,
              warehouse_id: warehouse,
              stock_state: state,
              q,
              page: String(current),
              page_size: "25",
            }),
          { signal },
        ),
      );
    },
    async sources(view, part, warehouse, state, current, signal,context) {
      return page<{ id: string; code: string; quantity_milli: number }>(
        await request(
          "document-drafts?" +
            new URLSearchParams({
              view,
              part_id: part,
              ...(view==="sources"?{warehouse_id:warehouse,stock_state:state}:{}),
              ...(context?.vehicle_id?{vehicle_id:context.vehicle_id}:{}),
              page: String(current),
              page_size: "25",
            }),
          { signal },
        ),
      );
    },
    async stock(partId, warehouseId, signal, excludeDocument, stockState) {
      const result = await request(
        "document-drafts?" +
          new URLSearchParams({
            view: "stock",
            ...(stockState ? { stock_state: stockState } : {}),
            ...(excludeDocument ? { exclude_document: excludeDocument } : {}),
            part_id: partId,
            warehouse_id: warehouseId,
          }),
        { signal },
      );
      if (
        !object(result.data) ||
        !Number.isSafeInteger(result.data.quantity_milli) ||
        !(Number.isSafeInteger(result.data.value_vnd)||(result.data.value_vnd===null&&result.data.valuation_status==="pending"))
      )
        return invalid();
      return {
        quantity_milli: Number(result.data.quantity_milli),
        value_vnd: result.data.value_vnd===null?null:Number(result.data.value_vnd),
        quantity_known: result.data.quantity_known !== false,
      };
    },
    async checkSerials(partId, serials, signal, excludeDocument) {
      const params = new URLSearchParams({
        view: "serial-check",
        part_id: partId,
      });
      if (excludeDocument) params.set("exclude_document", excludeDocument);
      serials.forEach((value) => params.append("serial", value));
      const result = await request("document-drafts?" + params, { signal });
      if (
        !object(result.data) ||
        !Array.isArray(result.data.conflicts) ||
        !result.data.conflicts.every((v) => typeof v === "string")
      )
        return invalid();
      return result.data.conflicts;
    },
    async nextNumber(kind, date, departmentId = "", signal, openingMode) {
      const params = new URLSearchParams({
        view: "next-number",
        kind,
        date,
        department_id: departmentId,
      });
      if(kind==="opening")params.set("opening_mode",openingMode??"stock");
      const result = await request("document-drafts?" + params, { signal });
      if (
        !object(result.data) ||
        typeof result.data.code !== "string" ||
        !/^\d{2}\.\d{2}\.\d{5}\//.test(result.data.code)
      )
        return invalid();
      return result.data.code;
    },
    async creators(signal, kind = "receipt") {
      const result = await request(
        "document-drafts?view=creators&kind=" + encodeURIComponent(kind),
        { signal },
      );
      if (
        !Array.isArray(result.data) ||
        result.data.some(
          (v: any) =>
            !v ||
            typeof v.id !== "string" ||
            typeof v.display_name !== "string",
        )
      )
        invalid();
      return result.data;
    },
    async list(options) {
      const params = new URLSearchParams({
        kind: options.kind,
        page: String(options.page ?? 1),
        page_size: String(options.pageSize ?? 25),
      });
      if (["receipt", "issue", "recovery"].includes(options.kind))
        params.set(
          "include_totals",
          options.includeTotals === false ? "0" : "1",
        );
      for (const key of [
        "sort",
        "direction",
        "q",
        "status",
        "from",
        "to",
        "warehouse_id",
        "supplier_id",
        "created_by",
        "valuation_pending",
        "opening_mode",
        "part_id","recovery_classification","recovery_vehicle","recovery_recipient",
      ] as const)
        if (options[key]) params.set(key, options[key]!);
      return page<DocumentSummary>(
        await request("document-drafts?" + params, { signal: options.signal }),
      );
    },
    async get(id, signal) {
      return record(
        (await request("document-drafts/" + encodeURIComponent(id), { signal }))
          .data,
      );
    },
    async save(draft, key, row, reason) {
      return record(
        (
          await request("document-drafts" + (row ? "/" + row.id : ""), {
            method: row ? "PATCH" : "POST",
            body: JSON.stringify(
              row
                ? {
                    action:
                      row.draft.kind === "retread" && row.status === "posted"
                        ? "receive"
                        : "save",
                    version: row.version,
                    reason,
                    draft,
                    commit: draft.kind !== "proposal",
                  }
                : {
                    draft,
                    idempotency_key: key,
                    commit: draft.kind !== "proposal",
                  },
            ),
          })
        ).data,
      );
    },
    async action(row, action, reason) {
      return record(
        (
          await request("document-drafts/" + row.id, {
            method: "PATCH",
            body: JSON.stringify({ version: row.version, action, reason }),
          })
        ).data,
      );
    },
    async history(id, current, signal) {
      return page<DocumentEvent>(
        await request(
          `document-drafts/${id}?view=history&page=${current}&page_size=25`,
          { signal },
        ),
      );
    },
    async workflows(signal) {
      const result = await request("document-workflows", { signal });
      if (!Array.isArray(result.data)) return invalid();
      return result.data as DocumentWorkflow[];
    },
    async approvers(signal) {
      const result = await request("document-workflows?view=approvers", {
        signal,
      });
      if (!Array.isArray(result.data)) return invalid();
      return result.data as Approver[];
    },
    async saveWorkflow(workflow, row) {
      const result = await request(
        "document-workflows" + (row ? "/" + row.id : ""),
        {
          method: row ? "PATCH" : "POST",
          body: JSON.stringify({
            ...workflow,
            ...(row ? { version: row.version } : {}),
          }),
        },
      );
      if (!object(result.data) || typeof result.data.id !== "string")
        return invalid();
      return result.data as unknown as DocumentWorkflow;
    },
  };
}

