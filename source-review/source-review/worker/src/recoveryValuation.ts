import type { Env, Row } from "./types.ts";
import { ApiError } from "./http.ts";
import { scaledDecimal } from "../../shared/documents.ts";
import { issueStockCutoff } from "../../shared/issueStockDate.ts";
import { costRound } from "./issuePricing.ts";
import { serialKey } from "../../shared/documentSerials.ts";
class MissingRecoveryEvidence extends Error {}
function missing(message: string): never {
  throw new MissingRecoveryEvidence(message);
}
function fail(message: string): never {
  throw new ApiError(409, "INVENTORY_RULE", message);
}
export interface RecoveryValuationInput {
  current_unit_price?: string;
  quality_percent?: string;
  assessor?: string;
  quantity: string;
  business_at: string;
  odo: string;
  hours: string;
  serials: string[];
}
/** Defaults come from the saved opening line, never today's catalog price or a client total. */
export async function openingRecoveryDefaults(env:Env,rootLineId:unknown){
 const row=await env.DB.prepare("SELECT dl.line_json FROM opening_usage_lines ou JOIN inventory_document_lines il ON il.id=ou.inventory_line_id JOIN inventory_documents d ON d.id=il.document_id AND d.status='posted' JOIN document_drafts dd ON dd.posted_inventory_id=d.id JOIN document_draft_lines dl ON dl.document_id=dd.id AND dl.line_number=il.line_number WHERE ou.inventory_line_id=? AND ou.original_unit_price_known=0").bind(rootLineId).first<{line_json:string}>();
 if(!row)return {};
 const line=JSON.parse(row.line_json) as Record<string,unknown>;
 const value=(key:string)=>typeof line[key]==="string"?line[key] as string:undefined;
 return {current_unit_price:value("opening_current_unit_price"),quality_percent:value("opening_quality_percent"),assessor:value("opening_assessor")};
}
/** Read all valuation evidence from D1; client supplies only the requested return and removal readings. */
async function calculateRecoveryValuation(
  env: Env,
  u: Row,
  input: RecoveryValuationInput,
) {
  const q = Number(scaledDecimal(input.quantity, 3, "Số lượng"));
  if (q <= 0 || q > Number(u.open_quantity_milli))
    fail("Số lượng vượt phần còn đang sử dụng.");
  try {
    issueStockCutoff(input.business_at);
  } catch {
    fail("Ngày chứng từ không hợp lệ.");
  }
  if (Date.parse(input.business_at + ":00+07:00") > Date.now())
    fail("Ngày giờ thu hồi không được ở tương lai.");
  if (input.business_at < String(u.started_at))
    fail("Ngày giờ thu hồi không được trước lần xuất/lắp.");
  const root = await env.DB.prepare(
    "SELECT * FROM inventory_document_lines WHERE id=?",
  )
    .bind(u.root_line_id)
    .first<Row>();
  const part = await env.DB.prepare("SELECT * FROM parts WHERE id=?")
    .bind(u.part_id)
    .first<Row>();
  if (!root || !part) missing("Không đủ dữ liệu giá xuất gốc để tính thu hồi.");
  const opening=await env.DB.prepare("SELECT declared_at,installed_at,original_unit_price_known FROM opening_usage_lines WHERE inventory_line_id=?").bind(u.root_line_id).first<Row>();
  if(opening&&input.business_at<String(opening.declared_at))fail("Ngày thu hồi không được trước ngày khai báo vật tư đầu kỳ.");
  const marketEligible = !!opening && Number(opening.original_unit_price_known) === 0;
  if (!marketEligible && (input.current_unit_price || input.assessor))
    fail("Giá mua hiện tại chỉ dùng cho vật tư đang sử dụng đầu kỳ chưa rõ giá gốc.");
  if (marketEligible) {
    const defaults=await openingRecoveryDefaults(env,u.root_line_id);
    const current = input.current_unit_price ?? defaults.current_unit_price ?? "", quality = input.quality_percent ?? defaults.quality_percent ?? "", assessor = (input.assessor ?? defaults.assessor ?? "").trim();
    if (current && !/^\d{1,12}(?:\.\d{1,3})?$/.test(current)) fail("Giá mua hiện tại không hợp lệ.");
    if (quality && (!/^\d{1,3}(?:\.\d{1,2})?$/.test(quality) || Number(quality)>100)) fail("Chất lượng phải từ 0 đến 100%.");
    if (assessor.length>256) fail("Tên kỹ thuật xác nhận quá dài.");
    if (Number(part.is_serialized) === 1) {
      if(input.serials.length*1000!==q||new Set(input.serials.map(serialKey)).size!==input.serials.length)fail("Chọn đủ serial thuộc lần xuất/lắp để tính thu hồi.");
      for(const serial of input.serials){const found=await env.DB.prepare("SELECT 1 FROM usage_serials a JOIN inventory_serials s ON s.part_id=a.part_id AND s.serial_key=a.serial_key WHERE a.usage_id=? AND a.part_id=? AND a.serial_key=? AND a.active=1 AND s.status='mounted'").bind(u.id,u.part_id,serialKey(serial)).first();if(!found)fail("Serial không thuộc lần sử dụng được chọn: "+serial);}
    }
    if (!current || !quality || !assessor) missing("Bổ sung giá mua hiện tại, % chất lượng và kỹ thuật xác nhận để xác định giá trị thu hồi đầu kỳ.");
    const price=scaledDecimal(current,3,"Giá mua hiện tại")!, percent=scaledDecimal(quality,2,"Chất lượng")!;
    if(price<=0n)fail("Giá mua hiện tại phải lớn hơn 0.");
    const base=costRound(price*BigInt(q),1000000n),amount=costRound(price*BigInt(q)*percent,10000000000n);
    if(!Number.isSafeInteger(base)||!Number.isSafeInteger(amount)||!Number.isSafeInteger(costRound(BigInt(amount)*1000000n,BigInt(q))))fail("Giá trị thu hồi vượt giới hạn.");
    const serialCosts = Number(part.is_serialized)===1 ? input.serials.map(serial=>({serial,source_unit_price_vnd_milli:String(price),unit_price_vnd_milli:costRound(price*percent,10000n),amount_vnd:Number(price*percent/10000000n)})) : [];
    let remainder=amount-serialCosts.reduce((sum,c)=>sum+c.amount_vnd,0);
    for(const cost of serialCosts){if(remainder<=0)break;cost.amount_vnd++;remainder--;}
    return {valuation_status:"known" as const,warning:undefined as string|undefined,serial_costs:serialCosts,base_vnd:base,amount_vnd:amount,unit_price_vnd_milli:costRound(BigInt(amount)*1000000n,BigInt(q)),remaining_percent:null,used_cost_vnd:base-amount,estimated_hours:false,
      metadata:{version:3,basis:"current_price_quality",usage_id:String(u.id),root_line_id:String(u.root_line_id),source_document_id:String(root.document_id),current_unit_price_vnd_milli:String(price),quality_percent:quality,assessor,quantity_milli:q,base_vnd:base,amount_vnd:amount,remaining_percent:null,business_at:input.business_at,confirmed_at:new Date().toISOString(),estimated_hours:false,serial_costs:serialCosts}};
  }
  const pending = await env.DB.prepare(
    "SELECT 1 FROM inventory_valuation_flags f WHERE f.inventory_line_id=? AND f.status='pending'",
  )
    .bind(u.root_line_id)
    .first();
  if (pending)
    missing("Giá xuất của lần sử dụng chưa xác định, cần rà soát bổ sung.");
  const reused = await env.DB.prepare(
    "SELECT 1 FROM stock_source_allocations a JOIN stock_lots s ON s.source_line_id=a.source_line_id WHERE a.consumer_line_id=? AND s.stock_state<>'new' LIMIT 1",
  )
    .bind(u.root_line_id)
    .first();
  const moved = await env.DB.prepare(
    "WITH RECURSIVE ancestors AS (SELECT * FROM stock_usages WHERE id=? UNION ALL SELECT p.* FROM stock_usages p JOIN ancestors c ON c.parent_usage_id=p.id) SELECT 1 FROM ancestors WHERE target_id<>? OR target_type<>? LIMIT 1",
  )
    .bind(u.id, u.target_id, u.target_type)
    .first();
  if (moved)
    missing(
      "Thiếu mốc đồng hồ giữa các phương tiện sau khi chuyển lắp, cần rà soát giá trị.",
    );
  const initialLimits: Record<string, number> = {
    odo: Number(part.lifespan_km_limit ?? 0) * 1000,
    hours: Number(part.lifespan_hours_limit ?? 0) * 1000,
  };
  let effectiveLimits={...initialLimits};
  let upstreamEstimated = false;
  if (reused) {
    const origins = await env.DB.prepare(
      "SELECT s.stock_state,d.labels_json,dl.line_json FROM stock_source_allocations a JOIN stock_lots s ON s.source_line_id=a.source_line_id JOIN inventory_document_lines il ON il.id=s.source_line_id LEFT JOIN document_drafts d ON d.posted_inventory_id=il.document_id LEFT JOIN document_draft_lines dl ON dl.document_id=d.id AND dl.line_number=il.line_number WHERE a.consumer_line_id=?",
    )
      .bind(u.root_line_id)
      .all<Row>();
    let common: string | undefined;
    for (const origin of origins.results) {
      let limits: Record<string, number> = { ...initialLimits };
      if (origin.stock_state !== "new") {
        try {
          const line: unknown = JSON.parse(String(origin.line_json)),
            labels: unknown = JSON.parse(String(origin.labels_json));
          if (
            !line ||
            typeof line !== "object" ||
            !("id" in line) ||
            !labels ||
            typeof labels !== "object"
          )
            throw new Error();
          const raw = (labels as Record<string, unknown>)[
            "recovery_valuation:" + String(line.id)
          ];
          if (typeof raw !== "string") throw new Error();
          const meta: unknown = JSON.parse(raw);
          if (
            !meta ||
            typeof meta !== "object" ||
            !("measurements" in meta) ||
            !Array.isArray(meta.measurements)
          )
            throw new Error();
          limits = { odo: 0, hours: 0 };
          for (const value of meta.measurements as unknown[]) {
            if (
              !value ||
              typeof value !== "object" ||
              !("method" in value) ||
              !("start_milli" in value) ||
              !("end_milli" in value) ||
              !("limit_milli" in value) ||
              !Number.isSafeInteger(value.start_milli) ||
              !Number.isSafeInteger(value.end_milli) ||
              !Number.isSafeInteger(value.limit_milli)
            )
              throw new Error();
            const key =
              value.method === "km"
                ? "odo"
                : value.method === "hours"
                  ? "hours"
                  : "";
            if (!key) throw new Error();
            limits[key] = Math.max(
              0,
              Number(value.limit_milli) -
                Math.max(
                  0,
                  Number(value.end_milli) - Number(value.start_milli),
                ),
            );
            if ("estimated" in value && value.estimated)
              upstreamEstimated = true;
          }
          if (!limits.odo && !limits.hours) throw new Error();
        } catch {
          missing(
            "Chưa đủ căn cứ tuổi thọ còn lại từ vòng sử dụng trước, cần bổ sung sau.",
          );
        }
      }
      const signature = JSON.stringify(limits);
      if (common && common !== signature)
        missing(
          "Các nguồn xuất có tuổi thọ còn lại khác nhau, cần rà soát giá trị.",
        );
      common = signature;
      effectiveLimits = limits;
    }
    if (!origins.results.length)
      missing("Không có căn cứ tuổi thọ của nguồn tái sử dụng.");
  }
  let numerator = 1n,
    denominator = 1n;
  const measurements: Array<{
    method: "km" | "hours";
    start_milli: number;
    end_milli: number;
    limit_milli: number;
    used_percent: string;
    estimated: boolean;
    time_basis?: {
      started_at: string;
      removed_at: string;
      method: "elapsed_calendar_hours";
    };
  }> = [];
  for (const [key, stored, limitField] of [
    ["odo", "odo_milli", "lifespan_km_limit"],
    ["hours", "hours_milli", "lifespan_hours_limit"],
  ] as const) {
    const reading = input[key];
    let start = u[stored];
    let end = reading ? Number(scaledDecimal(reading, 3, key)) : null;
    const estimated =
      key === "hours" &&
      (start === null || start === undefined || end === null);
    if (estimated) {
      if(opening&&!opening.installed_at&&Number(part.lifespan_hours_limit??0)>0)missing("Chưa rõ ngày lắp gốc của vật tư đầu kỳ để tạm tính giờ sử dụng.");
      start = 0;
      end = Math.round(
        (Date.parse(input.business_at + ":00+07:00") -
          Date.parse(String(u.started_at) + ":00+07:00")) /
          3600,
      );
    }

    if (
      end !== null &&
      start !== null &&
      start !== undefined &&
      end < Number(start)
    )
      fail("Mốc KM/giờ tháo không được nhỏ hơn khi lắp.");
    const limit = effectiveLimits[key];
    if (limit <= 0) continue;
    if (start === null || start === undefined || end === null)
      missing("Cần đủ mốc KM/giờ lúc lắp và lúc tháo theo định mức.");
    const delta = BigInt(end) - BigInt(String(start)),
      life = BigInt(limit),
      used = delta > life ? life : delta,
      remaining = life - used;
    measurements.push({
      method: key === "odo" ? "km" : "hours",
      start_milli: Number(start),
      end_milli: end,
      limit_milli: limit,
      used_percent: String(costRound(used * 10000n, life) / 100),
      estimated,
      ...(estimated
        ? {
            time_basis: {
              started_at: String(u.started_at),
              removed_at: input.business_at,
              method: "elapsed_calendar_hours" as const,
            },
          }
        : {}),
    });
    if (remaining * denominator < numerator * life) {
      numerator = remaining;
      denominator = life;
    }
  }
  if (!measurements.length)
    missing(
      "Chưa có định mức tuổi thọ KM/giờ để tính % còn lại. Cập nhật định mức vật tư trước khi thu hồi.",
    );
  let price = BigInt(String(root.unit_price_vnd_milli));
  let base: number;
  const serialPrices: Array<{ serial: string; price: bigint }> = [];
  if (Number(part.is_serialized) === 1) {
    if (
      input.serials.length * 1000 !== q ||
      new Set(input.serials.map(serialKey)).size !== input.serials.length
    )
      fail("Chọn đủ serial thuộc lần xuất/lắp để tính thu hồi.");
    let totalPrice = 0n;
    for (const serial of input.serials) {
      const row = await env.DB.prepare(
        "SELECT s.cost_vnd_milli FROM usage_serials a JOIN inventory_serials s ON s.part_id=a.part_id AND s.serial_key=a.serial_key WHERE a.usage_id=? AND a.part_id=? AND a.serial_key=? AND a.active=1 AND s.status='mounted'",
      )
        .bind(u.id, u.part_id, serialKey(serial))
        .first<Row>();
      if (!row) fail("Serial không thuộc lần sử dụng được chọn: " + serial);
      if (row.cost_vnd_milli === null)
        missing("Chưa xác định giá xuất của serial: " + serial);
      totalPrice += BigInt(String(row.cost_vnd_milli));
      serialPrices.push({ serial, price: BigInt(String(row.cost_vnd_milli)) });
    }
    base = costRound(totalPrice, 1000n);
    price = BigInt(costRound(totalPrice, BigInt(input.serials.length)));
  } else base = costRound(price * BigInt(q), 1000000n);
  const amount = costRound(BigInt(base) * numerator, denominator),
    remainingPercent = String(costRound(numerator * 10000n, denominator) / 100);
  const serialCosts = serialPrices.map(({ serial, price }) => ({
    serial,
    source_unit_price_vnd_milli: String(price),
    unit_price_vnd_milli: costRound(price * numerator, denominator),
    amount_vnd: Number((price * numerator) / (denominator * 1000n)),
  }));
  let remainder =
    amount - serialCosts.reduce((sum, row) => sum + row.amount_vnd, 0);
  for (const row of serialCosts) {
    if (remainder <= 0) break;
    row.amount_vnd++;
    remainder--;
  }
  if (serialCosts.length && remainder !== 0)
    fail("Không thể phân bổ chính xác giá trị thu hồi serial.");
  return {
    valuation_status: "known" as const,
    warning: undefined as string | undefined,
    serial_costs: serialCosts,
    base_vnd: base,
    amount_vnd: amount,
    unit_price_vnd_milli: costRound(BigInt(amount) * 1000000n, BigInt(q)),
    remaining_percent: remainingPercent,
    used_cost_vnd: base - amount,
    estimated_hours: measurements.some((m) => m.estimated) || upstreamEstimated,
    metadata: {
      version: 1,
      basis: "issue_cost_lifetime",
      usage_id: String(u.id),
      root_line_id: String(u.root_line_id),
      source_document_id: String(root.document_id),
      source_unit_price_vnd_milli: String(price),
      quantity_milli: q,
      base_vnd: base,
      remaining_percent: remainingPercent,
      amount_vnd: amount,
      used_cost_vnd: base - amount,
      business_at: input.business_at,
      measurements,
      estimated_hours: measurements.some((m) => m.estimated)||upstreamEstimated,
      serial_costs: serialCosts,
    },
  };
}

