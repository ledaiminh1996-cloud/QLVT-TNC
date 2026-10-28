# Quy chuẩn font và số liệu toàn hệ thống

Áp dụng từ 24/10/2026 theo yêu cầu người dùng. Chuẩn này áp dụng cả giao diện đang dùng API, màn hình dữ liệu cũ, biểu mẫu, báo cáo, ngăn lịch sử và phiếu in.

## Hai font cố định

- Sans-serif: **Inter Variable**; dự phòng Segoe UI, Arial, sans-serif. Dùng cho tiêu đề, tên, nhãn, nút, lời giải thích, ngày tháng, số điện thoại, email, tiền và mọi số đo.
- Monospace: **JetBrains Mono Variable**; dự phòng Consolas, Liberation Mono, monospace. Chỉ dùng cho mã định danh: mã vật tư/NCC/kho, mã NV, biển số, mã máy phát/rơ moóc/Cont, mã đối tượng/nhóm, số serial/khung/máy, mã số thuế, số phiếu/hóa đơn.
- Mã định danh dùng `font-mono`, cỡ chuẩn **11px / dòng 16px**, nhỏ hơn nội dung bảng 12px. Không đặt `font-mono` lên cả hàng, vùng dữ liệu hoặc select chứa tên kèm mã.
- Khai báo tập trung bằng `@theme` trong `src/index.css`; `src/fonts.css` chỉ chứa @font-face và unicode-range. Font được nhúng cùng webapp, không gọi Google Fonts/CDN. Chỉ đóng gói Latin, Latin Extended, Vietnamese; trình duyệt tải subset cần dùng. Có Inter italic thật cho chữ nghiêng; giữ giấy phép OFL trong public/fonts.

## Số liệu và căn lề

- Giá tiền, km, tuổi thọ giờ/ngày, tồn kho, số lượng, dung tích, ODO, phần trăm, tổng hợp: dùng **`font-sans tabular-nums`**. Trong cột bảng hoặc ô nhập số thêm **`text-right`**, tiêu đề cột căn phải theo dữ liệu.
- Các nhãn thường như “Chưa có dữ liệu”, “Chưa ghép”, “Đầu kỳ”, tên và đơn vị không dùng monospace. Trường trộn nhãn và mã phải tách span mã; không để nội dung thường kế thừa font mã.
- Mã số thuế, điện thoại, biển số, mã NV vẫn là chuỗi: đổi font không được ép Number, bỏ số 0 đầu, sửa giá trị, hoặc thay nghiệp vụ.
- Logo là artwork thương hiệu, giữ nguyên phông/chữ vẽ riêng; quy chuẩn trên áp dụng nội dung giao diện.

## Cách dùng

```tsx
<span className="font-mono">{vehicle.plateNumber}</span>
<td className="font-sans tabular-nums text-right">{formatVND(amount)}</td>
<span className="font-sans">Chưa có dữ liệu</span>
```

## Kết quả rà soát từng màn hình

Đã đối chiếu **152 lần khai báo** trên 150 dòng: giữ 50 vị trí mã định danh; chuyển 88 vị trí số liệu và 14 vị trí nội dung thường sang sans-serif. Không thay toàn bộ monospace bằng một phép thay thế chung. Hồ sơ gốc theo file/dòng/vị trí: `font-audit-20261024.json`. Số dòng trong hồ sơ là trước lần chỉnh này.

| Màn hình / thành phần | Mã giữ monospace | Số chuyển sans | Nội dung chuyển sans |
|---|---:|---:|---:|
| CatalogHistoryDrawer | 1 | 0 | 0 |
| CatalogListView | 1 | 5 | 0 |
| CloudCatalogApp | 1 | 0 | 0 |
| DashboardAlerts | 2 | 1 | 0 |
| DirectoryExcelImportModal | 0 | 0 | 2 |
| EnterpriseSectionsView | 8 | 4 | 4 |
| FleetMountedManager | 6 | 5 | 0 |
| FuelManagementView | 4 | 9 | 1 |
| MaintenanceReport | 4 | 11 | 1 |
| PairingDrawer | 1 | 0 | 0 |
| PairingSetsView | 3 | 0 | 0 |
| PartCardGrid | 1 | 0 | 0 |
| PartCatalogModal | 1 | 5 | 0 |
| PartStockCardModal | 2 | 5 | 2 |
| PeriodLockModal | 0 | 3 | 0 |
| ProjectDataImportModal | 0 | 1 | 1 |
| StockBalanceTable | 1 | 19 | 0 |
| TireManagementView | 6 | 9 | 1 |
| TransactionFormModal | 1 | 6 | 1 |
| TransactionHistoryView | 2 | 2 | 1 |
| TransactionReceiptModal | 5 | 3 | 0 |

Ngoài các vị trí cũ đã rà, các trường mã trong biểu mẫu API và các span mã trong drawer cũng được gắn font đúng theo nội dung. Kiểm tra bản build, font thực tải trên trình duyệt, tiếng Việt, màu sáng/tối và bố cục bảng trước khi triển khai các thay đổi font sau này.

## Kiểm tra sau triển khai mã

- TypeScript và 54 kiểm thử giao diện đạt; build đóng gói các file WOFF2 có tên hash cùng webapp.
- Kiểm tra Chrome bằng dữ liệu mẫu: font glyph thực tế của tên tiếng Việt và số là Inter; mã vật tư là JetBrains Mono (custom font đã tải), không fallback. Ô số 12px, mã 11px; số có tabular-nums và căn phải.
- Tám nhóm danh mục giữ chữ bảng/tiêu đề cột 12px và dòng khoảng 50px. Bảng ghép kiểm tra ở 1440×900, 1366×600, 390×844 và 390×640: dòng khoảng 50–51px, chỉ một vùng cuộn và tiêu đề cố định.
- Đã kiểm tra ảnh giao diện sáng/tối và điện thoại; không thay dữ liệu hoặc schema máy chủ trong lần chuẩn hóa font này.
