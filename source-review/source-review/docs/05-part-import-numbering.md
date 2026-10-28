# Danh mục VT-TB: Import, cấp mã tự động và giao diện đồng bộ

## Giao diện

VT-TB và Phương tiện dùng cùng bố cục với Nhân sự/Kho/Nhà cung cấp: khung tiêu đề nền trắng, nút Thêm màu xanh, Export, ô tìm kiếm, bảng chữ nhỏ và nút sửa/xóa dạng biểu tượng màu vàng/đỏ. VT-TB có thêm Import Excel. Tất cả nằm trong menu webapp, lưu qua API.

## Quy tắc đã thống nhất

```text
Loại hàng - Mã đối tượng - Mã nhóm - số thứ tự 4 chữ số
M-IN-TDONG-0001
M-IN-TDONG-0002
M-IN-LOP-0001
```

| Loại hàng | Mã |
|---|---|
| VẬT TƯ | M |
| DỊCH VỤ | G |
| THANH LÝ | T |
| HÀNG CŨ | C |

Số tăng **riêng cho từng bộ** Loại hàng/Mã đối tượng/Mã nhóm, bắt đầu 0001. Không đặt lại theo năm. Không tái sử dụng mã đã ngừng sử dụng. Tối đa 9999 cho một bộ; đạt giới hạn thì từ chối và cần quy tắc mở rộng riêng, không tự chuyển sang năm chữ số.

Mã đối tượng và mã nhóm là hai danh mục riêng, độc lập, có mã, tên và trạng thái. Không suy đoán ý nghĩa của IN hoặc TDONG; người quản trị tự nhập tên chính thức. Mã gồm chữ A–Z/số, tối đa 20 ký tự, không có khoảng trắng/gạch nối/dấu tiếng Việt; API tự viết hoa. Mã đã có vật tư tham chiếu không đổi được do khóa ngoại; có thể đổi tên hoặc ngừng sử dụng.

Phân biệt **Mã nhóm** của mã vật tư (ví dụ TDONG) và **Nhóm vật tư/Nhóm kỹ thuật** (lốp, dầu, lọc...) phục vụ phân loại kỹ thuật hiện có. Hai trường có mục đích khác nhau.

## Cách sử dụng

1. Menu Danh mục → **Mã đối tượng VT-TB**: thêm mã và tên, ví dụ IN với tên thật do doanh nghiệp quy định.
2. Menu Danh mục → **Mã nhóm VT-TB**: thêm mã và tên, ví dụ TDONG.
3. Danh mục VT-TB → Thêm vật tư: chọn Loại hàng, Mã đối tượng, Mã nhóm; nhập tên/đơn vị/các thông tin còn lại.
4. Biểu mẫu hiển thị cấu trúc với ####. Số chính xác do máy chủ cấp khi lưu, không lấy số trong trình duyệt.
5. Sau khi lưu, mã thật được trả về và hiển thị trong bảng.

Cấu trúc mã/SKU của vật tư đã tạo được giữ nguyên khi sửa; không tự đổi mã chứng từ cũ. Danh mục cũ có SKU khác cấu trúc này vẫn được đọc/sửa thông tin, không tự đánh lại mã.

## Import

VT-TB → **Import Excel** → tải file mẫu CSV hoặc chọn file .xlsx/.csv/.tsv/.txt, hay dán bảng từ Excel. File Excel đọc sheet đầu tiên; .xls cần lưu lại thành .xlsx. Giới hạn file 5 MB, tối đa 100 dòng mỗi lượt; giới hạn thực thi tài khoản D1 vẫn áp dụng cho một lượt nhập.

Cột mẫu:

```text
Loại hàng | Mã đối tượng | Mã nhóm | Tên vật tư | ĐVT | Nhóm kỹ thuật | Áp dụng cho | Mã vật tư
M        | IN           | TDONG   | Tên thật   | Cái | accessories   | both        |
```

