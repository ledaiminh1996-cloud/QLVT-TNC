# Kiến trúc Webapp Quản lý vật tư Tân Nam Chinh

Chuẩn do người dùng thống nhất ngày 22/10/2026. Áp dụng khi phát triển các chức năng và sửa đổi tiếp theo. Các yêu cầu trực tiếp mới hơn của người dùng được ưu tiên.

## Quy chuẩn hiện hành — cập nhật 28/10/2026

Đọc mục này trước khi sửa giao diện hoặc nghiệp vụ. Yêu cầu trực tiếp mới hơn của người dùng được ưu tiên. Các mục ghi ngày cũ bên dưới và các biên bản triển khai là lịch sử; phần đã được thay thế không được dùng để khôi phục hành vi cũ. Nhật ký trong docs không thay thế việc cập nhật quy chuẩn tại đây.

### Thẻ số liệu dùng chung

Chuẩn đối chiếu là [ReceiptSummaryCards](src/documents/ReceiptSummaryCards.tsx), đang dùng cho cả phiếu nhập và phiếu xuất. Sổ kho và các thẻ số liệu tương ứng phải theo cùng kích thước; không tự tạo biến thể nhỏ hơn để tiết kiệm chiều cao.

| Thuộc tính | Giá trị đã chốt |
|---|---|
| Chiều cao mỗi thẻ | 72px, kể cả điện thoại |
| Bo góc | 12px (`rounded-xl`) |
| Khoảng đệm | Dọc 6px, ngang 10px (`py-1.5 px-2.5`) |
| Bố trí bên trong | Ba hàng 12px / 26px / 16px; khoảng cách hàng 2px; căn giữa theo chiều dọc |
| Nhãn | 10px, chiều cao dòng 12px, màu phụ |
| Số liệu thường | 16px, đậm; từ breakpoint xl: 18px; chiều cao dòng 24px |
| Giá trị chính | 18px, rất đậm; từ breakpoint xl: 20px; chiều cao dòng 24px; nền/viền/chữ xanh |
| Font số | Inter, `font-sans tabular-nums`; không dùng font mã định danh |
| Khoảng cách giữa thẻ | 8px |
| Hàng thứ ba | Dành cho chip trạng thái; không có chip vẫn giữ hàng trống để số thẳng hàng |
| Bố trí ngoài | Cùng hàng với nhóm nút thao tác trên máy tính; màn hẹp tự xuống hàng, không ép tràn ngang |

Số lượng thẻ, tỷ lệ độ rộng và nội dung phụ thuộc nghiệp vụ, không đổi phép tính chỉ để đồng bộ giao diện. Chỉ cộng số lượng cùng ĐVT; khác ĐVT hiển thị Nhiều ĐVT. Sổ kho dùng Tồn cuối kỳ làm thẻ nhấn mạnh. Không đặt nhãn và số cùng một hàng bên trong thẻ. Quy ước 72px đã có từ 26/10 tại [tài liệu chứng từ](docs/16-document-preparation.md); việc đưa vào mục này là đồng bộ tài liệu, không phải thiết kế mới.

### Phần đầu Sổ theo dõi kho

Theo [bố cục sổ kho đã chốt](docs/33-ledger-compact-header-20261028.md), triển khai tại [StockLedger](src/books/StockLedger.tsx):

- Hàng đầu: Tổng nhập, Tổng xuất, Tồn cuối kỳ, Số phát sinh; bên phải là Tải lại, Xuất Excel, In sổ. Không có thêm khối tiêu đề/phụ đề riêng; giữ breadcrumb.
- Hàng thẻ/thao tác và hàng bộ lọc phải dùng cùng một lưới 5 cột, cùng gap 8px để mép từng ô trên/dưới thẳng nhau. CSS dùng chung `--ledger-header-columns`: bốn cột đầu chia đều, cột cuối cùng tỷ lệ nhưng tối thiểu 240px đủ ba nút. Nhóm nút chiếm đủ cột thứ năm, không để mép lệch do tự co theo chữ. Giữ thẻ cao 72px; hẹp hơn 800px tự xuống hàng. Không tự đổi kích thước thẻ để căn lưới.
- Hàng lọc ngoài: Tìm kiếm, Kỳ, Kho, Vật tư, Bộ lọc khác. Loại phiếu và Trạng thái hàng nằm trong Bộ lọc khác; có chỉ báo số điều kiện đang dùng. Từ vùng nội dung rộng 800px giữ một hàng; hẹp hơn tự xuống hàng.
- Hàng tùy chọn: chú giải Theo phiếu / Chi tiết Serial, Đã ghi sổ, đổi chiều thời gian, Cột hiển thị. Mật độ và Giờ ghi sổ nằm trong Cột hiển thị.
- Chân bảng chỉ giữ trang, số dòng/trang và chuyển trang; không lặp số nhóm phát sinh.
- Một vùng cuộn bảng chiếm chiều cao còn lại, tiêu đề ghim và phân trang ở đáy. Dòng Gọn 44px, Thoải mái 56px. Dữ liệu trống dùng dấu `-`.
- Giữ nguyên [quy tắc nhóm và số dư](docs/30-grouped-stock-ledger-20261027.md): chỉ tính Tồn khi chọn một vật tư, mặc định tăng dần theo ngày chứng từ, mặc định tháng hiện tại, 50/100 nhóm mỗi trang, Serial tải khi mở. Không trở lại bố cục 14 cột cuộn ngang ở các ghi chép cũ.

### Giảm tải truy vấn Sổ theo dõi kho — 28/10/2026

Worker stockLedger.ts dùng CTE rows MATERIALIZED trong phạm vi một request/SQL, sau khi lọc kỳ, quyền kho và bộ lọc vật tư/trạng thái. Tìm kiếm dựng tập group_key phù hợp một lần, tách điều kiện phương tiện khỏi EXISTS Serial; không nhân điều kiện JSON/biển số theo số Serial. Tìm từ khóa và Loại phiếu tiếp tục lọc **sau** tính số dư, giữ đủ tổng lượng của nhóm; không áp dụng cách lọc riêng từng Serial của Sổ chi tiết NXT sang sổ này.

