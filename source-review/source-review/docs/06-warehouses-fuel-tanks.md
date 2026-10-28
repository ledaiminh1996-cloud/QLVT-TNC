# Kho và bồn dầu

Một kho chứa nhiều bồn dầu, mỗi bồn bắt buộc thuộc một kho. Vật tư vẫn quản lý theo kho.

- Danh mục kho: mã, tên, địa điểm, trạng thái. Không dùng dung tích bồn làm thuộc tính kho.
- Danh mục bồn dầu: mã, tên, kho trực thuộc, dung tích lít (tối đa 3 chữ số thập phân), vị trí, trạng thái, ghi chú.
- Nút Xem bồn ở từng kho mở danh sách bồn đã lọc đúng kho. Khi thêm bồn từ danh sách này, kho được chọn sẵn.
- Bồn có thể chuyển sang kho khác đang sử dụng. Không xóa kho còn bồn đang sử dụng; cần chuyển hoặc ngừng các bồn trước. Xóa là ngừng sử dụng, vẫn giữ lịch sử.
- Cả hai danh mục dùng phân quyền và kiểm tra phiên bản, ghi audit cùng giao dịch. Trigger D1 kiểm tra liên kết khi có thao tác đồng thời.

API: /api/warehouses và /api/fuel-tanks; danh sách bồn hỗ trợ tham số warehouse_id. Dung tích lưu bằng phần nghìn lít ở capacity_milli.

Migration 0007_fuel_tanks.sql tạo bảng fuel_tanks và ràng buộc, không đổi dữ liệu vật tư. Kiểm tra trước triển khai: D1 hiện chưa có kho/bồn và chưa có phát sinh sổ kho; không tự tạo kho hay tự gán quan hệ cho dữ liệu cũ.

52 kiểm thử đạt: 23 frontend, 29 API/runtime; bao gồm lọc đúng kho, chọn sẵn kho khi thêm bồn, dung tích, chuyển bồn, ngừng sử dụng, ràng buộc cha con và phiên bản cũ.
