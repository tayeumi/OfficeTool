import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { OcrProcessor } from './ocr.processor';
import { OCR_QUEUE } from '../jobs/jobs.constants';

@Module({
  imports: [BullModule.registerQueue({ name: OCR_QUEUE })],
  controllers: [OcrController],
  providers: [OcrService, OcrProcessor],
})
export class OcrModule {}
