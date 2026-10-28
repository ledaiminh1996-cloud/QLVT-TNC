# Triển khai chứng từ nháp lên cloud ngày 25/10/2026

- URL: https://qlvt.tannamchinh.workers.dev
- Worker: qlvt. Version hoạt động 100%: 5ecdaa1d-0f2f-4d2c-b9fb-7bc7b795dfed.
- Thời điểm deployment: 25/10/2026 09:20:20 giờ Việt Nam.
- Phiên bản trước: ba6f0d42-c5bc-4d01-9e48-718dad9a42c2.
- D1: tnc-vattu. Hai migration 0020_document_drafts.sql và 0021_document_validation.sql đã áp dụng thành công. Không còn migration chờ.

## Sao lưu và xác minh dữ liệu
Backup SQL riêng tại backups/tnc-vattu-before-documents-20261025.sql, không đưa vào Git hoặc gói source. SHA-256: 493ad8486a4b2117b32c29674547da6eca126513e1d090b7bf496d869820689a.
Khôi phục thử trong SQLite, áp dụng cả hai migration, integrity_check=ok và không lỗi foreign_key_check. Đối chiếu database cloud sau migration: 561 vật tư, 432 NCC, 10 kho, 4 bồn, 88 nhân sự, 269 phương tiện, 262 thiết bị; số lượng giữ nguyên. inventory_documents=0, stock_movements=0, document_drafts=0. Không tạo phiếu thử hoặc tài khoản mẫu trên cloud.

## Kiểm chứng
69 kiểm thử frontend, 60 kiểm thử API, kiểm tra TypeScript frontend/Worker và build đều đạt trước deploy. Wrangler xác nhận Worker mới hoạt động 100%. Truy cập web, /api/health và /api/document-drafts chưa đăng nhập đều trả 302 đến Cloudflare Access, không bỏ qua xác thực. Không kiểm thử lưu phiếu qua phiên Access thật bằng công cụ trong lượt triển khai; thao tác này đã được kiểm thử bằng API/Miniflare và trình duyệt cục bộ.

## Phạm vi
Bật lưu nháp và quy trình duyệt đề xuất đã cấu hình. Chưa bật ghi sổ, tồn kho, NXT, gửi/nhận đắp hoặc sinh chứng từ thực hiện tự động. document_warehouse_access và document_workflows khởi tạo rỗng; không tự cấp quyền kho hoặc tự chọn người duyệt. Quản trị cần cấu hình quy trình phù hợp trước khi gửi đề xuất duyệt. Các tồn tại trong lần rà soát kiến trúc trước vẫn chưa được coi là đã hoàn tất.

## Cập nhật nhiều serial trên phiếu nhập
Version cuối: efd773e8-ff53-4291-a110-d1578e5d4fd9. Migration 0022_document_serials.sql đã áp dụng cloud. Backup riêng: backups/tnc-vattu-before-multi-serial-20261025.sql; SHA-256 7b95714920d0db856e6284821ad0b60b78c1e6e4bb75ebea761305c3e43cc564. Khôi phục thử và migration trên bản sao đều đạt integrity_check/foreign_key_check; đối chiếu cloud sau migrate: 561 vật tư, 0 nháp/dòng/serial nháp, 0 stock_movements và 0 inventory_serials; không tạo dữ liệu thử trên cloud.
Kiểm thử: toàn bộ frontend đạt, 63 kiểm thử API đạt (gồm Miniflare với 1 dòng nhiều serial), TypeScript/build đạt. Chrome cục bộ xác minh tự mở/focus, sinh dải 0001–0005, huy hiệu 5/5, lưu/mở lại và không cuộn ngang ở viewport 1440px. Giao diện nhiều serial áp dụng PN; draft DTO/persistence hỗ trợ serials[] và giữ tương thích serial đơn ở các form cũ. Lưu nháp không cập nhật tồn/sổ serial. inventory_serials mới là cấu trúc nền, chưa có posting engine.

## Bật Lưu nhập kho ngay
Version hoạt động: a626dec6-85ef-4868-96d3-8ba6af557a28. Đã áp dụng 0023_receipt_posting.sql. Backup trước thay đổi: backups/tnc-vattu-before-receipt-posting-20261025.sql, SHA-256 f58c976fabb7a93478f41d6425c316e32e6d92b7ec4cb4f8aeb2ee2e6fd006fa. Bản sao restore/migrate vượt integrity_check/foreign_key_check, giữ toàn bộ dữ liệu cũ. Sau triển khai cloud còn 561 vật tư, không có phiếu/movement/serial/tồn mẫu, không có lỗi khóa ngoại hoặc migration chờ.
Luồng PN trên giao diện: Lưu -> gửi commit:true -> nhập kho posted nguyên tử. Đủ serial, đơn giá, quyền kho và khóa kỳ là bắt buộc. Thẻ VT-TB và ô vật tư hiển thị tồn theo sổ. Nháp cũ không tự cộng tồn; phiếu posted không sửa/hủy trực tiếp. VAT lưu tách khỏi giá trị trước thuế của tồn; chưa vốn hóa VAT. Không bật xuất, thu hồi, thanh lý, điều chuyển hoặc sổ NXT trong bước này.
Kiểm thử toàn frontend và 71 API (gồm D1 runtime) đạt; TypeScript/build đạt. Chrome cục bộ xác minh Lưu chặn thiếu serial, lưu đủ thì tồn 0 -> 3, trạng thái Đã nhập kho và mở lại chỉ xem. Đã kiểm thử idempotency, tranh chấp serial, khóa kỳ xen giữa request và batch, lỗi audit hoàn tác đủ phiếu/số/tồn/serial. Không tạo phiếu thử trên cloud.


## Lưu ghi sổ và sửa/xóa PN chưa sử dụng

- Migration: 0024_inventory_operations.sql; sao lưu trước nâng cấp tại backups/tnc-vattu-before-inventory-operations-20261025.sql. Bản sao SQLite qua integrity_check và foreign_key_check; báo cáo/hash tại backups/inventory-operations-preflight-20261025.json.
- Trước/sau: 561 vật tư, 432 NCC, 0 chứng từ, 0 stock movements. Không seed hoặc tự ghi sổ dữ liệu cũ.
- Cloud: migration áp dụng thành công; foreign_key_check không có lỗi; receipt_mutation_locks rỗng sau nâng cấp.
- Worker ban đầu: 8fb71bba-7590-49cb-97c0-a80e05b92b44. Bản cập nhật giao diện nhập nhiều serial sẽ ghi version cuối bên dưới.
- Kiểm tra cục bộ: 81 API (bao gồm Miniflare/D1 thực thi sửa PN, xuất serial, chặn xóa PN đã xuất), 76 frontend; lint/check/build đạt. Không có phiên Access của người dùng để chạy phiếu trên production.

- Version phát hành cuối: **425854cb-bd72-4e0b-9406-66313ba0072e**. Frontend 76/76 và API 81/81 đạt sau thay đổi cuối. Cổng production trả 302 về Cloudflare Access; không bỏ xác thực.


## Giá chính xác và kiểm tra 50 serial

- Version cloud: **e8f163a6-07d3-4d91-9d06-94526b79b30f**. Migration 0025_receipt_exact_pricing.sql áp dụng thành công.
- Sao lưu: backups/tnc-vattu-before-exact-pricing-20261025.sql. Báo cáo/hash: backups/exact-pricing-preflight-20261025.json. SQLite integrity/foreign keys đạt; lượng, tiền và balances không đổi qua migration.
- Trước/sau nâng cấp: 1 phiếu, 1 dòng inventory, 50 inventory_serials và 50 document_draft_serials. Tồn trước phiếu cũ được tái dựng là 0; không đổi đơn giá/tiền đã ghi và không thêm phiếu thử cloud.
- Kiểm tra: frontend TypeScript, Worker TypeScript, production build; 83 API và 79 frontend đạt. Chrome cục bộ xác nhận 50/50 xanh, serial textarea 16 dòng và tổng 200.000.000 sau VAT. Remote foreign_key_check rỗng. Chưa thao tác trong phiên đăng nhập production của người dùng.


## Ngăn kéo serial

- Version triển khai: **ca218081-2642-42f4-964f-56680ae25737**.
- Chuyển editor serial PN sang ngăn kéo 540px; bảng mỗi serial một bản ghi UI, tìm kiếm lọc thật, trạng thái, xóa từng dòng, xác nhận/xóa hết/hoàn tác. Xong áp dụng vào phiếu; Hủy giữ danh sách ban đầu.
- Không migration hoặc chỉnh dữ liệu cloud; schema và quy tắc ghi kho giữ nguyên.
- Lint, build, 82 frontend tests đạt. Chrome kiểm tra 50 serial, bố cục phiếu không đổi, lọc/xóa/hủy đúng, 375px không tràn ngang, không page errors. Các thử nghiệm đều trong preview bộ nhớ cục bộ.


## Triển khai danh sách phiếu nhập – 26/10/2026, đợt 1

- Đã triển khai Xem/In, menu thứ cấp, Excel từng phiếu và bộ lọc tháng/Kho/NCC/serial.
- Worker version: `4e90b2d2-2a11-4203-ae34-9eefdb116126`.
- 87 kiểm tra frontend, 84 kiểm tra Worker đạt; lint, Worker check, build và Chrome preview đạt. Không migration và không tạo phiếu thử trên production.
- Hoàn tất đợt này trước khi triển khai yêu cầu tiếp theo về cột, tổng trang và xuất danh sách.


## Triển khai cột và tổng danh sách phiếu nhập – 26/10/2026, đợt 2

- Worker version: `d0e73541-b154-4a10-8d9d-2e992805e006`.
- NCC mã/tên hai tầng, Tổng SL, tổng Dòng/SL/Sau VAT theo trang, cột tùy chọn hóa đơn/người lập/nội dung; bỏ cột Trạng thái. Tiêu đề theo cuộn trang, không thêm cuộn dọc bảng; rê chuột tô nhẹ.
- Xuất Excel toàn bộ các trang theo bộ lọc, kiểm tra số lượng/trùng bản ghi, giữ số hóa đơn dạng text. Tải Excel từng phiếu vẫn trong menu ba chấm.
- Đạt 90 frontend tests (36 chứng từ), 84 Worker tests, frontend lint, Worker check và Vite build. Cảnh báo Vite __dirname và chunk lớn là cảnh báo cũ, build thành công.
- Chrome preview kiểm tra Xem/In/menu/nhân bản/lọc serial/Excel, cột bổ sung và tiêu đề cố định với 25 phiếu mẫu; không lỗi trình duyệt. Các phiếu thử chỉ trong bộ nhớ phiên preview, không tạo dữ liệu production.
- Sau triển khai, URL production trả 302 đến Cloudflare Access đúng cấu hình. Chưa kiểm tra tương tác production qua phiên đăng nhập của người dùng.
- Không migration, không thay đổi dữ liệu tồn hay serial production.


### Chỉnh cột phiếu nhập tiếp theo – 26/10/2026

