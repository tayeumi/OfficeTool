import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  IMAGE_QUEUE,
  ImageJobName,
  ImageCompressJobData,
  ImageConvertJobData,
  ImageResizeJobData,
} from '../jobs/jobs.constants';

const JOB_OPTIONS = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 3600 },
};

const EXTENSION_BY_FORMAT: Record<string, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

@Injectable()
export class ImageService {
  constructor(@InjectQueue(IMAGE_QUEUE) private readonly queue: Queue) {}

  async queueCompress(inputPath: string) {
    const outputFileName = `${randomUUID()}${extname(inputPath)}`;
    const job = await this.queue.add(
      ImageJobName.Compress,
      { inputPath, outputFileName } satisfies ImageCompressJobData,
      JOB_OPTIONS,
    );
    return { jobId: `image:${job.id}` };
  }

  async queueConvert(inputPath: string, targetFormat: 'jpeg' | 'png' | 'webp') {
    const outputFileName = `${randomUUID()}${EXTENSION_BY_FORMAT[targetFormat]}`;
    const job = await this.queue.add(
      ImageJobName.Convert,
      { inputPath, targetFormat, outputFileName } satisfies ImageConvertJobData,
      JOB_OPTIONS,
    );
    return { jobId: `image:${job.id}` };
  }

  async queueResize(
    inputPath: string,
    dims: { width?: number; height?: number; percent?: number },
  ) {
    const outputFileName = `${randomUUID()}${extname(inputPath)}`;
    const job = await this.queue.add(
      ImageJobName.Resize,
      {
        inputPath,
        ...dims,
        outputFileName,
      } satisfies ImageResizeJobData,
      JOB_OPTIONS,
    );
    return { jobId: `image:${job.id}` };
  }
}
