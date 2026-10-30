import {
  getDocument,
  GlobalWorkerOptions,
  OPS,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {
  findColumns,
  parseRosterPage,
  type PdfBox,
  type PdfText,
  type RosterColumns,
} from "../lib/rosterPdf";
import type { IncomingStudent } from "../lib/studentRoster";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Render resolution of the photos: 4 px per PDF point. */
const IMAGE_SCALE = 4;
const IMAGE_QUALITY = 0.85;

type Matrix = [number, number, number, number, number, number];

/** Reads all text fragments of a page with their positions. */
async function readTexts(page: PDFPageProxy): Promise<PdfText[]> {
  const { items } = await page.getTextContent();
  return items.flatMap((item) =>
    "str" in item && item.str.trim()
      ? [{ text: item.str, x: item.transform[4], y: item.transform[5] }]
      : [],
  );
}

/** Locates all images of a page by following the transformations of its drawing operations. */
export async function readImageBoxes(page: PDFPageProxy): Promise<PdfBox[]> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const boxes: PdfBox[] = [];
  const stack: Matrix[] = [];
  let [a, b, c, d, e, f]: Matrix = [1, 0, 0, 1, 0, 0];
  fnArray.forEach((fn, index) => {
    if (fn == OPS.save) stack.push([a, b, c, d, e, f]);
    else if (fn == OPS.restore)
      [a, b, c, d, e, f] = stack.pop() ?? [a, b, c, d, e, f];
    else if (fn == OPS.transform) {
      const [a2, b2, c2, d2, e2, f2] = argsArray[index] as Matrix;
      [a, b, c, d, e, f] = [
        a * a2 + c * b2,
        b * a2 + d * b2,
        a * c2 + c * d2,
        b * c2 + d * d2,
        a * e2 + c * f2 + e,
        b * e2 + d * f2 + f,
      ];
    } else if (
      fn == OPS.paintImageXObject ||
      fn == OPS.paintInlineImageXObject
    ) {
      // Images fill the unit square of the current coordinate system
      boxes.push({
        x: Math.min(e, e + a),
        y: Math.min(f, f + d),
        width: Math.abs(a),
        height: Math.abs(d),
      });
    }
  });
  return boxes;
}

/** Renders a page and cuts the given areas out of it as JPEG data URLs. */
async function cropImages(page: PDFPageProxy, boxes: PdfBox[]) {
  const viewport = page.getViewport({ scale: IMAGE_SCALE });
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = viewport.width;
  pageCanvas.height = viewport.height;
  await page.render({ canvas: pageCanvas, viewport }).promise;

  return boxes.map((box) => {
    const crop = document.createElement("canvas");
    crop.width = Math.round(box.width * IMAGE_SCALE);
    crop.height = Math.round(box.height * IMAGE_SCALE);
    const left = box.x * IMAGE_SCALE;
    // PDF coordinates start at the bottom of the page, canvas coordinates at the top
    const top = viewport.height - (box.y + box.height) * IMAGE_SCALE;
    crop
      .getContext("2d")!
      .drawImage(
        pageCanvas,
        left,
        top,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );
    return crop.toDataURL("image/jpeg", IMAGE_QUALITY);
  });
}

/**
 * Reads the students of a WebUntis PDF from all pages. Everything happens on the device.
 * @returns The students, or `null` if the file has no matching table header.
 */
export async function readRosterPdf(
  data: ArrayBuffer,
): Promise<IncomingStudent[] | null> {
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;
  const students: IncomingStudent[] = [];
  let columns: RosterColumns | null = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const texts = await readTexts(page);
    const header = findColumns(texts);
    columns = header?.columns ?? columns;
    if (!columns) continue;

    const rows = parseRosterPage(
      texts,
      await readImageBoxes(page),
      columns,
      header?.headerY,
    );
    const boxes = rows.flatMap((row) => (row.imageBox ? [row.imageBox] : []));
    const images = boxes.length ? await cropImages(page, boxes) : [];
    for (const { firstName, lastName, imageBox } of rows) {
      students.push({
        firstName,
        lastName,
        image: imageBox ? images[boxes.indexOf(imageBox)] : null,
      });
    }
  }
  await loadingTask.destroy();
  return columns && students;
}
