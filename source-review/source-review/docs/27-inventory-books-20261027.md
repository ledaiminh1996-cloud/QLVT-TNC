# Ba sổ kho máy chủ — 27/10/2026

## Phạm vi

Nối ba menu có sẵn Sổ theo dõi kho, Sổ chi tiết NXT (Thẻ kho), Sổ tổng hợp NXT vào API /api/inventory-books. Không dùng dữ liệu localStorage, không bật lại các màn bảng cũ. Tách shared/inventoryBooks.ts, worker/src/inventoryBooks.ts, src/books và lazy load từ CloudCatalogApp.

- Theo dõi kho: tồn theo vật tư, kho và trạng thái; giá trị tồn, đơn giá tồn bình quân và ngày phát sinh gần nhất.
- Thẻ kho: chọn vật tư, số dư theo kho/trạng thái, từng phát sinh, Serial lịch sử, số dư chạy sau từng dòng; mở phiếu gốc ở chế độ chỉ xem.
- Tổng hợp NXT: số lượng và giá trị đầu kỳ, nhập, xuất, cuối kỳ theo vật tư/kho/trạng thái. Nhấn mã vật tư mở thẻ kho theo đúng kho/trạng thái.
- Lọc khoảng ngày, kho, vật tư, trạng thái; phân trang trên máy chủ. Tổng tiền theo toàn bộ bộ lọc, không chỉ trang đang xem. Không cộng chung số lượng khác đơn vị tính vào thẻ tổng tiền.

## Nguồn và quy tắc số liệu

Nguồn duy nhất là stock_movements nối inventory_document_lines và inventory_documents đã posted. Không dùng tổng tiền hóa đơn có VAT để làm giá tồn; dùng giá trị phát sinh kho đã ghi, gồm phân bổ chi phí nhập theo cơ chế hiện có. Phiếu nháp/hủy không vào sổ. Vật tư đang sử dụng đầu kỳ không có phát sinh kho và bị loại thêm bằng is_opening_usage=0.

Đầu kỳ = phát sinh trước ngày bắt đầu, cộng phiếu OPENING tồn kho đúng ngày bắt đầu. Nhập/xuất trong kỳ loại phần OPENING đã tính đầu kỳ; các phiếu OPENING ở ngày khác trong khoảng xem được tính phát sinh tại ngày đó. Cuối kỳ = đầu kỳ + nhập - xuất. Thẻ kho chạy số dư theo từng kho/vật tư/trạng thái trên toàn bộ lịch sử đến ngày kết thúc, rồi mới lọc kỳ và phân trang; thứ tự ổn định có ngày giờ, ngày ghi sổ, ID phiếu/dòng/phát sinh. Dòng OPENING được tính đầu kỳ được xếp trước các phát sinh của kỳ.

Điều chuyển kho: một dòng xuất kho đi và một dòng nhập kho nhận; tăng/giảm toàn công ty triệt tiêu. Tổng nhập/xuất khi xem nhiều kho thể hiện cả luân chuyển nội bộ. Chuyển thiết bị/đảo vị trí không có stock_movements nên không tạo nhập xuất kho giả.

Đắp vỏ: nối received_line_id với retread_jobs để dùng ngày nhận, Serial sau đắp và chi phí đã ghi sổ; dòng gửi giữ ngày gửi/Serial trước đắp. Không lấy vị trí hay trạng thái hiện tại của inventory_serials để suy ra lịch sử.

Dòng có inventory_valuation_flags pending: số lượng được tính, giá trị phát sinh để null. Số dư còn hàng có lịch sử định giá chưa giải quyết được giữ null một cách thận trọng; không suy đoán giá hoặc dùng 0 thay giá chưa biết. Khi hết số lượng, số dư giá trị ghi sổ vẫn hiển thị. Thông báo pending_lines/pending_groups phản ánh lịch sử dòng chưa giải quyết, có thể còn ngay cả khi đã xuất hết. Tỷ lệ/giá vật tư đang sử dụng không tự thay thế định giá phát sinh kho.

Giá trị và số lượng dạng integer được kiểm tra giới hạn số nguyên an toàn trước trả JSON. UI giữ null, không ép thành 0. Việc sửa/xóa PN hợp lệ được phản ánh từ sổ máy chủ ở lần tải lại.

## Quyền và tính nhất quán

Chỉ GET, yêu cầu tài khoản đang hoạt động và phiên hợp lệ, kể cả xuất/in. Thủ kho chỉ xem kho có document_warehouse_access; lọc tất cả cũng chỉ tổng hợp các kho được phép, kho chỉ định ngoài quyền trả 403. Các vai trò đọc toàn bộ theo quy tắc quyền hiện hành. Danh sách kho riêng của API gồm cả kho ngừng hoạt động có lịch sử, được lọc quyền.

Các truy vấn trang, số dòng, tổng và số dư thẻ kho chạy cùng D1 batch. Xuất/in lấy toàn bộ một lần (tối đa 10.000 dòng); vượt mức trả lỗi yêu cầu thu hẹp, không âm thầm xuất thiếu. Client kiểm tra đủ số dòng trước tạo file. Không đổi schema, phát sinh, flags, bộ đếm hay audit khi đọc sổ.

## Xuất và in

Excel .xlsx dùng cell writer hiện có: số lượng ở đơn vị hiển thị, tiền dạng số, mã/Serial dạng chuỗi giữ số 0 đầu, nội dung bắt đầu bằng dấu = vẫn là text, giá trị chưa biết là ô trống. Bản in A4 ngang, sáng, lặp tiêu đề bảng, số tiền không ngắt giữa dòng, font chung ứng dụng. Xuất/in dùng cùng cột và cùng dữ liệu API.

## Kiểm tra

156 kiểm thử frontend/shared đạt. Bộ Worker/D1 143 kiểm thử đạt, gồm kiểm tra truy vấn thẻ kho trên runtime D1; bổ sung kiểm tra sửa/xóa PN và giới hạn xuất, kiểm tra lại bốn kịch bản sổ/đắp đều đạt. Kiểm tra TypeScript và production build đạt.

Đối soát: đầu kỳ 10 cái × 1.000đ, nhập 10 cái × 1.000đ, xuất 3, điều chuyển 2: kho đi còn 15 cái/15.000đ, kho nhận 2 cái/2.000đ; toàn công ty 17 cái/17.000đ. Có kiểm tra VAT không cộng vào giá kho, số dư qua phân trang, kho ngoài quyền, dòng thu hồi chưa có giá, Serial lịch sử, phiếu đang sử dụng đầu kỳ không tăng tồn, ngày nhận đắp khác ngày gửi, không ghi dữ liệu khi xem.

Trình duyệt: ba màn, sáng/tối, điện thoại, drilldown/quay lại, Excel download và iframe bản in thực tế không có lỗi. Ảnh và file thử trong artifacts/inventory-books-* chỉ chứa dữ liệu mẫu cục bộ, không ghi phiếu giả lên cloud.

Tailwind loại thư mục artifacts khỏi dò lớp CSS để bản HTML kiểm tra in có nhúng stylesheet không làm phình CSS production.

## Triển khai

Đã triển khai phiên bản ab99fffb-42c3-47f3-935f-0a4993d62985. Trang chính HTTP 200 dùng đúng gói index-CUOB_7Mu.js; cả ba API sổ chặn truy cập chưa đăng nhập bằng HTTP 401. Không chạy migration hoặc ghi chứng từ giả trên dữ liệu thật.
