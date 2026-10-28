import type { DocumentRecord, DocumentDraft } from "../../shared/documents";
export type ReceiptRange = "today" | "week" | "month" | "previous";
export function vietnamToday(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => p.find((v) => v.type === t)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function receiptDateRange(range: ReceiptRange, now = new Date()) {
  const today = vietnamToday(now),
    [y, m, d] = today.split("-").map(Number);
  const iso = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  if (range === "today") return { from: today, to: today };
  if (range === "week") return { from: iso(y, m - 1, d - 6), to: today };
  if (range === "previous")
    return { from: iso(y, m - 2, 1), to: iso(y, m - 1, 0) };
  return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
}
export function duplicateReceipt(
  row: DocumentRecord,
  now = new Date(),
): DocumentDraft {
  return {
    ...structuredClone(row.draft),
    business_at: vietnamToday(now) + "T00:00",
    invoice_number: "",
    invoice_date: "",
    lines: row.draft.lines.map((l) => ({
      ...structuredClone(l),
      id: crypto.randomUUID(),
      serial: "",
      serials: [],
      source_line_id: "",
      usage_id: "",
      returned_serial: "",
    })),
  };
}

/** Fetch every filtered page; reject changed totals/duplicate rows rather than downloading a partial file. */
export async function collectReceiptList(
  client: import("./documentClient").DocumentClient,
  filters: import("./documentClient").ListDocuments,
): Promise<import("../../shared/documents").DocumentSummary[]> {
  const rows: import("../../shared/documents").DocumentSummary[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let page = 1; ; page++) {
    filters.signal?.throwIfAborted();
    const result = await client.list({
      ...filters,
      page,
      includeTotals: false,
    });
    if (total !== undefined && total !== result.pagination.total)
      throw new Error("Danh sách vừa thay đổi. Vui lòng xuất Excel lại.");
    total = result.pagination.total;
    if (
      result.pagination.page !== page ||
      result.pagination.page_size < 1 ||
      (!result.data.length && rows.length < total)
    )
      throw new Error("Không tải đủ danh sách. Vui lòng xuất Excel lại.");
    for (const row of result.data) {
      if (seen.has(row.id))
        throw new Error("Danh sách vừa thay đổi. Vui lòng xuất Excel lại.");
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length === total) return rows;
    if (rows.length > total)
      throw new Error("Danh sách vừa thay đổi. Vui lòng xuất Excel lại.");
  }
}