Một lượt tải bảng dùng 2 SQL báo cáo (trang + thống kê chung count/tổng theo ĐVT/tồn đầu cuối), thay 4 SQL trước đây. Giới hạn trang trước khi đọc metadata hiển thị. Không gửi SQL số dư rỗng khi chưa chọn vật tư. Mở nhóm Serial chỉ dựng nguồn của đúng group_key trong phạm vi được phép xem và kiểm tra phiên bản, dùng 2 SQL thay 3; xuất đầy đủ dùng thêm một SQL chi tiết, tổng 3 thay 5, giữ giới hạn 10.000 dòng. Kết quả nhóm không còn phù hợp hoặc đổi phiên bản vẫn trả LEDGER_CHANGED; trang chi tiết vượt cuối nhưng nhóm còn hợp lệ vẫn trả trang trống và tổng đúng.

Không cache dữ liệu qua các request/người dùng, không đổi bảng tồn hay snapshot lịch sử. Mỗi lần tải đọc mới; không thêm công việc nền hoặc chỉ mục/bảng tổng hợp mới trong thay đổi này. Bằng chứng đối chiếu trước/sau và số đo D1 lưu tại docs/39-stock-ledger-query-optimization-20261028.md.

### Sổ chi tiết NXT và Sổ tổng hợp NXT — cập nhật 28/10/2026

Theo [đặc tả hai sổ NXT](docs/35-nxt-book-layout-20261028.md), giao diện dùng [NxtBooks](src/books/NxtBooks.tsx) và API inventory-books hiện hành. Áp dụng cùng format Sổ theo dõi kho: bốn thẻ giá trị đầu kỳ/nhập/xuất/cuối kỳ cao 72px và nhóm nút Tải lại/Excel/In, hai hàng trên cùng lưới 5 cột gap 8px; bộ lọc Tìm kiếm/Kỳ/Kho/Vật tư/Bộ lọc khác; mật độ 44/56px và tùy chọn Giá trị (đ) trong Cột hiển thị; một vùng cuộn, header/footer ghim, không cuộn ngang. Mặc định tháng hiện tại, 50/100 dòng/trang; giá trị cuối kỳ nhấn xanh. Trống dùng dấu gạch, giá chưa xác định vẫn null và có thông báo.

