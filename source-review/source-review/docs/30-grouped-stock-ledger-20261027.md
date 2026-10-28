# Sổ theo dõi kho nhóm chứng từ — 27/10/2026

## Giao diện và nhóm

Màn book=stock chuyển sang StockLedger và API /api/stock-ledger. Hai sổ card/summary giữ nguyên. API inventory-books cũ còn để tương thích; giao diện Sổ theo dõi kho mới không gọi nó để lấy phát sinh.

Một cha theo ID chứng từ kho, kho, vật tư, trạng thái và chiều nhập/xuất. Vì phiếu xuất cũ có thể chia cùng vật tư thành nhiều dòng Serial, nhóm hợp nhất cả các dòng cùng bộ khóa này: nhập 50 lốp hoặc xuất 12 lốp đều một cha. Không nhóm hai kho, hai trạng thái hoặc hai vật tư khác nhau. Cha thể hiện tổng số lượng; chi tiết mới hiển thị Serial/phương tiện/số đo của từng dòng. Thông tin nhiều thiết bị/số đo được báo rõ thay vì lấy đại dòng đầu.

Mở bằng mũi tên, mỗi lần tải tối đa 100 chi tiết; có Tải thêm. Reopen có thể tải lại, không tự tải toàn bộ chi tiết khi vào sổ. Chỉ một biến thể desktop/mobile được mount để không gọi chi tiết hai lần. Kiểm tra version cha khi tải chi tiết; nếu phiếu đã sửa hoặc không còn trong scope trả 409 và yêu cầu tải lại.

Vật tư gồm mã/tên hai tầng, ĐVT kèm mã; mã là text. Loại phiếu chip màu. Phương tiện gộp biển số/mã và loại. Chưa có dữ liệu dùng dấu gạch ngang ASCII. Ngày CT chỉ ngày; giờ ghi sổ là cột phụ tùy chọn, UTC posted_at được định dạng theo giờ Việt Nam.

Kỳ dùng cùng receiptDateRange/nhãn Hôm nay, 7 ngày, Tháng này, Tháng trước, Tùy chọn của danh sách phiếu. Mặc định tháng hiện tại; 50/100 cha mỗi trang. Tìm số phiếu, Serial và biển số/mã thiết bị từ snapshot; có loại phiếu, kho, vật tư, trạng thái. Tìm Serial chỉ lọc cha có chứa Serial, không làm giảm tổng của cha.

## Số dư

Chỉ tính Tồn khi chọn một part_id. Không chọn: không chạy window sum hoặc truy vấn số dư tháng, cột Tồn là gạch ngang, nhắc chọn vật tư.

Tồn đầu kỳ là tổng tháng trước tháng bắt đầu + phần phát sinh đầu tháng trước ngày bắt đầu. Tồn sau cha chạy theo ngày chứng từ, thời gian CT và ID ổn định, partition vật tư/kho/trạng thái. Tính trước phân trang. Dòng tồn đầu/cuối kỳ theo từng kho/trạng thái được hiện đầu/cuối bảng. Phiếu DK đúng ngày bắt đầu vẫn là phát sinh nhập ở ngày đó; không tính hai lần vào đầu kỳ và nhập.

Mặc định thời gian tăng dần; nút đổi chiều chỉ đổi hiển thị, Tồn sau phát sinh giữ định nghĩa theo thứ tự thời gian. Chọn vật tư mới đưa chiều hiển thị về tăng dần.

Tìm kiếm và loại phiếu chỉ lọc danh sách cha, không thay số dư thật của vật tư. Khi có hai bộ lọc này, thẻ Nhập/Xuất đổi nhãn Nhập hiển thị/Xuất hiển thị và có chú thích Tồn vẫn tính đủ phát sinh. Các kho/trạng thái/vật tư được lọc ngay ở scope số dư. Không cộng số lượng khác ĐVT; thẻ báo Nhiều ĐVT và có diễn giải theo từng đơn vị.

## Bảng tổng hợp và hiệu năng

Migration 0036 tạo stock_book_flow (view từ phát sinh posted và snapshot trạng thái) và stock_book_months (net số lượng + số phát sinh theo tháng/vật tư/kho/trạng thái). Đây là bảng tổng hợp tháng, không phải bản sao tồn theo từng ngày. Đọc đầu kỳ cộng các dòng tháng trước theo khóa thay vì quét từng stock_movements của toàn bộ lịch sử; khoảng ngày tùy chọn chỉ quét thêm phần tháng đầu.

Trigger thêm/xóa/đổi lượng hoặc nguồn kho của stock_movements cập nhật bảng tháng cùng transaction. Chỉ đổi giá không ghi lại lượng tháng. Đổi ngày/trạng thái inventory_documents cũng chuyển đúng tháng hoặc loại khỏi posted. Xóa số phát sinh cuối của khóa thì xóa dòng tổng hợp đó; net=0 nhưng còn lịch sử vẫn giữ.

