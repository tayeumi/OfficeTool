import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  OCR_QUEUE,
  OcrJobName,
  ImageToTextJobData,
  PdfToTextJobData,
  OcrPdfToWordJobData,
} from '../jobs/jobs.constants';

const JOB_OPTIONS = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 3600 },
};

@Injectable()
export class OcrService {
  constructor(@InjectQueue(OCR_QUEUE) private readonly queue: Queue) {}

  async queueImageToText(inputPath: string) {
    const outputFileName = `${randomUUID()}.txt`;
    const job = await this.queue.add(
      OcrJobName.ImageToText,
      { inputPath, outputFileName } satisfies ImageToTextJobData,
      JOB_OPTIONS,
    );
    return { jobId: `ocr:${job.id}` };
  }

  async queuePdfToText(inputPath: string) {
    const outputFileName = `${randomUUID()}.txt`;
    const job = await this.queue.add(
      OcrJobName.PdfToText,
      { inputPath, outputFileName } satisfies PdfToTextJobData,
      JOB_OPTIONS,
    );
    return { jobId: `ocr:${job.id}` };
  }

  async queuePdfToWord(inputPath: string) {
    const outputFileName = `${randomUUID()}.docx`;
    const job = await this.queue.add(
      OcrJobName.PdfToWord,
      { inputPath, outputFileName } satisfies OcrPdfToWordJobData,
      JOB_OPTIONS,
    );
    return { jobId: `ocr:${job.id}` };
  }
}