- **Tổng hợp:** nhóm theo vật tư/kho/trạng thái; vỏ xe và ắc quy Serial vẫn cộng lượng, không đọc hoặc xuất danh sách Serial. Bảng hiện có **14 cột**: Kho (mã/tên), Trạng thái hàng, Vật tư (mã/tên; mã bấm mở chi tiết trong kỳ), ĐVT, **Tồn đầu, Dư đầu, SL nhập, Tiền nhập, SL xuất, Tiền xuất, Tồn cuối, Dư cuối**, Phát sinh đầu, Phát sinh cuối. Tồn đầu/cuối và SL nhập/xuất là số lượng; Dư đầu/cuối và Tiền nhập/xuất là tiền. Thay thế cách gộp lượng/tiền hai tầng và hai cột Nhập ĐC/Xuất ĐC trước đó; không hiển thị hai cột điều chuyển trên bảng, Excel hoặc in. Thứ tự và ánh xạ tám trường dùng chung tại src/books/nxtSummaryColumns.ts, đồng bộ bảng/tổng/Excel/in. Độ rộng màn hình hiện hành lấy từ nxtSummaryWidths(): Kho 88px, Trạng thái hàng 96px, ĐVT 36px, bốn cột lượng 60px/cột, Phát sinh đầu 84px, Phát sinh cuối 88px; phần dư chia cho Vật tư và bốn cột tiền theo tỷ lệ 1.5:1:1:1:1. Thay thế các tỷ lệ phần trăm cũ để trạng thái/ngày không phình rộng theo màn hình. Tất cả tiêu đề bảng tổng hợp ở một dòng, giữ đủ Kho Nghi Sơn, trạng thái dài có tooltip. Không chừa rãnh thanh cuộn khi chưa cần; khi có thanh cuộn thật thì chân tổng trừ đúng độ rộng rãnh qua ResizeObserver vùng cuộn. Bỏ chọn Giá trị (đ) thì ẩn bốn cột tiền, giữ bốn cột lượng và tự phân bổ lại chiều rộng.
- Điều chuyển vẫn nằm trong tổng Nhập/Xuất theo công thức máy chủ hiện hành; yêu cầu tách cột không thay cách tính. Các trường transfer trong API giữ tương thích nhưng không còn là cột báo cáo. Không trừ điều chuyển hoặc cộng lần nữa khi tính tồn. Ngày phát sinh đầu/cuối là min/max ngày chứng từ trong khoảng lọc (có tính DK đúng ngày đầu), không phải ngày tạo/ghi sổ; nhóm chỉ có số dư cũ hiển thị dấu gạch. Excel tách tám trường số đúng kiểu quantity/money và bản in tổng hợp 14 cột.
- **Riêng Tổng hợp (thay thế bộ lọc/căn lề chung phía trên):** năm ô ngoài gồm Tìm kiếm, Kỳ, Kho, Trạng thái hàng, nhóm Mã A→Z / Cột hiển thị. Bỏ picker Vật tư, Bộ lọc khác và nhãn Đã ghi sổ. Vẫn tìm mã/tên vật tư qua ô Tìm kiếm. Toàn bộ tiêu đề và dữ liệu bảng tổng hợp căn trái theo yêu cầu mới; sổ chi tiết/sổ kho giữ căn số cũ. Giá trị 0 hiện dấu – màu phụ, không kèm 0 đ; null vẫn khác 0, có tooltip và thông báo chưa xác định. Tiền 11px ở cột riêng, sáng hơn trong dark mode, không truncate/ellipsis; được ngắt giữa nhóm nghìn để giữ đủ chữ số. Bảng và chân tổng dùng cùng một danh sách độ rộng từ nxtSummaryWidths(), không chuẩn hóa lại sang phần trăm. Dòng tổng tiền ghim ngoài vùng cuộn, thẳng bốn cột Dư đầu/Tiền nhập/Tiền xuất/Dư cuối; ô cột lượng để trống, không cộng khác ĐVT. Tổng lấy toàn bộ bộ lọc từ Worker, không cộng riêng trang hiện tại. Ẩn Giá trị (đ) thì ẩn dòng tổng tiền. Excel giữ ô số 0 và null thật, không thay bằng chuỗi gạch.
- **Chi tiết:** tên hiện hành **Sổ chi tiết NXT**, bỏ hậu tố Thẻ kho trong menu/breadcrumb/màn hình/Excel/in. Chọn một vật tư để có tồn lũy kế; bảng 9 cột gồm Ngày CT, Số phiếu/loại, Kho, Trạng thái, Vật tư, Serial, Nhập, Xuất, Tồn. Có dòng đầu/cuối kỳ theo kho/trạng thái. Mỗi phát sinh giữ tổng lượng/tiền, mở dòng nhiều Serial để xem từng mã; khi số Serial khớp lượng, hiển thị nhập/xuất 1 đơn vị cho từng mã. Bấm mã Serial lọc lịch sử trong kỳ; không tự phân bổ tiền từng Serial khi thiếu căn cứ lịch sử.
- **Tra cứu Serial chính xác (thay quy tắc Serial chỉ lọc dòng cũ):** khi từ khóa khớp toàn bộ Serial đã ghi sổ của vật tư/kho/trạng thái được phép xem đến cuối kỳ, máy chủ trả serial_filter và lọc Serial **trước** khi tính tổng/số dư. Dòng nhập gộp 50 Serial chỉ còn nhập 1 cho mã đang tra cứu; xuất 1 thì tồn 0. Tồn đầu kỳ, tồn lũy kế, tồn cuối kỳ, các thẻ tiền, phân trang, Excel và in dùng cùng phạm vi Serial; không giữ số tổng cả lô hoặc cả vật tư. Bấm Serial trong dòng con cũng dùng cách này. Chuẩn hóa theo serialKey; không khớp tiền tố sang Serial dài hơn. Nhãn cạnh bảng nêu rõ đang tính riêng Serial. Tìm số phiếu, mã/tên vật tư, một phần Serial và Loại phiếu vẫn lọc các phát sinh hiển thị **sau** khi tính số dư trong phạm vi hiện hành. Đổi chiều chỉ đổi hiển thị, không đổi thứ tự tính tồn.
- Tiền từng Serial dùng snapshot amount_vnd issue_serial_costs/recovery_serial_costs đã lưu; dòng đúng một đơn vị dùng số tiền đã ghi sổ, nhập/đầu kỳ đồng giá có danh sách Serial khớp lượng thì quy đổi một đơn vị và làm tròn đồng bằng số nguyên. Không đọc cost hiện tại từ inventory_serials hoặc DMVT để thay giá lịch sử; thiếu căn cứ tách giá thì giữ null và báo chưa xác định, số lượng vẫn tính. Không sửa chứng từ/movements để sửa báo cáo. Serial B65006700 đã đối chiếu nguồn thực: nhập 1 / xuất 1 / tồn 0, tiền nhập/xuất 3.703.704 đ, tồn tiền 0. Quy tắc này không đổi Sổ tổng hợp NXT hay cách nhóm Sổ theo dõi kho. Tổng hợp tìm mã/tên vật tư. Ở sổ chi tiết, Trạng thái và Loại phiếu nằm trong Bộ lọc khác. Tổng hợp dùng bộ lọc ngoài theo quy tắc riêng dưới đây.
- Excel/in chi tiết có từng dòng Serial bên dưới phát sinh; các dòng con không ghi lặp số lượng/tiền vào cột số để tránh cộng trùng. Tổng hợp không lấy Serial. Mã vật tư tổng hợp bấm mở cửa sổ **Chi tiết nhập xuất vật tư trong kỳ**, thay quy tắc không link cũ. Cửa sổ dùng lại NxtBooks book=card và cùng API Sổ chi tiết NXT, tự khởi tạo đúng part_id/warehouse_id/stock_state của dòng được chọn và from/to của tổng hợp; direction=asc, page=1, page_size=50. Không mang q, sắp xếp mã, phân trang hoặc kind của tổng hợp sang che mất phát sinh. Giữ tồn đầu/cuối, tồn lũy kế, Serial, Excel/in, mở phiếu chỉ đọc như màn sổ chi tiết. Các bộ lọc trong cửa sổ được điều chỉnh độc lập; dòng phạm vi cập nhật theo bộ lọc hiện tại. Đóng cửa sổ giữ nguyên bộ lọc, trang, vị trí cuộn tổng hợp và trả focus về mã đã bấm; hủy các yêu cầu còn chạy. Native dialog giữ focus/inert nền, Escape đóng menu/phiếu con trước, không đóng luôn cửa sổ cha. Không tạo truy vấn/cách tính báo cáo thứ hai hoặc nới quyền kho. Số phiếu mở bản gốc chỉ đọc. Không hiển thị dữ liệu tổng hợp cũ trong lúc chuyển sang chi tiết.
- Giữ quy tắc tài chính NXT cũ: tồn đầu gồm OPENING đúng ngày bắt đầu, không cộng vật tư đang sử dụng đầu kỳ vào kho. Không thay giá vốn, snapshot, quyền kho, công thức lượng/tiền hoặc sửa lịch sử. Nguồn đầu kỳ đang sử dụng không phát sinh stock_movements. Không dùng bảng lượng tháng để thay cho giá trị đầu kỳ tài chính.

### Phương tiện lắp thiết bị trên phiếu xuất — 28/10/2026

Theo [đặc tả thiết bị nhận phiếu xuất](docs/36-issue-installation-target-20261028.md): đầu phiếu có ô **Phương tiện lắp thiết bị**, tương ứng ô Phương tiện tháo thiết bị bên thu hồi; chọn một xe/rơ moóc/máy phát/container trong bộ ghép của đầu phiếu, áp dụng cho toàn bộ dòng. Nếu lắp lên thiết bị khác thì lập phiếu riêng. UI yêu cầu chọn rõ; đổi tài xế/xe hoặc sửa mã thiết bị đang chọn sẽ xóa lựa chọn và đồng hồ cũ, không tự chọn mặc định đầu kéo.

