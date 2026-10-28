import { Vehicle, SparePart, InventoryTransaction, MountedComponent } from '../types/inventory';
import { parseDateVN, extractTrailerAndDriver } from '../utils/rawProjectParser';

// Real raw JSON logs provided by user
export const USER_RAW_BATCHES = [
  {
    batchId: "ID-498ba023-124d-48af-ae1a-886d0b8563ad",
    author: "ledaiminh1996@gmail.com",
    authorName: "Lê Đại Minh",
    created: "2026-10-14T02:22:08.389Z",
    records: [
      { receipt: "PX-26100002", date: "07/10/2026", dienGiai: "Xuất dầu cho LX - Hoàng Văn Huy - 50H-048.53 - 51R-254.81 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 345, phuongTien: "50H-048.53", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Hoàng Văn Huy" } },
      { receipt: "PX-26100003", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Kha - 50E-085.50 - 51R-503.34 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 600, phuongTien: "50E-085.50", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Kha" } },
      { receipt: "PX-26100004", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Trần Minh Tuấn - 50H-045.43 - 51R-093.05 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 450, phuongTien: "50H-045.43", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Minh Tuấn" } },
      { receipt: "PX-26100005", date: "08/10/2026", dienGiai: "Xuất dầu cho LX -  Nguyễn Thành Đôn - 50E-858.25 - 50R-048.78 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 240, phuongTien: "50E-858.25", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Thành Đôn" } },
      { receipt: "PX-26100006", date: "08/10/2026", dienGiai: "Xuất dầu cho LX -  Nguyễn Đình Sĩ - 50H-091.40 - 51R-271.81 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 620, phuongTien: "50H-091.40", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Đình Sĩ" } },
      { receipt: "PX-26100007", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Huy Hoàng - 50H-076.49 - 51R-503.48 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 320, phuongTien: "50H-076.49", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Huy Hoàng" } },
      { receipt: "PX-26100008", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Phạm Nhật Tân - 50H-092.54 - 50R-048.48 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 570, phuongTien: "50H-092.54", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Phạm Nhật Tân" } },
      { receipt: "PX-26100009", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Trần Trung Hiếu - 50H-048.95 - 51R-270.96 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 410, phuongTien: "50H-048.95", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Trung Hiếu" } },
      { receipt: "PX-26100010", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Trần Trung Hiếu - 50H-048.95 - máy lạnh - 51R-270.96 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 120, phuongTien: "50H-048.95", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Trung Hiếu" } },
      { receipt: "PX-26100011", date: "08/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Trung Hiếu - 50H-208.67 - 51R-503.90 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 300, phuongTien: "50H-208.67", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Trung Hiếu" } },
      { receipt: "PX-26100012", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Trí Thiện - 50H-210.67 - máy lạnh - 51R-271.69 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 91, phuongTien: "50H-210.67", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Trí Thiện" } },
      { receipt: "PX-26100013", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Trần Nguyễn Nam Khang - 51D-308.50 - 51R-091.45 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 600, phuongTien: "51D-308.50", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Nguyễn Nam Khang" } },
      { receipt: "PX-26100014", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Trần Nguyễn Nam Khang - 51D-308.50 - máy lạnh - 51R-091.45 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 190, phuongTien: "51D-308.50", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Nguyễn Nam Khang" } },
      { receipt: "PX-26100015", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Phan Thuận Bình - 51D-183.44 - 51R-271.36 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 220, phuongTien: "51D-183.44", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Phan Thuận Bình" } },
      { receipt: "PX-26100016", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Lê Văn Cường - 50H-077.00 - 50R-035.05 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 570, phuongTien: "50H-077.00", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Lê Văn Cường" } },
      { receipt: "PX-26100017", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Hoàng Anh - 50H-113.08 - 50R-048.75 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 530, phuongTien: "50H-113.08", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Hoàng Anh" } },
      { receipt: "PX-26100018", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Mai Chánh Thành - 51D-602.93 - 50R-036.77 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 260, phuongTien: "51D-602.93", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Mai Chánh Thành" } },
      { receipt: "PX-26100019", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Trần Quang Hùng - 50E-957.02 - 51R-271.12 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 260, phuongTien: "50E-957.02", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Quang Hùng" } },
      { receipt: "PX-26100020", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Trí Thiện - 50H-210.67 - 51R-271.69 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 600, phuongTien: "50H-210.67", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Trí Thiện" } },
      { receipt: "PX-26100021", date: "09/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Kinh - 50H-211.09 - 50RM-002.65 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 280, phuongTien: "50H-211.09", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Kinh" } },
      { receipt: "PX-26100022", date: "09/10/2026", dienGiai: "Xuất dầu cho LX -  Trần Văn Đức - 50H-211.03 - 50R-047.28 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 590, phuongTien: "50H-211.03", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Văn Đức" } },
      { receipt: "PX-26100023", date: "10/10/2026", dienGiai: "Xuất dầu cho LX - Hà Phi Hùng - 50H-256.17 - 51R-254.88 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 604, phuongTien: "50H-256.17", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Hà Phi Hùng" } },
      { receipt: "PX-26100024", date: "10/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đức Trị - 50H-046.07 - 51R-270.07 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 540, phuongTien: "50H-046.07", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Đức Trị" } },
      { receipt: "PX-26100025", date: "10/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đức Trị - 50H-046.07 - máy lạnh - 51R-270.07 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 100, phuongTien: "50H-046.07", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Đức Trị" } },
      { receipt: "PX-26100026", date: "10/10/2026", dienGiai: "Xuất dầu cho LX - Giản Tư Tâm - 50H-110.99 - 51R-047.31 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50H-110.99", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Giản Tư Tâm" } },
      { receipt: "PX-26100027", date: "10/10/2026", dienGiai: "Xuất dầu cho LX -  Trần Duy Nhật Quang - 50H-074.63 - 51R-503.00 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 550, phuongTien: "50H-074.63", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Duy Nhật Quang" } },
      { receipt: "PX-26100028", date: "10/10/2026", dienGiai: "Xuất dầu cho LX -  Nguyễn Tiến Bình - 50H-237.32 - 51R-270.27 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 235, phuongTien: "50H-237.32", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Tiến Bình" } },
      { receipt: "PX-26100029", date: "10/10/2026", dienGiai: "Xuất dầu cho LX - Bùi Hữu Tuấn - 50H- 048.32- 51R-271.77 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 230, phuongTien: "50H-048.32", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Bùi Hữu Tuấn" } },
      { receipt: "PX-26100030", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Minh Vũ - 50H-113.92 - 51R-066.36 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 290, phuongTien: "50H-113.92", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Minh Vũ" } },
      { receipt: "PX-26100031", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Công Thanh - 50H-239.44 - 51R-121.87  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 520, phuongTien: "50H-239.44", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Công Thanh" } },
      { receipt: "PX-26100032", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Công Thanh - 50H-239.44 - máy lạnh - 51R-121.87  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 150, phuongTien: "50H-239.44", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Công Thanh" } },
      { receipt: "PX-26100033", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Lộc - 50E-860.63 - 50R-048.51  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 570, phuongTien: "50E-860.63", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Lộc" } },
      { receipt: "PX-26100034", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Đỗ Văn Thiện - 51D-154.64 - 51R-252.10 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 550, phuongTien: "51D-154.64", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Đỗ Văn Thiện" } },
      { receipt: "PX-26100035", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Đỗ Văn Thiện - 51D-154.64 - máy lạnh - 51R-252.10 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 110, phuongTien: "51D-154.64", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Đỗ Văn Thiện" } },
      { receipt: "PX-26100036", date: "11/10/2026", dienGiai: "Xuất dầu cho LX - Hồ Ngọc Minh Phong - 50H-112.41 - 51R-270.77 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 270, phuongTien: "50H-112.41", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Hồ Ngọc Minh Phong" } },
      { receipt: "PX-26100037", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Hà Xuân Bình - 50H-859.55 - 50R-033.17 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 260, phuongTien: "50E-859.55", odoLap: 1, bonDau: "BON1-KHONGHISON", tenTaiXe: "Hà Xuân Bình" } }
    ]
  },
  {
    batchId: "ID-d4fe5616-a477-42b5-b6b4-337014baf60f",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-15T15:31:44.570Z",
    records: [
      { receipt: "PX-26100041", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Lập - 50H-296.03 - 51R-271.21 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 580, phuongTien: "50H-296.03", odoLap: 560, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Lập" } },
      { receipt: "PX-26100042", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Trần Mạnh Bảo - 50H-201.97 - 51R- 254.18 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 540, phuongTien: "50H-201.97", odoLap: 530, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Mạnh Bảo" } },
      { receipt: "PX-26100043", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Võ Thành Bảo - 50H-074.47 - 51R-268.93 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 550, phuongTien: "50H-074.47", odoLap: 590, bonDau: "BON1-KHONGHISON", tenTaiXe: "Võ Thành Bảo" } },
      { receipt: "PX-26100044", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Cương - 50H-092.33 - 51R-270.41 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 530, phuongTien: "50H-092.33", odoLap: 620, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Cương" } },
      { receipt: "PX-26100045", date: "12/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Cương - 50H-092.33 - Máy lạnh - 51R-270.41 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 100, phuongTien: "50H-092.33", odoLap: 620, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Cương" } },
      { receipt: "PX-26100046", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Phạm Nhật Tân - 50H-092.54 - 50R-048.48 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 220, phuongTien: "50H-092.54", odoLap: 1250, bonDau: "BON1-KHONGHISON", tenTaiXe: "Phạm Nhật Tân" } },
      { receipt: "PX-26100047", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Bùi Xuân Vương - 50H-074.17 - 50R-090.20 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 370, phuongTien: "50H-074.17", odoLap: 650, bonDau: "BON1-KHONGHISON", tenTaiXe: "Bùi Xuân Vương" } },
      { receipt: "PX-26100048", date: "13/10/2026", dienGiai: "Xuất dầu cho LX -  Nguyễn Văn Kha - 50E-085.50 - 51R-503.34 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 250, phuongTien: "50E-085.50", odoLap: 650, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Kha" } },
      { receipt: "PX-26100049", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đình Thi - 36C-339.73 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 70, phuongTien: "36C-339.73", odoLap: 650, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Đình Thi" } },
      { receipt: "PX-26100050", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Lê Hồng Sơn - 50H-113.87 - 50R-048.65 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 523, phuongTien: "50H-113.87", odoLap: 548, bonDau: "BON1-KHONGHISON", tenTaiXe: "Lê Hồng Sơn" } },
      { receipt: "PX-26100051", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Anh Tuấn  - 50H-042.16 - 50R-035.98 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 555, phuongTien: "50H-042.16", odoLap: 582, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Anh Tuấn" } },
      { receipt: "PX-26100052", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Trần Duy Đức - 51D-147.29 - 50R-035.53 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 560, phuongTien: "51D-147.29", odoLap: 752, bonDau: "BON1-KHONGHISON", tenTaiXe: "Trần Duy Đức" } },
      { receipt: "PX-26100053", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Ni - 50H-210.85 - 51R-067.22  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50H-210.85", odoLap: 625, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Ni" } },
      { receipt: "PX-26100054", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Chung Thanh Tùng - 50E-957.28 - 51R-092.87 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50E-957.28", odoLap: 645, bonDau: "BON1-KHONGHISON", tenTaiXe: "Chung Thanh Tùng" } },
      { receipt: "PX-26100055", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Chung Thanh Tùng - 50E-957.28 - máy lạnh - 51R-092.87 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 100, phuongTien: "50E-957.28", odoLap: 645, bonDau: "BON1-KHONGHISON", tenTaiXe: "Chung Thanh Tùng" } },
      { receipt: "PX-26100056", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Đỗ Bá Thắng - 51D-154.99 - 51R-271.42 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 350, phuongTien: "51D-154.99", odoLap: 652, bonDau: "BON1-KHONGHISON", tenTaiXe: "Đỗ Bá Thắng" } },
      { receipt: "PX-26100057", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Tiên - 50H-089.56 - 51R-046.24 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 270, phuongTien: "50H-089.56", odoLap: 653, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Văn Tiên" } }
    ]
  },
  {
    batchId: "ID-82ef4580-258a-466d-9b6a-04a3e11a409c",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-15T15:55:04.241Z",
    records: [
      { receipt: "PX-26100058", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Thành Toại - 50H-092.24 - 51R-066.03 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 250, phuongTien: "50H-092.24", odoLap: 456, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Thành Toại" } },
      { receipt: "PX-26100059", date: "13/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đình Sĩ - 50H-091.40 - 51R-271.81 - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 260, phuongTien: "50H-091.40", odoLap: 654, bonDau: "BON1-KHONGHISON", tenTaiXe: "Nguyễn Đình Sĩ" } }
    ]
  },
  {
    batchId: "ID-80bb982e-286d-40a6-9e28-198275d0006e",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-15T16:05:33.099Z",
    records: [
      { receipt: "PX-26100060", date: "14/10/2026", dienGiai: "Xuất dầu cho LX -  Phạm Văn Hiền - 15H-061.51 - 15RM-072.68  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 400, phuongTien: "TN-15H-061.51", odoLap: 580, bonDau: "BON1-KHONGHISON", tenTaiXe: "CÔNG TY CỔ PHẦN PHONG NIÊN" } },
      { receipt: "PX-26100061", date: "14/10/2026", dienGiai: "Xuất dầu cho LX -  Phạm Văn Hiền - 15H-061.51 - máy lạnh - 15RM-072.68  - KHODAU6", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 200, phuongTien: "TN-MP-15H-061.51", odoLap: 580, bonDau: "BON1-KHONGHISON", tenTaiXe: "CÔNG TY CỔ PHẦN PHONG NIÊN" } }
    ]
  },
  {
    batchId: "ID-ce044f29-da7d-4c01-9b89-8b0382aa1369",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-15T16:18:30.987Z",
    records: [
      { receipt: "PX-26100062", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Hạnh - 51D-160.44 - 50R-035.82 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 520, phuongTien: "51D-160.44", odoLap: 650, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Văn Hạnh" } },
      { receipt: "PX-26100063", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Hạnh - 51D-160.44 - máy lạnh - 50R-035.82 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 100, phuongTien: "51D-160.44", odoLap: 650, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Văn Hạnh" } },
      { receipt: "PX-26100064", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Trịnh Văn Tuấn - 50H-092.83 - 50R-029.73 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 360, phuongTien: "50H-092.83", odoLap: 690, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trịnh Văn Tuấn" } },
      { receipt: "PX-26100065", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Trần Nguyễn Nam Khang - 51D-308.50 - 51R-091.45 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 320, phuongTien: "51D-308.50", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Nguyễn Nam Khang" } },
      { receipt: "PX-26100066", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Hòi - 50H-111.26 - 51R-503.68 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 470, phuongTien: "50H-111.26", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Hòi" } },
      { receipt: "PX-26100067", date: "14/10/2026", dienGiai: "Xuất dầu cho LX -Nguyễn Đình Thi - 51D-117.32  -  KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 65, phuongTien: "51D-117.32", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Đình Thi" } },
      { receipt: "PX-26100068", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Trần Trung Hiếu - 50H-048.95 - 51R-270.96 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 380, phuongTien: "50H-048.95", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Trung Hiếu" } },
      { receipt: "PX-26100069", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Trần Ngọc Viễn - 50H-153.43 - 51R-271.76 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 570, phuongTien: "50H-153.43", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Ngọc Viễn" } }
    ]
  },
  {
    batchId: "ID-20792f3d-0f08-43aa-b828-1c272ad7d5b6",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-15T16:26:41.563Z",
    records: [
      { receipt: "PX-26100070", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Phúc(TX) - 50H-092.18 - 50R-036.44 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 400, phuongTien: "50H-092.18", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Văn Phúc(TX)" } },
      { receipt: "PX-26100071", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Văn Phúc(TX) - 50H-092.18 - máy lạnh - 50R-036.44 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 100, phuongTien: "50H-092.18", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Văn Phúc(TX)" } },
      { receipt: "PX-26100072", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Phan Hồng Phú - 50H-074.18 - 51R-125.30 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 590, phuongTien: "50H-074.18", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Phan Hồng Phú" } },
      { receipt: "PX-26100073", date: "14/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Trung Tín - 50H-227.03 - 50R-047.37 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 540, phuongTien: "50H-227.03", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Trung Tín" } },
      { receipt: "PX-26100074", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Trần Duy Nhật Quang - 50H-074.63 - 51R-503.00 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 300, phuongTien: "50H-074.63", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Duy Nhật Quang" } },
      { receipt: "PX-26100075", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Trần Văn Đức - 50H-211.03 - 50R-047.28 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 240, phuongTien: "50H-211.03", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Văn Đức" } },
      { receipt: "PX-26100076", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Trần Văn Đức - 50H-211.03 - máy lạnh - 50R-047.28 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 200, phuongTien: "50H-211.03", odoLap: 680, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Văn Đức" } }
    ]
  },
  {
    batchId: "ID-dd493ce3-4aa2-4a2d-a5d5-ae65fa3dd62b",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-17T02:50:03.875Z",
    records: [
      { receipt: "PX-26100081", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Trần Tiến Quý - 50H-045.67 - 51R-271.16 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 530, phuongTien: "50H-045.67", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Tiến Quý" } },
      { receipt: "PX-26100082", date: "15/10/2026", dienGiai: "Xuất dầu cho LX -  Hà Phi Hùng - 50H-256.17 - 51R-254.88 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 350, phuongTien: "50H-256.17", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Hà Phi Hùng" } },
      { receipt: "PX-26100083", date: "15/10/2026", dienGiai: "Xuất dầu cho LX -  Mai Văn Thành - 50H-114.50 - 51R-092.87 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 520, phuongTien: "50H-114.50", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Mai Văn Thành" } },
      { receipt: "PX-26100084", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Trần Minh Tuấn - 50H-045.43 - 51R-093.05 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 550, phuongTien: "50H-045.43", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Trần Minh Tuấn" } },
      { receipt: "PX-26100085", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đức Trị - 50H-046.07 - 51R-270.07 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 275, phuongTien: "50H-046.07", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Đức Trị" } },
      { receipt: "PX-26100086", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Minh Vũ - 50H-113.92 - 51R-066.36 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50H-113.92", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Minh Vũ" } },
      { receipt: "PX-26100087", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Bùi Hữu Tuấn - 50H-048.32 - 51R-271.77 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50H-048.32", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Bùi Hữu Tuấn" } },
      { receipt: "PX-26100088", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đình Sĩ - 50H-091.40 - 51R-271.81 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 480, phuongTien: "50H-091.40", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Đình Sĩ" } }
    ]
  },
  {
    batchId: "ID-5731b132-3c75-410b-ab5c-a437db58c08f",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-17T09:24:45.853Z",
    records: [
      { receipt: "PX-26100089", date: "15/10/2026", dienGiai: "Xuất dầu cho LX -  Hà Phi Hùng - 50H-256.17 - máy lạnh - 51R-254.88 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 360, phuongTien: "50H-256.17", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Hà Phi Hùng" } },
      { receipt: "PX-26100090", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Minh Vũ - 50H-113.92 - Máy Lạnh - 51R-066.36 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 250, phuongTien: "50H-113.92", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Minh Vũ" } },
      { receipt: "PX-26100091", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Bùi Hữu Tuấn - 50H-048.32 - Máy Lạnh - 51R-271.77 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 330, phuongTien: "50H-048.32", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Bùi Hữu Tuấn" } },
      { receipt: "PX-26100092", date: "15/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Đình Sĩ - 50H-091.40 - Máy Lạnh - 51R-271.81 - KHODAU2", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 338, phuongTien: "50H-091.40", odoLap: 1100, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Đình Sĩ" } }
    ]
  },
  {
    batchId: "ID-223abbf0-55d7-4116-9d32-b1aec0342d77",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-18T08:22:48.681Z",
    records: [
      { receipt: "PX-26100096", date: "16/10/2026", dienGiai: "Xuất dầu cho LX - Nguyễn Công Thanh - 50H-239.44 - 51R-121.87 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 320, phuongTien: "50H-239.44", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Nguyễn Công Thanh" } },
      { receipt: "PX-26100097", date: "16/10/2026", dienGiai: "Xuất dầu cho LX -  Đặng Ngọc Hà - 50H-212.50 - 51R-046.52 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 500, phuongTien: "50H-212.50", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Đặng Ngọc Hà" } },
      { receipt: "PX-26100098", date: "16/10/2026", dienGiai: "Xuất dầu cho LX -  Đinh Văn Nam -50H-113.35- 50R-048.06 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 520, phuongTien: "50H-113.35", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Đinh Văn Nam" } },
      { receipt: "PX-26100099", date: "16/10/2026", dienGiai: "Xuất dầu cho LX -  Đinh Công Bộ - 50H-202.47 - 51R-503.32 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 530, phuongTien: "50H-202.47", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Đinh Công Bộ" } },
      { receipt: "PX-26100100", date: "16/10/2026", dienGiai: "Xuất dầu cho LX -  Mai Chấn Bôn - 50H-048.18 - 50R-036.79 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 460, phuongTien: "50H-048.18", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Mai Chấn Bôn" } },
      { receipt: "PX-26100101", date: "16/10/2026", dienGiai: "Xuất dầu cho LX - Lê Văn Cường - 50H-077.00 - 50R-035.05 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 280, phuongTien: "50H-077.00", odoLap: 1300, bonDau: "BON2-KHONGHISON", tenTaiXe: "Lê Văn Cường" } }
    ]
  },
  {
    batchId: "ID-133a26fd-3dd6-461a-a1ca-ec0aded7d81d",
    author: "nguyenthuy060882@gmail.com",
    authorName: "Nguyễn Thị Thuý",
    created: "2026-10-19T06:07:36.989Z",
    records: [
      { receipt: "PX-26100110", date: "16/10/2026", dienGiai: "Xuất dầu cho LX -  Giản Tư Tâm - 50H-110.99 - 51R-047.31 - KHODAU7", item: { ma: "M-DC-TIEU-0020", ten: "Dầu DO", dvt: "Lít", soLuong: 260, phuongTien: "50H-110.99", odoLap: 1046598, bonDau: "BON2-KHONGHISON", tenTaiXe: "Giản Tư Tâm" } }
    ]
  }
];

// Price of Diesel DO per Liter
export const DIESEL_PRICE_PER_LITER = 21500;

// Convert raw records into application database
export function buildDatabaseFromUserProject(): {
  vehicles: Vehicle[];
  parts: SparePart[];
  transactions: InventoryTransaction[];
  mountedComponents: MountedComponent[];
} {
  const vehicleMap = new Map<string, Vehicle>();
  const transactions: InventoryTransaction[] = [];
  const mountedComponents: MountedComponent[] = [];

  let totalFuelIssued = 0;

  // Process all raw batches
  USER_RAW_BATCHES.forEach(batch => {
    batch.records.forEach((rec, idx) => {
      const parsedDate = parseDateVN(rec.date);
      const info = extractTrailerAndDriver(rec.dienGiai);

      // Clean vehicle plate
      const tractorPlate = rec.item.phuongTien.trim().replace(/^TN-|^TN-MP-/, '');
      const driverName = rec.item.tenTaiXe?.trim() || info.driver || 'Tài xế';
      const odoKm = rec.item.odoLap && rec.item.odoLap > 1000 ? rec.item.odoLap : (rec.item.odoLap || 650);

      // Register or update Tractor
      if (tractorPlate && !vehicleMap.has(tractorPlate)) {
        vehicleMap.set(tractorPlate, {
          id: `veh-${tractorPlate.replace(/[^a-zA-Z0-9]/g, '')}`,
          plateNumber: tractorPlate,
          type: 'tractor',
          brandModel: 'Xe Đầu Kéo Container Đường Dài',
          manufactureYear: 2022,
          currentOdoKm: odoKm,
          assignedDriver: driverName,
          status: 'active',
          notes: `Tài xế phụ trách: ${driverName}`
        });
      } else if (tractorPlate && odoKm > (vehicleMap.get(tractorPlate)?.currentOdoKm || 0)) {
        const v = vehicleMap.get(tractorPlate)!;
        v.currentOdoKm = odoKm;
      }

      // Register Trailer if present in description
      if (info.trailer && !vehicleMap.has(info.trailer)) {
        vehicleMap.set(info.trailer, {
          id: `veh-${info.trailer.replace(/[^a-zA-Z0-9]/g, '')}`,
          plateNumber: info.trailer,
          type: 'trailer',
          brandModel: info.isReefer ? 'Rơ-Moóc Lạnh (Container Lạnh)' : 'Rơ-Moóc Xương 40ft/45ft',
          manufactureYear: 2023,
          currentOdoKm: odoKm,
          assignedDriver: `Đi kèm xe ${tractorPlate}`,
          status: 'active',
          notes: info.isReefer ? 'Rơ moóc gắn máy lạnh chạy lạnh hàng hóa' : 'Rơ moóc chở hàng container khô'
        });
      }

      const isReeferItem = info.isReefer;
      const subtotal = rec.item.soLuong * DIESEL_PRICE_PER_LITER;
      totalFuelIssued += rec.item.soLuong;

      // Construct Transaction
      const tx: InventoryTransaction = {
        id: `tx-user-${rec.receipt}-${idx}`,
        code: rec.receipt,
        type: 'OUT',
        date: parsedDate,
        creatorName: batch.authorName,
        partnerOrReceiver: driverName,
        invoiceNumber: rec.item.bonDau || 'Kho Nghi Sơn',
        items: [
          {
            partId: 'part-diesel-0020',
            sku: rec.item.ma,
            partName: isReeferItem ? 'Dầu DO (Cấp Máy Lạnh Rơ-Moóc)' : 'Dầu DO (Cấp Động Cơ Đầu Kéo)',
            unit: 'Lít',
            quantity: rec.item.soLuong,
            unitPrice: DIESEL_PRICE_PER_LITER,
            totalPrice: subtotal,
            vehicleId: `veh-${tractorPlate.replace(/[^a-zA-Z0-9]/g, '')}`,
            vehiclePlate: tractorPlate,
            vehicleOdoAtMount: odoKm,
            mountPosition: isReeferItem ? `Máy Lạnh Moóc ${info.trailer || ''}` : `Bình Dầu Động Cơ (${rec.item.bonDau || 'Bồn Nghi Sơn'})`
          }
        ],
        totalAmount: subtotal,
        note: rec.dienGiai,
        createdAt: batch.created
      };

      transactions.push(tx);
    });
  });

  // Master Part: Dầu DO
  const dieselPart: SparePart = {
    id: 'part-diesel-0020',
    sku: 'M-DC-TIEU-0020',
    name: 'Dầu DO 0.05S-II (Nhiên Liệu Động Cơ & Máy Lạnh)',
    category: 'lubricants',
    unit: 'Lít',
    specifications: 'Nhiên liệu Diesel tiêu chuẩn Euro 5 cấp bồn Nghi Sơn (Bồn 1 & Bồn 2)',
    applicableFor: 'both',
    minStock: 8000,
    currentStock: Math.max(12500, 35000 - totalFuelIssued),
    avgCostPrice: DIESEL_PRICE_PER_LITER,
    storageLocation: 'Kho Nghi Sơn (Bồn 1 & Bồn 2)',
    lifespanKmLimit: 1000, // Định mức cấp dầu theo chặng 1,000 KM
    lifespanDaysLimit: 7,
    notes: 'Theo dõi cấp phát dầu cho xe đầu kéo và máy lạnh rơ-moóc đường dài'
  };

  // Add initial receipt so the stock balance has a proper initial IN
  const initialFuelReceipt: InventoryTransaction = {
    id: 'tx-fuel-initial-receipt',
    code: 'PNK-2026-1001-DAU',
    type: 'IN',
    date: '2026-10-01',
    creatorName: 'Lê Đại Minh (Thủ kho)',
    partnerOrReceiver: 'Tổng Công Ty Dầu Petrolimex / Nghi Sơn',
    invoiceNumber: 'HD-NGHISON-88912',
    items: [
      {
        partId: 'part-diesel-0020',
        sku: 'M-DC-TIEU-0020',
        partName: 'Dầu DO 0.05S-II (Nhiên Liệu Động Cơ & Máy Lạnh)',
        unit: 'Lít',
        quantity: 35000,
        unitPrice: DIESEL_PRICE_PER_LITER,
        totalPrice: 35000 * DIESEL_PRICE_PER_LITER
      }
    ],
    totalAmount: 35000 * DIESEL_PRICE_PER_LITER,
    note: 'Nhập bồn dầu Nghi Sơn đợt 1 tháng 10/2026 (35,000 Lít bồn 1 và bồn 2)',
    createdAt: '2026-10-01T08:00:00Z'
  };

  return {
    vehicles: Array.from(vehicleMap.values()),
    parts: [dieselPart],
    transactions: [initialFuelReceipt, ...transactions],
    mountedComponents
  };
}
