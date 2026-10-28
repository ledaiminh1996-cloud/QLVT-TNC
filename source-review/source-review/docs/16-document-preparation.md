# Bản dựng chứng từ — chuẩn bị trước khi nối sổ kho

Ngày 24/10/2026. Nguồn yêu cầu: [tài liệu v174](reference/Tom_tat_chung_tu_va_luong_du_lieu_v174.md).

## Tình trạng bàn giao

**Đã triển khai cloud ngày 25/10/2026 theo yêu cầu người dùng.** Worker `5ecdaa1d-0f2f-4d2c-b9fb-7bc7b795dfed`, migration 0020 và 0021 đã áp dụng. Xem [biên bản triển khai](17-deployment-documents-20261025.md). Cập nhật mới nhất: PN đã có nút Lưu nhập kho ngay và migration 0023; các loại khác giữ nháp/phê duyệt. Xem mục Lưu phiếu nhập cập nhật tồn ngay ở cuối tài liệu. Các ghi chú cục bộ ngày 24/10 bên dưới là lịch sử giai đoạn chuẩn bị.

Bản dựng có đủ menu, biểu mẫu và API nháp. Không ghi vào `inventory_documents`, `inventory_document_lines`, `stock_movements` hoặc báo cáo NXT. `post`, `receive`, `resume` bị API chặn bằng `POSTING_NOT_ENABLED`; không chỉ ẩn nút ở giao diện.

## Xem ngay trên máy

Trong thư mục source-review, chạy:

```powershell
npm.cmd run dev:documents
```

Mở **http://127.0.0.1:4176/?preview=documents**.

- Trang riêng có banner BẢN DỰNG CHỨNG TỪ TRÊN MÁY, dùng danh mục và phiếu mẫu. Tất cả dữ liệu chỉ trong bộ nhớ phiên, tải lại sẽ mất; không dùng để nhập dữ liệu thật.
- Không gọi Cloudflare, không dựa vào phiên Access và không trộn dữ liệu với chế độ dữ liệu cũ trên máy.
- Chỉ tồn tại khi Vite ở chế độ DEV. Production build không đóng gói DocumentPreview/previewStore và không có nhánh bỏ qua xác thực.
- Có vai trò xem thử để rà nút thao tác. Quyền thực tế do Worker kiểm tra; preview không phải cơ chế cấp quyền.
- API thật cho việc lưu nháp bền vững đã chuẩn bị ở worker/src/documents.ts và được kiểm tra bằng SQLite + Miniflare/D1 cục bộ; chế độ xem thử không thay thế API đó.

## Đã dựng

| Loại | Phần biểu mẫu và xử lý nháp |
|---|---|
| PĐX | Bộ phận, loại đề xuất, xe/kho liên quan, vật tư, lượng/giá dự kiến; gửi duyệt, duyệt, trả về, từ chối, bỏ duyệt theo quyền |
| PN | Kho, NCC, hóa đơn, số lượng chứng từ và thực nhập riêng; đơn giá, VAT, thành tiền; Serial; bồn DO; Gói Data SIM; nhập nhanh dòng |
| PX | Kho/người nhận/mục đích, nhiều trạng thái hàng trong một phiếu, Serial, thiết bị, ODO/giờ; nhập dòng và nhập nhiều phiếu nháp |
| PTH | Tham chiếu lần lắp gốc, kho nhận, lượng, tình trạng thu hồi, ODO/giờ tháo; chặn dầu tiêu hao |
| TL | Nguồn chờ thanh lý, lượng/Serial và ghi chú; không tự diễn giải giá giảm kho thành doanh thu |
| DV | NCC đắp, Serial trước/sau dự kiến, nguồn, chi phí đắp; chưa bật gửi/nhận ảnh hưởng tồn |
| PĐC kho | Kho đi/đến khác nhau, nguồn/Serial; hiển thị hai số PXĐC/PNĐC cùng phần số gốc; chưa tạo biến động hai đầu |
| PĐC thiết bị | Tham chiếu lần lắp, thiết bị nhận, vị trí, ODO/giờ; không biến thành nhập xuất kho |
| DAO | Vật tư, Serial, vị trí trước/sau, thiết bị và mốc đo |
| SD | Ngày bắt đầu, kho, hàng mới/thu hồi, lượng/giá/Serial/bồn/Gói Data; tối đa 60 dòng; chưa tạo số dư vào sổ |
| SCN | Form chuẩn bị sửa chữa ngoài với NCC, hóa đơn, thiết bị, chi phí/VAT; không gán quyền xem toàn đội xe cho Thủ kho chỉ vì có quyền một kho |

Mọi màn có tìm kiếm không phân biệt hoa thường, lọc ngày/trạng thái, phân trang 25 phiếu, xem/sửa nháp, xuất JSON, in bản nháp và lịch sử trước/sau. Danh mục chỉ tìm theo trang khi mở ô chọn, không đọc toàn bộ mỗi lần mở trang.

Các trường tham chiếu nguồn/lần lắp ở bản dựng chỉ là **tham chiếu nháp**, chưa phải nguồn hợp lệ đã được xác minh. Không cho người dùng hiểu việc nhập ID đồng nghĩa với cấp quyền nguồn hoặc xác nhận còn tồn.

## Số, tiền và tính toàn vẹn

- Số MM.yy.00001/LOẠI cấp khi lưu nháp trong transaction; 5 chữ số theo tháng/loại. PĐX thêm mã bộ phận. Hai loại điều chuyển dùng chung dãy PĐC. Không đổi loại/tháng của phiếu đã cấp số, không tái dùng số hủy.
- ID phiếu/dòng độc lập số hiển thị. Serial, mã, hóa đơn là chuỗi; không ép Number, giữ số 0 đầu và chuỗi số dài.
- Lượng/đơn giá là chuỗi thập phân tối đa 3 số lẻ; tính bằng BigInt với thang đo, làm tròn từng dòng ra đồng, rồi tính VAT theo % tối đa 2 số lẻ, làm tròn ra đồng. Tổng là tiền hàng + VAT.
- PN tính theo lượng **thực nhập**, không theo lượng chứng từ. Tổng nháp là để đối chiếu, chưa quyết định VAT có được vốn hóa vào giá nhập hay không.
- Giá vốn PX/PTH/TL/DV/điều chuyển chưa biết thì hiển thị “—”, không ghi 0 và không nhận giá vốn tự nhập thay nguồn máy chủ.
- SERIAL: 1 chiếc/dòng, bắt buộc Serial, không trùng trong phiếu. Chưa giữ chỗ Serial toàn hệ thống ở bước nháp; kiểm tra trùng toàn hệ thống là việc bắt buộc của posting engine sau này.
- Lưu mới có idempotency_key + hash nội dung; retry cùng yêu cầu không tạo thêm phiếu/cấp thêm số. Sửa có lý do và version; CAS trong batch chặn ghi đè. Ghi phiếu, dòng, số và lịch sử nguyên tử; lỗi audit hoàn tác tất cả.
- Lịch sử có snapshot nhãn, người, lý do, thời gian và request_id; cấm UPDATE/DELETE lịch sử bằng trigger. UI trình bày trường nghiệp vụ, không dùng JSON kỹ thuật làm giao diện chính.
- Thủ kho chỉ tạo trong kho có document_warehouse_access; chỉ sửa nháp mình lập. Có thể đọc/duyệt đề xuất được phân công trong snapshot. Quản trị/Kế toán có quyền nháp chung, hủy/bỏ duyệt. Người xem không ghi. Vai trò Kỹ thuật và quyền chức năng chi tiết chưa được thêm trong bước này.
- Quy trình duyệt cấu hình riêng, một bộ phận/loại; tối đa 10 bước, any/all; chụp khi gửi. Cấu hình thay đổi không sửa phiếu chờ duyệt. Duyệt xong vẫn không ghi sổ.

## Nhập nhanh và hàng loạt

