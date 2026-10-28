# Format thống nhất cho hai sổ NXT — 28/10/2026

InventoryBooks điều phối StockLedger hoặc NxtBooks. NxtBooks dùng chung ListMenu/LedgerPeriod, lưới --ledger-header-columns, thẻ 72px và CSS mật độ/vùng cuộn với Sổ theo dõi kho. Tổng hợp 7 cột có lượng/tiền hai tầng; chi tiết 9 cột có Serial, đầu/cuối kỳ, tìm mã/số phiếu/Serial và loại phiếu. Mobile dùng thẻ, giữ một biến thể DOM để không tải/trình bày hai lần. Ngoài ra giữ drill-down từ mã vật tư tổng hợp, Quay lại và mở phiếu gốc chỉ đọc.

API summary nhóm vật tư/kho/trạng thái, hoàn toàn không dùng biểu thức đọc Serial khi lấy tổng hợp; vật tư quản lý Serial như vỏ xe/ắc quy chỉ tính lượng, không tách nhóm. Bản in/Excel summary không có Serial. Không bỏ các cột giá trị NXT hiện có; lượng là số chính, tiền bên dưới và có tùy chọn ẩn trong bảng.

API card giữ phát sinh gốc và danh sách Serial đã lưu trong chứng từ, không đọc giá/ghép nối hiện tại để viết lại lịch sử. Một Serial hiển thị trực tiếp; nhiều Serial có nút mở từng mã, bấm để lọc lịch sử trong kỳ. Nếu số mã khớp lượng thì có nhãn nhập/xuất 1 đơn vị; thiếu căn cứ không tạo giả lượng hay tiền con. Xuất/in có dòng con mỗi Serial, lượng/tiền của con để trống ở các cột số; tổng chỉ ở phát sinh, không cộng trùng. Danh sách con của màn hình lọc theo mã Serial khi đang tìm mã đó.

Search/loại phiếu áp dụng sau window số dư, giữ toàn bộ số dư/tổng NXT cho phạm vi vật tư/kho/trạng thái. Direction chỉ đổi thứ tự trả về; mặc định asc và tháng hiện tại, 50/100 bản ghi trang. Quyền kho và giá null không thay đổi. Các kịch bản đầu kỳ, nhập, xuất, chuyển kho, thu hồi không sửa công thức cũ. Tổng hợp/chi tiết dùng trường posted có sẵn, không migration. Kiểm tra và phiên bản triển khai ghi bên dưới khi hoàn tất.

## Kiểm tra và triển khai

168 UI/shared và 148 Worker/D1 tests đạt, lint/Worker check/build đạt. API thử vỏ/ắc quy quản lý Serial: tổng hợp chỉ hai nhóm vật tư, số lượng nhập/xuất/tồn đúng; payload tổng hợp không chứa Serial. Chi tiết tìm một mã vẫn giữ lượng phát sinh và số dư chính xác, đổi chiều không đổi số dư, lọc loại phiếu không cắt mất dữ liệu tính tồn. Có kiểm thử kho không được cấp, tiền pending null, sửa/xóa phiếu, số dư qua điều chuyển và không ghi thêm lịch sử. Miniflare/D1 thực thi được summary và card với direction/kind.

UI thử drill-down, Quay lại, mở phiếu chỉ đọc, hủy phản hồi cũ và không hiện dữ liệu khác loại sổ khi chuyển màn; mở từng Serial, tìm theo mã và xuất/in không lặp lượng/tiền con. Browser 1920/1366/390 xác nhận 7 cột summary không có Serial, 9 cột card và 50 mã con, thẻ 72px và hai hàng thẳng lưới; mật độ/sắp xếp/menu, không cuộn ngang hoặc cuộn trang lồng; Excel summary tải đủ. Các ảnh/file mẫu artifacts/nxt-* chỉ cục bộ.

