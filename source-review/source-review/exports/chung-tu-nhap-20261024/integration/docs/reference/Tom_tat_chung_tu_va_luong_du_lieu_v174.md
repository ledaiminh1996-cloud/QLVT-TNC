# Chức năng chứng từ và luồng dữ liệu quản lý vật tư

## 1 Phạm vi hệ thống

Chưa thấy trong phạm vi mã đã rà soát một phân hệ kế toán tổng hợp đầy đủ gồm định khoản Nợ/Có, sổ cái, công nợ phải thu/phải trả, thanh toán và kê khai thuế. Có trường số hóa đơn, nhưng không nên coi trường này là phân hệ hóa đơn điện tử hoặc xử lý thuế. Khi xây phần mềm mới, các nội dung tài chính này cần được thiết kế và thống nhất riêng.

**Mục tiêu xây lại:** giữ đúng luồng chứng từ và dấu vết nguồn vật tư; không đếm trùng tồn kho; bảo toàn lịch sử sử dụng; cho phép tra ngược từ phiếu xuất đến nguồn nhập và từ vật tư thu hồi đến lần xuất đã sử dụng.
Hiện chưa có cột VAT, thuế ở các phiếu. Bổ sung them chỗ này
## 2 Danh mục phiếu và ảnh hưởng dữ liệu

| Loại chứng từ | Ký hiệu số mới | Chức năng và ảnh hưởng chính |
| --- | --- | --- |
| Đề xuất vật tư thiết bị | PĐX | Lập nhu cầu và duyệt theo quy trình. Duyệt đề xuất chưa làm tăng hoặc giảm tồn kho. |
| Nhập kho | PN | Nhận hàng vào kho, ghi số lượng thực nhập và giá trị; tạo nguồn nhập cho các lần xuất. |
| Xuất kho | PX | Xuất vật tư từ Hàng mới hoặc Hàng thu hồi; giảm tồn đúng kho, trạng thái và Serial; có thể mở một lần sử dụng trên xe. |
| Nhập thu hồi | PTH | Nhận lại vật tư từ một lần sử dụng còn mở; tăng tồn Hàng thu hồi hoặc Hàng thu hồi chờ thanh lý. |
| Thanh lý | TL | Xuất từ nguồn Hàng thu hồi chờ thanh lý; giảm tồn và giữ liên kết đến nguồn thu hồi. |
| Gửi và nhận đắp vỏ | DV | Gửi một Serial thu hồi đi đắp; khi nhận về tạo Serial sau đắp và giá trị sau đắp. |
| Điều chuyển giữa kho | PĐC, hai đầu PXĐC và PNĐC | Giảm kho đi, tăng kho nhận, giữ nguồn và giá trị bàn giao. Hai đầu thuộc cùng một chứng từ điều chuyển. |
| Điều chuyển giữa thiết bị | PĐC | Đóng giai đoạn sử dụng trên thiết bị đi và mở giai đoạn trên thiết bị nhận; không làm tăng giảm tồn kho thực tế. |
| Đảo và điều chuyển vỏ xe, ắc quy | DAO | Ghi vị trí lắp, đảo vị trí hoặc chuyển xe. Đảo vị trí không tạo nhập xuất kho; chuyển xe giữ chuỗi sử dụng. |
| Số dư đầu kỳ | SD | Khởi tạo số lượng và giá trị tại mốc bắt đầu; không tính thành nhập mua trong kỳ. |

Số hiển thị có dạng **MM.yy.00001/LOẠI**, ví dụ `10.26.00009/PN`. Số thứ tự gồm 5 chữ số, cấp theo tháng và từng loại. Đề xuất PĐX có thêm hậu tố mã bộ phận. Điều chuyển kho có một số gốc PĐC và hai số tương ứng PXĐC, PNĐC cùng phần số. Phiếu xuất Hàng thu hồi dùng số công khai PX; trong mã nội bộ vẫn còn xử lý mã PXT để tương thích dữ liệu cũ.



## 4 Dữ liệu cần có trên chứng từ

