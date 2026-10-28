import { documentDate } from "./documentFormatting";
import { useRef, useState } from "react";
import { parseDraft } from "../../shared/documents";
import type { DocumentDraft } from "../../shared/documents";
import type { DocumentClient } from "./documentClient";
import { docButton, docInput } from "./CatalogPicker";
import { accessMessage } from "../api/catalogClient";
export function DocumentBulkImport({
  documents,
  onClose,
  onSaved,
}: {
  documents: DocumentClient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(""),
    [rows, setRows] = useState<DocumentDraft[]>(),
    [results, setResults] = useState<Record<number, string>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const keys = useRef<string[]>([]),
    lock = useRef(false);
  async function save() {
    if (!rows || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let completed = 0;
    try {
      for (let i = 0; i < rows.length; i++) {
        if (results[i]) continue;
        const result = await documents.save(rows[i], keys.current[i]);
        setResults((prev) => ({ ...prev, [i]: result.code }));
        completed++;
      }
    } catch (e) {
      setError(
        accessMessage(e) +
          " Những phiếu đã lưu được giữ nguyên; bấm tiếp tục sẽ chỉ xử lý phiếu còn lại.",
      );
    } finally {
      if (completed) onSaved();
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Nhập nhiều phiếu xuất"
        className="max-h-[90dvh] w-full max-w-3xl space-y-3 overflow-auto rounded-xl bg-white p-5"
      >
        <h3 className="font-bold">Nhập nhiều phiếu xuất — bản nháp</h3>
        <p className="text-xs text-slate-600">
          Dán mảng JSON các phiếu PX theo cấu trúc xuất JSON của màn này, tối đa
          20 phiếu/đợt. Mã danh mục dùng ID đang có; Serial phải là chuỗi. Tạo
          nháp chưa trừ tồn.
        </p>
        <textarea
          aria-label="JSON nhiều phiếu PX"
          className={docInput}
          rows={7}
          value={text}
          disabled={busy || Object.keys(results).length > 0}
          onChange={(e) => {
            setText(e.target.value);
            setRows(undefined);
          }}
        />
        {rows && (
          <div className="overflow-auto">
            <table className="catalog-table w-full">
              <thead>
                <tr>
                  <th>Ngày giờ</th>
                  <th className="text-right">Số dòng</th>
                  <th>Người nhận</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={keys.current[index]}>
                    <td>{documentDate(row.business_at)}</td>
                    <td className="text-right tabular-nums">
                      {row.lines.length}
                    </td>
                    <td>{row.recipient}</td>
                    <td>
                      {results[index] ? (
                        <span className="font-mono text-emerald-700">
                          {results[index]}
                        </span>
                      ) : (
                        "Chưa lưu"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-between gap-2 text-xs">
          <span className="tabular-nums">
            Đã lưu {Object.keys(results).length}/{rows?.length ?? 0} phiếu nháp
          </span>
          <div className="flex gap-2">
            <button className={docButton} disabled={busy} onClick={onClose}>
              Đóng
            </button>
            <button
              className={docButton}
              disabled={busy || Object.keys(results).length > 0}
              onClick={() => {
                setError("");
                try {
                  const parsed: unknown = JSON.parse(text);
                  if (
                    !Array.isArray(parsed) ||
                    !parsed.length ||
                    parsed.length > 20
                  )
                    throw new Error("Cần mảng 1–20 phiếu.");
                  const data = parsed.map((value, index) => {
                    try {
                      const raw =
                        value && typeof value === "object" && "draft" in value
                          ? value.draft
                          : value;
                      const d = parseDraft(raw);
                      if (d.kind !== "issue")
                        throw new Error("Chỉ nhập phiếu PX ở đây.");
                      return {
                        ...d,
                        lines: d.lines.map((line) => ({
                          ...line,
                          id: crypto.randomUUID(),
                        })),
                      };
                    } catch (error) {
                      throw new Error(
                        `Phiếu ${index + 1}: ${error instanceof Error ? error.message : "Dữ liệu không hợp lệ."}`,
                      );
                    }
                  });
                  setRows(data);
                  keys.current = data.map(() => crypto.randomUUID());
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "JSON không hợp lệ.",
                  );
                }
              }}
            >
              Kiểm tra / xem trước
            </button>
            <button
              className={docButton + " !bg-blue-600 !text-white"}
              disabled={
                busy || !rows || Object.keys(results).length === rows.length
              }
              onClick={() => {
                void save();
              }}
            >
              {busy ? "Đang lưu…" : "Lưu / tiếp tục"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