- PN/PĐX/SD/SCN: `Mã vật tư, Số lượng, Đơn giá [, Gói Data]`, CSV hoặc Tab từ Excel, tối đa 60 dòng, có xem trước. SERIAL cần lượng 1 và bổ sung Serial trong form trước khi lưu.
- Các phiếu nguồn: `Mã vật tư, Số lượng, Trạng thái [, Serial]`. Trạng thái dùng new/recovered/pending_scrap hoặc nhãn tiếng Việt; khi lưu vẫn qua kiểm tra theo loại phiếu.
- Nhập nhiều PX: mảng JSON tối đa 20 phiếu theo cấu trúc xuất JSON. Đây là công cụ cho dữ liệu đã ánh xạ ID danh mục; chưa phải bộ đọc mọi định dạng Excel/Apps Script cũ. Mỗi phiếu có key riêng, giữ kết quả từng phiếu, tiếp tục bỏ qua phiếu đã lưu trong cùng phiên nhập. Không tự gửi lại toàn lô sau một lỗi.

## API và migration chưa áp dụng lên cloud

- GET/POST `/api/document-drafts`; GET/PATCH `/api/document-drafts/:id`; GET `?view=history` trên một phiếu.
- PATCH actions: save, submit, approve, return, reject, revoke, cancel. Ghi sổ/nhận đắp/tiếp tục chuyển kho chưa bật.
- GET/POST `/api/document-workflows`; PATCH `/api/document-workflows/:id`; GET `?view=approvers` dành cho vai trò quản lý.
- Migration **0020_document_drafts.sql** tạo khu vực nháp riêng. Tests áp dụng trên database thử nghiệm, chưa áp dụng remote.
- Khi được tiếp tục cloud: sao lưu, đối chiếu schema/dữ liệu thực và dãy số cũ, kiểm tra/khởi tạo counters theo dữ liệu đã có để tránh trùng số với inventory_documents hoặc phiếu cũ; áp dụng migration, cấp phạm vi kho cần thiết, rồi mới deploy và kiểm tra phiên Access. Không đưa sample preview vào database thật.

## Còn phải xây trước khi bật ghi sổ

1. Posting engine và quyền chức năng/kho, role Kỹ thuật; khóa kỳ theo ngày, chống thao tác đồng thời và requestId cho nghiệp vụ.
2. Nguồn nhập, stock buckets kho/trạng thái/Serial, phân bổ nhiều lô FIFO riêng với giá vốn bình quân; xác minh toàn bộ nguồn ở máy chủ.
3. Giai đoạn sử dụng, thu hồi lượng còn mở, kiểm tra ngày/ODO/giờ; giá trị còn lại và tuổi thọ tái sử dụng; chặn thu hồi dầu tiêu hao.
4. Gửi/nhận đắp cùng hồ sơ, chi phí và Serial mới, chống nhận lại; TL theo nguồn chờ thanh lý, không tự hạch toán doanh thu.
5. Điều chuyển kho nguyên tử hai đầu/cùng số, tiếp tục/hủy cả hồ sơ, không đếm trùng NXT; chuyển thiết bị/đảo vị trí không biến động kho thực.
6. Số dư trước mốc bắt đầu một giây, không tính là nhập mua, chống khởi tạo lặp; mở/khóa kỳ, phụ thuộc và hủy ngược chuỗi.
7. Ba sổ NXT và đối chiếu lượng/giá trị; phân biệt chưa biết và 0; đồng bộ lại báo cáo không tạo lại phiếu. Thống nhất cách xử lý VAT trong giá nhập theo chính sách áp dụng thực tế.
8. Ánh xạ dữ liệu cũ, bí danh PXT/PX, ID nguồn/lần xuất, liên kết thu hồi/đắp/chuyển và lịch sử. Không chỉ nhập các bảng phẳng rồi coi là đã truy vết.

## Kiểm chứng bản dựng

- 63 kiểm thử frontend: tiền/VAT, CSV/Tab, retry, quyền xem, các menu, giữ dữ liệu khi lỗi/conflict và chống submit trùng.
- 57 kiểm thử Worker: bao gồm auth, quan hệ danh mục, draft/version/Serial, phạm vi kho, khóa kỳ, workflow snapshot/đồng duyệt, rollback số/dòng/audit, dầu/bồn và API nháp trên Miniflare/D1 thật cục bộ.
- TypeScript frontend/Worker và production build đạt. Chứng từ và in được tách chunk, không tải cả màn lập/in khi chỉ mở danh mục.
- Chrome cục bộ đã lập/lưu/mở lại PN, xem lịch sử, mở các menu, cấu hình quy trình, nhập nhanh SIM/Gói Data và xem điện thoại/sáng/tối. Không có yêu cầu mạng ra ngoài localhost trong kịch bản kiểm tra.

## Mẫu giấy PĐX Mẫu 01 (24/10/2026)
Đối chiếu Mẫu phiếu đề xuất.docx: thông tin vận hành, ảnh hưởng/an toàn, thiết bị và đồng hồ, kiểm tra kỹ thuật, phương án nhiều lựa chọn; hai bảng riêng tháo/thu hồi và cấp/lắp; bàn giao, kiểm tra nguồn, hồ sơ tham chiếu; dự toán mua ngoài/công sửa/chi khác/thuế riêng. Khoản chưa biết giữ null, giá trị tham khảo kho không cộng chi tiền. Toàn bộ dữ liệu lưu cùng header/line JSON, phiên bản và lịch sử hiện có; không cần sửa bảng D1.
Bản in PĐX có các phần tương ứng và năm vị trí ký. Phê duyệt điện tử theo quy trình được cấu hình, không tự tạo tài khoản hoặc chữ ký. Quyết định có điều kiện, hạn mức duyệt có cấu trúc, tải tệp và sinh chứng từ thực hiện tự động chưa triển khai; hiện ghi điều kiện trong lý do duyệt/lịch sử. Chưa ghi sổ tồn kho và chưa deploy cloud.

## Rà soát ràng buộc chứng từ 24/10/2026
- Bỏ SCN khỏi menu và loại chứng từ có thể tạo. Không xóa lịch sử cũ.
- Nhập tay / nhập nhanh dùng vi-VN: chấm là hàng nghìn, phẩy là thập phân. Từ chối 150.5. Ví dụ giá 150.000 × 2, VAT 8% = 324.000 đ. API / JSON xuất nhập dùng chuỗi số chuẩn, dấu chấm thập phân cho số lượng/thuế; tiền VND chỉ chuỗi số nguyên. Không áp dụng bộ chuẩn hóa giao diện lần thứ hai lên JSON API đã chuẩn.
- PĐX: mỗi khoản tiền là nguyên đồng; khoản chưa biết là null. Không cộng giá trị tham khảo kho vào tiền chi.
- Migration 0021 thêm parts.is_fuel / needs_data_package, chuyển dữ liệu cũ một lần. Runtime đọc cờ, không suy từ SKU. Cờ cấu hình được ở danh mục vật tư. Worker là nơi đối chiếu cờ đáng tin; parseDraft chỉ kiểm tra cấu trúc và số liệu, không nhận cờ từ client làm bằng chứng.
- Không cho Serial trên vật tư không quản lý SERIAL; bồn trên vật tư không phải nhiên liệu; gói Data trên vật tư không dùng gói Data. Vật tư SERIAL bắt buộc serial và số lượng 1.
- Khóa dòng (document_id, id) ngăn lỗi trùng giữa hai phiếu, vẫn chặn ID trùng trong một phiếu. Migration giữ lại dòng và không sửa lịch sử.
- Quy trình trùng bộ phận + loại trả 409; giao dịch vẫn nguyên tử. Tìm kiếm chứng từ không phân biệt dấu, thêm serial/bồn/gói Data; không thay quy tắc tìm kiếm danh mục.
- Editor cảnh báo Đóng/Escape/beforeunload khi có thay đổi, lỗi ghi số dòng/nhãn và chuyển focus về ô tương ứng. JSON header tùy chọn mặc định chuỗi rỗng, trường nghiệp vụ bắt buộc vẫn kiểm tra.
- Tách DocumentList, DocumentLines, documentFormatting, documentNumbers, focusDocumentError; định dạng bộ module bằng Prettier 3.6.2.
- 0020 và 0021 vẫn chỉ kiểm thử cục bộ, chưa áp dụng cloud. Áp dụng đúng thứ tự khi triển khai sau này.

