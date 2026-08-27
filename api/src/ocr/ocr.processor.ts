import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { rename, unlink, writeFile, rm, mkdtemp, readFile } from 'fs/promises';
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
  constructor(private readonly storage: StorageService) {
    super();
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

  /** Render từng trang PDF thành ảnh rồi OCR - dùng chung cho pdf-to-text/word. */
  private async ocrPdfPages(inputPath: string): Promise<string[]> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(inputPath, { scale: 2 });

    const pageDir = await mkdtemp(join(tmpdir(), 'ocr-pdf-'));
    const pageTexts: string[] = [];

    try {
      let pageNumber = 1;
      for await (const image of document) {
        const pagePath = join(pageDir, `page-${pageNumber}.png`);
        await writeFile(pagePath, image);
        const text = await this.runTesseract(pagePath);
        pageTexts.push(text.trim());
        pageNumber++;
      }
    } finally {
      await rm(pageDir, { recursive: true, force: true });
    }

    return pageTexts;
  }

  private async imageToText(data: ImageToTextJobData): Promise<JobResult> {
    const tmpBase = join(this.storage.outputsDir, randomUUID());
    const tmpOutput = `${tmpBase}.txt`;

    try {
      await execFileAsync('tesseract', [data.inputPath, tmpBase, '-l', 'vie'], {
        timeout: 60_000,
      });
      await rename(tmpOutput, this.storage.outputPath(data.outputFileName));
      return { outputFileName: data.outputFileName };
    } catch (err) {
      // tesseract có thể bị kill giữa chừng (timeout/crash) sau khi đã ghi
      // một phần file .txt, hoặc rename() có thể fail (disk đầy...) - dọn
      // file trung gian mồ côi ngay thay vì chờ TTL cleanup định kỳ.
      await unlink(tmpOutput).catch(() => undefined);
      throw err;
    }
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
    // văn theo dòng xuống dòng của tesseract. Đây là tái tạo layout ở mức
    // tương đối (không giữ bảng biểu/vị trí ảnh như bản gốc) - phù hợp cho
    // PDF scan/ảnh vốn không có text layer để LibreOffice đọc được.
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
