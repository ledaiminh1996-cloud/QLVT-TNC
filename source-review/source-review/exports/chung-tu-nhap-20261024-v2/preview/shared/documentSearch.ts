export function foldDocumentSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
export function documentSearchPattern(value: string): string {
  return (
    "%" + foldDocumentSearch(value.trim()).replace(/[\\%_]/g, "\\$&") + "%"
  );
}
