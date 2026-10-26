import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import {
  BLOCK,
  BOARD_H,
  BOARD_W,
  CELL_POINTS,
  COLORS,
  COLS,
  FREEZE_MS,
  FREEZE_TINT,
  GRID_COLOR,
  H,
  ICON_COLOR,
  LINE_SCORES,
  MAX_DT,
  MAX_SCORE,
  POWERS,
  POWER_EVERY,
  RESUME_LOCK_MS,
  ROWS,
  SHINE_COLOR,
  TOAST_MS,
  W,
  WILD,
  WILD_ICON_COLOR,
  dropIntervalFor,
  type PowerType,
  type Piece,
} from "./constants";
import {
  clearLines,
  collide,
  createBoard,
  ghostY,
  merge,
  randomPiece,
  tryRotate,
  applyPower,
  type Board,
} from "./entities";

const GAME_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
];

const FONT = "ui-monospace, Menlo, Consolas, monospace";
const PANEL_X = BOARD_W;
const PANEL_PAD = 18;

// Dibuja una celda; `x`/`y` son coordenadas de rejilla, `ox`/`oy` el origen en px
function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
  ox = 0,
  oy = 0,
) {
  const color = COLORS[colorIndex];
  if (!color) return;
  const px = ox + x * BLOCK + 1;
  const py = oy + y * BLOCK + 1;
  const sz = BLOCK - 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, sz, sz);
  ctx.fillStyle = SHINE_COLOR;
  ctx.fillRect(px, py, sz, 4);
  const power = POWERS[colorIndex as PowerType];
  if (power || colorIndex === WILD) {
    ctx.fillStyle = power ? ICON_COLOR : WILD_ICON_COLOR;
    ctx.font = `${power ? "" : "bold "}${BLOCK * 0.6}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      power ? power.icon : "★",
      ox + x * BLOCK + BLOCK / 2,
      oy + y * BLOCK + BLOCK / 2 + 1,
    );
  }
  ctx.globalAlpha = 1;
}

export class TetrisEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;

  private board: Board = createBoard();
  private current: Piece = randomPiece();
  private next: Piece = randomPiece();
  private score = 0;
  private lines = 0;
  private level = 1;
  private dropInterval = dropIntervalFor(1);
  private dropAccum = 0;
  private freezeLeft = 0; // ms de congelación restantes
  private toastText = ""; // aviso del último poder usado
  private toastLeft = 0; // ms restantes del aviso
  private powerAt = POWER_EVERY; // total de líneas que otorga el siguiente poder
  private powerPending = false; // la próxima pieza generada es un poder
  private inputLockUntil = 0; // performance.now() hasta el que se ignoran teclas

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private paused = false;
  private over = false;

  private lastStats: GameStats | null = null;
  private gameOverNotified = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    canvas.width = W;
    canvas.height = H;
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this.reset();
    window.addEventListener("keydown", this.onKeyDown);
    this.emitStats();
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    // Tras reanudar se ignoran las teclas un instante (p. ej. un Espacio de más)
    if (this.paused && !paused)
      this.inputLockUntil = performance.now() + RESUME_LOCK_MS;
    this.paused = paused;
    // Al reanudar, el primer frame no debe acumular el tiempo en pausa
    this.lastTime = null;
  }

  // Termina la partida con el puntaje actual (botón FIN)
  finish() {
    if (!this.running || this.over) return;
    this.endGame();
  }

  destroy() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private reset() {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = dropIntervalFor(1);
    this.dropAccum = 0;
    this.over = false;
    this.gameOverNotified = false;
    this.freezeLeft = 0;
    this.toastLeft = 0;
    this.powerAt = POWER_EVERY;
    this.powerPending = false;
    this.inputLockUntil = 0;
    this.current = randomPiece();
    this.next = randomPiece();
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    // No interferir con la escritura en campos de texto (p. ej. el modal)
    if (e.target instanceof HTMLInputElement) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (this.paused || this.over) return;
    if (performance.now() < this.inputLockUntil) return;
    const { board, current } = this;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate(board, current);
        break;
      case "Space":
        this.hardDrop();
        break;
    }
  };

  // ── Reglas ──────────────────────────────────────────────────────────────────
  private addScore(points: number) {
    this.score = Math.min(MAX_SCORE, this.score + points);
  }

  private softDrop() {
    const { board, current } = this;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      this.addScore(1);
    } else {
      this.lockPiece();
    }
  }

  private hardDrop() {
    const gy = ghostY(this.board, this.current);
    this.addScore((gy - this.current.y) * 2);
    this.current.y = gy;
    this.lockPiece();
  }

  private lockPiece() {
    const { board, current } = this;
    if (current.power) {
      const removed = applyPower(
        board,
        current.type as PowerType,
        current.x,
        current.y,
      );
      if (current.type === 10 || current.type === 11)
        this.addScore(removed * CELL_POINTS);
      if (current.type === 14) this.freezeLeft = FREEZE_MS;
      const power = POWERS[current.type as PowerType];
      this.toastText = `${power.icon} ${power.name}`;
      this.toastLeft = TOAST_MS;
    } else {
      merge(board, current);
    }
    const cleared = clearLines(board);
    if (cleared) {
      this.lines += cleared;
      this.addScore((LINE_SCORES[cleared] ?? 0) * this.level);
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = dropIntervalFor(this.level);
      while (this.lines >= this.powerAt) {
        this.powerAt += POWER_EVERY;
        this.powerPending = true;
      }
    }
    this.spawn();
  }

  private spawn() {
    this.current = this.next;
    this.next = randomPiece(this.powerPending);
    this.powerPending = false;
    const { board, current } = this;
    if (collide(board, current.shape, current.x, current.y)) this.endGame();
  }

  private endGame() {
    this.over = true;
    window.removeEventListener("keydown", this.onKeyDown);
    this.draw(); // el loop ya no pinta tras el game over: deja el estado final
    this.notifyGameOver();
  }

  // ── Contrato con la plataforma ──────────────────────────────────────────────
  // Solo emite cuando cambia score o level (no en cada frame)
  private emitStats() {
    const { score, level } = this;
    const last = this.lastStats;
    if (last && last.score === score && last.level === level) return;
    this.lastStats = { score, level };
    this.callbacks.onStats({ score, level });
  }

  private notifyGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(this.score);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  private update(dt: number) {
    if (this.toastLeft > 0) this.toastLeft -= dt;
    if (this.freezeLeft > 0) {
      this.freezeLeft -= dt;
      this.dropAccum = 0; // caída detenida mientras dura la congelación
    } else {
      this.dropAccum += dt;
    }
    if (this.dropAccum < this.dropInterval) return;
    this.dropAccum = 0;
    const { board, current } = this;
    if (!collide(board, current.shape, current.x, current.y + 1)) current.y++;
    else this.lockPiece();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  private drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, BOARD_H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
    }
    ctx.stroke();
  }

  private drawPiece(piece: Piece, y: number, alpha = 1) {
    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) drawBlock(this.ctx, piece.x + c, y + r, v, alpha);
      }),
    );
  }

  private drawPanel() {
    const { ctx } = this;
    const x = PANEL_X + PANEL_PAD;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(PANEL_X, 0, W - PANEL_X, H);
    ctx.fillStyle = GRID_COLOR;
    ctx.fillRect(PANEL_X, 0, 2, H);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = "#8a8aa0";
    ctx.fillText("SIGUIENTE", x, 36);

    // Rejilla 4×4 de bloques de 30 px, la pieza centrada
    const gx = x + 2;
    const gy = 52;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(gx - 0.5, gy - 0.5, 4 * BLOCK + 1, 4 * BLOCK + 1);
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) drawBlock(ctx, offX + c, offY + r, v, 1, gx, gy);
      }),
    );

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = "#8a8aa0";
    ctx.fillText("LÍNEAS", x, 232);
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = "#e8e8f0";
    ctx.fillText(String(this.lines), x, 264);

    let status = "";
    if (this.freezeLeft > 0)
      status = `❄ Congelado ${Math.ceil(this.freezeLeft / 1000)}s`;
    else if (this.toastLeft > 0) status = this.toastText;
    if (status) {
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillStyle = this.freezeLeft > 0 ? COLORS[14]! : "#e8e8f0";
      ctx.fillText(status, x, 316, W - PANEL_X - PANEL_PAD * 2);
    }
  }

  private draw() {
    const { ctx, board, current } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c]);

    this.drawPiece(current, ghostY(board, current), 0.2);
    this.drawPiece(current, current.y);

    if (this.freezeLeft > 0) {
      ctx.fillStyle = FREEZE_TINT;
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    }
    this.drawPanel();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  private loop = (ts: number) => {
    if (!this.running) return;
    if (!this.paused && !this.over) {
      const dt =
        this.lastTime === null ? 0 : Math.min(ts - this.lastTime, MAX_DT);
      this.lastTime = ts;
      this.update(dt);
      this.emitStats();
      this.draw();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}
