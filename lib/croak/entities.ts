import {
  W,
  H,
  LILY_Y,
  TONGUE_SPEED,
  SPEED_PER_ROUND,
  FLY_POINTS,
  DRAGONFLY_POINTS,
  FIREFLY_POINTS,
  FLY_SPEED,
  DRAGONFLY_SPEED,
  FIREFLY_SPEED,
  FLY_R,
  DRAGONFLY_R,
  FIREFLY_R,
  type Bug,
  type BugKind,
  type Tongue,
} from "./constants";

export function spawnBug(round: number): Bug {
  const r = Math.random();
  let kind: BugKind;
  let basePoints: number;
  let bugR: number;
  let baseSpeed: number;

  if (r < 0.5) {
    kind = "fly";
    basePoints = FLY_POINTS;
    bugR = FLY_R;
    baseSpeed = FLY_SPEED;
  } else if (r < 0.8) {
    kind = "dragonfly";
    basePoints = DRAGONFLY_POINTS;
    bugR = DRAGONFLY_R;
    baseSpeed = DRAGONFLY_SPEED;
  } else {
    kind = "firefly";
    basePoints = FIREFLY_POINTS;
    bugR = FIREFLY_R;
    baseSpeed = FIREFLY_SPEED;
  }

  const speed = baseSpeed + SPEED_PER_ROUND * (round - 1);
  const edge = Math.floor(Math.random() * 3); // 0=top, 1=left, 2=right
  let x: number, y: number, vx: number, vy: number;

  if (edge === 0) {
    x = Math.random() * W;
    y = -bugR;
    const spread = ((Math.random() - 0.5) * Math.PI) / 3;
    vx = speed * Math.sin(spread);
    vy = speed * Math.cos(spread);
  } else if (edge === 1) {
    x = -bugR;
    y = 20 + Math.random() * (H * 0.65);
    const spread = ((Math.random() - 0.5) * Math.PI) / 3;
    vx = speed * Math.cos(spread);
    vy = speed * Math.sin(spread);
  } else {
    x = W + bugR;
    y = 20 + Math.random() * (H * 0.65);
    const spread = ((Math.random() - 0.5) * Math.PI) / 3;
    vx = -speed * Math.cos(spread);
    vy = speed * Math.sin(spread);
  }

  return { x, y, vx, vy, kind, r: bugR, basePoints, alive: true, blink: 0 };
}

export function moveBugs(bugs: Bug[], dt: number): void {
  const dtS = dt / 1000;
  for (const bug of bugs) {
    if (!bug.alive) continue;
    bug.x += bug.vx * dtS;
    bug.y += bug.vy * dtS;
    if (bug.blink > 0) bug.blink = Math.max(0, bug.blink - dt);
  }
}

export function extendTongue(tongue: Tongue, dt: number): void {
  tongue.length += TONGUE_SPEED * (dt / 1000);
}

export function retractTongue(tongue: Tongue, dt: number): void {
  tongue.length -= TONGUE_SPEED * (dt / 1000);
  if (tongue.length < 0) tongue.length = 0;
}

export function tongueHitsBug(tongue: Tongue, bugs: Bug[]): Bug | null {
  const angleRad = (tongue.angle * Math.PI) / 180;
  const tipX = tongue.originX + tongue.length * Math.cos(angleRad);
  const tipY = tongue.originY - tongue.length * Math.sin(angleRad);

  const dx = tipX - tongue.originX;
  const dy = tipY - tongue.originY;
  const lenSq = dx * dx + dy * dy;

  for (const bug of bugs) {
    if (!bug.alive) continue;
    const t =
      lenSq > 0
        ? Math.max(
            0,
            Math.min(
              1,
              ((bug.x - tongue.originX) * dx + (bug.y - tongue.originY) * dy) /
                lenSq,
            ),
          )
        : 0;
    const closestX = tongue.originX + t * dx;
    const closestY = tongue.originY + t * dy;
    if (Math.hypot(bug.x - closestX, bug.y - closestY) < bug.r + 4) {
      return bug;
    }
  }
  return null;
}

export function bugEscaped(bug: Bug): boolean {
  const margin = bug.r * 4;
  return (
    bug.x < -margin ||
    bug.x > W + margin ||
    bug.y < -margin ||
    bug.y > H + margin
  );
}

export function jumpArc(
  fromX: number,
  toX: number,
  progress: number,
): { x: number; y: number } {
  const x = fromX + (toX - fromX) * progress;
  const y = LILY_Y - 80 * 4 * progress * (1 - progress);
  return { x, y };
}
