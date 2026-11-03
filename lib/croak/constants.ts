export const W = 800,
  H = 600;
export const LILY_Y = 520;
export const LILY_POSITIONS = [100, 250, 400, 550, 700] as const;
export const LILY_R = 35;
export const FROG_R = 25;
export const TONGUE_SPEED = 600; // px/s
export const AIM_SPEED = 120; // grados/s
export const AIM_START = 90;
export const JUMP_DURATION_MS = 200;
export const FLY_POINTS = 10,
  DRAGONFLY_POINTS = 30,
  FIREFLY_POINTS = 50;
export const FLY_SPEED = 90,
  DRAGONFLY_SPEED = 140,
  FIREFLY_SPEED = 190;
export const FLY_R = 12,
  DRAGONFLY_R = 8,
  FIREFLY_R = 8;
export const MAX_COMBO = 5;
export const ROUND_DURATION_MS = 45_000;
export const SPEED_PER_ROUND = 15; // px/s extra por ronda
export const MAX_DT_MS = 50;
export const MAX_SCORE = 10_000_000;
export type Phase = "ready" | "playing" | "round_end" | "gameover";
export type BugKind = "fly" | "dragonfly" | "firefly";
export interface Bug {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BugKind;
  r: number;
  basePoints: number;
  alive: boolean;
  blink: number;
}
export interface Tongue {
  originX: number;
  originY: number;
  angle: number;
  extending: boolean;
  retracting: boolean;
  caught: Bug | null;
  length: number;
}
