import {
  BOMB_CHANCE,
  BOMB_FLASH,
  H,
  POINTS,
  POWERUP_TYPES,
  SHIELD_DURATION,
  SHIELD_GRACE,
  SHIELD_PAD,
  TRIPLE_DURATION,
  W,
  dist,
  rand,
  randInt,
  type AsteroidsState,
  type PowerUpType,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type Keys,
} from "./entities";

export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por partida
}

const GAME_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export class AsteroidsEngine {
  private ctx: CanvasRenderingContext2D;

  private ship = new Ship();
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: AsteroidsState = "playing";
  private deadTimer = 0;

  // Power-ups
  private powerUps: PowerUp[] = [];
  private powerUpSpawned = false; // el triple aparece una sola vez por partida...
  private tripleLevel = 1; // ...en esta ronda
  private powerUpSpawnTimer = 0;
  private tripleShotTimer = 0;
  private shieldSpawned = false;
  private shieldSpawnTimer = 0;
  private shieldTimer = 0;
  private shieldGrace = 0; // margen tras absorber un golpe: los fragmentos nacen junto a la nave
  private bombSpawnTimer = -1; // < 0: no aparece esta ronda
  private hasBomb = false;
  private bombFlash = 0;

  private keys: Keys = {};
  private justPressed: Keys = {};

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private running = false;
  private paused = false;

  private lastStats: AsteroidsStats | null = null;
  private gameOverNotified = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: AsteroidsCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this.initGame();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.lastTime = null;
    this.emitStats();
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    // Al reanudar, el primer frame no debe acumular el tiempo en pausa
    this.lastTime = null;
  }

  // Termina la partida con el puntaje actual (botón FIN)
  finish() {
    if (!this.running || this.state === "gameover") return;
    this.state = "gameover";
    this.removeInput();
    this.notifyGameOver();
  }

  destroy() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.removeInput();
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    // No interferir con la escritura en campos de texto (p. ej. el modal)
    if (e.target instanceof HTMLInputElement) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (this.paused) return; // en pausa no se acumulan pulsaciones
    this.justPressed[e.code] = !this.keys[e.code];
    this.keys[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private removeInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.keys = {};
    this.justPressed = {};
  }

  private pressed(code: string) {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  // ── Estado de la partida ────────────────────────────────────────────────────
  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.lastStats = null;
    this.gameOverNotified = false;
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.tripleLevel = randInt(1, 3);
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.shieldGrace = 0;
    this.hasBomb = false;
    this.bombFlash = 0;
    this.resetRoundPowerUps();
    this.spawnAsteroids(4);
  }

  // El escudo aparece una vez por ronda, salvo en la ronda del disparo triple
  private resetRoundPowerUps() {
    this.powerUpSpawnTimer = rand(5, 12);
    this.shieldSpawned = this.level === this.tripleLevel;
    this.shieldSpawnTimer = rand(6, 18);
    // La Bomba Nova es escasa: solo aparece en algunas rondas
    this.bombSpawnTimer = Math.random() < BOMB_CHANCE ? rand(8, 25) : -1;
  }

  // Destruye todos los asteroides en pantalla (sin fragmentarlos)
  private detonateBomb() {
    this.hasBomb = false;
    this.bombFlash = BOMB_FLASH;
    for (const a of this.asteroids) {
      this.score += POINTS[a.size];
      this.explode(a.x, a.y, a.size * 5);
    }
    this.asteroids = [];
  }

  private spawnPowerUp(type: PowerUpType) {
    let x: number, y: number;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (dist({ x, y }, this.ship) < 150);
    this.powerUps.push(new PowerUp(x, y, type));
  }

  private nextLevel() {
    this.level++;
    this.resetRoundPowerUps();
    this.bullets = [];
    this.particles = [];
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.tripleShotTimer = 0;
    this.shieldTimer = 0;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
      this.removeInput();
      this.notifyGameOver();
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }

  // ── Contrato con la plataforma ──────────────────────────────────────────────
  // Solo emite cuando cambia score, lives o level (no en cada frame)
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

  private notifyGameOver() {
    if (this.gameOverNotified) return;
    this.gameOverNotified = true;
    this.emitStats();
    this.callbacks.onGameOver(this.score);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  private update(dt: number) {
    if (this.state === "gameover") {
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }

    // Disparar
    if (this.pressed("Space")) {
      this.bullets.push(...this.ship.tryShoot(this.tripleShotTimer > 0));
    }
    if (this.pressed("KeyB") && this.hasBomb) this.detonateBomb();
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt);

    if (this.shieldGrace > 0)
      this.shieldGrace = Math.max(0, this.shieldGrace - dt);
    this.ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (this.ship.invincible <= 0 && this.shieldGrace <= 0) {
      const reach = this.ship.radius + (this.shieldTimer > 0 ? SHIELD_PAD : 0);
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < reach + a.radius * 0.82) {
          if (this.shieldTimer > 0) {
            // El escudo absorbe el impacto y destruye el asteroide; los fragmentos
            // que nacen pegados a la nave no pueden matarla en el acto
            this.shieldTimer = 0;
            this.shieldGrace = SHIELD_GRACE;
            a.dead = true;
            this.explode(a.x, a.y, a.size * 5);
            this.asteroids = this.asteroids
              .filter((x) => !x.dead)
              .concat(a.split());
          } else {
            this.killShip();
          }
          break;
        }
      }
    }

    // Power-ups: aparición, recogida y duración del efecto
    if (this.tripleShotTimer > 0)
      this.tripleShotTimer = Math.max(0, this.tripleShotTimer - dt);
    if (this.shieldTimer > 0)
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (!this.powerUpSpawned && this.level === this.tripleLevel) {
      this.powerUpSpawnTimer -= dt;
      if (this.powerUpSpawnTimer <= 0) {
        this.spawnPowerUp("triple");
        this.powerUpSpawned = true;
      }
    }
    if (!this.shieldSpawned) {
      this.shieldSpawnTimer -= dt;
      if (this.shieldSpawnTimer <= 0) {
        this.spawnPowerUp("shield");
        this.shieldSpawned = true;
      }
    }
    if (this.bombSpawnTimer >= 0) {
      this.bombSpawnTimer -= dt;
      if (this.bombSpawnTimer < 0) {
        if (!this.hasBomb) this.spawnPowerUp("bomb");
        this.bombSpawnTimer = -1;
      }
    }
    for (const p of this.powerUps) {
      p.update(dt);
      if (
        !p.dead &&
        this.state === "playing" &&
        !this.ship.dead &&
        dist(this.ship, p) < this.ship.radius + p.radius
      ) {
        if (p.type === "triple") this.tripleShotTimer = TRIPLE_DURATION;
        else if (p.type === "shield") this.shieldTimer = SHIELD_DURATION;
        else this.hasBomb = true;
        p.dead = true;
        this.explode(p.x, p.y, 6);
      }
    }
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  private draw() {
    const { ctx } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    this.powerUps.forEach((p) => p.draw(ctx));
    this.ship.draw(ctx);
    this.drawShield();

    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${((this.bombFlash / BOMB_FLASH) * 0.8).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawPowerUpIndicators();
  }

  private drawShield() {
    const { ctx, ship, shieldTimer } = this;
    if (shieldTimer <= 0 || ship.dead) return;
    // Parpadeo durante el último segundo
    if (shieldTimer < 1 && Math.floor(shieldTimer * 10) % 2 === 0) return;
    ctx.save();
    ctx.strokeStyle = POWERUP_TYPES.shield.color;
    ctx.fillStyle = "rgba(68,255,68,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius + SHIELD_PAD, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Puntos, vidas y nivel los pinta el HUD de la plataforma; aquí solo los power-ups activos
  private drawPowerUpIndicators() {
    const { ctx } = this;
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    let hudY = 26;
    if (this.tripleShotTimer > 0) {
      ctx.fillStyle = POWERUP_TYPES.triple.color;
      ctx.fillText(`TRIPLE ${Math.ceil(this.tripleShotTimer)}s`, 14, hudY);
      hudY += 20;
    }
    if (this.shieldTimer > 0) {
      ctx.fillStyle = POWERUP_TYPES.shield.color;
      ctx.fillText(`ESCUDO ${Math.ceil(this.shieldTimer)}s`, 14, hudY);
      hudY += 20;
    }
    if (this.hasBomb) {
      ctx.fillStyle = POWERUP_TYPES.bomb.color;
      ctx.fillText("BOMBA NOVA [B]", 14, hudY);
    }
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  private loop = (ts: number) => {
    if (!this.running) return;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this.update(dt);
      this.emitStats();
      this.draw();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}
