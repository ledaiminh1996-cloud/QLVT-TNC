import {RecoveryListHeader,RecoveryTable,type RecoveryFilters} from "./RecoveryListView";
import {OpeningUsageTable} from "./OpeningUsageTable";
import { IssueTable } from "./IssueTable";
import type { ReceiptSort, SortDirection } from "../../shared/receiptSort";
import { ReceiptColumns } from "./ReceiptColumns";
import { ReceiptSummaryCards } from "./ReceiptSummaryCards";
import type { ReceiptTotals } from "../../shared/receiptTotals";
import type { ReceiptColumn } from "./ReceiptColumns";
import { ReceiptTable } from "./ReceiptTable";
import { collectReceiptList } from "./receiptListUtils";
import { ReceiptFilters } from "./ReceiptFilters";
import { receiptDateRange, duplicateReceipt } from "./receiptListUtils";
import { DocumentDateInput } from "./DocumentDateInput";
import { documentDate } from "./documentFormatting";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  History,
  Printer,
  Upload,
  Download,
  Filter,
  Eye,
} from "lucide-react";
import { documentKinds, editableDraft } from "../../shared/documents";
import type {
  DocumentKind,
  DocumentDraft,
  DocumentRecord,
  DocumentSummary,
} from "../../shared/documents";
import type { DocumentClient, DocumentPage } from "./documentClient";
import type { CatalogClient, Session } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import { docButton, docInput } from "./CatalogPicker";
import { DocumentEditor, money } from "./DocumentEditor";
import { DocumentHistory } from "./DocumentHistory";
import { DocumentWorkflows } from "./DocumentWorkflows";
import { DocumentBulkImport } from "./DocumentBulkImport";

import { StatusBadge } from "../components/StatusBadge";
import { MenuIcon } from "../components/MenuIcon";

