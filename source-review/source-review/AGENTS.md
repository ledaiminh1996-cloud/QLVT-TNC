# Hướng dẫn triển khai trong repository

Đọc ARCHITECTURE.md trước khi sửa chức năng. Đây là chuẩn kiến trúc người dùng chốt cho dự án Tân Nam Chinh.

- Tuân thủ Component-Driven Architecture, Function Components/Hooks, Tailwind v4 và Lucide React dùng chung.
- Mã mới có kiểu dữ liệu rõ ràng; kiểm tra dữ liệu ở ranh giới API và giữ nghiệp vụ ghi sổ trên Worker/D1.
- React 19 là chuẩn đã thống nhất. Frontend tsconfig.json hiện strict:true; xác minh cấu hình khi nhận xét, không dùng mô tả cũ để kết luận. Không tự đổi major version ngoài phạm vi công việc đang được yêu cầu.
- Bảo toàn dữ liệu và các lựa chọn UI người dùng đã chốt. Dùng npm.cmd/npx.cmd khi chạy trong PowerShell.
- Yêu cầu trực tiếp mới hơn của người dùng được ưu tiên so với tài liệu này.

- Font toàn hệ thống theo [docs/15-typography-standard.md](docs/15-typography-standard.md): Inter cho nội dung/số liệu; JetBrains Mono chỉ cho mã định danh. Số liệu dùng font-sans tabular-nums, cột số căn phải; không đưa số đo hay lời giải thích vào font-mono.

- Trước khi sửa UI tương tự, đọc mục **Quy chuẩn hiện hành** trong ARCHITECTURE.md và component chuẩn được dẫn; đối chiếu kích thước/font/padding/bố cục trước khi tạo kiểu riêng. Thẻ số liệu lấy ReceiptSummaryCards của phiếu nhập/xuất làm chuẩn 72px; thẻ sổ kho phải theo cùng thông số.
- Khi người dùng chốt thông số hoặc hành vi áp dụng lâu dài, cập nhật ARCHITECTURE.md trong cùng thay đổi, không chỉ ghi vào docs nhật ký. Ghi rõ phạm vi thay thế quy tắc cũ; docs lưu kiểm tra/triển khai, không thay thế quy chuẩn hiện hành. Không kết luận đã lưu vào architecture nếu chưa sửa tệp này.
