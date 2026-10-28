import {
  normalizeViNumber,
  displayViNumber,
} from "../../shared/documentNumbers";
import { useRef, useState } from "react";
import {
  emptyLine,
  parseQuickLines,
  scaledDecimal,
  stockStates,
} from "../../shared/documents";
import type { DraftLine, DocumentKind } from "../../shared/documents";
import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import { normalizeSearch } from "../../shared/searchText";
import { docButton, docInput, catalogLabel } from "./CatalogPicker";
export function DocumentQuickImport({
  api,
  kind,
  onApply,
  onClose,
}: {
  api: CatalogClient;
  kind: DocumentKind;
  onApply: (lines: DraftLine[], parts: CatalogRow[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<{
      lines: DraftLine[];
      parts: CatalogRow[];
    }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    sequence = useRef(0);
  const incoming = ["receipt", "proposal", "opening"].includes(kind);
  async function inspect() {
    if (busy) return;
    setBusy(true);
    setError("");
    const revision = ++sequence.current;
    try {
      const rows = parseQuickLines(text);
      if (!rows.length) throw new Error("Chưa có dòng để nhập.");
      if (rows.some((row) => row.length < 3 || row.length > 4))
        throw new Error("Mỗi dòng cần 3 hoặc 4 cột. Không thêm dòng tiêu đề.");
      const parts: CatalogRow[] = [],
        lines: DraftLine[] = [];
      for (const [index, values] of rows.entries()) {
        try {
          const [sku, quantity, third, fourth = ""] = values;
          let part = parts.find(
            (p) => normalizeSearch(p.sku) === normalizeSearch(sku),
          );
          if (!part) {
            const page = await api.list("parts", { q: sku, pageSize: 25 });
            part = page.data.find(
              (p) => normalizeSearch(p.sku) === normalizeSearch(sku),
            );
            if (!part)
              throw new Error(`Dòng ${index + 1}: không tìm thấy mã ${sku}.`);
            parts.push(part);
          }
          const line = emptyLine();
          line.part_id = part.id;
          line.quantity = normalizeViNumber(
            quantity,
            `Dòng ${index + 1}: Số lượng`,
          );
          if (scaledDecimal(line.quantity, 3, "Số lượng")! <= 0n)
            throw new Error("Số lượng phải lớn hơn 0.");
          line.document_quantity = line.quantity;
          if (incoming) {
            line.unit_price = normalizeViNumber(
              third,
              `Dòng ${index + 1}: Đơn giá`,
              true,
            );
            scaledDecimal(line.unit_price, 3, "Đơn giá");
            line.data_package = fourth;
          } else {
            const state = Object.entries(stockStates).find(
              ([key, label]) =>
                normalizeSearch(key) === normalizeSearch(third) ||
                normalizeSearch(label) === normalizeSearch(third),
            );
            if (!state)
              throw new Error(
                `Dòng ${index + 1}: trạng thái dùng new/recovered/pending_scrap.`,
              );
            line.stock_state = state[0] as DraftLine["stock_state"];
            line.serial = fourth;
          }
          if (
            part.is_serialized === 1 &&
            scaledDecimal(line.quantity, 3, "Số lượng") !== 1000n
          )
            throw new Error(
              `Dòng ${index + 1}: vật tư SERIAL cần số lượng 1; thêm Serial trong phiếu sau khi áp dụng.`,
            );
          if (line.serial && part.is_serialized !== 1)
            throw new Error(
              `Dòng ${index + 1}: vật tư không quản lý SERIAL, không nhập Serial.`,
            );
          if (line.data_package && part.needs_data_package !== 1)
            throw new Error(
              `Dòng ${index + 1}: vật tư không sử dụng gói Data.`,
            );
          lines.push(line);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Dữ liệu không hợp lệ.";
          throw new Error(
            /^Dòng \d+/.test(message)
              ? message
              : `Dòng ${index + 1}: ${message}`,
          );
        }
      }
      if (sequence.current === revision) setPreview({ lines, parts });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không phân tích được dữ liệu.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Nhập nhanh dòng vật tư"
        className="max-h-[85dvh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl bg-white p-5"
      >
        <h3 className="font-bold">Nhập nhanh dòng vật tư</h3>
        <p className="text-xs text-slate-600">
          {incoming
            ? "Mã vật tư, Số lượng, Đơn giá [, Gói Data]"
            : "Mã vật tư, Số lượng, Trạng thái [, Serial]"}{" "}
          — dán từ Excel (Tab) hoặc CSV. Tối đa 60 dòng; số vi-VN: chấm hàng
          nghìn, phẩy thập phân. Tiền VND là số nguyên; CSV có dấu phẩy thập
          phân cần đặt ô trong dấu ngoặc kép. Dòng SERIAL cần bổ sung Serial
          trong phiếu trước khi lưu. Đây là các dòng nháp, chưa ghi kho.
        </p>
        <textarea
          aria-label="Dữ liệu dòng vật tư"
          rows={7}
          className={docInput}
          disabled={busy}
          value={text}
          placeholder={
            incoming ? "M-IN-TDONG-0001,2,150000" : "M-IN-TDONG-0001,2,new"
          }
          onChange={(e) => {
            setText(e.target.value);
            setPreview(undefined);
          }}
        />
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        {preview && (
          <div className="max-h-52 overflow-auto rounded border border-slate-200">
            <table className="catalog-table w-full text-left">
              <thead>
                <tr>
                  <th>Vật tư</th>
                  <th className="text-right">Số lượng</th>
                  <th>
                    {incoming ? "Đơn giá / Gói Data" : "Trạng thái / Serial"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {catalogLabel(
                        preview.parts.find((p) => p.id === line.part_id)!,
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {displayViNumber(line.quantity)}
                    </td>
                    <td>
                      {incoming
                        ? line.unit_price +
                          (line.data_package ? " · " + line.data_package : "")
                        : stockStates[line.stock_state] + " · " + line.serial}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={docButton}
            disabled={busy}
            onClick={() => {
              sequence.current++;
              onClose();
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            className={docButton}
            disabled={busy}
            onClick={() => {
              void inspect();
            }}
          >
            {busy ? "Đang kiểm tra…" : "Xem trước"}
          </button>
          <button
            type="button"
            className={docButton + " !bg-blue-600 !text-white"}
            disabled={!preview || busy}
            onClick={() => preview && onApply(preview.lines, preview.parts)}
          >
            Thêm vào phiếu
          </button>
        </div>
      </section>
    </div>
  );
}
