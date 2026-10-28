# Bản dựng chứng từ — chuẩn bị trước khi nối sổ kho

Ngày 24/10/2026. Nguồn yêu cầu: [tài liệu v174](reference/Tom_tat_chung_tu_va_luong_du_lieu_v174.md).

## Tình trạng bàn giao

**Chỉ thay đổi và kiểm thử cục bộ. Chưa deploy Worker, chưa chạy migration remote, không gọi D1 cloud.** D1 production đang hết hạn mức đọc. Không tự coi bản dựng này đã có hiệu lực trên webapp cloud.

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
