import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';
import {
  IMAGE_QUEUE,
  ImageJobName,
  ImageJobData,
  ImageCompressJobData,
  ImageConvertJobData,
  ImageResizeJobData,
  JobResult,
} from '../jobs/jobs.constants';

@Processor(IMAGE_QUEUE)
export class ImageProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(
    job: Job<ImageJobData, JobResult, ImageJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case ImageJobName.Compress:
        return this.compress(job.data);
      case ImageJobName.Convert:
        return this.convert(job.data as ImageConvertJobData);
      case ImageJobName.Resize:
        return this.resize(job.data);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  private async compress(data: ImageCompressJobData): Promise<JobResult> {
    const image = sharp(data.inputPath);
    const metadata = await image.metadata();
    const outputPath = this.storage.outputPath(data.outputFileName);

    if (metadata.format === 'png') {
      await image.png({ compressionLevel: 9, quality: 80 }).toFile(outputPath);
    } else {
      await image.jpeg({ quality: 70, mozjpeg: true }).toFile(outputPath);
    }

    return { outputFileName: data.outputFileName };
  }

  private async convert(data: ImageConvertJobData): Promise<JobResult> {
    const image = sharp(data.inputPath)[data.targetFormat]();
    const outputPath = this.storage.outputPath(data.outputFileName);
    await image.toFile(outputPath);
    return { outputFileName: data.outputFileName };
  }

  private async resize(data: ImageResizeJobData): Promise<JobResult> {
    const image = sharp(data.inputPath);
    const outputPath = this.storage.outputPath(data.outputFileName);

    if (data.percent) {
      const metadata = await image.metadata();
      const targetWidth = Math.round(
        ((metadata.width ?? 0) * data.percent) / 100,
      );
      await image.resize({ width: targetWidth }).toFile(outputPath);
    } else {
      await image
        .resize({ width: data.width, height: data.height, fit: 'inside' })
        .toFile(outputPath);
    }

    return { outputFileName: data.outputFileName };
  }
}
