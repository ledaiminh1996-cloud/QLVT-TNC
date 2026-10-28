import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { docButton } from "./CatalogPicker";
export const receiptColumns = [
  { key: "net", label: "Tiền hàng (trước VAT)", width: 160 },
  { key: "vat", label: "Tiền VAT", width: 120 },
  { key: "creator", label: "Người tạo", width: 115 },
  { key: "created", label: "Ngày giờ tạo", width: 155 },
  { key: "quantity", label: "Tổng SL", width: 90 },
  { key: "serial", label: "Số serial", width: 145 },
  { key: "editor", label: "Người sửa cuối", width: 125 },
] as const;
export const optionalReceiptColumns = receiptColumns.filter((c) =>
  ["quantity", "serial", "editor"].includes(c.key),
);
export type ReceiptColumn = (typeof receiptColumns)[number]["key"];
export function ReceiptColumns({
  selected,
  onChange,
  allowed,
}: {
  selected: ReceiptColumn[];
  allowed?: ReceiptColumn[];
  onChange: (next: ReceiptColumn[]) => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node))
        root.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      ref={root}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          if (root.current) {
            root.current.open = false;
            root.current.querySelector("summary")?.focus();
          }
        }
      }}
    >
      <summary
        aria-label="Cột hiển thị"
        className={
          docButton +
          " cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        }
      >
        Cột hiển thị <ChevronDown size={14} />
      </summary>
      <div
        className="absolute right-0 top-full z-20 mt-1 w-60 space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        role="group"
        aria-label="Chọn cột bổ sung"
      >
        {optionalReceiptColumns
          .filter((c) => !allowed || allowed.includes(c.key))
          .map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.key)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, c.key]
                      : selected.filter((k) => k !== c.key),
                  )
                }
              />
              {c.label}
            </label>
          ))}
      </div>
    </details>
  );
}
