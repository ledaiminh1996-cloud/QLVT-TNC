// worker/src/http.ts
var ApiError = class extends Error {
  status;
  code;
  constructor(status, code2, message) {
    super(message);
    this.status = status;
    this.code = code2;
  }
};
function json(data, status = 200) {
  return Response.json(data, { status });
}

// worker/src/bookTarget.ts
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function parse(value) {
  if (typeof value !== "string") return {};
  try {
    return object(JSON.parse(value));
  } catch {
    return {};
  }
}
var text = (v) => typeof v === "string" ? v.trim() : "";
var code = (v) => text(v).split(/\s+[—–](?:\s+|$)/)[0].trim();
var decimal = (v) => {
  const s = text(v);
  return /^\d{1,12}(?:\.\d{1,3})?$/.test(s) ? s : "";
};
var kinds = { tractor: "\u0110\u1EA7u k\xE9o", trailer: "R\u01A1 mo\xF3c", generator: "M\xE1y ph\xE1t", container: "Container", office_car: "Xe con", box_truck: "Xe t\u1EA3i th\xF9ng", rented_truck: "Xe thu\xEA" };
function bookTarget(row) {
  const header = parse(row.header_json), labels = parse(row.labels_json), line = parse(row.line_json), sourceHeader = parse(row.source_header_json), sourceLabels = parse(row.source_labels_json);
  const issue = object(header.issue_details), recovery = object(header.recovery_details), sourceIssue = object(sourceHeader.issue_details), sourceOpening = object(sourceHeader.opening_details);
  const recovered = row.kind === "recovery", targetType = recovered ? text(row.source_target_type) : text(line.target_type), targetId = recovered ? text(row.source_target_id) : text(line.target_id);
  const key = (targetType === "equipment" ? "equipment:" : "vehicles:") + targetId;
  let label = targetId ? code(labels[key]) || code(sourceLabels[key]) : "";
  if (recovered) label = code(labels["recovery_source:" + text(line.id)]) || label;
  if (!label && targetType !== "equipment") label = code(row.vehicle_plate_snapshot);
  if (!label && !targetId) label = code(recovered ? recovery.vehicle_plate : issue.vehicle_plate);
  const type = text(recovered ? labels["recovery_target_kind:" + text(line.id)] : labels["type:" + key]) || text(sourceLabels["type:" + key]);
  let kind = kinds[type] ?? "";
  for (const saved of [issue, recovery, sourceIssue, sourceOpening]) {
    if (!label) continue;
    if (label === text(saved.trailer_number)) {
      kind = kind || "R\u01A1 mo\xF3c";
      break;
    }
    if (label === text(saved.generator_code) || label === text(saved.other)) {
      kind = kind || "M\xE1y ph\xE1t";
      break;
    }
    if (label === text(saved.container_number)) {
      kind = kind || "Container";
      break;
    }
    if (label === text(saved.vehicle_plate)) {
      kind = kind || (text(saved.vehicle_group) === "box_truck" ? "Xe t\u1EA3i th\xF9ng" : text(saved.vehicle_group) === "office_car" ? "Xe con" : ["BNAM", "DCANG"].includes(text(saved.vehicle_group)) ? "\u0110\u1EA7u k\xE9o" : "Ph\u01B0\u01A1ng ti\u1EC7n");
      break;
    }
  }
  if (label && !kind) kind = targetType === "equipment" ? "Thi\u1EBFt b\u1ECB" : targetType === "vehicle" ? "Ph\u01B0\u01A1ng ti\u1EC7n" : "";
  let odo = decimal(line.odo), hours = decimal(line.hours);
  const headerReading = recovered ? recovery : issue;
  if (!odo && label && label === text(headerReading.vehicle_plate)) odo = decimal(headerReading.odo);
  if (!hours && recovered && label && label === text(recovery.removed_from)) hours = decimal(recovery.hours);
  if (!odo && row.vehicle_odo_km !== null && row.vehicle_odo_km !== void 0 && Number.isSafeInteger(row.vehicle_odo_km)) odo = String(row.vehicle_odo_km);
  return { target_label: label, target_kind: kind, odo, hours };
}

