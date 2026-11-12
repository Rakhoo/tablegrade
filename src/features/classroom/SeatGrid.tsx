import { useRef, useState, type PointerEvent } from "react";
import { FitText } from "../../components/FitText";
import { GradeIcon } from "../../components/GradeIcon";
import { MarkBadge } from "../../components/MarkBadge";
import { SuggestedGradeIcon } from "../../components/SuggestedGradeIcon";
import { CommentIcon } from "../../components/icons";
import type { Duty, GradeEntry, SeatedStudent, Trait } from "../../db";
import { DutyBadge } from "../../components/dutySymbols";
import { getCommentPreview, getStudentLabel } from "../../lib/formatters";
import { getGradeColor } from "../../lib/grades";
import {
  getZoomedArea,
  GRID_COLUMNS,
  GRID_ROWS,
  SEAT_SIZE,
} from "../../lib/seating";
import { WARNING_LEVELS } from "../../lib/warnings";

type SeatGridProps = {
  students: SeatedStudent[];
  /** All traits in display order; their position decides the slot around the photo. */
  traits: Trait[];
  /** Duties shown on the seats; empty while they are hidden. */
  duties: Duty[];
  /** Whether the seats show the students' photos. */
  showPhotos: boolean;
  /** Grade entries of the current lesson, by student id. */
  grades: Map<number, GradeEntry>;
  /** Suggested symbols for students without one, by student id. */
  suggestions: Map<number, number>;
  /** Arrange mode: students are dragged instead of tapped. */
  arranging: boolean;
  /** Comment mode: comments show their first words in a speech bubble. */
  showComments: boolean;
  /** Students shown grayed out, e.g. already marked in a retake's exam. */
  dimmed?: Set<number>;
  /** Enlarges the smallest part of the room holding all seated students (not while arranging). */
  zoomed?: boolean;
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
  duties,
  showPhotos,
  grades,
  suggestions,
  arranging,
  showComments,
  zoomed = false,
  dimmed,
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

  const seated = students.filter(
    (student) => student.x != null && student.y != null,
  );
  const zoomedArea =
    zoomed && !arranging ? getZoomedArea(seated as Position[]) : null;
  const percent = (share: number) => `${share * 100}%`;

  return (
    <>
      <div className="relative h-full overflow-hidden">
        <div
          ref={gridRef}
          className={
            "seat-grid absolute grid transition-[left,top,width,height] duration-300 " +
            (arranging ? "arranging touch-none" : "")
          }
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            left: percent(zoomedArea?.left ?? 0),
            top: percent(zoomedArea?.top ?? 0),
            width: percent(zoomedArea?.width ?? 1),
            height: percent(zoomedArea?.height ?? 1),
          }}
          {...dragHandlers}
        >
          {seated.map((student) => (
            <Seat
              key={student.id}
              student={student}
              entry={grades.get(student.id)}
              suggestion={suggestions.get(student.id)}
              arranging={arranging}
              showComment={showComments}
              traits={traits}
              duty={duties.find((duty) => duty.id == student.dutyId)}
              showPhoto={showPhotos}
              isDragged={drag?.student.id == student.id}
              isDimmed={!!dimmed?.has(student.id)}
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
  suggestion?: number;
  arranging: boolean;
  showComment: boolean;
  traits: Trait[];
  duty?: Duty;
  showPhoto: boolean;
  isDragged: boolean;
  isDimmed: boolean;
  onTap: SeatGridProps["onTap"];
};

/** A placed student with photo, name, warning color and badges for duty, grade and comment. */
function Seat({
  student,
  entry,
  suggestion,
  arranging,
  showComment,
  traits,
  duty,
  showPhoto,
  isDragged,
  isDimmed,
  onTap,
}: SeatProps) {
  const grade = entry?.grade ?? null;
  const hasSymbol = grade != null || !!entry?.absent;
  const warning = WARNING_LEVELS[entry?.warnings ?? 0];
  // Badges are framed in the tile color, so they blend into the tile's edge
  const tileColor = warning?.background ?? "var(--color-surface)";
  // Grades show as an inner ring in the symbol's color, warnings as a colored outer ring
  const rings = [
    grade != null && `inset 0 0 0 2px ${getGradeColor(grade)}66`,
    warning && `0 0 0 3px ${warning.accent}`,
    "var(--shadow-tile)",
  ];

  return (
    <div
      className={
        "seat relative m-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface p-1.5 text-center shadow-tile transition-[transform,opacity,background-color] active:scale-95 " +
        (arranging ? "cursor-grab " : "") +
        (isDragged ? "opacity-30" : isDimmed ? "opacity-40 grayscale" : "")
      }
      style={{
        ...seatArea(student as Position),
        backgroundColor: warning?.background,
        boxShadow: rings.filter(Boolean).join(", "),
      }}
      data-student={student.id}
      onClick={arranging ? undefined : () => onTap(student)}
    >
      {/* Photo area: keeps its space without a photo, so all names stay on one level. With
          photos hidden it only holds the trait dots behind the name, which moves to the center */}
      <div
        className={
          (showPhoto
            ? "relative min-h-0 w-full flex-1"
            : "absolute inset-1.5") + " [container-type:size]"
        }
      >
        {/* The largest square fitting the area, so the photo never leaves the seat */}
        <div className="absolute inset-0 m-auto size-[min(100cqw,100cqh)]">
          {showPhoto && student.image && (
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
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 ring-1 ring-white landscape:h-2 landscape:w-2"
                style={{
                  left: `${50 + 50 * Math.cos(angle)}%`,
                  top: `${50 + 50 * Math.sin(angle)}%`,
                  background: trait.color,
                }}
              />
            );
          })}
        </div>
      </div>
      <FitText
        text={getStudentLabel(student)}
        className="w-full shrink-0 font-semibold"
      />
      {(duty || warning) && (
        // Duty and warning side by side, slightly overlapping with the duty in front
        <span className="absolute -top-1 -left-1 z-10 flex">
          {duty && (
            <DutyBadge
              duty={duty}
              size={24}
              className="relative z-1 border-2 shadow-tile"
              style={{ borderColor: tileColor }}
            />
          )}
          {warning && (
            <span
              className={
                "flex h-6 min-w-6 items-center justify-center rounded-full border-2 px-1 text-xs font-bold text-white shadow-tile " +
                (duty ? "-ml-1.5" : "")
              }
              style={{
                background: warning.accent,
                borderColor: tileColor,
              }}
              title={warning.label}
            >
              {warning.mark}
            </span>
          )}
        </span>
      )}
      {hasSymbol && (
        <span
          className="absolute -top-1 -right-1 z-10 flex rounded-full p-0.5 shadow-tile"
          style={{ background: tileColor }}
        >
          <GradeIcon grade={grade ?? undefined} size={24} />
        </span>
      )}
      {!hasSymbol && suggestion != null && (
        <span
          className="absolute -top-1 -right-1 z-10 flex rounded-full"
          style={{ background: tileColor }}
        >
          <SuggestedGradeIcon grade={suggestion} size={28} />
        </span>
      )}
      {(entry?.mark != null || entry?.projectMark != null) && (
        // Exam or retake mark and project mark side by side
        <span className="absolute -bottom-1 -left-1 z-10 flex gap-0.5">
          {entry.mark != null && (
            <MarkBadge mark={entry.mark} className="border-2 shadow-tile" />
          )}
          {entry.projectMark != null && (
            <MarkBadge
              mark={entry.projectMark}
              className="border-2 shadow-tile"
            />
          )}
        </span>
      )}
      {entry?.comment && showComment && (
        <span className="absolute inset-x-1 top-1 z-20 rounded-xl bg-surface px-1.5 py-1 text-left text-[11px] leading-tight font-medium text-ink shadow-tile ring-1 ring-brand-200">
          <span className="line-clamp-3">
            {getCommentPreview(entry.comment)}
          </span>
          <span className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-surface" />
        </span>
      )}
      {entry?.comment && !showComment && (
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