## Một dòng vật tư, nhiều serial (25/10/2026)
- Phiếu nhập có bảng STT, Vật tư, SL chứng từ, Thực nhập, Đơn giá, VAT, Thành tiền, Thao tác; serial/trạng thái chuyển xuống vùng mở rộng. Modal tối đa 1400px; desktop không cuộn ngang, màn nhỏ vẫn cuộn khi cần.
- Vật tư đọc is_serialized từ danh mục. Huy hiệu đếm, tự mở/focus, dán từ Excel/quét Enter, sinh dải giữ số 0 đầu, cảnh báo trùng theo mã vật tư. Giảm lượng cần xác nhận trước khi bỏ serial cuối. Trạng thái dùng chung dòng; PN tiếp tục chỉ nhận hàng mới theo quy tắc đã chốt.
- DTO DraftLine có serials[], giữ serial đơn để tương thích phiếu cũ; database không lưu danh sách trong line_json: migration 0022 tạo document_draft_serials và chuyển các serial cũ. Mỗi serial có document_id, line_id, part_id, serial_number/key, stock_state. Unique(document_id,part_id,serial_key), FK dòng ghép và cascade khi sửa dòng trong transaction.
- Nháp được thiếu serial; số lượng SERIAL nguyên, không nhận dư serial, tối đa 500 serial/dòng, 1.000/phiếu. Gửi/duyệt đề xuất kiểm tra đủ số serial; posting vẫn khóa. Kiểm tra server đối chiếu inventory_serials theo part_id+serial_key, trạng thái in_stock/mounted; hai nháp chưa giữ chỗ serial.
- inventory_serials là cấu trúc nền cho sổ serial; lưu nháp không cập nhật bảng này hay stock_movements. Posting engine tương lai phải ghi movement và sổ serial nguyên tử với kiểm tra lại trùng/nguồn/ngày/khóa kỳ. Chưa coi việc tạo bảng là hoàn tất sổ kho.
- Tồn hiện tại trong ô vật tư vẫn ghi Chưa có dữ liệu vì chưa nối sổ tồn; không tự giả định 0. Giao diện nhiều serial mới áp dụng cho PN, các màn chứng từ khác giữ bố cục hiện hành và DTO tương thích nhiều serial.

## Đơn giá thập phân (25/10/2026)
Yêu cầu mới thay quy tắc đơn giá nguyên đồng trước đó: unit_price cho phép tối đa 3 chữ số thập phân; nhập tay/Excel dùng phẩy thập phân, API giữ chuỗi chuẩn dùng dấu chấm. Tiền hàng mỗi dòng và VAT vẫn làm tròn ra đồng bằng BigInt. Ví dụ 50 × 3.703.703,7, VAT 8% = 185.185.185 + 14.814.815 = 200.000.000 đ. Các khoản tổng dự toán và chi phí nhập dạng tiền nguyên vẫn giữ nguyên quy tắc riêng. Không sửa dữ liệu cũ, không cần migration.

## Lưu phiếu nhập cập nhật tồn ngay (25/10/2026)
Yêu cầu mới của người dùng: PN dùng nút Lưu, gửi commit:true. Máy chủ kiểm tra kho/quyền/khóa kỳ/đơn giá và đủ serial, sau đó trong một D1 batch ghi metadata, inventory_documents(type IN, posted), inventory_document_lines theo Thực nhập, receipt_line_details (SL chứng từ/VAT/bồn/gói Data), stock_movements, stock_balances, inventory_serials và audit. Không nhập theo SL chứng từ. Retry idempotency không tạo thêm phiếu hoặc tồn. UNIQUE serial + trigger khóa kỳ kiểm tra lại trong transaction; lỗi bất kỳ hoàn tác toàn bộ.
Giá trị nhập kho dùng tiền trước thuế đã làm tròn; VAT và tổng thanh toán lưu riêng, chưa vốn hóa VAT. stock_balances là số dư được duy trì trong cùng giao dịch với movement để đọc ít dòng D1; đối chiếu với current_stock. Tồn hiển thị là tồn theo sổ, không phải số kiểm kê thực tế.
Migration 0023 thêm posted_inventory_id vào metadata, liên kết phiếu kho đã posted; API/list trả trạng thái posted khi có liên kết. Các thao tác sửa/hủy metadata và dòng/serial đã posted bị chặn cả API lẫn trigger. Chưa có chức năng đảo/hủy phiếu đã nhập; không được sửa giảm tồn thủ công. Các loại PX/PTH/TL/DV/PĐC/SD và duyệt PĐX giữ luồng riêng, không tự bật ghi sổ chúng.
Không tự chuyển các phiếu nháp cũ thành nhập kho. Người dùng mở phiếu nháp, hoàn thiện và bấm Lưu; các phiếu đã nhập chỉ xem/in/lịch sử. Có kiểm thử SQLite/Miniflare cho hoàn tác, đồng thời serial, khóa kỳ thay đổi giữa request và batch, retry, số lượng thực, giá thập phân và không sửa/hủy posted.


## Cập nhật 25/10/2026 — Lưu và ghi sổ trực tiếp (yêu cầu mới)

Yêu cầu mới thay phần giới hạn ghi sổ ở trên: giao diện không còn nút Lưu nháp. Lưu PN/PX/PTH/TL/DV/PĐC/SD gửi commit:true; PĐX vẫn lưu và gửi duyệt, không cập nhật kho. API cũ bỏ commit vẫn giữ khả năng đọc/lưu dữ liệu chuẩn bị để tương thích; không tự ghi sổ các phiếu cũ bằng migration.

Migration 0024 bổ sung tồn theo trạng thái, lô nguồn, phân bổ FIFO để truy nguồn, liên kết giá vốn bình quân, lần sử dụng và serial, hồ sơ đắp, số dư và khóa sửa PN. Giá vốn xuất dùng bình quân theo vật tư/kho/trạng thái; FIFO chỉ phân bổ nguồn. Nhiều dòng cùng nguồn được cộng dồn trong kế hoạch và kiểm tra phiên bản lại trong batch D1 nguyên tử. Không đủ tồn hoặc ngày trước nguồn tham gia giá vốn thì chặn.

- PN đã ghi sổ chỉ được sửa/xóa khi chưa có sử dụng hoặc liên kết, kể cả tham gia tính giá vốn bình quân. Sửa phải có lý do và phiên bản, hoàn tác tồn cũ rồi ghi lại trong cùng giao dịch. Xóa là ẩn khỏi danh sách thường, giữ số phiếu, lịch sử và hồ sơ hủy để truy vết; không tái sử dụng số.
- PX giảm tồn và mở lượng sử dụng; PTH phải chọn lần xuất/lắp còn mở và không vượt lượng còn lại; TL chỉ giảm hàng chờ thanh lý. Dầu tiêu hao không được thu hồi.
- PĐC kho ghi hai chiều trong một giao dịch, lượng/giá trị toàn công ty không tăng. Chuyển thiết bị/đảo vị trí đóng/mở sử dụng, không tạo nhập xuất kho giả.
- DV gửi một vỏ/serial mỗi dòng từ hàng thu hồi; mở lại hồ sơ đang đắp và Lưu nhận đắp để tăng tồn với serial mới và chi phí thực tế. Chặn nhận hai lần.
- SD tạo tồn có giá/serial, chặn khởi tạo lại nhóm hoặc khi vật tư/kho đã có lịch sử.
- Mọi thay đổi có phân quyền, kiểm tra khóa kỳ và lịch sử; lỗi audit hoặc cạnh tranh nguồn làm rollback cả số phiếu/tồn/serial.

Giới hạn cần giữ rõ: mô hình hiện chưa có đủ đồng hồ đi/đến và tuổi thọ còn lại qua nhiều vòng tái sử dụng. PTH của hàng có tuổi thọ qua nguồn thu hồi hoặc chuyển xe bị chặn khi không đủ căn cứ; không tự tính một giá trị ước đoán để ghi kho. Đảo vị trí trên cùng xe giữ mốc đồng hồ gốc. Preview bộ nhớ không mô phỏng các nghiệp vụ kho mới ngoài PN; báo rõ chưa kết nối, không báo lưu thành công giả. Các luồng này được kiểm thử qua Worker/D1 cục bộ.