Đổi Sau VAT (đ) thành Thành tiền sau VAT; bỏ cột Dòng và tổng số dòng. Người tạo và Ngày tạo (dd/mm/yyyy, lấy created_at) luôn hiện ở cuối bảng, trước Thao tác. Người tạo không còn nằm trong nhóm cột bật thêm; nhóm này giữ Số hóa đơn và Mục đích/nội dung. Excel danh sách đồng bộ thứ tự và nhãn. Lint, 36 kiểm tra chứng từ và build đạt. Đã triển khai version `430d9216-a990-4054-9d15-f2622594a5de`. Không thay đổi dữ liệu hay schema.


### Kho, đơn giá và VAT trên danh sách phiếu nhập – 26/10/2026

Kho chỉ hiển thị mã, tooltip giữ mã và tên đầy đủ. Đơn giá trước VAT và VAT % luôn hiện giữa Tổng SL và Thành tiền sau VAT; phiếu nhiều mức hiện Nhiều mức, tooltip liệt kê từng mức, không lấy trung bình hay lấy ngầm dòng đầu. API lấy dữ liệu dòng trong truy vấn danh sách, không gọi từng phiếu; summary trả unit_prices/vat_rates. Excel danh sách cũng có hai cột này. Cân lại cột Kho nhỏ, dành chỗ cho NCC và số tiền. 37 kiểm tra chứng từ, 84 Worker tests, lint/check/build và Chrome preview đạt. Đã deploy `8cac89b9-ee17-4229-a283-31bb7bae75ce`; không đổi schema hoặc dữ liệu tồn.


### Hiển thị cố định toàn bộ cột phiếu nhập – 26/10/2026

Số hóa đơn và Mục đích/nội dung luôn hiện. Bỏ checkbox Hiện thêm và trạng thái bật/tắt cột. Bảng gồm 13 cột, thu gọn khoảng đệm ngang còn 8px, tiêu đề cho xuống dòng; độ rộng tối thiểu 1240px, cuộn ngang khi màn hình hẹp, NCC/nội dung hai tầng và tooltip giữ thông tin đầy đủ. Tổng trang vẫn căn đúng Tổng SL và Thành tiền sau VAT. Lint, 37 kiểm tra chứng từ, build và Chrome preview đạt. Deploy `cd8d9fe6-003e-40df-891b-fef6b4c90030`.


### Nhóm cột phiếu nhập chốt lại – 26/10/2026

Mặc định 10 cột: Số phiếu, Ngày CT, Kho (mã + tooltip đầy đủ), NCC, Số hóa đơn, Mục đích/nội dung, Tổng SL, Thành tiền sau VAT (đ), Trạng thái, Thao tác. Checkbox Hiện thêm mặc định tắt mở đồng thời 6 cột: Tiền hàng (trước VAT), Tiền VAT, Người tạo, Ngày giờ tạo, Số serial, Người sửa cuối. Hai cột tiền dùng tổng net/vat của phiếu, thay cho đơn giá/tỷ lệ VAT; chân bảng cộng thêm net/vat khi hiện. Ngày giờ tạo hiển thị dd/mm/yyyy HH:mm theo Asia/Ho_Chi_Minh. Serial hiện xem trước và tooltip toàn bộ từ document_draft_serials. Người sửa cuối lấy sự kiện save có before_json (không lấy người tạo hay người hủy), chưa sửa hiện —. API dùng truy vấn theo chỉ mục trong danh sách, không gọi từng phiếu; không migration. Excel danh sách đồng bộ nội dung. Đạt 38 kiểm tra chứng từ, 84 Worker tests, lint/check/build và Chrome preview. Đã triển khai version `ded4e8ef-3125-4961-ba2f-a06439a6b09f`.


### Chiều cao NCC và tiêu đề bảng – 26/10/2026

Tên NCC giới hạn hai dòng bằng line-clamp-2, dấu ba chấm và tooltip tên đầy đủ; mã NCC vẫn dòng nhỏ phía trên. Tiêu đề nowrap: Ngày CT, Tổng SL, Sau VAT (đ); tăng độ rộng NCC và các tiêu đề dài trong nhóm mở rộng. Nhóm cột mặc định/tùy chọn giữ nguyên. 38 kiểm tra chứng từ, lint/build và Chrome với tên NCC dài đạt. Đã deploy `bdb3bb77-9f6b-497a-af30-96c813099997`.


### Tổng theo bộ lọc, ĐVT và khung cuộn phiếu nhập – 26/10/2026

API trả receipt_totals cho toàn bộ điều kiện tìm/lọc và phạm vi quyền, độc lập LIMIT trang; cộng số nguyên tiền/số lượng ở D1 và truyền chuỗi số nguyên. Số lượng chỉ có nghĩa khi tất cả dòng cùng ĐVT (chuẩn hóa Unicode/hoa thường/khoảng trắng từ snapshot nhãn unit của dòng); phiếu nhiều ĐVT hiện Nhiều ĐVT, thiếu ĐVT hiện —; tổng SL chân bảng/trang/toàn bộ lọc chỉ hiện khi cùng ĐVT. Excel đồng bộ quy tắc, bỏ chú thích cộng lẫn ĐVT. Hiện riêng Trang này và Theo bộ lọc với số phiếu, SL cùng ĐVT, Sau VAT. Không tải hết các trang để tính tổng.

Bộ lọc một hàng trên desktop; menu Khoảng thời gian cạnh Từ ngày giữ Hôm nay/7 ngày/Tháng này/Tháng trước. Tháng hiện tại mặc định không được tính là bộ lọc thêm, Xóa lọc chỉ hiện khi khác mặc định và khôi phục tháng hiện tại. Ẩn tiêu đề thẻ phiếu nhập trùng breadcrumb (vẫn có heading sr-only) và banner danh mục xanh ở màn phiếu nhập. Bảng overflow-auto có chiều cao giới hạn theo màn hình và thead sticky, giữ bộ lọc/toolbar phía trên. Các chứng từ khác giữ giao diện riêng.

Đạt 93 frontend tests (39 chứng từ), 85 Worker tests, lint/check/build và Chrome: bộ lọc một hàng, mặc định không đếm, reset tháng, tiêu đề sticky trong khung; thử 26 phiếu qua hai trang và nhiều ĐVT chỉ trên database test. Không migration, không tạo phiếu thử production. Đã deploy `ed872e1e-abeb-4dbe-9549-33929a7a637a`.


### Hoàn thiện bố cục phiếu nhập – 26/10/2026

Tổng toàn bộ bộ lọc chuyển thành ba thẻ số liệu trên bảng (số phiếu, SL cùng ĐVT, sau VAT). Bỏ dòng Trang này/Theo bộ lọc và tổng số phiếu ở thanh dưới; giữ tổng trang trong tfoot. Menu Cột hiển thị chọn độc lập 6 cột bổ sung, mặc định ẩn; giữ lựa chọn qua thay đổi trang, bộ lọc và số dòng trong phiên màn hình. Ngày giờ tạo dd/mm/yyyy HH:mm Asia/Ho_Chi_Minh. Kỳ là ô chọn riêng trước Từ ngày, gồm Hôm nay/7 ngày/Tháng này/Tháng trước/Tùy chọn; chọn Tùy chọn giữ ngày để sửa, không tự tải toàn thời gian.

Desktop màn phiếu nhập dùng flex theo chiều cao viewport: bảng giãn trong phần còn lại và chỉ vùng bảng cuộn, thanh phân trang sát đáy. Mặc định 20 dòng, chọn 20/50/100 qua page_size máy chủ, đổi số dòng về trang 1. Các loại chứng từ khác giữ mặc định cũ. Ẩn nút Nhập Kho xanh trên Header riêng màn phiếu nhập máy chủ, giữ Lập phiếu; luồng giao diện cũ và trang khác không bị ẩn. Hóa đơn/nội dung có tooltip đầy đủ.

Đạt 94 frontend tests (40 chứng từ), 85 Worker tests, lint/check/build và Chrome desktop/mobile: menu từng cột độc lập, ngày giờ, giữ cột qua đổi 50/100, bảng cao 640px ở viewport 1440x1000, phân trang sát đáy, không lỗi trình duyệt. Đã deploy `932cd6c0-97f9-44b6-8a6b-f14c7b3b6fbb`. Không đổi schema hoặc ghi phiếu thử production.


### Năm thẻ tổng trên hàng thao tác và tránh tính lại khi phân trang – 26/10/2026

Đưa Số phiếu, Tổng SL, Tiền hàng, Tiền VAT, Tổng sau VAT lên cùng hàng bên trái các nút Xuất Excel/Làm mới/Lập phiếu. Thẻ cao 72px, số lớn/nhãn mờ, cùng ĐVT mới hiện SL+ĐVT; nhiều ĐVT hiện Nhiều ĐVT. Trong Số phiếu có nút lọc Đã nhập kho và Đã hủy (hủy chỉ hiện khi có hoặc đang chọn), bấm lần nữa bỏ lọc. Không còn tổng bộ lọc ở dưới bảng; tổng trang trong tfoot giữ nguyên.

API danh sách vẫn trả danh sách và receipt_totals trong cùng một phản hồi. Thêm include_totals=0 để bỏ tổng tiền/tổng lượng/count theo trạng thái khi chỉ phân trang hoặc xuất; vẫn COUNT metadata cho phân trang. Tiền cộng trên document_drafts, lượng chỉ join document_drafts với document_draft_lines, không join bảng serial để cộng tổng. Cache tổng chỉ trong bộ nhớ phiên màn hình, khóa theo bộ lọc + người dùng/quyền + phiên bản làm mới, không localStorage, không dùng làm dữ liệu dự phòng khi đổi phạm vi. Đổi trang/số dòng dùng lại tổng; đổi bộ lọc, lưu/hủy, làm mới hoặc đổi API client sẽ lấy lại tổng cùng danh sách. Tìm kiếm chờ 400ms; không tải trang 1 theo từ khóa cũ khi bắt đầu gõ từ trang 2.

Đạt 95 frontend tests (41 chứng từ), 86 Worker tests, lint/check/build. Test SQL xác nhận include_totals=0 chỉ có danh sách + COUNT metadata, không chạy sum tiền/lượng; truy vấn lượng không chứa bảng serial. Chrome kiểm tra 5 thẻ cùng hàng, từng thẻ 72px, nút nằm bên phải, số phiếu không bị ẩn, nhãn trạng thái lọc được và tìm kiếm chờ đủ thời gian. Không migration hoặc phiếu thử production. Đã deploy `8104a327-13f0-40b0-a422-fd16e8ca9dce`.


### Chi phí nhập kho A/B/C và ghi chú dòng – 26/10/2026

Phiếu nhập đổi Dòng vật tư thành A. Chi phí vật tư; Ghi chú nằm trong từng dòng, lưu trong line_json, có tooltip, theo bản in và Excel. Bỏ ô ghi chú chung ở phiếu mới; ghi chú chung cũ vẫn giữ nguyên dữ liệu và hiển thị đọc, không tự chuyển/xóa.

B. Chi phí liên quan gồm transport (vận chuyển), unloading (bốc dỡ), installation (nhân công thay thế lắp đặt), other (khác), vat (thuế GTGT số tiền); optional related_costs trong header_json, tiền nguyên đồng không âm, nhập vi-VN, kiểm tra cả client và Worker. C. Tổng giá trị nhập kho (A+B) là tiền hàng trước VAT + chi phí B trước VAT. Tổng thuế là VAT vật tư + VAT chi phí; thanh toán = giá trị nhập kho + tổng thuế.

