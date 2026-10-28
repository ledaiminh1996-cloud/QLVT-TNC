/** Canonical Vietnamese case-insensitive matching; accents remain meaningful. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').toLocaleLowerCase('vi-VN');
}
export function searchIncludes(value: unknown, query: unknown): boolean {
  return normalizeSearch(value).includes(normalizeSearch(query).trim());
}
export function searchPattern(query: string): string {
  return '%' + normalizeSearch(query.trim()).replace(/[\\%_]/g, '\\$&') + '%';
}
