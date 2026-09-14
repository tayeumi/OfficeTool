import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { appendFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { usageLogFilePath } from './usage-log-path.util';

/**
 * Ghi log "ai gọi endpoint nào, lúc nào" ra file usage-YYYY-MM.log (1 dòng
 * JSON/request, xoay vòng theo tháng - xem usage-log-path.util.ts) để thống
 * kê sử dụng OfficeTool - KHÔNG phải audit bảo mật, vì header "X-User-Name"
 * do frontend tự gắn (xem officeToolClient.js bên ams) và KHÔNG được xác
 * thực - OfficeTool hiện chưa có cơ chế đăng nhập/token nào, ai cũng có thể
 * sửa header này qua DevTools. Đủ dùng cho mục đích thống kê nội bộ, không
 * dùng để phân quyền hay truy vết trách nhiệm.
 *
 * Chỉ ghi log các request xử lý thật (POST tới pdf/office/image/ocr) - bỏ qua
 * GET /jobs/:jobId (poll trạng thái, gọi liên tục mỗi 2s) và GET /download
 * để tránh phình to vô ích với các request không phải "hành động" của người
 * dùng.
 */
@Injectable()
export class UsageLogMiddleware implements NestMiddleware {
  private readonly rootDir: string;
  private ensureDirPromise: Promise<unknown> | null = null;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(this.config.get<string>('storage.dir')!);
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST') {
      const username = req.header('X-User-Name') || 'unknown';
      const now = new Date();
      const entry = {
        time: now.toISOString(),
        user: username,
        method: req.method,
        path: req.originalUrl,
      };
      void this.appendLog(entry, now);
    }
    next();
  }

  private async appendLog(entry: Record<string, string>, now: Date) {
    try {
      // mkdir lap lai moi request se ton I/O khong can thiet - cache lai
      // PROMISE dau tien (khong phai boolean) de cac request DEN CUNG LUC
      // luc app moi khoi dong deu cho chung 1 lan mkdir thay vi tu goi rieng.
      // rootDir KHONG doi theo thang (chi ten file thay doi) nen 1 lan mkdir
      // la du cho toan bo vong doi app, khong can tinh lai moi khi sang thang.
      if (!this.ensureDirPromise) {
        this.ensureDirPromise = mkdir(this.rootDir, { recursive: true });
      }
      await this.ensureDirPromise;
      const filePath = usageLogFilePath(this.rootDir, now);
      await appendFile(filePath, JSON.stringify(entry) + '\n');
    } catch {
      // Ghi log usage la tinh nang phu - loi ghi file (vd het dung luong
      // dia) khong duoc lam gian doan request xu ly file chinh cua nguoi
      // dung.
    }
  }
}
