import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { isTag, isText, type Element } from 'domhandler';
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalMergeType,
  UnderlineType,
  AlignmentType,
  ImageRun,
} from 'docx';

// Doc thuoc tinh align="center|right|left" (Gemini duoc yeu cau ghi truc
// tiep attribute nay, xem OCR_PROMPT) - fallback doc ca "style=text-align:
// ..." phong khi model tra ve dang CSS inline thay vi attribute don gian.
function readAlignment(
  $: CheerioAny,
  el: Element,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const alignAttr = ($(el).attr('align') || '').toLowerCase();
  const styleAttr = ($(el).attr('style') || '').toLowerCase();
  const styleMatch = /text-align\s*:\s*(center|right|left|justify)/.exec(
    styleAttr,
  );
  const value = alignAttr || styleMatch?.[1] || '';

  switch (value) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

// docx dung don vi "half-point" cho TextRun.size (vd co 12pt -> size: 24).
// Anh xa 4 muc RỜI RẠC ("xl"/"lg"/"md"/"sm") thay vi bat AI uoc luong so pt
// chinh xac - AI Vision doc so pt tu 1 buc anh scan gan nhu khong the chinh
// xac (khong co thuoc do), nhung SO SANH tuong doi "to hon/nho hon thanh
// phan xung quanh" thi kha tin cay. "md" (than bai) khong set gi - de docx
// dung mac dinh cua template, tranh ghi de khong can thiet.
const FONT_SIZE_HALF_POINTS: Record<string, number> = {
  xl: 32, // ~16pt - tieu de lon (vd "THÔNG TƯ", "QUYẾT ĐỊNH")
  lg: 28, // ~14pt - tieu de phu/de muc
  sm: 20, // ~10pt - chu thich/ghi chu nho
};

function readFontSize($: CheerioAny, el: Element): number | undefined {
  const size = ($(el).attr('data-size') || '').toLowerCase();
  return FONT_SIZE_HALF_POINTS[size];
}

// Thut le dau dong - docx dung don vi TWIP (1/20 point), 720 TWIP = 0.5 inch
// = muc thut le chuan cua Word ("First Line Indent" mac dinh).
const FIRST_LINE_INDENT_TWIPS = 720;

function readIndent(
  $: CheerioAny,
  el: Element,
): { firstLine: number } | undefined {
  return $(el).attr('data-indent') === 'true'
    ? { firstLine: FIRST_LINE_INDENT_TWIPS }
    : undefined;
}

type DocxBlock = Paragraph | Table;

const HEADING_TAG_TO_LEVEL: Record<
  string,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
};

type CheerioAny = ReturnType<typeof cheerio.load>;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: { type: (typeof UnderlineType)[keyof typeof UnderlineType] };
  size?: number;
}

// Doc de quy 1 the (vd <p>, <td>) thanh cac TextRun, giu dinh dang
// b/i/u/br - cheerio cho phep duyet cay DOM lồng nhau (vd "<b>vua <i>dam
// va nghieng</i></b>") ma khong can tu viet regex tach tag thu cong (de vo
// voi HTML long nhau).
function extractRuns(
  $: CheerioAny,
  el: Element,
  style: RunStyle = {},
): TextRun[] {
  const runs: TextRun[] = [];
  $(el)
    .contents()
    .each((_, node) => {
      if (isText(node)) {
        const text = $(node).text();
        if (text) runs.push(new TextRun({ text, ...style }));
        return;
      }
      if (!isTag(node)) return;
      const tag = node.tagName?.toLowerCase();
      if (tag === 'br') {
        runs.push(new TextRun({ text: '', break: 1 }));
        return;
      }
      const nextStyle: RunStyle = { ...style };
      if (tag === 'b' || tag === 'strong') nextStyle.bold = true;
      if (tag === 'i' || tag === 'em') nextStyle.italics = true;
      if (tag === 'u') nextStyle.underline = { type: UnderlineType.SINGLE };
      runs.push(...extractRuns($, node, nextStyle));
    });
  return runs;
}

// 1 o "that" (co noi dung, la goc cua 1 nhom gop neu co colspan/rowspan).
interface RealCellSlot {
  kind: 'real';
  colSpan: number;
  rowSpan: number;
  runs: TextRun[];
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
}
// 1 o "bi gop theo chieu doc" - phai la 1 <w:tc> RIENG voi vMerge="continue"
// trong OOXML (docx KHONG tu sinh cai nay khi chi set rowSpan tren o goc -
// da kiem tra truc tiep type definition cua thu vien "docx", field rowSpan
// chi ghi so vao o goc, cac hang duoi van can co the <w:tc> rieng).
interface ContinueCellSlot {
  kind: 'continue';
}
type CellSlot = RealCellSlot | ContinueCellSlot;