Đối với vật tư quản lý theo SERIAL, mỗi dòng nhập mới là một chiếc và phải có Serial duy nhất. \
Đối với SỐ LƯỢNG, tồn được kiểm soát theo nhóm kho, trạng thái và mã vật tư. Một mã vật tư có thể có nhiều lô nhập; một lần xuất số lượng có thể phân bổ từ nhiều nguồn nhập.

## 5 Luồng từng nhóm chứng từ

### 5.1 Phiếu đề xuất

Người lập chọn loại đề xuất, bộ phận, xe/kho liên quan và các dòng vật tư, sau đó lưu Nháp. Hệ thống chọn quy trình theo bộ phận và loại đề xuất, chụp lại cấu hình quy trình tại lúc gửi để thay đổi cấu hình sau này không tự làm đổi phiếu đang duyệt.

Luồng chính là **Nháp → Chờ duyệt → Đã duyệt**, có nhánh Trả về, Từ chối và Bỏ duyệt theo quyền. Mỗi bước có thể yêu cầu một người hoặc tất cả người được phân công duyệt. 
cấu hình quy trình trong mục riêng. Duyệt xong chưa tự ghi vào các bảng nhập/xuất.

### 5.2 Phiếu nhập kho

Người lập chọn ngày, kho, nhà cung cấp, số hóa đơn nếu có và các dòng vật tư. Dòng nhập có số lượng chứng từ, số lượng thực nhập, đơn giá và Serial. 
Với dầu M-DC-TIEU-0020 có them trường chọn bồn dầu nhập; với mã vật tư SIM có them trường Gói Data.

Khi lưu, hệ thống kiểm tra quyền kho, kỳ khóa, số phiếu, số lượng và đơn giá. Serial phải tồn tại duy nhất, không trùng trong phiếu hoặc đã có trong hệ thống. **Giá trị nhập = số lượng thực nhập × đơn giá.    có thêm VAT và thành tiền
. Tồn tăng theo số lượng thực nhập, không theo số lượng chứng từ. Nguồn nhập này được dùng cho xuất kho và truy nguồn sau đó.

Chức năng import dòng vật tư nhanh


### 5.3 Phiếu xuất kho

Người lập chọn kho, ngày/giờ xuất, mục đích, người nhận và các dòng vật tư. Mỗi dòng có trạng thái Hàng mới hoặc Hàng thu hồi, số lượng, Serial nếu cần, xe/thiết bị nhận và ODO/giờ khi lắp hoặc sử dụng.

Hệ thống kiểm tra tồn trực tiếp từ dữ liệu nguồn dưới khóa ghi chung, cộng gộp nhu cầu của các dòng cùng nhóm trước khi so tồn, chặn Serial trùng và vượt tồn. Giá vốn được xác định trên máy chủ, không lấy thành tiền do giao diện tự gửi lên làm căn cứ cuối cùng.

Mỗi dòng có **ID lần xuất** để liên kết tới nguồn nhập, tuổi thọ, thu hồi và lịch sử lắp. Xuất cấp dùng làm giảm tồn kho và mở lượng còn đang sử dụng trên xe. Xuất thanh lý hoặc nghiệp vụ đặc biệt được nhận diện theo loại/mục đích, không tự coi mọi dòng xuất là một lần lắp trên xe.

1 phiếu xuất có thể vừa có hàng mới, vừa có hàng thu hồi
có chức năng import hàng loạt phiếu xuất, import dòng vật tư 

### 5.4 Phiếu nhập thu hồi

Người lập chọn **lần xuất/lắp còn mở**, số lượng còn được thu hồi, kho nhận, tình trạng và ODO/giờ lúc tháo. Máy chủ đọc lại lần xuất; không tin ngay ngày lắp, giá trị và lượng còn lại do giao diện gửi lên.

Hệ thống chặn thu hồi quá số lượng chưa thu hồi, ngày thu hồi trước ngày lắp và ODO tháo nhỏ hơn ODO lắp. Dữ liệu giữ ID lần xuất gốc. Có hai đích trạng thái: Hàng thu hồi để tái sử dụng và Hàng thu hồi chờ thanh lý.

