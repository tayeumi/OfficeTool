import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LoggingService } from './logging.service';

@ApiTags('logging')
@Controller('usage-stats')
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  @Get()
  @ApiOperation({
    summary:
      'Thống kê sử dụng OfficeTool theo người dùng/công cụ/ngày (đọc từ usage.log)',
  })
  @ApiQuery({ name: 'fromDate', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'toDate', required: false, example: '2026-09-30' })
  async getUsageStats(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.loggingService.getUsageStats({ fromDate, toDate });
  }
}
