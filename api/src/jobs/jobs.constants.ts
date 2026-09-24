export const PDF_QUEUE = 'pdf';
export const OFFICE_QUEUE = 'office';
export const IMAGE_QUEUE = 'image';
export const OCR_QUEUE = 'ocr';

export enum PdfJobName {
  Merge = 'merge',
  Split = 'split',
  Compress = 'compress',
  ToImage = 'to-image',
  Watermark = 'watermark',
  PageNumbers = 'page-numbers',
  Rotate = 'rotate',
  DeletePages = 'delete-pages',
  Protect = 'protect',
  Unlock = 'unlock',
  Sign = 'sign',
  ImagesToPdf = 'images-to-pdf',
}

export interface MergeJobData {
  inputPaths: string[];
  // Thu tu TUNG TRANG xuat ra, dang { fileIndex, pageIndex } (0-based, tro
  // vao inputPaths[fileIndex] va trang thu pageIndex cua file do) - cho phep
  // sap xep tu do bat ky thu tu nao giua cac trang cua nhieu file, khong chi
  // noi lan luot tung file (2026-09-14, theo yeu cau "ghép vào 1 trang bất
  // kỳ của trang gốc"). Tuy chon - khong truyen thi giu HANH VI CU (noi lan
  // luot toan bo trang cua tung file theo dung thu tu inputPaths), dam bao
  // khong pha vo endpoint /pdf/merge don gian dang dung.
  pageOrder?: Array<{ fileIndex: number; pageIndex: number }>;
  outputFileName: string;
}

export interface SplitJobData {
  inputPath: string;
  ranges: string;
  outputFileName: string;
}

export interface CompressJobData {
  inputPath: string;
  // "light" (~300 DPI, giu chat luong in) | "medium" (~150 DPI, can bang) |
  // "strong" (~72 DPI, nen manh nhat cho xem man hinh) - xem
  // pdf/ghostscript.util.ts. Doi tu cach nen cu (chi xoa metadata, khong that
  // su giam dung luong voi PDF nhieu anh/scan) sang Ghostscript
  // -dPDFSETTINGS, giam DPI anh nhung ben trong (2026-09-12, theo yeu cau
  // "công cụ cho dân văn phòng thường sử dụng còn gì nữa không" - PDF24 cho
  // chon muc nen ro rang thay vi 1 nut nen chung chung).
  level: 'light' | 'medium' | 'strong';
  outputFileName: string;
}

export interface ToImageJobData {
  inputPath: string;
  scale: number;
  outputFileName: string;
}

export interface WatermarkJobData {
  inputPath: string;
  text: string;
  outputFileName: string;
}

export interface PageNumbersJobData {
  inputPath: string;
  startAt: number;
  outputFileName: string;
}

export interface RotateJobData {
  inputPath: string;
  // Map "so trang (1-based)" -> "goc xoay CONG DON vao goc hien tai" - chi
  // cac trang co mat trong map moi bi xoay, cac trang khac giu nguyen. Doi tu
  // "degrees: number" (xoay TOAN BO file theo 1 goc) sang per-page
  // (2026-09-12, theo yeu cau "còn tính năng nào chưa trực quan thì cải tiến
  // giống cái này" - PDF24 cho xoay tung trang rieng le tren thumbnail, xoay
  // ca file la thao tac hiem gap hon).
  pageRotations: Record<number, number>;
  outputFileName: string;
}

export interface DeletePagesJobData {
  inputPath: string;
  pages: string;
  outputFileName: string;
}

export interface ProtectJobData {
  inputPath: string;
  password: string;
  outputFileName: string;
}

export interface UnlockJobData {
  inputPath: string;
  password: string;
  outputFileName: string;
}

// 1 ghi chu doc lap (kieu "Sticky Note"/"Add Note" cua Adobe Acrobat/Foxit) -
// KHONG lien quan chu ky, dat duoc o bat ky vi tri nao tren bat ky trang nao,
// nguoi dung co the them/sua/xoa nhieu note truoc khi xuat file (2026-09-24,
// sua lai theo dung y "add note như 1 tính năng riêng biệt, ko liên quan gì
// vẽ chữ ký... giống các ứng dụng pdf trên winform ấy" sau khi lan dau hieu
// nham thanh note-gan-voi-chu-ky). Duoc ghi thanh PDF TEXT ANNOTATION that
// (pdf-lib doc.context.obj + page.node.Annots) de cac trinh doc PDF khac
// (Adobe/Foxit) cung nhan dien va tuong tac duoc, khong phai ve thang chu
// len trang.
export interface PdfNote {
  page: number;
  x: number;
  y: number;
  content: string;
}

