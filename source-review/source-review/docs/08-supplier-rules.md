# Danh mục nhà cung cấp

- Mã NCC: tự cấp khi lưu theo NCC00001 … NCC99999; lấy số lớn nhất từ mã chuẩn hiện tại (kể cả NCC ngừng sử dụng) và bộ đếm. Bảng giữ ràng buộc mã duy nhất. Biểu mẫu hiển thị mã dự kiến; mã thực tế được cấp trong cùng giao dịch với bản ghi và audit.
- Tỉnh/Thành phố: không bắt buộc (cập nhật theo yêu cầu người dùng); để trống lưu NULL, nếu có thì chọn một trong 34 đơn vị hành chính cấp tỉnh hiện hành sau sắp xếp. Dữ liệu dùng chung ở shared/vietnamProvinces.ts và bảng vietnam_provinces (migration 0010).
- Mã số thuế: không bắt buộc; ô trống lưu NULL. Kiểm tra trùng kể cả khác khoảng trắng hoặc dấu nối mã chi nhánh; unique index bảo vệ trường hợp lưu đồng thời. Không suy đoán mã số thuế còn thiếu.
- Bỏ ô/cột điện thoại; giữ dữ liệu điện thoại cũ trong DB nếu có.
- Địa chỉ có nhãn: Địa chỉ (Không nhập tỉnh/thành phố ở đây).
- NCC đã liên kết inventory_documents không được ngừng sử dụng hay xóa cứng, kể cả chứng từ nháp/đã hủy. UI khóa nút Xóa và API/trigger chặn thao tác đồng thời. Các bảng có liên kết NCC bổ sung sau này phải áp dụng cùng quy tắc.
- NCC chưa có phát sinh có thể ngừng sử dụng. Không dùng lại mã đã cấp.

Nguồn danh sách tỉnh/thành:
https://cms.baochinhphu.vn/quoc-hoi-thong-qua-viec-sap-xep-don-vi-hanh-chinh-cap-tinh-ca-nuoc-co-34-tinh-thanh-102250612100156988.htm
https://www2.en.baochinhphu.vn/bo-noi-vu-bac-thong-tin-tiep-tuc-sap-nhap-con-16-tinh-thanh-pho-102251117104548065.htm

Đối chiếu nguồn ngày 22/10/2026. Không tự phân tách địa chỉ cũ để suy ra tỉnh mới. Hiện chưa có NCC trong DB khi triển khai yêu cầu này.

Migration 0011 bỏ yêu cầu tỉnh bắt buộc, giữ nguyên khóa ngoại và các quy tắc mã/trùng MST/liên kết chứng từ.
