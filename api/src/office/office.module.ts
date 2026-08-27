import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OfficeController } from './office.controller';
import { OfficeService } from './office.service';
import { OfficeProcessor } from './office.processor';
import { OFFICE_QUEUE } from '../jobs/jobs.constants';

@Module({
  imports: [BullModule.registerQueue({ name: OFFICE_QUEUE })],
  controllers: [OfficeController],
  providers: [OfficeService, OfficeProcessor],
})
export class OfficeModule {}
