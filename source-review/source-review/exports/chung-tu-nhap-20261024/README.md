# Mã nguồn chứng từ nháp Tân Nam Chinh
Ngày đóng gói: 24/10/2026. Đây là bản dựng cục bộ, chưa triển khai Cloudflare.

## Chạy riêng bản xem thử
Mở PowerShell tại thư mục preview, chạy:

    npm.cmd install
    npm.cmd run dev

Mở http://127.0.0.1:4177
Chọn Phiếu đề xuất VT-TB trong menu bên trái. Có cả các chứng từ nháp khác đang được dựng cùng hệ thống.
Dữ liệu mẫu chỉ trong bộ nhớ phiên, tải lại sẽ xóa. Không có kết nối hoặc ghi Cloudflare. npm install cần internet để cài thư viện.

## Nội dung
- preview/src/documents: toàn bộ màn hình chứng từ, biểu mẫu PĐX theo Mẫu 01, bản in, lịch sử và quy trình duyệt.
- preview/shared: kiểu dữ liệu, quy tắc kiểm tra, cấu hình trường mẫu giấy, tính dự toán.
- preview/src/api và components: thành phần cần thiết để chạy riêng.
- integration: module Worker, migration chưa áp dụng cloud, kiểm thử và tài liệu tích hợp. Đây là phần để ghép vào dự án QLVT_STUDIO hiện tại, không phải Worker độc lập.

## Tích hợp vào dự án hiện tại
Các file preview/src/documents và preview/shared giữ đường dẫn như dự án gốc. Không chép main.tsx, package.json hoặc vite.config.ts của bản xem thử đè vào ứng dụng chính.
Worker hiện tại cần nhập handleDocuments và handleDocumentWorkflows từ module documents.ts, gọi sau kiểm tra danh tính, tài khoản và cùng nguồn yêu cầu. Migration 0020 dựa trên các migration 0001–0019 của dự án, không chạy vào database chưa có cấu trúc nền. Frontend dùng DocumentsWorkspace sau cổng xác thực. Không đưa previewStore thành phương án thay thế khi API thực tế lỗi.

## Giới hạn
Chưa ghi sổ kho, chưa cập nhật tồn, chưa tự sinh chứng từ thực hiện sau duyệt. Tải tệp và hạn mức duyệt có cấu trúc chưa kết nối. Điều kiện duyệt hiện ghi trong lý do và lịch sử. Không chứa token, tài khoản thật hoặc bản sao database.
