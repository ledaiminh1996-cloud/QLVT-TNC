# Lịch sử danh mục

Mọi danh mục máy chủ dùng chung nút lịch sử và CatalogHistoryDrawer, kể cả quyền chỉ xem. Có trên bảng và thẻ VT-TB; đơn vị/phòng ban/nhân viên/tài xế; kho/bồn; NCC; tất cả tab phương tiện; nhóm tuyến, loại thiết bị, nguồn, trạng thái và mã đối tượng/nhóm VT-TB. Ghép thiết bị giữ drawer thao tác và nhật ký riêng.

GET /api/{resource}?view=history&entity_id={id}&page=1&page_size=25 tái sử dụng quyền đọc hiện có của resource. Không tải lịch sử khi mở danh sách. Phân trang ổn định created_at/id, chỉ đọc nhật ký của entity_type + entity_id tương ứng; nhận cả tên resource dạng dấu gạch dưới của nhật ký nhập cũ. Danh mục users vẫn chỉ admin. Bản ghi đã xóa cứng có thể đọc lịch sử nếu nhật ký còn tồn tại.

Trước/sau hiển thị các trường đã ghi nhận, theo nhãn danh mục, đơn vị và thang số đúng. Snapshot cũ thiếu trường không được suy diễn thành xóa dữ liệu. Tên bản ghi liên kết lấy theo danh mục hiện tại và ghi rõ điều này trên drawer. Chưa có nhật ký thì thông báo trống; không tạo giả lịch sử trước đây. Các audit_events hiện có không bị viết lại.

Thay đổi ghép mới ghi thêm audit cho rơ moóc/máy phát liên quan và đồng bộ trường xe/rơ moóc của tài xế trong cùng giao dịch. Nhật ký ghép cũ của đầu kéo cũng có thể xem từ lịch sử phương tiện. Nhật ký thiết bị liên quan trước lần triển khai này chỉ xuất hiện nếu từng được ghi nhận trực tiếp.

Migration 0019 chỉ thêm chỉ mục audit_events(entity_type,entity_id,created_at,id), không đổi dữ liệu. Tham số dùng cache cho danh mục nhỏ nhưng lịch sử luôn đọc mới từ máy chủ. Mỗi lần chỉ tải một trang lịch sử, tên tham chiếu đọc theo ID cần thiết (chia lô tối đa 80).