Chi phí B trước thuế phân bổ theo tiền hàng trước thuế từng dòng, dùng BigInt và phần dư lớn nhất, hòa thì thứ tự dòng; nếu tổng tiền hàng bằng 0 thì chia đều. Stock movements/balances/buckets/lots và inventory_document_lines.amount_vnd ghi giá trị gồm chi phí, không gồm VAT. Unit price exact numerator/denominator trên dòng sổ kho phản ánh giá vốn sau phân bổ; receipt_line_details giữ nguyên giá/tiền hóa đơn vật tư. Phần chi phí mỗi dòng có thể đối chiếu bằng amount_vnd - receipt_line_details.net_vnd, chi phí gốc và căn cứ phân bổ được giữ trong header_json/audit. Không đổi schema/migration, không viết lại phiếu cũ. Sửa/hủy chưa phát sinh hoàn đủ giá trị phân bổ; đã xuất vẫn chặn.

Đạt 98 frontend tests (44 chứng từ), 89 Worker tests, lint/check/build. Test kiểm tra phân bổ đến đồng, chi phí vào giá xuất, tách VAT khỏi tồn, sửa/hủy hoàn tồn, chặn sửa sau xuất, từ chối số âm/lẻ/sai định dạng. Chrome nhập B=1.550.000, A=300.000 -> C=1.850.000; VAT=148.000; thanh toán=1.998.000; lưu và mở lại ghi chú/chi phí đúng, chế độ xem không sửa. Bản in/Excel A/B/C đồng bộ. Không tạo dữ liệu thử production. Đã deploy `14ff7af8-6e24-4c8f-8462-9cb87205cb02`.


### Gọn thẻ và sắp xếp phiếu nhập – 26/10/2026

Bỏ tfoot tổng trang trên bảng phiếu nhập; chỉ giữ thẻ tổng toàn bộ bộ lọc. Bộ lọc trạng thái rút nhãn Tất cả. Thẻ Tổng sau VAT (đ) không có hậu tố đ trong giá trị, dùng nền/viền xanh và số lớn/đậm nhất. Mỗi thẻ có cùng ba hàng nhãn/số/chip (hàng chip trống khi không có), nên số thẳng hàng dù thẻ Số phiếu có Đã nhập kho/Đã hủy. Cột hiển thị nằm chung hàng các nút Xuất Excel/Làm mới/Lập phiếu; bỏ hàng riêng trên bảng.

Ba cột Số phiếu, Ngày CT và Sau VAT có nút/mũi tên tăng giảm và aria-sort. Sắp xếp máy chủ trước LIMIT, whitelist sort=code|business_at|gross, direction=asc|desc, ổn định theo id; số tiền chưa xác định luôn ở cuối. Đổi sắp xếp về trang 1, không làm mất bộ lọc/số dòng/cột chọn và không tính lại tổng. Excel danh sách đi theo thứ tự đang chọn.

Đạt 99 frontend tests (45 chứng từ), 90 Worker tests, lint/check/build và Chrome: không tfoot, giá trị thẻ cùng y, Tổng VAT nổi bật, menu cùng hàng và mũi tên đổi đúng hướng. API test xác nhận thứ tự áp dụng trên toàn bộ tập trước phân trang, NULL cuối và từ chối tham số lạ. Không migration hoặc dữ liệu thử production. Đã deploy `b49ae6bf-9013-4b51-8445-473503b9ecdf`.


### 26/10/2026 — Chi phí từng khoản và danh mục VAT
Phiếu nhập dùng bảng chi phí động: vận chuyển, bốc dỡ, bảo hiểm, thuế nhập khẩu, khác (bắt buộc tên cụ thể); thêm/xóa từng khoản, số tiền trước VAT và thuế suất riêng. Tổng GTGT gồm VAT hàng và VAT từng khoản, làm tròn đồng từng khoản. Chi phí trước VAT được phân bổ vào giá nhập; VAT tách riêng. Dữ liệu chi phí cố định cũ được giữ nguyên, không suy đoán thuế suất. Chế độ xem đơn giá dùng định dạng vi-VN, giữ độ chính xác gốc.
Danh mục VAT có 0/5/8/10, kiểm tra phía máy chủ; giữ thuế suất đã lưu khi sửa phiếu cũ. Migration 0026_vat_catalog.sql đã áp dụng sau backup imports/before-vat-catalog-20261026.sql. Không tạo phiếu thử trên production.
Kiểm tra: 100 frontend tests, 92 Worker tests, lint, Worker check, build và Chrome nhập/lưu/xem hai khoản VAT 8/10 đều đạt. Deploy Cloudflare version 2d353676-4eea-4748-8773-d3cd995030be.


### 26/10/2026 — Bộ lọc phiếu nhập gọn 4 ô
Tìm kiếm / khoảng thời gian / trạng thái / Bộ lọc khác. Khoảng thời gian gộp kỳ và ngày, có Hôm nay, 7 ngày, Tháng này, Tháng trước, Tùy chọn, hai lịch và nút Áp dụng; không gọi danh sách khi mới sửa ngày trong popup. Bộ lọc khác chứa Kho, NCC và Người tạo; chip từng lựa chọn cho phép bỏ riêng. Mặc định tháng hiện tại không tính là bộ lọc bổ sung.
Lọc created_by tại Worker cùng điều kiện của danh sách/tổng/Excel, đưa vào khóa cache tổng. Danh sách người tạo chỉ lấy tên và id; tài khoản kho chỉ thấy chính mình, các vai trò khác lấy người từng lập phiếu nhập. Giữ kiểm tra phạm vi dữ liệu hiện có. Không migration hoặc ghi dữ liệu thử production.
Đạt 46 kiểm tra chứng từ, 92 kiểm tra Worker, lint/check/build, Chrome chọn lịch/Kho/Người tạo và xóa chip; xử lý popup danh mục render qua portal để không đóng nhầm. Deploy 878f0f89-2137-40e7-91c2-76de56f65f10.


### 26/10/2026 — Sửa bộ lọc tải VAT
useVatRates gửi status=1 (client chuyển thành is_active=1), thay active gây lỗi 400. Thêm kiểm tra hook qua catalog client thật, mock trả 400 với giá trị không hợp lệ để bắt hồi quy; xác nhận đủ 0/5/8/10 và ô chọn khả dụng. 47 tests chứng từ, lint/build đạt. Không migration/dữ liệu thay đổi. Deploy f287ef81-a2fe-4a0a-aa26-87d07f292bbe.


### 26/10/2026 — Số hóa đơn 8 chữ số
Phiếu nhập chỉ nhận 1–8 chữ số (cho phép bỏ trống), tự padStart 8 khi blur và parseDraft ở cả client/Worker. Lưu chuỗi giữ số 0 đầu, không chuyển Number. Danh sách/xem/Excel dùng cùng định dạng cho số cũ hợp lệ; không tự sửa dữ liệu cũ trong database. Chặn ký tự, dấu thập phân, số âm và hơn 8 số. 48 kiểm tra chứng từ, 92 Worker tests, lint/check/build và Chrome 567 → 00000567 đều đạt. Deploy 44e43c64-0356-43d4-a18f-eb92969cf8ff.


### 26/10/2026 — Ngày hóa đơn
Đổi nhãn thành Số hóa đơn, thêm Ngày hóa đơn kế bên theo dd/mm/yyyy. invoice_date ISO ngày lưu trong header_json, không migration, không bắt buộc để tương thích phiếu cũ. Kiểm tra ngày thực ở shared parseDraft (client/Worker). Xem, in, lịch sử và Excel phiếu giữ ngày; nhân bản xóa cả số và ngày hóa đơn. 49 tests chứng từ, 92 Worker tests, lint/check/build, Chrome kiểm tra hai ô cùng hàng đạt. Deploy 84394b5c-5321-4fe7-b13b-9f863730a0d4.


### 26/10/2026 — Mẫu in phiếu nhập theo biểu mẫu công ty
ReceiptPrint riêng, A4 ngang: tên công ty/MST 0303955513; số/ngày phiếu; NCC/MST/địa chỉ; kho; số/ngày hóa đơn; nội dung. Bảng 11 cột STT, mã, tên, ĐVT, chất lượng, SL, đơn giá, tiền trước GTGT, thuế GTGT, serial, ghi chú. Chi phí theo khoản/VAT, tổng giá trị nhập kho trước VAT (1+2), tổng thuế, tổng thanh toán, bốn ô ký (Người lập, Người giao, Thủ kho, Kế toán).
Nhiều hơn 3 serial/dòng in phụ lục đủ từng serial, dẫn chiếu dòng phiếu; giữ header bảng khi sang trang, không ngắt hàng/khu ký. Không cộng số lượng khác ĐVT. Dữ liệu dùng tiền đã lưu và phép tính chính xác shared; không ghi sổ hay sửa dữ liệu khi in. Phiếu hủy/nháp có nhãn rõ, phiếu posted không nhãn nháp.
Worker lưu snapshot MST/địa chỉ/tỉnh NCC trong labels từ lần lưu tiếp theo. Với phiếu cũ thiếu snapshot, đọc metadata hiện tại để in (không ghi lại DB); snapshot đã có không bị thay theo danh mục. Không migration.
Kiểm tra: 50 tests chứng từ, 92 Worker tests, lint/check/build. Chrome in PDF thử 50 serial đủ 50 (2 trang, phụ lục trang 2), 28 dòng hàng sang 3 trang không tràn ngang; kiểm tra giữ metadata khi NCC đổi địa chỉ. Deploy 156b192a-2aff-4b57-9783-f4d7ae68727c.


### 26/10/2026 — Mỗi serial một dòng ngay trong bảng in
Thay phụ lục serial bằng tách dòng chỉ trên bản in: 30 serial/SL 30 thành 30 dòng cùng vật tư, mỗi dòng SL 1, STT liên tục. Không đổi dòng dữ liệu lưu/stock. Phân bổ tiền net và VAT nguyên đồng bằng thương/chia dư từ tổng dòng gốc, không nhân lại giá đã làm tròn; tổng tiền không đổi. Phiếu nháp thiếu serial giữ lượng gốc và cảnh báo, không giả lập serial hoặc số lượng.
Số phiếu/ngày ở đầu bảng lặp lại; footer số phiếu/ngày và Trang x/y trên mọi trang, kể cả trang tổng/ký. Không phụ lục. 50 tests chứng từ (kiểm tra 50 dòng, trường hợp 30 serial chia 100đ+8đ vẫn đúng tổng), lint/build và PDF Chrome có đủ serial, số phiếu và số trang trên tất cả các trang. Deploy cec84e30-33c0-4408-a677-b4939864ef00.


### 26/10/2026 — Cột mặc định phiếu nhập
Tiền hàng (trước VAT), Tiền VAT hiển thị mặc định trước cột Tiền hàng (sau VAT) (đổi từ Sau VAT (đ)). Người tạo và Ngày giờ tạo luôn hiện ngay trước Thao tác. Tổng SL chuyển vào Cột hiển thị, mặc định ẩn cùng Serial/Người sửa cuối. Thẻ Tiền hàng (đ), Tiền VAT (đ). Điều chỉnh colgroup/minWidth và colspan đồng bộ, giữ dữ liệu/tổng/API. 50 tests chứng từ, lint/build và Chrome xác nhận thứ tự cột, chọn Tổng SL, nhãn thẻ đạt. Deploy b9d31333-756b-4cca-a4ef-2f7c4daf770f.