Đã cập nhật ARCHITECTURE.md cùng thay đổi. Triển khai version 494339f7-f3af-468d-8e80-0a6f07853d19; index-CTfYf7ow.js, index-Dnk1asjT.css. Production root/bundle sổ HTTP 200 đúng bản dựng; API chưa đăng nhập 401. Không thay schema, không tạo phiếu thử hoặc sửa dữ liệu gốc trên production.

## Bổ sung chi tiết sổ tổng hợp

Thay bản tổng hợp 7 cột bằng 12 cột: Kho mã/tên, Trạng thái hàng, Vật tư mã/tên (text không link), ĐVT text màu thường, Đầu kỳ, Nhập, Nhập điều chuyển, Xuất, Xuất điều chuyển, Cuối kỳ, Ngày phát sinh đầu/cuối. ĐVT không còn gộp mờ trong ô vật tư của summary. Bỏ drill-down từ summary theo yêu cầu mới; chi tiết vẫn vào từ menu và bộ chọn vật tư. Bảng chi tiết 9 cột giữ nguyên.

API thêm transfer_in/out_quantity_milli, transfer_in/out_value_vnd và first/last_movement_at vào từng nhóm kho/vật tư/trạng thái. Điều chuyển là phần của tổng in/out đã có, không thay công thức số dư; nhóm theo từng chiều của stock_movements, không nhân theo Serial. Ngày min/max trong kỳ, kể cả OPENING đúng ngày đầu; không có phát sinh kỳ thì null dù có số dư cũ. last_at cũ giữ nguyên. Không đổi BookTotals hay dữ liệu gốc, không migration.

Excel có 20 trường gồm lượng/tiền điều chuyển, tên kho và hai ngày; bản in dùng 12 cột với lượng/tiền hai tầng để vừa A4 ngang. Ô số dài có tooltip, không ép tràn ngang. Kiểm tra/phiên bản ghi tiếp sau khi triển khai.

### Nghiệm thu bổ sung sổ tổng hợp

168 UI/shared và 148 Worker/D1 đạt, lint/check/build đạt. Ca điều chuyển hai kho xác nhận kho gửi transfer_out=2.000 milli/2.000đ và kho nhận transfer_in=2.000 milli/2.000đ, các tổng NXT cũ không đổi. Ngày đầu gồm OPENING đúng đầu kỳ, ngày cuối đúng phiếu cuối; khoảng chỉ có số dư cũ trả hai ngày null. Test UI xác nhận đủ 12 cột, Kho có tên, ĐVT text thường, mã không link; chi tiết vẫn mở phiếu gốc chỉ đọc. Excel 20 trường có lượng/tiền điều chuyển và ngày; print 12 cột và tên kho.

Browser kiểm tra 1920/1366/390 không cuộn ngang/tràn trang, màu chữ ĐVT bằng nội dung thường, mã vật tư không có nút, các trường mới hiện đủ. Đã tải Excel mẫu và kiểm tra iframe in 12 cột; các tệp artifacts/nxt-summary-transfer* chỉ thử cục bộ. ARCHITECTURE.md đã cập nhật quy tắc thay thế 7 cột và bỏ drill-down.

Triển khai version 8844316e-2af0-45bd-a7ef-0efe215fbf04; index-DkC2Nw0B.js, InventoryBooks-DU24CAb4.js. Production root/bundle HTTP 200, đúng bản dựng. Không migration hoặc thay đổi chứng từ gốc.


## Tinh gọn bộ lọc và tổng cuối bảng — 28/10/2026

Chỉ Sổ tổng hợp NXT: hàng năm ô là Tìm kiếm, Kỳ, Kho, Trạng thái hàng, nhóm Mã A→Z / Cột hiển thị. Bỏ picker vật tư riêng, Bộ lọc khác và nhãn Đã ghi sổ. Sổ chi tiết giữ bộ chọn vật tư và các bộ lọc nghiệp vụ đang có. Nhãn ngày rút thành Phát sinh đầu / Phát sinh cuối trên UI/Excel/in.

