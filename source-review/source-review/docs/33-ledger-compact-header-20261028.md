# Thu gọn phần đầu Sổ theo dõi kho — 28/10/2026

Thẻ Tổng nhập, Tổng xuất, Tồn cuối kỳ, Số phát sinh cùng hàng với Tải lại/Xuất Excel/In sổ. Bỏ heading và phụ đề riêng trong nội dung; breadcrumb vẫn nhận diện trang. Hàng lọc ngoài gồm tìm chung, Kỳ dạng gọn, Kho, Vật tư và Bộ lọc khác; Loại phiếu/Trạng thái nằm trong menu có số điều kiện áp dụng và nút xóa riêng. Hàng tùy chọn có chú giải nhóm/Serial, dấu Đã ghi sổ, đổi chiều và Cột hiển thị. Mật độ/Giờ ghi sổ vào menu, đóng bằng Escape/nhấn ngoài. Bỏ số nhóm phát sinh ở chân, giữ số trang/phân trang. Trên vùng nội dung từ 800px bộ lọc một hàng; nhỏ hơn tự xuống hàng, không cuộn ngang. Bảng dùng chiều cao còn lại, giữ chức năng mở từng nhóm Serial.

Không đổi API, dữ liệu sổ, tính tồn hoặc quy tắc xuất/in. Tùy chọn mật độ/cột không gọi lại API. CatalogPicker thêm placeholder tùy chọn, mặc định các nơi khác giữ nguyên.

Kiểm tra: 165 UI/shared đạt; typecheck/build đạt; sau tinh chỉnh placeholder chạy lại 3 kiểm thử sổ đạt. Browser xác nhận một hàng lọc desktop, menu mặc định ẩn và đếm điều kiện, mật độ/cột giờ, loại bỏ tiêu đề/số nhóm footer; kích thước 1920/1366/1100/390 không tràn ngang hoặc tạo cuộn trang, bảng còn cao trên 200px. Ảnh mẫu cục bộ artifacts/ledger-compact-header-*.

Đã triển khai version f8114fa1-874e-4d84-bfe7-12db45e050e6, index-xvtKYhYn.js và index-CScmgb2Y.css. Production root và bundle InventoryBooks-BhsGYaCy.js trả 200, đúng mã bản dựng.

## Đồng bộ thẻ với phiếu nhập/xuất

Đã đối chiếu trực tiếp ReceiptSummaryCards ở hai chế độ receipt/issue. Thẻ sổ kho cùng chiều cao 72px, bo góc 12px, padding 6px dọc/10px ngang, nhãn 10px, số thường 16px (18px màn rộng), giá trị nhấn mạnh 18px (20px màn rộng); chia hàng nhãn/số/khoảng cuối 12/26/16px. Tồn cuối kỳ dùng cùng màu nhấn giá trị chính. Giữ hàng thẻ/thao tác hiện có. Browser đo thẻ thực của cả ba màn hình khớp kích thước, mobile không tràn; frontend typecheck/build đạt. Thay đổi chỉ giao diện nên không thêm kiểm thử nghiệp vụ.

Đã triển khai version 5008619c-ceaf-4596-808e-dcb5680e2025, index-Bt8hIbuk.js, index-D4GxaMrJ.css. Production 200 và đúng bundle.

## Căn lưới hai hàng

Hàng bốn thẻ + nhóm nút và hàng năm bộ lọc dùng chung --ledger-header-columns, gap 8px. Từ vùng nội dung 800px: repeat(4,minmax(0,1fr)) minmax(240px,1fr), thẻ wrapper display:contents; nhóm nút chiếm đủ cột thứ năm. Khi đủ rộng cả năm cột bằng nhau, hẹp hơn cột nút tối thiểu 240px và bốn cột đầu chia đều. Dưới 800px tự xuống hàng; giữ thẻ 72px và Cũ đến mới ở hàng tùy chọn. Đã cập nhật quy tắc này vào ARCHITECTURE.md trong cùng thay đổi.

Typecheck/build đạt. Browser đo mép trái và chiều rộng từng cặp ô trên/dưới sai số dưới 1px ở viewport 1920 và 1366; viewport 1100 và 390 tự xuống hàng không tràn ngang/dọc, bốn thẻ vẫn 72px. Thay đổi bố cục, không đổi nghiệp vụ/API. Triển khai version 9ad51e56-ce30-422c-ba06-035cf8aa272a, index-BIshVTTR.js, index-Bqt0jlYq.css; production HTTP 200 đúng bundle.
