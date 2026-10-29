import {
  CELL,
  COLS,
  GOAL_COUNT,
  GOAL_W,
  JUMP_MS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
  SPEED_INC,
  TURTLE_SUBMERGE_MS,
  TURTLE_VISIBLE_MS,
  W,
  type Entity,
  type Frog,
  type Lane,
} from "./constants";

// ── Configuración estática de carriles ──────────────────────────────────────

interface LaneDef {
  row: number;
  dir: 1 | -1;
  /** velocidad base en celdas/segundo a nivel 1 */
  baseSpeed: number;
  entities: Omit<Entity, "submerged" | "submergeTimer">[];
}

const LANE_DEFS: LaneDef[] = [
  // ── Carretera (filas 8–12, índice 0 = arriba) ────────────────────────────
  {
    row: 12,
    dir: 1,
    baseSpeed: 2.5,
    entities: [
      { col: 0, width: 2, type: "car" },
      { col: 5, width: 2, type: "car" },
      { col: 10, width: 2, type: "car" },
    ],
  },
  {
    row: 11,
    dir: -1,
    baseSpeed: 1.8,
    entities: [
      { col: 1, width: 3, type: "truck" },
      { col: 8, width: 3, type: "truck" },
    ],
  },
  {
    row: 10,
    dir: 1,
    baseSpeed: 3.5,
    entities: [
      { col: 0, width: 1, type: "car" },
      { col: 4, width: 1, type: "car" },
      { col: 8, width: 1, type: "car" },
      { col: 12, width: 1, type: "car" },
    ],
  },
  {
    row: 9,
    dir: -1,
    baseSpeed: 2.2,
    entities: [
      { col: 2, width: 2, type: "car" },
      { col: 7, width: 2, type: "car" },
      { col: 12, width: 2, type: "car" },
    ],
  },
  {
    row: 8,
    dir: 1,
    baseSpeed: 2.8,
    entities: [
      { col: 0, width: 3, type: "truck" },
      { col: 6, width: 1, type: "car" },
      { col: 10, width: 3, type: "truck" },
    ],
  },

  // ── Río (filas 1–6) ───────────────────────────────────────────────────────
  {
    row: 6,
    dir: 1,
    baseSpeed: 1.5,
    entities: [
      { col: 0, width: 3, type: "log" },
      { col: 6, width: 3, type: "log" },
      { col: 12, width: 3, type: "log" },
    ],
  },
  {
    row: 5,
    dir: -1,
    baseSpeed: 2.0,
    entities: [
      { col: 1, width: 2, type: "turtle" },
      { col: 5, width: 2, type: "turtle" },
      { col: 9, width: 2, type: "turtle" },
      { col: 13, width: 2, type: "turtle" },
    ],
  },
  {
    row: 4,
    dir: 1,
    baseSpeed: 2.5,
    entities: [
      { col: 0, width: 4, type: "log" },
      { col: 7, width: 4, type: "log" },
    ],
  },
  {
    row: 3,
    dir: -1,
    baseSpeed: 1.8,
    entities: [
      { col: 0, width: 3, type: "turtle" },
      { col: 7, width: 3, type: "turtle" },
    ],
  },
  {
    row: 2,
    dir: 1,
    baseSpeed: 3.0,
    entities: [
      { col: 1, width: 2, type: "log" },
      { col: 6, width: 2, type: "log" },
      { col: 11, width: 2, type: "log" },
    ],
  },
  {
    row: 1,
    dir: -1,
    baseSpeed: 2.2,
    entities: [
      { col: 0, width: 3, type: "log" },
      { col: 6, width: 2, type: "turtle" },
      { col: 11, width: 3, type: "log" },
    ],
  },
];

export function buildLanes(level: number): Lane[] {
  const mult = Math.pow(SPEED_INC, level - 1);
  return LANE_DEFS.map((def) => ({
    row: def.row,
    dir: def.dir,
    speed: def.baseSpeed * mult,
    entities: def.entities.map((e) => ({
      ...e,
      submerged: false,
      submergeTimer:
        e.type === "turtle" ? Math.random() * TURTLE_VISIBLE_MS : 0,
    })),
  }));
}

// ── Actualización de carriles ────────────────────────────────────────────────

