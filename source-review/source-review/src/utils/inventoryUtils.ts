import { SparePart, Vehicle, MountedComponent, InventoryTransaction } from '../types/inventory';

// Định dạng tiền tệ VNĐ chuẩn
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Định dạng số nguyên có dấu phẩy
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

// Định dạng ngày DD/MM/YYYY
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// Kiểm tra trạng thái tồn kho của phụ tùng
export function getStockStatus(part: SparePart): {
  status: 'critical' | 'low' | 'normal';
  label: string;
  badgeClass: string;
  shortageQty: number;
} {
  if (part.currentStock <= 0) {
    return {
      status: 'critical',
      label: 'Hết hàng (Tồn 0)',
      badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/20',
      shortageQty: part.minStock
    };
  }
  if (part.currentStock <= part.minStock) {
    return {
      status: 'low',
      label: `Cảnh báo thiếu (Tồn ${part.currentStock}/${part.minStock})`,
      badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
      shortageQty: part.minStock - part.currentStock
    };
  }
  return {
    status: 'normal',
    label: 'Đủ tồn kho an toàn',
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    shortageQty: 0
  };
}

// Tính toán mức hao mòn & hạn bảo dưỡng của linh kiện lắp trên xe
export interface WearCalculation {
  kmUsed: number;
  kmRemaining: number;
  kmPercentage: number;
  daysUsed: number;
  daysRemaining: number;
  daysPercentage: number;
  maxPercentage: number;
  urgency: 'critical' | 'warning' | 'normal';
  urgencyText: string;
  recommendedAction: string;
}

export function calculateComponentWear(
  component: MountedComponent,
  vehicle: Vehicle | undefined
): WearCalculation {
  const currentOdo = vehicle ? vehicle.currentOdoKm : component.mountOdoKm;
  const kmUsed = Math.max(0, currentOdo - component.mountOdoKm);
  
  let kmRemaining = 0;
  let kmPercentage = 0;
  if (component.lifespanKmLimit && component.lifespanKmLimit > 0) {
    kmRemaining = component.lifespanKmLimit - kmUsed;
    kmPercentage = Math.round((kmUsed / component.lifespanKmLimit) * 100);
  }

  // Tính ngày đã sử dụng
  const mountDate = new Date(component.mountDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - mountDate.getTime());
  const daysUsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let daysRemaining = 0;
  let daysPercentage = 0;
  if (component.lifespanDaysLimit && component.lifespanDaysLimit > 0) {
    daysRemaining = component.lifespanDaysLimit - daysUsed;
    daysPercentage = Math.round((daysUsed / component.lifespanDaysLimit) * 100);
  }

  const maxPercentage = Math.max(kmPercentage, daysPercentage);

  let urgency: 'critical' | 'warning' | 'normal' = 'normal';
  let urgencyText = 'Đang hoạt động tốt';
  let recommendedAction = 'Tiếp tục theo dõi định kỳ';

  if (maxPercentage >= 100) {
    urgency = 'critical';
    urgencyText = 'ĐÃ QUÁ HẠN ĐỊNH MỨC';
    recommendedAction = 'Yêu cầu kiểm tra & xuất kho thay thế khẩn cấp!';
  } else if (maxPercentage >= 80) {
    urgency = 'warning';
    urgencyText = `Sắp đến hạn (${maxPercentage}%)`;
    recommendedAction = 'Lên lịch bảo trì/đặt hàng vật tư dự phòng';
  }

  return {
    kmUsed,
    kmRemaining,
    kmPercentage,
    daysUsed,
    daysRemaining,
    daysPercentage,
    maxPercentage,
    urgency,
    urgencyText,
    recommendedAction
  };
}

// Bảng tính Xuất - Nhập - Tồn chi tiết trong kỳ
export interface InventoryBalanceRow {
  partId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  specifications: string;
  storageLocation: string;
  minStock: number;
  openingStock: number; // Tồn đầu kỳ
  inQty: number;        // Nhập trong kỳ
  inAmount: number;     // Giá trị nhập
  outQty: number;       // Xuất trong kỳ
  outAmount: number;    // Giá trị xuất
  closingStock: number; // Tồn cuối kỳ
  closingAmount: number;// Giá trị tồn
  stockStatus: 'critical' | 'low' | 'normal';
  shortageQty: number;
  suggestedReorder: number;
}

export function computeInventoryBalance(
  parts: SparePart[],
  transactions: InventoryTransaction[],
  startDate?: string,
  endDate?: string
): InventoryBalanceRow[] {
  // Lọc giao dịch theo khoảng ngày nếu có
  const filteredTxs = transactions.filter(tx => {
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  });

  return parts.map(part => {
    // Tính tổng nhập & xuất trong kỳ
    let inQty = 0;
    let inAmount = 0;
    let outQty = 0;
    let outAmount = 0;

    filteredTxs.forEach(tx => {
      tx.items.forEach(item => {
        if (item.partId === part.id) {
          if (tx.type === 'IN') {
            inQty += item.quantity;
            inAmount += item.totalPrice;
          } else if (tx.type === 'OUT') {
            outQty += item.quantity;
            outAmount += item.totalPrice;
          }
        }
      });
    });

    // Tồn cuối kỳ = tồn thực tế hiện tại
    const closingStock = part.currentStock;
    const closingAmount = closingStock * part.avgCostPrice;
    
    // Tồn đầu kỳ ước tính = Tồn cuối - Nhập + Xuất
    const openingStock = Math.max(0, closingStock - inQty + outQty);

    const statusObj = getStockStatus(part);
    // Gợi ý số lượng đặt hàng nếu thiếu
    const suggestedReorder = part.currentStock < part.minStock ? (part.minStock * 2) - part.currentStock : 0;

    return {
      partId: part.id,
      sku: part.sku,
      name: part.name,
      category: part.category,
      unit: part.unit,
      specifications: part.specifications,
      storageLocation: part.storageLocation,
      minStock: part.minStock,
      openingStock,
      inQty,
      inAmount,
      outQty,
      outAmount,
      closingStock,
      closingAmount,
      stockStatus: statusObj.status,
      shortageQty: statusObj.shortageQty,
      suggestedReorder
    };
  });
}

// Xuất file CSV tiêu chuẩn (có BOM UTF-8 để mở tiếng Việt trên Microsoft Excel không bị lỗi phông)
export function exportToCSV(filename: string, rows: Record<string, any>[], headers: { key: string; label: string }[]) {
  const headerLine = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  const lines = rows.map(row => {
    return headers.map(h => {
      const val = row[h.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
