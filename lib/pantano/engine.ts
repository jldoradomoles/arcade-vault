import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import { DEFAULT_SKIN, type SkinId } from "@/lib/game-types";
import {
  ALL_SAVED_BONUS,
  CELL,
  COLS,
  FROG_SAVED_POINTS,
  FROG_STEP_MS,
  LOG_LENGTH,
  MAX_DT_MS,
  MAX_SCORE,
  PLACE_TIME_BASE_MS,
  PLACE_TIME_DECREASE_MS,
  PLACE_TIME_MIN_MS,
  ROWS,
  SHORE_BOTTOM,
  SHORE_TOP,
  TURTLE_SINK_MS,
  UNUSED_PIECE_POINTS,
  W,
  H,
  type CurrentRow,
  type Frog,
  type GamePhase,
  type Orientation,
  type Piece,
  type PieceKind,
  type PlacedPiece,
  type WaveInventory,
} from "./constants";
import { type PantanoPalette, SKINS } from "./skins";
import {
  canPlace,
  evaluateWave,
  frogsForWave,
  generateCurrents,
  generateInventory,
  movePieces,
  placePiece,
  sinkTurtles,
  stepFrog,
} from "./entities";

export class PantanoEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;

  // ── State ────────────────────────────────────────────────────────────────
  private phase: GamePhase = "placing";
  private wave = 1;
  private score = 0;

  // Grid & pieces
  private grid: (PlacedPiece | null)[][] = [];
  private pieces: PlacedPiece[] = [];
  private currents: CurrentRow[] = [];

  // Inventory (placing phase)
  private inventory: WaveInventory = { lilypads: 0, logs: 0, turtles: 0 };
  private selectedKind: PieceKind = "lilypad";
  private selectedOrientation: Orientation = "horizontal";
  private cursor = { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) };
  private placeTimeLeft = 0; // ms remaining
  private placeTimerMax = 0; // valor inicial de placeTimeLeft en esta oleada
  private static readonly WAVE_INTRO_MS = 2_000; // overlay de bienvenida

  // Crossing phase
  private frogs: Frog[] = [];
  private frogsTotal = 0;
  private frogsLaunched = 0;
  private frogsSaved = 0;
  private frogLaunchAcc = 0;
  private static readonly FROG_LAUNCH_MS = 1_400;

  // Result phase
  private resultTimer = 0;
  private static readonly RESULT_MS = 3_000;
  private unusedPieces = 0;
  private wavePointsEarned = 0;

  // RAF
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private paused = false;

  // Stats
  private lastStats: GameStats | null = null;
  private gameOverNotified = false;

  // Paleta activa
  private palette: PantanoPalette;

  // ── Constructor ──────────────────────────────────────────────────────────
  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
    _options?: { skin?: SkinId },
  ) {
    this.palette = SKINS[_options?.skin ?? DEFAULT_SKIN];
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
  }

  // ── GameEngine ────────────────────────────────────────────────────────────
  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.resetGame();
    this.emitStats();
    window.addEventListener("keydown", this.onKeyDown);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    if (this.phase === "gameover") return;
    this.paused = paused;
    this.lastTime = null; // descarta el dt acumulado durante la pausa
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
    this.canvas.width = 0; // libera textura GPU
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  private resetGame() {
    this.wave = 1;
    this.score = 0;
    this.gameOverNotified = false;
    this.lastStats = null;
    this.startWave();
  }

  private startWave() {
    this.grid = Array.from({ length: ROWS }, () =>
      Array<PlacedPiece | null>(COLS).fill(null),
    );
    this.pieces = [];
    this.currents = generateCurrents(this.wave);
    this.inventory = generateInventory(this.wave);
    this.selectedKind = "lilypad";
    this.selectedOrientation = "horizontal";
    this.cursor = {
      col: Math.floor(COLS / 2),
      row: Math.floor((ROWS - 2) / 2) + 1,
    };
    const pt = Math.max(
      PLACE_TIME_MIN_MS,
      PLACE_TIME_BASE_MS - (this.wave - 1) * PLACE_TIME_DECREASE_MS,
    );
    this.placeTimerMax = pt;
    this.placeTimeLeft = pt;
    this.frogs = [];
    this.frogsTotal = frogsForWave(this.wave);
    this.frogsLaunched = 0;
    this.frogsSaved = 0;
    this.frogLaunchAcc = 0;
    this.resultTimer = 0;
    this.unusedPieces = 0;
    this.wavePointsEarned = 0;
    this.phase = "placing";
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    const code = e.code;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Space",
        "KeyR",
        "KeyD",
      ].includes(code)
    ) {
      e.preventDefault();
    }

    if (this.paused || this.phase !== "placing") return;

    switch (code) {
      case "ArrowLeft":
        this.cursor.col = Math.max(0, this.cursor.col - 1);
        break;
      case "ArrowRight":
        this.cursor.col = Math.min(COLS - 1, this.cursor.col + 1);
        break;
      case "ArrowUp":
        this.cursor.row = Math.max(SHORE_TOP + 1, this.cursor.row - 1);
        break;
      case "ArrowDown":
        this.cursor.row = Math.min(SHORE_BOTTOM - 1, this.cursor.row + 1);
        break;
      case "Space": {
        const count = this.inventoryCount(this.selectedKind);
        if (count <= 0) break;
        const piece: Piece = {
          kind: this.selectedKind,
          orientation: this.selectedOrientation,
        };
        if (!canPlace(this.grid, piece, this.cursor.col, this.cursor.row))
          break;
        const placed = placePiece(
          this.grid,
          piece,
          this.cursor.col,
          this.cursor.row,
        );
        this.pieces.push(placed);
        this.decrementInventory(this.selectedKind);
        const nextAfterPlace = this.nextAvailableKind();
        if (nextAfterPlace === null) {
          this.startCrossing();
        } else {
          this.selectedKind = nextAfterPlace;
          if (nextAfterPlace !== "log") this.selectedOrientation = "horizontal";
        }
        break;
      }
      case "KeyR":
        if (this.selectedKind === "log") {
          this.selectedOrientation =
            this.selectedOrientation === "horizontal"
              ? "vertical"
              : "horizontal";
        } else {
          // lilypad/turtle no tienen orientación: R cicla al siguiente tipo (igual que D)
          const rCount = this.inventoryCount(this.selectedKind);
          if (rCount <= 0) break;
          this.decrementInventory(this.selectedKind);
          const nextAfterR = this.nextAvailableKind();
          if (nextAfterR === null) {
            this.startCrossing();
          } else {
            this.selectedKind = nextAfterR;
            if (nextAfterR !== "log") this.selectedOrientation = "horizontal";
          }
        }
        break;
      case "KeyD": {
        const dCount = this.inventoryCount(this.selectedKind);
        if (dCount <= 0) break;
        this.decrementInventory(this.selectedKind);
        const nextAfterDiscard = this.nextAvailableKind();
        if (nextAfterDiscard === null) {
          this.startCrossing();
        } else {
          this.selectedKind = nextAfterDiscard;
          if (nextAfterDiscard !== "log")
            this.selectedOrientation = "horizontal";
        }
        break;
      }
    }
  };

  // ── Loop ──────────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (!this.running) return;
    const dt =
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_DT_MS);
    this.lastTime = now;

    if (!this.paused && this.phase !== "gameover") this.update(dt);

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    switch (this.phase) {
      case "placing":
        this.updatePlacing(dt);
        break;
      case "crossing":
        this.updateCrossing(dt);
        break;
      case "result":
        this.updateResult(dt);
        break;
    }
  }

  private updatePlacing(dt: number) {
    this.placeTimeLeft -= dt;
    if (this.placeTimeLeft <= 0) this.startCrossing();
  }

  private updateCrossing(dt: number) {
    // 1. Mover troncos con la corriente
    const preDriftPieces = this.pieces;
    this.pieces = movePieces(this.pieces, this.currents, dt);

    // 2. Derivar ranas en troncos / detectar caídas por pieza que se escapa
    this.frogs = this.frogs.map((frog) => {
      if (!frog.alive || frog.saved || frog.row === SHORE_BOTTOM) return frog;
      return this.driftFrog(frog, preDriftPieces);
    });

    // 3. Avanzar temporizador de paso y realizar el paso cuando toca
    this.frogs = this.frogs.map((frog) => {
      if (!frog.alive || frog.saved) return frog;
      const timer = frog.stepTimer + dt;
      if (timer >= FROG_STEP_MS) {
        return stepFrog({ ...frog, stepTimer: 0 }, this.pieces);
      }
      return { ...frog, stepTimer: timer };
    });

    // 4. Hundir tortugas (actualiza timers, elimina las hundidas)
    this.pieces = sinkTurtles(this.pieces, dt);

    // 5. Contar ranas salvadas
    this.frogsSaved = this.frogs.filter((f) => f.saved).length;

    // 6. Lanzar nuevas ranas con intervalo fijo
    this.frogLaunchAcc += dt;
    while (
      this.frogLaunchAcc >= PantanoEngine.FROG_LAUNCH_MS &&
      this.frogsLaunched < this.frogsTotal
    ) {
      this.frogLaunchAcc -= PantanoEngine.FROG_LAUNCH_MS;
      this.launchFrog();
    }

    // 7. Verificar fin de fase
    if (this.frogsLaunched >= this.frogsTotal && this.frogs.length > 0) {
      if (this.frogs.every((f) => f.saved || !f.alive)) {
        this.startResult();
      }
    }
  }

  private updateResult(dt: number) {
    this.resultTimer += dt;
    if (this.resultTimer < PantanoEngine.RESULT_MS) return;

    const { pass } = evaluateWave(this.frogsSaved, this.frogsTotal);
    if (pass) {
      this.wave++;
      this.startWave();
      this.emitStats();
    } else {
      this.endGame();
    }
  }

  // ── Placing helpers ────────────────────────────────────────────────────────
  private startCrossing() {
    this.unusedPieces =
      this.inventory.lilypads + this.inventory.logs + this.inventory.turtles;
    this.phase = "crossing";
  }

  private inventoryCount(kind: PieceKind): number {
    switch (kind) {
      case "lilypad":
        return this.inventory.lilypads;
      case "log":
        return this.inventory.logs;
      case "turtle":
        return this.inventory.turtles;
    }
  }

  private decrementInventory(kind: PieceKind) {
    switch (kind) {
      case "lilypad":
        this.inventory.lilypads = Math.max(0, this.inventory.lilypads - 1);
        break;
      case "log":
        this.inventory.logs = Math.max(0, this.inventory.logs - 1);
        break;
      case "turtle":
        this.inventory.turtles = Math.max(0, this.inventory.turtles - 1);
        break;
    }
  }

  // Busca el siguiente tipo con piezas disponibles, girando por el inventario.
  private nextAvailableKind(): PieceKind | null {
    const kinds: PieceKind[] = ["lilypad", "log", "turtle"];
    const start = kinds.indexOf(this.selectedKind);
    for (let i = 1; i <= kinds.length; i++) {
      const kind = kinds[(start + i) % kinds.length];
      if (this.inventoryCount(kind) > 0) return kind;
    }
    return null;
  }

  // ── Crossing helpers ──────────────────────────────────────────────────────

  private launchFrog() {
    const col = Math.floor(Math.random() * COLS);
    this.frogs.push({
      col,
      row: SHORE_BOTTOM,
      x: col * CELL,
      stepTimer: 0,
      alive: true,
      saved: false,
    });
    this.frogsLaunched++;
  }

  // Mueve la rana con su tronco o detecta caída si la pieza se escapó.
  private driftFrog(frog: Frog, oldPieces: PlacedPiece[]): Frog {
    const centerX = frog.x + CELL / 2;
    const oldPiece = oldPieces.find((p) =>
      this.pieceCovers(p, frog.row, centerX),
    );
    if (!oldPiece) return { ...frog, alive: false };

    if (oldPiece.kind === "log") {
      const newPiece = this.pieces.find(
        (p) =>
          p.kind === "log" && p.col === oldPiece.col && p.row === oldPiece.row,
      );
      if (!newPiece) return { ...frog, alive: false };
      const dx = newPiece.x - oldPiece.x;
      if (Math.abs(dx) > CELL * 2) return { ...frog, alive: false }; // wrapping
      return { ...frog, x: frog.x + dx };
    }

    // Nenúfar o tortuga: verificar que no se hundió
    const stillHere = this.pieces.find(
      (p) =>
        p.kind === oldPiece.kind &&
        p.col === oldPiece.col &&
        p.row === oldPiece.row,
    );
    return stillHere ? frog : { ...frog, alive: false };
  }

  // Comprueba si una pieza cubre la posición (row, centerX).
  private pieceCovers(p: PlacedPiece, row: number, centerX: number): boolean {
    if (p.kind === "turtle" && (p.sinkTimer ?? 0) >= TURTLE_SINK_MS)
      return false;
    if (p.kind === "log" && p.orientation === "vertical") {
      if (row < p.row || row > p.row + LOG_LENGTH - 1) return false;
      return centerX >= p.x && centerX < p.x + CELL;
    }
    if (p.row !== row) return false;
    const right = p.kind === "log" ? p.x + LOG_LENGTH * CELL : p.x + CELL;
    return centerX >= p.x && centerX < right;
  }

  private startResult() {
    const allBonus = this.frogsSaved === this.frogsTotal ? ALL_SAVED_BONUS : 0;
    this.wavePointsEarned =
      this.frogsSaved * FROG_SAVED_POINTS +
      this.unusedPieces * UNUSED_PIECE_POINTS +
      allBonus;
    this.score = Math.min(this.score + this.wavePointsEarned, MAX_SCORE);
    this.resultTimer = 0;
    this.phase = "result";
    this.emitStats();
  }

  // ── Game over ──────────────────────────────────────────────────────────────
  private endGame() {
    if (this.gameOverNotified) return;
    this.phase = "gameover";
    window.removeEventListener("keydown", this.onKeyDown);
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(Math.min(this.score, MAX_SCORE));
  }

  // Solo emite cuando cambia score o level; sin lives (el HUD oculta VIDAS)
  private emitStats() {
    const stats: GameStats = { score: this.score, level: this.wave };
    const last = this.lastStats;
    if (last && last.score === stats.score && last.level === stats.level)
      return;
    this.lastStats = stats;
    this.callbacks.onStats(stats);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  private draw() {
    this.drawBackground();
    this.drawPieces();
    if (this.phase === "placing") {
      this.drawCursor();
      this.drawTimerBar();
      this.drawInventoryBar();
      this.drawPhaseLabel("COLOCA TUS PIEZAS");
      this.drawWaveIntro();
    }
    if (this.phase === "crossing" || this.phase === "result") {
      this.drawFrogs();
      this.drawPhaseLabel("LAS RANAS CRUZAN");
      this.drawFrogCount();
    }
    if (this.phase === "result") {
      this.drawResultOverlay();
    }
  }

  private drawBackground() {
    const { ctx } = this;
    const p = this.palette;

    // Shore top (row 0)
    ctx.fillStyle = p.bgShore;
    ctx.fillRect(0, 0, W, CELL);

    // Water rows 1-13
    ctx.fillStyle = p.bgWater;
    ctx.fillRect(0, CELL, W, (ROWS - 2) * CELL);

    // Shore bottom (row 14)
    ctx.fillStyle = p.bgShore;
    ctx.fillRect(0, SHORE_BOTTOM * CELL, W, CELL);

    this.drawGridLines();
    this.drawCurrentArrows();
  }

  private drawGridLines() {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = this.palette.gridLine;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * CELL, CELL);
      ctx.lineTo(c * CELL, (ROWS - 1) * CELL);
    }
    for (let r = 1; r <= ROWS - 1; r++) {
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawCurrentArrows() {
    const { ctx } = this;
    ctx.save();

    for (const curr of this.currents) {
      const y = curr.row * CELL + CELL / 2;
      const goRight = curr.speed > 0;
      ctx.strokeStyle = curr.diagonal
        ? this.palette.arrowDiagonal
        : this.palette.arrowNormal;
      ctx.lineWidth = 1;

      const startX = goRight ? 30 : 50;
      for (let ax = startX; ax < W - 10; ax += 80) {
        this.drawArrow(ctx, ax, y, goRight, curr.diagonal ?? false);
      }
    }

    ctx.restore();
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    goRight: boolean,
    diagonal: boolean,
  ) {
    const len = 18;
    const head = 5;
    const d = goRight ? 1 : -1;
    const dy = diagonal ? 3 : 0;

    const x0 = x - d * (len / 2);
    const y0 = y - dy / 2;
    const x1 = x + d * (len / 2);
    const y1 = y + dy / 2;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - d * head, y1 - head / 2);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - d * head, y1 + head / 2);
    ctx.stroke();
  }

  // ── Timer bar ─────────────────────────────────────────────────────────────
  private drawTimerBar() {
    const { ctx } = this;
    const p = this.palette;
    const ratio =
      this.placeTimerMax > 0
        ? Math.max(0, this.placeTimeLeft / this.placeTimerMax)
        : 0;
    const barH = 5;

    ctx.fillStyle = p.hudBarBg;
    ctx.fillRect(0, 0, W, barH);

    const color =
      ratio > 0.5 ? p.timerHigh : ratio > 0.25 ? p.timerMid : p.timerLow;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W * ratio, barH);
  }

  // ── Cursor ────────────────────────────────────────────────────────────────
  private drawCursor() {
    const { ctx } = this;
    const { col, row } = this.cursor;
    const piece: Piece = {
      kind: this.selectedKind,
      orientation: this.selectedOrientation,
    };
    const cells = this.pieceCells(piece, col, row);
    const valid =
      this.inventoryCount(this.selectedKind) > 0 &&
      canPlace(this.grid, piece, col, row);

    const p = this.palette;
    ctx.save();
    const ghostAlpha = valid ? 0.35 : 0.18;
    const borderColor = valid ? p.cursorValid : p.cursorInvalid;
    const baseFill =
      this.selectedKind === "lilypad"
        ? p.cursorLilypadFill
        : this.selectedKind === "log"
          ? p.cursorLogFill
          : p.cursorTurtleFill;

    ctx.globalAlpha = ghostAlpha;
    ctx.fillStyle = baseFill;
    for (const [c, r] of cells) {
      if (c >= 0 && c < COLS && r > SHORE_TOP && r < SHORE_BOTTOM) {
        ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 8;
    for (const [c, r] of cells) {
      if (c >= 0 && c < COLS && r > SHORE_TOP && r < SHORE_BOTTOM) {
        ctx.strokeRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3);
      }
    }
    ctx.restore();
  }

  private pieceCells(
    piece: Piece,
    col: number,
    row: number,
  ): [number, number][] {
    if (piece.kind === "log") {
      if (piece.orientation === "horizontal") {
        return [
          [col, row],
          [col + 1, row],
          [col + 2, row],
        ];
      }
      return [
        [col, row],
        [col, row + 1],
        [col, row + 2],
      ];
    }
    return [[col, row]];
  }

  // ── Pieces ────────────────────────────────────────────────────────────────
  private drawPieces() {
    for (const p of this.pieces) {
      const py = p.row * CELL;
      if (p.kind === "lilypad") this.drawLilypad(p.x, py);
      else if (p.kind === "log") this.drawLog(p);
      else this.drawTurtle(p);
    }
  }

  private drawLilypad(px: number, py: number) {
    const { ctx } = this;
    const p = this.palette;
    const cx = px + CELL / 2;
    const cy = py + CELL / 2;
    const r = CELL / 2 - 3;
    ctx.save();
    ctx.fillStyle = p.lilypadFill;
    ctx.strokeStyle = p.lilypadStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, py + 3);
    ctx.strokeStyle = p.lilypadStroke;
    ctx.stroke();
    ctx.restore();
  }

  private drawLog(p: PlacedPiece) {
    const { ctx } = this;
    const pal = this.palette;
    const isH = p.orientation === "horizontal";
    const lw = isH ? LOG_LENGTH * CELL : CELL;
    const lh = isH ? CELL : LOG_LENGTH * CELL;
    const py = p.row * CELL;
    ctx.save();
    ctx.fillStyle = pal.logFill;
    ctx.strokeStyle = pal.logStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    (
      ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }
    ).roundRect(p.x + 2, py + 2, lw - 4, lh - 4, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = pal.logGrain;
    ctx.lineWidth = 0.8;
    if (isH) {
      for (let i = 1; i < LOG_LENGTH; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x + i * CELL, py + 4);
        ctx.lineTo(p.x + i * CELL, py + CELL - 4);
        ctx.stroke();
      }
    } else {
      for (let i = 1; i < LOG_LENGTH; i++) {
        ctx.beginPath();
        ctx.moveTo(p.x + 4, py + i * CELL);
        ctx.lineTo(p.x + CELL - 4, py + i * CELL);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawTurtle(p: PlacedPiece) {
    const { ctx } = this;
    const pal = this.palette;
    const py = p.row * CELL;
    const cx = p.x + CELL / 2;
    const cy = py + CELL / 2;
    const sinking = (p.sinkTimer ?? 0) >= TURTLE_SINK_MS * 0.8;
    const alpha = sinking
      ? 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 150))
      : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal.turtleFill;
    ctx.strokeStyle = pal.turtleStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, CELL / 2 - 4, CELL / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = pal.turtleRing;
    ctx.beginPath();
    ctx.ellipse(cx, cy, CELL / 4, CELL / 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Inventory bar ─────────────────────────────────────────────────────────
  private drawInventoryBar() {
    const { ctx } = this;
    const p = this.palette;
    const y = SHORE_BOTTOM * CELL;
    const barH = CELL;

    ctx.fillStyle = p.hudBarBg;
    ctx.fillRect(0, y, W, barH);

    const types: PieceKind[] = ["lilypad", "log", "turtle"];
    const colors = [p.invLilypadColor, p.invLogColor, p.invTurtleColor];
    const labels = ["NENÚFAR", "TRONCO", "TORTUGA"];
    const sectionW = W / 3;

    for (let i = 0; i < 3; i++) {
      const kind = types[i];
      const count = this.inventoryCount(kind);
      const sx = i * sectionW;
      const cx = sx + sectionW / 2;
      const cy = y + barH / 2;
      const selected = this.selectedKind === kind;

      if (selected) {
        ctx.fillStyle = p.invSelectedBg;
        ctx.fillRect(sx + 2, y + 2, sectionW - 4, barH - 4);
      }

      ctx.fillStyle = count > 0 ? colors[i] : p.invEmptyColor;
      ctx.fillRect(cx - 24, cy - 8, 16, 16);

      ctx.save();
      ctx.font = `bold ${selected ? 14 : 12}px monospace`;
      ctx.fillStyle =
        count > 0
          ? selected
            ? p.invTextSelected
            : p.invTextAvailable
          : p.invTextEmpty;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${count}`, cx - 5, cy);

      ctx.font = "7px monospace";
      ctx.fillStyle = selected ? p.invLabelSelected : p.invLabelAvailable;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(labels[i], cx, y + barH - 3);
      ctx.restore();
    }
  }

  // ── Phase label ───────────────────────────────────────────────────────────
  private drawPhaseLabel(text: string) {
    const { ctx } = this;
    ctx.save();
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = this.palette.phaseLabel;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, CELL / 2);
    ctx.restore();
  }

  // ── Frogs ─────────────────────────────────────────────────────────────────
  private drawFrogs() {
    const { ctx } = this;
    for (const frog of this.frogs) {
      if (!frog.alive && !frog.saved) continue;
      const px = frog.x;
      const py = frog.row * CELL;
      const cx = px + CELL / 2;
      const cy = py + CELL / 2;

      const p = this.palette;
      ctx.save();
      ctx.globalAlpha = frog.saved ? 0.55 : 1;

      // Cuerpo
      ctx.fillStyle = p.frogBody;
      ctx.strokeStyle = p.frogBodyStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, CELL / 2 - 5, CELL / 2 - 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ojos
      ctx.fillStyle = p.frogEye;
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 6, cy - 4, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pupilas
      ctx.fillStyle = p.frogPupil;
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 6, cy - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawFrogCount() {
    const { ctx } = this;
    const total = this.frogsTotal;
    const saved = this.frogsSaved;
    const launched = this.frogsLaunched;

    ctx.save();
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.palette.frogCountText;
    ctx.fillText(
      `RANAS ${saved}/${total}  •  LANZADAS ${launched}`,
      W - 8,
      CELL / 2,
    );
    ctx.restore();
  }

  // ── Result overlay ────────────────────────────────────────────────────────
  private drawResultOverlay() {
    const { ctx } = this;
    const p = this.palette;
    const panelW = 380;
    const panelH = 200;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;

    // Fondo del panel
    ctx.save();
    ctx.fillStyle = p.resultBg;
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    (
      ctx as CanvasRenderingContext2D & {
        roundRect: (...a: unknown[]) => void;
      }
    ).roundRect(px, py, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    // Título
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = p.accentColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`OLEADA ${this.wave}`, W / 2, py + 14);

    // Filas de estadísticas
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    const lx = px + 24;
    const rx = px + panelW - 24;
    let ry = py + 48;
    const row = (label: string, value: string, highlight = false) => {
      ctx.fillStyle = highlight ? p.resultHighlight : p.resultText;
      ctx.textAlign = "left";
      ctx.fillText(label, lx, ry);
      ctx.textAlign = "right";
      ctx.fillText(value, rx, ry);
      ry += 22;
    };

    const needMin = Math.ceil(this.frogsTotal * 0.6);
    row(
      `RANAS SALVADAS`,
      `${this.frogsSaved} / ${this.frogsTotal}  (min. ${needMin})`,
      this.frogsSaved < needMin,
    );
    row(
      `PIEZAS NO USADAS  ×${UNUSED_PIECE_POINTS}`,
      `+${this.unusedPieces * UNUSED_PIECE_POINTS}`,
    );
    if (this.frogsSaved === this.frogsTotal) {
      row(`BONUS TODAS SALVADAS`, `+${ALL_SAVED_BONUS}`, true);
    }

    // Separador
    ctx.strokeStyle = p.resultDivider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ry);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ry += 10;

    // Total de puntos
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = p.resultHighlight;
    ctx.textAlign = "left";
    ctx.fillText("PUNTOS DE OLEADA", lx, ry);
    ctx.textAlign = "right";
    ctx.fillText(`+${this.wavePointsEarned}`, rx, ry);

    // Barra de progreso (tiempo restante)
    const ratio = Math.min(1, this.resultTimer / PantanoEngine.RESULT_MS);
    const barY = py + panelH - 10;
    ctx.fillStyle = p.resultProgressBg;
    ctx.fillRect(px + 4, barY, panelW - 8, 5);
    ctx.fillStyle = p.accentColor;
    ctx.fillRect(px + 4, barY, (panelW - 8) * ratio, 5);

    ctx.restore();
  }

  // ── Wave intro overlay ────────────────────────────────────────────────────
  private drawWaveIntro() {
    const elapsed = this.placeTimerMax - this.placeTimeLeft;
    if (elapsed >= PantanoEngine.WAVE_INTRO_MS) return;

    // Fade out over the last 500 ms of the intro
    const fadeStart = PantanoEngine.WAVE_INTRO_MS - 500;
    const alpha = elapsed < fadeStart ? 1 : 1 - (elapsed - fadeStart) / 500;

    const { ctx } = this;
    const p = this.palette;
    ctx.save();

    // Fondo atenuado
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = p.waveIntroBg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;

    // Número de oleada
    ctx.font = "bold 52px monospace";
    ctx.fillStyle = p.accentColor;
    ctx.shadowColor = p.accentColor;
    ctx.shadowBlur = 24;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`OLEADA ${this.wave}`, W / 2, H / 2 - 52);

    ctx.shadowBlur = 0;

    // Estadísticas de dificultad
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = p.waveStatText;
    const secs = Math.round(this.placeTimerMax / 1000);
    ctx.fillText(
      `${this.frogsTotal} RANAS  •  ${secs}s PARA COLOCAR`,
      W / 2,
      H / 2 + 8,
    );

    // Aviso de corrientes diagonales (oleada >= 4)
    if (this.wave >= 4) {
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = p.accentColor;
      ctx.fillText("⚠  CORRIENTES DIAGONALES ACTIVAS", W / 2, H / 2 + 46);
    }

    ctx.restore();
  }
}
