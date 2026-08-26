import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join, resolve } from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly rootDir: string;
  private readonly ttlMinutes: number;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(this.config.get<string>('storage.dir')!);
    this.ttlMinutes = this.config.get<number>('storage.fileTtlMinutes')!;
  }

  async onModuleInit() {
    await mkdir(this.uploadsDir, { recursive: true });
    await mkdir(this.outputsDir, { recursive: true });
  }

  get uploadsDir() {
    return join(this.rootDir, 'uploads');
  }

  get outputsDir() {
    return join(this.rootDir, 'outputs');
  }

  outputPath(fileName: string) {
    return join(this.outputsDir, fileName);
  }

  uploadPath(fileName: string) {
    return join(this.uploadsDir, fileName);
  }

  async cleanupExpired() {
    const cutoff = Date.now() - this.ttlMinutes * 60_000;
    for (const dir of [this.uploadsDir, this.outputsDir]) {
      const entries = await readdir(dir);
      for (const entry of entries) {
        const path = join(dir, entry);
        const info = await stat(path);
        if (info.mtimeMs < cutoff) {
          await unlink(path).catch(() => undefined);
        }
      }
    }
  }
}
