import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import { DEFAULT_SKIN, type SkinId } from "@/lib/game-types";
import {
  CELL,
  COLS,
  GOAL_COUNT,
  H,
  JUMP_MS,
  LIVES_START,
  MAX_DT_MS,
  PTS_CELL,
  PTS_GOAL,
  PTS_ROUND,
  PTS_TIME,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  ROUND_TIME_BASE,
  ROUND_TIME_DEC,
  ROUND_TIME_MIN,
  W,
  type Direction,
  type Entity,
  type Frog,
  type Lane,
} from "./constants";
import {
  applyCurrentDrift,
  buildLanes,
  checkRoadCollision,
  getGoalIndex,
  getSupport,
  goalRects,
  interpolateFrog,
  startFrog,
  updateLanes,
} from "./entities";

// ── Paleta por defecto ──────────────────────────────────────────────────────

interface Palette {
  bg: string;
  road: string;
  river: string;
  safe: string;
  goalEmpty: string;
  goalOccupied: string;
  car: string[];
  truck: string;
  log: string;
  turtleVisible: string;
  turtleSubmerged: string;
  frogBody: string;
  frogEye: string;
  hudText: string;
  timerFull: string;
  timerMid: string;
  timerLow: string;
}

const DEFAULT_PALETTE: Palette = {
  bg: "#111",
  road: "#222",
  river: "#0a1a3a",
  safe: "#1a3a1a",
  goalEmpty: "#0d2a0d",
  goalOccupied: "#1a5c1a",
  car: ["#e05050", "#e0b050", "#5090e0"],
  truck: "#707070",
  log: "#8b4513",
  turtleVisible: "#2d8a2d",
  turtleSubmerged: "rgba(45,138,45,0.3)",
  frogBody: "#44cc44",
  frogEye: "#ffffff",
  hudText: "#ffffff",
  timerFull: "#44cc44",
  timerMid: "#cccc44",
  timerLow: "#cc4444",
};

const SKINS: Record<SkinId, Palette> = {
  classic: DEFAULT_PALETTE,
  neon: {
    ...DEFAULT_PALETTE,
    road: "#180018",
    river: "#001830",
    safe: "#001800",
    goalEmpty: "#001800",
    goalOccupied: "#004400",
    car: ["#ff2060", "#ffcc00", "#00ccff"],
    truck: "#cc44ff",
    log: "#cc6600",
    turtleVisible: "#00ff88",
    turtleSubmerged: "rgba(0,255,136,0.2)",
    frogBody: "#00ff88",
    hudText: "#00ffcc",
  },
  retro: {
    ...DEFAULT_PALETTE,
    bg: "#0f0f0f",
    road: "#1a1208",
    river: "#081018",
    safe: "#0a1a08",
    car: ["#cc3030", "#cc9030", "#3070cc"],
    truck: "#555",
    log: "#7a3a10",
    turtleVisible: "#267026",
    frogBody: "#3ab03a",
    hudText: "#c8c88a",
  },
};

// ── Constantes internas ─────────────────────────────────────────────────────

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

type Phase = "ready" | "playing" | "dead" | "gameover";

const DEAD_PAUSE_MS = 800; // ms de pausa tras morir antes de reaparecer/gameover

// ── Motor ──────────────────────────────────────────────────────────────────