// shared/stockLedger.ts
var ledgerKinds = { opening: "T\u1ED3n kho \u0111\u1EA7u k\u1EF3", receipt: "Nh\u1EADp kho", issue: "Xu\u1EA5t kho", recovery: "Thu h\u1ED3i", warehouse_transfer: "\u0110i\u1EC1u chuy\u1EC3n kho", retread: "G\u1EEDi \u0111\u1EAFp v\u1ECF", retread_receive: "Nh\u1EADn \u0111\u1EAFp v\u1ECF", liquidation: "Thanh l\xFD" };

// worker/src/stockLedger.ts
var bad = (message) => {
  throw new ApiError(400, "INVALID_LEDGER_FILTER", message);
};
function date(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + "T00:00Z")) || (/* @__PURE__ */ new Date(s + "T00:00Z")).toISOString().slice(0, 10) !== s) return bad("Ch\u1ECDn ng\xE0y ch\u1EE9ng t\u1EEB h\u1EE3p l\u1EC7.");
  return s;
}
function n(v) {
  const value = Number(v ?? 0);
  if (!Number.isSafeInteger(value)) throw new ApiError(422, "LEDGER_LIMIT", "S\u1ED1 li\u1EC7u v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n. Ch\u1ECDn ph\u1EA1m vi nh\u1ECF h\u01A1n.");
  return value;
}
var str = (v) => String(v ?? "");
function reading(r) {
  const m = bookTarget(r);
  return { target: m.target_label, target_kind: m.target_kind, readings: [m.odo ? m.odo + " km" : "", m.hours ? m.hours + " gi\u1EDD" : ""].filter(Boolean).join(" / ") };
}
async function handleStockLedger(request, env, user) {
  if (request.method !== "GET") throw new ApiError(405, "METHOD_NOT_ALLOWED", "S\u1ED5 kho ch\u1EC9 cho ph\xE9p xem.");
  const p = new URL(request.url).searchParams, from = date(p.get("from") ?? ""), to = date(p.get("to") ?? ""), warehouse = p.get("warehouse_id") ?? "", part = p.get("part_id") ?? "", state = p.get("stock_state") ?? "", kind = p.get("kind") ?? "", q = p.get("q")?.trim() ?? "", view = p.get("view") ?? "", exporting = p.get("export") === "1", direction = p.get("direction") ?? "asc";
  if (from > to) return bad("Ng\xE0y b\u1EAFt \u0111\u1EA7u ph\u1EA3i tr\u01B0\u1EDBc ng\xE0y k\u1EBFt th\xFAc.");
  for (const id of [warehouse, part]) if (id && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return bad("M\xE3 kho/v\u1EADt t\u01B0 kh\xF4ng h\u1EE3p l\u1EC7.");
  if (state && !["new", "recovered", "pending_scrap"].includes(state)) return bad("Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7.");
  if (kind && !Object.hasOwn(ledgerKinds, kind)) return bad("Lo\u1EA1i phi\u1EBFu kh\xF4ng h\u1EE3p l\u1EC7.");
  if (q.length > 200 || !["asc", "desc"].includes(direction) || !["", "children"].includes(view)) return bad("B\u1ED9 l\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7.");
  if (warehouse && user.role === "warehouse" && !await env.DB.prepare("SELECT 1 FROM document_warehouse_access WHERE user_id=? AND warehouse_id=?").bind(user.id, warehouse).first()) throw new ApiError(403, "WAREHOUSE_FORBIDDEN", "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem kho n\xE0y.");
  const page = Number(p.get("page") ?? 1), size = exporting ? 1e4 : Number(p.get("page_size") ?? (view === "children" ? 100 : 50));
  if (!Number.isSafeInteger(page) || page < 1 || page > 1e6 || !Number.isSafeInteger(size) || ![50, 100, 1e4].includes(size) || !exporting && size === 1e4) return bad("Ch\u1ECDn 50 ho\u1EB7c 100 d\xF2ng m\u1ED7i trang.");
  const access = (alias) => {
    const conditions = [], args2 = [];
    if (user.role === "warehouse") {
      conditions.push(`EXISTS(SELECT 1 FROM document_warehouse_access a WHERE a.user_id=? AND a.warehouse_id=${alias}.warehouse_id)`);
      args2.push(user.id);
    }
    for (const [key, value] of [["warehouse_id", warehouse], ["part_id", part], ["stock_state", state]]) if (value) {
      conditions.push(`${alias}.${key}=?`);
      args2.push(value);
    }
    return { sql: conditions.length ? " AND " + conditions.join(" AND ") : "", args: args2 };
  };
  const flowScope = access("f"), monthScope = access("b"), scope = access("s");
  const calcBalance = !!part && view !== "children";
  const opening = calcBalance ? `opening AS (SELECT part_id,warehouse_id,stock_state,sum(q) AS opening_milli FROM (
 SELECT b.part_id,b.warehouse_id,b.stock_state,b.quantity_milli AS q FROM stock_book_months b WHERE b.period<substr(?,1,7) ${monthScope.sql}
 UNION ALL SELECT f.part_id,f.warehouse_id,f.stock_state,f.quantity_delta_milli FROM stock_book_flow f WHERE f.status='posted' AND f.day>=substr(?,1,7)||'-01' AND f.day<? ${flowScope.sql}) GROUP BY part_id,warehouse_id,stock_state),` : `opening AS (SELECT NULL AS part_id,NULL AS warehouse_id,NULL AS stock_state,0 AS opening_milli WHERE 0),`;
  const openingArgs = calcBalance ? [from, ...monthScope.args, from, from, ...flowScope.args] : [];
  const base = `WITH ${opening} source AS (
 SELECT m.id AS movement_id,m.part_id,m.warehouse_id,l.line_number,l.sku_snapshot AS sku,l.part_name_snapshot AS part_name,l.unit_snapshot AS unit,
 coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END) AS stock_state,d.business_date AS day,coalesce(rj.received_at,dd.business_at,d.business_date||'T00:00') AS business_at,d.posted_at,d.id AS document_id,dd.id AS draft_id,coalesce(dd.version,0) AS version,d.code,
 CASE WHEN rj.received_line_id IS NOT NULL THEN 'retread_receive' ELSE coalesce(dd.kind,CASE d.type WHEN 'IN' THEN 'receipt' WHEN 'OUT' THEN 'issue' WHEN 'OPENING' THEN 'opening' WHEN 'RECOVERY' THEN 'recovery' WHEN 'TRANSFER' THEN 'warehouse_transfer' WHEN 'SCRAP' THEN 'liquidation' ELSE d.type END) END AS kind,
 w.code AS warehouse_code,m.quantity_delta_milli AS delta,
 CASE WHEN m.quantity_delta_milli>0 THEN 'in' ELSE 'out' END AS flow,
 d.id||':'||m.warehouse_id||':'||m.part_id||':'||coalesce(json_extract(dl.line_json,'$.stock_state'),CASE WHEN d.type='RECOVERY' THEN 'recovered' ELSE 'new' END)||':'||CASE WHEN m.quantity_delta_milli>0 THEN 'in' ELSE 'out' END AS group_key,
 dd.header_json,dd.labels_json,dl.id AS draft_line_id,dl.line_json,l.vehicle_plate_snapshot,l.vehicle_odo_km,
 u.target_type AS source_target_type,u.target_id AS source_target_id,ud.header_json AS source_header_json,ud.labels_json AS source_labels_json,
 coalesce(rj.serial_after,l.serial_number_snapshot,'') AS fallback_serial,
 CASE WHEN rj.received_line_id IS NOT NULL THEN 1 ELSE (SELECT count(*) FROM document_draft_serials ds WHERE ds.document_id=dd.id AND ds.line_id=dl.id) END AS serial_count,
 EXISTS(SELECT 1 FROM inventory_valuation_flags v WHERE v.inventory_line_id=l.id AND v.status='pending') AS pending
 FROM inventory_documents d JOIN inventory_document_lines l ON l.document_id=d.id JOIN stock_movements m ON m.document_line_id=l.id JOIN warehouses w ON w.id=m.warehouse_id
 LEFT JOIN retread_jobs rj ON rj.received_line_id=l.id
 LEFT JOIN document_drafts dd ON dd.posted_inventory_id=d.id OR (rj.document_id IS NOT NULL AND dd.id=rj.document_id)
 LEFT JOIN document_draft_lines dl ON dl.document_id=dd.id AND dl.line_number=l.line_number
 LEFT JOIN stock_usages u ON u.id=json_extract(dl.line_json,'$.usage_id') LEFT JOIN document_drafts ud ON ud.posted_inventory_id=u.document_id
 WHERE d.status='posted' AND d.business_date>=? AND d.business_date<=? AND l.is_opening_usage=0),
 rows AS (SELECT s.* FROM source s WHERE 1 ${scope.sql}),
 grouped AS (SELECT group_key,max(version) AS version,day,document_id,draft_id,code,kind,warehouse_id,warehouse_code,stock_state,part_id,sku,part_name,unit,flow,
 min(business_at) AS at,max(posted_at) AS posted_at,sum(CASE WHEN delta>0 THEN delta ELSE 0 END) AS in_milli,sum(CASE WHEN delta<0 THEN -delta ELSE 0 END) AS out_milli,sum(delta) AS delta,sum(serial_count) AS serial_count,sum(CASE WHEN serial_count>0 THEN serial_count ELSE 1 END) AS detail_count,max(pending) AS pending FROM rows GROUP BY group_key),
 numbered AS (SELECT g.*${calcBalance ? ",coalesce((SELECT o.opening_milli FROM opening o WHERE o.part_id=g.part_id AND o.warehouse_id=g.warehouse_id AND o.stock_state=g.stock_state),0)+sum(delta) OVER (PARTITION BY part_id,warehouse_id,stock_state ORDER BY day,at,document_id,flow ROWS UNBOUNDED PRECEDING) AS balance_milli" : ",NULL AS balance_milli"} FROM grouped g),
 matched AS (SELECT g.* FROM numbered g WHERE 1 ${kind ? "AND kind=?" : ""} ${q ? `AND (lower(code) LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM rows r LEFT JOIN document_draft_serials ds ON ds.document_id=r.draft_id AND ds.line_id=r.draft_line_id WHERE r.group_key=g.group_key AND (lower(coalesce(ds.serial_number,r.fallback_serial)) LIKE ? ESCAPE '\\' OR lower(coalesce(r.vehicle_plate_snapshot,'')||' '||coalesce(json_extract(r.header_json,'$.issue_details.vehicle_plate'),'')||' '||coalesce(json_extract(r.header_json,'$.recovery_details.vehicle_plate'),'')||' '||coalesce((SELECT e.value FROM json_each(r.labels_json) e WHERE e.key='recovery_source:'||json_extract(r.line_json,'$.id') LIMIT 1),'')||' '||coalesce((SELECT e.value FROM json_each(r.labels_json) e WHERE e.key=(CASE json_extract(r.line_json,'$.target_type') WHEN 'equipment' THEN 'equipment:' ELSE 'vehicles:' END)||json_extract(r.line_json,'$.target_id') LIMIT 1),'')) LIKE ? ESCAPE '\\')))` : ""})`;
  const pattern = "%" + q.toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const args = [...openingArgs, from, to, ...scope.args, ...kind ? [kind] : [], ...q ? [pattern, pattern, pattern] : []];
  const order = direction === "asc" ? "ASC" : "DESC";
  const childrenSql = `SELECT r.*,coalesce(nullif(r.fallback_serial,''),ds.serial_number,'') AS serial FROM rows r JOIN matched g ON g.group_key=r.group_key LEFT JOIN document_draft_serials ds ON ds.document_id=r.draft_id AND ds.line_id=r.draft_line_id AND r.kind<>'retread_receive'`;
  const child = (r) => {
    const quantity = n(r.serial_count) > 1 && Math.abs(n(r.delta)) !== n(r.serial_count) * 1e3 ? null : n(r.serial_count) > 1 ? 1e3 : Math.abs(n(r.delta));
    return { key: str(r.movement_id) + ":" + str(r.serial), group_key: str(r.group_key), serial: str(r.serial), in_milli: n(r.delta) > 0 ? quantity : 0, out_milli: n(r.delta) < 0 ? quantity : 0, ...reading(r), notes: (() => {
      try {
        return str(JSON.parse(str(r.line_json) || "{}").notes);
      } catch {
        return "";
      }
    })() };
  };
  if (view === "children") {
    const key = p.get("group_key") ?? "", expected = Number(p.get("version"));
    if (!/^[a-zA-Z0-9_:-]{1,512}$/.test(key) || !Number.isSafeInteger(expected) || expected < 0) return bad("Nh\xF3m ch\u1EE9ng t\u1EEB kh\xF4ng h\u1EE3p l\u1EC7.");
    const where = " WHERE r.group_key=? AND g.version=?", results2 = await env.DB.batch([env.DB.prepare(base + " " + childrenSql + where + " ORDER BY r.line_number,serial,r.movement_id LIMIT ? OFFSET ?").bind(...args, key, expected, size, (page - 1) * size), env.DB.prepare(base + " SELECT count(*) AS total FROM (" + childrenSql + where + ")").bind(...args, key, expected), env.DB.prepare(base + " SELECT version FROM matched WHERE group_key=?").bind(...args, key)]);
    if (!results2[2].results.length || n(results2[2].results[0].version) !== expected) throw new ApiError(409, "LEDGER_CHANGED", "Nh\xF3m phi\u1EBFu \u0111\xE3 thay \u0111\u1ED5i ho\u1EB7c kh\xF4ng c\xF2n trong b\u1ED9 l\u1ECDc. T\u1EA3i l\u1EA1i s\u1ED5.");
    return json({ data: results2[0].results.map(child), pagination: { page, page_size: size, total: n(results2[1].results[0].total) } });
  }
  const pageSql = `SELECT g.*,(SELECT r.header_json FROM rows r WHERE r.group_key=g.group_key LIMIT 1) AS header_json,(SELECT r.labels_json FROM rows r WHERE r.group_key=g.group_key LIMIT 1) AS labels_json,(SELECT json_group_array(json_object('kind',r.kind,'line_json',r.line_json,'source_target_type',r.source_target_type,'source_target_id',r.source_target_id,'source_header_json',r.source_header_json,'source_labels_json',r.source_labels_json,'vehicle_plate_snapshot',r.vehicle_plate_snapshot,'vehicle_odo_km',r.vehicle_odo_km)) FROM rows r WHERE r.group_key=g.group_key) AS metadata FROM matched g ORDER BY day ${order},at ${order},document_id ${order},flow ${order} LIMIT ? OFFSET ?`;
  const balancesSql = part ? `SELECT x.part_id,x.warehouse_id,x.stock_state,w.code AS warehouse_code,p.sku,p.name AS part_name,p.unit,sum(x.opening_milli) AS opening_milli,sum(x.closing_milli) AS closing_milli FROM (
 SELECT part_id,warehouse_id,stock_state,opening_milli,opening_milli AS closing_milli FROM opening UNION ALL SELECT part_id,warehouse_id,stock_state,0,sum(delta) FROM grouped GROUP BY part_id,warehouse_id,stock_state
 ) x JOIN warehouses w ON w.id=x.warehouse_id JOIN parts p ON p.id=x.part_id GROUP BY x.part_id,x.warehouse_id,x.stock_state ORDER BY w.code,x.stock_state` : "SELECT NULL WHERE 0";
  const statements = [env.DB.prepare(base + " " + pageSql).bind(...args, size, exporting ? 0 : (page - 1) * size), env.DB.prepare(base + " SELECT count(*) AS total FROM matched").bind(...args), env.DB.prepare(base + " SELECT unit,sum(in_milli) AS in_milli,sum(out_milli) AS out_milli FROM matched GROUP BY unit").bind(...args), env.DB.prepare(base + " " + balancesSql).bind(...args), ...exporting ? [env.DB.prepare(base + " " + childrenSql + " ORDER BY r.day,r.business_at,r.document_id,r.line_number,serial LIMIT 10001").bind(...args)] : []];
  const results = await env.DB.batch(statements), count = n(results[1].results[0].total);
  if (exporting && (count > 1e4 || results[4].results.length > 1e4)) throw new ApiError(422, "LEDGER_EXPORT_LIMIT", "S\u1ED5 c\xF3 h\u01A1n 10.000 d\xF2ng chi ti\u1EBFt. Thu h\u1EB9p k\u1EF3 ho\u1EB7c kho \u0111\u1EC3 xu\u1EA5t \u0111\u1EA7y \u0111\u1EE7.");
  const data = results[0].results.map((r) => {
    const metadata = JSON.parse(str(r.metadata) || "[]").map((m) => reading({ ...m, header_json: r.header_json, labels_json: r.labels_json })), targets = [...new Set(metadata.map((m) => m.target + (m.target_kind ? " \xB7 " + m.target_kind : "")).filter(Boolean))], readings = [...new Set(metadata.map((m) => m.readings).filter(Boolean))];
    return { key: str(r.group_key), version: n(r.version), day: str(r.day), posted_at: str(r.posted_at), document_id: str(r.document_id), draft_id: r.draft_id === null ? null : str(r.draft_id), code: str(r.code), kind: str(r.kind), warehouse_id: str(r.warehouse_id), warehouse_code: str(r.warehouse_code), stock_state: r.stock_state, part_id: str(r.part_id), sku: str(r.sku), part_name: str(r.part_name).startsWith(str(r.sku) + " \u2014 ") ? str(r.part_name).slice(str(r.sku).length + 3) : str(r.part_name), unit: str(r.unit), in_milli: n(r.in_milli), out_milli: n(r.out_milli), balance_milli: r.balance_milli === null ? null : n(r.balance_milli), serial_count: n(r.serial_count), detail_count: n(r.detail_count), target: targets.length > 1 ? "Nhi\u1EC1u thi\u1EBFt b\u1ECB" : targets[0] ?? "", target_kind: "", readings: readings.length > 1 ? "Nhi\u1EC1u s\u1ED1 \u0111o" : readings[0] ?? "", pending: !!r.pending };
  });
  const balances = part ? results[3].results.map((r) => ({ part_id: str(r.part_id), warehouse_id: str(r.warehouse_id), stock_state: r.stock_state, warehouse_code: str(r.warehouse_code), sku: str(r.sku), part_name: str(r.part_name), unit: str(r.unit), opening_milli: n(r.opening_milli), closing_milli: n(r.closing_milli) })) : [];
  return json({ data, balances, units: results[2].results.map((r) => ({ unit: str(r.unit), in_milli: n(r.in_milli), out_milli: n(r.out_milli) })), totals: { count, opening_milli: part ? balances.reduce((sum, b) => n(sum + b.opening_milli), 0) : null, closing_milli: part ? balances.reduce((sum, b) => n(sum + b.closing_milli), 0) : null }, pagination: { page: exporting ? 1 : page, page_size: size, total: count }, ...exporting ? { children: results[4].results.map(child) } : {} });
}
export {
  handleStockLedger
};
