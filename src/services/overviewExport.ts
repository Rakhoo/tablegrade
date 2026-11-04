import { format, parseISO } from "date-fns";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbsentBadge, GradeBadge } from "../components/GradeBadge";
import type { GradeEntry, SchoolClass, Trait } from "../db";
import { toIsoDate } from "../lib/dates";
import { formatClassName } from "../lib/formatters";
import {
  MARK_KIND,
  ABSENT_COLOR,
  formatMark,
  getGradeColor,
  type LessonType,
} from "../lib/grades";
import { LESSON_TYPE_LABELS } from "../lib/lessons";
import type { LessonColumn, OverviewColumn } from "../lib/overview";
import { REPORT_LABELS, type ReportColumn } from "../lib/reports";
import type { AppSettings } from "../lib/settings";
import { downloadFile } from "./backup";

/** What an export contains; rows are in display order. */
export type OverviewExport = {
  schoolClass: SchoolClass;
  title: string;
  /** `image` and `traits` hold what the overview shows; only the PDF uses them. */
  students: {
    id: number;
    name: string;
    image: string | null;
    traits: Trait[];
  }[];
  columns: OverviewColumn[];
  entryOf: (studentId: number, date: string) => GradeEntry | undefined;
  typesOf: (date: string) => LessonType[];
  settings: AppSettings;
};

/** The grade or mark of a lesson column. */
const valueOf = (entry: GradeEntry | undefined, column: LessonColumn) =>
  column.kind == "oral"
    ? entry?.grade
    : column.kind == "mark"
      ? entry?.mark
      : entry?.projectMark;

/** Text of a cell: the grade or mark like "2+", or "E" for excused. */
function cellText(entry: GradeEntry | undefined, column: LessonColumn) {
  const value = valueOf(entry, column);
  if (value != null) return formatMark(value);
  return entry?.absent ? "E" : "";
}

const columnTitle = (column: OverviewColumn, types: LessonType[]) => {
  if (column.kind == "report")
    return column.main ? REPORT_LABELS[column.report] : column.label;
  const label = format(parseISO(column.date), "dd.MM.yy");
  if (column.kind == "oral") return label;
  // A mark column is named after the type it belongs to
  const kind = column.kind == "projectMark" ? "project" : "exam";
  const type = types.find((other) => MARK_KIND[other] == kind);
  return type ? `${label} ${LESSON_TYPE_LABELS[type]}` : label;
};

