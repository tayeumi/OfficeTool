import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  OFFICE_QUEUE,
  OfficeJobName,
  WordToPdfJobData,
  ExcelToPdfJobData,
  PdfToWordJobData,
  ExcelMergeJobData,
  PptToPdfJobData,
  PdfToPptJobData,
} from '../jobs/jobs.constants';

const JOB_OPTIONS = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 3600 },
};

@Injectable()
export class OfficeService {
  constructor(@InjectQueue(OFFICE_QUEUE) private readonly queue: Queue) {}

  async queueWordToPdf(inputPath: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      OfficeJobName.WordToPdf,
      { inputPath, outputFileName } satisfies WordToPdfJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }

  async queueExcelToPdf(inputPath: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      OfficeJobName.ExcelToPdf,
      { inputPath, outputFileName } satisfies ExcelToPdfJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }

  async queuePdfToWord(inputPath: string) {
    const outputFileName = `${randomUUID()}.docx`;
    const job = await this.queue.add(
      OfficeJobName.PdfToWord,
      { inputPath, outputFileName } satisfies PdfToWordJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }

  async queueExcelMerge(inputPaths: string[]) {
    const outputFileName = `${randomUUID()}.xlsx`;
    const job = await this.queue.add(
      OfficeJobName.ExcelMerge,
      { inputPaths, outputFileName } satisfies ExcelMergeJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }

  async queuePptToPdf(inputPath: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      OfficeJobName.PptToPdf,
      { inputPath, outputFileName } satisfies PptToPdfJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }

  async queuePdfToPpt(inputPath: string) {
    const outputFileName = `${randomUUID()}.pptx`;
    const job = await this.queue.add(
      OfficeJobName.PdfToPpt,
      { inputPath, outputFileName } satisfies PdfToPptJobData,
      JOB_OPTIONS,
    );
    return { jobId: `office:${job.id}` };
  }
}
