import { useEffect, useState } from "react";
import type { CatalogClient } from "../api/catalogClient";
import { accessMessage } from "../api/catalogClient";
import { docInput } from "./CatalogPicker";
export interface VatOption {
  value: string;
  label: string;
}
export function useVatRates(api: CatalogClient, enabled: boolean) {
  const [rates, setRates] = useState<VatOption[]>([]),
    [pending, setPending] = useState(enabled),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setPending(true);
    setError("");
    api
      .list("vat-rates", {
        status: "1",
        pageSize: 100,
        signal: controller.signal,
      })
      .then((p) => {
        if (!controller.signal.aborted)
          setRates(
            p.data
              .map((r) => ({
                value: String(r.rate_pct),
                label: String(r.rate_pct) + "%",
              }))
              .sort((a, b) => Number(a.value) - Number(b.value)),
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(accessMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [api, enabled, revision]);
  return { rates, pending, error, retry: () => setRevision((n) => n + 1) };
}
export function VatSelect({
  value,
  onChange,
  label,
  disabled,
  rates,
  pending,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled: boolean;
  rates: VatOption[];
  pending: boolean;
}) {
  const known = rates.some((r) => r.value === value);
  return (
    <select
      aria-label={label}
      className={docInput + " text-right font-sans tabular-nums"}
      value={value}
      disabled={disabled || pending}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && (
        <option value={value} disabled>
          {pending ? "Đang tải…" : value ? value + "% (đã lưu)" : "Chọn VAT"}
        </option>
      )}
      {rates.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