export interface SignJobData {
  inputPath: string;
  // signaturePath rong = khong chen chu ky, chi xuat note (cho phep dung tool
  // nay THUAN TUY de them note ma khong can vebe chu ky).
  signaturePath?: string;
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  notes?: PdfNote[];
  outputFileName: string;
}

export interface ImagesToPdfJobData {
  // Danh sach duong dan anh, DUNG THU TU can ghep vao PDF (moi anh 1 trang) -
  // frontend gui theo dung thu tu nguoi dung da sap xep truoc khi upload.
  inputPaths: string[];
  outputFileName: string;
}

export type PdfJobData =
  | MergeJobData
  | SplitJobData
  | CompressJobData
  | ToImageJobData
  | WatermarkJobData
  | PageNumbersJobData
  | RotateJobData
  | DeletePagesJobData
  | ProtectJobData
  | UnlockJobData
  | SignJobData
  | ImagesToPdfJobData;

export enum OfficeJobName {
  WordToPdf = 'word-to-pdf',
  ExcelToPdf = 'excel-to-pdf',
  PdfToWord = 'pdf-to-word',
  ExcelMerge = 'excel-merge',
  PptToPdf = 'ppt-to-pdf',
  PdfToPpt = 'pdf-to-ppt',
}

export interface WordToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ExcelToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface PdfToWordJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ExcelMergeJobData {
  inputPaths: string[];
  outputFileName: string;
}

export interface PptToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface PdfToPptJobData {
  inputPath: string;
  outputFileName: string;
}

export type OfficeJobData =
  | WordToPdfJobData
  | ExcelToPdfJobData
  | PdfToWordJobData
  | ExcelMergeJobData
  | PptToPdfJobData
  | PdfToPptJobData;

export enum ImageJobName {
  Compress = 'compress',
  Convert = 'convert',
  Resize = 'resize',
  Rotate = 'rotate',
  Crop = 'crop',
  Watermark = 'watermark',
}

export interface ImageCompressJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ImageConvertJobData {
  inputPath: string;
  targetFormat: 'jpeg' | 'png' | 'webp';
  outputFileName: string;
}

export interface ImageResizeJobData {
  inputPath: string;
  width?: number;
  height?: number;
  percent?: number;
  outputFileName: string;
}

export interface ImageRotateJobData {
  inputPath: string;
  degrees: number;
  flip?: 'horizontal' | 'vertical';
  outputFileName: string;
}

export interface ImageCropJobData {
  inputPath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  outputFileName: string;
}

export interface ImageWatermarkJobData {
  inputPath: string;
  text: string;
  outputFileName: string;
}

export type ImageJobData =
  | ImageCompressJobData
  | ImageConvertJobData
  | ImageResizeJobData
  | ImageRotateJobData
  | ImageCropJobData
  | ImageWatermarkJobData;

// Cac job OCR truyen thong (Tesseract/PaddleOCR: ImageToText/PdfToText/
// PdfToWord) DA BI XOA (2026-09-24, theo yeu cau "trong các tính năng OCR
// bỏ hết các công cụ kia, do không hiệu quả, chỉ để 1 công cụ này thôi") -
// chi giu lai PdfToWordAi.
export enum OcrJobName {
  PdfToWordAi = 'pdf-to-word-ai',
}

// Dung Vision LLM (Gemini/Claude/GPT, xem ai-providers/) doc TUNG TRANG anh,
// tra ve HTML giu dung bang bieu/cau truc roi moi dung thanh .docx
// (2026-09-23, theo yeu cau "hiện tại OCR PDF sang Word thực sự không hiệu
// quả... kết quả convert trả về phải tương tự về cả format"). modelConfigId
// tro toi 1 cau hinh model AI da duoc admin khai bao san (2026-09-24, theo
// yeu cau "backend có thể khai báo sử dụng nhiều mô hình AI... người dùng
// vào chủ động khai báo") - xem AiModelsService.
export interface OcrPdfToWordAiJobData {
  inputPath: string;
  modelConfigId: string;
  outputFileName: string;
}

export type OcrJobData = OcrPdfToWordAiJobData;

export interface JobResult {
  outputFileName: string;
}
