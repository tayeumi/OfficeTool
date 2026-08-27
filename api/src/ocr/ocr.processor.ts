import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { rename, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { StorageService } from '../storage/storage.service';
import {
  OCR_QUEUE,
  OcrJobName,
  OcrJobData,
  JobResult,
} from '../jobs/jobs.constants';

const execFileAsync = promisify(execFile);

@Processor(OCR_QUEUE)
export class OcrProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(
    job: Job<OcrJobData, JobResult, OcrJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case OcrJobName.ImageToText:
        return this.imageToText(job.data);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  private async imageToText(data: OcrJobData): Promise<JobResult> {
    // tesseract tự thêm ".txt" vào base path được truyền, nên dùng base tạm
    // rồi rename sang tên output UUID cuối cùng (giống quy ước các domain khác).
    const tmpBase = join(this.storage.outputsDir, randomUUID());
    const tmpOutput = `${tmpBase}.txt`;

    try {
      await execFileAsync('tesseract', [data.inputPath, tmpBase, '-l', 'vie'], {
        timeout: 60_000,
      });
      await rename(tmpOutput, this.storage.outputPath(data.outputFileName));
      return { outputFileName: data.outputFileName };
    } catch (err) {
      // tesseract có thể bị kill giữa chừng (timeout/crash) sau khi đã ghi
      // một phần file .txt, hoặc rename() có thể fail (disk đầy...) - dọn
      // file trung gian mồ côi ngay thay vì chờ TTL cleanup định kỳ.
      await unlink(tmpOutput).catch(() => undefined);
      throw err;
    }
  }
}
