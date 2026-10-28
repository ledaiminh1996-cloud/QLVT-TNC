# Các nhóm thiết bị và bộ ghép nháp

- Máy phát: mã, loại máy phát, trạng thái, ghi chú. Cont: mã, quy cách, nhóm tuyến, vị trí, trạng thái, ghi chú. Tên/serial đã nhập vẫn được giữ trong dữ liệu; bản ghi mới tự lấy tên theo mã.
- Xe văn phòng/tải thùng chung một tab, có cột Nhóm xe và lựa chọn nhóm trong form. Giữ subtype gốc: office_car và box_truck (box_truck dùng vehicles.type=rented_truck, phân biệt bằng source_group). Lọc gộp trên máy chủ, không gộp lẫn 9 xe thuê ngoài.
- Xe thuê ngoài: biển số, nguồn, đơn vị cho thuê, tải trọng/số chỗ, trạng thái, ghi chú. Không tự thêm đơn vị vào số tải trọng nguồn.
- Ghép thiết bị hiển thị mỗi đầu kéo một dòng, rơ moóc và tối đa hai máy phát. Chỉ là bộ ghép nháp, không cập nhật gắn linh kiện, phân công tài xế hoặc ghép vận hành.
- Các link hiện có vẫn ở equipment_pairing_drafts. Migration 0014 chỉ thêm pairing_set_versions và trigger đồng bộ version khi sửa từng link; không viết lại 151 link nhập ban đầu.
- API /api/equipment-pairing-sets GET phân trang 25 đầu kéo; tìm cả đầu kéo và thiết bị con. PATCH cập nhật cả bộ trong D1.batch, check version nguyên tử bằng CHECK, audit, chống trùng thiết bị con; bỏ link bằng is_active=0 giữ lịch sử. Giữ metadata ngày/ghi chú của các link không đổi.
- Nếu dữ liệu hiện tại có hơn một rơ moóc, hơn hai máy phát hoặc có Cont, không tự rút gọn; yêu cầu rà soát trước khi lưu.
- Nhận diện mutation thành công bằng RETURNING id, không dùng tổng meta.changes của D1 vì tổng này bao gồm cả trigger. Kiểm tra version và audit giữ nguyên.
