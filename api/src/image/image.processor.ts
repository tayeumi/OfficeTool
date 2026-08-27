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
  ImageRotateJobData,
  ImageCropJobData,
  ImageWatermarkJobData,
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
      case ImageJobName.Rotate:
        return this.rotate(job.data as ImageRotateJobData);
      case ImageJobName.Crop:
        return this.crop(job.data as ImageCropJobData);
      case ImageJobName.Watermark:
        return this.watermark(job.data as ImageWatermarkJobData);
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

  private async rotate(data: ImageRotateJobData): Promise<JobResult> {
    let image = sharp(data.inputPath);
    if (data.flip === 'horizontal') image = image.flop();
    if (data.flip === 'vertical') image = image.flip();
    if (data.degrees) image = image.rotate(data.degrees);

    const outputPath = this.storage.outputPath(data.outputFileName);
    await image.toFile(outputPath);
    return { outputFileName: data.outputFileName };
  }

  private async crop(data: ImageCropJobData): Promise<JobResult> {
    const outputPath = this.storage.outputPath(data.outputFileName);
    await sharp(data.inputPath)
      .extract({
        left: data.left,
        top: data.top,
        width: data.width,
        height: data.height,
      })
      .toFile(outputPath);
    return { outputFileName: data.outputFileName };
  }

  private async watermark(data: ImageWatermarkJobData): Promise<JobResult> {
    const image = sharp(data.inputPath);
    const metadata = await image.metadata();
    const outputPath = this.storage.outputPath(data.outputFileName);

    const textOverlay = await sharp({
      text: {
        text: `<span foreground="white">${escapeXml(data.text)}</span>`,
        width: metadata.width ?? 800,
        rgba: true,
        align: 'center',
      },
    })
      .png()
      .toBuffer();

    await image
      .composite([{ input: textOverlay, gravity: 'center', blend: 'over' }])
      .toFile(outputPath);
    return { outputFileName: data.outputFileName };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
