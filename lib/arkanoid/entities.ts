import {
  BLOCK_COLORS,
  BLOCK_GAP,
  BLOCK_H,
  BLOCK_POINTS,
  BLOCK_W,
  COLS,
  GRID_TOP,
  LEVELS,
  MAX_BOUNCE_ANGLE,
  MIN_BLOCKS,
  TOUGH_HITS,
  TOUGH_POINTS,
  W,
  type Block,
} from "./constants";

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Posición = esquina superior izquierda, como en el original
export interface Ball {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  speed: number;
  stuck: boolean;
}

export type BlockHit = "none" | "damaged" | "destroyed";

// Mapa del nivel: huecos al azar en la mitad izquierda, espejados a la derecha
export function createBlocks(level: number): Block[] {
  const { gapChance, toughChance } = LEVELS[level - 1];
  const gridW = COLS * BLOCK_W + (COLS - 1) * BLOCK_GAP;
  const left = (W - gridW) / 2;
  let blocks: Block[];
  do {
    blocks = [];
    BLOCK_COLORS.forEach((color, row) => {
      for (let col = 0; col < COLS / 2; col++) {
        if (Math.random() < gapChance) continue;
        const tough = Math.random() < toughChance; // la celda espejada comparte tipo
        for (const c of [col, COLS - 1 - col]) {
          blocks.push({
            x: left + c * (BLOCK_W + BLOCK_GAP),
            y: GRID_TOP + row * (BLOCK_H + BLOCK_GAP),
            w: BLOCK_W,
            h: BLOCK_H,
            color: tough ? "gray" : color,
            alive: true,
            hp: tough ? TOUGH_HITS : 1,
            points: tough ? TOUGH_POINTS : BLOCK_POINTS,
          });
        }
      }
    });
  } while (blocks.length < MIN_BLOCKS);
  return blocks;
}

// Rebota la bola si baja y toca la paleta; devuelve true si hubo rebote
export function collideBallWithPaddle(ball: Ball, paddle: Paddle): boolean {
  if (ball.vy <= 0) return false;
  if (ball.x + ball.size < paddle.x || ball.x > paddle.x + paddle.w) {
    return false;
  }
  if (ball.y + ball.size < paddle.y || ball.y > paddle.y + paddle.h) {
    return false;
  }

  const offset = Math.max(
    -1,
    Math.min(
      1,
      (ball.x + ball.size / 2 - (paddle.x + paddle.w / 2)) / (paddle.w / 2),
    ),
  );
  const angle = offset * MAX_BOUNCE_ANGLE;

  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed; // siempre hacia arriba
  ball.y = paddle.y - ball.size; // justo encima de la paleta
  return true;
}

// Rebota por el eje de menor penetración y resta un golpe al bloque.
// Solo se procesa un bloque por llamada, como en el original.
export function collideBallWithBlocks(
  ball: Ball,
  blocks: Block[],
): { result: BlockHit; block: Block | null } {
  for (const blk of blocks) {
    if (!blk.alive) continue;
    if (ball.x + ball.size <= blk.x || ball.x >= blk.x + blk.w) continue;
    if (ball.y + ball.size <= blk.y || ball.y >= blk.y + blk.h) continue;

    const overlapX = Math.min(
      ball.x + ball.size - blk.x,
      blk.x + blk.w - ball.x,
    );
    const overlapY = Math.min(
      ball.y + ball.size - blk.y,
      blk.y + blk.h - ball.y,
    );

    if (overlapX < overlapY) {
      const fromLeft = ball.x + ball.size / 2 < blk.x + blk.w / 2;
      ball.x += fromLeft ? -overlapX : overlapX;
      ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    } else {
      const fromTop = ball.y + ball.size / 2 < blk.y + blk.h / 2;
      ball.y += fromTop ? -overlapY : overlapY;
      ball.vy = fromTop ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    }

    blk.hp--;
    if (blk.hp > 0) return { result: "damaged", block: blk };
    blk.alive = false;
    return { result: "destroyed", block: blk };
  }
  return { result: "none", block: null };
}