Kiểm chứng: 81 kiểm thử API/Workers-D1, 76 kiểm thử frontend, TypeScript frontend/Worker và production build đạt. Chưa kiểm tra thao tác với phiên đăng nhập cloud của người dùng; kiểm tra production bằng migration, khóa ngoại, số lượng dữ liệu và cổng Cloudflare Access, không tạo phiếu thử trên cloud.


## Phiếu nhập: giá chính xác, tồn trước phiếu và 50 serial — 25/10/2026

- Một dòng hàng có N serial. document_draft_serials lưu mỗi serial một bản ghi gắn document_id/line_id/part_id; inventory_serials lưu mỗi serial một bản ghi sổ, khóa (part_id,serial_key). Không lưu danh sách serial ghép chuỗi trong dòng database. JSON API vẫn trả mảng để giao diện dùng.
- PN có ba cách nhập giá: đơn giá trước VAT, đơn giá sau VAT, thành tiền cả dòng sau VAT. Đơn giá trực tiếp nhận tối đa 12 chữ số thập phân và lưu chuỗi gốc; số tiền hóa đơn nhận nguyên đồng theo quy ước vi-VN. Phép tính dùng BigInt/tỷ lệ chính xác, không tính bằng số thực nhị phân.
- Với đầu vào sau VAT, Worker suy ra đơn giá trước VAT dạng phân số; numerator/denominator TEXT trong inventory_document_lines là giá chính xác. unit_price_vnd_milli chỉ còn là giá chiếu tương thích làm tròn 3 chữ số, không dùng nó để tính lại tổng PN. receipt_line_details giữ pricing_mode/pricing_value gốc; JSON dòng giữ cùng đầu vào. Số tiền net/VAT/gross làm tròn đồng; nhập gross thì net=round(gross/(1+VAT)), VAT=gross-net. Không tự đổi số tiền đã ghi của phiếu cũ.
- Ví dụ: 50 × (100000000/27) × 1,08 = 200.000.000 đ. Tổng 200 triệu hoặc giá sau VAT 4 triệu đều cho net 185.185.185, VAT 14.814.815 và gross 200.000.000. Dấu … ở giá xem trước chỉ rút gọn phần hiển thị; phân số lưu không mất độ chính xác.
- Chỉ còn một chỉ số “Tồn kho trước phiếu này” theo kho chọn. Phiếu mới đọc stock_balances; khi lưu ghi snapshot trước cả phiếu trong cùng batch, kể cả nhiều dòng trùng vật tư. Mở phiếu đã lưu dùng snapshot, không hiển thị tồn sau nhập như tồn trước nhập. Dữ liệu cũ chỉ tái dựng khi thứ tự posted_at không mơ hồ và không có lịch sử hủy can thiệp; trường hợp không đủ căn cứ hiện chưa có số liệu.
- Serial editor tăng đến 16 dòng nhìn thấy, cho thay đổi chiều cao, tìm kiếm không phân biệt hoa thường, sắp xếp tự nhiên và Xóa hết có xác nhận. Cảnh báo dưới ô nêu dòng hàng và số thứ tự serial trùng. Huy hiệu đủ/không lỗi xanh, thiếu cam, thừa đỏ. Không có sinh dải serial.
- Migration 0025_receipt_exact_pricing.sql; đã preflight trên backup có 1 phiếu/1 dòng/50 serial, giữ nguyên lượng và giá trị. 83 API + 79 frontend đạt; Chrome 1440px kiểm tra 50/50 và tổng 200 triệu, ảnh artifacts/receipt-exact-pricing-50-serials.png. Các giao dịch thử chỉ chạy cục bộ.


## Serial chuyển sang ngăn kéo bên phải

Thiết kế mới thay phần textarea mở rộng trong bảng PN. Dòng hàng giữ nút Serial x/y có mũi tên, xem trước hai serial và số lượng còn lại; ngăn kéo rộng 540px, đầy màn hình trên điện thoại. Portal phủ lên phiếu, không thêm dòng/đổi chiều cao bảng chính. Tên vật tư, bộ đếm và tiến độ cố định ở đầu; bảng serial có STT, giá trị, trạng thái và xóa từng dòng; chỉ vùng bảng cuộn.

- Nhập nhanh Enter, dán nhiều dòng/tab từ Excel hoặc nút Dán từ Excel (khi trình duyệt cho phép clipboard). Tối đa 500; dán vượt giới hạn bị từ chối cả lượt, không cắt ngầm. Không có sinh dải.
- Tìm kiếm lọc trực tiếp các dòng; giữ STT nguồn trong lúc lọc và xóa theo ID nội bộ ổn định. Sắp xếp tự nhiên; không truy vấn lại kho khi chỉ đổi thứ tự, tìm kiếm hoặc đổi hoa/thường.
- Mỗi bản ghi báo hợp lệ, đang kiểm tra, trùng trong dòng/phiếu/kho, hoặc sai định dạng. Ghi rõ các STT/dòng hàng trùng. Kiểm tra kho có hủy phản hồi cũ; máy chủ vẫn kiểm tra lại khi Lưu phiếu.
- Xóa hết là liên kết nguy hiểm riêng ở cuối, xa Sắp xếp; có xác nhận và Hoàn tác. Hoàn tác khôi phục cả danh sách và ô nhập nhanh chưa thêm.
- Chỉnh trong ngăn là bộ đệm riêng. Xong áp dụng danh sách vào phiếu, gồm serial đang gõ chưa Enter; chưa ghi kho. Hủy/X/Escape/nền ngoài hỏi khi có thay đổi và bỏ bộ đệm, giữ nguyên phiếu. beforeunload bảo vệ bộ đệm chưa áp dụng. Phần phiếu ở dưới inert/aria-hidden, trap focus trong ngăn và trả focus về nút serial khi đóng; Escape không đóng cả phiếu.
- Chế độ chỉ xem vẫn tìm được serial nhưng không thêm/sửa/xóa/sắp xếp hoặc đọc lại serial của chính phiếu thành xung đột giả.

Kiểm chứng: 82 kiểm thử frontend đạt, lint và production build đạt. Chrome 1440px kiểm tra 50 serial, vị trí bảng và nút Lưu không thay đổi khi mở ngăn; lọc đúng dòng và Hủy giữ đủ 50. Chrome 375px không tràn ngang, không có page errors. Ảnh artifacts/serial-drawer-desktop.png và artifacts/serial-drawer-mobile.png. Không đổi schema/API/tồn hoặc nhập chứng từ thử cloud.


## Cập nhật danh sách phiếu nhập ngày 26/10/2026

- Phiếu nhập mở mặc định ở chế độ Xem từ số phiếu, cả dòng hoặc nút mắt; Xem và In là hai thao tác chính. Menu ba chấm chứa Lịch sử, Excel, Nhân bản, Sửa và Hủy theo quyền/điều kiện phát sinh phía máy chủ. In hỗ trợ lưu PDF qua hộp thoại in, tải trực tiếp là Excel .xlsx.
- Mặc định tháng hiện tại theo giờ Việt Nam; ngày có nhãn Từ/Đến, nút Hôm nay/7 ngày/Tháng này/Tháng trước. Lọc Kho, NCC (kể cả danh mục ngừng hoạt động), trạng thái và tìm serial; có bộ đếm và Xóa lọc. Không tự đọc toàn bộ danh mục lựa chọn khi mở trang.
- Bảng dùng Ngày chứng từ, NCC hai tầng mã/tên với tooltip, Dòng, Tổng SL thực nhập và Sau VAT. Bỏ cột Trạng thái, giữ bộ lọc trạng thái. Số phiếu liên kết xanh; rê chuột tô nhẹ dòng.
- Ô Hiện thêm bật ba cột Số hóa đơn, Người lập và Mục đích/nội dung. Có cuộn ngang khi bật nhiều cột hoặc màn hình hẹp. Hàng tiêu đề theo cuộn trang, không thêm vùng cuộn dọc trong bảng.
- Chân bảng cộng Dòng, Tổng SL và Sau VAT của trang hiện tại. Số lượng truyền dưới dạng chuỗi số nguyên phần nghìn, cộng bằng BigInt. Tổng SL có thể gồm nhiều ĐVT. Nếu có phiếu chưa có giá trị, tổng tiền chỉ cộng phần đã xác định và ghi chú rõ.
- Xuất Excel trên thanh công cụ đọc toàn bộ các trang theo bộ lọc tại lúc bấm, không chỉ trang đang xem; không tải file thiếu nếu API lỗi, bị hủy, thay đổi tổng số phiếu hoặc trùng bản ghi giữa các trang. Không tạo hay sửa chứng từ khi xuất. Số hóa đơn/serial là ô text để giữ số 0 đầu và không thực thi công thức Excel.
- API danh sách bổ sung invoice_number, purpose và total_quantity (chuỗi số nguyên phần nghìn); người lập dùng created_by_name sẵn có. Không đổi schema, cách cấp số, quyền kho hoặc nghiệp vụ tồn.


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


