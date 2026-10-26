import {
  CELL,
  COLS,
  FRUIT_SPRITES,
  ROWS,
  STEP_BASE_MS,
  STEP_DECREASE_MS,
  STEP_MIN_MS,
  type Cell,
  type Dir,
} from "./constants";

const FRUIT_MARGIN = 4; // px libres entre el sprite y el borde de su celda

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Milisegundos entre pasos: 140 en el nivel 1, −10 por nivel, nunca menos de 70
export function stepInterval(level: number): number {
  return Math.max(STEP_MIN_MS, STEP_BASE_MS - (level - 1) * STEP_DECREASE_MS);
}

export function isOpposite(a: Dir, b: Dir): boolean {
  return OPPOSITE[a] === b;
}

export function nextHead(head: Cell, dir: Dir): Cell {
  const { x, y } = DELTA[dir];
  return { x: head.x + x, y: head.y + y };
}

export function hitsWall(cell: Cell): boolean {
  return cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS;
}

// Quien llama decide qué segmentos cuentan: si la serpiente no crece en el paso,
// la cola se libera y se le pasa el cuerpo sin ella (snake.slice(0, -1))
export function hitsBody(snake: readonly Cell[], cell: Cell): boolean {
  return snake.some((s) => s.x === cell.x && s.y === cell.y);
}

// Celda libre al azar entre las que no ocupa la serpiente; null si no queda ninguna
export function pickFruitCell(
  snake: readonly Cell[],
  rand: () => number,
): Cell | null {
  const taken = new Set(snake.map((s) => s.y * COLS + s.x));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!taken.has(y * COLS + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rand() * free.length)];
}

// Sprite escalado por min(CELL / w, CELL / h) y centrado en la celda, sin deformarlo.
// Mientras la imagen no esté cargada se dibuja un círculo de respaldo.
export function drawFruitSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  sprite: number,
  cell: Cell,
  fallbackColor: string,
): void {
  const px = cell.x * CELL;
  const py = cell.y * CELL;
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = fallbackColor;
    ctx.beginPath();
    ctx.arc(
      px + CELL / 2,
      py + CELL / 2,
      CELL / 2 - FRUIT_MARGIN,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    return;
  }
  const { x, y, w, h } = FRUIT_SPRITES[sprite];
  const scale = Math.min((CELL - FRUIT_MARGIN) / w, (CELL - FRUIT_MARGIN) / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(
    img,
    x,
    y,
    w,
    h,
    px + (CELL - dw) / 2,
    py + (CELL - dh) / 2,
    dw,
    dh,
  );
}
