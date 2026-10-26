// Canvas lógico, igual que el original (800×600)
export const W = 800;
export const H = 600;

export const BLOCK_COLORS = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
] as const; // fila 0..5

export const COLS = 10;
export const BLOCK_W = 64;
export const BLOCK_H = 32;
export const BLOCK_GAP = 4; // rejilla = 10*64 + 9*4 = 676 px, centrada (margen 62 px)
export const GRID_TOP = 80;
export const BLOCK_POINTS = 10;
export const TOUGH_POINTS = 30;
export const TOUGH_HITS = 2;
export const DAMAGED_ALPHA = 0.6; // opacidad del bloque gris tras el primer golpe
export const MIN_BLOCKS = 20; // mínimo de bloques vivos por mapa generado

export const LEVELS = [
  { speed: 380, gapChance: 0.1, toughChance: 0 },
  { speed: 420, gapChance: 0.2, toughChance: 0.15 },
  { speed: 460, gapChance: 0.25, toughChance: 0.3 },
] as const;

export const PADDLE_W = 120;
export const PADDLE_H = 14;
export const PADDLE_Y = 560;
export const PADDLE_START_X = 340;
export const PADDLE_SPEED = 600;
export const BALL_SIZE = 16;
export const LIVES = 3;

export const MAX_DT = 1 / 30; // el del original; más estricto que el 0,05 de SPEC 05
export const LAUNCH_SPREAD = (15 * Math.PI) / 180; // desviación máxima respecto a la vertical
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // en los bordes de la paleta
export const EXPLOSION_DURATION = 150; // ms
export const MAX_SCORE = 10_000_000; // límite de submitScore (SPEC 06)

export const ASSETS = {
  sprites: "/games/arkanoid/spritesheet-breakout.png",
  bounce: "/games/arkanoid/ball-bounce.mp3",
  break: "/games/arkanoid/break-sound.mp3",
} as const;

export type BlockColor = (typeof BLOCK_COLORS)[number] | "gray";
export type Phase = "ready" | "playing" | "gameover";

export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
  hp: number;
  points: number;
}

export interface Explosion {
  x: number;
  y: number;
  color: BlockColor;
  elapsed: number; // ms
}

export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Coordenadas del spritesheet (las de assets/spritesheet.js del original)
const frame = (sx: number, sy: number, sw = 32, sh = 16): Frame => ({
  sx,
  sy,
  sw,
  sh,
});

export const SPRITES = {
  paddle: frame(32, 112, 162, 14),
  ball: frame(32, 32, 16, 16),
  blocks: {
    gray: frame(32, 288),
    red: frame(32, 176),
    yellow: frame(32, 240),
    cyan: frame(32, 192),
    magenta: frame(32, 224),
    hotpink: frame(32, 256),
    green: frame(32, 208),
  },
} as const satisfies {
  paddle: Frame;
  ball: Frame;
  blocks: Record<BlockColor, Frame>;
};

// 4 frames por color en x = 256, 288, 320, 352; el gris reutiliza los del rojo
const explosion = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => frame(sx, sy));

export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: explosion(176),
  cyan: explosion(192),
  green: explosion(208),
  magenta: explosion(224),
  yellow: explosion(240),
  hotpink: explosion(256),
  gray: explosion(176),
};
