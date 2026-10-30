/** Text fragment of a PDF page; `y` is the baseline, measured from the page bottom. */
export type PdfText = { text: string; x: number; y: number };
/** Position of an image on a PDF page; `y` is its lower edge. */
export type PdfBox = { x: number; y: number; width: number; height: number };
/** Student row of a WebUntis student list. */
export type RosterPdfRow = {
  firstName: string;
  lastName: string;
  imageBox: PdfBox | null;
};
/** Left edges of the name columns; found once, later pages may repeat or omit the header. */
export type RosterColumns = {
  lastName: number;
  firstName: number;
  end: number;
};

/** Maximum vertical distance in pt to the row number (rows are 40 pt high). */
const ROW_TOLERANCE = 18;
/** Text starts a little right of the cell, but never further left than the header. */
const COLUMN_TOLERANCE = 2;

/** Finds the table header ("Familienname", "Vorname", "Klasse") of a page. */
export function findColumns(texts: PdfText[]) {
  const find = (label: string) =>
    texts.find((item) => item.text.trim() == label);
  const [lastName, firstName, end] = ["Familienname", "Vorname", "Klasse"].map(
    find,
  );
  if (!lastName || !firstName || !end) return null;
  return {
    columns: {
      lastName: lastName.x,
      firstName: firstName.x,
      end: end.x,
    } as RosterColumns,
    headerY: lastName.y,
  };
}

/** Joins the fragments of a table cell, top to bottom, as long names may wrap. */
function joinCell(items: PdfText[]) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  return sorted
    .map((item, index) =>
      index > 0 && Math.abs(item.y - sorted[index - 1].y) > 1
        ? ` ${item.text}`
        : item.text,
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads the student rows of one page: each row starts with its number left of the name
 * columns. Texts and images belong to the row whose number is vertically closest.
 */
export function parseRosterPage(
  texts: PdfText[],
  images: PdfBox[],
  columns: RosterColumns,
  headerY = Infinity,
): RosterPdfRow[] {
  const table = texts.filter((item) => item.y < headerY);
  const numbers = table.filter(
    (item) => item.x < columns.lastName && /^\d+$/.test(item.text.trim()),
  );
  const nearestNumber = (y: number) => {
    const nearest = numbers.reduce<PdfText | null>(
      (best, number) =>
        !best || Math.abs(number.y - y) < Math.abs(best.y - y) ? number : best,
      null,
    );
    return nearest && Math.abs(nearest.y - y) <= ROW_TOLERANCE ? nearest : null;
  };
  const inColumn = (item: PdfText, start: number, end: number) =>
    item.x >= start - COLUMN_TOLERANCE && item.x < end - COLUMN_TOLERANCE;

  return numbers
    .map((number) => {
      const cell = (start: number, end: number) =>
        joinCell(
          table.filter(
            (item) =>
              inColumn(item, start, end) && nearestNumber(item.y) == number,
          ),
        );
      return {
        lastName: cell(columns.lastName, columns.firstName),
        firstName: cell(columns.firstName, columns.end),
        imageBox:
          images.find(
            (box) =>
              box.x < columns.lastName &&
              nearestNumber(box.y + box.height / 2) == number,
          ) ?? null,
      };
    })
    .filter((row) => row.firstName || row.lastName);
}