export async function recoveryValuation(
  env: Env,
  u: Row,
  input: RecoveryValuationInput,
) {
  // Reject invalid removal readings even when valuation evidence is missing.
  for (const [key, stored] of [
    ["odo", "odo_milli"],
    ["hours", "hours_milli"],
  ] as const)
    if (
      input[key] &&
      u[stored] !== null &&
      u[stored] !== undefined &&
      Number(scaledDecimal(input[key], 3, key)) < Number(u[stored])
    )
      fail("Mốc KM/giờ tháo không được nhỏ hơn khi lắp.");
  try {
    const result=await calculateRecoveryValuation(env, u, input);
    return {...result,valuation_method:result.metadata.basis};
  } catch (error) {
    if (!(error instanceof MissingRecoveryEvidence)) throw error;
    return {
      valuation_method: "pending_evidence",
      valuation_status: "pending" as const,
      warning: error.message,
      serial_costs: [],
      base_vnd: null,
      amount_vnd: null,
      unit_price_vnd_milli: null,
      remaining_percent: null,
      used_cost_vnd: null,
      estimated_hours: false,
      metadata: {
        version: 2,
        basis: "pending_evidence",
        usage_id: String(u.id),
        root_line_id: String(u.root_line_id),
        business_at: input.business_at,
        amount_vnd: null,
        remaining_percent: null,
        estimated_hours: false,
        reason: error.message,
      },
    };
  }
}