- Để trống Mã vật tư để cấp tự động.
- Nếu có mã đúng cấu trúc như M-IN-TDONG-0002, hệ thống giữ mã đó. Nếu thiếu các thành phần mã thì có thể tách từ SKU này; nếu các thành phần đã nhập nhưng không khớp thì báo lỗi.
- Các mã đối tượng/nhóm phải tồn tại và đang sử dụng trên máy chủ. Import không âm thầm tạo các danh mục mã này.
- Nhóm kỹ thuật và Áp dụng cho hỗ trợ giá trị hệ thống hoặc nhãn trong biểu mẫu; bỏ trống lần lượt dùng accessories và both.
- CSV hỗ trợ ô có dấu phẩy/ngoặc kép/xuống dòng; hỗ trợ UTF-8 BOM, dấu tab và chấm phẩy.
- Xem trước trước khi bấm nhập. Mã tự động chỉ được cấp lúc lưu, không giữ số khi xem trước/hủy.
- Đây là **thêm mới**, không tự cập nhật vật tư trùng mã. Trùng SKU hoặc dữ liệu sai sẽ báo lỗi và hoàn tác cả lượt nhập.
- Không nhập tồn kho/giá vốn từ danh mục. Cột chưa hỗ trợ bị báo lỗi thay vì bỏ qua dữ liệu.
- Nếu mất kết nối sau khi gửi, giữ nguyên bản xem trước và thử lại. Mã lượt nhập + hash nội dung giúp trả lại kết quả lượt đã thành công mà không thêm lại. Thay file/nội dung hoặc phân tích lại tạo lượt mới.

## Bảo đảm dữ liệu

Migration `0004_part_numbering.sql` thêm part_objects, part_groups, part_sku_sequences, part_import_batches và ba cột mã phân loại trên parts. Không sửa lại SKU cũ, không xóa dữ liệu.

Cấp số + tạo vật tư + audit chạy cùng batch D1. Bộ đếm đối chiếu cả SKU đã tồn tại cùng tiền tố để không đụng mã nhập sẵn. Mã đối tượng/nhóm đang sử dụng được kiểm tra lại trong SQL ghi. Lượt nhập ghi mã batch cùng toàn bộ vật tư/audit trong một batch; nếu lỗi thì số cấp và dấu lượt nhập cũng rollback.

API mới:

- `/api/part-objects`, `/api/part-groups`: GET/POST/PATCH theo quyền danh mục hiện có, có version.
- POST `/api/parts`: khi có các thành phần mã và không gửi SKU sẽ tự cấp mã; vẫn hỗ trợ dữ liệu mã cũ qua API để tương thích.
- POST `/api/parts/import`: `{ batch_id, rows }`; 1–100 dòng, tối đa 512 KB JSON. Chỉ admin/kế toán.

## Cập nhật online

Trong PowerShell:

```powershell
cd "C:\Users\BaOBaODz\Documents\ChatGPT\QLVT AI STUDIO\source-review\worker"
npx.cmd wrangler d1 migrations apply tnc-vattu --remote
cd ..
npm.cmd ci
npm.cmd run build
cd worker
npx.cmd wrangler deploy
```

Chạy migration trước khi deploy vì API mới cần các bảng/cột mới. npm ci ở thư mục source-review cài thêm thư viện đọc Excel theo lockfile. Tải lại web bằng Ctrl+F5 sau deploy. Không có lệnh deploy/ghi database remote nào được thực hiện trong quá trình phát triển này.

## Kiểm chứng

20 ca giao diện/client/parser và 27 ca API/bootstrap/runtime đạt. Có kiểm tra riêng prefix độc lập, mã nhập sẵn, không tái dùng số đã ngừng sử dụng, tràn 9999, rollback cả số cấp khi import lỗi, idempotency khi gửi lại và bốn yêu cầu cấp mã đồng thời trên Workers/D1 local. Đã kiểm tra TypeScript và build giao diện. Chưa kiểm thử với Access/database production của người dùng.
