import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import {
  ARC_COLOR,
  ARC_MAX_TURN,
  ARC_RADIUS,
  ARC_SPAN,
  ARC_THICKNESS,
  BALL_COLOR,
  BALL_RADIUS,
  BG,
  COMBO_MAX,
  COMBO_WINDOW,
  CORE_COLOR,
  CORE_RADIUS,
  CX,
  CY,
  H,
  KILL_SCORE,
  LIVES_START,
  MAX_DT,
  MAX_SCORE,
  PULSE_COLOR,
  PULSE_COOLDOWN,
  RETURN_SCORE,
  RETURNED_COLOR,
  SECONDS_PER_LEVEL,
  W,
  type Ball,
} from "./constants";
import {
  applyPulse,
  ballSpeed,
  ballsCollide,
  hitsArc,
  reflect,
  spawnInterval,
  turnToward,
} from "./entities";

interface Explosion {
  x: number;
  y: number;
  timer: number; // cuenta atrás desde 0.2 s
}

export class OrbitalEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;

  private phase: "playing" | "gameover" = "playing";
  private theta = 0; // ángulo actual del escudo (rad)
  private targetTheta = 0; // ángulo apuntado por el cursor

  private lives = LIVES_START;
  private score = 0;
  private level = 1;
  private t = 0; // segundos de juego efectivos

  private balls: Ball[] = [];
  private spawnTimer = 0;
  private explosions: Explosion[] = [];
  private comboMultiplier = 1;
  private comboTimer = 0;
  private pulseCooldown = 0; // 0 = listo, > 0 = recargando

  private lastTime: number | null = null;
  private rafId: number | null = null;
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
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.resetGame();
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("keydown", this.onKeyDown);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.lastTime = null; // evita dt acumulado al reanudar
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
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  // ── Inicialización ─────────────────────────────────────────────────────────

  private resetGame() {
    this.phase = "playing";
    this.theta = 0;
    this.targetTheta = 0;
    this.lives = LIVES_START;
    this.score = 0;
    this.level = 1;
    this.t = 0;
    this.balls = [];
    this.spawnTimer = 0;
    this.explosions = [];
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.pulseCooldown = 0;
    this.lastTime = null;
    this.gameOverNotified = false;
    this.lastStats = null;
    this.emitStats();
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onMouseMove = (e: MouseEvent) => {
    if (this.paused || this.phase === "gameover") return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const lx = (e.clientX - rect.left) * scaleX;
    const ly = (e.clientY - rect.top) * scaleY;
    this.targetTheta = Math.atan2(ly - CY, lx - CX);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!e.isTrusted || e.button !== 0) return; // ignora clics sintéticos (SPEC 10)
    this.firePulse();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      this.firePulse();
    }
  };

  private firePulse() {
    if (this.paused || this.phase === "gameover") return;
    if (this.pulseCooldown > 0) return;
    applyPulse(this.balls);
    this.pulseCooldown = PULSE_COOLDOWN;
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private loop = (now: number) => {
    if (!this.running || this.destroyed) return;
    if (!this.paused && this.phase !== "gameover") {
      const dt =
        this.lastTime !== null
          ? Math.min((now - this.lastTime) / 1000, MAX_DT)
          : 0;
      this.lastTime = now;
      this.update(dt);
    } else {
      this.lastTime = null;
    }
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.t += dt;
    this.theta = turnToward(this.theta, this.targetTheta, ARC_MAX_TURN * dt);

    // Nivel por tiempo
    const newLevel = 1 + Math.floor(this.t / SECONDS_PER_LEVEL);
    if (newLevel !== this.level) {
      this.level = newLevel;
      this.emitStats();
    }

    // Recarga del pulso
    if (this.pulseCooldown > 0) {
      this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    }

    // Temporizador del combo
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboMultiplier = 1;
      }
    }

    // Spawn de bolas hostiles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.balls.push(this.spawnBall());
      this.spawnTimer = spawnInterval(this.t);
    }

    // Mover todas las bolas
    for (const ball of this.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
    }

    // Devoluciones: bola hostil que toca el escudo
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (!ball.returned && hitsArc(ball, this.theta)) {
        this.balls[i] = reflect(ball);
        const pts = Math.min(
          MAX_SCORE,
          this.score + RETURN_SCORE * this.comboMultiplier,
        );
        if (pts !== this.score) {
          this.score = pts;
          this.emitStats();
        }
      }
    }

    // Colisiones entre bolas devueltas y hostiles → explosiones + combo
    const dead = new Set<number>();
    for (let i = 0; i < this.balls.length; i++) {
      if (dead.has(i)) continue;
      if (!this.balls[i].returned) continue;
      for (let j = 0; j < this.balls.length; j++) {
        if (dead.has(j) || i === j) continue;
        if (this.balls[j].returned) continue;
        if (ballsCollide(this.balls[i], this.balls[j])) {
          dead.add(i);
          dead.add(j);
          this.explosions.push({
            x: (this.balls[i].x + this.balls[j].x) / 2,
            y: (this.balls[i].y + this.balls[j].y) / 2,
            timer: 0.2,
          });
          // Avanzar combo
          if (this.comboTimer > 0) {
            this.comboMultiplier = Math.min(
              COMBO_MAX,
              this.comboMultiplier + 1,
            );
          } else {
            this.comboMultiplier = 1;
          }
          this.comboTimer = COMBO_WINDOW;
          const pts = Math.min(
            MAX_SCORE,
            this.score + KILL_SCORE * this.comboMultiplier,
          );
          if (pts !== this.score) {
            this.score = pts;
            this.emitStats();
          }
        }
      }
    }

    // Daño al núcleo y depuración de bolas
    const surviving: Ball[] = [];
    for (let i = 0; i < this.balls.length; i++) {
      if (dead.has(i)) continue;
      const ball = this.balls[i];

      // Fuera del canvas
      if (
        ball.x < -BALL_RADIUS * 2 ||
        ball.x > W + BALL_RADIUS * 2 ||
        ball.y < -BALL_RADIUS * 2 ||
        ball.y > H + BALL_RADIUS * 2
      ) {
        continue;
      }

      // Bola hostil que golpea el núcleo
      if (!ball.returned) {
        const dx = ball.x - CX;
        const dy = ball.y - CY;
        if (dx * dx + dy * dy < (CORE_RADIUS + BALL_RADIUS) ** 2) {
          this.lives -= 1;
          this.emitStats();
          if (this.lives <= 0) this.endGame();
          continue;
        }
      }

      surviving.push(ball);
    }
    this.balls = surviving;

    // Envejecer explosiones
    this.explosions = this.explosions
      .map((e) => ({ ...e, timer: e.timer - dt }))
      .filter((e) => e.timer > 0);
  }

  private spawnBall(): Ball {
    // Posición aleatoria en el perímetro del canvas
    const perimeter = 2 * (W + H);
    const pos = Math.random() * perimeter;
    let sx: number, sy: number;
    if (pos < W) {
      sx = pos;
      sy = 0;
    } else if (pos < W + H) {
      sx = W;
      sy = pos - W;
    } else if (pos < 2 * W + H) {
      sx = 2 * W + H - pos;
      sy = H;
    } else {
      sx = 0;
      sy = 2 * (W + H) - pos;
    }

    const dx = CX - sx;
    const dy = CY - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = ballSpeed(this.level);

    return {
      x: sx,
      y: sy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      returned: false,
    };
  }

  // ── Fin de partida ─────────────────────────────────────────────────────────

  private endGame() {
    this.phase = "gameover";
    if (!this.gameOverNotified) {
      this.gameOverNotified = true;
      this.callbacks.onGameOver(this.score);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  private emitStats() {
    const next: GameStats = {
      score: this.score,
      lives: this.lives,
      level: this.level,
    };
    if (
      !this.lastStats ||
      next.score !== this.lastStats.score ||
      next.lives !== this.lastStats.lives ||
      next.level !== this.lastStats.level
    ) {
      this.lastStats = next;
      this.callbacks.onStats(next);
    }
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  private draw() {
    const { ctx } = this;

    // Fondo
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    this.drawPulseRing();
    this.drawExplosions();
    this.drawBalls();
    this.drawCore();
    this.drawShield();
  }

  private drawPulseRing() {
    if (this.phase === "gameover") return;
    const { ctx } = this;
    const ringRadius = ARC_RADIUS + ARC_THICKNESS + 14;
    const ready = this.pulseCooldown === 0;
    const filled = ready ? 1 : 1 - this.pulseCooldown / PULSE_COOLDOWN;

    if (ready) {
      // Anillo completo brillante: pulso disponible
      ctx.beginPath();
      ctx.arc(CX, CY, ringRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = PULSE_COLOR;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // Arco de progreso desde arriba (−π/2), sentido horario
      ctx.beginPath();
      ctx.arc(
        CX,
        CY,
        ringRadius,
        -Math.PI / 2,
        -Math.PI / 2 + filled * 2 * Math.PI,
      );
      ctx.strokeStyle = PULSE_COLOR;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  private drawBalls() {
    const { ctx } = this;
    for (const ball of this.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = ball.returned ? RETURNED_COLOR : BALL_COLOR;
      ctx.fill();
    }
  }

  private drawExplosions() {
    const { ctx } = this;
    for (const exp of this.explosions) {
      const progress = 1 - exp.timer / 0.2; // 0 → 1 conforme pasa el tiempo
      const radius = BALL_RADIUS * 2 + progress * BALL_RADIUS * 4;
      const alpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 200, 255, ${alpha})`;
      ctx.fill();
    }
  }

  private drawCore() {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(CX, CY, CORE_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = CORE_COLOR;
    ctx.fill();
  }

  private drawShield() {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(
      CX,
      CY,
      ARC_RADIUS,
      this.theta - ARC_SPAN / 2,
      this.theta + ARC_SPAN / 2,
    );
    ctx.strokeStyle = ARC_COLOR;
    ctx.lineWidth = ARC_THICKNESS;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}
