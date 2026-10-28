# Bước 2 — API Cloudflare Workers

Đã triển khai backend trong thư mục `worker/`. Chưa deploy lên Cloudflare; chưa nối các màn hình React với API. Database local trống, không tự nhập dữ liệu mẫu hoặc tạo tài khoản mặc định. Các bảng phiếu/biến động tồn đã có ở bước 1 nhưng **chưa có API ghi sổ** trong bước này.

## Cấu trúc

```text
worker/
  src/index.ts             Router, lỗi, request ID, kiểm tra nguồn gửi
  src/auth.ts              Xác minh JWT Cloudflare Access, tra tài khoản D1
  src/catalogs.ts          API danh mục, validation, phiên bản, ghi audit
  src/http.ts              JSON, giới hạn request, lỗi chuẩn
  src/types.ts             Kiểu môi trường, danh tính, vai trò
  tests/api.test.mjs        Kiểm thử API + SQLite và JWT có chữ ký
  tests/runtime.test.mjs    Kiểm thử trên runtime Workers + D1 local
  scripts/bootstrap-admin.mjs  Tạo file SQL cấp quản trị đầu tiên
  wrangler.jsonc           Cấu hình local D1, không có ID database remote
  .dev.vars.example        Mẫu hai biến Cloudflare Access
  package.json / package-lock.json / tsconfig.json
migrations/0002_catalog_versions.sql
```

Backend có package và lockfile riêng để kiểm tra độc lập, không thay đổi dependency giao diện. Root tsconfig loại trừ worker; mỗi phần có cấu hình TypeScript riêng. Vite đã có proxy `/api` tới `127.0.0.1:8787` để dùng khi nối giao diện.

## Đăng nhập và cấp quyền

Sử dụng **Cloudflare Access** làm cổng đăng nhập. Access cho phép chọn phương thức đăng nhập trong tài khoản Cloudflare; chưa cố định Google hay OTP email thay cho người quản trị. API kiểm tra JWT RS256 bằng JWKS chính thức của team, issuer, audience, thời hạn và các claim bắt buộc. Không chấp nhận chỉ một header email, không có chế độ bỏ qua xác thực cho local/production.

API nhận token qua `Cf-Access-Jwt-Assertion` do Access chuyển tiếp. Khi thử local có thể gửi token Access hợp lệ qua `Authorization: Bearer ...`. Các kiểm thử tự tạo cặp khóa và JWT chỉ trong test harness; production không có khóa hoặc công tắc test này.

Sau khi xác minh danh tính, API tìm tài khoản D1 bằng cả `auth_subject` và email. Người đã đăng nhập Access nhưng chưa được cấp tài khoản D1 chỉ xem được chính danh tính của họ qua `/api/auth/me`; không đọc danh mục. Tài khoản bị vô hiệu hóa cũng bị chặn.

| Vai trò | Đọc năm danh mục | Tạo/sửa/ngừng sử dụng danh mục | Quản lý tài khoản |
|---|---|---|---|
| admin | Có | Có | Có |
| accountant | Có | Có | Không |
| warehouse | Có | Chưa cấp ở bước này | Không |
| viewer | Có | Không | Không |

Thủ kho sẽ nhận quyền lập phiếu nhập/xuất khi API nghiệp vụ được xây dựng; hiện chưa có API phiếu. Admin không được tự hạ quyền, vô hiệu hóa hoặc đổi định danh đăng nhập của chính mình qua API.

Các route API được kiểm tra độc lập với chính sách Access bên ngoài. Khi deploy cần bảo vệ cả hostname frontend bằng Access để người chưa đăng nhập không mở được ứng dụng. `workers_dev` và preview URL hiện tắt; chưa có domain/route được cấu hình. Việc logout do Access quản lý, chưa tạo màn hình đăng nhập/logout trong React.

## Các endpoint đã có

| Method | Đường dẫn | Kết quả |
|---|---|---|
| GET | /api/health | Kiểm tra kết nối DB; không yêu cầu tài khoản, không trả cấu hình bí mật. |
| GET | /api/auth/me | Danh tính đã xác minh, tài khoản ứng dụng và access_granted. |
| GET | /api/parts | Danh sách vật tư. |
| GET | /api/warehouses | Danh sách kho/bồn. |
| GET | /api/vehicles | Danh sách phương tiện. |
| GET | /api/staff | Danh sách nhân sự/tài xế. |
| GET | /api/suppliers | Danh sách nhà cung cấp. |
| GET | /api/users | Danh sách tài khoản, chỉ admin. |
| GET | /api/{danh-mục}/{id} | Chi tiết. |
| POST | /api/{danh-mục} | Tạo mới, API sinh UUID; trả 201. |
| PATCH | /api/{danh-mục}/{id} | Sửa các trường được gửi, bắt buộc version hiện tại. |

