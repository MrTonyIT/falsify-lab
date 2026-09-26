# Gói duyệt 5 bài ứng viên

Chạy `node scripts/review-candidates.mjs` để xuất gói JSON dễ đọc vào
`private/learner-candidate-review.json`. Không ghi đè một gói review đang có.
Nguồn thực thi và ca kiểm tra nằm trong `fixtures/learner-candidates.js`.
Đây là nội dung tổng hợp do cùng một AI soạn, không phải bài Codeforces hay
nguồn có bằng chứng ACCEPTED. Chưa chọn giấy phép phân phối; chủ dự án quyết định.

| Bài                      | Lỗi được cài vào chương trình sai | Ca phản ví dụ |
| ------------------------ | --------------------------------- | ------------- |
| Signed total             | Cộng trị tuyệt đối                | -2, 3 → 1     |
| Distinct values          | Trả về độ dài mảng                | 2, 2, 3 → 2   |
| Array spread             | Lấy phần tử cuối trừ phần tử đầu  | 3, -2, 1 → 5  |
| Strictly positive values | Tính cả số 0                      | 0, 1, -1 → 1  |
| Equal-value runs         | Đếm giá trị khác nhau             | 1, 2, 1 → 3   |

Mỗi bài có đề, giới hạn, sample, validator và ca kiểm tra validator, token checker,
ba bản reference nháp, đối chứng đúng (reference đầu), đối chứng sai, ca biên,
phiên bản và trạng thái pending. Ba bản nháp cùng tác giả **không độc lập**.
Gói không được import vào danh mục live và không tự sinh chữ ký review.

Reviewer có chuyên môn cần:

1. Kiểm tra tính rõ ràng của đề/constraints và quyền sử dụng; bổ sung ca rỗng
   ngoài miền, biên n=1/n=20, số âm, trùng lặp, thứ tự và định dạng sai.
2. Đọc validator và checker; chứng minh các chương trình đúng trên miền bài,
   kiểm tra đối chứng sai qua sample nhưng sai trên ca đã ghi.
3. Cung cấp reference có nguồn gốc và tính độc lập đáp ứng `docs/CORPUS.md`.
   Không đổi tên tác giả của các bản AI để vượt gate. Nếu không đáp ứng thì giữ pending.
4. Chạy `node --test test/learner-mvp.test.js`. Chạy bộ runtime bằng quy trình
   `docs/OFFICIAL_RUN.md`; chỉ sử dụng artifact khớp commit và image thực tế.
   `test/candidate-docker.test.js` kiểm tra ba reference trên sample/ca biên và
   đối chứng sai, không phải chứng minh đầy đủ hay human review.
5. Chỉ sau review thật mới đưa bài vào corpus riêng theo schema hiện có:
   reference sourceHash/provenance/algorithmFamily/independenceRationale,
   review reviewer/reviewedAt, sampleVerification và oracleReview gắn
   `oracleBinding(problem)`. Ghi người, ngày, phạm vi, hạn chế và bằng chứng thật.
   Plugin validator vẫn cần review binding hiện hành. Chạy audit corpus trước khi dùng.

Chưa chắc: tính đúng trên toàn miền, chất lượng hướng dẫn, độc lập reference,
giá trị học tập và hiệu quả so với chatbot. Các bài đều cùng họ mảng nhỏ;
không được tính chúng là năm mẫu nghiên cứu độc lập chỉ vì đã review duplicate.
