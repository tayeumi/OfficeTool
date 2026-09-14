import { join } from 'path';

/**
 * Xoay vong usage.log THEO THANG - 1 file rieng cho moi thang
 * ("usage-2026-09.log") thay vi 1 file usage.log DUY NHAT phinh to vo han
 * theo thoi gian (2026-09-13, theo yeu cau "định kỳ vẫn xoá file rác đầy
 * đủ chứ" - file nay can GIU LAU DAI de thong ke nen KHONG the nam trong
 * co che xoa theo TTL ngan nhu uploads/outputs, nhung van can gioi han
 * bang cach xoay vong + xoa file qua cu, xem CleanupScheduler).
 */
export function usageLogFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `usage-${year}-${month}.log`;
}

export function usageLogFilePath(rootDir: string, date: Date): string {
  return join(rootDir, usageLogFileName(date));
}

const USAGE_LOG_FILE_PATTERN = /^usage-(\d{4})-(\d{2})\.log$/;

/** Parse "usage-2026-09.log" -> Date đầu tháng đó, hoặc null nếu không khớp. */
export function parseUsageLogFileName(fileName: string): Date | null {
  const match = USAGE_LOG_FILE_PATTERN.exec(fileName);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(Date.UTC(year, month - 1, 1));
}
