export const W = 800,
  H = 600;
export const CX = W / 2,
  CY = H / 2;
export const CORE_RADIUS = 30,
  ARC_RADIUS = 120,
  ARC_SPAN = (50 * Math.PI) / 180,
  ARC_THICKNESS = 12,
  ARC_MAX_TURN = 9; // rad/s
export const BALL_RADIUS = 8,
  BALL_SPEED_BASE = 150,
  BALL_SPEED_PER_LEVEL = 10,
  RETURNED_SPEED_FACTOR = 1.6;
export const LIVES_START = 5;
export const SPAWN_START = 1.6,
  SPAWN_DECAY_PER_S = 1 / 40,
  SPAWN_MIN = 0.35,
  SECONDS_PER_LEVEL = 30;
export const COMBO_WINDOW = 1.5,
  COMBO_MAX = 6;
export const RETURN_SCORE = 10,
  KILL_SCORE = 50;
export const PULSE_RADIUS = 200,
  PULSE_PUSH = 260,
  PULSE_COOLDOWN = 8;
export const MAX_DT = 0.05;
export const MAX_SCORE = 10_000_000;

export type Phase = "playing" | "gameover";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  returned: boolean;
}