### 26/10/2026 — Mẫu in phiếu nhập theo biểu mẫu công ty
ReceiptPrint riêng, A4 ngang: tên công ty/MST 0303955513; số/ngày phiếu; NCC/MST/địa chỉ; kho; số/ngày hóa đơn; nội dung. Bảng 11 cột STT, mã, tên, ĐVT, chất lượng, SL, đơn giá, tiền trước GTGT, thuế GTGT, serial, ghi chú. Chi phí theo khoản/VAT, tổng giá trị nhập kho trước VAT (1+2), tổng thuế, tổng thanh toán, bốn ô ký (Người lập, Người giao, Thủ kho, Kế toán).
Nhiều hơn 3 serial/dòng in phụ lục đủ từng serial, dẫn chiếu dòng phiếu; giữ header bảng khi sang trang, không ngắt hàng/khu ký. Không cộng số lượng khác ĐVT. Dữ liệu dùng tiền đã lưu và phép tính chính xác shared; không ghi sổ hay sửa dữ liệu khi in. Phiếu hủy/nháp có nhãn rõ, phiếu posted không nhãn nháp.
Worker lưu snapshot MST/địa chỉ/tỉnh NCC trong labels từ lần lưu tiếp theo. Với phiếu cũ thiếu snapshot, đọc metadata hiện tại để in (không ghi lại DB); snapshot đã có không bị thay theo danh mục. Không migration.
Kiểm tra: 50 tests chứng từ, 92 Worker tests, lint/check/build. Chrome in PDF thử 50 serial đủ 50 (2 trang, phụ lục trang 2), 28 dòng hàng sang 3 trang không tràn ngang; kiểm tra giữ metadata khi NCC đổi địa chỉ. Deploy 156b192a-2aff-4b57-9783-f4d7ae68727c.


### 26/10/2026 — Mỗi serial một dòng ngay trong bảng in
Thay phụ lục serial bằng tách dòng chỉ trên bản in: 30 serial/SL 30 thành 30 dòng cùng vật tư, mỗi dòng SL 1, STT liên tục. Không đổi dòng dữ liệu lưu/stock. Phân bổ tiền net và VAT nguyên đồng bằng thương/chia dư từ tổng dòng gốc, không nhân lại giá đã làm tròn; tổng tiền không đổi. Phiếu nháp thiếu serial giữ lượng gốc và cảnh báo, không giả lập serial hoặc số lượng.
Số phiếu/ngày ở đầu bảng lặp lại; footer số phiếu/ngày và Trang x/y trên mọi trang, kể cả trang tổng/ký. Không phụ lục. 50 tests chứng từ (kiểm tra 50 dòng, trường hợp 30 serial chia 100đ+8đ vẫn đúng tổng), lint/build và PDF Chrome có đủ serial, số phiếu và số trang trên tất cả các trang. Deploy cec84e30-33c0-4408-a677-b4939864ef00.


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


### 26/10/2026 — Hoàn thiện bố cục và thông tin bắt buộc phiếu xuất
- Chọn lái xe lấy xe đang hoạt động được phân công duy nhất, ODO, nhóm xe; không có/không duy nhất thì yêu cầu chọn biển số. Đổi/xóa lái xe xóa thông tin xe cũ tương ứng; giữ độc lập trạng thái tải thông tin và Nhập nhanh.
- Họ tên lái xe, biển số xe, ODO bắt buộc khi lưu ghi sổ; Worker kiểm tra lại. Đầu phiếu 4 ô/hàng trên màn hình lớn: Số phiếu, Ngày chứng từ, Kho xuất, Người nhận.
- Bảng dòng hàng bỏ Thiết bị nhận, ODO, Giờ máy; thêm Đơn giá, Thành tiền; không VAT. Giữ Vị trí lắp, Ghi chú thành cột cạnh Thao tác. Giá vốn chỉ đọc từ số đã ghi sổ; chưa ghi sổ hoặc đã sửa nội dung hiển thị dấu gạch để tránh dùng giá cũ.
- Worker trả giá trị/SL thực tế theo từng dòng đã ghi sổ trong labels issue_amount/issue_quantity. Dòng mới chưa có đích nhận kế thừa xe và ODO đầu phiếu; giữ liên kết lịch sử đã có. Không đổi thuật toán FIFO hoặc cách chọn serial, không migration.
- Kiểm tra: frontend lint/build, 112 tests giao diện, Worker check và 96 tests (SQLite + Miniflare/D1). Browser kiểm tra chọn tài xế tự điền xe/ODO, 4 ô đầu phiếu, cột tiền/ghi chú, cửa sổ ở 1600/1024/390 px. Ảnh artifacts/issue-layout-desktop.png và issue-layout-390.png. Trang preview nền có tràn ngang trên điện thoại từ bố cục chung; cửa sổ phiếu nằm trong viewport và tự cuộn.


### 26/10/2026 — Thu gọn đầu phiếu xuất và thiết bị ghép nối
Người nhận chuyển xuống ô đầu hàng 2, tiếp theo Bộ phận nhận và Mục đích/nội dung. Hàng đầu còn Số phiếu, Ngày chứng từ, Kho xuất. Nhóm xe nằm cùng hàng với Phương tiện/thiết bị ghép nối trên màn hình lớn; ba ô Rơmooc số, Container số, Máy phát nhỏ hơn. Máy phát nhập tay, giữ trường lưu `other` để bảo toàn dữ liệu đã có, đồng bộ nhãn bản in và Excel. Không thay nghiệp vụ hay schema.
Đã kiểm tra frontend lint/build, 58 tests chứng từ; trình duyệt xác nhận hàng 2, hai nhóm cùng hàng, nhập tay Máy phát và cửa sổ ở 1600/1024/390 px.


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


