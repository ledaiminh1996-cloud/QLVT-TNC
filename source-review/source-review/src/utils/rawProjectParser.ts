// Parser and converter for the user's project JSON/CSV export

export interface RawLineItem {
  ma: string;
  ten: string;
  dvt: string;
  soLuong: number;
  serial?: string;
  phuongTien: string;
  loaiThietBi?: string;
  odoLap?: number;
  bonDau?: string;
  tenTaiXe?: string;
  trangThaiKho?: string;
}

export interface RawLineForm {
  soPhieu: string;
  ngay: string;
  gioLap?: string;
  kho: string;
  trangThaiKho: string;
  mucDich: string;
  nguoiNhan?: string;
  dienGiai: string;
  items: RawLineItem[];
}

export interface RawLine {
  row: number;
  key: string;
  hash: string;
  form: RawLineForm;
  status: string;
  receipt: string;
  time: string;
  error?: string;
  expected?: string;
  createdAt: string;
  creatorEmail?: string;
  creatorName?: string;
}

export interface RawBatch {
  id: string;
  author: string;
  authorName: string;
  hash: string;
  status: string;
  created: string;
  lines: RawLine[];
}

// Convert DD/MM/YYYY to YYYY-MM-DD
export function parseDateVN(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// Extract Trailer Plate and driver from description if present
// e.g. "Xuất dầu cho LX - Hoàng Văn Huy - 50H-048.53 - 51R-254.81 - KHODAU6"
export function extractTrailerAndDriver(dienGiai: string) {
  let driver = '';
  let tractor = '';
  let trailer = '';
  let isReefer = false; // Máy lạnh

  if (dienGiai.toLowerCase().includes('máy lạnh') || dienGiai.toLowerCase().includes('may lanh')) {
    isReefer = true;
  }

  // Regex to match plates like 50H-048.53, 51D-308.50, 15H-061.51, 36C-339.73, 50E-858.25
  const plateMatches = dienGiai.match(/\b([0-9]{2}[A-Z]-[0-9]{3}\.[0-9]{2}|[0-9]{2}[A-Z]{1,2}-[0-9]{3}\.[0-9]{2}|[0-9]{2}[A-Z]{1,2}-[0-9]{3}\.[0-9]{2})\b/g);

  // Extract driver name between "LX -" and next "-"
  const lxMatch = dienGiai.match(/LX\s*-\s*([^-\n]+)/i);
  if (lxMatch) {
    driver = lxMatch[1].trim();
  }

  if (plateMatches && plateMatches.length >= 1) {
    tractor = plateMatches[0];
    if (plateMatches.length >= 2) {
      trailer = plateMatches[1];
    }
  }

  return { driver, tractor, trailer, isReefer };
}
