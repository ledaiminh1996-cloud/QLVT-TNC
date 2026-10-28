# Nhập PTTB và khung tham số / ghép thiết bị

Nguồn: DM_PTTB_lam_sach.xlsx, ngày 23/10/2026. Không sửa file nguồn.

- DM_THIET_BI: 531 dòng, 91 đầu kéo, 155 rơ moóc, 85 máy phát, 177 Cont, 12 xe văn phòng, 9 xe thuê ngoài, 2 xe tải thùng.
- Đầu kéo/rơ moóc/xe VP/xe thuê ngoài dùng vehicles. Xe tải thùng dùng vehicles.type=rented_truck để tương thích schema cũ, phân biệt chính xác bằng source_group=box_truck; API và UI lọc source_group. Không gộp 2 xe này vào nhóm xe thuê ngoài.
- Máy phát/Cont dùng equipment. Nhập đầy đủ metadata riêng: số khung/máy, tải trọng/số chỗ, quy cách, nguồn, đơn vị thuê, hợp đồng, nhóm tuyến, vị trí, loại máy phát và trạng thái gốc. Mã/serial/số khung/số máy lưu TEXT.
- Giá trị tải trọng Excel có sai số nhị phân được biểu diễn thập phân tối đa 3 chữ số, không tự gán đơn vị. File không có ODO/giờ hoạt động nên giữ mặc định kỹ thuật 0; chưa phải số đo đã xác nhận.
- Trạng thái gốc giữ original_status. Hoạt động -> active; Hư -> maintenance; Ngưng sử dụng/Làm kho -> stopped. Làm kho được giữ riêng để không coi là thiết bị đang vận hành.
- THAM_SO: 14 tham số nguồn + Hư từ dữ liệu thực tế = 15, chia nhóm tuyến / loại thiết bị / nguồn / trạng thái. CRUD độc lập trong menu Tham số phương tiện thiết bị; chưa gắn dropdown động với toàn bộ trường thiết bị ở bước khung này.
- GHEP_BAN_DAU: 151 dòng vào equipment_pairing_drafts. Tất cả là nháp, chưa ghép vận hành; thiếu ngày/người cập nhật giữ NULL. Có kiểm tra đầu kéo, đúng loại thiết bị con và chống trùng thiết bị con trong các nháp đang sử dụng. Chỉnh sửa có version/audit. Các quy tắc lịch sử ghép, tháo/ghép có hiệu lực chưa triển khai.
- DM_TAI_XE, Sheet1, HIEN_TRANG_GHEP được giữ trong bản trích xuất nguồn để tham chiếu; không tự tạo tài xế hoặc cập nhật phân công/ghép thực tế.
- Mọi tab tải 25 dòng/trang. Import tạo audit cho từng bản ghi, đã sao lưu và kiểm tra trên bản sao trước áp dụng.

## Biểu mẫu theo nhóm

Biểu mẫu đầu kéo/rơ moóc/xe và máy phát/Cont chỉ hiển thị trường liên quan; không nhập ODO ở bước danh mục này. Nguồn, nhóm tuyến, trạng thái dùng tham số đang hoạt động; giá trị lịch sử được giữ khi không đổi. Chỉ còn một ô Trạng thái, ghi original_status và đồng bộ trạng thái vận hành cho các trạng thái chuẩn. Các trường bị ẩn không bị xóa khỏi dữ liệu khi sửa.
