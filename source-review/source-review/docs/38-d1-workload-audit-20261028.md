# Kiểm tra lượng truy vấn D1 — 28/10/2026

## Phạm vi

Kiểm tra theo yêu cầu người dùng; không sửa mã ứng dụng, cấu hình đăng nhập, bảng hoặc dữ liệu production. Đọc GraphQL Analytics với phiên Cloudflare đang có; không xuất token. Phân tích kế hoạch truy vấn và thử phương án tối ưu trên bản dump đã có trong bộ nhớ cục bộ. Không chạy lại báo cáo nặng trên D1 để đo tải.

Khoảng thống kê chính: 00:00 đến 15:36 ngày 28/10/2026 giờ Việt Nam (2026-10-27T17:00Z đến 2026-10-28T08:36Z). Analytics và query insights là hai dataset Adaptive; số ước lượng có thể khác khi đổi chiều nhóm/thời điểm lấy, không cộng hoặc đối chiếu chúng như bộ đếm chính xác từng request. Insights không lưu bound parameters hay người gọi, nên xác định được họ SQL/nghiệp vụ, chưa quy chính xác người dùng/thao tác đơn lẻ.

## Số liệu

Dataset d1AnalyticsAdaptiveGroups: readQueries 2.165; writeQueries 591; rowsRead 1.302.158; rowsWritten 1.785. Đây là số lượt SQL và số dòng quét khác nhau, không phải 1,3 triệu lần người dùng gửi yêu cầu.

Các cửa sổ 5 phút có lượng đọc lớn trên biểu đồ Metrics:

| Giờ VN bắt đầu cửa sổ | Rows read (ước lượng) | Nhóm nghiệp vụ chính qua Query Insights |
|---|---:|---|
| 11:15 | 158.454 | Tìm phương tiện/vật tư, tải/chọn chứng từ |
| 13:40 | 146.357 | Sổ theo dõi kho |
| 14:25 | 146.821 | Sổ theo dõi kho, tìm danh mục phụ |
| 14:55 | 233.197 | Sổ theo dõi kho, đặc biệt nhánh tìm kiếm |

Gộp họ SQL từ Query Insights trong cùng ngày (147 nhóm SQL): Sổ theo dõi kho khoảng 757.062 dòng đọc / 250 lần chạy SQL; tìm kiếm/tải danh mục khoảng 348.105 dòng (bao gồm nhóm catalog_search, danh sách parts và vehicles); nguồn sử dụng/thu hồi khoảng 38.302 dòng; sổ NXT khoảng 35.670 dòng / 90 lần chạy SQL. Số này là ước lượng Query Insights, không phải phân bổ kế toán khớp tuyệt đối dataset Metrics.

## Nguyên nhân đã xác nhận trong mã

1. worker/src/stockLedger.ts: một lần tải thường gửi 4 SQL trong một batch. Bảng, count và tổng lượng từng lặp CTE source/rows/grouped/matched; SQL số dư dù không chọn vật tư là một truy vấn hằng rỗng. Nhánh tìm kiếm gộp EXISTS trên rows + LEFT JOIN danh sách Serial + JSON nhãn/phương tiện, và chạy sau khi nhóm/tính số dư để giữ đúng nghiệp vụ. Mỗi lượt lọc có thể đọc lặp metadata theo dòng/Serial. Truy vấn nhiều nhất trong thống kê 24h đầu tiên trung bình 7.091 dòng/lần; đợt 14:55 trên dataset nhóm cửa sổ có nhóm trung bình khoảng 10.562 dòng/lần. Không được so khớp trực tiếp tổng của hai dataset adaptive.
2. worker/src/catalogs.ts: tìm kiếm dùng EXISTS catalog_search với LIKE %từ khóa%, sau đó chạy riêng SELECT danh sách và count. Chỉ trả một kết quả vẫn có thể duyệt nhiều bản ghi/các trường tìm kiếm; phương tiện thấy trung bình khoảng 2.679 dòng/SQL. SQL count còn quét đủ kết quả khi danh sách chỉ cần trang đầu. CatalogPicker và danh sách có debounce 250ms, mỗi lần dừng gõ hoặc mở lại picker có thể gọi lại, chưa có cache phạm vi phù hợp.
3. Sổ NXT cũng lặp CTE cho bảng/count/tổng/nhóm đầu cuối, chưa cache tổng khi chuyển trang. Trong số liệu hôm nay đây là nguồn nhỏ hơn, không phải nguồn lớn nhất.
4. Không thấy setInterval/polling hay retry vô hạn trong StockLedger/NxtBooks/CatalogPicker. Các effect có hủy phản hồi cũ và debounce; việc hủy ở trình duyệt không bảo đảm SQL đã chạy trên máy chủ được hoàn tác. Không kết luận toàn hệ thống không có vòng lặp chỉ từ kiểm tra các màn này.
5. Kiểm tra đăng nhập chỉ khoảng 1.758 dòng đọc trong nhóm SQL được thống kê; không phải nguồn đọc lớn. Bảo trì lịch sử và sao lưu hôm nay có phần tải riêng; đợt tăng lớn nhận diện được theo SQL báo cáo/danh mục, không được quy toàn bộ cho bảo trì. Không đủ log request/user lịch sử để tách chính xác phần do người dùng và phần đối chiếu kỹ thuật. Các kiểm tra UI/Worker thông thường chạy cục bộ; một số đối chiếu handler/D1 và bảo trì thực tế có chạm production theo phạm vi đã cho phép.

