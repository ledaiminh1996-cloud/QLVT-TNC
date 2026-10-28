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

## Bản v2 — các sửa lỗi sau phản hồi
Quy ước ô nhập: vi-VN, chấm hàng nghìn, phẩy thập phân. 150.000 × 2, VAT 8% = 324.000 đ. Tiền VND chỉ nhận số nguyên. 150.5 bị từ chối. API / file JSON dùng chuỗi số chuẩn; chỉ số lượng, km, giờ và thuế có thể dùng dấu chấm thập phân. Không đưa JSON đã chuẩn qua bộ chuẩn hóa giao diện lần nữa.
Bỏ SCN. Ràng buộc Serial/bồn/gói Data theo cờ parts.is_fuel và needs_data_package. Không suy loại từ mã SKU ở runtime. Khóa dòng (document_id,id); quy trình trùng trả 409. Tìm kiếm chứng từ không dấu và theo Serial/bồn/gói Data. Có xác nhận bỏ thay đổi và cảnh báo khi rời trang; lỗi ghi số dòng và chuyển focus. Tách DocumentLines/DocumentList, định dạng Prettier.
Cần tích hợp cả cấu hình catalogFields.ts và catalogs.ts để sửa được cờ vật tư. Sidebar.tsx loại SCN. Migration 0021 chạy sau 0020 và toàn bộ nền 0001–0019; KHÔNG chạy vào cloud khi đang kiểm tra preview. Những file integration cần dự án gốc để dùng, không chạy độc lập. Chưa ghi sổ kho.
Đã kiểm thử toàn ứng dụng: 69 kiểm thử frontend, 60 API, TypeScript frontend/Worker và build; thêm kiểm tra trình duyệt cục bộ về tiền vi-VN/cảnh báo chưa lưu/nhập nhanh, không gọi cloud.
