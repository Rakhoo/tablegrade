import { useRef, useState, type PointerEvent } from "react";
import { GradeIcon } from "../../components/GradeIcon";
import { CommentIcon } from "../../components/icons";
import type { GradeEntry, SeatedStudent, Trait } from "../../db";
import { getStudentLabel } from "../../lib/formatters";
import { getGradeDefinition } from "../../lib/grades";
import { GRID_COLUMNS, GRID_ROWS, SEAT_SIZE } from "../../lib/seating";
import { getTraitColor } from "../../lib/traits";
import { WARNING_LEVELS } from "../../lib/warnings";

type SeatGridProps = {
  students: SeatedStudent[];
  /** All traits in display order; their position decides the slot around the photo. */
  traits: Trait[];
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
  traits,
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
              traits={traits}
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
          {getStudentLabel(drag.student)}
        </div>
      )}
    </>
  );
}

type SeatProps = {
  student: SeatedStudent;
  entry?: GradeEntry;
  arranging: boolean;
  traits: Trait[];
  isDragged: boolean;
  onTap: SeatGridProps["onTap"];
};

/** A placed student with photo, name, warning color and badges for grade and comment. */
function Seat({
  student,
  entry,
  arranging,
  traits,
  isDragged,
  onTap,
}: SeatProps) {
  const grade = getGradeDefinition(entry?.grade);
  const warning = WARNING_LEVELS[entry?.warnings ?? 0];
  // Badges are framed in the tile color, so they blend into the tile's edge
  const tileColor = warning?.background ?? "var(--color-surface)";
  // Grades show as an inner ring in the symbol's color, warnings as a colored outer ring
  const rings = [
    grade && `inset 0 0 0 2px ${grade.color}66`,
    warning && `0 0 0 3px ${warning.accent}`,
    "var(--shadow-tile)",
  ];

  return (
    <div
      className={
        "seat relative m-1 flex flex-col items-center gap-0.5 rounded-2xl bg-surface p-1.5 text-center shadow-tile transition-[transform,opacity,background-color] active:scale-95 " +
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
      {/* Photo area: keeps its space without a photo, so all names stay on one level */}
      <div className="relative min-h-0 w-full flex-1">
        <div className="absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2">
          {student.image && (
            <img
              src={student.image}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full rounded-full object-cover"
            />
          )}
          {traits.map((trait, index) => {
            if (!student.traitIds.includes(trait.id)) return null;
            // Every trait has a fixed slot on the circle, so its position is recognizable too
            const angle =
              ((index / traits.length) * 360 - 90) * (Math.PI / 180);
            return (
              <span
                key={trait.id}
                title={trait.name}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white landscape:h-2 landscape:w-2"
                style={{
                  left: `${50 + 50 * Math.cos(angle)}%`,
                  top: `${50 + 50 * Math.sin(angle)}%`,
                  background: getTraitColor(trait.name),
                }}
              />
            );
          })}
        </div>
      </div>
      <span className="w-full shrink-0 truncate text-sm leading-tight font-semibold">
        {getStudentLabel(student)}
      </span>
      {warning && (
        <span
          className="absolute -top-1 -left-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold border-2 text-white shadow-tile"
          style={{
            background: warning.accent,
            borderColor: tileColor,
          }}
          title={warning.label}
        >
          {warning.mark}
        </span>
      )}
      {grade && (
        <span
          className="absolute -top-1 -right-1 z-10 flex rounded-full p-0.5 shadow-tile"
          style={{ background: tileColor }}
        >
          <GradeIcon grade={grade.key} size={24} />
        </span>
      )}
      {entry?.comment && (
        <span
          className="absolute -right-1 -bottom-1 z-10 flex rounded-full border-2 bg-surface p-0.5 text-brand-500 shadow-tile"
          style={{ borderColor: tileColor }}
          title={entry.comment}
        >
          <CommentIcon size={14} />
        </span>
      )}
    </div>
  );
}