### 26/10/2026 — In A4 dọc và bỏ dòng nhận diện trùng
Bỏ receipt-table-reference trong thead, giữ footer số phiếu/ngày và Trang x/y. Mẫu phiếu nhập chuyển A4 portrait; cân cột và cỡ chữ vừa bề ngang trang; chi phí toàn chiều ngang. Đưa receipt stylesheet vào head sau CSS chung để override hướng giấy rõ ràng. 50 tests chứng từ, lint/build; PDF Chrome 50 serial có 3 trang, mỗi trang 595x842 point và Rotate=0, trang 2/3 mỗi số phiếu một lần; đủ tất cả serial, không tràn ngang. Deploy 977126c3-794f-47ca-a367-05b304576f77.


### 26/10/2026 — Chỉ mở xem từ số phiếu/nút Xem
Bỏ click/keydown/tabIndex/nhãn thao tác trên hàng bảng phiếu nhập, bỏ con trỏ bàn tay toàn hàng; giữ hover để dễ đọc. Số phiếu và nút Xem vẫn mở xem, các nút khác giữ tác vụ riêng. 50 kiểm tra chứng từ (click hàng/ô/ngõ Enter không mở hoặc gọi get, số phiếu/Xem vẫn mở), lint/build đạt. Deploy 205c3d2b-4d54-4e24-8184-71830ed43814.


### 26/10/2026 — Phiếu xuất kho theo chuẩn giao diện phiếu nhập
Danh sách PX dùng cùng khung viewport/bảng cuộn sticky, cỡ chữ/căn số, bộ lọc 4 ô (kỳ gộp ngày, tháng hiện tại mặc định, 400ms tìm kiếm), chip Kho/Người tạo, phân trang 20/50/100, sort máy chủ, Xem/In và menu lịch sử/Excel/nhân bản/sửa-hủy theo quyền. Chỉ số phiếu/nút Xem mở xem. Cột Người nhận, mục đích, Tổng SL theo ĐVT, Giá trị xuất do máy chủ tính, trạng thái, người/ngày tạo; tùy chọn Serial/Người sửa cuối. Ba thẻ Số phiếu/Tổng SL/Giá trị xuất, cùng list response và cache tổng khi chuyển trang/sort. Không mang NCC/hóa đơn/VAT/chi phí nhập sang PX. Ẩn nút tạo PX trùng ở Header và banner danh mục trên trang chứng từ.
Nguyên nhân không tải tồn: DocumentLines cũ chưa dùng PartStock. Nay PX tải stock theo part+warehouse+stock_state từ stock_buckets; đổi kho/trạng thái gọi lại, abort phản hồi cũ, lỗi có Thử lại, không dùng tồn trình duyệt. Đổi kho xóa serial/nguồn/bồn cũ; đổi trạng thái xóa serial/nguồn. Tồn hiển thị là hiện tại, không giả là tồn trước phiếu posted.
Serial PX chọn trong drawer riêng từ inventory_serials status=in_stock, đúng kho/vật tư/trạng thái, tìm kiếm 400ms và phân trang; không gợi ý serial đã xuất, chặn serial đã chọn ở dòng khác và chọn quá SL. Bản xem chỉ hiện serial đã lưu. Giữ xe/thiết bị nhận, vị trí, ODO/giờ, nguồn FIFO/bồn/gói Data theo nghiệp vụ hiện có. Không nhập giá vốn thủ công; Lưu vẫn commit:true, kiểm tra đủ tồn/serial và ghi sổ nguyên tử phía Worker; posted PX không được sửa/hủy trực tiếp.
Mẫu in PX A4 dọc theo kiểu công ty, người nhận/thiết bị/vị trí, mỗi serial một dòng khi đủ số lượng, tổng giá vốn từ máy chủ, không VAT/hóa đơn hay chi phí nhập; số phiếu/ngày và trang. Excel riêng cho phiếu/danh sách đang lọc, giữ ID/serial text, không trộn đơn vị tính.
API additions: stock_state optional ở view=stock; view=available-serials; creators theo kind receipt/issue; include_totals hỗ trợ issue trên cùng request. Đều có kiểm tra tham số/quyền kho; không migration. Preview là dữ liệu dựng riêng; kiểm thử ghi sổ dùng D1 test, không tạo phiếu thử production.
Đạt 109 frontend tests, 93 Worker tests, lint/check/build; Chrome chọn vật tư kho1 tồn3 → kho2 tồn0 → kho1 tồn3 → thu hồi tồn0, form thiết bị, không hóa đơn/VAT; PDF PX 50 serial đủ 50, A4 dọc không tràn. API test xác nhận sau PX serial đã xuất bị loại khỏi danh sách, tồn giảm đúng, chặn ngoài quyền và xuất lại serial. Deploy 803a218c-de38-4593-bbd9-1154ecc6b248.


### 26/10/2026 — Dòng PX gọn và nguồn tự động
Tách IssueLines riêng: STT, vật tư, SL, trạng thái, serial, thiết bị nhận (loại + mã), vị trí lắp, ODO, giờ máy, thao tác trên một hàng; tất cả TD align-top, ghi chú dưới vật tư, giữ bồn/gói Data có điều kiện. Bỏ khối mở rộng và ô chọn nguồn nhập trên PX. Các loại chứng từ khác giữ component cũ. Không còn ô Vị trí trước/tháo trên form PX, giữ dữ liệu lịch sử.
API parseDraft từ chối source_line_id thủ công cho issue; formDraft bỏ lựa chọn nguồn cũ của PX ở bản nhập/sửa để dùng luồng tự động, không sửa database khi xem. Hàng không serial giữ phân bổ số lượng FIFO. Hàng có serial lấy inventory_serials.document_line_id của chính serial; không thay serial bằng lô sớm hơn. Không thay chính sách giá vốn bình quân hiện có.
Đạt 109 frontend tests, 94 Worker tests, lint/check/build. API kiểm tra serial ở lô sau: lô trước còn nguyên, lô sau giảm đúng, allocation khớp nguồn serial; kiểm tra vật tư không serial lấy lô sớm nhất; chặn gửi nguồn thủ công. Chrome đo mép trên các ô chênh không quá 2px, các trường nhận thiết bị/vị trí/đồng hồ cùng TR, không ô nguồn, tồn vẫn thay đúng kho/trạng thái. Không migration/phiếu thử production. Deploy 73c24725-1e43-4db8-ad52-1beeb030d9c4.


### 26/10/2026 — Thông tin nhận PX
Đổi Kho thành Kho xuất, Người nhận / bàn giao thành Người nhận cho PX. IssueHeader mới: người nhận chọn staff (cả nhân viên/tài xế), Bộ phận nhận readOnly theo department_id/department; lái xe chọn staff_type=driver, biển số từ vehicles; ODO hiện tại tự điền từ xe rồi cho sửa theo thực tế; nhóm xe checkbox readOnly theo BNAM/DCANG hoặc source_group box_truck/office_car. Không suy đoán nhóm thiếu dữ liệu. Biển số chọn tải lái xe assigned_driver_id; ghép đang active chỉ có một trailer/container thì gợi ý số, không tự chọn khi nhiều liên kết. Rơmooc/Container/Khác có thể nhập sửa, không làm thay liên kết ghép vận hành.
issue_details có IDs và snapshot chuỗi lưu header_json, không migration. Worker GET issue-context lấy tên người nhận/bộ phận/lái xe/nhóm đúng danh mục; khi lưu xác minh và thay các trường tự điền, không tin tên/bộ phận/nhóm do client giả. Giữ snapshot nếu liên kết không đổi khi sửa phiếu cũ, và không truy lại danh mục khi xem. Các thông tin này là header chứng từ; không tự ghi đè thiết bị/ODO của từng dòng xuất. In/Excel/lịch sử có thông tin mới; search_text có metadata mới. Bản ghi cũ không có issue_details vẫn mở được.
UI chặn Lưu khi lookup pending, abort lookup cũ, hiển thị lỗi thay vì điền dữ liệu đoán; DTO context được kiểm tra kiểu. Preview thêm nhân sự/tài xế mẫu và bộ lọc staff_type để kiểm tra.
Đạt 110 frontend tests, 95 Worker tests, lint/check/build. Chrome người nhận → Bộ phận kho; biển số → lái xe/Đường dài/ODO 123456. API chống giả tên/nhóm và snapshot giữ nguyên sau đổi phòng ban/nhóm xe. Không phiếu thử production. Deploy df555171-e6b0-461a-b76d-5ef433e4e3aa.


### 26/10/2026 — Sửa chọn/xóa người nhận mở nhầm Nhập nhanh
Nguyên nhân: IssueHeader.onBusyChange trước đó nối setImporting, cùng state mở DocumentQuickImport. Tách headerLoading riêng, chỉ nút Nhập nhanh điều khiển importing. Chặn submit và khóa nút Lưu/Nhập nhanh khi lookup header pending; không thay dữ liệu/Worker/schema. Thêm test deferred promise cho cả chọn và xóa người nhận: không xuất hiện modal, Lưu khóa rồi mở lại sau phản hồi, Nhập nhanh vẫn mở khi chủ động bấm. Đạt 111 frontend tests, lint/build. Deploy 4b53850e-96d6-4a3e-ba1f-7dde35d37e79.


### 26/10/2026 — Hoàn thiện bố cục và thông tin bắt buộc phiếu xuất
- Chọn lái xe lấy xe đang hoạt động được phân công duy nhất, ODO, nhóm xe; không có/không duy nhất thì yêu cầu chọn biển số. Đổi/xóa lái xe xóa thông tin xe cũ tương ứng; giữ độc lập trạng thái tải thông tin và Nhập nhanh.
- Họ tên lái xe, biển số xe, ODO bắt buộc khi lưu ghi sổ; Worker kiểm tra lại. Đầu phiếu 4 ô/hàng trên màn hình lớn: Số phiếu, Ngày chứng từ, Kho xuất, Người nhận.
- Bảng dòng hàng bỏ Thiết bị nhận, ODO, Giờ máy; thêm Đơn giá, Thành tiền; không VAT. Giữ Vị trí lắp, Ghi chú thành cột cạnh Thao tác. Giá vốn chỉ đọc từ số đã ghi sổ; chưa ghi sổ hoặc đã sửa nội dung hiển thị dấu gạch để tránh dùng giá cũ.
- Worker trả giá trị/SL thực tế theo từng dòng đã ghi sổ trong labels issue_amount/issue_quantity. Dòng mới chưa có đích nhận kế thừa xe và ODO đầu phiếu; giữ liên kết lịch sử đã có. Không đổi thuật toán FIFO hoặc cách chọn serial, không migration.
- Kiểm tra: frontend lint/build, 112 tests giao diện, Worker check và 96 tests (SQLite + Miniflare/D1). Browser kiểm tra chọn tài xế tự điền xe/ODO, 4 ô đầu phiếu, cột tiền/ghi chú, cửa sổ ở 1600/1024/390 px. Ảnh artifacts/issue-layout-desktop.png và issue-layout-390.png. Trang preview nền có tràn ngang trên điện thoại từ bố cục chung; cửa sổ phiếu nằm trong viewport và tự cuộn.
Deploy thành công: 6768c808-da5e-4676-a51d-776ef25490b2 — https://qlvt.tannamchinh.workers.dev.


