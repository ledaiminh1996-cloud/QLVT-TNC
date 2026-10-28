import {
  normalizeViNumber,
  normalizeDraftInput,
} from "../shared/documentNumbers";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import {
  emptyDraft,
  emptyLine,
  parseDraft,
  draftTotals,
  parseQuickLines,
  documentKinds,
} from "../shared/documents";
import { createDocumentClient } from "../src/documents/documentClient";
import { createDocumentPreview } from "../src/documents/previewStore";
import { CatalogApiError } from "../src/api/catalogClient";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000/",
});
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  localStorage: dom.window.localStorage,
  innerWidth: 1440,
  innerHeight: 900,
  IS_REACT_ACT_ENVIRONMENT: true,
}))
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
const { render, screen, fireEvent, waitFor, cleanup } = await import(
  "@testing-library/react"
);
const { DocumentsWorkspace } = await import(
  "../src/documents/DocumentsWorkspace"
);
const { DocumentEditor } = await import("../src/documents/DocumentEditor");
const { DocumentQuickImport } = await import(
  "../src/documents/DocumentQuickImport"
);
afterEach(() => {
  cleanup();
  dom.window.localStorage.clear();
});
const user = {
  id: "preview-admin",
  display_name: "Quản trị mẫu",
  role: "admin" as const,
};
async function preview() {
  const p = createDocumentPreview(() => user);
  await p.ready;
  return p;
}
async function example() {
  const p = await preview(),
    summary = (await p.documents.list({ kind: "receipt" })).data[0],
    record = await p.documents.get(summary.id);
  return { ...p, record };
}