### 26/10/2026 — Phiếu thu hồi theo mẫu, đánh giá chất lượng thực tế
- Thêm RecoveryHeader/RecoveryLines và metadata recovery_details: phương tiện tháo, xe/rơmooc/máy phát/container, lái xe, ODO/giờ máy, lý do tháo, bàn giao/tiếp nhận, ghi chú. Dùng giao diện ngày giờ và palette sáng/tối chung.
- Mỗi dòng chọn lần xuất/lắp còn mở; serial drawer chỉ trả serial đang mounted và thuộc usage còn mở. Kiểm tra quyền kho nguồn khi tra cứu, quyền kho nhận và liên kết khi ghi sổ; giữ chống trùng/thu hồi quá số lượng/giao dịch nguyên tử.
- Người dùng chốt nhập % đánh giá thực tế. Chấp nhận 0..100, tối đa 2 số thập phân; chuẩn hóa số Việt ở biên UI, máy chủ tính lại bằng số nguyên: phần giá trị còn mở phân bổ theo số lượng × chất lượng / 100, làm tròn đồng. Lưu snapshot base/quality/source, đọc amount/unit price từ sổ cho xem/in. Dữ liệu API cũ không có quality giữ thuật toán tuổi thọ trước đây; form mới bắt buộc quality.
- CSD/CSC về recovered; KSD/CTL về pending_scrap, không phát lại như recovered. Lưu đủ mã phân loại riêng trên từng dòng.
- Nhập nhanh bảng có tiêu đề Phân loại, Chất lượng (%), giữ dán/copy TSV và kiểm tra trường. Sau nhập cần chọn nguồn usage trên từng dòng.
- RecoveryPrint dùng CSS phiếu nhập, A4 portrait 11 cột, 4 chữ ký, giờ chứng từ, % chất lượng và phân loại, kho nhận; nhiều serial tách dòng và bảo toàn tổng đồng. Không VAT. Bản mẫu artifacts/recovery-print-sample.pdf (1 trang); mẫu 32 dòng artifacts/recovery-print-many-lines.pdf (2 trang), đủ 32 serial, không trang trắng.
- Kiểm thử đạt 122 frontend + 107 Worker (gồm runtime D1); lint/check/build đạt. Browser kiểm tra sáng/tối, sửa % cập nhật giá, serial theo usage và mobile; không có lỗi JavaScript. Không thay schema/migration và không tạo phiếu thử trên dữ liệu thật.


### 26/10/2026 — Cân lại các hàng đầu phiếu thu hồi
RecoveryHeader: hàng 1 Số/Ngày/Kho; hàng 2 Họ tên lái xe/ODO/Giờ máy; hàng 3 Biển số/Rơmooc/Máy phát/Container; hàng 4 Phương tiện tháo thiết bị/Lý do tháo/Người bàn giao/Người tiếp nhận. Giữ responsive 1/2 cột khi màn hình hẹp. Chọn lái xe gọi issue-context theo driver, lấy xe duy nhất và ghép nối active hiện tại, ghi đè bộ ghép nối cũ; bỏ chọn lái xe xóa các trường xe/thiết bị. API này đã có sẵn và được dùng lại, không thay schema hay nghiệp vụ ghi kho.
Đạt lint, 123 frontend tests, build; browser đo các ô hàng 2/hàng 4 cùng trục, sáng/tối/mobile và serial không lỗi JavaScript. Test mới xác nhận query driver không kèm xe cũ, lấy đủ trailer/generator/container/ODO và xóa pairing cũ khi bỏ chọn.


### 26/10/2026 — Ưu tiên % còn lại theo định mức cho tồn thu hồi
Yêu cầu mới thay cách tính nhân % đánh giá thực tế trước đó. recoveryValuation là hàm Worker dùng chung preview và posting: đọc usage/root line/parts/serial đang mounted từ D1; dùng giá xuất gốc × số lượng × phần định mức còn lại. Tỷ lệ sử dụng = chênh lệch ODO/giờ / định mức, chặn mốc âm và giới hạn sử dụng tối đa 100%. Nếu cả hai định mức được cấu hình, yêu cầu đủ cả hai mốc và dùng tỷ lệ còn lại thấp hơn, giữ quy tắc thận trọng đã có. Thiếu định mức/mốc gốc hoặc lịch sử tái sử dụng/chuyển đồng hồ chưa đủ căn cứ thì báo lỗi và không ghi giá ước đoán.
Chất lượng đánh giá lưu riêng, không ảnh hưởng giá tính theo định mức. Giao diện thêm mốc ODO/giờ tháo riêng từng dòng, mặc định kế thừa đầu phiếu khi để trống. Máy chủ kiểm tra lại lượng mở/ngày/mốc tháo, lưu usage_id/root_line_id/source document, giá xuất, định mức, mốc thực đo, phần trăm còn lại và giá trị vào recovery_valuation snapshot; estimated_hours=false. Chưa bật công thức giờ tạm tính theo lựa chọn ưu tiên hiện tại của người dùng. Serial theo giá xuất riêng và snapshot số tiền/đơn giá thu hồi riêng, không gộp thành giá bình quân cho serial. Đích kho vẫn recovered hoặc pending_scrap theo phân loại.
RecoveryPrint hiển thị % còn lại định mức cạnh giá trị và ghi rõ giá trị quản trị tồn thu hồi, không phải bút toán khấu hao tài chính. Áp dụng khi lập phiếu mới, không sửa lại giá trị phiếu đã ghi sổ. Không schema migration và không chỉnh dữ liệu kho thật trong kiểm thử.
Đạt 123 frontend tests, 109 Worker tests (gồm runtime D1), lint/check/build. API kiểm tra thiếu định mức, thiếu mốc, phần trăm vượt định mức, ODO/giờ lùi, quá lượng, giả ngày/giá/lượng mở, chất lượng 0/100 không đổi định giá và serial khác giá giữ đúng từng giá trị; quote bằng posted amount. Browser sáng/tối/mobile, đổi ODO cập nhật %/tiền, PDF 1 trang mẫu và 2 trang 32 dòng đủ serial.


### 26/10/2026 — Sửa PTH không tải được nguồn, báo Bộ lọc nguồn không hợp lệ
Nguyên nhân lỗi: RecoverySource gọi sources(usages, part, '', ''), documentClient gửi stock_state='' nhưng Worker kiểm tra enum kho cho cả usages. Tách validation theo loại nguồn: sources vẫn yêu cầu trạng thái kho hợp lệ; usages không dùng trạng thái/kho nhận để lọc usage. Client bỏ warehouse_id/stock_state với usages, giữ nguyên sources. Thêm test chính request thực của client để tránh chỉ mock UI che lỗi tích hợp.
Nguồn thu hồi nhận vehicle_id từ RecoveryHeader, Worker lọc usage đang mở theo xe và các thiết bị ghép active hiện tại, vẫn áp quyền kho nguồn và phân trang. Option hiển thị ngày giờ lắp, số phiếu, vị trí, đối tượng và lượng chưa thu hồi. Đổi xe/lái xe sang xe khác xóa usage/serial/mốc tháo cũ để chọn lại; serial vẫn chỉ tải theo usage đã chọn.
Đối chiếu D1 thật chỉ đọc: mã M-DC-CBXE-0006 có phiếu 10.26.00001/PX ngày 10/10/2026 15:00, xe 50H-110.99, 12 usage còn mở, mỗi usage 1000 milli, vị trí 12 lốp rơ moóc. Không thiếu phiếu gốc và không sửa dữ liệu kho trong lần khắc phục này.
Đạt lint/check/build, 124 frontend tests và 110 Worker tests. Regression kiểm tra usages với stock_state rỗng, sources vẫn chặn trạng thái rỗng, scope xe A/B/thiết bị ghép, serial đúng usage, và quyền kho nguồn.