Danh sách chỉ đọc phát sinh trong khoảng CT đã chọn. Window chỉ cho vật tư được chọn; endpoint con không tính lại window/số dư. Phân trang/đếm/tổng/số dư cùng D1 batch. Tải meta chi tiết chỉ cho các cha của trang; xuất/in lấy đầy đủ cùng một batch và giới hạn 10.000 dòng chi tiết, vượt giới hạn yêu cầu lọc hẹp, không xuất thiếu.

Không hứa số liệu tài chính từ bảng lượng: giá trị quản trị/VAT/giá vốn và hai sổ NXT không thay đổi. Thủ kho vẫn chỉ thấy kho đã cấp ở cả danh sách, số dư, tìm kiếm, chi tiết, xuất và in. Tài khoản viewer có quyền đọc theo quy tắc hiện hành; mọi API cần phiên hợp lệ.

## Bố cục và xuất/in

Một vùng cuộn dọc trong bảng chiếm phần cao còn lại của viewport; header ghim, phân trang ngoài vùng cuộn ở đáy. Không cuộn ngang: desktop bảng fixed 100%, vùng nội dung hẹp chuyển thẻ đầy đủ thông tin. Mật độ Gọn mặc định 44px; Thoải mái 56px, lưu tùy chọn UI. Focus xám mảnh, placeholder tối tăng tương phản. Đã ghi sổ đặt cạnh tiêu đề. Header toàn ứng dụng được thu gọn riêng màn này để không chiếm chiều cao trên điện thoại.

Excel gồm sheet sổ theo cha và sheet chi tiết Serial để không cộng trùng cha/con. Mã và Serial vẫn dạng chuỗi, số lượng numeric, thiếu lượng không giả thành 0. Bản in A4 ngang đủ cha/con và đầu/cuối kỳ; giữ font chung, lặp tiêu đề bảng. Số phiếu mở bản gốc chỉ đọc.

## Sao lưu và kiểm tra

Bản sao trước migration: artifacts/before-grouped-ledger-20261027.sql, chứa dữ liệu nhạy cảm và không phân phối. Áp dụng thử 0036 trên bản sao: 58 bảng/15.672 dòng cũ nguyên trạng, giữ 189 đối tượng schema cũ, không lỗi khóa ngoại; hai dòng tổng hợp khớp ledger posted và stock_buckets. Thử đổi ngày và trạng thái trên bản sao vẫn khớp, rollback giữ dữ liệu gốc.

146 kiểm thử Worker/D1 và 161 kiểm thử UI/shared đạt; sau tối ưu đã kiểm tra lại các phần ảnh hưởng và runtime D1 với migration cuối. Kịch bản: nhập kỳ trước 50, nhập kỳ này 10 và xuất 12 dòng Serial -> hai cha; mở kỳ 50, sau nhập 60, sau xuất/đóng kỳ 48. Search một Serial vẫn giữ lượng cha 12 và Tồn 48. Có kiểm tra sửa/xóa nhập trước kỳ cập nhật bảng tháng, phân quyền, version và xuất đủ chi tiết.

Trình duyệt kiểm tra 50/12 Serial -> hai dòng đóng, mở chi tiết một lần, Tồn đầu/cuối, tăng/giảm, loại phiếu, mật độ 44/56, Kỳ, Excel và iframe in. Desktop và điện thoại không có cuộn ngang hoặc scrollbar trang lồng ngoài; header ghim và footer trong viewport. Ảnh/file thử tại artifacts/grouped-ledger-* chỉ là mẫu cục bộ.

## Triển khai 28/10/2026

Đã áp dụng 0036_stock_book_months.sql trên D1 production. Kiểm tra hai chiều stock_book_months so với stock_book_flow posted: không lệch hoặc thiếu dòng; PRAGMA foreign_key_check không có lỗi. Không sửa dữ liệu chứng từ gốc.

Đã giảm payload metadata cha: header/labels chứng từ chỉ đọc một lần cho mỗi nhóm, không lặp trong JSON của từng dòng Serial; kiểm thử grouped API và Worker typecheck đạt sau thay đổi.

Worker version 709d479f-a301-4034-914c-aa0d31eae2b8. Trang production trả 200, tải đúng index-DhJlxADd.js và index-PwzB4bRd.css; các bundle InventoryBooks và stockLedgerOutput trả 200. Endpoint mới khi chưa đăng nhập trả 401. Kiểm tra chức năng có dữ liệu thực hiện qua API/D1 runtime và trình duyệt cục bộ; không tạo chứng từ thử trên production.
