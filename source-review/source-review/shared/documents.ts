import {hasOpeningAssessment,openingUsageAssessment} from "./openingUsageAssessment.ts";
import {parseOpeningDetails,type OpeningDetails} from "./openingDetails.ts";
import {issueStockCutoff} from "./issueStockDate.ts";
import {parseRecoveryDetails,recoveryClasses,recoveryState,type RecoveryClass,type RecoveryDetails} from "./recoveryDetails.ts";
import { issuePurposes, type IssuePurpose, parseIssueDetails, type IssueDetails } from "./issueDetails.ts";
import { normalizeInvoiceNumber } from "./invoiceNumber.ts";
import {
  parseReceiptCosts,
  parseReceiptCostItems,
  type ReceiptCostItem,
  receiptExtraTotals,
  type ReceiptCosts,
} from "./receiptCosts.ts";
import { receiptPricing } from "./receiptPricing.ts";
import {
  lineSerials,
  serialKey,
  serialFormatError,
  MAX_SERIALS_PER_LINE,
} from "./documentSerials.ts";
import {
  proposalKeys,
  proposalSections,
  proposalPlans,
  proposalEvidence,
  type ProposalData,
} from "./proposal.ts";
/** Draft preparation only. No function in this module posts stock or authorizes a stock movement. */
export const documentKinds = {
  proposal: {
    label: "Phiếu đề xuất VT-TB",
    code: "PĐX",
    menu: "ct_de_xuat",
    priced: true,
  },
  receipt: {
    label: "Phiếu nhập kho VT-TB",
    code: "PN",
    menu: "ct_nhap_kho",
    priced: true,
  },
  issue: {
    label: "Phiếu xuất kho VT-TB",
    code: "PX",
    menu: "ct_xuat_kho",
    priced: false,
  },
  recovery: {
    label: "Phiếu thu hồi VT-TB",
    code: "PTH",
    menu: "ct_thu_hoi",
    priced: false,
  },
  liquidation: {
    label: "Phiếu thanh lý VT-TB",
    code: "TL",
    menu: "ct_thanh_ly",
    priced: false,
  },
  retread: {
    label: "Phiếu gửi / nhận đắp vỏ",
    code: "DV",
    menu: "ct_dap_vo",
    priced: false,
  },
  warehouse_transfer: {
    label: "Điều chuyển giữa kho",
    code: "PĐC",
    menu: "ct_dieu_chuyen",
    priced: false,
  },
  equipment_transfer: {
    label: "Điều chuyển giữa thiết bị",
    code: "PĐC",
    menu: "ct_dieu_chuyen",
    priced: false,
  },
  rotation: {
    label: "Đảo vỏ xe / ắc quy",
    code: "DAO",
    menu: "ct_dao_vo_acquy",
    priced: false,
  },
  opening: {
    label: "Phiếu Tồn kho đầu kỳ",
    code: "DK",
    menu: "ht_so_du_dau",
    priced: true,
  },
} as const;
export type DocumentKind = keyof typeof documentKinds;
/** Existing records keep their issued code. Each new opening mode uses its own counter. */
export function documentSymbol(kind:DocumentKind,openingMode?:"stock"|"in_use"):string {
  return kind==="opening"&&openingMode==="in_use"?"SD":documentKinds[kind].code;
}

export type DraftStatus =
  | "posted"
  | "draft"
  | "pending"
  | "approved"
  | "returned"
  | "rejected"
  | "cancelled";
