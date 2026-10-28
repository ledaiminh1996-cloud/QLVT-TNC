import { SparePart, Vehicle, InventoryTransaction, MountedComponent } from '../types/inventory';
import { buildDatabaseFromUserProject } from './userFleetProjectData';

// Build entities from user's production export
const userDb = buildDatabaseFromUserProject();

export const INITIAL_PARTS: SparePart[] = [
  // 1. DẦU DO TỪ DỰ ÁN THỰC TẾ CỦA USER (M-DC-TIEU-0020)
  ...userDb.parts,

  // 2. PHỤ TÙNG LỐP XE ĐẦU KÉO & RƠ-MOÓC
  {
    id: 'part-01',
    sku: 'VT-LOP-12R225-BS',
    name: 'Vỏ Lốp Xe 12R22.5 Bridgestone R150 (Gai xuôi)',
    category: 'tires',
    unit: 'Quả',
    specifications: '12R22.5 bố thép 18PR - Lắp trục dẫn hướng hoặc trục rơ-moóc',
    applicableFor: 'both',
    minStock: 6,
    currentStock: 3, // Cảnh báo thiếu hụt!
    avgCostPrice: 8650000,
    storageLocation: 'Kho Bãi Lốp A1 - Nghi Sơn',
    lifespanKmLimit: 100000,
    lifespanDaysLimit: 730,
    notes: 'Dòng lốp cao cấp chịu tải đường dài'
  },
  {
    id: 'part-02',
    sku: 'VT-LOP-11R225-CAS',
    name: 'Vỏ Lốp Xe 11R22.5 Casumina GS201 (Gai ngang - Trục truyền động)',
    category: 'tires',
    unit: 'Quả',
    specifications: '11R22.5 bố kẽm 16PR - Lắp 8 bánh cầu sau đầu kéo',
    applicableFor: 'tractor',
    minStock: 8,
    currentStock: 12,
    avgCostPrice: 5800000,
    storageLocation: 'Kho Bãi Lốp A2 - Nghi Sơn',
    lifespanKmLimit: 85000,
    lifespanDaysLimit: 600,
    notes: 'Bám đường tốt cho địa hình dốc và mưa'
  },
  {
    id: 'part-03',
    sku: 'VT-LOP-12R225-DRC',
    name: 'Vỏ Lốp Rơ-moóc 12R22.5 DRC D601 (Gai zíc zắc)',
    category: 'tires',
    unit: 'Quả',
    specifications: '12R22.5 18PR chuyên lắp 12 bánh trục rơ-moóc 3 trục',
    applicableFor: 'trailer',
    minStock: 8,
    currentStock: 2, // Thiếu hụt nghiêm trọng!
    avgCostPrice: 6200000,
    storageLocation: 'Kho Bãi Lốp A3',
    lifespanKmLimit: 90000,
    lifespanDaysLimit: 730,
    notes: 'Lốp nội địa chịu cọ quẹt tốt'
  },

  // 3. DẦU NHỚT ĐỘNG CƠ & MỠ BÒ
  {
    id: 'part-04',
    sku: 'VT-DAU-15W40-MOB',
    name: 'Dầu Nhớt Động Cơ Mobil Delvac Modern 15W40 CI-4',
    category: 'lubricants',
    unit: 'Xô (18L)',
    specifications: 'Xô 18 Lít - Chuẩn CI-4/SL chuyên động cơ Cummins, Weichai, Detroit',
    applicableFor: 'tractor',
    minStock: 10,
    currentStock: 5, // Cảnh báo tồn kho thấp!
    avgCostPrice: 1650000,
    storageLocation: 'Kệ Dầu Nhớt K1',
    lifespanKmLimit: 18000,
    lifespanDaysLimit: 120,
    notes: 'Mỗi lần thay đầu kéo cần từ 34 - 38 Lít nhớt (2 xô)'
  },
  {
    id: 'part-05',
    sku: 'VT-DAU-85W140-CAU',
    name: 'Nhớt Cầu & Hộp Số Castrol Axle GL-5 85W-140',
    category: 'lubricants',
    unit: 'Xô (18L)',
    specifications: 'Xô 18 Lít - Chịu cực áp cao bảo vệ bánh răng vi sai',
    applicableFor: 'tractor',
    minStock: 4,
    currentStock: 6,
    avgCostPrice: 1950000,
    storageLocation: 'Kệ Dầu Nhớt K2',
    lifespanKmLimit: 50000,
    lifespanDaysLimit: 365,
    notes: 'Định kỳ bảo dưỡng vi sai cầu và hộp số'
  },
  {
    id: 'part-06',
    sku: 'VT-MO-MOAYO-BL',
    name: 'Mỡ Bò Bôi Trơn Vòng Bi Moay-ơ Sinopec Extreme Blue',
    category: 'lubricants',
    unit: 'Xô (15Kg)',
    specifications: 'Chịu nhiệt độ cao 260°C, kháng nước cực tốt',
    applicableFor: 'both',
    minStock: 5,
    currentStock: 7,
    avgCostPrice: 1450000,
    storageLocation: 'Kệ Dầu Nhớt K3',
    lifespanKmLimit: 30000,
    lifespanDaysLimit: 180,
    notes: 'Dùng đóng bi moay-ơ đầu kéo & trục rơ-moóc'
  },
  {
    id: 'part-07',
    sku: 'VT-PHU-ADBLUE',
    name: 'Dung Dịch Khí Thải Ure AdBlue Euro 5/6 (Can 20L)',
    category: 'lubricants',
    unit: 'Can (20L)',
    specifications: 'Tiêu chuẩn AUS 32 ISO 22241 cho hệ thống SCR',
    applicableFor: 'tractor',
    minStock: 15,
    currentStock: 25,
    avgCostPrice: 280000,
    storageLocation: 'Khu Hoá Chất C1',
    lifespanKmLimit: 5000,
    notes: 'Bổ sung liên tục theo tỷ lệ 4-5% nhiên liệu tiêu hao'
  },

  // 4. LỌC CÁC LOẠI
  {
    id: 'part-08',
    sku: 'VT-LOC-NHOT-FLEET',
    name: 'Lọc Nhớt Động Cơ Fleetguard LF9009 (Cummins / Sitrak)',
    category: 'filters',
    unit: 'Cái',
    specifications: 'Lọc nhớt ly tâm kết hợp lọc chặn Venturi',
    applicableFor: 'tractor',
    minStock: 8,
    currentStock: 4,
    avgCostPrice: 420000,
    storageLocation: 'Kệ Lọc L1-01',
    lifespanKmLimit: 18000,
    lifespanDaysLimit: 120,
    notes: 'Phụ tùng chính hãng OEM'
  },
  {
    id: 'part-09',
    sku: 'VT-LOC-DAU-FS1000',
    name: 'Lọc Tách Nước Dầu Nhiên Liệu Fleetguard FS1000',
    category: 'filters',
    unit: 'Cái',
    specifications: 'Lọc thô tách nước có van xả đáy',
    applicableFor: 'tractor',
    minStock: 6,
    currentStock: 8,
    avgCostPrice: 480000,
    storageLocation: 'Kệ Lọc L1-02',
    lifespanKmLimit: 20000,
    lifespanDaysLimit: 120,
    notes: 'Bảo vệ kim phun dầu điện tử Common Rail'
  },
  {
    id: 'part-10',
    sku: 'VT-LOC-SAYKHI-WABCO',
    name: 'Ruột Lọc Sấy Khí Hệ Thống Phanh Wabco Cartridge',
    category: 'filters',
    unit: 'Cái',
    specifications: 'Hạt hút ẩm khử dầu, ren M39x1.5',
    applicableFor: 'tractor',
    minStock: 4,
    currentStock: 2, // Thiếu!
    avgCostPrice: 650000,
    storageLocation: 'Kệ Lọc L2-01',
    lifespanKmLimit: 40000,
    lifespanDaysLimit: 365,
    notes: 'Ngăn đọng nước trong bình hơi và van chia phanh'
  },

  // 5. PHANH / THẮNG & GẦM MOÓC
  {
    id: 'part-12',
    sku: 'VT-PHANH-BO-FUWA',
    name: 'Má Phanh / Bố Thắng Trục Rơ-moóc Fuwa 420x180',
    category: 'brake',
    unit: 'Bộ (8 miếng)',
    specifications: 'Bố tán sẵn đinh rive, bố thép phi amiang chuẩn Fuwa 13-16T',
    applicableFor: 'trailer',
    minStock: 6,
    currentStock: 8,
    avgCostPrice: 1350000,
    storageLocation: 'Khu Phụ Tùng Nặng P1',
    lifespanKmLimit: 60000,
    lifespanDaysLimit: 365,
    notes: '1 trục moóc gồm 2 bánh = 8 miếng bố'
  },
  {
    id: 'part-13',
    sku: 'VT-PHANH-SEN-T3030',
    name: 'Búp Sen Thắng Kép T30/30 (Bầu Phanh Lốc-kê)',
    category: 'brake',
    unit: 'Cái',
    specifications: 'Ty dài, lò xo lốc kê phanh đỗ xe hơi',
    applicableFor: 'both',
    minStock: 4,
    currentStock: 3,
    avgCostPrice: 850000,
    storageLocation: 'Khu Phụ Tùng Nặng P2',
    lifespanKmLimit: 90000,
    lifespanDaysLimit: 730,
    notes: 'Dùng cho cả cầu sau xe kéo và trục rơ-moóc'
  },
  {
    id: 'part-16',
    sku: 'VT-GAM-BONGHOI-CONT',
    name: 'Bóng Hơi Rơ-moóc Contitech 941MB (Hệ thống treo khí nén)',
    category: 'suspension',
    unit: 'Cái',
    specifications: 'Đế nhôm đúc, cao su 4 lớp bố chịu áp lực 10 bar',
    applicableFor: 'trailer',
    minStock: 4,
    currentStock: 2, // Thiếu hụt!
    avgCostPrice: 2300000,
    storageLocation: 'Khu Phụ Tùng Cao Su G2',
    lifespanKmLimit: 120000,
    lifespanDaysLimit: 730,
    notes: 'Dành riêng cho rơ-moóc chuyên chở hàng dễ vỡ/chống rung'
  },
  {
    id: 'part-21',
    sku: 'VT-DIEN-ACQUY-150',
    name: 'Bình Ắc Quy Đồng Nai 12V - 150Ah N150 (Cặp 2 bình 24V)',
    category: 'electrical',
    unit: 'Bình',
    specifications: '12V - 150Ah cọc chì tiêu chuẩn xe đầu kéo',
    applicableFor: 'tractor',
    minStock: 4,
    currentStock: 2,
    avgCostPrice: 3250000,
    storageLocation: 'Khu Ắc Quy E1',
    lifespanDaysLimit: 730,
    notes: 'Thay cả cặp 2 bình để dòng nạp xả cân bằng'
  }
];

