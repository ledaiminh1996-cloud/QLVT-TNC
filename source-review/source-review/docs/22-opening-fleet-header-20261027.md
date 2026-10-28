# Đầu kỳ đang sử dụng — tài xế, bộ ghép và bảng gọn (27/10/2026)

Yêu cầu mới thay thế cách dùng Đơn vị quản lý trong docs/21-opening-management-units-20261027.md.

- Bỏ Đơn vị quản lý ở phiếu, danh sách phiếu và biểu mẫu danh mục xe/rơ moóc/máy phát/container. Bỏ phần chọn quyền đơn vị trong biểu mẫu người dùng. Không xóa cột hoặc dữ liệu lịch sử; không cần migration mới.
- Đầu phiếu có Số phiếu, Ngày đầu kỳ, Mục đích/nội dung; hàng sau có Tài xế, Xe, Rơ moóc, Máy phát. Chọn tài xế gọi luồng issueContext hiện có để lấy xe đang phân công duy nhất và thiết bị ghép hiện tại. Các ô xe/bộ ghép chỉ đọc. Thiếu xe duy nhất hiển thị cảnh báo, không tự chọn tùy ý.
- opening_details được xác thực ở shared DTO, chỉ dành cho opening/in_use. Máy chủ đọc lại tài xế/bộ ghép, không tin tên hay biển số do trình duyệt gửi lên; lưu snapshot trong phiếu, bản in dùng snapshot. Nếu xe tài xế đã thay đổi so với lúc chọn, yêu cầu chọn lại. Phiếu cũ không có opening_details vẫn mở được.
- Đổi/xóa tài xế xóa bộ ghép cũ ngay; hủy yêu cầu trước và bỏ phản hồi trễ. Không tự ghi đè xe/thiết bị người dùng đã chọn ở từng dòng vật tư.
- Bảng vật tư giảm chiều rộng tối thiểu từ 1750 xuống 1460, giảm padding/ô nhập và nút chọn. Nguyên giá hiển thị tiền có dấu hàng nghìn và đ, cùng kiểu Giá trị còn lại; chọn ô để sửa, rời ô tự định dạng. Tiếp tục lấy giá DMVT mặc định, cho sửa và tính lại ba tổng cộng.
- Không còn kiểm tra đơn vị cho opening/in_use. Vai trò Thủ kho khai báo nguồn đầu kỳ của mình; chọn nguồn/serial/báo giá/thu hồi kiểm tra người lập nguồn. Nguồn có kho gốc cũ vẫn giữ quyền kho gốc; phiếu xuất thường vẫn kiểm tra kho xuất. Khi thu hồi luôn kiểm tra riêng quyền kho nhận. Quản trị/kế toán giữ quyền chung như trước. Không mở quyền xem/thu hồi nguồn của người khác chỉ vì bỏ ô đơn vị.
- Giữ phiếu đầu kỳ không gắn kho, không tạo biến động tồn. Chú thích không thay đổi tồn kho và ba tổng cộng giữ nguyên. Bản in bỏ đơn vị, thêm tài xế và bộ ghép.
- Kiểm tra: 146 frontend tests, 135 Worker tests, TypeScript hai phần, build; UI thử chọn/xóa/đổi tài xế, phản hồi trễ, chỉnh nguyên giá và tổng cộng, dán bảng có tiêu đề, sáng/tối/mobile, bản in. Không ghi thử chứng từ vào dữ liệu thật.
