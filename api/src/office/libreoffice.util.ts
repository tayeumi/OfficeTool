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
  options: {
    inFilter?: string;
    timeoutMs?: number;
    // Ten export filter + data JSON, noi vao sau targetFormat theo cu phap
    // "--convert-to pdf:calc_pdf_Export:{...}" cua LibreOffice - dung de
    // truyen tuy chon rieng cho tung filter (vd SinglePageSheets cho Calc PDF
    // export, xem excelToPdfFilterOptions() ben duoi). Khong truyen thi giu
    // hanh vi mac dinh cua LibreOffice (--convert-to <format> tron, khong co
    // filter data).
    exportFilterName?: string;
    exportFilterData?: Record<string, unknown>;
  } = {},
): Promise<string> {
  const {
    inFilter,
    timeoutMs = 120_000,
    exportFilterName,
    exportFilterData,
  } = options;
  const profileDir = await mkdtemp(join(tmpdir(), 'lo-profile-'));
  try {
    const args = [
      '--headless',
      '--norestore',
      `-env:UserInstallation=file://${profileDir}`,
    ];
    if (inFilter) args.push(`--infilter=${inFilter}`);

    // Cu phap LibreOffice: "pdf:calc_pdf_Export:{"SinglePageSheets":{"type":
    // "boolean","value":"true"}}" - filter data la 1 JSON object dang UNO
    // property (moi key can boc {"type","value"}, KHONG phai gia tri tho).
    const convertToTarget =
      exportFilterName && exportFilterData
        ? `${targetFormat}:${exportFilterName}:${JSON.stringify(exportFilterData)}`
        : targetFormat;
    args.push(
      '--convert-to',
      convertToTarget,
      '--outdir',
      outputDir,
      inputPath,
    );

    await execFileAsync('soffice', args, { timeout: timeoutMs });
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }

  const inputBasename = basename(inputPath, extname(inputPath));
  return join(outputDir, `${inputBasename}.${targetFormat}`);
}

/**
 * Filter data cho LibreOffice Calc PDF export ("calc_pdf_Export") - buoc
 * "SinglePageSheets" tu dong THU NHO (scale-to-fit) noi dung MOI SHEET de vua
 * dung 1 trang PDF, thay vi tran ra nhieu trang theo Page Setup mac dinh cua
 * file goc (2026-09-16, theo phan hoi "các sheet excel phải gom chung vào 1
 * trang chứ" - LibreOffice --convert-to trơn dùng đúng Print Area/Page Setup
 * đã lưu sẵn trong file .xlsx, sheet nào không set "Fit to 1 page" sẽ in
 * tràn nhiều trang ngang/dọc theo scale 100%).
 */
export function excelToPdfFilterOptions(): {
  exportFilterName: string;
  exportFilterData: Record<string, unknown>;
} {
  return {
    exportFilterName: 'calc_pdf_Export',
    exportFilterData: {
      SinglePageSheets: { type: 'boolean', value: 'true' },
    },
  };
}