// Dung ma tran [row][col] -> CellSlot de xac dinh CHINH XAC moi <tr> HTML
// (co the co it <td> hon so cot thuc te neu hang tren co o rowspan de
// xuong) tuong ung voi bao nhieu TableCell docx that su can render, va o
// nao la "continue" cua 1 rowspan tu hang tren.
function buildCellGrid($: CheerioAny, tableEl: Element): CellSlot[][] {
  const trEls = $(tableEl).find('tr').toArray();
  const grid: CellSlot[][] = trEls.map(() => []);

  trEls.forEach((tr, rowIndex) => {
    let colCursor = 0;
    const tdEls = $(tr).find('td, th').toArray();

    for (const td of tdEls) {
      while (grid[rowIndex][colCursor]) colCursor++;

      const colSpan = Math.max(1, parseInt($(td).attr('colspan') || '1', 10));
      const rowSpan = Math.max(1, parseInt($(td).attr('rowspan') || '1', 10));
      const isBold = $(td).is('th');

      grid[rowIndex][colCursor] = {
        kind: 'real',
        colSpan,
        rowSpan,
        runs: extractRuns($, td, isBold ? { bold: true } : {}),
        alignment: readAlignment($, td),
      };

      for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
        if (!grid[r]) grid[r] = [];
        for (let c = colCursor; c < colCursor + colSpan; c++) {
          if (r === rowIndex && c === colCursor) continue; // o goc, da gan o tren
          grid[r][c] = { kind: 'continue' };
        }
      }
      colCursor += colSpan;
    }
  });

  return grid;
}

function buildTableFromHtml($: CheerioAny, tableEl: Element): Table {
  const grid = buildCellGrid($, tableEl);

  const rows = grid.map((rowSlots) => {
    const cells: TableCell[] = [];
    const columnCount = rowSlots.length;

    for (let col = 0; col < columnCount; col++) {
      const slot = rowSlots[col];
      if (!slot) continue; // o trong (khong co du lieu, hiem gap) - bo qua

      if (slot.kind === 'continue') {
        // O rong danh dau "tiep tuc gop doc" - PHAI la 1 TableCell rieng de
        // OOXML co dung so <w:tc> khop voi so cot, khong duoc gop chung vao
        // o goc.
        cells.push(
          new TableCell({
            verticalMerge: VerticalMergeType.CONTINUE,
            children: [new Paragraph({ text: '' })],
          }),
        );
        continue;
      }

      cells.push(
        new TableCell({
          columnSpan: slot.colSpan > 1 ? slot.colSpan : undefined,
          verticalMerge:
            slot.rowSpan > 1 ? VerticalMergeType.RESTART : undefined,
          children: [
            new Paragraph({ alignment: slot.alignment, children: slot.runs }),
          ],
        }),
      );
    }

    return new TableRow({ children: cells });
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

// Doc bbox "x1,y1,x2,y2" (% 0-100, xem OCR_PROMPT) tu <img data-bbox="...">
// va CAT ĐÚNG vung do ra khoi anh GOC cua trang bang sharp - AI chi bao vi
// tri, KHONG tu "ve lai" hinh anh (AI Vision khong the tai tao chinh xac
// pixel cua logo/con dau/chu ky that), nen day la cach DUY NHAT giu duoc
// hinh anh THAT trong ket qua. Tra ve null neu bbox khong hop le hoac cat
// that bai (vd toa do AI doan sai lech ra ngoai trang) - khong lam hong ca
// trang chi vi 1 hinh loi.
async function cropImageFromBbox(
  pageImageBytes: Buffer,
  bboxAttr: string,
): Promise<Buffer | null> {
  const parts = bboxAttr.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x1Pct, y1Pct, x2Pct, y2Pct] = parts;

  try {
    const metadata = await sharp(pageImageBytes).metadata();
    const pageWidth = metadata.width ?? 0;
    const pageHeight = metadata.height ?? 0;
    if (!pageWidth || !pageHeight) return null;

    const left = Math.max(0, Math.round((x1Pct / 100) * pageWidth));
    const top = Math.max(0, Math.round((y1Pct / 100) * pageHeight));
    const width = Math.min(
      pageWidth - left,
      Math.round(((x2Pct - x1Pct) / 100) * pageWidth),
    );
    const height = Math.min(
      pageHeight - top,
      Math.round(((y2Pct - y1Pct) / 100) * pageHeight),
    );
    if (width <= 0 || height <= 0) return null;

    return await sharp(pageImageBytes)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// Kich thuoc hien thi TOI DA cua anh chen vao .docx (EMU-independent, docx
// nhan truc tiep px) - gioi han de logo/con dau khong bi phong to qua kho
// (bbox AI doan co the rong hon thuc te), giu ty le goc qua "transformation".
const MAX_INLINE_IMAGE_WIDTH_PX = 300;

async function buildImageParagraph(
  pageImageBytes: Buffer,
  bboxAttr: string,
): Promise<Paragraph | null> {
  const cropped = await cropImageFromBbox(pageImageBytes, bboxAttr);
  if (!cropped) return null;

  const metadata = await sharp(cropped).metadata();
  const naturalWidth = metadata.width ?? MAX_INLINE_IMAGE_WIDTH_PX;
  const naturalHeight = metadata.height ?? MAX_INLINE_IMAGE_WIDTH_PX;
  const scale = Math.min(1, MAX_INLINE_IMAGE_WIDTH_PX / naturalWidth);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        type: 'png',
        data: cropped,
        transformation: {
          width: Math.round(naturalWidth * scale),
          height: Math.round(naturalHeight * scale),
        },
      }),
    ],
  });
}

