import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { parseUsageLogFileName } from './usage-log-path.util';

interface UsageLogEntry {
  time: string;
  user: string;
  method: string;
  path: string;
}

export interface UsageStatsQuery {
  fromDate?: string; // ISO date "YYYY-MM-DD", theo dau ngay UTC
  toDate?: string; // ISO date "YYYY-MM-DD", theo cuoi ngay UTC
}

export interface UsageStats {
  totalRequests: number;
  byUser: Array<{ user: string; count: number }>;
  byTool: Array<{ path: string; count: number }>;
  byDate: Array<{ date: string; count: number }>;
}

// Suy ra "ten cong cu" tu path API (vd "/pdf/split" -> "pdf/split") - bo tien
// to "/", giu nguyen phan con lai lam nhan hien thi vi da du de phan biet
// (khop truc tiep voi ten endpoint trong Swagger, khong can bang tra cuu
// rieng them ten hien thi cho tung tool).
function toolLabelFromPath(path: string): string {
  const withoutQuery = path.split('?')[0];
  return withoutQuery.replace(/^\//, '');
}

@Injectable()
export class LoggingService {
  private readonly rootDir: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(this.config.get<string>('storage.dir')!);
  }

  async getUsageStats(query: UsageStatsQuery): Promise<UsageStats> {
    const fromTime = query.fromDate
      ? new Date(`${query.fromDate}T00:00:00.000Z`).getTime()
      : null;
    const toTime = query.toDate
      ? new Date(`${query.toDate}T23:59:59.999Z`).getTime()
      : null;

    // File xoay vong theo thang (usage-YYYY-MM.log) - doc gop TAT CA file
    // trong khoang [fromTime, toTime] thay vi 1 file duy nhat, vi 1 khoang
    // loc co the trai qua nhieu thang (vd loc ca quy). Khong loc fromDate/
    // toDate thi doc TAT CA thang tu luc bat middleware toi nay.
    const entries = await this.readEntries(fromTime, toTime);

    const filtered = entries.filter((entry) => {
      const t = new Date(entry.time).getTime();
      if (Number.isNaN(t)) return false;
      if (fromTime !== null && t < fromTime) return false;
      if (toTime !== null && t > toTime) return false;
      return true;
    });

    const byUserMap = new Map<string, number>();
    const byToolMap = new Map<string, number>();
    const byDateMap = new Map<string, number>();

    for (const entry of filtered) {
      byUserMap.set(entry.user, (byUserMap.get(entry.user) ?? 0) + 1);

      const tool = toolLabelFromPath(entry.path);
      byToolMap.set(tool, (byToolMap.get(tool) ?? 0) + 1);

      const date = entry.time.slice(0, 10); // "YYYY-MM-DD"
      byDateMap.set(date, (byDateMap.get(date) ?? 0) + 1);
    }

    const sortByCountDesc = (a: { count: number }, b: { count: number }) =>
      b.count - a.count;

    return {
      totalRequests: filtered.length,
      byUser: [...byUserMap.entries()]
        .map(([user, count]) => ({ user, count }))
        .sort(sortByCountDesc),
      byTool: [...byToolMap.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort(sortByCountDesc),
      byDate: [...byDateMap.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  // Liet ke cac file "usage-YYYY-MM.log" thuc su co tren dia trong
  // [fromTime, toTime] (dung readdir + parse ten file thay vi tu tinh danh
  // sach thang theo range - don gian va chinh xac hon, tu dong bo qua thang
  // khong co du lieu/da bi xoa boi CleanupScheduler).
  private async listRelevantFiles(
    fromTime: number | null,
    toTime: number | null,
  ): Promise<string[]> {
    let allFiles: string[];
    try {
      allFiles = await readdir(this.rootDir);
    } catch {
      return [];
    }

    return allFiles.filter((fileName) => {
      const monthStart = parseUsageLogFileName(fileName);
      if (!monthStart) return false;
      const monthStartTime = monthStart.getTime();
      // Thang co the chua entry NAM TRONG khoang loc neu diem dau thang
      // truoc toTime, VA diem cuoi thang (thang sau) sau fromTime - so sanh
      // theo thang (khong can chinh xac tung ngay o day, readEntries se loc
      // lai chinh xac theo timestamp that cua tung dong sau khi doc file).
      const monthEndTime = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
      ).getTime();
      if (toTime !== null && monthStartTime > toTime) return false;
      if (fromTime !== null && monthEndTime <= fromTime) return false;
      return true;
    });
  }

  private async readEntries(
    fromTime: number | null,
    toTime: number | null,
  ): Promise<UsageLogEntry[]> {
    const relevantFiles = await this.listRelevantFiles(fromTime, toTime);

    const entries: UsageLogEntry[] = [];
    for (const fileName of relevantFiles) {
      let raw: string;
      try {
        raw = await readFile(join(this.rootDir, fileName), 'utf-8');
      } catch {
        // File co the bi xoa giua luc readdir() liet ke va luc doc (race
        // condition binh thuong voi cleanup dinh ky) - bo qua file do.
        continue;
      }

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as UsageLogEntry;
          if (parsed.time && parsed.user && parsed.path) entries.push(parsed);
        } catch {
          // 1 dong bi hong (vd ghi do dang luc app crash giua chung) - bo
          // qua dong do, khong lam hong toan bo thong ke.
        }
      }
    }
    return entries;
  }
}
