# Trang công khai trước Access — cấu hình cần hoàn thiện

Ngày27/10/2026. Người mới truy cập root hiện bị chuyển302 sang Cloudflare trước khi Worker/HTML chạy. Vì vậy frontend AppEntrance đã xây vẫn ở sau lớp Access. Không thể sửa thứ tự này chỉ bằng React/CSS.

## Kết quả kiểm tra
Root /, asset giao diện và API đều chuyển sang misty-disk-6b97.cloudflareaccess.com. Trang xác thực người dùng gửi chỉ có Identity Provider Cloudflare; không thể coi email OTP đã được bật. OAuth triển khai hiện đọc Worker/D1 được, nhưng GET Access organizations trả403 Authentication error; danh sách Access apps không trả ứng dụng QLVT để có thể sửa có căn cứ. Không tự thay gate hoặc tạo policy mới khi chưa đọc được cấu hình hiện hành.

## Thay đổi dự kiến để duyệt trên cấu hình thực
- Phục vụ công khai HTML root và các tài nguyên giao diện. Không chứa dữ liệu nghiệp vụ trong tài nguyên tĩnh.
- Giữ Access ở /api và /api/*; Worker tiếp tục xác minh chữ ký, issuer, audience và tài khoản hoạt động/quyền kho với mọi API dữ liệu.
- Ưu tiên chỉnh phạm vi của chính ứng dụng Access hiện tại để giữ audience/subject. Nếu có Worker-level/account-level Access, cần xử lý lớp toàn Worker tương ứng, chỉ sau khi API đã có gate chính xác. Không bỏ gate toàn Worker trước khi kiểm tra bảo vệ API.
- Giữ api/auth/login là điểm bắt đầu xác thực; gọi auth/me từ trang công khai không được tự điều hướng cả trang. Cấu hình IdP email OTP và allow-list theo quyết định triển khai; tài khoản có liên kết sẵn phải được kiểm tra continuity trước khi đổi IdP để không khóa quản trị.

## Kiểm tra nghiệm thu sau thay đổi
Ẩn danh mở root phải200 HTML và hiện trang Tân Nam Chinh; assets tải được. Chưa bấm Đăng nhập không rời trang. Bấm Đăng nhập chuyển Access. API dữ liệu chưa xác thực phải bị chặn (401/302); không trả danh sách/tồn hay nhận ghi phiếu. Sau Access thành công, auth/me trả đúng tài khoản đang hoạt động, người chưa cấp/tài khoản khóa không được vào. Kiểm tra admin và thủ kho hiện có không mất liên kết. Lưu snapshot cấu hình Access trước thay đổi và xác minh qua trình duyệt ẩn danh thực, không chỉ mock.

Cần mở Workers & Pages → qlvt → Access để xem lớp bảo vệ hiện tại, hoặc cấp phiên quản trị Access có quyền đọc/sửa Apps and Policies qua cơ chế cấu hình an toàn. Không yêu cầu gửi mật khẩu/API token vào chat.


### 27/10/2026 — Đã hoàn tất chuyển khỏi Cloudflare Access
Người quản trị đã thiết lập mật khẩu (ready_admins=1, setup token used=1) và đổi policy Access sang Bypass. Kiểm tra trực tiếp bằng trình duyệt sạch: root200 hiển thị form email/mật khẩu Tân Nam Chinh, không có điều hướng cloudflareaccess.com. GET /api/auth/me,/api/parts,/api/user-management,/api/document-drafts?kind=receipt và POST /api/document-drafts không cookie đều401 JSON. Một lần thử đăng nhập email ngẫu nhiên không tồn tại trả401 với thông báo chung, không tạo cookie phiên; kiểm tra này chỉ ghi bộ đếm đăng nhập, không tạo tài khoản/phiếu/tồn. Desktop/mobile không tràn, không lỗi JS. Bản triển khai vẫn87ef1968-a67e-4271-8c4c-ff37c46dda3d; không cần deploy lại sau đổi policy. Script worker/scripts/verify-native-cutover.mjs, ảnh artifacts/native-cutover-live-{desktop,mobile}.png.