Giá trị còn lại phục vụ quản trị được xác định khi đủ dữ liệu tuổi thọ và giá trị xuất. Với trường hợp đủ căn cứ theo KM/giờ, tỷ lệ sử dụng được giới hạn tối đa 100%; giá trị cơ sở là đơn giá xuất nhân số lượng thu hồi, rồi trừ phần đã sử dụng. Các cách tính giờ tạm tính có metadata riêng. Giá trị còn lại này là cơ sở tồn thu hồi, không mặc nhiên đồng nghĩa với bút toán khấu hao kế toán tài chính.

Mã còn giữ nhánh nhập thu hồi Tồn đầu kỳ cho dữ liệu cũ. Chức năng khởi tạo số dư mới cần ưu tiên luồng SD riêng. Dầu tiêu hao đã cấp dùng bị chặn nhập thu hồi.

### 5.5 Phiếu thanh lý

Chỉ chọn từ nguồn còn tồn ở trạng thái **Hàng thu hồi chờ thanh lý**. Kiểm tra số lượng, Serial, ngày, phiên bản nguồn và lý do thanh lý. Máy chủ lấy giá trị còn lại của nguồn làm đơn giá xuất giảm kho.

mục đích Thanh lý, số loại TL; quan hệ nguồn ghi tại `LIEN KET THANH LY`. **Giá trị xuất thanh lý là giá trị giảm kho.** Trong luồng này chưa có đầy đủ giá bán, thuế, công nợ người mua hoặc thu tiền để tự ghi nhận doanh thu thanh lý.

### 5.6 Phiếu gửi và nhận đắp vỏ

Gửi đắp chỉ áp dụng cho vật tư SERIAL đang còn đúng một chiếc ở Hàng thu hồi, có giá trị còn lại hợp lệ. Ghi kho, nhà cung cấp đắp, Serial trước đắp, Serial gốc và lần đắp vào `DAP VO`, trạng thái **Đang đắp**. Khi tính kho, Serial gửi đi giảm khỏi tồn sẵn có.

Nhận đắp cập nhật chính phiếu gửi, phải có ngày nhận không trước ngày gửi, Serial sau đắp chưa từng tồn tại và chi phí đắp không âm. **Giá trị sau đắp = giá trị trước đắp + chi phí đắp.** Phiếu chuyển sang **Đã nhận**; Serial sau đắp tăng vào tồn Hàng thu hồi. Đây là hai giai đoạn trên một hồ sơ DV, không tự tính thành một lần nhập mua mới.


### 5.8 Điều chuyển giữa kho

Có hai cách lập: từ đề xuất đã duyệt hoặc lập thủ công. Chọn kho đi và kho đến khác nhau, ngày/giờ, nguồn còn tồn, số lượng và lý do bàn giao. Giữ nguyên Serial, giá trị nguồn và dấu vết nhập ban đầu.

Hệ thống lập hồ sơ `DC VAT TU` ở trạng thái **Đang xử lý**, chuẩn bị các dòng hai đầu. Kho đi ghi xuất; kho nhận Hàng mới ghi `DU LIEU NHAP`, còn Hàng thu hồi ghi `NHAP THU HOI`. Chỉ khi toàn bộ kế hoạch ghi hoàn tất, hồ sơ chuyển **Hoàn thành** và các dòng mới có hiệu lực cho nghiệp vụ.

Hai đầu hiển thị PXĐC và PNĐC, cùng gắn một hồ sơ PĐC. Không được sửa/hủy riêng một đầu. Có thể tiếp tục hồ sơ dang dở mà không tạo cặp phiếu mới; hủy cả hồ sơ nếu không có giao dịch phụ thuộc. -> Lưu ý số liệu chỗ này để tránh double trên báo cáo NXT

**Tại kho đi:** xuất tăng, tồn giảm. **Tại kho nhận:** nhập tăng, tồn tăng. Xét toàn bộ công ty, lượng và giá trị chuyển đi/đến bù nhau. Cột nhập/xuất điều chuyển trong báo cáo là thông tin chi tiết đã nằm trong nhập/xuất chung, không cộng thêm lần hai.

### 5.9 Điều chuyển thiết bị và đảo vỏ