export type StockState = "new" | "recovered" | "pending_scrap";
export const stockStates: Record<StockState, string> = {
  new: "Hàng mới",
  recovered: "Hàng thu hồi",
  pending_scrap: "Hàng thu hồi chờ thanh lý",
};
export interface DraftLine {
  installed_at?:string;
  opening_current_unit_price?:string;
  opening_quality_percent?:string;
  opening_assessor?:string;
  opening_confirmation_basis?:string;
  recovery_classification?:RecoveryClass;
  recovery_quality_percent?:string;
  recovery_current_unit_price?:string;
  recovery_assessor?:string;
  issue_purpose?: IssuePurpose;
  mount_position_id?: string;
  proposal_side?: string;
  proposal_description?: string;
  proposal_condition?: string;
  proposal_source?: string;
  proposal_location?: string;
  proposal_destination?: string;
  proposal_link?: string;
  id: string;
  part_id: string;
  quantity: string;
  document_quantity: string;
  unit_price: string;
  pricing_mode?: "unit_net" | "unit_gross" | "line_gross";
  pricing_value?: string;
  vat_rate: string;
  stock_state: StockState;
  serial: string;
  serials?: string[];
  tank_id: string;
  data_package: string;
  target_type: "vehicle" | "equipment";
  target_id: string;
  source_line_id: string;
  usage_id: string;
  odo: string;
  hours: string;
  from_position: string;
  to_position: string;
  returned_serial: string;
  retread_cost: string;
  notes: string;
}
export interface DocumentDraft {
  opening_mode?:"stock"|"in_use";
  opening_details?:OpeningDetails;
  kind: DocumentKind;
  business_at: string;
  warehouse_id: string;
  to_warehouse_id: string;
  supplier_id: string;
  department_id: string;
  proposal_type: "purchase" | "issue" | "transfer" | "repair";
  recipient: string;
  invoice_number: string;
  invoice_date?: string;
  purpose: string;
  notes: string;
  proposal?: ProposalData;
  related_costs?: ReceiptCosts;
  related_cost_items?: ReceiptCostItem[];
  issue_details?: IssueDetails;
  recovery_details?:RecoveryDetails;
  lines: DraftLine[];
}
export interface DocumentTotals {
  net: number | null;
  vat: number | null;
  gross: number | null;
}
export interface ApprovalStep {
  label: string;
  mode: "any" | "all";
  approver_ids: string[];
}
export interface DocumentWorkflow {
  id: string;
  version: number;
  name: string;
  department_id: string;
  proposal_type: DocumentDraft["proposal_type"];
  steps: ApprovalStep[];
  is_active: number;
}
export interface DocumentRecord {
  can_modify?: boolean;
  operation_state?: string;
  id: string;
  version: number;
  code: string;
  status: DraftStatus;
  draft: DocumentDraft;
  labels: Record<string, string>;
  totals: DocumentTotals;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  workflow_snapshot: { name: string; steps: ApprovalStep[] } | null;
  approval_step: number;
  approval_votes: string[];
}
export type DocumentSummary = Omit<
  DocumentRecord,
  "draft" | "workflow_snapshot" | "labels" | "approval_votes"
> & {
  kind: DocumentKind;
  business_at: string;
  recovery_details?:RecoveryDetails;
  recovery_counts?:Record<RecoveryClass,number>;
  opening_details?:OpeningDetails;
  opening_original_value_vnd?:number|null;
  opening_target_labels?:string[];
  warehouse_label: string;
  partner_label: string;
  line_count: number;
  /** Total actual quantity in integer thousandths, serialized as text for exact aggregation. */
  total_quantity?: string;
  quantity_units?: string[];
  unit_prices?: string[];
  vat_rates?: string[];
  serial_numbers?: string[];
  last_edited_by_name?: string | null;
  invoice_number?: string;
  purpose?: string;
};
export const editableDraft = (status: DraftStatus) =>
  status === "draft" || status === "returned";