export class FroggerEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private palette: Palette;

  private phase: Phase = "ready";
  private lives = LIVES_START;
  private score = 0;
  private level = 1;

  private frog: Frog = startFrog();
  private lanes: Lane[] = [];
  private goals: boolean[] = Array(GOAL_COUNT).fill(false);
  private roundTimer = ROUND_TIME_BASE; // ms restantes en la ronda
  private pendingDir: Direction | null = null;

  private deadTimer = 0;

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private paused = false;

  private lastStats: GameStats | null = null;
  private gameOverNotified = false;

  // Para PTS_CELL: columna central de origen, para evitar contar retrocesos
  private prevHighRow = ROW_START;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
    options?: { skin?: SkinId },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.palette = SKINS[options?.skin ?? DEFAULT_SKIN] ?? DEFAULT_PALETTE;
    canvas.width = W;
    canvas.height = H;
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.resetGame();
    window.addEventListener("keydown", this.onKeyDown);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.lastTime = null;
  }

  finish() {
    if (!this.running || this.phase === "gameover") return;
    this.endGame();
  }

  destroy() {
    this.destroyed = true;
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener("keydown", this.onKeyDown);
  }

  // ── Inicialización ─────────────────────────────────────────────────────────

  private resetGame() {
    this.phase = "ready";
    this.lives = LIVES_START;
    this.score = 0;
    this.level = 1;
    this.gameOverNotified = false;
    this.startRound();
    this.emitStats();
  }

  private startRound() {
    this.lanes = buildLanes(this.level);
    this.goals = Array(GOAL_COUNT).fill(false);
    this.roundTimer = Math.max(
      ROUND_TIME_MIN,
      ROUND_TIME_BASE * Math.pow(ROUND_TIME_DEC, this.level - 1),
    );
    this.respawnFrog();
  }

  private respawnFrog() {
    this.frog = startFrog();
    this.prevHighRow = ROW_START;
    // Resetear el temporizador de ronda al reaparecer (spec paso 7)
    this.roundTimer = Math.max(
      ROUND_TIME_MIN,
      ROUND_TIME_BASE * Math.pow(ROUND_TIME_DEC, this.level - 1),
    );
    if (this.phase !== "gameover") this.phase = "playing";
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.phase === "gameover" || this.phase === "dead")
      return;
    if (this.phase === "ready") this.phase = "playing";
    this.pendingDir = dir;
  };

  // ── Loop ───────────────────────────────────────────────────────────────────

  private loop = (now: number) => {
    if (!this.running) return;
    const dt =
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_DT_MS);
    this.lastTime = now;
    if (!this.paused) this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Actualización ──────────────────────────────────────────────────────────

  private update(dt: number) {
    if (this.phase === "gameover") return;

    if (this.phase === "dead") {
      this.deadTimer += dt;
      if (this.deadTimer >= DEAD_PAUSE_MS) {
        this.deadTimer = 0;
        if (this.lives <= 0) {
          this.endGame();
        } else {
          this.respawnFrog();
        }
      }
      return;
    }

    if (this.phase === "ready" || this.phase === "playing") {
      updateLanes(this.lanes, dt);
      this.updateFrog(dt);
      if (this.phase === "playing") {
        this.roundTimer -= dt;
        if (this.roundTimer <= 0) {
          this.roundTimer = 0;
          this.killFrog();
        }
      }
    }
  }

  private updateFrog(dt: number) {
    const frog = this.frog;

    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        // Completar el salto
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        this.resolveCell();
      }
      return;
    }

    // Rana en el río: arrastrar por la corriente
    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      const support = getSupport(frog, this.lanes);
      if (!support) {
        this.killFrog();
        return;
      }
      const lane = this.lanes.find((l) => l.row === frog.row)!;
      applyCurrentDrift(frog, support, lane, dt);
      // Salir por los bordes del río
      if (frog.col < 0 || frog.col >= COLS) {
        this.killFrog();
        return;
      }
    }

    // Rana en la carretera: colisión continua
    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, this.lanes)) {
        this.killFrog();
        return;
      }
    }

    // Procesar input pendiente
    if (this.pendingDir && this.phase === "playing") {
      this.startJump(this.pendingDir);
      this.pendingDir = null;
    }
  }

  private startJump(dir: Direction) {
    const frog = this.frog;
    let tc = frog.col;
    let tr = frog.row;

    if (dir === "up") tr -= 1;
    else if (dir === "down") tr += 1;
    else if (dir === "left") tc -= 1;
    else if (dir === "right") tc += 1;

    // Límites laterales del canvas
    tc = Math.max(0, Math.min(tc, COLS - 1));
    // No bajar más de ROW_START ni subir más de ROW_GOALS
    tr = Math.max(ROW_GOALS, Math.min(tr, ROW_START));

    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = tc;
    frog.targetRow = tr;
  }

  private resolveCell() {
    const frog = this.frog;

    // Puntuación por avance
    if (frog.row < this.prevHighRow) {
      const stepsUp = this.prevHighRow - frog.row;
      this.addScore(stepsUp * PTS_CELL);
      this.prevHighRow = frog.row;
    }

    // Boca destino
    if (frog.row === ROW_GOALS) {
      const idx = getGoalIndex(Math.round(frog.col));
      if (idx === null || this.goals[idx]) {
        // Columna no es boca, o boca ya ocupada → muerte
        this.killFrog();
        return;
      }
      this.occupyGoal(idx);
      return;
    }

    // Río sin soporte → muerte inmediata tras el salto
    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      const support = getSupport(frog, this.lanes);
      if (!support) {
        this.killFrog();
        return;
      }
    }

    // Carretera → colisión inmediata tras el salto
    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, this.lanes)) {
        this.killFrog();
      }
    }
  }

  private occupyGoal(idx: number) {
    this.goals[idx] = true;
    const timeBonus = Math.floor(this.roundTimer / 1000) * PTS_TIME;
    this.addScore(PTS_GOAL + timeBonus);
    this.emitStats();

    const allDone = this.goals.every(Boolean);
    if (allDone) {
      this.completeRound();
    } else {
      this.respawnFrog();
    }
  }

  // ── Gestión de ronda ────────────────────────────────────────────────────────

  private completeRound() {
    this.addScore(PTS_ROUND);
    this.level += 1;
    this.emitStats();
    this.startRound();
  }

  // ── Gestión de muerte ──────────────────────────────────────────────────────

  private killFrog() {
    if (this.phase === "dead" || this.phase === "gameover") return;
    this.lives -= 1;
    this.emitStats();
    this.phase = "dead";
    this.deadTimer = 0;
  }

  private endGame() {
    if (this.gameOverNotified) return;
    this.phase = "gameover";
    window.removeEventListener("keydown", this.onKeyDown);
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(this.score);
  }

  // ── Puntuación ─────────────────────────────────────────────────────────────

  private addScore(pts: number) {
    this.score += pts;
    this.emitStats();
  }

  private emitStats() {
    const { score, lives, level } = this;
    const last = this.lastStats;
    if (
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === level
    )
      return;
    this.lastStats = { score, lives, level };
    this.callbacks.onStats({ score, lives, level });
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  private draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);

    this.drawBackground();
    this.drawGoals();
    this.drawLanes();
    this.drawFrog();
    this.drawHUD();

    if (this.phase === "ready") this.drawReadyLabel();
  }

  private drawBackground() {
    const { ctx, palette } = this;

    // Fila 0: bocas (green oscuro)
    ctx.fillStyle = palette.goalEmpty;
    ctx.fillRect(0, 0, W, CELL);

    // Filas 1–6: río
    ctx.fillStyle = palette.river;
    ctx.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );

    // Fila 7: zona segura central
    ctx.fillStyle = palette.safe;
    ctx.fillRect(0, ROW_SAFE_MID * CELL, W, CELL);

    // Filas 8–12: carretera
    ctx.fillStyle = palette.road;
    ctx.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );

    // Fila 13: zona segura inferior (inicio)
    ctx.fillStyle = palette.safe;
    ctx.fillRect(0, ROW_START * CELL, W, CELL);
  }

  private drawGoals() {
    const { ctx, palette } = this;
    const rects = goalRects();
    rects.forEach((r, i) => {
      ctx.fillStyle = this.goals[i] ? palette.goalOccupied : palette.goalEmpty;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // Borde dorado
      ctx.strokeStyle = "#c8a020";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

      // Silueta de rana si la boca está ocupada
      if (this.goals[i]) {
        ctx.fillStyle = palette.frogBody;
        ctx.beginPath();
        ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawLanes() {
    for (const lane of this.lanes) {
      for (const entity of lane.entities) {
        this.drawEntity(entity, lane.row);
      }
    }
  }

  private drawEntity(entity: Entity, row: number) {
    const { ctx, palette } = this;
    const x = entity.col * CELL;
    const y = row * CELL;
    const ew = entity.width * CELL;

    switch (entity.type) {
      case "car": {
        const colors = palette.car;
        const colorIdx =
          Math.abs(Math.round(entity.col * 3 + row)) % colors.length;
        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x + 2, y + 6, ew - 4, CELL - 12);
        // Ruedas
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x + 8, y + CELL - 6, 5, 0, Math.PI * 2);
        ctx.arc(x + ew - 8, y + CELL - 6, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "truck": {
        ctx.fillStyle = palette.truck;
        ctx.fillRect(x + 2, y + 4, ew - 4, CELL - 8);
        // Cabina diferenciada
        ctx.fillStyle = "#909090";
        ctx.fillRect(x + 2, y + 6, CELL - 4, CELL - 12);
        // Ruedas
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(x + 8, y + CELL - 5, 5, 0, Math.PI * 2);
        ctx.arc(x + ew - 8, y + CELL - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "log": {
        ctx.fillStyle = palette.log;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 8, ew - 2, CELL - 16, 6);
        ctx.fill();
        // Líneas de textura
        ctx.strokeStyle = "#6a300a";
        ctx.lineWidth = 1;
        for (let i = 1; i < entity.width; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * CELL, y + 10);
          ctx.lineTo(x + i * CELL, y + CELL - 10);
          ctx.stroke();
        }
        break;
      }
      case "turtle": {
        const alpha = entity.submerged ? 0.3 : 1.0;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < entity.width; i++) {
          const tx = x + i * CELL + CELL / 2;
          const ty = y + CELL / 2;
          ctx.fillStyle = palette.turtleVisible;
          ctx.beginPath();
          ctx.ellipse(tx, ty, 14, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          // Patrón de escamas
          ctx.strokeStyle = "#1a5a1a";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx, ty - 6);
          ctx.lineTo(tx, ty + 6);
          ctx.moveTo(tx - 8, ty);
          ctx.lineTo(tx + 8, ty);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        break;
      }
    }
  }

  private drawFrog() {
    if (this.phase === "dead" || this.phase === "gameover") return;
    const { ctx, palette } = this;
    const { col, row } = interpolateFrog(this.frog);
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;

    // Cuerpo
    ctx.fillStyle = palette.frogBody;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ojos
    ctx.fillStyle = palette.frogEye;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 5, 4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 5, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Patas extendidas durante el salto
    if (this.frog.animating) {
      ctx.strokeStyle = palette.frogBody;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy);
      ctx.lineTo(cx - 20, cy + 6);
      ctx.moveTo(cx + 14, cy);
      ctx.lineTo(cx + 20, cy + 6);
      ctx.stroke();
    }
  }

  private drawHUD() {
    const { ctx, palette } = this;

    // Barra de tiempo en la parte superior (fila 0, encima del fondo de bocas)
    const timerRatio = Math.max(
      0,
      this.roundTimer /
        Math.max(
          ROUND_TIME_MIN,
          ROUND_TIME_BASE * Math.pow(ROUND_TIME_DEC, this.level - 1),
        ),
    );
    const barColor =
      timerRatio > 0.5
        ? palette.timerFull
        : timerRatio > 0.25
          ? palette.timerMid
          : palette.timerLow;
    ctx.fillStyle = barColor;
    ctx.fillRect(0, H - 4, W * timerRatio, 4);

    // Puntuación top-left (pequeño, para no tapar bocas)
    ctx.fillStyle = palette.hudText;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${this.score}`, 4, 4);

    // Nivel top-center
    ctx.textAlign = "center";
    ctx.fillText(`NV ${this.level}`, W / 2, 4);

    // Iconos de vida top-right (círculos verdes)
    ctx.textAlign = "right";
    const livesToShow = Math.max(0, this.lives);
    for (let i = 0; i < livesToShow; i++) {
      ctx.fillStyle = palette.frogBody;
      ctx.beginPath();
      ctx.arc(W - 8 - i * 18, 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawReadyLabel() {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 28px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText("PULSA UNA FLECHA", W / 2, H / 2 + 60);
    ctx.restore();
  }
}