Điều chuyển vật tư giữa thiết bị chọn một lần lắp đang mở, ghi tháo khỏi thiết bị đi và lắp vào thiết bị nhận, có mốc thời gian/ODO hoặc dữ liệu GPS phù hợp. Luồng này có thể sinh các dòng thu hồi/xuất kỹ thuật và liên kết tuổi thọ, nhưng được tách khỏi tính tồn kho thực tế để không tạo tăng giảm kho giả.

Đảo vỏ có hồ sơ yêu cầu tại `YEU CAU DAO VO`, sau đó thực hiện qua hồ sơ `DC VAT TU`. Gán/đảo vị trí trên cùng xe chỉ thay đổi vị trí; chuyển sang xe khác đóng/mở giai đoạn sử dụng. Giữ Serial, nguồn, vị trí trước/sau và cách xác định KM. Có kiểm tra vị trí trùng, nguồn đã thay đổi và các lần thực hiện phía sau trước khi hủy.

### 5.10 Số dư đầu kỳ và khóa sổ

Số dư đầu kỳ ghi ngày bắt đầu, kho, vật tư, trạng thái Hàng mới/Hàng thu hồi, số lượng, đơn giá và Serial/bồn/Gói Data khi cần. Một phiếu nhận **1–60 dòng**. Dữ liệu được ghi qua hồ sơ `DC VAT TU` loại OPENING và các dòng nguồn `DU LIEU NHAP`, số loại SD.

Mốc ghi dữ liệu là trước 00:00 ngày bắt đầu một giây; báo cáo còn nhận biết cờ số dư để đưa vào tồn đầu. Khởi tạo không phải thao tác lặp lại đầu mỗi tháng. Có kiểm tra trùng nhóm số dư, ngày khởi tạo khác của cùng kho và lịch sử trước mốc bắt đầu để tránh cộng đè lên tồn đã có.

Khóa sổ ghi tại `KHOA SO KY`, áp dụng cho **mọi ngày đến hết ngày khóa gần nhất**, không chỉ các ngày nằm trong khoảng ghi chú của kỳ. Trước khi khóa phải xử lý các chứng từ dang dở. Chứng từ thuộc ngày đã khóa bị chặn thay đổi; mở sổ cần lý do và phải mở kỳ khóa gần nhất trước.

## 6 Quy tắc giá vốn và truy nguồn

**Vật tư SERIAL:** xác định giá theo đúng Serial và nguồn tương ứng; vật tư thu hồi sử dụng giá trị nguồn thu hồi/phục hồi hợp lệ. **Vật tư SỐ LƯỢNG:** giá bình quân được xác định từ giá trị tồn chia số lượng tồn của nhóm kho, trạng thái và mã vật tư tại lúc tính xuất. Mã hiện tại không phải một cơ chế tự tính lại giá vốn lịch sử hoàn chỉnh theo từng ngày khi thêm/sửa chứng từ lùi ngày.

**Truy nguồn nhập:** với Hàng mới không Serial, phân bổ nguồn nhập theo FIFO trên sổ. Một PX có nhiều dòng xuất, mỗi dòng xuất có thể có nhiều dòng phân bổ nguồn. Tổng lượng phân bổ phải bằng lượng xuất; nguồn phải hợp lệ theo mã, kho, ngày và dấu kiểm tra dữ liệu.

**Không đồng nhất hai việc:** phân bổ lô FIFO để giải thích nguồn nhập không có nghĩa giá vốn của lần xuất được tính theo FIFO. Bên xây dựng phải giữ rõ phương pháp giá vốn và phương pháp truy nguồn.

`LIEN KET TUOI THO` giữ nguồn thu hồi, mã theo dõi gốc và mức đã sử dụng trước đó khi tái cấp dùng. Chuỗi điển hình: **PN → PX lần 1 → PTH → PX lần 2**, hoặc **PTH → gửi đắp → nhận đắp Serial mới → PX tiếp theo**.

## 7 Sửa hủy và tính toàn vẹn

