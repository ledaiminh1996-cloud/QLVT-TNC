# Tìm kiếm tiếng Việt không phân biệt hoa/thường

- Dùng shared/searchText.ts: normalizeSearch chuẩn hóa NFD + lowercase tiếng Việt; searchIncludes và searchPattern dùng chung giữa UI/API. Không đổi chuỗi gốc, giữ ý nghĩa dấu tiếng Việt.
- Migration 0015 tạo search_character_map và catalog_search dẫn xuất theo resource/entity/field. Trigger tự cập nhật khi thêm, sửa, xóa (kể cả nhập SQL trực tiếp). Backfill dữ liệu hiện tại không sửa bảng nghiệp vụ.
- SQLite LIKE/LOWER mặc định không đủ cho chữ hoa có dấu; đọc catalog_search đã chuẩn hóa, không tải toàn danh mục về trình duyệt để tìm. Bảo toàn phân trang/tổng số/lọc trạng thái và escape ký tự %, _, dấu gạch chéo.
- API danh mục và tìm bộ ghép đều dùng dữ liệu tìm kiếm dẫn xuất. Các màn hình dữ liệu cũ và cache tham số dùng cùng helper.
- Khi bổ sung trường/resource có tìm kiếm cần thêm trigger/backfill tương ứng bằng migration mới; chỉ mục hiện có theo resource/entity/field. Không xóa hoặc sửa dữ liệu dẫn xuất thủ công.
- Kiểm thử: ĐẠI LONG / Đại Long / đại long, Unicode ghép/tách dấu, dữ liệu gốc không đổi, cập nhật/xóa trực tiếp, lỗi audit rollback, tìm trên runtime D1.
