/**
 * Size of the classroom grid in half seats. A student occupies SEAT_SIZE × SEAT_SIZE cells,
 * so the room holds 10 × 10 students and seats can be offset by half a seat.
 */
export const GRID_COLUMNS = 20;
export const GRID_ROWS = 20;
export const SEAT_SIZE = 2;

/** Top left cell of a seat; `null` for students without a seat. */
export type Seat = { x: number | null; y: number | null };
type Position = { x: number; y: number };

/** Whether two placed students cover at least one common grid cell. */
export const seatsOverlap = (a: Seat, b: Seat) =>
  a.x != null &&
  b.x != null &&
  Math.abs(a.x - b.x) < SEAT_SIZE &&
  Math.abs(a.y! - b.y!) < SEAT_SIZE;

/**
 * Default room layout, described for the left half of the room (the right half is mirrored):
 * a column of seats along the side wall plus table rows of two seats next to it.
 */
const DEFAULT_LAYOUT = {
  wallX: 2,
  tableXs: [4, 6],
  /** Table rows sit half a seat lower than the neighboring wall seats. */
  tableYs: [1, 5, 9],
};

/** Mirrors a seat column to the right half of the room. */
const mirror = (x: number) => GRID_COLUMNS - SEAT_SIZE - x;

/**
 * Seat order of the default layout. Table rows are filled from front to back; for each one,
 * first the wall seats down to the first wall seat below the table row, then the table seats,
 * left half before right half. Wall seats behind the last table row follow, row by row.
 */
function defaultLayoutOrder(): Position[] {
  const { wallX, tableXs, tableYs } = DEFAULT_LAYOUT;
  const wallYs: number[] = [];
  for (let y = 0; y <= GRID_ROWS - SEAT_SIZE; y += SEAT_SIZE) wallYs.push(y);

  const order: Position[] = [];
  let nextWall = 0;
  for (const tableY of tableYs) {
    const until = wallYs.findIndex((y) => y >= tableY + SEAT_SIZE) + 1;
    const walls = wallYs.slice(nextWall, until);
    nextWall = until;
    for (const side of [(x: number) => x, mirror]) {
      order.push(...walls.map((y) => ({ x: side(wallX), y })));
      order.push(
        ...tableXs
          .map((x) => ({ x: side(x), y: tableY }))
          .sort((a, b) => a.x - b.x),
      );
    }
  }
  for (const y of wallYs.slice(nextWall)) {
    order.push({ x: wallX, y }, { x: mirror(wallX), y });
  }
  return order;
}

/** Preferred seats for new students: the default layout, then all whole seats row by row. */
const PREFERRED_SEATS: Position[] = defaultLayoutOrder();
for (let y = 0; y <= GRID_ROWS - SEAT_SIZE; y += SEAT_SIZE)
  for (let x = 0; x <= GRID_COLUMNS - SEAT_SIZE; x += SEAT_SIZE)
    PREFERRED_SEATS.push({ x, y });

/**
 * Yields free seats in preferred order and marks each yielded seat as taken.
 * @param occupied Seats already in use; the array is extended while iterating.
 */
export function* freeSeats(occupied: Seat[]) {
  for (const seat of PREFERRED_SEATS) {
    if (!occupied.some((taken) => seatsOverlap(taken, seat))) {
      occupied.push(seat);
      yield seat;
    }
  }
}