/**
 * Parser HTML sang cac khoi docx (Paragraph/Table) - chi ho tro dung tap
 * the ma OCR_PROMPT yeu cau Gemini sinh ra (h1-h3, p, table/tr/td voi
 * colspan/rowspan, b/i/u/br, img[data-bbox]) - KHONG phai parser HTML day
 * du, nhung dung cheerio (thay vi regex tu viet) de duyet cay DOM dung dan
 * voi cau truc long nhau/khong deu (2026-09-23, theo phan hoi "OCR PDF
 * sang Word (AI)... vẫn chưa giống hoàn toàn bản gốc" - thay
 * markdown-to-docx.util.ts cu vi Markdown table khong bieu dien duoc merge
 * cell; sau do bo sung co chu/thut le/hinh anh that theo cung phan hoi).
 * ASYNC vi buildImageParagraph() can goi sharp (bat dong bo) de cat anh -
 * pageImageBytes la anh GOC cua CHINH trang nay (chua qua OCR), dung de
 * cat vung hinh ra, KHONG dung khi khong co the <img> nao trong html.
 */
export async function htmlToDocxBlocks(
  html: string,
  pageImageBytes: Buffer,
): Promise<DocxBlock[]> {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const root = $('#root')[0];
  const blocks: DocxBlock[] = [];

  const children = $(root).children().toArray();
  for (const el of children) {
    {
      const tag = el.tagName?.toLowerCase();
      if (tag === 'img') {
        const bboxAttr = $(el).attr('data-bbox');
        if (bboxAttr) {
          const imgParagraph = await buildImageParagraph(
            pageImageBytes,
            bboxAttr,
          );
          if (imgParagraph) blocks.push(imgParagraph);
        }
        continue;
      }
      if (tag === 'table') {
        blocks.push(buildTableFromHtml($, el));
        continue;
      }
      if (tag in HEADING_TAG_TO_LEVEL) {
        const fontSize = readFontSize($, el);
        blocks.push(
          new Paragraph({
            heading: HEADING_TAG_TO_LEVEL[tag],
            alignment: readAlignment($, el),
            children: extractRuns($, el, fontSize ? { size: fontSize } : {}),
          }),
        );
        continue;
      }
      if (tag === 'p' || tag === 'div') {
        const fontSize = readFontSize($, el);
        const runs = extractRuns($, el, fontSize ? { size: fontSize } : {});
        if (runs.length > 0) {
          blocks.push(
            new Paragraph({
              alignment: readAlignment($, el),
              indent: readIndent($, el),
              children: runs,
            }),
          );
        }
        continue;
      }
      // The la khac (vd Gemini lo sinh <ul>/<li>) - fallback lay text thuan
      // thay vi bo qua hoan toan noi dung.
      const text = $(el).text().trim();
      if (text) blocks.push(new Paragraph({ text }));
    }
  }

  return blocks;
}