### 26/10/2026 — Thu gọn đầu phiếu xuất và thiết bị ghép nối
Người nhận chuyển xuống ô đầu hàng 2, tiếp theo Bộ phận nhận và Mục đích/nội dung. Hàng đầu còn Số phiếu, Ngày chứng từ, Kho xuất. Nhóm xe nằm cùng hàng với Phương tiện/thiết bị ghép nối trên màn hình lớn; ba ô Rơmooc số, Container số, Máy phát nhỏ hơn. Máy phát nhập tay, giữ trường lưu `other` để bảo toàn dữ liệu đã có, đồng bộ nhãn bản in và Excel. Không thay nghiệp vụ hay schema.
Đã kiểm tra frontend lint/build, 58 tests chứng từ; trình duyệt xác nhận hàng 2, hai nhóm cùng hàng, nhập tay Máy phát và cửa sổ ở 1600/1024/390 px.


### 26/10/2026 — Cân màu dark mode phiếu xuất
Thêm scope document-editor/issue-header trong palette tối dùng chung: nền cửa sổ #111b2e, khối thông tin #182438, fieldset #142035, ô nhập #0c1628, chỉ đọc #202f46, nhãn #cbd5e1, viền #40516b. Tiêu đề bảng và nút phụ có lớp nền riêng; checkbox nhóm xe hiện dấu chọn xanh rõ. Chỉ áp dụng @media screen và data-theme=dark; không đổi bản in hay light mode.
Kiểm tra lint/build và Chrome thực tế tại 1600/1024/390px, xác nhận computed colors, nhập Máy phát, chế độ sáng và print không nhận override tối. Ảnh artifacts/issue-dark-desktop.png, issue-dark-390.png, issue-light-check.png.


### 26/10/2026 — Nội dung, máy phát ghép nối và mục đích dòng phiếu xuất
- Nhãn đầu phiếu đổi thành Nội dung. Thứ tự thiết bị: Rơmooc số → Máy phát → Container số. Khi chọn xe/tài xế, issue-context đọc thêm pairing_type=generator đang hoạt động; một liên kết duy nhất tự điền mã máy phát vào snapshot other. Không có hoặc nhiều liên kết thì để trống; vẫn nhập tay được theo yêu cầu trước. Đổi xe làm mới trường máy phát.
- Thứ tự bảng: STT, Vật tư, Số lượng, Trạng thái hàng, Đơn giá, Thành tiền, Serial, Vị trí lắp, Mục đích, Ghi chú, Thao tác.
- DraftLine.issue_purpose tùy chọn: use/repair/warranty/liquidation; phiếu cũ thiếu trường mặc định Sử dụng. API kiểm tra enum, chỉ chấp nhận Thanh lý với stock_state=recovered, kể cả lưu nháp. UI khóa Thanh lý cho hàng mới và tự chuyển về Sử dụng khi đổi trạng thái từ thu hồi sang mới. Mục đích lưu trong line_json, có trên bản in/Excel. Đây là phân loại mục đích của dòng phiếu xuất, không thay thế phân hệ/chế độ ghi sổ phiếu thanh lý riêng. Không migration hay thay cách FIFO/serial.
- Kiểm tra lint/build, Worker check; 112 frontend tests, 97 Worker tests, gồm chặn gửi Thanh lý hàng mới, lưu/đọc lại mục đích, lấy máy phát từ ghép đang hoạt động và không lấy liên kết đã ngừng. Browser xác nhận thứ tự cột, máy phát trước container, nhãn Nội dung, reset mục đích và dark/light/print, 1600/1024/390px.


### 26/10/2026 — Lọc vật tư xuất theo tồn kho và trạng thái hàng
CatalogPicker phiếu xuất gửi warehouse_id + stock_state (new/recovered), chỉ bật chọn vật tư sau khi chọn kho. API parts lọc EXISTS stock_buckets.quantity_milli>0 đúng kho/trạng thái trước tìm kiếm và phân trang, trả current_stock_milli đúng phạm vi cho từng lựa chọn. Tài khoản warehouse phải được cấp document_warehouse_access, không lộ tổng tồn kho khác. Trạng thái/kho đổi thì reset trang danh sách, hủy request cũ; PartStock tự tải lại theo trạng thái như trước. Danh sách hiển thị Tồn + ĐVT, không tải toàn bộ danh mục để lọc phía trình duyệt. Chế độ preview cũng áp dụng lọc; phiếu mẫu chưa ghi sổ không tạo tồn giả.
Đơn giá, Thành tiền (tiêu đề và giá trị) và ODO đầu phiếu căn trái theo yêu cầu mới. Giữ số lượng căn phải.
Kiểm tra: lint/build; 113 frontend tests, 98 Worker tests, gồm tồn dương/0, khác kho, new/recovered, search/paging và phân quyền. Browser tạo PN mẫu nhập 2, chọn PX thấy Tồn 2; đổi thu hồi tồn 0 và không có vật tư để chọn; đổi mới tồn 2; xác nhận computed textAlign=left cho ba giá trị, dark/light và responsive.


### 26/10/2026 — Giá vốn khi lập phiếu và danh mục Vị trí lắp
Giá xem trước qua POST /api/document-drafts/issue-price (chỉ đọc, kiểm tra phạm vi kho, tồn và serial), cập nhật theo vật tư/kho/trạng thái/SL/serial; debounce + AbortController, không dùng phản hồi cũ. IssueCostCells hiện đơn giá và thành tiền trước khi lưu, giữ giá đã ghi sổ khi xem phiếu cũ. Lưu vẫn tính lại trên Worker.
Hàng số lượng tính bình quân gia quyền theo giá trị/số lượng bucket kho-trạng thái, đơn giá 3 số lẻ độc lập thành tiền nguyên đồng; FIFO chỉ phân bổ nguồn số lượng. Serial lấy giá vốn nhập riêng, gồm chi phí đã phân bổ vào kho, không VAT; sổ serial lưu cost_vnd_milli để không mất giá riêng khi điều chuyển cùng nhiều serial khác giá. Sửa Plan.debit cho outbound serial theo giá riêng; snapshot phiếu cũ không tính lại. Dữ liệu serial tồn hiện có lấy giá nguồn nhập hiện tại; kiểm tra trước triển khai không có chênh lệch bucket so với giá nguồn vượt sai số làm tròn. Chặn thiếu giá trị tồn thay vì tự ghi âm. Danh sách chọn serial hiện giá từng serial; dòng nhiều serial hiện tổng và đơn giá tương ứng.
Danh mục mount-positions: menu Danh mục vị trí lắp, thêm/sửa/ngừng sử dụng, mã không trùng, tìm tiếng Việt, phân quyền/audit/lịch sử dùng chung. Phiếu xuất chọn từ catalog đang hoạt động; mount_position_id lưu liên kết, to_position lưu tên snapshot. Vị trí cũ nhập tay vẫn giữ nguyên, đổi tên/ngừng danh mục không đổi lịch sử phiếu. Không tự tạo các vị trí chưa được người dùng chỉ định.
Migrations 0027_mount_positions.sql và 0028_serial_cost_snapshot.sql đã áp dụng remote. Sao lưu trước vào artifacts/tnc-before-issue-pricing-20261026.sql. Sau áp dụng: 80/80 serial tồn có giá snapshot, bảng mount_positions tồn tại; PRAGMA foreign_key_check không lỗi. Không đổi các bút toán đã ghi sổ.
Kiểm tra: frontend lint/build, 114 frontend tests, Worker check và 102 tests (SQLite + Miniflare). Ca serial 100/300 chọn 300 ra 300 trước và sau ghi sổ; chuyển kho hai serial giữ giá 100/300; bình quân 100+300 ra 200; đơn giá 33,333 và tiền 33 giữ độc lập. Tests catalog CRUD/search/inactive/snapshot, phân quyền quote, quote không ghi dữ liệu, bỏ phản hồi cũ. Browser xác nhận giá 150.000 hiện trước lưu và SL 2 thành tiền 300.000, giao diện sáng/tối/in và ba kích thước.
Deploy thành công: de816c7b-636f-4f68-8321-6ca8529e193e, https://qlvt.tannamchinh.workers.dev.


### 26/10/2026 — Bổ sung vị trí lắp và Dùng cho
Migration 0029 thêm 8 mã Đầu kéo GTT/GTN/GPT/GPN/STT/STN/SPT/SPN và 12 mã Rơ moóc T1TT/T1TN/T1PT/T1PN, T2TT/T2TN/T2PT/T2PN, T3TT/T3TN/T3PT/T3PN theo đúng tên người dùng cung cấp. Giữ TT/TP có sẵn, phân loại Đầu kéo khi notes chưa có. Tổng cloud: 10 Đầu kéo, 12 Rơ moóc. Giữ ID/trạng thái cũ khi trùng mã, cập nhật chỉ mục tìm kiếm tiếng Việt cùng dữ liệu.
Riêng mount-positions đổi nhãn Ghi chú thành Dùng cho, ô chọn Đầu kéo/Rơ moóc và API kiểm tra hai giá trị; vẫn lưu ở notes để bảo toàn schema/liên kết. Giữ null cho dữ liệu cũ. Bảng và xuất danh mục dùng nhãn trường mới; không đổi Ghi chú dòng chứng từ.
Backup trước seed: artifacts/mount-positions-before-usage-20261026.json. Kiểm tra lint/build, Worker check và 103 tests (đủ 8+12, tìm kiếm nhóm, chặn nhóm không hợp lệ, đổi nhóm cập nhật tìm kiếm); đã đối chiếu tổng và tên mã trên cloud. Deploy 60b27e2d-2b84-40d8-b77c-3d1c584c7a97.


### 26/10/2026 — Nhập nhanh dạng bảng, sao chép kèm tiêu đề
Thay textarea CSV bằng bảng ô nhập trực tiếp, thêm/xóa tối đa 60 dòng, nút Sao chép bảng kèm tiêu đề copy TSV phù hợp Excel cùng các giá trị đang có. Dán từ Excel vào một ô nhận cả bảng có hàng tiêu đề, ánh xạ theo tên cột bất kể thứ tự. Bảng dán thay dữ liệu đang nhập; thiếu/trùng/không biết tiêu đề hoặc sai số ô báo lỗi và khóa áp dụng, không đoán theo vị trí. Bảo toàn mã có số 0 đầu, dấu phẩy thập phân/ghi chú, ô quoted nhiều dòng; không dùng dấu phẩy phân cột trên giao diện. Có Xem trước trước khi Thêm vào phiếu; thay ô/dán lỗi xóa preview cũ.
Cột theo loại phiếu: mã, SL, đơn giá/VAT/Data cho nhập; trạng thái/serial/mục đích/vị trí/ghi chú cho xuất. Serial nhiều giá trị ngăn cách chấm phẩy; mã vị trí đối chiếu danh mục đang dùng. Phiếu xuất tìm mã trong đúng kho/trạng thái tồn, cộng kiểm tra SL cùng mã/trạng thái, giữ chặn Thanh lý hàng mới; giữ ranh giới số Việt Nam và kiểm tra Data/serial như trước.
Kiểm tra frontend lint/build, 116 tests. Chrome clipboard thực xác nhận copy cả tiêu đề+giá trị, dán đảo cột, dấu phẩy trong notes và đơn giá 150.000,5, xem trước/áp dụng; dark/light và mobile 390px. Ảnh artifacts/quick-table-light.png, quick-table-dark.png, quick-table-mobile.png. Không thay schema/ghi sổ.


