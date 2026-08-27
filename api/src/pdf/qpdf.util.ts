import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Đặt mật khẩu mở file cho 1 PDF bằng qpdf (mã hoá AES-256). */
export async function protectPdf(
  inputPath: string,
  outputPath: string,
  password: string,
): Promise<void> {
  await execFileAsync('qpdf', [
    '--encrypt',
    password,
    password,
    '256',
    '--',
    inputPath,
    outputPath,
  ]);
}

/** Gỡ mật khẩu khỏi 1 PDF đã mã hoá bằng qpdf. */
export async function unlockPdf(
  inputPath: string,
  outputPath: string,
  password: string,
): Promise<void> {
  await execFileAsync('qpdf', [
    '--decrypt',
    `--password=${password}`,
    inputPath,
    outputPath,
  ]);
}
