import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { rename, unlink, writeFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, readFile } from 'fs/promises';
import { StorageService } from '../storage/storage.service';
import {
  OCR_QUEUE,
  OcrJobName,
  OcrJobData,
  ImageToTextJobData,
  PdfToTextJobData,
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
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(data.inputPath, { scale: 2 });

    const pageDir = await mkdtemp(join(tmpdir(), 'ocr-pdf-'));
    const pageTexts: string[] = [];

    try {
      let pageNumber = 1;
      for await (const image of document) {
        const pagePath = join(pageDir, `page-${pageNumber}.png`);
        await writeFile(pagePath, image);
        const text = await this.runTesseract(pagePath);
        pageTexts.push(`--- Trang ${pageNumber} ---\n${text.trim()}`);
        pageNumber++;
      }
    } finally {
      await rm(pageDir, { recursive: true, force: true });
    }

    const outputPath = this.storage.outputPath(data.outputFileName);
    await writeFile(outputPath, pageTexts.join('\n\n'), 'utf-8');
    return { outputFileName: data.outputFileName };
  }
}
