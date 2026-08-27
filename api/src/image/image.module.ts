import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { ImageProcessor } from './image.processor';
import { IMAGE_QUEUE } from '../jobs/jobs.constants';

@Module({
  imports: [BullModule.registerQueue({ name: IMAGE_QUEUE })],
  controllers: [ImageController],
  providers: [ImageService, ImageProcessor],
})
export class ImageModule {}
