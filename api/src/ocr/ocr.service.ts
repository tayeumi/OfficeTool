import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  OCR_QUEUE,
  OcrJobName,
  ImageToTextJobData,
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
}
