import { useRef, useState, type PointerEvent } from "react";
import { GradeIcon } from "../../components/GradeIcon";
import { CommentIcon } from "../../components/icons";
import type { GradeEntry, SeatedStudent } from "../../db";
import { getGradeDefinition } from "../../lib/grades";
import { GRID_COLUMNS, GRID_ROWS, SEAT_SIZE } from "../../lib/seating";
import { WARNING_LEVELS } from "../../lib/warnings";

type SeatGridProps = {
  students: SeatedStudent[];
  /** Grade entries of the current lesson, by student id. */
  grades: Map<number, GradeEntry>;
  /** Arrange mode: students are dragged instead of tapped. */
  arranging: boolean;
  /** Called when a student is tapped outside of arrange mode. */
  onTap: (student: SeatedStudent) => void;
  onMove: (student: SeatedStudent, x: number, y: number) => void;
};

type Position = { x: number; y: number };
type Drag = { student: SeatedStudent; pointer: Position; target: Position };

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/** Grid placement of a seat whose top left cell is at `(x, y)`. */
const seatArea = ({ x, y }: Position) => ({
  gridColumn: `${x + 1} / span ${SEAT_SIZE}`,
  gridRow: `${y + 1} / span ${SEAT_SIZE}`,
});

/**
 * Classroom seating plan on a grid of half seats, each student covers 2 × 2 cells.
 * Outside of arrange mode a tap is passed to `onTap`; in arrange mode students are dragged
 * to any whole or half position (swapping with an overlapped student).
 */
export function SeatGrid({
  students,
  grades,
  arranging,
  onTap,
  onMove,
}: SeatGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  /** Top left cell of a seat centered below the pointer, kept inside the grid. */
  const targetAt = (clientX: number, clientY: number): Position => {
    const rect = gridRef.current!.getBoundingClientRect();
    const offset = SEAT_SIZE / 2;
    return {
      x: clamp(
        Math.round(
          ((clientX - rect.left) / rect.width) * GRID_COLUMNS - offset,
        ),
        GRID_COLUMNS - SEAT_SIZE,
      ),
      y: clamp(
        Math.round(((clientY - rect.top) / rect.height) * GRID_ROWS - offset),
        GRID_ROWS - SEAT_SIZE,
      ),
    };
  };

  const dragHandlers = arranging && {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      const seat = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-student]",
      );
      const student = students.find(
        (s) => s.id == Number(seat?.dataset.student),
      );
      if (!student) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const pointer = { x: event.clientX, y: event.clientY };
      setDrag({ student, pointer, target: targetAt(pointer.x, pointer.y) });
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!drag) return;
      const pointer = { x: event.clientX, y: event.clientY };
      setDrag({ ...drag, pointer, target: targetAt(pointer.x, pointer.y) });
    },
    onPointerUp: () => {
      const { student, target } = drag ?? {};
      if (student && target && (target.x != student.x || target.y != student.y))
        onMove(student, target.x, target.y);
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
  };

  return (
    <>
      <div
        ref={gridRef}
        className={
          "seat-grid grid h-full " + (arranging ? "arranging touch-none" : "")
        }
        style={{
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
        }}
        {...dragHandlers}
      >
        {students
          .filter((student) => student.x != null && student.y != null)
          .map((student) => (
            <Seat
              key={student.id}
              student={student}
              entry={grades.get(student.id)}
              arranging={arranging}
              isDragged={drag?.student.id == student.id}
              onTap={onTap}
            />
          ))}
        {drag && (
          <div
            className="pointer-events-none m-1 rounded-2xl border-2 border-dashed border-white bg-white/25"
            style={seatArea(drag.target)}
          />
        )}
      </div>
      {drag && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rotate-2 rounded-2xl bg-surface px-4 py-2.5 font-semibold shadow-card ring-2 ring-brand-300"
          style={{ left: drag.pointer.x, top: drag.pointer.y }}
        >
          {drag.student.nickname || drag.student.name}
        </div>
      )}
    </>
  );
}

type SeatProps = {
  student: SeatedStudent;
  entry?: GradeEntry;
  arranging: boolean;
  isDragged: boolean;
  onTap: SeatGridProps["onTap"];
};

/** A placed student with name, grade symbol, comment marker and warning color. */
function Seat({ student, entry, arranging, isDragged, onTap }: SeatProps) {
  const grade = getGradeDefinition(entry?.grade);
  const warning = WARNING_LEVELS[entry?.warnings ?? 0];
  // Grades show as an inner ring in the symbol's color, warnings as a colored outer ring
  const rings = [
    grade && `inset 0 0 0 2px ${grade.color}66`,
    warning && `0 0 0 3px ${warning.accent}`,
    "var(--shadow-tile)",
  ];

  return (
    <div
      className={
        "seat relative m-1 flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface p-1.5 text-center shadow-tile transition-[transform,opacity,background-color] active:scale-95 " +
        (arranging ? "cursor-grab " : "") +
        (isDragged ? "opacity-30" : "")
      }
      style={{
        ...seatArea(student as Position),
        backgroundColor: warning?.background,
        boxShadow: rings.filter(Boolean).join(", "),
      }}
      data-student={student.id}
      onClick={arranging ? undefined : () => onTap(student)}
    >
      <span className="line-clamp-2 text-sm leading-tight font-semibold break-words">
        {student.nickname || student.name}
      </span>
      {grade && <GradeIcon grade={grade.key} size={30} />}
      {warning && (
        <span
          className="absolute top-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
          style={{ background: warning.accent }}
          title={warning.label}
        >
          {warning.mark}
        </span>
      )}
      {entry?.comment && (
        <span
          className="absolute top-1.5 right-1.5 text-brand-500"
          title={entry.comment}
        >
          <CommentIcon size={14} />
        </span>
      )}
    </div>
  );
}
