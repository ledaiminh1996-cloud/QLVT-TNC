import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, RefreshCw } from "lucide-react";
import type { DocumentWorkflow, ApprovalStep } from "../../shared/documents";
import type { DocumentClient, Approver } from "./documentClient";
import type { CatalogClient } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import { CatalogPicker, docButton, docInput } from "./CatalogPicker";
import { proposalTypes } from "./DocumentEditor";
import { StatusBadge } from "../components/StatusBadge";
import { MenuIcon } from "../components/MenuIcon";
export function DocumentWorkflows({
  documents,
  api,
  canEdit,
}: {
  documents: DocumentClient;
  api: CatalogClient;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<DocumentWorkflow[]>(),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [form, setForm] = useState<{ row?: DocumentWorkflow }>();
  useEffect(() => {
    const c = new AbortController();
    setRows(undefined);
    setError("");
    documents
      .workflows(c.signal)
      .then((value) => {
        if (!c.signal.aborted) setRows(value);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(accessMessage(e));
      });
    return () => c.abort();
  }, [documents, revision]);
  return (
    <section className="catalog-page space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 font-bold">
          <MenuIcon menuId="ht_quy_trinh" className="text-blue-600" />
          Quy trình duyệt đề xuất
        </h2>
        <div className="flex gap-2">
          <button
            className={docButton}
            aria-label="Tải lại quy trình"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={14} />
          </button>
          {canEdit && (
            <button
              className={docButton + " !bg-blue-600 !text-white"}
              onClick={() => setForm({})}
            >
              <Plus size={14} />
              Thêm quy trình
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Mỗi bộ phận và loại đề xuất có một quy trình. Khi gửi duyệt, phiếu lưu
        bản chụp quy trình; thay đổi ở đây không đổi phiếu đang duyệt. Duyệt
        xong chưa làm thay đổi tồn kho.
      </p>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : !rows ? (
        <p role="status">Đang tải quy trình…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="catalog-table w-full min-w-[640px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th>Tên quy trình</th>
                <th>Loại đề xuất</th>
                <th className="text-right">Số bước</th>
                <th className="text-center">Trạng thái</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="font-semibold">{row.name}</td>
                  <td>{proposalTypes[row.proposal_type]}</td>
                  <td className="text-right tabular-nums">
                    {row.steps.length}
                  </td>
                  <td className="text-center">
                    <StatusBadge value={row.is_active} />
                  </td>
                  <td className="text-center">
                    {canEdit && (
                      <button
                        className={docButton + " !min-h-7 !px-2"}
                        aria-label={"Sửa " + row.name}
                        onClick={() => setForm({ row })}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-slate-500">
                    Chưa có quy trình duyệt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {form && (
        <WorkflowEditor
          documents={documents}
          api={api}
          row={form.row}
          onClose={() => setForm(undefined)}
          onSaved={() => {
            setForm(undefined);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
function WorkflowEditor({
  documents,
  api,
  row,
  onClose,
  onSaved,
}: {
  documents: DocumentClient;
  api: CatalogClient;
  row?: DocumentWorkflow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row?.name ?? ""),
    [department, setDepartment] = useState(row?.department_id ?? ""),
    [deptLabel, setDeptLabel] = useState(""),
    [kind, setKind] = useState(row?.proposal_type ?? "purchase"),
    [active, setActive] = useState(row?.is_active ?? 1),
    [steps, setSteps] = useState<ApprovalStep[]>(() =>
      row
        ? structuredClone(row.steps)
        : [{ label: "Duyệt đề xuất", mode: "any", approver_ids: [] }],
    ),
    [users, setUsers] = useState<Approver[]>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    documents
      .approvers(c.signal)
      .then((value) => {
        if (!c.signal.aborted) setUsers(value);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(accessMessage(e));
      });
    return () => c.abort();
  }, [documents]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Cấu hình quy trình duyệt"
        className="max-h-[92dvh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl bg-white p-5 text-slate-900"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (
              !name.trim() ||
              !department ||
              steps.some((s) => !s.label.trim() || !s.approver_ids.length)
            )
              throw new Error("Nhập tên, bộ phận và người duyệt cho mọi bước.");
            await documents.saveWorkflow(
              {
                name,
                department_id: department,
                proposal_type: kind,
                is_active: active,
                steps,
              },
              row,
            );
            onSaved();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Không lưu được quy trình.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3 className="font-bold">Cấu hình quy trình duyệt</h3>
        <label className="block text-xs font-semibold">
          Tên quy trình
          <input
            autoFocus
            required
            className={docInput + " mt-1"}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <CatalogPicker
          api={api}
          resource="departments"
          label="Bộ phận *"
          value={department}
          selectedLabel={deptLabel}
          disabled={busy}
          onChange={(id, row) => {
            setDepartment(id);
            setDeptLabel(String(row?.name ?? ""));
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">
            Loại đề xuất
            <select
              className={docInput + " mt-1"}
              disabled={busy}
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {Object.entries(proposalTypes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Trạng thái
            <select
              className={docInput + " mt-1"}
              disabled={busy}
              value={active}
              onChange={(e) => setActive(Number(e.target.value))}
            >
              <option value={1}>Hoạt động</option>
              <option value={0}>Ngừng hoạt động</option>
            </select>
          </label>
        </div>
        {steps.map((step, index) => (
          <section
            key={index}
            className="space-y-2 rounded-lg border border-slate-200 p-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold">Bước {index + 1}</h4>
              <button
                type="button"
                className={docButton + " !min-h-7"}
                aria-label={"Xóa bước " + (index + 1)}
                disabled={busy || steps.length === 1}
                onClick={() => setSteps((s) => s.filter((_, i) => i !== index))}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <input
              aria-label={"Tên bước " + (index + 1)}
              className={docInput}
              value={step.label}
              disabled={busy}
              onChange={(e) =>
                setSteps((rows) =>
                  rows.map((s, i) =>
                    i === index ? { ...s, label: e.target.value } : s,
                  ),
                )
              }
            />
            <select
              aria-label={"Cách duyệt bước " + (index + 1)}
              className={docInput}
              disabled={busy}
              value={step.mode}
              onChange={(e) =>
                setSteps((rows) =>
                  rows.map((s, i) =>
                    i === index
                      ? { ...s, mode: e.target.value as "any" | "all" }
                      : s,
                  ),
                )
              }
            >
              <option value="any">Một người trong nhóm duyệt</option>
              <option value="all">
                Tất cả người được phân công phải duyệt
              </option>
            </select>
            <fieldset
              disabled={busy || !users}
              className="grid gap-2 sm:grid-cols-2"
            >
              <legend className="mb-1 text-xs font-semibold">
                Người duyệt
              </legend>
              {users
                ?.filter((u) => u.role !== "viewer")
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={step.approver_ids.includes(u.id)}
                      onChange={(e) =>
                        setSteps((rows) =>
                          rows.map((s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  approver_ids: e.target.checked
                                    ? [...s.approver_ids, u.id]
                                    : s.approver_ids.filter(
                                        (id) => id !== u.id,
                                      ),
                                }
                              : s,
                          ),
                        )
                      }
                    />
                    {u.display_name}
                  </label>
                ))}
              {!users && (
                <p role="status" className="text-xs">
                  Đang tải người duyệt…
                </p>
              )}
            </fieldset>
          </section>
        ))}
        <button
          type="button"
          className={docButton}
          disabled={busy || steps.length >= 10}
          onClick={() =>
            setSteps((s) => [
              ...s,
              {
                label: "Bước duyệt " + (s.length + 1),
                mode: "any",
                approver_ids: [],
              },
            ])
          }
        >
          <Plus size={14} />
          Thêm bước
        </button>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={docButton}
            disabled={busy}
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="submit"
            className={docButton + " !bg-blue-600 !text-white"}
            disabled={busy || !users}
          >
            {busy ? "Đang lưu…" : "Lưu quy trình"}
          </button>
        </div>
      </form>
    </div>
  );
}
