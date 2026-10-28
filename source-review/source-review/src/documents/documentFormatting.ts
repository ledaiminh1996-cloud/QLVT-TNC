export const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
        value,
      ) + " đ";

/** Formats stored business dates without a UTC conversion or day shift. */
export function documentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}
/** Business timestamps are local wall-clock values, with no UTC conversion. */
export function documentDateTime(value:string):string {
  const date=documentDate(value), time=/T(\d{2}:\d{2})/.exec(value)?.[1];
  return date==="—"?date:date+(time?" "+time:"");
}
export function parseDocumentDateTime(value:string):string {
  const match=/^(\d{2}\/\d{2}\/\d{4}) ([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if(!match)return "";
  const date=parseDocumentDate(match[1]);
  return date?date+"T"+match[2]+":"+match[3]:"";
}
export function parseDocumentDate(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return "";
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}

/** Audit timestamps are UTC instants; display them in Vietnam time. */
export function documentCreatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const valueOf=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  return `${valueOf("day")}/${valueOf("month")}/${valueOf("year")} ${valueOf("hour")}:${valueOf("minute")}`;
}