- Lưu installation_target, installation_odo, installation_hours trong issue_details. Worker đọc lại danh mục và ghép nối đang có để giải ra target_type/target_id, không tin ID hay đồng hồ dòng từ client. Ghi xuống từng dòng và stock_usages theo luồng sẵn có; labels chụp mã/loại cho sổ và nguồn thu hồi. Vị trí lắp có nhóm Đầu kéo/Rơ moóc phải phù hợp lựa chọn.
- ODO đầu kéo chỉ dùng cho lựa chọn Xe; rơ moóc lấy ODO lúc lắp riêng, máy phát lấy giờ máy. Thiếu đồng hồ phụ thì để trống, không sao chép ODO đầu kéo. Số đo theo định dạng Việt ở UI, chuỗi số chuẩn trong API, 0 hợp lệ. In/Excel có phương tiện lắp và đồng hồ liên quan.
- Tương thích phiếu cũ: thiếu lựa chọn chỉ tự điền thiết bị khi bộ phiếu có duy nhất xe và dòng chưa có target; nhiều thiết bị mà thiếu target khi ghi sổ thì chặn. Dòng cũ đã có target giữ nguyên, không cập nhật lại khi xem báo cáo. Khi mở phiếu cũ thiếu thông tin, không suy luận lại từ bộ ghép hiện tại. Phiếu đã ghi sổ không được sửa trực tiếp qua luồng phiếu nhập; sửa thiết bị lịch sử phải có phạm vi xác nhận và audit riêng.

### Điều chỉnh thiết bị lịch sử đã được xác nhận — 28/10/2026

Phiếu 10.26.00001/PX đã được người dùng xác nhận cả 12 vỏ lắp rơ moóc 51R-047.31. Đã sửa đúng target/snapshot của 12 dòng và 12 stock_usages, giữ ID nguồn, tăng phiên bản phiếu và nguồn để tránh dùng dữ liệu cũ. Bỏ ODO 1046457 bị tự lấy từ đầu kéo khỏi dòng/rơ moóc; ODO đầu kéo trong đầu phiếu vẫn giữ, không tự gán ODO rơ moóc hiện tại cho ngày lắp cũ.

Thao tác bảo trì phạm vi cố định ở scripts/maintenance/correct-issue-20261028.mjs, mặc định dry-run; đã có sao lưu trước, kiểm thử replay/phụ thuộc/thay đổi tài chính bị chặn và rollback, 29 lệnh trong một D1 batch. Dùng khóa metadata hiện có với kiểm tra riêng kỳ khóa, phiên bản, vòng đời và toàn bộ số liệu trước/sau; không xóa/sửa trigger, không nới chức năng sửa phiếu trên API. Không ghi lại movements hoặc đổi số lượng/Serial/tiền/tồn; có document_draft_events và audit_events chứa trước/sau và lý do xác nhận. Tái chạy bản này sau khi đã sửa bị chặn bởi phiên bản. Chi tiết kết quả tại docs/36-issue-installation-target-20261028.md.

### Màn hình danh sách Phiếu thu hồi VT-TB — 28/10/2026

Theo [đặc tả danh sách thu hồi](docs/34-recovery-list-20261028.md), giao diện tại [RecoveryListView](src/documents/RecoveryListView.tsx), dữ liệu tại [recoveryList](worker/src/recoveryList.ts):

- Dùng cùng lưới 5 cột với sổ kho: bốn thẻ 72px (Số phiếu, Tổng SL thu hồi, Giá trị thu hồi (đ), Theo phân loại), cột thứ năm là Tải lại/Lập phiếu. Cùng gap 8px, padding/font/bo góc theo chuẩn thẻ bên trên. Giá trị thu hồi nhấn xanh. Thẻ số phiếu có chip Đã thu hồi, bấm lọc posted.
- Hàng ngoài: Tìm kiếm, Kỳ, Kho nhận, Vật tư, Bộ lọc khác. Trong Bộ lọc khác có Phân loại, Phương tiện (biển số/mã thiết bị), Trạng thái, Người tiếp nhận; giữ chức năng rà soát phiếu cần bổ sung giá bên trong menu.
- Bảng mặc định 11 cột: Số phiếu (liên kết xem), Ngày CT (chỉ ngày), Phương tiện (ba dòng có nhãn Xe / Rơ moóc / MP), Lý do tháo (hai dòng + tooltip), Bàn giao → Tiếp nhận (hai tầng), Kho nhận, Tổng SL, Phân loại, Giá trị (đ), Trạng thái, Thao tác. Hai nút Xem/In; lịch sử, dữ liệu JSON, sửa/xử lý nháp trong menu … . Không tự bật sửa/hủy phiếu đã ghi sổ nếu máy chủ chưa hỗ trợ.
- Bộ lọc Phân loại dùng bốn ô tick CSD/CSC/KSD/CTL, chọn được nhiều loại đồng thời; chip trên thẻ cũng bật/tắt từng loại mà giữ các loại khác. Lọc theo OR (phiếu có ít nhất một dòng thuộc một trong các loại đã chọn); không chọn loại nào là tất cả. Giá trị API `recovery_classification` giữ tương thích một mã hoặc danh sách mã cách bằng dấu phẩy; Worker kiểm tra đủ bộ mã. Phân loại của từng dòng vật tư vẫn là một loại, không đổi cách ghi sổ.
- Thống kê phân loại là **số dòng vật tư**, không phải số Serial hoặc số lượng. CSD/CSC/KSD/CTL đều hiện trên thẻ, bấm lọc/bỏ lọc; mỗi phiếu có thể hiện nhiều chip. Tổng SL cộng riêng theo số lượng, không cộng khác ĐVT. Vật tư + phân loại phải khớp cùng một dòng khi dùng cả hai bộ lọc.
- Lọc chọn **phiếu có dòng phù hợp**; bảng và thẻ vẫn tính đầy đủ nội dung của các phiếu phù hợp, không cắt mất các dòng phân loại khác trong phiếu. Tổng do máy chủ tính trên toàn bộ bộ lọc; cache theo bộ lọc/người dùng, chuyển trang/sắp xếp dùng include_totals=0 để không tính tổng lại. Mặc định tháng hiện tại, 20/50/100 phiếu mỗi trang. Giá chưa biết vẫn null, không đổi thành 0.
- Tìm số phiếu, Serial, xe/rơ moóc/máy phát/container, lý do, người bàn giao/tiếp nhận. Đọc snapshot đã lưu, không lấy bộ ghép hiện tại gán cho phiếu cũ. Thông tin recovery_details mới được bổ sung vào search_text; phiếu cũ tìm trực tiếp snapshot, hỗ trợ dấu/không dấu và hoa/thường tiếng Việt bằng mẫu GLOB có escape, không cập nhật lại chứng từ.
- Giữ quyền xem chứng từ hiện hành (thủ kho: phiếu mình lập hoặc được duyệt; kế toán/quản trị/chỉ xem theo vai trò đang có). Không đổi quy tắc ghi sổ, thu hồi nguồn hay số tồn. Bảng desktop fixed vừa khung, dưới 1000px vùng nội dung chuyển thẻ; không cuộn ngang, tiêu đề/phân trang giữ trong khung màn hình.

