// Types for Tractor-Trailer Fleet, Spare Parts, Tire Lifecycle & Fuel Management (TNC System Rules)

export type VehicleType = 'tractor' | 'trailer' | 'office_car' | 'rented_truck'; // Đầu kéo | Rơ-moóc | Xe con VP | Xe thuê ngoài

export interface Vehicle {
  id: string;
  plateNumber: string; // Biển số xe: e.g. 50H-048.53, 51R-254.81
  type: VehicleType;
  brandModel: string; // Howo Sitrak, International, Doosung 3 Trục, Tân Thanh...
  manufactureYear: number;
  currentOdoKm: number; // Số KM Odometer hiện tại
  assignedDriver?: string; // Tài xế phụ trách
  status: 'active' | 'maintenance' | 'stopped';
  notes?: string;
  hasReefer?: boolean; // Có gắn máy lạnh rơ-moóc hay không
}

export type PartCategory = 
  | 'tires'        // Lốp xe & mâm (Có quản lý serial, đảo vỏ, đắp vỏ)
  | 'lubricants'   // Dầu DO, dầu nhớt động cơ, hộp số, mỡ bôi trơn
  | 'filters'      // Lọc dầu, lọc nhớt, ruột lọc sấy khí Wabco, lọc gió
  | 'brake'        // Bố thắng Fuwa, tăng bua, búp sen T30/30
  | 'suspension'   // Lá nhíp, bóng hơi Contitech, quai nhíp
  | 'coupling'     // Mâm kéo Jost, ắc moóc Kingpin, chân chống
  | 'electrical'   // Bình ắc quy 150Ah/200Ah, đèn led moóc
  | 'engine_trans' // Dây curoa, ly hợp, hộp số
  | 'accessories'; // Thiết bị GPS, SIM 4G, que thăm dầu, phụ kiện

export type TireStatus = 'new' | 'running' | 'retreaded' | 'recovered' | 'scrapped';

export interface TireDetail {
  serialNumber: string; // Số seri dập trên lốp (VD: BR-882910)
  brand: string; // Bridgestone, Michelin, Casumina, DRC, Double Coin...
  size: string; // 12R22.5, 11R22.5, 295/80R22.5
  status: TireStatus;
  currentVehiclePlate?: string;
  currentPosition?: string; // Trục 1 Lái (FL/FR), Cầu 1 Trong/Ngoài, Trục 1-2-3 Moóc
  mountDate?: string;
  mountOdoKm?: number;
  currentKmRun: number;
  retreadCount: number; // Số lần đắp vỏ (0: vỏ mới, 1: đắp lần 1, 2: đắp lần 2)
  treadDepthMm?: number; // Độ sâu gai lốp (mm) - Cảnh báo khi < 3mm
  notes?: string;
}

export interface SparePart {
  id: string;
  sku: string; // Mã vật tư: e.g. M-DC-TIEU-0020, VT-LOP-12R225
  name: string; // Tên phụ tùng vật tư
  category: PartCategory;
  unit: string; // Lít, Quả, Cái, Xô, Bình, Bộ...
  specifications: string; // Quy cách kỹ thuật
  applicableFor: 'tractor' | 'trailer' | 'both';
  minStock: number; // Mức tồn kho tối thiểu
  currentStock: number; // Số lượng tồn kho hiện tại
  avgCostPrice: number; // Đơn giá vốn bình quân (VNĐ)
  storageLocation: string; // Vị trí kho: Bồn 1 Kho Nghi Sơn, Bồn 2, Kệ Lốp A1...
  
  // Định mức kỹ thuật & tuổi thọ
  lifespanKmLimit?: number; // Định mức KM tối đa
  lifespanDaysLimit?: number; // Định mức ngày tối đa
  notes?: string;
}

// Bồn chứa dầu (TNC BonDau rules)
export interface FuelTank {
  id: string;
  code: string; // BON1-KHONGHISON, BON2-KHONGHISON, KHODAU6, KHODAU7
  name: string;
  location: string;
  capacityLiters: number; // Dung tích bồn (e.g. 25,000 Lít)
  currentLiters: number; // Số lượng dầu tồn bồn thực tế
  dipstickCm?: number; // Chiều cao que thăm dầu (cm)
  lastInspectionDate?: string;
}

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'RETREAD' | 'RECOVERY' | 'SCRAP';

export interface TransactionItem {
  partId: string;
  sku: string;
  partName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // Thông tin xe & lắp đặt (TNC rules)
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleOdoAtMount?: number;
  mountPosition?: string;
  tankCode?: string; // Bồn dầu cấp (e.g. BON1-KHONGHISON, BON2)
  isReefer?: boolean; // Cấp cho máy lạnh rơ-moóc
  driverName?: string; // Tên tài xế nhận
  serialNumber?: string; // Số seri nếu là lốp vỏ
}

export interface InventoryTransaction {
  id: string;
  code: string; // Số phiếu: PX-26100002, PNK-2026-001, PDC-2026-001
  type: TransactionType;
  date: string; // YYYY-MM-DD
  creatorName: string; // Người lập phiếu (Lê Đại Minh, Nguyễn Thị Thuý...)
  partnerOrReceiver: string; // Tên tài xế hoặc đối tác
  invoiceNumber?: string; // Số hóa đơn VAT hoặc Bồn cấp
  items: TransactionItem[];
  totalAmount: number;
  note?: string;
  createdAt: string;
  status?: 'Đã tạo' | 'Chờ tạo' | 'Hoàn thành' | 'Đã hủy';
}

// Bảng linh kiện đang lắp trên từng phương tiện để theo dõi hao mòn & bảo trì
export interface MountedComponent {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  partId: string;
  partName: string;
  sku: string;
  category: PartCategory;
  mountDate: string;
  mountOdoKm: number;
  lifespanKmLimit?: number;
  lifespanDaysLimit?: number;
  mountPosition: string; // Vị trí lắp trên xe
  notes?: string;
  status: 'running' | 'replaced' | 'overdue';
  serialNumber?: string;
}

// Đề xuất xin cấp vật tư (TNC DeXuatVatTu)
export interface MaterialRequisition {
  id: string;
  code: string; // DX-2026-001
  date: string;
  vehiclePlate: string;
  driverName: string;
  items: Array<{
    partName: string;
    sku?: string;
    unit: string;
    requestedQty: number;
    approvedQty?: number;
    reason: string;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

// Khóa kỳ kế toán (TNC KeToanKy)
export interface AccountingPeriodLock {
  id: string;
  month: number;
  year: number;
  lockedAt: string;
  lockedBy: string;
  isLocked: boolean;
  totalOpeningAmount: number;
  totalInAmount: number;
  totalOutAmount: number;
  totalClosingAmount: number;
  notes?: string;
}
