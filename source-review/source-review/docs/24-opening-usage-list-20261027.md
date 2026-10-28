# Danh sách vật tư đang sử dụng đầu kỳ — 27/10/2026

- Tách OpeningUsageTable khỏi bảng chứng từ chung. Bảng có 11 cột tương ứng đủ 11 col/ô: Số phiếu, Ngày đầu kỳ, Tài xế, Phương tiện, Nội dung, Tổng SL, Tổng nguyên giá (đ), Giá trị còn lại (đ), Trạng thái, Người lập, Thao tác.
- Phương tiện gom Xe/Rơ moóc/MP trong một ô ba dòng, dùng opening_details đã lưu. Phiếu cũ thiếu snapshot đầu phiếu hiển thị phương tiện đã lưu tại các dòng vật tư qua opening_target_labels, không tra bộ ghép hiện tại để sửa lịch sử; tài xế chưa khai báo để trống.
- Ngày giờ đầy đủ dd/mm/yyyy HH:mm, cột tiền đủ rộng theo giới hạn chứng từ. Bảng tối thiểu 1448px, cuộn trong bảng trên màn hình nhỏ, header dính trên và thao tác dính bên phải. Các nút xem/sửa, lịch sử, in, xuất JSON và xử lý nháp vẫn gọi luồng cũ, giữ quyền người dùng. Không giới thiệu tải Excel cho loại phiếu chưa có xuất Excel.
- Trạng thái đã ghi nhận dùng cùng StatusBadge, bộ lọc đồng bộ nhãn. Số phiếu mở chi tiết, sắp xếp số phiếu/ngày đầu kỳ dùng thứ tự máy chủ.
- API danh sách trả optional opening_details/opening_original_value_vnd/opening_target_labels. Tổng nguyên giá tính từ số lượng × nguyên giá đã lưu, giá trị còn lại dùng quy tắc hiện hành; phiếu thiếu dữ liệu vẫn để trống. Không dùng giá DMVT hiện tại để thay giá đã lưu.
- Tìm chứng từ hỗ trợ tài xế/biển số/thiết bị. Chỉ mục mới gồm opening_details; truy vấn bổ sung tìm snapshot header cho chỉ mục cũ, dữ liệu tìm kiếm được bind/escape. Không sửa chỉ mục của phiếu đã ghi sổ.
- Kiểm tra TypeScript hai phần, 148 frontend tests, 137 Worker tests, build; kiểm tra trình duyệt 1566px và điện thoại: đủ cột, tiền/ngày không bị cắt, thao tác còn đủ, mở chi tiết, sáng/tối/mobile. Không migration hoặc ghi thử chứng từ vào dữ liệu thật.
