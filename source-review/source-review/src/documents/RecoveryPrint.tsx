import type { DocumentRecord } from "../../shared/documents";
import { lineSerials, serialKey } from "../../shared/documentSerials";
import {
  recoveryClasses,
  type RecoveryClass,
} from "../../shared/recoveryDetails";
import { documentDateTime, money } from "./documentFormatting";
const blank = "........................................";
const number = (v: number | null, decimals = 0) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: decimals,
      }).format(v);
export function recoveryPrintRows(row: DocumentRecord) {
  let sequence = 0;
  return row.draft.lines.flatMap((line) => {
    const serials = lineSerials(line),
      raw = row.labels["recovery_amount:" + line.id],
      amount = raw === undefined ? null : Number(raw),
      priceRaw = row.labels["recovery_unit_price:" + line.id],
      price =
        priceRaw === undefined
          ? amount !== null && Number(line.quantity) > 0
            ? amount / Number(line.quantity)
            : null
          : Number(priceRaw) / 1000;
    const entries =
      serials.length === Number(line.quantity) && serials.length
        ? serials
        : [serials.join("; ")];
    let serialCosts: Array<{
      serial: string;
      amount_vnd: number;
      unit_price_vnd_milli: number;
    }> = [];
    try {
      const value: unknown = JSON.parse(
        row.labels["recovery_serial_costs:" + line.id] ?? "[]",
      );
      if (Array.isArray(value))
        serialCosts = value.filter(
          (
            entry,
          ): entry is {
            serial: string;
            amount_vnd: number;
            unit_price_vnd_milli: number;
          } =>
            entry &&
            typeof entry === "object" &&
            typeof entry.serial === "string" &&
            Number.isSafeInteger(entry.amount_vnd) &&
            Number.isSafeInteger(entry.unit_price_vnd_milli),
        );
    } catch {}
    return entries.map((serial, index) => ({
      line,
      sequence: ++sequence,
      serial,
      quantity:
        entries.length === serials.length && serials.length
          ? "1"
          : line.quantity,
      price:
        serialCosts.find((cost) => serialKey(cost.serial) === serialKey(serial))
          ?.unit_price_vnd_milli !== undefined
          ? serialCosts.find(
              (cost) => serialKey(cost.serial) === serialKey(serial),
            )!.unit_price_vnd_milli / 1000
          : price,
      amount:
        serialCosts.find((cost) => serialKey(cost.serial) === serialKey(serial))
          ?.amount_vnd ??
        (amount === null
          ? null
          : entries.length > 1
            ? Number(
                BigInt(amount) / BigInt(entries.length) +
                  (BigInt(index) < BigInt(amount) % BigInt(entries.length)
                    ? 1n
                    : 0n),
              )
            : amount),
    }));
  });
}
export function RecoveryPrint({ row }: { row: DocumentRecord }) {
  const { draft, labels } = row,
    info = draft.recovery_details,
    rows = recoveryPrintRows(row),
    classes = new Set(
      draft.lines.map(
        (l) =>
          l.recovery_classification ??
          (l.stock_state === "pending_scrap" ? "CTL" : "CSD"),
      ),
    );
  const source =
    info?.removed_from ||
    Array.from(
      new Set(
        draft.lines
          .map((l) => labels["recovery_source:" + l.id])
          .filter(Boolean),
      ),
    ).join("; ");
  return (
    <main className="receipt-print recovery-print">
      <header>
        <div className="company">
          CÔNG TY TNHH DV VÀ TM TÂN NAM CHINH. MÃ SỐ THUẾ: 0303955513
        </div>
        <h1>PHIẾU THU HỒI VẬT TƯ</h1>
        <div className="document-number">
          Số: <strong>{row.code}</strong> · Ngày{" "}
          {documentDateTime(draft.business_at)}
        </div>
      </header>
      {row.status !== "posted" && (
        <div className="receipt-watermark">
          {row.status === "cancelled" ? "PHIẾU ĐÃ HỦY" : "CHƯA GHI SỔ KHO"}
        </div>
      )}
      <section className="receipt-meta">
        <p>Phương tiện tháo vật tư: {source || blank}</p>
        <p>
          Biển số xe: {info?.vehicle_plate || "................"} · Rơmooc số:{" "}
          {info?.trailer_number || "................"} · Máy phát số:{" "}
          {info?.generator_code || "................"} · Container số:{" "}
          {info?.container_number || "................"}
        </p>
        <p>Họ tên lái xe: {info?.driver_name || blank}</p>
        <p>
          Số Km (ODO) hiện tại:{" "}
          {info?.odo ? number(Number(info.odo), 3) : blank}
          {info?.hours && (
            <span className="address">
              Giờ máy: {number(Number(info.hours), 3)}
            </span>
          )}
        </p>
        <p>Lý do tháo: {draft.purpose || blank}</p>
        <p>
          Người bàn giao: {info?.handover_name || blank}
          <span className="address">
            Người tiếp nhận: {draft.recipient || blank}
          </span>
        </p>
        <p>
          Phân loại:{" "}
          {Object.entries(recoveryClasses).map(([key, label]) => (
            <span key={key} className="recovery-class">
              {label} ({key}) {classes.has(key as RecoveryClass) ? "☑" : "☐"}
            </span>
          ))}
        </p>
        <p>Ghi chú: {draft.notes || blank}</p>
      </section>
      <table className="receipt-goods">
        <colgroup>
          {[4, 11, 19, 5, 6, 10, 11, 9, 10, 6, 9].map((w, i) => (
            <col key={i} style={{ width: w + "%" }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {[
              "STT",
              "Mã vật tư",
              "Tên vật tư",
              "ĐVT",
              "Số lượng",
              "Đơn giá",
              "Thành tiền",
              "Chất lượng (% còn lại)",
              "Số serial (nếu có)",
              "Phân loại",
              "Mã kho nhận thu hồi",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((printed) => {
            const l = printed.line,
              quality =
                l.recovery_quality_percent ??
                labels["recovery_quality:" + l.id],
              name = labels["parts:" + l.part_id] ?? "";
            return (
              <tr
                key={l.id + ":" + printed.sequence}
                data-serial-row={printed.serial || undefined}
              >
                <td className="center">{printed.sequence}</td>
                <td className="code">
                  {labels["sku:" + l.part_id] || name.split(" — ")[0] || "—"}
                </td>
                <td>
                  {name.includes(" — ")
                    ? name.split(" — ").slice(1).join(" — ")
                    : name}
                  {l.notes && <small>{l.notes}</small>}
                  {labels["recovery_valuation_method:"+l.id]==="current_price_quality"&&<small>Giá mua hiện tại: {number(Number(l.recovery_current_unit_price),3)} đ/đơn vị × chất lượng {l.recovery_quality_percent}%. Kỹ thuật xác nhận: {l.recovery_assessor}.</small>}
                </td>
                <td className="center">{labels["unit:" + l.part_id] || "—"}</td>
                <td className="number">
                  {number(Number(printed.quantity), 3)}
                </td>
                <td className="number">{number(printed.price, 3)}</td>
                <td className="number">
                  {number(printed.amount)}{labels["valuation_pending:"+l.id]==="1"&&<small>Chưa xác định giá trị – cần bổ sung sau.</small>}{labels["recovery_estimated_hours:"+l.id]==="1"&&<small>Giờ tạm tính từ thời gian lắp/tháo</small>}
                  {labels["recovery_remaining_percent:" + l.id] !==
                    undefined && (
                    <small>
                      Còn{" "}
                      {number(
                        Number(labels["recovery_remaining_percent:" + l.id]),
                        2,
                      )}
                      % định mức
                    </small>
                  )}
                </td>
                <td className="center">
                  {quality !== undefined && quality !== ""
                    ? number(Number(quality), 2) + "%"
                    : "—"}
                </td>
                <td className="code">{printed.serial || "—"}</td>
                <td className="center">
                  {l.recovery_classification ??
                    (l.stock_state === "pending_scrap" ? "CTL" : "CSD")}
                </td>
                <td className="code">
                  {labels["warehouses:" + draft.warehouse_id]?.split(
                    " — ",
                  )[0] || "—"}
                </td>
              </tr>
            );
          })}
          <tr className="receipt-total">
            <td colSpan={6}>Tổng cộng</td>
            <td className="number">{number(row.totals.net)}</td>
            <td colSpan={4} />
          </tr>
        </tbody>
      </table>
      <section className="receipt-bottom">
        <p>
          Giá trị quản trị tồn thu hồi; không phải bút toán khấu hao kế toán tài
          chính.
        </p>
        <p className="payment">
          Tổng giá trị thu hồi: <strong>{money(row.totals.net)}</strong>
        </p>
        <div className="receipt-signatures">
          {[
            "Người lập phiếu",
            "Người tiếp nhận",
            "Thủ kho",
            "Trưởng bộ phận",
          ].map((label, index) => (
            <div key={label}>
              <strong>{label}</strong>
              <em>(Ký, ghi rõ họ tên)</em>
              <div className="signature-space" />
              {index === 0 && <strong>{row.created_by_name}</strong>}
              {index === 1 && <strong>{draft.recipient}</strong>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
export const recoveryPrintCss = `.receipt-print.recovery-print .recovery-class{display:inline-block;margin-right:10px;white-space:nowrap}.receipt-print.recovery-print .number{overflow-wrap:normal;word-break:normal}.receipt-print.recovery-print .receipt-signatures strong{display:block}`;