### 26/10/2026 — Luồng thu hồi từ vật tư đang sử dụng, giờ tạm tính và nhận/xuất thiếu định giá
- RecoveryUsagePicker + GET recovery-sources: chọn trực tiếp các usage mở phát sinh từ OUT posted, hiển thị mã/tên/serial/phương tiện/vị trí/phiếu gốc/ngày lắp/ODO/giờ lắp/SL còn lại; scope kho và xe/thiết bị ghép, tìm mã/serial/số phiếu, phân trang. Serial chọn thành dòng 1 đơn vị; hàng lượng cho thu từng phần. Giữ usage_id/root_line_id qua các vòng; đóng đủ thì mất khỏi nguồn chọn.
- Server chặn ngày tháo trước lắp và ngày tương lai (Asia/Ho_Chi_Minh), ODO/giờ tháo thấp hơn lắp, quá lượng mở, sai serial, kho không quyền, kỳ khóa. Đủ căn cứ thì tính % còn lại/chi phí đã dùng/giá trị thu hồi; giờ thiếu đồng hồ thực đo được tạm tính theo chênh thời gian lắp/tháo, metadata elapsed_calendar_hours và estimated_hours rõ ràng. Không quy đổi thành khấu hao tài chính.
- Nhiều vòng: sử dụng ngân sách tuổi thọ còn lại từ snapshot vòng thu hồi trước nếu các nguồn nhất quán; không đặt lại toàn bộ định mức. Nếu nguồn thiếu/pha trộn tuổi thọ khác nhau/chuyển đồng hồ thiếu căn cứ thì giá trị quản trị pending thay vì ngăn nhận số lượng.
- Người dùng chốt vẫn cho xuất tiếp khi chưa xác định giá trị, cảnh báo để bổ sung sau. Migration0030 thêm inventory_valuation_flags liên kết dòng và origin, giữ trạng thái pending/reason lâu dài. Các trường tiền số nguyên nội bộ trên dòng pending chỉ là số tạm của sổ, không là giá trị 0 đã được xác định; API detail/quote/stock/tổng phiếu công bố null và không lộ đơn giá/serial-cost 0. Dòng issue/transfer phát sinh từ nguồn pending nhận cờ nguồn tương ứng; quản lý theo lượng còn pending trong nguồn bình quân cảnh báo toàn dòng, không tính ra một giá bình quân có vẻ xác định.
- Form/PDF/list có cảnh báo chưa xác định giá trị; bộ lọc Chưa xác định giá trị cho PTH/PX và export lọc tương ứng giúp rà soát bổ sung sau. Chưa tự ghi giá bù hay thay lại lịch sử khi có định mức mới. Việc bổ sung giá và đối chiếu các dòng đã tiêu thụ cần nghiệp vụ rà soát riêng; trạng thái/căn cứ/ID nguồn đã được lưu để thực hiện sau.
- Phiếu và tồn kho tiếp tục ghi cùng giao dịch nguyên tử để không có khoảng lệch phiếu-tồn, với version guard/audit/idempotency đã có. Báo cáo đọc lại dữ liệu đã ghi, không tạo hàng thu hồi giả hoặc sửa lịch sử PX.
- Đạt126 frontend tests,114 Worker tests (gồm runtime D1), lint/check/build. Kiểm tra thực end-to-end qua API cho ví dụ10/3/7, khác ID khi xuất lại, giá trị400 từ ngân sách500 sau vòng1, giá pending nhận/xuất/thu vòng2 vẫn null và có cờ, scope, ngày tương lai, metadata giờ tạm tính. Browser desktop/dark/mobile nguồn chọn và tiền trống có cảnh báo không lỗi JavaScript.
- Sao lưu trước migration: artifacts/tnc-before-pending-recovery-values-20261026.sql (4547618bytes). Không backfill giá trị hay sửa chứng từ cũ.


### 27/10/2026 — Thu gọn bộ lọc và chuyển nút rà soát giá xuống cuối hàng
Đổi nút Chưa xác định giá trị thành Phiếu cần bổ sung giá, dùng icon Filter và tooltip giải thích chỉ lọc phiếu cần rà soát; inactive nhẹ, active vẫn báo màu amber. Chuyển khỏi nhóm Lập phiếu/Xuất Excel xuống ô cuối phía phải trong ReceiptFilters (PX), PTH xuống phía phải dưới nhóm lọc riêng. ReceiptFilters thêm trailingAction tùy chọn; điều chỉnh ô lọc32px, chiều rộng trạng thái125px/bộ lọc khác120px, thu gọn khoảng cách và padding. Trên màn hình nhỏ nút xuống cuối phía phải; nhóm thao tác được giới hạn max-width để tự xuống hàng, không gây tràn ngang.
Giữ nguyên query/logic pendingOnly và nghiệp vụ dữ liệu. Đạt126 frontend tests, lint/build. Browser1600/1280/390px sáng/tối: nút là phần tử cuối hàng lọc bên phải, ô nhập/nút32px, bật/tắt aria-pressed đúng, popup thời gian dùng được, không lỗi JS, không tràn trang mobile. Artifacts compact-issue-filters-*.png. Không thay Worker/schema/dữ liệu kho.


### 27/10/2026 — Tìm nhà cung cấp theo mã số thuế trong phiếu nhập
CatalogPicker suppliers đổi placeholder thành Tìm mã, tên hoặc mã số thuế và hiện MST dưới tên trong từng lựa chọn; sau chọn vẫn giữ nhãn mã/tên và supplier_id như cũ. Catalog API đã có tìm tax_code theo dữ liệu search, bổ sung nhánh so sánh tax_code chuẩn hóa bỏ dấu gạch/khoảng trắng cho từ khóa số để tìm cả MST chi nhánh khi nhập liền, nhập cách hoặc một phần. Giữ lọc is_active, phân trang trước trả dữ liệu, tìm mã/tên và escape LIKE.
Đạt127 frontend tests,115 Worker tests (gồm runtime D1), lint/check/build. Test UI nhập0312345678001 hiển thị MST0312345678-001 và chọn đúng ID, giữ nhãn; API đối chiếu mã đầy đủ/có gạch/có khoảng trắng/một phần, NCC ngừng hoạt động bị loại khi is_active=1, tìm mã NCC vẫn hoạt động. Không schema hay sửa dữ liệu NCC/chứng từ thật.


### 27/10/2026 — Phiếu vật tư đang sử dụng đầu kỳ, nối nguồn thu hồi
- Số dư đầu kỳ có2 tab Tồn kho đầu kỳ / Vật tư đang sử dụng đầu kỳ. Dùng cùng kind opening và bộ đếm SD, phân biệt header opening_mode=stock/in_use; API list lọc đúng mode (legacy không có mode thuộc stock). Client gửi đủ opening_mode và valuation_pending, có test request thực để tránh bỏ sót tham số.
- OpeningUsageLines nhập vật tư, xe/rơmooc/thiết bị, vị trí lắp, số lượng, serial, đơn giá gốc tùy biết, ngày lắp gốc/ODO/giờ gốc tùy biết, ghi chú; không tự lấy ODO hiện tại làm mốc lắp cũ. Giá/mốc chưa rõ được để trống; hàng serial mỗi dòng1 đơn vị trên form. Kho quản lý xác định nguồn và quyền truy xuất, không nhận kho tại lúc khai báo.
- Posting in_use tạo inventory line loại OPENING và stock_usage/usage_serials; serial ở mounted, warehouse_id NULL. Không tạo stock_movements, stock_lots, stock_balances, stock_buckets hoặc opening_groups. Giá gốc thiếu có cờ pending như luồng thu hồi đã chốt. Khai báo serial trùng bị chặn; hàng lượng chặn khai báo lại cùng vật tư/đối tượng/vị trí bằng unique index và giao dịch rollback.
- Migration0031 thêm opening_usage_lines (declared_at, installed_at nullable, original_unit_price_known, đối tượng/vị trí). Điều chỉnh opening_no_prior_stock để bỏ qua riêng các dòng đang dùng đầu kỳ: hai số đầu kỳ không cản nhau, nhưng kho đã có phát sinh thực vẫn giữ chặn khởi tạo lại. Không backfill hoặc thay chứng từ cũ.
- Thu hồi đọc cả OUT và OPENING có opening_usage_lines; nguồn có source_kind=opening_usage, nhãn Đang sử dụng đầu kỳ, ngày lắp chưa rõ hiển thị đúng. Scope xe còn bao gồm rơmooc/thiết bị đang ghép. Giữ đúng usage_id, serial và lượng còn mở; thu hết nguồn biến mất; thu một phần chỉ giảm lượng tương ứng. Chặn thu trước ngày khai báo, đồng hồ nhỏ hơn lắp; không tạm tính giờ từ ngày khai báo nếu ngày lắp gốc chưa biết. Khi đủ giá/ODO lắp thì định giá theo tuổi thọ; thiếu thì tiền trống, nhận/xuất tiếp kèm cờ pending.
- OpeningUsagePrint A4 portrait,11 cột,3 chữ ký, dùng CSS/typography phiếu nhập, không VAT, mốc/giá chưa rõ thể hiện trống. PDF mẫu1 trang và mẫu30 dòng2 trang đủ30 serial, không trang trắng. Browserdesktop1752/dark/mobile390 kiểm tra tab, chọn rơmooc/serial giữ giá trị, không ép giá/mốc cũ và form cuộn ngang nội bộ.
- Đạt130 frontend tests,117 Worker tests (có runtime D1), lint/check/build. API integration chứng minh mounted opening không sinh tồn kho, thu hồi từ rơmooc ghép với đầu kéo thấy đúng nguồn/serial, giá unknown vẫn nhận, đóng đủ hết nguồn, thu3/10 còn7, giá100×3×50%=150 khi đủ căn cứ, phân quyền kho, idempotency, duplicate rollback, hai mode list tách biệt. Backend test dùng dữ liệu cô lập, không tạo phiếu giả trên D1 thật.
- Sao lưu trước migration: artifacts/tnc-before-opening-in-use-20261027.sql. Migration0031 đã áp dụng thành công.


