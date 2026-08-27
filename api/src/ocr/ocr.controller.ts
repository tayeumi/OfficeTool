import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { singleFileUpload, assertMimetype } from '../uploads/upload.util';

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png'];
const singleImageUpload = singleFileUpload('file');
const singlePdfUpload = singleFileUpload('file');

@ApiTags('ocr')
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('image-to-text')
  @ApiOperation({
    summary: 'Nhận dạng chữ trong ảnh (tiếng Việt) và xuất ra file .txt',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singleImageUpload)
  async imageToText(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');
    const { jobId } = await this.ocrService.queueImageToText(file.path);
    return { jobId };
  }

  @Post('pdf-to-text')
  @ApiOperation({
    summary:
      'Nhận dạng chữ trong file PDF (tiếng Việt, kể cả PDF scan/ảnh) và xuất ra file .txt',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async pdfToText(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, ['application/pdf'], 'File phải là PDF');
    const { jobId } = await this.ocrService.queuePdfToText(file.path);
    return { jobId };
  }
}