/** Text of a report's cell; a main column has "n.b." without a grade. */
function reportText(column: ReportColumn, studentId: number) {
  const value = column.values.get(studentId);
  if (value != null) return formatMark(value);
  return column.main ? "n.b." : "";
}

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
        columnTitle(column, data.typesOf(column.date)),
      ),
    ],
    ...data.students.map((student) => [
      student.name,
      ...data.columns.map((column) =>
        column.kind == "report"
          ? reportText(column, student.id)
          : cellText(data.entryOf(student.id, column.date), column),
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

/** Crops a photo to a centered circle, as a PNG data URL. */
async function renderPhoto(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_PIXELS;
  const context = canvas.getContext("2d")!;
  context.arc(PHOTO_PIXELS / 2, PHOTO_PIXELS / 2, PHOTO_PIXELS / 2, 0, 7);
  context.clip();
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_PIXELS,
    PHOTO_PIXELS,
  );
  return canvas.toDataURL("image/png");
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
const PHOTO_SIZE = 6;
const PHOTO_PIXELS = 128;
const TRAIT_FONT_SIZE = 6.5;
const TRAIT_LINE_HEIGHT = 2.8;
const TRAIT_GAP = 1.2;

const BLACK: [number, number, number] = [0, 0, 0];

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * Exports the table as PDF in landscape, split over pages if necessary. Grades are symbols or
 * numbers and colored or black and white, by the settings; theme colors are left out. Photos
 * and written out traits are included as shown in the overview, unless the settings forbid it.
 */
export async function exportPdf(data: OverviewExport) {
  const { jsPDF } = await import("jspdf");
  const { settings, columns } = data;
  const color = settings.exportColors;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const students = data.students.map((student) => ({
    ...student,
    image: settings.exportNoPhotos ? null : student.image,
    traits: settings.exportNoTraits ? [] : student.traits,
  }));
  const photoWidth = students.some((student) => student.image)
    ? PHOTO_SIZE + 1
    : 0;
  const nameWidth = NAME_WIDTH + photoWidth;

  /** Breaks a student's traits into lines that fit below the name. */
  const getTraitLines = (traits: Trait[]) => {
    doc.setFontSize(TRAIT_FONT_SIZE);
    const lines: { trait: Trait; text: string; x: number }[][] = [];
    let x = Infinity;
    for (const [index, trait] of traits.entries()) {
      const text = index < traits.length - 1 ? `${trait.name},` : trait.name;
      const width = doc.getTextWidth(text);
      if (x + width > NAME_WIDTH - 2) {
        lines.push([]);
        x = 0;
      }
      lines.at(-1)!.push({ trait, text, x });
      x += width + TRAIT_GAP;
    }
    return lines;
  };
  const traitLines = new Map(
    students.map((student) => [student.id, getTraitLines(student.traits)]),
  );
  const maxTraitLines = Math.max(
    0,
    ...[...traitLines.values()].map((lines) => lines.length),
  );
  const rowHeight =
    maxTraitLines > 0 ? 5.5 + maxTraitLines * TRAIT_LINE_HEIGHT : ROW_HEIGHT;
  const photos = new Map<number, string>();
  for (const { id, image } of students) {
    if (image) photos.set(id, await renderPhoto(image));
  }

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
    (PAGE_WIDTH - 2 * MARGIN - nameWidth) / COLUMN_WIDTH,
  );
  const top = MARGIN + TITLE_HEIGHT + HEADER_HEIGHT;
  const rowsPerPage = Math.floor((PAGE_HEIGHT - MARGIN - top) / rowHeight);

  let firstPage = true;
  for (let c = 0; c < Math.max(columns.length, 1); c += columnsPerPage) {
    for (let r = 0; r < students.length; r += rowsPerPage) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      const pageColumns = columns.slice(c, c + columnsPerPage);
      const pageStudents = students.slice(r, r + rowsPerPage);
      const right = MARGIN + nameWidth + pageColumns.length * COLUMN_WIDTH;

      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(data.title, MARGIN, MARGIN + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      pageColumns.forEach((column, index) => {
        const x =
          MARGIN + nameWidth + index * COLUMN_WIDTH + COLUMN_WIDTH / 2 + 1;
        doc.text(columnTitle(column, data.typesOf(column.date)), x, top - 2, {
          angle: 60,
        });
      });

      doc.setDrawColor(190);
      doc.setLineWidth(0.1);
      for (const [index, student] of pageStudents.entries()) {
        const y = top + index * rowHeight;
        const lines = traitLines.get(student.id)!;
        const textX = MARGIN + 1 + photoWidth;
        doc.line(MARGIN, y, right, y);
        const photo = photos.get(student.id);
        if (photo) {
          doc.addImage(
            photo,
            "PNG",
            MARGIN + 1,
            y + (rowHeight - PHOTO_SIZE) / 2,
            PHOTO_SIZE,
            PHOTO_SIZE,
          );
        }
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(student.name, textX, y + (maxTraitLines > 0 ? 3.8 : 4.7), {
          maxWidth: NAME_WIDTH - 2,
        });
        doc.setFontSize(TRAIT_FONT_SIZE);
        for (const [lineIndex, line] of lines.entries()) {
          for (const { trait, text, x } of line) {
            if (color) doc.setTextColor(...hexToRgb(trait.color));
            else doc.setTextColor(0);
            doc.text(text, textX + x, y + 6.6 + lineIndex * TRAIT_LINE_HEIGHT);
          }
        }
        doc.setFontSize(9);
        for (const [columnIndex, column] of pageColumns.entries()) {
          if (column.kind == "report") {
            const value = column.values.get(student.id) ?? null;
            const suggestion = column.suggestions.get(student.id) ?? null;
            const x =
              MARGIN +
              nameWidth +
              columnIndex * COLUMN_WIDTH +
              COLUMN_WIDTH / 2;
            const baseline = y + rowHeight / 2 + 1.2;
            doc.setFont("helvetica", column.main ? "bold" : "normal");
            doc.setTextColor(
              ...(color && value != null
                ? hexToRgb(getGradeColor(value))
                : BLACK),
            );
            doc.text(reportText(column, student.id), x, baseline, {
              align: "center",
            });
            doc.setFont("helvetica", "normal");
            if (
              column.main &&
              value != null &&
              suggestion != null &&
              value != suggestion
            ) {
              // Helvetica has no arrows, so a small triangle shows the correction
              const better = value < suggestion;
              const arrow = color
                ? hexToRgb(better ? "#15803d" : "#dc2626")
                : BLACK;
              const tip = baseline - 1.2 + (better ? -1 : 1);
              const foot = baseline - 1.2 + (better ? 1 : -1);
              doc.setFillColor(...arrow);
              doc.triangle(x + 2.6, tip, x + 1.7, foot, x + 3.5, foot, "F");
            } else if (column.main && value != null && suggestion == null) {
              // Set by hand instead of "n.b."
              doc.setFont("helvetica", "bold");
              doc.setTextColor(...(color ? hexToRgb("#ca8a04") : BLACK));
              doc.text("!", x + 2.6, baseline);
              doc.setFont("helvetica", "normal");
            }
            continue;
          }
          const entry = data.entryOf(student.id, column.date);
          const value = valueOf(entry, column);
          const x = MARGIN + nameWidth + columnIndex * COLUMN_WIDTH;
          const useBadge =
            !settings.exportValues && column.kind == "oral" && value != null;
          if (useBadge || (value == null && entry?.absent)) {
            doc.addImage(
              await getBadge(value ?? null),
              "PNG",
              x + (COLUMN_WIDTH - BADGE_SIZE) / 2,
              y + (rowHeight - BADGE_SIZE) / 2,
              BADGE_SIZE,
              BADGE_SIZE,
            );
          } else if (value != null) {
            const [red, green, blue] = hexToRgb(getGradeColor(value));
            if (color) doc.setTextColor(red, green, blue);
            else doc.setTextColor(0);
            doc.text(
              formatMark(value),
              x + COLUMN_WIDTH / 2,
              y + rowHeight / 2 + 1.2,
              {
                align: "center",
              },
            );
          }
        }
      }
      const bottom = top + pageStudents.length * rowHeight;
      doc.line(MARGIN, bottom, right, bottom);
      for (let index = 0; index <= pageColumns.length; index++) {
        const x = MARGIN + nameWidth + index * COLUMN_WIDTH;
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
