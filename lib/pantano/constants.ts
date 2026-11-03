export const W = 800,
  H = 600;
export const CELL = 40,
  COLS = 20,
  ROWS = 15;
export const SHORE_TOP = 0,
  SHORE_BOTTOM = 14;
export const PLACE_TIME_BASE_MS = 20_000;
export const PLACE_TIME_DECREASE_MS = 1_000;
export const PLACE_TIME_MIN_MS = 8_000;
export const FROG_STEP_MS = 1_200;
export const FROGS_BASE = 3,
  FROGS_INCREMENT = 1,
  FROGS_MAX = 8;
export const SAVE_RATIO = 0.6;
export const LOG_LENGTH = 3;
export const TURTLE_SINK_MS = 10_000;
export const CURRENT_BASE_SPEED = 25;
export const CURRENT_PER_WAVE = 5;
export const FROG_SAVED_POINTS = 50;
export const UNUSED_PIECE_POINTS = 20;
export const ALL_SAVED_BONUS = 100;
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;

export type GamePhase = "placing" | "crossing" | "result" | "gameover";
export type PieceKind = "lilypad" | "log" | "turtle";
export type Orientation = "horizontal" | "vertical";

export interface Piece {
  kind: PieceKind;
  orientation: Orientation;
}

export interface PlacedPiece extends Piece {
  col: number;
  row: number;
  x: number;
  sinkTimer?: number;
}

export interface Frog {
  col: number;
  row: number;
  x: number;
  stepTimer: number;
  alive: boolean;
  saved: boolean;
}

export interface WaveInventory {
  lilypads: number;
  logs: number;
  turtles: number;
}

export interface CurrentRow {
  row: number;
  speed: number;
  diagonal?: boolean;
}
