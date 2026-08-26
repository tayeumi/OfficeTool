import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PDF_QUEUE, PdfJobName, MergeJobData } from '../jobs/jobs.constants';

@Injectable()
export class PdfService {
  constructor(@InjectQueue(PDF_QUEUE) private readonly queue: Queue) {}

  async queueMerge(inputPaths: string[]) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Merge,
      { inputPaths, outputFileName } satisfies MergeJobData,
      { removeOnComplete: { age: 3600 }, removeOnFail: { age: 3600 } },
    );
    return { jobId: job.id! };
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const result = job.returnvalue as { outputFileName: string } | undefined;
    return {
      jobId,
      state,
      outputFileName: state === 'completed' ? result?.outputFileName : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
    };
  }
}
