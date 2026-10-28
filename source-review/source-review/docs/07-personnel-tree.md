# Danh mục nhân sự: hai tab

Mọi thao tác nằm trong Danh mục nhân sự, không thêm menu Đơn vị/Phòng ban/Tài xế riêng ở thanh bên.

- Tab Nhân viên: Đơn vị → Phòng ban → Nhân viên. Thêm đơn vị không tự tạo phòng ban hoặc Đội xe. Chọn đơn vị để thêm phòng ban, chọn phòng ban để thêm nhân viên; đơn vị/phòng ban được chọn sẵn.
- Tab Tài xế: danh sách độc lập, có mã, tên, đầu kéo phụ trách, rơ-moóc phụ trách, điện thoại, email, trạng thái. Đơn vị là tùy chọn; không bắt buộc chọn phòng ban.
- Biển số đầu kéo/rơ-moóc trong hồ sơ tài xế lưu theo các trường vehicle_plate/trailer_plate hiện có. Phân công tài xế của danh mục phương tiện vẫn dùng assigned_driver_id như trước.
- Nhóm nhân sự được cố định theo tab khi thêm/sửa, tránh lẫn nhân viên và tài xế.
- Giữ ID nhân sự và quan hệ xe hiện có. Tài xế đang được phân công xe không được chuyển thành nhân viên nếu chưa gỡ phân công.
- Bản ghi nhân viên chưa phân phòng nằm ở nhánh tương ứng trong tab Nhân viên.
- Không ngừng đơn vị/phòng ban còn thành viên hoạt động; không chuyển phòng ban nếu làm sai quan hệ nhân viên hiện có.

Schema dùng migration 0008_personnel_tree.sql. Thay đổi bỏ Đội xe tự tạo không cần migration mới. Các Đội xe cũ được giữ lịch sử; bản ghi tự tạo không có thành viên được ngừng sử dụng khi sửa dữ liệu. Phương tiện chỉ nhận phân công tài xế đang sử dụng.

API /api/org-units, /api/departments, /api/staff có bộ lọc unit_id/department_id/staff_type/kind; ghi dữ liệu dùng phiên bản, phân quyền, audit và ràng buộc D1.