### Thu hồi từ vật tư đang sử dụng đầu kỳ và nhập nhanh

Theo [luồng giá đầu kỳ sang thu hồi](docs/31-recovery-opening-value-20261028.md) và [nhập nhanh thu hồi](docs/32-recovery-quick-import-20261028.md):

- Tên hiện hành là Phiếu thu hồi VT-TB, đồng bộ form/menu/breadcrumb. Bỏ chú thích dài và Diễn giải / ghi chú cuối form thu hồi; giữ ghi chú dòng. Kho nhận ở bảng dòng căn giữa cùng chiều cao ô nhập.
- Khi chọn nguồn đầu kỳ, mang nguyên giá, tỷ lệ còn lại và người xác nhận đã lưu sang thu hồi; cho sửa đánh giá lúc tháo. Giá trị tính theo lượng thực thu hồi. Máy chủ đọc lại nguồn, không lấy giá danh mục hiện tại để thay snapshot và không tin tổng tiền phía giao diện. Đánh giá 0% là hợp lệ. Không tự ghi lại các phiếu đã ghi sổ.
- Nhập nhanh phải liên kết `usage_id` từ nguồn còn đang sử dụng được cấp quyền, bao gồm nguồn xuất và đầu kỳ. Serial được đối chiếu chính xác; khác nguồn tự tách dòng. Không chọn đại khi có nhiều lần xuất/lắp: yêu cầu số phiếu nguồn/phương tiện hoặc chọn trực tiếp.
- Xem trước hiển thị nguồn; kiểm tra trùng Serial và tổng lượng cả các dòng đã có. Worker tiếp tục kiểm tra lại nguồn, quyền, ngày, đồng hồ và lượng còn lại khi lưu.

### Cách sử dụng và cập nhật quy chuẩn

Trước khi sửa phần tương tự, đọc mục hiện hành này và thành phần chuẩn được dẫn ở đây; đối chiếu kích thước, font, khoảng đệm và bố cục trước khi viết giao diện riêng. Nếu thiếu thông số, kiểm tra thành phần hiện hành và tài liệu liên quan trước khi tự quyết. Khi người dùng chốt quy tắc áp dụng lâu dài, cập nhật ARCHITECTURE.md trong cùng thay đổi; tài liệu docs ghi bằng chứng/kiểm thử/triển khai. Nếu quy tắc thay thế bản cũ, ghi rõ phạm vi được thay thế. Không ghi vào tài liệu rằng đã dùng chung component khi mã còn là hai phần triển khai riêng.

Hiện thẻ phiếu nhập/xuất dùng chung ReceiptSummaryCards; thẻ sổ kho vẫn triển khai riêng nhưng đã đối chiếu đúng thông số. Đây là điểm cần đối chiếu khi thay đổi sau này, không được mặc nhiên cho rằng sửa một nơi sẽ đổi cả ba màn hình.

## 1. Công nghệ và trạng thái chuyển đổi

| Thành phần | Chuẩn thống nhất | Mã nguồn hiện tại / việc còn cần làm |
|---|---|---|
| Ứng dụng | Single Page Application (SPA) | React/Vite, API cùng hostname ở /api |
| Frontend | React 19, TypeScript nghiêm ngặt | package.json khai báo React/react-dom ^19.0.1 và types 19; thống nhất tiếp tục dùng React 19 |
| Kiểu dữ liệu | TypeScript strict, DTO/domain types rõ ràng | Worker và frontend tsconfig.json đang bật strict:true. Không suy ra mọi tài liệu hoặc mã cũ đã được chuẩn hóa chỉ từ cấu hình |
| Build | Vite, ESM | Đang sử dụng |
| Giao diện | Tailwind CSS v4, Light/Dark Enterprise Theme | Đang sử dụng; giao diện sáng/tối, tinh gọn, responsive |
| Icon | Lucide React SVG | Đang sử dụng; dùng chung MenuIcon/CatalogIcon ở menu, tiêu đề, biểu mẫu |
| Backend | Cloudflare Workers | Xác thực, phân quyền, kiểm tra nghiệp vụ, ghi audit và API |
| Database | Cloudflare D1 | Nguồn dữ liệu tập trung; thay đổi schema bằng migration |

React 19 là phiên bản thống nhất cho dự án. Frontend hiện bật TypeScript strict:true trong tsconfig.json; các mô tả chưa bật strict ở biên bản cũ là lịch sử. Không tự đổi major version hoặc cấu hình strict ngoài yêu cầu.

## 2. Cấu trúc thành phần

- Sidebar.tsx: menu nhiều cấp, thu gọn/mở rộng, dùng trên di động, tối đa hai mục yêu thích.
- Header.tsx: breadcrumb/tag nhận diện trang và các thao tác nhanh.
- CloudCatalogApp.tsx: shell dữ liệu tập trung, kiểm tra phiên, điều phối danh mục. Các màn hình mới cần tách thành module theo nghiệp vụ, hạn chế tiếp tục dồn logic vào shell này.
- Danh mục: nhân sự (tab Nhân viên với cây Đơn vị → Phòng ban → Nhân viên; tab Tài xế riêng), kho/bồn (một kho nhiều bồn), NCC, VT-TB, phương tiện, mã đối tượng và mã nhóm.
- Màn hình nghiệp vụ: StockBalanceTable, CatalogListView, FleetMountedManager, FuelManagementView, MaintenanceReport, TransactionHistoryView. Các component hiện có là nền tảng giao diện; phải kiểm tra nguồn dữ liệu thực tế trước khi tái sử dụng cho API.
- Modals: lập phiếu nhập/xuất, xem/in phiếu theo mẫu kế toán được yêu cầu, thẻ kho chi tiết, khóa sổ kỳ, nhập dữ liệu CSV/JSON trong phạm vi được bật.
- Thành phần chung: MenuIcon.tsx (icon), StatusBadge.tsx (trạng thái), quy tắc cột thao tác dùng chung. Tránh tạo biến thể riêng gây lệch giữa các màn hình.

