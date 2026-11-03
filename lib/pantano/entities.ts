import {
  CELL,
  COLS,
  LOG_LENGTH,
  SAVE_RATIO,
  SHORE_BOTTOM,
  SHORE_TOP,
  TURTLE_SINK_MS,
  W,
  type CurrentRow,
  type Frog,
  type Piece,
  type PlacedPiece,
  type WaveInventory,
  CURRENT_BASE_SPEED,
  CURRENT_PER_WAVE,
  FROGS_BASE,
  FROGS_INCREMENT,
  FROGS_MAX,
} from "./constants";

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function generateInventory(wave: number): WaveInventory {
  return {
    lilypads: Math.min(3 + wave, 8),
    logs: Math.min(1 + Math.ceil(wave / 2), 4),
    turtles: Math.min(Math.ceil(wave / 2), 3),
  };
}

// ---------------------------------------------------------------------------
// Currents
// ---------------------------------------------------------------------------

export function generateCurrents(wave: number): CurrentRow[] {
  const speed = CURRENT_BASE_SPEED + (wave - 1) * CURRENT_PER_WAVE;
  const hasDiagonal = wave >= 4;
  const currents: CurrentRow[] = [];

  for (let row = SHORE_TOP + 1; row < SHORE_BOTTOM; row++) {
    const dir = row % 2 === 0 ? 1 : -1;
    currents.push({
      row,
      speed: speed * dir,
      diagonal: hasDiagonal && row % 3 === 0,
    });
  }
  return currents;
}

// ---------------------------------------------------------------------------
// Frogs per wave
// ---------------------------------------------------------------------------

export function frogsForWave(wave: number): number {
  return Math.min(FROGS_BASE + (wave - 1) * FROGS_INCREMENT, FROGS_MAX);
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

function getCells(piece: Piece, col: number, row: number): [number, number][] {
  if (piece.kind === "log") {
    if (piece.orientation === "horizontal") {
      return [
        [col, row],
        [col + 1, row],
        [col + 2, row],
      ];
    }
    return [
      [col, row],
      [col, row + 1],
      [col, row + 2],
    ];
  }
  return [[col, row]];
}

export function canPlace(
  grid: (PlacedPiece | null)[][],
  piece: Piece,
  col: number,
  row: number,
): boolean {
  if (row === SHORE_TOP || row === SHORE_BOTTOM) return false;
  const cells = getCells(piece, col, row);
  for (const [c, r] of cells) {
    if (r <= SHORE_TOP || r >= SHORE_BOTTOM) return false;
    if (c < 0 || c >= COLS) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

// Mutates grid — returns the new PlacedPiece.
export function placePiece(
  grid: (PlacedPiece | null)[][],
  piece: Piece,
  col: number,
  row: number,
): PlacedPiece {
  const placed: PlacedPiece = {
    ...piece,
    col,
    row,
    x: col * CELL,
    ...(piece.kind === "turtle" ? { sinkTimer: 0 } : {}),
  };
  for (const [c, r] of getCells(piece, col, row)) {
    grid[r][c] = placed;
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

export function movePieces(
  pieces: PlacedPiece[],
  currents: CurrentRow[],
  dt: number,
): PlacedPiece[] {
  return pieces.map((p) => {
    if (p.kind !== "log") return p;

    const current = currents.find((c) => c.row === p.row);
    if (!current) return p;

    // Diagonal flag amplifies speed slightly to make navigation harder.
    const factor = current.diagonal ? 1.15 : 1;
    const dx = (current.speed * factor * dt) / 1000;
    let newX = p.x + dx;

    const logW = p.orientation === "horizontal" ? LOG_LENGTH * CELL : CELL;

    // Wrap seamlessly at canvas edges.
    if (newX > W) newX = -logW;
    if (newX + logW < 0) newX = W;

    return { ...p, x: newX };
  });
}

export function sinkTurtles(pieces: PlacedPiece[], dt: number): PlacedPiece[] {
  return pieces
    .map((p) =>
      p.kind === "turtle" ? { ...p, sinkTimer: (p.sinkTimer ?? 0) + dt } : p,
    )
    .filter((p) => p.kind !== "turtle" || (p.sinkTimer ?? 0) < TURTLE_SINK_MS);
}

// ---------------------------------------------------------------------------
// Frog logic
// ---------------------------------------------------------------------------

function pieceCoversPosition(
  p: PlacedPiece,
  row: number,
  centerX: number,
): boolean {
  if (p.kind === "turtle") {
    if ((p.sinkTimer ?? 0) >= TURTLE_SINK_MS) return false;
  }

  if (p.kind === "log" && p.orientation === "vertical") {
    if (row < p.row || row > p.row + LOG_LENGTH - 1) return false;
    return centerX >= p.x && centerX < p.x + CELL;
  }

  if (p.row !== row) return false;

  const right =
    p.kind === "log" && p.orientation === "horizontal"
      ? p.x + LOG_LENGTH * CELL
      : p.x + CELL;

  return centerX >= p.x && centerX < right;
}

// Advances the frog one row. Call when frog.stepTimer >= FROG_STEP_MS.
export function stepFrog(frog: Frog, pieces: PlacedPiece[]): Frog {
  if (!frog.alive || frog.saved) return frog;

  const nextRow = frog.row - 1;

  if (nextRow <= SHORE_TOP) {
    return { ...frog, row: SHORE_TOP, saved: true, stepTimer: 0 };
  }

  const frogCenterX = frog.x + CELL / 2;
  const landing = pieces.find((p) =>
    pieceCoversPosition(p, nextRow, frogCenterX),
  );

  if (landing) {
    return { ...frog, row: nextRow, x: landing.x, stepTimer: 0 };
  }

  return { ...frog, alive: false, stepTimer: 0 };
}

export function frogReachedShore(frog: Frog): boolean {
  return frog.saved;
}

// ---------------------------------------------------------------------------
// Wave evaluation
// ---------------------------------------------------------------------------

export function evaluateWave(saved: number, total: number): { pass: boolean } {
  return { pass: saved >= Math.ceil(total * SAVE_RATIO) };
}
