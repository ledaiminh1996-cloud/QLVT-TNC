import {recoveryLineCounts,parseRecoveryClassFilter} from "../../shared/recoveryDetails";
import {documentSymbol} from "../../shared/documents";
import {openingUsageTotals} from "../../shared/openingUsageAssessment";
import {
  emptyIssueDetails,
  issueVehicleGroup,
} from "../../shared/issueDetails";
import { receiptLandedCosts } from "../../shared/receiptCosts";
import {
  receiptTotals,
  normalizeReceiptUnits,
} from "../../shared/receiptTotals";
import { receiptPriceSummary } from "../../shared/receiptSummary";
import { lineSerials } from "../../shared/documentSerials";
import { foldDocumentSearch } from "../../shared/documentSearch";
/** Development-only, explicit in-memory preview. Never used as a fallback for an API failure. */
import { createCatalogClient, CatalogApiError } from "../api/catalogClient";
import type { CatalogRow, Resource, Session } from "../api/catalogClient";
import {
  documentKinds,
  emptyDraft,
  parseDraft,
  draftTotals,
  lineTotals,
  editableDraft,
} from "../../shared/documents";
import type {
  DocumentRecord,
  DocumentDraft,
  DocumentWorkflow,
  DocumentSummary,
} from "../../shared/documents";
import type { DocumentClient, DocumentEvent } from "./documentClient";
import { searchIncludes } from "../../shared/searchText";
const clone = <T>(value: T): T => structuredClone(value);
export function createDocumentPreview(
  user: () => NonNullable<Session["user"]>,
) {
  const fixtures: Partial<Record<Resource, CatalogRow[]>> = {
    "mount-positions": [
      {id:"mount-gtt",version:1,code:"GTT",name:"Giữa Trái Trong",notes:"Đầu kéo",is_active:1},
      {id:"mount-t1tt",version:1,code:"T1TT",name:"Trục 1 Trái Trong",notes:"Rơ moóc",is_active:1},
    ],
    "vat-rates": [0, 5, 8, 10].map((n) => ({
      id: "vat-" + n,
      version: 1,
      code: "VAT" + String(n).padStart(2, "0"),
      name: "VAT " + n + "%",
      rate_pct: n,
      is_active: 1,
    })),
    parts: [
      {
        id: "part-filter",
        version: 1,
        sku: "M-IN-TDONG-0001",
        name: "Lọc dầu động cơ",
        unit: "Cái",
        unit_price_vnd: 150000,
        is_serialized: 0,
        is_active: 1,
      },
      {
        id: "part-tire",
        version: 1,
        sku: "M-RM-LOP-0001",
        name: "Lốp xe 12R22.5",
        unit: "Quả",
        unit_price_vnd: 8500000,
        is_serialized: 1,
        is_active: 1,
      },
      {
        id: "part-oil",
        version: 1,
        sku: "M-DC-TIEU-0020",
        name: "Dầu DO",
        is_fuel: 1,
        unit: "Lít",
        unit_price_vnd: 21500,
        is_serialized: 0,
        is_active: 1,
      },
      {
        id: "part-sim",
        version: 1,
        sku: "M-DC-SIM-0001",
        name: "SIM 4G định vị",
        needs_data_package: 1,
        unit: "Cái",
        unit_price_vnd: 50000,
        is_serialized: 1,
        is_active: 1,
      },
    ],
    warehouses: [
      {
        id: "wh-1",
        version: 1,
        code: "KHO01",
        name: "Kho trung tâm",
        kind: "parts",
        is_active: 1,
      },
      {
        id: "wh-2",
        version: 1,
        code: "KHO02",
        name: "Kho chi nhánh",
        kind: "parts",
        is_active: 1,
      },
    ],
    "fuel-tanks": [
      {
        id: "tank-1",
        version: 1,
        code: "BON01",
        name: "Bồn dầu số 1",
        warehouse_id: "wh-1",
        capacity_milli: 25000000,
        is_active: 1,
      },
    ],
    suppliers: [
      {
        id: "supplier-1",
        version: 1,
        code: "NCC00001",
        name: "Nhà cung cấp mẫu",
        is_active: 1,
      },
    ],
    departments: [
      {
        id: "dept-1",
        version: 1,
        code: "KHO",
        name: "Bộ phận kho",
        kind: "employee",
        is_active: 1,
      },
    ],
    staff: [
      {
        id: "staff-receiver",
        version: 1,
        code: "NV001",
        name: "Người nhận mẫu",
        staff_type: "employee",
        department_id: "dept-1",
        is_active: 1,
      },
      {
        id: "staff-driver",
        version: 1,
        code: "TX001",
        name: "Tài xế mẫu",
        staff_type: "driver",
        is_active: 1,
      },
    ],
    vehicles: [
      {
        id: "vehicle-1",
        version: 1,
        plate_number: "50H-123.45",
        type: "tractor",
        brand_model: "Đầu kéo mẫu",
        route_group: "BNAM",
        assigned_driver_id: "staff-driver",
        current_odo_km: 123456,
        status: "active",
      },
      {
        id: "trailer-1",
        version: 1,
        plate_number: "51R-456.78",
        current_odo_km:654321,
        type: "trailer",
        brand_model: "Rơ moóc mẫu",
        status: "active",
      },
    ],
    equipment: [
      {
        id: "generator-1",
        version: 1,
        code: "MP001",
        name: "Máy phát mẫu",
        type: "generator",
        status: "active",
      },
    ],
  };
  const catalog = createCatalogClient(async (input) => {
    const url = new URL(String(input), "http://preview.invalid"),
      resource = url.pathname.split("/").pop() as Resource,
      q = url.searchParams.get("q") ?? "",
      current = Number(url.searchParams.get("page") ?? 1),
      size = Number(url.searchParams.get("page_size") ?? 25);
    const all = (fixtures[resource] ?? []).filter(
      (row) =>
        searchIncludes(Object.values(row).join(" "), q) &&
        (!url.searchParams.get("warehouse_id") ||
          (resource === "parts" && url.searchParams.has("stock_state")) ||
          row.warehouse_id === url.searchParams.get("warehouse_id")) &&
        (!(resource === "parts" && url.searchParams.has("stock_state")) ||
          (url.searchParams.get("stock_state") === "new" && (stock.get(String(row.id) + ":" + url.searchParams.get("warehouse_id"))?.quantity_milli ?? 0) > 0)),
    );
    return Response.json({
      data: clone(all.slice((current - 1) * size, current * size).map(row =>
        resource === "parts" && url.searchParams.has("stock_state")
          ? {...row, current_stock_milli: stock.get(String(row.id) + ":" + url.searchParams.get("warehouse_id"))?.quantity_milli ?? 0}
          : row)),
      pagination: { page: current, page_size: size, total: all.length },
    });
  });
  const records = new Map<string, DocumentRecord>(),
    events = new Map<string, DocumentEvent[]>(),
    keys = new Map<string, { hash: string; id: string }>(),
    counters = new Map<string, number>();
  let workflows: DocumentWorkflow[] = [
    {
      id: "flow-1",
      version: 1,
      name: "Duyệt mẫu bộ phận kho",
      department_id: "dept-1",
      proposal_type: "purchase",
      is_active: 1,
      steps: [
        {
          label: "Quản trị duyệt",
          mode: "any",
          approver_ids: ["preview-admin"],
        },
      ],
    },
  ];
  function changed(): never {
    throw new CatalogApiError(
      409,
      "VERSION_CONFLICT",
      "Phiếu đã thay đổi. Tải lại để đối chiếu.",
    );
  }
  function labels(draft: DocumentDraft) {
    const result: Record<string, string> = {};
    for (const [resource, rows] of Object.entries(fixtures))
      for (const row of rows) {
        result[resource + ":" + row.id] =
          String(row.sku ?? row.plate_number ?? row.code) +
          " — " +
          String(row.name ?? row.brand_model ?? "");
        if (resource === "parts") {
          result["unit:" + row.id] = String(row.unit);
          result["sku:" + row.id] = String(row.sku);
          result["serialized:" + row.id] = String(row.is_serialized);
          result["fuel:" + row.id] = String(row.is_fuel ?? 0);
          result["data:" + row.id] = String(row.needs_data_package ?? 0);
        }
      }
    const wanted = new Set([
      "warehouses:" + draft.warehouse_id,
      "warehouses:" + draft.to_warehouse_id,
      "suppliers:" + draft.supplier_id,
      "departments:" + draft.department_id,
    ]);
    for (const line of draft.lines) {
      for (const prefix of [
        "parts:",
        "unit:",
        "sku:",
        "serialized:",
        "fuel:",
        "data:",
      ])
        wanted.add(prefix + line.part_id);
      wanted.add("fuel-tanks:" + line.tank_id);
      wanted.add(
        (line.target_type === "vehicle" ? "vehicles:" : "equipment:") +
          line.target_id,
      );
    }
    return Object.fromEntries(
      Object.entries(result).filter(([key]) => wanted.has(key)),
    );
  }
  function event(
    row: DocumentRecord,
    action: string,
    reason: string,
    before: DocumentRecord | null,
  ) {
    const previous = events.get(row.id) ?? [];
    events.set(row.id, [
      {
        id: crypto.randomUUID(),
        actor_name: user().display_name,
        action,
        reason,
        created_at: new Date().toISOString(),
        before_json: before ? JSON.stringify(before) : null,
        after_json: JSON.stringify(row),
      },
      ...previous,
    ]);
  }
  const stock = new Map<
      string,
      { quantity_milli: number; value_vnd: number }
    >(),
    stockSerials = new Map<string, string>(),
    beforeStocks = new Map<
      string,
      { quantity_milli: number; value_vnd: number }
    >();
  let seeding = true;
  const client: DocumentClient = {
    async sources() {
      return { data: [], pagination: { page: 1, page_size: 25, total: 0 } };
    },
    async issuePrice(input,signal) {
      signal?.throwIfAborted();
      const balance=stock.get(input.part_id+":"+input.warehouse_id);
      const q=Number(input.quantity),available=(balance?.quantity_milli??0)/1000;
      if(input.stock_state!=="new" || !balance || available<q || q<=0)throw new Error("Không đủ tồn kho để tính giá xuất.");
      const amount=Math.round(balance.value_vnd*q/available);
      return {amount_vnd:amount,unit_price_vnd_milli:Math.round(amount*1000/q)};
    },
    async issueContext(staffId, vehicleId, driverId, signal) {
      signal?.throwIfAborted();
      if (driverId && !vehicleId) {
        const matches = fixtures.vehicles?.filter((v) => v.assigned_driver_id === driverId && v.status === "active" && v.type !== "trailer") ?? [];
        if (matches.length === 1) vehicleId = String(matches[0].id);
      }
      const info = emptyIssueDetails(),
        staff = fixtures.staff?.find((s) => s.id === staffId),
        vehicle = fixtures.vehicles?.find((v) => v.id === vehicleId);
      if (staff) {
        info.recipient_staff_id = staffId;
        info.department_id = String(staff.department_id ?? "");
        info.department_name = String(
          fixtures.departments?.find((d) => d.id === info.department_id)
            ?.name ??
            staff.department ??
            "",
        );
      }
      if (vehicle) {
        info.vehicle_id = vehicleId;
        info.vehicle_plate = String(vehicle.plate_number);
        info.vehicle_group = issueVehicleGroup({
          route_group: vehicle.route_group,
          source_group: vehicle.source_group,
          type: vehicle.type,
        });
        info.odo = String(vehicle.current_odo_km ?? 0);
        if(vehicle.id==="vehicle-1"){info.trailer_number=String(fixtures.vehicles?.find(v=>v.id==="trailer-1")?.plate_number??"");info.other=String(fixtures.equipment?.find(e=>e.id==="generator-1")?.code??"");}
        if (!driverId) driverId = String(vehicle.assigned_driver_id ?? "");
      }
      const driver = fixtures.staff?.find((s) => s.id === driverId);
      if (driver) {
        info.driver_id = driverId;
        info.driver_name = String(driver.name);
      }
      return { ...info, recipient: String(staff?.name ?? "") };
    },
    async availableSerials(part, warehouse, state, q, page, signal) {
      signal?.throwIfAborted();
      const data =
        state === "new"
          ? [...stockSerials.keys()]
              .filter(
                (key) =>
                  stockSerials.get(key) === warehouse &&
                  key.startsWith(part + ":") &&
                  key.toUpperCase().includes(q.toUpperCase()),
              )
              .map((key) => ({ serial_number: key.slice(part.length + 1) }))
          : [];
      return {
        data: data.slice((page - 1) * 25, page * 25),
        pagination: { page, page_size: 25, total: data.length },
      };
    },
    async stock(part, warehouse, signal, excludeDocument, stockState) {
      signal?.throwIfAborted();
      if (stockState && stockState !== "new")
        return { quantity_milli: 0, value_vnd: 0 };
      return clone(
        (excludeDocument
          ? beforeStocks.get(excludeDocument + ":" + part + ":" + warehouse)
          : undefined) ??
          stock.get(part + ":" + warehouse) ?? {
            quantity_milli: 0,
            value_vnd: 0,
          },
      );
    },
    async checkSerials(_part, _values, signal) {
      signal?.throwIfAborted();
      return _values.filter((value) =>
        stockSerials.has(_part + ":" + value.toUpperCase()),
      );
    },
    async nextNumber(kind, date, departmentId = "", signal, openingMode) {
      signal?.throwIfAborted();
      const symbol = documentSymbol(kind as keyof typeof documentKinds,openingMode);
      const period = date.slice(0, 7);
      const next = (counters.get(period + symbol) ?? 0) + 1;
      const dept = fixtures.departments?.find((d) => d.id === departmentId);
      return (
        date.slice(5, 7) +
        "." +
        date.slice(2, 4) +
        "." +
        String(next).padStart(5, "0") +
        "/" +
        symbol +
        (kind === "proposal" && dept ? "/" + dept.code : "")
      );
    },
    async creators() {
      return [
        ...new Map(
          [...records.values()].map((r) => [
            r.created_by,
            { id: r.created_by, display_name: r.created_by_name },
          ]),
        ).values(),
      ];
    },
    async list(options) {
      options.signal?.throwIfAborted();
      const filtered = [...records.values()]
        .filter(
          (r) =>
            r.draft.kind === options.kind &&
            (!options.opening_mode||(r.draft.opening_mode??"stock")===options.opening_mode) &&
            (!options.status || r.status === options.status) &&
            r.draft.lines.some(l=>(!options.part_id||l.part_id===options.part_id)&&(!options.recovery_classification||parseRecoveryClassFilter(options.recovery_classification).includes(l.recovery_classification??(l.stock_state==='pending_scrap'?'CTL':'CSD')))) &&
            (!options.recovery_vehicle||foldDocumentSearch(Object.values(r.draft.recovery_details??{}).join(" ")).includes(foldDocumentSearch(options.recovery_vehicle))) &&
            (!options.recovery_recipient||foldDocumentSearch(r.draft.recipient).includes(foldDocumentSearch(options.recovery_recipient))) &&
            (!options.created_by || r.created_by === options.created_by) &&
            (!options.warehouse_id ||
              r.draft.warehouse_id === options.warehouse_id) &&
            (!options.supplier_id ||
              r.draft.supplier_id === options.supplier_id) &&
            (!options.from || r.draft.business_at >= options.from) &&
            (!options.to || r.draft.business_at.slice(0, 10) <= options.to) &&
            foldDocumentSearch(
              r.code +
                " " +
                Object.values(r.labels).join(" ") +
                " " +
                Object.values(r.draft.opening_details??{}).join(" ")+" "+Object.values(r.draft.recovery_details??{}).join(" ")+" "+r.draft.purpose+" "+r.draft.recipient +
                " " +
                r.draft.lines
                  .flatMap((l) => [
                    ...lineSerials(l),
                    l.data_package,
                    l.tank_id,
                    l.notes,
                  ])
                  .join(" "),
            ).includes(foldDocumentSearch(options.q ?? "")),
        )
        .sort((a, b) => {
          const direction = options.direction === "asc" ? 1 : -1;
          const key = options.sort ?? "business_at";
          if (
            key === "gross" &&
            (a.totals.gross === null || b.totals.gross === null)
          )
            return a.totals.gross === b.totals.gross
              ? direction * a.id.localeCompare(b.id)
              : a.totals.gross === null
                ? 1
                : -1;
          const value =
            key === "gross"
              ? a.totals.gross! - b.totals.gross!
              : key === "code"
                ? a.code.localeCompare(b.code)
                : a.draft.business_at.localeCompare(b.draft.business_at);
          return direction * (value || a.id.localeCompare(b.id));
        });
      const current = options.page ?? 1;
      const pageSize = options.pageSize ?? 25;
      return {
        data: filtered.slice((current - 1) * pageSize, current * pageSize).map(
          (r) =>
            ({
              id: r.id,
              version: r.version,
              code: r.code,
              status: r.status,
              kind: r.draft.kind,
              business_at: r.draft.business_at,
              totals: clone(r.totals),
              created_by: r.created_by,
              created_by_name: r.created_by_name,
              created_at: r.created_at,
              updated_at: r.updated_at,
              line_count: r.draft.lines.length,
              ...(r.draft.kind==="opening"&&r.draft.opening_mode==="in_use"?{opening_details:r.draft.opening_details,opening_original_value_vnd:openingUsageTotals(r.draft.lines).base_vnd,opening_target_labels:[...new Set(r.draft.lines.map(l=>r.labels[(l.target_type==="vehicle"?"vehicles:":"equipment:")+l.target_id]).filter(Boolean))]}:{}),
              ...(r.draft.kind==="recovery"?{recovery_details:r.draft.recovery_details,recovery_counts:recoveryLineCounts(r.draft.lines)}:{}),
              ...receiptPriceSummary(r.draft.lines),
              serial_numbers: r.draft.lines.flatMap(lineSerials),
              last_edited_by_name:
                (events.get(r.id) ?? []).find(
                  (e) => e.action === "save" && e.before_json !== null,
                )?.actor_name ?? null,
              quantity_units: normalizeReceiptUnits(
                r.draft.lines.map((l) =>
                  String(r.labels["unit:" + l.part_id] ?? ""),
                ),
              ),
              total_quantity: String(
                r.draft.lines.reduce(
                  (sum, l) =>
                    sum + BigInt(Math.round(Number(l.quantity) * 1000)),
                  0n,
                ),
              ),
              invoice_number: r.draft.invoice_number,
              purpose: r.draft.purpose,
              warehouse_label:
                r.labels["warehouses:" + r.draft.warehouse_id] ?? "",
              partner_label:
                r.draft.kind === "issue"
                  ? r.draft.recipient
                  : (r.labels["suppliers:" + r.draft.supplier_id] ??
                    r.draft.recipient),
            }) as DocumentSummary,
        ),
        ...(options.includeTotals !== false
          ? {
              receipt_totals: receiptTotals(
                filtered.map((r) => ({
                  ...r,
                  kind: r.draft.kind,
                  business_at: r.draft.business_at,
                  warehouse_label: "",
                  partner_label: "",
                  line_count: r.draft.lines.length,
                  ...(r.draft.kind==="recovery"?{recovery_counts:recoveryLineCounts(r.draft.lines)}:{}),
                  total_quantity: String(
                    r.draft.lines.reduce(
                      (s, l) =>
                        s + BigInt(Math.round(Number(l.quantity) * 1000)),
                      0n,
                    ),
                  ),
                  quantity_units: normalizeReceiptUnits(
                    r.draft.lines.map((l) =>
                      String(r.labels["unit:" + l.part_id] ?? ""),
                    ),
                  ),
                })),
              ),
            }
          : {}),
        pagination: {
          page: current,
          page_size: pageSize,
          total: filtered.length,
        },
      };
    },
    async get(id, signal) {
      signal?.throwIfAborted();
      const r = records.get(id);
      if (!r)
        throw new CatalogApiError(
          400,
          "DOCUMENT_VALIDATION",
          "Không tìm thấy phiếu mẫu.",
        );
      return clone(r);
    },
    async save(input, key, old, reason) {
      const draft = parseDraft(input);
      const before = old ? records.get(old.id) : undefined;
      const replay = keys.get(key);
      if (!old && replay) {
        if (replay.hash !== JSON.stringify(draft))
          throw new CatalogApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Mã yêu cầu đã dùng cho dữ liệu khác.",
          );
        return clone(records.get(replay.id)!);
      }
      if (old && (!before || before.version !== old.version)) return changed();
      if (before && !editableDraft(before.status))
        throw new CatalogApiError(
          400,
          "DOCUMENT_VALIDATION",
          "Phiếu không ở trạng thái sửa được.",
        );
      for (const line of draft.lines) {
        const part = fixtures.parts?.find((p) => p.id === line.part_id);
        if (lineSerials(line).length && part?.is_serialized !== 1)
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Vật tư không quản lý SERIAL, không nhập Serial.",
          );
        if (line.tank_id && part?.is_fuel !== 1)
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Vật tư không phải nhiên liệu.",
          );
        if (line.data_package && part?.needs_data_package !== 1)
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Vật tư không sử dụng gói Data.",
          );
      }
      const hash = JSON.stringify(draft),
        found = keys.get(key);
      if (!old && found) {
        if (found.hash !== hash)
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Mã yêu cầu đã dùng cho nội dung khác.",
          );
        return clone(records.get(found.id)!);
      }
      if (
        before &&
        (!reason?.trim() ||
          before.draft.kind !== draft.kind ||
          before.draft.business_at.slice(0, 7) !==
            draft.business_at.slice(0, 7))
      )
        throw new CatalogApiError(
          400,
          "DOCUMENT_VALIDATION",
          "Cần lý do sửa; không đổi loại/tháng đã cấp số.",
        );
      if (!seeding && !["receipt", "proposal"].includes(draft.kind))
        throw new CatalogApiError(
          409,
          "PREVIEW_ONLY",
          "Bản xem trước chưa kết nối sổ kho cho loại phiếu này. Dùng máy chủ để ghi sổ thực tế.",
        );
      const committing = draft.kind === "receipt" && !seeding;
      if (committing) {
        for (const [index, line] of draft.lines.entries()) {
          const part = fixtures.parts?.find((p) => p.id === line.part_id);
          if (
            (line.pricing_mode || "unit_net") === "unit_net"
              ? line.unit_price === ""
              : !line.pricing_value
          )
            throw new CatalogApiError(
              400,
              "PRICE_REQUIRED",
              `Dòng ${index + 1}: Đơn giá bắt buộc.`,
            );
          if (
            part?.is_serialized === 1 &&
            lineSerials(line).length !== Number(line.quantity)
          )
            throw new CatalogApiError(
              400,
              "SERIALS_INCOMPLETE",
              `Dòng ${index + 1}: Chưa đủ serial.`,
            );
          if (
            lineSerials(line).some((value) =>
              stockSerials.has(line.part_id + ":" + value.toUpperCase()),
            )
          )
            throw new CatalogApiError(
              409,
              "SERIAL_IN_STOCK",
              "Serial đã có trong kho.",
            );
        }
      }
      const stamp = new Date().toISOString(),
        period = draft.business_at.slice(0, 7),
        counterKey = period + documentSymbol(draft.kind,draft.opening_mode),
        count = (counters.get(counterKey) ?? 0) + 1;
      const code =
        before?.code ??
        draft.business_at.slice(5, 7) +
          "." +
          draft.business_at.slice(2, 4) +
          "." +
          String(count).padStart(5, "0") +
          "/" +
          documentSymbol(draft.kind,draft.opening_mode) +
          (draft.kind === "proposal" ? "/KHO" : "");
      const row: DocumentRecord = {
        id: before?.id ?? crypto.randomUUID(),
        version: (before?.version ?? 0) + 1,
        code,
        status: committing ? "posted" : (before?.status ?? "draft"),
        draft: clone(draft),
        labels: labels(draft),
        totals: draftTotals(draft),
        created_by: before?.created_by ?? user().id,
        created_by_name: before?.created_by_name ?? user().display_name,
        created_at: before?.created_at ?? stamp,
        updated_at: stamp,
        workflow_snapshot: before?.workflow_snapshot ?? null,
        approval_step: before?.approval_step ?? 0,
        approval_votes: before?.approval_votes ?? [],
      };
      if (committing)
        for (const [index, line] of draft.lines.entries()) {
          const key = line.part_id + ":" + draft.warehouse_id,
            balance = stock.get(key) ?? { quantity_milli: 0, value_vnd: 0 };
          if (!beforeStocks.has(row.id + ":" + key))
            beforeStocks.set(row.id + ":" + key, clone(balance));
          stock.set(key, {
            quantity_milli:
              balance.quantity_milli + Math.round(Number(line.quantity) * 1000),
            value_vnd:
              balance.value_vnd + receiptLandedCosts(draft)[index].landed,
          });
          lineSerials(line).forEach((value) =>
            stockSerials.set(
              line.part_id + ":" + value.toUpperCase(),
              draft.warehouse_id,
            ),
          );
        }
      records.set(row.id, row);
      if (!before) {
        keys.set(key, { hash, id: row.id });
        counters.set(counterKey, count);
      }
      event(
        row,
        before ? "save" : "create",
        reason ?? "Lập nháp mẫu",
        before ?? null,
      );
      return clone(row);
    },
    async action(old, action, reason) {
      const before = records.get(old.id);
      if (!before || before.version !== old.version) return changed();
      if (!reason.trim())
        throw new CatalogApiError(400, "DOCUMENT_VALIDATION", "Cần lý do.");
      const row = clone(before);
      if (action === "submit") {
        const flow = workflows.find(
          (w) =>
            w.department_id === row.draft.department_id &&
            w.proposal_type === row.draft.proposal_type &&
            w.is_active === 1,
        );
        if (
          row.draft.kind !== "proposal" ||
          !editableDraft(row.status) ||
          !flow
        )
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Chưa có quy trình phù hợp.",
          );
        row.status = "pending";
        row.workflow_snapshot = { name: flow.name, steps: clone(flow.steps) };
        row.approval_step = 0;
        row.approval_votes = [];
      } else if (["approve", "return", "reject"].includes(action)) {
        const step = row.workflow_snapshot?.steps[row.approval_step];
        if (row.status !== "pending" || !step?.approver_ids.includes(user().id))
          throw new CatalogApiError(
            400,
            "DOCUMENT_VALIDATION",
            "Không thuộc bước duyệt hiện tại.",
          );
        if (action === "return") row.status = "returned";
        else if (action === "reject") row.status = "rejected";
        else {
          if (row.approval_votes.includes(user().id))
            throw new CatalogApiError(
              400,
              "DOCUMENT_VALIDATION",
              "Bạn đã duyệt.",
            );
          row.approval_votes.push(user().id);
          if (
            step.mode === "any" ||
            step.approver_ids.every((id) => row.approval_votes.includes(id))
          ) {
            row.approval_step++;
            row.approval_votes = [];
            if (row.approval_step === row.workflow_snapshot!.steps.length)
              row.status = "approved";
          }
        }
      } else if (action === "cancel") row.status = "cancelled";
      else if (action === "revoke") row.status = "returned";
      else
        throw new CatalogApiError(
          400,
          "DOCUMENT_VALIDATION",
          "Chưa bật ghi sổ trong bản dựng.",
        );
      row.version++;
      row.updated_at = new Date().toISOString();
      records.set(row.id, row);
      event(row, action, reason, before);
      return clone(row);
    },
    async history(id, page, signal) {
      signal?.throwIfAborted();
      const all = events.get(id) ?? [];
      return {
        data: clone(all.slice((page - 1) * 25, page * 25)),
        pagination: { page, page_size: 25, total: all.length },
      };
    },
    async workflows(signal) {
      signal?.throwIfAborted();
      return clone(workflows);
    },
    async approvers() {
      return [
        { id: "preview-admin", display_name: "Quản trị mẫu", role: "admin" },
        {
          id: "preview-accountant",
          display_name: "Kế toán mẫu",
          role: "accountant",
        },
      ];
    },
    async saveWorkflow(value, old) {
      const row = {
        ...clone(value),
        id: old?.id ?? crypto.randomUUID(),
        version: (old?.version ?? 0) + 1,
      };
      if (
        old &&
        workflows.find((w) => w.id === old.id)?.version !== old.version
      )
        return changed();
      workflows = old
        ? workflows.map((w) => (w.id === old.id ? row : w))
        : [...workflows, row];
      return clone(row);
    },
  };
  const draft = emptyDraft("receipt");
  draft.business_at = "2026-10-24T08:30";
  draft.warehouse_id = "wh-1";
  draft.supplier_id = "supplier-1";
  draft.lines[0].part_id = "part-filter";
  draft.lines[0].quantity = "2";
  draft.lines[0].document_quantity = "2";
  draft.lines[0].unit_price = "150000";
  draft.lines[0].vat_rate = "8";
  const ready = client.save(draft, "seed").finally(() => {
    seeding = false;
  });
  return { catalog, documents: client, ready };
}
