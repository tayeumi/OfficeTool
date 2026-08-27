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
}
