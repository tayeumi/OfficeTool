import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';

export const uploadsDir = resolve(
  process.env.STORAGE_DIR ?? './storage',
  'uploads',
);

export function singleFileUpload(fieldName: string) {
  return FileInterceptor(fieldName, {
    storage: diskStorage({
      destination: uploadsDir,
      filename: (
        _req: unknown,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
      ) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
    }),
  });
}

export function assertMimetype(
  file: { mimetype: string } | undefined,
  allowedMimetypes: string[],
  errorMessage: string,
): asserts file is { mimetype: string } {
  if (!file) throw new BadRequestException(errorMessage);
  if (!allowedMimetypes.includes(file.mimetype)) {
    throw new BadRequestException(errorMessage);
  }
}
