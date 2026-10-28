import { useEffect, useRef, useState } from "react";
import { documentDate, parseDocumentDate,documentDateTime,parseDocumentDateTime } from "./documentFormatting";
import { docInput } from "./CatalogPicker";
/** Text input fixes the visible format independently of browser/OS language. */
export function DocumentDateInput({
  value,
  withTime = false,
  onChange,
  label,
  disabled = false,
  required = false,
  className = "",
  onValidityChange,
}: {
  value: string;
  withTime?:boolean;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onValidityChange?: (valid: boolean) => void;
}) {
  const format=withTime?documentDateTime:documentDate;
  const [text, setText] = useState(value ? format(value) : "");
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(value ? format(value) : "");
    }
  }, [value,withTime]);
  return (
    <input
      aria-label={label}
      type="text"
      inputMode={withTime?"text":"numeric"}
      placeholder={withTime?"dd/mm/yyyy HH:mm":"dd/mm/yyyy"}
      maxLength={withTime?16:10}
      pattern={withTime?"[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}":"[0-9]{2}/[0-9]{2}/[0-9]{4}"}
      required={required}
      disabled={disabled}
      className={docInput + " font-sans tabular-nums " + className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const iso = withTime?parseDocumentDateTime(raw):parseDocumentDate(raw);
        emitted.current = iso;
        onChange(iso);
        onValidityChange?.(!raw || !!iso);
        e.target.setCustomValidity(
          raw && !iso ? (withTime?"Nhập ngày giờ hợp lệ theo dd/mm/yyyy HH:mm (giờ 00–23, phút 00–59).":"Nhập ngày hợp lệ theo dd/mm/yyyy.") : "",
        );
      }}
    />
  );
}
