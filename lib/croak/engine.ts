"use client";

import type { GameCallbacks, GameEngine, GameStats } from "@/lib/game-engine";
import { DEFAULT_SKIN, type SkinId } from "@/lib/game-types";
import {
  AIM_START,
  FROG_R,
  H,
  LILY_POSITIONS,
  LILY_R,
  LILY_Y,
  MAX_DT_MS,
  MAX_SCORE,
  ROUND_DURATION_MS,
  W,
  type Bug,
  type Phase,
  type Tongue,
} from "./constants";
import {
  bugEscaped,
  extendTongue,
  jumpArc,
  moveBugs,
  retractTongue,
  spawnBug,
  tongueHitsBug,
} from "./entities";
import { type CroakPalette, SKINS } from "./skins";

// ── Motor ──────────────────────────────────────────────────────────────────

export class CroakEngine implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private readonly palette: CroakPalette;

  // Estado de partida
  private phase: Phase = "ready";
  private score = 0;
  private round = 1;
  private combo = 1;
  private catchesThisRound = 0;
  private roundTimeLeft = ROUND_DURATION_MS;

  // Posición de la rana
  private lilyIndex = 2; // índice en LILY_POSITIONS (0–4)

  // Salto (animación, paso 5)
  private jumping = false;
  private jumpFromX: number = LILY_POSITIONS[2];
  private jumpToX: number = LILY_POSITIONS[2];
  private jumpProgress = 0;

  // Apuntado
  private aimAngle = AIM_START; // grados: 0=derecha, 90=arriba, 180=izquierda
  private keysHeld: Record<string, boolean> = {};
  private jumpPending: -1 | 0 | 1 = 0; // dirección de salto pendiente

  // Lengua (paso 6)
  private tongue: Tongue | null = null;

  // Insectos (paso 7)
  private bugs: Bug[] = [];
  private spawnTimer = 0;

  // Transición de ronda (paso 8)
  private roundEndTimer = 0;

  // Loop
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private destroyed = false;
  private paused = false;

  // Stats
  private lastStats: GameStats | null = null;
  private gameOverNotified = false;

  constructor(
    canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
    options?: { skin?: SkinId },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.palette = SKINS[options?.skin ?? DEFAULT_SKIN];
    canvas.width = W;
    canvas.height = H;
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.resetGame();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.lastTime = null;
    // Evitar teclas pegadas al reanudar
    if (paused) this.keysHeld = {};
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
    window.removeEventListener("keyup", this.onKeyUp);
  }

  // ── Inicialización ─────────────────────────────────────────────────────────

  private resetGame() {
    this.phase = "ready";
    this.score = 0;
    this.round = 1;
    this.combo = 1;
    this.catchesThisRound = 0;
    this.roundTimeLeft = ROUND_DURATION_MS;
    this.roundEndTimer = 0;
    this.lilyIndex = 2;
    this.jumping = false;
    this.jumpFromX = LILY_POSITIONS[2];
    this.jumpToX = LILY_POSITIONS[2];
    this.jumpProgress = 0;
    this.aimAngle = AIM_START;
    this.tongue = null;
    this.bugs = [];
    this.spawnTimer = 0;
    this.keysHeld = {};
    this.jumpPending = 0;
    this.gameOverNotified = false;
    this.lastStats = null;
    this.emitStats();
  }

  private startNextRound() {
    this.round++;
    this.roundTimeLeft = ROUND_DURATION_MS;
    this.catchesThisRound = 0;
    this.tongue = null;
    this.bugs = [];
    this.spawnTimer = 0;
    this.jumping = false;
    this.lilyIndex = 2;
    this.jumpFromX = LILY_POSITIONS[2];
    this.jumpToX = LILY_POSITIONS[2];
    this.jumpProgress = 0;
    this.phase = "playing";
    this.emitStats();
  }

  // ── Teclado ────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }
    if (this.paused || this.phase === "gameover" || this.phase === "round_end")
      return;

    this.keysHeld[e.code] = true;

    if (e.code === "ArrowLeft" && !e.repeat) this.jumpPending = -1;
    if (e.code === "ArrowRight" && !e.repeat) this.jumpPending = 1;

    if (this.phase === "ready" && e.code === "Space") {
      this.phase = "playing";
      return;
    }

    if (e.code === "Space" && !e.repeat && this.canFire) {
      this.fireTongue();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld[e.code] = false;
  };

  // ── Loop ───────────────────────────────────────────────────────────────────

  private loop = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const raw = this.lastTime === null ? 0 : now - this.lastTime;
    this.lastTime = now;
    if (this.paused) return;

    const dt = Math.min(raw, MAX_DT_MS);
    this.update(dt);
    this.draw();
  };

  // ── Update ─────────────────────────────────────────────────────────────────

  private update(dt: number) {
    // Transición de fin de ronda
    if (this.phase === "round_end") {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) this.startNextRound();
      return;
    }

    if (this.phase !== "playing") return;

    // Temporizador de ronda
    this.roundTimeLeft -= dt;
    if (this.roundTimeLeft <= 0) {
      this.roundTimeLeft = 0;
      if (this.catchesThisRound === 0) {
        this.endGame();
      } else {
        this.phase = "round_end";
        this.roundEndTimer = 2200;
        this.tongue = null;
      }
      return;
    }

    // Ajustar ángulo de apuntado con flechas arriba/abajo
    if (this.keysHeld["ArrowUp"]) {
      this.aimAngle = Math.min(180, this.aimAngle + (120 * dt) / 1000);
    }
    if (this.keysHeld["ArrowDown"]) {
      this.aimAngle = Math.max(0, this.aimAngle - (120 * dt) / 1000);
    }

    // Salto entre nenúfares (paso 5: animación de arco)
    if (!this.jumping && this.jumpPending !== 0) {
      const next = this.lilyIndex + this.jumpPending;
      if (next >= 0 && next < LILY_POSITIONS.length) {
        this.jumping = true;
        this.jumpFromX = LILY_POSITIONS[this.lilyIndex];
        this.jumpToX = LILY_POSITIONS[next];
        this.jumpProgress = 0;
        this.lilyIndex = next;
      }
      this.jumpPending = 0;
    }

    if (this.jumping) {
      this.jumpProgress = Math.min(
        1,
        this.jumpProgress + dt / 200, // 200 ms de duración
      );
      if (this.jumpProgress >= 1) {
        this.jumping = false;
        this.jumpFromX = this.jumpToX;
      }
    }

    this.updateTongue(dt);
    this.updateBugs(dt);
  }

  // ── Insectos ───────────────────────────────────────────────────────────────

  private updateBugs(dt: number) {
    moveBugs(this.bugs, dt);

    // Eliminar insectos que han salido del canvas
    this.bugs = this.bugs.filter((b) => b.alive && !bugEscaped(b));

    // Spawning
    const maxBugs = Math.min(2 + this.round, 8);
    const interval = Math.max(800, 2500 - this.round * 200);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.bugs.length < maxBugs) {
      const bug = spawnBug(this.round);
      bug.blink = 400; // destello al aparecer
      this.bugs.push(bug);
      this.spawnTimer = interval;
    }
  }

  // ── Lengua ─────────────────────────────────────────────────────────────────

  private fireTongue() {
    const { x, y } = this.frogPos();
    const frogTop = y - LILY_R * 0.55 - FROG_R;
    this.tongue = {
      originX: x,
      originY: frogTop,
      angle: this.aimAngle,
      extending: true,
      retracting: false,
      caught: null,
      length: 0,
    };
  }

  private updateTongue(dt: number) {
    const t = this.tongue;
    if (!t) return;

    if (t.extending) {
      extendTongue(t, dt);

      // Colisión con insectos (paso 7: se rellenará con bugs reales)
      const hit = tongueHitsBug(t, this.bugs);
      if (hit) {
        hit.alive = false;
        t.caught = hit;
        t.extending = false;
        t.retracting = true;
        return;
      }

      // Tip de la lengua
      const rad = (t.angle * Math.PI) / 180;
      const tipX = t.originX + t.length * Math.cos(rad);
      const tipY = t.originY - t.length * Math.sin(rad);

      // Retractar si sale del canvas
      if (tipX < 0 || tipX > W || tipY < 0 || tipY > H) {
        t.extending = false;
        t.retracting = true;
      }
    } else if (t.retracting) {
      retractTongue(t, dt);
      if (t.caught) {
        // Mover insecto atrapado con la lengua (paso 7)
        const rad = (t.angle * Math.PI) / 180;
        t.caught.x = t.originX + t.length * Math.cos(rad);
        t.caught.y = t.originY - t.length * Math.sin(rad);
      }
      if (t.length <= 0) {
        if (t.caught) {
          // Captura: sumar puntos con combo
          const points = t.caught.basePoints * this.combo;
          this.score = Math.min(MAX_SCORE, this.score + points);
          this.combo = Math.min(5, this.combo + 1);
          this.catchesThisRound++;
          // Eliminar el insecto del array
          const idx = this.bugs.indexOf(t.caught);
          if (idx !== -1) this.bugs.splice(idx, 1);
          this.emitStats();
        } else {
          this.combo = 1; // Fallo: resetear combo
        }
        this.tongue = null;
      }
    }
  }

  // ── Posición actual de la rana ─────────────────────────────────────────────

  private frogPos(): { x: number; y: number } {
    if (this.jumping) {
      return jumpArc(this.jumpFromX, this.jumpToX, this.jumpProgress);
    }
    return { x: LILY_POSITIONS[this.lilyIndex], y: LILY_Y };
  }

  // La lengua no puede dispararse durante un salto ni mientras ya hay una en vuelo
  private get canFire(): boolean {
    return !this.jumping && this.tongue === null && this.phase === "playing";
  }

  // ── Game over ──────────────────────────────────────────────────────────────

  private endGame() {
    this.phase = "gameover";
    if (!this.gameOverNotified) {
      this.gameOverNotified = true;
      this.callbacks.onGameOver(Math.min(this.score, MAX_SCORE));
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  private emitStats() {
    const next: GameStats = { score: this.score, level: this.round };
    if (
      this.lastStats?.score === next.score &&
      this.lastStats?.level === next.level
    )
      return;
    this.lastStats = next;
    this.callbacks.onStats(next);
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  private draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);

    this.drawBackground();
    this.drawLilyPads();
    this.drawBugs();
    if (!this.tongue) this.drawAimLine();
    this.drawTongue();
    this.drawFrog();
    this.drawCombo();
    this.drawTimerBar();

    if (this.phase === "ready") this.drawReadyScreen();
    if (this.phase === "round_end") this.drawRoundEnd();
  }

  private drawTimerBar() {
    if (this.phase === "ready" || this.phase === "gameover") return;
    const { ctx, palette } = this;
    const ratio = Math.max(0, this.roundTimeLeft / ROUND_DURATION_MS);
    const barH = 8;
    const barW = W - 40;
    const bx = 20;
    const by = 16;

    // Fondo de la barra
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(bx, by, barW, barH);

    // Relleno con color según tiempo restante
    const color =
      ratio > 0.5
        ? palette.timerHigh
        : ratio > 0.25
          ? palette.timerMid
          : palette.timerLow;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.shadowBlur = 0;

    // Borde
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
  }

  private drawCombo() {
    if (this.combo <= 1 || this.phase !== "playing") return;
    const { ctx, palette } = this;
    const { x, y } = this.frogPos();
    const comboY = y - LILY_R * 0.55 - FROG_R * 2 - 10;

    ctx.save();
    ctx.font = `bold 14px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = palette.comboColor;
    ctx.shadowColor = palette.comboColor;
    ctx.shadowBlur = 10;
    ctx.fillText(`x${this.combo}`, x, comboY);
    ctx.restore();
  }

  private drawRoundEnd() {
    const { ctx, palette } = this;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = palette.uiAccent;
    ctx.font = `bold 22px "Press Start 2P", monospace`;
    ctx.shadowColor = palette.uiAccent;
    ctx.shadowBlur = 18;
    ctx.fillText(`RONDA ${this.round - 1} COMPLETADA`, W / 2, H / 2 - 24);

    ctx.font = `bold 14px "Press Start 2P", monospace`;
    ctx.fillStyle = palette.uiSub;
    ctx.shadowColor = palette.uiSub;
    ctx.shadowBlur = 10;
    ctx.fillText(`RONDA ${this.round} — PREPARATE`, W / 2, H / 2 + 18);
    ctx.restore();
  }

  private drawBugs() {
    const { ctx } = this;
    const now = Date.now();

    for (const bug of this.bugs) {
      if (!bug.alive) continue;

      ctx.save();

      // Parpadeo de aparición
      if (bug.blink > 0) {
        ctx.globalAlpha = 0.4 + 0.6 * (1 - bug.blink / 400);
      }

      switch (bug.kind) {
        case "fly":
          this.drawFly(ctx, bug.x, bug.y, now);
          break;
        case "dragonfly":
          this.drawDragonfly(ctx, bug.x, bug.y, now);
          break;
        case "firefly":
          this.drawFirefly(ctx, bug.x, bug.y, now);
          break;
      }

      ctx.restore();
    }
  }

  private drawFly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    now: number,
  ) {
    const { palette } = this;
    const pulse = 0.85 + 0.15 * Math.sin(now / 120 + x);
    ctx.fillStyle = palette.flyBody;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * pulse, 5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    // Alas
    ctx.fillStyle = palette.flyWing;
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 2, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - 2, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = palette.flyEye;
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDragonfly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    now: number,
  ) {
    const { palette } = this;
    const wing = 0.7 + 0.3 * Math.sin(now / 60 + x);
    // Cuerpo
    ctx.fillStyle = palette.dragonflyBody;
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Alas (4) — alpha dinámico basado en wing
    ctx.fillStyle = `rgba(${palette.dragonflyWingRgb},${0.45 * wing})`;
    ctx.beginPath();
    ctx.ellipse(x - 9, y - 3, 8, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 9, y - 3, 8, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 8, y + 2, 6, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 2, 6, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = palette.dragonflyEye;
    ctx.beginPath();
    ctx.arc(x - 2, y - 7, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2, y - 7, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFirefly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    now: number,
  ) {
    const { palette } = this;
    const glow = 0.5 + 0.5 * Math.sin(now / 400 + x * 0.05);
    // Halo — alpha dinámico basado en glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
    grad.addColorStop(0, `rgba(${palette.fireflyHaloRgb},${0.35 * glow})`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
    // Cuerpo
    ctx.fillStyle = palette.fireflyBody;
    ctx.shadowColor = palette.fireflyGlow;
    ctx.shadowBlur = 8 * glow;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Alas translúcidas — alpha dinámico basado en glow
    ctx.fillStyle = `rgba(${palette.fireflyWingRgb},${0.3 * glow})`;
    ctx.beginPath();
    ctx.ellipse(x - 7, y, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y, 5, 3, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawAimLine() {
    if (this.phase !== "playing" && this.phase !== "ready") return;
    const { ctx, palette } = this;
    const { x, y } = this.frogPos();
    const frogTop = y - LILY_R * 0.55 - FROG_R;
    const rad = (this.aimAngle * Math.PI) / 180;
    const guideLen = 130;
    const ex = frogTop + guideLen * Math.cos(rad);
    const ey = frogTop - guideLen * Math.sin(rad);

    ctx.save();
    ctx.strokeStyle = palette.aimLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -(Date.now() / 80) % 11;
    ctx.beginPath();
    ctx.moveTo(x, frogTop);
    ctx.lineTo(
      x + guideLen * Math.cos(rad),
      frogTop - guideLen * Math.sin(rad),
    );
    ctx.stroke();

    // Punta de flecha
    ctx.setLineDash([]);
    ctx.fillStyle = palette.aimTip;
    ctx.beginPath();
    ctx.arc(
      x + guideLen * Math.cos(rad),
      frogTop - guideLen * Math.sin(rad),
      3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    void ex;
    void ey; // usados implícitamente arriba
  }

  private drawTongue() {
    const t = this.tongue;
    if (!t) return;
    const { ctx, palette } = this;
    const rad = (t.angle * Math.PI) / 180;
    const tipX = t.originX + t.length * Math.cos(rad);
    const tipY = t.originY - t.length * Math.sin(rad);

    ctx.save();
    ctx.strokeStyle = palette.tongue;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.shadowColor = palette.tongue;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(t.originX, t.originY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Punta de la lengua (bola)
    ctx.fillStyle = palette.tongueTip;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBackground() {
    const { ctx, palette } = this;

    // Fondo de pantano nocturno
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    // Agua en la parte inferior
    const water = ctx.createLinearGradient(0, LILY_Y - 40, 0, H);
    water.addColorStop(0, "transparent");
    water.addColorStop(1, palette.waterDeep);
    ctx.fillStyle = water;
    ctx.fillRect(0, LILY_Y - 40, W, H - (LILY_Y - 40));

    // Líneas de reflejo en el agua
    ctx.strokeStyle = palette.waterReflect;
    ctx.lineWidth = 1;
    for (let y = LILY_Y + 20; y < H; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Luciérnagas de fondo (puntos fijos decorativos)
    const fireflies = [
      { x: 80, y: 120 },
      { x: 320, y: 80 },
      { x: 560, y: 150 },
      { x: 700, y: 60 },
      { x: 140, y: 240 },
      { x: 660, y: 200 },
    ];
    for (const ff of fireflies) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 800 + ff.x);
      const grad = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, 10);
      grad.addColorStop(0, palette.bgFirefly);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ff.x, ff.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawLilyPads() {
    const { ctx, palette } = this;

    for (let i = 0; i < LILY_POSITIONS.length; i++) {
      const px = LILY_POSITIONS[i];
      const py = LILY_Y;
      const isActive = i === this.lilyIndex;

      // Sombra en el agua
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(px, py + 12, LILY_R * 0.9, LILY_R * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Nenúfar (elipse verde)
      ctx.save();
      const grad = ctx.createRadialGradient(
        px - LILY_R * 0.3,
        py - LILY_R * 0.3,
        2,
        px,
        py,
        LILY_R,
      );
      grad.addColorStop(
        0,
        isActive ? palette.lilyHlActive : palette.lilyHlInactive,
      );
      grad.addColorStop(
        0.6,
        isActive ? palette.lilyMidActive : palette.lilyMidInactive,
      );
      grad.addColorStop(1, palette.lilyDark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, LILY_R, LILY_R * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hendidura del nenúfar
      ctx.strokeStyle = isActive
        ? palette.lilySplitActive
        : palette.lilySplitInactive;
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(px, py - LILY_R * 0.55);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.restore();

      // Borde de neón en el nenúfar activo
      if (isActive) {
        ctx.save();
        ctx.strokeStyle = palette.lilyRimActive;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = palette.lilyGlow;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(px, py, LILY_R, LILY_R * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawFrog() {
    const { ctx, palette } = this;
    const { x: fx, y: fy } = this.frogPos();
    const frogTop = fy - LILY_R * 0.55 - FROG_R;

    ctx.save();

    // Cuerpo
    ctx.fillStyle = palette.frogBody;
    ctx.shadowColor = palette.frogGlow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(fx, frogTop, FROG_R * 0.85, FROG_R * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = palette.frogHead;
    ctx.beginPath();
    ctx.ellipse(
      fx,
      frogTop - FROG_R * 0.45,
      FROG_R * 0.7,
      FROG_R * 0.55,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.shadowBlur = 0;

    // Ojos
    const eyeY = frogTop - FROG_R * 0.7;
    for (const ex of [fx - FROG_R * 0.38, fx + FROG_R * 0.38]) {
      ctx.fillStyle = palette.frogHead;
      ctx.beginPath();
      ctx.arc(ex, eyeY, FROG_R * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.frogPupil;
      ctx.beginPath();
      ctx.arc(ex, eyeY, FROG_R * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }

    // Patas traseras
    ctx.strokeStyle = palette.frogBody;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [sx, ex] of [
      [fx - FROG_R * 0.7, fx - FROG_R * 1.2],
      [fx + FROG_R * 0.7, fx + FROG_R * 1.2],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(sx, frogTop + FROG_R * 0.4);
      ctx.lineTo(ex, frogTop + FROG_R * 0.7);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawReadyScreen() {
    const { ctx, palette } = this;
    ctx.save();
    ctx.fillStyle = palette.readyText;
    ctx.font = `bold 18px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = palette.uiSub;
    ctx.shadowBlur = 14;
    ctx.fillText("PULSA ESPACIO PARA EMPEZAR", W / 2, H / 2 - 20);
    ctx.restore();
  }
}
