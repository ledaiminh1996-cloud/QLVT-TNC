import {issueStockTimeLabel} from "../../shared/issueStockDate.ts";
import type { Env, Row } from "./types.ts";
import { ApiError } from "./http.ts";
import { serialKey } from "../../shared/documentSerials.ts";
export const costRound = (n: bigint, d: bigint) => Number((n + d / 2n) / d);
export async function serialIssueCost(env: Env, part: string, warehouse: string, state: string, serials: string[], businessAt?: string, prices?:Map<string,number>) {
  let costMilli = 0n;
  const keys = new Set<string>();
  for (const serial of serials) {
    const key = serialKey(serial);
    if (keys.has(key)) throw new ApiError(400,"VALIDATION_ERROR","Serial trùng trong dòng xuất.");
    keys.add(key);
    const row = await env.DB.prepare("SELECT l.*,s.cost_vnd_milli FROM inventory_serials s JOIN stock_lots l ON l.source_line_id=s.document_line_id WHERE s.part_id=? AND s.serial_key=? AND s.warehouse_id=? AND s.stock_state=? AND s.status='in_stock'").bind(part,key,warehouse,state).first<Row>();
    if (!row) throw new ApiError(409,"INVENTORY_RULE","Serial không còn trong kho/trạng thái đã chọn: "+serial);
    if(businessAt && String(row.available_at)>businessAt)throw new ApiError(409,"INVENTORY_RULE","Serial "+serial+" nhập lúc "+issueStockTimeLabel(String(row.available_at))+", không thể xuất trước thời điểm nhập.");
    const basis=row.cost_vnd_milli==null?costRound(BigInt(String(row.original_value_vnd))*1000000n,BigInt(String(row.initial_quantity_milli))):Number(row.cost_vnd_milli);
    prices?.set(key,basis);
    costMilli+=BigInt(basis);
  }
  const amount=costRound(costMilli,1000n);
  if (!Number.isSafeInteger(amount)) throw new ApiError(400,"VALIDATION_ERROR","Giá trị xuất vượt giới hạn.");
  return amount;
}
