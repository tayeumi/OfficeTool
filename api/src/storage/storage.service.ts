import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, stat, statfs, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { parseUsageLogFileName } from '../logging/usage-log-path.util';

const LOW_DISK_WARNING_RATIO = 0.1;
// So thang giu lai file usage-YYYY-MM.log truoc khi xoa - GIU LAU HON NHIEU
// so voi FILE_TTL_MINUTES cua uploads/outputs (thuong tinh bang phut, vi la
// file tam trong luc xu ly job) vi day la du lieu THONG KE can xem lai lich
// su nhieu thang, khong phai file rac. 12 thang du de so sanh theo quy/nam
// ma khong de file tich luy vo han (2026-09-13, theo yeu cau "định kỳ vẫn
// xoá file rác đầy đủ chứ").
const USAGE_LOG_RETENTION_MONTHS = 12;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly rootDir: string;
  private readonly ttlMinutes: number;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(this.config.get<string>('storage.dir')!);
    this.ttlMinutes = this.config.get<number>('storage.fileTtlMinutes')!;
  }

  async onModuleInit() {
    await mkdir(this.uploadsDir, { recursive: true });
    await mkdir(this.outputsDir, { recursive: true });
  }

  get uploadsDir() {
    return join(this.rootDir, 'uploads');
  }

  get outputsDir() {
    return join(this.rootDir, 'outputs');
  }

  outputPath(fileName: string) {
    return join(this.outputsDir, fileName);
  }

  uploadPath(fileName: string) {
    return join(this.uploadsDir, fileName);
  }

  async cleanupExpired() {
    const cutoff = Date.now() - this.ttlMinutes * 60_000;
    for (const dir of [this.uploadsDir, this.outputsDir]) {
      const entries = await readdir(dir);
      for (const entry of entries) {
        const path = join(dir, entry);
        // File có thể bị job khác xóa/rename giữa lúc readdir() liệt kê và
        // lúc stat() đọc - đây là race condition bình thường (không phải
        // lỗi), bỏ qua entry đó thay vì để throw làm hỏng cả vòng quét.
        const info = await stat(path).catch(() => null);
        if (info && info.mtimeMs < cutoff) {
          await unlink(path).catch(() => undefined);
        }
      }
    }

    await this.cleanupOldUsageLogs();
    await this.warnIfDiskLow();
  }

  /**
   * Xoá các file usage-YYYY-MM.log cũ hơn USAGE_LOG_RETENTION_MONTHS tháng -
   * file này nằm ở rootDir (không phải uploads/outputs) nên KHÔNG bị dọn bởi
   * vòng lặp cleanupExpired() ở trên, cần xử lý riêng.
   */
  private async cleanupOldUsageLogs() {
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - USAGE_LOG_RETENTION_MONTHS);

    const entries = await readdir(this.rootDir).catch(() => []);
    for (const fileName of entries) {
      const monthStart = parseUsageLogFileName(fileName);
      if (monthStart && monthStart.getTime() < cutoff.getTime()) {
        await unlink(join(this.rootDir, fileName)).catch(() => undefined);
      }
    }
  }

  private async warnIfDiskLow() {
    try {
      const stats = await statfs(this.rootDir);
      const availableRatio = stats.bavail / stats.blocks;
      if (availableRatio < LOW_DISK_WARNING_RATIO) {
        const availableMb = Math.round(
          (stats.bavail * stats.bsize) / (1024 * 1024),
        );
        this.logger.warn(
          `Dung lượng ổ đĩa storage sắp hết: còn ${availableMb}MB (${(availableRatio * 100).toFixed(1)}%)`,
        );
      }
    } catch {
      // statfs có thể không khả dụng trên mọi hệ điều hành/filesystem -
      // đây chỉ là cảnh báo phụ trợ, không để nó làm gián đoạn cleanup chính.
    }
  }
}
