import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImageService } from './image.service';
import { singleFileUpload, assertMimetype } from '../uploads/upload.util';

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png'];
const TARGET_FORMATS = ['jpeg', 'png', 'webp'] as const;
type TargetFormat = (typeof TARGET_FORMATS)[number];
const FLIP_VALUES = ['horizontal', 'vertical'] as const;
type FlipValue = (typeof FLIP_VALUES)[number];

const singleImageUpload = singleFileUpload('file');

@ApiTags('image')
@Controller('image')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post('compress')
  @ApiOperation({
    summary: 'Giảm dung lượng ảnh JPG/PNG, giữ nguyên định dạng',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(singleImageUpload)
  async compress(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');
    const { jobId } = await this.imageService.queueCompress(file.path);
    return { jobId };
  }

  @Post('convert')
  @ApiOperation({ summary: 'Chuyển đổi ảnh giữa JPG, PNG, WebP' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        targetFormat: { type: 'string', example: 'webp' },
      },
    },
  })
  @UseInterceptors(singleImageUpload)
  async convert(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('targetFormat') targetFormat: string,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');
    if (!TARGET_FORMATS.includes(targetFormat as TargetFormat)) {
      throw new BadRequestException('targetFormat phải là jpeg, png hoặc webp');
    }

    const { jobId } = await this.imageService.queueConvert(
      file.path,
      targetFormat as TargetFormat,
    );
    return { jobId };
  }

  @Post('resize')
  @ApiOperation({
    summary: 'Thay đổi kích thước ảnh theo chiều rộng/cao hoặc phần trăm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        width: { type: 'number', example: 800 },
        height: { type: 'number', example: 600 },
        percent: { type: 'number', example: 50 },
      },
    },
  })
  @UseInterceptors(singleImageUpload)
  async resize(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('width') widthInput: string,
    @Body('height') heightInput: string,
    @Body('percent') percentInput: string,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');

    const width = widthInput ? Number(widthInput) : undefined;
    const height = heightInput ? Number(heightInput) : undefined;
    const percent = percentInput ? Number(percentInput) : undefined;

    if (!((width && height) || percent)) {
      throw new BadRequestException('Cần chỉ định width/height hoặc percent');
    }
    if (
      (width !== undefined && (!Number.isFinite(width) || width <= 0)) ||
      (height !== undefined && (!Number.isFinite(height) || height <= 0)) ||
      (percent !== undefined && (!Number.isFinite(percent) || percent <= 0))
    ) {
      throw new BadRequestException('Kích thước phải là số dương');
    }

    const { jobId } = await this.imageService.queueResize(file.path, {
      width,
      height,
      percent,
    });
    return { jobId };
  }

  @Post('rotate')
  @ApiOperation({ summary: 'Xoay hoặc lật ảnh' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        degrees: { type: 'number', example: 90 },
        flip: { type: 'string', example: 'horizontal' },
      },
    },
  })
  @UseInterceptors(singleImageUpload)
  async rotate(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('degrees') degreesInput: string,
    @Body('flip') flip: string,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');

    const degreesValue = degreesInput ? Number(degreesInput) : 0;
    if (degreesInput && !Number.isFinite(degreesValue)) {
      throw new BadRequestException('degrees phải là số');
    }
    if (flip && !FLIP_VALUES.includes(flip as FlipValue)) {
      throw new BadRequestException('flip phải là horizontal hoặc vertical');
    }
    if (!degreesInput && !flip) {
      throw new BadRequestException('Cần chỉ định degrees hoặc flip');
    }

    const { jobId } = await this.imageService.queueRotate(file.path, {
      degrees: degreesValue,
      flip: flip as FlipValue | undefined,
    });
    return { jobId };
  }

  @Post('crop')
  @ApiOperation({ summary: 'Cắt ảnh theo toạ độ và kích thước chỉ định' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        left: { type: 'number', example: 0 },
        top: { type: 'number', example: 0 },
        width: { type: 'number', example: 400 },
        height: { type: 'number', example: 300 },
      },
    },
  })
  @UseInterceptors(singleImageUpload)
  async crop(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('left') leftInput: string,
    @Body('top') topInput: string,
    @Body('width') widthInput: string,
    @Body('height') heightInput: string,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');

    const left = Number(leftInput);
    const top = Number(topInput);
    const width = Number(widthInput);
    const height = Number(heightInput);

    if (
      !Number.isInteger(left) ||
      !Number.isInteger(top) ||
      left < 0 ||
      top < 0
    ) {
      throw new BadRequestException('left/top phải là số nguyên không âm');
    }
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new BadRequestException('width/height phải là số nguyên dương');
    }

    const { jobId } = await this.imageService.queueCrop(file.path, {
      left,
      top,
      width,
      height,
    });
    return { jobId };
  }

  @Post('watermark')
  @ApiOperation({ summary: 'Chèn watermark chữ vào ảnh' })
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
  @UseInterceptors(singleImageUpload)
  async watermark(
    @UploadedFile() file: { path: string; mimetype: string } | undefined,
    @Body('text') text: string,
  ) {
    assertMimetype(file, IMAGE_MIMETYPES, 'File phải là JPG hoặc PNG');
    if (!text?.trim()) {
      throw new BadRequestException('Cần nhập nội dung watermark');
    }

    const { jobId } = await this.imageService.queueWatermark(file.path, text);
    return { jobId };
  }
}
