# Rà soát và thay đổi bộ ghép

Màn Ghép thiết bị dùng API cùng hostname /api/equipment-pairing-sets, phân trang 25 dòng. Thống kê tính trên toàn bộ kết quả tìm kiếm và nhóm tuyến; ô thống kê lọc tiếp trong tập đó. Đủ bộ gồm rơ moóc, máy phát, tài xế hoạt động, đầu kéo hoạt động và không có cảnh báo trùng tài xế.

- Nhóm tuyến chỉ xem, sửa tại danh mục đầu kéo.
- view=available: tìm và phân trang thiết bị/tài xế rảnh; trạng thái phải hoạt động. Kiểm tra lại khi lưu, bảo vệ bằng unique/trigger và giao dịch D1.
- Drawer: assemble, replace_trailer, replace_generator, replace_driver, detach. Mọi thay đổi cần effective_at có múi giờ, không ở tương lai và không trước sự kiện cuối; reason bắt buộc. Chỉ admin/accountant ghi. Hệ thống áp dụng khi lưu, không tạo lịch tương lai.
- Mỗi thay đổi lưu pairing_change_events bất biến và audit_events trong cùng giao dịch. Trường tương thích xe/rơ moóc trên staff đồng bộ từ các liên kết chính thức. Liên kết cũ giữ lịch sử, không xóa cứng.
- Đổi máy phát thay toàn bộ máy phát hiện tại bằng một máy phát đã chọn; drawer cảnh báo nếu đang có nhiều máy phát. Dữ liệu nhập cũ có hai máy phát được giữ nguyên cho đến thao tác có chủ đích.
- PATCH /review xác nhận các cặp id/version đã chọn (tối đa 100), nguyên tử toàn lô. Cảnh báo không bị xóa bởi rà soát. reviewed_version khác version thì tự thành chưa rà soát khi đổi liên kết, nhóm tuyến, trạng thái thiết bị hay thông tin tài xế.
- API equipment-pairings cũ chỉ đọc; các thao tác ghi phải qua quy trình mới để có lý do và nhật ký.
- Xem lịch sử mới phân trang; nhật ký nhập và chỉnh dữ liệu trước tính năng này vẫn được giữ trong audit_events, không tạo giả thời điểm lịch sử.
- Xuất Excel tải toàn bộ các trang theo bộ lọc/sắp xếp khi người dùng bấm; các mã được xuất kiểu chuỗi. Màn hình bình thường không tải toàn bộ danh mục.

Migration 0018 chỉ thêm thông tin rà soát, lịch sử và trigger; không tự đánh dấu đã rà soát, không sửa liên kết nhập cũ, không đổi tên/mã tài xế hoặc tuyến đường.

## Bố cục và điều hướng (24/10/2026)

Ghép thiết bị là mục riêng trong menu Danh mục (dm_ghep_thiet_bi), không còn là tab trong phương tiện. Màn này dùng chiều cao viewport, phần đầu cố định và chỉ bảng cuộn dọc trong khoảng trống còn lại; tiêu đề bảng sticky. Các danh mục khác vẫn cuộn như trước. Toolbar điện thoại thu gọn, phần giải thích có thể mở rộng.

Ô thống kê có hover/focus và chip bỏ lọc; tên tài xế/mã NV chung một cột; cảnh báo icon + nội dung ngắn và tooltip đầy đủ; mã thiết bị chỉ gạch chân khi hover/focus; tiến độ rà soát hiển thị phần trăm và bộ đếm. Xuất Excel giữ riêng hai cột tên/mã NV để xử lý dữ liệu.