test("document amounts use actual quantity and exact decimal rounding rather than invoice quantity", () => {
  const draft = emptyDraft("receipt");
  draft.warehouse_id = "warehouse";
  const line = draft.lines[0];
  line.part_id = "part";
  line.document_quantity = "100";
  line.quantity = "2.125";
  line.unit_price = "12345";
  line.vat_rate = "8";
  assert.deepEqual(draftTotals(parseDraft(draft)), {
    net: 26233,
    vat: 2099,
    gross: 28332,
  });
  line.serial = "000001234567890123456789";
  line.quantity = "1";
  assert.equal(parseDraft(draft).lines[0].serial, line.serial);
  line.quantity = "2";
  assert.throws(() => parseDraft(draft), /Serial/);
});
test("draft parsing blocks unsafe quantities, duplicate serials, injected totals and illegal stock states", () => {
  const draft = emptyDraft("receipt");
  draft.warehouse_id = "warehouse";
  draft.lines[0].part_id = "part";
  draft.lines[0].unit_price = "100";
  for (const quantity of ["-1", "1e3", "1.2345", "NaN", "0"])
    assert.throws(() =>
      parseDraft({ ...draft, lines: [{ ...draft.lines[0], quantity }] }),
    );
  assert.throws(() => parseDraft({ ...draft, total: 1 }), /trường/);
  assert.throws(
    () =>
      parseDraft({ ...draft, lines: [{ ...draft.lines[0], vat_rate: "101" }] }),
    /VAT/,
  );
  const serial = { ...draft.lines[0], serial: "ABC" };
  assert.throws(
    () =>
      parseDraft({
        ...draft,
        lines: [serial, { ...serial, id: crypto.randomUUID(), serial: "abc" }],
      }),
    /Serial trùng/,
  );
  assert.throws(
    () =>
      parseDraft({
        ...draft,
        kind: "liquidation",
        lines: [{ ...draft.lines[0], unit_price: "" }],
      }),
    /chờ thanh lý/,
  );
  const out = {
    ...draft,
    kind: "issue" as const,
    lines: [{ ...draft.lines[0], unit_price: "" }],
  };
  assert.deepEqual(draftTotals(parseDraft(out)), {
    net: null,
    vat: null,
    gross: null,
  });
});
test("quick import parses BOM, quoted commas, multiline data and three/four columns without coercing codes", () => {
  assert.deepEqual(
    parseQuickLines("\uFEFF000123\t2\t150000\r\n000124\t1\t50000\tGOI90"),
    [
      ["000123", "2", "150000"],
      ["000124", "1", "50000", "GOI90"],
    ],
  );
  assert.deepEqual(parseQuickLines('SIM,"1,5",50000,"Gói A\nGói B"'), [
    ["SIM", "1,5", "50000", "Gói A\nGói B"],
  ]);
  assert.throws(() => parseQuickLines('A,1,"123'), /ngoặc kép/);
});
test("document client sends idempotency and version only through the authenticated API and rejects login HTML", async () => {
  const { record } = await example(),
    calls: { url: string; options: RequestInit }[] = [];
  const client = createDocumentClient(async (url, options) => {
    calls.push({ url: String(url), options: options! });
    return Response.json({ data: record });
  });
  await client.save(record.draft, "key");
  await client.save(record.draft, "ignored", record, "Sửa");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(
    JSON.parse(String(calls[0].options.body)).idempotency_key,
    "key",
  );
  assert.equal(
    JSON.parse(String(calls[1].options.body)).version,
    record.version,
  );
  assert.equal(JSON.parse(String(calls[1].options.body)).action, "save");
  const html = createDocumentClient(
    async () =>
      new Response("<html>Login</html>", {
        headers: { "Content-Type": "text/html" },
      }),
  );
  await assert.rejects(() => html.get("x"), CatalogApiError);
});
test("document workspace lists drafts without eagerly reading catalogs and viewers cannot create", async () => {
  const p = await preview();
  let catalogReads = 0;
  const api = {
    ...p.catalog,
    list: async (...args: Parameters<typeof p.catalog.list>) => {
      catalogReads++;
      return p.catalog.list(...args);
    },
  };
  render(
    <DocumentsWorkspace
      menu="ct_nhap_kho"
      api={api}
      documents={p.documents}
      user={{ ...user, role: "viewer" }}
    />,
  );
  await screen.findByText("10.26.00001/PN");
  assert.equal(catalogReads, 0);
  assert.equal(screen.queryByRole("button", { name: "Lập phiếu" }), null);
  assert.equal(dom.window.localStorage.length, 0);
});
test("every document menu opens a specific workspace and transfer has both tabs", async () => {
  const p = await preview();
  for (const kind of Object.keys(
    documentKinds,
  ) as (keyof typeof documentKinds)[]) {
    const mounted = render(
      <DocumentsWorkspace
        menu={documentKinds[kind].menu}
        api={p.catalog}
        documents={p.documents}
        user={user}
      />,
    );
    if (kind === "equipment_transfer")
      fireEvent.click(
        screen.getByRole("tab", { name: "Điều chuyển giữa thiết bị" }),
      );
    assert.ok(
      await screen.findByRole("heading", { name: documentKinds[kind].label }),
    );
    mounted.unmount();
  }
});
test("failed draft edits keep values and reason, never write browser business storage or claim saved", async () => {
  const { record, catalog, documents } = await example();
  let saved = false;
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async () => {
          throw new CatalogApiError(409, "VERSION_CONFLICT", "Conflict");
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {
        saved = true;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Đối chiếu số thực nhập" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await screen.findByRole("alert");
  assert.equal(
    (screen.getByLabelText("Số lượng dòng 1") as HTMLInputElement).value,
    "3",
  );
  assert.equal(
    (screen.getByLabelText("Lý do sửa *") as HTMLInputElement).value,
    "Đối chiếu số thực nhập",
  );
  assert.equal(saved, false);
  assert.equal(dom.window.localStorage.length, 0);
});
test("draft save blocks duplicate submits and confirms only after API response", async () => {
  const { record, catalog, documents } = await example();
  let count = 0,
    saved = 0;
  let resolve!: (value: typeof record) => void;
  const promise = new Promise<typeof record>((r) => {
    resolve = r;
  });
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async () => {
          count++;
          return promise;
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {
        saved++;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Lưu kiểm tra" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  fireEvent.submit(
    screen.getByRole("button", { name: "Đang lưu…" }).closest("form")!,
  );
  assert.equal(count, 1);
  assert.equal(saved, 0);
  resolve(record);
  await waitFor(() => assert.equal(saved, 1));
});
test("receipt quick import previews data package and retains source text until applying", async () => {
  const p = await preview();
  let applied: unknown;
  render(
    <DocumentQuickImport
      api={p.catalog}
      kind="receipt"
      onClose={() => {}}
      onApply={(lines) => {
        applied = lines;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Dữ liệu dòng vật tư"), {
    target: { value: "M-DC-SIM-0001,1,150000,GOI30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
  await screen.findByText("150000 · GOI30");
  assert.equal(applied, undefined);
  fireEvent.click(screen.getByRole("button", { name: "Thêm vào phiếu" }));
  assert.equal(
    (applied as { data_package: string }[])[0].data_package,
    "GOI30",
  );
});

test("paper proposal separates removal and installation and excludes stock reference from cash budget", () => {
  const d = emptyDraft("proposal");
  d.department_id = "dept";
  d.lines[0].part_id = "part";
  d.lines[0].proposal_side = "remove";
  d.lines[0].proposal_link = "00012";
  d.proposal = {
    purchase_cost: "100",
    labor_cost: "20",
    other_cost: "0",
    vat_cost: "8",
    stock_reference: "9999",
    plans: "Thu hồi;Thay thế",
  };
  const parsed = parseDraft(d);
  assert.equal(parsed.lines[0].proposal_link, "00012");
  assert.deepEqual(draftTotals(parsed), { net: 120, vat: 8, gross: 128 });
  d.proposal.vat_cost = "";
  assert.equal(draftTotals(parseDraft(d)).gross, null);
  d.proposal.urgency = "INVALID";
  assert.throws(() => parseDraft(d));
});
test("paper proposal editor renders paper sections and separate material tables", async () => {
  const p = await preview();
  render(
    <DocumentEditor
      kind="proposal"
      api={p.api}
      documents={p.documents}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  assert.ok(screen.getByText("2.1. Vật tư dự kiến tháo / thu hồi"));
  assert.ok(screen.getByText("2.2. Vật tư dự kiến cấp / lắp vào"));
  assert.ok(screen.getByText("Người đề xuất"));
  assert.ok(screen.getByText("3. Dự toán"));
});

test("vi-VN input normalizes thousands and comma decimals; ambiguous dots and fractional VND are rejected", () => {
  assert.equal(normalizeViNumber("150.000", "Đơn giá", true), "150000");
  assert.equal(normalizeViNumber("1.234,5", "Số lượng"), "1234.5");
  assert.throws(
    () => normalizeViNumber("150.5", "Đơn giá", true),
    /hàng nghìn/,
  );
  assert.throws(
    () => normalizeViNumber("150,5", "Đơn giá", true),
    /nguyên đồng/,
  );
  const d = emptyDraft("receipt");
  d.warehouse_id = "wh";
  d.lines[0].part_id = "part";
  d.lines[0].unit_price = "150.000";
  d.lines[0].quantity = "2";
  d.lines[0].vat_rate = "8";
  assert.equal(draftTotals(parseDraft(normalizeDraftInput(d))).gross, 324000);
});
test("missing optional JSON headers default to empty strings without weakening required warehouse validation", () => {
  const d = emptyDraft("issue");
  d.warehouse_id = "wh";
  d.lines[0].part_id = "part";
  const { notes, recipient, invoice_number, purpose, ...partial } = d;
  const parsed = parseDraft(partial);
  assert.equal(parsed.notes, "");
  assert.equal(parsed.recipient, "");
  assert.throws(
    () => parseDraft({ ...partial, warehouse_id: undefined }),
    /Chọn kho/,
  );
});
test("editor money entry and quick import use identical vi-VN boundaries", async () => {
  const { record, catalog, documents } = await example();
  let saved: unknown;
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async (d) => {
          saved = d;
          return record;
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Đơn giá dòng 1"), {
    target: { value: "150.000" },
  });
  fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("VAT % dòng 1"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Đối chiếu" },
  });
  assert.ok(screen.getAllByText("324.000 đ").length);
  fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
  await waitFor(() =>
    assert.equal(
      (saved as { lines: { unit_price: string }[] }).lines[0].unit_price,
      "150000",
    ),
  );
  cleanup();
  const p = await preview();
  let rows: unknown;
  render(
    <DocumentQuickImport
      api={p.catalog}
      kind="receipt"
      onClose={() => {}}
      onApply={(d) => {
        rows = d;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Dữ liệu dòng vật tư"), {
    target: { value: "M-IN-TDONG-0001\t2\t150.000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
  await screen.findByText("150000");
  fireEvent.click(screen.getByRole("button", { name: "Thêm vào phiếu" }));
  assert.equal((rows as { unit_price: string }[])[0].unit_price, "150000");
});
test("unsaved editor protects close, Escape and browser unload; invalid input receives focus", async () => {
  const { record, catalog, documents } = await example();
  let closed = 0,
    calls = 0;
  const original = window.confirm;
  window.confirm = () => {
    calls++;
    return false;
  };
  try {
    render(
      <DocumentEditor
        kind="receipt"
        record={record}
        api={catalog}
        documents={documents}
        canEdit
        onClose={() => closed++}
        onSaved={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Đơn giá dòng 1"), {
      target: { value: "150.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
    assert.equal(calls, 1);
    assert.equal(closed, 0);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    assert.equal(calls, 2);
    const event = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() =>
      assert.ok(document.activeElement===screen.getByLabelText("Đơn giá dòng 1"),"Expected invalid price field focus"),
    );
    assert.match(screen.getByRole("alert").textContent ?? "", /Dòng 1/);
  } finally {
    window.confirm = original;
  }
});
