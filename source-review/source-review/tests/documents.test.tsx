import type {DraftLine} from "../shared/documents";
import { ReceiptTable as ReceiptTableView } from "../src/documents/ReceiptTable";
import { ReceiptColumns } from "../src/documents/ReceiptColumns";
import type { ReceiptColumn } from "../src/documents/ReceiptColumns";
import { serialRange, lineSerials } from "../shared/documentSerials";
import {
  documentDate,
  parseDocumentDate,
} from "../src/documents/documentFormatting";
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
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { DocumentsWorkspace } =
  await import("../src/documents/DocumentsWorkspace");
const { DocumentEditor } = await import("../src/documents/DocumentEditor");
const { DocumentQuickImport } =
  await import("../src/documents/DocumentQuickImport");

function ReceiptTableHarness(
  props: React.ComponentProps<typeof ReceiptTableView>,
) {
  const [selected, setSelected] = React.useState<ReceiptColumn[]>([]);
  return (
    <>
      <ReceiptColumns selected={selected} onChange={setSelected} />
      <ReceiptTableView {...props} selectedColumns={selected} />
    </>
  );
}
function toggleAllReceiptColumns() {
  const summary = screen.getByText("Cột hiển thị");
  const details = summary.closest("details")!;
  details.open = true;
  for (const input of screen.getAllByRole("checkbox")) fireEvent.click(input);
}
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
  assert.equal(parseDraft(draft).lines[0].quantity, "2");
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
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
  fireEvent.paste(screen.getByLabelText("Mã vật tư nhập nhanh dòng 1"), {
    clipboardData: {getData:()=>"Gói Data\tSố lượng\tMã vật tư\tĐơn giá\nGOI30\t1\tM-DC-SIM-0001\t150000"},
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
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
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
  fireEvent.paste(screen.getByLabelText("Mã vật tư nhập nhanh dòng 1"), {
    clipboardData: {getData:()=>"Mã vật tư\tSố lượng\tĐơn giá\nM-IN-TDONG-0001\t2\t150.000"},
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
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      assert.ok(
        document.activeElement === screen.getByLabelText("Đơn giá dòng 1"),
        "Expected invalid price field focus",
      ),
    );
    assert.match(screen.getByRole("alert").textContent ?? "", /Dòng 1/);
  } finally {
    window.confirm = original;
  }
});

test("document date displays dd/mm/yyyy, validates calendar and retains stored business time", async () => {
  assert.equal(documentDate("2026-10-25T08:30"), "25/10/2026");
  assert.equal(parseDocumentDate("29/02/2024"), "2024-02-29");
  assert.equal(parseDocumentDate("29/02/2026"), "");
  assert.equal(parseDocumentDate("31/04/2026"), "");
  const { record, catalog, documents } = await example();
  let value: unknown;
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async (d) => {
          value = d;
          return record;
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  assert.equal(
    (screen.getByLabelText("Số phiếu") as HTMLInputElement).value,
    record.code,
  );
  assert.equal(
    (screen.getByLabelText("Số phiếu") as HTMLInputElement).readOnly,
    true,
  );
  assert.equal(
    (screen.getByLabelText("Ngày chứng từ *") as HTMLInputElement).value,
    "24/10/2026 08:30",
  );
  fireEvent.change(screen.getByLabelText("Ngày chứng từ *"), {
    target: { value: "25/10/2026 19:45" },
  });
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Chỉnh ngày" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    assert.equal(
      (value as { business_at: string }).business_at,
      "2026-10-25T19:45",
    ),
  );
  cleanup();
  render(
    <DocumentEditor
      kind="receipt"
      api={catalog}
      documents={documents}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  await waitFor(() =>
    assert.match(
      (screen.getByLabelText("Số phiếu") as HTMLInputElement).value,
      /^\d{2}\.\d{2}\.\d{5}\/PN$/,
    ),
  );
  assert.equal(screen.queryByText(/Số được cấp khi lưu nháp/), null);
});

test("number preview follows period and ignores stale replies after date changes", async () => {
  const p = await preview();
  let first!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    first = resolve;
  });
  let requests = 0;
  render(
    <DocumentEditor
      kind="receipt"
      api={p.catalog}
      documents={{
        ...p.documents,
        nextNumber: async () => {
          requests++;
          return requests === 1 ? pending : "11.26.00001/PN";
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Ngày chứng từ *"), {
    target: { value: "01/11/2026 08:30" },
  });
  await waitFor(() =>
    assert.equal(
      (screen.getByLabelText("Số phiếu") as HTMLInputElement).value,
      "11.26.00001/PN",
    ),
  );
  first("10.26.00001/PN");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(
    (screen.getByLabelText("Số phiếu") as HTMLInputElement).value,
    "11.26.00001/PN",
  );
});

test("multi serial draft keeps one line and permits missing serials while enforcing part-scoped uniqueness", () => {
  const d = emptyDraft("receipt");
  d.warehouse_id = "w";
  const l = d.lines[0];
  l.part_id = "p";
  l.quantity = "5";
  l.serials = ["00001", "00002"];
  assert.equal(parseDraft(d).lines.length, 1);
  assert.deepEqual(parseDraft(d).lines[0].serials, ["00001", "00002"]);
  assert.throws(
    () => parseDraft({ ...d, lines: [{ ...l, serials: ["a", "A"] }] }),
    /Serial trùng/,
  );
  assert.throws(
    () => parseDraft({ ...d, lines: [{ ...l, quantity: "1.5" }] }),
    /số lượng nguyên/,
  );
  assert.throws(
    () => parseDraft({ ...d, lines: [{ ...l, quantity: "1" }] }),
    /vượt/,
  );
  assert.equal(
    parseDraft({
      ...d,
      lines: [l, { ...l, id: crypto.randomUUID(), part_id: "p2" }],
    }).lines.length,
    2,
  );
  assert.deepEqual(serialRange("MP", "0008", "0010"), [
    "MP0008",
    "MP0009",
    "MP0010",
  ]);
  assert.throws(() => serialRange("", "1", "999999999999"), /500/);
});
test("receipt serial drawer applies only on Done, keeps the main table unchanged and confirms quantity reduction", async () => {
  const p = await preview();
  let closed = 0;
  render(
    <DocumentEditor
      kind="receipt"
      api={p.catalog}
      documents={p.documents}
      canEdit
      onClose={() => {
        closed++;
      }}
      onSaved={() => {}}
    />,
  );
  const picker = screen.getByRole("combobox", { name: "Vật tư dòng 1" });
  fireEvent.focus(picker);
  fireEvent.change(picker, { target: { value: "M-RM-LOP" } });
  fireEvent.click(await screen.findByRole("option", { name: /Lốp xe/ }));
  await screen.findByRole("dialog", { name: "Serial dòng 1" });
  await waitFor(() =>
    assert.ok(
      document.activeElement ===
        screen.getByLabelText("Nhập nhanh serial dòng 1"),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
    target: { value: "3" },
  });
  const main = screen.getByRole("table", { name: "Dòng vật tư phiếu nhập" });
  const originalRows = main.querySelectorAll("tbody tr").length;
  fireEvent.click(screen.getByRole("button", { name: "Serial dòng 1" }));
  const quick = screen.getByLabelText("Nhập nhanh serial dòng 1");
  fireEvent.paste(quick, {
    clipboardData: { getData: () => "00001\n00002\n00003" },
  });
  assert.equal(main.querySelectorAll("tbody tr").length, originalRows);
  assert.ok(main.closest('[role="dialog"]')?.hasAttribute("inert"));
  assert.equal(closed, 0);
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  assert.ok(screen.getByText("Serial 3/3"));
  assert.ok(!main.closest('[role="dialog"]')?.hasAttribute("inert"));
  const original = window.confirm;
  try {
    window.confirm = () => false;
    fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
      target: { value: "2" },
    });
    assert.equal(
      (screen.getByLabelText("Số lượng dòng 1") as HTMLInputElement).value,
      "3",
    );
    window.confirm = () => true;
    fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
      target: { value: "2" },
    });
    assert.ok(screen.getByText("Serial 2/2"));
  } finally {
    window.confirm = original;
  }
  fireEvent.click(screen.getByRole("button", { name: "Serial dòng 1" }));
  fireEvent.change(screen.getByLabelText("Serial #2 dòng 1"), {
    target: { value: "00001" },
  });
  assert.ok(screen.getAllByText("Trùng tại STT 1, 2").length === 2);
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  assert.ok(screen.getByText("Serial 2/2").className.includes("amber"));
  assert.equal(
    screen.queryByRole("columnheader", { name: "Serial", exact: true }),
    null,
  );
  assert.equal(closed, 0);
});

test("receipt decimal unit price computes and saves the screenshot example; imported vi-VN decimals match", async () => {
  const d = emptyDraft("receipt");
  d.warehouse_id = "w";
  d.lines[0].part_id = "p";
  d.lines[0].quantity = "50";
  d.lines[0].unit_price = "3703703,7";
  d.lines[0].vat_rate = "8";
  assert.deepEqual(draftTotals(parseDraft(normalizeDraftInput(d))), {
    net: 185185185,
    vat: 14814815,
    gross: 200000000,
  });
  assert.throws(
    () =>
      parseDraft(
        normalizeDraftInput({
          ...d,
          lines: [{ ...d.lines[0], unit_price: "1,1234567890123" }],
        }),
      ),
    /12 chữ số/,
  );
  const { record, catalog, documents } = await example();
  let saved: unknown;
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async (value) => {
          saved = value;
          return record;
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Số lượng dòng 1"), {
    target: { value: "50" },
  });
  fireEvent.change(screen.getByLabelText("Đơn giá dòng 1"), {
    target: { value: "3703703,7" },
  });
  fireEvent.change(screen.getByLabelText("VAT % dòng 1"), {
    target: { value: "8" },
  });
  assert.ok(screen.getAllByText("200.000.000 đ").length);
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Đơn giá thập phân" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    assert.equal(
      (saved as { lines: { unit_price: string }[] }).lines[0].unit_price,
      "3703703.7",
    ),
  );
  cleanup();
  const p = await preview();
  let imported: unknown;
  render(
    <DocumentQuickImport
      kind="receipt"
      api={p.catalog}
      onClose={() => {}}
      onApply={(rows) => {
        imported = rows;
      }}
    />,
  );
  fireEvent.paste(screen.getByLabelText("Mã vật tư nhập nhanh dòng 1"), {
    clipboardData: {getData:()=>"Mã vật tư\tSố lượng\tĐơn giá\nM-IN-TDONG-0001\t50\t3.703.703,7"},
  });
  fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));
  await screen.findByText("3703703.7");
  fireEvent.click(screen.getByRole("button", { name: "Thêm vào phiếu" }));
  assert.equal(
    (imported as { unit_price: string }[])[0].unit_price,
    "3703703.7",
  );
});

