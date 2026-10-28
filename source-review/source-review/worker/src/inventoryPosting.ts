import {checkSourceAccess} from "./openingManagement.ts";
import {hasOpeningAssessment,openingUsageAssessment} from "../../shared/openingUsageAssessment.ts";
import {pendingStockValue} from "./pendingValuation.ts";
import {recoveryValuation} from "./recoveryValuation.ts";
import {issueStockCutoff,issueStockTimeLabel} from "../../shared/issueStockDate.ts";
import { serialIssueCost } from "./issuePricing.ts";
import type { Env, User, Row } from "./types.ts";
import type { DocumentDraft, DraftLine } from "../../shared/documents.ts";
import { scaledDecimal, lineTotals, draftTotals } from "../../shared/documents.ts";
import {
  lineSerials,
  serialKey,
  serialFormatError,
} from "../../shared/documentSerials.ts";
import { ApiError } from "./http.ts";
function error(message: string): never {
  throw new ApiError(409, "INVENTORY_RULE", message);
}
const qty = (line: DraftLine) =>
  Number(scaledDecimal(line.quantity, 3, "Số lượng")!);
const round = (n: bigint, d: bigint) => Number((n + d / 2n) / d);
const num = (v: unknown) => Number(v);
type Bucket = {
  part: string;
  warehouse: string;
  state: string;
  quantity: number;
  value: number;
  version: number;
};
/** Planner reads sources first, but every debit/usage/serial is guarded again inside the D1 batch. */
export interface OpeningReplacement {sources:Record<string,{line_id:string;usage_id:string;usage_version:number}>}
class Plan {
  statements: D1PreparedStatement[] = [];
  buckets = new Map<string, Bucket>();
  lots = new Map<string, Row>();
  usages = new Map<string, Row>();
  readonly env: Env;
  readonly id: string;
  readonly draft: DocumentDraft;
  readonly labels: Record<string, string>;
  readonly replacement?:OpeningReplacement;
  constructor(
    env: Env,
    id: string,
    draft: DocumentDraft,
    labels: Record<string, string>,
    replacement?:OpeningReplacement,
  ) {
    this.env = env;
    this.id = id;
    this.draft = draft;
    this.labels = labels;
    this.replacement=replacement;
  }
  stmt(sql: string, ...args: unknown[]) {
    this.statements.push(this.env.DB.prepare(sql).bind(...args));
  }
  async bucket(part: string, warehouse: string, state: string) {
    const key = part + ":" + warehouse + ":" + state;
    let b = this.buckets.get(key);
    if (!b) {
      const row = await this.env.DB.prepare(
        "SELECT * FROM stock_buckets WHERE part_id=? AND warehouse_id=? AND stock_state=?",
      )
        .bind(part, warehouse, state)
        .first<Row>();
      b = {
        part,
        warehouse,
        state,
        quantity: num(row?.quantity_milli ?? 0),
        value: num(row?.value_vnd ?? 0),
        version: num(row?.version ?? 0),
      };
      this.buckets.set(key, b);
    }
    return b;
  }
  coreLine(
    line: DraftLine,
    id: string,
    value: number,
    from: string | null,
    to: string | null,
    priceOverride?: number,
  ) {
    const q = qty(line),
      price = priceOverride ?? round(BigInt(value) * 1000000n, BigInt(q));
    this.stmt(
      "INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,from_warehouse_id,to_warehouse_id,vehicle_id,vehicle_plate_snapshot,vehicle_odo_km,mount_position,is_opening_usage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      this.id,
      this.draft.lines.findIndex((row) => row.id === line.id) + 1,
      line.part_id,
      this.labels["sku:" + line.part_id] ?? "",
      this.labels["parts:" + line.part_id] ?? "",
      this.labels["unit:" + line.part_id] ?? "",
      q,
      price,
      value,
      from,
      to,
      line.target_type === "vehicle" ? line.target_id || null : null,
      this.labels["vehicles:" + line.target_id] ?? null,
      line.odo
        ? Number(BigInt(scaledDecimal(line.odo, 3, "ODO")!) / 1000n)
        : null,
      line.to_position || null,
      this.draft.kind==="opening"&&this.draft.opening_mode==="in_use"?1:0,
    );
  }
  balance(part: string, warehouse: string, q: number, value: number) {
    if (q >= 0)
      this.stmt(
        "INSERT INTO stock_balances(part_id,warehouse_id,quantity_milli,value_vnd) VALUES (?,?,?,?) ON CONFLICT(part_id,warehouse_id) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,value_vnd=value_vnd+excluded.value_vnd",
        part,
        warehouse,
        q,
        value,
      );
    else
      this.stmt(
        "UPDATE stock_balances SET quantity_milli=quantity_milli+?,value_vnd=value_vnd+? WHERE part_id=? AND warehouse_id=?",
        q,
        value,
        part,
        warehouse,
      );
  }
  async debit(line: DraftLine, id: string, destination: string | null = null) {
    const cutoff = this.draft.kind === "issue" ? issueStockCutoff(this.draft.business_at) : this.draft.business_at;
    const q = qty(line),
      b = await this.bucket(
        line.part_id,
        this.draft.warehouse_id,
        line.stock_state,
      );
    if (q > b.quantity) error("Không đủ tồn kho theo trạng thái hàng.");
    let value =
      q === b.quantity
        ? b.value
        : round(BigInt(b.value) * BigInt(q), BigInt(b.quantity));
    const pendingValue=await pendingStockValue(this.env,line.part_id,this.draft.warehouse_id,line.stock_state,lineSerials(line));
    const serialPrices=new Map<string,number>();
    if (lineSerials(line).length) {
      value = await serialIssueCost(this.env,line.part_id,this.draft.warehouse_id,line.stock_state,lineSerials(line),cutoff,serialPrices);
      if (q === b.quantity && Math.abs(value-b.value) <= lineSerials(line).length) value=b.value;
      if (value>b.value) error("Giá trị tồn kho không đủ theo giá nhập serial đã chọn.");
    }
    if(this.draft.kind === "issue" && serialPrices.size){
      const entries=lineSerials(line).map(serial=>({serial,unit_price_vnd_milli:serialPrices.get(serialKey(serial))!,amount_vnd:Math.floor(serialPrices.get(serialKey(serial))!/1000)}));
      let delta=value-entries.reduce((sum,e)=>sum+e.amount_vnd,0);
      for(const entry of entries){if(delta>0){entry.amount_vnd++;delta--;}else if(delta<0){const take=Math.min(entry.amount_vnd,-delta);entry.amount_vnd-=take;delta+=take;}}
      if(delta!==0)error("Không phân bổ được giá trị theo từng serial.");
      this.labels["issue_serial_costs:"+line.id]=JSON.stringify(entries);
    }
    const unitPrice = serialPrices.size ? round([...serialPrices.values()].reduce((sum,price)=>sum+BigInt(price),0n),BigInt(serialPrices.size)) : round(BigInt(b.value)*1000000n,BigInt(b.quantity));
    this.coreLine(line, id, value, this.draft.warehouse_id, destination, unitPrice);
    if(pendingValue){this.labels["valuation_pending:"+line.id]="1";this.labels["valuation_reason:"+line.id]=String(pendingValue.reason);this.stmt("INSERT INTO inventory_valuation_flags(inventory_line_id,reason,origin_line_id) VALUES (?,?,?)",id,String(pendingValue.reason),pendingValue.origin_line_id??pendingValue.inventory_line_id);}

    this.stmt(
      "UPDATE stock_buckets SET quantity_milli=CASE WHEN version=? AND quantity_milli>=? AND value_vnd>=? THEN quantity_milli-? ELSE -1 END,value_vnd=value_vnd-?,version=version+1 WHERE part_id=? AND warehouse_id=? AND stock_state=?",
      b.version,
      q,
      value,
      q,
      value,
      b.part,
      b.warehouse,
      b.state,
    );
    b.quantity -= q;
    b.value -= value;
    b.version++;
    this.stmt(
      "INSERT INTO stock_movements(id,document_line_id,part_id,warehouse_id,quantity_delta_milli,value_delta_vnd) VALUES (?,?,?,?,?,?)",
      crypto.randomUUID(),
      id,
      line.part_id,
      this.draft.warehouse_id,
      -q,
      -value,
    );
    this.balance(line.part_id, this.draft.warehouse_id, -q, -value);
    const serials = lineSerials(line),
      sourceNeed = new Map<string, number>();
    if (serials.length) {
      for (const serial of serials) {
        const current = await this.env.DB.prepare(
          "SELECT * FROM inventory_serials WHERE part_id=? AND serial_key=? AND warehouse_id=? AND stock_state=? AND status='in_stock'",
        )
          .bind(
            line.part_id,
            serialKey(serial),
            this.draft.warehouse_id,
            line.stock_state,
          )
          .first<Row>();
        if (!current) error("Serial không còn đúng kho/trạng thái: " + serial);
        const source = String(current.document_line_id);
        sourceNeed.set(source, (sourceNeed.get(source) ?? 0) + 1000);
        this.stmt(
          "UPDATE inventory_serials SET status='out',warehouse_id=NULL,document_line_id=? WHERE part_id=? AND serial_key=? AND status='in_stock' AND document_line_id=?",
          id,
          line.part_id,
          serialKey(serial),
          source,
        );
      }
    }
    const rows = await this.env.DB.prepare(
      "SELECT l.* FROM stock_lots l JOIN inventory_document_lines x ON x.id=l.source_line_id JOIN inventory_documents d ON d.id=x.document_id WHERE l.part_id=? AND l.warehouse_id=? AND l.stock_state=? AND l.remaining_quantity_milli>0 AND l.available_at<=? AND d.status='posted' ORDER BY l.available_at,l.source_line_id",
    )
      .bind(
        line.part_id,
        this.draft.warehouse_id,
        line.stock_state,
        cutoff,
      )
      .all<Row>();
    const future = await this.env.DB.prepare(
      "SELECT available_at FROM stock_lots WHERE part_id=? AND warehouse_id=? AND stock_state=? AND remaining_quantity_milli>0 AND available_at>? ORDER BY available_at DESC LIMIT 1",
    )
      .bind(
        line.part_id,
        this.draft.warehouse_id,
        line.stock_state,
        cutoff,
      )
      .first();
    if (future && !serials.length)
      error(
        "Ngày giờ xuất phải từ "+issueStockTimeLabel(String(future.available_at))+" để dùng giá vốn của các lô nhập hiện có.",
      );
    for (const source of rows.results.filter(row => !serials.length || sourceNeed.has(String(row.source_line_id))))
      this.stmt(
        "INSERT INTO stock_cost_dependencies(consumer_line_id,source_line_id) VALUES (?,?)",
        id,
        source.source_line_id,
      );
    let remaining = q;
    for (const raw of rows.results) {
      const key = String(raw.source_line_id);
      const lot = this.lots.get(key) ?? raw;
      this.lots.set(key, lot);
      if (line.source_line_id && line.source_line_id !== key) continue;
      const take = serials.length
        ? (sourceNeed.get(key) ?? 0)
        : Math.min(remaining, num(lot.remaining_quantity_milli));
      if (take <= 0) continue;
      if (take > num(lot.remaining_quantity_milli))
        error("Nguồn nhập đã được sử dụng bởi giao dịch khác.");
      this.stmt(
        "UPDATE stock_lots SET remaining_quantity_milli=CASE WHEN version=? AND remaining_quantity_milli>=? THEN remaining_quantity_milli-? ELSE -1 END,version=version+1 WHERE source_line_id=?",
        num(lot.version),
        take,
        take,
        key,
      );
      this.stmt(
        "INSERT INTO stock_source_allocations(consumer_line_id,source_line_id,quantity_milli) VALUES (?,?,?)",
        id,
        key,
        take,
      );
      lot.remaining_quantity_milli = num(lot.remaining_quantity_milli) - take;
      lot.version = num(lot.version) + 1;
      remaining -= take;
    }
    if (remaining !== 0) error("Không đủ nguồn nhập hợp lệ tại ngày chứng từ.");
    return value;
  }
  async inbound(
    line: DraftLine,
    id: string,
    value: number,
    warehouse: string,
    createLine = true,
  ) {
    const q = qty(line);
    if (createLine) this.coreLine(line, id, value, null, warehouse);
    this.stmt(
      "INSERT INTO stock_movements(id,document_line_id,part_id,warehouse_id,quantity_delta_milli,value_delta_vnd) VALUES (?,?,?,?,?,?)",
      crypto.randomUUID(),
      id,
      line.part_id,
      warehouse,
      q,
      value,
    );
    this.balance(line.part_id, warehouse, q, value);
    const b = await this.bucket(line.part_id, warehouse, line.stock_state);
    this.stmt(
      "INSERT INTO stock_buckets(part_id,warehouse_id,stock_state,quantity_milli,value_vnd) VALUES (?,?,?,?,?) ON CONFLICT(part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,value_vnd=value_vnd+excluded.value_vnd,version=version+1",
      line.part_id,
      warehouse,
      line.stock_state,
      q,
      value,
    );
    b.quantity += q;
    b.value += value;
    b.version++;
    this.stmt(
      "INSERT INTO stock_lots(source_line_id,part_id,warehouse_id,stock_state,initial_quantity_milli,remaining_quantity_milli,original_value_vnd,available_at) VALUES (?,?,?,?,?,?,?,?)",
      id,
      line.part_id,
      warehouse,
      line.stock_state,
      q,
      q,
      value,
      this.draft.business_at,
    );
  }
  serialsIn(line: DraftLine, id: string, warehouse: string, existing = false) {
    for (const serial of lineSerials(line)) {
      if (existing)
        this.stmt(
          "UPDATE inventory_serials SET status='in_stock',warehouse_id=?,stock_state=?,cost_vnd_milli=CASE WHEN ?='warehouse_transfer' THEN cost_vnd_milli ELSE (SELECT unit_price_vnd_milli FROM inventory_document_lines WHERE id=?) END,document_line_id=? WHERE part_id=? AND serial_key=?",
          warehouse,
          line.stock_state,
          this.draft.kind,
          id,
          id,
          line.part_id,
          serialKey(serial),
        );
      else
        this.stmt(
          "INSERT INTO inventory_serials(part_id,serial_key,serial_number,warehouse_id,stock_state,status,document_line_id,cost_vnd_milli) VALUES (?,?,?,?,?,'in_stock',?,(SELECT unit_price_vnd_milli FROM inventory_document_lines WHERE id=?))",
          line.part_id,
          serialKey(serial),
          serial,
          warehouse,
          line.stock_state,
          id,
          id,
        );
    }
  }
  async usage(line: DraftLine) {
    if (!line.usage_id) error("Chọn lần xuất/lắp gốc còn đang sử dụng.");
    let u = this.usages.get(line.usage_id);
    if (!u) {
      u =
        (await this.env.DB.prepare("SELECT * FROM stock_usages WHERE id=?")
          .bind(line.usage_id)
          .first<Row>()) ?? undefined;
      if (!u) error("Không tìm thấy lần xuất/lắp gốc.");
      this.usages.set(line.usage_id, u!);
    }
    if (u!.part_id !== line.part_id || qty(line) > num(u!.open_quantity_milli))
      error("Số lượng vượt phần còn đang sử dụng.");
    if (this.draft.business_at < String(u!.started_at))
      error("Ngày thao tác không được trước ngày lắp.");
    for (const [key, stored] of [
      ["odo", "odo_milli"],
      ["hours", "hours_milli"],
    ] as const)
      if (
        line[key] &&
        u![stored] != null &&
        Number(scaledDecimal(line[key], 3, key)) < num(u![stored])
      )
        error("Mốc KM/giờ không được nhỏ hơn khi lắp.");
    return u!;
  }
  async closeUsage(line: DraftLine, u: Row) {
    const q = qty(line),
      base =
        q === num(u.open_quantity_milli)
          ? num(u.open_value_vnd)
          : round(
              BigInt(num(u.open_value_vnd)) * BigInt(q),
              BigInt(num(u.open_quantity_milli)),
            );
    for (const serial of lineSerials(line)) {
      const link = await this.env.DB.prepare(
        "SELECT 1 FROM usage_serials WHERE usage_id=? AND part_id=? AND serial_key=? AND active=1",
      )
        .bind(u.id, line.part_id, serialKey(serial))
        .first();
      if (!link) error("Serial không thuộc lần sử dụng được chọn: " + serial);
      this.stmt(
        "UPDATE usage_serials SET active=0 WHERE usage_id=? AND part_id=? AND serial_key=? AND active=1",
        u.id,
        line.part_id,
        serialKey(serial),
      );
    }
    this.stmt(
      "UPDATE stock_usages SET open_quantity_milli=CASE WHEN version=? AND open_quantity_milli>=? THEN open_quantity_milli-? ELSE -1 END,open_value_vnd=open_value_vnd-?,version=version+1 WHERE id=?",
      num(u.version),
      q,
      q,
      base,
      u.id,
    );
    u.open_quantity_milli = num(u.open_quantity_milli) - q;
    u.open_value_vnd = num(u.open_value_vnd) - base;
    u.version = num(u.version) + 1;
    return base;
  }
  openUsage(
    line: DraftLine,
    id: string,
    root: string,
    value: number,
    parent: string | null = null,
    startedAt:string=this.draft.business_at,
  ) {
    const q = qty(line);
    id=this.replacement?.sources[line.id]?.usage_id??id;
    this.stmt(
      "INSERT INTO stock_usages(id,root_line_id,document_id,parent_usage_id,part_id,quantity_milli,open_quantity_milli,open_value_vnd,target_type,target_id,position,started_at,odo_milli,hours_milli,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      root,
      this.id,
      parent,
      line.part_id,
      q,
      q,
      value,
      line.target_type,
      line.target_id,
      line.to_position,
      startedAt,
      line.odo ? Number(scaledDecimal(line.odo, 3, "ODO")) : null,
      line.hours ? Number(scaledDecimal(line.hours, 3, "Giờ")) : null,
      (this.replacement?.sources[line.id]?.usage_version??0)+1,
    );
    for (const serial of lineSerials(line))
      this.stmt(
        "INSERT INTO usage_serials(usage_id,part_id,serial_key,active) VALUES (?,?,?,1)",
        id,
        line.part_id,
        serialKey(serial),
      );
  }
}
async function header(
  env: Env,
  id: string,
  draft: DocumentDraft,
  user: User,
  type: string,
  labels: Record<string, string>,
) {
  const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ draft, commit: true })),
    ),
    hash = Array.from(new Uint8Array(digest), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
  return env.DB.prepare(
    "INSERT INTO inventory_documents(id,code,type,business_date,status,supplier_id,partner_name_snapshot,invoice_number,created_by,posted_by,posted_at,idempotency_key,request_hash,source_reference,notes) SELECT id,code,?,substr(business_at,1,10),'posted',supplier_id,?,json_extract(header_json,'$.invoice_number'),created_by,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'operation:'||id,?,'prepared:'||id,json_extract(header_json,'$.notes') FROM document_drafts WHERE id=?",
  ).bind(
    type,
    labels["suppliers:" + draft.supplier_id] ?? draft.recipient,
    user.id,
    hash,
    id,
  );
}
export async function inventoryPosting(
  env: Env,
  id: string,
  draft: DocumentDraft,
  user: User,
  labels: Record<string, string>,
  replacement?:OpeningReplacement,
): Promise<D1PreparedStatement[]> {
  if (draft.kind === "proposal" || draft.kind === "receipt")
    error("Loại phiếu không phù hợp luồng ghi kho này.");
  const types = {
    issue: "OUT",
    recovery: "RECOVERY",
    liquidation: "SCRAP",
    retread: "OUT",
    warehouse_transfer: "TRANSFER",
    equipment_transfer: "ADJUSTMENT",
    rotation: "ADJUSTMENT",
    opening: "OPENING",
  } as const;
  if(replacement&&!(draft.kind==="opening"&&draft.opening_mode==="in_use"))error("Chỉ thay thế dữ liệu đầu kỳ đang sử dụng.");
  const plan = new Plan(env, id, draft, labels,replacement);
  if(!replacement)plan.statements.push(
    await header(env, id, draft, user, types[draft.kind], labels),
  );
  if (user.role === "warehouse") {
    for (const line of draft.lines) {
      if (!line.usage_id) continue;
      const source=await env.DB.prepare("SELECT root_line_id FROM stock_usages WHERE id=?").bind(line.usage_id).first<Row>();
      if(!source)error("Lần xuất/lắp gốc không tồn tại.");
      await checkSourceAccess(env,user,String(source.root_line_id));
    }
  }
  if (draft.kind === "opening"&&draft.opening_mode!=="in_use") {
    const groups = new Set<string>();
    for (const line of draft.lines) {
      const key = line.part_id + ":" + line.stock_state;
      if (groups.has(key)) continue;
      groups.add(key);
      plan.stmt(
        "INSERT INTO opening_groups(part_id,warehouse_id,stock_state,document_id,start_at) VALUES (?,?,?,?,?)",
        line.part_id,
        draft.warehouse_id,
        line.stock_state,
        id,
        draft.business_at,
      );
    }
  }
  for (const [index, line] of draft.lines.entries()) {
    try {
      const lineId = replacement?.sources[line.id]?.line_id??crypto.randomUUID();
      if(draft.kind==="opening"&&draft.opening_mode==="in_use"){
        if(Date.parse(draft.business_at+":00+07:00")>Date.now())error("Ngày khai báo đầu kỳ không được ở tương lai.");
        if(!line.target_id)error("Chọn xe/rơmooc hoặc thiết bị đang sử dụng.");
        const part=await env.DB.prepare("SELECT is_serialized,is_fuel FROM parts WHERE id=?").bind(line.part_id).first<Row>();
        if(!part||Number(part.is_fuel)===1)error("Không khai báo dầu tiêu hao trong vật tư đang sử dụng đầu kỳ.");
        const assessed=hasOpeningAssessment(line)?openingUsageAssessment(line):null;
        if(assessed&&assessed.amount_vnd===null)error("Nhập đủ Nguyên giá, Tỷ lệ còn lại (%) và Người xác nhận.");
        if(assessed)labels["opening_reference_assessment:"+line.id]=JSON.stringify({...assessed,business_at:draft.business_at});
        const legacyKnown=!assessed&&line.unit_price!=="",value=assessed?.amount_vnd??(legacyKnown?lineTotals(line,"opening").net!:0);
        plan.coreLine(line,lineId,value,null,null);
        plan.stmt("INSERT INTO opening_usage_lines(inventory_line_id,part_id,target_type,target_id,position,is_serialized,declared_at,installed_at,original_unit_price_known,managing_unit_id) VALUES (?,?,?,?,?,?,?,?,?,?)",lineId,line.part_id,line.target_type,line.target_id,line.to_position,Number(part.is_serialized),draft.business_at,line.installed_at||null,legacyKnown?1:0,null);
        plan.openUsage(line,lineId,lineId,value,null,line.installed_at||draft.business_at);
        for(const serial of lineSerials(line))plan.stmt("INSERT INTO inventory_serials(part_id,serial_key,serial_number,warehouse_id,stock_state,status,document_line_id,cost_vnd_milli) VALUES (?,?,?,?,?,'mounted',?,?)",line.part_id,serialKey(serial),serial,null,"recovered",lineId,assessed?round(BigInt(value)*1000000n,BigInt(qty(line))):legacyKnown?Number(scaledDecimal(line.unit_price,3,"Nguyên giá")):null);
      }else if (draft.kind === "opening") {
        if (line.unit_price === "") error("Đơn giá số dư bắt buộc.");
        const value = lineTotals(line, "opening").net!;
        await plan.inbound(line, lineId, value, draft.warehouse_id);
        plan.serialsIn(line, lineId, draft.warehouse_id);
      } else if (
        ["issue", "liquidation", "retread", "warehouse_transfer"].includes(
          draft.kind,
        )
      ) {
        const value = await plan.debit(
          line,
          lineId,
          draft.kind === "warehouse_transfer" ? draft.to_warehouse_id : null,
        );
        if (draft.kind === "issue") {
          plan.openUsage(line, lineId, lineId, value);
          for (const serial of lineSerials(line))
            plan.stmt(
              "UPDATE inventory_serials SET status='mounted' WHERE part_id=? AND serial_key=? AND document_line_id=?",
              line.part_id,
              serialKey(serial),
              lineId,
            );
        }
        if (draft.kind === "warehouse_transfer") {
          await plan.inbound(line, lineId, value, draft.to_warehouse_id, false);
          plan.serialsIn(line, lineId, draft.to_warehouse_id, true);
        }
        if (draft.kind === "liquidation")
          for (const serial of lineSerials(line))
            plan.stmt(
              "UPDATE inventory_serials SET status='scrapped' WHERE part_id=? AND serial_key=? AND document_line_id=?",
              line.part_id,
              serialKey(serial),
              lineId,
            );
        if (draft.kind === "retread") {
          const serials = lineSerials(line);
          if (serials.length !== 1 || qty(line) !== 1000)
            error("Mỗi dòng gửi đắp cần đúng một vỏ và một serial.");
          plan.stmt(
            "INSERT INTO retread_jobs(document_id,send_line_id,part_id,serial_before,source_value_vnd,stage) VALUES (?,?,?,?,?,'sent')",
            id,
            lineId,
            line.part_id,
            serials[0],
            value,
          );
        }
      } else if (draft.kind === "recovery") {
        const u=await plan.usage(line);
        const valuation=await recoveryValuation(env,u,{quantity:line.quantity,business_at:draft.business_at,odo:line.odo,hours:line.hours,serials:lineSerials(line),current_unit_price:line.recovery_current_unit_price,quality_percent:line.recovery_quality_percent,assessor:line.recovery_assessor});
        await plan.closeUsage(line,u);
        const base=valuation.base_vnd,remaining=valuation.amount_vnd??0;
        labels["recovery_valuation:"+line.id]=JSON.stringify(valuation.metadata);
        if(valuation.remaining_percent!==null)labels["recovery_remaining_percent:"+line.id]=valuation.remaining_percent;
        labels["recovery_estimated_hours:"+line.id]=valuation.estimated_hours?"1":"0";
        const sourceTarget=await env.DB.prepare(u.target_type==="vehicle"?"SELECT plate_number AS label,type FROM vehicles WHERE id=?":"SELECT code AS label,type FROM equipment WHERE id=?").bind(u.target_id).first<Row>();
        labels["recovery_target_kind:"+line.id]=String(sourceTarget?.type??"");
        labels["recovery_source:"+line.id]=String(sourceTarget?.label??u.target_id??"")+(u.position?" – "+String(u.position):"");
        if(base!==null)labels["recovery_base:"+line.id]=String(base);
        labels["recovery_valuation_method:"+line.id]=valuation.metadata.basis;
        labels["recovery_quality:"+line.id]=line.recovery_quality_percent??"";
        await plan.inbound(line, lineId, remaining, draft.warehouse_id);
        plan.serialsIn(line, lineId, draft.warehouse_id, true);
        if(valuation.valuation_status==="pending"){labels["valuation_pending:"+line.id]="1";labels["valuation_reason:"+line.id]=valuation.warning??"Chưa xác định giá trị";plan.stmt("INSERT INTO inventory_valuation_flags(inventory_line_id,reason,origin_line_id) VALUES (?,?,?)",lineId,valuation.warning??"Chưa xác định giá trị",lineId);plan.stmt("UPDATE inventory_serials SET cost_vnd_milli=NULL WHERE document_line_id=?",lineId);}
        for(const cost of valuation.serial_costs)plan.stmt("UPDATE inventory_serials SET cost_vnd_milli=? WHERE part_id=? AND serial_key=? AND document_line_id=?",cost.unit_price_vnd_milli,line.part_id,serialKey(cost.serial),lineId);
        labels["recovery_serial_costs:"+line.id]=JSON.stringify(valuation.serial_costs);
      } else {
        const u = await plan.usage(line);
        if (!line.target_id) error("Chọn xe/thiết bị nhận.");
        const value = await plan.closeUsage(line, u),
          next = crypto.randomUUID();
        const nextLine = { ...line };
        if (
          u.target_id === line.target_id &&
          u.target_type === line.target_type
        ) {
          nextLine.odo =
            u.odo_milli == null ? "" : String(Number(u.odo_milli) / 1000);
          nextLine.hours =
            u.hours_milli == null ? "" : String(Number(u.hours_milli) / 1000);
        }
        plan.openUsage(
          nextLine,
          next,
          String(u.root_line_id),
          value,
          String(u.id),
        );
        plan.stmt(
          "INSERT INTO equipment_operations(id,document_id,from_usage_id,to_usage_id,quantity_milli,from_position,to_position,effective_at) VALUES (?,?,?,?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          u.id,
          next,
          qty(line),
          line.from_position || String(u.position),
          line.to_position,
          draft.business_at,
        );
      }
    } catch (e) {
      if (e instanceof ApiError)
        throw new ApiError(e.status, e.code, `Dòng ${index + 1}: ${e.message}`);
      throw e;
    }
  }
  if(draft.kind === "issue" || draft.kind === "recovery" || (draft.kind==="opening"&&draft.opening_mode==="in_use")) plan.stmt("UPDATE document_drafts SET labels_json=? WHERE id=?",JSON.stringify(labels),id);
  if (draft.kind === "retread")
    plan.stmt(
      "UPDATE document_drafts SET operation_state='sent' WHERE id=?",
      id,
    );
  if(draft.kind==="opening"&&draft.opening_mode==="in_use")plan.stmt("UPDATE document_drafts SET totals_json=? WHERE id=?",JSON.stringify(draftTotals(draft)),id);
  else {
  plan.stmt(
    "UPDATE document_drafts SET totals_json=(SELECT CASE WHEN EXISTS(SELECT 1 FROM inventory_valuation_flags f JOIN inventory_document_lines fl ON fl.id=f.inventory_line_id WHERE fl.document_id=inventory_document_lines.document_id AND f.status='pending') THEN json_object('net',NULL,'vat',0,'gross',NULL) ELSE json_object('net',coalesce(sum(amount_vnd),0),'vat',0,'gross',coalesce(sum(amount_vnd),0)) END FROM inventory_document_lines WHERE document_id=?) WHERE id=?",
    id,
    id,
  );
  }
  plan.stmt(
    "UPDATE document_drafts SET posted_inventory_id=? WHERE id=? AND posted_inventory_id IS NULL",
    id,
    id,
  );
  return plan.statements;
}
export async function receiveRetread(
  env: Env,
  recordId: string,
  draft: DocumentDraft,
  user: User,
  labels: Record<string, string>,
): Promise<D1PreparedStatement[]> {
  const rows = await env.DB.prepare(
    "SELECT j.*,l.line_number FROM retread_jobs j JOIN inventory_document_lines l ON l.id=j.send_line_id WHERE j.document_id=? ORDER BY l.line_number",
  )
    .bind(recordId)
    .all<Row>();
  if (
    rows.results.length !== draft.lines.length ||
    rows.results.some((r) => r.stage !== "sent")
  )
    error("Phiếu đắp đã nhận hoặc không còn ở trạng thái đang đắp.");
  const receiptId = crypto.randomUUID(),
    plan = new Plan(env, receiptId, draft, labels);
  const hash = crypto.randomUUID();
  plan.stmt(
    "INSERT INTO inventory_documents(id,code,type,business_date,status,supplier_id,created_by,posted_by,posted_at,idempotency_key,request_hash,source_reference,notes) SELECT ?,code||'/NHAN','RECOVERY',?,'posted',supplier_id,created_by,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'retread-receive:'||id,?,'retread-receive:'||id,? FROM document_drafts WHERE id=?",
    receiptId,
    draft.business_at.slice(0, 10),
    user.id,
    hash,
    draft.notes,
    recordId,
  );
  for (const [index, line] of draft.lines.entries()) {
    const job = rows.results[index];
    if (
      job.part_id !== line.part_id ||
      lineSerials(line)[0] !== job.serial_before ||
      qty(line) !== 1000
    )
      error("Không đổi vỏ hoặc serial gốc khi nhận đắp.");
    if (
      !line.returned_serial ||
      serialFormatError(line.returned_serial) ||
      line.retread_cost === ""
    )
      error("Cần serial sau đắp hợp lệ và chi phí đắp.");
    const cost =
      Number(scaledDecimal(line.retread_cost, 3, "Chi phí đắp")!) / 1000;
    if (!Number.isSafeInteger(cost))
      error("Chi phí đắp phải là số nguyên đồng.");
    const returned = {
        ...line,
        serial: "",
        serials: [line.returned_serial],
        stock_state: "recovered" as const,
      },
      lineId = crypto.randomUUID();
    await plan.inbound(
      returned,
      lineId,
      num(job.source_value_vnd) + cost,
      draft.warehouse_id,
    );
    if (
      serialKey(line.returned_serial) === serialKey(String(job.serial_before))
    )
      error("Serial sau đắp phải là serial mới, chưa từng tồn tại.");
    plan.serialsIn(returned, lineId, draft.warehouse_id);
    plan.stmt(
      "UPDATE retread_jobs SET stage=CASE WHEN stage='sent' THEN 'received' ELSE 'invalid' END,received_inventory_id=?,received_line_id=?,serial_after=?,repair_cost_vnd=?,received_at=? WHERE send_line_id=?",
      receiptId,
      lineId,
      line.returned_serial,
      cost,
      draft.business_at,
      job.send_line_id,
    );
  }
  plan.stmt(
    "UPDATE document_drafts SET operation_state='received',version=version+1 WHERE id=?",
    recordId,
  );
  return plan.statements;
}
