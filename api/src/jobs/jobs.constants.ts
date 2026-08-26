export const PDF_QUEUE = 'pdf';

export enum PdfJobName {
  Merge = 'merge',
  Split = 'split',
  Compress = 'compress',
  ToImage = 'to-image',
  Watermark = 'watermark',
  PageNumbers = 'page-numbers',
}

export interface MergeJobData {
  inputPaths: string[];
  outputFileName: string;
}

export interface SplitJobData {
  inputPath: string;
  ranges: string;
  outputFileName: string;
}

export interface CompressJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ToImageJobData {
  inputPath: string;
  scale: number;
  outputFileName: string;
}

export interface WatermarkJobData {
  inputPath: string;
  text: string;
  outputFileName: string;
}

export interface PageNumbersJobData {
  inputPath: string;
  startAt: number;
  outputFileName: string;
}

export type PdfJobData =
  | MergeJobData
  | SplitJobData
  | CompressJobData
  | ToImageJobData
  | WatermarkJobData
  | PageNumbersJobData;

export interface JobResult {
  outputFileName: string;
}
