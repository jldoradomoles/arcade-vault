import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import {
  BG,
  BODY_COLOR,
  CELL,
  COLS,
  FRUITS_PER_LEVEL,
  FRUITS_SRC,
  FRUIT_FALLBACK_COLOR,
  FRUIT_POINTS,
  FRUIT_SPRITES,
  GRID_LINE,
  H,
  HEAD_COLOR,
  MAX_DT_MS,
  MAX_QUEUED_TURNS,
  MAX_SCORE,
  ROWS,
  START_LENGTH,
  W,
  type Cell,
  type Dir,
  type Fruit,
  type Phase,
} from "./constants";
import {
  drawFruitSprite,
  hitsBody,
  hitsWall,
  isOpposite,
  nextHead,
  pickFruitCell,
  stepInterval,
} from "./entities";

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const SEGMENT_INSET = 2; // px entre cada segmento y el borde de su celda

export class SnakeEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private fruitImg: HTMLImageElement | null = null; // null hasta que carga

  private phase: Phase = "ready";
  private level = 1;
  private score = 0;
  private eaten = 0; // frutas comidas en la partida
  private fruit: Fruit | null = null;
  private snake: Cell[] = []; // cabeza en el índice 0
  private dir: Dir = "right";
  private turns: Dir[] = []; // giros pendientes, como máximo MAX_QUEUED_TURNS
  private stepAcc = 0; // ms acumulados desde el último paso

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private paused = false;

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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.reset();
    this.loadFruitImage();
    this.emitStats();
    window.addEventListener("keydown", this.onKeyDown);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    // Al reanudar, el primer frame no debe acumular el tiempo en pausa
    this.lastTime = null;
  }

  // Termina la partida con el puntaje actual (botón FIN)
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

  private reset() {
    this.phase = "ready";
    this.level = 1;
    this.score = 0;
    this.eaten = 0;
    this.dir = "right";
    this.turns = [];
    this.stepAcc = 0;
    // Centro-izquierda mirando a la derecha: la cabeza delante, la cola detrás
    const row = Math.floor(ROWS / 2);
    const headX = Math.floor(COLS / 4);
    this.snake = Array.from({ length: START_LENGTH }, (_, i) => ({
      x: headX - i,
      y: row,
    }));
    this.spawnFruit();
  }

  // Mientras no cargue la imagen la fruta se dibuja como círculo y el juego sigue
  private loadFruitImage() {
    const img = new Image();
    img.onload = () => {
      if (this.destroyed) return;
      this.fruitImg = img;
    };
    img.src = FRUITS_SRC;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    // No interferir con la escritura en campos de texto (p. ej. el modal)
    if (e.target instanceof HTMLInputElement) return;
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    e.preventDefault(); // las flechas no deben desplazar la página
    if (this.paused || this.phase === "gameover") return;
    this.queueTurn(dir);
  };

  // Cada giro se valida contra el último encolado, no contra la dirección ya aplicada
  private queueTurn(dir: Dir) {
    const ref = this.turns[this.turns.length - 1] ?? this.dir;
    if (isOpposite(ref, dir)) return;
    if (this.phase === "ready") {
      // La primera dirección válida pone en marcha la serpiente; → repite la actual
      this.phase = "playing";
      if (dir !== this.dir) this.turns.push(dir);
      return;
    }
    if (dir === ref || this.turns.length >= MAX_QUEUED_TURNS) return;
    this.turns.push(dir);
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  private step() {
    const turn = this.turns.shift();
    if (turn) this.dir = turn;
    const head = nextHead(this.snake[0], this.dir);
    const eats =
      this.fruit !== null && head.x === this.fruit.x && head.y === this.fruit.y;
    if (hitsWall(head)) return this.endGame();
    // Si no crece, la cola se libera en este paso: no cuenta como cuerpo
    const body = eats ? this.snake : this.snake.slice(0, -1);
    if (hitsBody(body, head)) return this.endGame();

    this.snake.unshift(head);
    if (!eats) {
      this.snake.pop();
      return;
    }
    // la cola se queda: la serpiente crece un segmento
    this.eatFruit();
    // sin celda libre para la fruta siguiente, el tablero está lleno
    if (this.fruit === null) this.endGame();
  }

  // Muro, cuerpo, tablero lleno o FIN: se quita la entrada y se avisa una sola vez
  private endGame() {
    if (this.gameOverNotified) return;
    this.phase = "gameover";
    window.removeEventListener("keydown", this.onKeyDown);
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(this.score);
  }

  // Solo emite cuando cambia score o level (no en cada frame); sin lives, el HUD oculta VIDAS
  private emitStats() {
    const { score, level } = this;
    const last = this.lastStats;
    if (last && last.score === score && last.level === level) return;
    this.lastStats = { score, level };
    this.callbacks.onStats({ score, level });
  }

  private eatFruit() {
    this.eaten++;
    this.score = Math.min(this.score + FRUIT_POINTS, MAX_SCORE);
    this.level = 1 + Math.floor(this.eaten / FRUITS_PER_LEVEL);
    this.spawnFruit();
    this.emitStats();
  }

  // Celda libre al azar y sprite al azar entre los 22 del atlas
  private spawnFruit() {
    const cell = pickFruitCell(this.snake, Math.random);
    this.fruit = cell
      ? {
          ...cell,
          sprite: Math.floor(Math.random() * FRUIT_SPRITES.length),
        }
      : null;
  }

  private update(dt: number) {
    if (this.phase !== "playing") return;
    this.stepAcc += dt;
    const interval = stepInterval(this.level);
    while (this.phase === "playing" && this.stepAcc >= interval) {
      this.stepAcc -= interval;
      this.step();
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (!this.running) return;
    const dt =
      this.lastTime === null ? 0 : Math.min(now - this.lastTime, MAX_DT_MS);
    this.lastTime = now;
    if (!this.paused && this.phase !== "gameover") this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  private draw() {
    const { ctx } = this;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    this.drawGrid();
    this.drawFruit();
    this.drawSnake();
    if (this.phase === "ready") this.drawReadyLabel();
  }

  private drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();
  }

  // Rótulo de espera, sin oscurecer el tablero
  private drawReadyLabel() {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 36px monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = BG;
    ctx.shadowBlur = 8;
    ctx.fillText("PULSA UNA FLECHA", W / 2, H - 120);
    ctx.restore();
  }

  private drawFruit() {
    if (!this.fruit) return;
    drawFruitSprite(
      this.ctx,
      this.fruitImg,
      this.fruit.sprite,
      this.fruit,
      FRUIT_FALLBACK_COLOR,
    );
  }

  // Del último segmento a la cabeza, para que la cabeza quede encima
  private drawSnake() {
    const { ctx, snake } = this;
    const size = CELL - SEGMENT_INSET * 2;
    for (let i = snake.length - 1; i >= 0; i--) {
      const { x, y } = snake[i];
      const head = i === 0;
      ctx.fillStyle = head ? HEAD_COLOR : BODY_COLOR;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = head ? 12 : 6;
      ctx.fillRect(
        x * CELL + SEGMENT_INSET,
        y * CELL + SEGMENT_INSET,
        size,
        size,
      );
    }
    ctx.shadowBlur = 0;
  }
}