Hệ thống có năm vai trò: Quản trị, Kế toán, Thủ kho, Kỹ thuật và Người xem. Quyền thực tế còn phụ thuộc kho được phép và cấu hình từng chức năng, mức xem/thao tác. Thủ kho có thể lập phiếu kho trong phạm vi cho phép; Kỹ thuật có các thao tác chuyên môn. SCN là dữ liệu toàn đội xe nên yêu cầu phạm vi TẤT CẢ, không thể chỉ dựa vào kho để chia quyền đọc.

- Sửa/hủy chứng từ thông thường chỉ dành cho Quản trị hoặc Kế toán, đồng thời phải qua quyền chức năng và phạm vi kho. Người dùng chỉ xem không có quyền ghi vì nhìn thấy nút hoặc biết đường gọi API.
- Không mở sửa mọi trường. PN cho sửa hóa đơn, nhà cung cấp, diễn giải; số lượng/đơn giá chỉ khi chưa có phụ thuộc. PX cho sửa người nhận, diễn giải, ODO/giờ đủ điều kiện; không tự thay vật tư, xe, Serial hoặc nguồn. PTH, SCN và DV có danh sách trường được sửa riêng.
- Sửa phải có lý do, đối chiếu phiên bản, ghi dữ liệu trước/sau tại `LICH SU SUA PHIEU` và lịch sử thao tác. Không ghi đè phiên bản người khác vừa cập nhật.
- Hủy mềm: giữ số và dòng nguồn, đánh dấu Đã hủy, ghi lý do/người/thời gian. Bộ đọc nghiệp vụ loại ảnh hưởng khỏi tồn; lịch sử vẫn tra được. Không cấp lại số phiếu đã hủy.
- Nếu có phiếu phụ thuộc thì chặn hủy; xử lý ngược từ chứng từ phía sau. Với điều chuyển hoặc số dư, dùng cơ chế hủy hồ sơ gốc, không sửa từng dòng tự sinh.
- Mã có khóa ghi chung, requestId và dấu kiểm tra để chống xử lý lặp ở nhiều nghiệp vụ. Mức hỗ trợ không đồng đều: không được giả định mọi hàm lưu trực tiếp đều là một giao dịch cơ sở dữ liệu nguyên khối. Khi xây lại nên dùng transaction và khóa dữ liệu phù hợp.
- Lưu chứng từ thành công nhưng cập nhật báo cáo lỗi là hai trạng thái khác nhau. Cần thông báo cập nhật lại báo cáo, không yêu cầu người dùng bấm lưu lại phiếu rồi tạo trùng.


## 9 Báo cáo và công thức đối chiếu

Ba sổ chính là **Sổ theo dõi kho**, **Sổ chi tiết NXT**, **Sổ tổng hợp NXT**. Sổ chi tiết tách Serial theo phương thức quản lý; sổ tổng hợp nhóm theo kho, trạng thái và mã vật tư. Báo cáo theo kỳ sử dụng ngày chứng từ để tách đầu kỳ, trong kỳ và cuối kỳ.

**Tồn cuối = tồn đầu + nhập trong kỳ − xuất trong kỳ**, áp dụng riêng cho lượng và giá trị. Gửi đắp là xuất; nhận đắp là nhập giá trị sau đắp. Điều chuyển thiết bị không làm thay đổi tồn kho thực tế. Các giá trị chưa xác định trên báo cáo cần phân biệt với số 0.

Lọc loại phiếu tại NXT lựa chọn các nhóm vật tư có phát sinh loại đó trong kỳ, nhưng vẫn tính đủ các nghiệp vụ của nhóm để không làm sai tồn. Sổ theo dõi kho lọc dòng phát sinh theo loại phiếu. Không áp dụng cùng một cách lọc giao dịch cho cả hai loại báo cáo.


## 10 Mô hình dữ liệu đề nghị khi xây lại

Đây là đề nghị triển khai, không phải khẳng định mã Apps Script đã có các bảng quan hệ dưới đây:

