import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { rename, unlink } from 'fs/promises';
import ExcelJS from 'exceljs';
import { StorageService } from '../storage/storage.service';
import {
  OFFICE_QUEUE,
  OfficeJobName,
  OfficeJobData,
  WordToPdfJobData,
  ExcelToPdfJobData,
  PdfToWordJobData,
  ExcelMergeJobData,
  JobResult,
} from '../jobs/jobs.constants';
import { convertWithLibreOffice } from './libreoffice.util';

@Processor(OFFICE_QUEUE)
export class OfficeProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(
    job: Job<OfficeJobData, JobResult, OfficeJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case OfficeJobName.WordToPdf:
        return this.convertViaLibreOffice(job.data as WordToPdfJobData, 'pdf');
      case OfficeJobName.ExcelToPdf:
        return this.convertViaLibreOffice(job.data as ExcelToPdfJobData, 'pdf');
      case OfficeJobName.PdfToWord:
        return this.convertViaLibreOffice(
          job.data as PdfToWordJobData,
          'docx',
          {
            inFilter: 'writer_pdf_import',
          },
        );
      case OfficeJobName.ExcelMerge:
        return this.excelMerge(job.data as ExcelMergeJobData);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  private async convertViaLibreOffice(
    data: { inputPath: string; outputFileName: string },
    targetFormat: string,
    options?: { inFilter?: string },
  ): Promise<JobResult> {
    const convertedPath = await convertWithLibreOffice(
      data.inputPath,
      this.storage.outputsDir,
      targetFormat,
      options,
    );
    const outputPath = this.storage.outputPath(data.outputFileName);
    try {
      await rename(convertedPath, outputPath);
    } catch (err) {
      // rename() fail (vd disk đầy) sau khi LibreOffice đã ghi xong file
      // convertedPath (tên theo basename input, không phải UUID mong muốn) -
      // dọn ngay thay vì để mồ côi chờ TTL cleanup.
      await unlink(convertedPath).catch(() => undefined);
      throw err;
    }
    return { outputFileName: data.outputFileName };
  }

  private async excelMerge(data: ExcelMergeJobData): Promise<JobResult> {
    const merged = new ExcelJS.Workbook();
    const usedNames = new Set<string>();

    for (const inputPath of data.inputPaths) {
      const source = new ExcelJS.Workbook();
      await source.xlsx.readFile(inputPath);

      source.eachSheet((sheet) => {
        const name = this.uniqueSheetName(sheet.name, usedNames);
        usedNames.add(name);
        const target = merged.addWorksheet(name);

        sheet.eachRow((row, rowNumber) => {
          target.getRow(rowNumber).values = row.values;
        });
      });
    }

    const outputPath = this.storage.outputPath(data.outputFileName);
    await merged.xlsx.writeFile(outputPath);
    return { outputFileName: data.outputFileName };
  }

  private uniqueSheetName(name: string, used: Set<string>): string {
    if (!used.has(name)) return name;
    let index = 2;
    let candidate = `${name} (${index})`;
    while (used.has(candidate)) {
      index++;
      candidate = `${name} (${index})`;
    }
    return candidate;
  }
}
