import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { StorageService } from '../storage/storage.service';
import { PDF_QUEUE, PdfJobName, MergeJobData, JobResult } from '../jobs/jobs.constants';

@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(job: Job<MergeJobData, JobResult, PdfJobName>): Promise<JobResult> {
    switch (job.name) {
      case PdfJobName.Merge:
        return this.merge(job.data);
      default:
        throw new Error(`Unknown job: ${job.name}`);
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

    const outputBytes = await merged.save();
    const outputPath = this.storage.outputPath(data.outputFileName);
    await writeFile(outputPath, outputBytes);

    return { outputFileName: data.outputFileName };
  }
}
