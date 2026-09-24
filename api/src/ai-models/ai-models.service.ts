import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { AiModelConfig } from './ai-model.types';

/**
 * Danh sach cau hinh model AI (Gemini/Claude/GPT + API key rieng) do ADMIN
 * chu dong khai bao qua trang UI, nguoi dung thuong chi CHON 1 trong cac
 * cau hinh da co san khi dung tool OCR AI (2026-09-24, theo yeu cau "backend
 * có thể khai báo sử dụng nhiều mô hình AI... người dùng vào chủ động khai
 * báo"). Luu vao 1 file JSON trong STORAGE_DIR (khong dung Redis - Redis
 * von thiet ke cho du lieu tam/cache cua job queue, dung lam "nguon su
 * that" duy nhat cho cau hinh co rui ro neu Redis bi flush; khong dung DB
 * that vi OfficeTool hien khong co ha tang database nao, them 1 DB moi chi
 * cho vai chuc dong cau hinh la qua muc can thiet).
 */
@Injectable()
export class AiModelsService implements OnModuleInit {
  private readonly filePath: string;

  constructor(private readonly config: ConfigService) {
    const rootDir = resolve(this.config.get<string>('storage.dir')!);
    this.filePath = join(rootDir, 'ai-models.json');
  }

  async onModuleInit() {
    await mkdir(resolve(this.filePath, '..'), { recursive: true });
  }

  async list(): Promise<AiModelConfig[]> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AiModelConfig[]) : [];
    } catch {
      // Chua co file (lan dau chua khai bao model nao) - tra ve rong thay
      // vi loi, day la trang thai binh thuong.
      return [];
    }
  }

  async getById(id: string): Promise<AiModelConfig> {
    const all = await this.list();
    const found = all.find((m) => m.id === id);
    if (!found) throw new NotFoundException('Không tìm thấy cấu hình model AI');
    return found;
  }

  async create(
    data: Omit<AiModelConfig, 'id' | 'createdAt'>,
  ): Promise<AiModelConfig> {
    const all = await this.list();
    const newConfig: AiModelConfig = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.save([...all, newConfig]);
    return newConfig;
  }

  async update(
    id: string,
    data: Partial<Omit<AiModelConfig, 'id' | 'createdAt'>>,
  ): Promise<AiModelConfig> {
    const all = await this.list();
    const index = all.findIndex((m) => m.id === id);
    if (index === -1)
      throw new NotFoundException('Không tìm thấy cấu hình model AI');

    // apiKey trong "data" co the la chuoi rong ("khong doi key cu") khi
    // admin chi sua label/enabled tu form da MASK key that - chi ghi de
    // apiKey khi thuc su co gia tri moi duoc gui len.
    const updated: AiModelConfig = {
      ...all[index],
      ...data,
      apiKey: data.apiKey ? data.apiKey : all[index].apiKey,
    };
    all[index] = updated;
    await this.save(all);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    const next = all.filter((m) => m.id !== id);
    if (next.length === all.length) {
      throw new NotFoundException('Không tìm thấy cấu hình model AI');
    }
    await this.save(next);
  }

  private async save(configs: AiModelConfig[]): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(configs, null, 2), 'utf-8');
  }
}
