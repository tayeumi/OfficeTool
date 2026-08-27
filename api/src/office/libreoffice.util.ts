import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, basename, extname } from 'path';

const execFileAsync = promisify(execFile);

/**
 * Chuyển đổi 1 file qua LibreOffice headless. Mỗi lần gọi dùng riêng 1
 * profile dir tạm (-env:UserInstallation) để tránh lỗi treo/lock khi nhiều
 * tiến trình soffice headless chạy song song dùng chung profile mặc định.
 * LibreOffice đặt tên output theo basename input (không theo UUID mong
 * muốn) - caller tự rename() sang tên output cuối cùng.
 */
export async function convertWithLibreOffice(
  inputPath: string,
  outputDir: string,
  targetFormat: string,
  options: { inFilter?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { inFilter, timeoutMs = 120_000 } = options;
  const profileDir = await mkdtemp(join(tmpdir(), 'lo-profile-'));
  try {
    const args = [
      '--headless',
      '--norestore',
      `-env:UserInstallation=file://${profileDir}`,
    ];
    if (inFilter) args.push(`--infilter=${inFilter}`);
    args.push('--convert-to', targetFormat, '--outdir', outputDir, inputPath);

    await execFileAsync('soffice', args, { timeout: timeoutMs });
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }

  const inputBasename = basename(inputPath, extname(inputPath));
  return join(outputDir, `${inputBasename}.${targetFormat}`);
}
