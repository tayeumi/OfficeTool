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
  Rotate = 'rotate',
  DeletePages = 'delete-pages',
  Protect = 'protect',
  Unlock = 'unlock',
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

export interface RotateJobData {
  inputPath: string;
  degrees: number;
  outputFileName: string;
}

export interface DeletePagesJobData {
  inputPath: string;
  pages: string;
  outputFileName: string;
}

export interface ProtectJobData {
  inputPath: string;
  password: string;
  outputFileName: string;
}

export interface UnlockJobData {
  inputPath: string;
  password: string;
  outputFileName: string;
}

export type PdfJobData =
  | MergeJobData
  | SplitJobData
  | CompressJobData
  | ToImageJobData
  | WatermarkJobData
  | PageNumbersJobData
  | RotateJobData
  | DeletePagesJobData
  | ProtectJobData
  | UnlockJobData;

export enum OfficeJobName {
  WordToPdf = 'word-to-pdf',
  ExcelToPdf = 'excel-to-pdf',
  PdfToWord = 'pdf-to-word',
  ExcelMerge = 'excel-merge',
  PptToPdf = 'ppt-to-pdf',
  PdfToPpt = 'pdf-to-ppt',
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

export interface PptToPdfJobData {
  inputPath: string;
  outputFileName: string;
}

export interface PdfToPptJobData {
  inputPath: string;
  outputFileName: string;
}

export type OfficeJobData =
  | WordToPdfJobData
  | ExcelToPdfJobData
  | PdfToWordJobData
  | ExcelMergeJobData
  | PptToPdfJobData
  | PdfToPptJobData;

export enum ImageJobName {
  Compress = 'compress',
  Convert = 'convert',
  Resize = 'resize',
  Rotate = 'rotate',
  Crop = 'crop',
  Watermark = 'watermark',
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

export interface ImageRotateJobData {
  inputPath: string;
  degrees: number;
  flip?: 'horizontal' | 'vertical';
  outputFileName: string;
}

export interface ImageCropJobData {
  inputPath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  outputFileName: string;
}

export interface ImageWatermarkJobData {
  inputPath: string;
  text: string;
  outputFileName: string;
}

export type ImageJobData =
  | ImageCompressJobData
  | ImageConvertJobData
  | ImageResizeJobData
  | ImageRotateJobData
  | ImageCropJobData
  | ImageWatermarkJobData;

export enum OcrJobName {
  ImageToText = 'image-to-text',
  PdfToText = 'pdf-to-text',
}

export interface ImageToTextJobData {
  inputPath: string;
  outputFileName: string;
}

export interface PdfToTextJobData {
  inputPath: string;
  outputFileName: string;
}

export type OcrJobData = ImageToTextJobData | PdfToTextJobData;

export interface JobResult {
  outputFileName: string;
}
