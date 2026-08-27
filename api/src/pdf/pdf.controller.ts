import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import {
  singleFileUpload,
  uploadsDir,
  assertMimetype,
} from '../uploads/upload.util';

const singlePdfUpload = singleFileUpload('file');

function assertIsPdf(
  file: { mimetype: string } | undefined,
): asserts file is { mimetype: string } {
  assertMimetype(file, ['application/pdf'], 'File phải là PDF');
}

@ApiTags('pdf')
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('merge')
  @ApiOperation({
    summary: 'Ghép nhiều file PDF thành 1 file (xử lý bất đồng bộ qua queue)',
  })
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
        filename: (_req, file: { originalname: string }, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
    }),
  )
  async merge(
    @UploadedFiles() files: Array<{ path: string; mimetype: string }>,
  ) {
    if (!files?.length || files.length < 2) {
      throw new BadRequestException('Cần tối thiểu 2 file PDF để ghép');
    }
    for (const file of files) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Tất cả file phải là PDF');
      }
    }

    const { jobId } = await this.pdfService.queueMerge(
      files.map((f) => f.path),
    );
    return { jobId };
  }

  @Post('split')
  @ApiOperation({
    summary: 'Tách 1 file PDF theo khoảng trang (vd: "1-3,5,8-10")',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        ranges: { type: 'string', example: '1-3,5,8-10' },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async split(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('ranges') ranges: string,
  ) {
    assertIsPdf(file);
    if (!ranges?.trim()) {
      throw new BadRequestException(
        'Cần chỉ định khoảng trang, vd: "1-3,5,8-10"',
      );
    }

    const { jobId } = await this.pdfService.queueSplit(file.path, ranges);
    return { jobId };
  }

  @Post('compress')
  @ApiOperation({ summary: 'Nén file PDF để giảm dung lượng' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async compress(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertIsPdf(file);
    const { jobId } = await this.pdfService.queueCompress(file.path);
    return { jobId };
  }

  @Post('to-image')
  @ApiOperation({
    summary: 'Xuất từng trang PDF thành ảnh PNG, đóng gói vào file .zip',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        scale: { type: 'number', example: 2 },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async toImage(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('scale') scaleInput: string,
  ) {
    assertIsPdf(file);
    const scale = scaleInput ? Number(scaleInput) : 2;
    if (!Number.isFinite(scale) || scale <= 0 || scale > 10) {
      throw new BadRequestException('scale phải là số trong khoảng (0, 10]');
    }

    const { jobId } = await this.pdfService.queueToImage(file.path, scale);
    return { jobId };
  }

  @Post('watermark')
  @ApiOperation({ summary: 'Chèn watermark chữ vào mọi trang của file PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        text: { type: 'string', example: 'CONFIDENTIAL' },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async watermark(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('text') text: string,
  ) {
    assertIsPdf(file);
    if (!text?.trim()) {
      throw new BadRequestException('Cần nhập nội dung watermark');
    }

    const { jobId } = await this.pdfService.queueWatermark(file.path, text);
    return { jobId };
  }

  @Post('page-numbers')
  @ApiOperation({ summary: 'Đánh số trang vào mọi trang của file PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        startAt: { type: 'number', example: 1 },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async pageNumbers(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('startAt') startAtInput: string,
  ) {
    assertIsPdf(file);
    const startAt = startAtInput ? Number(startAtInput) : 1;
    if (!Number.isInteger(startAt) || startAt < 0) {
      throw new BadRequestException('startAt phải là số nguyên không âm');
    }

    const { jobId } = await this.pdfService.queuePageNumbers(
      file.path,
      startAt,
    );
    return { jobId };
  }
}