## Kiểm chứng cục bộ

Bản sao lưu lúc trước sửa thiết bị có 46 movements, 66 dòng inventory, 9 drafts, 144 draft serials, 561 vật tư, 269 phương tiện và 10.444 dòng catalog_search. Kế hoạch SQLite xác nhận source bị scan, nhiều correlated subqueries, JSON virtual scans và temporary group/order; catalog count scan vehicles rồi tra search theo từng entity.

Prototype chỉ trên bản sao cục bộ: giữ source/rows dạng MATERIALIZED, cùng kỳ và từ khóa biển số. Ba SQL bảng/count/tổng giảm tổng khoảng 292.100 xuống 169.200 bước máy SQLite (khoảng 42%). Kết quả nghiệp vụ khớp sau chuẩn hóa thứ tự mảng metadata không có ORDER BY. Đây là số bước thực thi cục bộ, không phải số rows_read trên D1 và không phải cam kết giảm 42% trên production. Chưa sửa/triển khai prototype; cần kiểm thử đủ tìm Serial, quyền kho, số dư, xuất/in trước khi áp dụng.

## Ưu tiên xử lý

- Trước tiên tối ưu Sổ theo dõi kho: tránh dựng/duyệt lặp cùng nguồn, tách tra Serial và phương tiện thay vì nhân dòng Serial cho điều kiện biển số; bỏ truy vấn hằng dư thừa. Giữ nguyên quy tắc bộ lọc chỉ đổi dòng hiển thị sau tính tồn.
- Tiếp theo tối ưu autocomplete: dùng tra mã chính xác trước khi fallback tìm chứa; chế độ picker chỉ lấy trang + has_more khi không cần tổng; cache ngắn hạn theo tài khoản/quyền/kho/trạng thái và hủy khi danh mục đổi. Không tự đổi ý nghĩa tìm kiếm hay phân quyền.
- Sau đó tái dùng tổng báo cáo khi chỉ chuyển trang/đổi chiều; cache có phạm vi, thời hạn và invalidation sau ghi sổ. Không cache xuyên người dùng hoặc giữ tồn đã cũ.
- Đo lại cùng thao tác bằng rows_read, rows_returned, số SQL/request và latency trước/sau, không chỉ nhìn số câu query.

## Bằng chứng

- artifacts/d1-workload-today-20261028.json: Metrics 5 phút và họ SQL trong ngày.
- artifacts/d1-workload-windows-20261028.json: SQL theo cửa sổ 5 phút.
- artifacts/d1-local-query-plans-20261028.json: kế hoạch cục bộ.
- artifacts/d1-offline-prototype-20261028.json: so sánh bước thực thi.
- Tài liệu Cloudflare: https://developers.cloudflare.com/d1/observability/metrics-analytics/ .
