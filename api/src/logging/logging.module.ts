import { Module } from '@nestjs/common';
import { LoggingController } from './logging.controller';
import { LoggingService } from './logging.service';
import { UsageLogMiddleware } from './usage-log.middleware';

@Module({
  controllers: [LoggingController],
  providers: [LoggingService, UsageLogMiddleware],
  exports: [UsageLogMiddleware],
})
export class LoggingModule {}
