import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { unlink, writeFile, rm, mkdtemp, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import { StorageService } from '../storage/storage.service';
import {
  OCR_QUEUE,
  OcrJobName,
  OcrJobData,
  ImageToTextJobData,
  PdfToTextJobData,
  OcrPdfToWordJobData,
  JobResult,
} from '../jobs/jobs.constants';

const execFileAsync = promisify(execFile);

@Processor(OCR_QUEUE)
export class OcrProcessor extends WorkerHost {
  private readonly engine: 'tesseract' | 'paddleocr';

  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    super();
    this.engine =
      this.config.get<string>('ocr.engine') === 'paddleocr'
        ? 'paddleocr'
        : 'tesseract';
  }

  async process(
    job: Job<OcrJobData, JobResult, OcrJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case OcrJobName.ImageToText:
        return this.imageToText(job.data);
      case OcrJobName.PdfToText:
        return this.pdfToText(job.data);
      case OcrJobName.PdfToWord:
        return this.pdfToWord(job.data);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  /** OCR một ảnh, dispatch theo engine cấu hình qua OCR_ENGINE. */
  private async runOcr(inputPath: string): Promise<string> {
    return this.engine === 'paddleocr'
      ? (await this.runPaddleOcr([inputPath]))[0]
      : this.runTesseract(inputPath);
  }

  private async runTesseract(inputPath: string): Promise<string> {
    // tesseract tự thêm ".txt" vào base path được truyền, nên dùng base tạm
    // rồi đọc lại nội dung thay vì để lại ở đường dẫn tesseract tự đặt.
    const tmpBase = join(this.storage.outputsDir, randomUUID());
    const tmpOutput = `${tmpBase}.txt`;

    try {
      await execFileAsync('tesseract', [inputPath, tmpBase, '-l', 'vie'], {
        timeout: 60_000,
      });
      const text = await readFile(tmpOutput, 'utf-8');
      return text;
    } finally {
      await unlink(tmpOutput).catch(() => undefined);
    }
  }

  // Ký tự phân tách trang trong stdout của paddle_ocr.py (ASCII Record
  // Separator) - phải khớp PAGE_SEPARATOR trong scripts/paddle_ocr.py.
  private static readonly PADDLE_PAGE_SEPARATOR = '\x1e';

  /**
   * OCR nhiều ảnh trong CÙNG một process Python. PaddleOCR(lang="vi") mất
   * hàng chục giây để load model - gọi script riêng cho mỗi trang PDF (như
   * trước đây) khiến job nhiều trang chạy đủ lâu để BullMQ mất lock giữa
   * chừng và tự đánh fail dù OCR vẫn đang chạy bình thường.
   */
  private async runPaddleOcr(inputPaths: string[]): Promise<string[]> {
    const scriptPath = join(process.cwd(), 'scripts', 'paddle_ocr.py');
    const { stdout } = await execFileAsync(
      'python3',
      [scriptPath, ...inputPaths],
      {
        timeout: 60_000 * inputPaths.length,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return stdout.split(OcrProcessor.PADDLE_PAGE_SEPARATOR);
  }

  /** Render từng trang PDF thành ảnh rồi OCR - dùng chung cho pdf-to-text/word. */
  private async ocrPdfPages(inputPath: string): Promise<string[]> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(inputPath, { scale: 2 });

    const pageDir = await mkdtemp(join(tmpdir(), 'ocr-pdf-'));

    try {
      const pagePaths: string[] = [];
      let pageNumber = 1;
      for await (const image of document) {
        const pagePath = join(pageDir, `page-${pageNumber}.png`);
        await writeFile(pagePath, image);
        pagePaths.push(pagePath);
        pageNumber++;
      }

      if (this.engine === 'paddleocr') {
        const pageTexts = await this.runPaddleOcr(pagePaths);
        return pageTexts.map((text) => text.trim());
      }

      const pageTexts: string[] = [];
      for (const pagePath of pagePaths) {
        const text = await this.runTesseract(pagePath);
        pageTexts.push(text.trim());
      }
      return pageTexts;
    } finally {
      await rm(pageDir, { recursive: true, force: true });
    }
  }

  private async imageToText(data: ImageToTextJobData): Promise<JobResult> {
    const text = await this.runOcr(data.inputPath);
    await writeFile(
      this.storage.outputPath(data.outputFileName),
      text,
      'utf-8',
    );
    return { outputFileName: data.outputFileName };
  }

  private async pdfToText(data: PdfToTextJobData): Promise<JobResult> {
    const pageTexts = await this.ocrPdfPages(data.inputPath);
    const content = pageTexts
      .map((text, index) => `--- Trang ${index + 1} ---\n${text}`)
      .join('\n\n');

    const outputPath = this.storage.outputPath(data.outputFileName);
    await writeFile(outputPath, content, 'utf-8');
    return { outputFileName: data.outputFileName };
  }

  private async pdfToWord(data: OcrPdfToWordJobData): Promise<JobResult> {
    const pageTexts = await this.ocrPdfPages(data.inputPath);

    // Dựng lại thành .docx: mỗi trang PDF -> 1 heading "Trang N" + các đoạn
    // văn theo dòng xuống dòng OCR được. Đây là tái tạo layout ở mức tương
    // đối (không giữ bảng biểu/vị trí ảnh như bản gốc) - phù hợp cho PDF
    // scan/ảnh vốn không có text layer để LibreOffice đọc được.
    //
    // Đã thử PP-StructureV3 (PaddleOCR) để giữ layout/bảng biểu thật, nhưng
    // pipeline đó luôn tải + load model PP-Chart2Table (~1-2GB, dùng cho
    // chart-to-table) vào RAM bất kể use_chart_recognition=False - đây là
    // model mặc định vốn đã tắt theo docs nhưng vẫn bị khởi tạo trong thực
    // tế (giới hạn kiến trúc của thư viện, không phải lỗi cấu hình) - khiến
    // container bị OOM-killed kể cả với 12GB RAM. Quay lại cách nối text
    // đơn giản này cho tới khi PaddleOCR có API kiểm soát việc này tốt hơn.
    const children: Paragraph[] = [];
    pageTexts.forEach((text, index) => {
      children.push(
        new Paragraph({
          text: `Trang ${index + 1}`,
          heading: HeadingLevel.HEADING_2,
          pageBreakBefore: index > 0,
        }),
      );
      const lines = text.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length === 0) {
        children.push(new Paragraph({ text: '' }));
      }
      for (const line of lines) {
        children.push(new Paragraph({ text: line.trim() }));
      }
    });

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const outputPath = this.storage.outputPath(data.outputFileName);
    await writeFile(outputPath, buffer);
    return { outputFileName: data.outputFileName };
  }
}
