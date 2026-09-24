import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { writeFile, rm, mkdtemp, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Document, Packer, Paragraph, HeadingLevel, Table } from 'docx';
import { StorageService } from '../storage/storage.service';
import {
  OCR_QUEUE,
  OcrJobName,
  OcrJobData,
  OcrPdfToWordAiJobData,
  JobResult,
} from '../jobs/jobs.constants';
import { htmlToDocxBlocks } from './html-to-docx.util';
import { ocrPageWithAiModel } from '../ai-providers/ai-provider.dispatch';
import { AiModelsService } from '../ai-models/ai-models.service';

// Cac tool OCR truyen thong (Tesseract/PaddleOCR: image-to-text, pdf-to-text,
// pdf-to-word) DA BI XOA khoi processor nay (2026-09-24, theo yeu cau "trong
// các tính năng OCR bỏ hết các công cụ kia, do không hiệu quả, chỉ để 1 công
// cụ này thôi") - chi giu lai pdfToWordAi() vi cho ket qua giu duoc bang
// bieu/cau truc/hinh anh gan voi ban goc hon han OCR truyen thong.
@Processor(OCR_QUEUE)
export class OcrProcessor extends WorkerHost {
  constructor(
    private readonly storage: StorageService,
    private readonly aiModelsService: AiModelsService,
  ) {
    super();
  }

  async process(
    job: Job<OcrJobData, JobResult, OcrJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case OcrJobName.PdfToWordAi:
        return this.pdfToWordAi(job.data);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  /** Render từng trang PDF thành file PNG trong pageDir, trả về danh sách đường dẫn theo thứ tự trang. */
  private async renderPdfPagesToFiles(
    inputPath: string,
    pageDir: string,
  ): Promise<string[]> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(inputPath, { scale: 2 });

    const pagePaths: string[] = [];
    let pageNumber = 1;
    for await (const image of document) {
      const pagePath = join(pageDir, `page-${pageNumber}.png`);
      await writeFile(pagePath, image);
      pagePaths.push(pagePath);
      pageNumber++;
    }
    return pagePaths;
  }

  /**
   * "OCR PDF sang Word (AI)" - dung Vision LLM (Gemini/Claude/GPT, chon qua
   * modelConfigId - xem AiModelsService) doc TUNG TRANG anh va tra ve HTML
   * giu dung bang bieu (ke ca merge cell qua colspan/rowspan)/tieu de/dinh
   * dang chu, roi parse HTML do thanh Paragraph/Table that cua docx (xem
   * html-to-docx.util.ts) - giu duoc format gan voi ban goc hon nhieu so voi
   * cach noi text thuan cua OCR truyen thong (2026-09-23).
   */
  private async pdfToWordAi(data: OcrPdfToWordAiJobData): Promise<JobResult> {
    const modelConfig = await this.aiModelsService.getById(data.modelConfigId);

    const pageDir = await mkdtemp(join(tmpdir(), 'ocr-ai-pdf-'));
    let pagePaths: string[];
    try {
      pagePaths = await this.renderPdfPagesToFiles(data.inputPath, pageDir);

      const children: (Paragraph | Table)[] = [];
      for (let i = 0; i < pagePaths.length; i++) {
        const imageBytes = await readFile(pagePaths[i]);
        const html = await ocrPageWithAiModel(modelConfig, imageBytes);

        children.push(this.buildPageHeading(i));
        if (html.trim()) {
          children.push(...(await htmlToDocxBlocks(html, imageBytes)));
        } else {
          children.push(new Paragraph({ text: '' }));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);

      const outputPath = this.storage.outputPath(data.outputFileName);
      await writeFile(outputPath, buffer);
      return { outputFileName: data.outputFileName };
    } finally {
      await rm(pageDir, { recursive: true, force: true });
    }
  }

  private buildPageHeading(pageIndex: number): Paragraph {
    return new Paragraph({
      text: `Trang ${pageIndex + 1}`,
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: pageIndex > 0,
    });
  }
}
