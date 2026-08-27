import {
  BadRequestException,
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
import { OfficeService } from './office.service';
import {
  singleFileUpload,
  uploadsDir,
  assertMimetype,
} from '../uploads/upload.util';

const WORD_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const EXCEL_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPT_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const singleWordUpload = singleFileUpload('file');
const singleExcelUpload = singleFileUpload('file');
const singlePdfUpload = singleFileUpload('file');
const singlePptUpload = singleFileUpload('file');
const singlePdfForPptUpload = singleFileUpload('file');

@ApiTags('office')
@Controller('office')
export class OfficeController {
  constructor(private readonly officeService: OfficeService) {}

  @Post('word-to-pdf')
  @ApiOperation({ summary: 'Chuyển file Word (.docx) sang PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singleWordUpload)
  async wordToPdf(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, [WORD_MIMETYPE], 'File phải là Word (.docx)');
    const { jobId } = await this.officeService.queueWordToPdf(file.path);
    return { jobId };
  }

  @Post('excel-to-pdf')
  @ApiOperation({ summary: 'Chuyển file Excel (.xlsx) sang PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singleExcelUpload)
  async excelToPdf(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, [EXCEL_MIMETYPE], 'File phải là Excel (.xlsx)');
    const { jobId } = await this.officeService.queueExcelToPdf(file.path);
    return { jobId };
  }

  @Post('pdf-to-word')
  @ApiOperation({
    summary: 'Chuyển file PDF sang Word (.docx) - kết quả mang tính tương đối',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async pdfToWord(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, ['application/pdf'], 'File phải là PDF');
    const { jobId } = await this.officeService.queuePdfToWord(file.path);
    return { jobId };
  }

  @Post('excel-merge')
  @ApiOperation({ summary: 'Ghép nhiều file Excel thành 1 file nhiều sheet' })
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
  async excelMerge(
    @UploadedFiles() files: Array<{ path: string; mimetype: string }>,
  ) {
    if (!files?.length || files.length < 2) {
      throw new BadRequestException('Cần tối thiểu 2 file Excel để ghép');
    }
    for (const file of files) {
      if (file.mimetype !== EXCEL_MIMETYPE) {
        throw new BadRequestException('Tất cả file phải là Excel (.xlsx)');
      }
    }

    const { jobId } = await this.officeService.queueExcelMerge(
      files.map((f) => f.path),
    );
    return { jobId };
  }

  @Post('ppt-to-pdf')
  @ApiOperation({ summary: 'Chuyển file PowerPoint (.pptx) sang PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singlePptUpload)
  async pptToPdf(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, [PPT_MIMETYPE], 'File phải là PowerPoint (.pptx)');
    const { jobId } = await this.officeService.queuePptToPdf(file.path);
    return { jobId };
  }

  @Post('pdf-to-ppt')
  @ApiOperation({
    summary:
      'Chuyển file PDF sang PowerPoint (.pptx) - kết quả mang tính tương đối',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singlePdfForPptUpload)
  async pdfToPpt(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, ['application/pdf'], 'File phải là PDF');
    const { jobId } = await this.officeService.queuePdfToPpt(file.path);
    return { jobId };
  }
}
