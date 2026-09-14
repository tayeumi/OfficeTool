import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  PDF_QUEUE,
  PdfJobName,
  MergeJobData,
  SplitJobData,
  CompressJobData,
  ToImageJobData,
  WatermarkJobData,
  PageNumbersJobData,
  RotateJobData,
  DeletePagesJobData,
  ProtectJobData,
  UnlockJobData,
  SignJobData,
  ImagesToPdfJobData,
} from '../jobs/jobs.constants';

const JOB_OPTIONS = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 3600 },
};

@Injectable()
export class PdfService {
  constructor(@InjectQueue(PDF_QUEUE) private readonly queue: Queue) {}

  async queueMerge(
    inputPaths: string[],
    pageOrder?: MergeJobData['pageOrder'],
  ) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Merge,
      { inputPaths, pageOrder, outputFileName } satisfies MergeJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueSplit(inputPath: string, ranges: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Split,
      { inputPath, ranges, outputFileName } satisfies SplitJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueCompress(inputPath: string, level: CompressJobData['level']) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Compress,
      { inputPath, level, outputFileName } satisfies CompressJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueToImage(inputPath: string, scale: number) {
    const outputFileName = `${randomUUID()}.zip`;
    const job = await this.queue.add(
      PdfJobName.ToImage,
      { inputPath, scale, outputFileName } satisfies ToImageJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueWatermark(inputPath: string, text: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Watermark,
      { inputPath, text, outputFileName } satisfies WatermarkJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queuePageNumbers(inputPath: string, startAt: number) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.PageNumbers,
      { inputPath, startAt, outputFileName } satisfies PageNumbersJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueRotate(inputPath: string, pageRotations: Record<number, number>) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Rotate,
      { inputPath, pageRotations, outputFileName } satisfies RotateJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueDeletePages(inputPath: string, pages: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.DeletePages,
      { inputPath, pages, outputFileName } satisfies DeletePagesJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueProtect(inputPath: string, password: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Protect,
      { inputPath, password, outputFileName } satisfies ProtectJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueUnlock(inputPath: string, password: string) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Unlock,
      { inputPath, password, outputFileName } satisfies UnlockJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueSign(
    inputPath: string,
    signaturePath: string,
    page: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.Sign,
      {
        inputPath,
        signaturePath,
        page,
        x,
        y,
        width,
        height,
        outputFileName,
      } satisfies SignJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }

  async queueImagesToPdf(inputPaths: string[]) {
    const outputFileName = `${randomUUID()}.pdf`;
    const job = await this.queue.add(
      PdfJobName.ImagesToPdf,
      { inputPaths, outputFileName } satisfies ImagesToPdfJobData,
      JOB_OPTIONS,
    );
    return { jobId: `pdf:${job.id}` };
  }
}
