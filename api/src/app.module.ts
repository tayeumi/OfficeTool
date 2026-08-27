import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import { StorageModule } from './storage/storage.module';
import { CleanupScheduler } from './storage/cleanup.scheduler';
import { PdfModule } from './pdf/pdf.module';
import { OfficeModule } from './office/office.module';
import { ImageModule } from './image/image.module';
import { OcrModule } from './ocr/ocr.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
    StorageModule,
    PdfModule,
    OfficeModule,
    ImageModule,
    OcrModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [AppService, CleanupScheduler],
})
export class AppModule {}
