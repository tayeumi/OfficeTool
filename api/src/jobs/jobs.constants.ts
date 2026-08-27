export const PDF_QUEUE = 'pdf';
export const OFFICE_QUEUE = 'office';
export const IMAGE_QUEUE = 'image';
export const OCR_QUEUE = 'ocr';

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

export enum OfficeJobName {
  WordToPdf = 'word-to-pdf',
  ExcelToPdf = 'excel-to-pdf',
  PdfToWord = 'pdf-to-word',
  ExcelMerge = 'excel-merge',
}

export interface WordToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ExcelToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface PdfToWordJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ExcelMergeJobData {
  inputPaths: string[];
  outputFileName: string;
}

export type OfficeJobData =
  WordToPdfJobData | ExcelToPdfJobData | PdfToWordJobData | ExcelMergeJobData;

export enum ImageJobName {
  Compress = 'compress',
  Convert = 'convert',
  Resize = 'resize',
}

export interface ImageCompressJobData {
  inputPath: string;
  outputFileName: string;
}

export interface ImageConvertJobData {
  inputPath: string;
  targetFormat: 'jpeg' | 'png' | 'webp';
  outputFileName: string;
}

export interface ImageResizeJobData {
  inputPath: string;
  width?: number;
  height?: number;
  percent?: number;
  outputFileName: string;
}

export type ImageJobData =
  ImageCompressJobData | ImageConvertJobData | ImageResizeJobData;

export enum OcrJobName {
  ImageToText = 'image-to-text',
}

export interface ImageToTextJobData {
  inputPath: string;
  outputFileName: string;
}

export type OcrJobData = ImageToTextJobData;

export interface JobResult {
  outputFileName: string;
}
