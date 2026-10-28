/** Paper form Mẫu 01. These are declared facts, never stock movements or approval votes. */
export const proposalSections = [
 ['1.1. Thông tin đề xuất và ảnh hưởng vận hành',[
 ['requester','Người đề xuất'],['job_title','Chức danh'],['phone','Số điện thoại'],['location','Địa điểm hiện tại'],['custodian','Lái xe / Người đang quản lý'],['operation','Nhóm vận hành','Đường dài|Cảng|Bãi Nghi Sơn|Khác'],['operation_other','Nhóm khác'],['urgency','Mức độ','Bình thường|Khẩn cấp'],['deadline','Hạn cần hoàn thành','datetime-local'],['impact','Ảnh hưởng','Dừng xe|Nguy cơ mất an toàn|Chưa dừng xe'],['trip','Chuyến / Lệnh vận chuyển'],['cargo','Có hàng','Có|Không|Không áp dụng'],['safety','Biện pháp an toàn và phối hợp điều phối','textarea']]],
 ['1.2. Phương tiện và thiết bị liên quan',[
 ['tractor','Biển số đầu kéo'],['trailer','Biển số moóc'],['container','Số container'],['equipment','Mã thiết bị'],['model','Loại / Model thiết bị'],['odo','ODO (km)'],['hours','Giờ máy'],['meter_applicable','Đồng hồ','Áp dụng|Không áp dụng'],['recorded_at','Thời điểm ghi nhận','datetime-local'],['meter_source','Nguồn ghi nhận','Đồng hồ|Hệ thống|Khác'],['meter_source_other','Nguồn khác']]],
 ['1.3. Hiện trạng và phương án kỹ thuật',[
 ['symptoms','Hiện tượng và thời điểm phát sinh','textarea'],['inspector','Kỹ thuật kiểm tra bởi'],['inspected_at','Thời điểm kiểm tra','datetime-local'],['cause','Kết luận / Nguyên nhân','textarea'],['condition','Tình trạng','Còn dùng được|Cần sửa chữa|Không dùng được|Chờ kiểm tra; chưa kết luận nguyên nhân'],['plan_reason','Lý do chọn phương án / Đơn vị sửa / Thời gian dự kiến','textarea']]],
 ['2.3. Điều chuyển hoặc giao sửa chữa',[
 ['from','Từ xe / Thiết bị / Kho'],['to','Đến xe / Thiết bị / Kho / Đơn vị sửa'],['handover_by','Người giao dự kiến'],['receive_by','Người nhận dự kiến'],['executor','Người thực hiện dự kiến'],['execution_at','Thời gian dự kiến','datetime-local'],['transport','Cách vận chuyển']]],
 ['2.4. Kiểm tra tồn kho và hồ sơ kèm theo',[
 ['stock_checked_by','Vật tư kiểm tra bởi'],['stock_checked_at','Ngày kiểm tra','date'],['availability','Kết quả kiểm tra','Có sẵn|Thiếu|Cần mua|Chờ xác minh'],['stock_plan','SL có thể cấp / Nguồn điều chuyển / Phần cần mua','textarea'],['attachments','Tệp hoặc số tài liệu kèm theo','textarea'],['missing_files','Tài liệu còn thiếu và lý do','textarea']]],
 ['3. Dự toán',[
 ['currency','Đơn vị tiền','VND|Khác'],['currency_other','Đơn vị tiền khác'],['quote_number','Báo giá số'],['quote_date','Ngày báo giá','date'],['quote_supplier','Đơn vị báo giá'],['purchase_cost','a. Vật tư mua ngoài trước thuế','amount'],['labor_cost','b. Công sửa chữa thuê ngoài trước thuế','amount'],['other_cost','c. Chi phí khác trước thuế','amount'],['cost_basis','Diễn giải / Căn cứ các khoản chi','textarea'],['vat_cost','e. Thuế GTGT dự kiến theo từng khoản','amount'],['stock_reference','Giá trị tham khảo tồn kho / Điều chuyển (không cộng chi tiền)','amount'],['stock_reference_reason','Lý do ghi giá trị tham khảo'],['unknown_cost_reason','Khoản chưa xác định / Lý do / Người bổ sung','textarea']]],
] as const;
export const proposalKeys = [...proposalSections.flatMap(([,fields])=>fields.map(f=>f[0])), 'plans','evidence'] as const;
export type ProposalData = Partial<Record<typeof proposalKeys[number],string>>;
export const proposalPlans=['Điều chuyển nội bộ','Thay thế','Thu hồi','Sửa chữa nội bộ','Sửa chữa ngoài'];
export const proposalEvidence=['Ảnh hiện trạng','Kết quả kiểm tra kỹ thuật','Báo giá','Ảnh mã nhận dạng','Khác'];
export const proposalLineFields={proposal_side:'Bảng',proposal_description:'Tên / Quy cách bổ sung',proposal_condition:'Hiện trạng / Phân loại',proposal_source:'Nguồn cấp',proposal_location:'Xe thiết bị / Vị trí',proposal_destination:'Nơi nhận',proposal_link:'Mã liên kết'} as const;
