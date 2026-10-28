# Sổ chi tiết NXT: tra cứu đúng Serial — 28/10/2026

## Kết quả và nguyên nhân

Tên màn hình là **Sổ chi tiết NXT**; bỏ hậu tố Thẻ kho ở menu, breadcrumb, tên bảng, Excel và in.

Trước sửa, truy vấn tính tổng/tồn trên toàn vật tư rồi tìm từ khóa ở chuỗi Serial gộp. Một mã trong lô 50 Serial làm cả dòng nhập 50 xuất hiện, dù dòng con chỉ hiện mã đang tìm. Số tồn và thẻ tiền vẫn là toàn vật tư.

Sau sửa, từ khóa khớp đầy đủ một Serial đã ghi sổ trong phạm vi vật tư/kho/trạng thái/ngày được phép xem sẽ bật `serial_filter`. CTE lọc nguồn Serial trước aggregate/window: mỗi phát sinh chỉ nhận ±1 đơn vị, chỉ giữ Serial đó; dùng cùng dữ liệu cho tồn đầu/cuối, tồn lũy kế, tổng, phân trang, Excel và in. Tìm tiền tố hoặc số phiếu vẫn là tìm kiếm dòng, không đổi số dư; loại phiếu cũng chỉ lọc dòng trong phạm vi hiện hành. Không đổi Sổ tổng hợp NXT hoặc Sổ theo dõi kho.

## Giá trị và dữ liệu

- Lấy amount_vnd từng Serial từ issue_serial_costs/recovery_serial_costs đã lưu. Dòng 1 đơn vị dùng số tiền ghi sổ. Nhập/đầu kỳ đồng giá có số Serial bằng số lượng dùng phần giá một đơn vị, làm tròn đồng bằng số nguyên. Dòng thiếu căn cứ tách giá giữ null, không bịa giá trung bình cho dòng xuất hỗn hợp.
- Không đọc giá đang thay đổi ở inventory_serials/DMVT để thay lịch sử; không thay stock_movements, số phiếu hoặc chứng từ.
- Bảo toàn quyền kho và bộ lọc thời gian. Không tải tất cả vật tư/Serial ra trình duyệt. Summary không đọc danh sách Serial. Giao diện hiển thị nhãn đang tính riêng Serial, output cũng ghi phạm vi này.
- Công cụ artifacts/verify-nxt-serial-scope.mjs chỉ gọi handler đọc bằng kết nối D1 sẵn có, không tạo phiên đăng nhập hay sửa dữ liệu. Kết quả đối chiếu lưu artifacts/nxt-serial-actual-result.json.

## Đối chiếu dữ liệu thật

Vật tư M-DC-CBXE-0006, Serial **B65006700**, 01–31/10/2026:

| Ngày CT | Phiếu | Nhập | Xuất | Tồn | Tiền nhập | Tiền xuất | Dư |
|---|---|---:|---:|---:|---:|---:|---:|
| 10/10/2026 | 10.26.00001/PN | 1 | 0 | 1 | 3.703.704 | 0 | 3.703.704 |
| 14/10/2026 | 10.26.00002/PX | 0 | 1 | 0 | 0 | 3.703.704 | 0 |

## Kiểm tra

- 174 kiểm tra UI/shared và 152 kiểm tra Worker/D1 đều đạt.
- Có ca lô 50 Serial, mã tiền tố gần giống, giá thập phân, truy vấn chữ thường, đổi kỳ, đầu kỳ 1/cuối kỳ 0, giới hạn cuối kỳ, phân trang 1 dòng, sắp xếp, xuất đầy đủ, lọc loại phiếu, quyền kho, không thay movements, giá hiện tại thay đổi không làm đổi báo cáo, dòng xuất nhiều Serial khác giá và thu hồi chưa xác định giá.
- UI kiểm tra không còn nút 50 Serial trong kết quả tìm đúng mã; số tiền/lượng/cảnh báo và bảng/Excel/in đồng bộ, tiêu đề mới.
- Trình duyệt: desktop, dark mode, điện thoại 390px không tràn ngang; Excel tải được, bản in iframe đúng Serial. Không gọi máy in thật.
- Sửa import động trong công cụ bảo trì đã có để lint UI không kéo kiểu D1 của Worker vào. Không chạy lại sửa dữ liệu lịch sử.
- Quy tắc hiện hành đã cập nhật trực tiếp trong ARCHITECTURE.md, thay quy tắc Serial chỉ lọc dòng cũ.


## Bản đã triển khai

- Worker qlvt: 425f604f-8ab4-4bd2-8eab-37bfca942f94.
- Root index-BL1G-CYK.js; InventoryBooks-KlaHmxfm.js; bookOutput-Cdj86NcC.js.
- Xác nhận hostname production đang trả asset mới; API sổ kho khi chưa đăng nhập vẫn trả 401. Kết quả chi tiết dữ liệu thật kiểm tra qua handler đọc + D1, không tạo phiên đăng nhập giả.
