import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import { StorageService } from '../storage/storage.service';

const uploadsDir = resolve(process.env.STORAGE_DIR ?? './storage', 'uploads');

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly storage: StorageService,
  ) {}

  @Post('merge')
  @ApiOperation({ summary: 'Ghép nhiều file PDF thành 1 file (xử lý bất đồng bộ qua queue)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
    }),
  )
  async merge(@UploadedFiles() files: Array<{ path: string; mimetype: string }>) {
    if (!files?.length || files.length < 2) {
      throw new BadRequestException('Cần tối thiểu 2 file PDF để ghép');
    }
    for (const file of files) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Tất cả file phải là PDF');
      }
    }

    const { jobId } = await this.pdfService.queueMerge(files.map((f) => f.path));
    return { jobId };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái job (pending/active/completed/failed)' })
  @ApiParam({ name: 'jobId', example: '1' })
  async getStatus(@Param('jobId') jobId: string) {
    const status = await this.pdfService.getJobStatus(jobId);
    if (!status) throw new NotFoundException('Job không tồn tại');
    return status;
  }

  @Get('download/:fileName')
  @ApiOperation({ summary: 'Tải file kết quả sau khi job completed' })
  @ApiParam({ name: 'fileName', example: 'uuid.pdf' })
  async download(@Param('fileName') fileName: string, @Res() res: Response) {
    const path = this.storage.outputPath(fileName);
    if (!existsSync(path)) throw new NotFoundException('File không tồn tại hoặc đã hết hạn');
    res.download(path);
  }
}