### 26/10/2026 — Serial cùng ngày nhập và vị trí lắp có nhóm xe
Đối chiếu trực tiếp B65046023: in_stock/new tại KHONS, PN 10.26.00001/PN, stock_lots.available_at=2026-10-10T23:07. Form PX chỉ chọn ngày nhưng trước đây Plan.debit/serialIssueCost so timestamp (giờ UI ẩn), khiến phiếu 10/10 có giờ trước 23:07 bị chặn dù cùng ngày.
Thêm issueStockCutoff theo cuối ngày nghiệp vụ, chỉ áp dụng cho phiếu xuất; đồng bộ lọc available-serials có business_at, quote issue-price và ghi sổ. UI gửi ngày hiện tại vào danh sách serial và quote, hủy request/giá cũ khi ngày đổi. Vẫn chặn xuất trước ngày nhập và kiểm tra tồn/kho/trạng thái/quyền/khóa sổ; lỗi ngày nay nêu rõ serial và ngày nhập, tách khỏi sai kho/trạng thái. Không sửa timestamp, giá hay dữ liệu serial hiện có, không migration.
Vị trí lắp tăng cột từ 100 lên 300, bảng cuộn tối thiểu 1500 và cửa sổ PX tối đa 1600. Format nhãn dùng chung: Đầu kéo – tên hoặc Rơ moóc – tên; danh sách có mã + nhãn ghép, ô đã chọn/snapshot mới/in/Excel dùng tên kèm nhóm. Snapshot phiếu cũ giữ nguyên, nhóm danh mục thay sau không làm đổi lịch sử; Nhập nhanh nhận cả mã, tên và nhãn ghép.
Kiểm tra lint/build, 117 frontend tests và 105 Worker tests: receipt 10/10 23:07 và PX 10/10 08:00 đủ serial picker/quote/post thành công; 09/10 không thấy serial, quote/post bị chặn và serial vẫn in_stock; quantity same-day và snapshot Rơ moóc cũng đạt. Browser xác nhận ô vị trí >=240px, hiện đủ Rơ moóc – Trục 1 Trái Trong, sáng/tối và responsive. Deploy fb595afa-1bb4-4c94-a87e-3d8459ff9bcb.


### 26/10/2026 — PN/PX nhập ngày giờ và mẫu in PX theo biểu mẫu
Ngày chứng từ PN/PX hiển thị/chỉnh trong cùng một ô dd/mm/yyyy HH:mm. DocumentDateInput với withTime, kiểm tra ngày thực/giờ 00–23/phút 00–59, giữ local wall-clock business_at YYYY-MM-DDTHH:mm, không đổi qua UTC. Mở lại phiếu, danh sách, in và Excel đều hiện giờ đã lưu; ngày hóa đơn và các loại phiếu khác giữ điều khiển cũ. Counter số phiếu vẫn theo ngày/tháng.
Theo yêu cầu bổ sung giờ hiển thị, quy tắc hiện tại cho serial picker/quote/post dùng đúng ngày GIỜ đã chọn (thay quy tắc cuối ngày ở mục trước). Nguồn 10/10/2026 23:07 phải xuất từ 23:07 trở đi; 08:00 cùng ngày vẫn bị chặn rõ, thông báo nêu giờ nhập. Không sửa timestamp nguồn, số tồn hay chứng từ cũ.
IssuePrint mới dùng chung receiptPrintCss: A4 dọc, lề 10/10/15mm, font Inter/sans + mono cho mã, tiêu đề xanh và căn bảng/giữ hàng/lặp header như PN. Theo ảnh: tên công ty/MST, số và ngày giờ, kho/người nhận/bộ phận/nội dung, phần đề xuất/người duyệt để chấm trống khi không có liên kết, tài xế/xe/ODO/nhóm xe/thiết bị ghép nối. Bảng 11 cột: STT, Mã, Tên, ĐVT, Chất lượng, SL, Đơn giá, Thành tiền, Serial, Vị trí, Ghi chú; nhóm I Vật tư TB thay thế; tổng giá trị xuất không VAT. Mục đích ngoài Sử dụng in ở ghi chú. 5 ô ký: Người lập, Người giao hàng, Người nhận, Thủ kho, Trưởng bộ phận. Phiếu chưa ghi sổ/hủy có nhãn riêng.
Serial in riêng từng dòng, đơn giá giữ giá nhập riêng tới 3 số lẻ; thành tiền nguyên đồng phân bổ giữ nguyên tổng đã lưu. Worker lưu issue_serial_costs theo dòng vào labels_json trong cùng transaction ghi sổ; không đọc giá hiện tại để đổi bản in lịch sử khi serial thu hồi. Số cũ chưa có snapshot phân bổ từ tổng dòng giữ nguyên tiền, ghi chú làm tròn khi cần. Điều chỉnh đơn giá serial core/quote để không mất số lẻ do chia ngược từ tiền đã làm tròn. Không migration.
Kiểm tra frontend lint/build và 119 tests; Worker check và 106 tests. Ca nguồn 23:07 chặn giờ sớm và chấp nhận giờ bằng/sau nguồn; serial unit 33,333 + thành tiền 33; snapshot in không đổi khi giá serial hiện tại đổi. Browser nhập PN 10/10/2026 23:07, lưu/mở lại/list đúng giờ; PX 23:08. Chrome PDF thực: 12 dòng 1 trang, 28 dòng 2 trang, 50 serial 3 trang, đủ serial/chữ ký, không tràn ngang và không trang trắng. Tắt riêng fixed page-id footer trên PX để tránh trang trắng Chrome; số trang dùng margin box chung PN.
Mẫu PDF artifacts/issue-form-sample.pdf; many-lines và serials-50 có bản HTML/PNG/PDF đi kèm. Deploy d07884ea-244d-4a32-8c66-7de530a49e91 tại https://qlvt.tannamchinh.workers.dev.


### 26/10/2026 — Cân cột danh sách PN/PX sau khi hiển thị giờ
ReceiptTable và IssueTable tăng Ngày CT lên 160px, Ngày giờ tạo 160px; cân lại số phiếu/kho/tên/nội dung/người tạo/thao tác. Hai bảng thống nhất padding ngang 8px. Độ rộng tối thiểu tính trực tiếp từ tổng colgroup, gồm cột tùy chọn, để không ép cột ngày khi màn hình hẹp; cuộn ngang trong vùng bảng. IssueTable đổi documentDate sang documentDateTime để có đủ giờ như PN. Tooltip giữ đầy đủ timestamp. Không đổi dữ liệu hoặc nghiệp vụ.
Kiểm tra lint/build. Chrome dùng CSS/font bản dựng, SSR hai component thật với dữ liệu 26/10/2026 23:59, mặc định và bật cột tùy chọn, viewport 1920/1280/390: đo chiều rộng text không vượt phần hiển thị cho cả Ngày CT/Ngày giờ tạo ở cả PN/PX. Ảnh artifacts/list-columns-receipt.png, list-columns-issue.png. Deploy b12892aa-6dc3-42bc-a8f3-be7de90a2b4d.

### 26/10/2026 — Căn giá tiền thẳng hàng ô nhập PX
IssueCostCells bọc Đơn giá và Thành tiền trong flex min-height 34px, items-center để tâm giá trị khớp tâm ô Số lượng/select cùng hàng (không căn theo toàn bộ chiều cao dòng vật tư có tên/tồn bên dưới). Giữ căn trái theo yêu cầu trước; báo lỗi vẫn nằm dưới giá tiền. Không đổi giá trị, nghiệp vụ, bản in hay dữ liệu.
Đã lint/build và Chrome đo chênh tâm <=1px; kiểm tra giao diện sáng/tối và màn hình hẹp. Ảnh artifacts/issue-cost-alignment.png. Deploy dd527e7e-4583-4e7a-8812-a2df2efa0a49.


### 26/10/2026 — Phiếu thu hồi theo mẫu, đánh giá chất lượng thực tế
- Thêm RecoveryHeader/RecoveryLines và metadata recovery_details: phương tiện tháo, xe/rơmooc/máy phát/container, lái xe, ODO/giờ máy, lý do tháo, bàn giao/tiếp nhận, ghi chú. Dùng giao diện ngày giờ và palette sáng/tối chung.
- Mỗi dòng chọn lần xuất/lắp còn mở; serial drawer chỉ trả serial đang mounted và thuộc usage còn mở. Kiểm tra quyền kho nguồn khi tra cứu, quyền kho nhận và liên kết khi ghi sổ; giữ chống trùng/thu hồi quá số lượng/giao dịch nguyên tử.
- Người dùng chốt nhập % đánh giá thực tế. Chấp nhận 0..100, tối đa 2 số thập phân; chuẩn hóa số Việt ở biên UI, máy chủ tính lại bằng số nguyên: phần giá trị còn mở phân bổ theo số lượng × chất lượng / 100, làm tròn đồng. Lưu snapshot base/quality/source, đọc amount/unit price từ sổ cho xem/in. Dữ liệu API cũ không có quality giữ thuật toán tuổi thọ trước đây; form mới bắt buộc quality.
- CSD/CSC về recovered; KSD/CTL về pending_scrap, không phát lại như recovered. Lưu đủ mã phân loại riêng trên từng dòng.
- Nhập nhanh bảng có tiêu đề Phân loại, Chất lượng (%), giữ dán/copy TSV và kiểm tra trường. Sau nhập cần chọn nguồn usage trên từng dòng.
- RecoveryPrint dùng CSS phiếu nhập, A4 portrait 11 cột, 4 chữ ký, giờ chứng từ, % chất lượng và phân loại, kho nhận; nhiều serial tách dòng và bảo toàn tổng đồng. Không VAT. Bản mẫu artifacts/recovery-print-sample.pdf (1 trang); mẫu 32 dòng artifacts/recovery-print-many-lines.pdf (2 trang), đủ 32 serial, không trang trắng.
- Kiểm thử đạt 122 frontend + 107 Worker (gồm runtime D1); lint/check/build đạt. Browser kiểm tra sáng/tối, sửa % cập nhật giá, serial theo usage và mobile; không có lỗi JavaScript. Không thay schema/migration và không tạo phiếu thử trên dữ liệu thật.

Triển khai thành công Worker qlvt: `8c397eab-abe8-48c6-a593-cec3a9837463`, https://qlvt.tannamchinh.workers.dev. Không migration.