`{danh-mục}` chỉ nhận parts, warehouses, vehicles, staff, suppliers, users. Không có PUT/DELETE và không xóa cứng. Ngừng sử dụng qua `is_active: 0`; xe dùng `status: "stopped"`.

GET danh sách hỗ trợ `q`, `page` (mặc định 1), `page_size` (mặc định 25, tối đa 100). Lọc `is_active=0|1`, riêng xe dùng `status=active|maintenance|stopped`. Mặc định trả cả bản ghi hoạt động và ngừng sử dụng. Sắp xếp theo id để phân trang xác định; tìm kiếm dùng LIKE của SQLite, chưa hỗ trợ tìm không dấu tiếng Việt. Dấu `%`/`_` trong từ khóa được coi là ký tự thường.

## Dữ liệu gửi lên

Tên trường theo snake_case của database. Số/bool dạng số phải đúng kiểu JSON; `is_active`, `has_reefer`, `is_serialized` nhận 0/1, không nhận true/false. Không gửi `id` hay `version` khi tạo mới. PATCH gửi trường cần thay và `version` lấy từ GET trước đó. Trường lạ bị từ chối; không cho gửi currentStock/avgCostPrice vào danh mục vật tư.

Ví dụ tạo vật tư:

```json
{
  "sku": "VT-LOC-001",
  "name": "Lọc nhớt động cơ",
  "category": "filters",
  "unit": "Cái",
  "applicable_for": "tractor",
  "lifespan_km_limit": 18000,
  "lifespan_days_limit": 120
}
```

Ví dụ cập nhật:

```json
{ "name": "Lọc nhớt động cơ — loại A", "version": 1 }
```

Những trường bắt buộc khi tạo:

| Danh mục | Trường bắt buộc |
|---|---|
| parts | sku, name, category, unit, applicable_for |
| warehouses | code, name, kind |
| vehicles | plate_number, type |
| staff | code, name |
| suppliers | code, name |
| users | auth_subject, email, display_name, role |

Các trường tùy chọn và giới hạn cụ thể nằm trong `worker/src/catalogs.ts` (đối tượng `catalogs`). Mã và biển số được trim/viết hoa; email viết thường. Không tự xóa tiền tố TN/TN-MP hoặc sửa dữ liệu lịch sử bằng suy đoán. `assigned_driver_id` phải tham chiếu nhân sự còn hoạt động khi gán. ODO chỉ nhận số nguyên không âm, không được giảm qua API này.

Kho/bồn có `capacity_milli` theo hệ số 1.000; 25.000 lít = 25.000.000. Đây là cấu hình sức chứa, chưa kiểm tra đầy bồn khi nhập vì chưa có API ghi sổ. Tồn tối thiểu/vị trí kệ của `part_warehouse_settings` và báo cáo `current_stock` sẽ được nối ở bước API kho tiếp theo, chưa có route riêng.

## Quy tắc cập nhật và lỗi

- Mọi truy vấn giá trị đều dùng bind parameter; tên bảng/cột chỉ lấy từ danh sách cố định trong source.
- Tạo/sửa và audit chạy trong cùng `D1.batch()`. Audit thất bại thì thay đổi danh mục rollback.
- PATCH dùng điều kiện `WHERE id = ? AND version = ?`, tăng version. Nếu người khác đã sửa sẽ trả 409, không ghi đè và không tạo audit cho thao tác thất bại. Client cần tải lại và cho người dùng đối chiếu.
- Kiểm tra JSON và giới hạn tối đa 32 KB, kể cả request không có Content-Length. Mutation từ Origin khác hoặc Sec-Fetch-Site cross-site bị chặn. Không bật CORS cho website bên ngoài.
- API trả Cache-Control: no-store, X-Content-Type-Options: nosniff, X-Request-Id. Lỗi trả mã lỗi, thông báo và request_id; không trả stack trace/SQL/token.
- 400 dữ liệu không hợp lệ; 401 thiếu/sai/hết phiên; 403 thiếu quyền; 404 không tìm thấy; 405 sai method; 409 trùng mã/sai phiên bản/liên kết không hợp lệ; 413 request quá lớn; 415 sai Content-Type; 503 chưa cấu hình Access. Lỗi hạ tầng chưa phân loại trả 500.

