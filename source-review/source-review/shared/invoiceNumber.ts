/** Invoice identifiers are text: leading zeroes must survive API and export. */
export function normalizeInvoiceNumber(value: string): string {
  const digits = value.trim();
  if (!digits) return "";
  if (!/^[0-9]{1,8}$/.test(digits))
    throw new Error("Số hóa đơn chỉ gồm chữ số, tối đa 8 số.");
  return digits.padStart(8, "0");
}
export function displayInvoiceNumber(value?: string): string {
  const raw = value ?? "";
  return /^[0-9]{1,8}$/.test(raw.trim()) ? raw.trim().padStart(8, "0") : raw;
}
