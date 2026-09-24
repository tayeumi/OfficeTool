import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiModelsService } from './ai-models.service';
import { AiProvider, toPublicAiModelConfig } from './ai-model.types';

const VALID_PROVIDERS: AiProvider[] = [
  'gemini',
  'anthropic',
  'openai',
  'openrouter',
];

interface CreateAiModelDto {
  label: string;
  provider: string;
  modelId: string;
  apiKey: string;
  enabled?: boolean;
}

interface UpdateAiModelDto {
  label?: string;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  enabled?: boolean;
}

function assertValidProvider(provider: string): asserts provider is AiProvider {
  if (!VALID_PROVIDERS.includes(provider as AiProvider)) {
    throw new BadRequestException(
      `provider phải là một trong: ${VALID_PROVIDERS.join(', ')}`,
    );
  }
}

@ApiTags('ai-models')
@Controller('ai-models')
export class AiModelsController {
  constructor(private readonly aiModelsService: AiModelsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách cấu hình model AI đã khai báo (API key được che, không trả về đầy đủ)',
  })
  async list() {
    const configs = await this.aiModelsService.list();
    return configs.map(toPublicAiModelConfig);
  }

  @Post()
  @ApiOperation({ summary: 'Khai báo 1 cấu hình model AI mới (admin)' })
  async create(@Body() dto: CreateAiModelDto) {
    if (!dto.label?.trim())
      throw new BadRequestException('Cần nhập tên hiển thị');
    if (!dto.modelId?.trim()) throw new BadRequestException('Cần nhập modelId');
    if (!dto.apiKey?.trim()) throw new BadRequestException('Cần nhập API key');
    assertValidProvider(dto.provider);

    const created = await this.aiModelsService.create({
      label: dto.label.trim(),
      provider: dto.provider,
      modelId: dto.modelId.trim(),
      apiKey: dto.apiKey.trim(),
      enabled: dto.enabled ?? true,
    });
    return toPublicAiModelConfig(created);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Sửa 1 cấu hình model AI đã khai báo (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAiModelDto) {
    if (dto.provider) assertValidProvider(dto.provider);

    const updated = await this.aiModelsService.update(id, {
      ...(dto.label !== undefined && { label: dto.label.trim() }),
      ...(dto.provider !== undefined && {
        provider: dto.provider as AiProvider,
      }),
      ...(dto.modelId !== undefined && { modelId: dto.modelId.trim() }),
      ...(dto.apiKey !== undefined && { apiKey: dto.apiKey.trim() }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    });
    return toPublicAiModelConfig(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá 1 cấu hình model AI (admin)' })
  async remove(@Param('id') id: string) {
    await this.aiModelsService.remove(id);
    return { success: true };
  }
}