Tất cả giao diện mới dùng Function Components và Hooks. Tách form, bảng, cây điều hướng và logic gọi API khi module lớn lên. Props phải có kiểu rõ ràng; hạn chế phụ thuộc vòng giữa các module.

## 3. Dữ liệu và an toàn nghiệp vụ

- Định nghĩa domain types và DTO cho SparePart, Vehicle, InventoryTransaction, TransactionItem cùng các danh mục liên quan. Không trộn DTO database dùng số nguyên theo thang đo với model giao diện dùng đơn vị hiển thị.
- Dùng unknown ở dữ liệu ngoài, kiểm tra cấu trúc trước khi sử dụng. Không dùng any hoặc ép kiểu để bỏ qua lỗi nghiệp vụ trong mã mới.
- Mã cũ còn kiểu rộng/generic cần được thu hẹp khi sửa module liên quan; bảo toàn dữ liệu trong quá trình chuyển đổi.
- Tiền và số lượng trong D1 theo thang đo đã định nghĩa. Chuyển đổi ở ranh giới API/UI; kiểm tra số hữu hạn, số nguyên an toàn, giới hạn và độ chính xác.
- Giao diện có thể kiểm tra sớm và hiển thị tính toán xem trước. Worker phải kiểm tra lại quyền, liên kết, phiên bản, số lượng, tiền và điều kiện khóa sổ.
- Cấp mã, kiểm tra trùng, ghi dữ liệu và audit cần giao dịch nguyên tử cùng ràng buộc database khi phù hợp. Không dựa vào kiểm tra trên trình duyệt để chống thao tác đồng thời.
- Giữ version chống ghi đè dữ liệu và các quy tắc không xóa danh mục đã có phát sinh. Bảo toàn khóa ngoại và lịch sử.
- LocalStorage chỉ phù hợp cho tùy chọn giao diện hoặc chế độ dữ liệu cũ được mở rõ ràng. Không tự lấy dữ liệu cũ thay thế khi API lỗi và không coi dữ liệu local là sổ kho máy chủ.

## 4. Hooks và hiệu năng

- useState cho trạng thái giao diện; useEffect cho đồng bộ với API và tác vụ có vòng đời, có hủy request khi chuyển trang hoặc unmount.
- useMemo cho phép tính thuần tốn chi phí như NXT, tổng tiền, cảnh báo và bộ lọc theo dữ liệu/điều kiện. Dependencies đầy đủ; không gây side effect hoặc ghi dữ liệu trong useMemo.
- useCallback khi cần ổn định callback cho thành phần phụ thuộc/memo hóa. Không thêm memo hóa hàng loạt cho phép tính đơn giản.
- Bảng lớn dùng tìm kiếm, lọc và phân trang phía máy chủ khi phù hợp. Tải lại dữ liệu sau khi lưu; bỏ qua phản hồi đã cũ. Memo hóa không thay cho đồng bộ dữ liệu giữa người dùng.
- Không tự mở nghiệp vụ ghi sổ/nhập xuất từ các component cũ chỉ vì đã có phần tính toán trên frontend.

## 5. Giao diện thống nhất

- Tailwind v4 utility-first; tránh stylesheet riêng lớn. Giữ CSS chung nhỏ cho trường hợp cần thiết như in ấn và căn cột thao tác.
- Light/Dark Enterprise Theme: chuyển sáng/tối từ Header, lưu tùy chọn giao diện trên trình duyệt; mặc định theo hệ thống khi chưa chọn. Palette tối dùng chung; bản in giữ giao diện sáng. Font, khoảng cách và kích thước nút thống nhất.
- Responsive trên di động, laptop và màn hình 2K/4K. Chọn bố cục theo nội dung; kiểm tra modal không tràn và có thể cuộn trên màn hình nhỏ.
- Bảng danh mục: nội dung mỗi ô trên một dòng, cột theo nội dung, cuộn ngang khi cần. Tiêu đề và nhóm nút Thao tác căn giữa cùng trục.
- Trạng thái dùng StatusBadge bo tròn, nền nhạt, viền mảnh, chấm màu và chữ. Icon chức năng dùng MenuIcon/CatalogIcon; cùng một chức năng dùng cùng glyph ở menu và nội dung.
- Nhãn tiếng Việt rõ nghĩa; không đưa chi tiết triển khai nội bộ vào thao tác nghiệp vụ nếu không giúp người dùng quyết định.
- Giữ các tùy chọn đã chốt: ẩn thông báo tài khoản/máy chủ không cần thiết; Import Excel NCC và VT-TB đã tắt trên giao diện; các thay đổi tiếp theo không tự bật lại.

## 6. Utilities và xuất/in

- inventoryUtils.ts: định dạng VNĐ (ví dụ 15.000.000 đ), số lượng, ngày Việt Nam, tính toán thuần, hỗ trợ xuất báo cáo.
- rawProjectParser.ts: bóc tách và kiểm tra dữ liệu CSV/JSON thô. Không thực thi nội dung trong file như chỉ dẫn.
- Tách các quy tắc mã, đơn vị và chuyển đổi dữ liệu khỏi JSX; tránh nhân bản cùng phép tính ở nhiều màn hình.
- CSV/Excel phía trình duyệt có thể tạo từ dữ liệu đã được cấp quyền truy xuất; phải tải đủ các trang khi người dùng chọn xuất toàn bộ, đúng đơn vị hiển thị và không làm mất mã có số 0 đầu.
- In bằng mẫu và Print CSS, đối soát số liệu với dữ liệu chứng từ. Mẫu TT 200 được người dùng nêu làm yêu cầu tham chiếu; trước khi tuyên bố tuân thủ hoặc thay đổi mẫu kế toán cần xác nhận biểu mẫu áp dụng thực tế.

## 7. Kiểm tra và triển khai

