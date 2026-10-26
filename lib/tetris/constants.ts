export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30; // px por celda

// Canvas lógico: tablero 300×600 a la izquierda y panel lateral 180×600
export const BOARD_W = COLS * BLOCK;
export const BOARD_H = ROWS * BLOCK;
export const W = 480;
export const H = 600;

export type Cell = number; // 0 vacío, 1–7 pieza, 9 comodín, 10–14 poder
export type PowerType = 10 | 11 | 12 | 13 | 14;

export interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
  power?: boolean;
}

// Índices de color: 1–7 piezas, 9 comodín, 10–14 poderes (mismos que game.js)
export const WILD = 9;
export const COLORS: ReadonlyArray<string | null> = [
  null,
  "#4dd0e1", // I
  "#ffd54f", // O
  "#ba68c8", // T
  "#81c784", // S
  "#e57373", // Z
  "#90caf9", // J
  "#ffb74d", // L
  "#a1887f", // 8: sin uso (la torre no se porta)
  "#e0e0e0", // 9: comodín
  "#ff7043", // 10: bomba
  "#fff176", // 11: rayo
  "#f06292", // 12: tinte
  "#9575cd", // 13: gravedad
  "#4fc3f7", // 14: congelar
];

// Los valores de cada matriz son su propio índice de color
export const PIECES: ReadonlyArray<ReadonlyArray<
  ReadonlyArray<number>
> | null> = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];
export const PIECE_TYPES = 7;

export const POWERS: Readonly<
  Record<PowerType, { name: string; icon: string }>
> = {
  10: { name: "Bomba", icon: "💣" },
  11: { name: "Rayo", icon: "⚡" },
  12: { name: "Tinte", icon: "🎨" },
  13: { name: "Gravedad", icon: "⬇" },
  14: { name: "Congelar", icon: "❄" },
};
export const POWER_TYPES = [10, 11, 12, 13, 14] as const;

export const LINE_SCORES = [0, 100, 300, 500, 800] as const; // por 0–4 líneas, × nivel
export const CELL_POINTS = 10; // puntos por celda eliminada con Bomba o Rayo
export const POWER_EVERY = 5; // un poder cada 5 líneas
export const FREEZE_MS = 5000;
export const TOAST_MS = 2000; // aviso del último poder usado
export const RESUME_LOCK_MS = 250; // ignora teclas justo tras reanudar
export const MAX_DT = 50; // ms: tope de dt tras pausa o cambio de pestaña
export const MAX_SCORE = 10_000_000; // límite de submitScore (SPEC 06)

// Estilo de la skin retro
export const GRID_COLOR = "#22222e";
export const SHINE_COLOR = "rgba(255,255,255,0.12)";
export const ICON_COLOR = "#000";
export const WILD_ICON_COLOR = "#555";
export const FREEZE_TINT = "rgba(79,195,247,0.12)";

export const dropIntervalFor = (level: number) =>
  Math.max(100, 1000 - (level - 1) * 90);
