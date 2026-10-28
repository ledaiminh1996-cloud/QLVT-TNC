# Vật tư đang sử dụng đầu kỳ theo đơn vị quản lý — 27/10/2026

Đã triển khai Worker 3d1ca24f-acea-423d-94b7-f86bf0360d3a, migration 0034_opening_management_units.sql.

## Phiếu và tổng cộng
- Phiếu đang sử dụng không chọn kho. Đơn vị quản lý tự đọc theo từng xe/thiết bị và tổng hợp ở đầu phiếu. Danh mục phương tiện, rơ moóc, máy phát/container có trường Đơn vị quản lý dùng danh mục Đơn vị.
- Ưu tiên đơn vị đã khai báo trực tiếp; tiếp theo đơn vị tài xế đang phân công, giá trị Vị trí/đơn vị khớp duy nhất với danh mục, hoặc đơn vị đầu kéo đang ghép duy nhất. Không chọn đơn vị theo người lập/kho. Thiếu căn cứ hiển thị Chưa xác định; quản trị/kế toán có thể ghi nhận, thủ kho cần đơn vị đã được cấp.
- Máy chủ tự xác định và lưu snapshot đơn vị theo từng nguồn, không tin đơn vị gửi từ giao diện. Đổi đơn vị phương tiện về sau không tự chuyển quyền lịch sử của nguồn đã ghi nhận.
- Chú thích: “Ghi nhận vật tư đang sử dụng tại ngày đầu kỳ. Không làm thay đổi tồn kho.” Bỏ ô Diễn giải/ghi chú chung bên dưới. Ghi chú từng dòng giữ nguyên.
- Tổng cộng: số lượng; tổng nguyên giá = tổng (nguyên giá một đơn vị × số lượng); tổng giá trị còn lại theo tỷ lệ. Tính số thập phân bằng số nguyên theo thang đo. Dòng thiếu dữ liệu làm tổng tiền tương ứng để trống và báo số dòng thiếu. 0% là giá trị còn lại bằng 0 hợp lệ. Bản in đồng bộ đơn vị, chú thích và ba tổng cộng.

## Quyền và thu hồi
- Quản lý người dùng có thêm danh sách Đơn vị quản lý vật tư đang sử dụng cho vai trò Thủ kho, tách riêng danh sách kho. Không tự cấp quyền mới cho tài khoản cũ. Quản trị/kế toán giữ quyền toàn hệ thống như trước.
- Nguồn đầu kỳ mới có snapshot đơn vị thì kiểm tra quyền đơn vị cho danh sách chờ thu hồi, serial, báo giá và ghi sổ thu hồi. Kho nhận vẫn kiểm tra quyền kho riêng; không được suy quyền đơn vị từ kho nhận.
- Nguồn cũ chưa có snapshot đơn vị giữ kiểm tra kho gốc để không làm mất khả năng thu hồi lịch sử. Nguồn mới chưa xác định đơn vị không có kho giả và chỉ được vai trò toàn hệ thống thao tác.
- Phiếu đầu kỳ mới có warehouse_id rỗng, from/to warehouse của dòng tồn đều NULL; không sinh stock_movements, buckets hoặc lots. Chỉ tạo nguồn đang sử dụng và liên kết thu hồi.

## Chuyển đổi và nghiệm thu
- Migration bổ sung managing_unit_id ở vehicles/equipment/opening_usage_lines, bảng document_unit_access; rebuild inventory_document_lines có cờ is_opening_usage để cho phép riêng nguồn đầu kỳ không có kho. Trigger chặn gắn cờ cho chứng từ khác và chặn gắn kho cho dòng đầu kỳ mới.
- Đã sao lưu trước khi áp dụng. Đối chiếu bản sao dữ liệu thật: 57 bảng, 15.579 bản ghi và 127 đối tượng schema được bảo toàn; khóa ngoại không lỗi. Không sửa giá trị sổ kho hay lịch sử cũ.
- Kiểm tra 144 frontend tests, 135 Worker tests, TypeScript, build; có kiểm tra migration trên dữ liệu có liên kết ở SQLite và D1 runtime. Kiểm tra quyền đơn vị khác, quyền kho nhận tách riêng, đổi đơn vị xe sau khi ghi nhận không đổi quyền nguồn; kiểm tra tổng số lẻ, giá trị 0 và dữ liệu thiếu.
- Đã kiểm tra giao diện sáng/tối/mobile và bản in. Migration cloud hoàn thành; kiểm tra foreign_key_check cloud không có lỗi, số dòng tồn/biến động/lần sử dụng còn đủ. Kiểm tra bundle giao diện trực tuyến đúng phiên bản. Không ghi thử chứng từ vào dữ liệu thật.
