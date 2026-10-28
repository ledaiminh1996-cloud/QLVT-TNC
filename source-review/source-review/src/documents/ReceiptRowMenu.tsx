import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal,
  History,
  Download,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { docButton } from "./CatalogPicker";
export type ReceiptMenuAction =
  "history" | "excel" | "duplicate" | "cancel" | "edit";
export function ReceiptRowMenu({
  code,
  busy,
  writable,
  canEdit,
  canCancel,
  onAction,
  variant="receipt",
  onOpeningAction,
}: {
  variant?:"receipt"|"opening"|"recovery";
  onOpeningAction?:(action:"export"|"actions")=>void;
  code: string;
  busy: boolean;
  writable: boolean;
  canEdit: boolean;
  canCancel: boolean;
  onAction: (a: ReceiptMenuAction) => void;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const r = trigger.current?.getBoundingClientRect();
    if (r)
      setPosition({
        left: Math.max(8, Math.min(r.right - 240, innerWidth - 248)),
        top:
          r.bottom + 260 > innerHeight
            ? Math.max(8, r.top - 250)
            : r.bottom + 4,
      });
    const outside = (e: MouseEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const scroll = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("resize", scroll);
    window.addEventListener("scroll", scroll, true);
    const timer = setTimeout(
      () =>
        menu.current
          ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
          ?.focus({ preventScroll: true }),
      0,
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("resize", scroll);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  const items = variant!=="receipt"? [
    {key:"history",label:"Lịch sử",icon:History,disabled:false,title:"Xem lịch sử phiếu"},
    {key:"export",label:"Tải dữ liệu phiếu (JSON)",icon:Download,disabled:false,title:"Tải dữ liệu đã lưu"},
    ...(writable?[{key:"edit",label:"Sửa phiếu",icon:Pencil,disabled:!canEdit,title:canEdit?"Sửa phiếu":"Phiếu đã ghi sổ, có liên kết hoặc thuộc kỳ đã khóa"},...(canCancel?[{key:"actions",label:"Xử lý phiếu",icon:MoreHorizontal,disabled:false,title:"Xử lý phiếu nháp"}]:[])]:[]),
  ] : [
    {
      key: "history",
      label: "Lịch sử",
      icon: History,
      disabled: false,
      title: "Xem lịch sử phiếu",
    },
    {
      key: "excel",
      label: "Tải Excel (.xlsx)",
      icon: Download,
      disabled: false,
      title: "Tải phiếu và danh sách serial dạng Excel (.xlsx)",
    },
    ...(writable
      ? [
          {
            key: "duplicate",
            label: "Nhân bản",
            icon: Copy,
            disabled: false,
            title:
              "Tạo phiếu mới từ nội dung này; không sao chép serial và số phiếu",
          },
          {
            key: "edit",
            label: "Sửa phiếu",
            icon: Pencil,
            disabled: !canEdit,
            title: canEdit
              ? "Sửa phiếu chưa có phát sinh sử dụng"
              : "Phiếu đã có phát sinh hoặc không được phép sửa",
          },
          {
            key: "cancel",
            label: "Hủy phiếu",
            icon: Trash2,
            disabled: !canCancel,
            title: canCancel
              ? "Hủy phiếu và hoàn lại tồn kho; cần lý do"
              : "Phiếu đã ghi sổ/phát sinh hoặc đã hủy; không thể hủy trực tiếp",
          },
        ]
      : []),
  ];
  return (
    <>
      <button
        ref={trigger}
        type="button"
        title="Thao tác khác"
        aria-label={"Thao tác khác " + code}
        aria-haspopup="menu"
        aria-expanded={open}
        className={docButton + " !px-1.5"}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={"Thao tác phiếu " + code}
            className="fixed z-[90] w-60 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl"
            style={position}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                trigger.current?.focus();
              }
              const nodes = Array.from(
                menu.current?.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]:not([disabled])',
                ) ?? [],
              );
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const current = nodes.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                nodes[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? nodes.length - 1
                      : (current +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          nodes.length) %
                        nodes.length
                ]?.focus();
              }
              if (e.key === "Tab") setOpen(false);
            }}
          >
            {items.map((item) => (
              <button
                type="button"
                role="menuitem"
                key={item.key}
                title={item.title}
                disabled={item.disabled || busy}
                className={
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-40 " +
                  (item.key === "cancel"
                    ? "border-t border-slate-100 text-red-600"
                    : "")
                }
                onClick={() => {
                  setOpen(false);
                  if(item.key==="export"||item.key==="actions")onOpeningAction?.(item.key);else onAction(item.key as ReceiptMenuAction);
                }}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
