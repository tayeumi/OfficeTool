// Prompt dung CHUNG cho ca 3 provider (Gemini/Claude/GPT) - giu 1 nguon duy
// nhat de doi format (vd sau nay muon thu Markdown lai) chi can sua 1 cho,
// khong bi lech giua cac provider.
//
// Doi tu Markdown sang HTML (2026-09-23, theo phan hoi "OCR PDF sang Word
// (AI) có thêm được bảng, nhưng nó vẫn chưa giống hoàn toàn bản gốc") -
// Markdown table khong co khai niem merge cell (colspan/rowspan), bang co o
// gop (rat pho bien trong van ban hanh chinh VN) bi "xe le" sai lech ro so
// voi ban goc. HTML <table> co san <td colspan>/<td rowspan> chuan, parse
// bang cheerio (src/ocr/html-to-docx.util.ts) thanh Table that cua docx voi
// day du thong tin gop o.
export const OCR_PROMPT = `Bạn là công cụ OCR chuyên nghiệp. Đây là 1 trang tài liệu tiếng Việt dạng ảnh scan.
Hãy đọc CHÍNH XÁC toàn bộ nội dung và trả về dưới dạng HTML (chỉ phần bên trong <body>, không cần thẻ <html>/<head>/<body>), giữ nguyên cấu trúc:
- Tiêu đề dùng <h1>/<h2>/<h3> theo đúng cấp bậc.
- Bảng biểu PHẢI dựng lại bằng thẻ <table><tr><td>...</td></tr></table>, giữ ĐÚNG số hàng/cột như bản gốc.
- Ô bị GỘP (nhiều hàng hoặc nhiều cột chung 1 ô) PHẢI dùng đúng thuộc tính colspan="n" hoặc rowspan="n" trên thẻ <td> tương ứng - KHÔNG lặp lại nội dung ô gộp ra nhiều ô riêng lẻ.
- Đoạn văn dùng <p>, giữ nguyên xuống dòng như bản gốc.
- CĂN LỀ: quan sát kỹ vị trí thực tế của từng đoạn/tiêu đề/ô bảng trên ảnh (căn giữa, căn phải, hay căn trái mặc định) và thêm thuộc tính align="center" hoặc align="right" vào đúng thẻ <p>/<h1>/<h2>/<h3>/<td> đó. Các dòng quốc hiệu, tiêu ngữ, tên loại văn bản, số hiệu/ngày tháng ở đầu văn bản hành chính THƯỜNG được căn giữa - hãy giữ đúng như trên ảnh, không mặc định căn trái nếu ảnh cho thấy đang căn giữa.
- Chữ in đậm dùng <b>, chữ in nghiêng dùng <i>, gạch chân dùng <u>.
- CỠ CHỮ: so sánh cỡ chữ TƯƠNG ĐỐI giữa các đoạn/tiêu đề trên ảnh (không cần số pt chính xác) và gắn thuộc tính data-size="xl"|"lg"|"md"|"sm" vào thẻ <p>/<h1>/<h2>/<h3> tương ứng - "xl" cho tiêu đề lớn nhất (thường là tên loại văn bản như "THÔNG TƯ", "QUYẾT ĐỊNH"), "lg" cho tiêu đề phụ/đề mục, "md" là cỡ chữ thân bài thông thường (mặc định nếu không chắc), "sm" cho chú thích/ghi chú nhỏ hơn thân bài. Không gắn data-size nếu đoạn đó cùng cỡ với thân bài.
- THỤT LỀ ĐẦU DÒNG: nếu đoạn văn có thụt lề đầu dòng rõ rệt trên ảnh (thường gặp ở đoạn nội dung chính trong văn bản hành chính), thêm thuộc tính data-indent="true" vào thẻ <p> đó.
- HÌNH ẢNH/LOGO/CON DẤU/CHỮ KÝ: nếu trên trang có bất kỳ hình ảnh nào không phải chữ (quốc huy, logo cơ quan, con dấu đỏ, chữ ký tay, watermark chữ ký số...), hãy chèn 1 thẻ <img data-bbox="x1,y1,x2,y2"> vào ĐÚNG vị trí nó xuất hiện trong luồng nội dung (không gom hết xuống cuối). x1,y1 là góc trên-trái và x2,y2 là góc dưới-phải của vùng chứa hình đó, đơn vị là PHẦN TRĂM (0-100) so với chiều rộng/chiều cao toàn trang ảnh - ước lượng khung bao sát nhất có thể, không cần quá rộng. KHÔNG dùng thuộc tính src, KHÔNG mô tả nội dung hình ảnh bằng chữ.
- KHÔNG thêm giải thích, bình luận, hay bọc trong \`\`\` - chỉ trả về đúng nội dung HTML của trang.
- Nếu trang trống hoặc không đọc được, trả về chuỗi rỗng.`;

/** Bóc phần HTML thật ra khỏi output, phòng trường hợp model lỡ bọc ```html ... ``` dù đã dặn không làm vậy. */
export function stripCodeFence(text: string): string {
  const fenceMatch = /^```(?:html)?\s*\n([\s\S]*?)\n```$/.exec(text.trim());
  return fenceMatch ? fenceMatch[1].trim() : text.trim();
}
