#!/usr/bin/env python3
"""OCR một hoặc nhiều ảnh bằng PaddleOCR (tiếng Việt) trong CÙNG một process.

Nhận nhiều đường dẫn ảnh qua argv thay vì 1 ảnh/lần gọi: PaddleOCR(lang="vi")
mất hàng chục giây để load model từ đĩa - nếu gọi script này riêng cho mỗi
trang PDF (như bản trước), một PDF nhiều trang sẽ load lại model từng đó
lần, đủ chậm để BullMQ mất lock giữa chừng và tự đánh fail job dù việc OCR
vẫn đang chạy bình thường. Ở đây model chỉ load 1 lần cho toàn bộ job.

In ra stdout: mỗi trang là 1 khối text, các trang cách nhau bởi dòng
"\x1e" (ASCII Record Separator) - Node tách lại bằng ký tự này.

Usage: python3 paddle_ocr.py <image_path> [<image_path> ...]
"""
import sys

from paddleocr import PaddleOCR

PAGE_SEPARATOR = "\x1e"


def main():
    if len(sys.argv) < 2:
        print("Usage: paddle_ocr.py <image_path> [<image_path> ...]", file=sys.stderr)
        sys.exit(1)

    image_paths = sys.argv[1:]
    ocr = PaddleOCR(use_angle_cls=True, lang="vi", show_log=False)

    page_texts = []
    for image_path in image_paths:
        result = ocr.ocr(image_path, cls=True)
        lines = [
            detection[1][0]
            for page in (result or [])
            for detection in (page or [])
        ]
        page_texts.append("\n".join(lines))

    sys.stdout.write(PAGE_SEPARATOR.join(page_texts))


if __name__ == "__main__":
    main()
