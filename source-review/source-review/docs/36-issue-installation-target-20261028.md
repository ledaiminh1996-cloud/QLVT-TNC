# Phương tiện lắp thiết bị phiếu xuất — 28/10/2026

## Nguyên nhân xác nhận

Phiếu 10.26.00001/PX có 12 dòng vị trí Rơ moóc – Trục 1/2/3, nhưng cả 12 target_id đã lưu là xe 50H-110.99. Luồng cũ tự gán dòng thiếu thiết bị về xe đầu phiếu. Sổ đọc đúng snapshot bị lưu nhầm, không thể sửa bằng việc đổi nhãn hiển thị hay dùng ghép nối hiện tại. Chẩn đoán chỉ chạy SELECT (rows_written=0).

## Luồng mới

Theo lựa chọn người dùng, thêm một ô Phương tiện lắp thiết bị trên đầu phiếu, không thêm cột chọn thiết bị từng dòng. Dropdown gồm xe/rơ moóc/máy phát/container có thông tin trên bộ phiếu. Tất cả vật tư áp dụng cùng phương tiện lắp. Worker tra ID danh mục, kiểm tra loại/hoạt động và ghép nối, ghi lại target_type/id chuẩn cho mọi dòng và lần sử dụng. Chặn nhiều thiết bị mà không có lựa chọn/target; dữ liệu legacy chỉ có một xe giữ tương thích. Nhóm vị trí lắp kiểm tra phù hợp thiết bị.

ODO đầu kéo và ODO/giờ lắp phụ tách riêng. Rơ moóc thiếu ODO thì trống; máy phát dùng giờ, không nhận ODO xe. UI đổi bộ xe hoặc mã thiết bị đang chọn sẽ xóa lựa chọn và đồng hồ cũ. Giữ ID gốc theo luồng inventoryPosting và labels sẵn có, không migration. Sổ kho/NXT và nguồn thu hồi đọc ID/snapshot đúng, không đọc bộ ghép hiện tại gán cho lịch sử. In/Excel thêm trường phương tiện lắp và số đo.

## Phiếu cũ

Trạng thái hiện hành: đã chỉnh thiết bị của phiếu 10.26.00001/PX sau khi người dùng xác nhận cả 12 vỏ thực tế lắp rơ moóc 51R-047.31. Chỉ sửa metadata thiết bị và đồng hồ gán nhầm, không ghi lại số lượng/tiền/tồn. Kết quả bảo trì có audit và đối chiếu bên dưới.


## Nghiệm thu và triển khai

173 UI/shared và 150 Worker/D1 tests đạt; lint/check/build đạt. Các ca mới ghi sổ rơ moóc/máy phát thực qua API và SQLite, kiểm tra target_id/target_type, ODO/giờ, stock_usages, Serial, sổ kho và nguồn thu hồi. Thử đổi ghép sau xuất không đổi nhãn lịch sử. Chặn thiếu lựa chọn đa thiết bị, thiết bị không ghép và vị trí Rơ moóc khi chọn Xe; các trường hợp lỗi không đổi tồn/nguồn. UI kiểm tra đổi thiết bị xóa số đo cũ, dùng số chuẩn khi gửi, bắt buộc chọn thiết bị; in/Excel có mã/loại. Browser 1366/390 kiểm tra select, số đo tách ODO xe, gửi giờ 12,25 thành 12.25 và không tràn trang. Tệp mẫu/ảnh artifacts/issue-installation-* chỉ cục bộ.

Phiếu cũ được kiểm tra SELECT thêm: snapshot đầu phiếu có rơ moóc 51R-047.31, máy phát MP126; 12 stock_usages, tổng lượng còn mở 12.000 milli, không có dòng draft tham chiếu usage_id. Chưa sửa các snapshot/nguồn cũ vì cần xác nhận thiết bị thực tế. Cloudflare có một truy vấn trả 7403 tạm thời; xác minh đúng tài khoản/Worker, thử lại thành công, không thay thông tin đăng nhập hay quyền.

Triển khai version 5df33c53-8a35-46fe-a08e-dc2be18cb9df; index-DFHRzOMV.js, LedgerPeriod-X368_9C4.js, DocumentPrint-BfxLWv1h.js. Production root/bundles 200 đúng bản dựng và có trường mới; API chưa đăng nhập 401. Không migration hoặc ghi lại dữ liệu lịch sử.


## Điều chỉnh phiếu cũ sau xác nhận

Người dùng xác nhận: “đúng lắp cho rmooc 047.31”. Sao lưu trước thao tác tại artifacts/before-issue-target-correction-20261028.sql (bản sao chứa dữ liệu riêng, không công khai). Script bảo trì cố định scripts/maintenance/correct-issue-20261028.mjs được thử trên bản sao: sửa đúng, tái chạy bị chặn, nguồn có thu hồi bị chặn, cố tình đổi một bảng tài chính khiến toàn bộ giao dịch rollback. Gói rút còn 29 lệnh để phù hợp D1, áp dụng bằng một batch nguyên tử; không chỉnh schema hay tắt trigger.

Khóa mutation hiện có dùng chế độ metadata/receive. Vì chế độ đó không tự kiểm tra kỳ/phụ thuộc như sửa phiếu nhập, gói bảo trì kiểm tra rõ kỳ khóa, đúng phiên bản/header/labels/12 dòng, nguồn còn nguyên, không có tham chiếu thu hồi/điều chuyển, quyền admin, và 20 ảnh chụp số liệu/định nghĩa trigger trước lẫn sau. Khóa chỉ tồn tại trong giao dịch và được xóa trước commit. Không cung cấp luồng API sửa phiếu xuất tùy ý.

Đã chuyển 12 draft lines, 12 inventory line snapshots và 12 stock_usages từ xe 50H-110.99 sang rơ moóc 51R-047.31. Giữ nguyên tất cả ID, Serial, vị trí lắp, lượng, giá và tiền. Tăng phiên bản phiếu 1→2 và các nguồn +1. ODO 1046457 trên dòng/nguồn là giá trị tự sao chép từ đầu kéo nên xóa ở rơ moóc; đầu phiếu vẫn giữ ODO đầu kéo 1046457. Chưa có căn cứ ODO rơ moóc lúc lắp nên để trống, không dùng ODO hiện tại thay lịch sử.

Đối chiếu trực tiếp sau commit: 12/12 dòng, 12/12 snapshots và 12/12 nguồn đúng target; document audit=1, global audit=1, khóa còn lại=0. 20 nhóm kiểm chứng không đổi, gồm inventory_documents, các bảng tồn/lô/movements/chi phí/Serial/số dư tháng và định nghĩa trigger. Gọi đúng handler Sổ theo dõi kho trên D1 thật: 1 nhóm xuất 12.000 milli, phương tiện 51R-047.31 · Rơ moóc, số đo trống; nguồn giữ nguyên ID để thu hồi. Không cần phát hành lại ứng dụng vì chỉ sửa dữ liệu đã được xác nhận.

Operation ID: ed262aab-5c76-45b5-bda2-ea21e06f0e21. Hoàn tất UTC: 2026-10-28T08:06:48.398Z. Báo cáo đối chiếu cục bộ: artifacts/issue-target-correction-result.json.
