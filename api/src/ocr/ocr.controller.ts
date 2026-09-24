import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { singleFileUpload, assertMimetype } from '../uploads/upload.util';
import { AiModelsService } from '../ai-models/ai-models.service';

const singlePdfForWordAiUpload = singleFileUpload('file');

// Cac tool OCR truyen thong (Tesseract/PaddleOCR: image-to-text,
// pdf-to-text, pdf-to-word) DA BI XOA (2026-09-24, theo yeu cau "trong các
// tính năng OCR bỏ hết các công cụ kia, do không hiệu quả, chỉ để 1 công cụ
// này thôi") - chi giu lai "OCR PDF sang Word (AI)" vi cho ket qua giu duoc
// bang bieu/cau truc/hinh anh gan voi ban goc hon han. Cac endpoint/queue
// job/service method tuong ung cung da bi xoa (xem ocr.service.ts,
// ocr.processor.ts, jobs.constants.ts).
@ApiTags('ocr')
@Controller('ocr')
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly aiModelsService: AiModelsService,
  ) {}

  @Post('pdf-to-word-ai')
  @ApiOperation({
    summary:
      'Nhận dạng chữ trong file PDF scan/ảnh bằng AI (chọn 1 model đã khai báo qua /ai-models) và xuất ra file Word (.docx) - giữ được bảng biểu/cấu trúc gần với bản gốc hơn OCR truyền thống',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        modelConfigId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(singlePdfForWordAiUpload)
  async pdfToWordAi(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('modelConfigId') modelConfigId: string,
  ) {
    assertMimetype(file, ['application/pdf'], 'File phải là PDF');
    if (!modelConfigId?.trim()) {
      throw new BadRequestException(
        'Cần chọn 1 model AI trước khi xử lý - vào trang "Khai báo model AI" nếu chưa thấy lựa chọn nào.',
      );
    }
    // Xac nhan ngay luc request (khong doi toi khi job chay) de tra loi
    // ro rang - getById() tu throw NotFoundException neu id sai/da bi xoa.
    const modelConfig = await this.aiModelsService.getById(modelConfigId);
    if (!modelConfig.enabled) {
      throw new BadRequestException(
        'Model AI này hiện đang bị tắt - chọn model khác.',
      );
    }

    const { jobId } = await this.ocrService.queuePdfToWordAi(
      file.path,
      modelConfigId,
    );
    return { jobId };
  }
}