// USER'S REAL VEHICLES MERGED WITH SAMPLE FLEET
export const INITIAL_VEHICLES: Vehicle[] = [
  ...userDb.vehicles
];

// USER'S REAL PRODUCTION TRANSACTIONS (PX-26100002 to PX-26100110)
export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  ...userDb.transactions
];

// MOUNTED TRACKING WITH REAL PLATES FROM PROJECT
export const INITIAL_MOUNTED_COMPONENTS: MountedComponent[] = [
  // Xe đầu kéo 50H-110.99 (Đã chạy thực tế ODO 1,046,598 KM theo log)
  {
    id: 'mc-user-01',
    vehicleId: 'veh-50H11099',
    vehiclePlate: '50H-110.99',
    partId: 'part-04',
    partName: 'Dầu Nhớt Động Cơ Mobil Delvac Modern 15W40 CI-4',
    sku: 'VT-DAU-15W40-MOB',
    category: 'lubricants',
    mountDate: '2026-09-10',
    mountOdoKm: 1029000,
    lifespanKmLimit: 18000,
    lifespanDaysLimit: 120,
    mountPosition: 'Động cơ chính xe 50H-110.99',
    status: 'overdue',
    notes: 'Đã chạy 17,598 / 18,000 KM (98%). Sắp đến hạn thay dầu máy trong chuyến tiếp theo.'
  },
  {
    id: 'mc-user-02',
    vehicleId: 'veh-50H11099',
    vehiclePlate: '50H-110.99',
    partId: 'part-10',
    partName: 'Ruột Lọc Sấy Khí Wabco Cartridge',
    sku: 'VT-LOC-SAYKHI-WABCO',
    category: 'filters',
    mountDate: '2026-04-12',
    mountOdoKm: 1005000,
    lifespanKmLimit: 40000,
    lifespanDaysLimit: 365,
    mountPosition: 'Cụm van sấy khí phanh hơi',
    status: 'overdue',
    notes: 'Đã chạy 41,598 / 40,000 KM. ĐÃ QUÁ HẠN ĐỊNH MỨC! Khẩn cấp thay thế.'
  },
  // Xe đầu kéo 50H-048.53 (Tài xế Hoàng Văn Huy)
  {
    id: 'mc-user-03',
    vehicleId: 'veh-50H04853',
    vehiclePlate: '50H-048.53',
    partId: 'part-01',
    partName: 'Vỏ Lốp Xe 12R22.5 Bridgestone R150',
    sku: 'VT-LOP-12R225-BS',
    category: 'tires',
    mountDate: '2025-11-20',
    mountOdoKm: 210000,
    lifespanKmLimit: 100000,
    lifespanDaysLimit: 730,
    mountPosition: 'Trục dẫn hướng lái (Bánh trước Trái/Phải)',
    status: 'running',
    notes: 'Gai lốp còn 4.5mm, vận hành an toàn'
  },
  // Xe đầu kéo 51D-308.50 (Tài xế Trần Nguyễn Nam Khang)
  {
    id: 'mc-user-04',
    vehicleId: 'veh-51D30850',
    vehiclePlate: '51D-308.50',
    partId: 'part-08',
    partName: 'Lọc Nhớt Động Cơ Fleetguard LF9009',
    sku: 'VT-LOC-NHOT-FLEET',
    category: 'filters',
    mountDate: '2026-08-15',
    mountOdoKm: 295000,
    lifespanKmLimit: 18000,
    lifespanDaysLimit: 120,
    mountPosition: 'Bầu lọc nhớt động cơ',
    status: 'running',
    notes: 'Kiểm tra áp suất dầu tốt'
  },
  // Rơ-moóc 51R-254.81 (Đi kèm 50H-048.53)
  {
    id: 'mc-user-05',
    vehicleId: 'veh-51R25481',
    vehiclePlate: '51R-254.81',
    partId: 'part-12',
    partName: 'Má Phanh / Bố Thắng Trục Rơ-moóc Fuwa 420x180',
    sku: 'VT-PHANH-BO-FUWA',
    category: 'brake',
    mountDate: '2026-02-14',
    mountOdoKm: 180000,
    lifespanKmLimit: 60000,
    lifespanDaysLimit: 365,
    mountPosition: 'Trục 2 và Trục 3 Rơ-moóc Fuwa',
    status: 'running',
    notes: 'Bố mòn đều, cự ly phanh chuẩn'
  },
  // Rơ-moóc lạnh 51R-271.69 (Máy lạnh container lạnh)
  {
    id: 'mc-user-06',
    vehicleId: 'veh-51R27169',
    vehiclePlate: '51R-271.69',
    partId: 'part-16',
    partName: 'Bóng Hơi Rơ-moóc Contitech 941MB',
    sku: 'VT-GAM-BONGHOI-CONT',
    category: 'suspension',
    mountDate: '2025-05-10',
    mountOdoKm: 120000,
    lifespanKmLimit: 120000,
    lifespanDaysLimit: 730,
    mountPosition: 'Bóng hơi trục giảm chấn chống rung',
    status: 'running',
    notes: 'Bảo vệ hàng hóa container lạnh'
  }
];

export const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  tires: { label: 'Lốp Xe & Vành Mâm', icon: 'Disc', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  lubricants: { label: 'Nhiên Liệu Dầu DO & Dầu Nhớt', icon: 'Droplets', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  filters: { label: 'Lọc Nhiên Liệu, Sấy Khí & Gió', icon: 'Filter', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  brake: { label: 'Phanh & Thắng Hơi', icon: 'ShieldAlert', color: 'bg-red-100 text-red-800 border-red-300' },
  suspension: { label: 'Gầm, Nhíp & Bóng Hơi', icon: 'Layers', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  coupling: { label: 'Mâm Kéo & Ắc Moóc', icon: 'Link', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  electrical: { label: 'Ắc Quy & Điện Xe', icon: 'Zap', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  engine_trans: { label: 'Động Cơ & Hộp Số', icon: 'Cpu', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  accessories: { label: 'Vật Tư Phụ Khác', icon: 'Wrench', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' }
};
