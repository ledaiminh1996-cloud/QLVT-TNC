import {
  proposalSections,
  proposalPlans,
  proposalEvidence,
  type ProposalData,
} from "../../shared/proposal";
import {
  emptyLine,
  type DocumentDraft,
  type DraftLine,
} from "../../shared/documents";
import type { CatalogClient, CatalogRow } from "../api/catalogClient";
import { CatalogPicker, docInput, docButton } from "./CatalogPicker";
export function ProposalForm({
  draft,
  onChange,
  disabled,
  api,
  labels,
  remember,
}: {
  draft: DocumentDraft;
  onChange: (d: DocumentDraft) => void;
  disabled: boolean;
  api: CatalogClient;
  labels: Record<string, string>;
  remember: (r: string, id: string, row?: CatalogRow) => void;
}) {
  const p = draft.proposal ?? {},
    patch = (key: keyof ProposalData, value: string) =>
      onChange({ ...draft, proposal: { ...p, [key]: value } });
  const setLine = (id: string, change: Partial<DraftLine>) =>
    onChange({
      ...draft,
      lines: draft.lines.map((l) => (l.id === id ? { ...l, ...change } : l)),
    });
  const checks = (key: "plans" | "evidence", options: string[]) => (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            disabled={disabled}
            checked={(p[key] ?? "").split(";").includes(o)}
            onChange={(e) =>
              patch(
                key,
                e.target.checked
                  ? [...(p[key] ?? "").split(";").filter(Boolean), o].join(";")
                  : (p[key] ?? "")
                      .split(";")
                      .filter((x) => x !== o)
                      .join(";"),
              )
            }
          />
          {o}
        </label>
      ))}
    </div>
  );
  const fields = (section: (typeof proposalSections)[number]) => (
    <section
      key={section[0]}
      className="space-y-3 rounded-xl border border-slate-200 p-3"
    >
      <h3 className="text-sm font-bold">{section[0]}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {section[1].map((f) => {
          const type: string = f.length > 2 ? (f[2] ?? "text") : "text",
            value = p[f[0]] ?? "";
          return (
            <label
              key={f[0]}
              className={
                "text-xs font-semibold " +
                (type === "textarea" ? "sm:col-span-2" : "")
              }
            >
              {f[1]}
              {type.includes("|") ? (
                <select
                  className={docInput + " mt-1"}
                  disabled={disabled}
                  value={value}
                  onChange={(e) => patch(f[0], e.target.value)}
                >
                  <option value="">Chưa xác định</option>
                  {type.split("|").map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : type === "textarea" ? (
                <textarea
                  rows={2}
                  className={docInput + " mt-1"}
                  disabled={disabled}
                  value={value}
                  onChange={(e) => patch(f[0], e.target.value)}
                />
              ) : (
                <input
                  className={
                    docInput +
                    " mt-1" +
                    (type === "amount" ? " text-right tabular-nums" : "")
                  }
                  type={type === "amount" ? "text" : type}
                  inputMode={type === "amount" ? "decimal" : undefined}
                  placeholder={type === "amount" ? "Chưa xác định" : undefined}
                  disabled={disabled}
                  value={value}
                  onChange={(e) => patch(f[0], e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
      {section[0].startsWith("1.3") && checks("plans", proposalPlans)}
      {section[0].startsWith("2.4") && (
        <>
          {checks("evidence", proposalEvidence)}
          <p className="text-xs text-slate-500">
            Ghi tên tệp / số tài liệu; chức năng tải tệp chưa kết nối.
          </p>
        </>
      )}
    </section>
  );
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        Mẫu 01 · Kính gửi Tổng Giám đốc hoặc người được ủy quyền; bộ phận vật tư
        và kỹ thuật. Chọn nhiều phương án khi cần. Phê duyệt đề xuất chưa tạo
        nhập, xuất hoặc thanh lý.
      </p>
      {proposalSections.slice(0, 3).map(fields)}
      {(["remove", "install"] as const).map((side) => (
        <section key={side} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">
              {side === "remove"
                ? "2.1. Vật tư dự kiến tháo / thu hồi"
                : "2.2. Vật tư dự kiến cấp / lắp vào"}
            </h3>
            <button
              type="button"
              className={docButton}
              disabled={disabled || draft.lines.length >= 60}
              onClick={() =>
                onChange({
                  ...draft,
                  lines: [
                    ...draft.lines,
                    { ...emptyLine(), proposal_side: side },
                  ],
                })
              }
            >
              + Thêm dòng
            </button>
          </div>
          {side === "remove" && (
            <p className="text-xs text-amber-700">
              Đề nghị loại bỏ vẫn phải thu hồi và quản lý; không tự thanh lý
              hoặc tiêu hủy.
            </p>
          )}
          <div className="space-y-2">
            {draft.lines
              .filter((l) => (l.proposal_side ?? "install") === side)
              .map((l, i) => (
                <div
                  key={l.id}
                  className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <CatalogPicker
                    api={api}
                    resource="parts"
                    label={"Vật tư " + (i + 1)}
                    value={l.part_id}
                    selectedLabel={labels["parts:" + l.part_id]}
                    disabled={disabled}
                    onChange={(id, row) => {
                      remember("parts", id, row);
                      setLine(l.id, { part_id: id });
                    }}
                  />
                  {(
                    [
                      ["quantity", "Số lượng"],
                      ["serial", "Serial / Nhận dạng"],
                      ["proposal_description", "Tên / Quy cách bổ sung"],
                      [
                        "proposal_location",
                        side === "remove"
                          ? "Xe thiết bị / Vị trí tháo"
                          : "Xe thiết bị / Vị trí lắp",
                      ],
                      ["proposal_destination", "Nơi nhận"],
                      ["proposal_link", "Mã liên kết"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="text-xs font-semibold" key={key}>
                      {label}
                      <input
                        className={
                          docInput +
                          " mt-1" +
                          (key === "quantity" ? " text-right tabular-nums" : "")
                        }
                        disabled={disabled}
                        value={l[key] ?? ""}
                        onChange={(e) =>
                          setLine(l.id, {
                            [key]: e.target.value,
                            ...(key === "serial" ? { serials: undefined } : {}),
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="text-xs font-semibold">
                    {side === "remove"
                      ? "Hiện trạng / Phân loại"
                      : "Tình trạng"}
                    <select
                      className={docInput + " mt-1"}
                      disabled={disabled}
                      value={l.proposal_condition ?? ""}
                      onChange={(e) =>
                        setLine(l.id, { proposal_condition: e.target.value })
                      }
                    >
                      <option value="">Chưa xác định</option>
                      {(side === "remove"
                        ? [
                            "Còn dùng được",
                            "Chờ sửa",
                            "Chờ kiểm tra",
                            "Đề nghị loại bỏ",
                          ]
                        : ["Mới", "Đã dùng còn tốt", "Sau sửa chữa"]
                      ).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  {side === "install" && (
                    <label className="text-xs font-semibold">
                      Nguồn cấp
                      <select
                        className={docInput + " mt-1"}
                        disabled={disabled}
                        value={l.proposal_source ?? ""}
                        onChange={(e) =>
                          setLine(l.id, { proposal_source: e.target.value })
                        }
                      >
                        <option value="">Chưa xác định</option>
                        {[
                          "Tồn kho",
                          "Điều chuyển từ xe hoặc thiết bị khác",
                          "Mua ngoài",
                          "Sửa xong cấp lại",
                        ].map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="self-center text-xs text-slate-500">
                    ĐVT: {labels["unit:" + l.part_id] ?? "—"}
                  </p>
                  <button
                    className={docButton + " self-end text-rose-600"}
                    type="button"
                    disabled={disabled || draft.lines.length === 1}
                    onClick={() =>
                      onChange({
                        ...draft,
                        lines: draft.lines.filter((x) => x.id !== l.id),
                      })
                    }
                  >
                    Xóa dòng
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
      {proposalSections.slice(3).map(fields)}
      <p className="text-xs text-slate-500">
        Dự toán chỉ cộng mua ngoài + công sửa thuê ngoài + chi phí khác; cộng
        thuế riêng theo báo giá. Để trống khoản chưa biết, nhập 0 khi đã xác
        nhận không phát sinh.
      </p>
      <section className="rounded-xl border border-slate-200 p-3 text-xs">
        <h3 className="mb-2 text-sm font-bold">
          4. Xác nhận và quyết định phê duyệt
        </h3>
        <p>
          Người đề xuất → Phụ trách Nghi Sơn / Trưởng bộ phận → Kỹ thuật → Vật
          tư → Người có thẩm quyền.
        </p>
        <p className="mt-2 text-slate-500">
          Các bước và tài khoản được phân công tại Quy trình phê duyệt. Quyết
          định được ghi bằng thao tác duyệt / trả về / từ chối và nhật ký; người
          lập không tự nhập chữ ký.
        </p>
      </section>
    </div>
  );
}
