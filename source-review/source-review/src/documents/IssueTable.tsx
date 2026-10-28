import type { ReceiptColumn } from "./ReceiptColumns";
import type { DocumentSummary } from "../../shared/documents";
import { editableDraft } from "../../shared/documents";
import type { Session } from "../api/catalogClient";
import type { ReceiptSort, SortDirection } from "../../shared/receiptSort";
import { Eye, Printer, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { ReceiptRowMenu } from "./ReceiptRowMenu";
import { StatusBadge } from "../components/StatusBadge";
import { docButton } from "./CatalogPicker";
import { documentDateTime, documentCreatedAt } from "./documentFormatting";
import { receiptQuantity } from "./ReceiptTable";
import { normalizeReceiptUnits } from "../../shared/receiptTotals";
export function IssueTable({
  rows,
  selectedColumns = [],
  user,
  busy,
  sort,
  direction,
  onSort,
  onOpen,
}: {
  rows: DocumentSummary[];
  selectedColumns?: ReceiptColumn[];
  user: NonNullable<Session["user"]>;
  busy: boolean;
  sort: ReceiptSort;
  direction: SortDirection;
  onSort: (key: ReceiptSort) => void;
  onOpen: (
    row: DocumentSummary,
    mode:
      "view" | "print" | "history" | "excel" | "duplicate" | "edit" | "cancel",
  ) => void;
}) {
  const visible = ["serial", "editor"].filter((key) =>
    selectedColumns.includes(key as ReceiptColumn),
  );
  const sortable = (label: string, key: ReceiptSort, right = false) => {
    const Icon =
      sort === key ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        aria-sort={
          sort === key
            ? direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <button
          type="button"
          className={
            "inline-flex w-full items-center gap-1 font-semibold " +
            (right ? "justify-end" : "")
          }
          title={"Sắp xếp theo " + label}
          onClick={() => onSort(key)}
        >
          {label}
          <Icon size={12} />
        </button>
      </th>
    );
  };
  const columnWidths=[124,160,68,150,175,100,140,...visible.map(()=>145),120,110,160,112];
  return (
    <div
      className="h-[50dvh] min-h-[180px] flex-1 overflow-auto rounded-xl border border-slate-200 bg-white lg:h-auto lg:min-h-0"
      aria-label="Bảng phiếu xuất cuộn"
    >
      <table
        className="catalog-table w-full table-fixed text-left [&_thead_th]:!whitespace-nowrap [&_thead_th]:!px-2 [&_tbody_td]:!px-2"
        style={{ minWidth: columnWidths.reduce((sum,width)=>sum+width,0) }}
      >
        <colgroup>
          {columnWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
          <tr>
            {sortable("Số phiếu", "code")}
            {sortable("Ngày CT", "business_at")}
            <th>Kho</th>
            <th>Người nhận</th>
            <th>Mục đích/nội dung</th>
            <th className="text-right">Tổng SL</th>
            {sortable("Giá trị xuất (đ)", "gross", true)}
            {visible.map((key) => (
              <th key={key}>
                {key === "serial" ? "Số serial" : "Người sửa cuối"}
              </th>
            ))}
            <th className="text-center">Trạng thái</th>
            <th>Người tạo</th>
            <th>Ngày giờ tạo</th>
            <th className="text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const own = user.role !== "warehouse" || row.created_by === user.id;
            const writable =
              ["admin", "accountant", "warehouse"].includes(user.role) && own;
            const units = normalizeReceiptUnits(row.quantity_units ?? []);
            return (
              <tr
                key={row.id}
                className="border-t border-slate-100 hover:bg-blue-50/50"
              >
                <td className="font-mono font-bold">
                  <button
                    type="button"
                    title={"Xem phiếu " + row.code}
                    className="text-blue-600 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-600"
                    disabled={busy}
                    onClick={() => onOpen(row, "view")}
                  >
                    {row.code}
                  </button>
                </td>
                <td className="tabular-nums" title={documentDateTime(row.business_at)}>
                  {documentDateTime(row.business_at)}
                </td>
                <td className="font-mono" title={row.warehouse_label}>
                  {row.warehouse_label.split(" — ")[0] || "—"}
                </td>
                <td title={row.partner_label}>
                  <span className="line-clamp-2 !whitespace-normal">
                    {row.partner_label || "—"}
                  </span>
                </td>
                <td title={row.purpose}>
                  <span className="line-clamp-2 !whitespace-normal">
                    {row.purpose || "—"}
                  </span>
                </td>
                <td className="text-right tabular-nums">
                  {units.length === 1 && units[0]
                    ? receiptQuantity(row.total_quantity) + " " + units[0]
                    : units.length > 1
                      ? "Nhiều ĐVT"
                      : "—"}
                </td>
                <td
                  className="text-right tabular-nums"
                  title="Giá vốn do máy chủ tính khi ghi sổ"
                >
                  {row.totals.net === null
                    ? "—"
                    : new Intl.NumberFormat("vi-VN").format(row.totals.net)}{row.status==="posted"&&row.totals.net===null&&<span className="block text-xs text-amber-700">⚠ Chưa xác định giá trị</span>}
                </td>
                {visible.map((key) => (
                  <td
                    key={key}
                    className={key === "serial" ? "font-mono" : ""}
                    title={
                      key === "serial"
                        ? row.serial_numbers?.join("\n")
                        : (row.last_edited_by_name ?? "")
                    }
                  >
                    {key === "serial"
                      ? (row.serial_numbers?.slice(0, 2).join(", ") || "—") +
                        (row.serial_numbers && row.serial_numbers.length > 2
                          ? " (+" + (row.serial_numbers.length - 2) + ")"
                          : "")
                      : row.last_edited_by_name || "—"}
                  </td>
                ))}
                <td className="catalog-cell-center">
                  <StatusBadge
                    value={row.status}
                    label={row.status === "posted" ? "Đã xuất kho" : undefined}
                  />
                </td>
                <td title={row.created_by_name}>
                  <span className="line-clamp-2 !whitespace-normal">
                    {row.created_by_name}
                  </span>
                </td>
                <td className="tabular-nums" title={documentCreatedAt(row.created_at)}>
                  {documentCreatedAt(row.created_at)}
                </td>
                <td className="catalog-actions-cell">
                  <div className="catalog-actions">
                    <button
                      type="button"
                      title="Xem phiếu"
                      aria-label={"Xem " + row.code}
                      className={docButton + " !px-1.5"}
                      disabled={busy}
                      onClick={() => onOpen(row, "view")}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      title="In phiếu (có thể lưu PDF)"
                      aria-label={"In phiếu " + row.code}
                      className={docButton + " !px-1.5"}
                      disabled={busy}
                      onClick={() => onOpen(row, "print")}
                    >
                      <Printer size={14} />
                    </button>
                    <ReceiptRowMenu
                      code={row.code}
                      busy={busy}
                      writable={writable}
                      canEdit={writable && editableDraft(row.status)}
                      canCancel={writable && editableDraft(row.status)}
                      onAction={(mode) => onOpen(row, mode)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td
                colSpan={11 + visible.length}
                className="text-center text-slate-500"
              >
                Chưa có phiếu xuất phù hợp.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
