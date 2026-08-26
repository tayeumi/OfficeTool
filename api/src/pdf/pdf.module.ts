import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfProcessor } from './pdf.processor';
import { PDF_QUEUE } from '../jobs/jobs.constants';

@Module({
  imports: [BullModule.registerQueue({ name: PDF_QUEUE })],
  controllers: [PdfController],
  providers: [PdfService, PdfProcessor],
})
export class PdfModule {}