export function emptyLine(): DraftLine {
  return {
    id: crypto.randomUUID(),
    part_id: "",
    quantity: "1",
    document_quantity: "1",
    unit_price: "",
    vat_rate: "0",
    stock_state: "new",
    serial: "",
    tank_id: "",
    data_package: "",
    target_type: "vehicle",
    target_id: "",
    source_line_id: "",
    usage_id: "",
    odo: "",
    hours: "",
    from_position: "",
    to_position: "",
    returned_serial: "",
    retread_cost: "",
    notes: "",
  };
}
export function emptyDraft(kind: DocumentKind): DocumentDraft {
  const now = new Date(),
    local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
    line = emptyLine();
  if (["retread", "recovery"].includes(kind)) line.stock_state = "recovered";
  if (kind === "liquidation") line.stock_state = "pending_scrap";
  return {
    kind,
    business_at: kind === "opening" ? local.slice(0, 10) + "T00:00" : local,
    warehouse_id: "",
    to_warehouse_id: "",
    supplier_id: "",
    department_id: "",
    proposal_type: "purchase",
    recipient: "",
    invoice_number: "",
    invoice_date: "",
    purpose: "",
    notes: "",
    ...(kind === "proposal" ? { proposal: {} } : {}),
    lines: [line],
  };
}
export function scaledDecimal(
  value: string,
  places: number,
  label: string,
  optional = false,
): bigint | null {
  if (optional && value === "") return null;
  if (
    !new RegExp("^\\d+(?:\\.\\d{1," + places + "})?$").test(value) ||
    value.length > 18
  )
    throw new Error(
      label +
        ": nhập số không âm, tối đa " +
        places +
        " chữ số thập phân; không dùng dấu phân cách hàng nghìn.",
    );
  const [whole, fraction = ""] = value.split("."),
    n =
      BigInt(whole) * 10n ** BigInt(places) +
      BigInt(fraction.padEnd(places, "0"));
  if (n > 9000000000000n) throw new Error(label + " vượt giới hạn.");
  return n;
}
function rounded(n: bigint, d: bigint): bigint {
  return (n + d / 2n) / d;
}
export function lineTotals(
  line: DraftLine,
  kind: DocumentKind,
): DocumentTotals {
  if(kind==="opening"&&hasOpeningAssessment(line)){const amount=openingUsageAssessment(line).amount_vnd;return {net:amount,vat:0,gross:amount};}
  if (kind === "receipt") {
    if (
      (line.pricing_mode || "unit_net") === "unit_net"
        ? line.unit_price === ""
        : !line.pricing_value
    )
      return { net: null, vat: null, gross: null };
    const { net, vat, gross } = receiptPricing(line);
    return { net, vat, gross };
  }
  if (!documentKinds[kind].priced || line.unit_price === "")
    return { net: null, vat: null, gross: null };
  const qty = scaledDecimal(line.quantity, 3, "Số lượng")!,
    price = scaledDecimal(line.unit_price, 3, "Đơn giá")!,
    rate = scaledDecimal(line.vat_rate, 2, "VAT")!;
  if (rate > 10000n) throw new Error("VAT không vượt quá 100%.");
  const net = rounded(qty * price, 1000000n),
    vat = rounded(net * rate, 10000n),
    gross = net + vat;
  if (gross > 9000000000000n) throw new Error("Thành tiền vượt giới hạn.");
  return { net: Number(net), vat: Number(vat), gross: Number(gross) };
}
export function draftTotals(draft: DocumentDraft): DocumentTotals {
  if (draft.kind === "proposal" && draft.proposal) {
    const p = draft.proposal;
    const amounts = ["purchase_cost", "labor_cost", "other_cost"].map((k) =>
      scaledDecimal(p[k as keyof ProposalData] ?? "", 3, k, true),
    );
    const vat = scaledDecimal(p.vat_cost ?? "", 3, "Thuế dự kiến", true);
    const net = amounts.some((n) => n === null)
      ? null
      : amounts.reduce<bigint>((a, n) => a + n!, 0n);
    if (net !== null && net + (vat ?? 0n) > 9000000000000n)
      throw new Error("Tổng dự toán vượt giới hạn.");
    return {
      net: net === null ? null : Number(net) / 1000,
      vat: vat === null ? null : Number(vat) / 1000,
      gross: net === null || vat === null ? null : Number(net + vat) / 1000,
    };
  }
  const values = draft.lines.map((line) => lineTotals(line, draft.kind));
  if (values.some((v) => v.net === null))
    return { net: null, vat: null, gross: null };
  const result = { net: 0, vat: 0, gross: 0 };
  for (const value of values)
    for (const key of ["net", "vat", "gross"] as const) {
      result[key] += value[key]!;
      if (!Number.isSafeInteger(result[key]) || result[key] > 9000000000000)
        throw new Error("Tổng tiền vượt giới hạn.");
    }
  if (draft.kind === "receipt") {
    const extra = receiptExtraTotals(
      draft.related_costs,
      draft.related_cost_items,
    );
    for (const key of ["net", "vat", "gross"] as const) {
      result[key] += extra[key];
      if (!Number.isSafeInteger(result[key]) || result[key] > 9000000000000)
        throw new Error("Tổng tiền vượt giới hạn.");
    }
  }
  return result;
}
const headers = [
  "kind",
  "business_at",
  "warehouse_id",
  "to_warehouse_id",
  "supplier_id",
  "department_id",
  "proposal_type",
  "recipient",
  "invoice_number",
  "invoice_date",
  "purpose",
  "notes",
  "lines",
  "proposal",
  "related_costs",
  "related_cost_items",
  "issue_details",
  "recovery_details",
  "opening_mode",
  "opening_details",
];
const lineKeys = [
  "id",
  "part_id",
  "quantity",
  "document_quantity",
  "unit_price",
  "vat_rate",
  "stock_state",
  "serial",
  "tank_id",
  "data_package",
  "target_type",
  "target_id",
  "source_line_id",
  "usage_id",
  "odo",
  "hours",
  "from_position",
  "to_position",
  "returned_serial",
  "retread_cost",
  "notes",
];
export function parseDraft(value: unknown): DocumentDraft {
  const obj = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new Error("Dữ liệu phiếu không hợp lệ.");
    return v as Record<string, unknown>;
  };
  const text = (v: unknown, max = 1000) => {
    if (typeof v !== "string" || v.length > max)
      throw new Error("Trường nhập không hợp lệ hoặc quá dài.");
    return v.trim();
  };
  const v = obj(value);
  if (Object.keys(v).some((k) => !headers.includes(k)))
    throw new Error("Phiếu có trường không được hỗ trợ.");
  if (typeof v.kind !== "string" || !Object.hasOwn(documentKinds, v.kind))
    throw new Error("Loại phiếu không hợp lệ.");
  const kind = v.kind as DocumentKind,
    business_at = text(v.business_at, 16);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(business_at) ||
    !Number.isFinite(Date.parse(business_at + ":00Z")) ||
    new Date(business_at + ":00Z").toISOString().slice(0, 16) !== business_at
  )
    throw new Error("Ngày giờ chứng từ không hợp lệ.");
  if (!Array.isArray(v.lines) || v.lines.length < 1 || v.lines.length > 60)
    throw new Error("Một phiếu cần từ 1 đến 60 dòng.");
  const d = { kind, business_at, lines: [] as DraftLine[] } as DocumentDraft;
  for (const key of headers.filter(
    (k) =>
      ![
        "kind",
        "business_at",
        "lines",
        "proposal",
        "related_costs",
        "related_cost_items",
        "issue_details",
        "recovery_details",
        "opening_mode",
  "opening_details",
      ].includes(k),
  ))
    Object.assign(d, {
      [key]: text(
        v[key] === undefined
          ? key === "proposal_type"
            ? "purchase"
            : ""
          : v[key],
        key === "notes" ? 4000 : 1000,
      ),
    });
  if(v.opening_mode!==undefined){if(kind!=="opening"||!["stock","in_use"].includes(String(v.opening_mode)))throw new Error("Loại đầu kỳ không hợp lệ.");d.opening_mode=v.opening_mode as "stock"|"in_use";}
  if(v.opening_details!==undefined){if(kind!=="opening"||d.opening_mode!=="in_use")throw new Error("Thông tin tài xế chỉ dùng cho đầu kỳ đang sử dụng.");d.opening_details=parseOpeningDetails(v.opening_details);}
  if (kind === "receipt")
    d.invoice_number = normalizeInvoiceNumber(d.invoice_number);
  if (
    d.invoice_date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(d.invoice_date) ||
      !Number.isFinite(Date.parse(d.invoice_date + "T00:00:00Z")) ||
      new Date(d.invoice_date + "T00:00:00Z").toISOString().slice(0, 10) !==
        d.invoice_date)
  )
    throw new Error("Ngày hóa đơn không hợp lệ; nhập theo dd/mm/yyyy.");
  if(v.recovery_details!==undefined){if(kind!=="recovery")throw new Error("Thông tin thu hồi chỉ dùng cho PTH.");d.recovery_details=parseRecoveryDetails(v.recovery_details);}
  if (v.issue_details !== undefined) {
    if (kind !== "issue")
      throw new Error("Thông tin nhận chỉ dùng cho phiếu xuất.");
    d.issue_details = parseIssueDetails(v.issue_details);
  }
  if (v.related_cost_items !== undefined) {
    if (kind !== "receipt")
      throw new Error("Chỉ phiếu nhập có chi phí liên quan.");
    d.related_cost_items = parseReceiptCostItems(v.related_cost_items);
  }
  if (v.related_costs !== undefined) {
    if (kind !== "receipt")
      throw new Error("Chỉ phiếu nhập có chi phí liên quan.");
    d.related_costs = parseReceiptCosts(v.related_costs);
  }
  if (v.proposal !== undefined) {
    if (kind !== "proposal")
      throw new Error("Chỉ PĐX có thông tin mẫu đề xuất.");
    const p = obj(v.proposal);
    if (
      Object.keys(p).some(
        (k) => !(proposalKeys as readonly string[]).includes(k),
      )
    )
      throw new Error("Thông tin đề xuất không hợp lệ.");
    for (const [key, choices] of [
      ["plans", proposalPlans],
      ["evidence", proposalEvidence],
    ] as const) {
      if (
        p[key] !== undefined &&
        (typeof p[key] !== "string" ||
          (p[key] as string)
            .split(";")
            .filter(Boolean)
            .some((x) => !choices.includes(x)))
      )
        throw new Error("Lựa chọn nhiều mục không hợp lệ.");
    }
    d.proposal = {};
    for (const [k, val] of Object.entries(p))
      Object.assign(d.proposal, { [k]: text(val, 4000) });
    for (const [, fields] of proposalSections)
      for (const f of fields) {
        const val = d.proposal[f[0]] ?? "",
          type: string = f.length > 2 ? (f[2] ?? "") : "";
        if (val && type.includes("|") && !type.split("|").includes(val))
          throw new Error("Lựa chọn đề xuất không hợp lệ.");
        if (type === "amount" && val && !/^\d+$/.test(val))
          throw new Error(f[1] + ": số tiền VND phải là số nguyên đồng.");
        if (type === "amount") scaledDecimal(val, 3, f[1], true);
      }
  }
  if (!["purchase", "issue", "transfer", "repair"].includes(d.proposal_type))
    throw new Error("Loại đề xuất không hợp lệ.");
  if (
    !["equipment_transfer", "rotation", "proposal"].includes(kind) &&
    !(kind === "opening" && d.opening_mode === "in_use") &&
    !d.warehouse_id
  )
    throw new Error("Chọn kho.");
  if(kind === "opening" && d.opening_mode === "in_use"){d.warehouse_id="";d.to_warehouse_id="";}
  if (kind === "proposal" && !d.department_id)
    throw new Error("Chọn bộ phận đề xuất.");
  if (
    kind === "warehouse_transfer" &&
    (!d.to_warehouse_id || d.warehouse_id === d.to_warehouse_id)
  )
    throw new Error("Kho đi và kho đến phải khác nhau.");
  const ids = new Set<string>(),
    serials = new Set<string>();
  d.lines = v.lines.map((raw, index) => {
    const l = obj(raw);
    if (
      Object.keys(l).some(
        (k) =>
          !lineKeys.includes(k) &&
          k !== "serials" &&
          k !== "installed_at" &&
          !["opening_current_unit_price","opening_quality_percent","opening_assessor","opening_confirmation_basis"].includes(k) &&
          k !== "issue_purpose" &&
          k !== "mount_position_id" &&
          k !== "recovery_current_unit_price" &&
          k !== "recovery_assessor" &&
          k !== "recovery_quality_percent" &&
          k !== "recovery_classification" &&
          k !== "pricing_mode" &&
          k !== "pricing_value" &&
          ![
            "proposal_side",
            "proposal_description",
            "proposal_condition",
            "proposal_source",
            "proposal_location",
            "proposal_destination",
            "proposal_link",
          ].includes(k),
      )
    )
      throw new Error("Dòng vật tư có trường không được hỗ trợ.");
    try {
      const row = Object.fromEntries(
        lineKeys.map((key) => [
          key,
          text(l[key], key === "notes" ? 1000 : 256),
        ]),
      ) as unknown as DraftLine;
      const openingKeys=["opening_current_unit_price","opening_quality_percent","opening_assessor","opening_confirmation_basis"] as const;
      if(openingKeys.some(key=>l[key]!==undefined)){
        if(kind!=="opening"||d.opening_mode!=="in_use")throw new Error("Định giá đầu kỳ chỉ dùng cho vật tư đang sử dụng đầu kỳ.");
        for(const key of openingKeys)if(l[key]!==undefined)row[key]=text(l[key],key==="opening_confirmation_basis"?1000:key==="opening_assessor"?256:32).trim();
        const price=row.opening_current_unit_price,quality=row.opening_quality_percent;
        if(price&&(!/^\d{1,12}(?:\.\d{1,3})?$/.test(price)||Number(price)<=0))throw new Error("Giá mua hiện tại đầu kỳ phải lớn hơn 0, tối đa 3 số lẻ.");
        if(quality&&(!/^\d{1,3}(?:\.\d{1,2})?$/.test(quality)||Number(quality)>100))throw new Error("Chất lượng đầu kỳ phải từ 0 đến 100%, tối đa 2 số lẻ.");
      }
      if(l.installed_at!==undefined){if(kind!=="opening"||d.opening_mode!=="in_use")throw new Error("Ngày lắp gốc chỉ dùng cho đầu kỳ đang sử dụng.");row.installed_at=text(l.installed_at,32);if(row.installed_at){issueStockCutoff(row.installed_at);if(row.installed_at>d.business_at)throw new Error(`Dòng ${index+1}: ngày lắp gốc không được sau ngày khai báo đầu kỳ.`);}}
      if(kind==="opening"&&d.opening_mode==="in_use"){if(!row.target_id)throw new Error(`Dòng ${index+1}: chọn xe/rơmooc hoặc thiết bị đang sử dụng.`);if(row.stock_state!=="recovered")throw new Error("Vật tư đang sử dụng đầu kỳ phải là hàng đã sử dụng.");if(row.source_line_id||row.usage_id||row.tank_id)throw new Error("Đầu kỳ đang sử dụng không chọn nguồn kho, bồn hoặc lần sử dụng khác.");}
      if(l.recovery_current_unit_price!==undefined||l.recovery_assessor!==undefined){
        if(kind!=="recovery")throw new Error("Giá hiện tại/kỹ thuật xác nhận chỉ dùng cho PTH.");
        if(l.recovery_current_unit_price!==undefined){row.recovery_current_unit_price=text(l.recovery_current_unit_price,32);if(row.recovery_current_unit_price&&!/^\d{1,12}(?:\.\d{1,3})?$/.test(row.recovery_current_unit_price))throw new Error("Giá mua hiện tại không hợp lệ.");}
        if(l.recovery_assessor!==undefined)row.recovery_assessor=text(l.recovery_assessor,256).trim();
      }
      if(kind==="recovery"){
        const classification=l.recovery_classification??(row.stock_state==="pending_scrap"?"CTL":"CSD");
        if(typeof classification!=="string"||!Object.hasOwn(recoveryClasses,classification))throw new Error("Phân loại thu hồi không hợp lệ.");
        row.recovery_classification=classification as RecoveryClass;
        if(l.recovery_classification!==undefined&&row.stock_state!==recoveryState(row.recovery_classification))throw new Error("Phân loại và trạng thái thu hồi không khớp.");
        if(l.recovery_quality_percent!==undefined){const quality=text(l.recovery_quality_percent,16);if(!quality||!/^\d{1,3}(?:\.\d{1,2})?$/.test(quality)||Number(quality)>100)throw new Error("Chất lượng phải từ 0 đến 100%, tối đa 2 số lẻ.");row.recovery_quality_percent=quality;}
      }else if(l.recovery_classification!==undefined||l.recovery_quality_percent!==undefined)throw new Error("Phân loại/chất lượng thu hồi chỉ dùng cho PTH.");
      if (l.mount_position_id !== undefined) {
        if(kind!=="issue" || typeof l.mount_position_id!=="string" || (l.mount_position_id!=="" && !/^[a-zA-Z0-9_-]{1,128}$/.test(l.mount_position_id))) throw new Error("Vị trí lắp không hợp lệ.");
        row.mount_position_id=l.mount_position_id;
      }
      if (kind === "issue") {
        const purpose = l.issue_purpose ?? "use";
        if (typeof purpose !== "string" || !Object.hasOwn(issuePurposes, purpose))
          throw new Error("Mục đích xuất không hợp lệ.");
        row.issue_purpose = purpose as IssuePurpose;
        if (purpose === "liquidation" && row.stock_state !== "recovered")
          throw new Error("Thanh lý chỉ áp dụng cho hàng thu hồi.");
      } else if (l.issue_purpose !== undefined) {
        throw new Error("Mục đích xuất chỉ dùng cho phiếu xuất.");
      }
      if (l.pricing_mode !== undefined || l.pricing_value !== undefined) {
        const mode = l.pricing_mode ?? "unit_net",
          value = text(l.pricing_value ?? "", 64);
        if (
          !["unit_net", "unit_gross", "line_gross"].includes(String(mode)) ||
          (kind !== "receipt" && (mode !== "unit_net" || value !== ""))
        )
          throw new Error("Cách nhập giá chỉ dùng cho phiếu nhập.");
        if (kind === "receipt") {
          row.pricing_mode = mode as DraftLine["pricing_mode"];
          row.pricing_value = value;
          if (mode !== "unit_net") row.unit_price = "";
        }
      }
      for (const k of [
        "proposal_side",
        "proposal_description",
        "proposal_condition",
        "proposal_source",
        "proposal_location",
        "proposal_destination",
        "proposal_link",
      ])
        if (l[k] !== undefined) {
          if (kind !== "proposal")
            throw new Error("Trường chỉ dùng cho đề xuất.");
          Object.assign(row, { [k]: text(l[k], 1000) });
        }
      if (
        row.proposal_side &&
        !["remove", "install"].includes(row.proposal_side)
      )
        throw new Error("Bảng vật tư không hợp lệ.");
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || ids.has(row.id))
        throw new Error("ID dòng bị trùng hoặc không hợp lệ.");
      ids.add(row.id);
      if (kind === "issue" && row.source_line_id)
        throw new Error(
          "Dòng " +
            (index + 1) +
            ": phiếu xuất không chọn nguồn nhập; nguồn được xác định theo serial hoặc tự phân bổ FIFO.",
        );
      if (!row.part_id)
        throw new Error("Dòng " + (index + 1) + ": chọn vật tư.");
      if (scaledDecimal(row.quantity, 3, "Số lượng")! <= 0n)
        throw new Error("Số lượng phải lớn hơn 0.");
      for (const key of [
        "document_quantity",
        "unit_price",
        "retread_cost",
        "odo",
        "hours",
      ] as const)
        if (!(kind === "receipt" && key === "unit_price"))
          scaledDecimal(
            row[key],
            3,
            {
              document_quantity: "Số lượng chứng từ",
              unit_price: "Đơn giá",
              retread_cost: "Chi phí đắp",
              odo: "ODO",
              hours: "Giờ máy",
            }[key],
            true,
          );
      if (
        !Object.hasOwn(stockStates, row.stock_state) ||
        !["vehicle", "equipment"].includes(row.target_type)
      )
        throw new Error("Trạng thái hàng hoặc loại thiết bị không hợp lệ.");
      if (kind === "receipt" && row.stock_state !== "new")
        throw new Error("PN nhận Hàng mới; hàng đã dùng đi qua phiếu thu hồi.");
      if (kind === "opening" && row.stock_state === "pending_scrap")
        throw new Error("Tồn kho đầu kỳ dùng Hàng mới hoặc Hàng thu hồi.");
      if (kind === "issue" && row.stock_state === "pending_scrap")
        throw new Error("PX chỉ xuất Hàng mới hoặc Hàng thu hồi.");
      if (kind === "recovery" && row.stock_state === "new")
        throw new Error("Thu hồi chỉ nhận Hàng thu hồi hoặc chờ thanh lý.");
      if (kind === "liquidation" && row.stock_state !== "pending_scrap")
        throw new Error("Thanh lý chỉ dùng Hàng thu hồi chờ thanh lý.");
      if (kind === "retread" && row.stock_state !== "recovered")
        throw new Error("Gửi đắp chỉ dùng Hàng thu hồi.");
      if (l.serials !== undefined) {
        if (
          !Array.isArray(l.serials) ||
          l.serials.length > MAX_SERIALS_PER_LINE
        )
          throw new Error("Tối đa 500 serial mỗi dòng.");
        row.serials = l.serials.map((value) => text(value, 128));
        if (
          row.serial &&
          !(
            row.serials.length === 1 &&
            serialKey(row.serials[0]) === serialKey(row.serial)
          )
        )
          throw new Error(
            "Không kết hợp Serial đơn và danh sách Serial khác nhau.",
          );
      }
      const list = lineSerials(row);
      if (list.length) {
        const qty = scaledDecimal(row.quantity, 3, "Số lượng")!;
        if (qty % 1000n !== 0n)
          throw new Error("Vật tư SERIAL phải có số lượng nguyên.");
        if (BigInt(list.length) * 1000n > qty)
          throw new Error("Số serial vượt quá số lượng thực tế.");
        for (const value of list) {
          const problem = serialFormatError(value);
          if (problem) throw new Error(problem);
          const key = row.part_id + ":" + serialKey(value);
          if (serials.has(key))
            throw new Error("Serial trùng trong phiếu: " + value);
          serials.add(key);
          if (serials.size > 1000)
            throw new Error("Tối đa 1.000 serial mỗi phiếu.");
        }
      }
      if (!documentKinds[kind].priced && row.unit_price !== "")
        throw new Error("Giá vốn phải được xác định từ nguồn khi ghi sổ.");
      if (kind === "opening" && scaledDecimal(row.vat_rate, 2, "VAT") !== 0n)
        throw new Error("Tồn kho đầu kỳ không cộng VAT mua hàng.");
      for (const key of ["retread_cost"] as const)
        if (row[key] && !/^\d+$/.test(row[key]))
          throw new Error("Số tiền VND phải là số nguyên đồng.");
      lineTotals(row, kind);
      return row;
    } catch (error) {
      throw new Error(
        "Dòng " +
          (index + 1) +
          ": " +
          (error instanceof Error ? error.message : "Dữ liệu không hợp lệ."),
      );
    }
  });
  draftTotals(d);
  return d;
}
export function previewNumber(draft: DocumentDraft): string {
  return (
    draft.business_at.slice(5, 7) +
    "." +
    draft.business_at.slice(2, 4) +
    ".00001/" +
    documentSymbol(draft.kind,draft.opening_mode)
  );
}
/** Quoted CSV/TSV, no coercion of identifiers or serials. A fourth PN column is Gói Data. */
export function parseQuickLines(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "").trim();
  if (!input) return [];
  const separator = input.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",",
    rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === separator && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Thiếu dấu đóng ngoặc kép trong dữ liệu nhập.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 60) throw new Error("Tối đa 60 dòng một phiếu.");
  return rows;
}

export function isDocumentMenu(menu: string): boolean {
  return (
    menu === "ht_quy_trinh" ||
    Object.values(documentKinds).some((kind) => kind.menu === menu)
  );
}
