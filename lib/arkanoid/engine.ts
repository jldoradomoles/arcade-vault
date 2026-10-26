import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import {
  ASSETS,
  BALL_SIZE,
  BG,
  BLOCK_H,
  BLOCK_W,
  DAMAGED_ALPHA,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  H,
  LAUNCH_SPREAD,
  LIVES,
  LEVELS,
  MAX_DT,
  MAX_SCORE,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_START_X,
  PADDLE_W,
  PADDLE_Y,
  SPRITES,
  TOUGH_HITS,
  W,
  type Block,
  type Explosion,
  type Frame,
  type Phase,
} from "./constants";
import {
  collideBallWithBlocks,
  collideBallWithPaddle,
  createBlocks,
  type Ball,
  type Paddle,
} from "./entities";

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"];

export class ArkanoidEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private sprites: HTMLImageElement | null = null;
  private spritesLoaded = false;
  private sounds: Partial<Record<"bounce" | "break", HTMLAudioElement>> = {};
  private playing = new Set<HTMLAudioElement>(); // clones sonando

  private phase: Phase = "ready";
  private level = 1;
  private score = 0;
  private lives = LIVES;
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private paddle: Paddle = {
    x: PADDLE_START_X,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  private ball: Ball = {
    x: 0,
    y: 0,
    size: BALL_SIZE,
    vx: 0,
    vy: 0,
    speed: LEVELS[0].speed,
    stuck: true,
  };
  private left = false;
  private right = false;

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
    ctx.imageSmoothingEnabled = false;
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this.reset();
    this.loadSprites();
    this.loadSounds();
    this.emitStats();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.stopSounds();
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
    this.removeListeners();
    this.stopSounds();
  }

  private stopSounds() {
    for (const audio of this.playing) audio.pause();
    this.playing.clear();
  }

  private removeListeners() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
  }

  private reset() {
    this.phase = "ready";
    this.score = 0;
    this.lives = LIVES;
    this.explosions = [];
    this.paddle.x = PADDLE_START_X;
    this.loadLevel(1);
  }

  // Carga el mapa y la velocidad del nivel; la bola vuelve pegada a la paleta
  private loadLevel(level: number) {
    this.level = level;
    this.ball.speed = LEVELS[level - 1].speed;
    this.blocks = createBlocks(level);
    this.phase = "ready";
    this.stickBallToPaddle();
  }

  private loadSounds() {
    for (const name of ["bounce", "break"] as const) {
      const audio = new Audio(ASSETS[name]);
      audio.preload = "auto";
      this.sounds[name] = audio;
    }
  }

  // Clona el Audio precargado para que los sonidos se solapen; si el navegador
  // bloquea el audio, el juego sigue sin sonido
  private playSound(name: "bounce" | "break") {
    if (this.destroyed) return;
    try {
      const clone = this.sounds[name]?.cloneNode() as HTMLAudioElement;
      if (!clone) return;
      this.playing.add(clone);
      clone.addEventListener("ended", () => this.playing.delete(clone));
      clone.play().catch(() => this.playing.delete(clone));
    } catch {
      // sin audio
    }
  }

  private loadSprites() {
    const img = new Image();
    img.onload = () => {
      if (this.destroyed) return;
      this.sprites = img;
      this.spritesLoaded = true;
    };
    img.src = ASSETS.sprites;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    // No interferir con la escritura en campos de texto (p. ej. el modal)
    if (e.target instanceof HTMLInputElement) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (this.paused || this.phase === "gameover") return;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        break;
      case "Space":
        if (!e.repeat) this.launchBall();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        break;
    }
  };

  // Píxeles CSS del canvas → coordenada lógica x
  private mouseX(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return (e.clientX - rect.left) * (W / rect.width);
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.paused || this.phase === "gameover") return;
    this.setPaddleX(this.mouseX(e) - this.paddle.w / 2);
  };

  private onMouseDown = () => {
    if (this.paused || this.phase === "gameover") return;
    this.launchBall();
  };

  // ── Reglas ──────────────────────────────────────────────────────────────────
  private setPaddleX(x: number) {
    this.paddle.x = Math.max(0, Math.min(W - this.paddle.w, x));
  }

  private stickBallToPaddle() {
    const { ball, paddle } = this;
    ball.stuck = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = paddle.x + paddle.w / 2 - ball.size / 2;
    ball.y = paddle.y - ball.size;
  }

  private launchBall() {
    const { ball } = this;
    if (!ball.stuck || this.phase !== "ready") return;
    const angle = (Math.random() * 2 - 1) * LAUNCH_SPREAD;
    ball.vx = Math.sin(angle) * ball.speed;
    ball.vy = -Math.cos(angle) * ball.speed;
    ball.stuck = false;
    this.phase = "playing";
  }

  private updatePaddle(dt: number) {
    const dir = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (dir !== 0) this.setPaddleX(this.paddle.x + dir * PADDLE_SPEED * dt);
  }

  private updateBall(dt: number) {
    const { ball } = this;
    if (ball.stuck) {
      this.stickBallToPaddle();
      return;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // paredes laterales
    if (ball.x < 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      this.playSound("bounce");
    } else if (ball.x + ball.size > W) {
      ball.x = W - ball.size;
      ball.vx = -Math.abs(ball.vx);
      this.playSound("bounce");
    }
    // techo
    if (ball.y < 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      this.playSound("bounce");
    }
    if (collideBallWithPaddle(ball, this.paddle)) this.playSound("bounce");
    this.hitBlocks();
    // la bola cae por debajo del canvas
    if (ball.y > H) this.loseLife();
  }

  private loseLife() {
    this.lives--;
    if (this.lives > 0) {
      this.phase = "ready";
      this.stickBallToPaddle();
    } else {
      this.endGame();
    }
  }

  // Sin vidas, sin niveles o por FIN: la bola queda detenida y se quita la entrada
  private endGame() {
    if (this.gameOverNotified) return;
    this.phase = "gameover";
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.removeListeners();
    this.stopSounds();
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(this.score);
  }

  // Solo emite cuando cambia score, lives o level (no en cada frame)
  private emitStats() {
    const { score, lives, level } = this;
    const last = this.lastStats;
    if (
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === level
    ) {
      return;
    }
    this.lastStats = { score, lives, level };
    this.callbacks.onStats({ score, lives, level });
  }

  // Un golpe de bola: el gris sobrevive al primero; al romperse suma y explota
  private hitBlocks() {
    const { result, block } = collideBallWithBlocks(this.ball, this.blocks);
    if (result === "damaged") this.playSound("bounce"); // el gris sobrevive
    if (result !== "destroyed" || !block) return;
    this.playSound("break");
    this.score = Math.min(MAX_SCORE, this.score + block.points);
    this.explosions.push({
      x: block.x,
      y: block.y,
      color: block.color,
      elapsed: 0,
    });
    if (this.blocks.some((b) => b.alive)) return;
    // nivel vaciado: puntos y vidas se conservan; tras el último, victoria
    if (this.level < LEVELS.length) this.loadLevel(this.level + 1);
    else this.endGame();
  }

  private updateExplosions(dt: number) {
    for (const ex of this.explosions) ex.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (ex) => ex.elapsed < EXPLOSION_DURATION,
    );
  }

  private update(dt: number) {
    this.updatePaddle(dt);
    this.updateBall(dt);
    this.updateExplosions(dt);
    this.emitStats();
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  private loop = (now: number) => {
    if (!this.running) return;
    const dt =
      this.lastTime === null
        ? 0
        : Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    if (!this.paused && this.phase !== "gameover") this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  private drawFrame(frame: Frame, x: number, y: number, w: number, h: number) {
    if (!this.spritesLoaded || !this.sprites) return;
    this.ctx.drawImage(
      this.sprites,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      x,
      y,
      w,
      h,
    );
  }

  private draw() {
    const { ctx, paddle, ball } = this;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    for (const b of this.blocks) {
      if (!b.alive) continue;
      // el bloque gris dañado se dibuja con menos opacidad
      const damaged = b.color === "gray" && b.hp < TOUGH_HITS;
      if (damaged) ctx.globalAlpha = DAMAGED_ALPHA;
      this.drawFrame(SPRITES.blocks[b.color], b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }
    for (const ex of this.explosions) {
      // los frames se reparten a partes iguales en EXPLOSION_DURATION
      const frames = EXPLOSION_FRAMES[ex.color];
      const i = Math.min(
        frames.length - 1,
        Math.floor((ex.elapsed / EXPLOSION_DURATION) * frames.length),
      );
      this.drawFrame(frames[i], ex.x, ex.y, BLOCK_W, BLOCK_H);
    }
    this.drawFrame(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    this.drawFrame(SPRITES.ball, ball.x, ball.y, ball.size, ball.size);
    // rótulo «Nivel N» sin oscurecer el canvas, mientras la bola está pegada
    if (this.phase === "ready") {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 48px monospace";
      ctx.fillText(`Nivel ${this.level}`, W / 2, 440);
    }
  }
}
