import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  OCR_QUEUE,
  OcrJobName,
  OcrPdfToWordAiJobData,
} from '../jobs/jobs.constants';

const JOB_OPTIONS = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 3600 },
};

@Injectable()
export class OcrService {
  constructor(@InjectQueue(OCR_QUEUE) private readonly queue: Queue) {}

  async queuePdfToWordAi(inputPath: string, modelConfigId: string) {
    const outputFileName = `${randomUUID()}.docx`;
    const job = await this.queue.add(
      OcrJobName.PdfToWordAi,
      {
        inputPath,
        modelConfigId,
        outputFileName,
      } satisfies OcrPdfToWordAiJobData,
      JOB_OPTIONS,
    );
    return { jobId: `ocr:${job.id}` };
  }
}
