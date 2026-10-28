# Thu hồi từ vật tư đang sử dụng đầu kỳ — 28/10/2026

Chọn nguồn đầu kỳ tự mang nguyên giá, tỷ lệ còn lại và người xác nhận đã lưu sang dòng thu hồi, cho phép sửa khi tháo. Worker đọc lại dòng đầu kỳ theo root_line_id của usage; khi trường đánh giá chưa được gửi, dùng snapshot đầu kỳ, không dùng giá danh mục hiện tại và không tin tổng tiền phía giao diện. Trường được gửi rỗng vẫn là thiếu căn cứ, không tự thay bằng mặc định. Nguồn biết giá gốc vẫn giữ quy tắc tuổi thọ hiện hành. Thu hồi từng phần tính theo số lượng, không lấy toàn bộ tổng giá trị nguồn.

Cột kho nhận căn giữa và cùng chiều cao ô nhập. Xóa chú thích dài cuối bảng, ẩn Diễn giải / ghi chú cuối form riêng thu hồi, giữ ghi chú dòng và nội dung phiếu. Đổi tên Phiếu thu hồi VT-TB trong biểu mẫu, menu và breadcrumb. Không thay dữ liệu các phiếu đã ghi sổ hoặc sửa schema.

Kiểm tra: 146 Worker/D1 và 161 UI/shared đạt; lint, Worker typecheck, build đạt. Có ca nguyên giá 5.000.000 × 20% = 1.000.000/đơn vị, thu hồi từng phần, tỷ lệ 0%, đổi giá danh mục không ảnh hưởng snapshot, cho sửa giá/tỷ lệ/người xác nhận, giá gốc biết không cho ghi đè, và bỏ trống có chủ ý vẫn pending. Browser sáng/tối xác nhận giá trị và căn giữa kho, tên phiếu và các phần đã ẩn. Mẫu thử chỉ cục bộ.

Đã triển khai version 16014137-dd2a-49f7-8950-2d26c9a04fcf. Bundle index-90JRhcQG.js, CSS index-BDFH0eoL.css. Production root/bundle biểu mẫu trả 200; API giá thu hồi chưa đăng nhập trả 401.
