import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { StorageService } from '../storage/storage.service';
import {
  PDF_QUEUE,
  PdfJobName,
  PdfJobData,
  MergeJobData,
  SplitJobData,
  CompressJobData,
  ToImageJobData,
  WatermarkJobData,
  PageNumbersJobData,
  JobResult,
} from '../jobs/jobs.constants';
import { parsePageRanges } from './page-range.util';

@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(
    job: Job<PdfJobData, JobResult, PdfJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case PdfJobName.Merge:
        return this.merge(job.data as MergeJobData);
      case PdfJobName.Split:
        return this.split(job.data as SplitJobData);
      case PdfJobName.Compress:
        return this.compress(job.data as CompressJobData);
      case PdfJobName.ToImage:
        return this.toImage(job.data as ToImageJobData);
      case PdfJobName.Watermark:
        return this.watermark(job.data as WatermarkJobData);
      case PdfJobName.PageNumbers:
        return this.pageNumbers(job.data as PageNumbersJobData);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  private async merge(data: MergeJobData): Promise<JobResult> {
    const merged = await PDFDocument.create();

    for (const inputPath of data.inputPaths) {
      const bytes = await readFile(inputPath);
      const doc = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    return this.saveOutput(merged, data.outputFileName);
  }

  private async split(data: SplitJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const pageIndices = parsePageRanges(data.ranges, srcDoc.getPageCount());

    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, pageIndices);
    pages.forEach((page) => newDoc.addPage(page));

    return this.saveOutput(newDoc, data.outputFileName);
  }

  private async compress(data: CompressJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('');
    doc.setCreator('');

    return this.saveOutput(doc, data.outputFileName, {
      objectsPerTick: Infinity,
    });
  }

  private async toImage(data: ToImageJobData): Promise<JobResult> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(data.inputPath, { scale: data.scale });

    const outputPath = this.storage.outputPath(data.outputFileName);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(outputPath);

    const done = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });
    archive.pipe(output);

    let pageNumber = 1;
    for await (const image of document) {
      archive.append(image, {
        name: `page-${String(pageNumber).padStart(3, '0')}.png`,
      });
      pageNumber++;
    }

    await archive.finalize();
    await done;

    return { outputFileName: data.outputFileName };
  }

  private async watermark(data: WatermarkJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 10;
      const textWidth = font.widthOfTextAtSize(data.text, fontSize);

      page.drawText(data.text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.3,
        rotate: degrees(45),
      });
    }

    return this.saveOutput(doc, data.outputFileName);
  }

  private async pageNumbers(data: PageNumbersJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;

    doc.getPages().forEach((page, index) => {
      const { width } = page.getSize();
      const label = String(data.startAt + index);
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      page.drawText(label, {
        x: width / 2 - textWidth / 2,
        y: 20,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    return this.saveOutput(doc, data.outputFileName);
  }

  private async saveOutput(
    doc: PDFDocument,
    outputFileName: string,
    saveOptions?: Parameters<PDFDocument['save']>[0],
  ): Promise<JobResult> {
    const outputBytes = await doc.save(saveOptions);
    const outputPath = this.storage.outputPath(outputFileName);
    await writeFile(outputPath, outputBytes);
    return { outputFileName };
  }
}
