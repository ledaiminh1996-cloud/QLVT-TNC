import { receiptLandedCosts } from "../../shared/receiptCosts.ts";
import { receiptPricing } from "../../shared/receiptPricing.ts";
import type { Env, User } from "./types.ts";
import type { DocumentDraft } from "../../shared/documents.ts";
import { scaledDecimal, lineTotals } from "../../shared/documents.ts";
import { lineSerials, serialKey } from "../../shared/documentSerials.ts";
import { ApiError } from "./http.ts";
/** All statements join the caller's D1 batch: no intermediate durable draft or stock. */
export async function receiptPosting(
  env: Env,
  id: string,
  draft: DocumentDraft,
  user: User,
  labels: Record<string, string>,
  replacing = false,
): Promise<D1PreparedStatement[]> {
  if (draft.kind !== "receipt")
    throw new ApiError(
      400,
      "RECEIPT_ONLY",
      "Chỉ phiếu nhập được lưu và cập nhật tồn ở bước này.",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ draft, commit: true })),
  );
  const requestHash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  const statements: D1PreparedStatement[] = replacing
    ? [
        env.DB.prepare(
          "UPDATE inventory_documents SET business_date=?,supplier_id=?,partner_name_snapshot=?,invoice_number=?,notes=?,request_hash=?,posted_by=?,posted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='posted'",
        ).bind(
          draft.business_at.slice(0, 10),
          draft.supplier_id || null,
          labels["suppliers:" + draft.supplier_id] ?? "",
          draft.invoice_number,
          draft.notes,
          requestHash,
          user.id,
          id,
        ),
      ]
    : [
        env.DB.prepare(
          "INSERT INTO inventory_documents(id,code,type,business_date,status,supplier_id,partner_name_snapshot,invoice_number,created_by,posted_by,posted_at,idempotency_key,request_hash,source_reference,notes) SELECT id,code,'IN',substr(business_at,1,10),'posted',supplier_id,?,json_extract(header_json,'$.invoice_number'),created_by,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'receipt:'||id,?,'prepared:'||id,json_extract(header_json,'$.notes') FROM document_drafts WHERE id=?",
        ).bind(
          labels["suppliers:" + draft.supplier_id] ?? "",
          user.id,
          requestHash,
          id,
        ),
      ];
  let landedLines: ReturnType<typeof receiptLandedCosts>;
  try {
    landedLines = receiptLandedCosts(draft);
  } catch (e) {
    throw new ApiError(
      400,
      "RECEIPT_COST_VALIDATION",
      e instanceof Error ? e.message : "Chi phí không hợp lệ.",
    );
  }
  for (const [index, line] of draft.lines.entries()) {
    if (
      (line.pricing_mode || "unit_net") === "unit_net"
        ? line.unit_price === ""
        : !line.pricing_value
    )
      throw new ApiError(
        400,
        "PRICE_REQUIRED",
        `Dòng ${index + 1}: Đơn giá bắt buộc khi lưu nhập kho.`,
      );
    const exact = receiptPricing(line),
      amount = lineTotals(line, "receipt"),
      lineId = crypto.randomUUID(),
      qty = Number(scaledDecimal(line.quantity, 3, "Thực nhập")!),
      landed = landedLines[index].landed,
      hasCosts = landedLines[index].allocated > 0,
      numerator = hasCosts ? String(BigInt(landed) * 1000n) : exact.numerator,
      denominator = hasCosts ? String(qty) : exact.denominator,
      price = hasCosts
        ? Number((BigInt(landed) * 1000000n + BigInt(qty) / 2n) / BigInt(qty))
        : exact.legacyMilli;
    if (hasCosts && BigInt(landed) * 1000n > 9000000000n * BigInt(qty))
      throw new ApiError(
        400,
        "PRICE_LIMIT",
        `Dòng ${index + 1}: Đơn giá vốn sau phân bổ vượt giới hạn.`,
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO inventory_document_lines(id,document_id,line_number,part_id,sku_snapshot,part_name_snapshot,unit_snapshot,quantity_milli,unit_price_vnd_milli,amount_vnd,to_warehouse_id,unit_price_numerator,unit_price_denominator) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        lineId,
        id,
        index + 1,
        line.part_id,
        labels["sku:" + line.part_id] ?? "",
        labels["parts:" + line.part_id] ?? "",
        labels["unit:" + line.part_id] ?? "",
        qty,
        price,
        landed,
        draft.warehouse_id,
        numerator,
        denominator,
      ),
      env.DB.prepare(
        "INSERT INTO receipt_line_details(inventory_line_id,invoice_quantity_milli,vat_rate_hundredths,net_vnd,vat_vnd,gross_vnd,tank_id,data_package,pricing_mode,pricing_value,stock_before_quantity_milli,stock_before_value_vnd) VALUES (?,?,?,?,?,?,?,?,?,?,(SELECT coalesce((SELECT quantity_milli FROM stock_balances WHERE part_id=? AND warehouse_id=?),0)-coalesce((SELECT sum(m.quantity_delta_milli) FROM stock_movements m JOIN inventory_document_lines l ON l.id=m.document_line_id WHERE l.document_id=? AND m.part_id=? AND m.warehouse_id=?),0)),(SELECT coalesce((SELECT value_vnd FROM stock_balances WHERE part_id=? AND warehouse_id=?),0)-coalesce((SELECT sum(m.value_delta_vnd) FROM stock_movements m JOIN inventory_document_lines l ON l.id=m.document_line_id WHERE l.document_id=? AND m.part_id=? AND m.warehouse_id=?),0)))",
      ).bind(
        lineId,
        Number(
          scaledDecimal(
            line.document_quantity || line.quantity,
            3,
            "SL chứng từ",
          )!,
        ),
        Number(scaledDecimal(line.vat_rate, 2, "VAT")!),
        amount.net,
        amount.vat,
        amount.gross,
        line.tank_id || null,
        line.data_package,
        exact.mode,
        exact.value,
        line.part_id,
        draft.warehouse_id,
        id,
        line.part_id,
        draft.warehouse_id,
        line.part_id,
        draft.warehouse_id,
        id,
        line.part_id,
        draft.warehouse_id,
      ),
      env.DB.prepare(
        "INSERT INTO stock_movements(id,document_line_id,part_id,warehouse_id,quantity_delta_milli,value_delta_vnd) VALUES (?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        lineId,
        line.part_id,
        draft.warehouse_id,
        qty,
        landed,
      ),
      env.DB.prepare(
        "INSERT INTO stock_balances(part_id,warehouse_id,quantity_milli,value_vnd) VALUES (?,?,?,?) ON CONFLICT(part_id,warehouse_id) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,value_vnd=value_vnd+excluded.value_vnd",
      ).bind(line.part_id, draft.warehouse_id, qty, landed),
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO stock_lots(source_line_id,part_id,warehouse_id,stock_state,initial_quantity_milli,remaining_quantity_milli,original_value_vnd,available_at) VALUES (?,?,?,'new',?,?,?,?)",
      ).bind(
        lineId,
        line.part_id,
        draft.warehouse_id,
        qty,
        qty,
        landed,
        draft.business_at,
      ),
      env.DB.prepare(
        "INSERT INTO stock_buckets(part_id,warehouse_id,stock_state,quantity_milli,value_vnd) VALUES (?,?,'new',?,?) ON CONFLICT(part_id,warehouse_id,stock_state) DO UPDATE SET quantity_milli=quantity_milli+excluded.quantity_milli,value_vnd=value_vnd+excluded.value_vnd,version=version+1",
      ).bind(line.part_id, draft.warehouse_id, qty, landed),
    );
    const values = lineSerials(line);
    if (values.length)
      statements.push(
        env.DB.prepare(
          "INSERT INTO inventory_serials(part_id,serial_key,serial_number,warehouse_id,stock_state,status,document_line_id,cost_vnd_milli) SELECT ?,json_extract(value,'$.key'),json_extract(value,'$.number'),?,'new','in_stock',?,? FROM json_each(?)",
        ).bind(
          line.part_id,
          draft.warehouse_id,
          lineId,
          Number((BigInt(landed)*1000000n+BigInt(qty)/2n)/BigInt(qty)),
          JSON.stringify(
            values.map((value) => ({ key: serialKey(value), number: value })),
          ),
        ),
      );
  }
  statements.push(
    env.DB.prepare(
      "UPDATE document_drafts SET posted_inventory_id=? WHERE id=? AND posted_inventory_id IS NULL",
    ).bind(id, id),
  );
  return statements;
}
