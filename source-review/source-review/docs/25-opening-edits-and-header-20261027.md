# Sửa phiếu vật tư đang sử dụng đầu kỳ — 27/10/2026

Danh sách bỏ cột Tổng SL. Hai thao tác chính là Xem và In; Sửa, Lịch sử và tải dữ liệu đặt trong menu … . Ba tổng cộng trong form vẫn giữ theo yêu cầu trước đó.

## Bố cục nhập liệu

Hàng 1 chia đều ba ô: Số phiếu, Ngày đầu kỳ, Mục đích / nội dung.
Hàng 2 chia đều sáu ô: Tài xế, Đầu kéo, ODO Đầu kéo, Rơ moóc, ODO Rơ Moóc, Máy phát. Hai hàng cùng chiều rộng; màn hình nhỏ tự xuống hàng.
Chọn tài xế lấy bộ ghép hiện tại và ODO trong danh mục. ODO được phép sửa và lưu trong snapshot đầu phiếu, xuất hiện trên bản in. Đây là số đo tại thời điểm khai báo đầu kỳ, không tự gán thành ODO lắp gốc của từng vật tư. Phiếu cũ giữ snapshot lịch sử.

## Sửa và bảo toàn nguồn thu hồi

Cho sửa phiếu đã ghi sổ khi kỳ chưa khóa và nguồn chưa có thu hồi, chuyển thiết bị, gia công, liên kết giá vốn hoặc phiếu thu hồi đang soạn. Người dùng phải nhập lý do sửa; lịch sử lưu dữ liệu trước/sau.
Worker xác thực lại danh mục, quyền, phiên bản, kỳ và định giá. Toàn bộ thay đổi cùng kiểm tra phụ thuộc được thực hiện trong một batch D1. Migration 0035 thêm trigger bảo vệ ngay thời điểm ghi, dùng khóa sửa chứng từ hiện có; không sửa dữ liệu lịch sử khi áp dụng migration.
Dòng giữ lại bảo toàn ID dòng nguồn và ID lần sử dụng. Phiên bản lần sử dụng tăng khi sửa để chặn một lượt thu hồi đã đọc dữ liệu cũ. Dòng thêm mới có ID mới; dòng bỏ chỉ được xóa khi không có liên kết. Không tạo phát sinh tồn kho cho khai báo đầu kỳ.

## Kiểm tra

150 kiểm thử giao diện/shared và 140 kiểm thử Worker/D1 đạt; kiểm tra TypeScript đạt. Bao gồm sửa nhiều lần, giữ ID nguồn, phiên bản cũ, kỳ khóa, phụ thuộc phát sinh trước batch và thu hồi đồng thời với sửa.
Kiểm tra trình duyệt: Xem/In/menu, sửa và lưu, hai hàng chia đều 3/6 ô, lưu ODO, chế độ xem khóa nhập, sáng/tối và điện thoại không tràn trang.
Bản sao D1 trước migration: artifacts/before-opening-edit-20261027.sql. Áp dụng thử migration trên bản sao giữ nguyên 15.680 dòng của 58 bảng và 129 đối tượng schema hiện có; không có lỗi khóa ngoại. File sao lưu chứa dữ liệu nhạy cảm, không phân phối.

## Triển khai

Đã áp dụng migration 0035 và triển khai Worker phiên bản ff037dd2-5b70-4a02-ad4e-1c6096e7e82e. Kiểm tra máy chủ: không có lỗi khóa ngoại, không còn khóa sửa đang giữ. Trang chính HTTP 200 dùng đúng gói index-DDIx4CLJ.js; API chứng từ chặn truy cập chưa đăng nhập bằng HTTP 401. Không tạo phiếu giả trên dữ liệu thật để kiểm tra.
