# Màn hình danh sách Phiếu thu hồi VT-TB — 28/10/2026

Dùng DocumentList cho trạng thái/bộ đệm tổng và các thao tác hiện có, RecoveryListView cho phần đầu/bảng riêng; ListMenu tách dùng chung với sổ kho. Lưới 5 cột chung với sổ kho, bốn thẻ theo chuẩn 72px, nhãn/số/chip; giá trị thu hồi nhấn xanh. Header gọn có breadcrumb; bỏ banner danh mục ở màn nghiệp vụ này. Bảng 11 cột, ngày chứng từ không có giờ, phương tiện và người giao/nhận hai tầng, lý do tối đa hai dòng với tooltip, tiền căn phải. Xem/In và menu … ; sửa/xử lý chỉ cho nháp theo quyền hiện có. Không thêm nghiệp vụ sửa phiếu đã ghi sổ.

API GET document-drafts?kind=recovery đọc snapshot dòng/đầu phiếu đã lưu, riêng một handler chỉ đọc; không thay schema hoặc lịch sử. Bộ lọc ngoài q/Kỳ/kho/vật tư; khác gồm classification/vehicle/status/recipient, giữ valuation_pending. Part và phân loại khớp cùng dòng. Lọc theo phiếu chứa dòng phù hợp; lượng/tiền/đếm loại của phiếu vẫn đầy đủ, không cắt một phần phiếu. Thẻ tổng toàn bộ bộ lọc; số dòng theo CSD/CSC/KSD/CTL không bị nhân bởi Serial. include_totals=0 chỉ đếm phiếu và lấy trang, không chạy tổng; DocumentList cache tổng theo bộ lọc/người dùng. Giá pending giữ null. Quyền đọc theo handler chứng từ hiện hành được giữ, không mở rộng phạm vi thủ kho.

Mặc định tháng hiện tại, 20 dòng; tùy chọn 50/100. Các bộ lọc áp dụng ở máy chủ và kiểm tra giá trị. Tìm snapshot cũ không cần cập nhật lại dữ liệu: documentSearchGlob tạo mẫu ràng buộc có escape cho hoa/thường/dấu tiếng Việt; trường đã có search_text tiếp tục dùng normalized LIKE. Đã thử tìm theo xe/rơ moóc/máy phát/container, tên giao/nhận, lý do, literal dấu % và ký tự GLOB. Bản in phiếu tiếp tục dùng RecoveryPrint hiện có.

Kiểm tra và triển khai ghi bên dưới sau khi hoàn tất. Ảnh xem thử artifacts/recovery-list-* chỉ dữ liệu cục bộ.

## Kiểm tra và triển khai

167 kiểm thử UI/shared và 147 kiểm thử Worker/D1 đạt. Sau bổ sung tìm snapshot cũ và kết hợp lọc cùng dòng, chạy lại kiểm thử API ảnh hưởng và runtime Miniflare/D1 đạt; lint/Worker typecheck/build đạt. API kiểm tra tổng qua nhiều trang, bốn phân loại trong một phiếu, lượng không bị nhân, tìm các thành phần bộ xe và tên giao/nhận/lý do, uppercase/không dấu trên dữ liệu cũ, literal ký tự mẫu, kết hợp part/class cùng dòng, quyền thủ kho/viewer và include_totals=0. UI kiểm tra chip, trạng thái, tìm, bộ lọc nhận, cache tổng khi chuyển trang và menu. Browser đo bốn thẻ 72px, cùng lưới 5 cột với hàng lọc, 11 cột bảng, đổi phân loại/menu và không cuộn ngang trên desktop/laptop; điện thoại dùng thẻ, còn vùng bảng 336px, không tràn trang. Không tạo phiếu thử trên production.

Đã triển khai version dddfff64-3ea9-4bac-9611-7bfe1d163e38. Production root 200 đúng index-kR04xRfR.js; DocumentsWorkspace-ABpsm8h1.js 200; API thu hồi chưa đăng nhập 401. ARCHITECTURE.md đã cập nhật thông số và luồng hiện hành cùng thay đổi. Không migration, không cập nhật lại chứng từ đã ghi sổ.

## Chọn nhiều loại và phương tiện ba dòng

Bộ lọc Phân loại đổi thành bốn checkbox, chip trên thẻ cũng bật/tắt từng mã và giữ các mã khác. API recovery_classification nhận một mã hoặc chuỗi CSV hợp lệ không trùng, tối đa bốn mã; SQL dùng IN với bind parameters theo OR, vẫn kết hợp part_id trên cùng dòng. Không chọn là tất cả. Không đổi phân loại của dòng nhập liệu hoặc lịch sử. Preview cùng logic.

Ô phương tiện có nhãn Xe / Rơ moóc / MP màu phụ, nhãn rộng 55px và mã định danh căn cùng cột, thiếu dùng dấu gạch; vẫn đọc snapshot. Độ rộng các cột đã cân lại để ba dòng không làm tràn bảng. ARCHITECTURE.md đã cập nhật cùng thay đổi.

Kiểm thử API ảnh hưởng đạt cho CSD,CSC / CSC,CTL, part+multi cùng dòng, mã sai/trùng; hai kiểm thử UI/client đạt, checkbox giữ đồng thời và bỏ riêng từng loại. Browser đo ba mã có cùng mép trái và đủ ba nhãn, checkbox CSD/CSC cùng chọn, bảng laptop không tràn ngang. Lint, Worker check và build đạt. Triển khai version ac704f28-756b-4508-9432-8e0c983b8fcb, index-DH4Gpg8L.js, index-DmPYovNJ.css. Production 200 đúng bundle.
