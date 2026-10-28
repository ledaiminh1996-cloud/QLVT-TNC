# Phiếu Tồn kho đầu kỳ — 27/10/2026

Tên màn hình/form và bản in: Phiếu Tồn kho đầu kỳ. Phiếu kho mới cấp mã /DK; vật tư đang sử dụng đầu kỳ tiếp tục /SD với dãy số riêng. Mã phiếu cũ giữ nguyên. Không thay schema, cập nhật mã cũ hoặc đặt lại bộ đếm lịch sử.

Cấp số dự kiến và cấp số chính thức cùng dùng documentSymbol; API next-number nhận opening_mode (stock mặc định hoặc in_use). Cấp số chính thức vẫn ở batch nguyên tử cùng ghi phiếu/audit, giữ cơ chế idempotency và chống trùng. Kiểm tra cloud trước triển khai: chưa có mã /DK hoặc bộ đếm DK.

Đầu form bốn ô bằng nhau: Số phiếu, Ngày đầu kỳ, Kho, Mục đích / nội dung. Bỏ ô Diễn giải / ghi chú cuối form; giữ ghi chú cũ trong dữ liệu lịch sử. Bảng gồm Vật tư, Số lượng, Đơn giá, Thành tiền, Serial, Trạng thái hàng, Ghi chú, Thao tác. Bỏ VAT trên form, tổng cộng, bản in và bảng nhập nhanh. Phiếu nhập mua hàng không đổi. Tồn kho đầu kỳ vẫn được máy chủ kiểm tra VAT bằng 0.

Serial là input text một dòng, không có tay kéo giãn. Nhập nhiều serial bằng dấu chấm phẩy hoặc dấu phẩy; khi dán nhiều dòng/tab, hệ thống đổi thành danh sách phân cách để giữ đủ serial. Giữ nguyên kiểm tra số lượng/trùng serial trước khi ghi sổ.

Đã kiểm tra TypeScript frontend/Worker, build và toàn bộ bộ kiểm thử liên quan. Kiểm thử cấp số xác nhận DK và SD độc lập, xem trước không tiêu số, cùng yêu cầu lưu không cấp thêm số, mã cũ và khóa ngoại được giữ. Kiểm tra trình duyệt xác nhận bốn ô bằng nhau, tám cột khớp, Serial không mất khi đổi ô khác, sáng/tối/điện thoại không tràn trang. Ảnh tại artifacts/opening-stock-*.png.

Triển khai thành công phiên bản 278fd3dc-2e3b-4efb-84b2-8c4b137c170d. Trang chính HTTP 200 đúng gói index-DonhYTdz.js; API cấp số chưa đăng nhập trả 401. Không chạy migration, không ghi phiếu thử trên cloud. Kiểm thử frontend/shared 152 đạt; Worker/D1 140 bài còn lại đạt và bài mới về mã DK đã chạy lại đạt sau khi sửa truy vấn kiểm tra và tham số commit của bài kiểm tra.
