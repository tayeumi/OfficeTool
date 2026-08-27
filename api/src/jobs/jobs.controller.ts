import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('jobs')
@Controller()
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly storage: StorageService,
  ) {}

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái job (pending/active/completed/failed)',
  })
  @ApiParam({ name: 'jobId', example: 'pdf:1' })
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.jobsService.getJobStatus(jobId);
    if (!status) throw new NotFoundException('Job không tồn tại');
    return status;
  }

  @Get('download/:fileName')
  @ApiOperation({ summary: 'Tải file kết quả sau khi job completed' })
  @ApiParam({ name: 'fileName', example: 'uuid.pdf' })
  download(@Param('fileName') fileName: string, @Res() res: Response) {
    const path = this.storage.outputPath(fileName);
    if (!existsSync(path))
      throw new NotFoundException('File không tồn tại hoặc đã hết hạn');
    res.download(path);
  }
}