Bảng tổng hợp căn trái đồng nhất theo yêu cầu mới, thay quy tắc căn số phải cho riêng màn này. Ô lượng/tiền 0 hiện dấu – màu phụ; null có tooltip Chưa xác định giá trị, vẫn có thông báo và không biến thành số 0. Tiền phụ 11px, màu #cbd5e1 trên nền tối. Bỏ truncate tiền, cho ngắt giữa nhóm nghìn khi rất dài. Sửa mẫu số tỷ lệ cột về tổng trọng số thật và phân bổ thêm chỗ cho sáu cột NXT. Không đổi dữ liệu xuất Excel thành chuỗi gạch.

Dòng tổng tiền đặt ngoài vùng cuộn trong cùng khung, luôn ở đáy kể cả ít dòng, cùng tỷ lệ cột với bảng và trừ độ rộng thanh cuộn thực. Sáu giá trị tính ở Worker trên toàn bộ bộ lọc, không cộng riêng trang hiện tại; tổng API thêm transfer_in_value_vnd / transfer_out_value_vnd, null được giữ. Ẩn Giá trị (đ) thì ẩn cả chân tiền. Không cộng số lượng khác ĐVT, không cộng điều chuyển lần nữa vào tồn. Không migration hay thay dữ liệu chứng từ.


### Kiểm tra tinh gọn giao diện

169 UI/shared và 148 Worker/D1 tests đạt; lint, Worker check và build đạt. Kiểm thử mới xác nhận bộ lọc trạng thái nằm ngoài, không có picker vật tư/Đã ghi sổ, đủ chữ số tiền lớn, null phân biệt 0, dòng tổng dùng toàn bộ bộ lọc dù có 75 dòng/50 dòng mỗi trang. API kiểm tra tổng không đổi qua trang 2 và tổng điều chuyển thay đúng theo kho; client từ chối tiền không nguyên an toàn. Bảng chi tiết vẫn giữ bộ chọn vật tư, mở phiếu chỉ đọc và Serial.

Browser thử 1920/1366/390, bảng 80 nhóm: 50/30 dòng qua hai trang, tổng không đổi, cuộn không làm dịch chân tổng. Các cột chân tổng khớp vị trí bảng sai lệch dưới 1px. Ở 1366, các tiền mẫu đến 250.000.000 đ và ngày đều hiển thị đủ, không tràn; tiền rất dài được ngắt nhóm nghìn. Không cuộn ngang; menu mật độ/ẩn tiền/đổi chiều/lọc trạng thái hoạt động. Bằng chứng cục bộ: artifacts/nxt-summary-polish-*.png và *-tests.log. ARCHITECTURE.md được cập nhật cùng thay đổi.

Triển khai version 9f34fbb7-fc78-4f7b-ae7f-655f7b107442; index-D-iazZQk.js, InventoryBooks-gOUqs-UT.js, index-CZnGnvSM.css. Production root/bundles HTTP 200 đúng bản dựng; API chưa đăng nhập trả 401. Không migration hoặc thay đổi dữ liệu chứng từ.


## Đổi thứ tự cột — 28/10/2026

Thứ tự sáu cột giá trị: Đầu kỳ, Nhập, Xuất, Cuối kỳ, Nhập ĐC, Xuất ĐC. Đồng bộ ánh xạ giá trị, chân tổng ghim, Excel và bản in; tên rút gọn Nhập ĐC / Xuất ĐC. Nới rộng trạng thái, thu gọn vật tư; tiêu đề và giá trị trạng thái một dòng (tooltip giữ đủ tên). Giữ nguyên cách tính Nhập/Xuất đang bao gồm điều chuyển; yêu cầu lần này chỉ đổi vị trí/nhãn và độ rộng. ARCHITECTURE.md đã được cập nhật cùng thay đổi.

