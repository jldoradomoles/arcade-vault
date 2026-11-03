import {
  ARC_RADIUS,
  ARC_SPAN,
  ARC_THICKNESS,
  BALL_RADIUS,
  BALL_SPEED_BASE,
  BALL_SPEED_PER_LEVEL,
  CX,
  CY,
  PULSE_PUSH,
  PULSE_RADIUS,
  RETURNED_SPEED_FACTOR,
  SPAWN_DECAY_PER_S,
  SPAWN_MIN,
  SPAWN_START,
  type Ball,
} from "./constants";

export function spawnInterval(t: number): number {
  return Math.max(SPAWN_MIN, SPAWN_START - t * SPAWN_DECAY_PER_S);
}

export function ballSpeed(level: number): number {
  return BALL_SPEED_BASE + (level - 1) * BALL_SPEED_PER_LEVEL;
}

/** Rotates theta toward target by at most maxStep (rad), shortest path. */
export function turnToward(
  theta: number,
  target: number,
  maxStep: number,
): number {
  let diff = target - theta;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return target;
  return theta + Math.sign(diff) * maxStep;
}

/** Returns true if ball is touching the arc shield at angle theta. */
export function hitsArc(ball: Ball, theta: number): boolean {
  if (ball.returned) return false;
  const dx = ball.x - CX;
  const dy = ball.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (Math.abs(dist - ARC_RADIUS) > ARC_THICKNESS / 2 + BALL_RADIUS)
    return false;

  const ballAngle = Math.atan2(dy, dx);
  let diff = ballAngle - theta;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > ARC_SPAN / 2 + BALL_RADIUS / ARC_RADIUS) return false;

  // Ball must be moving inward (toward center)
  const radialVel = dx * ball.vx + dy * ball.vy;
  return radialVel < 0;
}

/**
 * Reflects ball off the arc and marks it as returned.
 * Outward normal at contact point is radial from center.
 */
export function reflect(ball: Ball): Ball {
  const dx = ball.x - CX;
  const dy = ball.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const dot = ball.vx * nx + ball.vy * ny;
  const speed =
    Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * RETURNED_SPEED_FACTOR;
  const rvx = ball.vx - 2 * dot * nx;
  const rvy = ball.vy - 2 * dot * ny;
  const rspeed = Math.sqrt(rvx * rvx + rvy * rvy) || 1;

  return {
    x: ball.x,
    y: ball.y,
    vx: (rvx / rspeed) * speed,
    vy: (rvy / rspeed) * speed,
    returned: true,
  };
}

/** Returns true if two balls overlap. */
export function ballsCollide(a: Ball, b: Ball): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < 2 * BALL_RADIUS * (2 * BALL_RADIUS);
}

/** Pushes hostile balls within PULSE_RADIUS away from center. */
export function applyPulse(balls: Ball[]): void {
  for (const ball of balls) {
    if (ball.returned) continue;
    const dx = ball.x - CX;
    const dy = ball.y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0 && dist <= PULSE_RADIUS) {
      ball.vx += (dx / dist) * PULSE_PUSH;
      ball.vy += (dy / dist) * PULSE_PUSH;
    }
  }
}