### 26/10/2026 — Cân lại các hàng đầu phiếu thu hồi
RecoveryHeader: hàng 1 Số/Ngày/Kho; hàng 2 Họ tên lái xe/ODO/Giờ máy; hàng 3 Biển số/Rơmooc/Máy phát/Container; hàng 4 Phương tiện tháo thiết bị/Lý do tháo/Người bàn giao/Người tiếp nhận. Giữ responsive 1/2 cột khi màn hình hẹp. Chọn lái xe gọi issue-context theo driver, lấy xe duy nhất và ghép nối active hiện tại, ghi đè bộ ghép nối cũ; bỏ chọn lái xe xóa các trường xe/thiết bị. API này đã có sẵn và được dùng lại, không thay schema hay nghiệp vụ ghi kho.
Đạt lint, 123 frontend tests, build; browser đo các ô hàng 2/hàng 4 cùng trục, sáng/tối/mobile và serial không lỗi JavaScript. Test mới xác nhận query driver không kèm xe cũ, lấy đủ trailer/generator/container/ODO và xóa pairing cũ khi bỏ chọn.
Deploy thành công: 3df75358-39cd-4ef8-8ab3-bbb218380ca9 — https://qlvt.tannamchinh.workers.dev.


### 26/10/2026 — Ưu tiên % còn lại theo định mức cho tồn thu hồi
Yêu cầu mới thay cách tính nhân % đánh giá thực tế trước đó. recoveryValuation là hàm Worker dùng chung preview và posting: đọc usage/root line/parts/serial đang mounted từ D1; dùng giá xuất gốc × số lượng × phần định mức còn lại. Tỷ lệ sử dụng = chênh lệch ODO/giờ / định mức, chặn mốc âm và giới hạn sử dụng tối đa 100%. Nếu cả hai định mức được cấu hình, yêu cầu đủ cả hai mốc và dùng tỷ lệ còn lại thấp hơn, giữ quy tắc thận trọng đã có. Thiếu định mức/mốc gốc hoặc lịch sử tái sử dụng/chuyển đồng hồ chưa đủ căn cứ thì báo lỗi và không ghi giá ước đoán.
Chất lượng đánh giá lưu riêng, không ảnh hưởng giá tính theo định mức. Giao diện thêm mốc ODO/giờ tháo riêng từng dòng, mặc định kế thừa đầu phiếu khi để trống. Máy chủ kiểm tra lại lượng mở/ngày/mốc tháo, lưu usage_id/root_line_id/source document, giá xuất, định mức, mốc thực đo, phần trăm còn lại và giá trị vào recovery_valuation snapshot; estimated_hours=false. Chưa bật công thức giờ tạm tính theo lựa chọn ưu tiên hiện tại của người dùng. Serial theo giá xuất riêng và snapshot số tiền/đơn giá thu hồi riêng, không gộp thành giá bình quân cho serial. Đích kho vẫn recovered hoặc pending_scrap theo phân loại.
RecoveryPrint hiển thị % còn lại định mức cạnh giá trị và ghi rõ giá trị quản trị tồn thu hồi, không phải bút toán khấu hao tài chính. Áp dụng khi lập phiếu mới, không sửa lại giá trị phiếu đã ghi sổ. Không schema migration và không chỉnh dữ liệu kho thật trong kiểm thử.
Đạt 123 frontend tests, 109 Worker tests (gồm runtime D1), lint/check/build. API kiểm tra thiếu định mức, thiếu mốc, phần trăm vượt định mức, ODO/giờ lùi, quá lượng, giả ngày/giá/lượng mở, chất lượng 0/100 không đổi định giá và serial khác giá giữ đúng từng giá trị; quote bằng posted amount. Browser sáng/tối/mobile, đổi ODO cập nhật %/tiền, PDF 1 trang mẫu và 2 trang 32 dòng đủ serial.
Deploy thành công cách tính % còn lại theo định mức: bcb30910-e1dc-4d7f-a7d0-d4caa5e109fd — https://qlvt.tannamchinh.workers.dev. Không migration, không tính lại phiếu đã ghi sổ.


### 26/10/2026 — Sửa PTH không tải được nguồn, báo Bộ lọc nguồn không hợp lệ
Nguyên nhân lỗi: RecoverySource gọi sources(usages, part, '', ''), documentClient gửi stock_state='' nhưng Worker kiểm tra enum kho cho cả usages. Tách validation theo loại nguồn: sources vẫn yêu cầu trạng thái kho hợp lệ; usages không dùng trạng thái/kho nhận để lọc usage. Client bỏ warehouse_id/stock_state với usages, giữ nguyên sources. Thêm test chính request thực của client để tránh chỉ mock UI che lỗi tích hợp.
Nguồn thu hồi nhận vehicle_id từ RecoveryHeader, Worker lọc usage đang mở theo xe và các thiết bị ghép active hiện tại, vẫn áp quyền kho nguồn và phân trang. Option hiển thị ngày giờ lắp, số phiếu, vị trí, đối tượng và lượng chưa thu hồi. Đổi xe/lái xe sang xe khác xóa usage/serial/mốc tháo cũ để chọn lại; serial vẫn chỉ tải theo usage đã chọn.
Đối chiếu D1 thật chỉ đọc: mã M-DC-CBXE-0006 có phiếu 10.26.00001/PX ngày 10/10/2026 15:00, xe 50H-110.99, 12 usage còn mở, mỗi usage 1000 milli, vị trí 12 lốp rơ moóc. Không thiếu phiếu gốc và không sửa dữ liệu kho trong lần khắc phục này.
Đạt lint/check/build, 124 frontend tests và 110 Worker tests. Regression kiểm tra usages với stock_state rỗng, sources vẫn chặn trạng thái rỗng, scope xe A/B/thiết bị ghép, serial đúng usage, và quyền kho nguồn.
Deploy thành công bản sửa nguồn thu hồi: 26f2d2ae-1679-4084-9147-6a94fc22579f. D1 đối chiếu bổ sung xác nhận đủ 12 serial liên kết active, trạng thái mounted, tổng lượng mở 12; không thay dữ liệu thật.


### 26/10/2026 — Luồng thu hồi từ vật tư đang sử dụng, giờ tạm tính và nhận/xuất thiếu định giá
- RecoveryUsagePicker + GET recovery-sources: chọn trực tiếp các usage mở phát sinh từ OUT posted, hiển thị mã/tên/serial/phương tiện/vị trí/phiếu gốc/ngày lắp/ODO/giờ lắp/SL còn lại; scope kho và xe/thiết bị ghép, tìm mã/serial/số phiếu, phân trang. Serial chọn thành dòng 1 đơn vị; hàng lượng cho thu từng phần. Giữ usage_id/root_line_id qua các vòng; đóng đủ thì mất khỏi nguồn chọn.
- Server chặn ngày tháo trước lắp và ngày tương lai (Asia/Ho_Chi_Minh), ODO/giờ tháo thấp hơn lắp, quá lượng mở, sai serial, kho không quyền, kỳ khóa. Đủ căn cứ thì tính % còn lại/chi phí đã dùng/giá trị thu hồi; giờ thiếu đồng hồ thực đo được tạm tính theo chênh thời gian lắp/tháo, metadata elapsed_calendar_hours và estimated_hours rõ ràng. Không quy đổi thành khấu hao tài chính.
- Nhiều vòng: sử dụng ngân sách tuổi thọ còn lại từ snapshot vòng thu hồi trước nếu các nguồn nhất quán; không đặt lại toàn bộ định mức. Nếu nguồn thiếu/pha trộn tuổi thọ khác nhau/chuyển đồng hồ thiếu căn cứ thì giá trị quản trị pending thay vì ngăn nhận số lượng.
- Người dùng chốt vẫn cho xuất tiếp khi chưa xác định giá trị, cảnh báo để bổ sung sau. Migration0030 thêm inventory_valuation_flags liên kết dòng và origin, giữ trạng thái pending/reason lâu dài. Các trường tiền số nguyên nội bộ trên dòng pending chỉ là số tạm của sổ, không là giá trị 0 đã được xác định; API detail/quote/stock/tổng phiếu công bố null và không lộ đơn giá/serial-cost 0. Dòng issue/transfer phát sinh từ nguồn pending nhận cờ nguồn tương ứng; quản lý theo lượng còn pending trong nguồn bình quân cảnh báo toàn dòng, không tính ra một giá bình quân có vẻ xác định.
- Form/PDF/list có cảnh báo chưa xác định giá trị; bộ lọc Chưa xác định giá trị cho PTH/PX và export lọc tương ứng giúp rà soát bổ sung sau. Chưa tự ghi giá bù hay thay lại lịch sử khi có định mức mới. Việc bổ sung giá và đối chiếu các dòng đã tiêu thụ cần nghiệp vụ rà soát riêng; trạng thái/căn cứ/ID nguồn đã được lưu để thực hiện sau.
- Phiếu và tồn kho tiếp tục ghi cùng giao dịch nguyên tử để không có khoảng lệch phiếu-tồn, với version guard/audit/idempotency đã có. Báo cáo đọc lại dữ liệu đã ghi, không tạo hàng thu hồi giả hoặc sửa lịch sử PX.
- Đạt126 frontend tests,114 Worker tests (gồm runtime D1), lint/check/build. Kiểm tra thực end-to-end qua API cho ví dụ10/3/7, khác ID khi xuất lại, giá trị400 từ ngân sách500 sau vòng1, giá pending nhận/xuất/thu vòng2 vẫn null và có cờ, scope, ngày tương lai, metadata giờ tạm tính. Browser desktop/dark/mobile nguồn chọn và tiền trống có cảnh báo không lỗi JavaScript.
- Sao lưu trước migration: artifacts/tnc-before-pending-recovery-values-20261026.sql (4547618bytes). Không backfill giá trị hay sửa chứng từ cũ.
Migration0030 và deploy thành công: a82b22b9-cc6e-4e5d-8c2f-8f928f1ed3e2 — https://qlvt.tannamchinh.workers.dev. Kiểm tra sau migration: inventory_valuation_flags có0 dòng, PRAGMA foreign_key_check không có lỗi. Không tạo chứng từ thử trên kho thật.


### 27/10/2026 — Thu gọn bộ lọc và chuyển nút rà soát giá xuống cuối hàng
Đổi nút Chưa xác định giá trị thành Phiếu cần bổ sung giá, dùng icon Filter và tooltip giải thích chỉ lọc phiếu cần rà soát; inactive nhẹ, active vẫn báo màu amber. Chuyển khỏi nhóm Lập phiếu/Xuất Excel xuống ô cuối phía phải trong ReceiptFilters (PX), PTH xuống phía phải dưới nhóm lọc riêng. ReceiptFilters thêm trailingAction tùy chọn; điều chỉnh ô lọc32px, chiều rộng trạng thái125px/bộ lọc khác120px, thu gọn khoảng cách và padding. Trên màn hình nhỏ nút xuống cuối phía phải; nhóm thao tác được giới hạn max-width để tự xuống hàng, không gây tràn ngang.
Giữ nguyên query/logic pendingOnly và nghiệp vụ dữ liệu. Đạt126 frontend tests, lint/build. Browser1600/1280/390px sáng/tối: nút là phần tử cuối hàng lọc bên phải, ô nhập/nút32px, bật/tắt aria-pressed đúng, popup thời gian dùng được, không lỗi JS, không tràn trang mobile. Artifacts compact-issue-filters-*.png. Không thay Worker/schema/dữ liệu kho.
Deploy thành công27/10/2026: 2daaf139-369e-4cdc-8ead-eb5773e9fb2e — bộ lọc gọn và nút Phiếu cần bổ sung giá ở cuối bên phải.