### 27/10/2026 — Giá hiện tại × chất lượng kỹ thuật cho thu hồi đầu kỳ không rõ giá gốc
- Chỉ nguồn opening_usage_lines.original_unit_price_known=0 được áp dụng, Worker đọc lại nguồn gốc từ D1. Giữ cách tính tuổi thọ KM/giờ cho nguồn có giá gốc; không giảm kép giá trị theo đồng hồ khi dùng chất lượng thực tế.
- Dòng thu hồi có giá mua hiện tại/đơn vị, % chất lượng và tên kỹ thuật xác nhận. Thiếu một căn cứ thì tiền null, vẫn nhận/xuất số lượng và cảnh báo theo quyết định trước. Giá hiện tại phải dương, chất lượng 0..100% (2 số lẻ), 0% là giá trị xác định bằng 0. Giá/số lượng dùng thang đo và BigInt; kiểm tra giới hạn an toàn.
- Snapshot recovery_valuation version3 basis current_price_quality giữ giá tham chiếu, % chất lượng, người xác nhận, thời điểm ghi, usage/root IDs, số lượng và thành tiền. Bản in hiển thị căn cứ. Serial nhập kho nhận giá mới, giữ nguyên đầu kỳ chưa rõ giá gốc và lịch sử cũ. Không có migration, không chỉnh dữ liệu chứng từ đã ghi sổ.
- Đạt 131 frontend tests,119 Worker tests,lint,Worker check,build. Kiểm thử 5.000.000 ×20%=1.000.000;3 cái=3.000.000;0/100%,2 số lẻ, thiếu xác nhận, sai serial, quá lượng, ngày/ODO sai, chặn ghi đè nguồn có giá gốc và giá xuất tiếp1.000.000. Chrome kiểm tra chọn nguồn xóa giá cũ, nhập lại giá/chất lượng, dark/light/mobile. Logs artifacts/current-price-{ui,api}-tests.log, ảnh artifacts/current-price-recovery-{dark,light,mobile}.png.

Đã deploy Worker qlvt: 4e1d1be6-b203-42b2-b379-cb474f06c110, https://qlvt.tannamchinh.workers.dev.


### 27/10/2026 — Người dùng, phân quyền qua Cloudflare Access
Đã bổ sung AccessGate, nút mở tài khoản trên thanh đầu, trang Hệ thống → Người dùng, phân quyền; tạo email chờ liên kết, quản lý4 vai trò và kho được phép thao tác, khóa tài khoản giữ lịch sử, chặn tự khóa/hạ quyền quản trị. Migration0032 giữ tài khoản cũ đã liên kết; sao lưu trước cập nhật và FK check rỗng. Đạt134 frontend tests,124 Worker tests,lint/check/build; Chrome desktop/mobile sáng/tối. Cloudflare Access policy vẫn quản lý riêng, không gửi email hoặc tự tạo tài khoản trên nhà cung cấp. Chi tiết docs/18-user-access-20261027.md. Deploy749d01a8-38f1-4332-bd6f-5be97efd7c3b tại https://qlvt.tannamchinh.workers.dev.

### 2026-10-27 — Định giá tham khảo vật tư đang sử dụng đầu kỳ
- Phiếu in_use có bảng định giá bên dưới thông tin đang lắp và nút chuyển nhanh tới bảng: giá mua hiện tại, chất lượng còn lại 0–100%, người xác nhận, căn cứ xác nhận; giá trị tham khảo = giá hiện tại × chất lượng × số lượng.
- Máy chủ xác thực trường, số và loại phiếu; lưu dữ liệu cùng dòng phiếu và snapshot opening_reference_assessment trong labels khi ghi sổ. Có giá, chất lượng và người xác nhận hoặc căn cứ mới tính giá trị; thiếu dữ liệu để trống, 0% hợp lệ.
- Giá tham khảo không thay giá gốc, không tạo tồn kho và không sửa giá trị xuất gốc. Bản in hiển thị riêng bảng định giá nếu có khai báo.
- Nguồn thu hồi đầu kỳ chưa biết giá gốc mang theo tham chiếu này. Chỉ gợi ý giá mua hiện tại; phải xác nhận lại chất lượng và người đánh giá lúc tháo. Phiếu thu hồi cũ cũng nhận biết đúng nguồn để hiện ô giá hiện tại.
- Kiểm tra: 142 frontend tests, 131 Worker tests, TypeScript cả hai phần, build; kiểm tra giao diện sáng/tối/mobile, giá 5 triệu × 20% = 1 triệu, bản in và độ rộng bảng. Không thay schema, không ghi thử vào sổ kho thật.

### 2026-10-27 — Gộp định giá vào dòng vật tư đầu kỳ
Theo yêu cầu mới, bỏ bốn cột giá gốc/ngày lắp gốc/ODO lúc lắp/giờ lúc lắp khỏi giao diện và bản in. Thay ngay trong dòng vật tư bằng Nguyên giá → Tỷ lệ còn lại (%) → Giá trị còn lại → Căn cứ/người xác nhận. Không còn bảng định giá riêng, lời dẫn hoặc nút chuyển nhanh. Khi chọn vật tư, nguyên giá lấy unit_price_vnd từ DMVT nếu có giá dương, được sửa trực tiếp và lưu snapshot vào opening_current_unit_price; các lần tải hoặc sửa tỷ lệ không tự ghi đè nguyên giá đã nhập. Không đổi dữ liệu gốc/logic ghi sổ và thu hồi. Bản in có cùng bốn cột mới. Đã kiểm tra frontend 142 tests, TypeScript, build, giao diện sáng/tối/mobile và bản in; kiểm tra lấy giá DMVT 8.500.000, sửa thành 5.000.000 và tính 20% thành 1.000.000 khi có xác nhận.

### 2026-10-27 — Nhập nhanh vật tư đang sử dụng đầu kỳ
- Bỏ ô nhập Biên bản/căn cứ xác nhận; giữ người xác nhận. Dữ liệu căn cứ đã lưu trước đây vẫn được bảo toàn.
- Bật Nhập nhanh dòng cho opening/in_use với bảng có tiêu đề: Mã vật tư, Loại phương tiện, Biển số/mã thiết bị, Vị trí lắp, Số lượng, Serial, Nguyên giá, Tỷ lệ còn lại (%), Người xác nhận, Ghi chú. Sao chép bao gồm tiêu đề và nội dung dạng TSV tương thích Excel; dán ánh xạ theo tiêu đề, từ chối thiếu/trùng/không nhận diện cột hoặc lệch số ô. Có xem trước, sửa sẽ vô hiệu kết quả xem trước.
- Tra cứu vật tư và phương tiện hoạt động, đối chiếu loại xe và vị trí danh mục; một Serial/một dòng; không dùng tồn kho, VAT hay giá gốc. Nguyên giá trống lấy giá mua DMVT, cho sửa; giữ giá đã nhập. Thêm dòng vào phiếu giữ đúng ID và nhãn phương tiện. Server vẫn xác thực khi lưu.
- Kho quản lý hiện được giữ làm phạm vi phân quyền nguồn đang sử dụng (inventory line from_warehouse_id); không làm tăng tồn kho. Kho nhận lúc thu hồi được chọn riêng.
- Đã kiểm tra 143 frontend tests, TypeScript, build và trình duyệt: đảo thứ tự tiêu đề, copy đủ nội dung, tra xe/giá DMVT, tính tiền và sáng/tối/mobile. Không đổi schema hoặc dữ liệu thật.
