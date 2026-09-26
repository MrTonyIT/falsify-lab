# Thử nghiệm có kiểm soát: 5–10 người

**Chưa tuyển, chưa chạy, chưa có kết quả.** Chủ dự án tự mời; AI không liên hệ ai.
Có thể thử usability bằng demo, nhưng phải ghi rõ đó là mô phỏng. Chỉ đo khả năng
tìm lỗi live sau khi có catalog được duyệt, đúng runtime và ngân sách được cấp.

Đối tượng: người đang học thuật toán, dùng Python một file, từng gặp bài qua sample
nhưng Wrong Answer. Tránh chỉ tuyển người biết sẵn lỗi hay chỉ chọn ca sản phẩm thắng.

Lời mời dùng được: “Mình đang thử một công cụ giúp tìm và chạy lại input làm lời giải
Python sai. Công cụ còn hạn chế, không bảo đảm tìm được lỗi. Bạn có thể thử khoảng
30 phút và so sánh với chatbot bạn thường dùng không? Tham gia tự nguyện, có thể dừng
bất cứ lúc nào. Không gửi code riêng tư. Mình chỉ ghi dữ liệu bạn đồng ý chia sẻ.”

Trước buổi thử: hỏi kinh nghiệm Python, chatbot thường dùng và công cụ thực thi của
nó, mức quen thuộc với bài. Xin phép riêng cho ghi màn hình; dùng mã người tham gia,
không thu secret. Thống nhất dữ liệu giữ lại và ngày xóa trước khi bắt đầu.

Chuẩn bị hai bài tương đương nhưng khác lỗi, đã được người độc lập duyệt. Chia thứ tự
Lab→chatbot và chatbot→Lab xen kẽ; đổi bài giữa hai nhóm. Không đưa cùng lỗi vừa biết
cho điều kiện thứ hai. Cho chatbot dùng khả năng/tool mà người dùng thực sự có.
Ghi model, phiên bản nếu biết, tool, thời điểm, cấu hình, quota; không biết thì ghi unknown.
Chốt danh sách bài và giới hạn thời gian trước khi quan sát kết quả.

Tác vụ mỗi điều kiện (tối đa 10 phút, không tăng riêng cho bên nào):

1. Tìm input hợp lệ khiến chương trình qua sample trả lời sai.
2. Nói expected/actual và căn cứ tin kết quả. Lưu đủ input để chạy lại.
3. Sửa code theo hiểu biết của mình, kiểm tra lại chính input đó.
4. Giải thích liệu việc qua input vừa rồi có chứng minh code đúng không.

Người điều phối đọc cùng hướng dẫn, không chỉ vị trí lỗi hoặc cung cấp prompt tối ưu
riêng cho một bên. Chỉ giải thích thao tác khi mắc kẹt, ghi từng lần hỗ trợ.
Ghi cả lỗi, timeout, inconclusive và tác vụ bỏ cuộc; không loại sau khi biết kết quả.
Reviewer dùng checker/runtime đã xác minh để kiểm chứng phản ví dụ, không dựa vào
sự tự tin của người dùng hoặc câu trả lời AI.

| Mã      | Bài/phiên bản | Điều kiện/thứ tự | Model/tool | Hoàn thành | Input hợp lệ/sai thật | Kết luận sai | Giây đến kết quả hữu ích | Thao tác/lần hỗ trợ | Chi phí quan sát/unknown | Chạy lại được | Kiểm tra bản sửa | Failure/inconclusive |
| ------- | ------------- | ---------------- | ---------- | ---------- | --------------------- | ------------ | ------------------------ | ------------------- | ------------------------ | ------------- | ---------------- | -------------------- |
| Chưa đo |               |                  |            |            |                       |              |                          |                     |                          |               |                  |                      |

Sau buổi thử: bước nào khó hiểu, bằng chứng nào thuyết phục, có hiểu demo/live và
survived/inconclusive không, sẽ chọn công cụ nào cho ca mới và vì sao? Sau 1–2 tuần,
nếu người tham gia đã đồng ý theo dõi, ghi họ có nhu cầu mới và tự quay lại hay không;
không tính lần được nhắc quay lại như sử dụng chủ động. Chủ dự án thực hiện liên hệ.

Đây là nghiên cứu usability nhỏ, không đủ kết luận ưu thế khoa học. Báo cáo từng ca,
median/range mô tả và mọi thất bại; không quảng cáo tỷ lệ thành công đại diện thị trường.