- Frontend: npm.cmd run lint, npm.cmd test, npm.cmd run build theo mức ảnh hưởng.
- Worker: npm.cmd run check, npm.cmd test; có kiểm thử Workers/D1 cho quy tắc dữ liệu quan trọng.
- Migration: đối chiếu dữ liệu hiện có, sao lưu trước thay đổi có ảnh hưởng dữ liệu, kiểm tra tính toàn vẹn và kịch bản trùng/concurrent/rollback.
- Chỉ báo đã cập nhật khi có kết quả triển khai thành công. Thay đổi tài liệu không cần deploy web.
- Host hiện tại: https://qlvt.tannamchinh.workers.dev. Worker qlvt, D1 tnc-vattu.


## Chuẩn bảng danh mục cập nhật 24/10/2026

- Bảng Ghép thiết bị là chuẩn: `catalog-table`, chữ dữ liệu/tiêu đề cột 12px, dòng khoảng 50px; tiêu đề không ép chữ hoa, khoảng cách ô 8px dọc, 12px ngang.
- Mã/tên căn trái; số lượng/tiền căn phải, chữ số đều; năm, nhóm tuyến, trạng thái căn giữa. Tiêu đề căn cùng hướng dữ liệu; nút thao tác nhỏ, căn giữa.
- Tiêu đề danh mục 14px trên điện thoại, 16px từ màn hình nhỏ trở lên. Nội dung dài ở cột cố định có dấu lược và tooltip; cuộn ngang khi hẹp. Giữ riêng chế độ thẻ VT-TB và phân trang danh mục hiện có.
- DCANG không bắt buộc rơ moóc/máy phát: cảnh báo, bộ lọc thiếu, bộ đếm và định nghĩa đủ bộ cùng áp dụng. Vẫn kiểm tra thiếu/trùng tài xế, thiết bị đã ghép bị lỗi và đầu kéo ngừng hoạt động.


## Font toàn hệ thống (24/10/2026)

Áp dụng [quy chuẩn font và số liệu](docs/15-typography-standard.md). Inter Variable được nhúng cho giao diện/số liệu; JetBrains Mono Variable chỉ cho mã định danh (11px). Khai báo tập trung trong Tailwind v4 @theme. Số liệu dùng font-sans tabular-nums, cột số căn phải; lời giải thích dùng sans-serif. Giữ artwork logo và giữ nguyên kiểu dữ liệu chuỗi của mã. Hồ sơ phân loại 152 vị trí cũ lưu trong docs/font-audit-20261024.json.


## Lịch sử: chứng từ chuẩn bị cục bộ (24/10/2026)

Ghi chép dưới đây mô tả giai đoạn đầu, không phải trạng thái bật chức năng hiện nay; các phiếu xuất/thu hồi/đầu kỳ và ba sổ kho đã được triển khai ở các cập nhật sau. Xem [docs/16-document-preparation.md](docs/16-document-preparation.md). Phân hệ mới tách shared/documents.ts, src/documents và worker/src/documents.ts; migration 0020 và 0021 đã áp dụng cloud ngày 25/10/2026. Phiếu nhập đã có luồng Lưu cập nhật tồn và sổ serial nguyên tử từ 25/10/2026 (migration 0023). PĐX giữ phê duyệt; các loại chứng từ khác và NXT chưa bật ghi sổ. Không nối lại các màn localStorage cũ làm fallback. Chế độ xem thử chỉ ở Vite DEV, dữ liệu mẫu trong bộ nhớ, không đóng gói vào production. Đã triển khai cloud theo yêu cầu ngày 25/10/2026; xem [biên bản triển khai](docs/17-deployment-documents-20261025.md). Chỉ PN đã bật ghi sổ nhập kho; các phân hệ ghi sổ khác chưa bật.


## Xác thực hiện hành — 27/10/2026
Đăng nhập native email/mật khẩu tại trang Tân Nam Chinh, AUTH_MODE=native. Cloudflare Access đã Bypass và không còn là cơ chế xác thực người dùng ứng dụng. Worker bảo vệ mọi API dữ liệu bằng cookie HttpOnly/Secure và D1 sessions; không chấp nhận header/JWT Access thay phiên native. Bảo toàn ID người dùng/vai trò/quyền kho và lịch sử. Mật khẩu tạm phải đổi trước khi dùng; đổi/đặt lại mật khẩu và khóa tài khoản thu hồi phiên. Chi tiết triển khai, KDF/pepper, giới hạn nền tảng và kiểm tra nghiệm thu tại docs/20-native-login-20261027.md. Không bật lại Access redirect hoặc đổi AUTH_MODE nếu không có yêu cầu trực tiếp mới của người dùng.

## Vật tư đang sử dụng đầu kỳ — yêu cầu mới nhất 27/10/2026
Theo docs/22-opening-fleet-header-20261027.md: bỏ Đơn vị quản lý ở phiếu và danh mục phương tiện; không kiểm tra quyền đơn vị cho đầu kỳ. Đầu phiếu lấy tài xế/xe/rơ moóc/máy phát từ ghép nối hiện tại, snapshot được máy chủ xác thực và giữ trong bản in. Bảng vật tư gọn, nguyên giá định dạng tiền có thể sửa. Đầu kỳ không gắn kho, không thay đổi tồn, giữ ba tổng cộng. Thủ kho thao tác nguồn đầu kỳ do mình lập; nguồn kho cũ vẫn theo quyền kho. Kho nhận thu hồi luôn được kiểm tra riêng. Dữ liệu đơn vị và schema 0034 giữ lại vì lịch sử, không hiển thị hoặc bắt buộc khai báo.

Định giá đầu kỳ mới nhất theo docs/23-opening-price-policy-20261027.md: Nguyên giá (DMVT hoặc nhập tay), Tỷ lệ còn lại và Người xác nhận là bộ dữ liệu xác định giá trị quản trị. Không cảnh báo thiếu giá gốc lịch sử và không phụ thuộc unit_price cũ. Nguồn mới lưu giá trị còn lại theo bộ này; đọc phiếu cũ bỏ cảnh báo lỗi thời nhưng không sửa lịch sử sổ kho. Thiếu người xác nhận chưa ghi sổ được phương pháp mới; 0% hợp lệ. Cảnh báo thiếu định giá ở luồng thu hồi/xuất thực tế giữ nguyên.