test("receipt Save updates preview book stock once, opens posted record read-only and rejects incomplete serials", async () => {
  const p = await preview(),
    d = emptyDraft("receipt");
  d.warehouse_id = "wh-1";
  d.lines[0].part_id = "part-filter";
  d.lines[0].quantity = "3";
  d.lines[0].unit_price = "150000";
  const saved = await p.documents.save(d, "preview-post");
  assert.equal(saved.status, "posted");
  assert.equal(
    (await p.documents.stock("part-filter", "wh-1")).quantity_milli,
    3000,
  );
  await p.documents.save(d, "preview-post");
  assert.equal(
    (await p.documents.stock("part-filter", "wh-1")).quantity_milli,
    3000,
  );
  render(
    <DocumentEditor
      kind="receipt"
      record={saved}
      api={p.catalog}
      documents={p.documents}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  assert.equal(
    screen.queryByRole("button", { name: "Lưu", exact: true }),
    null,
  );
  assert.equal(
    (screen.getByLabelText("Số lượng dòng 1") as HTMLInputElement).disabled,
    true,
  );
  cleanup();
  d.lines[0].part_id = "part-tire";
  d.lines[0].serials = ["S001"];
  await assert.rejects(
    () => p.documents.save(d, "preview-short"),
    /Chưa đủ serial/,
  );
});

test("Save commits every stock document while proposals retain approval", async () => {
  const { record } = await example();
  const calls: Record<string, unknown>[] = [];
  const client = createDocumentClient(async (_url, options) => {
    calls.push(JSON.parse(String(options?.body)));
    return Response.json({ data: record });
  });
  for (const kind of Object.keys(
    documentKinds,
  ) as (keyof typeof documentKinds)[]) {
    const draft = { ...record.draft, kind };
    await client.save(draft, "key-" + kind);
    assert.equal(calls.at(-1)?.commit, kind !== "proposal");
  }
  await client.save(
    { ...record.draft, kind: "retread" },
    "unused",
    {
      ...record,
      status: "posted",
      draft: { ...record.draft, kind: "retread" },
      operation_state: "sent",
    },
    "Nhận đắp",
  );
  assert.equal(calls.at(-1)?.action, "receive");
});

test("receipt restores a single net unit price input without changing exact legacy pricing until edited", async () => {
  const { ReceiptPriceInput } =
    await import("../src/documents/ReceiptPriceInput");
  const { receiptPricing } = await import("../shared/receiptPricing");
  const draft = emptyDraft("receipt");
  Object.assign(draft.lines[0], {
    quantity: "50",
    vat_rate: "8",
    pricing_mode: "line_gross",
    pricing_value: "200000000",
  });
  let output = draft.lines[0];
  function Harness() {
    const [item, setItem] = React.useState(draft.lines[0]);
    output = item;
    return (
      <ReceiptPriceInput
        item={item}
        index={0}
        disabled={false}
        onChange={(p) => setItem((v) => ({ ...v, ...p }))}
      />
    );
  }
  render(<Harness />);
  assert.equal(screen.queryByLabelText("Cách nhập giá dòng 1"), null);
  assert.equal(receiptPricing(output).gross, 200000000);
  fireEvent.change(screen.getByLabelText("Đơn giá dòng 1"), {
    target: { value: "3703703,7" },
  });
  assert.equal(output.pricing_mode, "unit_net");
  assert.equal(output.pricing_value, "");
  assert.equal(
    receiptPricing(normalizeDraftInput({ ...draft, lines: [output] }).lines[0])
      .gross,
    200000000,
  );
});
test("fifty-row serial drawer filters real rows, deletes the filtered record, sorts and confirms clear with undo", async () => {
  const { SerialEditor } = await import("../src/documents/SerialEditor");
  const p = await preview();
  let applied: string[] = [];
  function Harness() {
    const [open, setOpen] = React.useState(true);
    return open ? (
      <SerialEditor
        item={{
          ...emptyLine(),
          part_id: "p",
          serials: Array.from(
            { length: 50 },
            (_, i) => "SN" + String(50 - i).padStart(4, "0"),
          ),
        }}
        index={0}
        title="SKU — Vỏ xe"
        expected={50}
        disabled={false}
        documents={p.documents}
        onChange={(v) => {
          applied = v.serials ?? [];
        }}
        onClose={() => setOpen(false)}
      />
    ) : null;
  }
  render(<Harness />);
  const table = screen.getByRole("table");
  assert.equal(table.querySelectorAll("tbody tr").length, 50);
  assert.ok(screen.getByText("SKU — Vỏ xe"));
  assert.equal(
    screen.queryByRole("textbox", { name: "Danh sách serial dòng 1" }),
    null,
  );
  assert.equal(screen.queryByText("Sinh dải serial"), null);
  fireEvent.change(screen.getByLabelText("Tìm serial dòng 1"), {
    target: { value: "sn0007" },
  });
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.ok(screen.getByText("Hiển thị 1/50 serial"));
  fireEvent.click(screen.getByRole("button", { name: "Sắp xếp" }));
  assert.equal(
    (screen.getByLabelText("Serial #7 dòng 1") as HTMLInputElement).value,
    "SN0007",
  );
  fireEvent.click(screen.getByRole("button", { name: "Xóa serial #7" }));
  assert.equal(screen.queryByDisplayValue("SN0007"), null);
  assert.ok(screen.getByText("Hiển thị 0/49 serial"));
  fireEvent.change(screen.getByLabelText("Tìm serial dòng 1"), {
    target: { value: "" },
  });
  assert.equal(table.querySelectorAll("tbody tr").length, 49);
  const original = window.confirm;
  try {
    window.confirm = () => false;
    fireEvent.click(screen.getByRole("button", { name: "Xóa hết serial" }));
    assert.equal(table.querySelectorAll("tbody tr").length, 49);
    window.confirm = () => true;
    fireEvent.click(screen.getByRole("button", { name: "Xóa hết serial" }));
    assert.ok(
      screen.getByText("Chưa có serial. Nhập hoặc dán vào ô phía trên."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    assert.equal(table.querySelectorAll("tbody tr").length, 49);
  } finally {
    window.confirm = original;
  }
  assert.equal(applied.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  assert.equal(applied.length, 49);
  assert.ok(!applied.includes("SN0007"));
  assert.equal(screen.queryByRole("dialog"), null);
});

test("receipt shows selected stock and serial shortage or excess after applying drawer", async () => {
  const { ReceiptLines } = await import("../src/documents/ReceiptLines");
  const p = await preview();
  const documents = {
    ...p.documents,
    stock: async () => ({ quantity_milli: 7000, value_vnd: 0 }),
  };
  function Harness() {
    const [draft, setDraft] = React.useState(() => {
      const d = emptyDraft("receipt");
      d.warehouse_id = "w";
      Object.assign(d.lines[0], {
        part_id: "p",
        quantity: "50",
        serials: Array.from({ length: 50 }, (_, i) => "S" + i),
      });
      return d;
    });
    const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
    return (
      <ReceiptLines
        vatCatalog={{
          rates: [0, 5, 8, 10].map((n) => ({
            value: String(n),
            label: n + "%",
          })),
          pending: false,
          error: "",
          retry: () => {},
        }}
        draft={draft}
        setDraft={setDraft}
        kind="receipt"
        api={p.catalog}
        labels={{
          "serialized:p": "1",
          "parts:p": "SKU — Vỏ",
          "unit:p": "Cái",
          "sku:p": "SKU",
        }}
        readOnly={false}
        saving={false}
        expanded={expanded}
        setExpanded={setExpanded}
        documents={documents}
        remember={() => {}}
        line={(id, patch) =>
          setDraft((d) => ({
            ...d,
            lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          }))
        }
      />
    );
  }
  render(<Harness />);
  await screen.findByText("Tồn kho trước phiếu này: 7");
  assert.equal(screen.queryByText(/Tồn: Chưa có dữ liệu/), null);
  assert.ok(screen.getByRole("columnheader", { name: "Thành tiền sau VAT" }));
  assert.ok(screen.getByText("Serial 50/50").className.includes("emerald"));
  fireEvent.click(screen.getByRole("button", { name: "Serial dòng 1" }));
  fireEvent.change(screen.getByLabelText("Nhập nhanh serial dòng 1"), {
    target: { value: "EXTRA" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xong" }));
  assert.ok(screen.getByText("Serial 51/50").className.includes("red"));
});

test("serial drawer Enter adds without submitting, Escape protects local edits and Cancel leaves invoice intact", async () => {
  const { SerialEditor } = await import("../src/documents/SerialEditor");
  const p = await preview();
  let applied = 0,
    outerEscape = 0;
  function Harness() {
    const [open, setOpen] = React.useState(true);
    return (
      <div
        role="dialog"
        aria-label="Phiếu gốc"
        onKeyDown={(e) => {
          if (e.key === "Escape") outerEscape++;
        }}
      >
        {open && (
          <SerialEditor
            item={{ ...emptyLine(), part_id: "p", serials: ["ORIGINAL"] }}
            index={0}
            title="SKU — Vật tư"
            expected={2}
            documents={p.documents}
            disabled={false}
            onChange={() => {
              applied++;
            }}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }
  render(<Harness />);
  const quick = screen.getByLabelText("Nhập nhanh serial dòng 1");
  fireEvent.change(quick, { target: { value: "NEW" } });
  fireEvent.keyDown(quick, { key: "Enter" });
  assert.equal(
    (screen.getByLabelText("Serial #2 dòng 1") as HTMLInputElement).value,
    "NEW",
  );
  assert.equal(applied, 0);
  const original = window.confirm;
  try {
    window.confirm = () => false;
    fireEvent.keyDown(quick, { key: "Escape" });
    assert.ok(screen.getByRole("dialog", { name: "Serial dòng 1" }));
    window.confirm = () => true;
    fireEvent.keyDown(quick, { key: "Escape" });
    assert.equal(screen.queryByRole("dialog", { name: "Serial dòng 1" }), null);
  } finally {
    window.confirm = original;
  }
  assert.equal(outerEscape, 0);
  assert.equal(applied, 0);
  assert.ok(screen.getByRole("dialog", { name: "Phiếu gốc" }));
});

test("serial drawer reports format, intra-line, other-line and stock conflicts per record and rejects oversized paste atomically", async () => {
  const { SerialEditor } = await import("../src/documents/SerialEditor");
  const p = await preview();
  let checked: string[] = [];
  const documents = {
    ...p.documents,
    checkSerials: async (_part: string, values: string[]) => {
      checked = values;
      return ["EXISTS"];
    },
  };
  render(
    <SerialEditor
      item={{
        ...emptyLine(),
        part_id: "p",
        serials: ["EXISTS", "SAME", "same", "BAD SPACE", "EXTERNAL"],
      }}
      index={0}
      title="SKU — Vật tư"
      expected={5}
      disabled={false}
      documents={documents}
      otherLocations={new Map([["p:EXTERNAL", ["dòng hàng 2, serial #1"]]])}
      onChange={() => {}}
      onClose={() => {}}
    />,
  );
  await waitFor(() => assert.ok(screen.getByText("Trùng trong kho")));
  assert.equal(screen.getAllByText("Trùng serial").length, 3);
  assert.ok(screen.getByText("Sai định dạng"));
  assert.ok(screen.getByText("Trùng dòng hàng 2, serial #1"));
  assert.ok(!checked.includes("BAD SPACE"));
  assert.equal(checked.filter((v) => v.toUpperCase() === "SAME").length, 1);
  const table = screen.getByRole("table");
  fireEvent.paste(screen.getByLabelText("Nhập nhanh serial dòng 1"), {
    clipboardData: {
      getData: () =>
        Array.from({ length: 501 }, (_, i) => "NEW" + i).join("\n"),
    },
  });
  assert.equal(table.querySelectorAll("tbody tr").length, 5);
  assert.ok(screen.getByRole("alert").textContent?.includes("500"));
});
test("read-only serial drawer filters records without exposing mutations or querying own stored serials as duplicates", async () => {
  const { SerialEditor } = await import("../src/documents/SerialEditor");
  const p = await preview();
  let queries = 0,
    closed = 0;
  render(
    <SerialEditor
      item={{ ...emptyLine(), part_id: "p", serials: ["AAA", "BBB"] }}
      index={0}
      title="SKU — Đã ghi sổ"
      expected={2}
      disabled
      documents={{
        ...p.documents,
        checkSerials: async () => {
          queries++;
          return [];
        },
      }}
      onChange={() => {
        throw Error("read-only mutation");
      }}
      onClose={() => {
        closed++;
      }}
    />,
  );
  assert.equal(screen.queryByRole("button", { name: "Xóa hết serial" }), null);
  assert.equal(screen.queryByLabelText("Nhập nhanh serial dòng 1"), null);
  assert.equal(screen.queryByRole("button", { name: "Sắp xếp" }), null);
  fireEvent.change(screen.getByLabelText("Tìm serial dòng 1"), {
    target: { value: "bbb" },
  });
  assert.ok(screen.getByText("BBB"));
  assert.equal(screen.queryByText("AAA"), null);
  assert.equal(queries, 0);
  fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  assert.equal(closed, 1);
});

test("receipt date shortcuts use Vietnam calendar and duplicate clears serials and receipt identity", async () => {
  const { receiptDateRange, vietnamToday, duplicateReceipt } =
    await import("../src/documents/receiptListUtils");
  assert.equal(vietnamToday(new Date("2026-03-31T18:00:00Z")), "2026-04-01");
  assert.deepEqual(
    receiptDateRange("month", new Date("2026-03-31T18:00:00Z")),
    { from: "2026-04-01", to: "2026-04-30" },
  );
  assert.deepEqual(
    receiptDateRange("previous", new Date("2024-03-15T00:00:00Z")),
    { from: "2024-02-01", to: "2024-02-29" },
  );
  assert.deepEqual(receiptDateRange("week", new Date("2026-01-02T00:00:00Z")), {
    from: "2025-12-27",
    to: "2026-01-02",
  });
  const { record } = await example();
  record.draft.lines[0].serials = ["000001"];
  record.draft.invoice_number = "OLD";
  const copied = duplicateReceipt(record, new Date("2026-10-26T00:00:00Z"));
  assert.notEqual(copied.lines[0].id, record.draft.lines[0].id);
  assert.deepEqual(copied.lines[0].serials, []);
  assert.equal(copied.invoice_number, "");
  assert.equal(copied.business_at, "2026-10-26T00:00");
  assert.deepEqual(record.draft.lines[0].serials, ["000001"]);
});
test("posted receipt opens read-only only from View and number, exposes View Print and puts secondary actions in menu", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example();
  const summary = {
    ...(await p.documents.list({ kind: "receipt" })).data[0],
    status: "posted" as const,
    can_modify: true,
  };
  const posted = { ...p.record, status: "posted" as const, can_modify: true };
  let gets = 0;
  const documents = {
    ...p.documents,
    list: async () => ({
      data: [summary],
      pagination: { page: 1, page_size: 25, total: 1 },
    }),
    get: async () => {
      gets++;
      return structuredClone(posted);
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={documents}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByRole("button", { name: summary.code });
  assert.ok(screen.getByRole("button", { name: "Xem " + summary.code }).title);
  assert.ok(
    screen.getByRole("button", { name: "In phiếu " + summary.code }).title,
  );
  assert.equal(
    screen.queryByRole("button", { name: "Lịch sử " + summary.code }),
    null,
  );
  fireEvent.click(screen.getByRole("button", { name: summary.code }));
  await screen.findByRole("dialog");
  assert.equal(
    screen.queryByRole("button", { name: "Lưu", exact: true }),
    null,
  );
  assert.equal(
    (screen.getByLabelText("Đơn giá dòng 1") as HTMLInputElement).disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  const tableRow = screen
    .getByRole("button", { name: summary.code })
    .closest("tr")!;
  fireEvent.click(tableRow);
  fireEvent.click(tableRow.querySelectorAll("td")[1]);
  fireEvent.keyDown(tableRow, { key: "Enter" });
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(gets, 1);
  assert.equal(tableRow.getAttribute("tabindex"), null);
  fireEvent.click(screen.getByRole("button", { name: "Xem " + summary.code }));
  await screen.findByRole("dialog");
  assert.equal(gets, 2);
  assert.equal(
    screen.queryByRole("button", { name: "Lưu", exact: true }),
    null,
  );
  fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  fireEvent.click(
    screen.getByRole("button", { name: "Thao tác khác " + summary.code }),
  );
  for (const name of ["Lịch sử", "Tải Excel (.xlsx)", "Nhân bản", "Hủy phiếu"])
    assert.ok(screen.getByRole("menuitem", { name }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Sửa phiếu" }));
  await screen.findByRole("button", { name: "Lưu", exact: true });
  assert.equal(gets, 3);
});
test("receipt filters default to current month, label dates, count filters and send selected warehouse supplier and serial", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const { receiptDateRange } =
    await import("../src/documents/receiptListUtils");
  const p = await preview();
  const calls: import("../src/documents/documentClient").ListDocuments[] = [];
  const documents = {
    ...p.documents,
    list: async (
      options: import("../src/documents/documentClient").ListDocuments,
    ) => {
      calls.push(options);
      return { data: [], pagination: { page: 1, page_size: 25, total: 0 } };
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={documents}
      user={user}
      createToken={0}
    />,
  );
  await waitFor(() => assert.ok(calls.length));
  assert.equal(calls[0].from, receiptDateRange("month").from);
  assert.equal(calls[0].to, receiptDateRange("month").to);
  assert.equal(screen.queryByText("1 bộ lọc đang áp dụng"), null);
  assert.equal(screen.queryByRole("button", { name: "Xóa lọc" }), null);
  assert.equal(screen.queryByLabelText("Từ ngày"), null);
  fireEvent.click(
    screen.getByRole("button", { name: "Chọn khoảng thời gian" }),
  );
  assert.ok(screen.getByLabelText("Từ ngày"));
  assert.ok(screen.getByLabelText("Đến ngày"));
  const beforeDates = calls.length;
  fireEvent.change(screen.getByLabelText("Từ ngày"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.change(screen.getByLabelText("Đến ngày"), {
    target: { value: "2026-10-01" },
  });
  assert.ok(
    (screen.getByRole("button", { name: "Áp dụng" }) as HTMLButtonElement)
      .disabled,
  );
  assert.equal(calls.length, beforeDates);
  fireEvent.click(screen.getByRole("button", { name: "Hôm nay", exact: true }));
  await waitFor(() =>
    assert.equal(calls.at(-1)?.from, receiptDateRange("today").from),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Bộ lọc khác", exact: true }),
  );
  fireEvent.focus(screen.getByRole("combobox", { name: "Kho" }));
  const warehouseOption = await screen.findByRole("option", { name: /KHO01/ });
  fireEvent.mouseDown(warehouseOption);
  fireEvent.click(warehouseOption);
  assert.ok(screen.getByRole("dialog", { name: "Bộ lọc khác" }));
  await waitFor(() => assert.ok(calls.at(-1)?.warehouse_id));
  fireEvent.focus(screen.getByRole("combobox", { name: "Nhà cung cấp" }));
  fireEvent.click(await screen.findByRole("option", { name: /NCC00001/ }));
  await waitFor(() => assert.ok(calls.at(-1)?.supplier_id));
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm chứng từ" }), {
    target: { value: "B65006700" },
  });
  await waitFor(() => assert.equal(calls.at(-1)?.q, "B65006700"));
  assert.ok(screen.getByText("4 bộ lọc đang áp dụng"));
  assert.ok(screen.getByRole("button", { name: "Bỏ lọc Kho" }));
  assert.ok(screen.getByRole("button", { name: "Bỏ lọc NCC" }));
  await waitFor(() =>
    assert.ok(
      screen
        .getByRole("combobox", { name: "Người tạo" })
        .querySelectorAll("option").length > 1,
    ),
  );
  const creatorSelect = screen.getByRole("combobox", { name: "Người tạo" });
  const creatorId = creatorSelect.querySelectorAll("option")[1].value;
  fireEvent.change(creatorSelect, { target: { value: creatorId } });
  await waitFor(() => assert.equal(calls.at(-1)?.created_by, creatorId));
  assert.ok(screen.getByRole("button", { name: "Bỏ lọc Người tạo" }));
  fireEvent.click(screen.getByRole("button", { name: "Bỏ lọc Người tạo" }));
  await waitFor(() => assert.equal(calls.at(-1)?.created_by, ""));

  fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
  await waitFor(() => {
    const last = calls.at(-1);
    assert.equal(last?.from, receiptDateRange("month").from);
    assert.equal(last?.to, receiptDateRange("month").to);
    assert.equal(last?.warehouse_id, "");
    assert.equal(last?.supplier_id, "");
    assert.equal(last?.q, "");
  });
  assert.equal(screen.queryByText("0 bộ lọc đang áp dụng"), null);
  assert.equal(screen.queryByRole("button", { name: "Xóa lọc" }), null);
});
test("receipt Excel exports real xlsx sheets with text serials, XML-safe names and accurate totals", async () => {
  const { buildReceiptWorkbook } =
    await import("../src/documents/receiptExcel");
  const readXlsx = (await import("read-excel-file/node")).readSheet;
  const { record } = await example();
  record.labels["parts:" + record.draft.lines[0].part_id] = "A & B <Lốp>";
  record.draft.lines[0].serials = ["000001", "=1+1"];
  const bytes = buildReceiptWorkbook(record);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const serials = await readXlsx(Buffer.from(bytes), "Serial");
  assert.equal(serials[1][3], "000001");
  assert.equal(serials[2][3], "=1+1");
  const rows = await readXlsx(Buffer.from(bytes), "Phiếu nhập");
  assert.ok(rows.some((row) => row.includes("A & B <Lốp>")));
  assert.equal(rows.at(-1)?.[1], record.totals.gross);
});

test("receipt secondary menu duplicates into an unsaved new number and cancels only after reason confirmation", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example();
  const summary = {
    ...(await p.documents.list({ kind: "receipt" })).data[0],
    status: "posted" as const,
    can_modify: true,
  };
  const posted = { ...p.record, status: "posted" as const, can_modify: true };
  let writes = 0,
    actionName = "",
    actionReason = "";
  const documents = {
    ...p.documents,
    list: async () => ({
      data: [summary],
      pagination: { page: 1, page_size: 25, total: 1 },
    }),
    get: async () => structuredClone(posted),
    save: async () => {
      writes++;
      return posted;
    },
    action: async (_row: typeof posted, name: string, reason: string) => {
      actionName = name;
      actionReason = reason;
      return { ...posted, status: "cancelled" as const };
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={documents}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByRole("button", { name: "Thao tác khác " + summary.code });
  fireEvent.click(
    screen.getByRole("button", { name: "Thao tác khác " + summary.code }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Nhân bản" }));
  await screen.findByRole("button", { name: "Lưu", exact: true });
  await screen.findByDisplayValue("10.26.00002/PN");
  assert.equal(writes, 0);
  fireEvent.click(screen.getByRole("button", { name: "Đóng", exact: true }));
  fireEvent.click(
    screen.getByRole("button", { name: "Thao tác khác " + summary.code }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Hủy phiếu" }));
  await screen.findByRole("dialog", { name: "Xử lý chứng từ" });
  assert.equal(
    (screen.getByRole("button", { name: "Xác nhận" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  assert.equal(actionName, "");
  fireEvent.change(screen.getByLabelText("Lý do *"), {
    target: { value: "Nhập nhầm" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
  await waitFor(() => assert.equal(actionName, "delete"));
  assert.equal(actionReason, "Nhập nhầm");
  assert.equal(writes, 0);
});

test("receipt table shows supplier code/name, exact page totals and default/optional column groups", async () => {
  const { ReceiptTable, receiptQuantity } =
    await import("../src/documents/ReceiptTable");
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const rows = [
    {
      ...base,
      total_quantity: "50125",
      invoice_number: "0000123",
      purpose: "Mua lốp",
      partner_label: "NCC00001 — Công Ty Đại Long",
      totals: { net: 100, vat: 8, gross: 108 },
    },
    {
      ...base,
      id: "second",
      code: "10.26.00002/PN",
      total_quantity: "875",
      totals: { net: 200, vat: 16, gross: 216 },
    },
  ];
  render(
    <ReceiptTableHarness
      rows={rows}
      busy={false}
      user={user}
      onOpen={() => {}}
    />,
  );
  assert.ok(
    screen.getByRole("columnheader", { name: "Trạng thái", exact: true }),
  );
  assert.equal(
    screen.queryByRole("columnheader", { name: "Dòng", exact: true }),
    null,
  );
  assert.ok(
    screen.getByRole("columnheader", {
      name: "Tiền hàng (sau VAT)",
      exact: true,
    }),
  );
  for (const label of [
    "Tiền hàng (trước VAT)",
    "Tiền VAT",
    "Người tạo",
    "Ngày giờ tạo",
  ])
    assert.ok(screen.getByRole("columnheader", { name: label, exact: true }));
  for (const label of ["Tổng SL", "Số serial", "Người sửa cuối"])
    assert.equal(
      screen.queryByRole("columnheader", { name: label, exact: true }),
      null,
    );
  const headers = [...document.querySelectorAll("thead th")].map((h) =>
    h.textContent?.trim(),
  );
  assert.deepEqual(headers.slice(-3), [
    "Người tạo",
    "Ngày giờ tạo",
    "Thao tác",
  ]);
  assert.equal(
    screen.queryByRole("checkbox", { name: "Tiền VAT", exact: true }),
    null,
  );
  toggleAllReceiptColumns();
  for (const label of [
    "Tiền hàng (trước VAT)",
    "Tiền VAT",
    "Người tạo",
    "Ngày giờ tạo",
    "Số serial",
    "Người sửa cuối",
  ])
    assert.ok(screen.getByRole("columnheader", { name: label, exact: true }));
  assert.ok(screen.getAllByText("NCC00001")[0]);
  assert.ok(screen.getByText("Công Ty Đại Long"));
  assert.equal(document.querySelector("tfoot"), null);
  assert.equal(receiptQuantity("12345678901234567"), "12.345.678.901.234,567");
  assert.ok(screen.getByText("Cột hiển thị"));
  assert.ok(screen.getByRole("columnheader", { name: "Số hóa đơn" }));
  assert.ok(screen.getAllByText("00000123")[0]);
  assert.ok(screen.getAllByText("Mua lốp")[0]);
});
test("filtered receipt Excel collects every page, forwards filters and rejects partial or changed lists", async () => {
  const { collectReceiptList } =
    await import("../src/documents/receiptListUtils");
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const calls: Record<string, unknown>[] = [];
  const client = {
    ...p.documents,
    list: async (args) => {
      calls.push(args);
      return {
        data: [{ ...base, id: String(args.page) }],
        pagination: { page: args.page, page_size: 1, total: 2 },
      };
    },
  };
  const filters = {
    kind: "receipt",
    q: "b650",
    from: "2026-10-01",
    warehouse_id: "wh",
    supplier_id: "sup",
  };
  const rows = await collectReceiptList(client, filters);
  assert.equal(rows.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].q, "b650");
  assert.equal(calls[1].warehouse_id, "wh");
  assert.equal(calls[1].supplier_id, "sup");
  await assert.rejects(
    collectReceiptList(
      {
        ...client,
        list: async (args) => ({
          data: args.page === 1 ? [base] : [],
          pagination: { page: args.page!, page_size: 1, total: 2 },
        }),
      },
      filters,
    ),
    /Không tải đủ/,
  );
  await assert.rejects(
    collectReceiptList(
      {
        ...client,
        list: async (args) => ({
          data: [base],
          pagination: {
            page: args.page!,
            page_size: 1,
            total: args.page === 1 ? 2 : 3,
          },
        }),
      },
      filters,
    ),
    /vừa thay đổi/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    collectReceiptList(client, { ...filters, signal: controller.signal }),
    { name: "AbortError" },
  );
});
test("filtered list workbook includes metadata and totals without losing invoice leading zeroes", async () => {
  const { buildReceiptListWorkbook } =
    await import("../src/documents/receiptExcel");
  const read = (await import("read-excel-file/node")).readSheet;
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const rows = await read(
    Buffer.from(
      buildReceiptListWorkbook([
        {
          ...base,
          total_quantity: "50125",
          invoice_number: "0000123",
          purpose: "A & B",
          totals: { net: 100, vat: 8, gross: 108 },
        },
      ]),
    ),
    "Phiếu nhập",
  );
  assert.equal(rows[2][4], "00000123");
  assert.equal(rows[2][5], "A & B");
  assert.equal(rows[2][6], 50.125);
  assert.equal(rows.at(-1)![7], 108);
});

test("receipt price summary preserves single and mixed price rates and warehouse tooltip shows full label", async () => {
  const { receiptPriceSummary } = await import("../shared/receiptSummary");
  const { ReceiptTable, receiptRate } =
    await import("../src/documents/ReceiptTable");
  const p = await example();
  const summary = (await p.documents.list({ kind: "receipt" })).data[0];
  const line = {
    ...emptyLine(),
    unit_price: "3703703.7",
    vat_rate: "8",
    quantity: "50",
  };
  assert.deepEqual(receiptPriceSummary([line, line]), {
    unit_prices: ["3703703.7"],
    vat_rates: ["8"],
  });
  assert.equal(
    receiptRate(
      receiptPriceSummary([
        line,
        { ...line, unit_price: "5000", vat_rate: "10" },
      ]).unit_prices,
    ),
    "Nhiều mức",
  );
  render(
    <ReceiptTableHarness
      rows={[
        {
          ...summary,
          ...receiptPriceSummary([line]),
          warehouse_label: "KHONS — Kho Nghi Sơn",
        },
      ]}
      busy={false}
      user={user}
      onOpen={() => {}}
    />,
  );
  assert.equal(
    screen.getByText("KHONS").getAttribute("title"),
    "KHONS — Kho Nghi Sơn",
  );
  assert.equal(
    screen.queryByRole("columnheader", { name: "Đơn giá", exact: true }),
    null,
  );
  assert.equal(
    screen.queryByRole("columnheader", { name: "VAT %", exact: true }),
    null,
  );
  toggleAllReceiptColumns();
  assert.ok(
    screen.getByRole("columnheader", {
      name: "Tiền hàng (trước VAT)",
      exact: true,
    }),
  );
  assert.ok(
    screen.getByRole("columnheader", { name: "Tiền VAT", exact: true }),
  );
});

test("optional receipt metadata shows true serial numbers, last editor and Vietnam creation datetime", async () => {
  const { ReceiptTable } = await import("../src/documents/ReceiptTable");
  const { documentCreatedAt } =
    await import("../src/documents/documentFormatting");
  assert.equal(documentCreatedAt("2026-10-25T20:05:00Z"), "26/10/2026 03:05");
  const p = await example();
  const row = (await p.documents.list({ kind: "receipt" })).data[0];
  render(
    <ReceiptTableHarness
      rows={[
        {
          ...row,
          serial_numbers: ["000001", "B65006700", "B65006701"],
          last_edited_by_name: "Người sửa mẫu",
          created_at: "2026-10-25T20:05:00Z",
        },
      ]}
      busy={false}
      user={user}
      onOpen={() => {}}
    />,
  );
  assert.equal(document.querySelectorAll("thead th").length, 13);
  toggleAllReceiptColumns();
  assert.equal(document.querySelectorAll("thead th").length, 16);
  assert.ok(screen.getByText("Người sửa mẫu"));
  assert.ok(screen.getByText("26/10/2026 03:05"));
  assert.ok(screen.getByText("000001, B65006700 (+1)"));
  toggleAllReceiptColumns();
  assert.equal(document.querySelectorAll("thead th").length, 13);
});

test("receipt quantity and filter totals never add incompatible units", async () => {
  const { ReceiptTable } = await import("../src/documents/ReceiptTable");
  const { receiptTotals } = await import("../shared/receiptTotals");
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const rows = [
    { ...base, id: "a", quantity_units: ["Cái"], total_quantity: "50000" },
    { ...base, id: "b", quantity_units: ["lít"], total_quantity: "30000" },
    {
      ...base,
      id: "c",
      quantity_units: ["cái", "lít"],
      total_quantity: "5000",
    },
  ];
  render(
    <ReceiptTableHarness
      rows={rows}
      busy={false}
      user={user}
      onOpen={() => {}}
    />,
  );
  toggleAllReceiptColumns();
  assert.ok(screen.getByText("50 cái"));
  assert.ok(screen.getByText("30 lít"));
  assert.ok(screen.getByText("Nhiều ĐVT"));
  assert.equal(document.querySelector("tfoot"), null);

  assert.deepEqual(
    receiptTotals([
      { ...base, quantity_units: [" CÁI "] },
      { ...base, quantity_units: ["cái"] },
    ]).units,
    ["cái"],
  );
});

test("receipt column choices stay independent across server page-size changes and tooltip metadata remains complete", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const row = {
    ...base,
    invoice_number: "1977",
    purpose: "Nội dung rất dài cần hiển thị đầy đủ trong tooltip",
    created_at: "2026-10-25T20:05:00Z",
  };
  const calls: import("../src/documents/documentClient").ListDocuments[] = [];
  const client = {
    ...p.documents,
    list: async (
      options: import("../src/documents/documentClient").ListDocuments,
    ) => {
      calls.push(options);
      return {
        data: [row],
        pagination: {
          page: options.page ?? 1,
          page_size: options.pageSize ?? 25,
          total: 1,
        },
      };
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={client}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByRole("button", { name: row.code });
  assert.equal(calls[0].pageSize, 20);
  const summary = screen.getByText("Cột hiển thị");
  summary.closest("details")!.open = true;
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Tổng SL", exact: true }),
  );
  assert.ok(
    screen.getByRole("columnheader", { name: "Tiền VAT", exact: true }),
  );
  assert.ok(
    screen.getByRole("columnheader", {
      name: "Tiền hàng (trước VAT)",
      exact: true,
    }),
  );
  assert.ok(screen.getByRole("columnheader", { name: "Tổng SL", exact: true }));
  assert.equal(
    screen.queryByRole("columnheader", { name: "Số serial", exact: true }),
    null,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    { target: { value: "50" } },
  );
  await waitFor(() => assert.equal(calls.at(-1)?.pageSize, 50));
  await screen.findByRole("columnheader", { name: "Tiền VAT", exact: true });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    { target: { value: "100" } },
  );
  await waitFor(() => assert.equal(calls.at(-1)?.pageSize, 100));
  await screen.findByRole("button", { name: row.code });
  screen.getByText("Cột hiển thị").closest("details")!.open = true;
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Số serial", exact: true }),
  );
  assert.ok(screen.getByText("26/10/2026 03:05"));
  assert.equal(screen.getByText("00001977").closest("td")?.title, "00001977");
  assert.equal(screen.getByText(row.purpose).closest("td")?.title, row.purpose);
  assert.equal(screen.queryByText(/Trang này:/), null);
  assert.equal(screen.queryByText(/Tổng 1 phiếu/), null);
});

test("receipt cards share list response, cache totals on paging and debounce search for 400ms", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example();
  const base = (await p.documents.list({ kind: "receipt" })).data[0];
  const totals = {
    count: 40,
    quantity_milli: "80000",
    units: ["cái"],
    net: "286000000",
    vat: "24340000",
    gross: "310340000",
    status_counts: { posted: 38, cancelled: 2 },
  };
  const calls: import("../src/documents/documentClient").ListDocuments[] = [];
  const client = {
    ...p.documents,
    list: async (
      options: import("../src/documents/documentClient").ListDocuments,
    ) => {
      calls.push(options);
      return {
        data: [base],
        ...(options.includeTotals === false ? {} : { receipt_totals: totals }),
        pagination: {
          page: options.page ?? 1,
          page_size: options.pageSize ?? 20,
          total: 40,
        },
      };
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={client}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByText("310.340.000");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includeTotals, true);
  assert.ok(screen.getByText("286.000.000"));
  assert.ok(screen.getByText("24.340.000"));
  fireEvent.click(
    screen.getByRole("button", { name: "Trang sau", exact: true }),
  );
  await waitFor(() => assert.equal(calls.at(-1)?.page, 2));
  assert.equal(calls.at(-1)?.includeTotals, false);
  await screen.findByText("310.340.000");
  const pageTwoCalls = calls.length;
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm chứng từ" }), {
    target: { value: "PAGE2" },
  });
  await new Promise((r) => setTimeout(r, 180));
  assert.equal(calls.length, pageTwoCalls);
  await waitFor(() => assert.equal(calls.at(-1)?.q, "PAGE2"));
  assert.equal(calls.length, pageTwoCalls + 1);
  assert.equal(calls.at(-1)?.page, 1);
  assert.equal(calls.at(-1)?.includeTotals, true);

  fireEvent.change(
    screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    { target: { value: "50" } },
  );
  await waitFor(() => assert.equal(calls.at(-1)?.pageSize, 50));
  assert.equal(calls.at(-1)?.includeTotals, false);
  fireEvent.click(
    screen.getByRole("button", { name: "Đã hủy: 2", exact: true }),
  );
  await waitFor(() => assert.equal(calls.at(-1)?.status, "cancelled"));
  assert.equal(calls.at(-1)?.includeTotals, true);
  assert.equal(calls.at(-1)?.page, 1);
  const before = calls.length;
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm chứng từ" }), {
    target: { value: "B65" },
  });
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(calls.length, before);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm chứng từ" }), {
    target: { value: "B6500" },
  });
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(calls.length, before);
  await waitFor(() => assert.equal(calls.at(-1)?.q, "B6500"));
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1)?.includeTotals, true);
  fireEvent.click(
    screen.getByRole("button", { name: "Tải lại chứng từ", exact: true }),
  );
  await waitFor(() => assert.equal(calls.length, before + 2));
  assert.equal(calls.at(-1)?.includeTotals, true);
});

test("receipt related costs validate vi-VN money and allocate every dong without adding VAT to inventory", async () => {
  const { receiptLandedCosts, emptyReceiptCosts } =
    await import("../shared/receiptCosts");
  const d = emptyDraft("receipt");
  d.warehouse_id = "w";
  d.lines = [
    {
      ...emptyLine(),
      part_id: "p",
      quantity: "2",
      unit_price: "100",
      vat_rate: "10",
      notes: "Lắp cầu trước",
    },
    {
      ...emptyLine(),
      part_id: "p",
      quantity: "1",
      unit_price: "300",
      vat_rate: "8",
      notes: "Lắp cầu sau",
    },
  ];
  d.related_costs = {
    transport: "100",
    unloading: "20",
    installation: "30",
    other: "5",
    vat: "15",
  };
  const parsed = parseDraft(d);
  assert.deepEqual(draftTotals(parsed), { net: 655, vat: 59, gross: 714 });
  assert.deepEqual(
    receiptLandedCosts(parsed).map((l) => [l.allocated, l.landed]),
    [
      [62, 262],
      [93, 393],
    ],
  );
  const split = {
    ...parsed,
    lines: Array.from({ length: 3 }, () => ({
      ...emptyLine(),
      part_id: "p",
      unit_price: "1",
      quantity: "1",
    })),
    related_costs: { ...emptyReceiptCosts(), transport: "1" },
  };
  assert.deepEqual(
    receiptLandedCosts(split).map((l) => l.allocated),
    [1, 0, 0],
  );
  split.lines.forEach((l) => (l.unit_price = "0"));
  split.related_costs.transport = "2";
  assert.deepEqual(
    receiptLandedCosts(split).map((l) => l.allocated),
    [1, 1, 0],
  );
  assert.equal(
    normalizeDraftInput({
      ...d,
      related_costs: { ...emptyReceiptCosts(), transport: "1.000" },
    }).related_costs?.transport,
    "1000",
  );
  for (const value of ["-1", "1.5", "1e3"]) {
    assert.throws(
      () =>
        parseDraft({
          ...d,
          related_costs: { ...emptyReceiptCosts(), transport: value },
        }),
      /Chi phí vận chuyển/,
    );
  }
  assert.throws(
    () =>
      parseDraft({
        ...d,
        related_costs: {
          ...emptyReceiptCosts(),
          transport: "9000000000000",
          other: "1",
        },
      }),
    /vượt giới hạn/,
  );
  assert.throws(() => parseDraft({ ...d, kind: "proposal" }), /Chỉ phiếu nhập/);
});
test("receipt editor saves per-line notes and A B C costs, reopens read-only and updates preview stock net only", async () => {
  const { DocumentEditor } = await import("../src/documents/DocumentEditor");
  const { duplicateReceipt } =
    await import("../src/documents/receiptListUtils");
  const p = await example();
  const draft = duplicateReceipt(p.record);
  let saved: import("../shared/documents").DocumentRecord | undefined;
  const mounted = render(
    <DocumentEditor
      kind="receipt"
      initialDraft={draft}
      api={p.catalog}
      documents={p.documents}
      canEdit={true}
      onClose={() => {}}
      onSaved={(r) => {
        saved = r;
      }}
    />,
  );
  assert.ok(screen.getByRole("heading", { name: /A. Chi phí vật tư/ }));
  assert.ok(
    screen.getByRole("heading", { name: "B. Chi phí liên quan", exact: true }),
  );
  assert.equal(screen.queryByText("Diễn giải / ghi chú"), null);
  fireEvent.change(screen.getByRole("textbox", { name: "Ghi chú dòng 1" }), {
    target: { value: "Ghi chú riêng vật tư & kiểm tra" },
  });
  await screen.findByRole("option", { name: "8%" });
  fireEvent.click(
    screen.getByRole("button", { name: "Thêm chi phí", exact: true }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Số tiền chi phí 1" }), {
    target: { value: "1.000" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "VAT chi phí 1" }), {
    target: { value: "8" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await waitFor(() => assert.ok(saved));
  assert.equal(saved!.draft.lines[0].notes, "Ghi chú riêng vật tư & kiểm tra");
  assert.equal(saved!.draft.related_cost_items?.[0].amount, "1000");
  assert.equal(saved!.totals.net, p.record.totals.net! + 1000);
  assert.equal(saved!.totals.vat, p.record.totals.vat! + 80);
  assert.equal(
    (await p.documents.stock(draft.lines[0].part_id, draft.warehouse_id))
      .value_vnd,
    saved!.totals.net,
  );
  mounted.unmount();
  render(
    <DocumentEditor
      kind="receipt"
      record={saved}
      api={p.catalog}
      documents={p.documents}
      canEdit={false}
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  assert.equal(
    (
      screen.getByRole("textbox", {
        name: "Ghi chú dòng 1",
      }) as HTMLInputElement
    ).disabled,
    true,
  );
  assert.equal(
    (
      screen.getByRole("textbox", {
        name: "Số tiền chi phí 1",
        exact: true,
      }) as HTMLInputElement
    ).disabled,
    true,
  );
});
test("receipt Excel and print include B costs, line notes and separate total VAT", async () => {
  const { buildReceiptWorkbook } =
    await import("../src/documents/receiptExcel");
  const { ReceiptPrintCosts } =
    await import("../src/documents/ReceiptPrintCosts");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { emptyReceiptCosts } = await import("../shared/receiptCosts");
  const p = await example();
  p.record.draft.related_costs = {
    ...emptyReceiptCosts(),
    transport: "1000",
    vat: "80",
  };
  p.record.draft.lines[0].notes = "Thay lốp cầu sau";
  p.record.totals = draftTotals(p.record.draft);
  const rows = await (
    await import("read-excel-file/node")
  ).readSheet(Buffer.from(buildReceiptWorkbook(p.record)), "Phiếu nhập");
  assert.ok(rows.some((r) => r.includes("Thay lốp cầu sau")));
  assert.ok(rows.some((r) => r[0] === "Chi phí vận chuyển" && r[1] === 1000));
  assert.ok(
    rows.some(
      (r) =>
        r[0] === "C. Tổng giá trị nhập kho (A+B)" &&
        r[1] === p.record.totals.net,
    ),
  );
  const html = renderToStaticMarkup(<ReceiptPrintCosts row={p.record} />);
  assert.match(html, /B. Chi phí liên quan/);
  assert.match(html, /Tổng thuế GTGT/);
});

test("receipt header sorting sends server order without recalculating filter totals", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example();
  const row = (await p.documents.list({ kind: "receipt" })).data[0];
  const calls: import("../src/documents/documentClient").ListDocuments[] = [];
  const totals = {
    count: 1,
    quantity_milli: "2000",
    units: ["cái"],
    net: "300000",
    vat: "24000",
    gross: "324000",
    status_counts: { posted: 1, cancelled: 0 },
  };
  const client = {
    ...p.documents,
    list: async (
      o: import("../src/documents/documentClient").ListDocuments,
    ) => {
      calls.push(o);
      return {
        data: [row],
        ...(o.includeTotals === false ? {} : { receipt_totals: totals }),
        pagination: {
          page: o.page ?? 1,
          page_size: o.pageSize ?? 20,
          total: 1,
        },
      };
    },
  };
  render(
    <DocumentList
      kind="receipt"
      api={p.catalog}
      documents={client}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByRole("button", { name: row.code });
  assert.equal(
    screen
      .getByRole("columnheader", { name: "Ngày CT", exact: true })
      .getAttribute("aria-sort"),
    "descending",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Số phiếu", exact: true }),
  );
  await waitFor(() => assert.equal(calls.at(-1)?.sort, "code"));
  assert.equal(calls.at(-1)?.direction, "asc");
  assert.equal(calls.at(-1)?.includeTotals, false);
  await screen.findByRole("button", { name: row.code });
  fireEvent.click(
    screen.getByRole("button", { name: "Số phiếu", exact: true }),
  );
  await waitFor(() => assert.equal(calls.at(-1)?.direction, "desc"));
  await screen.findByRole("button", { name: row.code });
  fireEvent.click(
    screen.getByRole("button", { name: "Tiền hàng (sau VAT)", exact: true }),
  );
  await waitFor(() => assert.equal(calls.at(-1)?.sort, "gross"));
  assert.equal(calls.at(-1)?.includeTotals, false);
  assert.equal(document.querySelector("tfoot"), null);
  assert.ok(screen.getByRole("option", { name: "Tất cả", exact: true }));
  assert.ok(screen.getByText("Tổng sau VAT (đ)"));
});

test("dynamic receipt costs calculate VAT per item and retain exact formatted read-only prices", async () => {
  const { parseReceiptCostItems, receiptExtraTotals } =
    await import("../shared/receiptCosts");
  const { formatViNumber } = await import("../shared/documentNumbers");
  const items = parseReceiptCostItems([
    {
      id: "c1",
      type: "transport",
      name: "Vận chuyển",
      amount: "1500000",
      vat_rate: "8",
    },
    {
      id: "c2",
      type: "unloading",
      name: "Bốc dỡ",
      amount: "300000",
      vat_rate: "10",
    },
  ]);
  assert.deepEqual(receiptExtraTotals(undefined, items), {
    net: 1800000,
    vat: 150000,
    gross: 1950000,
  });
  assert.equal(formatViNumber("3405555,56"), "3.405.555,56");
  assert.equal(
    formatViNumber("3405555,123456789012"),
    "3.405.555,123456789012",
  );
  assert.throws(
    () => parseReceiptCostItems([{ ...items[0], type: "other", name: "" }]),
    /tên chi phí cụ thể/,
  );
  assert.throws(() => parseReceiptCostItems([items[0], items[0]]), /trùng/);
  const { ReceiptPriceInput } =
    await import("../src/documents/ReceiptPriceInput");
  render(
    <ReceiptPriceInput
      item={{ ...emptyLine(), unit_price: "3405555,56" }}
      index={0}
      disabled={true}
      view={true}
      onChange={() => {}}
    />,
  );
  assert.equal(
    (
      screen.getByRole("textbox", {
        name: "Đơn giá dòng 1",
      }) as HTMLInputElement
    ).value,
    "3.405.555,56",
  );
});

test("VAT loader sends numeric active filter through the real catalog client", async () => {
  const { createCatalogClient } = await import("../src/api/catalogClient");
  const { useVatRates, VatSelect } = await import("../src/documents/VatSelect");
  const urls: string[] = [];
  const api = createCatalogClient((async (input) => {
    const url = new URL(String(input), "http://localhost");
    urls.push(url.toString());
    if (url.searchParams.get("is_active") !== "1")
      return new Response(
        JSON.stringify({ error: { message: "is_active phải là 0 hoặc 1." } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    return new Response(
      JSON.stringify({
        data: [0, 5, 8, 10].map((rate) => ({
          id: "vat-" + rate,
          version: 1,
          code: "VAT" + rate,
          name: rate + "%",
          rate_pct: rate,
          is_active: 1,
        })),
        pagination: { page: 1, page_size: 100, total: 4 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch);
  function Harness() {
    const catalog = useVatRates(api, true);
    return (
      <>
        <VatSelect
          label="VAT thử"
          value="0"
          onChange={() => {}}
          disabled={false}
          {...catalog}
        />
        {catalog.error && <p role="alert">{catalog.error}</p>}
      </>
    );
  }
  render(<Harness />);
  await waitFor(() =>
    assert.equal(
      screen
        .getByRole("combobox", { name: "VAT thử" })
        .querySelectorAll("option").length,
      4,
    ),
  );
  assert.equal(screen.queryByRole("alert"), null);
  assert.equal(
    (screen.getByRole("combobox", { name: "VAT thử" }) as HTMLSelectElement)
      .disabled,
    false,
  );
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes("/api/vat-rates?"));
});

test("receipt invoice numbers pad to eight digits and reject non-digit or excessive values", async () => {
  const { normalizeInvoiceNumber } = await import("../shared/invoiceNumber");
  assert.equal(normalizeInvoiceNumber("567"), "00000567");
  assert.equal(normalizeInvoiceNumber("00000567"), "00000567");
  assert.equal(normalizeInvoiceNumber("12345678"), "12345678");
  assert.equal(normalizeInvoiceNumber(""), "");
  const { record } = await example();
  const draft = record.draft;
  draft.invoice_number = "567";
  assert.equal(parseDraft(draft).invoice_number, "00000567");
  for (const bad of ["123456789", "1.234", "12,5", "-1", "1e3", "ABC"]) {
    draft.invoice_number = bad;
    assert.throws(() => parseDraft(draft), /Số hóa đơn/);
  }
});

test("receipt invoice date validates real dates, round-trips and appears beside the renamed invoice field", async () => {
  const { record, catalog, documents } = await example();
  record.draft.invoice_date = "2026-10-20";
  assert.equal(parseDraft(record.draft).invoice_date, "2026-10-20");
  for (const bad of ["2026-02-30", "20/10/2026", "invalid"]) {
    assert.throws(
      () => parseDraft({ ...record.draft, invoice_date: bad }),
      /Ngày hóa đơn/,
    );
  }
  const { invoice_date, ...legacy } = record.draft;
  assert.equal(parseDraft(legacy).invoice_date, "");
  let saved: any;
  render(
    <DocumentEditor
      kind="receipt"
      record={record}
      api={catalog}
      documents={{
        ...documents,
        save: async (draft) => {
          saved = draft;
          return { ...record, draft };
        },
      }}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  assert.equal(screen.queryByLabelText("Số hóa đơn / tham chiếu"), null);
  assert.ok(screen.getByLabelText("Số hóa đơn"));
  const date = screen.getByRole("textbox", { name: "Ngày hóa đơn" });
  assert.equal((date as HTMLInputElement).value, "20/10/2026");
  fireEvent.change(date, { target: { value: "21/10/2026" } });
  fireEvent.change(screen.getByLabelText("Lý do sửa *"), {
    target: { value: "Bổ sung ngày hóa đơn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  await waitFor(() => assert.equal(saved?.invoice_date, "2026-10-21"));
  const { buildReceiptWorkbook } =
    await import("../src/documents/receiptExcel");
  const { readSheet } = await import("read-excel-file/node");
  const rows = await readSheet(
    Buffer.from(buildReceiptWorkbook({ ...record, draft: saved })),
    "Phiếu nhập",
  );
  assert.ok(
    rows.some((row) => row[0] === "Ngày hóa đơn" && row[1] === "21/10/2026"),
  );
});

test("receipt print matches company form, separates goods costs VAT and prints every serial as a separate goods row", async () => {
  const { ReceiptPrint } = await import("../src/documents/ReceiptPrint");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { record } = await example();
  record.status = "posted";
  record.draft.invoice_number = "567";
  record.draft.invoice_date = "2026-10-20";
  const line = record.draft.lines[0];
  line.quantity = "50";
  line.unit_price = "100000";
  line.vat_rate = "8";
  line.serials = Array.from(
    { length: 50 },
    (_, i) => "SN" + String(i + 1).padStart(14, "0"),
  );
  line.serial = "";
  line.notes = "Nhập thay thế";
  record.labels["tax:suppliers:" + record.draft.supplier_id] = "0012345678";
  record.labels["address:suppliers:" + record.draft.supplier_id] = "12 Đường A";
  record.labels["province:suppliers:" + record.draft.supplier_id] =
    "Thành phố Hồ Chí Minh";
  record.draft.related_cost_items = [
    {
      id: "cost-print",
      type: "transport",
      name: "Vận chuyển",
      amount: "1500000",
      vat_rate: "8",
    },
  ];
  record.totals = draftTotals(record.draft);
  const html = renderToStaticMarkup(<ReceiptPrint row={record} />);
  for (const text of [
    "0303955513",
    "PHIẾU NHẬP VẬT TƯ – THIẾT BỊ",
    "00000567",
    "20/10/2026",
    "0012345678",
    "12 Đường A",
    "Người lập phiếu",
    "Người giao hàng",
    "Thủ kho",
    "Kế toán",
    "6.500.000",
    "520.000",
    "7.020.000",
    "Nhập thay thế",
  ])
    assert.ok(html.includes(text), text);
  const { receiptPrintRows } = await import("../src/documents/ReceiptPrint");
  const printed = receiptPrintRows(record.draft);
  assert.equal(printed.length, 50);
  assert.ok(printed.every((p) => p.quantity === "1" && p.serials.length === 1));
  assert.equal(
    printed.reduce((n, p) => n + (p.net ?? 0), 0),
    5000000,
  );
  assert.equal(
    printed.reduce((n, p) => n + (p.vat ?? 0), 0),
    400000,
  );
  assert.ok(!html.includes("PHỤ LỤC"));
  assert.ok(!html.includes("receipt-table-reference"));
  const { receiptPrintCss } = await import("../src/documents/ReceiptPrint");
  assert.ok(receiptPrintCss.includes("size:A4 portrait"));
  for (const serial of line.serials) assert.ok(html.includes(serial));
  line.quantity = "30";
  line.unit_price = "3.333333333333";
  line.serials = line.serials.slice(0, 30);
  const split = receiptPrintRows(record.draft);
  assert.equal(split.length, 30);
  assert.equal(
    split.reduce((n, p) => n + (p.net ?? 0), 0),
    100,
  );
  assert.equal(
    split.reduce((n, p) => n + (p.vat ?? 0), 0),
    8,
  );
  assert.ok(split.some((p) => p.rounding));
  assert.ok(!html.includes("CHƯA GHI SỔ"));
  record.status = "cancelled";
  assert.ok(
    renderToStaticMarkup(<ReceiptPrint row={record} />).includes(
      "PHIẾU ĐÃ HỦY",
    ),
  );
});

test("issue list shares compact stock layout without receipt-only fields and uses server filter totals", async () => {
  const { DocumentList } = await import("../src/documents/DocumentList");
  const p = await example(),
    base = (await p.documents.list({ kind: "receipt" })).data[0];
  const row = {
    ...base,
    kind: "issue" as const,
    code: "10.26.00001/PX",
    partner_label: "Tài xế nhận hàng",
    status: "posted" as const,
    can_modify: false,
    totals: { net: 100, vat: 0, gross: 100 },
  };
  const calls: any[] = [];
  let gets = 0;
  const client = {
    ...p.documents,
    list: async (options) => {
      calls.push(options);
      return {
        data: [row],
        receipt_totals: {
          count: 1,
          net: "100",
          vat: "0",
          gross: "100",
          quantity_milli: "1000",
          units: ["Cái"],
          status_counts: { posted: 1, cancelled: 0 },
        },
        pagination: {
          page: options.page ?? 1,
          page_size: options.pageSize ?? 20,
          total: 1,
        },
      };
    },
    get: async () => {
      gets++;
      return {
        ...p.record,
        code: row.code,
        status: "posted" as const,
        draft: { ...p.record.draft, kind: "issue" as const },
      };
    },
  };
  render(
    <DocumentList
      kind="issue"
      api={p.catalog}
      documents={client}
      user={user}
      createToken={0}
    />,
  );
  await screen.findByRole("button", { name: row.code });
  assert.equal(calls[0].pageSize, 20);
  assert.ok(calls[0].from);
  for (const label of [
    "Nhà cung cấp",
    "Số hóa đơn",
    "Tiền VAT",
    "Tiền hàng (trước VAT)",
  ])
    assert.equal(
      screen.queryByRole("columnheader", { name: label, exact: true }),
      null,
    );
  assert.ok(screen.getByRole("columnheader", { name: "Người nhận" }));
  assert.ok(screen.getByRole("columnheader", { name: "Giá trị xuất (đ)" }));
  const tr = screen.getByRole("button", { name: row.code }).closest("tr")!;
  fireEvent.click(tr);
  assert.equal(gets, 0);
  fireEvent.click(
    screen.getByRole("button", { name: "Bộ lọc khác", exact: true }),
  );
  assert.equal(screen.queryByRole("combobox", { name: "Nhà cung cấp" }), null);
  fireEvent.click(screen.getByRole("button", { name: "Xong", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Xem " + row.code }));
  await screen.findByRole("dialog");
  assert.equal(gets, 1);
  assert.equal(screen.queryByLabelText("Số hóa đơn"), null);
  assert.equal(screen.queryByText("B. Chi phí liên quan"), null);
});

test("issue stock refreshes on warehouse and state changes and ignores stale requests", async () => {
  const { PartStock } = await import("../src/documents/PartStock");
  const p = await preview();
  const calls: any[] = [];
  let firstResolve: any;
  const docs = {
    ...p.documents,
    stock: async (part, warehouse, signal, exclude, state) => {
      calls.push({ part, warehouse, state });
      if (warehouse === "A")
        return new Promise<any>((resolve) => (firstResolve = resolve));
      return {
        quantity_milli: state === "recovered" ? 2000 : 5000,
        value_vnd: 500,
      };
    },
  };
  const view = render(
    <PartStock
      partId="part"
      warehouseId="A"
      documents={docs}
      stockState="new"
      label="Tồn hiện tại"
    />,
  );
  await waitFor(() => assert.equal(calls.length, 1));
  view.rerender(
    <PartStock
      partId="part"
      warehouseId="B"
      documents={docs}
      stockState="new"
      label="Tồn hiện tại"
    />,
  );
  await screen.findByText("Tồn hiện tại: 5");
  firstResolve({ quantity_milli: 99000, value_vnd: 9900 });
  await waitFor(() => assert.ok(screen.getByText("Tồn hiện tại: 5")));
  view.rerender(
    <PartStock
      partId="part"
      warehouseId="B"
      documents={docs}
      stockState="recovered"
      label="Tồn hiện tại"
    />,
  );
  await screen.findByText("Tồn hiện tại: 2");
  assert.equal(calls.at(-1).state, "recovered");
});

test("issue serial drawer chooses in-stock serials and blocks those selected on another line", async () => {
  const { IssueSerialPicker } =
    await import("../src/documents/IssueSerialPicker");
  const p = await preview();
  let selected: string[] = [];
  function Harness() {
    const [values, setValues] = React.useState<string[]>([]);
    return (
      <IssueSerialPicker
        documents={{
          ...p.documents,
          availableSerials: async () => ({
            data: [{ serial_number: "FREE001" }, { serial_number: "USED001" }],
            pagination: { page: 1, page_size: 25, total: 2 },
          }),
        }}
        part="part"
        warehouse="warehouse"
        state="new"
        quantity="1"
        values={values}
        used={["USED001"]}
        label="Lốp xe"
        disabled={false}
        onChange={(v) => {
          selected = v;
          setValues(v);
        }}
        onClose={() => {}}
      />
    );
  }
  render(<Harness />);
  const used = await screen.findByRole("checkbox", {
    name: "Chọn serial USED001",
  });
  assert.ok((used as HTMLInputElement).disabled);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Chọn serial FREE001" }),
  );
  assert.deepEqual(selected, ["FREE001"]);
  assert.ok(screen.getByText(/Đã chọn 1\/1/));
});

test("issue editor loads stock by selected warehouse and clears source and serial when the warehouse changes", async () => {
  const p = await preview();
  const draft = emptyDraft("issue");
  draft.warehouse_id = "wh-1";
  draft.lines[0].part_id = "part-tire";
  draft.lines[0].serials = ["OLD001"];
  draft.lines[0].source_line_id = "old-source";
  const calls: any[] = [];
  let saved: any;
  const docs = {
    ...p.documents,
    stock: async (part, warehouse, signal, exclude, state) => {
      calls.push({ part, warehouse, state });
      return {
        quantity_milli: warehouse === "wh-1" ? 3000 : 7000,
        value_vnd: 700,
      };
    },
    save: async (d) => {
      saved = d;
      return { id: "issue", version: 1, draft: d } as any;
    },
  };
  render(
    <DocumentEditor
      kind="issue"
      initialDraft={draft}
      initialLabels={{
        ["issue_amount:" + draft.lines[0].id]: "700",
        ["issue_quantity:" + draft.lines[0].id]: "1000",
        "serialized:part-tire": "1",
        "unit:part-tire": "Quả",
        "parts:part-tire": "M-RM-LOP-0001 — Lốp xe",
      }}
      api={p.catalog}
      documents={docs}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  await screen.findByText(/Tồn hiện tại: 3/);
  assert.equal(screen.getByLabelText("Đơn giá dòng 1").textContent, "700 đ");
  assert.equal(screen.getByLabelText("Thành tiền dòng 1").textContent, "700 đ");
  assert.equal(screen.queryByLabelText("ODO dòng 1"), null);
  assert.equal(screen.queryByLabelText("Giờ máy dòng 1"), null);
  assert.equal(screen.queryByLabelText("Chọn xe / thiết bị dòng 1"), null);
  fireEvent.focus(screen.getByRole("combobox", { name: "Kho xuất *" }));
  fireEvent.click(await screen.findByRole("option", { name: /KHO02/ }));
  await screen.findByText(/Tồn hiện tại: 7/);
  assert.equal(calls.at(-1).warehouse, "wh-2");
  assert.equal(screen.getByLabelText("Thành tiền dòng 1").textContent, "—");
  assert.ok(
    screen
      .getByRole("button", { name: "Serial xuất dòng 1" })
      .textContent?.includes("0/1"),
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Trạng thái hàng dòng 1" }),
    { target: { value: "recovered" } },
  );
  await waitFor(() => assert.equal(calls.at(-1).state, "recovered"));
  const purpose = screen.getByRole("combobox", {name: "Mục đích dòng 1", exact: true});
  fireEvent.change(purpose, {target:{value:"liquidation"}});
  assert.equal((purpose as HTMLSelectElement).value,"liquidation");
  fireEvent.change(screen.getByRole("combobox", {name:"Trạng thái hàng dòng 1"}), {target:{value:"new"}});
  assert.equal((purpose as HTMLSelectElement).value,"use");
  assert.equal((screen.getByRole("option",{name:"Thanh lý",exact:true}) as HTMLOptionElement).disabled,true);
  const headers=Array.from(purpose.closest("table")!.querySelectorAll("th")).map(el=>el.textContent);
  assert.deepEqual(headers.slice(4,9),["Đơn giá","Thành tiền","Serial","Vị trí lắp","Mục đích"]);

  assert.ok(screen.getByLabelText("Đơn giá dòng 1"));
  assert.equal(screen.queryByLabelText("VAT % dòng 1"), null);
  assert.equal(screen.queryByRole("combobox", { name: "Nguồn nhập" }), null);
  for (const label of [
    "Đơn giá dòng 1",
    "Vị trí lắp dòng 1",
    "Thành tiền dòng 1",
    "Ghi chú dòng 1",
  ]) {
    const input = screen.getByLabelText(label);
    assert.equal(
      input.closest("tr"),
      screen.getByRole("textbox", { name: "Số lượng dòng 1" }).closest("tr"),
    );
    assert.ok(input.closest("td")?.className.includes("align-top"));
  }
});

test("issue print and Excel include recipient and equipment rather than invoice VAT or related costs", async () => {
  const { record } = await example();
  record.draft.kind = "issue";
  record.draft.recipient = "Tài xế A";
  record.totals = { net: 12345, vat: 0, gross: 12345 };
  record.code = "10.26.00001/PX";
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { IssuePrint } = await import("../src/documents/IssuePrint");
  const html = renderToStaticMarkup(<IssuePrint row={record} />);
  assert.ok(html.includes("PHIẾU XUẤT"));
  assert.ok(html.includes("Tài xế A"));
  assert.ok(!html.includes("Số hóa đơn"));
  assert.ok(!html.includes("Thuế GTGT"));
  assert.ok(!html.includes("Chi phí liên quan"));
  const { buildIssueListWorkbook, buildIssueWorkbook } =
    await import("../src/documents/issueExcel");
  const { readSheet } = await import("read-excel-file/node");
  const rows = await readSheet(
    Buffer.from(buildIssueWorkbook(record)),
    "Phiếu xuất",
  );
  assert.ok(rows.some((r) => r[0] === "Người nhận" && r[1] === "Tài xế A"));
  const summary = {
    ...(await (await preview()).documents.list({ kind: "receipt" })).data[0],
    kind: "issue" as const,
    code: record.code,
    partner_label: "Tài xế A",
  };
  const list = await readSheet(
    Buffer.from(buildIssueListWorkbook([summary])),
    "Phiếu xuất",
  );
  assert.equal(list[1][3], "Người nhận");
  assert.ok(!list[1].includes("Tiền VAT"));
});

test("issue header derives department and vehicle group, retains editable usage fields and saves the snapshot", async () => {
  const { IssueHeader } = await import("../src/documents/IssueHeader");
  const { emptyIssueDetails } = await import("../shared/issueDetails");
  const p = await preview();
  let saved: any;
  const docs = {
    ...p.documents,
    issueContext: async (staff, vehicle, driver) => ({
      ...emptyIssueDetails(),
      recipient_staff_id: staff,
      recipient: staff ? "Nhân viên nhận" : "",
      department_id: staff ? "dept" : "",
      department_name: staff ? "Phòng vận hành" : "",
      vehicle_id: vehicle,
      vehicle_plate: vehicle ? "50E-123.45" : "",
      vehicle_group: vehicle ? "DCANG" : "",
      driver_id: vehicle ? "driver" : "",
      driver_name: vehicle ? "Tài xế B" : "",
      odo: vehicle ? "123456" : "",
      trailer_number: vehicle ? "51R-001.23" : "",
      container_number: vehicle ? "TNCU001" : "",
    }),
  };
  const staff = (await p.catalog.list("staff", { pageSize: 25 })).data[0],
    vehicle = (await p.catalog.list("vehicles", { pageSize: 25 })).data[0];
  function Harness() {
    const [draft, setDraft] = React.useState(emptyDraft("issue"));
    saved = draft;
    return (
      <IssueHeader
        draft={draft}
        setDraft={setDraft}
        api={p.catalog}
        documents={docs}
        disabled={false}
        onBusyChange={React.useCallback(() => {}, [])}
      />
    );
  }
  render(<Harness />);
  fireEvent.focus(
    screen.getByRole("combobox", { name: "Người nhận", exact: true }),
  );
  fireEvent.click(
    await screen.findByRole("option", { name: new RegExp(String(staff.code)) }),
  );
  await waitFor(() =>
    assert.equal(
      (
        screen.getByRole("textbox", {
          name: "Bộ phận nhận",
        }) as HTMLInputElement
      ).value,
      "Phòng vận hành",
    ),
  );
  assert.ok(
    (screen.getByRole("textbox", { name: "Bộ phận nhận" }) as HTMLInputElement)
      .readOnly,
  );
  fireEvent.focus(
    screen.getByRole("combobox", { name: "Biển số xe *", exact: true }),
  );
  fireEvent.click(
    await screen.findByRole("option", {
      name: new RegExp(
        String(vehicle.plate_number).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    }),
  );
  await waitFor(() =>
    assert.ok(
      (screen.getByRole("checkbox", { name: "Đường cảng" }) as HTMLInputElement)
        .checked,
    ),
  );
  assert.equal(
    (
      screen.getByRole("textbox", {
        name: "Số Km (ODO) hiện tại *",
      }) as HTMLInputElement
    ).value,
    "123456",
  );
  assert.equal(
    (screen.getByRole("textbox", { name: "Rơmooc số" }) as HTMLInputElement)
      .value,
    "51R-001.23",
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Máy phát", exact: true }), {
    target: { value: "Thiết bị phụ" },
  });
  assert.equal(saved.issue_details.other, "Thiết bị phụ");
  const d = emptyDraft("issue");
  d.warehouse_id = "wh";
  d.lines[0].part_id = "part";
  d.issue_details = { ...saved.issue_details, odo: "123456.5" };
  assert.equal(parseDraft(d).issue_details?.odo, "123456.5");
  assert.throws(
    () =>
      parseDraft({ ...d, issue_details: { ...d.issue_details, odo: "-1" } }),
    /ODO/,
  );
});

test("selecting and clearing issue recipient while lookup is pending never opens quick import", async () => {
  const p = await preview();
  const { emptyIssueDetails } = await import("../shared/issueDetails");
  const resolvers: ((v: any) => void)[] = [];
  let calls = 0;
  const docs = {
    ...p.documents,
    issueContext: async () => {
      calls++;
      return new Promise<any>((resolve) => resolvers.push(resolve));
    },
  };
  render(
    <DocumentEditor
      kind="issue"
      api={p.catalog}
      documents={docs}
      canEdit
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );
  fireEvent.focus(
    screen.getByRole("combobox", { name: "Người nhận", exact: true }),
  );
  fireEvent.click(await screen.findByRole("option", { name: /NV001/ }));
  await waitFor(() => assert.equal(calls, 1));
  assert.equal(
    screen.queryByText("Nhập nhanh dòng vật tư", { exact: true }),
    null,
  );
  assert.ok(
    (
      screen.getByRole("button", {
        name: "Lưu",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  );
  assert.ok(
    (
      screen.getByRole("button", {
        name: "Nhập nhanh dòng",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  );
  resolvers[0]({
    ...emptyIssueDetails(),
    recipient_staff_id: "staff-receiver",
    recipient: "Người nhận mẫu",
    department_name: "Bộ phận kho",
  });
  await waitFor(() =>
    assert.ok(
      !(
        screen.getByRole("button", {
          name: "Lưu",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Bỏ chọn Người nhận", exact: true }),
  );
  await waitFor(() => assert.equal(calls, 2));
  assert.equal(
    screen.queryByText("Nhập nhanh dòng vật tư", { exact: true }),
    null,
  );
  assert.ok(
    (
      screen.getByRole("button", {
        name: "Lưu",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  );
  resolvers[1]({ ...emptyIssueDetails(), recipient: "" });
  await waitFor(() =>
    assert.equal(
      (
        screen.getByRole("textbox", {
          name: "Bộ phận nhận",
          exact: true,
        }) as HTMLInputElement
      ).value,
      "",
    ),
  );
  assert.equal(
    screen.queryByText("Nhập nhanh dòng vật tư", { exact: true }),
    null,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Nhập nhanh dòng", exact: true }),
  );
  assert.ok(
    screen.getByRole("heading", {
      name: "Nhập nhanh dòng vật tư",
      exact: true,
    }),
  );
});

test("choosing and clearing issue driver refreshes vehicle and ODO without retaining the previous vehicle", async () => {
 const {IssueHeader}=await import("../src/documents/IssueHeader");
 const p=await preview();
 function Harness(){
  const [draft,setDraft]=React.useState(emptyDraft("issue"));
  return <IssueHeader draft={draft} setDraft={setDraft} api={p.catalog} documents={p.documents} disabled={false} onBusyChange={React.useCallback(()=>{},[])}/>;
 }
 render(<Harness/>);
 fireEvent.focus(screen.getByRole("combobox",{name:"Họ tên lái xe *",exact:true}));
 fireEvent.click(await screen.findByRole("option",{name:/Tài xế/}));
 await waitFor(()=>assert.ok((screen.getByRole("combobox",{name:"Biển số xe *",exact:true}) as HTMLInputElement).value));
 assert.equal((screen.getByLabelText("Số Km (ODO) hiện tại *") as HTMLInputElement).value,"123456");
 const clear=screen.getAllByRole("button",{name:"Bỏ chọn Họ tên lái xe *",exact:true});
 assert.ok(clear.length);
 fireEvent.click(clear[0]);
 await waitFor(()=>assert.equal((screen.getByRole("combobox",{name:"Biển số xe *",exact:true}) as HTMLInputElement).value,""));
 assert.equal((screen.getByLabelText("Số Km (ODO) hiện tại *") as HTMLInputElement).value,"");
});

test("issue material picker always sends warehouse and stock state, refreshes scope and shows quantities", async()=>{
 const {CatalogPicker}=await import("../src/documents/CatalogPicker");
 const calls: Array<{warehouse_id?:string;stock_state?:string;page?:number}>=[];
 const p=await preview();
 const api={...p.catalog,list:async(resource,options)=>{
  calls.push(options);
  return {data:[{id:"stock-part",version:1,sku:"STOCK",name:options.stock_state==="new"?"Hàng mới":"Hàng thu hồi",unit:"Cái",current_stock_milli:options.stock_state==="new"?2500:1000}],pagination:{page:1,page_size:25,total:1}};
 }};
 const props={api,resource:"parts" as const,label:"Vật tư xuất",value:"",onChange:()=>{}};
 const {rerender}=render(<CatalogPicker {...props} warehouseId="wh-1" stockState="new"/>);
 fireEvent.focus(screen.getByRole("combobox",{name:"Vật tư xuất"}));
 await screen.findByRole("option",{name:/Tồn: 2,5 Cái/});
 assert.equal(calls.at(-1)?.warehouse_id,"wh-1");assert.equal(calls.at(-1)?.stock_state,"new");
 rerender(<CatalogPicker {...props} warehouseId="wh-2" stockState="recovered"/>);
 await screen.findByRole("option",{name:/Hàng thu hồi.*Tồn: 1 Cái/});
 assert.equal(calls.at(-1)?.warehouse_id,"wh-2");assert.equal(calls.at(-1)?.stock_state,"recovered");
});

test("issue price cells load before save, refresh quantity, and discard stale quotes",async()=>{
 const {IssueCostCells}=await import("../src/documents/IssueCostCells");
 const p=await preview();
 let release:(value:{amount_vnd:number;unit_price_vnd_milli:number})=>void=()=>{};
 const calls:string[]=[];
 const docs={...p.documents,issuePrice:async(input)=>{
  calls.push(input.quantity);
  if(input.quantity==='1')return new Promise<{amount_vnd:number;unit_price_vnd_milli:number}>(resolve=>{release=resolve;});
  return {amount_vnd:400,unit_price_vnd_milli:200000};
 }};
 const item=emptyLine();item.part_id='stock';item.quantity='1';
 const props={item,index:0,warehouse:'wh-1',documents:docs,saved:false,serialized:false};
 const {rerender}=render(<table><tbody><tr><IssueCostCells {...props}/></tr></tbody></table>);
 await waitFor(()=>assert.equal(calls.length,1));
 rerender(<table><tbody><tr><IssueCostCells {...props} item={{...item,quantity:'2'}}/></tr></tbody></table>);
 await waitFor(()=>assert.equal(screen.getByLabelText('Thành tiền dòng 1').textContent,'400 đ'));
 release({amount_vnd:999,unit_price_vnd_milli:999000});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(screen.getByLabelText('Đơn giá dòng 1').textContent,'200 đ');assert.equal(screen.getByLabelText('Thành tiền dòng 1').textContent,'400 đ');
});

test("table import maps headers regardless of order, preserves comma decimals and quoted cells, rejects ambiguous headers",async()=>{
 const {parseQuickTable,quickTableText}=await import("../shared/quickImportTable");
 assert.deepEqual(parseQuickTable('Ghi chú\tĐơn giá\tMã vật tư\tSố lượng\n"A, B\nC"\t150.000,5\t000123\t1,5','receipt'),[{notes:'A, B\nC',unit_price:'150.000,5',sku:'000123',quantity:'1,5'}]);
 assert.throws(()=>parseQuickTable('Mã vật tư\tSố lượng\nVT01\t2','receipt'),/Thiếu cột.*Đơn giá/);
 assert.throws(()=>parseQuickTable('Mã vật tư\tSố lượng\tĐơn giá\tĐơn giá\nA\t1\t2\t3','receipt'),/Trùng cột/);
 assert.throws(()=>parseQuickTable('A,1,150000','receipt'),/kèm hàng tiêu đề/);
 assert.throws(()=>parseQuickTable('Mã vật tư\tSố lượng\tĐơn giá\nA\t1','receipt'),/số ô không khớp/);
 const rows=[{sku:'000123',quantity:'1,5',unit_price:'150.000,5',notes:'ghi chú, có phẩy'}];
 const roundtrip=parseQuickTable(quickTableText(rows,'receipt'),'receipt');assert.equal(roundtrip[0].sku,'000123');assert.equal(roundtrip[0].notes,'ghi chú, có phẩy');
 const sixty=Array.from({length:60},(_,i)=>({sku:'VT'+i,quantity:'1',unit_price:'2'}));assert.equal(parseQuickTable(quickTableText(sixty,'receipt'),'receipt').length,60);
 assert.throws(()=>parseQuickTable(quickTableText([...sixty,sixty[0]],'receipt'),'receipt'),/60 dòng/);
});
test("quick import copies values with headers and invalidates preview when pasted headings are missing",async()=>{
 const p=await preview();let copied='';
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 try{
  render(<DocumentQuickImport api={p.catalog} kind="receipt" onApply={()=>{}} onClose={()=>{}}/>);
  fireEvent.paste(screen.getByLabelText('Mã vật tư nhập nhanh dòng 1'),{clipboardData:{getData:()=>"Đơn giá\tMã vật tư\tSố lượng\n150.000\tM-IN-TDONG-0001\t2"}});
  assert.equal((screen.getByLabelText('Đơn giá nhập nhanh dòng 1') as HTMLInputElement).value,'150.000');
  fireEvent.click(screen.getByRole('button',{name:'Sao chép bảng kèm tiêu đề'}));
  await waitFor(()=>assert.ok(copied.startsWith('Mã vật tư\tSố lượng\tĐơn giá')));assert.ok(copied.includes('M-IN-TDONG-0001\t2\t150.000'));
  fireEvent.click(screen.getByRole('button',{name:'Xem trước'}));await screen.findByText('150000');
  fireEvent.paste(screen.getByLabelText('Mã vật tư nhập nhanh dòng 1'),{clipboardData:{getData:()=>"M-IN-TDONG-0001\t2\t150.000"}});
  await screen.findByRole('alert');assert.equal((screen.getByRole('button',{name:'Thêm vào phiếu'}) as HTMLButtonElement).disabled,true);
 }finally{if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else Reflect.deleteProperty(navigator,'clipboard');}
});

test("mount position options display tractor or trailer before position name",async()=>{
 const {CatalogPicker}=await import("../src/documents/CatalogPicker");
 const p=await preview();const api={...p.catalog,list:async()=>({data:[{id:'pos',version:1,code:'T1TT',name:'Trục 1 Trái Trong',notes:'Rơ moóc'}],pagination:{page:1,page_size:25,total:1}})};
 render(<CatalogPicker api={api} resource="mount-positions" label="Chọn vị trí lắp" value="" onChange={()=>{}}/>);
 fireEvent.focus(screen.getByRole('combobox',{name:'Chọn vị trí lắp'}));
 await screen.findByRole('option',{name:'T1TT — Rơ moóc – Trục 1 Trái Trong'});
});

test("receipt and issue date fields accept explicit local time and reject invalid times",async()=>{
 const {documentDateTime,parseDocumentDateTime}=await import("../src/documents/documentFormatting");
 assert.equal(documentDateTime('2026-10-10T23:07'),'10/10/2026 23:07');
 assert.equal(parseDocumentDateTime('10/10/2026 23:07'),'2026-10-10T23:07');
 for(const bad of ['10/10/2026','10/10/2026 24:00','10/10/2026 23:60','31/04/2026 12:00'])assert.equal(parseDocumentDateTime(bad),'');
 const {DocumentDateInput}=await import("../src/documents/DocumentDateInput");let value='';
 render(<DocumentDateInput label="Ngày giờ thử" withTime value="2026-10-10T23:07" onChange={v=>{value=v;}}/>);
 const input=screen.getByLabelText('Ngày giờ thử') as HTMLInputElement;assert.equal(input.value,'10/10/2026 23:07');
 fireEvent.change(input,{target:{value:'11/10/2026 00:15'}});assert.equal(value,'2026-10-11T00:15');
 fireEvent.change(input,{target:{value:'11/10/2026 24:00'}});assert.equal(value,'');assert.equal(input.checkValidity(),false);
});

test("issue print follows company form with exact serial costs eleven columns and five signatures",async()=>{
 const {IssuePrint,issuePrintRows}=await import("../src/documents/IssuePrint");const {renderToStaticMarkup}=await import("react-dom/server");
 const {record}=await example();record.draft.kind='issue';record.status='posted';record.draft.business_at='2026-10-10T23:08';record.totals={net:400,vat:0,gross:400};
 const l=record.draft.lines[0];l.quantity='2';l.serial='';l.serials=['CHEAP','COSTLY'];l.to_position='Rơ moóc – Trục 1 Trái Trong';
 record.labels['issue_amount:'+l.id]='400';record.labels['issue_unit_price:'+l.id]='200000';record.labels['issue_serial_costs:'+l.id]=JSON.stringify([{serial:'CHEAP',unit_price_vnd_milli:100000,amount_vnd:100},{serial:'COSTLY',unit_price_vnd_milli:300000,amount_vnd:300}]);
 const rows=issuePrintRows(record);assert.deepEqual(rows.map(r=>r.amount),[100,300]);assert.deepEqual(rows.map(r=>r.price),[100,300]);
 const html=renderToStaticMarkup(<IssuePrint row={record}/>);const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelectorAll('thead th').length,11);assert.equal(doc.querySelectorAll('.receipt-signatures>div').length,5);
 for(const text of ['PHIẾU XUẤT KHO VẬT TƯ','Vật tư TB thay thế','Người giao hàng','Người nhận','Trưởng bộ phận','10/10/2026 23:08','Rơ moóc – Trục 1 Trái Trong'])assert.ok(doc.body.textContent?.includes(text),text);
 assert.ok(!html.includes('GTGT'));assert.ok(!html.includes('Giờ máy'));assert.equal(doc.querySelectorAll('[data-serial-row]').length,2);
 l.serials=['A','B','C'];l.quantity='3';record.labels['issue_amount:'+l.id]='100';delete record.labels['issue_serial_costs:'+l.id];assert.equal(issuePrintRows(record).reduce((sum,r)=>sum+(r.amount??0),0),100);
});


test("recovery assessment accepts Vietnamese percentages and validates classes and range",async()=>{
 const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");
 const draft=emptyDraft("recovery");draft.warehouse_id="wh";draft.lines[0].part_id="part";draft.recovery_details=emptyRecoveryDetails();draft.lines[0].recovery_classification="CSC";draft.lines[0].recovery_quality_percent="40,25";draft.recovery_details.odo="1.234.567";
 const parsed=parseDraft(normalizeDraftInput(draft));assert.equal(parsed.lines[0].recovery_quality_percent,"40.25");assert.equal(parsed.recovery_details?.odo,"1234567");
 for(const percent of ["101","-1","20.123",""]){assert.throws(()=>parseDraft({...parsed,lines:[{...parsed.lines[0],recovery_quality_percent:percent}]}));}
 assert.throws(()=>parseDraft({...parsed,lines:[{...parsed.lines[0],recovery_classification:"CTL"}]}));
 for(const percent of ["0","100"])assert.equal(parseDraft({...parsed,lines:[{...parsed.lines[0],recovery_quality_percent:percent}]}).lines[0].recovery_quality_percent,percent);
 const {quickTableText,parseQuickTable}=await import("../shared/quickImportTable");const table=quickTableText([{sku:"VT001",quantity:"1",recovery_classification:"CSC",recovery_quality_percent:"40,25"}],"recovery");assert.equal(parseQuickTable(table,"recovery")[0].recovery_quality_percent,"40,25");
});

test("recovery form refreshes lifetime valuation and maps liquidation classification without opening import",async()=>{
 const {record,catalog,documents}=await example();const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");record.draft.kind="recovery";record.status="draft";record.draft.recovery_details={...emptyRecoveryDetails(),odo:"700"};record.draft.business_at="2026-10-26T09:00";const line=record.draft.lines[0];Object.assign(line,{stock_state:"recovered",usage_id:"usage-one",quantity:"1",unit_price:"",serial:"",serials:[],recovery_classification:"CSD",recovery_quality_percent:"40"});
 const quotes:string[]=[];const docs={...documents,sources:async()=>({data:[{id:"usage-one",code:"PX001",target_label:"50H-110.99",position:"Đầu kéo – Sau Trái Trong",quantity_milli:1000}],pagination:{page:1,page_size:25,total:1}}),recoveryPrice:async(input:{odo:string})=>{quotes.push(input.odo);const percent=Math.max(0,100-(Number(input.odo)-100)/10);const amount=Math.round(12345*percent/100);return{base_vnd:12345,amount_vnd:amount,unit_price_vnd_milli:amount*1000,remaining_percent:String(percent)};}};
 render(<DocumentEditor kind="recovery" record={record} api={catalog} documents={docs} canEdit onClose={()=>{}} onSaved={()=>{}}/>);
 await waitFor(()=>assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("4.938")));
 assert.ok(!(screen.getByRole("textbox",{name:"Chất lượng còn lại (%) dòng 1"})as HTMLInputElement).disabled);fireEvent.change(screen.getByRole("textbox",{name:"Chất lượng còn lại (%) dòng 1"}),{target:{value:"50"}});assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("4.938"));
 fireEvent.change(screen.getByRole("textbox",{name:"ODO tháo dòng 1"}),{target:{value:"600"}});await waitFor(()=>assert.ok(quotes.includes("600")));await waitFor(()=>assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("6.173")));assert.ok(screen.getByText("Còn 50% định mức"));
 fireEvent.change(screen.getByRole("combobox",{name:"Phân loại thu hồi dòng 1"}),{target:{value:"CTL"}});assert.ok((screen.getByRole("checkbox",{name:"Chờ thanh lý (CTL)"})as HTMLInputElement).checked);
 assert.equal(screen.queryByRole("heading",{name:"Nhập nhanh dòng vật tư"}),null);assert.ok(screen.getByRole("textbox",{name:"Người bàn giao"}));assert.ok(screen.getByRole("textbox",{name:"Lý do tháo"}));
});

test("recovery print has eleven columns four signatures classifications quality and exact distributed total",async()=>{
 const {record}=await example();const {RecoveryPrint,recoveryPrintRows}=await import("../src/documents/RecoveryPrint");const {renderToStaticMarkup}=await import("react-dom/server");const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");record.draft.kind="recovery";record.status="posted";record.draft.recovery_details={...emptyRecoveryDetails(),vehicle_plate:"50H-110.99",handover_name:"Người giao mẫu",removed_from:"Rơ moóc",odo:"1046457"};record.draft.recipient="Người nhận mẫu";record.draft.business_at="2026-10-26T14:05";record.totals={net:100,vat:0,gross:100};const line=record.draft.lines[0];Object.assign(line,{quantity:"3",serial:"",serials:["REC-A","REC-B","REC-C"],recovery_classification:"CSC",recovery_quality_percent:"40.25"});record.labels["recovery_amount:"+line.id]="100";record.labels["recovery_unit_price:"+line.id]="33333";
 const rows=recoveryPrintRows(record);assert.deepEqual(rows.map(r=>r.amount),[34,33,33]);assert.equal(rows.reduce((sum,r)=>sum+(r.amount??0),0),100);
 const doc=new JSDOM(renderToStaticMarkup(<RecoveryPrint row={record}/>)).window.document;assert.equal(doc.querySelectorAll("thead th").length,11);assert.equal(doc.querySelectorAll(".receipt-signatures>div").length,4);assert.equal(doc.querySelectorAll("[data-serial-row]").length,3);for(const text of ["PHIẾU THU HỒI VẬT TƯ","26/10/2026 14:05","40,25%","CSD","CSC","KSD","CTL","Người giao mẫu","Người nhận mẫu"])assert.ok(doc.body.textContent?.includes(text),text);assert.ok(!doc.body.textContent?.includes("VAT"));
 record.labels["recovery_serial_costs:"+line.id]=JSON.stringify([{serial:"REC-A",amount_vnd:10,unit_price_vnd_milli:10000},{serial:"REC-B",amount_vnd:30,unit_price_vnd_milli:30000},{serial:"REC-C",amount_vnd:60,unit_price_vnd_milli:60000}]);record.labels["recovery_remaining_percent:"+line.id]="50";assert.deepEqual(recoveryPrintRows(record).map(r=>r.amount),[10,30,60]);assert.deepEqual(recoveryPrintRows(record).map(r=>r.price),[10,30,60]);assert.ok(renderToStaticMarkup(<RecoveryPrint row={record}/>).includes("50"));
});


test("recovery driver selection loads current paired equipment and clearing removes stale pairings",async()=>{
 const {RecoveryHeader}=await import("../src/documents/RecoveryHeader");const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");const {emptyIssueDetails}=await import("../shared/issueDetails");const p=await preview();const calls:string[][]=[];
 const docs={...p.documents,issueContext:async(staff:string,vehicle:string,driver:string)=>{calls.push([staff,vehicle,driver]);return driver?{...emptyIssueDetails(),recipient:"",driver_id:driver,driver_name:"Tài xế hiện tại",vehicle_id:"current-vehicle",vehicle_plate:"50H-110.99",trailer_number:"51R-047.31",other:"MP126",container_number:"CONT123",odo:"1046457"}:{...emptyIssueDetails(),recipient:""};}};
 function Harness(){const[draft,setDraft]=React.useState({...emptyDraft("recovery"),recovery_details:{...emptyRecoveryDetails(),vehicle_id:"old-vehicle",vehicle_plate:"OLD",trailer_number:"OLD-R",generator_code:"OLD-G",container_number:"OLD-C"}});return <RecoveryHeader draft={draft} setDraft={setDraft} api={p.catalog} documents={docs} disabled={false} onBusyChange={React.useCallback(()=>{},[])} topFields={<span>Số / Ngày / Kho</span>}/>;}
 render(<Harness/>);fireEvent.focus(screen.getByRole("combobox",{name:"Họ tên lái xe",exact:true}));fireEvent.click(await screen.findByRole("option",{name:/Tài xế/}));await waitFor(()=>assert.equal((screen.getByLabelText("Máy phát số")as HTMLInputElement).value,"MP126"));assert.equal(calls[0][1],"");assert.ok(calls[0][2]);assert.equal((screen.getByRole("combobox",{name:"Biển số xe",exact:true})as HTMLInputElement).value,"50H-110.99");assert.equal((screen.getByLabelText("Rơmooc số")as HTMLInputElement).value,"51R-047.31");assert.equal((screen.getByLabelText("Container số")as HTMLInputElement).value,"CONT123");assert.equal((screen.getByLabelText("Số Km (ODO) hiện tại")as HTMLInputElement).value,"1046457");
 fireEvent.click(screen.getByRole("button",{name:"Bỏ chọn Họ tên lái xe",exact:true}));await waitFor(()=>assert.equal((screen.getByLabelText("Máy phát số")as HTMLInputElement).value,""));for(const label of ["Rơmooc số","Container số"])assert.equal((screen.getByLabelText(label)as HTMLInputElement).value,"");
});


test("usage lookup omits stock-only filters and sends selected vehicle context through real document client",async()=>{
 const urls:URL[]=[];const client=createDocumentClient(async(url)=>{urls.push(new URL(String(url),"https://test.invalid"));return Response.json({data:[],pagination:{page:1,page_size:25,total:0}});});
 await client.sources("usages","part-id","","",1,undefined,{vehicle_id:"vehicle-id"});assert.equal(urls[0].searchParams.get("view"),"usages");assert.equal(urls[0].searchParams.get("vehicle_id"),"vehicle-id");assert.equal(urls[0].searchParams.has("stock_state"),false);assert.equal(urls[0].searchParams.has("warehouse_id"),false);
 await client.sources("sources","part-id","warehouse-id","recovered",1);assert.equal(urls[1].searchParams.get("stock_state"),"recovered");assert.equal(urls[1].searchParams.get("warehouse_id"),"warehouse-id");
});


test("recovery chooses an installed serial directly with source identity and quantity, not general catalog",async()=>{
 const p=await preview();const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");const draft={...emptyDraft("recovery"),recovery_details:emptyRecoveryDetails()};draft.warehouse_id="wh";const source={usage_id:"source-cycle-2",root_line_id:"original-issue-line",part_id:"tire",sku:"M-DC-CBXE-0006",name:"Vỏ xe đang lắp",unit:"Cái",part_version:1,is_serialized:1,serial_number:"B65046023",target_label:"50H-110.99",position:"Rơ moóc – Trục 1 Trái Trong",code:"10.26.00001/PX",started_at:"2026-10-10T15:00",odo_milli:1046457000,hours_milli:null,quantity_milli:1000,issued_quantity_milli:1000,open_quantity_milli:1000};let queried=false;
 const docs={...p.documents,recoverySources:async()=>{queried=true;return{data:[source],pagination:{page:1,page_size:25,total:1}};}};
 render(<DocumentEditor kind="recovery" initialDraft={draft} api={p.catalog} documents={docs} canEdit onClose={()=>{}} onSaved={()=>{}}/>);fireEvent.click(screen.getByRole("button",{name:"Chọn vật tư đang sử dụng dòng 1"}));await screen.findByText("B65046023");assert.ok(queried);assert.ok(screen.getByText("10/10/2026 15:00"));fireEvent.click(screen.getByRole("button",{name:"Chọn M-DC-CBXE-0006 B65046023"}));await waitFor(()=>assert.equal(screen.queryByRole("dialog",{name:"Vật tư đang sử dụng"}),null));assert.ok(screen.getByText("Vỏ xe đang lắp"));assert.equal((screen.getByRole("textbox",{name:"Số lượng thu hồi dòng 1"})as HTMLInputElement).value,"1");assert.ok((screen.getByRole("textbox",{name:"Số lượng thu hồi dòng 1"})as HTMLInputElement).readOnly);assert.ok(screen.getByRole("button",{name:"Serial thu hồi dòng 1"}).textContent?.includes("1/1"));assert.ok(screen.getByText(/ODO lúc xuất: 1.046.457/));
});


test("unknown issue prices stay blank with a warning and do not prevent selection",async()=>{
 const {IssueCostCells}=await import("../src/documents/IssueCostCells");const p=await preview();const item=emptyLine();item.part_id="pending-part";const docs={...p.documents,issuePrice:async()=>({amount_vnd:null,unit_price_vnd_milli:null,valuation_status:"pending" as const,warning:"Thiếu dữ liệu tuổi thọ"})};render(<table><tbody><tr><IssueCostCells item={item} index={0} warehouse="wh" documents={docs} saved={false} serialized={false}/></tr></tbody></table>);await screen.findByText(/Chưa xác định giá trị/);assert.equal(screen.getByLabelText("Đơn giá dòng 1").textContent,"—");assert.ok(screen.getByLabelText("Thành tiền dòng 1").textContent?.startsWith("—"));
 const client=createDocumentClient(async()=>Response.json({data:{amount_vnd:null,unit_price_vnd_milli:null,valuation_status:"pending",warning:"Chưa có căn cứ"}}));assert.equal((await client.issuePrice!({part_id:"p",warehouse_id:"wh",stock_state:"recovered",quantity:"1",serials:[]})).amount_vnd,null);
});


test("supplier picker accepts tax search and displays tax number before choosing the supplier",async()=>{
 const {CatalogPicker,catalogLabel}=await import("../src/documents/CatalogPicker");const p=await preview();const calls:string[]=[];const supplier={id:"tax-supplier",version:1,code:"NCC00123",name:"Công ty vật tư mẫu",tax_code:"0312345678-001"};let selected="";
 const api={...p.catalog,list:async(resource,options)=>{assert.equal(resource,"suppliers");assert.equal(options.status,"1");calls.push(options.q??"");return{data:options.q==="0312345678001"?[supplier]:[],pagination:{page:1,page_size:25,total:options.q==="0312345678001"?1:0}};}};
 function Harness(){const[value,setValue]=React.useState("");const[label,setLabel]=React.useState("");return <CatalogPicker api={api} resource="suppliers" label="Nhà cung cấp" value={value} selectedLabel={label} onChange={(id,row)=>{selected=id;setValue(id);setLabel(row?catalogLabel(row):"");}}/>;}
 render(<Harness/>);const input=screen.getByRole("combobox",{name:"Nhà cung cấp",exact:true});assert.equal(input.getAttribute("placeholder"),"Tìm mã, tên hoặc mã số thuế…");fireEvent.focus(input);fireEvent.change(input,{target:{value:"0312345678001"}});const option=await screen.findByRole("option",{name:/NCC00123.*MST: 0312345678-001/});assert.ok(calls.includes("0312345678001"));fireEvent.click(option);assert.equal(selected,supplier.id);await waitFor(()=>assert.equal((input as HTMLInputElement).value,"NCC00123 — Công ty vật tư mẫu"));
});


test("opening workspace separates warehouse stock and mounted opening, saves mounted identifiers with optional price and install readings",async()=>{
 const p=await example();const requested:(string|undefined)[]=[];let saved:ReturnType<typeof emptyDraft>|undefined;const docs={...p.documents,list:async(options)=>{requested.push(options.opening_mode);return p.documents.list(options);},save:async(draft)=>{saved=draft;return{...p.record,draft,status:"posted" as const,code:"10.26.00001/SD",totals:{net:null,vat:0,gross:null}};}};
 render(<DocumentsWorkspace menu="ht_so_du_dau" api={p.catalog} documents={docs} user={user}/>);await waitFor(()=>assert.ok(requested.includes("stock")));fireEvent.click(screen.getByRole("tab",{name:"Vật tư đang sử dụng đầu kỳ"}));await waitFor(()=>assert.ok(requested.includes("in_use")));fireEvent.click(screen.getByRole("button",{name:"Lập phiếu",exact:true}));assert.ok(screen.getByRole("dialog",{name:"Lập Vật tư đang sử dụng đầu kỳ"}));assert.ok(screen.getByRole("textbox",{name:"Ngày đầu kỳ *",exact:true}));assert.equal(screen.queryByText("VAT",{exact:true}),null);assert.equal(screen.queryByRole("textbox",{name:"Đơn giá gốc dòng 1"}),null);
 assert.equal(screen.queryByRole("combobox",{name:"Kho quản lý *",exact:true}),null);assert.equal(screen.queryByLabelText("Đơn vị quản lý"),null);assert.ok(screen.getByRole("combobox",{name:"Tài xế",exact:true}));fireEvent.focus(screen.getByRole("combobox",{name:"Vật tư đầu kỳ đang dùng dòng 1"}));fireEvent.click(await screen.findByRole("option",{name:/M-RM-LOP-0001/}));assert.equal((screen.getByLabelText("Nguyên giá đầu kỳ dòng 1")as HTMLInputElement).value,"8.500.000 đ");fireEvent.focus(screen.getByRole("combobox",{name:"Đối tượng đang sử dụng dòng 1"}));fireEvent.click(await screen.findByRole("option",{name:/51R-456.78/}));fireEvent.change(screen.getByRole("textbox",{name:"Serial đầu kỳ dòng 1"}),{target:{value:"OLD-UI-OPENING"}});fireEvent.change(screen.getByLabelText("Nguyên giá đầu kỳ dòng 1"),{target:{value:"5.000.000"}});fireEvent.change(screen.getByLabelText("Tỷ lệ còn lại đầu kỳ (%) dòng 1"),{target:{value:"20"}});fireEvent.change(screen.getByLabelText("Người xác nhận đầu kỳ dòng 1"),{target:{value:"Kỹ thuật mẫu"}});assert.equal(screen.queryByLabelText("Căn cứ xác nhận đầu kỳ dòng 1"),null);assert.ok(screen.getByLabelText("Giá trị còn lại đầu kỳ dòng 1").textContent?.includes("1.000.000"));assert.ok(screen.getByText("Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ. Không làm thay đổi tồn kho."));assert.equal(screen.queryByLabelText("Diễn giải / ghi chú"),null);assert.ok(screen.getByLabelText("Tổng số lượng đầu kỳ").textContent?.includes("1"));assert.ok(screen.getByLabelText("Tổng nguyên giá đầu kỳ").textContent?.includes("5.000.000"));assert.ok(screen.getByLabelText("Tổng giá trị còn lại đầu kỳ").textContent?.includes("1.000.000"));fireEvent.click(screen.getByRole("button",{name:"Lưu",exact:true}));await waitFor(()=>assert.ok(saved));assert.equal(saved?.kind,"opening");assert.equal(saved?.opening_mode,"in_use");assert.equal(saved?.warehouse_id,"");assert.equal(saved?.lines[0].target_type,"vehicle");assert.deepEqual(saved?.lines[0].serials,["OLD-UI-OPENING"]);assert.equal(saved?.lines[0].unit_price,"");assert.equal(saved?.lines[0].opening_current_unit_price,"5000000");assert.equal(saved?.lines[0].opening_quality_percent,"20");assert.equal(saved?.lines[0].opening_assessor,"Kỹ thuật mẫu");assert.equal(saved?.lines[0].odo,"");assert.equal(saved?.lines[0].stock_state,"recovered");
});

test("mounted opening parser keeps legacy stock mode, rejects wrong kind, future install and warehouse sources; print shows the new document",async()=>{
 const draft=emptyDraft("opening");draft.warehouse_id="wh";draft.opening_mode="in_use";draft.business_at="2026-10-10T00:00";Object.assign(draft.lines[0],{part_id:"part",target_id:"trailer",stock_state:"recovered",unit_price:"",installed_at:"",odo:""});const parsed=parseDraft(draft);assert.equal(parsed.opening_mode,"in_use");assert.equal(parsed.lines[0].installed_at,"");assert.throws(()=>parseDraft({...draft,kind:"issue"}));assert.throws(()=>parseDraft({...draft,lines:[{...draft.lines[0],installed_at:"2026-10-11T00:00"}]}));assert.throws(()=>parseDraft({...draft,lines:[{...draft.lines[0],source_line_id:"warehouse-source"}]}));
 const {record}=await example();record.draft=parsed;record.totals={net:null,vat:0,gross:null};const {OpeningUsagePrint}=await import("../src/documents/OpeningUsagePrint");const {renderToStaticMarkup}=await import("react-dom/server");const html=renderToStaticMarkup(<OpeningUsagePrint row={record}/>);assert.ok(html.includes("PHIẾU VẬT TƯ ĐANG SỬ DỤNG ĐẦU KỲ"));assert.ok(!html.includes("Đơn vị quản lý"));assert.ok(html.includes("Nguyên giá"));assert.ok(!html.includes("VAT"));assert.equal(new JSDOM(html).window.document.querySelectorAll("thead th").length,10);
});


test("document client sends mounted opening and valuation review filters to the real API query",async()=>{
 let url="";const client=createDocumentClient(async(input)=>{url=String(input);return Response.json({data:[],pagination:{page:1,page_size:25,total:0}});});await client.list({kind:"opening",opening_mode:"in_use"});assert.equal(new URL(url,"https://test.invalid").searchParams.get("opening_mode"),"in_use");await client.list({kind:"recovery",valuation_pending:"1"});assert.equal(new URL(url,"https://test.invalid").searchParams.get("valuation_pending"),"1");
});


test("opening recovery current price quality inputs refresh canonical quotes and print technical evidence",async()=>{
 const {record,catalog,documents}=await example();record.draft.kind="recovery";record.status="draft";record.draft.business_at="2026-10-26T09:00";const line=record.draft.lines[0];Object.assign(line,{stock_state:"recovered",usage_id:"opening-usage",quantity:"1",unit_price:"",serial:"",serials:[],recovery_classification:"CSD",recovery_quality_percent:"20",recovery_current_unit_price:"5000000",recovery_assessor:"Kỹ thuật A"});
 const calls:Array<{current_unit_price?:string;quality_percent?:string;assessor?:string}>=[];
 const docs={...documents,recoveryPrice:async(input:{current_unit_price?:string;quality_percent?:string;assessor?:string})=>{calls.push(input);const amount=Math.round(Number(input.current_unit_price)*Number(input.quality_percent)/100);return{base_vnd:5000000,amount_vnd:amount,unit_price_vnd_milli:amount*1000,valuation_method:"current_price_quality",remaining_percent:null};}};
 render(<DocumentEditor kind="recovery" record={record} api={catalog} documents={docs} canEdit onClose={()=>{}} onSaved={()=>{}}/>);
 await waitFor(()=>assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("1.000.000")));assert.ok(screen.getByText("Giá hiện tại × chất lượng kỹ thuật."));assert.equal(screen.queryByText("Còn 20% định mức"),null);
 fireEvent.change(screen.getByRole("textbox",{name:"Giá mua hiện tại dòng 1"}),{target:{value:"6.000.000"}});await waitFor(()=>assert.ok(calls.some(c=>c.current_unit_price==="6000000")));await waitFor(()=>assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("1.200.000")));
 fireEvent.change(screen.getByRole("textbox",{name:"Chất lượng còn lại (%) dòng 1"}),{target:{value:"25,5"}});await waitFor(()=>assert.ok(calls.some(c=>c.quality_percent==="25.5")));await waitFor(()=>assert.ok(screen.getByLabelText("Thành tiền thu hồi dòng 1").textContent?.includes("1.530.000")));
 fireEvent.change(screen.getByRole("textbox",{name:"Kỹ thuật xác nhận dòng 1"}),{target:{value:"Kỹ thuật B"}});await waitFor(()=>assert.equal(calls.at(-1)?.assessor,"Kỹ thuật B"));
 const canonical=parseDraft(normalizeDraftInput({...record.draft,lines:[{...line,recovery_current_unit_price:"5.000.000",recovery_quality_percent:"20"}]}));assert.equal(canonical.lines[0].recovery_current_unit_price,"5000000");assert.throws(()=>parseDraft({...canonical,kind:"issue"}));
 const {RecoveryPrint}=await import("../src/documents/RecoveryPrint");const {renderToStaticMarkup}=await import("react-dom/server");record.labels["recovery_valuation_method:"+line.id]="current_price_quality";record.labels["recovery_amount:"+line.id]="1000000";const text=new JSDOM(renderToStaticMarkup(<RecoveryPrint row={record}/>)).window.document.body.textContent;assert.ok(text?.includes("5.000.000"));assert.ok(text?.includes("Kỹ thuật A"));assert.ok(!text?.includes("% định mức"));
});

test("opening print includes current price, quality and assessment basis separately from original cost",async()=>{const {record}=await example();record.draft={...emptyDraft('opening'),opening_mode:'in_use',warehouse_id:'wh'};Object.assign(record.draft.lines[0],{part_id:'part',target_id:'vehicle',stock_state:'recovered',unit_price:'',opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Nguyễn Kỹ Thuật',opening_confirmation_basis:'Biên bản DK-01'});const{OpeningUsagePrint}=await import('../src/documents/OpeningUsagePrint');const{renderToStaticMarkup}=await import('react-dom/server');const text=new JSDOM(renderToStaticMarkup(<OpeningUsagePrint row={record}/>)).window.document.body.textContent;for(const value of ['Nguyên giá','Tỷ lệ còn lại (%)','Giá trị còn lại','5.000.000','20%','1.000.000','Nguyễn Kỹ Thuật','Biên bản DK-01'])assert.ok(text?.includes(value),value);});

test("opening source carries saved price, remaining ratio and assessor into recovery; old drafts expose market inputs",async()=>{
 const p=await preview();const source={usage_id:'opening-cycle',root_line_id:'opening-line',part_id:'tire',sku:'OPEN-TIRE',name:'Vỏ đầu kỳ',unit:'Cái',part_version:1,is_serialized:1,serial_number:'OPEN-REF-001',target_label:'50H-110.99',position:'GTT',code:'10.26.001/SD',started_at:'2026-10-10T00:00',odo_milli:null,hours_milli:null,quantity_milli:1000,issued_quantity_milli:1000,open_quantity_milli:1000,source_kind:'opening_usage' as const,opening_original_unit_price_known:0,opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật đầu kỳ',opening_confirmation_basis:'Biên bản DK-01'};
 const docs={...p.documents,recoverySources:async()=>({data:[source],pagination:{page:1,page_size:25,total:1}})};const draft=emptyDraft('recovery');draft.warehouse_id='wh';const view=render(<DocumentEditor kind="recovery" initialDraft={draft} api={p.catalog} documents={docs} canEdit onClose={()=>{}} onSaved={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Chọn vật tư đang sử dụng dòng 1'}));fireEvent.click(await screen.findByRole('button',{name:'Chọn OPEN-TIRE OPEN-REF-001'}));await screen.findByLabelText('Giá mua hiện tại dòng 1');assert.equal((screen.getByLabelText('Giá mua hiện tại dòng 1')as HTMLInputElement).value,'5000000');assert.equal((screen.getByLabelText('Chất lượng còn lại (%) dòng 1')as HTMLInputElement).value,'20');assert.equal((screen.getByLabelText('Kỹ thuật xác nhận dòng 1')as HTMLInputElement).value,'Kỹ thuật đầu kỳ');assert.equal(screen.queryByText('Diễn giải / ghi chú'),null);assert.ok(screen.getByText('Phiếu thu hồi VT-TB'));assert.equal(screen.queryByText(/Đầu kỳ chưa rõ giá gốc:/),null);assert.ok(screen.getByLabelText('Kho nhận thu hồi dòng 1').className.includes('text-center'));assert.ok(screen.getByText(/Biên bản DK-01/));view.unmount();
 const {record,catalog,documents}=await example();record.draft.kind='recovery';record.status='draft';Object.assign(record.draft.lines[0],{usage_id:'opening-cycle',stock_state:'recovered',unit_price:'',recovery_current_unit_price:undefined});record.labels['recovery_market_eligible:'+record.draft.lines[0].id]='1';render(<DocumentEditor kind="recovery" record={record} api={catalog} documents={documents} canEdit onClose={()=>{}} onSaved={()=>{}}/>);assert.ok(screen.getByLabelText('Giá mua hiện tại dòng 1'));assert.ok(screen.getByLabelText('Kỹ thuật xác nhận dòng 1'));
});



test("mounted opening quick import maps reordered headers, copies contents, resolves targets and defaults catalog prices without stock or VAT",async()=>{
 const p=await preview();let copied="";let applied:DraftLine[]|undefined;
 const descriptor=Object.getOwnPropertyDescriptor(navigator,"clipboard");
 Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{copied=text;}}});
 try{
  render(<DocumentQuickImport api={p.catalog} kind="opening" openingInUse onApply={lines=>{applied=lines}} onClose={()=>{}}/>);
  const paste=(text:string)=>fireEvent.paste(screen.getByLabelText("Mã vật tư nhập nhanh dòng 1"),{clipboardData:{getData:()=>text}});
  paste("Serial\tBiển số / mã thiết bị\tLoại phương tiện\tTỷ lệ còn lại (%)\tNgười xác nhận\tSố lượng\tVị trí lắp\tMã vật tư\nOLD-QUICK-001\t51R-456.78\tRơ moóc\t20\tKỹ thuật mẫu\t1\tT1TT\tM-RM-LOP-0001");
  fireEvent.click(screen.getByRole("button",{name:"Sao chép bảng kèm tiêu đề"}));await waitFor(()=>assert.ok(copied.startsWith("Mã vật tư\tLoại phương tiện\tBiển số / mã thiết bị")));assert.ok(copied.includes("OLD-QUICK-001"));assert.ok(!copied.includes("VAT"));
  fireEvent.click(screen.getByRole("button",{name:"Xem trước"}));await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Thêm vào phiếu"})as HTMLButtonElement).disabled,false));
  fireEvent.click(screen.getByRole("button",{name:"Thêm vào phiếu"}));assert.equal(applied?.[0].target_id,"trailer-1");assert.equal(applied?.[0].opening_current_unit_price,"8500000");assert.equal(applied?.[0].opening_quality_percent,"20");assert.equal(applied?.[0].unit_price,"");assert.equal(applied?.[0].mount_position_id,undefined);assert.ok(applied?.[0].to_position.includes("Trục 1"));
  const draft={...emptyDraft("opening"),opening_mode:"in_use" as const,warehouse_id:"wh-1",lines:applied!};assert.equal(parseDraft(draft).lines[0].target_id,"trailer-1");
  paste("Mã vật tư\tSố lượng\nM-RM-LOP-0001\t1");assert.ok(screen.getByRole("alert").textContent?.includes("Biển số"));assert.equal((screen.getByRole("button",{name:"Thêm vào phiếu"})as HTMLButtonElement).disabled,true);
  paste("Mã vật tư\tBiển số / mã thiết bị\tLoại phương tiện\tSố lượng\tSerial\nM-RM-LOP-0001\t51R-456.78\tĐầu kéo\t1\tOLD-QUICK-001");fireEvent.click(screen.getByRole("button",{name:"Xem trước"}));await waitFor(()=>assert.ok(screen.getByRole("alert").textContent?.includes("không khớp")));
 }finally{if(descriptor)Object.defineProperty(navigator,"clipboard",descriptor);else Reflect.deleteProperty(navigator,"clipboard");}
});
test('opening fleet header clears old pairings immediately, ignores stale driver responses and preserves material targets',async()=>{
 const {OpeningFleetHeader}=await import('../src/documents/OpeningFleetHeader');const {emptyIssueDetails}=await import('../shared/issueDetails');const p=await preview();
 let release:(value:ReturnType<typeof emptyIssueDetails>&{recipient:string})=>void=()=>{};let firstSignal:AbortSignal|undefined;let snapshot=emptyDraft('opening');snapshot.opening_mode='in_use';snapshot.lines[0].target_id='preserved-trailer';
 const docs={...p.documents,issueContext:async(_staff:string,_vehicle:string,driver:string,signal?:AbortSignal)=>{if(driver==='d1'){firstSignal=signal;return new Promise<ReturnType<typeof emptyIssueDetails>&{recipient:string}>(resolve=>{release=resolve})}return {...emptyIssueDetails(),recipient:'',driver_id:'d2',driver_name:'Lái xe 2',vehicle_id:'v2',vehicle_plate:'50H-222.22',trailer_number:'51R-222.22',other:'MP222'};}};
 const api={...p.catalog,list:async(resource,options)=>resource==='staff'?{data:[{id:'d1',version:1,code:'D1',name:'Lái xe 1',staff_type:'driver',is_active:1},{id:'d2',version:1,code:'D2',name:'Lái xe 2',staff_type:'driver',is_active:1}],pagination:{page:1,page_size:25,total:2}}:p.catalog.list(resource,options)};
 const busy=()=>{};function Harness(){const[d,setD]=React.useState(snapshot);snapshot=d;return <OpeningFleetHeader draft={d} setDraft={setD} documents={docs} api={api} disabled={false} onBusyChange={busy} topFields={null}/>}
 render(<Harness/>);const picker=screen.getByRole('combobox',{name:'Tài xế',exact:true});fireEvent.focus(picker);fireEvent.click(await screen.findByRole('option',{name:/D1 —/}));assert.equal((screen.getByLabelText('Đầu kéo',{exact:true})as HTMLInputElement).value,'');fireEvent.focus(picker);fireEvent.click(await screen.findByRole('option',{name:/D2 —/}));await waitFor(()=>assert.equal((screen.getByLabelText('Đầu kéo',{exact:true})as HTMLInputElement).value,'50H-222.22'));assert.equal(firstSignal?.aborted,true);assert.equal((screen.getByLabelText('Rơ moóc',{exact:true})as HTMLInputElement).value,'51R-222.22');assert.equal((screen.getByLabelText('Máy phát',{exact:true})as HTMLInputElement).value,'MP222');
 release({...emptyIssueDetails(),recipient:'',driver_id:'d1',driver_name:'Lái xe 1',vehicle_id:'v1',vehicle_plate:'STALE',trailer_number:'STALE',other:'STALE'});await new Promise(resolve=>setTimeout(resolve,10));assert.equal(snapshot.opening_details?.vehicle_id,'v2');assert.equal(snapshot.lines[0].target_id,'preserved-trailer');
 fireEvent.click(screen.getByRole('button',{name:'Bỏ chọn Tài xế'}));assert.equal(snapshot.opening_details?.driver_id,'');for(const name of ['Đầu kéo','Rơ moóc','Máy phát'])assert.equal((screen.getByLabelText(name,{exact:true})as HTMLInputElement).value,'');
});
test('opening original price displays currency, edits on focus, updates remaining value and keeps fleet details in valid drafts and print',async()=>{
 const {OpeningUsageAssessment}=await import('../src/documents/OpeningUsageAssessment');const base={...emptyLine(),part_id:'part',quantity:'1',opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'};
 function Harness(){const[item,setItem]=React.useState(base);return <table><tbody><tr><OpeningUsageAssessment item={item} index={0} disabled={false} line={(_id,patch)=>setItem(v=>({...v,...patch}))}/></tr></tbody></table>}
 render(<Harness/>);const price=screen.getByLabelText('Nguyên giá đầu kỳ dòng 1')as HTMLInputElement;assert.equal(price.value,'5.000.000 đ');fireEvent.focus(price);assert.equal(price.value,'5000000');fireEvent.change(price,{target:{value:'2.000.000'}});fireEvent.blur(price);assert.equal(price.value,'2.000.000 đ');assert.ok(screen.getByLabelText('Giá trị còn lại đầu kỳ dòng 1').textContent?.includes('400.000'));
 const details={driver_id:'driver',driver_name:'Lái xe mẫu',vehicle_id:'vehicle',vehicle_plate:'50H-555.55',trailer_number:'51R-555.55',generator_code:'MP555'};const draft={...emptyDraft('opening'),opening_mode:'in_use' as const,opening_details:details,lines:[{...base,target_id:'vehicle',stock_state:'recovered' as const}]};const valid=parseDraft(draft);assert.deepEqual(valid.opening_details,{...details,vehicle_odo:"",trailer_odo:""});assert.throws(()=>parseDraft({...draft,opening_mode:'stock'}));assert.throws(()=>parseDraft({...draft,opening_details:{...details,driver_id:'bad/id'}}));
 const {record}=await example();record.draft=valid;const {OpeningUsagePrint}=await import('../src/documents/OpeningUsagePrint');const{renderToStaticMarkup}=await import('react-dom/server');const html=renderToStaticMarkup(<OpeningUsagePrint row={record}/>);for(const value of [details.driver_name,details.vehicle_plate,details.trailer_number,details.generator_code])assert.ok(html.includes(value));assert.ok(!html.includes('Đơn vị quản lý'));
});
test('mounted opening list aligns its own fields, full datetime, money and actions and handles legacy rows without inventing fleet data',async()=>{
 const {OpeningUsageTable}=await import('../src/documents/OpeningUsageTable');const p=await preview();const receipt=(await p.documents.list({kind:'receipt'})).data[0];const row={...receipt,kind:'opening' as const,status:'posted' as const,code:'10.26.00001/SD',business_at:'2026-10-10T08:35',created_by:'admin',created_by_name:'Người lập mẫu',total_quantity:'12000',quantity_units:['Cái'],opening_original_value_vnd:60000000,totals:{net:12800000,vat:0,gross:12800000},opening_details:{driver_id:'driver',driver_name:'Nguyễn Lái Xe',vehicle_id:'vehicle',vehicle_plate:'50H-110.99',trailer_number:'51R-047.31',generator_code:'MP126'},purpose:'Kiểm kê vật tư đang gắn trên xe đầu kỳ'};const calls:string[]=[];
 const view=render(<OpeningUsageTable rows={[row]} user={user} busy={false} sort="business_at" direction="desc" onSort={key=>calls.push(key)} onOpen={(_row,mode)=>calls.push(mode)}/>);
 const table=screen.getByRole('table');assert.equal(table.querySelectorAll('col').length,10);assert.equal(table.querySelectorAll('thead th').length,10);assert.equal(table.querySelectorAll('tbody td').length,10);for(const value of ['10/10/2026 08:35','Nguyễn Lái Xe','50H-110.99','51R-047.31','MP126','60.000.000','12.800.000','Người lập mẫu','Đã ghi nhận'])assert.ok(table.textContent?.includes(value),value);assert.ok(!table.textContent?.includes('Đối tác / người nhận'));
 fireEvent.click(screen.getByRole('button',{name:'Xem '+row.code,exact:true}));fireEvent.click(screen.getByRole('button',{name:'In phiếu '+row.code,exact:true}));assert.equal(screen.queryByRole('button',{name:'Lịch sử '+row.code,exact:true}),null);fireEvent.click(screen.getByRole('button',{name:'Thao tác khác '+row.code,exact:true}));fireEvent.click(screen.getByRole('menuitem',{name:'Lịch sử',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Thao tác khác '+row.code,exact:true}));fireEvent.click(screen.getByRole('menuitem',{name:'Tải dữ liệu phiếu (JSON)',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Số phiếu'}));assert.deepEqual(calls,['view','print','history','export','code']);assert.equal(screen.queryByRole('columnheader',{name:'Tổng SL'}),null);view.unmount();
 render(<OpeningUsageTable rows={[{...row,opening_details:undefined,opening_target_labels:["51R-OLD — Rơ moóc"],opening_original_value_vnd:null,totals:{net:0,vat:0,gross:0}}]} user={{...user,role:'viewer'}} busy={false} sort="business_at" direction="desc" onSort={()=>{}} onOpen={()=>{}}/>);assert.equal(screen.queryByText('Nguyễn Lái Xe'),null);assert.ok(screen.getByText('51R-OLD — Rơ moóc'));assert.equal(screen.queryByText('⚠ Chưa xác định giá trị'),null);assert.ok(screen.getByRole('table').textContent?.includes('0'));assert.equal(screen.queryByRole('button',{name:'Xử lý '+row.code}),null);
});
test('opening list DTO rejects invalid original amounts and malformed driver snapshots while permitting older summaries',async()=>{
 const p=await preview();const base=(await p.documents.list({kind:'receipt'})).data[0];const make=(row:unknown)=>createDocumentClient(async()=>Response.json({data:[row],pagination:{page:1,page_size:25,total:1}}));
 assert.equal((await make({...base,kind:'opening'}).list({kind:'opening',opening_mode:'in_use'})).data.length,1);
 await assert.rejects(()=>make({...base,opening_original_value_vnd:-1}).list({kind:'opening'}),/Phản hồi/);
 await assert.rejects(()=>make({...base,opening_details:{driver_name:1}}).list({kind:'opening'}),/Phản hồi/);
});
test('opening posted edit opens from ellipsis, remains read-only through View and saves price and both ODO readings with a reason',async()=>{
 const p=await example();const {record}=p;record.id='ui-opening-edit';record.code='10.26.00001/SD';record.status='posted';record.can_modify=true;record.draft={...emptyDraft('opening'),opening_mode:'in_use',business_at:'2026-10-10T08:00',opening_details:{driver_id:'staff-driver',driver_name:'Tài xế mẫu',vehicle_id:'vehicle-1',vehicle_plate:'50H-123.45',trailer_number:'51R-456.78',generator_code:'MP001',vehicle_odo:'123456',trailer_odo:'654321'}};Object.assign(record.draft.lines[0],{part_id:'part-tire',target_type:'vehicle',target_id:'trailer-1',stock_state:'recovered',serials:['UI-EDIT'],quantity:'1',opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'});record.labels={'sku:part-tire':'M-RM-LOP-0001','parts:part-tire':'M-RM-LOP-0001 — Lốp xe','unit:part-tire':'Cái','serialized:part-tire':'1','vehicles:trailer-1':'51R-456.78 — Rơ moóc'};record.totals=draftTotals(record.draft);let saved:import('../shared/documents').DocumentDraft|undefined,reason='';
 const row={...record,kind:'opening' as const,business_at:record.draft.business_at,warehouse_label:'',partner_label:'',line_count:1,opening_details:record.draft.opening_details,opening_original_value_vnd:5000000};const docs={...p.documents,list:async(options)=>({data:options.kind==='opening'&&options.opening_mode==='in_use'?[row]:[],pagination:{page:1,page_size:25,total:options.opening_mode==='in_use'?1:0}}),get:async()=>structuredClone(record),save:async(draft,key,old,why)=>{saved=draft;reason=why;return{...record,draft,version:2,totals:draftTotals(draft)}}};
 render(<DocumentsWorkspace menu="ht_so_du_dau" api={p.catalog} documents={docs} user={user}/>);fireEvent.click(screen.getByRole('tab',{name:'Vật tư đang sử dụng đầu kỳ'}));await screen.findByRole('button',{name:'Xem '+row.code,exact:true});assert.equal(screen.queryByRole('columnheader',{name:'Tổng SL'}),null);fireEvent.click(screen.getByRole('button',{name:'Xem '+row.code,exact:true}));await screen.findByRole('dialog');assert.equal((screen.getByLabelText('Nguyên giá đầu kỳ dòng 1')as HTMLInputElement).disabled,true);fireEvent.click(screen.getByRole('button',{name:'Đóng',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'Thao tác khác '+row.code,exact:true}));const edit=screen.getByRole('menuitem',{name:'Sửa phiếu',exact:true});assert.equal((edit as HTMLButtonElement).disabled,false);fireEvent.click(edit);await screen.findByRole('dialog');const price=screen.getByLabelText('Nguyên giá đầu kỳ dòng 1')as HTMLInputElement;assert.equal(price.disabled,false);fireEvent.focus(price);fireEvent.change(price,{target:{value:'6.000.000'}});fireEvent.blur(price);fireEvent.change(screen.getByLabelText('ODO Đầu kéo'),{target:{value:'123.500'}});fireEvent.change(screen.getByLabelText('ODO Rơ Moóc'),{target:{value:'654.500'}});fireEvent.change(screen.getByLabelText('Lý do sửa *'),{target:{value:'Điều chỉnh đánh giá và ODO'}});fireEvent.click(screen.getByRole('button',{name:'Lưu',exact:true}));await waitFor(()=>assert.ok(saved));assert.equal(saved?.lines[0].opening_current_unit_price,'6000000');assert.equal(saved?.opening_details?.vehicle_odo,'123500');assert.equal(saved?.opening_details?.trailer_odo,'654500');assert.equal(reason,'Điều chỉnh đánh giá và ODO');assert.equal(saved?.lines[0].odo,'');
});
test('opening 3/6 header auto-loads tractor/trailer ODO, allows edits and clears readings with driver',async()=>{
 const {OpeningFleetHeader}=await import('../src/documents/OpeningFleetHeader');const p=await preview();let snapshot=emptyDraft('opening');snapshot.opening_mode='in_use';const busy=()=>{};function Harness(){const[d,setD]=React.useState(snapshot);snapshot=d;return <OpeningFleetHeader draft={d} setDraft={setD} api={p.catalog} documents={p.documents} disabled={false} onBusyChange={busy} topFields={<><input aria-label="Số phiếu thử"/><input aria-label="Ngày thử"/><input aria-label="Nội dung thử"/></>}/>}
 render(<Harness/>);fireEvent.focus(screen.getByRole('combobox',{name:'Tài xế',exact:true}));fireEvent.click(await screen.findByRole('option',{name:/TX001/}));await waitFor(()=>assert.equal((screen.getByLabelText('ODO Rơ Moóc')as HTMLInputElement).value,'654321'));assert.equal((screen.getByLabelText('ODO Đầu kéo')as HTMLInputElement).value,'123456');const section=screen.getByRole('region',{name:'Thông tin phiếu đầu kỳ'});assert.equal(section.querySelectorAll(':scope > div')[0].children.length,3);assert.equal(section.querySelectorAll(':scope > div')[1].children.length,6);
 fireEvent.change(screen.getByLabelText('ODO Rơ Moóc'),{target:{value:'700.000'}});assert.equal(snapshot.opening_details?.trailer_odo,'700.000');fireEvent.click(screen.getByRole('button',{name:'Bỏ chọn Tài xế'}));assert.equal((screen.getByLabelText('ODO Rơ Moóc')as HTMLInputElement).value,'');assert.equal((screen.getByLabelText('ODO Đầu kéo')as HTMLInputElement).value,'');assert.equal((screen.getByLabelText('ODO Rơ Moóc')as HTMLInputElement).disabled,true);
});


test("opening stock uses DK numbering and a compact four-column header without VAT or general notes",async()=>{
 const p=await example();const draft=emptyDraft("opening");draft.warehouse_id=p.record.draft.warehouse_id;draft.business_at="2026-10-10T00:00";draft.purpose="Kiểm kê tồn đầu kỳ";Object.assign(draft.lines[0],{part_id:"part-tire",quantity:"2",unit_price:"100000",serials:["DK-A","DK-B"],notes:"Tồn đã kiểm kê"});
 const record={...p.record,code:"10.26.00001/SD",status:"draft" as const,draft,totals:draftTotals(draft),labels:{...p.record.labels,"parts:part-tire":"M-RM-LOP-0001 — Lốp","serialized:part-tire":"1"}};let saved:import("../shared/documents").DocumentDraft|undefined;
 const docs={...p.documents,save:async(input)=>{saved=input;return {...record,draft:input,totals:draftTotals(input)};}};
 const r=render(<DocumentEditor kind="opening" record={record} canEdit api={p.catalog} documents={docs} onClose={()=>{}} onSaved={()=>{}}/>);
 const header=screen.getByLabelText("Thông tin phiếu tồn kho đầu kỳ");assert.equal(header.children.length,4);assert.ok(header.classList.contains("lg:grid-cols-4"));assert.ok(header.textContent?.includes("Mục đích / nội dung"));assert.ok(screen.getByRole("dialog").textContent?.includes("Phiếu Tồn kho đầu kỳ"));
 const table=r.container.querySelector("table")!;const headings=[...table.querySelectorAll("thead th")].map(el=>el.textContent);assert.deepEqual(headings,["Vật tư","Số lượng","Đơn giá","Thành tiền","Serial","Trạng thái hàng","Ghi chú","Thao tác"]);assert.equal(table.querySelectorAll("tbody tr:first-child td").length,headings.length);assert.ok(!screen.queryByText("VAT"));assert.ok(!screen.queryByText("Diễn giải / ghi chú"));assert.ok(screen.getByText("Tổng thành tiền"));
 const serial=screen.getByLabelText("Serial dòng 1") as HTMLInputElement;assert.equal(serial.tagName,"INPUT");assert.equal(serial.type,"text");assert.equal(serial.value,"DK-A; DK-B");fireEvent.change(serial,{target:{value:"DK-C; DK-D"}});fireEvent.change(screen.getByLabelText("Ghi chú dòng 1"),{target:{value:"Kiểm đếm lại"}});fireEvent.change(screen.getByLabelText(/Lý do sửa/),{target:{value:"Cập nhật kiểm kê"}});fireEvent.click(screen.getByRole("button",{name:"Lưu"}));await waitFor(()=>assert.ok(saved));assert.deepEqual(saved!.lines[0].serials,["DK-C","DK-D"]);assert.equal(saved!.lines[0].vat_rate,"0");assert.equal(saved!.lines[0].notes,"Kiểm đếm lại");assert.equal(record.code,"10.26.00001/SD");
 cleanup();let query="";const client=createDocumentClient(async(input)=>{query=String(input);return Response.json({data:{code:"10.26.00001/DK"}})});await client.nextNumber("opening","2026-10-10","",undefined,"stock");assert.equal(new URL(query,"https://test.invalid").searchParams.get("opening_mode"),"stock");await client.nextNumber("opening","2026-10-10","",undefined,"in_use");assert.equal(new URL(query,"https://test.invalid").searchParams.get("opening_mode"),"in_use");assert.match(await p.documents.nextNumber("opening","2026-10-10"),/\/DK$/);assert.match(await p.documents.nextNumber("opening","2026-10-10","",undefined,"in_use"),/\/SD$/);
});


test("opening stock quick table excludes VAT and still maps reordered serial and notes columns",async()=>{
 const {quickColumns,parseQuickTable,quickTableText}=await import("../shared/quickImportTable");const columns=quickColumns("opening");assert.ok(!columns.some(c=>c.key==="vat_rate"));const values=parseQuickTable("Serial\tGhi chú\tĐơn giá\tSố lượng\tMã vật tư\nA; B\tKiểm kê\t100.000\t2\tM-VT-001","opening");assert.equal(values[0].serial,"A; B");assert.equal(values[0].notes,"Kiểm kê");assert.equal(values[0].unit_price,"100.000");const text=quickTableText(values,"opening");assert.ok(!text.includes("VAT"));assert.deepEqual(parseQuickTable(text,"opening"),values.map(v=>Object.fromEntries(columns.map(c=>[c.key,v[c.key]??""]))));
});


test("recovery editor quick import binds open opening usage before adding and preserves inherited valuation",async()=>{
 const p=await preview();const part=(await p.catalog.list('parts',{q:'M-RM-LOP-0001',pageSize:25})).data.find(p=>p.sku==='M-RM-LOP-0001')!;assert.ok(part);
 const calls:string[]=[];const source={usage_id:'quick-open',root_line_id:'root-open',part_id:part.id,sku:String(part.sku),name:String(part.name),unit:'Cái',part_version:1,is_serialized:1,serial_number:'OPEN-QUICK-001',target_label:'51R-456.78',position:'T1TT',code:'10.26.001/SD',started_at:'2026-10-10T00:00',odo_milli:null,hours_milli:null,quantity_milli:1000,issued_quantity_milli:1000,open_quantity_milli:1000,source_kind:'opening_usage' as const,opening_original_unit_price_known:0,opening_current_unit_price:'5000000',opening_quality_percent:'20',opening_assessor:'Kỹ thuật'};
 const docs={...p.documents,recoverySources:async(_q:string,_page:number,vehicle?:string)=>{calls.push(vehicle??'');return {data:[source],pagination:{page:1,page_size:25,total:1}}},recoveryPrice:async()=>({base_vnd:5000000,amount_vnd:1000000,unit_price_vnd_milli:1000000000,valuation_method:'current_price_quality'})};
 const {emptyRecoveryDetails}=await import("../shared/recoveryDetails");const draft=emptyDraft('recovery');draft.business_at='2026-10-26T10:00';draft.warehouse_id='wh-1';draft.recovery_details={...emptyRecoveryDetails(),vehicle_id:'vehicle-1'};
 render(<DocumentEditor kind="recovery" initialDraft={draft} api={p.catalog} documents={docs} canEdit onClose={()=>{}} onSaved={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Nhập nhanh dòng'}));fireEvent.paste(screen.getByLabelText('Mã vật tư nhập nhanh dòng 1'),{clipboardData:{getData:()=>"Serial\tMã vật tư\tSố lượng\tPhân loại\tChất lượng (%)\nOPEN-QUICK-001\tM-RM-LOP-0001\t1\tCSD\t"}});
 fireEvent.click(screen.getByRole('button',{name:'Xem trước'}));await waitFor(()=>assert.equal((screen.getByRole('button',{name:'Thêm vào phiếu'})as HTMLButtonElement).disabled,false));assert.ok(screen.getByText(/Nguồn: 10.26.001\/SD/));assert.deepEqual(calls,['vehicle-1']);fireEvent.click(screen.getByRole('button',{name:'Thêm vào phiếu'}));await waitFor(()=>assert.ok(screen.getByLabelText('Thành tiền thu hồi dòng 1').textContent?.includes('1.000.000')));assert.equal((screen.getByLabelText('Chất lượng còn lại (%) dòng 1')as HTMLInputElement).value,'20');assert.equal((screen.getByLabelText('Kỹ thuật xác nhận dòng 1')as HTMLInputElement).value,'Kỹ thuật');assert.equal(screen.queryByRole('dialog',{name:'Nhập nhanh dòng vật tư'}),null);
});


test("recovery list cards use full filter totals, classification chips filter and paging reuses totals",async()=>{
 const p=await preview();const {emptyRecoveryDetails}=await import('../shared/recoveryDetails');const calls:import('../src/documents/documentClient').ListDocuments[]=[];
 const base={id:'rec-list',version:1,code:'10.26.00001/PTH',kind:'recovery' as const,status:'posted' as const,business_at:'2026-10-26T15:00',totals:{net:12000000,vat:0,gross:12000000},created_by:user.id,created_by_name:user.display_name,created_at:'2026-10-26T08:00Z',updated_at:'2026-10-26T08:00Z',warehouse_label:'KHONS — Kho Nghi Sơn',partner_label:'Lê Văn Khôi',purpose:'Thu hồi vỏ thay mới',line_count:12,total_quantity:'12000',quantity_units:['Cái'],recovery_details:{...emptyRecoveryDetails(),vehicle_plate:'50H-110.99',trailer_number:'51R-047.31',generator_code:'MP126',handover_name:'Giản Tư Tâm'},recovery_counts:{CSD:12,CSC:0,KSD:0,CTL:0}};
 const docs={...p.documents,list:async(f:import('../src/documents/documentClient').ListDocuments)=>{calls.push(f);const total=f.recovery_classification?1:25;return {data:[base],pagination:{page:f.page??1,page_size:f.pageSize??20,total},...(f.includeTotals===false?{}:{receipt_totals:{count:total,status_counts:{posted:total,cancelled:0},quantity_milli:'12000',units:['cái'],net:'12000000',vat:'0',gross:'12000000',recovery_counts:base.recovery_counts}})}}};
 render(<DocumentsWorkspace menu="ct_thu_hoi" api={p.catalog} documents={docs} user={user}/>);await screen.findByRole('button',{name:'10.26.00001/PTH'});assert.ok(screen.getByText('Tổng SL thu hồi'));assert.ok(screen.getByText('Giá trị thu hồi (đ)'));assert.equal(screen.queryByText('26/10/2026 15:00'),null);assert.ok(screen.getByText('51R-047.31'));assert.ok(screen.getByText('MP126'));assert.ok(screen.getByText('Xe:'));assert.ok(screen.getByText('Rơ moóc:'));assert.ok(screen.getByText('MP:'));assert.equal(screen.queryByLabelText('Trạng thái chứng từ'),null);
 fireEvent.click(screen.getByRole('button',{name:'Trang sau',exact:true}));await waitFor(()=>assert.equal(calls.at(-1)?.page,2));assert.equal(calls.at(-1)?.includeTotals,false);
 fireEvent.click(screen.getByRole('button',{name:'CSD 12',exact:true}));await waitFor(()=>assert.equal(calls.at(-1)?.recovery_classification,'CSD'));assert.equal(calls.at(-1)?.page,1);assert.equal(calls.at(-1)?.includeTotals,true);assert.equal(screen.getByRole('button',{name:'CSD 12'}).getAttribute('aria-pressed'),'true');
 fireEvent.click(screen.getByRole('button',{name:'Bộ lọc khác (1)',exact:true}));fireEvent.click(screen.getByRole('checkbox',{name:'CSC · Chờ sửa chữa',exact:true}));await waitFor(()=>assert.equal(calls.at(-1)?.recovery_classification,'CSD,CSC'));assert.equal((screen.getByRole('checkbox',{name:'CSD · Còn sử dụng được',exact:true})as HTMLInputElement).checked,true);assert.equal((screen.getByRole('checkbox',{name:'CSC · Chờ sửa chữa',exact:true})as HTMLInputElement).checked,true);fireEvent.click(screen.getByRole('checkbox',{name:'CSC · Chờ sửa chữa',exact:true}));await waitFor(()=>assert.equal(calls.at(-1)?.recovery_classification,'CSD'));fireEvent.keyDown(document,{key:'Escape'});

 fireEvent.click(screen.getByRole('button',{name:'Bộ lọc khác (1)',exact:true}));fireEvent.change(screen.getByLabelText('Người tiếp nhận thu hồi'),{target:{value:'Khôi'}});await waitFor(()=>assert.equal(calls.at(-1)?.recovery_recipient,'Khôi'));fireEvent.keyDown(document,{key:'Escape'});fireEvent.change(screen.getByLabelText('Tìm chứng từ'),{target:{value:'MP126'}});await waitFor(()=>assert.equal(calls.at(-1)?.q,'MP126'));
 assert.ok(screen.getByRole('button',{name:'Xem 10.26.00001/PTH'}));assert.ok(screen.getByRole('button',{name:'In phiếu 10.26.00001/PTH'}));fireEvent.click(screen.getByRole('button',{name:'Thao tác khác 10.26.00001/PTH'}));assert.ok(screen.getByRole('menuitem',{name:'Lịch sử'}));assert.equal((screen.getByRole('menuitem',{name:'Sửa phiếu'})as HTMLButtonElement).disabled,true);
});

test("recovery document client sends dedicated filters and rejects malformed classification totals",async()=>{
 let url='';const response={data:[],pagination:{page:1,page_size:20,total:0},receipt_totals:{count:0,status_counts:{posted:0,cancelled:0},quantity_milli:'0',units:[],net:'0',vat:'0',gross:'0',recovery_counts:{CSD:0,CSC:0,KSD:0,CTL:0}}};const client=createDocumentClient(async(input)=>{url=String(input);return Response.json(response)});await client.list({kind:'recovery',part_id:'p',recovery_classification:'CSD',recovery_vehicle:'51R',recovery_recipient:'Khôi'});const params=new URL(url,'https://test.invalid').searchParams;assert.equal(params.get('part_id'),'p');assert.equal(params.get('recovery_classification'),'CSD');assert.equal(params.get('include_totals'),'1');response.receipt_totals.recovery_counts.CSD=-1;await assert.rejects(()=>client.list({kind:'recovery'}));
});


test('issue installation header chooses a paired device and clears old measurements when the set changes',async()=>{
 const {IssueHeader}=await import('../src/documents/IssueHeader'),{emptyIssueDetails}=await import('../shared/issueDetails');const p=await preview();let current=emptyDraft('issue');
 current.issue_details={...emptyIssueDetails(),vehicle_id:'vehicle-1',vehicle_plate:'50H-110.99',driver_id:'driver',driver_name:'Tài xế',odo:'1046457',trailer_number:'51R-047.31',other:'MP126'};
 function Harness(){const [draft,setDraft]=React.useState(current);current=draft;return <IssueHeader draft={draft} setDraft={setDraft} api={p.catalog} documents={p.documents} disabled={false} onBusyChange={React.useCallback(()=>{},[])}/>}
 render(<Harness/>);const target=screen.getByLabelText('Phương tiện lắp thiết bị');assert.ok(target.textContent?.includes('51R-047.31'));assert.ok(target.textContent?.includes('MP126'));
 fireEvent.change(target,{target:{value:'trailer'}});assert.equal(current.issue_details?.installation_target,'trailer');assert.equal((screen.getByLabelText('ODO lúc lắp')as HTMLInputElement).value,'');assert.equal((screen.getByLabelText('ODO lúc lắp')as HTMLInputElement).disabled,false);
 fireEvent.change(screen.getByLabelText('ODO lúc lắp'),{target:{value:'321,5'}});assert.equal(normalizeDraftInput(current).issue_details?.installation_odo,'321.5');
 fireEvent.change(target,{target:{value:'generator'}});assert.equal(current.issue_details?.installation_odo,'');assert.equal((screen.getByLabelText('ODO lúc lắp')as HTMLInputElement).disabled,true);fireEvent.change(screen.getByLabelText('Giờ máy lúc lắp'),{target:{value:'12,25'}});assert.equal(normalizeDraftInput(current).issue_details?.installation_hours,'12.25');
 fireEvent.change(screen.getByLabelText('Máy phát',{exact:true}),{target:{value:'MP999'}});assert.equal(current.issue_details?.installation_target,'');assert.equal(current.issue_details?.installation_hours,'');assert.equal(current.lines[0].target_id,'');
});

test('issue installation selection parses and appears in print and Excel',async()=>{
 const {emptyIssueDetails,requireIssueInstallation}=await import('../shared/issueDetails');const {IssuePrint}=await import('../src/documents/IssuePrint');const {buildIssueWorkbook}=await import('../src/documents/issueExcel');const {renderToStaticMarkup}=await import('react-dom/server');const {unzipSync,strFromU8}=await import('fflate');
 const p=await preview();const record=await p.documents.get((await p.documents.list({kind:'receipt'})).data[0].id);record.draft.kind='issue';record.draft.lines=record.draft.lines.map(l=>({...l,unit_price:'',vat_rate:'0',source_line_id:''}));record.draft.issue_details={...emptyIssueDetails(),vehicle_id:'v',vehicle_plate:'50H-110.99',trailer_number:'51R-047.31',installation_target:'trailer',installation_odo:'321.5'};
 assert.doesNotThrow(()=>requireIssueInstallation(record.draft.issue_details));assert.throws(()=>requireIssueInstallation({...record.draft.issue_details,installation_target:''}));
 assert.equal(parseDraft(record.draft).issue_details?.installation_target,'trailer');assert.throws(()=>parseDraft({...record.draft,issue_details:{...record.draft.issue_details,installation_target:'arbitrary'}}));
 const html=renderToStaticMarkup(<IssuePrint row={record}/>);assert.ok(html.includes('Phương tiện lắp thiết bị'));assert.ok(html.includes('Rơ moóc · 51R-047.31'));
 const xml=strFromU8(unzipSync(buildIssueWorkbook(record))['xl/worksheets/sheet1.xml']);assert.ok(xml.includes('Phương tiện lắp thiết bị'));assert.ok(xml.includes('Rơ moóc · 51R-047.31'));
});