Nghiệm thu đổi cột: lint/build và 8 kiểm thử NXT đạt; kiểm tra trực quan 1366/1920 xác nhận thứ tự mới, tổng khớp từng cột. Ở 1366, ô trạng thái rộng 161px nội dung, đủ tên dài nhất đo 145px trên một dòng; không tràn ngang. Version 570a5256-fd0f-436c-9d5c-388d5f7ba636, index-D4Ky4gn2.js, InventoryBooks-BJdgYZM2.js; production root/assets HTTP 200 đúng bản dựng.


## Phân bổ lại khoảng dư trạng thái — 28/10/2026

Giữ tổng trọng số 141: Kho 9→12, Trạng thái hàng 23→14, Vật tư 13→17, Phát sinh cuối 10→12; các cột khác giữ nguyên. Phần lấy từ trạng thái được chia hết cho đúng ba cột người dùng yêu cầu. Tiêu đề trạng thái và Phát sinh cuối không xuống dòng; tên trạng thái dài giữ tooltip. Cùng trọng số cho bảng và dòng tổng, không đổi thứ tự hay số liệu. ARCHITECTURE.md cập nhật quy tắc hiện hành thay tỷ lệ cũ.

Kiểm tra lint/build đạt; browser 1366/1920 xác nhận Kho Nghi Sơn hiện đủ (71px chữ / 78px ô), Phát sinh cuối (75px chữ / 78px nội dung), trạng thái (83px chữ / 93px nội dung), các tiêu đề trên một dòng. Không cuộn ngang; chân tổng trùng tọa độ cột. Version e2648e48-7f91-4a23-b5ff-c84bf82e66bc; index-CEoNmxni.js, InventoryBooks-CPGNaNSL.js, production root/assets 200 đúng bản dựng.


## Tách số lượng / giá trị thành tám cột — 28/10/2026

Bỏ cột Nhập ĐC/Xuất ĐC, thay sáu ô hai tầng bằng tám cột: Tồn đầu, Dư đầu, SL nhập, Tiền nhập, SL xuất, Tiền xuất, Tồn cuối, Dư cuối. Tổng cộng 14 cột trên màn hình/in; Excel 16 trường vì Kho và Vật tư tách mã/tên. Ánh xạ dùng chung nxtSummaryColumns.ts, dữ liệu quantity_milli và money_vnd không đổi. Dòng tổng chỉ điền bốn cột tiền trên toàn bộ bộ lọc; không cộng lượng khác ĐVT. Ẩn Giá trị (đ) sẽ bỏ bốn cột tiền và chân tổng, bảng còn 10 cột. Giữ số 0 dạng gạch, tiền null vẫn chưa xác định, tiền dài không bị cắt. Điều chuyển vẫn trong tổng nhập/xuất theo nghiệp vụ hiện hành; không đổi truy vấn, chứng từ hoặc schema. ARCHITECTURE.md đã thay đặc tả cũ bằng bố cục hiện hành.

Nghiệm thu: 169 UI/shared tests đạt, lint/build đạt. Kiểm thử ánh xạ cả tám trường và kiểu số Excel, print 14 cột, null/0, tổng toàn bộ bộ lọc và ẩn bốn cột tiền; chi tiết vẫn mở phiếu chỉ đọc. Browser 1366/1920/390 xác nhận 14 cột, bốn tổng tiền khớp tọa độ, ẩn tiền còn 10 cột, không cuộn ngang; bảng 80 nhóm qua trang 50/30 giữ tổng không đổi và ghim khi cuộn. Version 7182cca4-3559-4eb8-a4f2-605e28004b40; index-CTmZwmvZ.js, InventoryBooks-BYoBvezF.js. Production root/bundles HTTP 200 đúng bản dựng, API chưa đăng nhập 401. Không đổi Worker, migration hay chứng từ.


## Tiêu đề một dòng, bỏ khoảng dư trạng thái/ngày — 28/10/2026

