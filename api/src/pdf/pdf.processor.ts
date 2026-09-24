import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFName,
  PDFString,
  PDFArray,
  PDFDict,
  PDFRef,
} from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { StorageService } from '../storage/storage.service';
import {
  PDF_QUEUE,
  PdfJobName,
  PdfJobData,
  MergeJobData,
  SplitJobData,
  CompressJobData,
  ToImageJobData,
  WatermarkJobData,
  PageNumbersJobData,
  RotateJobData,
  DeletePagesJobData,
  ProtectJobData,
  UnlockJobData,
  SignJobData,
  ImagesToPdfJobData,
  JobResult,
} from '../jobs/jobs.constants';
import { parsePageRanges } from './page-range.util';
import { protectPdf, unlockPdf } from './qpdf.util';
import { compressPdfWithGhostscript } from './ghostscript.util';

@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async process(
    job: Job<PdfJobData, JobResult, PdfJobName>,
  ): Promise<JobResult> {
    switch (job.name) {
      case PdfJobName.Merge:
        return this.merge(job.data as MergeJobData);
      case PdfJobName.Split:
        return this.split(job.data as SplitJobData);
      case PdfJobName.Compress:
        return this.compress(job.data as CompressJobData);
      case PdfJobName.ToImage:
        return this.toImage(job.data as ToImageJobData);
      case PdfJobName.Watermark:
        return this.watermark(job.data as WatermarkJobData);
      case PdfJobName.PageNumbers:
        return this.pageNumbers(job.data as PageNumbersJobData);
      case PdfJobName.Rotate:
        return this.rotate(job.data as RotateJobData);
      case PdfJobName.DeletePages:
        return this.deletePages(job.data as DeletePagesJobData);
      case PdfJobName.Protect:
        return this.protect(job.data as ProtectJobData);
      case PdfJobName.Unlock:
        return this.unlock(job.data as UnlockJobData);
      case PdfJobName.Sign:
        return this.sign(job.data as SignJobData);
      case PdfJobName.ImagesToPdf:
        return this.imagesToPdf(job.data as ImagesToPdfJobData);
      default:
        throw new Error(`Unknown job: ${job.name as string}`);
    }
  }

  private async merge(data: MergeJobData): Promise<JobResult> {
    const merged = await PDFDocument.create();
    const srcDocs = await Promise.all(
      data.inputPaths.map(async (inputPath) => {
        const bytes = await readFile(inputPath);
        return PDFDocument.load(bytes);
      }),
    );

    if (data.pageOrder?.length) {
      // Sap xep tu do TUNG TRANG theo dung thu tu nguoi dung da keo-tha
      // (xem comment MergeJobData.pageOrder) - copyPages tung trang RIENG
      // LE thay vi ca file 1 lan, giu dung vi tri chen giua cac trang cua
      // file khac.
      for (const { fileIndex, pageIndex } of data.pageOrder) {
        const srcDoc = srcDocs[fileIndex];
        if (!srcDoc) {
          throw new Error(`fileIndex không hợp lệ: ${fileIndex}`);
        }
        if (pageIndex < 0 || pageIndex >= srcDoc.getPageCount()) {
          throw new Error(
            `pageIndex ${pageIndex} không hợp lệ cho file thứ ${fileIndex}`,
          );
        }
        const [page] = await merged.copyPages(srcDoc, [pageIndex]);
        merged.addPage(page);
      }
    } else {
      // Hanh vi CU - noi lan luot toan bo trang cua tung file theo dung thu
      // tu inputPaths (tool "Ghép PDF" don gian, khong sap xep tung trang).
      for (const srcDoc of srcDocs) {
        const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
    }

    return this.saveOutput(merged, data.outputFileName);
  }

  private async split(data: SplitJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const pageIndices = parsePageRanges(data.ranges, srcDoc.getPageCount());

    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, pageIndices);
    pages.forEach((page) => newDoc.addPage(page));

    return this.saveOutput(newDoc, data.outputFileName);
  }

  private async compress(data: CompressJobData): Promise<JobResult> {
    const outputPath = this.storage.outputPath(data.outputFileName);
    await compressPdfWithGhostscript(data.inputPath, outputPath, data.level);
    return { outputFileName: data.outputFileName };
  }

  private async toImage(data: ToImageJobData): Promise<JobResult> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(data.inputPath, { scale: data.scale });

    const outputPath = this.storage.outputPath(data.outputFileName);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = createWriteStream(outputPath);

    const done = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });
    archive.pipe(output);

    let pageNumber = 1;
    for await (const image of document) {
      archive.append(image, {
        name: `page-${String(pageNumber).padStart(3, '0')}.png`,
      });
      pageNumber++;
    }

    await archive.finalize();
    await done;

    return { outputFileName: data.outputFileName };
  }

  private async watermark(data: WatermarkJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 10;
      const textWidth = font.widthOfTextAtSize(data.text, fontSize);

      page.drawText(data.text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.3,
        rotate: degrees(45),
      });
    }

    return this.saveOutput(doc, data.outputFileName);
  }

  private async pageNumbers(data: PageNumbersJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;

    doc.getPages().forEach((page, index) => {
      const { width } = page.getSize();
      const label = String(data.startAt + index);
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      page.drawText(label, {
        x: width / 2 - textWidth / 2,
        y: 20,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    return this.saveOutput(doc, data.outputFileName);
  }

  private async rotate(data: RotateJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();

    for (const [pageIndexStr, degreesValue] of Object.entries(
      data.pageRotations,
    )) {
      const pageNumber = Number(pageIndexStr);
      if (pageNumber < 1 || pageNumber > pages.length) {
        throw new Error(`page phải trong khoảng 1-${pages.length}`);
      }
      const page = pages[pageNumber - 1];
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees(currentAngle + degreesValue));
    }

    return this.saveOutput(doc, data.outputFileName);
  }

  private async deletePages(data: DeletePagesJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const srcDoc = await PDFDocument.load(bytes);
    const pageCount = srcDoc.getPageCount();
    const pagesToDelete = new Set(parsePageRanges(data.pages, pageCount));

    const pagesToKeep: number[] = [];
    for (let i = 0; i < pageCount; i++) {
      if (!pagesToDelete.has(i)) pagesToKeep.push(i);
    }
    if (pagesToKeep.length === 0) {
      throw new Error('Không thể xoá toàn bộ trang của file PDF');
    }

    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, pagesToKeep);
    pages.forEach((page) => newDoc.addPage(page));

    return this.saveOutput(newDoc, data.outputFileName);
  }

  private async protect(data: ProtectJobData): Promise<JobResult> {
    const outputPath = this.storage.outputPath(data.outputFileName);
    await protectPdf(data.inputPath, outputPath, data.password);
    return { outputFileName: data.outputFileName };
  }

  private async unlock(data: UnlockJobData): Promise<JobResult> {
    const outputPath = this.storage.outputPath(data.outputFileName);
    await unlockPdf(data.inputPath, outputPath, data.password);
    return { outputFileName: data.outputFileName };
  }

  /**
   * Chen anh chu ky (PNG nen trong suot, TUY CHON) vao 1 vi tri tren 1 trang
   * PDF, va/hoac chen cac GHI CHU (PdfNote) doc lap tai bat ky vi tri/trang
   * nao (2026-09-24, thiet ke lai theo dung y "add note như 1 tính năng
   * riêng biệt, ko liên quan gì vẽ chữ ký... giống các ứng dụng pdf trên
   * winform ấy" - lan dau hieu nham note gan voi vi tri chu ky). Toa do dung
   * don vi point PDF chuan (goc trai-duoi trang) - frontend chiu trach nhiem
   * quy doi tu toa do hien thi tren UI (thuong la top-left) sang he nay.
   */
  private async sign(data: SignJobData): Promise<JobResult> {
    const bytes = await readFile(data.inputPath);
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();

    const hasSignature = Boolean(
      data.signaturePath &&
      data.page != null &&
      data.x != null &&
      data.y != null &&
      data.width != null &&
      data.height != null,
    );

    if (hasSignature) {
      const page = data.page as number;
      if (page < 1 || page > pages.length) {
        throw new Error(`page phải trong khoảng 1-${pages.length}`);
      }
      const signatureBytes = await readFile(data.signaturePath as string);
      const signatureImage = await doc.embedPng(signatureBytes);
      pages[page - 1].drawImage(signatureImage, {
        x: data.x as number,
        y: data.y as number,
        width: data.width as number,
        height: data.height as number,
      });
    }

    // data.notes === undefined nghia la request KHONG dong cham gi den note
    // (vd chi vebe them chu ky) - GIU NGUYEN annotation cu. data.notes la
    // mang (ke ca rong []) nghia la UI da hien thi + cho nguoi dung sua/xoa
    // toan bo note hien co, nen XOA HET annotation Text cu roi ghi lai DAY
    // DU danh sach hien tai - tranh phai dong bo them/sua/xoa rieng le giua
    // client va server (client chi can gui lai toan bo mang notes hien tai).
    // Frontend doc note co san bang pdf.js (getAnnotations()) khi load file
    // de hien thi len UI cho nguoi dung sua/xoa (2026-09-24, theo yeu cau
    // "khi load file có sẵn note thì sao lại không hiển thị trên giao
    // diện").
    if (data.notes !== undefined) {
      for (const page of pages) {
        this.removeTextAnnotations(page);
      }
      for (const note of data.notes) {
        if (note.page < 1 || note.page > pages.length) {
          throw new Error(`page phải trong khoảng 1-${pages.length}`);
        }
        this.addTextAnnotation(doc, pages[note.page - 1], note);
      }
    }

    return this.saveOutput(doc, data.outputFileName);
  }

  private removeTextAnnotations(
    page: ReturnType<PDFDocument['getPages']>[number],
  ): void {
    const existingAnnots = page.node.lookup(PDFName.of('Annots'));
    if (!(existingAnnots instanceof PDFArray)) return;

    for (let i = existingAnnots.size() - 1; i >= 0; i--) {
      const annotRef = existingAnnots.get(i);
      const annotDict = page.node.context.lookup(annotRef);
      if (
        annotDict instanceof PDFDict &&
        annotDict.get(PDFName.of('Subtype'))?.toString() === '/Text'
      ) {
        existingAnnots.remove(i);
      }
    }
  }

  /**
   * Ghi 1 GHI CHU thanh PDF Text Annotation THAT (Subtype /Text, "sticky
   * note" chuan PDF spec) thay vi ve thang chu len trang - de cac trinh doc
   * PDF khac (Adobe Acrobat, Foxit...) cung nhan dien duoc icon note va cho
   * click de xem noi dung, dung nhu cac ung dung doc PDF desktop thong
   * thuong. Dung truc tiep pdf-lib low-level API (context.obj/register) vi
   * pdf-lib chua co helper cap cao cho annotation loai nay.
   */
  private addTextAnnotation(
    doc: PDFDocument,
    page: ReturnType<PDFDocument['getPages']>[number],
    note: { x: number; y: number; content: string },
  ): void {
    // note.x/note.y la TAM icon (khop voi cach frontend tinh nguoc lai luc
    // doc annotation co san - xem PdfSignPage.jsx handlePageRenderSuccess),
    // nen Rect phai CAN GIUA quanh (note.x, note.y), khong dat no lam goc
    // trai-duoi - neu khong 2 chieu ghi/doc se lech nua icon size moi lan.
    const iconSize = 20;
    const halfIcon = iconSize / 2;
    const annotDict = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [
        note.x - halfIcon,
        note.y - halfIcon,
        note.x + halfIcon,
        note.y + halfIcon,
      ],
      Contents: PDFString.of(note.content),
      Name: 'Comment',
      Open: false,
      C: [1, 0.92, 0.4],
    });

    const annotRef: PDFRef = doc.context.register(annotDict);

    const existingAnnots = page.node.lookup(PDFName.of('Annots'));
    if (existingAnnots instanceof PDFArray) {
      existingAnnots.push(annotRef);
    } else {
      page.node.set(PDFName.of('Annots'), doc.context.obj([annotRef]));
    }
  }

  /**
   * Ghep nhieu anh (JPG/PNG) thanh 1 file PDF - moi anh 1 trang, kich thuoc
   * trang = kich thuoc anh (point = pixel, khong scale) de giu dung ty le,
   * khong bi keo gian meo hinh nhu ep vao khung A4 co dinh.
   */
  private async imagesToPdf(data: ImagesToPdfJobData): Promise<JobResult> {
    const doc = await PDFDocument.create();

    for (const inputPath of data.inputPaths) {
      const bytes = await readFile(inputPath);
      const isPng = inputPath.toLowerCase().endsWith('.png');
      const image = isPng
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      const page = doc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    return this.saveOutput(doc, data.outputFileName);
  }

  private async saveOutput(
    doc: PDFDocument,
    outputFileName: string,
    saveOptions?: Parameters<PDFDocument['save']>[0],
  ): Promise<JobResult> {
    const outputBytes = await doc.save(saveOptions);
    const outputPath = this.storage.outputPath(outputFileName);
    await writeFile(outputPath, outputBytes);
    return { outputFileName };
  }
}
