# Sổ theo dõi kho theo phát sinh — 27/10/2026

Thay màn hình tồn theo nhóm của Sổ theo dõi kho bằng danh sách phát sinh đã ghi sổ. Đúng 14 cột: Ngày phiếu, Số phiếu, Loại phiếu, Kho, Trạng thái hàng, Mã vật tư, Tên vật tư, ĐVT, SL nhập, SL xuất, Serial, Biển số, Loại thiết bị, ODO/Giờ. Ngày phiếu giữ cả giờ để phân biệt phát sinh cùng ngày.

API book=stock trả BookMovement, mới nhất trước, phân trang trên phát sinh. Có cả phiếu OPENING tồn kho trong khoảng ngày; không gồm khai báo đang sử dụng đầu kỳ. Mỗi bên của điều chuyển kho là một dòng nhập/xuất ở kho tương ứng; không nhân bản theo từng Serial. SL theo đơn vị hiển thị, Serial nguyên chuỗi lịch sử. Hai sổ card/summary giữ cách tính số dư và quy tắc kỳ như docs/27.

Bỏ các thẻ tổng tiền ở màn theo dõi và tổng tiền cuối bản xuất/in của sổ này. Excel và bản in cùng 14 cột. Nhấn số phiếu xem bản gốc chỉ đọc; nhấn mã vật tư mở thẻ kho đúng kho và trạng thái, có quay lại.

Thông tin thiết bị ưu tiên thiết bị của từng dòng. bookTarget đọc snapshot header/labels/line và usage nguồn cho thu hồi, không tra bộ ghép hiện tại. Dòng rơ moóc không tự lấy ODO đầu kéo. Hiển thị số đo đã lưu, giữ số 0 và tối đa 3 số lẻ, thêm km/giờ để phân biệt; thiếu để dấu gạch. Máy phát/Container dùng mã thiết bị trong cột Biển số khi không có biển số. Phiếu nhập kho không ghi nhận thiết bị thì không tự điền thiết bị.

Lưu thêm loại phương tiện/thiết bị trong labels khi xác thực phiếu mới; thu hồi lưu loại của thiết bị nguồn cùng recovery_source. Không cập nhật ngược chứng từ cũ. Dòng cũ có thể suy từ snapshot ghép nối của chính phiếu/phiếu nguồn; thiếu căn cứ chỉ hiển thị loại chung Phương tiện/Thiết bị hoặc dấu gạch, không đoán loại từ mã biển số. Đọc tên vật tư từ snapshot và bỏ tiền tố SKU đã lặp khi có, không lấy tên hiện tại để thay lịch sử.

Không thay schema, sổ kho, giá vốn hoặc quyền. Tất cả truy vấn/đếm/xuất vẫn lọc quyền kho trên máy chủ. DTO client kiểm tra trường metadata và định dạng số đo của màn tracking.

Kiểm tra: 158 kiểm thử giao diện/shared và 145 kiểm thử Worker/D1 đạt. Bao gồm đúng thứ tự/số cột, số lượng mở kỳ không bỏ khỏi tracking, điều chuyển, rơ moóc/máy phát, ODO và giờ, số 0, không lấy ODO hiện tại, nguồn thu hồi, Serial, phân trang và xuất toàn bộ. TypeScript frontend/Worker đạt. Trình duyệt sáng/tối/điện thoại, cuộn đến các cột cuối, Excel download, drilldown/quay lại đều đạt; ảnh tại artifacts/stock-tracking-*.png.

Triển khai phiên bản bfd46df7-092d-41d0-8f52-4603f4d882e2; trang chính HTTP 200 đúng gói index-5xM3o7KQ.js; API tracking chưa đăng nhập HTTP 401. Không migration hoặc ghi chứng từ thử lên cloud.
