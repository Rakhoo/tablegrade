import { format, parseISO } from "date-fns";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbsentBadge, GradeBadge } from "../components/GradeBadge";
import type { GradeEntry, SchoolClass } from "../db";
import { toIsoDate } from "../lib/dates";
import { formatClassName } from "../lib/formatters";
import {
  ABSENT_COLOR,
  formatMark,
  getGradeColor,
  type LessonType,
} from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";
import type { OverviewColumn } from "../lib/overview";
import type { AppSettings } from "../lib/settings";
import { downloadFile } from "./backup";

/** What an export contains; rows are in display order. */
export type OverviewExport = {
  schoolClass: SchoolClass;
  title: string;
  students: { id: number; name: string }[];
  columns: OverviewColumn[];
  entryOf: (studentId: number, date: string) => GradeEntry | undefined;
  typeOf: (date: string) => LessonType;
  settings: AppSettings;
};

/** Text of a cell: the grade or mark like "2+", or "E" for excused. */
function cellText(entry: GradeEntry | undefined, column: OverviewColumn) {
  const value = column.kind == "oral" ? entry?.grade : entry?.mark;
  if (value != null) return formatMark(value);
  return entry?.absent ? "E" : "";
}

const columnTitle = ({ date, kind }: OverviewColumn, type: LessonType) => {
  const label = format(parseISO(date), "dd.MM.yy");
  return kind == "mark" ? `${label} ${LESSON_TYPE_LABELS[type]}` : label;
};

const fileName = ({ schoolClass }: OverviewExport, extension: string) =>
  `Uebersicht-${formatClassName(schoolClass)}-${schoolClass.subject}-${toIsoDate(new Date())}.${extension}`.replace(
    /[^\w.-]+/g,
    "_",
  );

/** Exports the table as CSV in the format of German spreadsheets (semicolons, BOM). */
export function exportCsv(data: OverviewExport) {
  const escape = (text: string) =>
    /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  const lines = [
    [
      "Schüler",
      ...data.columns.map((column) =>
        columnTitle(column, data.typeOf(column.date)),
      ),
    ],
    ...data.students.map((student) => [
      student.name,
      ...data.columns.map((column) =>
        cellText(data.entryOf(student.id, column.date), column),
      ),
    ]),
  ];
  const csv = lines.map((line) => line.map(escape).join(";")).join("\r\n");
  downloadFile(
    new File([`\ufeff${csv}`], fileName(data, "csv"), { type: "text/csv" }),
  );
}

/** Renders an SVG element to a PNG data URL, as jsPDF cannot embed SVGs. */
async function renderBadge(svg: string, size: number) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 10;
const NAME_WIDTH = 48;
const COLUMN_WIDTH = 8;
const ROW_HEIGHT = 7;
const HEADER_HEIGHT = 24;
const TITLE_HEIGHT = 10;
const BADGE_SIZE = 5;
const BADGE_PIXELS = 96;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * Exports the table as PDF in landscape, split over pages if necessary. Grades are symbols or
 * numbers and colored or black and white, by the settings; theme colors are left out.
 */
export async function exportPdf(data: OverviewExport) {
  const { jsPDF } = await import("jspdf");
  const { settings, columns, students } = data;
  const color = settings.exportColors;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const badges = new Map<string, string>();
  const getBadge = async (value: number | null) => {
    const key = String(value);
    if (!badges.has(key)) {
      const element =
        value == null
          ? createElement(AbsentBadge, {
              symbol: settings.absentSymbol,
              color: color ? ABSENT_COLOR : "#000000",
              size: BADGE_PIXELS,
              background: "#ffffff",
            })
          : createElement(GradeBadge, {
              symbol: settings.gradeSymbols[value]?.symbol ?? "value",
              value,
              color: getGradeColor(value),
              size: BADGE_PIXELS,
              monochrome: !color,
            });
      badges.set(
        key,
        await renderBadge(renderToStaticMarkup(element), BADGE_PIXELS),
      );
    }
    return badges.get(key)!;
  };

  const columnsPerPage = Math.floor(
    (PAGE_WIDTH - 2 * MARGIN - NAME_WIDTH) / COLUMN_WIDTH,
  );
  const top = MARGIN + TITLE_HEIGHT + HEADER_HEIGHT;
  const rowsPerPage = Math.floor((PAGE_HEIGHT - MARGIN - top) / ROW_HEIGHT);

  let firstPage = true;
  for (let c = 0; c < Math.max(columns.length, 1); c += columnsPerPage) {
    for (let r = 0; r < students.length; r += rowsPerPage) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      const pageColumns = columns.slice(c, c + columnsPerPage);
      const pageStudents = students.slice(r, r + rowsPerPage);
      const right = MARGIN + NAME_WIDTH + pageColumns.length * COLUMN_WIDTH;

      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(data.title, MARGIN, MARGIN + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      pageColumns.forEach((column, index) => {
        const x =
          MARGIN + NAME_WIDTH + index * COLUMN_WIDTH + COLUMN_WIDTH / 2 + 1;
        doc.text(columnTitle(column, data.typeOf(column.date)), x, top - 2, {
          angle: 60,
        });
      });

      doc.setDrawColor(190);
      doc.setLineWidth(0.1);
      for (const [index, student] of pageStudents.entries()) {
        const y = top + index * ROW_HEIGHT;
        doc.line(MARGIN, y, right, y);
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(student.name, MARGIN + 1, y + 4.7, {
          maxWidth: NAME_WIDTH - 2,
        });
        for (const [columnIndex, column] of pageColumns.entries()) {
          const entry = data.entryOf(student.id, column.date);
          const value = column.kind == "oral" ? entry?.grade : entry?.mark;
          const x = MARGIN + NAME_WIDTH + columnIndex * COLUMN_WIDTH;
          const useBadge =
            !settings.exportValues && column.kind == "oral" && value != null;
          if (useBadge || (value == null && entry?.absent)) {
            doc.addImage(
              await getBadge(value ?? null),
              "PNG",
              x + (COLUMN_WIDTH - BADGE_SIZE) / 2,
              y + (ROW_HEIGHT - BADGE_SIZE) / 2,
              BADGE_SIZE,
              BADGE_SIZE,
            );
          } else if (value != null) {
            const [red, green, blue] = hexToRgb(getGradeColor(value));
            if (color) doc.setTextColor(red, green, blue);
            else doc.setTextColor(0);
            doc.text(formatMark(value), x + COLUMN_WIDTH / 2, y + 4.7, {
              align: "center",
            });
          }
        }
      }
      const bottom = top + pageStudents.length * ROW_HEIGHT;
      doc.line(MARGIN, bottom, right, bottom);
      for (let index = 0; index <= pageColumns.length; index++) {
        const x = MARGIN + NAME_WIDTH + index * COLUMN_WIDTH;
        doc.line(x, top, x, bottom);
      }
    }
  }
  downloadFile(
    new File([doc.output("blob")], fileName(data, "pdf"), {
      type: "application/pdf",
    }),
  );
}
