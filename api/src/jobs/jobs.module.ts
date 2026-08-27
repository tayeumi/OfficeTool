import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import {
  PDF_QUEUE,
  OFFICE_QUEUE,
  IMAGE_QUEUE,
  OCR_QUEUE,
} from './jobs.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: PDF_QUEUE },
      { name: OFFICE_QUEUE },
      { name: IMAGE_QUEUE },
      { name: OCR_QUEUE },
    ),
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
