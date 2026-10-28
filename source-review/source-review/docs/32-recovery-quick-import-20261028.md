# Sửa nhập nhanh thu hồi — 28/10/2026

Nguyên nhân: DocumentQuickImport chưa gắn usage_id cho recovery, nên Worker chặn “Chọn lần xuất/lắp gốc còn đang sử dụng”. Đã truyền DocumentClient, phương tiện, ngày chứng từ và các dòng hiện có từ editor sang import; resolver đọc recovery-sources có phân quyền, gồm nguồn xuất và đầu kỳ đang sử dụng. Không đổi máy chủ hoặc schema, các kiểm tra khi ghi sổ được giữ nguyên.

Serial được đối chiếu chính xác theo part_id và serialKey, phân trang nguồn đầy đủ; nhiều Serial khác usage tách thành các dòng đúng nguồn. Lượng thường chỉ tự chọn khi có duy nhất nguồn phù hợp; nếu nhiều nguồn yêu cầu số phiếu và phương tiện (hai cột mới không bắt buộc trong mẫu TSV, bảng cũ vẫn đọc được). Không tìm thấy/nguồn sau ngày chứng từ/trùng Serial/vượt lượng cộng dồn cả dòng có sẵn đều chặn ở xem trước. Không tự chọn đại nguồn khi mơ hồ. Xem trước hiện phiếu nguồn và phương tiện. Nguồn đầu kỳ mang nguyên giá/người xác nhận, dùng tỷ lệ đầu kỳ khi ô chất lượng để trống; tỷ lệ nhập mới được ưu tiên.

Kiểm tra 165 UI/shared đạt, frontend typecheck và build đạt. Có kiểm thử parser tiêu đề cũ/mới, các nguồn qua nhiều trang, tách usage, thừa lượng từng phần/cộng dồn, trùng Serial, thiếu/đa nguồn, giới hạn ngày, kế thừa giá và editor dán bảng→xem trước→thêm dòng có giá trị đầu kỳ. Không tạo dữ liệu thử trên production.

Đã triển khai version 92cfa652-21c9-4ba0-a01e-a4b454021232. Production root trả 200, tải index-DdoWzd8M.js; bundle nhập liệu receiptListUtils-TakinNtz.js trả 200.