Thay độ rộng tỷ lệ thuần bằng độ rộng gọn cố định: Kho 88px, Trạng thái hàng 96px, ĐVT 36px, mỗi cột lượng 60px, ngày đầu 84px/ngày cuối 88px. Phần còn lại chia Vật tư và bốn cột tiền theo 1.5:1:1:1:1; không để trạng thái/ngày tự phình rộng trên màn lớn. Tất cả tiêu đề nowrap, dùng cùng nxtSummaryWidths() cho bảng và chân tổng. Không chừa scrollbar-gutter khi ít dòng; ResizeObserver theo dõi cả vùng cuộn để chân tổng bù đúng thanh cuộn thật khi nhiều dòng. ARCHITECTURE.md thay quy tắc phần trăm cũ bằng chuẩn hiện hành. Không đổi dữ liệu hoặc công thức NXT.

Nghiệm thu: lint/build và 8 kiểm thử NXT đạt. Browser đo toàn bộ 14 tiêu đề ở 1366/1920: cùng chiều cao 30px, đủ nội dung và nowrap; trạng thái cố định 96px, ngày cuối 88px, mép cuối bảng trùng mép vùng cuộn khi ít dòng. Cả bốn tổng tiền khớp tọa độ bảng sai lệch 0px, giữ đúng khi nhiều dòng/ẩn tiền; mobile không tràn ngang. Độ rộng linh hoạt tính thành px từ clientWidth thực (tránh colgroup bỏ qua calc hỗn hợp px/%). Version 22a3a8db-c3eb-4466-a3d4-2b9419a37c4f; index-BTo2DiWm.js, InventoryBooks-CcRgT_w8.js, production root/bundles 200 đúng bản dựng.


## Mở chi tiết từ mã vật tư tổng hợp — 28/10/2026

Mã vật tư chuyển thành nút mở native dialog Chi tiết nhập xuất vật tư trong kỳ. Bên trong dùng lại NxtBooks book=card, không tách phép tính hoặc thêm API. Khởi tạo vật tư/kho/trạng thái đúng dòng và kỳ tổng hợp; không mang tìm kiếm/mã-sắp-xếp/trang/loại phiếu sang. Có dòng phạm vi động; các bộ lọc trong cửa sổ độc lập. Giữ đầy đủ số dư đầu/cuối, lũy kế, Serial và mở phiếu gốc chỉ đọc, xuất/in qua luồng chi tiết đang có. Đóng không làm mất trang/lọc/cuộn tổng hợp và trả focus về mã vật tư; hủy tải đang chạy. Escape xử lý lớp con trước (menu/ngày/phiếu), nền bị inert bởi native dialog. ARCHITECTURE.md cập nhật thay quy tắc mã text không link cũ. Không sửa Worker, quyền truy cập hoặc dữ liệu.

Nghiệm thu cửa sổ chi tiết: 171 UI/shared tests đạt; bản cuối lint/build và 10 kiểm thử NXT đạt. Hai ca mới kiểm tra mang đúng phạm vi dòng, không mang q/direction/page tổng hợp, menu/phiếu con đóng riêng với Escape, quyền chỉ đọc, trả focus và hủy tải khi đóng. Browser 1366/390 xác nhận native dialog, 50 Serial, phiếu gốc, Excel đúng card/part/kho/trạng thái/kỳ, iframe in chuẩn bị đủ nội dung và được gọi trong cửa sổ. Thử trang 2 với scrollTop=100: đóng chi tiết giữ nguyên trang/cuộn, không tải lại summary. Ảnh artifacts/nxt-drilldown-* chỉ cục bộ. ARCHITECTURE.md cập nhật cùng thay đổi.

Triển khai version 2f3207fb-e5f6-4ca8-b460-8735669d3fe8; index-Czl3icjr.js, InventoryBooks-DcgWthCv.js, index-oAO1fzaG.css. Production root/bundle/CSS HTTP 200 đúng bản dựng và chứa cửa sổ mới; API chưa đăng nhập 401. Không thay Worker, quyền kho, schema hay chứng từ.
