# Danh mục phương tiện thiết bị

Bốn tab: Đầu kéo, Rơ moóc, Máy phát, Cont. Chỉ quản lý danh mục, chưa ghép nối, phân công tài xế hay gắn linh kiện.

- Đầu kéo/rơ moóc dùng bảng vehicles hiện có, lọc type trên máy chủ; bảo toàn liên kết và dữ liệu cũ.
- Máy phát/Cont dùng equipment riêng (migration 0012), mã duy nhất không phân biệt hoa thường, tên, loại, nhãn hiệu, serial, năm, trạng thái, ghi chú; máy phát thêm giờ hoạt động nguyên không âm và không giảm khi sửa.
- API /api/equipment dùng xác thực, phân quyền, version và audit giống các danh mục khác. Ngừng hoạt động thay vì xóa cứng.
- Mỗi tab tải 25 dòng/trang, tìm kiếm và lọc trạng thái phía máy chủ. Biểu mẫu cố định loại theo tab và không tải danh sách tài xế.
- Xe văn phòng/xe thuê ngoài cũ vẫn giữ nguyên trong database; không đưa vào bốn tab này.
