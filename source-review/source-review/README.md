# Quản lý vật tư Tân Nam Chinh

Giao diện React/Vite nằm trong `src/`. Backend Cloudflare Workers và D1 nằm trong `worker/`, có dependency và lockfile riêng.

- [Chuẩn kiến trúc đã thống nhất và trạng thái chuyển đổi](ARCHITECTURE.md)
- [Thiết kế database và quy tắc tồn kho](docs/01-database-design.md)
- [API Workers, đăng nhập, quyền và cách chạy local](docs/02-workers-api.md)
- [Giao diện danh mục kết nối API](docs/03-cloud-catalog-ui.md)

## Chạy giao diện

```powershell
npm install
npm run dev
```

Ứng dụng mở vào danh mục dữ liệu tập trung, gọi API cùng hostname tại `/api`. Vite proxy `/api` tới Worker local ở cổng 8787. Khi chưa thiết lập đăng nhập, giao diện hiển thị trạng thái chờ truy cập. Nút “Xem dữ liệu trên máy” mở giao diện cũ dùng localStorage, tách biệt với database.

Các danh mục đã kết nối API và được triển khai tại https://qlvt.tannamchinh.workers.dev. Phiếu nhập/xuất, sổ kho và báo cáo nghiệp vụ vẫn cần được kết nối API theo từng bước; không coi màn hình local cũ là dữ liệu máy chủ.

## Kiểm tra và chạy API

Yêu cầu Node >= 22.18; đã kiểm tra với Node 24.

```powershell
cd worker
npm ci
npm run db:migrate:local
npm run check
npm test
npm run build
npm run dev
```

`build` chỉ đóng gói thử (dry-run), không triển khai online. Endpoint `/api/health` kiểm tra D1 local. Những endpoint dữ liệu cần JWT Cloudflare Access hợp lệ và tài khoản được cấp quyền trong D1; xem tài liệu API để cấu hình.

Worker production là `qlvt`, database D1 là `tnc-vattu`, xác thực qua Cloudflare Access. Không tự động nhập seed hoặc số dư cũ vì cần đối soát số dư và liên kết trước. File `.dev.vars` và `.wrangler` không đưa vào Git.
