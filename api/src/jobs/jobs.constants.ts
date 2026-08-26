export const PDF_QUEUE = 'pdf';

export enum PdfJobName {
  Merge = 'merge',
}

export interface MergeJobData {
  inputPaths: string[];
  outputFileName: string;
}

export interface JobResult {
  outputFileName: string;
}