export function updateLanes(lanes: Lane[], dt: number): void {
  const dtSec = dt / 1000;
  for (const lane of lanes) {
    const delta = lane.speed * lane.dir * dtSec;
    for (const entity of lane.entities) {
      entity.col += delta;
      // Cuando sale por un lado, reaparece por el opuesto (en unidades de columna)
      const colW = W / CELL; // = COLS
      if (lane.dir === 1 && entity.col > colW) {
        entity.col -= colW + entity.width;
      } else if (lane.dir === -1 && entity.col + entity.width < 0) {
        entity.col += colW + entity.width;
      }

      // Ciclo de inmersión de tortugas
      if (entity.type === "turtle") {
        entity.submergeTimer = (entity.submergeTimer ?? 0) + dt;
        const cycle = TURTLE_VISIBLE_MS + TURTLE_SUBMERGE_MS;
        if (entity.submergeTimer > cycle) entity.submergeTimer -= cycle;
        entity.submerged = entity.submergeTimer > TURTLE_VISIBLE_MS;
      }
    }
  }
}

// ── Colisión y soporte ───────────────────────────────────────────────────────

/** Devuelve true si la rana (no animando) choca con un vehículo de carretera. */
export function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  for (const lane of lanes) {
    if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) continue;
    if (lane.row !== frog.row) continue;
    for (const entity of lane.entities) {
      if (frog.col >= entity.col && frog.col < entity.col + entity.width) {
        return true;
      }
    }
  }
  return false;
}

/** Devuelve la entidad del río que soporta a la rana, o null si no hay soporte. */
export function getSupport(frog: Frog, lanes: Lane[]): Entity | null {
  for (const lane of lanes) {
    if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
    if (lane.row !== frog.row) continue;
    for (const entity of lane.entities) {
      if (frog.col >= entity.col && frog.col < entity.col + entity.width) {
        if (entity.type === "turtle" && entity.submerged) return null;
        return entity;
      }
    }
  }
  return null;
}

// ── Bocas destino ────────────────────────────────────────────────────────────

/**
 * Devuelve el índice de boca (0–4) correspondiente a la columna de la rana,
 * o null si la columna no pertenece a ninguna boca.
 * Las bocas ocupan las columnas: [1,2], [4,5], [7,8], [10,11], [13,14]
 * (centrando 5 bocas de 2 cols en los 16 cols disponibles con 1 col de margen).
 */
export function getGoalIndex(col: number): number | null {
  // Bocas: [1,2], [4,5], [7,8], [10,11], [13,14] — stride 3 (GOAL_W + 1 gap)
  for (let i = 0; i < GOAL_COUNT; i++) {
    const bocaCol = 1 + i * (GOAL_W + 1);
    if (col >= bocaCol && col < bocaCol + GOAL_W) return i;
  }
  return null;
}

// ── Posición inicial ─────────────────────────────────────────────────────────

export function startFrog(): Frog {
  return {
    col: Math.floor(COLS / 2),
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: Math.floor(COLS / 2),
    targetRow: ROW_START,
    highRow: ROW_START,
  };
}

// ── Desplazamiento de la rana por la corriente ───────────────────────────────

/** Aplica la velocidad del soporte a la rana (cuando está sobre un tronco/tortuga). */
export function applyCurrentDrift(
  frog: Frog,
  _support: Entity,
  lane: Lane,
  dt: number,
): void {
  const dtSec = dt / 1000;
  frog.col += lane.speed * lane.dir * dtSec;
  // Matar si sale por los bordes
  frog.col = Math.max(-0.5, Math.min(frog.col, COLS - 0.5));
}

// ── Interpolación visual del salto ───────────────────────────────────────────

/** Devuelve la posición visual interpolada de la rana (en celdas) durante el salto. */
export function interpolateFrog(frog: Frog): { col: number; row: number } {
  if (!frog.animating) return { col: frog.col, row: frog.row };
  const t = Math.min(frog.animT / JUMP_MS, 1);
  return {
    col: frog.col + (frog.targetCol - frog.col) * t,
    row: frog.row + (frog.targetRow - frog.row) * t,
  };
}

// ── Coordenada de píxel de cada boca para el dibujo ─────────────────────────

export interface GoalRect {
  x: number; // px
  y: number; // px
  w: number; // px
  h: number; // px
}

export function goalRects(): GoalRect[] {
  const rects: GoalRect[] = [];
  for (let i = 0; i < GOAL_COUNT; i++) {
    const startCol = 1 + i * (GOAL_W + 1); // stride 3: bocas en cols 1,4,7,10,13
    rects.push({
      x: startCol * CELL,
      y: 0,
      w: GOAL_W * CELL,
      h: CELL,
    });
  }
  return rects;
}