function exportJSON(row: DocumentRecord) {
  const link = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
    );
  link.href = url;
  link.download = row.code.replaceAll("/", "-") + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DocumentList({
  kind,
  openingMode,
  api,
  documents,
  user,
  createToken,
}: {
  kind: DocumentKind;
  openingMode?:"stock"|"in_use";
  api: CatalogClient;
  documents: DocumentClient;
  user: NonNullable<Session["user"]>;
  createToken: number;
}) {
  const summaryCache = useRef<
    | {
        key: string;
        client: DocumentClient;
        value: ReceiptTotals;
      }
    | undefined
  >(undefined);
  const [summary, setSummary] = useState<{
    key: string;
    value: ReceiptTotals;
  }>();
  const recoveryList=kind==="recovery";
  const stockList = kind === "receipt" || kind === "issue" || recoveryList;
  const [recoveryFilters,setRecoveryFilters]=useState({part_id:"",classification:"",vehicle:"",recipient:""});
  const initialRange = useRef(receiptDateRange("month")).current;
  const [warehouse, setWarehouse] = useState(""),
    [supplier, setSupplier] = useState(""),
    [creator, setCreator] = useState(""),
    [dateValid, setDateValid] = useState(true);
  const[pendingOnly,setPendingOnly]=useState(false);
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(stockList ? initialRange.from : ""),
    [to, setTo] = useState(stockList ? initialRange.to : ""),
    [page, setPage] = useState(1),
    [sort, setSort] = useState<ReceiptSort>("business_at"),
    [direction, setDirection] = useState<SortDirection>("desc"),
    [pageSize, setPageSize] = useState(stockList ? 20 : 25),
    [selectedColumns, setSelectedColumns] = useState<ReceiptColumn[]>([]),
    [revision, setRevision] = useState(0),
    [result, setResult] = useState<DocumentPage<DocumentSummary>>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState<{
      record?: DocumentRecord;
      mode?: "view" | "edit";
      initialDraft?: DocumentDraft;
      labels?: Record<string, string>;
    }>(),
    [history, setHistory] = useState<DocumentRecord>(),
    [bulk, setBulk] = useState(false),
    [action, setAction] = useState<{ row: DocumentRecord; kind: string }>(),
    [reason, setReason] = useState("");
  const writable = ["admin", "accountant", "warehouse"].includes(user.role),
    admin = ["admin", "accountant"].includes(user.role),
    request = useRef<AbortController | undefined>(undefined),
    actionLock = useRef(false),
    exportRequest = useRef<AbortController | undefined>(undefined),
    exportLock = useRef(false);
  useEffect(() => {
    if (createToken > 0 && writable) setForm({});
  }, [createToken, writable]);
  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(
      () => {
        setSearch(query);
        setPage(1);
      },
      stockList ? 400 : 250,
    );
    return () => clearTimeout(timer);
  }, [query, kind, search]);
  const summaryKey = JSON.stringify([
    kind,
    openingMode,
    search,
    status,
    pendingOnly,
    from,
    to,
    warehouse,
    supplier,
    creator,
    revision,
    recoveryFilters,
    user.id,
    user.role,
  ]);
  const visibleTotals =
    summary?.key === summaryKey && summaryCache.current?.client === documents
      ? summary.value
      : undefined;
  useEffect(() => {
    const controller = new AbortController();
    if (stockList && (!dateValid || (from && to && from > to))) {
      setLoading(false);
      setError("");
      return () => controller.abort();
    }
    const cached =
      stockList &&
      summaryCache.current?.key === summaryKey &&
      summaryCache.current.client === documents
        ? summaryCache.current.value
        : undefined;
    setLoading(true);
    setResult(undefined);
    setError("");
    documents
      .list({
        kind,
        opening_mode:openingMode,
        page,
        pageSize,
        sort: stockList ? sort : undefined,
        direction: stockList ? direction : undefined,
        includeTotals: stockList ? !cached : undefined,
        q: search,
        valuation_pending:pendingOnly?"1":undefined,
        status,
        from,
        to,
        warehouse_id: warehouse,
        supplier_id: supplier,
        created_by: creator,
        ...(recoveryList?{part_id:recoveryFilters.part_id,recovery_classification:recoveryFilters.classification,recovery_vehicle:recoveryFilters.vehicle,recovery_recipient:recoveryFilters.recipient}:{}),
        signal: controller.signal,
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        setResult(value);
        if (stockList) {
          const totals = value.receipt_totals ?? cached;
          if (totals) {
            summaryCache.current = {
              key: summaryKey,
              client: documents,
              value: totals,
            };
            setSummary({ key: summaryKey, value: totals });
          }
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(accessMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    documents,
    kind,
    summaryKey,
    page,
    pageSize,
    sort,
    direction,
    search,
    status,
    from,
    to,
    warehouse,
    supplier,
    creator,
    dateValid,
    revision,
  ]);
  useEffect(
    () => () => {
      request.current?.abort();
      exportRequest.current?.abort();
    },
    [],
  );
  async function exportList() {
    if (exportLock.current) return;
    exportLock.current = true;
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(true);
    setError("");
    try {
      const rows = await collectReceiptList(documents, {
        kind,
        pageSize: 100,
        sort,
        direction,
        q: query,
        valuation_pending:pendingOnly?"1":undefined,
        status,
        from,
        to,
        warehouse_id: warehouse,
        supplier_id: supplier,
        created_by: creator,
        signal: controller.signal,
      });
      if (kind === "issue") {
        const { downloadIssueListExcel } = await import("./issueExcel");
        if (!controller.signal.aborted) downloadIssueListExcel(rows);
      } else {
        const { downloadReceiptListExcel } = await import("./receiptExcel");
        if (!controller.signal.aborted) downloadReceiptListExcel(rows);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(accessMessage(e));
    } finally {
      exportLock.current = false;
      if (!controller.signal.aborted) setExporting(false);
    }
  }
  async function open(
    row: DocumentSummary,
    mode:
      | "edit"
      | "view"
      | "duplicate"
      | "cancel"
      | "excel"
      | "history"
      | "print"
      | "export"
      | "actions",
  ) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const detail = await documents.get(row.id, controller.signal);
      if (controller.signal.aborted) return;
      if (mode === "view") setForm({ record: detail, mode: "view" });
      else if (mode === "duplicate")
        setForm({
          initialDraft: duplicateReceipt(detail),
          labels: detail.labels,
          mode: "edit",
        });
      else if (mode === "excel") {
        if (kind === "issue") {
          const { downloadIssueExcel } = await import("./issueExcel");
          if (!controller.signal.aborted) downloadIssueExcel(detail);
        } else {
          const { downloadReceiptExcel } = await import("./receiptExcel");
          if (!controller.signal.aborted) downloadReceiptExcel(detail);
        }
      } else if (mode === "cancel") {
        if (detail.status === "posted" && !detail.can_modify)
          throw new Error("Phiếu đã có phát sinh; không được hủy.");
        setReason("");
        setAction({
          row: detail,
          kind: detail.status === "posted" ? "delete" : "cancel",
        });
      } else if (mode === "history") setHistory(detail);
      else if (mode === "print") {
        const { printDraft } = await import("./DocumentPrint");
        if (!controller.signal.aborted) printDraft(detail);
      } else if (mode === "export") exportJSON(detail);
      else if (mode === "actions") {
        setReason("");
        setAction({ row: detail, kind: "" });
      } else setForm({ record: detail });
    } catch (e) {
      if (!controller.signal.aborted) setError(accessMessage(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const statuses = {
    posted: recoveryList?"Đã thu hồi":kind === "receipt" ? "Đã nhập kho" : kind==="opening"&&openingMode==="in_use"?"Đã ghi nhận":"Đã ghi sổ",
    draft: "Nháp",
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    returned: "Trả về",
    rejected: "Từ chối",
    cancelled: "Đã hủy",
  };
  const pendingFilterAction=["issue","recovery"].includes(kind)?<button type="button" className={docButton+" !h-8 !min-h-8 !px-2 text-slate-500 "+(pendingOnly?"!border-amber-500 !bg-amber-50 !text-amber-800":"")} title="Chỉ hiện phiếu có dòng chưa xác định giá trị để rà soát, bổ sung giá. Bấm lại để xem tất cả." aria-pressed={pendingOnly} onClick={()=>{setPendingOnly(v=>!v);setPage(1);}}><Filter size={12}/>Phiếu cần bổ sung giá</button>:undefined;
  const listActions=<>          {stockList && !recoveryList && (
            <ReceiptColumns
              allowed={kind === "issue" ? ["serial", "editor"] : undefined}
              selected={selectedColumns}
              onChange={setSelectedColumns}
            />
          )}
          {writable && kind === "issue" && (
            <button className={docButton} onClick={() => setBulk(true)}>
              <Upload size={14} />
              Nhập nhiều phiếu PX
            </button>
          )}
          {stockList && !recoveryList && (
            <button
              className={docButton}
              title="Xuất Excel toàn bộ danh sách đang lọc"
              disabled={
                exporting ||
                loading ||
                !dateValid ||
                !!(from && to && from > to)
              }
              onClick={() => void exportList()}
            >
              <Download size={14} />
              {exporting ? "Đang xuất…" : "Xuất Excel"}
            </button>
          )}
          <button
            className={docButton}
            aria-label="Tải lại chứng từ"
            title="Tải lại chứng từ"
            disabled={loading || busy}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={14} />
          </button>
          {writable && (
            <button
              className={docButton + " !bg-blue-600 !text-white"}
              onClick={() => setForm({})}
            >
              <Plus size={14} />
              Lập phiếu
            </button>
          )}
</>;
  const changeRecovery=(v:RecoveryFilters)=>{setQuery(v.query);const changed=v.from!==from||v.to!==to||v.warehouse_id!==warehouse||v.status!==status||v.part_id!==recoveryFilters.part_id||v.classification!==recoveryFilters.classification||v.vehicle!==recoveryFilters.vehicle||v.recipient!==recoveryFilters.recipient;setFrom(v.from);setTo(v.to);setWarehouse(v.warehouse_id);setStatus(v.status);setRecoveryFilters({part_id:v.part_id,classification:v.classification,vehicle:v.vehicle,recipient:v.recipient});if(changed){setSearch(v.query);setPage(1)}};
  return (
    <section
      className={
        "catalog-page " +
        (stockList ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-4")+(recoveryList?" stock-ledger recovery-list":"")
      }
    >
      {recoveryList?<RecoveryListHeader api={api} totals={visibleTotals} pending={loading&&!visibleTotals} value={{query,from,to,warehouse_id:warehouse,status,...recoveryFilters}} onChange={changeRecovery} actions={listActions} pendingAction={pendingFilterAction}/>:<>      <div
        className={
          stockList
            ? "!p-0 flex shrink-0 flex-wrap items-center justify-between gap-3 lg:flex-nowrap"
            : "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4"
        }
      >
        <h2
          className={
            stockList ? "sr-only" : "flex items-center gap-2 font-bold"
          }
        >
          <MenuIcon
            menuId={documentKinds[kind].menu}
            className="text-blue-600"
          />
          {kind==="opening"&&openingMode==="in_use"?"Vật tư đang sử dụng đầu kỳ":documentKinds[kind].label}
        </h2>
        {stockList && (
          <ReceiptSummaryCards
            kind={kind as "receipt" | "issue"}
            totals={visibleTotals}
            status={status}
            pending={loading && !visibleTotals}
            onStatusChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        )}
        <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2">{listActions}</div>
      </div>

      {stockList ? (
        <ReceiptFilters
          trailingAction={pendingFilterAction}
          kind={kind as "receipt" | "issue"}
          api={api}
          documents={documents}
          value={{
            query,
            status,
            from,
            to,
            warehouse_id: warehouse,
            supplier_id: supplier,
            created_by: creator,
          }}
          onValidChange={setDateValid}
          onChange={(v) => {
            const changed =
              v.status !== status ||
              v.from !== from ||
              v.to !== to ||
              v.warehouse_id !== warehouse ||
              v.supplier_id !== supplier ||
              v.created_by !== creator;
            setQuery(v.query);
            setStatus(v.status);
            setFrom(v.from);
            setTo(v.to);
            setWarehouse(v.warehouse_id);
            setSupplier(v.supplier_id);
            setCreator(v.created_by ?? "");
            if (changed) {
              setSearch(v.query);
              setPage(1);
            }
          }}
        />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_180px_160px_160px]">
            <input
              aria-label="Tìm chứng từ"
              placeholder={kind==="opening"&&openingMode==="in_use"?"Tìm số phiếu, vật tư, tài xế, biển số…":"Tìm số phiếu, vật tư, đối tác…"}
              className={docInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Trạng thái chứng từ"
              className={docInput}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statuses)
                .filter(
                  ([key]) =>
                    kind === "proposal" ||
                    ["draft", "posted", "cancelled"].includes(key),
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
            <DocumentDateInput
              label="Từ ngày"
              value={from}
              onChange={(value) => {
                setFrom(value);
                setPage(1);
              }}
            />
            <DocumentDateInput
              label="Đến ngày"
              value={to}
              onChange={(value) => {
                setTo(value);
                setPage(1);
              }}
            />
          </div>
          {pendingFilterAction&&<div className="flex justify-end">{pendingFilterAction}</div>}
        </>
      )}</>}

      {notice && (
        <p role="status" className="text-xs text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          {error}{" "}
          <button
            className={docButton}
            onClick={() => setRevision((n) => n + 1)}
          >
            Thử lại
          </button>
        </p>
      )}
      {loading ? (
        <p role="status" className="p-5 text-sm">
          Đang tải chứng từ…
        </p>
      ) : (
        result && (
          <>
            {recoveryList?<RecoveryTable rows={result.data} user={user} busy={busy} onOpen={(row,mode)=>void open(row,mode)}/>:kind === "receipt" ? (
              <ReceiptTable
                rows={result.data}
                selectedColumns={selectedColumns}
                sort={sort}
                direction={direction}
                onSort={(key) => {
                  setDirection(
                    key === sort
                      ? direction === "asc"
                        ? "desc"
                        : "asc"
                      : "asc",
                  );
                  setSort(key);
                  setPage(1);
                }}
                busy={busy}
                user={user}
                onOpen={(row, mode) => void open(row, mode)}
              />
            ) : kind === "issue" ? (
              <IssueTable
                selectedColumns={selectedColumns}
                rows={result.data}
                user={user}
                busy={busy}
                sort={sort}
                direction={direction}
                onSort={(key) => {
                  setDirection(
                    key === sort
                      ? direction === "asc"
                        ? "desc"
                        : "asc"
                      : "asc",
                  );
                  setSort(key);
                  setPage(1);
                }}
                onOpen={(row, mode) => void open(row, mode)}
              />
            ) : kind==="opening"&&openingMode==="in_use" ? <OpeningUsageTable rows={result.data} user={user} busy={busy} sort={sort} direction={direction} onSort={key=>{setDirection(key===sort?(direction==="asc"?"desc":"asc"):"asc");setSort(key);setPage(1)}} onOpen={(row,mode)=>void open(row,mode)}/> : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="catalog-table w-full table-fixed text-left min-w-[1126px]">
                    <colgroup>
                      {[164, 140, 170, 170, 64, 124, 110, 184].map((w, i) => (
                        <col key={i} style={{ width: w }} />
                      ))}
                    </colgroup>
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th>Số phiếu</th>
                        <th>Ngày giờ</th>
                        {!(kind==="opening"&&openingMode==="in_use")&&<th>Kho</th>}
                        <th>Đối tác / người nhận</th>
                        <th className="text-right">Dòng</th>
                        <th className="text-right">{kind==="opening"?(openingMode==="in_use"?"Giá trị còn lại (đ)":"Thành tiền (đ)"):"Sau VAT (đ)"}</th>
                        <th className="text-center">Trạng thái</th>
                        <th className="text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="font-mono font-bold text-amber-700">
                            {row.code}
                          </td>
                          <td className="tabular-nums">
                            {documentDate(row.business_at)}
                          </td>
                          {!(kind==="opening"&&openingMode==="in_use")&&<td title={row.warehouse_label}>{row.warehouse_label||"—"}</td>}
                          <td title={row.partner_label}>
                            {row.partner_label || "—"}
                          </td>
                          <td className="text-right tabular-nums">
                            {row.line_count}
                          </td>
                          <td
                            title={
                              row.totals.gross === null && !(kind==="opening"&&openingMode==="in_use")
                                ? row.status==="posted"?"Chưa xác định giá trị, cần rà soát bổ sung":"Giá vốn chưa xác định khi chưa ghi sổ"
                                : undefined
                            }
                            className="text-right font-sans tabular-nums"
                          >
                            {row.totals.gross === null
                              ? "—"
                              : new Intl.NumberFormat("vi-VN").format(
                                  row.totals.gross,
                                )}{!(kind==="opening"&&openingMode==="in_use")&&row.status==="posted"&&row.totals.net===null&&<span className="block text-xs text-amber-700">⚠ Chưa xác định giá trị</span>}
                          </td>
                          <td className="catalog-cell-center">
                            <StatusBadge
                              value={row.status}
                              label={
                                row.kind === "retread" &&
                                row.status === "posted"
                                  ? row.operation_state === "received"
                                    ? "Đã nhận đắp"
                                    : "Đang đắp"
                                  : statuses[row.status]
                              }
                            />
                          </td>
                          <td className="catalog-actions-cell">
                            <div className="catalog-actions">
                              <>
                                <button
                                  className={docButton + " !px-1.5"}
                                  disabled={busy}
                                  aria-label={"Mở " + row.code}
                                  onClick={() => {
                                    void open(row, "edit");
                                  }}
                                >
                                  {writable &&
                                  (editableDraft(row.status) ||
                                    row.can_modify ||
                                    (row.kind === "retread" &&
                                      row.operation_state === "sent")) ? (
                                    <Pencil size={13} />
                                  ) : (
                                    <Eye size={13} />
                                  )}
                                </button>
                                <button
                                  className={docButton + " !px-1.5"}
                                  disabled={busy}
                                  aria-label={"Lịch sử " + row.code}
                                  onClick={() => {
                                    void open(row, "history");
                                  }}
                                >
                                  <History size={13} />
                                </button>
                                <button
                                  className={docButton + " !px-1.5"}
                                  disabled={busy}
                                  aria-label={
                                    (row.status === "posted"
                                      ? "In phiếu "
                                      : "In nháp ") + row.code
                                  }
                                  onClick={() => {
                                    void open(row, "print");
                                  }}
                                >
                                  <Printer size={13} />
                                </button>
                                <button
                                  className={docButton + " !px-1.5"}
                                  disabled={busy}
                                  aria-label={"Xuất JSON " + row.code}
                                  onClick={() => {
                                    void open(row, "export");
                                  }}
                                >
                                  <Download size={13} />
                                </button>
                                {writable &&
                                  (!["cancelled", "posted"].includes(
                                    row.status,
                                  ) ||
                                    row.can_modify) && (
                                    <button
                                      className={docButton + " !px-2"}
                                      disabled={busy}
                                      aria-label={"Xử lý " + row.code}
                                      onClick={() => {
                                        void open(row, "actions");
                                      }}
                                    >
                                      ⋯
                                    </button>
                                  )}{" "}
                              </>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!result.data.length && (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center text-slate-500"
                          >
                            Chưa có chứng từ phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div
              className={
                "flex shrink-0 flex-wrap items-center justify-between gap-3 text-xs text-slate-600 " +
                (stockList
                  ? "mt-auto border-t border-slate-200 bg-white py-2"
                  : "")
              }
            >
              <span className="tabular-nums">
                {!stockList ? `Tổng ${result.pagination.total} phiếu · ` : ""}
                Trang {page}/
                {Math.max(
                  1,
                  Math.ceil(
                    result.pagination.total / result.pagination.page_size,
                  ),
                )}
              </span>
              <div className="flex items-center gap-2">
                {stockList && (
                  <label className="flex items-center gap-2">
                    Số dòng/trang
                    <select
                      aria-label="Số dòng mỗi trang"
                      className={docInput + " !w-20"}
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                    >
                      {[20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className={docButton}
                  disabled={page === 1}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Trang trước
                </button>
                <button
                  className={docButton}
                  disabled={
                    page * result.pagination.page_size >=
                    result.pagination.total
                  }
                  onClick={() => setPage((n) => n + 1)}
                >
                  Trang sau
                </button>
              </div>
            </div>
          </>
        )
      )}
      {form && (
        <DocumentEditor
          key={form.record?.id ?? "new"}
          kind={kind}
          openingMode={openingMode}
          record={form.record}
          initialDraft={form.initialDraft}
          initialLabels={form.labels}
          api={api}
          documents={documents}
          canEdit={
            form.mode !== "view" &&
            writable &&
            (!form.record ||
              user.role !== "warehouse" ||
              form.record.created_by === user.id)
          }
          onClose={() => setForm(undefined)}
          onSaved={(row) => {
            setForm(undefined);
            setNotice(
              row.status === "posted"
                ? "Đã lưu " +
                    row.code +
                    (kind==="opening"&&row.draft.opening_mode==="in_use"?" và ghi nhận vật tư đang sử dụng.":["equipment_transfer", "rotation"].includes(kind)
                      ? " và cập nhật sử dụng thiết bị."
                      : " và cập nhật tồn kho.")
                : "Đã lưu " + row.code + ".",
            );
            setRevision((n) => n + 1);
          }}
        />
      )}
      {history && (
        <DocumentHistory
          documents={documents}
          row={history}
          onClose={() => setHistory(undefined)}
        />
      )}
      {bulk && (
        <DocumentBulkImport
          documents={documents}
          onClose={() => setBulk(false)}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Xử lý chứng từ"
            className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 text-slate-900"
          >
            <h3 className="font-bold">
              Xử lý <span className="font-mono">{action.row.code}</span>
            </h3>
            <p className="text-xs text-slate-600">
              {action.row.workflow_snapshot
                ? `Quy trình: ${action.row.workflow_snapshot.name} · bước ${Math.min(action.row.approval_step + 1, action.row.workflow_snapshot.steps.length)}/${action.row.workflow_snapshot.steps.length}`
                : action.row.can_modify
                  ? "Hủy phiếu sẽ hoàn lại tồn kho; số phiếu và lịch sử vẫn được giữ."
                  : "Phiếu chưa gửi duyệt."}
            </p>
            <label className="block text-xs font-semibold">
              Thao tác
              <select
                aria-label="Thao tác chứng từ"
                className={docInput + " mt-1"}
                value={action.kind}
                disabled={busy}
                onChange={(e) => setAction({ ...action, kind: e.target.value })}
              >
                <option value="">Chọn thao tác</option>
                {kind === "proposal" && editableDraft(action.row.status) && (
                  <option value="submit">Gửi duyệt đề xuất</option>
                )}
                {kind === "proposal" &&
                  action.row.status === "pending" &&
                  action.row.workflow_snapshot?.steps[
                    action.row.approval_step
                  ]?.approver_ids.includes(user.id) && (
                    <>
                      <option value="approve">Duyệt bước hiện tại</option>
                      <option value="return">Trả về để bổ sung</option>
                      <option value="reject">Từ chối</option>
                    </>
                  )}
                {admin &&
                  action.row.status === "approved" &&
                  kind === "proposal" && (
                    <option value="revoke">Bỏ duyệt</option>
                  )}
                {action.row.can_modify ? (
                  <option value="delete">Hủy phiếu nhập chưa sử dụng</option>
                ) : (
                  admin &&
                  action.row.status !== "posted" && (
                    <option value="cancel">Hủy phiếu</option>
                  )
                )}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Lý do *
              <textarea
                className={docInput + " mt-1"}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div>
              {error && (
                <p role="alert" className="text-xs text-red-700">
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className={docButton}
                disabled={busy}
                onClick={() => setAction(undefined)}
              >
                Đóng
              </button>
              <button
                className={docButton + " !bg-blue-600 !text-white"}
                disabled={busy || !reason.trim() || !action.kind}
                onClick={async () => {
                  if (actionLock.current) return;
                  actionLock.current = true;
                  setBusy(true);
                  setError("");
                  try {
                    await documents.action(action.row, action.kind, reason);
                    setAction(undefined);
                    setNotice("Đã lưu thao tác và lịch sử.");
                    setRevision((n) => n + 1);
                  } catch (e) {
                    setError(accessMessage(e));
                  } finally {
                    setBusy(false);
                    actionLock.current = false;
                  }
                }}
              >
                {busy ? "Đang lưu…" : "Xác nhận"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

