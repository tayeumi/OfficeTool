import { BadRequestException } from '@nestjs/common';

/**
 * Parses a 1-indexed page range string like "1-3,5,8-10" into a
 * sorted, deduplicated array of 0-indexed page indices.
 */
export function parsePageRanges(ranges: string, pageCount: number): number[] {
  const indices = new Set<number>();

  for (const part of ranges.split(',')) {
    const token = part.trim();
    if (!token) continue;

    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) {
      throw new BadRequestException(`Khoảng trang không hợp lệ: "${token}"`);
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    if (start < 1 || end < start) {
      throw new BadRequestException(`Khoảng trang không hợp lệ: "${token}"`);
    }
    if (end > pageCount) {
      throw new BadRequestException(
        `Trang ${end} vượt quá tổng số trang (${pageCount}) của file PDF`,
      );
    }

    for (let page = start; page <= end; page++) {
      indices.add(page - 1);
    }
  }

  if (indices.size === 0) {
    throw new BadRequestException(
      'Cần chỉ định ít nhất một trang hoặc khoảng trang',
    );
  }

  return [...indices].sort((a, b) => a - b);
}
