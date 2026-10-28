export function focusDocumentError(root: HTMLElement | null, message: string) {
  if (!root) return;
  const cost = message.match(/Chi phí (\d+)/i)?.[1];
  const row = message.match(/Dòng (\d+)/i)?.[1];
  const fields = [
    "Phương tiện lắp thiết bị",
    "ODO lúc lắp",
    "Giờ máy lúc lắp",
    "Tên chi phí",
    "Chi phí vận chuyển",
    "Chi phí bốc dỡ",
    "Chi phí nhân công thay thế lắp đặt",
    "Chi phí khác",
    "Thuế GTGT (nếu có)",
    "Số lượng chứng từ",
    "SL chứng từ",
    "Đơn giá",
    "Số tiền",
    "Số lượng",
    "VAT",
    "Thuế",
    "Serial",
    "Bồn",
    "Gói Data",
    "Vật tư",
    "Kho nhận",
    "Kho",
    "Bộ phận",
    "Lý do sửa",
  ];
  let field = fields.find((f) =>
    message.toLocaleLowerCase("vi-VN").includes(f.toLocaleLowerCase("vi-VN")),
  );
  if (field === "Số tiền") field = cost ? "Số tiền" : "Đơn giá";
  const controls = Array.from(
    root.querySelectorAll<HTMLElement>(
      "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
    ),
  );
  const target = controls.find((el) => {
    const text = (
      el.getAttribute("aria-label") ??
      el.closest("label")?.textContent ??
      (el.id ? root.querySelector(`label[for="${el.id}"]`)?.textContent : "") ??
      ""
    ).toLowerCase();
    return (
      (!field || text.includes(field.toLowerCase())) &&
      (!cost ||
        el.closest("[data-cost-number]")?.getAttribute("data-cost-number") ===
          cost) &&
      (!row ||
        el.closest("[data-line-number]")?.getAttribute("data-line-number") ===
          row ||
        text.includes("dòng " + row))
    );
  });
  controls.forEach((el) => el.removeAttribute("aria-invalid"));
  if (target) {
    target.setAttribute("aria-invalid", "true");
    target.focus();
    target.scrollIntoView?.({ block: "nearest" });
  }
}
