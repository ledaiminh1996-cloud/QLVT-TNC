# Bước 3 — Giao diện danh mục kết nối API

## Đã làm

Ứng dụng mở mặc định vào màn hình **Quản lý danh mục — Dữ liệu tập trung**. Năm danh mục vật tư, kho/bồn, phương tiện, nhân sự và nhà cung cấp đọc/ghi qua API cùng hostname tại `/api`.

- Kiểm tra `/api/auth/me` trước khi tải danh mục.
- Hiển thị riêng trạng thái đang tải, chưa đăng nhập, đăng nhập chưa cấu hình, chưa được cấp quyền, lỗi kết nối và danh sách trống.
- Tìm theo mã/tên, lọc trạng thái, phân trang từ máy chủ (25 bản ghi/trang).
- Admin/kế toán có thể thêm, sửa, ngừng sử dụng. Thủ kho/người xem chỉ có quyền đọc ở giai đoạn này, khớp quyền API.
- Sửa gửi phiên bản `version` và chỉ các trường thay đổi; lỗi 409 giữ biểu mẫu để người dùng đối chiếu, không thông báo lưu thành công.
- Khi lỗi mạng hoặc lỗi nhập liệu, biểu mẫu giữ dữ liệu đang nhập. Trong khi chờ lưu, khóa thao tác gửi lặp và đóng biểu mẫu.
- Khi mất quyền/phiên đăng nhập, quay về trạng thái truy cập và không chuyển tự động sang dữ liệu local.
- Kho/bồn nhập sức chứa theo đơn vị thực; giao diện chuyển sang hệ số 1.000 theo hợp đồng API. Ví dụ 25.000 lít lưu thành 25.000.000.
- Phương tiện chọn tài xế bằng ID nhân sự và tải đầy đủ các trang danh sách nhân sự. Trường ODO gửi số nguyên; API chặn giảm ODO.
- Hủy/loại bỏ kết quả tải cũ khi đổi danh mục để tránh hiển thị nhầm dữ liệu đến muộn.

Các trường tồn, giá vốn, vị trí kệ và định mức tồn theo từng kho chưa nối vì API sổ kho/part_warehouse_settings đang thuộc bước tiếp theo. Danh mục mới không hiển thị số tồn 0 giả định.

## Dữ liệu trên máy

Nút **Xem dữ liệu trên máy** mở giao diện cũ, với thông báo luôn hiện rằng các thay đổi chưa được lưu lên Cloudflare. Các khóa localStorage cũ không đổi, không bị xóa hay tự nhập vào database.

Chỉ khi người dùng chủ động mở chế độ này, LocalApp mới được render và đọc/ghi localStorage. Dữ liệu local không được dùng như bản dự phòng cho danh mục API. Những thay đổi ở hai chế độ chưa đồng bộ với nhau. Phiếu và báo cáo cũ vẫn thuộc chế độ dữ liệu trên máy.

## File chính

| File | Vai trò |
|---|---|
| src/App.tsx | Chọn màn hình dữ liệu tập trung hoặc giao diện local cũ. |
| src/components/CloudCatalogApp.tsx | Trạng thái truy cập, danh sách, bộ lọc, phân trang và biểu mẫu. |
| src/api/catalogClient.ts | Gọi API cùng hostname, kiểm tra phản hồi, ánh xạ thông báo lỗi, gửi version. |
| src/api/catalogFields.ts | Nhãn tiếng Việt, trường form, enum, chuyển đổi sức chứa và cách hiển thị. |
| tests/cloud-catalogs.test.tsx | Kiểm thử giao diện và hợp đồng API client. |

Backend, chính sách xác thực và database remote không được thay đổi trong bước này. Cấu hình Worker do người dùng cập nhật (`qlvt`, database `tnc-vattu`) được giữ nguyên.

## Chạy local

Trong thư mục `source-review` (khác thư mục `worker`):

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite chạy ở cổng 3000 và proxy `/api` tới Worker local cổng 8787 như cấu hình đã có. Mở trình duyệt theo địa chỉ mà Vite in ra. Để API local hoạt động cần chạy Worker local riêng; các API dữ liệu vẫn cần cấu hình đăng nhập và token hợp lệ, không có cách bỏ qua xác thực.

Trong thời gian Cloudflare Access đang tạm hoãn, màn hình chưa đăng nhập/chờ cấu hình là kết quả đúng. Có thể chủ động mở dữ liệu trên máy để xem giao diện cũ. Không có thao tác cấp quyền, đăng nhập thật hoặc nhập dữ liệu remote nào được thực hiện ở bước này.

## Kiểm tra

Chạy tại `source-review`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Đã kiểm tra TypeScript, 13 ca kiểm thử API client/giao diện bằng DOM giả lập và build Vite. Không coi các ca dùng API giả lập là đã xác nhận đăng nhập Access hay dữ liệu production. Backend có bộ kiểm thử riêng ở `worker/tests` của bước trước.

Đã sửa dependency esbuild từ nhánh 0.25 sang 0.28 để đáp ứng yêu cầu của Vite 8 hiện có. Thêm lockfile cho giao diện và thư viện kiểm thử; không dùng cờ bỏ qua xung đột dependency.

## Triển khai lên web

Chưa deploy giao diện mới. URL `https://qlvt.tannamchinh.workers.dev` hiện vẫn là Worker API như lần người dùng triển khai trước.

Trước khi đưa giao diện lên cùng hostname cần bổ sung binding ASSETS và cấu hình SPA, ưu tiên `/api/*` vào Worker. Thực hiện ở bước triển khai riêng để không thay đổi cấu hình remote hoặc bật truy cập ngoài ý muốn. Chưa thể sử dụng dữ liệu tập trung thật cho tới khi Cloudflare Access hoạt động và tài khoản D1 được cấp quyền.
