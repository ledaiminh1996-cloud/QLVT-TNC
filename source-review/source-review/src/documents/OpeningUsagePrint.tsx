import {openingUsageAssessment,openingUsageTotals} from "../../shared/openingUsageAssessment";
import type { DocumentRecord } from "../../shared/documents";
import { lineSerials } from "../../shared/documentSerials";
import { documentDateTime, money } from "./documentFormatting";
const number = (value: number | null, decimals = 3) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: decimals,
      }).format(value);
export function OpeningUsagePrint({ row }: { row: DocumentRecord }) {
  const { draft, labels } = row;
  const totals=openingUsageTotals(draft.lines);
  return (
    <main className="receipt-print opening-usage-print">
      <header>
        <div className="company">
          CÔNG TY TNHH DV VÀ TM TÂN NAM CHINH. MÃ SỐ THUẾ: 0303955513
        </div>
        <h1>PHIẾU VẬT TƯ ĐANG SỬ DỤNG ĐẦU KỲ</h1>
        <div className="document-number">
          Số: <strong>{row.code}</strong> · Ngày khai báo:{" "}
          {documentDateTime(draft.business_at)}
        </div>
      </header>
      {row.status !== "posted" && (
        <div className="receipt-watermark">
          {row.status === "cancelled" ? "PHIẾU ĐÃ HỦY" : "CHƯA GHI NHẬN"}
        </div>
      )}
      <section className="receipt-meta">
        {draft.opening_details&&<><p>Tài xế: {draft.opening_details.driver_name||"—"} · Đầu kéo: {draft.opening_details.vehicle_plate||"—"} · ODO: {draft.opening_details.vehicle_odo?number(Number(draft.opening_details.vehicle_odo)):"—"}</p><p>Rơ moóc: {draft.opening_details.trailer_number||"—"} · ODO: {draft.opening_details.trailer_odo?number(Number(draft.opening_details.trailer_odo)):"—"} · Máy phát: {draft.opening_details.generator_code||"—"}</p></>}
        <p>
          Nội dung:{" "}
          {draft.purpose ||
            "Khai báo vật tư đang sử dụng khi bắt đầu theo dõi hệ thống."}
        </p>
        <p>
          Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ. Không làm thay đổi tồn kho.
        </p>
      </section>
      <table>
        <colgroup>
          {[4, 9, 16, 16, 5, 10, 10, 7, 10, 13].map((w, i) => (
            <col key={i} style={{ width: w + "%" }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {[
              "STT",
              "Mã vật tư",
              "Tên vật tư / ĐVT",
              "Xe, thiết bị / vị trí lắp",
              "SL",
              "Serial",
              "Nguyên giá",
              "Tỷ lệ còn lại (%)",
              "Giá trị còn lại",
              "Căn cứ/người xác nhận",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line, index) => {
            const label = labels["parts:" + line.part_id] || "",
              target =
                labels[
                  (line.target_type === "vehicle"
                    ? "vehicles:"
                    : "equipment:") + line.target_id
                ] || "—";
            const value=openingUsageAssessment(line);
            return (
              <tr key={line.id}>
                <td className="center">{index + 1}</td>
                <td className="code">{labels["sku:" + line.part_id] || "—"}</td>
                <td>
                  {label.split(" — ").slice(1).join(" — ") || label}
                  <small>ĐVT: {labels["unit:" + line.part_id] || "—"}</small>
                  {line.notes && <small>{line.notes}</small>}
                </td>
                <td>
                  {target}
                  <small>{line.to_position || "Chưa rõ vị trí"}</small>
                </td>
                <td className="number">{number(Number(line.quantity))}</td>
                <td className="code">{lineSerials(line).join("; ") || "—"}</td>
                <td className="number">{line.opening_current_unit_price ? number(Number(line.opening_current_unit_price)) : "—"}</td>
                <td className="number">{line.opening_quality_percent ? number(Number(line.opening_quality_percent),2)+"%" : "—"}</td>
                <td className="number">{money(value.amount_vnd)}</td>
                <td>{line.opening_assessor||"—"}{line.opening_confirmation_basis&&<small>{line.opening_confirmation_basis}</small>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <section className="receipt-bottom">
        <p className="payment">
          Tổng số lượng: <strong>{number(totals.quantity_milli/1000)}</strong> · Tổng nguyên giá: <strong>{money(totals.base_vnd)}</strong> · Tổng giá trị còn lại: <strong>{money(totals.remaining_vnd)}</strong>
        </p>
        <div
          className="receipt-signatures"
          style={{ gridTemplateColumns: "repeat(3,1fr)" }}
        >
          {[
            "Người lập phiếu",
            "Người quản lý phương tiện",
            "Trưởng bộ phận",
          ].map((label, index) => (
            <div key={label}>
              <strong>{label}</strong>
              <em>(Ký, ghi rõ họ tên)</em>
              <div className="signature-space" />
              {index === 0 && <strong>{row.created_by_name}</strong>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