Danh sách đầu kỳ đang sử dụng theo docs/24-opening-usage-list-20261027.md dùng bảng riêng gồm tài xế/bộ xe, nội dung, số lượng, tổng nguyên giá và giá trị còn lại. Dữ liệu snapshot và phương tiện đang gắn đã lưu; không lấy bộ ghép hiện tại để gán cho phiếu cũ. Ngày đầu kỳ có giờ đầy đủ; cột và số ô thống nhất, cuộn trong bảng và giữ thao tác bên phải.


## Sửa đầu kỳ và bố cục mới — 27/10/2026
Theo docs/25-opening-edits-and-header-20261027.md: danh sách bỏ Tổng SL; Xem/In là nút chính, chức năng khác trong menu … . Đầu phiếu chia đều hàng 1 ba ô và hàng 2 sáu ô (tài xế, đầu kéo, ODO đầu kéo, rơ moóc, ODO rơ moóc, máy phát). Hai ODO là snapshot đầu kỳ có thể sửa, không phải ODO lắp gốc. Cho sửa phiếu đã ghi sổ chưa có phụ thuộc và kỳ chưa khóa, bắt buộc lý do; Worker/D1 kiểm tra nguyên tử, giữ ID nguồn của dòng còn lại, tăng phiên bản sử dụng để chặn thu hồi đọc dữ liệu cũ. Migration 0035 bảo vệ cạnh tranh bằng trigger; không phát sinh tồn kho đầu kỳ đang sử dụng.


## Tồn kho đầu kỳ — cập nhật 27/10/2026
Theo docs/26-opening-stock-form-20261027.md: tên Phiếu Tồn kho đầu kỳ; phiếu kho mới /DK, đang sử dụng đầu kỳ vẫn /SD, mã cũ giữ nguyên. Cấp số dự kiến/chính thức dùng cùng documentSymbol và phân biệt opening_mode; dãy số riêng, cấp chính thức nguyên tử như trước. Form kho có bốn ô đều nhau trên hàng đầu, bỏ VAT và ghi chú chung, Serial text một dòng, Ghi chú sát Thao tác. Nhập nhanh và bản in đồng bộ không VAT. Không thay nghiệp vụ giá vốn hoặc phiếu nhập mua hàng.


## Ba sổ kho máy chủ — 27/10/2026
Theo docs/27-inventory-books-20261027.md: Sổ theo dõi kho, Thẻ kho và Tổng hợp NXT dùng /api/inventory-books, lấy stock_movements đã posted; không dùng màn localStorage cũ. Số dư theo kho/vật tư/trạng thái; thẻ kho chạy số dư trước phân trang. OPENING đúng ngày đầu kỳ vào số dư đầu, đang sử dụng đầu kỳ không cộng tồn. Thủ kho bị lọc document_warehouse_access ở mọi truy vấn/tổng/xuất. Giá chưa xác định là null và có cảnh báo, không tự thành 0. Xuất/in lấy trọn bộ một lần tối đa 10.000 dòng; vượt giới hạn yêu cầu lọc hẹp hơn. Chỉ đọc, không có migration hoặc ghi lại lịch sử.


## Sổ theo dõi kho dạng phát sinh — 27/10/2026
Yêu cầu mới nhất tại docs/28-stock-tracking-movements-20261027.md thay riêng book=stock thành danh sách phát sinh 14 cột, gồm cả OPENING trong khoảng xem, mới nhất trước. Không còn bảng tồn theo nhóm hoặc thẻ tổng tiền ở màn này; card/summary giữ nguyên cách tính. Thiết bị và ODO/Giờ lấy snapshot từng dòng/nguồn thu hồi, không lấy ghép nối/ODO hiện tại. Phiếu mới lưu thêm loại thiết bị trong labels; không sửa lịch sử cũ. Xuất/in đồng bộ 14 cột.


## Chỉnh cảnh báo UI sổ kho — 27/10/2026
Theo docs/29-book-ui-audit-20261027.md: khung bảng có đệm, ô bảng 12/16px; chú thích ngắn. Ô thiếu dữ liệu ghi Chưa ghi nhận, giá chưa biết Chưa xác định, không dùng gạch dài lặp lại và không biến giá chưa biết thành 0. Sidebar giữ artwork logo, tăng kích thước logo và tương phản chữ/icon của mục đang chọn. Không thay số liệu hoặc quyền.


## Thu gọn Sổ theo dõi kho — 27/10/2026
Mã vật tư trong book=stock là text định danh, không có liên kết/thao tác; chỉ book=summary giữ liên kết sang thẻ kho. Số phiếu vẫn mở phiếu gốc. Ô trống thống nhất font Inter/màu slate-500 cho mọi loại cột, gồm Biển số, Loại thiết bị và ODO/Giờ. Tổng độ rộng 14 cột tracking 1.620px (trước 1.970px), đệm ngang 12px, dọc 12px; giữ khung đệm và cuộn ngang. Không đổi API, dữ liệu hay cột hai sổ còn lại. Kiểm tra TypeScript, 6 bài kiểm thử sổ và trình duyệt sáng/tối/điện thoại đạt.
Triển khai thành công phiên bản 90a10d78-4203-4215-a845-9e5e1596fb73, trang chính HTTP 200 đúng gói index-DO2gg6-Z.js.


## Sổ kho nhóm và số dư — 27/10/2026
Yêu cầu mới nhất theo docs/30-grouped-stock-ledger-20261027.md: StockLedger thay giao diện book=stock, nhóm theo chứng từ/kho/vật tư/trạng thái/chiều, Serial tải khi mở. API /api/stock-ledger phân trang 50/100 cha, lọc Kỳ/tìm kiếm/loại phiếu. Chỉ chọn part_id mới tính Tồn; window trước phân trang theo kho/trạng thái. Search/loại chỉ lọc dòng hiển thị, không làm đổi số dư. Migration 0036 thêm bảng tổng hợp lượng tháng và trigger đồng bộ cùng transaction để không quét lịch sử từng phát sinh cho đầu kỳ. Một vùng cuộn dọc, không cuộn ngang; thẻ trên màn nhỏ, 44/56px, header/footer ghim. Excel tách cha và Serial để không cộng trùng. Quyền kho và hai sổ NXT khác giữ nguyên.
