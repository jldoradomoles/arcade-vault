// Canvas lógico 640×560: cuadrícula de 16 columnas × 14 filas de 40 px
export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px por celda

export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0; // 5 bocas destino
export const ROW_RIVER_TOP = 1; // primer carril fluvial
export const ROW_RIVER_BOT = 6; // último carril fluvial
export const ROW_SAFE_MID = 7; // franja segura central
export const ROW_ROAD_TOP = 8; // primer carril de carretera
export const ROW_ROAD_BOT = 12; // último carril de carretera
export const ROW_START = 13; // fila de inicio (base inferior segura)

// Número de bocas destino en la fila 0; cada boca ocupa GOAL_W columnas
export const GOAL_COUNT = 5;
export const GOAL_W = 2; // columnas por boca; GOAL_COUNT * GOAL_W < COLS

// Mecánica
export const LIVES_START = 3;
export const ROUND_TIME_BASE = 15_000; // ms a nivel 1
export const ROUND_TIME_MIN = 5_000; // ms mínimo en niveles altos
export const ROUND_TIME_DEC = 0.85; // multiplicador por nivel
export const SPEED_INC = 1.15; // multiplicador de velocidad por nivel

// Puntuación
export const PTS_CELL = 10; // por cada celda nueva hacia arriba (solo primera vez)
export const PTS_GOAL = 50; // al ocupar una boca destino
export const PTS_ROUND = 200; // al completar la ronda (5 bocas)
export const PTS_TIME = 10; // por cada ms restante / 100  (×10 → usamos segundos enteros)

// Animación
export const JUMP_MS = 120; // duración de la animación de salto
export const MAX_DT_MS = 50; // tope de dt para evitar túnel

// Ciclo de inmersión de tortugas
export const TURTLE_VISIBLE_MS = 3_000;
export const TURTLE_SUBMERGE_MS = 1_500;

// Tipos
export type Direction = "up" | "down" | "left" | "right";

export interface Entity {
  col: number; // posición X en unidades de columna (puede ser fraccional en movimiento)
  width: number; // ancho en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean; // tortugas: true mientras están bajo el agua
  submergeTimer?: number; // ms acumulados en el ciclo visible/submerged
}

export interface Lane {
  row: number;
  speed: number; // celdas/segundo (puede ser negativo si dir === -1)
  dir: 1 | -1;
  entities: Entity[];
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number; // ms transcurridos desde que comenzó el salto
  targetCol: number;
  targetRow: number;
  highRow: number; // fila más alta alcanzada en la ronda actual (para PTS_CELL)
}