### 27/10/2026 — Tìm nhà cung cấp theo mã số thuế trong phiếu nhập
CatalogPicker suppliers đổi placeholder thành Tìm mã, tên hoặc mã số thuế và hiện MST dưới tên trong từng lựa chọn; sau chọn vẫn giữ nhãn mã/tên và supplier_id như cũ. Catalog API đã có tìm tax_code theo dữ liệu search, bổ sung nhánh so sánh tax_code chuẩn hóa bỏ dấu gạch/khoảng trắng cho từ khóa số để tìm cả MST chi nhánh khi nhập liền, nhập cách hoặc một phần. Giữ lọc is_active, phân trang trước trả dữ liệu, tìm mã/tên và escape LIKE.
Đạt127 frontend tests,115 Worker tests (gồm runtime D1), lint/check/build. Test UI nhập0312345678001 hiển thị MST0312345678-001 và chọn đúng ID, giữ nhãn; API đối chiếu mã đầy đủ/có gạch/có khoảng trắng/một phần, NCC ngừng hoạt động bị loại khi is_active=1, tìm mã NCC vẫn hoạt động. Không schema hay sửa dữ liệu NCC/chứng từ thật.
Deploy thành công27/10/2026: 1c246561-c699-4b95-a41e-b13affda6cc4 — tìm và hiển thị MST nhà cung cấp trong phiếu nhập.


### 27/10/2026 — Phiếu vật tư đang sử dụng đầu kỳ, nối nguồn thu hồi
- Số dư đầu kỳ có2 tab Tồn kho đầu kỳ / Vật tư đang sử dụng đầu kỳ. Dùng cùng kind opening và bộ đếm SD, phân biệt header opening_mode=stock/in_use; API list lọc đúng mode (legacy không có mode thuộc stock). Client gửi đủ opening_mode và valuation_pending, có test request thực để tránh bỏ sót tham số.
- OpeningUsageLines nhập vật tư, xe/rơmooc/thiết bị, vị trí lắp, số lượng, serial, đơn giá gốc tùy biết, ngày lắp gốc/ODO/giờ gốc tùy biết, ghi chú; không tự lấy ODO hiện tại làm mốc lắp cũ. Giá/mốc chưa rõ được để trống; hàng serial mỗi dòng1 đơn vị trên form. Kho quản lý xác định nguồn và quyền truy xuất, không nhận kho tại lúc khai báo.
- Posting in_use tạo inventory line loại OPENING và stock_usage/usage_serials; serial ở mounted, warehouse_id NULL. Không tạo stock_movements, stock_lots, stock_balances, stock_buckets hoặc opening_groups. Giá gốc thiếu có cờ pending như luồng thu hồi đã chốt. Khai báo serial trùng bị chặn; hàng lượng chặn khai báo lại cùng vật tư/đối tượng/vị trí bằng unique index và giao dịch rollback.
- Migration0031 thêm opening_usage_lines (declared_at, installed_at nullable, original_unit_price_known, đối tượng/vị trí). Điều chỉnh opening_no_prior_stock để bỏ qua riêng các dòng đang dùng đầu kỳ: hai số đầu kỳ không cản nhau, nhưng kho đã có phát sinh thực vẫn giữ chặn khởi tạo lại. Không backfill hoặc thay chứng từ cũ.
- Thu hồi đọc cả OUT và OPENING có opening_usage_lines; nguồn có source_kind=opening_usage, nhãn Đang sử dụng đầu kỳ, ngày lắp chưa rõ hiển thị đúng. Scope xe còn bao gồm rơmooc/thiết bị đang ghép. Giữ đúng usage_id, serial và lượng còn mở; thu hết nguồn biến mất; thu một phần chỉ giảm lượng tương ứng. Chặn thu trước ngày khai báo, đồng hồ nhỏ hơn lắp; không tạm tính giờ từ ngày khai báo nếu ngày lắp gốc chưa biết. Khi đủ giá/ODO lắp thì định giá theo tuổi thọ; thiếu thì tiền trống, nhận/xuất tiếp kèm cờ pending.
- OpeningUsagePrint A4 portrait,11 cột,3 chữ ký, dùng CSS/typography phiếu nhập, không VAT, mốc/giá chưa rõ thể hiện trống. PDF mẫu1 trang và mẫu30 dòng2 trang đủ30 serial, không trang trắng. Browserdesktop1752/dark/mobile390 kiểm tra tab, chọn rơmooc/serial giữ giá trị, không ép giá/mốc cũ và form cuộn ngang nội bộ.
- Đạt130 frontend tests,117 Worker tests (có runtime D1), lint/check/build. API integration chứng minh mounted opening không sinh tồn kho, thu hồi từ rơmooc ghép với đầu kéo thấy đúng nguồn/serial, giá unknown vẫn nhận, đóng đủ hết nguồn, thu3/10 còn7, giá100×3×50%=150 khi đủ căn cứ, phân quyền kho, idempotency, duplicate rollback, hai mode list tách biệt. Backend test dùng dữ liệu cô lập, không tạo phiếu giả trên D1 thật.
- Sao lưu trước migration: artifacts/tnc-before-opening-in-use-20261027.sql. Migration0031 đã áp dụng thành công.
Deploy thành công27/10/2026: fb876b5a-1fef-41ff-a965-caa0e7e25ba4. Backup4548202bytes; migration0031 đã áp dụng. Kiểm tra D1 sau triển khai: opening_usage_lines0 dòng, nguồn OUT của M-DC-CBXE-0006 vẫn12 dòng, foreign_key_check không lỗi; không tạo phiếu thử trên dữ liệu thật.


### 27/10/2026 — Giá hiện tại × chất lượng kỹ thuật cho thu hồi đầu kỳ không rõ giá gốc
- Chỉ nguồn opening_usage_lines.original_unit_price_known=0 được áp dụng, Worker đọc lại nguồn gốc từ D1. Giữ cách tính tuổi thọ KM/giờ cho nguồn có giá gốc; không giảm kép giá trị theo đồng hồ khi dùng chất lượng thực tế.
- Dòng thu hồi có giá mua hiện tại/đơn vị, % chất lượng và tên kỹ thuật xác nhận. Thiếu một căn cứ thì tiền null, vẫn nhận/xuất số lượng và cảnh báo theo quyết định trước. Giá hiện tại phải dương, chất lượng 0..100% (2 số lẻ), 0% là giá trị xác định bằng 0. Giá/số lượng dùng thang đo và BigInt; kiểm tra giới hạn an toàn.
- Snapshot recovery_valuation version3 basis current_price_quality giữ giá tham chiếu, % chất lượng, người xác nhận, thời điểm ghi, usage/root IDs, số lượng và thành tiền. Bản in hiển thị căn cứ. Serial nhập kho nhận giá mới, giữ nguyên đầu kỳ chưa rõ giá gốc và lịch sử cũ. Không có migration, không chỉnh dữ liệu chứng từ đã ghi sổ.
- Đạt 131 frontend tests,119 Worker tests,lint,Worker check,build. Kiểm thử 5.000.000 ×20%=1.000.000;3 cái=3.000.000;0/100%,2 số lẻ, thiếu xác nhận, sai serial, quá lượng, ngày/ODO sai, chặn ghi đè nguồn có giá gốc và giá xuất tiếp1.000.000. Chrome kiểm tra chọn nguồn xóa giá cũ, nhập lại giá/chất lượng, dark/light/mobile. Logs artifacts/current-price-{ui,api}-tests.log, ảnh artifacts/current-price-recovery-{dark,light,mobile}.png.

Đã deploy Worker qlvt: 4e1d1be6-b203-42b2-b379-cb474f06c110, https://qlvt.tannamchinh.workers.dev.


### 27/10/2026 — Người dùng, phân quyền qua Cloudflare Access
Đã bổ sung AccessGate, nút mở tài khoản trên thanh đầu, trang Hệ thống → Người dùng, phân quyền; tạo email chờ liên kết, quản lý4 vai trò và kho được phép thao tác, khóa tài khoản giữ lịch sử, chặn tự khóa/hạ quyền quản trị. Migration0032 giữ tài khoản cũ đã liên kết; sao lưu trước cập nhật và FK check rỗng. Đạt134 frontend tests,124 Worker tests,lint/check/build; Chrome desktop/mobile sáng/tối. Cloudflare Access policy vẫn quản lý riêng, không gửi email hoặc tự tạo tài khoản trên nhà cung cấp. Chi tiết docs/18-user-access-20261027.md. Deploy749d01a8-38f1-4332-bd6f-5be97efd7c3b tại https://qlvt.tannamchinh.workers.dev.


### 27/10/2026 — Trang đăng nhập riêng trước màn nghiệp vụ
Đã triển khai AppEntrance/AccessGate theo mẫu chia chéo, minh họa SVG và logo Tân Nam Chinh; mỗi lần mở hoặc reload chờ bấm Vào phần mềm sau xác nhận Access. Không tải API danh mục trước bấm vào, không xây mật khẩu riêng và không nới bảo vệ Access. Khi chưa có phiên, Cloudflare vẫn xác thực trước khi tải HTML. Đạt136 frontend tests,lint/build,Chrome actual App desktop/dark/mobile/phiên hết hạn. Deploy2b48ef21-08c6-462a-9d5e-9aefd38ff687.


### 27/10/2026 — Đăng nhập native tại Tân Nam Chinh
Đã deploy87ef1968-a67e-4271-8c4c-ff37c46dda3d với AUTH_MODE=native, migration0033 và Worker Secret AUTH_PASSWORD_PEPPER. Giữ người dùng/dữ liệu cũ, đã chuẩn bị liên kết thiết lập quản trị một lần24 giờ trong file riêng. Đạt138 frontend tests,130 Worker tests,lint/check/build và browser HTTPS với Worker/D1 cục bộ, không chuyển nhà cung cấp. Kiểm tra cloud sau deploy: root200, API còn302 do policy Access ngoài Worker; chưa tuyên bố hoàn tất cắt chuyển. Cần chủ tài khoản thiết lập mật khẩu trên trình duyệt đang có phiên Access, rồi đổi chính sách qlvt sang Bypass/Everyone để native auth bảo vệ dữ liệu. Chi tiết docs/20-native-login-20261027.md. Không đưa link/token thiết lập hoặc pepper vào log/tài liệu công khai.


### 27/10/2026 — Đã hoàn tất chuyển khỏi Cloudflare Access
Người quản trị đã thiết lập mật khẩu (ready_admins=1, setup token used=1) và đổi policy Access sang Bypass. Kiểm tra trực tiếp bằng trình duyệt sạch: root200 hiển thị form email/mật khẩu Tân Nam Chinh, không có điều hướng cloudflareaccess.com. GET /api/auth/me,/api/parts,/api/user-management,/api/document-drafts?kind=receipt và POST /api/document-drafts không cookie đều401 JSON. Một lần thử đăng nhập email ngẫu nhiên không tồn tại trả401 với thông báo chung, không tạo cookie phiên; kiểm tra này chỉ ghi bộ đếm đăng nhập, không tạo tài khoản/phiếu/tồn. Desktop/mobile không tràn, không lỗi JS. Bản triển khai vẫn87ef1968-a67e-4271-8c4c-ff37c46dda3d; không cần deploy lại sau đổi policy. Script worker/scripts/verify-native-cutover.mjs, ảnh artifacts/native-cutover-live-{desktop,mobile}.png.
