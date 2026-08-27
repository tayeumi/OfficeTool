import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PDF_QUEUE,
  OFFICE_QUEUE,
  IMAGE_QUEUE,
  OCR_QUEUE,
} from './jobs.constants';

@Injectable()
export class JobsService {
  private readonly queuesByDomain: Record<string, Queue>;

  constructor(
    @InjectQueue(PDF_QUEUE) pdfQueue: Queue,
    @InjectQueue(OFFICE_QUEUE) officeQueue: Queue,
    @InjectQueue(IMAGE_QUEUE) imageQueue: Queue,
    @InjectQueue(OCR_QUEUE) ocrQueue: Queue,
  ) {
    this.queuesByDomain = {
      pdf: pdfQueue,
      office: officeQueue,
      image: imageQueue,
      ocr: ocrQueue,
    };
  }

  async getJobStatus(prefixedJobId: string) {
    const separatorIndex = prefixedJobId.indexOf(':');
    if (separatorIndex === -1) {
      throw new BadRequestException('jobId không hợp lệ');
    }

    const domain = prefixedJobId.slice(0, separatorIndex);
    const rawId = prefixedJobId.slice(separatorIndex + 1);
    const queue = this.queuesByDomain[domain];
    if (!queue) {
      throw new BadRequestException('jobId không hợp lệ');
    }

    const job = await queue.getJob(rawId);
    if (!job) return null;

    const state = await job.getState();
    const result = job.returnvalue as { outputFileName: string } | undefined;
    return {
      jobId: prefixedJobId,
      state,
      outputFileName:
        state === 'completed' ? result?.outputFileName : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
    };
  }
}
