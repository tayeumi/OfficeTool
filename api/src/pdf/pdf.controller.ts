import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
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

  @Post('images-to-pdf')
  @ApiOperation({
    summary: 'Ghép nhiều ảnh (JPG/PNG) thành 1 file PDF, mỗi ảnh 1 trang',
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
    FilesInterceptor('files', 50, {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file: { originalname: string }, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
    }),
  )
  async imagesToPdf(
    @UploadedFiles() files: Array<{ path: string; mimetype: string }>,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Cần chọn ít nhất 1 ảnh');
    }
    for (const file of files) {
      if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
        throw new BadRequestException('Tất cả file phải là JPG hoặc PNG');
      }
    }

    const { jobId } = await this.pdfService.queueImagesToPdf(
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
      properties: {
        file: { type: 'string', format: 'binary' },
        level: {
          type: 'string',
          enum: ['light', 'medium', 'strong'],
          example: 'medium',
        },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async compress(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('level') levelInput: string,
  ) {
    assertIsPdf(file);
    const level = (levelInput || 'medium') as 'light' | 'medium' | 'strong';
    if (!['light', 'medium', 'strong'].includes(level)) {
      throw new BadRequestException(
        'level phải là "light", "medium" hoặc "strong"',
      );
    }
    const { jobId } = await this.pdfService.queueCompress(file.path, level);
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

  @Post('rotate')
  @ApiOperation({
    summary: 'Xoay từng trang chỉ định của file PDF theo góc riêng',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        pageRotations: {
          type: 'string',
          description:
            'JSON object dạng { "<số trang 1-based>": <góc xoay 90|180|270|-90|-180|-270> }',
          example: '{"1":90,"3":180}',
        },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async rotate(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('pageRotations') pageRotationsInput: string,
  ) {
    assertIsPdf(file);

    let parsed: unknown;
    try {
      parsed = JSON.parse(pageRotationsInput ?? '');
    } catch {
      throw new BadRequestException(
        'pageRotations phải là JSON hợp lệ, vd: {"1":90,"3":180}',
      );
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new BadRequestException(
        'pageRotations phải là JSON object, vd: {"1":90,"3":180}',
      );
    }

    const pageRotations: Record<number, number> = {};
    const allowedDegrees = [90, 180, 270, -90, -180, -270];
    for (const [pageKey, degreesValue] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      const pageNumber = Number(pageKey);
      const degreesNum = Number(degreesValue);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        throw new BadRequestException(`Số trang không hợp lệ: "${pageKey}"`);
      }
      if (!allowedDegrees.includes(degreesNum)) {
        throw new BadRequestException(
          `Góc xoay phải là 90, 180 hoặc 270 (có thể âm) - nhận "${String(degreesValue)}"`,
        );
      }
      pageRotations[pageNumber] = degreesNum;
    }
    if (Object.keys(pageRotations).length === 0) {
      throw new BadRequestException('Cần chỉ định ít nhất 1 trang cần xoay');
    }

    const { jobId } = await this.pdfService.queueRotate(
      file.path,
      pageRotations,
    );
    return { jobId };
  }

  @Post('delete-pages')
  @ApiOperation({
    summary: 'Xoá các trang chỉ định khỏi file PDF (vd: "1-3,5,8-10")',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        pages: { type: 'string', example: '1-3,5' },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async deletePages(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('pages') pages: string,
  ) {
    assertIsPdf(file);
    if (!pages?.trim()) {
      throw new BadRequestException(
        'Cần chỉ định trang cần xoá, vd: "1-3,5,8-10"',
      );
    }

    const { jobId } = await this.pdfService.queueDeletePages(file.path, pages);
    return { jobId };
  }

  @Post('protect')
  @ApiOperation({ summary: 'Đặt mật khẩu mở file cho PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        password: { type: 'string', example: '123456' },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async protect(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('password') password: string,
  ) {
    assertIsPdf(file);
    if (!password?.trim()) {
      throw new BadRequestException('Cần nhập mật khẩu');
    }

    const { jobId } = await this.pdfService.queueProtect(file.path, password);
    return { jobId };
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Gỡ mật khẩu khỏi file PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        password: { type: 'string', example: '123456' },
      },
    },
  })
  @UseInterceptors(singlePdfUpload)
  async unlock(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('password') password: string,
  ) {
    assertIsPdf(file);
    if (!password?.trim()) {
      throw new BadRequestException('Cần nhập mật khẩu');
    }

    const { jobId } = await this.pdfService.queueUnlock(file.path, password);
    return { jobId };
  }

  @Post('sign')
  @ApiOperation({ summary: 'Chèn ảnh chữ ký vào 1 trang PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        signature: { type: 'string', format: 'binary' },
        page: { type: 'number', example: 1 },
        x: { type: 'number', example: 100 },
        y: { type: 'number', example: 100 },
        width: { type: 'number', example: 150 },
        height: { type: 'number', example: 75 },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'signature', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: uploadsDir,
          filename: (_req, file: { originalname: string }, cb) =>
            cb(null, `${randomUUID()}${extname(file.originalname)}`),
        }),
      },
    ),
  )
  async sign(
    @UploadedFiles()
    files: {
      file?: Array<{ path: string; mimetype: string }>;
      signature?: Array<{ path: string; mimetype: string }>;
    },
    @Body('page') pageInput: string,
    @Body('x') xInput: string,
    @Body('y') yInput: string,
    @Body('width') widthInput: string,
    @Body('height') heightInput: string,
  ) {
    const file = files?.file?.[0];
    const signature = files?.signature?.[0];
    assertIsPdf(file);
    assertMimetype(signature, ['image/png'], 'Ảnh chữ ký phải là PNG');

    const page = Number(pageInput);
    const x = Number(xInput);
    const y = Number(yInput);
    const width = Number(widthInput);
    const height = Number(heightInput);
    if (![page, x, y, width, height].every(Number.isFinite)) {
      throw new BadRequestException('page/x/y/width/height phải là số hợp lệ');
    }

    const { jobId } = await this.pdfService.queueSign(
      file.path,
      signature.path,
      page,
      x,
      y,
      width,
      height,
    );
    return { jobId };
  }
}
