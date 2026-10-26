import {
  COLS,
  PIECES,
  PIECE_TYPES,
  POWER_TYPES,
  ROWS,
  WILD,
  type Cell,
  type Piece,
  type PowerType,
} from "./constants";

export type Board = Cell[][];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
}

// Con `power` devuelve el bloque único de un poder aleatorio
export function randomPiece(power = false): Piece {
  if (power) {
    const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    return {
      type,
      power: true,
      shape: [[type]],
      x: Math.floor(COLS / 2),
      y: 0,
    };
  }
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function collide(
  board: Board,
  shape: number[][],
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

const KICKS = [0, -1, 1, -2, 2];

// Rota la pieza con wall kicks; devuelve false si ningún desplazamiento cabe
export function tryRotate(board: Board, piece: Piece): boolean {
  const rotated = rotateCW(piece.shape);
  for (const kick of KICKS) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return true;
    }
  }
  return false;
}

export function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
}

export function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

// Una fila se limpia si sus huecos no superan sus comodines; devuelve cuántas
export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    const empty = board[r].filter((v) => v === 0).length;
    const wild = board[r].filter((v) => v === WILD).length;
    if (empty <= wild) {
      board.splice(r, 1);
      board.unshift(new Array<Cell>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// Hace caer los bloques de la columna para que no queden huecos debajo
export function compactColumn(board: Board, c: number): void {
  const col: Cell[] = [];
  for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
  for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() ?? 0;
}

// Aplica el poder sobre el tablero y devuelve las celdas eliminadas
// (Bomba, Rayo y Tinte); puntuar y Congelar son cosa del motor
export function applyPower(
  board: Board,
  type: PowerType,
  x: number,
  y: number,
): number {
  let removed = 0;
  const clear = (r: number, c: number) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return;
    board[r][c] = 0;
    removed++;
  };
  switch (type) {
    case 10: // Bomba: área 3×3
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) clear(y + dr, x + dc);
      for (let dc = -1; dc <= 1; dc++)
        if (x + dc >= 0 && x + dc < COLS) compactColumn(board, x + dc);
      break;
    case 11: // Rayo: fila o columna completa
      if (Math.random() < 0.5) {
        for (let c = 0; c < COLS; c++) clear(y, c);
        // la fila queda vacía: lo de arriba desciende una posición
        board.splice(y, 1);
        board.unshift(new Array<Cell>(COLS).fill(0));
      } else for (let r = 0; r < ROWS; r++) clear(r, x);
      break;
    case 12: {
      // Tinte: el color bajo el bloque (o el más común) pasa a comodín
      let target = y + 1 < ROWS ? board[y + 1][x] : 0;
      if (!target || target === WILD) {
        const counts: Record<number, number> = {};
        for (const row of board)
          for (const v of row)
            if (v && v !== WILD) counts[v] = (counts[v] ?? 0) + 1;
        const best = Object.keys(counts)
          .map(Number)
          .sort((a, b) => counts[b] - counts[a])[0];
        target = best ?? 0;
      }
      if (target)
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === target) {
              board[r][c] = WILD;
              removed++;
            }
      break;
    }
    case 13: // Gravedad: compacta cada columna
      for (let c = 0; c < COLS; c++) compactColumn(board, c);
      break;
    case 14: // Congelar: sin efecto en el tablero
      break;
  }
  return removed;
}
