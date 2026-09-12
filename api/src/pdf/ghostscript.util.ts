import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type CompressLevel = 'light' | 'medium' | 'strong';

// Ghostscript "-dPDFSETTINGS" preset - dieu chinh chu yeu qua viec giam DPI
// cua anh nhung trong PDF (van la nguon chiem dung luong lon nhat trong da so
// file van phong scan/chup). "screen" nen manh nhat (72 DPI, phu hop xem man
// hinh), "ebook" can bang (150 DPI), "printer" nhe nhat (300 DPI, giu chat
// luong in an).
const GS_PRESET: Record<CompressLevel, string> = {
  light: '/printer',
  medium: '/ebook',
  strong: '/screen',
};

/**
 * Nen 1 file PDF bang Ghostscript theo muc do chi dinh - chu yeu giam chat
 * luong/DPI cua anh nhung ben trong, khac voi cach nen cu (chi xoa metadata,
 * hieu qua rat han che voi PDF co nhieu anh/scan).
 */
export async function compressPdfWithGhostscript(
  inputPath: string,
  outputPath: string,
  level: CompressLevel,
): Promise<void> {
  await execFileAsync('gs', [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${GS_PRESET[level]}`,
    '-dNOPAUSE',
    '-dBATCH',
    '-dQUIET',
    `-sOutputFile=${outputPath}`,
    inputPath,
  ]);
}
