import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from './storage.service';

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(private readonly storage: StorageService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCleanup() {
    await this.storage.cleanupExpired();
    this.logger.log('Expired files cleaned up');
  }
}
