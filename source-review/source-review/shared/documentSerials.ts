import type { DraftLine } from "./documents.ts";
export const MAX_SERIALS_PER_LINE = 500;
export function serialKey(value: string): string {
  return value.trim().normalize("NFC").toLocaleUpperCase("vi-VN");
}
export function lineSerials(line: DraftLine): string[] {
  return line.serials ?? (line.serial ? [line.serial] : []);
}
export function serialFormatError(value: string): string {
  return !value.trim()
    ? "Serial trống"
    : value.length > 128 || /[\s\u0000-\u001f\u007f]/u.test(value)
      ? "Serial tối đa 128 ký tự, không chứa khoảng trắng hoặc ký tự điều khiển"
      : "";
}
export function serialRange(
  prefix: string,
  from: string,
  to: string,
): string[] {
  if (!/^\d{1,12}$/.test(from) || !/^\d{1,12}$/.test(to))
    throw new Error("Số đầu/cuối phải là số nguyên, tối đa 12 chữ số.");
  const a = BigInt(from),
    b = BigInt(to);
  if (b < a || b - a + 1n > BigInt(MAX_SERIALS_PER_LINE))
    throw new Error(
      "Dải cần từ 1 đến 500 serial, số cuối không nhỏ hơn số đầu.",
    );
  return Array.from(
    { length: Number(b - a + 1n) },
    (_, i) =>
      prefix +
      (a + BigInt(i))
        .toString()
        .padStart(Math.max(from.length, to.length), "0"),
  );
}
