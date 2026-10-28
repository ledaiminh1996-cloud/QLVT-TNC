# Thêm, sửa, xóa ngay trong menu webapp

Màn hình mặc định được đưa về bố cục webapp có sidebar, logo, menu Danh mục và thanh thao tác. Không cần chuyển sang trang danh mục riêng để lưu máy chủ.

- Menu Nhân sự, Kho và Nhà cung cấp dùng lại màn hình/biểu mẫu cũ, với dữ liệu đọc và ghi qua API. Các hàm localStorage chỉ chạy trong chế độ xem dữ liệu cũ được mở riêng.
- Menu Vật tư và Phương tiện dùng bảng/biểu mẫu API trong cùng bố cục webapp, có thao tác thêm, sửa và xóa khỏi sử dụng.
- Nút Xóa gửi cập nhật ngừng sử dụng trên máy chủ, giữ lịch sử và liên kết, không DELETE vĩnh viễn.
- Lưu thất bại không đóng biểu mẫu hoặc ghi vào localStorage. Sửa dùng version của bản ghi đã tải để phát hiện xung đột. Chỉ báo thành công sau khi máy chủ trả kết quả.
- Danh mục máy chủ mới có thể trống. Không tự nhập dữ liệu mẫu/localStorage cũ vào D1.
- Nhân sự giữ được chức danh, bộ phận, điện thoại, email, biển số xe/moóc phụ trách. Các biển số phụ trách là thông tin danh mục, chưa thay thế quan hệ lắp ráp/chuyến vận hành.
- Nhà cung cấp giữ được mặt hàng cung ứng. Kho giữ nhãn loại kho và sức chứa dạng số (bồn dùng lít); tồn thực tế hiển thị chưa kết nối sổ kho, không nhập tồn trực tiếp từ danh mục.
- Import hàng loạt ở ba màn hình cũ tạm khóa để tránh lưu từng phần chưa có kết quả đối soát. Xuất danh mục vẫn khả dụng.
- Các menu phiếu/sổ kho/bảo trì chưa nối máy chủ sẽ hiển thị trạng thái đang hoàn thiện; không âm thầm chạy thao tác local trong chế độ máy chủ. Vẫn có nút xem dữ liệu cũ riêng.

## Cập nhật bản online

1. Tại thư mục `source-review/worker`, áp dụng migration bổ sung trước khi deploy API mới:

```powershell
npx.cmd wrangler d1 migrations apply tnc-vattu --remote
```

Chỉ cần migration mới `0003_directory_details.sql`; hai migration đã có không chạy lại. Migration mới thêm cột, không xóa dữ liệu.

2. Tại thư mục `source-review`, build giao diện:

```powershell
npm.cmd run build
```

3. Quay vào thư mục `worker` và deploy cả API/giao diện:

```powershell
npx.cmd wrangler deploy
```

4. Mở `https://qlvt.tannamchinh.workers.dev`, Ctrl+F5, chọn `Danh mục → Danh mục nhân sự`. Thêm hoặc sửa, chờ thông báo đã lưu máy chủ. Tải lại trang để kiểm tra dữ liệu còn nguyên.

Không sử dụng nút “Xem dữ liệu cũ trên máy” nếu muốn cập nhật máy chủ. Bản này chưa được tự động deploy; không gọi database production trong quá trình phát triển/kiểm thử.
