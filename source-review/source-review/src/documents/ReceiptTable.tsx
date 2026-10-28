import {documentDateTime} from "./documentFormatting";
import { displayInvoiceNumber } from "../../shared/invoiceNumber";
import type { ReceiptSort, SortDirection } from "../../shared/receiptSort";
import { receiptColumns, type ReceiptColumn } from "./ReceiptColumns";
import { normalizeReceiptUnits } from "../../shared/receiptTotals";
import { StatusBadge } from "../components/StatusBadge";
import { Eye, Printer, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { DocumentSummary } from "../../shared/documents";
import { editableDraft } from "../../shared/documents";
import { ReceiptRowMenu } from "./ReceiptRowMenu";
import { docButton } from "./CatalogPicker";
import { documentDate, documentCreatedAt } from "./documentFormatting";
import type { Session } from "../api/catalogClient";

type Action =
  "view" | "print" | "history" | "excel" | "duplicate" | "edit" | "cancel";
export function receiptRate(values: string[] | undefined, suffix = ""): string {
  if (!values?.length) return "—";
  if (values.length > 1) return "Nhiều mức";
  return values[0] === ""
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 12 }).format(
        Number(values[0]),
      ) + suffix;
}
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
/** Quantity totals travel as integer thousandths, avoiding floating point accumulation. */
export function receiptQuantity(value: string | undefined): string {
  if (value === undefined) return "—";
  const n = BigInt(value),
    whole = n / 1000n,
    fraction = String(n % 1000n)
      .padStart(3, "0")
      .replace(/0+$/, "");
  return (
    new Intl.NumberFormat("vi-VN").format(whole) +
    (fraction ? "," + fraction : "")
  );
}
export function ReceiptTable({
  rows,
  busy,
  user,
  onOpen,
  selectedColumns,
  sort = "business_at",
  direction = "desc",
  onSort,
}: {
  rows: DocumentSummary[];
  selectedColumns?: ReceiptColumn[];
  sort?: ReceiptSort;
  direction?: SortDirection;
  onSort?: (key: ReceiptSort) => void;
  busy: boolean;
  user: NonNullable<Session["user"]>;
  onOpen: (row: DocumentSummary, action: Action) => void;
}) {
  const visible = receiptColumns.filter(
    (c) =>
      ["quantity", "serial", "editor"].includes(c.key) &&
      (selectedColumns ?? []).includes(c.key),
  );
  const writable = ["admin", "accountant", "warehouse"].includes(user.role);
  const admin = ["admin", "accountant"].includes(user.role);
  const quantityFor = (
    value: string | undefined,
    units: string[] | undefined,
    total = false,
  ) => {
    const normalized = normalizeReceiptUnits(units ?? [""]);
    if (value === undefined || normalized.length !== 1 || !normalized[0])
      return total ? "—" : normalized.length > 1 ? "Nhiều ĐVT" : "—";
    return receiptQuantity(value) + " " + normalized[0];
  };
  function sortedHeader(label: string, key: ReceiptSort, right = false) {
    const Icon =
      sort === key ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        className={right ? "text-right" : ""}
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
          title={"Sắp xếp theo " + label}
          className={
            "inline-flex w-full items-center gap-1 font-semibold " +
            (right ? "justify-end" : "justify-start")
          }
          onClick={() => onSort?.(key)}
        >
          {label}
          <Icon size={12} aria-hidden="true" />
        </button>
      </th>
    );
  }
  const columnWidths=[124,160,64,170,88,160,150,108,160,...visible.map(c=>c.width),120,110,160,112];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className="h-[50dvh] min-h-[180px] flex-1 overflow-auto rounded-xl border border-slate-200 bg-white lg:h-auto lg:min-h-0"
        aria-label="Bảng phiếu nhập cuộn"
      >
        <table
          className="catalog-table w-full table-fixed text-left [&_thead_th]:!whitespace-nowrap [&_thead_th]:!px-2 [&_tbody_td]:!px-2"
          style={{
            minWidth: columnWidths.reduce((sum,width)=>sum+width,0),
          }}
        >
          <colgroup>
            {columnWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
            <tr>
              {sortedHeader("Số phiếu", "code")}
              {sortedHeader("Ngày CT", "business_at")}
              <th>Kho</th>
              <th>Nhà cung cấp</th>
              <th>Số hóa đơn</th>
              <th>Mục đích/nội dung</th>
              <th className="text-right">Tiền hàng (trước VAT)</th>
              <th className="text-right">Tiền VAT</th>
              {sortedHeader("Tiền hàng (sau VAT)", "gross", true)}
              {visible.map((c) => (
                <th
                  key={c.key}
                  className={c.key === "quantity" ? "text-right" : ""}
                >
                  {c.label}
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
              const split = row.partner_label.indexOf(" — ");
              const supplierCode =
                  split < 0 ? "" : row.partner_label.slice(0, split),
                supplierName =
                  split < 0
                    ? row.partner_label
                    : row.partner_label.slice(split + 3);
              const own =
                user.role !== "warehouse" || row.created_by === user.id;
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
                    <div className="!whitespace-normal break-words leading-5">
                      {supplierCode && (
                        <span className="block font-mono text-[11px] text-slate-500">
                          {supplierCode}
                        </span>
                      )}
                      <span className="line-clamp-2" title={supplierName}>
                        {supplierName || "—"}
                      </span>
                    </div>
                  </td>
                  <td title={displayInvoiceNumber(row.invoice_number)}>
                    {displayInvoiceNumber(row.invoice_number) || "—"}
                  </td>
                  <td title={row.purpose}>
                    <div className="line-clamp-2 !whitespace-normal">
                      {row.purpose || "—"}
                    </div>
                  </td>
                  <td className="text-right font-sans tabular-nums">
                    {row.totals.net === null
                      ? "—"
                      : number.format(row.totals.net)}
                  </td>
                  <td className="text-right font-sans tabular-nums">
                    {row.totals.vat === null
                      ? "—"
                      : number.format(row.totals.vat)}
                  </td>
                  <td
                    className="text-right font-sans tabular-nums"
                    title={
                      row.totals.gross === null
                        ? "Chưa xác định giá trị"
                        : undefined
                    }
                  >
                    {row.totals.gross === null
                      ? "—"
                      : number.format(row.totals.gross)}
                  </td>
                  {visible.map((c) => {
                    let value: string;
                    if (c.key === "quantity")
                      value = quantityFor(
                        row.total_quantity,
                        row.quantity_units,
                      );
                    else if (c.key === "net" || c.key === "vat")
                      value =
                        row.totals[c.key] === null
                          ? "—"
                          : number.format(row.totals[c.key]!);
                    else if (c.key === "creator")
                      value = row.created_by_name || "—";
                    else if (c.key === "created")
                      value = documentCreatedAt(row.created_at);
                    else if (c.key === "editor")
                      value = row.last_edited_by_name || "—";
                    else
                      value = row.serial_numbers?.length
                        ? row.serial_numbers.slice(0, 2).join(", ") +
                          (row.serial_numbers.length > 2
                            ? ` (+${row.serial_numbers.length - 2})`
                            : "")
                        : "—";
                    return (
                      <td
                        key={c.key}
                        title={
                          c.key === "serial"
                            ? row.serial_numbers?.join("\n")
                            : value
                        }
                        className={
                          c.key === "quantity" ||
                          c.key === "net" ||
                          c.key === "vat"
                            ? "text-right font-sans tabular-nums"
                            : c.key === "serial"
                              ? "font-mono"
                              : c.key === "created"
                                ? "tabular-nums"
                                : ""
                        }
                      >
                        {value}
                      </td>
                    );
                  })}
                  <td className="catalog-cell-center">
                    <StatusBadge
                      value={row.status}
                      label={
                        row.status === "posted" ? "Đã nhập kho" : undefined
                      }
                    />
                  </td>
                  <td title={row.created_by_name}>
                    <span className="line-clamp-2 !whitespace-normal">
                      {row.created_by_name || "—"}
                    </span>
                  </td>
                  <td
                    className="font-sans tabular-nums"
                    title={documentCreatedAt(row.created_at)}
                  >
                    {documentCreatedAt(row.created_at)}
                  </td>
                  <td className="catalog-actions-cell">
                    <div className="catalog-actions">
                      <button
                        type="button"
                        title="Xem phiếu"
                        aria-label={"Xem " + row.code}
                        disabled={busy}
                        className={docButton + " !px-1.5"}
                        onClick={() => onOpen(row, "view")}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        title="In phiếu (có thể lưu PDF trong hộp thoại in)"
                        aria-label={"In phiếu " + row.code}
                        disabled={busy}
                        className={docButton + " !px-1.5"}
                        onClick={() => onOpen(row, "print")}
                      >
                        <Printer size={14} />
                      </button>
                      <ReceiptRowMenu
                        code={row.code}
                        busy={busy}
                        writable={writable}
                        canEdit={
                          writable &&
                          own &&
                          !!(row.can_modify || editableDraft(row.status))
                        }
                        canCancel={
                          writable &&
                          own &&
                          !!(
                            row.can_modify ||
                            (admin && editableDraft(row.status))
                          )
                        }
                        onAction={(action) => onOpen(row, action)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td
                  colSpan={13 + visible.length}
                  className="text-center text-slate-500"
                >
                  Chưa có chứng từ phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
