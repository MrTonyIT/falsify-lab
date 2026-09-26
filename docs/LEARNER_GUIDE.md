# Dùng thử bản learner

Tại thư mục dự án, chạy `npm run build` rồi `npm start`; mở
http://127.0.0.1:4173. Server chỉ phục vụ local; không mở ra Internet.

1. Chọn tiếng Việt hoặc English. Giữ Demo, tải ví dụ lỗi dấu âm và chạy.
2. Xem input, expected/actual; đây là mô phỏng đã gắn nhãn, không thực thi code tùy ý.
3. Tải input đầy đủ hoặc xuất bằng chứng. Preview dài có nhãn bị cắt.
   Export không gồm source, generator hay raw provider response, nhưng input/output
   vẫn có thể nhạy cảm: xem lại trước khi chia sẻ.
4. Mở “Kiểm tra bản sửa trên input này”, tải ví dụ sửa sẵn và chạy lại. Kết quả chỉ
   áp dụng một input; không gọi model, không thay đổi seal của lần chạy gốc.
5. Sang Live để xem danh mục đã duyệt và điều kiện. Năm bài nháp nằm riêng ở pending.
   Khi chưa có bài được duyệt, không coi danh mục là sẵn sàng sử dụng thực tế.

Live yêu cầu operator cấu hình corpus với oracle/reference/validator review thật,
Docker và provider với giá/quota đã xác minh. Cấu hình không đồng nghĩa xác thực.
Code, đề và feedback được gửi tới provider hiển thị trước khi chạy; raw response
được giữ riêng trong thư mục kết quả. Không dán secret vào hội thoại hoặc source.
Các giới hạn và hạn mức hiển thị trước khi đồng ý gọi model.

Replay live chỉ cần oracle gốc và Docker, không gọi model. Oracle bị đổi, input
bị sửa, bằng chứng thiếu hoặc runtime không có sẽ bị chặn. Lỗi cú pháp hiển thị riêng;
crash/resource limit không phải correctness KILL. Kết quả replay lưu riêng và không
được nhập vào benchmark như lần tìm phản ví dụ mới. Lịch sử cũ không có replay artifact
hoặc thuộc protocol cũ cần chạy lại; không nâng cấp evidence cũ thành evidence mới.

Chưa chạy paid provider và chưa phê duyệt ngân sách. Trước thử live, operator cần chọn
provider/model/account, xem tài liệu và giá chính thức tại thời điểm chạy, xác định
trần tiền được duyệt. Đề xuất phạm vi kiểm tra đầu tiên: một bài đã review, tối đa
3 lời gọi tìm test (dừng khi có kill), sau đó một replay không LLM; compatibility call
nếu cần là lượt riêng phải tính thêm. Chưa thể báo giá khi chưa có model và cấu hình.
Không có secret hoặc quyền chi tiêu được suy ra từ biến môi trường.