| Thực thể | Quan hệ và trách nhiệm |
| --- | --- |
| Chứng từ | ID bất biến, số hiển thị, loại, ngày, trạng thái, người lập, phiên bản, diễn giải. Một chứng từ có nhiều dòng. |
| Dòng chứng từ | Vật tư, lượng, giá, Serial, kho/trạng thái, xe và thông tin chuyên biệt. Có ID dòng bất biến. |
| Biến động kho | Dòng tăng/giảm kho gắn dòng chứng từ, chỉ hiệu lực khi chứng từ được ghi nhận hoàn chỉnh. |
| Phân bổ nguồn | Quan hệ nhiều nguồn nhập cho một lần xuất, kèm lượng phân bổ; không dùng số phiếu làm khóa chính. |
| Giai đoạn sử dụng | Mở bằng lần xuất/lắp, đóng hoặc giảm lượng bằng thu hồi/chuyển thiết bị; lưu KM/giờ và nguồn gốc. |
| Hồ sơ điều chuyển | Liên kết hai đầu, kho/xe đi nhận, kế hoạch thực hiện, trạng thái, tiếp tục/hủy theo toàn hồ sơ. |
| Quy trình và phê duyệt | Cấu hình, bản chụp theo đề xuất, bước, người xử lý, kết quả và lịch sử. |
| Nhật ký và khóa kỳ | Trước/sau, lý do, tác nhân, requestId; ngày khóa và lịch sử mở khóa. |

Khi chuyển đổi dữ liệu phải đưa theo bảng số phiếu, bí danh số cũ, nguồn nhập, ID lần xuất, liên kết thu hồi/thanh lý/đắp, hồ sơ điều chuyển và lịch sử. Chỉ chuyển các sheet nhập/xuất riêng lẻ sẽ làm mất khả năng truy vết.

## 11 Các tình huống nghiệm thu chính

1. Nhập Serial trùng hoặc nhập hai chiếc trên một dòng SERIAL phải bị chặn; Serial có số 0 đầu hoặc chuỗi số dài giữ nguyên.
2. PX không vượt tồn kể cả khi một phiếu có nhiều dòng cùng mã, hoặc hai người đồng thời xuất cùng nguồn.
3. Từ PX tra ra các PN/lô và số lượng phân bổ; tổng phân bổ bằng lượng xuất. Giá vốn bình quân không bị đổi thành FIFO chỉ vì dùng truy nguồn FIFO.
4. Thu hồi đúng lần lắp còn mở, không vượt lượng còn dùng; thu hồi xong không bị chọn thêm vượt lượng.
5. Đắp vỏ gửi một chiếc, nhận Serial mới, giá sau đắp bằng giá cũ cộng chi phí; nhận lại lần hai không tạo nhập trùng.
6. Điều chuyển 10 chiếc từ A sang B làm A giảm 10, B tăng 10; cộng toàn hệ thống không tăng tồn. Có PXĐC/PNĐC truy được cùng hồ sơ PĐC.
7. Dừng giữa hai đầu điều chuyển rồi Tiếp tục không tạo dòng trùng; chứng từ dang dở chưa được tính hiệu lực vào tồn.
8. Chuyển phụ tùng giữa hai xe hoặc đảo vị trí vỏ giữ tổng tồn kho; cập nhật đúng giai đoạn và vị trí sử dụng.
10. SD xuất hiện ở tồn đầu, không ở nhập mua; không cho cộng lại số dư vào lịch sử đã có hoặc lặp nhóm khởi tạo.
11. Sửa/hủy có lý do và lịch sử; phiếu có phụ thuộc bị chặn; phiếu hủy không còn ảnh hưởng lượng/giá trị tồn.
12. Sau khóa kỳ, tạo/sửa/hủy hoặc nhận đắp thuộc thời gian bị khóa phải bị chặn theo chính sách ngày nghiệp vụ.
13. Lọc theo kỳ, kho, trạng thái, loại phiếu vẫn thỏa công thức NXT; điều chuyển không được cộng hai lần.
14. Nhập nhanh PN nhận được cả mẫu 3 và 4 cột; Gói Data trống không chặn dòng thiết bị thường; giá trị được đưa đúng vào phiếu SIM.
15. Nếu báo cáo cập nhật lỗi sau khi chứng từ đã lưu, chạy cập nhật lại không tạo phiếu mới. Quyền xem không gọi được thao tác ghi qua API.