## Chạy local

Yêu cầu Node >= 22.18. Khuyến nghị dùng cùng Node 24 như môi trường đã kiểm tra.

Trong thư mục `worker`:

```powershell
npm ci
npm run db:migrate:local
npm run check
npm test
npm run build
npm run dev
```

`build` chỉ chạy `wrangler deploy --dry-run`, không deploy. `dev` chỉ lắng nghe 127.0.0.1:8787. DB local nằm trong worker/.wrangler/ và bị loại khỏi Git; khác hoàn toàn D1 trên Cloudflare. `/api/health` chạy được với database local đã migrate; các API khác trả 401 khi chưa có token, hoặc 503 nếu có token nhưng thiếu cấu hình Access. Đây là hành vi dự kiến.

Sao chép `.dev.vars.example` thành `.dev.vars`, điền ACCESS_TEAM_DOMAIN (chỉ hostname của team) và ACCESS_AUD (AUD ứng dụng Access). Không đưa file này vào Git. Không dùng thông tin giả để bật quyền. Khi nối UI, chạy Vite ở thư mục source-review và Worker trong cửa sổ terminal thứ hai; gọi API bằng đường dẫn tương đối `/api/...`.

## Cấp quản trị đầu tiên

1. Cấu hình Access, đăng nhập bằng danh tính thật và đọc `/api/auth/me`. Lấy `identity.subject` và email từ kết quả đã xác minh.
2. Tạo file SQL để xem xét (thay các giá trị mẫu dưới đây bằng thông tin thật):

```powershell
node scripts/bootstrap-admin.mjs --email "EMAIL_THAT" --subject "SUB_TU_AUTH_ME" --name "TEN_QUAN_TRI" --out bootstrap-admin.sql
```

3. Đọc file rồi áp dụng vào **local** khi kiểm thử:

```powershell
npx.cmd wrangler d1 execute tnc-vattu --local --file bootstrap-admin.sql
```

Script chỉ tạo file, không tự kết nối database; không ghi đè file đã tồn tại. SQL chỉ cấp admin nếu chưa có admin nào; có ghi audit. Sau đó tài khoản admin dùng `/api/users` để cấp những người khác. Đưa file SQL sinh ra vào nơi riêng tư; mẫu `bootstrap-*.sql` đã được ignore. Chưa chạy cấp tài khoản nào trong lượt làm việc này.

## Khi chuẩn bị deploy

Chưa có database remote, Access team/AUD hay domain của người dùng nên chưa thể gọi là đã triển khai online. Ở bước deploy sẽ tạo D1, điền database_id thật vào cấu hình riêng theo môi trường, áp dụng migrations đúng database, cấu hình Access và route hostname. Nếu phục vụ cả React từ Worker sẽ bổ sung ASSETS trỏ tới bản build React và SPA fallback; `/api/*` phải ưu tiên Worker, không trả index.html khi API không tồn tại. Cấu hình hiện tại là API local, chưa chứa ASSETS/frontend.

Không có script deploy tự động trong package để tránh nhầm với đóng gói thử. Không có tài khoản/mật khẩu mặc định hay cơ chế tự nâng tài khoản đầu tiên thành admin khi truy cập web.

## Kiểm chứng đã thực hiện

- TypeScript strict của Worker đạt.
- Hai migration đã áp dụng thành công bằng Wrangler vào D1 local.
- 22 ca kiểm thử đạt, gồm JWT hết hạn/sai chữ ký/issuer/audience, quyền, danh mục, trùng mã, dữ liệu sai, stale update, tranh chấp đọc–ghi, rollback audit, cấp admin đầu tiên, giới hạn request và nguồn gửi.
- Kiểm thử tích hợp chạy trên runtime Workers/Miniflare với D1 local: xác minh JWT có chữ ký, tạo/sửa vật tư, ghi audit cùng batch, chặn trùng và version cũ.
- Đóng gói Worker dry-run thành công. Chưa gọi Cloudflare production, chưa kiểm thử đăng nhập Access với tài khoản thật, chưa build lại giao diện React.

## Tài liệu Cloudflare

- [Xác minh JWT Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [D1 batch và giao dịch nguyên tử](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
