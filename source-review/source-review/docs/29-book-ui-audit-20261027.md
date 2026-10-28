# Chỉnh cảnh báo giao diện Sổ theo dõi kho — 27/10/2026

Theo các vùng tô vàng trong ảnh người dùng: tăng đệm quanh bảng lên 8px và ô bảng 12px dọc/16px ngang; viewport cuộn riêng có thể focus bằng bàn phím, giữ đủ 14 cột. Chú thích cuối sổ rút gọn thành “Chỉ hiển thị phát sinh đã ghi sổ.” và giới hạn chiều dài dòng.

Ô trống hiển thị Chưa ghi nhận, giá trị tiền chưa biết hiển thị Chưa xác định, giữ số 0 và không thay dữ liệu thật. Nội dung giải thích không dùng monospace. Excel vẫn giữ ô tiền chưa xác định rỗng; bản in đồng bộ nhãn hiển thị. Dấu phân cách kho/vật tư trong bộ lọc dùng chấm giữa.

Sidebar: icon của mục đang chọn dùng màu tối trên nền cam, kể cả menu thu gọn và yêu thích; tăng tương phản caption thương hiệu/chân menu, chữ chân menu 12px. Bỏ khung bo/viền/bóng lồng quanh logo, hiển thị logo 48px và gán tên truy cập SVG. Giữ nguyên artwork/màu thương hiệu; đây là ảnh thương hiệu, không đổi màu logo để chạy theo phép đo chữ thông thường. Sidebar dùng chiều cao viewport động.

Không thay API, quyền hoặc dữ liệu nghiệp vụ. TypeScript và các kiểm thử sổ hiện có đạt. Trình duyệt kiểm tra 14 dòng ở viewport tương đương ảnh, sáng/tối: icon đang chọn tương phản >9:1, chân menu ở sáng >7:1 và tối >4,5:1, vùng thiếu dữ liệu >4,5:1; đệm 12/16 và khung 8px, logo 48px, bảng cuộn riêng, không tràn trang; không còn em-dash làm placeholder trên màn theo dõi. Kết quả đo và ảnh tại artifacts/book-ui-audit-*.

Đã triển khai phiên bản c97ba684-4f88-435f-b52f-c85e882d10e4. Trang chính HTTP 200 đúng gói index-DZbK01d-.js. Kiểm tra TypeScript, sáu kiểm thử sổ, build và đo giao diện trên trình duyệt đều đạt. Không thay dữ liệu máy chủ.
